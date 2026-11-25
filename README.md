# Edupro LMS — Laravel 13

**Laravel 13 is the sole application and production runtime.** This repository root is the Laravel project root. There is no Node.js/Express production server, Node database, React build or separate API service.

## Application modules

- Public website, course catalogue, instructor directory, community and certificate verification
- Separate login, registration and recovery flows for Branch, Teacher, Student and Guardian
- Admin approval and account/role management
- Course, category, batch, lesson, attendance, enrollment and learning progress
- Exams, question bank, results and certificates
- Products, e-books, orders, coupons and payment webhook verification
- Branch operations, finance, payroll and reports
- White-label branding and homepage/menu settings
- Verified backups, restore and non-destructive system updater

## Requirements

- PHP 8.3+
- Composer 2
- SQLite 3, MySQL 8+/MariaDB 10.6+, or PostgreSQL 14+
- PHP extensions: mbstring, openssl, PDO driver, tokenizer, XML, ctype, JSON, bcmath, curl, zip and GD

## Install

1. Upload this project and point the web server document root to `public/`.
2. Run `composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader`.
3. Copy `.env.example` to `.env`, configure database/mail/payment secrets and set `APP_ENV=production`, `APP_DEBUG=false`, `SESSION_SECURE_COOKIE=true`.
4. Run `php artisan key:generate`.
5. Ensure `storage/` and `bootstrap/cache/` are writable by PHP.
6. Run `php artisan migrate --force` or use the first-install wizard at `/install`.
7. Visit `/up`, complete the first-install wizard, then create/approve accounts through the admin portal.

See [README_INSTALL.md](README_INSTALL.md), [DEPLOYMENT.md](DEPLOYMENT.md) and [SECURITY.md](SECURITY.md).

## Development and checks

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan test --stop-on-failure
php artisan route:list
php artisan serve
```

GitHub Actions validates PHP syntax, installs Composer dependencies, runs migrations and all Laravel feature tests, boots the app and smoke-tests public and role-specific routes. It also produces a Laravel-only ZIP installer artifact.

## Data migration note

The previous Node/SQLite application is not used at runtime. If an existing installation contains customer/student records in its old database, export and reconcile those records into the Laravel schema using a reviewed migration/import procedure before switching production traffic. Do not overwrite a live database or assume schemas are interchangeable.
