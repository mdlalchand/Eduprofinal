# Installation & Non-Destructive Upgrade Guide (Laravel 13)

## Server Requirements
- **PHP**: `8.3` or higher
- **Required PHP Extensions**: `pdo_sqlite` / `pdo_mysql` / `pdo_pgsql`, `mbstring`, `openssl`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `curl`, `zip`, `gd`
- **Database**: SQLite 3, MySQL 8.0+, MariaDB 10.6+, or PostgreSQL 14+
- **Composer**: `2.x`

## Fresh Installation on Domain Hosting
1. Upload the Laravel project to your hosting directory and point your web server document root to `/public`.
2. Install PHP dependencies:
   ```bash
   composer install --no-dev --optimize-autoloader
   ```
3. Make `storage/` and `bootstrap/cache/` writable (`chmod -R 775 storage bootstrap/cache`) and copy `.env.example` to `.env` (or let the installer write `.env`).
4. Open `https://your-domain.com/install` in your browser.
5. Complete the **Web Installer Wizard**:
   - Verifies PHP 8.3+ and required extensions
   - Configures SQLite, MySQL/MariaDB, or PostgreSQL connection
   - Sets your Company Name, Tagline, Logo, Contact Email/Phone, Currency Symbol, and Student Roll Prefix
   - Runs incremental migrations with **zero demo data**
   - Creates your Super Admin account and writes `storage/installed.lock` so `/install` cannot be re-run

---

## Safe, Non-Destructive Update System (Zero Data Loss)
Once installed on your live domain, future application updates can be applied directly from **Portal -> System Updates** without losing any students, enrollments, courses, orders, `.env`, or uploaded media:

1. **Take or let the updater create a Full Backup**: Generates a verified JSON + SHA-256 checksum snapshot of all business tables plus `.env.backup`.
2. **Upload an Update Package (`.zip`)**:
   - The updater puts the site briefly into a clean 503 maintenance mode (`storage/framework/updating.flag`).
   - Protected paths (`.env*`, `storage/*`, `storage/installed.lock`, `public/uploads/*`, `vendor/*`, `database/*.sqlite`) are strictly skipped even if present in the ZIP.
   - Application files are staged and applied atomically with automatic rollback if any write fails.
   - Any new database migrations are applied incrementally (`php artisan migrate --force` — **never** `migrate:fresh`).
   - Caches (`config:clear`, `view:clear`, `route:clear`) are refreshed automatically.
3. **Update Package Format**:
   Include `version.json` at the root of your ZIP:
   ```json
   {
     "version": "1.1.0",
     "release_notes": "Bug fixes and new features"
   }
   ```
   Alongside any changed `app/`, `resources/`, `routes/`, `config/`, or new incremental `database/migrations/` files.

## Unified Portal Roles
- `admin` — Full system, branding, CMS, system updates, account approvals, courses, batches, users, finance, store, exams & certificates
- `branch` — Branch-scoped admissions, batches, fee approvals, orders & students (self-registered pending Main Admin approval)
- `teacher` — Batches, attendance, lessons & MCQ exam builder (self-registered pending Main Admin approval)
- `student` — Enrolled courses, video classroom, live MCQ exams, certificates & orders (self-registered pending Main Admin approval)
- `guardian` — Linked student progress, attendance, exam results & fee status (self-registered pending Main Admin approval)
