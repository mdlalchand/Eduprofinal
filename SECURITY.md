# Security Policy

## Baseline Hardening Included
- Installation routes (`/install*`) are permanently locked by `storage/installed.lock` after setup.
- Production secrets reside strictly in `.env` (never exposed in client HTML or protected from overwrite during updates).
- Role-based access control (`RoleMiddleware` and `BatchPolicy`) protects all `/portal*` administrative, branch, instructor, and student endpoints.
- Student passwords are hashed with Laravel's `bcrypt`/`argon2` hashing, CSRF tokens protect every state-changing POST/PUT/DELETE route, and file uploads validate image extensions and safe public upload paths.
- Update packages sanitize ZIP entry paths to block path traversal (`..`), enforce a size ceiling, skip protected user-data directories, verify SHA-256 checksums on backups, and automatically roll back on failure.
