import express, { type NextFunction, type Request, type Response } from 'express';
import {
  BATCH_LIFECYCLE_LABELS,
  BATCH_WEEK_DAYS,
  canDeleteBatch,
  computeBatchCapacitySummary,
  computeBatchDashboardAnalytics,
  detectScheduleConflicts,
  formatBatchComparisonCsv,
  formatBatchStudentsCsv,
  getBatchAssignedInstructorIds,
  getEffectiveBatchSlots,
  getTeacherAssignedBatches,
  normalizeBatchLifecycle,
  redactBatchForViewer,
  syncLegacyStatusFromLifecycle,
  validateBatchStudentAddition,
  validateBatchTransfer,
} from '../lib/batchEnterprise';
import { canTeacherManageCourse, isCourseStatusLive } from '../lib/courseEnterprise';
import { sanitizeSafeUrl } from '../lib/domain';
import type {
  AttendanceRecord,
  BatchActivityLog,
  BatchClassroomSettings,
  BatchFeeSettings,
  BatchLifecycleStatus,
  BatchNotification,
  BatchOnlineSettings,
  BatchScheduleSlot,
  BatchTeacherAssignment,
  BatchTeacherHistoryEntry,
  BatchTransferRecord,
  BatchWaitlistEntry,
  CourseBatch,
  Enrollment,
  EnrollmentHistoryEntry,
  UserRole,
} from '../types';
import { getDb, recordAuditLog, saveDb, type StoredUser } from './store';
import { assertBranchOperationalForTransactions } from './paymentService';

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

type RequireAuthFn = (req: AuthedRequest, res: Response, next: NextFunction) => void;
type RequireRoleFn = (
  roles: UserRole[]
) => (req: AuthedRequest, res: Response, next: NextFunction) => void;

function canActorAccessBatch(
  actor: StoredUser,
  batch: CourseBatch,
  db: ReturnType<typeof getDb>
): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role === 'branch') {
    return Boolean(actor.branchId && batch.branchId === actor.branchId);
  }
  if (actor.role === 'teacher') {
    const assigned = getTeacherAssignedBatches(actor, [batch], db.instructors);
    if (assigned.length > 0) return true;
    const course = db.courses.find((c) => c.id === batch.courseId);
    return canTeacherManageCourse(actor, course, db.instructors, db.batches);
  }
  return false;
}

function recordBatchLog(
  db: ReturnType<typeof getDb>,
  batchId: string,
  actor: StoredUser,
  action: string,
  details: string
): void {
  const entry: BatchActivityLog = {
    id: `blog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    batchId,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    details,
    createdAt: new Date().toISOString(),
  };
  db.batchActivityLogs.unshift(entry);
  if (db.batchActivityLogs.length > 500) {
    db.batchActivityLogs = db.batchActivityLogs.slice(0, 500);
  }
}

function pushBatchNotification(
  db: ReturnType<typeof getDb>,
  params: {
    batchId: string;
    courseId: string;
    type: BatchNotification['type'];
    title: string;
    message: string;
    createdBy: string;
    recipientUserIds?: string[];
  }
): BatchNotification {
  const notif: BatchNotification = {
    id: `bnot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    batchId: params.batchId,
    courseId: params.courseId,
    type: params.type,
    title: params.title,
    message: params.message,
    recipientUserIds: params.recipientUserIds,
    channel: 'in_app',
    readByUserIds: [],
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
  };
  db.batchNotifications.unshift(notif);
  if (db.batchNotifications.length > 500) {
    db.batchNotifications = db.batchNotifications.slice(0, 500);
  }
  return notif;
}

function formatScheduleSummary(slots: BatchScheduleSlot[], fallback: string): string {
  if (!slots || slots.length === 0) return fallback;
  const active = slots.filter((s) => s.status !== 'cancelled');
  if (active.length === 0) return fallback;
  const days = Array.from(new Set(active.map((s) => s.dayOfWeek))).join(' · ');
  const first = active[0];
  return `${days} — ${first.startTime}–${first.endTime}`;
}

export function createBatchEnterpriseRouter(
  requireAuth: RequireAuthFn,
  requireRole: RequireRoleFn
) {
  const router = express.Router();

  // ---------------- DASHBOARD ANALYTICS & COMPARISON ----------------
  router.get(
    '/api/portal/batches/dashboard',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;

      let scopedBatches = db.batches;
      if (actor.role === 'teacher') {
        scopedBatches = getTeacherAssignedBatches(actor, db.batches, db.instructors);
      } else if (actor.role === 'branch') {
        scopedBatches = actor.branchId ? db.batches.filter((b) => b.branchId === actor.branchId) : [];
      }

      const analytics = computeBatchDashboardAnalytics({
        batches: scopedBatches,
        courses: db.courses,
        enrollments: db.enrollments,
        attendance: db.attendance,
        transactions: db.transactions,
      });

      const scopedBatchIds = new Set(scopedBatches.map((b) => b.id));
      const upcomingSchedule = scopedBatches
        .filter((b) => {
          const lc = normalizeBatchLifecycle(b);
          return lc === 'active' || lc === 'enrollment_open' || lc === 'upcoming';
        })
        .flatMap((b) =>
          getEffectiveBatchSlots(b).map((slot) => ({
            batchId: b.id,
            batchName: b.name,
            batchCode: b.code,
            courseTitle: db.courses.find((c) => c.id === b.courseId)?.title || 'Course',
            instructorName:
              db.instructors.find((i) => i.id === (slot.instructorId || b.instructorId))?.name ||
              'Faculty',
            mode: b.mode,
            ...slot,
          }))
        )
        .slice(0, 30);

      const recentActivities = db.batchActivityLogs
        .filter((l) => scopedBatchIds.has(l.batchId))
        .slice(0, 20);

      const notifications = db.batchNotifications
        .filter((n) => scopedBatchIds.has(n.batchId))
        .slice(0, 25);

      res.json({
        ...analytics,
        batches: scopedBatches,
        upcomingSchedule,
        recentActivities,
        notifications,
        waitlistCounts: Object.fromEntries(
          scopedBatches.map((b) => [
            b.id,
            db.batchWaitlists.filter((w) => w.batchId === b.id && w.status === 'waiting').length,
          ])
        ),
      });
    }
  );

  // ---------------- STUDENT BATCH PORTAL ----------------
  router.get(
    '/api/student/batches',
    requireAuth,
    requireRole(['student', 'admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const myEnrollments = db.enrollments.filter((e) => e.userId === actor.id);
      const myBatchIds = new Set(
        myEnrollments.filter((e) => e.batchId).map((e) => e.batchId as string)
      );

      const enrolledBatches = db.batches
        .filter((b) => myBatchIds.has(b.id))
        .map((b) => {
          const safeBatch = redactBatchForViewer(b, actor, myEnrollments, db.instructors);
          const enr = myEnrollments.find((e) => e.batchId === b.id);
          const course = db.courses.find((c) => c.id === b.courseId);
          const myAtt = db.attendance.filter(
            (a) => a.batchId === b.id && a.targetId === actor.id
          );
          const present = myAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
          const myExams = db.exams.filter(
            (ex) => ex.batchId === b.id || ex.courseId === b.courseId
          );
          const myAttempts = db.examAttempts.filter((a) => a.userId === actor.id);
          const announcements = db.announcements.filter(
            (ann) => ann.courseId === b.courseId && (!ann.batchId || ann.batchId === b.id)
          );
          const notifications = db.batchNotifications.filter((n) => n.batchId === b.id);
          return {
            batch: safeBatch,
            enrollment: enr,
            courseTitle: course?.title || enr?.courseTitle || 'Course',
            courseSlug: course?.slug || '',
            instructor: db.instructors.find((i) => i.id === b.instructorId) || null,
            slots: getEffectiveBatchSlots(b),
            attendanceSummary: {
              total: myAtt.length,
              present,
              rate: myAtt.length > 0 ? Math.round((present / myAtt.length) * 100) : 100,
              records: myAtt.slice(0, 15),
            },
            examsCount: myExams.length,
            attempts: myAttempts,
            announcements,
            notifications,
          };
        });

      res.json({ enrolledBatches });
    }
  );

  // ---------------- SCHEDULE CONFLICT CHECK ----------------
  router.post(
    '/api/portal/batches/check-conflicts',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const candidateBatchId = body.batchId ? String(body.batchId) : undefined;
      const candidateSlots = Array.isArray(body.schedules)
        ? (body.schedules as BatchScheduleSlot[])
        : [];
      const candidateInstructorIds = Array.isArray(body.instructorIds)
        ? body.instructorIds.map(String).filter(Boolean)
        : body.instructorId
          ? [String(body.instructorId)]
          : [];
      const candidateClassroomKey = String(body.classroomKey ?? '').trim();

      const conflicts = detectScheduleConflicts({
        candidateBatchId,
        candidateStartDate: body.startDate ? String(body.startDate) : undefined,
        candidateEndDate: body.endDate ? String(body.endDate) : undefined,
        candidateInstructorIds,
        candidateClassroomKey,
        candidateSlots,
        existingBatches: db.batches,
      });

      res.json({ hasConflicts: conflicts.length > 0, conflicts });
    }
  );

  // ---------------- CREATE / UPDATE ENTERPRISE BATCH (6-STEP WIZARD) ----------------
  router.post(
    '/api/portal/batches/enterprise',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const body = (req.body ?? {}) as Record<string, unknown>;

      const courseId = String(body.courseId ?? '').trim();
      const name = String(body.name ?? '').trim().slice(0, 140);
      const code = String(body.code ?? '').trim().toUpperCase().slice(0, 32);
      if (!courseId || !name || !code) {
        return void res
          .status(400)
          .json({ error: 'Course, Batch Name, and Unique Batch Code are required.' });
      }

      if (db.batches.some((b) => b.code.toUpperCase() === code)) {
        return void res
          .status(409)
          .json({ error: `Batch code "${code}" already exists. Use a unique code.` });
      }

      const course = db.courses.find((c) => c.id === courseId);
      if (!course) return void res.status(404).json({ error: 'Selected course not found.' });

      const activeFallbackBranch = db.branches.find((b) => b.status === 'active')?.id ?? db.branches[0]?.id ?? 'br-mirpur';
      const branchId =
        actor.role === 'branch' && actor.branchId
          ? actor.branchId
          : String(body.branchId ?? activeFallbackBranch).trim();
      if (actor.role === 'branch' && body.branchId && String(body.branchId).trim() !== actor.branchId) {
        return void res.status(403).json({ error: 'Branch accounts can only create batches for their own campus.' });
      }
      const branchCheck = assertBranchOperationalForTransactions(branchId);
      if (!branchCheck.ok) {
        return void res.status(403).json({ error: branchCheck.error });
      }
      if (actor.role === 'teacher' && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        return void res
          .status(403)
          .json({ error: 'You are not authorized to create batches for this course.' });
      }

      const instructorId = String(body.instructorId ?? db.instructors[0]?.id ?? 'inst-1').trim();
      const mainInstructor = db.instructors.find((i) => i.id === instructorId);
      if (!mainInstructor) {
        return void res.status(400).json({ error: 'Selected Main Teacher is not an authorized instructor.' });
      }
      const assistantInstructorId = body.assistantInstructorId
        ? String(body.assistantInstructorId).trim()
        : null;

      const startDate = String(body.startDate ?? '2026-05-01').trim();
      const endDate = body.endDate ? String(body.endDate).trim() : undefined;
      if (endDate && endDate < startDate) {
        return void res.status(400).json({ error: 'Batch End Date cannot precede Batch Start Date.' });
      }
      const enrollmentStartDate = body.enrollmentStartDate
        ? String(body.enrollmentStartDate).trim()
        : undefined;
      const enrollmentClosingDate = body.enrollmentClosingDate
        ? String(body.enrollmentClosingDate).trim()
        : undefined;
      if (enrollmentStartDate && enrollmentClosingDate && enrollmentClosingDate < enrollmentStartDate) {
        return void res
          .status(400)
          .json({ error: 'Enrollment Closing Date cannot precede Enrollment Start Date.' });
      }

      const seatLimit = Math.max(1, Math.min(5000, Math.round(Number(body.seatLimit) || 40)));
      const minStudents = Math.max(0, Math.min(seatLimit, Math.round(Number(body.minStudents) || 5)));

      const rawLifecycle = String(body.lifecycleStatus ?? 'enrollment_open') as BatchLifecycleStatus;
      const lifecycleStatus: BatchLifecycleStatus = Object.keys(BATCH_LIFECYCLE_LABELS).includes(
        rawLifecycle
      )
        ? rawLifecycle
        : 'enrollment_open';

      const batchType: CourseBatch['batchType'] =
        body.batchType === 'Offline' || body.batchType === 'Online' || body.batchType === 'Hybrid'
          ? body.batchType
          : 'Hybrid';
      const mode: CourseBatch['mode'] =
        batchType === 'Online'
          ? 'Online Live'
          : batchType === 'Offline'
            ? 'Offline Branch'
            : 'Hybrid';

      const schedules: BatchScheduleSlot[] = Array.isArray(body.schedules)
        ? (body.schedules as BatchScheduleSlot[]).map((s, idx) => ({
            id: s.id || `slot-${Date.now()}-${idx}`,
            title: s.title || 'Class Session',
            dayOfWeek: BATCH_WEEK_DAYS.includes(s.dayOfWeek) ? s.dayOfWeek : 'Sun',
            startTime: String(s.startTime || '16:30'),
            endTime: String(s.endTime || '18:00'),
            durationMinutes: Math.max(15, Math.min(360, Number(s.durationMinutes) || 90)),
            breakMinutes: Math.max(0, Math.min(60, Number(s.breakMinutes) || 0)),
            instructorId: s.instructorId || instructorId,
            roomLabel: s.roomLabel ? String(s.roomLabel).trim() : undefined,
            sessionDate: s.sessionDate ? String(s.sessionDate).trim() : undefined,
            status: 'scheduled',
            topic: s.topic ? String(s.topic).trim() : undefined,
          }))
        : [];

      const teacherAssignments: BatchTeacherAssignment[] = Array.isArray(body.teacherAssignments)
        ? (body.teacherAssignments as BatchTeacherAssignment[])
        : [
            {
              instructorId,
              role: 'main',
              responsibility: 'Lead Instruction & Curriculum Delivery',
              assignedAt: new Date().toISOString(),
              assignedBy: actor.name,
            },
            ...(assistantInstructorId && assistantInstructorId !== instructorId
              ? [
                  {
                    instructorId: assistantInstructorId,
                    role: 'assistant' as const,
                    responsibility: 'Lab Support, Homework & Attendance',
                    assignedAt: new Date().toISOString(),
                    assignedBy: actor.name,
                  },
                ]
              : []),
          ];

      const classroom = (body.classroom ?? {}) as BatchClassroomSettings;
      const roomKey = classroom.roomNumber || classroom.classroomName || '';
      const candidateTeachers = Array.from(
        new Set([
          instructorId,
          ...(assistantInstructorId ? [assistantInstructorId] : []),
          ...teacherAssignments.map((t) => t.instructorId),
        ])
      );

      if (schedules.length > 0) {
        const conflicts = detectScheduleConflicts({
          candidateStartDate: startDate,
          candidateEndDate: endDate,
          candidateInstructorIds: candidateTeachers,
          candidateClassroomKey: batchType !== 'Online' ? roomKey : '',
          candidateSlots: schedules,
          existingBatches: db.batches,
        });
        if (conflicts.length > 0) {
          return void res.status(409).json({
            error: conflicts[0].message,
            conflicts,
          });
        }
      }

      const onlineRaw = (body.onlineSettings ?? {}) as BatchOnlineSettings;
      const onlineSettings: BatchOnlineSettings | undefined =
        batchType === 'Online' || batchType === 'Hybrid'
          ? {
              platform: String(onlineRaw.platform || 'Zoom').trim(),
              meetingLink: onlineRaw.meetingLink
                ? sanitizeSafeUrl(String(onlineRaw.meetingLink), '')
                : '',
              meetingId: String(onlineRaw.meetingId || '').trim(),
              meetingPassword: String(onlineRaw.meetingPassword || '').trim(),
              instructions: String(onlineRaw.instructions || '').trim(),
            }
          : undefined;

      const feeRaw = (body.feeSettings ?? {}) as BatchFeeSettings;
      const feeSettings: BatchFeeSettings = {
        admissionFee: Math.max(0, Math.round(Number(feeRaw.admissionFee ?? course.admissionFee ?? 0) || 0)),
        monthlyFee: Math.max(0, Math.round(Number(feeRaw.monthlyFee ?? 0) || 0)),
        courseFeeOverride:
          feeRaw.courseFeeOverride !== undefined && feeRaw.courseFeeOverride !== null && String(feeRaw.courseFeeOverride) !== ''
            ? Math.max(0, Math.round(Number(feeRaw.courseFeeOverride) || 0))
            : null,
        installmentEnabled: Boolean(feeRaw.installmentEnabled),
        installmentOptions: String(feeRaw.installmentOptions ?? '').trim(),
        paymentDeadline: String(feeRaw.paymentDeadline ?? '').trim(),
        latePaymentPolicy: String(feeRaw.latePaymentPolicy ?? '').trim(),
        batchDiscountPercent: Math.min(90, Math.max(0, Math.round(Number(feeRaw.batchDiscountPercent) || 0))),
      };

      const historyEntry: BatchTeacherHistoryEntry = {
        id: `bth-${Date.now()}`,
        instructorId,
        instructorName: mainInstructor.name,
        role: 'main',
        action: 'assigned',
        note: 'Initial batch creation assignment',
        actorName: actor.name,
        at: new Date().toISOString(),
      };

      const nowIso = new Date().toISOString();
      const batch: CourseBatch = {
        id: `bat-${Date.now()}`,
        courseId,
        name,
        code,
        description: String(body.description ?? '').trim().slice(0, 1500),
        thumbnail: body.thumbnail
          ? sanitizeSafeUrl(String(body.thumbnail), course.thumbnail)
          : course.thumbnail,
        branchId,
        instructorId,
        assistantInstructorId,
        teacherAssignments,
        teacherAssignmentHistory: [historyEntry],
        schedule: formatScheduleSummary(schedules, String(body.schedule || 'Sun · Tue · Thu — 4:30 PM')),
        schedules,
        classDurationMinutes: Math.max(15, Math.min(360, Number(body.classDurationMinutes) || 90)),
        breakMinutes: Math.max(0, Math.min(60, Number(body.breakMinutes) || 0)),
        weeklyFrequency: Math.max(1, Math.min(7, Number(body.weeklyFrequency) || Math.max(1, schedules.length))),
        totalClasses: Math.max(1, Math.min(500, Number(body.totalClasses) || 36)),
        classroomOrMeeting:
          batchType === 'Online'
            ? onlineSettings?.platform || 'Online Live'
            : roomKey || db.branches.find((b) => b.id === branchId)?.name || 'Campus Room',
        classroom: batchType !== 'Online' ? classroom : undefined,
        onlineSettings,
        feeSettings,
        startDate,
        endDate,
        enrollmentStartDate,
        enrollmentClosingDate,
        enrollmentDeadline: body.enrollmentDeadline ? String(body.enrollmentDeadline).trim() : enrollmentClosingDate,
        seatLimit,
        minStudents,
        enrolledSeats: 0,
        waitlistEnabled: body.waitlistEnabled !== false,
        mode,
        batchType,
        status: syncLegacyStatusFromLifecycle(lifecycleStatus),
        lifecycleStatus,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      db.batches.unshift(batch);
      recordBatchLog(db, batch.id, actor, 'BATCH_CREATED', `Created "${batch.name}" (${batch.code}) for ${course.title}`);
      recordAuditLog(db, actor, 'BATCH_CREATE', batch.name, `${batch.code} · ${batch.mode}`);
      saveDb(db);
      res.status(201).json({ batch });
    }
  );

  router.put(
    '/api/portal/batches/:id/enterprise',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.batches.findIndex((b) => b.id === req.params.id);
      if (idx === -1) return void res.status(404).json({ error: 'Batch not found.' });
      const existing = db.batches[idx];

      if (!canActorAccessBatch(actor, existing, db)) {
        return void res.status(403).json({ error: 'You are not authorized to edit this batch.' });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = String(body.name ?? existing.name).trim().slice(0, 140);
      const code = String(body.code ?? existing.code).trim().toUpperCase().slice(0, 32);
      if (!name || !code) {
        return void res.status(400).json({ error: 'Batch Name and Code are required.' });
      }
      if (db.batches.some((b) => b.id !== existing.id && b.code.toUpperCase() === code)) {
        return void res.status(409).json({ error: `Batch code "${code}" is already in use.` });
      }

      const seatLimit = Math.max(
        existing.enrolledSeats,
        Math.max(1, Math.min(5000, Math.round(Number(body.seatLimit ?? existing.seatLimit) || existing.seatLimit)))
      );
      const minStudents = Math.max(0, Math.min(seatLimit, Math.round(Number(body.minStudents ?? existing.minStudents ?? 5) || 0)));

      const startDate = String(body.startDate ?? existing.startDate).trim();
      const endDate = body.endDate !== undefined ? String(body.endDate || '').trim() || undefined : existing.endDate;
      if (endDate && endDate < startDate) {
        return void res.status(400).json({ error: 'Batch End Date cannot precede Start Date.' });
      }

      const instructorId = String(body.instructorId ?? existing.instructorId).trim();
      const assistantInstructorId =
        body.assistantInstructorId !== undefined
          ? (body.assistantInstructorId ? String(body.assistantInstructorId).trim() : null)
          : existing.assistantInstructorId ?? null;

      const batchType: CourseBatch['batchType'] =
        body.batchType === 'Offline' || body.batchType === 'Online' || body.batchType === 'Hybrid'
          ? body.batchType
          : existing.batchType ?? 'Hybrid';
      const mode: CourseBatch['mode'] =
        batchType === 'Online'
          ? 'Online Live'
          : batchType === 'Offline'
            ? 'Offline Branch'
            : 'Hybrid';

      const schedules = Array.isArray(body.schedules)
        ? (body.schedules as BatchScheduleSlot[])
        : existing.schedules ?? [];
      const classroom = (body.classroom ?? existing.classroom ?? {}) as BatchClassroomSettings;
      const roomKey = classroom.roomNumber || classroom.classroomName || '';

      const teacherAssignments = Array.isArray(body.teacherAssignments)
        ? (body.teacherAssignments as BatchTeacherAssignment[])
        : existing.teacherAssignments ?? [];

      const candidateTeachers = Array.from(
        new Set([
          instructorId,
          ...(assistantInstructorId ? [assistantInstructorId] : []),
          ...teacherAssignments.map((t) => t.instructorId),
        ])
      );

      if (schedules.length > 0) {
        const conflicts = detectScheduleConflicts({
          candidateBatchId: existing.id,
          candidateStartDate: startDate,
          candidateEndDate: endDate,
          candidateInstructorIds: candidateTeachers,
          candidateClassroomKey: batchType !== 'Online' ? roomKey : '',
          candidateSlots: schedules,
          existingBatches: db.batches,
        });
        if (conflicts.length > 0) {
          return void res.status(409).json({
            error: conflicts[0].message,
            conflicts,
          });
        }
      }

      const lifecycleStatus: BatchLifecycleStatus = body.lifecycleStatus
        ? (String(body.lifecycleStatus) as BatchLifecycleStatus)
        : normalizeBatchLifecycle(existing);

      const onlineRaw = (body.onlineSettings ?? existing.onlineSettings ?? {}) as BatchOnlineSettings;
      const feeRaw = (body.feeSettings ?? existing.feeSettings ?? {}) as BatchFeeSettings;

      const updated: CourseBatch = {
        ...existing,
        courseId: String(body.courseId ?? existing.courseId),
        name,
        code,
        description: body.description !== undefined ? String(body.description).trim() : existing.description,
        thumbnail: body.thumbnail ? sanitizeSafeUrl(String(body.thumbnail), existing.thumbnail || '') : existing.thumbnail,
        branchId: String(body.branchId ?? existing.branchId),
        instructorId,
        assistantInstructorId,
        teacherAssignments,
        schedules,
        schedule: formatScheduleSummary(schedules, String(body.schedule ?? existing.schedule)),
        classDurationMinutes: Number(body.classDurationMinutes ?? existing.classDurationMinutes ?? 90),
        breakMinutes: Number(body.breakMinutes ?? existing.breakMinutes ?? 0),
        weeklyFrequency: Number(body.weeklyFrequency ?? existing.weeklyFrequency ?? Math.max(1, schedules.length)),
        totalClasses: Number(body.totalClasses ?? existing.totalClasses ?? 36),
        classroom: batchType !== 'Online' ? classroom : undefined,
        onlineSettings:
          batchType !== 'Offline'
            ? {
                platform: String(onlineRaw.platform || 'Zoom').trim(),
                meetingLink: onlineRaw.meetingLink ? sanitizeSafeUrl(String(onlineRaw.meetingLink), '') : '',
                meetingId: String(onlineRaw.meetingId || '').trim(),
                meetingPassword: String(onlineRaw.meetingPassword || '').trim(),
                instructions: String(onlineRaw.instructions || '').trim(),
              }
            : undefined,
        classroomOrMeeting:
          batchType === 'Online'
            ? onlineRaw.platform || 'Online Live'
            : roomKey || existing.classroomOrMeeting,
        feeSettings: {
          ...existing.feeSettings,
          ...feeRaw,
        },
        startDate,
        endDate,
        enrollmentStartDate: body.enrollmentStartDate !== undefined ? String(body.enrollmentStartDate || '') || undefined : existing.enrollmentStartDate,
        enrollmentClosingDate: body.enrollmentClosingDate !== undefined ? String(body.enrollmentClosingDate || '') || undefined : existing.enrollmentClosingDate,
        enrollmentDeadline: body.enrollmentDeadline !== undefined ? String(body.enrollmentDeadline || '') || undefined : existing.enrollmentDeadline,
        seatLimit,
        minStudents,
        waitlistEnabled: body.waitlistEnabled !== undefined ? Boolean(body.waitlistEnabled) : existing.waitlistEnabled,
        mode,
        batchType,
        lifecycleStatus,
        status: syncLegacyStatusFromLifecycle(lifecycleStatus),
        updatedAt: new Date().toISOString(),
      };

      db.batches[idx] = updated;
      for (const l of db.lessons) {
        if (l.batchId === updated.id) l.batchName = updated.name;
      }
      recordBatchLog(db, updated.id, actor, 'BATCH_UPDATED', `Updated settings/routine for "${updated.name}"`);
      recordAuditLog(db, actor, 'BATCH_UPDATE', updated.name, `${updated.code} · ${lifecycleStatus}`);
      saveDb(db);
      res.json({ batch: updated });
    }
  );

  // ---------------- FULL 12-TAB BATCH DETAIL ----------------
  router.get(
    '/api/portal/batches/:id/detail',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'You are not assigned to this batch.' });
      }

      const course = db.courses.find((c) => c.id === batch.courseId) || null;
      const branch = db.branches.find((b) => b.id === batch.branchId) || null;
      const enrollments = db.enrollments.filter((e) => e.batchId === batch.id);
      const enrolledUserIds = new Set(enrollments.map((e) => e.userId));
      const waitlist = db.batchWaitlists.filter((w) => w.batchId === batch.id);
      const transfers = db.batchTransfers.filter(
        (t) => t.fromBatchId === batch.id || t.toBatchId === batch.id
      );
      const attendanceRecords = db.attendance.filter((a) => a.batchId === batch.id);
      const enrollmentIds = new Set(enrollments.map((e) => e.id));
      const payments = db.transactions.filter(
        (t) => t.referenceType === 'course' && enrollmentIds.has(t.referenceId)
      );
      const exams = db.exams.filter((ex) => ex.batchId === batch.id || ex.courseId === batch.courseId);
      const examIds = new Set(exams.map((ex) => ex.id));
      const examAttempts = db.examAttempts.filter(
        (att) => examIds.has(att.examId) && enrolledUserIds.has(att.userId)
      );
      const assignments = db.assignments.filter(
        (a) => a.batchId === batch.id || (a.courseId === batch.courseId && !a.batchId)
      );
      const assignmentIds = new Set(assignments.map((a) => a.id));
      const submissions = db.assignmentSubmissions.filter(
        (s) => assignmentIds.has(s.assignmentId) && enrolledUserIds.has(s.userId)
      );
      const announcements = db.announcements.filter(
        (ann) => ann.batchId === batch.id || (ann.courseId === batch.courseId && !ann.batchId)
      );
      const activityLogs = db.batchActivityLogs.filter((l) => l.batchId === batch.id);
      const notifications = db.batchNotifications.filter((n) => n.batchId === batch.id);

      const assignedInstIds = getBatchAssignedInstructorIds(batch);
      const teachers = db.instructors.filter((i) => assignedInstIds.includes(i.id));

      // Teacher workload summary across all batches
      const teacherWorkload = teachers.map((t) => {
        const assignedBatches = db.batches.filter(
          (other) =>
            normalizeBatchLifecycle(other) !== 'archived' &&
            normalizeBatchLifecycle(other) !== 'cancelled' &&
            getBatchAssignedInstructorIds(other).includes(t.id)
        );
        const weeklyClasses = assignedBatches.reduce(
          (sum, b) => sum + getEffectiveBatchSlots(b).filter((s) => s.status !== 'cancelled').length,
          0
        );
        return {
          instructorId: t.id,
          name: t.name,
          subject: t.subject,
          activeBatchesCount: assignedBatches.length,
          weeklyClasses,
        };
      });

      const rawCapacity = computeBatchCapacitySummary(
        batch,
        waitlist.filter((w) => w.status === 'waiting').length
      );
      const capacity = {
        ...rawCapacity,
        seatLimit: rawCapacity.maxCapacity,
        remainingSeats: rawCapacity.availableSeats,
        minStudents: rawCapacity.minRequirement,
        belowMinimum: !rawCapacity.meetsMinimum,
      };

      res.json({
        batch,
        course,
        branch,
        capacity,
        slots: getEffectiveBatchSlots(batch),
        enrollments,
        waitlist,
        transfers,
        teachers,
        teacherWorkload,
        attendanceRecords,
        payments,
        exams,
        examAttempts,
        assignments,
        submissions,
        announcements,
        activityLogs,
        notifications,
        eligibleStudents:
          actor.role === 'admin' || actor.role === 'branch'
            ? db.users
                .filter(
                  (u) =>
                    u.role === 'student' &&
                    u.status === 'active' &&
                    (actor.role !== 'branch' || u.branchId === batch.branchId)
                )
                .sort((a, b) => {
                  const aEnr = db.enrollments.some(
                    (e) =>
                      e.userId === a.id &&
                      e.courseId === batch.courseId &&
                      (e.status === 'approved' || e.status === 'pending')
                  );
                  const bEnr = db.enrollments.some(
                    (e) =>
                      e.userId === b.id &&
                      e.courseId === batch.courseId &&
                      (e.status === 'approved' || e.status === 'pending')
                  );
                  return Number(aEnr) - Number(bEnr);
                })
                .map(({ passwordHash: _p, ...u }) => u)
            : [],
      });
    }
  );

  // ---------------- STUDENT MANAGEMENT: ENROLL, BULK, REMOVE, TRANSFER, PROMOTE, WAITLIST ----------------
  router.post(
    '/api/portal/batches/:id/students/enroll',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized to enroll students in this batch.' });
      }
      const branchCheck = assertBranchOperationalForTransactions(batch.branchId);
      if (!branchCheck.ok) {
        return void res.status(403).json({ error: branchCheck.error });
      }
      const course = db.courses.find((c) => c.id === batch.courseId);
      if (!course || !isCourseStatusLive(course.status)) {
        return void res
          .status(400)
          .json({ error: 'Cannot enroll students: parent course must be published or active.' });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const studentIds: string[] = Array.isArray(body.studentIds)
        ? body.studentIds.map(String)
        : body.studentId
          ? [String(body.studentId)]
          : [];
      const emails: string[] = Array.isArray(body.emails)
        ? body.emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean)
        : [];

      const resolvedStudents = new Map<string, StoredUser>();
      for (const sid of studentIds) {
        const u = db.users.find((x) => x.id === sid);
        if (u) resolvedStudents.set(u.id, u);
      }
      for (const em of emails) {
        const u = db.users.find((x) => x.email.toLowerCase() === em);
        if (u) resolvedStudents.set(u.id, u);
      }

      if (resolvedStudents.size === 0) {
        return void res.status(404).json({ error: 'No matching student accounts found.' });
      }

      const enrolled: Enrollment[] = [];
      const rejected: { studentName: string; reason: string }[] = [];

      for (const stu of resolvedStudents.values()) {
        const check = validateBatchStudentAddition({
          batch,
          course,
          student: stu,
          enrollments: db.enrollments,
        });
        if (!check.ok) {
          rejected.push({ studentName: stu.name, reason: check.error });
          continue;
        }

        const feeOverride = batch.feeSettings?.courseFeeOverride;
        const baseCoursePrice =
          feeOverride !== undefined && feeOverride !== null ? feeOverride : course.price;
        const discountPct = Math.max(0, Math.min(90, Number(batch.feeSettings?.batchDiscountPercent) || 0));
        const payable = Math.max(
          0,
          Math.round(baseCoursePrice * (1 - discountPct / 100)) +
            (batch.feeSettings?.admissionFee ?? course.admissionFee ?? 0)
        );
        const finalAmount = body.amountPaid !== undefined ? Math.max(0, Math.round(Number(body.amountPaid) || 0)) : payable;
        const invoiceNo = `INV-${Date.now().toString().slice(-6)}-${Math.floor(10 + Math.random() * 89)}`;

        const enr: Enrollment = {
          id: `enr-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          userId: stu.id,
          studentName: stu.name,
          studentEmail: stu.email,
          courseId: course.id,
          courseTitle: course.title,
          branchId: batch.branchId,
          batchId: batch.id,
          batchName: batch.name,
          paymentMethod: (body.paymentMethod as Enrollment['paymentMethod']) || 'Branch Cash',
          invoiceNo,
          trxId: String(body.trxId || `ADM-${Date.now().toString().slice(-5)}`),
          amountPaid: finalAmount,
          status: 'approved',
          completedLessonIds: [],
          history: [
            {
              id: `eh-${Date.now()}`,
              action: 'enrolled_in_batch',
              actorName: actor.name,
              note: `Enrolled directly into batch "${batch.name}" (${batch.code})`,
              createdAt: new Date().toISOString(),
            },
          ],
          enrolledAt: new Date().toISOString(),
        };

        db.enrollments.unshift(enr);
        batch.enrolledSeats += 1;
        course.enrolledCount += 1;

        if (finalAmount > 0) {
          db.transactions.unshift({
            id: `txn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            invoiceNo,
            referenceType: 'course',
            referenceId: enr.id,
            userId: stu.id,
            payerName: stu.name,
            gateway: enr.paymentMethod === 'Card' ? 'SSLCommerz Card' : enr.paymentMethod,
            walletOrLast4: stu.phone.slice(-4) || '0000',
            trxId: enr.trxId || invoiceNo,
            subtotal: baseCoursePrice,
            discountAmount: Math.max(0, baseCoursePrice - finalAmount),
            deliveryFee: 0,
            totalAmount: finalAmount,
            status: 'completed',
            createdAt: new Date().toISOString(),
          });
        }

        // Remove from waitlist if present
        for (const w of db.batchWaitlists) {
          if (w.batchId === batch.id && w.userId === stu.id && w.status === 'waiting') {
            w.status = 'promoted';
          }
        }

        pushBatchNotification(db, {
          batchId: batch.id,
          courseId: course.id,
          type: 'enrollment',
          title: `Welcome to ${batch.name}`,
          message: `You have been enrolled in ${batch.name} (${batch.schedule}).`,
          recipientUserIds: [stu.id],
          createdBy: actor.name,
        });

        enrolled.push(enr);
      }

      if (enrolled.length === 0) {
        return void res.status(409).json({
          error: rejected[0]?.reason || 'Unable to enroll selected student(s).',
          rejected,
        });
      }

      recordBatchLog(
        db,
        batch.id,
        actor,
        'BATCH_STUDENT_ENROLLED',
        `Enrolled ${enrolled.length} student(s): ${enrolled.map((e) => e.studentName).join(', ')}`
      );
      recordAuditLog(
        db,
        actor,
        'BATCH_ENROLL',
        batch.name,
        `Enrolled ${enrolled.length} student(s) (${rejected.length} skipped)`
      );
      saveDb(db);
      res.status(201).json({ enrolled, rejected, batch });
    }
  );

  router.post(
    '/api/portal/batches/:id/students/remove',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }

      const enrollmentId = String(req.body?.enrollmentId ?? '').trim();
      const enr = db.enrollments.find((e) => e.id === enrollmentId && e.batchId === batch.id);
      if (!enr) return void res.status(404).json({ error: 'Student enrollment not found in this batch.' });

      const reason = String(req.body?.reason ?? 'Removed from batch roster by admin').trim();
      if (enr.status === 'approved') {
        batch.enrolledSeats = Math.max(0, batch.enrolledSeats - 1);
      }
      enr.status = 'cancelled';
      enr.history = [
        {
          id: `eh-${Date.now()}`,
          action: 'removed_from_batch',
          actorName: actor.name,
          note: `${reason} (Historical attendance & payment records preserved)`,
          createdAt: new Date().toISOString(),
        },
        ...(enr.history ?? []),
      ];

      recordBatchLog(
        db,
        batch.id,
        actor,
        'BATCH_STUDENT_REMOVED',
        `Removed ${enr.studentName} from active roster. Attendance & payment history preserved.`
      );
      saveDb(db);
      res.json({ enrollment: enr, batch });
    }
  );

  // SAFE TRANSFER BETWEEN BATCHES (PRESERVES ATTENDANCE & PAYMENT HISTORY!)
  router.post(
    '/api/portal/batches/:id/students/transfer',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const sourceBatch = db.batches.find((b) => b.id === req.params.id);
      if (!sourceBatch) return void res.status(404).json({ error: 'Source batch not found.' });
      if (!canActorAccessBatch(actor, sourceBatch, db)) {
        return void res.status(403).json({ error: 'Not authorized to transfer from this batch.' });
      }

      const enrollmentId = String(req.body?.enrollmentId ?? '').trim();
      const targetBatchId = String(req.body?.targetBatchId ?? '').trim();
      const reason = String(req.body?.reason ?? 'Administrative batch transfer').trim().slice(0, 240);

      const enrollment = db.enrollments.find(
        (e) => e.id === enrollmentId && e.batchId === sourceBatch.id
      );
      const targetBatch = db.batches.find((b) => b.id === targetBatchId);
      const targetCourse = targetBatch
        ? db.courses.find((c) => c.id === targetBatch.courseId)
        : undefined;

      const check = validateBatchTransfer({
        enrollment,
        sourceBatch,
        targetBatch,
        targetCourse,
        enrollments: db.enrollments,
      });
      if (!check.ok || !enrollment || !targetBatch || !targetCourse) {
        return void res
          .status(!check.ok ? check.statusCode : 400)
          .json({ error: !check.ok ? check.error : 'Invalid transfer payload.' });
      }
      const targetBranchCheck = assertBranchOperationalForTransactions(targetBatch.branchId);
      if (!targetBranchCheck.ok) {
        return void res.status(403).json({ error: targetBranchCheck.error });
      }

      // Count historical records preserved (never deleted or overwritten!)
      const preservedAttendanceCount = db.attendance.filter(
        (a) => a.targetId === enrollment.userId && a.batchId === sourceBatch.id
      ).length;
      const preservedPaymentCount = db.transactions.filter(
        (t) => t.referenceType === 'course' && t.referenceId === enrollment.id
      ).length;

      if (enrollment.status === 'approved') {
        sourceBatch.enrolledSeats = Math.max(0, sourceBatch.enrolledSeats - 1);
        targetBatch.enrolledSeats += 1;
        if (sourceBatch.courseId !== targetCourse.id) {
          const prevCourse = db.courses.find((c) => c.id === sourceBatch.courseId);
          if (prevCourse) prevCourse.enrolledCount = Math.max(0, prevCourse.enrolledCount - 1);
          targetCourse.enrolledCount += 1;
        }
      }

      const transferRec: BatchTransferRecord = {
        id: `btr-${Date.now()}`,
        enrollmentId: enrollment.id,
        studentUserId: enrollment.userId,
        studentName: enrollment.studentName,
        fromBatchId: sourceBatch.id,
        fromBatchName: sourceBatch.name,
        toBatchId: targetBatch.id,
        toBatchName: targetBatch.name,
        fromCourseId: enrollment.courseId,
        toCourseId: targetCourse.id,
        reason,
        preservedAttendanceCount,
        preservedPaymentCount,
        actorName: actor.name,
        transferredAt: new Date().toISOString(),
      };

      const hist: EnrollmentHistoryEntry = {
        id: `eh-${Date.now()}`,
        action: 'transferred',
        actorName: actor.name,
        note: `Transferred from "${sourceBatch.name}" to "${targetBatch.name}". Reason: ${reason}. Preserved ${preservedAttendanceCount} attendance & ${preservedPaymentCount} payment record(s).`,
        createdAt: new Date().toISOString(),
      };

      enrollment.courseId = targetCourse.id;
      enrollment.courseTitle = targetCourse.title;
      enrollment.batchId = targetBatch.id;
      enrollment.batchName = targetBatch.name;
      enrollment.branchId = targetBatch.branchId;
      enrollment.history = [hist, ...(enrollment.history ?? [])];

      db.batchTransfers.unshift(transferRec);
      recordBatchLog(db, sourceBatch.id, actor, 'STUDENT_TRANSFERRED_OUT', hist.note);
      recordBatchLog(db, targetBatch.id, actor, 'STUDENT_TRANSFERRED_IN', hist.note);
      pushBatchNotification(db, {
        batchId: targetBatch.id,
        courseId: targetCourse.id,
        type: 'enrollment',
        title: `Batch Transfer Confirmed: ${targetBatch.name}`,
        message: `You have been transferred to ${targetBatch.name} (${targetBatch.schedule}). Your previous attendance and payment history remain intact.`,
        recipientUserIds: [enrollment.userId],
        createdBy: actor.name,
      });
      recordAuditLog(db, actor, 'BATCH_STUDENT_TRANSFER', enrollment.studentName, hist.note);
      saveDb(db);

      res.json({ transfer: transferRec, enrollment, sourceBatch, targetBatch });
    }
  );

  // PROMOTE STUDENT
  router.post(
    '/api/portal/batches/:id/students/promote',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });

      const enrollmentId = String(req.body?.enrollmentId ?? '').trim();
      const note = String(req.body?.note ?? 'Promoted to next academic level').trim();
      const enrollment = db.enrollments.find(
        (e) => e.id === enrollmentId && e.batchId === batch.id
      );
      if (!enrollment) return void res.status(404).json({ error: 'Enrollment not found in batch.' });

      enrollment.history = [
        {
          id: `eh-${Date.now()}`,
          action: 'promoted',
          actorName: actor.name,
          note: `Promoted in "${batch.name}": ${note}`,
          createdAt: new Date().toISOString(),
        },
        ...(enrollment.history ?? []),
      ];
      recordBatchLog(db, batch.id, actor, 'STUDENT_PROMOTED', `${enrollment.studentName}: ${note}`);
      saveDb(db);
      res.json({ enrollment });
    }
  );

  // WAITLIST ADD / PROMOTE / REMOVE
  router.post(
    '/api/portal/batches/:id/waitlist',
    requireAuth,
    requireRole(['admin', 'student']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      const branchCheck = assertBranchOperationalForTransactions(batch.branchId);
      if (!branchCheck.ok) {
        return void res.status(403).json({ error: branchCheck.error });
      }

      const targetUserId =
        actor.role === 'student' ? actor.id : String(req.body?.studentId ?? '').trim();
      const student = db.users.find((u) => u.id === targetUserId && u.role === 'student');
      if (!student) return void res.status(404).json({ error: 'Student account not found.' });

      if (
        db.batchWaitlists.some(
          (w) => w.batchId === batch.id && w.userId === student.id && w.status === 'waiting'
        )
      ) {
        return void res.status(409).json({ error: `${student.name} is already on the waitlist.` });
      }

      const nextPriority =
        db.batchWaitlists.filter((w) => w.batchId === batch.id && w.status === 'waiting').length + 1;
      const entry: BatchWaitlistEntry = {
        id: `bw-${Date.now()}`,
        batchId: batch.id,
        courseId: batch.courseId,
        userId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        phone: student.phone,
        priority: nextPriority,
        status: 'waiting',
        note: String(req.body?.note ?? 'Added to batch waitlist').trim(),
        createdAt: new Date().toISOString(),
      };
      db.batchWaitlists.push(entry);
      recordBatchLog(db, batch.id, actor, 'WAITLIST_ADDED', `${student.name} added to waitlist (#${nextPriority})`);
      saveDb(db);
      res.status(201).json({ waitlistEntry: entry });
    }
  );

  router.post(
    '/api/portal/batches/:id/waitlist/:waitlistId/promote',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      const entry = db.batchWaitlists.find(
        (w) => w.id === req.params.waitlistId && w.batchId === req.params.id && w.status === 'waiting'
      );
      if (!batch || !entry) return void res.status(404).json({ error: 'Waitlist entry not found.' });
      const branchCheck = assertBranchOperationalForTransactions(batch.branchId);
      if (!branchCheck.ok) {
        return void res.status(403).json({ error: branchCheck.error });
      }

      const course = db.courses.find((c) => c.id === batch.courseId);
      const student = db.users.find((u) => u.id === entry.userId);
      const check = validateBatchStudentAddition({
        batch,
        course,
        student,
        enrollments: db.enrollments,
      });
      if (!check.ok || !course || !student) {
        return void res
          .status(!check.ok ? check.statusCode : 400)
          .json({ error: !check.ok ? check.error : 'Cannot promote student.' });
      }

      const enr: Enrollment = {
        id: `enr-${Date.now()}`,
        userId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        courseId: course.id,
        courseTitle: course.title,
        branchId: batch.branchId,
        batchId: batch.id,
        batchName: batch.name,
        paymentMethod: 'Branch Cash',
        invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
        amountPaid: course.price,
        status: 'approved',
        completedLessonIds: [],
        history: [
          {
            id: `eh-${Date.now()}`,
            action: 'promoted_from_waitlist',
            actorName: actor.name,
            note: `Promoted from waitlist #${entry.priority} into "${batch.name}"`,
            createdAt: new Date().toISOString(),
          },
        ],
        enrolledAt: new Date().toISOString(),
      };
      db.enrollments.unshift(enr);
      batch.enrolledSeats += 1;
      course.enrolledCount += 1;
      entry.status = 'promoted';

      recordBatchLog(db, batch.id, actor, 'WAITLIST_PROMOTED', `Promoted ${student.name} from waitlist to active roster`);
      saveDb(db);
      res.json({ enrollment: enr, waitlistEntry: entry, batch });
    }
  );

  // ---------------- TEACHER ASSIGNMENT & HISTORY ----------------
  router.post(
    '/api/portal/batches/:id/teachers',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const mainTeacherId = String(body.instructorId ?? batch.instructorId).trim();
      const assistantTeacherId = body.assistantInstructorId
        ? String(body.assistantInstructorId).trim()
        : null;
      const assignments = Array.isArray(body.teacherAssignments)
        ? (body.teacherAssignments as BatchTeacherAssignment[])
        : [
            {
              instructorId: mainTeacherId,
              role: 'main' as const,
              responsibility: 'Main Instructor',
              assignedAt: new Date().toISOString(),
              assignedBy: actor.name,
            },
            ...(assistantTeacherId && assistantTeacherId !== mainTeacherId
              ? [
                  {
                    instructorId: assistantTeacherId,
                    role: 'assistant' as const,
                    responsibility: 'Assistant Instructor',
                    assignedAt: new Date().toISOString(),
                    assignedBy: actor.name,
                  },
                ]
              : []),
          ];

      for (const a of assignments) {
        if (!db.instructors.some((i) => i.id === a.instructorId)) {
          return void res.status(400).json({ error: `Instructor ${a.instructorId} not found.` });
        }
      }

      const conflicts = detectScheduleConflicts({
        candidateBatchId: batch.id,
        candidateStartDate: batch.startDate,
        candidateEndDate: batch.endDate,
        candidateInstructorIds: assignments.map((a) => a.instructorId),
        candidateSlots: getEffectiveBatchSlots(batch),
        existingBatches: db.batches,
      });
      if (conflicts.length > 0) {
        return void res.status(409).json({
          error: `Teacher assignment blocked: ${conflicts[0].message}`,
          conflicts,
        });
      }

      const prevMain = batch.instructorId;
      batch.instructorId = mainTeacherId;
      batch.assistantInstructorId = assistantTeacherId;
      batch.teacherAssignments = assignments;
      const mainInst = db.instructors.find((i) => i.id === mainTeacherId);
      const historyEntry: BatchTeacherHistoryEntry = {
        id: `bth-${Date.now()}`,
        instructorId: mainTeacherId,
        instructorName: mainInst?.name || mainTeacherId,
        role: 'main',
        action: prevMain !== mainTeacherId ? 'role_changed' : 'assigned',
        note: `Assigned ${assignments.length} teacher(s) to batch`,
        actorName: actor.name,
        at: new Date().toISOString(),
      };
      batch.teacherAssignmentHistory = [historyEntry, ...(batch.teacherAssignmentHistory ?? [])];

      recordBatchLog(db, batch.id, actor, 'TEACHERS_UPDATED', `Main teacher: ${mainInst?.name || mainTeacherId} (${assignments.length} total)`);
      pushBatchNotification(db, {
        batchId: batch.id,
        courseId: batch.courseId,
        type: 'teacher_change',
        title: `Faculty Updated for ${batch.name}`,
        message: `${mainInst?.name || 'Lead faculty'} is assigned as Main Teacher for ${batch.name}.`,
        createdBy: actor.name,
      });
      saveDb(db);
      res.json({ batch });
    }
  );

  // ---------------- SCHEDULE / CLASS ROUTINE CRUD + CONFLICT CHECK ----------------
  router.post(
    '/api/portal/batches/:id/schedules',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized to edit this batch schedule.' });
      }

      const b = (req.body ?? {}) as Record<string, unknown>;
      const newSlot: BatchScheduleSlot = {
        id: `slot-${Date.now()}`,
        title: String(b.title ?? 'Scheduled Class').trim(),
        dayOfWeek: BATCH_WEEK_DAYS.includes(b.dayOfWeek as BatchScheduleSlot['dayOfWeek'])
          ? (b.dayOfWeek as BatchScheduleSlot['dayOfWeek'])
          : 'Sun',
        startTime: String(b.startTime ?? '16:30'),
        endTime: String(b.endTime ?? '18:00'),
        durationMinutes: Math.max(15, Math.min(360, Number(b.durationMinutes) || 90)),
        breakMinutes: Math.max(0, Math.min(60, Number(b.breakMinutes) || 0)),
        instructorId: String(b.instructorId || batch.instructorId),
        roomLabel: b.roomLabel
          ? String(b.roomLabel).trim()
          : batch.classroom?.roomNumber || batch.classroom?.classroomName || undefined,
        sessionDate: b.sessionDate ? String(b.sessionDate).trim() : undefined,
        status: 'scheduled',
        topic: b.topic ? String(b.topic).trim() : undefined,
      };

      const candidateSlots = [...getEffectiveBatchSlots(batch), newSlot];
      const conflicts = detectScheduleConflicts({
        candidateBatchId: batch.id,
        candidateStartDate: batch.startDate,
        candidateEndDate: batch.endDate,
        candidateInstructorIds: getBatchAssignedInstructorIds(batch),
        candidateClassroomKey: newSlot.roomLabel || batch.classroom?.roomNumber || '',
        candidateSlots,
        existingBatches: db.batches,
      });
      if (conflicts.length > 0) {
        return void res.status(409).json({
          error: conflicts[0].message,
          conflicts,
        });
      }

      batch.schedules = candidateSlots;
      batch.schedule = formatScheduleSummary(candidateSlots, batch.schedule);
      recordBatchLog(
        db,
        batch.id,
        actor,
        'SCHEDULE_SLOT_ADDED',
        `Added ${newSlot.dayOfWeek} ${newSlot.startTime}–${newSlot.endTime}`
      );
      pushBatchNotification(db, {
        batchId: batch.id,
        courseId: batch.courseId,
        type: 'schedule_change',
        title: `New Class Slot Added: ${batch.name}`,
        message: `${newSlot.dayOfWeek} ${newSlot.startTime}–${newSlot.endTime} (${newSlot.title})`,
        createdBy: actor.name,
      });
      saveDb(db);
      res.status(201).json({ slot: newSlot, batch });
    }
  );

  router.patch(
    '/api/portal/batches/:id/schedules/:slotId',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }

      const slots = getEffectiveBatchSlots(batch);
      const idx = slots.findIndex((s) => s.id === req.params.slotId);
      if (idx === -1) return void res.status(404).json({ error: 'Schedule slot not found.' });

      const b = (req.body ?? {}) as Record<string, unknown>;
      const updatedSlot: BatchScheduleSlot = {
        ...slots[idx],
        title: b.title !== undefined ? String(b.title).trim() : slots[idx].title,
        dayOfWeek:
          b.dayOfWeek && BATCH_WEEK_DAYS.includes(b.dayOfWeek as BatchScheduleSlot['dayOfWeek'])
            ? (b.dayOfWeek as BatchScheduleSlot['dayOfWeek'])
            : slots[idx].dayOfWeek,
        startTime: b.startTime !== undefined ? String(b.startTime) : slots[idx].startTime,
        endTime: b.endTime !== undefined ? String(b.endTime) : slots[idx].endTime,
        roomLabel: b.roomLabel !== undefined ? String(b.roomLabel).trim() : slots[idx].roomLabel,
        status:
          b.status &&
          ['scheduled', 'completed', 'cancelled', 'rescheduled'].includes(String(b.status))
            ? (String(b.status) as BatchScheduleSlot['status'])
            : slots[idx].status,
        cancelReason: b.cancelReason !== undefined ? String(b.cancelReason) : slots[idx].cancelReason,
        rescheduledFrom:
          b.status === 'rescheduled'
            ? `${slots[idx].dayOfWeek} ${slots[idx].startTime}`
            : slots[idx].rescheduledFrom,
      };

      const nextSlots = slots.map((s, i) => (i === idx ? updatedSlot : s));
      if (updatedSlot.status !== 'cancelled') {
        const conflicts = detectScheduleConflicts({
          candidateBatchId: batch.id,
          candidateStartDate: batch.startDate,
          candidateEndDate: batch.endDate,
          candidateInstructorIds: getBatchAssignedInstructorIds(batch),
          candidateClassroomKey: updatedSlot.roomLabel || batch.classroom?.roomNumber || '',
          candidateSlots: nextSlots,
          existingBatches: db.batches,
        });
        if (conflicts.length > 0) {
          return void res.status(409).json({ error: conflicts[0].message, conflicts });
        }
      }

      batch.schedules = nextSlots;
      batch.schedule = formatScheduleSummary(nextSlots, batch.schedule);
      recordBatchLog(
        db,
        batch.id,
        actor,
        'SCHEDULE_SLOT_UPDATED',
        `${updatedSlot.dayOfWeek} ${updatedSlot.startTime}–${updatedSlot.endTime} -> ${updatedSlot.status}`
      );
      if (updatedSlot.status === 'cancelled' || updatedSlot.status === 'rescheduled') {
        pushBatchNotification(db, {
          batchId: batch.id,
          courseId: batch.courseId,
          type: updatedSlot.status === 'cancelled' ? 'class_cancelled' : 'schedule_change',
          title: `Class ${updatedSlot.status === 'cancelled' ? 'Cancelled' : 'Rescheduled'}: ${batch.name}`,
          message: `${updatedSlot.dayOfWeek} ${updatedSlot.startTime}–${updatedSlot.endTime}${updatedSlot.cancelReason ? ` · ${updatedSlot.cancelReason}` : ''}`,
          createdBy: actor.name,
        });
      }
      saveDb(db);
      res.json({ slot: updatedSlot, batch });
    }
  );

  // ---------------- BULK BATCH ATTENDANCE (INTEGRATED WITH EXISTING db.attendance) ----------------
  router.post(
    '/api/portal/batches/:id/attendance/bulk',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized to mark attendance for this batch.' });
      }

      const date = String(req.body?.date || new Date().toISOString().slice(0, 10)).trim();
      const entries = Array.isArray(req.body?.entries)
        ? (req.body.entries as { studentId: string; status: string; notes?: string }[])
        : [];
      if (entries.length === 0) {
        return void res.status(400).json({ error: 'No attendance entries provided.' });
      }

      const enrolledBatchStudentIds = new Set(
        db.enrollments
          .filter(
            (e) =>
              e.status === 'approved' &&
              (e.batchId === batch.id || (!e.batchId && e.courseId === batch.courseId))
          )
          .map((e) => e.userId)
      );

      const updatedRecords: AttendanceRecord[] = [];
      for (const entry of entries) {
        if (!enrolledBatchStudentIds.has(entry.studentId)) continue;
        const student = db.users.find((u) => u.id === entry.studentId && u.role === 'student');
        if (!student) continue;
        const safeStatus = (
          ['present', 'absent', 'late', 'leave', 'excused'].includes(entry.status)
            ? entry.status
            : 'present'
        ) as AttendanceRecord['status'];

        const existing = db.attendance.find(
          (a) => a.targetId === student.id && a.date === date && a.batchId === batch.id
        );
        if (existing) {
          existing.status = safeStatus;
          existing.notes = entry.notes;
          existing.recordedBy = actor.name;
          updatedRecords.push(existing);
        } else {
          const rec: AttendanceRecord = {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            targetType: 'student',
            targetId: student.id,
            targetName: student.name,
            branchId: batch.branchId,
            batchId: batch.id,
            date,
            status: safeStatus,
            checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            notes: entry.notes,
            recordedBy: actor.name,
          };
          db.attendance.unshift(rec);
          updatedRecords.push(rec);
        }
      }

      recordBatchLog(
        db,
        batch.id,
        actor,
        'ATTENDANCE_RECORDED',
        `Marked attendance on ${date} for ${updatedRecords.length} student(s).`
      );
      saveDb(db);
      res.status(201).json({ records: updatedRecords, count: updatedRecords.length });
    }
  );

  // ---------------- BATCH ANNOUNCEMENTS & NOTIFICATIONS ----------------
  router.post(
    '/api/portal/batches/:id/announcements',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }

      const title = String(req.body?.title ?? '').trim();
      const message = String(req.body?.message ?? '').trim();
      if (!title || !message) {
        return void res.status(400).json({ error: 'Title and message are required.' });
      }

      const announcement = {
        id: `ann-${Date.now()}`,
        courseId: batch.courseId,
        batchId: batch.id,
        title,
        message,
        pinned: Boolean(req.body?.pinned),
        postedByUserId: actor.id,
        postedByName: actor.name,
        authorId: actor.id,
        authorName: actor.name,
        authorRole: actor.role,
        createdAt: new Date().toISOString(),
      };
      db.announcements.unshift(announcement);
      pushBatchNotification(db, {
        batchId: batch.id,
        courseId: batch.courseId,
        type: 'exam_announcement',
        title,
        message,
        createdBy: actor.name,
      });
      recordBatchLog(db, batch.id, actor, 'ANNOUNCEMENT_POSTED', title);
      saveDb(db);
      res.status(201).json({ announcement });
    }
  );

  router.post(
    '/api/portal/batches/:id/notifications/remind',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }

      const type = String(req.body?.type || 'payment_reminder') as BatchNotification['type'];
      const title = String(req.body?.title || `Reminder: ${batch.name}`).trim();
      const message = String(
        req.body?.message || `Please review your upcoming class / fee deadline for ${batch.name}.`
      ).trim();

      const notif = pushBatchNotification(db, {
        batchId: batch.id,
        courseId: batch.courseId,
        type,
        title,
        message,
        createdBy: actor.name,
      });
      recordBatchLog(db, batch.id, actor, 'NOTIFICATION_SENT', `${type}: ${title}`);
      saveDb(db);
      res.status(201).json({ notification: notif });
    }
  );

  // ---------------- LIFECYCLE & SAFE ARCHIVE / DELETE ----------------
  router.patch(
    '/api/portal/batches/:id/lifecycle',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }

      const nextLifecycle = String(req.body?.lifecycleStatus ?? '') as BatchLifecycleStatus;
      if (!Object.keys(BATCH_LIFECYCLE_LABELS).includes(nextLifecycle)) {
        return void res.status(400).json({ error: 'Invalid batch lifecycle status.' });
      }
      const prevLifecycle = normalizeBatchLifecycle(batch);
      batch.lifecycleStatus = nextLifecycle;
      batch.status = syncLegacyStatusFromLifecycle(nextLifecycle);
      batch.archivedAt = nextLifecycle === 'archived' ? new Date().toISOString() : null;
      batch.updatedAt = new Date().toISOString();

      recordBatchLog(
        db,
        batch.id,
        actor,
        'LIFECYCLE_CHANGED',
        `${BATCH_LIFECYCLE_LABELS[prevLifecycle]} -> ${BATCH_LIFECYCLE_LABELS[nextLifecycle]}`
      );
      if (nextLifecycle === 'completed') {
        pushBatchNotification(db, {
          batchId: batch.id,
          courseId: batch.courseId,
          type: 'batch_completed',
          title: `Batch Completed: ${batch.name}`,
          message: `Congratulations! ${batch.name} has been marked completed. Check your results and certificates.`,
          createdBy: actor.name,
        });
      }
      recordAuditLog(
        db,
        actor,
        'BATCH_LIFECYCLE',
        batch.name,
        `${prevLifecycle} -> ${nextLifecycle}`
      );
      saveDb(db);
      res.json({ batch });
    }
  );

  router.delete(
    '/api/portal/batches/:id/safe',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.batches.findIndex((b) => b.id === req.params.id);
      if (idx === -1) return void res.status(404).json({ error: 'Batch not found.' });
      const batch = db.batches[idx];

      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }

      const guard = canDeleteBatch({
        batch,
        enrollments: db.enrollments,
        attendance: db.attendance,
        transactions: db.transactions,
      });
      if (!guard.allowed) {
        return void res.status(409).json({
          error: guard.reason,
          dependencyCount: guard.dependencyCount,
          suggestArchive: true,
        });
      }

      const [removed] = db.batches.splice(idx, 1);
      db.recycleBin.unshift({
        id: `bin-${Date.now()}`,
        entityType: 'batch',
        originalId: removed.id,
        label: `${removed.name} (${removed.code})`,
        deletedBy: actor.name,
        deletedAt: new Date().toISOString(),
        snapshot: removed,
      });
      recordAuditLog(db, actor, 'BATCH_DELETE', removed.name, 'Moved empty batch to Recycle Bin');
      saveDb(db);
      res.json({ ok: true, deletedId: removed.id });
    }
  );

  // ---------------- CSV EXPORTS ----------------
  router.get(
    '/api/portal/batches/:id/export-students',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) return void res.status(404).json({ error: 'Batch not found.' });
      if (!canActorAccessBatch(actor, batch, db)) {
        return void res.status(403).json({ error: 'Not authorized.' });
      }
      const csv = formatBatchStudentsCsv(batch, db.enrollments, db.attendance);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="batch-${batch.code}-students.csv"`);
      res.send(csv);
    }
  );

  router.get(
    '/api/portal/batches/export-comparison',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const scopedBatches =
        actor.role === 'teacher'
          ? getTeacherAssignedBatches(actor, db.batches, db.instructors)
          : actor.role === 'branch'
            ? actor.branchId
              ? db.batches.filter((b) => b.branchId === actor.branchId)
              : []
            : db.batches;
      const analytics = computeBatchDashboardAnalytics({
        batches: scopedBatches,
        courses: db.courses,
        enrollments: db.enrollments,
        attendance: db.attendance,
        transactions: db.transactions,
      });
      const csv = formatBatchComparisonCsv(analytics.comparisonRows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="batch-comparison-report.csv"');
      res.send(csv);
    }
  );

  return router;
}
