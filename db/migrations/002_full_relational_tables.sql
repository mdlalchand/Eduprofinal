-- EDUPro Full Relational PostgreSQL Migration 002
-- Adds versioned migration tracking and all academic, LMS, finance, security, and collection tables.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start BIGINT NOT NULL,
  locked_until BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  role_title TEXT NOT NULL,
  education TEXT NOT NULL,
  panel TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  bio TEXT NOT NULL,
  avatar TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS academic_years (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL CHECK (status IN ('active', 'upcoming', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_classes (
  id TEXT PRIMARY KEY,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL,
  section_name TEXT NOT NULL,
  room_label TEXT,
  capacity INTEGER NOT NULL DEFAULT 40,
  class_teacher_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived')),
  UNIQUE (academic_year_id, branch_id, class_name, section_name)
);

CREATE TABLE IF NOT EXISTS academic_subjects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  class_level TEXT NOT NULL,
  course_id TEXT,
  credits_or_marks INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL CHECK (status IN ('active', 'archived'))
);

CREATE TABLE IF NOT EXISTS course_routines (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  subject_id TEXT REFERENCES academic_subjects(id) ON DELETE SET NULL,
  teacher_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room_or_link TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS student_admissions (
  id TEXT PRIMARY KEY,
  admission_no TEXT NOT NULL UNIQUE,
  student_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  academic_year_id TEXT NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
  class_section_id TEXT REFERENCES academic_classes(id) ON DELETE SET NULL,
  guardian_name TEXT,
  guardian_phone TEXT,
  blood_group TEXT,
  emergency_contact TEXT,
  admission_fee_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  admission_status TEXT NOT NULL CHECK (admission_status IN ('active', 'promoted', 'transferred', 'completed', 'suspended')),
  admitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT,
  batch_id TEXT,
  lesson_type TEXT NOT NULL,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  watched_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  percent_watched INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  last_position_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id TEXT,
  title TEXT NOT NULL,
  due_date TEXT,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  batch_id TEXT,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  certificate_number TEXT NOT NULL UNIQUE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  batch_id TEXT,
  title TEXT NOT NULL,
  visibility TEXT NOT NULL,
  teacher_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_session_starts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  UNIQUE (exam_id, user_id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  roll_number TEXT NOT NULL,
  score NUMERIC(10,2) NOT NULL,
  total_marks NUMERIC(10,2) NOT NULL,
  percentage NUMERIC(6,2) NOT NULL,
  passed BOOLEAN NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_invoices (
  id TEXT PRIMARY KEY,
  invoice_no TEXT NOT NULL UNIQUE,
  student_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  fee_type TEXT NOT NULL,
  title TEXT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12,2) NOT NULL,
  due_date TEXT NOT NULL,
  installment_plan_label TEXT,
  status TEXT NOT NULL CHECK (status IN ('unpaid', 'partial', 'paid', 'overdue', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_gateways (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  gateway TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  payload_json JSONB NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_pickup_id TEXT,
  total_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id TEXT PRIMARY KEY,
  attendance_id TEXT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  target_name TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  reason TEXT NOT NULL,
  corrected_by_id TEXT NOT NULL,
  corrected_by_name TEXT NOT NULL,
  corrected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payrolls (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  month_key TEXT NOT NULL,
  net_salary NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_records (
  id TEXT PRIMARY KEY,
  rec_type TEXT NOT NULL CHECK (rec_type IN ('income', 'expense', 'refund')),
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  rec_date TEXT NOT NULL,
  payload_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  action_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  reason TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  summary_json JSONB NOT NULL,
  file_path TEXT,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS json_collections (
  collection_name TEXT PRIMARY KEY,
  payload_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pg_enrollments_user_course ON enrollments(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_pg_attendance_date_branch ON attendance(att_date, branch_id);
CREATE INDEX IF NOT EXISTS idx_pg_transactions_trx ON transactions(trx_id);
CREATE INDEX IF NOT EXISTS idx_pg_audit_logs_created ON audit_logs(created_at DESC);

COMMIT;
