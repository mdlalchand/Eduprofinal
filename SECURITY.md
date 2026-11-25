# Security Policy

## Platform Security Controls
- **Primary Production Backend (`laravel-system/`)**:
  - Encrypted, HTTP-only, SameSite-protected sessions (`SESSION_ENCRYPT=true`, `SESSION_HTTP_ONLY=true`, HTTPS-aware `SESSION_SECURE_COOKIE`).
  - Database TLS configuration (`DB_SSLMODE`, `DB_SSLROOTCERT`, `MYSQL_ATTR_SSL_CA`, `MYSQL_ATTR_SSL_VERIFY_SERVER_CERT`).
  - Installer routes (`/install*`) permanently lock once `storage/installed.lock` is written.
  - Guardian registration enforces verification against the student's registered phone or HMAC linking code before linking student accounts.
  - Paid course enrollments remain `pending` until verified via HMAC-SHA256 webhook (`/payments/webhook/{gateway}`) or authorized admin/branch approval.
  - Update packages validate ZIP entries against path traversal, skip protected config/user-data paths, verify SHA-256 backup checksums, and roll back automatically on failure.
- **Interactive Preview Workspace (`server.ts`, `src/`)**:
  - Enforces a single Main Admin at the database index level (`idx_single_main_admin`), optional TOTP 2FA with recovery codes, and session revocation.
  - Requires a 32+ character `SESSION_SECRET` in production and verifies PostgreSQL TLS certificates (`PGSSL=verify-full` + `PGSSLROOTCERT`).
  - Redacts user identifiers, exam answers, grading internals, and unpaid media URLs on all public endpoints with rate limiting.

## Reporting a Vulnerability
Please report security issues privately to the platform administrator email configured in your deployment settings rather than opening a public issue.
