# Production Deployment & Operations Guide

## 1. Primary Production Backend (Laravel 13 — `laravel-system/`)
**Laravel 13 (`laravel-system/`)** is the primary production backend for live hosting deployments. The distributable archive is generated cleanly at `/downloads/academy-lms-laravel13.zip` without `.env`, `storage/installed.lock`, logs, or local databases.

### Session Secret & Cookie Hardening (Laravel)
- `APP_KEY`: Generated automatically during `/install` via `random_bytes(32)` (`base64:...`), never shipped in archives.
- `SESSION_ENCRYPT=true` and `SESSION_HTTP_ONLY=true` are enabled by default in `laravel-system/config/session.php` and `laravel-system/.env.example`.
- `SESSION_SECURE_COOKIE` defaults dynamically from HTTPS `APP_URL` and is written explicitly by the installer.

### Database SSL Configuration (Laravel)
- **PostgreSQL (`pgsql`)**: Defaults to `DB_SSLMODE=require` in production (`prefer` locally) and supports `DB_SSLROOTCERT=/path/to/ca.pem` in `config/database.php` and `/install`.
- **MySQL / MariaDB (`mysql`)**: Supports `MYSQL_ATTR_SSL_CA` and enables `PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT=true` whenever a CA certificate is configured.

### Backup, Restore & Non-Destructive Upgrades
- Full database + `.env` backups (`SystemUpdateService::createFullBackup`) snapshot all business tables with SHA-256 verification under `storage/app/backups/`.
- Restore (`SystemUpdateService::restoreBackupSnapshot`) verifies SHA-256 integrity, creates an automatic pre-restore safety snapshot, and restores atomically inside a transaction.
- Package updates (`SystemUpdateService::applyUpdateZip`) block path traversal, protect `.env*`, `storage/installed.lock`, `public/uploads/*`, and `*.sqlite`, run `migrate --force` incrementally, and roll back automatically on error.

---

## 2. Interactive Preview & SaaS Workspace (Node.js + Express)
- **Role Governance & Approval**: Strictly enforces `admin` (single Main Admin at DB level via `idx_single_main_admin`), `branch`, `teacher`, `student`, and `guardian`. Self-registrations enter `pending` status until Main Admin approval, with role-scoped login and password recovery (`/login/:role`, `/register/:role`, `/recover/:role`).
- **Session Secret (`SESSION_SECRET`)**:
  - In production (`NODE_ENV=production`), `SESSION_SECRET` **must be at least 32 characters** (`server.ts` refuses to start with weak/missing secrets unless `ALLOW_LOCAL_SESSION_SECRET_FALLBACK=true` is explicitly set for local preview).
  - Integration secrets are encrypted at rest with AES-256-GCM using `INTEGRATION_ENCRYPTION_KEY` (or `SESSION_SECRET`).
- **PostgreSQL SSL (`PGSSL` / `PGSSLROOTCERT`)**:
  - `PGSSL=verify-full` (or `verify-ca`, `require`, `true`) enables TLS certificate verification (`rejectUnauthorized: true`) and loads `PGSSLROOTCERT` when configured (throwing immediately if the CA path is missing).
  - Remote `DATABASE_URL` or `PGHOST` connections default to `rejectUnauthorized: true` unless explicitly configured with `PGSSL=no-verify` or `PGSSL=disable`.
  - When PostgreSQL is not configured, the workspace runs cleanly on SQLite (`data/edupro.db`, `WAL` mode, `foreign_keys = ON`).
- **Signed Payment Webhooks**: Course/order/invoice/e-book payments initiate server-side sessions (`/api/payments/initiate`) and settle only via HMAC-SHA256 verified callbacks (`/api/payments/webhooks/:gateway`) with idempotency deduplication.

---

## 3. Automated CI & Local Verification
GitHub Actions CI (`.github/workflows/ci.yml`) runs:
1. TypeScript lint (`npm run lint`), production frontend bundle (`npm run build`), and Node test suite (`npx --yes tsx --test src/lib/*.test.ts src/server/*.test.ts`).
2. Laravel PHP 8.3 Composer install & feature/unit test suite (`php artisan test`).
3. Clean Laravel ZIP package verification (`artisan`, `composer.json`, `version.json`, zero `.env`/`installed.lock`).
