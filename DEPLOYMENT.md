# EDUPro — Production Deployment & Operations Guide

## 1. Security & Single Main Admin Architecture
- **Allowed Authentication Roles**: `admin` (exactly ONE Main Admin enforced at DB level via `idx_single_main_admin`), `teacher`, `student`, `guardian`.
- **No Branch Manager Login Role**: Branches are operational units managed solely by the Main Admin (`active`, `inactive`, `suspended`, `archived`). Legacy `branch_manager` accounts (`u-manager`) are automatically quarantined into `revoked_legacy_accounts` during database migration.
- **Persistent Session Secret**: Configure `SESSION_SECRET` (at least 32 characters) in production environment variables. Automatic secret generation in production is disabled.
- **First-Time Main Admin Provisioning**:
  1. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (8+ chars with letters and numbers) before first startup, **or**
  2. Boot the app and visit `/login` to complete the locked one-time **Initial Main Admin Setup** screen (`/api/auth/setup-admin`), which automatically disables itself once the single Main Admin exists.
- **Two-Factor Authentication**: Main Admin can enable TOTP 2FA + single-use recovery codes inside **Portal -> Integrations & 2FA**.

## 2. Database, Migrations & Backups
- **SQLite Persistent Relational Engine**: Configured at `data/edupro.db` with `WAL` journal mode, `foreign_keys = ON`, relational tables (`users`, `branches`, `branch_status_history`, `auth_sessions`, `password_reset_tokens`, `academic_years`, `academic_classes`, `academic_subjects`, `course_routines`, `student_admissions`, `fee_invoices`, `payment_sessions`, `webhook_events`, `integrations`, `communication_logs`, `in_app_notifications`, `backups`, etc.), and automatic verified legacy `data/db.json` migration.
- **PostgreSQL Support**: Set `DATABASE_URL` and apply `db/migrations/001_initial_postgres.sql` for managed PostgreSQL deployments (`PGSSL=true` when TLS is required).
- **Backup & Restore**: Main Admin can trigger SHA-256 verified snapshots and restore tests via **Portal -> Settings, Backups & Export** (`/api/portal/backup`, `/api/portal/restore`).

## 3. Build & Run Commands
```bash
npm install
npm run build
npm start
```
- Runs on port `3000` (`PORT=3000`).
- Verification unit tests:
  ```bash
  npx --yes tsx --test src/lib/*.test.ts src/server/*.test.ts
  ```
