# Aloms English Center — White-Label LMS & Academy Platform

**Primary Production Backend:** **Laravel 13** (`laravel-system/`, PHP 8.3+, SQLite / MySQL / PostgreSQL)  
**Interactive Live Preview & Workspace:** **React 19 + TypeScript + Express** (Port 3000)

---

## Architecture Overview

| Layer | Role | Location |
| --- | --- | --- |
| **Primary Production Application** | Production web application with `/install` setup wizard, zero-demo-data bootstrap, multi-role `/portal`, signed payment webhooks (`/payments/webhook/{gateway}`), non-destructive `.zip` updater, and SHA-256 full backups | `laravel-system/` |
| **Interactive Preview & API Workspace** | Live React 19 + Vite UI preview & Express backend running SQLite WAL / PostgreSQL for immediate testing and direct download of the installable Laravel package | `src/`, `server.ts`, `db/` |

> **Direct Installer Download:** On the live preview homepage (`/`), use the **Download Installable Laravel 13 Package (.zip)** button or request `GET /downloads/academy-lms-laravel13.zip`.

---

## Quick Start — Production Deployment (Laravel 13)

1. Download `/downloads/academy-lms-laravel13.zip` (or deploy `laravel-system/`).
2. Point your web server document root to `public/`.
3. Install PHP dependencies:
   ```bash
   composer install --no-dev --optimize-autoloader
   ```
4. Ensure `storage/` and `bootstrap/cache/` are writable and visit `https://your-domain.com/install`.
5. Complete the installation wizard:
   - Generates a cryptographic `APP_KEY` and writes `.env` with `SESSION_ENCRYPT=true`, `SESSION_HTTP_ONLY=true`, and HTTPS-aware `SESSION_SECURE_COOKIE`.
   - Configures SQLite, MySQL (with `MYSQL_ATTR_SSL_CA` verification), or PostgreSQL (`DB_SSLMODE` + `DB_SSLROOTCERT`).
   - Runs incremental migrations with zero demo data and locks `/install` via `storage/installed.lock`.

See `laravel-system/README_INSTALL.md` and `DEPLOYMENT.md` for complete deployment and non-destructive upgrade instructions.

---

## Quick Start — Interactive Preview Workspace (Node.js)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables from `.env.example` (set a 32+ character `SESSION_SECRET` before running with `NODE_ENV=production`, and set `DATABASE_URL` / `PGSSL=verify-full` + `PGSSLROOTCERT` when using managed PostgreSQL).
3. Run development server:
   ```bash
   npm run dev
   ```
4. Verify lint, build, and test suite:
   ```bash
   npm run lint
   npm run build
   npx --yes tsx --test src/lib/*.test.ts src/server/*.test.ts
   ```
