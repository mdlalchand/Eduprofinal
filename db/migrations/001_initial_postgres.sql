-- EDUPro Production PostgreSQL Schema & Initial Migration
-- Enforces Single Main Admin, strict role domain, Branch lifecycle FKs, and transactional finance.

BEGIN;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  manager_name TEXT NOT NULL DEFAULT '',
  active_students INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'suspended', 'archived')),
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_branches_status ON branches(status);

CREATE TABLE IF NOT EXISTS branch_status_history (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  branch_name TEXT NOT NULL,
  previous_status TEXT NOT NULL CHECK (previous_status IN ('active', 'inactive', 'suspended', 'archived')),
  new_status TEXT NOT NULL CHECK (new_status IN ('active', 'inactive', 'suspended', 'archived')),
  reason TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'guardian', 'branch')),
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  roll_number TEXT UNIQUE,
  guardian_linked_student_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  bio TEXT,
  subject_specialty TEXT,
  education TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  approval_note TEXT,
  password_hash TEXT NOT NULL DEFAULT '',
  must_reset_password BOOLEAN NOT NULL DEFAULT FALSE,
  password_updated_at TIMESTAMPTZ,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_recovery_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
  communication_consent JSONB NOT NULL DEFAULT '{"email":true,"sms":true,"whatsapp":true}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Database-level enforcement: AT MOST ONE Main Admin account on the entire platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_main_admin ON users(role) WHERE role = 'admin';
CREATE INDEX IF NOT EXISTS idx_users_role_branch ON users(role, branch_id);

CREATE TABLE IF NOT EXISTS revoked_legacy_accounts (
  id TEXT PRIMARY KEY,
  original_user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  previous_role TEXT NOT NULL,
  branch_id TEXT,
  reason TEXT NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  category TEXT NOT NULL,
  level_tag TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  original_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  enrolled_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  instructor_id TEXT NOT NULL,
  seat_limit INTEGER NOT NULL DEFAULT 40,
  enrolled_seats INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  lifecycle_status TEXT,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_sessions (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  gateway TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('sandbox', 'live')),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL CHECK (status IN ('initiated', 'pending_verification', 'verified', 'failed', 'expired')),
  provider_payment_id TEXT,
  checkout_url TEXT,
  trx_id TEXT,
  webhook_verified_at TIMESTAMPTZ,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL,
  trx_id TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('student', 'teacher', 'staff')),
  target_id TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  att_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave', 'excused')),
  recorded_by TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  UNIQUE (target_type, target_id, att_date, batch_id)
);

CREATE TABLE IF NOT EXISTS integration_configs (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mode TEXT NOT NULL DEFAULT 'sandbox',
  configured BOOLEAN NOT NULL DEFAULT FALSE,
  health_status TEXT NOT NULL DEFAULT 'awaiting_configuration',
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  public_config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  secrets_encrypted_json TEXT NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS communication_logs (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push', 'in_app')),
  provider TEXT NOT NULL,
  recipient TEXT NOT NULL,
  recipient_user_id TEXT,
  subject TEXT,
  body_preview TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'accepted', 'delivered', 'failed', 'skipped_opt_out')),
  provider_message_id TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  category TEXT,
  severity TEXT,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
