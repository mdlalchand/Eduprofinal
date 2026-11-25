import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';
import {
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_HEADER_MENU,
  normalizeDashboardConfig,
  normalizeHeaderMenu,
} from '../lib/domain';
import { enrichAuditLogEntry } from '../lib/auditLogs';
import {
  describePgSslMode,
  parsePgSslConfig,
  redactDatabaseUrl,
} from '../server/envConfig';
import { createDefaultIntegrations } from '../server/integrationSeed';
import type { DatabaseState, ExamSessionTimer, StoredUser } from '../server/storeTypes';
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
import {
  getSqliteDb,
  loadStateFromSqlite,
  sanitizeLegacyStateForRelationalMigration,
  writeVerifiedDiskBackup,
} from './persistence';

export interface PgQueryable {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
}

const ALLOWED_ROLES = new Set(['admin', 'teacher', 'student', 'guardian', 'branch']);
const ALLOWED_USER_STATUSES = new Set(['pending', 'active', 'suspended', 'rejected']);

function normalizeUserStatus(status: unknown): 'pending' | 'active' | 'suspended' | 'rejected' {
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

let pgPool: Pool | null = null;
let appliedMigrationVersions: string[] = [];
let pgWriteQueue: Promise<void> = Promise.resolve();
let lastPgInitError: string | null = null;

export function isPostgresMode(): boolean {
  if ((process.env.DB_DRIVER ?? '').trim().toLowerCase() === 'sqlite') {
    return false;
  }
  return Boolean(process.env.DATABASE_URL?.trim() || process.env.PGHOST?.trim());
}

export function isPostgresActive(): boolean {
  return Boolean(pgPool);
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

export async function runPostgresMigrationsWithClient(
  client: PgQueryable,
  migrationsDir = path.resolve(process.cwd(), 'db', 'migrations')
): Promise<string[]> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const appliedRes = await client.query<{ version: string }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC'
  );
  const applied = new Set(appliedRes.rows.map((r) => r.version));

  if (!fs.existsSync(migrationsDir)) {
    return Array.from(applied);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8').trim();
    if (!sql) continue;

    const hasExplicitTx = /\bBEGIN\s*;/i.test(sql);
    try {
      if (!hasExplicitTx) await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, applied_at) VALUES ($1, NOW()) ON CONFLICT (version) DO NOTHING',
        [file]
      );
      if (!hasExplicitTx) await client.query('COMMIT');
      applied.add(file);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw new Error(
        `PostgreSQL migration "${file}" failed: ${redactDatabaseUrl(
          err instanceof Error ? err.message : String(err)
        )}`
      );
    }
  }

  return Array.from(applied).sort();
}

export async function persistStateToPostgresWithClient(
  client: PgQueryable,
  state: DatabaseState
): Promise<void> {
  const admins = state.users.filter((u) => u.role === 'admin');
  if (admins.length > 1) {
    throw new Error('SECURITY VIOLATION: Cannot persist more than 1 Main Admin account to PostgreSQL.');
  }
  for (const u of state.users) {
    if (!ALLOWED_ROLES.has(u.role)) {
      throw new Error(`SECURITY VIOLATION: Forbidden role "${u.role}" on user ${u.email}.`);
    }
  }

  const now = new Date().toISOString();
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO site_settings (id, payload_json, updated_at)
       VALUES (1, $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(state.settings), now]
    );

    const branchIds = new Set(state.branches.map((b) => b.id));
    for (const b of state.branches) {
      const nb = normalizeBranch(b);
      await client.query(
        `INSERT INTO branches (id, name, code, city, address, phone, manager_name, active_students, status, image, created_at, updated_at, archived_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, code=EXCLUDED.code, city=EXCLUDED.city, address=EXCLUDED.address,
           phone=EXCLUDED.phone, manager_name=EXCLUDED.manager_name, active_students=EXCLUDED.active_students,
           status=EXCLUDED.status, image=EXCLUDED.image, updated_at=EXCLUDED.updated_at, archived_at=EXCLUDED.archived_at`,
        [
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
          nb.archivedAt ?? null,
        ]
      );
    }

    for (const h of state.branchStatusHistory) {
      await client.query(
        `INSERT INTO branch_status_history (id, branch_id, branch_name, previous_status, new_status, reason, actor_id, actor_name, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [h.id, h.branchId, h.branchName, h.previousStatus, h.newStatus, h.reason, h.actorId, h.actorName, h.createdAt]
      );
    }

    for (const r of state.revokedLegacyAccounts) {
      await client.query(
        `INSERT INTO revoked_legacy_accounts (id, original_user_id, name, email, previous_role, branch_id, reason, revoked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING`,
        [r.id, r.originalUserId, r.name, r.email, r.previousRole, r.branchId, r.reason, r.revokedAt]
      );
    }

    const nextUserIds = new Set(state.users.map((u) => u.id));
    const existingUsers = await client.query<{ id: string }>('SELECT id FROM users');
    for (const row of existingUsers.rows) {
      if (!nextUserIds.has(row.id)) {
        await client.query('DELETE FROM users WHERE id = $1', [row.id]);
      }
    }

    for (const u of state.users) {
      const safeBranch = u.branchId && branchIds.has(u.branchId) ? u.branchId : null;
      await client.query(
        `INSERT INTO users (
           id, name, email, phone, role, branch_id, roll_number, guardian_linked_student_ids,
           avatar, status, bio, subject_specialty, education, approved_at, approved_by, approval_note,
           password_hash, must_reset_password, password_updated_at, two_factor_enabled,
           two_factor_secret, two_factor_recovery_hashes, communication_consent, last_login_at, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24,$25)
         ON CONFLICT (id) DO UPDATE SET
           name=EXCLUDED.name, email=EXCLUDED.email, phone=EXCLUDED.phone, role=EXCLUDED.role,
           branch_id=EXCLUDED.branch_id, roll_number=EXCLUDED.roll_number,
           guardian_linked_student_ids=EXCLUDED.guardian_linked_student_ids,
           avatar=EXCLUDED.avatar, status=EXCLUDED.status, bio=EXCLUDED.bio,
           subject_specialty=EXCLUDED.subject_specialty, education=EXCLUDED.education,
           approved_at=EXCLUDED.approved_at, approved_by=EXCLUDED.approved_by,
           approval_note=EXCLUDED.approval_note, password_hash=EXCLUDED.password_hash,
           must_reset_password=EXCLUDED.must_reset_password, password_updated_at=EXCLUDED.password_updated_at,
           two_factor_enabled=EXCLUDED.two_factor_enabled, two_factor_secret=EXCLUDED.two_factor_secret,
           two_factor_recovery_hashes=EXCLUDED.two_factor_recovery_hashes,
           communication_consent=EXCLUDED.communication_consent,
           last_login_at=EXCLUDED.last_login_at`,
        [
          u.id,
          u.name,
          u.email.toLowerCase(),
          u.phone,
          u.role,
          safeBranch,
          u.rollNumber ?? null,
          JSON.stringify(u.guardianLinkedStudentIds ?? []),
          u.avatar ?? null,
          normalizeUserStatus(u.status),
          u.bio ?? null,
          u.subjectSpecialty ?? null,
          u.education ?? null,
          u.approvedAt ?? null,
          u.approvedBy ?? null,
          u.approvalNote ?? null,
          u.passwordHash,
          Boolean(u.mustResetPassword),
          u.passwordUpdatedAt ?? null,
          Boolean(u.twoFactorEnabled),
          u.twoFactorSecret ?? null,
          JSON.stringify(u.twoFactorRecoveryHashes ?? []),
          JSON.stringify(u.communicationConsent ?? { email: true, sms: true, whatsapp: true }),
          u.lastLoginAt ?? null,
          u.createdAt,
        ]
      );
    }

    // Courses
    await client.query('DELETE FROM courses');
    const courseIds = new Set(state.courses.map((c) => c.id));
    for (const c of state.courses) {
      const safeCreator = c.createdByUserId && nextUserIds.has(c.createdByUserId) ? c.createdByUserId : null;
      await client.query(
        `INSERT INTO courses (id, slug, title, subtitle, category, level_tag, price, original_price, enrolled_count, status, created_by_user_id, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
        [
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
          JSON.stringify(c),
        ]
      );
    }

    // Batches
    await client.query('DELETE FROM batches');
    const batchIds = new Set(state.batches.map((b) => b.id));
    for (const b of state.batches) {
      if (!courseIds.has(b.courseId) || !branchIds.has(b.branchId)) continue;
      await client.query(
        `INSERT INTO batches (id, course_id, name, code, branch_id, instructor_id, seat_limit, enrolled_seats, status, lifecycle_status, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
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
          JSON.stringify(b),
        ]
      );
    }

    // Enrollments
    await client.query('DELETE FROM enrollments');
    for (const e of state.enrollments) {
      if (!nextUserIds.has(e.userId) || !courseIds.has(e.courseId) || !branchIds.has(e.branchId)) continue;
      const safeBatch = e.batchId && batchIds.has(e.batchId) ? e.batchId : null;
      await client.query(
        `INSERT INTO enrollments (id, user_id, course_id, branch_id, batch_id, status, amount_paid, enrolled_at, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [e.id, e.userId, e.courseId, e.branchId, safeBatch, e.status, e.amountPaid, e.enrolledAt, JSON.stringify(e)]
      );
    }

    // Lessons & Lesson Progress
    await client.query('DELETE FROM lesson_progress');
    await client.query('DELETE FROM lessons');
    const lessonIds = new Set(state.lessons.map((l) => l.id));
    for (const l of state.lessons) {
      if (!courseIds.has(l.courseId)) continue;
      await client.query(
        `INSERT INTO lessons (id, course_id, module_id, batch_id, lesson_type, title, order_index, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [l.id, l.courseId, l.moduleId ?? null, l.batchId ?? null, l.lessonType, l.title, l.orderIndex, JSON.stringify(l)]
      );
    }
    for (const lp of state.lessonProgress) {
      if (!nextUserIds.has(lp.userId) || !courseIds.has(lp.courseId) || !lessonIds.has(lp.lessonId)) continue;
      await client.query(
        `INSERT INTO lesson_progress (id, user_id, course_id, lesson_id, watched_seconds, duration_seconds, percent_watched, completed, last_position_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          lp.id,
          lp.userId,
          lp.courseId,
          lp.lessonId,
          lp.watchedSeconds,
          lp.durationSeconds,
          lp.percentWatched,
          Boolean(lp.completed),
          lp.lastPositionAt,
        ]
      );
    }

    // Exams & Attempts
    await client.query('DELETE FROM exam_attempts');
    await client.query('DELETE FROM exams');
    const examIds = new Set(state.exams.map((ex) => ex.id));
    for (const ex of state.exams) {
      const safeCourse = ex.courseId && courseIds.has(ex.courseId) ? ex.courseId : null;
      await client.query(
        `INSERT INTO exams (id, course_id, batch_id, title, visibility, teacher_id, created_at, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
        [ex.id, safeCourse, ex.batchId ?? null, ex.title, ex.visibility, ex.teacherId, ex.createdAt, JSON.stringify(ex)]
      );
    }
    for (const a of state.examAttempts) {
      if (!examIds.has(a.examId) || !nextUserIds.has(a.userId)) continue;
      const safeBr = a.branchId && branchIds.has(a.branchId) ? a.branchId : null;
      await client.query(
        `INSERT INTO exam_attempts (id, exam_id, user_id, branch_id, roll_number, score, total_marks, percentage, passed, submitted_at, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          a.id,
          a.examId,
          a.userId,
          safeBr,
          a.rollNumber,
          a.score,
          a.totalMarks,
          a.percentage,
          Boolean(a.passed),
          a.submittedAt,
          JSON.stringify(a),
        ]
      );
    }

    // Attendance & Corrections
    await client.query('DELETE FROM attendance_corrections');
    await client.query('DELETE FROM attendance');
    const attIds = new Set(state.attendance.map((a) => a.id));
    for (const rec of state.attendance) {
      const safeBr = rec.branchId && branchIds.has(rec.branchId) ? rec.branchId : null;
      const safeBat = rec.batchId && batchIds.has(rec.batchId) ? rec.batchId : null;
      await client.query(
        `INSERT INTO attendance (id, target_type, target_id, branch_id, batch_id, att_date, status, recorded_by, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         ON CONFLICT (target_type, target_id, att_date, batch_id) DO UPDATE SET
           status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by, payload_json = EXCLUDED.payload_json`,
        [rec.id, rec.targetType, rec.targetId, safeBr, safeBat, rec.date, rec.status, rec.recordedBy, JSON.stringify(rec)]
      );
    }
    for (const corr of state.attendanceCorrections) {
      if (!attIds.has(corr.attendanceId)) continue;
      await client.query(
        `INSERT INTO attendance_corrections (id, attendance_id, target_name, previous_status, new_status, reason, corrected_by_id, corrected_by_name, corrected_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [
          corr.id,
          corr.attendanceId,
          corr.targetName,
          corr.previousStatus,
          corr.newStatus,
          corr.reason,
          corr.correctedById,
          corr.correctedByName,
          corr.correctedAt,
        ]
      );
    }

    // Financial records, fee invoices, transactions, payment sessions
    await client.query('DELETE FROM financial_records');
    for (const f of state.financialRecords) {
      const safeBr = f.branchId && branchIds.has(f.branchId) ? f.branchId : null;
      await client.query(
        `INSERT INTO financial_records (id, rec_type, category, amount, branch_id, rec_date, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [f.id, f.type, f.category, f.amount, safeBr, f.date, JSON.stringify(f)]
      );
    }

    await client.query('DELETE FROM fee_invoices');
    for (const inv of state.feeInvoices) {
      if (!nextUserIds.has(inv.studentUserId) || !branchIds.has(inv.branchId)) continue;
      await client.query(
        `INSERT INTO fee_invoices (id, invoice_no, student_user_id, student_name, branch_id, course_id, batch_id, fee_type, title, total_amount, paid_amount, due_amount, due_date, installment_plan_label, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
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
          inv.updatedAt,
        ]
      );
    }

    await client.query('DELETE FROM transactions');
    for (const t of state.transactions) {
      if (!nextUserIds.has(t.userId)) continue;
      await client.query(
        `INSERT INTO transactions (id, invoice_no, reference_type, reference_id, user_id, gateway, trx_id, total_amount, status, created_at, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [t.id, t.invoiceNo, t.referenceType, t.referenceId, t.userId, t.gateway, t.trxId, t.totalAmount, t.status, t.createdAt, JSON.stringify(t)]
      );
    }

    await client.query('DELETE FROM payment_sessions');
    for (const ps of state.paymentSessions) {
      if (!nextUserIds.has(ps.userId)) continue;
      await client.query(
        `INSERT INTO payment_sessions (id, idempotency_key, user_id, reference_type, reference_id, branch_id, gateway, mode, amount, currency, status, provider_payment_id, checkout_url, trx_id, webhook_verified_at, metadata_json, created_at, expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17,$18)`,
        [
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
          ps.expiresAt,
        ]
      );
    }

    // Logs, notifications, backups
    await client.query('DELETE FROM audit_logs');
    for (const a of state.auditLogs) {
      await client.query(
        `INSERT INTO audit_logs (id, actor_id, actor_name, actor_role, category, severity, action, target, details, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [a.id, a.actorId, a.actorName, a.actorRole, a.category ?? null, a.severity ?? null, a.action, a.target, a.details, a.createdAt]
      );
    }

    await client.query('DELETE FROM communication_logs');
    for (const cl of state.communicationLogs.slice(0, 500)) {
      await client.query(
        `INSERT INTO communication_logs (id, channel, provider, recipient, recipient_user_id, subject, body_preview, status, provider_message_id, error_message, attempts, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
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
          cl.updatedAt,
        ]
      );
    }

    await client.query('DELETE FROM in_app_notifications');
    for (const n of state.inAppNotifications.slice(0, 500)) {
      if (!nextUserIds.has(n.userId)) continue;
      await client.query(
        `INSERT INTO in_app_notifications (id, user_id, title, message, type, read, action_url, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [n.id, n.userId, n.title, n.message, n.type, Boolean(n.read), n.actionUrl ?? null, n.createdAt]
      );
    }

    await client.query('DELETE FROM backups');
    for (const bkp of state.backups.slice(0, 20)) {
      await client.query(
        `INSERT INTO backups (id, label, reason, checksum_sha256, verified, created_by, created_at, summary_json, payload_json)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        [
          bkp.id,
          bkp.label,
          bkp.reason,
          bkp.checksumSha256,
          Boolean(bkp.verified),
          bkp.createdBy,
          bkp.createdAt,
          JSON.stringify(bkp.summary),
          bkp.payloadJson ?? null,
        ]
      );
    }

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

    for (const [k, v] of Object.entries(collectionMap)) {
      await client.query(
        `INSERT INTO json_collections (collection_name, payload_json, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (collection_name) DO UPDATE SET payload_json = EXCLUDED.payload_json, updated_at = EXCLUDED.updated_at`,
        [k, JSON.stringify(v), now]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

export async function loadStateFromPostgresWithClient(
  client: PgQueryable,
  defaultFactory: () => DatabaseState
): Promise<DatabaseState> {
  const fallback = defaultFactory();

  const settingsRes = await client.query<{ payload_json: DatabaseState['settings'] }>(
    'SELECT payload_json FROM site_settings WHERE id = 1'
  );
  const settings = settingsRes.rows[0]?.payload_json ?? fallback.settings;
  settings.headerMenu = normalizeHeaderMenu(settings.headerMenu, DEFAULT_HEADER_MENU);
  settings.dashboardConfig = normalizeDashboardConfig(settings.dashboardConfig, DEFAULT_DASHBOARD_CONFIG);

  const branchesRes = await client.query('SELECT * FROM branches');
  const branches: Branch[] = branchesRes.rows.map((r) => ({
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
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : undefined,
    updatedAt: r.updated_at ? new Date(String(r.updated_at)).toISOString() : undefined,
    archivedAt: r.archived_at ? new Date(String(r.archived_at)).toISOString() : null,
  }));

  const histRes = await client.query('SELECT * FROM branch_status_history ORDER BY created_at DESC');
  const branchStatusHistory: BranchStatusHistoryEntry[] = histRes.rows.map((r) => ({
    id: String(r.id),
    branchId: String(r.branch_id),
    branchName: String(r.branch_name),
    previousStatus: String(r.previous_status) as BranchStatus,
    newStatus: String(r.new_status) as BranchStatus,
    reason: String(r.reason),
    actorId: String(r.actor_id),
    actorName: String(r.actor_name),
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));

  const usersRes = await client.query('SELECT * FROM users');
  const users: StoredUser[] = usersRes.rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    email: String(r.email),
    phone: String(r.phone),
    role: String(r.role) as StoredUser['role'],
    branchId: r.branch_id ? String(r.branch_id) : null,
    rollNumber: r.roll_number ? String(r.roll_number) : undefined,
    guardianLinkedStudentIds: Array.isArray(r.guardian_linked_student_ids)
      ? r.guardian_linked_student_ids.map(String)
      : [],
    avatar: r.avatar ? String(r.avatar) : undefined,
    status: normalizeUserStatus(r.status),
    bio: r.bio ? String(r.bio) : undefined,
    subjectSpecialty: r.subject_specialty ? String(r.subject_specialty) : undefined,
    education: r.education ? String(r.education) : undefined,
    approvedAt: r.approved_at ? new Date(String(r.approved_at)).toISOString() : undefined,
    approvedBy: r.approved_by ? String(r.approved_by) : undefined,
    approvalNote: r.approval_note ? String(r.approval_note) : undefined,
    passwordHash: String(r.password_hash ?? ''),
    mustResetPassword: Boolean(r.must_reset_password),
    passwordUpdatedAt: r.password_updated_at ? new Date(String(r.password_updated_at)).toISOString() : null,
    twoFactorEnabled: Boolean(r.two_factor_enabled),
    twoFactorSecret: r.two_factor_secret ? String(r.two_factor_secret) : null,
    twoFactorRecoveryHashes: Array.isArray(r.two_factor_recovery_hashes)
      ? r.two_factor_recovery_hashes.map(String)
      : [],
    communicationConsent: (r.communication_consent as StoredUser['communicationConsent']) ?? {
      email: true,
      sms: true,
      whatsapp: true,
    },
    lastLoginAt: r.last_login_at ? new Date(String(r.last_login_at)).toISOString() : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));

  const revRes = await client.query('SELECT * FROM revoked_legacy_accounts ORDER BY revoked_at DESC');
  const revokedLegacyAccounts: RevokedLegacyAccount[] = revRes.rows.map((r) => ({
    id: String(r.id),
    originalUserId: String(r.original_user_id),
    name: String(r.name),
    email: String(r.email),
    previousRole: String(r.previous_role),
    branchId: r.branch_id ? String(r.branch_id) : null,
    reason: String(r.reason),
    revokedAt: new Date(String(r.revoked_at)).toISOString(),
  }));

  const courses = (await client.query<{ payload_json: DatabaseState['courses'][number] }>('SELECT payload_json FROM courses')).rows.map(
    (r) => r.payload_json
  );
  const batches = (await client.query<{ payload_json: DatabaseState['batches'][number] }>('SELECT payload_json FROM batches')).rows.map(
    (r) => r.payload_json
  );
  const enrollments = (await client.query<{ payload_json: DatabaseState['enrollments'][number] }>('SELECT payload_json FROM enrollments')).rows.map(
    (r) => r.payload_json
  );
  const lessons = (await client.query<{ payload_json: DatabaseState['lessons'][number] }>('SELECT payload_json FROM lessons ORDER BY order_index ASC')).rows.map(
    (r) => r.payload_json
  );
  const lessonProgress: LessonProgressRecord[] = (await client.query('SELECT * FROM lesson_progress')).rows.map(
    (r) => ({
      id: String(r.id),
      userId: String(r.user_id),
      courseId: String(r.course_id),
      lessonId: String(r.lesson_id),
      watchedSeconds: Number(r.watched_seconds),
      durationSeconds: Number(r.duration_seconds),
      percentWatched: Number(r.percent_watched),
      completed: Boolean(r.completed),
      lastPositionAt: new Date(String(r.last_position_at)).toISOString(),
    })
  );
  const exams = (await client.query<{ payload_json: DatabaseState['exams'][number] }>('SELECT payload_json FROM exams')).rows.map(
    (r) => r.payload_json
  );
  const examAttempts = (await client.query<{ payload_json: DatabaseState['examAttempts'][number] }>('SELECT payload_json FROM exam_attempts ORDER BY submitted_at DESC')).rows.map(
    (r) => r.payload_json
  );
  const attendance = (await client.query<{ payload_json: DatabaseState['attendance'][number] }>('SELECT payload_json FROM attendance ORDER BY att_date DESC')).rows.map(
    (r) => r.payload_json
  );
  const attendanceCorrections: AttendanceCorrectionEntry[] = (
    await client.query('SELECT * FROM attendance_corrections ORDER BY corrected_at DESC')
  ).rows.map((r) => ({
    id: String(r.id),
    attendanceId: String(r.attendance_id),
    targetName: String(r.target_name),
    previousStatus: String(r.previous_status) as AttendanceCorrectionEntry['previousStatus'],
    newStatus: String(r.new_status) as AttendanceCorrectionEntry['newStatus'],
    reason: String(r.reason),
    correctedById: String(r.corrected_by_id),
    correctedByName: String(r.corrected_by_name),
    correctedAt: new Date(String(r.corrected_at)).toISOString(),
  }));

  const financialRecords = (
    await client.query<{ payload_json: DatabaseState['financialRecords'][number] }>(
      'SELECT payload_json FROM financial_records ORDER BY rec_date DESC'
    )
  ).rows.map((r) => r.payload_json);

  const feeInvoices: FeeInvoice[] = (await client.query('SELECT * FROM fee_invoices ORDER BY created_at DESC')).rows.map(
    (r) => ({
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
      createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString(),
    })
  );

  const transactions = (
    await client.query<{ payload_json: DatabaseState['transactions'][number] }>(
      'SELECT payload_json FROM transactions ORDER BY created_at DESC'
    )
  ).rows.map((r) => r.payload_json);

  const paymentSessions: PaymentSessionRecord[] = (
    await client.query('SELECT * FROM payment_sessions ORDER BY created_at DESC')
  ).rows.map((r) => ({
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
    webhookVerifiedAt: r.webhook_verified_at ? new Date(String(r.webhook_verified_at)).toISOString() : undefined,
    metadataJson: r.metadata_json ? JSON.stringify(r.metadata_json) : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
    expiresAt: new Date(String(r.expires_at)).toISOString(),
  }));

  const auditLogs = (await client.query('SELECT * FROM audit_logs ORDER BY created_at DESC')).rows.map((r) =>
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
      createdAt: new Date(String(r.created_at)).toISOString(),
    })
  );

  const communicationLogs: CommunicationLogEntry[] = (
    await client.query('SELECT * FROM communication_logs ORDER BY created_at DESC')
  ).rows.map((r) => ({
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
    createdAt: new Date(String(r.created_at)).toISOString(),
    updatedAt: new Date(String(r.updated_at)).toISOString(),
  }));

  const inAppNotifications: InAppNotification[] = (
    await client.query('SELECT * FROM in_app_notifications ORDER BY created_at DESC')
  ).rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    title: String(r.title),
    message: String(r.message),
    type: String(r.type) as InAppNotification['type'],
    read: Boolean(r.read),
    actionUrl: r.action_url ? String(r.action_url) : undefined,
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));

  const backups = (await client.query('SELECT * FROM backups ORDER BY created_at DESC')).rows.map((r) => ({
    id: String(r.id),
    label: String(r.label),
    reason: String(r.reason) as 'manual' | 'pre_reset' | 'pre_restore',
    checksumSha256: String(r.checksum_sha256),
    verified: Boolean(r.verified),
    createdBy: String(r.created_by),
    createdAt: new Date(String(r.created_at)).toISOString(),
    summary: r.summary_json as DatabaseState['backups'][number]['summary'],
    payloadJson: r.payload_json ? String(r.payload_json) : undefined,
  }));

  const colRows = (
    await client.query<{ collection_name: string; payload_json: unknown }>(
      'SELECT collection_name, payload_json FROM json_collections'
    )
  ).rows;
  const cols: Record<string, unknown> = {};
  for (const row of colRows) {
    cols[row.collection_name] = row.payload_json;
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

export async function migrateLegacyStateToPostgresIfEmpty(
  client: PgQueryable,
  defaultFactory: () => DatabaseState,
  legacyJsonPath = path.resolve(process.cwd(), 'data', 'db.json')
): Promise<{ migrated: boolean; source: 'existing_postgres' | 'sqlite' | 'db_json' | 'fresh'; state: DatabaseState }> {
  const existingSettings = await client.query<{ cnt: number }>(
    'SELECT COUNT(*)::int AS cnt FROM site_settings WHERE id = 1'
  );
  if (Number(existingSettings.rows[0]?.cnt ?? 0) > 0) {
    // Production data already exists in PostgreSQL: never reset or overwrite
    const loaded = await loadStateFromPostgresWithClient(client, defaultFactory);
    return { migrated: false, source: 'existing_postgres', state: loaded };
  }

  let sourceState: Partial<DatabaseState> | null = null;
  let sourceKind: 'sqlite' | 'db_json' | 'fresh' = 'fresh';

  // Prefer existing migrated SQLite store if populated, else data/db.json
  try {
    const sqlite = getSqliteDb();
    const hasSqliteSettings = sqlite.prepare('SELECT id FROM site_settings WHERE id = 1').get();
    if (hasSqliteSettings) {
      sourceState = loadStateFromSqlite(defaultFactory);
      sourceKind = 'sqlite';
    }
  } catch {
    // ignore if SQLite unavailable
  }

  if (!sourceState && fs.existsSync(legacyJsonPath)) {
    const raw = fs.readFileSync(legacyJsonPath, 'utf8');
    try {
      sourceState = JSON.parse(raw) as Partial<DatabaseState>;
      sourceKind = 'db_json';
    } catch (err) {
      throw new Error(
        `CRITICAL: Legacy JSON file ${legacyJsonPath} is corrupted (${
          err instanceof Error ? err.message : 'parse error'
        }). Refusing to overwrite with seed data.`
      );
    }
    writeVerifiedDiskBackup('pre-postgres-migration', raw);
  }

  const sanitized = sanitizeLegacyStateForRelationalMigration(
    sourceState ?? defaultFactory(),
    defaultFactory
  );

  // Create verified backup before writing to PostgreSQL if migrating from live records
  if (sourceKind !== 'fresh') {
    const backupJson = JSON.stringify({ ...sanitized.state, backups: [] });
    writeVerifiedDiskBackup(`pre-postgres-${sourceKind}`, backupJson);
  }

  await persistStateToPostgresWithClient(client, sanitized.state);
  await client.query(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ('migrated_to_postgres', $1, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [`${sourceKind}:${new Date().toISOString()}`]
  );

  const loaded = await loadStateFromPostgresWithClient(client, defaultFactory);
  return { migrated: true, source: sourceKind, state: loaded };
}

export async function initPostgresIfConfigured(
  defaultFactory?: () => DatabaseState
): Promise<{
  enabled: boolean;
  connected: boolean;
  initialState?: DatabaseState;
  migrationSource?: string;
  appliedMigrations: string[];
  error?: string;
}> {
  if (!isPostgresMode()) {
    lastPgInitError = null;
    return { enabled: false, connected: false, appliedMigrations: [] };
  }

  const connectionString = (process.env.DATABASE_URL ?? '').trim();
  const sslConfig = parsePgSslConfig(process.env.PGSSL, connectionString);

  pgPool = new Pool(
    connectionString
      ? {
          connectionString,
          ssl: sslConfig,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        }
      : {
          host: process.env.PGHOST,
          port: Number(process.env.PGPORT || 5432),
          database: process.env.PGDATABASE,
          user: process.env.PGUSER,
          password: process.env.PGPASSWORD,
          ssl: sslConfig,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        }
  );

  pgPool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]', redactDatabaseUrl(err.message));
  });

  let client: PoolClient;
  try {
    client = await pgPool.connect();
  } catch (err) {
    const msg = redactDatabaseUrl(err instanceof Error ? err.message : String(err));
    lastPgInitError = msg;
    await pgPool.end().catch(() => undefined);
    pgPool = null;
    throw new Error(`PostgreSQL connection failed: ${msg}`);
  }

  try {
    await client.query('SELECT 1');
    appliedMigrationVersions = await runPostgresMigrationsWithClient(client);

    const adminCheck = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM users WHERE role = 'admin'"
    );
    const adminCount = Number(adminCheck.rows[0]?.count || '0');
    if (adminCount > 1) {
      throw new Error(
        `CRITICAL: PostgreSQL database contains ${adminCount} admin accounts. Only 1 Main Admin is allowed. Resolve duplicates manually before booting.`
      );
    }

    let initialState: DatabaseState | undefined;
    let migrationSource: string | undefined;
    if (defaultFactory) {
      const res = await migrateLegacyStateToPostgresIfEmpty(client, defaultFactory);
      initialState = res.state;
      migrationSource = res.source;
    }

    lastPgInitError = null;
    return {
      enabled: true,
      connected: true,
      initialState,
      migrationSource,
      appliedMigrations: appliedMigrationVersions,
    };
  } finally {
    client.release();
  }
}

export function enqueuePostgresPersist(state: DatabaseState): void {
  if (!pgPool) return;
  const snapshot = structuredClone(state);
  pgWriteQueue = pgWriteQueue
    .then(async () => {
      if (!pgPool) return;
      const client = await pgPool.connect();
      try {
        await persistStateToPostgresWithClient(client, snapshot);
      } finally {
        client.release();
      }
    })
    .catch((err) => {
      console.error(
        '[PostgreSQL Persist Error]',
        redactDatabaseUrl(err instanceof Error ? err.message : String(err))
      );
    });
}

export async function flushPostgresWrites(): Promise<void> {
  await pgWriteQueue;
}

export async function postgresHealthCheck(): Promise<{
  configured: boolean;
  connected: boolean;
  detail: string;
  latencyMs?: number;
  sslMode: string;
  appliedMigrations: string[];
}> {
  const configured = isPostgresMode();
  const sslMode = configured ? describePgSslMode() : 'not configured';
  if (!configured) {
    return {
      configured: false,
      connected: false,
      detail: 'DATABASE_URL not set (running local SQLite WAL fallback)',
      sslMode,
      appliedMigrations: [],
    };
  }
  if (!pgPool) {
    return {
      configured: true,
      connected: false,
      detail: lastPgInitError || 'PostgreSQL pool is not initialized',
      sslMode,
      appliedMigrations: appliedMigrationVersions,
    };
  }

  const start = Date.now();
  try {
    await pgPool.query('SELECT 1');
    return {
      configured: true,
      connected: true,
      detail: `Connected (${sslMode})`,
      latencyMs: Date.now() - start,
      sslMode,
      appliedMigrations: appliedMigrationVersions,
    };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      detail: redactDatabaseUrl(err instanceof Error ? err.message : 'PostgreSQL health check failed'),
      sslMode,
      appliedMigrations: appliedMigrationVersions,
    };
  }
}

export async function closePostgresPool(): Promise<void> {
  await flushPostgresWrites();
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
}

export function computeSha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}
