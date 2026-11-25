import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import nodemailer from 'nodemailer';
import {
  checkDatabaseHealth,
  getDecryptedIntegrationSecrets,
  revokeAllUserSessions,
  saveEncryptedIntegrationSecrets,
} from '../db/persistence';
import { postgresHealthCheck } from '../db/postgresAdapter';
import { canTeacherManageCourse, getTeacherAssignedCourseIds } from '../lib/courseEnterprise';
import { maskSecretValue } from '../lib/domain';
import { recalculateExamAttemptGrade } from '../lib/usersAndTeaching';
import { isStudentApprovedInCourse, normalizePhoneDigits } from './publicRedaction';
import type {
  AcademicClassSection,
  AcademicSubject,
  AcademicYear,
  AttendanceCorrectionEntry,
  BranchStatus,
  BranchStatusHistoryEntry,
  CourseRoutineItem,
  FeeInvoice,
  LessonProgressRecord,
  StudentAdmissionRecord,
  UserRole,
} from '../types';
import { dispatchRealCommunication } from './communicationService';
import {
  assertBranchOperationalForTransactions,
  initiateServerPaymentSession,
  processSignedWebhookCallback,
} from './paymentService';
import {
  buildTotpUri,
  generateRecoveryCodes,
  generateTotpSecret,
  isValidBangladeshPhone,
  verifyTotpCode,
} from './security';
import { getDb, recordAuditLog, saveDb, verifyPassword } from './store';
import type { StoredUser } from './storeTypes';

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

type RequireAuthFn = (req: AuthedRequest, res: Response, next: NextFunction) => void;
type RequireRoleFn = (roles: UserRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => void;

export function createEnterpriseOpsRouter(
  requireAuth: RequireAuthFn,
  requireRole: RequireRoleFn
) {
  const router = express.Router();

  // ---------------- MAIN ADMIN 2FA & SESSION SECURITY ----------------

  router.get('/api/portal/security/db-health', requireAuth, requireRole(['admin']), async (_req, res) => {
    const sqliteHealth = checkDatabaseHealth();
    const pgHealth = await postgresHealthCheck();
    const db = getDb();
    res.json({
      sqlite: sqliteHealth,
      postgres: pgHealth,
      revokedLegacyAccounts: db.revokedLegacyAccounts,
      backupCount: db.backups.length,
    });
  });

  router.post('/api/portal/security/revoke-all-sessions', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const targetUserId =
      actor.role === 'admin' && req.body?.userId ? String(req.body.userId) : actor.id;
    const revokedCount = revokeAllUserSessions(targetUserId);
    const db = getDb();
    recordAuditLog(
      db,
      actor,
      'SESSIONS_REVOKED',
      targetUserId,
      `Revoked ${revokedCount} active session(s)`
    );
    saveDb(db);
    res.json({ ok: true, revokedCount });
  });

  router.post('/api/portal/security/2fa/setup', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const admin = db.users.find((u) => u.id === req.authUser!.id && u.role === 'admin');
    if (!admin) {
      res.status(404).json({ error: 'Main Admin account not found.' });
      return;
    }
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, admin.email, 'Aloms English Center EDUPro');
    const recovery = generateRecoveryCodes(6);
    admin.twoFactorSecret = secret;
    admin.twoFactorRecoveryHashes = recovery.hashes;
    admin.twoFactorEnabled = false; // Enabled only after verifying first code
    saveDb(db);
    res.json({
      secret,
      otpauthUri: uri,
      recoveryCodes: recovery.plainCodes,
    });
  });

  router.post('/api/portal/security/2fa/enable', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const code = String(req.body?.code ?? '').trim();
    const db = getDb();
    const admin = db.users.find((u) => u.id === req.authUser!.id && u.role === 'admin');
    if (!admin || !admin.twoFactorSecret) {
      res.status(400).json({ error: 'Initialize 2FA setup first.' });
      return;
    }
    if (!verifyTotpCode(admin.twoFactorSecret, code)) {
      res.status(400).json({ error: 'Invalid 6-digit authenticator code.' });
      return;
    }
    admin.twoFactorEnabled = true;
    recordAuditLog(db, admin, 'ADMIN_2FA_ENABLED', admin.email, 'Main Admin TOTP two-factor authentication enabled');
    saveDb(db);
    res.json({ ok: true, twoFactorEnabled: true });
  });

  router.post('/api/portal/security/2fa/disable', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const password = String(req.body?.password ?? '');
    const code = String(req.body?.code ?? '').trim();
    const db = getDb();
    const admin = db.users.find((u) => u.id === req.authUser!.id && u.role === 'admin');
    if (!admin) {
      res.status(404).json({ error: 'Admin not found.' });
      return;
    }
    if (!verifyPassword(password, admin.passwordHash)) {
      res.status(401).json({ error: 'Current password verification failed.' });
      return;
    }
    if (admin.twoFactorEnabled && admin.twoFactorSecret && !verifyTotpCode(admin.twoFactorSecret, code)) {
      res.status(400).json({ error: 'Valid TOTP code required to disable 2FA.' });
      return;
    }
    admin.twoFactorEnabled = false;
    admin.twoFactorSecret = null;
    admin.twoFactorRecoveryHashes = [];
    recordAuditLog(db, admin, 'ADMIN_2FA_DISABLED', admin.email, 'Main Admin TOTP two-factor authentication disabled');
    saveDb(db);
    res.json({ ok: true, twoFactorEnabled: false });
  });

  // ---------------- COMPLETE BRANCH MANAGEMENT (MAIN ADMIN ONLY) ----------------

  router.get('/api/portal/branches/analytics', requireAuth, requireRole(['admin', 'branch']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    const visibleBranches =
      actor.role === 'branch'
        ? db.branches.filter((b) => b.id === actor.branchId)
        : db.branches;
    const branchStats = visibleBranches.map((branch) => {
      const enrollments = db.enrollments.filter((e) => e.branchId === branch.id);
      const approvedEnrollments = enrollments.filter((e) => e.status === 'approved');
      const teachers = db.users.filter((u) => u.role === 'teacher' && u.branchId === branch.id);
      const students = db.users.filter((u) => u.role === 'student' && u.branchId === branch.id);
      const batches = db.batches.filter((b) => b.branchId === branch.id);
      const incomeRecords = db.financialRecords.filter((f) => f.branchId === branch.id && f.type === 'income');
      const expenseRecords = db.financialRecords.filter((f) => f.branchId === branch.id && f.type === 'expense');
      const refundRecords = db.financialRecords.filter((f) => f.branchId === branch.id && f.type === 'refund');
      const invoices = db.feeInvoices.filter((i) => i.branchId === branch.id);
      const attRecords = db.attendance.filter((a) => a.branchId === branch.id);
      const presentAtt = attRecords.filter((a) => a.status === 'present' || a.status === 'late').length;

      const totalIncome = incomeRecords.reduce((s, f) => s + f.amount, 0);
      const totalExpenses = expenseRecords.reduce((s, f) => s + f.amount, 0);
      const totalRefunds = refundRecords.reduce((s, f) => s + f.amount, 0);
      const feesDue = invoices.reduce((s, i) => s + i.dueAmount, 0);

      return {
        branchId: branch.id,
        branchName: branch.name,
        branchCode: branch.code,
        status: branch.status,
        teachersCount: teachers.length,
        studentsCount: students.length,
        enrolledCount: approvedEnrollments.length,
        batchesCount: batches.length,
        totalIncome,
        totalExpenses,
        totalRefunds,
        netBalance: totalIncome - totalExpenses - totalRefunds,
        feesDue,
        attendanceTotal: attRecords.length,
        attendanceRatePercent: attRecords.length ? Math.round((presentAtt / attRecords.length) * 100) : 0,
      };
    });

    res.json({
      branches: visibleBranches,
      branchStats,
      statusHistory:
        actor.role === 'branch'
          ? db.branchStatusHistory.filter((h) => h.branchId === actor.branchId)
          : db.branchStatusHistory,
    });
  });

  router.patch('/api/portal/branches/:id/status', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    const branch = db.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }

    const nextStatus = String(req.body?.status ?? '').trim() as BranchStatus;
    const reason = String(req.body?.reason ?? '').trim();
    const allowed: BranchStatus[] = ['active', 'inactive', 'suspended', 'archived'];
    if (!allowed.includes(nextStatus)) {
      res.status(400).json({ error: 'Status must be active, inactive, suspended, or archived.' });
      return;
    }
    if (!reason || reason.length < 3) {
      res.status(400).json({ error: 'An audit reason (min 3 characters) is required for branch status changes.' });
      return;
    }
    if (branch.status === nextStatus) {
      res.json({ branch, statusHistory: db.branchStatusHistory });
      return;
    }

    const previousStatus = branch.status;
    const now = new Date().toISOString();
    branch.status = nextStatus;
    branch.updatedAt = now;
    if (nextStatus === 'archived') {
      branch.archivedAt = now;
    } else if (nextStatus === 'active') {
      branch.archivedAt = null;
    }

    const historyEntry: BranchStatusHistoryEntry = {
      id: `bsh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      branchId: branch.id,
      branchName: branch.name,
      previousStatus,
      newStatus: nextStatus,
      reason,
      actorId: actor.id,
      actorName: actor.name,
      createdAt: now,
    };
    db.branchStatusHistory.unshift(historyEntry);

    recordAuditLog(
      db,
      actor,
      'BRANCH_STATUS_CHANGE',
      branch.name,
      `${previousStatus} -> ${nextStatus} (${reason})`,
      nextStatus === 'suspended' ? 'warning' : 'info'
    );
    saveDb(db);

    res.json({
      branch,
      historyEntry,
      statusHistory: db.branchStatusHistory.filter((h) => h.branchId === branch.id),
    });
  });

  router.get('/api/portal/branches/:id/report-csv', requireAuth, requireRole(['admin', 'branch']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    if (actor.role === 'branch' && actor.branchId !== req.params.id) {
      res.status(403).json({ error: 'Branch isolation: cannot export another campus CSV.' });
      return;
    }
    const branch = db.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found.' });
      return;
    }
    const enrollments = db.enrollments.filter((e) => e.branchId === branch.id);
    const fin = db.financialRecords.filter((f) => f.branchId === branch.id);
    const lines = [
      'RecordType,Date,Title,Category,StatusOrPayment,AmountBDT',
      ...enrollments.map(
        (e) =>
          `Enrollment,"${e.enrolledAt.slice(0, 10)}","${e.studentName.replace(/"/g, '""')} — ${e.courseTitle.replace(/"/g, '""')}","${e.paymentMethod}","${e.status}",${e.amountPaid}`
      ),
      ...fin.map(
        (f) =>
          `Finance,"${f.date}","${f.title.replace(/"/g, '""')}","${f.category}","${f.type}",${f.amount}`
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="branch-${branch.code}-report.csv"`);
    res.send(lines.join('\n'));
  });

  // ---------------- ACADEMIC CORE STRUCTURE ----------------

  router.get(
    '/api/portal/academic/overview',
    requireAuth,
    requireRole(['admin', 'teacher', 'student', 'guardian', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      let admissions = db.studentAdmissions;
      if (actor.role === 'student') {
        admissions = admissions.filter((a) => a.studentUserId === actor.id);
      } else if (actor.role === 'guardian') {
        const linked = new Set(actor.guardianLinkedStudentIds ?? []);
        admissions = admissions.filter((a) => linked.has(a.studentUserId));
      } else if (actor.role === 'branch') {
        admissions = actor.branchId ? admissions.filter((a) => a.branchId === actor.branchId) : [];
      } else if (actor.role === 'teacher') {
        const teacherBatchCourseIds = new Set(
          db.batches
            .filter((b) =>
              db.instructors.some((i) => i.id === b.instructorId && i.userId === actor.id)
            )
            .map((b) => b.courseId)
        );
        const enrolledIds = new Set(
          db.enrollments.filter((e) => teacherBatchCourseIds.has(e.courseId)).map((e) => e.userId)
        );
        admissions = admissions.filter((a) => enrolledIds.has(a.studentUserId));
      }

      res.json({
        academicYears: db.academicYears,
        academicClasses: db.academicClasses,
        academicSubjects: db.academicSubjects,
        courseRoutines: db.courseRoutines,
        studentAdmissions: admissions,
      });
    }
  );

  router.post('/api/portal/academic/years', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const name = String(req.body?.name ?? '').trim();
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const startDate = String(req.body?.startDate ?? '').trim();
    const endDate = String(req.body?.endDate ?? '').trim();
    if (!name || !code || !startDate || !endDate) {
      res.status(400).json({ error: 'Name, code, start date, and end date are required.' });
      return;
    }
    const db = getDb();
    if (db.academicYears.some((y) => y.code === code)) {
      res.status(409).json({ error: `Academic year ${code} already exists.` });
      return;
    }
    const isCurrent = Boolean(req.body?.isCurrent);
    if (isCurrent) {
      db.academicYears.forEach((y) => {
        y.isCurrent = false;
      });
    }
    const year: AcademicYear = {
      id: `ay-${Date.now()}`,
      name,
      code,
      startDate,
      endDate,
      isCurrent,
      status: req.body?.status === 'upcoming' ? 'upcoming' : 'active',
      createdAt: new Date().toISOString(),
    };
    db.academicYears.unshift(year);
    saveDb(db);
    res.status(201).json({ year });
  });

  router.post('/api/portal/academic/classes', requireAuth, requireRole(['admin']), (req, res) => {
    const db = getDb();
    const academicYearId = String(req.body?.academicYearId ?? db.academicYears[0]?.id ?? '');
    const branchId = String(req.body?.branchId ?? '');
    const className = String(req.body?.className ?? '').trim();
    const sectionName = String(req.body?.sectionName ?? '').trim();
    if (!academicYearId || !branchId || !className || !sectionName) {
      res.status(400).json({ error: 'Academic year, branch, class name, and section are required.' });
      return;
    }
    const cls: AcademicClassSection = {
      id: `cls-${Date.now()}`,
      academicYearId,
      branchId,
      className,
      sectionName,
      roomLabel: String(req.body?.roomLabel ?? '').trim() || undefined,
      capacity: Math.max(5, Number(req.body?.capacity) || 40),
      classTeacherUserId: req.body?.classTeacherUserId ? String(req.body.classTeacherUserId) : null,
      status: 'active',
    };
    db.academicClasses.unshift(cls);
    saveDb(db);
    res.status(201).json({ classSection: cls });
  });

  router.post('/api/portal/academic/subjects', requireAuth, requireRole(['admin']), (req, res) => {
    const db = getDb();
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const name = String(req.body?.name ?? '').trim();
    const classLevel = String(req.body?.classLevel ?? 'SSC / HSC').trim();
    if (!code || !name) {
      res.status(400).json({ error: 'Subject code and name are required.' });
      return;
    }
    if (db.academicSubjects.some((s) => s.code === code)) {
      res.status(409).json({ error: `Subject ${code} already exists.` });
      return;
    }
    const subject: AcademicSubject = {
      id: `sub-${Date.now()}`,
      code,
      name,
      classLevel,
      courseId: req.body?.courseId ? String(req.body.courseId) : null,
      creditsOrMarks: Math.max(10, Number(req.body?.creditsOrMarks) || 100),
      status: 'active',
    };
    db.academicSubjects.unshift(subject);
    saveDb(db);
    res.status(201).json({ subject });
  });

  router.post('/api/portal/academic/routines', requireAuth, requireRole(['admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const courseId = String(req.body?.courseId ?? '').trim();
    const branchId = String(req.body?.branchId ?? '').trim();
    const dayOfWeek = String(req.body?.dayOfWeek ?? 'Sat').trim() as CourseRoutineItem['dayOfWeek'];
    const startTime = String(req.body?.startTime ?? '').trim();
    const endTime = String(req.body?.endTime ?? '').trim();
    if (!courseId || !branchId || !startTime || !endTime) {
      res.status(400).json({ error: 'Course, branch, startTime, and endTime are required.' });
      return;
    }
    const actor = req.authUser!;
    if (actor.role === 'teacher') {
      const course = db.courses.find((c) => c.id === courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You can only manage routines for your assigned courses.' });
        return;
      }
    }
    const routine: CourseRoutineItem = {
      id: `rtn-${Date.now()}`,
      courseId,
      batchId: req.body?.batchId ? String(req.body.batchId) : null,
      branchId,
      subjectId: req.body?.subjectId ? String(req.body.subjectId) : null,
      teacherUserId: req.body?.teacherUserId ? String(req.body.teacherUserId) : actor.id,
      dayOfWeek,
      startTime,
      endTime,
      roomOrLink: String(req.body?.roomOrLink ?? 'Main Campus Room').trim(),
      status: 'active',
    };
    db.courseRoutines.unshift(routine);
    saveDb(db);
    res.status(201).json({ routine });
  });

  router.post('/api/portal/academic/admissions', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const studentUserId = String(req.body?.studentUserId ?? '').trim();
    const branchId = String(req.body?.branchId ?? '').trim();
    const academicYearId = String(req.body?.academicYearId ?? db.academicYears[0]?.id ?? '').trim();
    const branchCheck = assertBranchOperationalForTransactions(branchId);
    if (!branchCheck.ok) {
      res.status(403).json({ error: branchCheck.error });
      return;
    }
    const student = db.users.find((u) => u.id === studentUserId && u.role === 'student');
    if (!student) {
      res.status(404).json({ error: 'Student user not found.' });
      return;
    }
    const admission: StudentAdmissionRecord = {
      id: `adm-${Date.now()}`,
      admissionNo: `ADM-AEC-${new Date().getFullYear()}-${String(db.studentAdmissions.length + 1).padStart(3, '0')}`,
      studentUserId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber || `AEC-${new Date().getFullYear()}-${db.studentAdmissions.length + 101}`,
      branchId,
      academicYearId,
      classSectionId: req.body?.classSectionId ? String(req.body.classSectionId) : null,
      guardianName: String(req.body?.guardianName ?? '').trim() || undefined,
      guardianPhone: String(req.body?.guardianPhone ?? '').trim() || undefined,
      bloodGroup: String(req.body?.bloodGroup ?? '').trim() || undefined,
      emergencyContact: String(req.body?.emergencyContact ?? '').trim() || undefined,
      admissionFeePaid: Math.max(0, Number(req.body?.admissionFeePaid) || 0),
      admissionStatus: 'active',
      admittedAt: new Date().toISOString(),
    };
    db.studentAdmissions.unshift(admission);
    recordAuditLog(db, req.authUser!, 'STUDENT_ADMISSION_CREATE', admission.admissionNo, `${student.name} admitted to ${branchId}`);
    saveDb(db);
    res.status(201).json({ admission });
  });

  // ---------------- LESSON WATCH PROGRESS & RESUME PLAYBACK ----------------

  router.get('/api/portal/lessons/progress', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const courseId = String(req.query.courseId ?? '').trim();
    const list = db.lessonProgress.filter(
      (p) => p.userId === req.authUser!.id && (!courseId || p.courseId === courseId)
    );
    res.json({ progress: list });
  });

  router.post('/api/portal/lessons/:lessonId/progress', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const lesson = db.lessons.find((l) => l.id === req.params.lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }
    if (
      user.role === 'student' &&
      !lesson.isFreePreview &&
      !isStudentApprovedInCourse(db.enrollments, user.id, lesson.courseId)
    ) {
      res.status(403).json({ error: 'Approved enrollment is required to access or track this lesson.' });
      return;
    }
    const watchedSeconds = Math.max(0, Math.round(Number(req.body?.watchedSeconds) || 0));
    const durationSeconds = Math.max(1, Math.round(Number(req.body?.durationSeconds) || 600));
    const percentWatched = Math.min(100, Math.round((watchedSeconds / durationSeconds) * 100));
    const completed = Boolean(req.body?.completed) || percentWatched >= 85;
    const now = new Date().toISOString();

    let rec = db.lessonProgress.find((p) => p.userId === user.id && p.lessonId === lesson.id);
    if (!rec) {
      rec = {
        id: `lp-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId: user.id,
        courseId: lesson.courseId,
        lessonId: lesson.id,
        watchedSeconds,
        durationSeconds,
        percentWatched,
        completed,
        lastPositionAt: now,
      };
      db.lessonProgress.unshift(rec);
    } else {
      rec.watchedSeconds = Math.max(rec.watchedSeconds, watchedSeconds);
      rec.durationSeconds = durationSeconds;
      rec.percentWatched = Math.max(rec.percentWatched, percentWatched);
      rec.completed = rec.completed || completed;
      rec.lastPositionAt = now;
    }

    if (rec.completed) {
      const enr = db.enrollments.find(
        (e) => e.userId === user.id && e.courseId === lesson.courseId && e.status === 'approved'
      );
      if (enr && !enr.completedLessonIds.includes(lesson.id)) {
        enr.completedLessonIds.push(lesson.id);
      }
    }
    saveDb(db);
    res.json({ progress: rec });
  });

  // ---------------- EXAM SERVER-SIDE TIMER & WRITTEN GRADING ----------------

  router.post('/api/portal/exams/:id/start', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    const exam = db.exams.find((e) => e.id === req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found.' });
      return;
    }
    if (
      actor.role === 'student' &&
      exam.visibility === 'course' &&
      exam.courseId &&
      !isStudentApprovedInCourse(db.enrollments, actor.id, exam.courseId)
    ) {
      res.status(403).json({ error: 'Approved course enrollment is required to start this exam.' });
      return;
    }
    const userId = actor.id;
    let timer = db.examSessionTimers.find((t) => t.examId === exam.id && t.userId === userId && !t.submittedAt);
    if (!timer) {
      const startedAt = Date.now();
      const expiresAt = startedAt + Math.max(1, exam.durationMinutes || 15) * 60 * 1000;
      timer = {
        id: `exst-${startedAt}`,
        examId: exam.id,
        userId,
        startedAt: new Date(startedAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        submittedAt: null,
      };
      db.examSessionTimers.unshift(timer);
      saveDb(db);
    }
    res.json({ timer, remainingSeconds: Math.max(0, Math.floor((Date.parse(timer.expiresAt) - Date.now()) / 1000)) });
  });

  router.patch(
    '/api/portal/exam-attempts/:id/grade',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const attempt = db.examAttempts.find((a) => a.id === req.params.id);
      if (!attempt) {
        res.status(404).json({ error: 'Exam attempt not found.' });
        return;
      }
      const exam = db.exams.find((e) => e.id === attempt.examId);
      if (actor.role === 'teacher' && exam) {
        const course = exam.courseId ? db.courses.find((c) => c.id === exam.courseId) : undefined;
        if (exam.teacherId !== actor.id && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
          res.status(403).json({ error: 'You can only grade attempts for your assigned courses/exams.' });
          return;
        }
      }

      const writtenScores = (req.body?.writtenScores ?? {}) as Record<string, number>;
      const writtenTotalEarned = Object.values(writtenScores).reduce(
        (sum, val) => sum + Math.max(0, Number(val) || 0),
        0
      );
      const overrideScore =
        req.body?.score !== undefined
          ? Math.max(0, Number(req.body.score))
          : attempt.score + writtenTotalEarned;

      const graded = recalculateExamAttemptGrade(
        overrideScore,
        attempt.totalMarks,
        exam?.passPercentage ?? 40
      );
      const updated = {
        ...attempt,
        ...graded,
        writtenScores: { ...(attempt.writtenScores ?? {}), ...writtenScores },
        gradingStatus: 'graded' as const,
        teacherFeedback: String(req.body?.teacherFeedback ?? attempt.teacherFeedback ?? '').trim(),
        gradedBy: actor.name,
        gradedAt: new Date().toISOString(),
      };

      const idx = db.examAttempts.findIndex((a) => a.id === attempt.id);
      db.examAttempts[idx] = updated;
      recordAuditLog(db, actor, 'EXAM_MANUAL_GRADED', attempt.studentName, `${attempt.examTitle}: ${updated.score}/${updated.totalMarks} (${updated.grade})`);
      saveDb(db);

      void dispatchRealCommunication({
        channel: 'in_app',
        recipient: attempt.studentName,
        recipientUserId: attempt.userId,
        subject: `Exam Result Published: ${attempt.examTitle}`,
        message: `Your exam was graded by ${actor.name}: ${updated.score}/${updated.totalMarks} (${updated.grade}).`,
        notificationType: 'exam',
        actionUrl: '/portal',
      });

      res.json({ attempt: updated });
    }
  );

  // ---------------- ATTENDANCE CORRECTIONS & REPORTS ----------------

  router.patch(
    '/api/portal/attendance/:id/correct',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const rec = db.attendance.find((a) => a.id === req.params.id);
      if (!rec) {
        res.status(404).json({ error: 'Attendance record not found.' });
        return;
      }
      if (actor.role === 'teacher' && rec.targetType === 'teacher' && rec.targetId !== actor.id) {
        res.status(403).json({ error: 'Teachers cannot correct other teachers attendance.' });
        return;
      }
      const nextStatus = String(req.body?.status ?? '').trim() as typeof rec.status;
      const reason = String(req.body?.reason ?? '').trim();
      if (!['present', 'absent', 'late', 'leave', 'excused'].includes(nextStatus) || reason.length < 3) {
        res.status(400).json({ error: 'Valid status and correction reason (min 3 chars) are required.' });
        return;
      }
      const prevStatus = rec.status;
      rec.status = nextStatus;
      if (req.body?.notes !== undefined) rec.notes = String(req.body.notes).trim();

      const correction: AttendanceCorrectionEntry = {
        id: `attc-${Date.now()}`,
        attendanceId: rec.id,
        targetName: rec.targetName,
        previousStatus: prevStatus,
        newStatus: nextStatus,
        reason,
        correctedById: actor.id,
        correctedByName: actor.name,
        correctedAt: new Date().toISOString(),
      };
      db.attendanceCorrections.unshift(correction);
      recordAuditLog(db, actor, 'ATTENDANCE_CORRECTED', rec.targetName, `${rec.date}: ${prevStatus} -> ${nextStatus} (${reason})`);
      saveDb(db);
      res.json({ record: rec, correction });
    }
  );

  router.get(
    '/api/portal/attendance/report',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const month = String(req.query.month ?? '').trim(); // YYYY-MM
      const branchId = String(req.query.branchId ?? '').trim();
      const targetType = String(req.query.targetType ?? '').trim();

      let records = db.attendance;
      if (actor.role === 'teacher') {
        const assignedCourses = getTeacherAssignedCourseIds(
          actor,
          db.courses,
          db.instructors,
          db.batches
        );
        const teacherBatches = new Set(
          db.batches.filter((b) => assignedCourses.has(b.courseId)).map((b) => b.id)
        );
        const enrolledStudents = new Set(
          db.enrollments
            .filter((e) => e.status === 'approved' && assignedCourses.has(e.courseId))
            .map((e) => e.userId)
        );
        records = records.filter(
          (r) =>
            (r.targetType === 'teacher' && r.targetId === actor.id) ||
            (r.targetType === 'student' &&
              ((r.batchId && teacherBatches.has(r.batchId)) || enrolledStudents.has(r.targetId)))
        );
      }
      if (month) records = records.filter((r) => r.date.startsWith(month));
      if (branchId && branchId !== 'all') records = records.filter((r) => r.branchId === branchId);
      if (targetType && targetType !== 'all') records = records.filter((r) => r.targetType === targetType);

      if (req.query.format === 'csv') {
        const csvLines = [
          'Date,Type,Name,Branch,Batch,Status,CheckIn,CheckOut,RecordedBy',
          ...records.map(
            (r) =>
              `"${r.date}","${r.targetType}","${r.targetName.replace(/"/g, '""')}","${r.branchId ?? ''}","${r.batchId ?? ''}","${r.status}","${r.checkInTime ?? ''}","${r.checkOutTime ?? ''}","${r.recordedBy.replace(/"/g, '""')}"`
          ),
        ];
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance-report.csv"');
        res.send(csvLines.join('\n'));
        return;
      }

      const visibleRecordIds = new Set(records.map((r) => r.id));
      const corrections =
        actor.role === 'teacher'
          ? db.attendanceCorrections.filter((c) => visibleRecordIds.has(c.attendanceId))
          : db.attendanceCorrections;

      res.json({
        total: records.length,
        presentCount: records.filter((r) => r.status === 'present').length,
        lateCount: records.filter((r) => r.status === 'late').length,
        absentCount: records.filter((r) => r.status === 'absent').length,
        excusedCount: records.filter((r) => r.status === 'excused' || r.status === 'leave').length,
        records,
        corrections,
      });
    }
  );

  // ---------------- FEE INVOICES & SERVER PAYMENT SESSIONS ----------------

  router.get('/api/portal/invoices', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    let invoices = db.feeInvoices;
    if (actor.role === 'student') {
      invoices = invoices.filter((i) => i.studentUserId === actor.id);
    } else if (actor.role === 'guardian') {
      const linked = new Set(actor.guardianLinkedStudentIds ?? []);
      invoices = invoices.filter((i) => linked.has(i.studentUserId));
    } else if (actor.role === 'teacher') {
      invoices = [];
    }
    res.json({ invoices });
  });

  router.post('/api/portal/invoices', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const studentUserId = String(req.body?.studentUserId ?? '').trim();
    const student = db.users.find((u) => u.id === studentUserId && u.role === 'student');
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    const branchId = String(req.body?.branchId ?? student.branchId ?? '').trim();
    const branchCheck = assertBranchOperationalForTransactions(branchId);
    if (!branchCheck.ok) {
      res.status(403).json({ error: branchCheck.error });
      return;
    }
    const totalAmount = Math.max(1, Number(req.body?.totalAmount) || 0);
    const now = new Date().toISOString();
    const invoice: FeeInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNo: `INV-AEC-${Date.now().toString().slice(-6)}`,
      studentUserId: student.id,
      studentName: student.name,
      branchId,
      courseId: req.body?.courseId ? String(req.body.courseId) : null,
      batchId: req.body?.batchId ? String(req.body.batchId) : null,
      feeType: (req.body?.feeType ?? 'tuition') as FeeInvoice['feeType'],
      title: String(req.body?.title ?? 'Course Tuition Fee').trim(),
      totalAmount,
      paidAmount: 0,
      dueAmount: totalAmount,
      dueDate: String(req.body?.dueDate ?? now.slice(0, 10)),
      installmentPlanLabel: req.body?.installmentPlanLabel ? String(req.body.installmentPlanLabel) : undefined,
      status: 'unpaid',
      createdAt: now,
      updatedAt: now,
    };
    db.feeInvoices.unshift(invoice);
    recordAuditLog(db, req.authUser!, 'INVOICE_CREATED', invoice.invoiceNo, `${student.name} · ৳${totalAmount}`);
    saveDb(db);
    res.status(201).json({ invoice });
  });

  router.post('/api/payments/initiate', requireAuth, (req: AuthedRequest, res) => {
    const idempotencyKey =
      String(req.headers['idempotency-key'] ?? req.body?.idempotencyKey ?? '').trim() ||
      `idem-${req.authUser!.id}-${Date.now()}`;
    const result = initiateServerPaymentSession({
      user: req.authUser!,
      idempotencyKey,
      referenceType: req.body?.referenceType,
      courseId: req.body?.courseId,
      ebookId: req.body?.ebookId,
      invoiceId: req.body?.invoiceId,
      batchId: req.body?.batchId,
      branchId: req.body?.branchId,
      items: req.body?.items,
      deliveryMode: req.body?.deliveryMode,
      deliveryAddress: req.body?.deliveryAddress,
      phone: req.body?.phone,
      branchPickupId: req.body?.branchPickupId,
      couponCode: req.body?.couponCode,
      gateway: req.body?.gateway || 'bKash',
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(201).json(result);
  });

  router.post('/api/payments/webhooks/:gateway', (req, res) => {
    const gateway = String(req.params.gateway ?? 'bkash');
    const signature = String(req.headers['x-webhook-signature'] ?? req.body?.signature ?? '');
    const payload = {
      sessionId: req.body?.sessionId,
      gateway: req.body?.gateway ?? gateway,
      trxId: req.body?.trxId,
      amount: req.body?.amount,
      status: req.body?.status ?? 'SUCCESS',
      eventId: req.body?.eventId,
    };
    const canonicalBody = JSON.stringify({
      sessionId: payload.sessionId,
      gateway: payload.gateway,
      trxId: payload.trxId,
      amount: payload.amount,
      status: payload.status,
    });
    const out = processSignedWebhookCallback({
      gateway,
      rawBody: canonicalBody,
      signature,
      payload,
    });
    if (!out.ok) {
      res.status(out.status).json({ error: out.error });
      return;
    }
    res.json({ ok: true, ...((out.result as Record<string, unknown>) ?? {}) });
  });

  // ---------------- CENTRAL INTEGRATION MANAGER & COMMUNICATIONS ----------------

  router.get('/api/portal/integrations', requireAuth, requireRole(['admin']), (_req, res) => {
    const db = getDb();
    res.json({
      integrations: db.integrations,
      communicationLogs: db.communicationLogs.slice(0, 100),
      webhooks: db.webhooks,
    });
  });

  router.put('/api/portal/integrations/:key', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const item = db.integrations.find((i) => i.key === req.params.key);
    if (!item) {
      res.status(404).json({ error: 'Integration entry not found.' });
      return;
    }
    if (typeof req.body?.enabled === 'boolean') item.enabled = req.body.enabled;
    if (req.body?.mode === 'sandbox' || req.body?.mode === 'live') item.mode = req.body.mode;
    if (req.body?.publicConfig && typeof req.body.publicConfig === 'object') {
      item.publicConfig = {
        ...item.publicConfig,
        ...Object.fromEntries(
          Object.entries(req.body.publicConfig).map(([k, v]) => [k, String(v ?? '').trim()])
        ),
      };
    }

    const incomingSecrets = (req.body?.secrets ?? {}) as Record<string, string>;
    const cleanSecrets: Record<string, string> = {};
    for (const [k, v] of Object.entries(incomingSecrets)) {
      const val = String(v ?? '').trim();
      if (val && !val.includes('••••') && val !== 'Not Configured') {
        cleanSecrets[k] = val;
        item.secretsMasked[k] = maskSecretValue(val);
      }
    }
    if (Object.keys(cleanSecrets).length > 0) {
      saveEncryptedIntegrationSecrets(item.key, cleanSecrets);
    }

    const storedSecrets = getDecryptedIntegrationSecrets(item.key);
    const hasPublicValues = Object.values(item.publicConfig).some((v) => Boolean(v && v.trim()));
    const hasSecrets = Object.keys(storedSecrets).length > 0 ||
      Object.values(item.secretsMasked).some((v) => v && v !== 'Not Configured');
    item.configured = hasSecrets || hasPublicValues;
    item.healthStatus = item.configured ? 'configured' : 'awaiting_configuration';
    item.updatedAt = new Date().toISOString();

    recordAuditLog(db, req.authUser!, 'INTEGRATION_UPDATED', item.name, `mode=${item.mode} enabled=${item.enabled} configured=${item.configured}`);
    saveDb(db);
    res.json({ integration: item });
  });

  router.post('/api/portal/integrations/:key/test', requireAuth, requireRole(['admin']), async (req: AuthedRequest, res) => {
    const db = getDb();
    const item = db.integrations.find((i) => i.key === req.params.key);
    if (!item) {
      res.status(404).json({ error: 'Integration not found.' });
      return;
    }

    const secrets = getDecryptedIntegrationSecrets(item.key);
    const now = new Date().toISOString();
    item.lastTestedAt = now;

    if (item.key === 'smtp_email') {
      const host = item.publicConfig.host || process.env.SMTP_HOST || '';
      const port = Number(item.publicConfig.port || process.env.SMTP_PORT || '587');
      const user = secrets.username || process.env.SMTP_USER || '';
      const pass = secrets.password || process.env.SMTP_PASS || '';
      if (!host || !user || !pass) {
        item.healthStatus = 'awaiting_configuration';
        item.lastError = 'SMTP host, username, and password are required before verification.';
        saveDb(db);
        res.json({ ok: false, integration: item, message: item.lastError });
        return;
      }
      try {
        const t = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
        await t.verify();
        item.healthStatus = 'healthy';
        item.configured = true;
        item.lastError = undefined;
        saveDb(db);
        res.json({ ok: true, integration: item, message: 'SMTP server connection verified.' });
        return;
      } catch (err) {
        item.healthStatus = 'error';
        item.lastError = err instanceof Error ? err.message : 'SMTP verification failed';
        saveDb(db);
        res.json({ ok: false, integration: item, message: item.lastError });
        return;
      }
    }

    if (item.key === 'gemini_ai') {
      const apiKey = secrets.apiKey || process.env.GEMINI_API_KEY || '';
      if (!apiKey) {
        item.healthStatus = 'awaiting_configuration';
        item.lastError = 'GEMINI_API_KEY is not configured.';
        saveDb(db);
        res.json({ ok: false, integration: item, message: item.lastError });
        return;
      }
      item.healthStatus = 'healthy';
      item.configured = true;
      item.lastError = undefined;
      saveDb(db);
      res.json({ ok: true, integration: item, message: 'Gemini AI API key is configured on server.' });
      return;
    }

    const hasAnySecret =
      Object.keys(secrets).length > 0 ||
      Object.values(item.secretsMasked).some((v) => v && v !== 'Not Configured');
    if (!hasAnySecret) {
      item.healthStatus = 'awaiting_configuration';
      item.lastError = `${item.name} credentials are not configured yet.`;
      saveDb(db);
      res.json({ ok: false, integration: item, message: item.lastError });
      return;
    }

    item.healthStatus = 'configured';
    item.configured = true;
    item.lastError = undefined;
    saveDb(db);
    res.json({ ok: true, integration: item, message: `${item.name} credentials are present and ready (${item.mode}).` });
  });

  router.post('/api/portal/communications/send', requireAuth, requireRole(['admin', 'teacher']), async (req: AuthedRequest, res) => {
    const channel = String(req.body?.channel ?? 'in_app') as 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
    const recipient = String(req.body?.recipient ?? '').trim();
    const recipientUserId = req.body?.recipientUserId ? String(req.body.recipientUserId) : undefined;
    const subject = String(req.body?.subject ?? '').trim();
    const message = String(req.body?.message ?? '').trim();
    if (!recipient || !message) {
      res.status(400).json({ error: 'Recipient and message are required.' });
      return;
    }
    if (channel === 'sms' && !isValidBangladeshPhone(recipient)) {
      res.status(400).json({ error: 'Invalid Bangladesh mobile phone format (expected 01XXXXXXXXX).' });
      return;
    }
    const actor = req.authUser!;
    if (actor.role === 'teacher') {
      const db = getDb();
      const assignedCourses = getTeacherAssignedCourseIds(
        actor,
        db.courses,
        db.instructors,
        db.batches
      );
      const enrolledStudentIds = new Set(
        db.enrollments
          .filter((e) => e.status === 'approved' && assignedCourses.has(e.courseId))
          .map((e) => e.userId)
      );
      const cleanRecipientLower = recipient.toLowerCase();
      const cleanRecipientDigits = normalizePhoneDigits(recipient);
      const targetUser = db.users.find(
        (u) =>
          (recipientUserId && u.id === recipientUserId) ||
          u.email.toLowerCase() === cleanRecipientLower ||
          (cleanRecipientDigits.length >= 10 &&
            normalizePhoneDigits(u.phone) === cleanRecipientDigits)
      );
      if (!targetUser || !enrolledStudentIds.has(targetUser.id)) {
        res.status(403).json({
          error: 'Teachers can only message students enrolled in their assigned courses or batches.',
        });
        return;
      }
    }
    const log = await dispatchRealCommunication({
      channel,
      recipient,
      recipientUserId,
      subject,
      message,
    });
    res.status(log.status === 'failed' ? 202 : 201).json({ log });
  });

  router.get('/api/portal/notifications', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const items = db.inAppNotifications.filter((n) => n.userId === req.authUser!.id);
    res.json({ notifications: items });
  });

  router.patch('/api/portal/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const item = db.inAppNotifications.find((n) => n.id === req.params.id && n.userId === req.authUser!.id);
    if (!item) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    item.read = true;
    saveDb(db);
    res.json({ notification: item });
  });

  router.patch('/api/portal/communication-consent', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    user.communicationConsent = {
      email: req.body?.email !== false,
      sms: req.body?.sms !== false,
      whatsapp: req.body?.whatsapp !== false,
    };
    saveDb(db);
    res.json({ communicationConsent: user.communicationConsent });
  });

  return router;
}
