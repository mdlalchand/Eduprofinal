# Laravel 13 Production Deployment

This is the only supported production deployment target. Deploy the application from this directory; do not deploy the repository-root Express server.

## Requirements

- PHP 8.3 or newer
- Composer 2
- MySQL 8+, MariaDB 10.6+, PostgreSQL 14+, or SQLite 3
- PHP extensions: mbstring, openssl, PDO driver for the selected database, tokenizer, XML, ctype, JSON, bcmath, curl, zip and GD
- HTTPS certificate and a writable Laravel storage directory

## Release procedure

1. Build or download the Laravel-only release archive from the successful GitHub Actions run.
2. Extract it into a new release directory.
3. Point the web server document root to that release's `public/` directory.
4. Install dependencies with `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader`.
5. Create `.env` from `.env.example`; never copy a development or CI `.env` into production.
6. Generate a unique application key using `php artisan key:generate`.
7. Configure database credentials, mail, queue, cache, session, payment and external service secrets.
8. For remote PostgreSQL/MySQL, configure CA-verified TLS; do not disable certificate verification. Use the exact database driver options supported by the selected PDO driver.
9. Set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://your-domain`, and `SESSION_SECURE_COOKIE=true`.
10. Ensure `storage/` and `bootstrap/cache/` are writable by the PHP-FPM/web user.
11. Run `php artisan migrate --force`.
12. Run `php artisan optimize` and verify `/up`, `/login/student`, `/login/teacher`, `/login/guardian`, `/login/branch`, and the public pages.
13. Complete `/install` only on a fresh, not-yet-installed instance. The installer must remain locked after setup.

## Web server

Configure the virtual host document root to the Laravel `public/` directory. Never expose `.env`, `vendor/`, `storage/`, source files or the repository root directly. Enable HTTPS and pass the correct trusted proxy headers when TLS terminates upstream.

## Scheduled tasks and queues

Configure Laravel's scheduler to run `php artisan schedule:run` every minute. If the deployment uses queued mail or jobs, run a supervised `php artisan queue:work` process and configure retry/failure monitoring.

## Pre-release verification

Run from this directory:

```bash
composer install --no-interaction --prefer-dist
php artisan test --stop-on-failure
php artisan migrate:status
php artisan route:list --except-vendor
php artisan about
php artisan optimize
```

Run a real backup and restore rehearsal on a disposable staging database before production upgrades. Verify payment signatures and settlement against each gateway's sandbox before enabling live credentials.

## Rollback

Keep the previous release directory and a verified database backup. If a release fails, switch the web root/symlink back to the previous release and restore the matching database snapshot only when the migration is backward-incompatible. Never use `migrate:fresh` on production.
