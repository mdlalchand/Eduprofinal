# Edupro LMS — Laravel 13 Production Application

**Production application: Laravel 13 only.** The deployable LMS, public website, role-based authentication, dashboards, learning workflows, examinations, store, payments, administration, backups, restore and updater live in `laravel-system/`.

The root-level React/TypeScript/Express workspace is a legacy preview/development tool only. It is not a production backend, must not receive production traffic, and is not required to install, run, test or operate the Laravel application.

## Production architecture

| Area | Production owner |
| --- | --- |
| Public website and CMS pages | Laravel 13 + Blade |
| Authentication, registration and recovery | Laravel 13 |
| Admin, Branch, Teacher, Student and Guardian portals | Laravel 13 |
| Courses, batches, lessons and enrollment | Laravel 13 |
| Exams, results and certificates | Laravel 13 |
| Store, orders and payment verification | Laravel 13 |
| Database schema and migrations | Laravel 13 |
| Backup, restore and system updater | Laravel 13 |
| Sessions, authorization and security | Laravel 13 |

No production workflow should depend on Node.js, Express, a separate Node database, or a Node API.

## Deploy Laravel 13

1. Deploy the contents of `laravel-system/` as the application root (not the repository root).
2. Set the web server document root to `laravel-system/public/`.
3. Use PHP 8.3+, Composer 2, and the required PHP extensions listed in `laravel-system/README_INSTALL.md`.
4. Install production dependencies:

   ```bash
   composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
   cp .env.example .env
   php artisan key:generate
   ```

5. Configure the database, verified TLS CA settings where remote DB TLS is used, HTTPS session cookies, mail transport, queue/cache drivers and payment gateway secrets in `.env`.
6. Ensure `storage/` and `bootstrap/cache/` are writable by the PHP process.
7. Run `php artisan migrate --force` and visit `/install` for the guided first-time setup if the site has not been installed.
8. Run the production checks below before opening traffic.

Read [Laravel installation guide](laravel-system/README_INSTALL.md) and [deployment guide](laravel-system/DEPLOYMENT.md).

## Local development

From `laravel-system/`:

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve
```

## Verification

From `laravel-system/`:

```bash
php artisan test --stop-on-failure
php artisan route:list
php artisan migrate:status
php artisan about
```

GitHub Actions runs the Laravel PHP 8.3 test suite, migration and HTTP smoke checks, PHP syntax validation, and builds an installable Laravel-only ZIP. The archive intentionally excludes `.env`, `vendor/`, logs, runtime caches and the installation lock.

## Legacy workspace

The root `src/`, `server.ts`, `db/` and root Node package are retained temporarily for migration reference and preview only. They are not part of the production release. The Laravel application must remain fully functional when those paths and Node dependencies are absent.
