import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { SQLITE_SCHEMA_SQL } from './schema';
import {
  DEFAULT_DASHBOARD_CONFIG,
  normalizeDashboardConfig,
  normalizeHeaderMenu,
  DEFAULT_HEADER_MENU,
} from '../lib/domain';
import { enrichAuditLogEntry } from '../lib/auditLogs';
import {
  createDefaultAcademicCollections,
  createDefaultIntegrations,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from '../server/integrationSeed';
import { resolveSessionSecret } from '../server/security';
import type {
  AttendanceCorrectionEntry,
  Branch,
  BranchStatus,
  BranchStatusHistoryEntry,
  CommunicationLogEntry,
  FeeInvoice,
  InAppNotification,
  IntegrationConfig,
  LessonProgressRecord,
  PaymentSessionRecord,
  RevokedLegacyAccount,
} from '../types';
import type { DatabaseState, ExamSessionTimer, SessionRecord, StoredUser } from '../server/storeTypes';

const ALLOWED_ROLES = new Set(['admin', 'teacher', 'student', 'guardian', 'branch']);
const ALLOWED_USER_STATUSES = new Set(['pending', 'active', 'suspended', 'rejected']);

function normalizeUserAccountStatus(
  status: unknown
): 'pending' | 'active' | 'suspended' | 'rejected' {
  const s = String(status ?? 'active');
  return ALLOWED_USER_STATUSES.has(s)
    ? (s as 'pending' | 'active' | 'suspended' | 'rejected')
    : 'active';
}

const ALLOWED_BRANCH_STATUSES = new Set<BranchStatus>([
  'active',
  'inactive',
  'suspended',
  'archived',
]);

let sqliteInstance: Database.Database | null = null;
let activeDbPath: string | null = null;

function resolveDbPath(): string {
  return process.env.SQLITE_DB_PATH
    ? path.resolve(process.env.SQLITE_DB_PATH)
    : path.resolve(process.cwd(), 'data', 'edupro.db');
}

function resolveDataDir(): string {
  return path.dirname(resolveDbPath());
}

function resolveBackupsDir(): string {
  return path.join(resolveDataDir(), 'backups');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  if (!salt || !key) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(key, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export function hashOpaqueToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function getEncryptionKey(): string {
  const encKey = (process.env.INTEGRATION_ENCRYPTION_KEY ?? '').trim();
  if (encKey.length >= 32) {
    return encKey;
  }
  if (encKey.length >= 16 && process.env.NODE_ENV !== 'production') {
    return encKey;
  }
  return resolveSessionSecret();
}

export function getSqliteDb(): Database.Database {
  const targetPath = resolveDbPath();
  if (sqliteInstance && activeDbPath === targetPath) {
    return sqliteInstance;
  }
  if (sqliteInstance) {
    try {
      sqliteInstance.close();
    } catch {
      // ignore close errors during test path switch
    }
    sqliteInstance = null;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const db = new Database(targetPath);
  db.exec(SQLITE_SCHEMA_SQL);

  // Automatic non-destructive SQLite table upgrade when legacy CHECK constraints or columns exist
  const usersDdl = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'")
    .get() as { sql?: string } | undefined;
  const needsUsersMigration =
    Boolean(usersDdl?.sql) &&
    (!usersDdl!.sql!.includes("'branch'") ||
      !usersDdl!.sql!.includes("'pending'") ||
      !usersDdl!.sql!.includes('approved_at'));

  if (needsUsersMigration) {
    const existingCols = new Set(
      (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => c.name)
    );
    const selCol = (name: string) => (existingCols.has(name) ? name : `NULL AS ${name}`);
    db.pragma('foreign_keys = OFF');
    const migrateUsersTx = db.transaction(() => {
      db.exec(`
        DROP TABLE IF EXISTS users_migrated;
        CREATE TABLE users_migrated (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL COLLATE NOCASE UNIQUE,
          phone TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'guardian', 'branch')),
          branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
          roll_number TEXT UNIQUE,
          guardian_linked_student_ids TEXT NOT NULL DEFAULT '[]',
          avatar TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
          bio TEXT,
          subject_specialty TEXT,
          education TEXT,
          approved_at TEXT,
          approved_by TEXT,
          approval_note TEXT,
          password_hash TEXT NOT NULL DEFAULT '',
          must_reset_password INTEGER NOT NULL DEFAULT 0,
          password_updated_at TEXT,
          two_factor_enabled INTEGER NOT NULL DEFAULT 0,
          two_factor_secret TEXT,
          two_factor_recovery_hashes TEXT NOT NULL DEFAULT '[]',
          communication_consent_json TEXT NOT NULL DEFAULT '{"email":true,"sms":true,"whatsapp":true}',
          last_login_at TEXT,
          created_at TEXT NOT NULL
        );
        INSERT INTO users_migrated (
          id, name, email, phone, role, branch_id, roll_number, guardian_linked_student_ids,
          avatar, status, bio, subject_specialty, education, approved_at, approved_by, approval_note,
          password_hash, must_reset_password, password_updated_at, two_factor_enabled,
          two_factor_secret, two_factor_recovery_hashes, communication_consent_json, last_login_at, created_at
        )
        SELECT
          id, name, email, phone, role, branch_id, roll_number, guardian_linked_student_ids,
          avatar, status, bio, subject_specialty, ${selCol('education')}, ${selCol('approved_at')},
          ${selCol('approved_by')}, ${selCol('approval_note')},
          password_hash, must_reset_password, password_updated_at, two_factor_enabled,
          two_factor_secret, two_factor_recovery_hashes, communication_consent_json, last_login_at, created_at
        FROM users;
        DROP TABLE users;
        ALTER TABLE users_migrated RENAME TO users;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_single_main_admin ON users(role) WHERE role = 'admin';
        CREATE INDEX IF NOT EXISTS idx_users_role_branch ON users(role, branch_id);
      `);
    });
    migrateUsersTx();
    db.pragma('foreign_keys = ON');
  }

  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') {
    throw new Error(`CRITICAL: SQLite database failed integrity_check (${String(integrity)}). Refusing to start.`);
  }
  sqliteInstance = db;
  activeDbPath = targetPath;
  return db;
}

export function closeSqliteDb(): void {
  if (sqliteInstance) {
    sqliteInstance.close();
    sqliteInstance = null;
    activeDbPath = null;
  }
}

export function checkDatabaseHealth(): {
  ok: boolean;
  engine: 'sqlite';
  integrity: string;
  adminCount: number;
  dbPath: string;
} {
  const db = getSqliteDb();
  const row = db.prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin'").get() as {
    cnt: number;
  };
  const integrity = String(db.pragma('integrity_check', { simple: true }));
  return {
    ok: integrity === 'ok' && row.cnt <= 1,
    engine: 'sqlite',
    integrity,
    adminCount: row.cnt,
    dbPath: resolveDbPath(),
  };
}

export function isAdminConfiguredInDb(): boolean {
  const db = getSqliteDb();
  const adminRow = db
    .prepare("SELECT id, password_hash, status FROM users WHERE role = 'admin' LIMIT 1")
    .get() as { id: string; password_hash: string; status: string } | undefined;
  if (!adminRow) return false;
  return Boolean(adminRow.password_hash && adminRow.password_hash.includes(':') && adminRow.status === 'active');
}

function normalizeBranch(branch: Partial<Branch>): Branch {
  const rawStatus = String(branch.status ?? 'active');
  const status: BranchStatus = ALLOWED_BRANCH_STATUSES.has(rawStatus as BranchStatus)
    ? (rawStatus as BranchStatus)
    : 'active';
  const now = new Date().toISOString();
  return {
    id: String(branch.id ?? `br-${Date.now()}`),
    name: String(branch.name ?? 'Campus Branch'),
    code: String(branch.code ?? `BR-${Date.now().toString().slice(-4)}`),
    city: String(branch.city ?? 'Dhaka'),
    address: String(branch.address ?? ''),
    phone: String(branch.phone ?? ''),
    managerName: String(branch.managerName ?? ''),
    activeStudents: Number(branch.activeStudents) || 0,
    status,
    image: branch.image,
    createdAt: branch.createdAt ?? now,
    updatedAt: branch.updatedAt ?? now,
    archivedAt: branch.archivedAt ?? null,
  };
}

export function sanitizeLegacyStateForRelationalMigration(
  rawState: Partial<DatabaseState>,
  defaultFactory: () => DatabaseState
): {
  state: DatabaseState;
  revokedAccounts: RevokedLegacyAccount[];
  adminNeedsProvisioning: boolean;
} {
  const fallback = defaultFactory();
  const rawUsers = Array.isArray(rawState.users)
    ? (rawState.users as unknown as Array<Record<string, unknown>>)
    : [];
  const admins = rawUsers.filter((u) => u.role === 'admin');
  if (admins.length > 1) {
    throw new Error(
      `CRITICAL SECURITY HALT: Found ${admins.length} admin accounts (${admins
        .map((a) => String(a.email ?? a.id))
        .join(', ')}). Platform allows exactly ONE Main Admin. Resolve duplicates manually before migrating.`
    );
  }

  const now = new Date().toISOString();
  const revokedAccounts: RevokedLegacyAccount[] = Array.isArray(rawState.revokedLegacyAccounts)
    ? [...rawState.revokedLegacyAccounts]
    : [];

  const envAdminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const envAdminPassword = (process.env.ADMIN_PASSWORD ?? '').trim();
  let adminNeedsProvisioning = false;

  const cleanUsers: StoredUser[] = [];
  for (const u of rawUsers) {
    const role = String(u.role ?? '');
    if (!ALLOWED_ROLES.has(role)) {
      if (!revokedAccounts.some((r) => r.originalUserId === String(u.id))) {
        revokedAccounts.push({
          id: `rev-${String(u.id ?? Date.now())}`,
          originalUserId: String(u.id ?? ''),
          name: String(u.name ?? 'Legacy Account'),
          email: String(u.email ?? ''),
          previousRole: role || 'unknown',
          branchId: u.branchId ? String(u.branchId) : null,
          reason: `Legacy role "${role}" permanently removed from platform; login revoked without promotion.`,
          revokedAt: now,
        });
      }
      continue;
    }

    const userRecord: StoredUser = {
      id: String(u.id),
      name: String(u.name ?? 'User'),
      email: String(u.email ?? '').toLowerCase(),
      phone: String(u.phone ?? ''),
      role: role as StoredUser['role'],
      branchId: u.branchId ? String(u.branchId) : null,
      rollNumber: u.rollNumber ? String(u.rollNumber) : undefined,
      guardianLinkedStudentIds: Array.isArray(u.guardianLinkedStudentIds)
        ? u.guardianLinkedStudentIds.map(String)
        : undefined,
      avatar: u.avatar ? String(u.avatar) : undefined,
      status: normalizeUserAccountStatus(u.status),
      bio: u.bio ? String(u.bio) : undefined,
      subjectSpecialty: u.subjectSpecialty ? String(u.subjectSpecialty) : undefined,
      education: u.education ? String(u.education) : undefined,
      approvedAt: u.approvedAt ? String(u.approvedAt) : undefined,
      approvedBy: u.approvedBy ? String(u.approvedBy) : undefined,
      approvalNote: u.approvalNote ? String(u.approvalNote) : undefined,
      mustResetPassword: Boolean(u.mustResetPassword),
      twoFactorEnabled: Boolean(u.twoFactorEnabled),
      twoFactorSecret: u.twoFactorSecret ? String(u.twoFactorSecret) : null,
      twoFactorRecoveryHashes: Array.isArray(u.twoFactorRecoveryHashes)
        ? u.twoFactorRecoveryHashes.map(String)
        : [],
      communicationConsent: (u.communicationConsent as StoredUser['communicationConsent']) ?? {
        email: true,
        sms: true,
        whatsapp: true,
      },
      lastLoginAt: u.lastLoginAt ? String(u.lastLoginAt) : undefined,
      createdAt: String(u.createdAt ?? now),
      passwordHash: String(u.passwordHash ?? ''),
      passwordUpdatedAt: u.passwordUpdatedAt ? String(u.passwordUpdatedAt) : null,
    };

    if (userRecord.role === 'admin') {
      if (envAdminPassword.length >= 10) {
        if (envAdminEmail) userRecord.email = envAdminEmail;
        userRecord.passwordHash = hashPassword(envAdminPassword);
        userRecord.passwordUpdatedAt = now;
        userRecord.mustResetPassword = false;
      } else if (!userRecord.passwordUpdatedAt) {
        // Legacy db.json admin had public seed password -> force secure first-time setup
        userRecord.passwordHash = '';
        userRecord.mustResetPassword = true;
        adminNeedsProvisioning = true;
      }
    }

    cleanUsers.push(userRecord);
  }

  // Normalize payrolls referencing revoked legacy accounts
  const revokedIds = new Set(revokedAccounts.map((r) => r.originalUserId));
  const cleanPayrolls = (rawState.payrolls ?? fallback.payrolls).map((p) => {
    const rawRole = String(p.role ?? 'teacher');
    if (rawRole === 'branch_manager' || revokedIds.has(p.employeeId) || !ALLOWED_ROLES.has(rawRole)) {
      return { ...p, role: 'legacy_revoked' as const };
    }
    return p;
  });

  const cleanBranches = (rawState.branches ?? fallback.branches).map(normalizeBranch);
  const academic = createDefaultAcademicCollections();
  const rawSettings = rawState.settings ?? fallback.settings;
  rawSettings.headerMenu = normalizeHeaderMenu(rawSettings.headerMenu, DEFAULT_HEADER_MENU);
  rawSettings.dashboardConfig = normalizeDashboardConfig(rawSettings.dashboardConfig, DEFAULT_DASHBOARD_CONFIG);
  rawSettings.homepageConfig = rawSettings.homepageConfig ?? fallback.settings.homepageConfig;

  const state: DatabaseState = {
    ...fallback,
    ...rawState,
    settings: rawSettings,
    branches: cleanBranches,
    branchStatusHistory: Array.isArray(rawState.branchStatusHistory) ? rawState.branchStatusHistory : [],
    users: cleanUsers,
    revokedLegacyAccounts: revokedAccounts,
    academicYears: Array.isArray(rawState.academicYears) && rawState.academicYears.length
      ? rawState.academicYears
      : academic.academicYears,
    academicClasses: Array.isArray(rawState.academicClasses) && rawState.academicClasses.length
      ? rawState.academicClasses
      : academic.academicClasses,
    academicSubjects: Array.isArray(rawState.academicSubjects) && rawState.academicSubjects.length
      ? rawState.academicSubjects
      : academic.academicSubjects,
    courseRoutines: Array.isArray(rawState.courseRoutines) && rawState.courseRoutines.length
      ? rawState.courseRoutines
      : academic.courseRoutines,
    studentAdmissions: Array.isArray(rawState.studentAdmissions) && rawState.studentAdmissions.length
      ? rawState.studentAdmissions
      : academic.studentAdmissions,
    lessonProgress: Array.isArray(rawState.lessonProgress) ? rawState.lessonProgress : [],
    examSessionTimers: Array.isArray(rawState.examSessionTimers) ? rawState.examSessionTimers : [],
    attendanceCorrections: Array.isArray(rawState.attendanceCorrections) ? rawState.attendanceCorrections : [],
    feeInvoices: Array.isArray(rawState.feeInvoices) && rawState.feeInvoices.length
      ? rawState.feeInvoices
      : academic.feeInvoices,
    paymentSessions: Array.isArray(rawState.paymentSessions) ? rawState.paymentSessions : [],
    integrations: Array.isArray(rawState.integrations) && rawState.integrations.length
      ? rawState.integrations
      : createDefaultIntegrations(),
    communicationLogs: Array.isArray(rawState.communicationLogs) ? rawState.communicationLogs : [],
    inAppNotifications: Array.isArray(rawState.inAppNotifications) ? rawState.inAppNotifications : [],
    payrolls: cleanPayrolls,
    auditLogs: (rawState.auditLogs ?? fallback.auditLogs).map(enrichAuditLogEntry),
  };

  return { state, revokedAccounts, adminNeedsProvisioning };
}

export function persistStateToSqlite(state: DatabaseState): void {
  const db = getSqliteDb();
  const admins = state.users.filter((u) => u.role === 'admin');
  if (admins.length > 1) {
    throw new Error('SECURITY VIOLATION: Cannot persist more than 1 Main Admin account.');
  }
  for (const u of state.users) {
    if (!ALLOWED_ROLES.has(u.role)) {
      throw new Error(`SECURITY VIOLATION: Forbidden role "${u.role}" on user ${u.email}.`);
    }
  }

  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO site_settings (id, payload_json, updated_at) VALUES (1, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`
    ).run(JSON.stringify(state.settings), now);

    // Sync branches
    const branchIds = new Set(state.branches.map((b) => b.id));
    for (const b of state.branches) {
      const nb = normalizeBranch(b);
      db.prepare(
        `INSERT INTO branches (id, name, code, city, address, phone, manager_name, active_students, status, image, created_at, updated_at, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, code=excluded.code, city=excluded.city, address=excluded.address,
           phone=excluded.phone, manager_name=excluded.manager_name, active_students=excluded.active_students,
           status=excluded.status, image=excluded.image, updated_at=excluded.updated_at, archived_at=excluded.archived_at`
      ).run(
        nb.id,
        nb.name,
        nb.code,
        nb.city,
        nb.address,
        nb.phone,
        nb.managerName,
        nb.activeStudents,
        nb.status,
        nb.image ?? null,
        nb.createdAt ?? now,
        nb.updatedAt ?? now,
        nb.archivedAt ?? null
      );
    }

    // Sync branch status history (append-only)
    for (const h of state.branchStatusHistory) {
      db.prepare(
        `INSERT OR IGNORE INTO branch_status_history (id, branch_id, branch_name, previous_status, new_status, reason, actor_id, actor_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        h.id,
        h.branchId,
        h.branchName,
        h.previousStatus,
        h.newStatus,
        h.reason,
        h.actorId,
        h.actorName,
        h.createdAt
      );
    }

    // Sync revoked legacy accounts
    for (const r of state.revokedLegacyAccounts) {
      db.prepare(
        `INSERT OR IGNORE INTO revoked_legacy_accounts (id, original_user_id, name, email, previous_role, branch_id, reason, revoked_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(r.id, r.originalUserId, r.name, r.email, r.previousRole, r.branchId, r.reason, r.revokedAt);
    }

    // Sync users
    const existingUserRows = db.prepare('SELECT id FROM users').all() as { id: string }[];
    const nextUserIds = new Set(state.users.map((u) => u.id));
    for (const row of existingUserRows) {
      if (!nextUserIds.has(row.id)) {
        db.prepare('DELETE FROM users WHERE id = ?').run(row.id);
      }
    }
    for (const u of state.users) {
      const safeBranch = u.branchId && branchIds.has(u.branchId) ? u.branchId : null;
      db.prepare(
        `INSERT INTO users (
           id, name, email, phone, role, branch_id, roll_number, guardian_linked_student_ids,
           avatar, status, bio, subject_specialty, education, approved_at, approved_by, approval_note,
           password_hash, must_reset_password, password_updated_at, two_factor_enabled,
           two_factor_secret, two_factor_recovery_hashes, communication_consent_json, last_login_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, email=excluded.email, phone=excluded.phone, role=excluded.role,
           branch_id=excluded.branch_id, roll_number=excluded.roll_number,
           guardian_linked_student_ids=excluded.guardian_linked_student_ids,
           avatar=excluded.avatar, status=excluded.status, bio=excluded.bio,
           subject_specialty=excluded.subject_specialty, education=excluded.education,
           approved_at=excluded.approved_at, approved_by=excluded.approved_by,
           approval_note=excluded.approval_note, password_hash=excluded.password_hash,
           must_reset_password=excluded.must_reset_password, password_updated_at=excluded.password_updated_at,
           two_factor_enabled=excluded.two_factor_enabled, two_factor_secret=excluded.two_factor_secret,
           two_factor_recovery_hashes=excluded.two_factor_recovery_hashes,
           communication_consent_json=excluded.communication_consent_json,
           last_login_at=excluded.last_login_at`
      ).run(
        u.id,
        u.name,
        u.email.toLowerCase(),
        u.phone,
        u.role,
        safeBranch,
        u.rollNumber ?? null,
        JSON.stringify(u.guardianLinkedStudentIds ?? []),
        u.avatar ?? null,
        normalizeUserAccountStatus(u.status),
        u.bio ?? null,
        u.subjectSpecialty ?? null,
        u.education ?? null,
        u.approvedAt ?? null,
        u.approvedBy ?? null,
        u.approvalNote ?? null,
        u.passwordHash,
        u.mustResetPassword ? 1 : 0,
        u.passwordUpdatedAt ?? null,
        u.twoFactorEnabled ? 1 : 0,
        u.twoFactorSecret ?? null,
        JSON.stringify(u.twoFactorRecoveryHashes ?? []),
        JSON.stringify(u.communicationConsent ?? { email: true, sms: true, whatsapp: true }),
        u.lastLoginAt ?? null,
        u.createdAt
      );
    }

    // Sync courses
    db.prepare('DELETE FROM courses').run();
    const insCourse = db.prepare(
      `INSERT INTO courses (id, slug, title, subtitle, category, level_tag, price, original_price, enrolled_count, status, created_by_user_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of state.courses) {
      const safeCreator = c.createdByUserId && nextUserIds.has(c.createdByUserId) ? c.createdByUserId : null;
      insCourse.run(
        c.id,
        c.slug,
        c.title,
        c.subtitle,
        c.category,
        c.levelTag,
        c.price,
        c.originalPrice,
        c.enrolledCount,
        c.status,
        safeCreator,
        JSON.stringify(c)
      );
    }
    const courseIds = new Set(state.courses.map((c) => c.id));

    // Sync batches
    db.prepare('DELETE FROM batches').run();
    const insBatch = db.prepare(
      `INSERT INTO batches (id, course_id, name, code, branch_id, instructor_id, seat_limit, enrolled_seats, status, lifecycle_status, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const b of state.batches) {
      if (!courseIds.has(b.courseId) || !branchIds.has(b.branchId)) continue;
      insBatch.run(
        b.id,
        b.courseId,
        b.name,
        b.code,
        b.branchId,
        b.instructorId,
        b.seatLimit,
        b.enrolledSeats,
        b.status,
        b.lifecycleStatus ?? null,
        JSON.stringify(b)
      );
    }
    const batchIds = new Set(state.batches.map((b) => b.id));

    // Sync enrollments
    db.prepare('DELETE FROM enrollments').run();
    const insEnr = db.prepare(
      `INSERT INTO enrollments (id, user_id, course_id, branch_id, batch_id, status, amount_paid, enrolled_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of state.enrollments) {
      if (!nextUserIds.has(e.userId) || !courseIds.has(e.courseId) || !branchIds.has(e.branchId)) continue;
      const safeBatch = e.batchId && batchIds.has(e.batchId) ? e.batchId : null;
      insEnr.run(
        e.id,
        e.userId,
        e.courseId,
        e.branchId,
        safeBatch,
        e.status,
        e.amountPaid,
        e.enrolledAt,
        JSON.stringify(e)
      );
    }

    // Sync lesson_progress
    db.prepare('DELETE FROM lesson_progress').run();
    const lessonIds = new Set(state.lessons.map((l) => l.id));
    // First sync lessons
    db.prepare('DELETE FROM lessons').run();
    const insLesson = db.prepare(
      `INSERT INTO lessons (id, course_id, module_id, batch_id, lesson_type, title, order_index, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const l of state.lessons) {
      if (!courseIds.has(l.courseId)) continue;
      insLesson.run(
        l.id,
        l.courseId,
        l.moduleId ?? null,
        l.batchId ?? null,
        l.lessonType,
        l.title,
        l.orderIndex,
        JSON.stringify(l)
      );
    }

    const insProg = db.prepare(
      `INSERT INTO lesson_progress (id, user_id, course_id, lesson_id, watched_seconds, duration_seconds, percent_watched, completed, last_position_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const lp of state.lessonProgress) {
      if (!nextUserIds.has(lp.userId) || !courseIds.has(lp.courseId) || !lessonIds.has(lp.lessonId)) continue;
      insProg.run(
        lp.id,
        lp.userId,
        lp.courseId,
        lp.lessonId,
        lp.watchedSeconds,
        lp.durationSeconds,
        lp.percentWatched,
        lp.completed ? 1 : 0,
        lp.lastPositionAt
      );
    }

    // Sync exams & attempts
    db.prepare('DELETE FROM exams').run();
    const insExam = db.prepare(
      `INSERT INTO exams (id, course_id, batch_id, title, visibility, teacher_id, created_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const ex of state.exams) {
      const safeCourse = ex.courseId && courseIds.has(ex.courseId) ? ex.courseId : null;
      insExam.run(
        ex.id,
        safeCourse,
        ex.batchId ?? null,
        ex.title,
        ex.visibility,
        ex.teacherId,
        ex.createdAt,
        JSON.stringify(ex)
      );
    }
    const examIds = new Set(state.exams.map((ex) => ex.id));

    db.prepare('DELETE FROM exam_attempts').run();
    const insAtt = db.prepare(
      `INSERT INTO exam_attempts (id, exam_id, user_id, branch_id, roll_number, score, total_marks, percentage, passed, submitted_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of state.examAttempts) {
      if (!examIds.has(a.examId) || !nextUserIds.has(a.userId)) continue;
      const safeBr = a.branchId && branchIds.has(a.branchId) ? a.branchId : null;
      insAtt.run(
        a.id,
        a.examId,
        a.userId,
        safeBr,
        a.rollNumber,
        a.score,
        a.totalMarks,
        a.percentage,
        a.passed ? 1 : 0,
        a.submittedAt,
        JSON.stringify(a)
      );
    }

    // Sync attendance & immutable corrections
    db.prepare('DELETE FROM attendance').run();
    const insAttendance = db.prepare(
      `INSERT OR REPLACE INTO attendance (id, target_type, target_id, branch_id, batch_id, att_date, status, recorded_by, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const rec of state.attendance) {
      const safeBr = rec.branchId && branchIds.has(rec.branchId) ? rec.branchId : null;
      const safeBat = rec.batchId && batchIds.has(rec.batchId) ? rec.batchId : null;
      insAttendance.run(
        rec.id,
        rec.targetType,
        rec.targetId,
        safeBr,
        safeBat,
        rec.date,
        rec.status,
        rec.recordedBy,
        JSON.stringify(rec)
      );
    }

    const attIds = new Set(state.attendance.map((a) => a.id));
    for (const corr of state.attendanceCorrections) {
      if (!attIds.has(corr.attendanceId)) continue;
      db.prepare(
        `INSERT OR IGNORE INTO attendance_corrections (id, attendance_id, target_name, previous_status, new_status, reason, corrected_by_id, corrected_by_name, corrected_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        corr.id,
        corr.attendanceId,
        corr.targetName,
        corr.previousStatus,
        corr.newStatus,
        corr.reason,
        corr.correctedById,
        corr.correctedByName,
        corr.correctedAt
      );
    }

    // Sync financial records, fee invoices, transactions, payment sessions
    db.prepare('DELETE FROM financial_records').run();
    const insFin = db.prepare(
      `INSERT INTO financial_records (id, rec_type, category, amount, branch_id, rec_date, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const f of state.financialRecords) {
      const safeBr = f.branchId && branchIds.has(f.branchId) ? f.branchId : null;
      insFin.run(f.id, f.type, f.category, f.amount, safeBr, f.date, JSON.stringify(f));
    }

    db.prepare('DELETE FROM fee_invoices').run();
    const insInv = db.prepare(
      `INSERT INTO fee_invoices (id, invoice_no, student_user_id, student_name, branch_id, course_id, batch_id, fee_type, title, total_amount, paid_amount, due_amount, due_date, installment_plan_label, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const inv of state.feeInvoices) {
      if (!nextUserIds.has(inv.studentUserId) || !branchIds.has(inv.branchId)) continue;
      insInv.run(
        inv.id,
        inv.invoiceNo,
        inv.studentUserId,
        inv.studentName,
        inv.branchId,
        inv.courseId && courseIds.has(inv.courseId) ? inv.courseId : null,
        inv.batchId && batchIds.has(inv.batchId) ? inv.batchId : null,
        inv.feeType,
        inv.title,
        inv.totalAmount,
        inv.paidAmount,
        inv.dueAmount,
        inv.dueDate,
        inv.installmentPlanLabel ?? null,
        inv.status,
        inv.createdAt,
        inv.updatedAt
      );
    }

    db.prepare('DELETE FROM transactions').run();
    const insTxn = db.prepare(
      `INSERT INTO transactions (id, invoice_no, reference_type, reference_id, user_id, gateway, trx_id, total_amount, status, created_at, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const t of state.transactions) {
      if (!nextUserIds.has(t.userId)) continue;
      insTxn.run(
        t.id,
        t.invoiceNo,
        t.referenceType,
        t.referenceId,
        t.userId,
        t.gateway,
        t.trxId,
        t.totalAmount,
        t.status,
        t.createdAt,
        JSON.stringify(t)
      );
    }

    db.prepare('DELETE FROM payment_sessions').run();
    const insPs = db.prepare(
      `INSERT INTO payment_sessions (id, idempotency_key, user_id, reference_type, reference_id, branch_id, gateway, mode, amount, currency, status, provider_payment_id, checkout_url, trx_id, webhook_verified_at, metadata_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const ps of state.paymentSessions) {
      if (!nextUserIds.has(ps.userId)) continue;
      insPs.run(
        ps.id,
        ps.idempotencyKey,
        ps.userId,
        ps.referenceType,
        ps.referenceId,
        ps.branchId && branchIds.has(ps.branchId) ? ps.branchId : null,
        ps.gateway,
        ps.mode,
        ps.amount,
        ps.currency,
        ps.status,
        ps.providerPaymentId ?? null,
        ps.checkoutUrl ?? null,
        ps.trxId ?? null,
        ps.webhookVerifiedAt ?? null,
        ps.metadataJson ?? null,
        ps.createdAt,
        ps.expiresAt
      );
    }

    // Sync audit logs & communication logs & notifications & backups
    db.prepare('DELETE FROM audit_logs').run();
    const insAudit = db.prepare(
      `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, category, severity, action, target, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of state.auditLogs) {
      insAudit.run(
        a.id,
        a.actorId,
        a.actorName,
        a.actorRole,
        a.category ?? null,
        a.severity ?? null,
        a.action,
        a.target,
        a.details,
        a.createdAt
      );
    }

    db.prepare('DELETE FROM communication_logs').run();
    const insComm = db.prepare(
      `INSERT INTO communication_logs (id, channel, provider, recipient, recipient_user_id, subject, body_preview, status, provider_message_id, error_message, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const cl of state.communicationLogs.slice(0, 500)) {
      insComm.run(
        cl.id,
        cl.channel,
        cl.provider,
        cl.recipient,
        cl.recipientUserId ?? null,
        cl.subject ?? null,
        cl.bodyPreview,
        cl.status,
        cl.providerMessageId ?? null,
        cl.errorMessage ?? null,
        cl.attempts,
        cl.createdAt,
        cl.updatedAt
      );
    }

    db.prepare('DELETE FROM in_app_notifications').run();
    const insNotif = db.prepare(
      `INSERT INTO in_app_notifications (id, user_id, title, message, type, read, action_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const n of state.inAppNotifications.slice(0, 500)) {
      if (!nextUserIds.has(n.userId)) continue;
      insNotif.run(n.id, n.userId, n.title, n.message, n.type, n.read ? 1 : 0, n.actionUrl ?? null, n.createdAt);
    }

    db.prepare('DELETE FROM backups').run();
    const insBkp = db.prepare(
      `INSERT INTO backups (id, label, reason, checksum_sha256, verified, created_by, created_at, summary_json, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const bkp of state.backups.slice(0, 20)) {
      insBkp.run(
        bkp.id,
        bkp.label,
        bkp.reason,
        bkp.checksumSha256,
        bkp.verified ? 1 : 0,
        bkp.createdBy,
        bkp.createdAt,
        JSON.stringify(bkp.summary),
        bkp.payloadJson ?? null
      );
    }

    // Store remaining structured collections cleanly in json_collections
    const collectionMap: Record<string, unknown> = {
      instructors: state.instructors,
      academicYears: state.academicYears,
      academicClasses: state.academicClasses,
      academicSubjects: state.academicSubjects,
      courseRoutines: state.courseRoutines,
      studentAdmissions: state.studentAdmissions,
      batchWaitlists: state.batchWaitlists,
      batchTransfers: state.batchTransfers,
      batchNotifications: state.batchNotifications,
      batchActivityLogs: state.batchActivityLogs,
      modules: state.modules,
      chapters: state.chapters,
      assignments: state.assignments,
      assignmentSubmissions: state.assignmentSubmissions,
      announcements: state.announcements,
      certificates: state.certificates,
      examSessionTimers: state.examSessionTimers,
      questionBank: state.questionBank,
      products: state.products,
      ebooks: state.ebooks,
      categories: state.categories,
      posts: state.posts,
      scormPackages: state.scormPackages,
      scormAttempts: state.scormAttempts,
      rewardsByUser: state.rewardsByUser,
      payrolls: state.payrolls,
      paymentGateways: state.paymentGateways,
      orders: state.orders,
      coupons: state.coupons,
      reviews: state.reviews,
      results: state.results,
      claimedEbooksByUser: state.claimedEbooksByUser,
      contactMessages: state.contactMessages,
      integrations: state.integrations,
      recycleBin: state.recycleBin,
      campaigns: state.campaigns,
      plugins: state.plugins,
      webhooks: state.webhooks,
      mediaAssets: state.mediaAssets,
    };

    const insCol = db.prepare(
      `INSERT INTO json_collections (collection_name, payload_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(collection_name) DO UPDATE SET payload_json=excluded.payload_json, updated_at=excluded.updated_at`
    );
    for (const [k, v] of Object.entries(collectionMap)) {
      insCol.run(k, JSON.stringify(v), now);
    }
  });

  tx();
}

export function loadOrInitializeDatabase(defaultFactory: () => DatabaseState): DatabaseState {
  const db = getSqliteDb();
  const hasSettings = db.prepare('SELECT payload_json FROM site_settings WHERE id = 1').get() as
    | { payload_json: string }
    | undefined;

  if (!hasSettings) {
    // Check if legacy data/db.json exists for verified migration
    const legacyJsonPath = path.join(resolveDataDir(), 'db.json');
    if (fs.existsSync(legacyJsonPath)) {
      let parsedRaw: Partial<DatabaseState>;
      try {
        parsedRaw = JSON.parse(fs.readFileSync(legacyJsonPath, 'utf8')) as Partial<DatabaseState>;
      } catch (err) {
        throw new Error(
          `CRITICAL: Legacy database file ${legacyJsonPath} is corrupted JSON (${
            err instanceof Error ? err.message : 'parse error'
          }). Refusing to overwrite with demo seed data.`
        );
      }

      // Write verified pre-migration backup snapshot before migrating
      const backupsDir = resolveBackupsDir();
      fs.mkdirSync(backupsDir, { recursive: true });
      const rawContent = fs.readFileSync(legacyJsonPath, 'utf8');
      const sha = crypto.createHash('sha256').update(rawContent).digest('hex');
      const backupFile = path.join(backupsDir, `pre-migration-auto-${Date.now()}.json`);
      fs.writeFileSync(backupFile, rawContent, 'utf8');
      fs.writeFileSync(`${backupFile}.sha256`, sha, 'utf8');

      const { state } = sanitizeLegacyStateForRelationalMigration(parsedRaw, defaultFactory);
      persistStateToSqlite(state);
      db.prepare(
        `INSERT INTO app_meta (key, value, updated_at) VALUES ('migrated_from_json', ?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`
      ).run(new Date().toISOString(), new Date().toISOString());
      return loadStateFromSqlite(defaultFactory);
    }

    // Fresh initialization
    const initial = sanitizeLegacyStateForRelationalMigration(defaultFactory(), defaultFactory).state;
    persistStateToSqlite(initial);
    return loadStateFromSqlite(defaultFactory);
  }

  return loadStateFromSqlite(defaultFactory);
}

export function loadStateFromSqlite(defaultFactory: () => DatabaseState): DatabaseState {
  const db = getSqliteDb();
  const fallback = defaultFactory();

  const settingsRow = db.prepare('SELECT payload_json FROM site_settings WHERE id = 1').get() as
    | { payload_json: string }
    | undefined;
  const settings = settingsRow ? JSON.parse(settingsRow.payload_json) : fallback.settings;
  settings.headerMenu = normalizeHeaderMenu(settings.headerMenu, DEFAULT_HEADER_MENU);
  settings.dashboardConfig = normalizeDashboardConfig(settings.dashboardConfig, DEFAULT_DASHBOARD_CONFIG);

  const branches = (db.prepare('SELECT * FROM branches').all() as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    code: String(r.code),
    city: String(r.city),
    address: String(r.address),
    phone: String(r.phone),
    managerName: String(r.manager_name ?? ''),
    activeStudents: Number(r.active_students ?? 0),
    status: String(r.status) as BranchStatus,
    image: r.image ? String(r.image) : undefined,
    createdAt: r.created_at ? String(r.created_at) : undefined,
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
    archivedAt: r.archived_at ? String(r.archived_at) : null,
  }));

  const branchStatusHistory = (
    db.prepare('SELECT * FROM branch_status_history ORDER BY created_at DESC').all() as Array<
      Record<string, unknown>
    >
  ).map(
    (r): BranchStatusHistoryEntry => ({
      id: String(r.id),
      branchId: String(r.branch_id),
      branchName: String(r.branch_name),
      previousStatus: String(r.previous_status) as BranchStatus,
      newStatus: String(r.new_status) as BranchStatus,
      reason: String(r.reason),
      actorId: String(r.actor_id),
      actorName: String(r.actor_name),
      createdAt: String(r.created_at),
    })
  );

  const users = (db.prepare('SELECT * FROM users').all() as Array<Record<string, unknown>>).map(
    (r): StoredUser => ({
      id: String(r.id),
      name: String(r.name),
      email: String(r.email),
      phone: String(r.phone),
      role: String(r.role) as StoredUser['role'],
      branchId: r.branch_id ? String(r.branch_id) : null,
      rollNumber: r.roll_number ? String(r.roll_number) : undefined,
      guardianLinkedStudentIds: JSON.parse(String(r.guardian_linked_student_ids || '[]')),
      avatar: r.avatar ? String(r.avatar) : undefined,
      status: normalizeUserAccountStatus(r.status),
      bio: r.bio ? String(r.bio) : undefined,
      subjectSpecialty: r.subject_specialty ? String(r.subject_specialty) : undefined,
      education: r.education ? String(r.education) : undefined,
      approvedAt: r.approved_at ? String(r.approved_at) : undefined,
      approvedBy: r.approved_by ? String(r.approved_by) : undefined,
      approvalNote: r.approval_note ? String(r.approval_note) : undefined,
      passwordHash: String(r.password_hash ?? ''),
      mustResetPassword: Boolean(r.must_reset_password),
      passwordUpdatedAt: r.password_updated_at ? String(r.password_updated_at) : null,
      twoFactorEnabled: Boolean(r.two_factor_enabled),
      twoFactorSecret: r.two_factor_secret ? String(r.two_factor_secret) : null,
      twoFactorRecoveryHashes: JSON.parse(String(r.two_factor_recovery_hashes || '[]')),
      communicationConsent: JSON.parse(
        String(r.communication_consent_json || '{"email":true,"sms":true,"whatsapp":true}')
      ),
      lastLoginAt: r.last_login_at ? String(r.last_login_at) : undefined,
      createdAt: String(r.created_at),
    })
  );

  const revokedLegacyAccounts = (
    db.prepare('SELECT * FROM revoked_legacy_accounts ORDER BY revoked_at DESC').all() as Array<
      Record<string, unknown>
    >
  ).map(
    (r): RevokedLegacyAccount => ({
      id: String(r.id),
      originalUserId: String(r.original_user_id),
      name: String(r.name),
      email: String(r.email),
      previousRole: String(r.previous_role),
      branchId: r.branch_id ? String(r.branch_id) : null,
      reason: String(r.reason),
      revokedAt: String(r.revoked_at),
    })
  );

  const courses = (db.prepare('SELECT payload_json FROM courses').all() as { payload_json: string }[]).map((r) =>
    JSON.parse(r.payload_json)
  );
  const batches = (db.prepare('SELECT payload_json FROM batches').all() as { payload_json: string }[]).map((r) =>
    JSON.parse(r.payload_json)
  );
  const enrollments = (
    db.prepare('SELECT payload_json FROM enrollments').all() as { payload_json: string }[]
  ).map((r) => JSON.parse(r.payload_json));
  const lessons = (
    db.prepare('SELECT payload_json FROM lessons ORDER BY order_index ASC').all() as { payload_json: string }[]
  ).map((r) => JSON.parse(r.payload_json));
  const lessonProgress = (
    db.prepare('SELECT * FROM lesson_progress').all() as Array<Record<string, unknown>>
  ).map(
    (r): LessonProgressRecord => ({
      id: String(r.id),
      userId: String(r.user_id),
      courseId: String(r.course_id),
      lessonId: String(r.lesson_id),
      watchedSeconds: Number(r.watched_seconds),
      durationSeconds: Number(r.duration_seconds),
      percentWatched: Number(r.percent_watched),
      completed: Boolean(r.completed),
      lastPositionAt: String(r.last_position_at),
    })
  );
  const exams = (db.prepare('SELECT payload_json FROM exams').all() as { payload_json: string }[]).map((r) =>
    JSON.parse(r.payload_json)
  );
  const examAttempts = (
    db.prepare('SELECT payload_json FROM exam_attempts ORDER BY submitted_at DESC').all() as {
      payload_json: string;
    }[]
  ).map((r) => JSON.parse(r.payload_json));
  const attendance = (
    db.prepare('SELECT payload_json FROM attendance ORDER BY att_date DESC').all() as { payload_json: string }[]
  ).map((r) => JSON.parse(r.payload_json));
  const attendanceCorrections = (
    db.prepare('SELECT * FROM attendance_corrections ORDER BY corrected_at DESC').all() as Array<
      Record<string, unknown>
    >
  ).map(
    (r): AttendanceCorrectionEntry => ({
      id: String(r.id),
      attendanceId: String(r.attendance_id),
      targetName: String(r.target_name),
      previousStatus: String(r.previous_status) as AttendanceCorrectionEntry['previousStatus'],
      newStatus: String(r.new_status) as AttendanceCorrectionEntry['newStatus'],
      reason: String(r.reason),
      correctedById: String(r.corrected_by_id),
      correctedByName: String(r.corrected_by_name),
      correctedAt: String(r.corrected_at),
    })
  );
  const financialRecords = (
    db.prepare('SELECT payload_json FROM financial_records ORDER BY rec_date DESC').all() as {
      payload_json: string;
    }[]
  ).map((r) => JSON.parse(r.payload_json));
  const feeInvoices = (
    db.prepare('SELECT * FROM fee_invoices ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
  ).map(
    (r): FeeInvoice => ({
      id: String(r.id),
      invoiceNo: String(r.invoice_no),
      studentUserId: String(r.student_user_id),
      studentName: String(r.student_name),
      branchId: String(r.branch_id),
      courseId: r.course_id ? String(r.course_id) : null,
      batchId: r.batch_id ? String(r.batch_id) : null,
      feeType: String(r.fee_type) as FeeInvoice['feeType'],
      title: String(r.title),
      totalAmount: Number(r.total_amount),
      paidAmount: Number(r.paid_amount),
      dueAmount: Number(r.due_amount),
      dueDate: String(r.due_date),
      installmentPlanLabel: r.installment_plan_label ? String(r.installment_plan_label) : undefined,
      status: String(r.status) as FeeInvoice['status'],
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })
  );
  const transactions = (
    db.prepare('SELECT payload_json FROM transactions ORDER BY created_at DESC').all() as {
      payload_json: string;
    }[]
  ).map((r) => JSON.parse(r.payload_json));
  const paymentSessions = (
    db.prepare('SELECT * FROM payment_sessions ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
  ).map(
    (r): PaymentSessionRecord => ({
      id: String(r.id),
      idempotencyKey: String(r.idempotency_key),
      userId: String(r.user_id),
      referenceType: String(r.reference_type) as PaymentSessionRecord['referenceType'],
      referenceId: String(r.reference_id),
      branchId: r.branch_id ? String(r.branch_id) : null,
      gateway: String(r.gateway),
      mode: String(r.mode) as 'sandbox' | 'live',
      amount: Number(r.amount),
      currency: 'BDT',
      status: String(r.status) as PaymentSessionRecord['status'],
      providerPaymentId: r.provider_payment_id ? String(r.provider_payment_id) : undefined,
      checkoutUrl: r.checkout_url ? String(r.checkout_url) : undefined,
      trxId: r.trx_id ? String(r.trx_id) : undefined,
      webhookVerifiedAt: r.webhook_verified_at ? String(r.webhook_verified_at) : undefined,
      metadataJson: r.metadata_json ? String(r.metadata_json) : undefined,
      createdAt: String(r.created_at),
      expiresAt: String(r.expires_at),
    })
  );
  const auditLogs = (
    db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
  ).map((r) =>
    enrichAuditLogEntry({
      id: String(r.id),
      actorId: String(r.actor_id),
      actorName: String(r.actor_name),
      actorRole: String(r.actor_role) as StoredUser['role'],
      category: r.category ? (String(r.category) as 'login' | 'course' | 'payment' | 'system') : undefined,
      severity: r.severity ? (String(r.severity) as 'info' | 'warning' | 'critical') : undefined,
      action: String(r.action),
      target: String(r.target),
      details: String(r.details),
      createdAt: String(r.created_at),
    })
  );
  const communicationLogs = (
    db.prepare('SELECT * FROM communication_logs ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
  ).map(
    (r): CommunicationLogEntry => ({
      id: String(r.id),
      channel: String(r.channel) as CommunicationLogEntry['channel'],
      provider: String(r.provider),
      recipient: String(r.recipient),
      recipientUserId: r.recipient_user_id ? String(r.recipient_user_id) : undefined,
      subject: r.subject ? String(r.subject) : undefined,
      bodyPreview: String(r.body_preview),
      status: String(r.status) as CommunicationLogEntry['status'],
      providerMessageId: r.provider_message_id ? String(r.provider_message_id) : undefined,
      errorMessage: r.error_message ? String(r.error_message) : undefined,
      attempts: Number(r.attempts),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    })
  );
  const inAppNotifications = (
    db.prepare('SELECT * FROM in_app_notifications ORDER BY created_at DESC').all() as Array<
      Record<string, unknown>
    >
  ).map(
    (r): InAppNotification => ({
      id: String(r.id),
      userId: String(r.user_id),
      title: String(r.title),
      message: String(r.message),
      type: String(r.type) as InAppNotification['type'],
      read: Boolean(r.read),
      actionUrl: r.action_url ? String(r.action_url) : undefined,
      createdAt: String(r.created_at),
    })
  );
  const backups = (
    db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all() as Array<Record<string, unknown>>
  ).map((r) => ({
    id: String(r.id),
    label: String(r.label),
    reason: String(r.reason) as 'manual' | 'pre_reset' | 'pre_restore',
    checksumSha256: String(r.checksum_sha256),
    verified: Boolean(r.verified),
    createdBy: String(r.created_by),
    createdAt: String(r.created_at),
    summary: JSON.parse(String(r.summary_json)),
    payloadJson: r.payload_json ? String(r.payload_json) : undefined,
  }));

  const colRows = db.prepare('SELECT collection_name, payload_json FROM json_collections').all() as {
    collection_name: string;
    payload_json: string;
  }[];
  const cols: Record<string, unknown> = {};
  for (const c of colRows) {
    cols[c.collection_name] = JSON.parse(c.payload_json);
  }

  return {
    ...fallback,
    settings,
    branches,
    branchStatusHistory,
    users,
    revokedLegacyAccounts,
    instructors: (cols.instructors as DatabaseState['instructors']) ?? fallback.instructors,
    academicYears: (cols.academicYears as DatabaseState['academicYears']) ?? fallback.academicYears,
    academicClasses: (cols.academicClasses as DatabaseState['academicClasses']) ?? fallback.academicClasses,
    academicSubjects: (cols.academicSubjects as DatabaseState['academicSubjects']) ?? fallback.academicSubjects,
    courseRoutines: (cols.courseRoutines as DatabaseState['courseRoutines']) ?? fallback.courseRoutines,
    studentAdmissions: (cols.studentAdmissions as DatabaseState['studentAdmissions']) ?? fallback.studentAdmissions,
    courses,
    batches,
    batchWaitlists: (cols.batchWaitlists as DatabaseState['batchWaitlists']) ?? [],
    batchTransfers: (cols.batchTransfers as DatabaseState['batchTransfers']) ?? [],
    batchNotifications: (cols.batchNotifications as DatabaseState['batchNotifications']) ?? fallback.batchNotifications,
    batchActivityLogs: (cols.batchActivityLogs as DatabaseState['batchActivityLogs']) ?? fallback.batchActivityLogs,
    modules: (cols.modules as DatabaseState['modules']) ?? fallback.modules,
    chapters: (cols.chapters as DatabaseState['chapters']) ?? fallback.chapters,
    lessons,
    lessonProgress,
    assignments: (cols.assignments as DatabaseState['assignments']) ?? fallback.assignments,
    assignmentSubmissions: (cols.assignmentSubmissions as DatabaseState['assignmentSubmissions']) ?? [],
    announcements: (cols.announcements as DatabaseState['announcements']) ?? fallback.announcements,
    certificates: (cols.certificates as DatabaseState['certificates']) ?? [],
    exams,
    examSessionTimers: (cols.examSessionTimers as ExamSessionTimer[]) ?? [],
    examAttempts,
    questionBank: (cols.questionBank as DatabaseState['questionBank']) ?? fallback.questionBank,
    products: (cols.products as DatabaseState['products']) ?? fallback.products,
    ebooks: (cols.ebooks as DatabaseState['ebooks']) ?? fallback.ebooks,
    categories: (cols.categories as DatabaseState['categories']) ?? fallback.categories,
    posts: (cols.posts as DatabaseState['posts']) ?? fallback.posts,
    scormPackages: (cols.scormPackages as DatabaseState['scormPackages']) ?? fallback.scormPackages,
    scormAttempts: (cols.scormAttempts as DatabaseState['scormAttempts']) ?? [],
    rewardsByUser: (cols.rewardsByUser as DatabaseState['rewardsByUser']) ?? fallback.rewardsByUser,
    attendance,
    attendanceCorrections,
    payrolls: (cols.payrolls as DatabaseState['payrolls']) ?? fallback.payrolls,
    financialRecords,
    feeInvoices,
    paymentGateways: (cols.paymentGateways as DatabaseState['paymentGateways']) ?? fallback.paymentGateways,
    paymentSessions,
    transactions,
    enrollments,
    orders: (cols.orders as DatabaseState['orders']) ?? fallback.orders,
    coupons: (cols.coupons as DatabaseState['coupons']) ?? fallback.coupons,
    reviews: (cols.reviews as DatabaseState['reviews']) ?? fallback.reviews,
    results: (cols.results as DatabaseState['results']) ?? fallback.results,
    claimedEbooksByUser: (cols.claimedEbooksByUser as DatabaseState['claimedEbooksByUser']) ?? fallback.claimedEbooksByUser,
    contactMessages: (cols.contactMessages as DatabaseState['contactMessages']) ?? [],
    integrations: (cols.integrations as IntegrationConfig[]) ?? createDefaultIntegrations(),
    communicationLogs,
    inAppNotifications,
    backups,
    recycleBin: (cols.recycleBin as DatabaseState['recycleBin']) ?? [],
    auditLogs,
    campaigns: (cols.campaigns as DatabaseState['campaigns']) ?? fallback.campaigns,
    plugins: (cols.plugins as DatabaseState['plugins']) ?? fallback.plugins,
    webhooks: (cols.webhooks as DatabaseState['webhooks']) ?? fallback.webhooks,
    mediaAssets: (cols.mediaAssets as DatabaseState['mediaAssets']) ?? [],
  };
}

// ---------------- RELATIONAL SESSION, RATE-LIMIT & ENCRYPTED SECRETS ----------------

export function createSessionRecord(params: {
  userId: string;
  rawToken: string;
  ipAddress: string;
  userAgent: string;
  ttlMs?: number;
}): SessionRecord {
  const db = getSqliteDb();
  const id = `sess-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const tokenHash = hashOpaqueToken(params.rawToken);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + (params.ttlMs ?? 1000 * 60 * 60 * 24 * 7)).toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, ip_address, user_agent, created_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
  ).run(id, params.userId, tokenHash, params.ipAddress.slice(0, 64), params.userAgent.slice(0, 200), createdAt, expiresAt);

  return {
    id,
    userId: params.userId,
    tokenHash,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt,
    expiresAt,
    revokedAt: null,
  };
}

export function findValidSessionByToken(rawToken: string): { sessionId: string; userId: string } | null {
  const db = getSqliteDb();
  const tokenHash = hashOpaqueToken(rawToken);
  const row = db
    .prepare('SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE token_hash = ? LIMIT 1')
    .get(tokenHash) as
    | { id: string; user_id: string; expires_at: string; revoked_at: string | null }
    | undefined;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.parse(row.expires_at) < Date.now()) return null;
  return { sessionId: row.id, userId: row.user_id };
}

export function revokeSessionByToken(rawToken: string): void {
  const db = getSqliteDb();
  const tokenHash = hashOpaqueToken(rawToken);
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL').run(
    new Date().toISOString(),
    tokenHash
  );
}

export function revokeAllUserSessions(userId: string): number {
  const db = getSqliteDb();
  const info = db
    .prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), userId);
  return info.changes;
}

export function checkLoginRateLimit(rateKey: string): { allowed: boolean; retryAfterSeconds: number } {
  const db = getSqliteDb();
  const now = Date.now();
  const row = db.prepare('SELECT * FROM login_rate_limits WHERE rate_key = ?').get(rateKey) as
    | { rate_key: string; attempts: number; window_start: number; locked_until: number }
    | undefined;
  if (!row) return { allowed: true, retryAfterSeconds: 0 };
  if (row.locked_until > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((row.locked_until - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordLoginFailure(rateKey: string, maxAttempts = 5, lockMs = 10 * 60 * 1000): {
  locked: boolean;
  remainingAttempts: number;
} {
  const db = getSqliteDb();
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const row = db.prepare('SELECT * FROM login_rate_limits WHERE rate_key = ?').get(rateKey) as
    | { rate_key: string; attempts: number; window_start: number; locked_until: number }
    | undefined;

  let attempts = 1;
  let windowStart = now;
  if (row && now - row.window_start < windowMs) {
    attempts = row.attempts + 1;
    windowStart = row.window_start;
  }
  const lockedUntil = attempts >= maxAttempts ? now + lockMs : 0;

  db.prepare(
    `INSERT INTO login_rate_limits (rate_key, attempts, window_start, locked_until)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(rate_key) DO UPDATE SET attempts=excluded.attempts, window_start=excluded.window_start, locked_until=excluded.locked_until`
  ).run(rateKey, attempts, windowStart, lockedUntil);

  return {
    locked: lockedUntil > now,
    remainingAttempts: Math.max(0, maxAttempts - attempts),
  };
}

export function clearLoginRateLimit(rateKey: string): void {
  const db = getSqliteDb();
  db.prepare('DELETE FROM login_rate_limits WHERE rate_key = ?').run(rateKey);
}

export function createPasswordResetToken(userId: string): string {
  const db = getSqliteDb();
  const rawToken = crypto.randomBytes(24).toString('base64url');
  const tokenHash = hashOpaqueToken(rawToken);
  const now = Date.now();
  db.prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)
     VALUES (?, ?, ?, ?, NULL, ?)`
  ).run(
    `prt-${now}-${crypto.randomBytes(3).toString('hex')}`,
    userId,
    tokenHash,
    new Date(now + 30 * 60 * 1000).toISOString(),
    new Date(now).toISOString()
  );
  return rawToken;
}

export function consumePasswordResetToken(rawToken: string): string | null {
  const db = getSqliteDb();
  const tokenHash = hashOpaqueToken(rawToken);
  const row = db
    .prepare('SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1')
    .get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;
  if (!row || row.used_at || Date.parse(row.expires_at) < Date.now()) {
    return null;
  }
  db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    row.id
  );
  return row.user_id;
}

export function saveEncryptedIntegrationSecrets(key: string, secrets: Record<string, string>): void {
  const db = getSqliteDb();
  const encKey = getEncryptionKey();
  const encrypted: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    if (v && v.trim() && !v.includes('••••') && v !== 'Not Configured') {
      encrypted[k] = encryptIntegrationSecret(v.trim(), encKey);
    }
  }
  const existingRow = db
    .prepare('SELECT secrets_encrypted_json FROM integration_configs WHERE key = ?')
    .get(key) as { secrets_encrypted_json: string } | undefined;
  const merged = {
    ...(existingRow ? JSON.parse(existingRow.secrets_encrypted_json) : {}),
    ...encrypted,
  };
  db.prepare(
    `INSERT INTO integration_configs (id, key, name, category, enabled, mode, configured, health_status, public_config_json, secrets_encrypted_json, updated_at)
     VALUES (?, ?, ?, 'General', 1, 'sandbox', 1, 'configured', '{}', ?, ?)
     ON CONFLICT(key) DO UPDATE SET secrets_encrypted_json = excluded.secrets_encrypted_json, updated_at = excluded.updated_at`
  ).run(`ic-${key}`, key, key, JSON.stringify(merged), new Date().toISOString());
}

export function getDecryptedIntegrationSecrets(key: string): Record<string, string> {
  const db = getSqliteDb();
  const row = db
    .prepare('SELECT secrets_encrypted_json FROM integration_configs WHERE key = ?')
    .get(key) as { secrets_encrypted_json: string } | undefined;
  if (!row) return {};
  const encKey = getEncryptionKey();
  const parsed = JSON.parse(row.secrets_encrypted_json || '{}') as Record<string, string>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    const dec = decryptIntegrationSecret(v, encKey);
    if (dec) out[k] = dec;
  }
  return out;
}

export function recordWebhookEventIdempotent(params: {
  eventKey: string;
  gateway: string;
  signatureValid: boolean;
  payload: unknown;
}): boolean {
  const db = getSqliteDb();
  const existing = db
    .prepare('SELECT id FROM payment_webhook_events WHERE event_key = ?')
    .get(params.eventKey);
  if (existing) return false;
  db.prepare(
    `INSERT INTO payment_webhook_events (id, event_key, gateway, signature_valid, payload_json, processed_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `whe-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    params.eventKey,
    params.gateway,
    params.signatureValid ? 1 : 0,
    JSON.stringify(params.payload),
    new Date().toISOString()
  );
  return true;
}

export function writeVerifiedDiskBackup(label: string, payloadJson: string): {
  filePath: string;
  checksumSha256: string;
} {
  const backupsDir = resolveBackupsDir();
  fs.mkdirSync(backupsDir, { recursive: true });
  const safeLabel = label.toLowerCase().replace(/[^a-z0-9-_]+/g, '-').slice(0, 40) || 'backup';
  const filePath = path.join(backupsDir, `${Date.now()}-${safeLabel}.json`);
  const checksumSha256 = crypto.createHash('sha256').update(payloadJson).digest('hex');
  fs.writeFileSync(filePath, payloadJson, 'utf8');
  fs.writeFileSync(`${filePath}.sha256`, checksumSha256, 'utf8');
  return { filePath, checksumSha256 };
}
