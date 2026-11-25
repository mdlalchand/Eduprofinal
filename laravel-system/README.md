# Academy LMS — White-Label Learning & Academy Management Platform (Laravel 13)

A complete, self-hosted, white-label LMS and Academy Operations platform built on **Laravel 13** and **PHP 8.3+**. Any organization can install and brand the platform with its own company name, logo, favicon, domain, currency, ID prefix, and color scheme—without touching code or needing a developer.

## Key Features
- **100% White-Label Installer (`/install`)**: Configure Company Name, Tagline, Logo, Favicon, Contact Info, Currency Symbol, Student Roll/ID Prefix, Database (SQLite, MySQL/MariaDB, or PostgreSQL), and Super Admin account from a browser wizard.
- **Zero Demo Data**: Fresh installations start completely clean—only your company branding and Super Admin account are created.
- **Unified Multi-Role Portal (`/portal`)**: Role-based dashboards for `admin`, `branch`, `teacher`, `student`, and `guardian` with separate role registration, recovery, and Main Admin approval.
- **Complete LMS & Operations**:
  - Branch & Category management
  - Courses, Batches, Schedules, Classrooms, Waitlists, Transfers, Attendance, and Payroll
  - Video / Text / SCORM Lessons with learner progress tracking
  - Question Bank & Online MCQ Exams with automatic grading
  - Physical Products & Digital E-Books Store with stock tracking, coupons, and orders
  - Academic Results, Certificate Issuance & Public QR/Serial Verification (`/verify-certificate`)
  - Community Noticeboard / Forum (`/community`)
  - Full-page Homepage & Theme CMS inside `/portal`
- **Safe, Non-Destructive Domain Update System (`/portal#system-updates`)**:
  - Automatic full SHA-256 database snapshot & `.env` backup before every update
  - Strict protected-paths guard (`.env*`, `storage/*`, `storage/installed.lock`, `public/uploads/*`, SQLite databases, `vendor/*` are never overwritten)
  - Incremental schema migrations (`migrate --force` — never destructive `migrate:fresh`)
  - Automatic 503 maintenance screen (`updating.flag`) and automatic file/version rollback on failure
  - Verified backup download and schema-safe restore

## Quick Start
See [README_INSTALL.md](README_INSTALL.md) for hosting & installation instructions.
