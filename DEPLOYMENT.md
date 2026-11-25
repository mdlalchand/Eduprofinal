# Laravel 13 Production Deployment

Deploy this repository root as the application. Set the web server document root to `public/`; never expose the project root.

## Requirements
PHP 8.3+, Composer 2, SQLite/MySQL/MariaDB/PostgreSQL and the PHP extensions in README_INSTALL.md.

## Release
1. Deploy a clean release directory and point the vhost to its `public/` directory.
2. Run `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader`.
3. Create a unique `.env` from `.env.example`; never deploy CI or development secrets.
4. Set `APP_ENV=production`, `APP_DEBUG=false`, correct `APP_URL`, and `SESSION_SECURE_COOKIE=true`.
5. Configure database credentials. For remote databases, require CA-verified TLS; never disable certificate verification.
6. Configure SMTP, queues, cache, payment gateway credentials and webhook signing secrets.
7. Ensure `storage/` and `bootstrap/cache/` are writable by PHP-FPM.
8. Run `php artisan migrate --force`, then `php artisan optimize`.
9. Verify `/up`, public pages, all role authentication pages and admin portal.

## Web server
Document root: `/public`. Enable HTTPS, block access to dotfiles and non-public directories, and configure trusted proxy headers where TLS terminates upstream.

## Scheduler and queues
Run `php artisan schedule:run` every minute. Supervise `php artisan queue:work` if queued mail/jobs are enabled.

## Backups and updates
Create a verified full backup before updates. Test restore against a disposable staging database. Keep the prior release for rollback. Never run `migrate:fresh` on production. Validate gateway signatures in sandbox before enabling live payments.

## Existing Node database
The old Node/SQLite database is not the Laravel database. Before a production cutover, export, map, validate and import existing users, courses, enrollments, payments and other business records into the Laravel schema; reconcile record counts and financial totals before switching traffic.
