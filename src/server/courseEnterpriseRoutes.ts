import express, { type NextFunction, type Request, type Response } from 'express';
import {
  buildCourseJsonLd,
  computeCourseAnalytics,
  computeCourseCompletionStatus,
  computeCurriculumHierarchy,
  COURSE_TEMPLATES,
  formatCoursesCsv,
  generateCertificateNumber,
  getTeacherAssignedCourseIds,
  canTeacherManageCourse,
  isCourseStatusLive,
  parseBulkCoursesImport,
  resolveTeacherInstructorIds,
  validateEnrollmentRequest,
} from '../lib/courseEnterprise';
import { computeBatchSeatUsage, sanitizeSafeUrl } from '../lib/domain';
import type {
  AssignmentSubmission,
  CourseAnnouncement,
  CourseAssignment,
  CourseCertificate,
  CourseChapter,
  CourseModule,
  EnrollmentHistoryEntry,
  Review,
  UserRole,
} from '../types';
import { getDb, recordAuditLog, saveDb, type StoredUser } from './store';
import { assertBranchOperationalForTransactions } from './paymentService';
import { consumePublicRateLimit, sanitizePublicCertificate } from './publicRedaction';
import { getClientIp } from './security';

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

type RequireAuthFn = (req: AuthedRequest, res: Response, next: NextFunction) => void;
type RequireRoleFn = (
  roles: UserRole[]
) => (req: AuthedRequest, res: Response, next: NextFunction) => void;

export function createCourseEnterpriseRouter(
  requireAuth: RequireAuthFn,
  requireRole: RequireRoleFn
) {
  const router = express.Router();

  // ---------------- ENTERPRISE ANALYTICS, EXPORT, TEMPLATES & BULK IMPORT ----------------

  router.get(
    '/api/portal/courses/analytics',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const assignedIds =
        actor.role === 'teacher'
          ? getTeacherAssignedCourseIds(actor, db.courses, db.instructors, db.batches)
          : null;

      const scopedCourses = assignedIds
        ? db.courses.filter((c) => assignedIds.has(c.id))
        : db.courses;
      const scopedCourseIdSet = new Set(scopedCourses.map((c) => c.id));
      const scopedBatches = db.batches.filter((b) => scopedCourseIdSet.has(b.courseId));
      const scopedLessons = db.lessons.filter((l) => scopedCourseIdSet.has(l.courseId));
      const scopedEnrollments = db.enrollments.filter((e) => scopedCourseIdSet.has(e.courseId));
      const scopedCertificates = db.certificates.filter((c) => scopedCourseIdSet.has(c.courseId));
      const scopedAssignments = db.assignments.filter((a) => scopedCourseIdSet.has(a.courseId));

      const summary = computeCourseAnalytics({
        courses: scopedCourses,
        batches: scopedBatches,
        lessons: scopedLessons,
        enrollments: scopedEnrollments,
        certificates: scopedCertificates,
        assignments: scopedAssignments,
      });

      const recentActivities = db.auditLogs
        .filter((log) => {
          const isCourseAction = [
            'COURSE_CREATE',
            'COURSE_UPDATE',
            'COURSE_STATUS',
            'COURSE_ARCHIVE',
            'COURSE_RESTORE',
            'COURSE_DUPLICATE',
            'COURSE_BULK_IMPORT',
            'BATCH_CREATE',
            'ENROLLMENT_CREATE',
            'ENROLLMENT_TRANSFER',
            'ENROLLMENT_CANCEL_REFUND',
            'CERTIFICATE_ISSUE',
            'CURRICULUM_UPDATE',
          ].includes(log.action);
          if (!isCourseAction) return false;
          if (actor.role !== 'teacher') return true;
          return (
            log.actorId === actor.id ||
            scopedCourses.some((c) => log.target.includes(c.title) || log.details.includes(c.id))
          );
        })
        .slice(0, 20);

      res.json({
        summary,
        recentActivities,
        assignedCourseIds: assignedIds ? Array.from(assignedIds) : null,
      });
    }
  );

  router.get(
    '/api/portal/courses/export-csv',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const courses =
        actor.role === 'teacher'
          ? db.courses.filter((c) =>
              canTeacherManageCourse(actor, c, db.instructors, db.batches)
            )
          : db.courses;
      const csv = formatCoursesCsv(courses, db.batches, db.instructors);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="aec-courses-report.csv"');
      res.send(csv);
    }
  );

  router.get(
    '/api/portal/courses/templates',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (_req, res) => {
      res.json({ templates: COURSE_TEMPLATES });
    }
  );

  router.post(
    '/api/portal/courses/bulk-import',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const rawInput = String(req.body?.rawInput ?? '');
      const parsed = parseBulkCoursesImport(
        rawInput,
        db.courses,
        db.branches,
        db.instructors
      );
      if (parsed.courses.length === 0) {
        res.status(400).json({
          error: parsed.errors[0] || 'No valid courses found to import.',
          errors: parsed.errors,
        });
        return;
      }

      const teacherInstIds =
        actor.role === 'teacher'
          ? Array.from(resolveTeacherInstructorIds(actor, db.instructors)).filter((id) =>
              db.instructors.some((i) => i.id === id)
            )
          : [];

      const createdCourses = parsed.courses.map((c) => ({
        ...c,
        createdByUserId: actor.id,
        instructorIds:
          teacherInstIds.length > 0
            ? Array.from(new Set([...teacherInstIds, ...c.instructorIds]))
            : c.instructorIds,
      }));

      db.courses.unshift(...createdCourses);
      recordAuditLog(
        db,
        actor,
        'COURSE_BULK_IMPORT',
        `${createdCourses.length} course(s)`,
        createdCourses.map((c) => c.title).slice(0, 3).join(', ')
      );
      saveDb(db);
      res.status(201).json({
        importedCount: createdCourses.length,
        courses: createdCourses,
        errors: parsed.errors,
      });
    }
  );

  router.patch(
    '/api/portal/courses/:id/archive',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.id);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to manage this course.' });
        return;
      }
      const prev = course.status;
      course.status = 'archived';
      course.updatedAt = new Date().toISOString();
      recordAuditLog(db, actor, 'COURSE_ARCHIVE', course.title, `Archived (${prev} -> archived)`);
      saveDb(db);
      res.json({ course });
    }
  );

  router.patch(
    '/api/portal/courses/:id/restore',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.id);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to manage this course.' });
        return;
      }
      const target = req.body?.status === 'published' || req.body?.status === 'active'
        ? req.body.status
        : 'draft';
      const prev = course.status;
      course.status = target;
      course.updatedAt = new Date().toISOString();
      recordAuditLog(db, actor, 'COURSE_RESTORE', course.title, `Restored (${prev} -> ${target})`);
      saveDb(db);
      res.json({ course });
    }
  );

  router.get(
    '/api/portal/courses/:id/audit-logs',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.id);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to inspect this course.' });
        return;
      }
      const logs = db.auditLogs.filter(
        (l) => l.target === course.title || l.details.includes(course.id)
      );
      res.json({ logs });
    }
  );

  // ---------------- HIERARCHICAL CURRICULUM BUILDER (MODULES, CHAPTERS & DRAG-DROP REORDER) ----------------

  router.get(
    '/api/portal/courses/:courseId/curriculum',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to this course.' });
        return;
      }
      const hierarchy = computeCurriculumHierarchy(
        course.id,
        db.modules,
        db.chapters,
        db.lessons,
        true
      );
      res.json({
        course,
        modules: db.modules.filter((m) => m.courseId === course.id).sort((a, b) => a.orderIndex - b.orderIndex),
        chapters: db.chapters.filter((ch) => ch.courseId === course.id).sort((a, b) => a.orderIndex - b.orderIndex),
        lessons: hierarchy.orderedLessons,
        hierarchy,
      });
    }
  );

  router.post(
    '/api/portal/courses/:courseId/modules',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to edit this course.' });
        return;
      }
      const title = String(req.body?.title ?? '').trim().slice(0, 140);
      if (!title) {
        res.status(400).json({ error: 'Module title is required.' });
        return;
      }
      const existingCount = db.modules.filter((m) => m.courseId === course.id).length;
      const mod: CourseModule = {
        id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        courseId: course.id,
        title,
        description: String(req.body?.description ?? '').trim().slice(0, 500) || undefined,
        orderIndex: existingCount + 1,
        status: req.body?.status === 'draft' ? 'draft' : 'published',
      };
      db.modules.push(mod);
      recordAuditLog(db, actor, 'CURRICULUM_UPDATE', course.title, `Added module "${mod.title}"`);
      saveDb(db);
      res.status(201).json({ module: mod });
    }
  );

  router.put(
    '/api/portal/modules/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const mod = db.modules.find((m) => m.id === req.params.id);
      if (!mod) {
        res.status(404).json({ error: 'Module not found' });
        return;
      }
      const course = db.courses.find((c) => c.id === mod.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to edit this module.' });
        return;
      }
      const title = String(req.body?.title ?? mod.title).trim().slice(0, 140);
      if (!title) {
        res.status(400).json({ error: 'Module title is required.' });
        return;
      }
      mod.title = title;
      if (req.body?.description !== undefined) {
        mod.description = String(req.body.description).trim().slice(0, 500) || undefined;
      }
      if (req.body?.status === 'draft' || req.body?.status === 'published') {
        mod.status = req.body.status;
      }
      for (const les of db.lessons) {
        if (les.moduleId === mod.id) {
          les.moduleName = mod.title;
        }
      }
      saveDb(db);
      res.json({ module: mod });
    }
  );

  router.delete(
    '/api/portal/modules/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.modules.findIndex((m) => m.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Module not found' });
        return;
      }
      const mod = db.modules[idx];
      const course = db.courses.find((c) => c.id === mod.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to delete this module.' });
        return;
      }
      db.modules.splice(idx, 1);
      db.chapters = db.chapters.filter((ch) => ch.moduleId !== mod.id);
      for (const les of db.lessons) {
        if (les.moduleId === mod.id) {
          les.moduleId = undefined;
          les.chapterId = undefined;
        }
      }
      db.modules
        .filter((m) => m.courseId === mod.courseId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .forEach((m, i) => {
          m.orderIndex = i + 1;
        });
      saveDb(db);
      res.json({ deletedId: mod.id });
    }
  );

  router.post(
    '/api/portal/courses/:courseId/chapters',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to edit this course.' });
        return;
      }
      const moduleId = String(req.body?.moduleId ?? '').trim();
      const title = String(req.body?.title ?? '').trim().slice(0, 140);
      if (!moduleId || !title) {
        res.status(400).json({ error: 'Module ID and chapter title are required.' });
        return;
      }
      if (!db.modules.some((m) => m.id === moduleId && m.courseId === course.id)) {
        res.status(400).json({ error: 'Target module does not belong to this course.' });
        return;
      }
      const count = db.chapters.filter((ch) => ch.moduleId === moduleId).length;
      const chapter: CourseChapter = {
        id: `chp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        courseId: course.id,
        moduleId,
        title,
        orderIndex: count + 1,
      };
      db.chapters.push(chapter);
      saveDb(db);
      res.status(201).json({ chapter });
    }
  );

  router.put(
    '/api/portal/chapters/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const ch = db.chapters.find((c) => c.id === req.params.id);
      if (!ch) {
        res.status(404).json({ error: 'Chapter not found' });
        return;
      }
      const course = db.courses.find((c) => c.id === ch.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to edit this chapter.' });
        return;
      }
      const title = String(req.body?.title ?? ch.title).trim().slice(0, 140);
      if (!title) {
        res.status(400).json({ error: 'Chapter title is required.' });
        return;
      }
      ch.title = title;
      saveDb(db);
      res.json({ chapter: ch });
    }
  );

  router.delete(
    '/api/portal/chapters/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.chapters.findIndex((c) => c.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Chapter not found' });
        return;
      }
      const ch = db.chapters[idx];
      const course = db.courses.find((c) => c.id === ch.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to delete this chapter.' });
        return;
      }
      db.chapters.splice(idx, 1);
      for (const les of db.lessons) {
        if (les.chapterId === ch.id) {
          les.chapterId = undefined;
        }
      }
      saveDb(db);
      res.json({ deletedId: ch.id });
    }
  );

  router.patch(
    '/api/portal/courses/:courseId/curriculum/reorder',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to reorder this curriculum.' });
        return;
      }

      const { moduleIds, lessonItems } = req.body ?? {};
      if (Array.isArray(moduleIds)) {
        moduleIds.forEach((modId, idx) => {
          const mod = db.modules.find((m) => m.id === modId && m.courseId === course.id);
          if (mod) mod.orderIndex = idx + 1;
        });
      }

      if (Array.isArray(lessonItems)) {
        lessonItems.forEach((item: { id: string; moduleId?: string; chapterId?: string }, idx: number) => {
          const les = db.lessons.find((l) => l.id === item.id && l.courseId === course.id);
          if (!les) return;
          les.orderIndex = idx + 1;
          if (item.moduleId !== undefined) {
            const targetMod = db.modules.find((m) => m.id === item.moduleId && m.courseId === course.id);
            les.moduleId = targetMod ? targetMod.id : undefined;
            if (targetMod) les.moduleName = targetMod.title;
          }
          if (item.chapterId !== undefined) {
            const targetChap = db.chapters.find((ch) => ch.id === item.chapterId && ch.courseId === course.id);
            les.chapterId = targetChap ? targetChap.id : undefined;
          }
        });
      }

      recordAuditLog(db, actor, 'CURRICULUM_UPDATE', course.title, 'Reordered curriculum structure');
      saveDb(db);
      res.json({
        modules: db.modules.filter((m) => m.courseId === course.id).sort((a, b) => a.orderIndex - b.orderIndex),
        lessons: db.lessons.filter((l) => l.courseId === course.id).sort((a, b) => a.orderIndex - b.orderIndex),
      });
    }
  );

  // ---------------- ENTERPRISE ENROLLMENT ACTIONS (TRANSFER, CANCEL/REFUND, EXPIRY) ----------------

  router.post(
    '/api/portal/enrollments/:id/transfer',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const enrollment = db.enrollments.find((e) => e.id === req.params.id);
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found.' });
        return;
      }

      const targetCourseId = String(req.body?.targetCourseId || enrollment.courseId).trim();
      const targetBatchId = req.body?.targetBatchId ? String(req.body.targetBatchId).trim() : null;
      const reason = String(req.body?.reason ?? 'Administrative course/batch transfer').trim().slice(0, 240);

      const targetCourse = db.courses.find((c) => c.id === targetCourseId && isCourseStatusLive(c.status));
      if (!targetCourse) {
        res.status(404).json({ error: 'Target course must be published or active.' });
        return;
      }

      if (targetCourse.id !== enrollment.courseId) {
        const dup = db.enrollments.find(
          (e) =>
            e.id !== enrollment.id &&
            e.userId === enrollment.userId &&
            e.courseId === targetCourse.id &&
            (e.status === 'approved' || e.status === 'pending')
        );
        if (dup) {
          res.status(409).json({ error: 'Student already has an active or pending enrollment in the target course.' });
          return;
        }
      }

      let targetBatch = targetBatchId
        ? db.batches.find((b) => b.id === targetBatchId && b.courseId === targetCourse.id)
        : undefined;
      if (targetBatchId && !targetBatch) {
        res.status(400).json({ error: 'Target batch does not belong to the selected course.' });
        return;
      }
      if (targetBatch && targetBatch.id !== enrollment.batchId) {
        if (targetBatch.status === 'closed') {
          res.status(400).json({ error: `Target batch "${targetBatch.name}" is closed.` });
          return;
        }
        const usage = computeBatchSeatUsage(targetBatch);
        if (usage.isFull) {
          res.status(409).json({ error: `Target batch "${targetBatch.name}" is already at full capacity.` });
          return;
        }
      }

      const prevCourse = db.courses.find((c) => c.id === enrollment.courseId);
      const prevBatch = enrollment.batchId
        ? db.batches.find((b) => b.id === enrollment.batchId)
        : undefined;

      if (enrollment.status === 'approved') {
        if (prevCourse && prevCourse.id !== targetCourse.id) {
          prevCourse.enrolledCount = Math.max(0, prevCourse.enrolledCount - 1);
          targetCourse.enrolledCount += 1;
        }
        if (prevBatch && prevBatch.id !== targetBatch?.id) {
          prevBatch.enrolledSeats = Math.max(0, prevBatch.enrolledSeats - 1);
        }
        if (targetBatch && targetBatch.id !== prevBatch?.id) {
          targetBatch.enrolledSeats += 1;
        }
      }

      const histEntry: EnrollmentHistoryEntry = {
        id: `eh-${Date.now()}`,
        action: 'transferred',
        note: `From "${enrollment.courseTitle}" (${enrollment.batchName || 'No batch'}) -> "${targetCourse.title}" (${targetBatch?.name || 'No batch'}). ${reason}`,
        actorName: actor.name,
        createdAt: new Date().toISOString(),
      };

      const nextBranchId = req.body?.targetBranchId
        ? String(req.body.targetBranchId)
        : targetBatch
          ? targetBatch.branchId
          : enrollment.branchId;
      const branchCheck = assertBranchOperationalForTransactions(nextBranchId);
      if (!branchCheck.ok) {
        res.status(403).json({ error: branchCheck.error });
        return;
      }
      enrollment.courseId = targetCourse.id;
      enrollment.courseTitle = targetCourse.title;
      enrollment.batchId = targetBatch ? targetBatch.id : null;
      enrollment.batchName = targetBatch ? targetBatch.name : undefined;
      enrollment.branchId = nextBranchId;
      enrollment.history = [histEntry, ...(enrollment.history ?? [])];

      recordAuditLog(
        db,
        actor,
        'ENROLLMENT_TRANSFER',
        enrollment.studentName,
        histEntry.note
      );
      saveDb(db);
      res.json({ enrollment });
    }
  );

  router.post(
    '/api/portal/enrollments/:id/cancel-refund',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const enrollment = db.enrollments.find((e) => e.id === req.params.id);
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found.' });
        return;
      }
      if (enrollment.status === 'cancelled') {
        res.status(400).json({ error: 'This enrollment is already cancelled.' });
        return;
      }

      const refundAmount = Math.max(
        0,
        Math.min(enrollment.amountPaid, Math.round(Number(req.body?.refundAmount ?? enrollment.amountPaid) || 0))
      );
      const reason = String(req.body?.reason ?? 'Cancelled upon student/admin request').trim().slice(0, 240);

      if (enrollment.status === 'approved') {
        const course = db.courses.find((c) => c.id === enrollment.courseId);
        if (course) course.enrolledCount = Math.max(0, course.enrolledCount - 1);
        if (enrollment.batchId) {
          const batch = db.batches.find((b) => b.id === enrollment.batchId);
          if (batch) batch.enrolledSeats = Math.max(0, batch.enrolledSeats - 1);
        }
      }

      enrollment.status = 'cancelled';
      enrollment.refundAmount = refundAmount;
      enrollment.refundReason = reason;
      enrollment.history = [
        {
          id: `eh-${Date.now()}`,
          action: refundAmount > 0 ? 'refunded' : 'cancelled',
          note: `Cancelled · Refund ৳${refundAmount} · ${reason}`,
          actorName: actor.name,
          createdAt: new Date().toISOString(),
        },
        ...(enrollment.history ?? []),
      ];

      const linkedTxn = db.transactions.find(
        (t) => t.referenceType === 'course' && t.referenceId === enrollment.id
      );
      if (linkedTxn) {
        linkedTxn.status = 'refunded';
      }

      if (refundAmount > 0) {
        db.financialRecords.unshift({
          id: `fin-ref-${Date.now()}`,
          type: 'expense',
          category: 'Enrollment Refund',
          title: `Refund: ${enrollment.courseTitle} — ${enrollment.studentName}`,
          amount: refundAmount,
          branchId: enrollment.branchId,
          date: new Date().toISOString().slice(0, 10),
          recordedBy: actor.name,
        });
      }

      recordAuditLog(
        db,
        actor,
        'ENROLLMENT_CANCEL_REFUND',
        enrollment.courseTitle,
        `${enrollment.studentName} · Cancelled · Refund ৳${refundAmount}`
      );
      saveDb(db);
      res.json({ enrollment });
    }
  );

  router.patch(
    '/api/portal/enrollments/:id/expiry',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const enrollment = db.enrollments.find((e) => e.id === req.params.id);
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found.' });
        return;
      }
      const expiresAt = req.body?.expiresAt ? String(req.body.expiresAt).trim() : null;
      enrollment.expiresAt = expiresAt;
      enrollment.history = [
        {
          id: `eh-${Date.now()}`,
          action: 'updated',
          note: expiresAt ? `Access expiry updated to ${expiresAt}` : 'Access expiry cleared (lifetime)',
          actorName: actor.name,
          createdAt: new Date().toISOString(),
        },
        ...(enrollment.history ?? []),
      ];
      saveDb(db);
      res.json({ enrollment });
    }
  );

  // ---------------- ASSIGNMENTS & SUBMISSIONS (TEACHER + STUDENT PORTAL) ----------------

  router.get(
    '/api/portal/courses/:courseId/assignments',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to this course.' });
        return;
      }
      const assignments = db.assignments.filter((a) => a.courseId === course.id);
      const submissions = db.assignmentSubmissions.filter((s) => s.courseId === course.id);
      res.json({ assignments, submissions });
    }
  );

  router.post(
    '/api/portal/courses/:courseId/assignments',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to create assignments for this course.' });
        return;
      }
      const title = String(req.body?.title ?? '').trim().slice(0, 180);
      const instructions = String(req.body?.instructions ?? '').trim().slice(0, 2000);
      if (!title || !instructions) {
        res.status(400).json({ error: 'Assignment title and instructions are required.' });
        return;
      }
      const assignment: CourseAssignment = {
        id: `asg-${Date.now()}`,
        courseId: course.id,
        batchId: req.body?.batchId ? String(req.body.batchId) : null,
        title,
        instructions,
        dueDate: String(req.body?.dueDate ?? '2026-12-31').trim().slice(0, 30),
        maxMarks: Math.max(5, Math.min(200, Math.round(Number(req.body?.maxMarks) || 20))),
        attachmentUrl: req.body?.attachmentUrl
          ? sanitizeSafeUrl(String(req.body.attachmentUrl), '')
          : undefined,
        createdByUserId: actor.id,
        createdByName: actor.name,
        createdAt: new Date().toISOString(),
      };
      db.assignments.unshift(assignment);
      recordAuditLog(db, actor, 'ASSIGNMENT_CREATE', course.title, assignment.title);
      saveDb(db);
      res.status(201).json({ assignment });
    }
  );

  router.delete(
    '/api/portal/assignments/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.assignments.findIndex((a) => a.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Assignment not found' });
        return;
      }
      const asg = db.assignments[idx];
      const course = db.courses.find((c) => c.id === asg.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to delete this assignment.' });
        return;
      }
      db.assignments.splice(idx, 1);
      saveDb(db);
      res.json({ deletedId: asg.id });
    }
  );

  router.post('/api/learn/assignments/:id/submit', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const assignment = db.assignments.find((a) => a.id === req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }

    const enrollment = db.enrollments.find(
      (e) => e.userId === user.id && e.courseId === assignment.courseId && e.status === 'approved'
    );
    if (!enrollment && user.role !== 'admin') {
      res.status(403).json({ error: 'Approved enrollment in this course is required to submit assignments.' });
      return;
    }
    if (enrollment?.expiresAt && Date.parse(enrollment.expiresAt) < Date.now()) {
      res.status(403).json({ error: 'Your course enrollment has expired.' });
      return;
    }

    const answerText = String(req.body?.answerText ?? '').trim().slice(0, 5000);
    const attachmentUrl = req.body?.attachmentUrl
      ? sanitizeSafeUrl(String(req.body.attachmentUrl), '')
      : undefined;

    if (!answerText && !attachmentUrl) {
      res.status(400).json({ error: 'Please write your assignment response or attach a submission link.' });
      return;
    }

    let submission = db.assignmentSubmissions.find(
      (s) => s.assignmentId === assignment.id && s.userId === user.id
    );
    if (submission) {
      submission.answerText = answerText;
      submission.attachmentUrl = attachmentUrl;
      submission.status = 'submitted';
      submission.submittedAt = new Date().toISOString();
    } else {
      submission = {
        id: `asub-${Date.now()}`,
        assignmentId: assignment.id,
        courseId: assignment.courseId,
        userId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        answerText,
        attachmentUrl,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      };
      db.assignmentSubmissions.unshift(submission);
    }

    saveDb(db);
    res.status(201).json({ submission });
  });

  router.patch(
    '/api/portal/assignment-submissions/:id/grade',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const submission = db.assignmentSubmissions.find((s) => s.id === req.params.id);
      if (!submission) {
        res.status(404).json({ error: 'Submission not found.' });
        return;
      }
      const course = db.courses.find((c) => c.id === submission.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to grade submissions for this course.' });
        return;
      }
      const assignment = db.assignments.find((a) => a.id === submission.assignmentId);
      const maxMarks = assignment?.maxMarks ?? 20;
      const marks = Math.max(0, Math.min(maxMarks, Math.round(Number(req.body?.marks ?? 0))));
      const feedback = String(req.body?.feedback ?? '').trim().slice(0, 1000);

      submission.marks = marks;
      submission.feedback = feedback || undefined;
      submission.status = 'graded';
      submission.gradedBy = actor.name;
      submission.gradedAt = new Date().toISOString();

      recordAuditLog(
        db,
        actor,
        'ASSIGNMENT_GRADE',
        `${submission.studentName} · ${assignment?.title ?? submission.assignmentId}`,
        `Marks ${marks}/${maxMarks}`
      );
      saveDb(db);
      res.json({ submission });
    }
  );

  // ---------------- COURSE ANNOUNCEMENTS ----------------

  router.get('/api/learn/announcements', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    if (user.role === 'admin') {
      res.json({ announcements: db.announcements });
      return;
    }
    const approvedIds = new Set(
      db.enrollments
        .filter((e) => e.userId === user.id && e.status === 'approved')
        .map((e) => e.courseId)
    );
    const teacherIds =
      user.role === 'teacher'
        ? getTeacherAssignedCourseIds(user, db.courses, db.instructors, db.batches)
        : new Set<string>();
    const announcements = db.announcements.filter(
      (a) => approvedIds.has(a.courseId) || teacherIds.has(a.courseId)
    );
    res.json({ announcements });
  });

  router.post(
    '/api/portal/courses/:courseId/announcements',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const course = db.courses.find((c) => c.id === req.params.courseId);
      if (!course) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to post announcements for this course.' });
        return;
      }
      const title = String(req.body?.title ?? '').trim().slice(0, 160);
      const message = String(req.body?.message ?? '').trim().slice(0, 2000);
      if (!title || !message) {
        res.status(400).json({ error: 'Announcement title and message are required.' });
        return;
      }
      const announcement: CourseAnnouncement = {
        id: `ann-${Date.now()}`,
        courseId: course.id,
        batchId: req.body?.batchId ? String(req.body.batchId) : null,
        title,
        message,
        pinned: Boolean(req.body?.pinned),
        postedByUserId: actor.id,
        postedByName: actor.name,
        createdAt: new Date().toISOString(),
      };
      db.announcements.unshift(announcement);
      recordAuditLog(db, actor, 'ANNOUNCEMENT_CREATE', course.title, announcement.title);
      saveDb(db);
      res.status(201).json({ announcement });
    }
  );

  router.delete(
    '/api/portal/announcements/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.announcements.findIndex((a) => a.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Announcement not found' });
        return;
      }
      const ann = db.announcements[idx];
      const course = db.courses.find((c) => c.id === ann.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to delete this announcement.' });
        return;
      }
      db.announcements.splice(idx, 1);
      saveDb(db);
      res.json({ deletedId: ann.id });
    }
  );

  // ---------------- VERIFIED STUDENT COURSE REVIEWS ----------------

  router.post('/api/courses/:id/reviews', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const course = db.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const approvedEnrollment = db.enrollments.find(
      (e) => e.userId === user.id && e.courseId === course.id && e.status === 'approved'
    );
    if (!approvedEnrollment && user.role !== 'admin') {
      res.status(403).json({
        error: 'Verified enrollment in this course is required before leaving a review.',
      });
      return;
    }

    const text = String(req.body?.text ?? '').trim().slice(0, 800);
    const rating = Math.min(5, Math.max(1, Math.round(Number(req.body?.rating) || 5)));
    if (text.length < 6) {
      res.status(400).json({ error: 'Please write at least 6 characters for your course review.' });
      return;
    }

    const existingIdx = db.reviews.findIndex(
      (r) => r.courseId === course.id && r.userId === user.id
    );
    const review: Review = {
      id: existingIdx >= 0 ? db.reviews[existingIdx].id : `rev-${Date.now()}`,
      name: user.name,
      roleLabel: `Verified Student · ${course.levelTag}`,
      text,
      rating,
      row: 1,
      status: 'approved',
      featured: false,
      courseTag: course.levelTag,
      courseId: course.id,
      userId: user.id,
      verified: true,
      createdAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.reviews[existingIdx] = review;
    } else {
      db.reviews.unshift(review);
    }
    recordAuditLog(db, user, 'COURSE_REVIEW_SUBMIT', course.title, `${rating}★ by ${user.name}`);
    saveDb(db);
    res.status(201).json({ review });
  });

  // ---------------- CERTIFICATES & PUBLIC VERIFICATION ----------------

  router.get('/api/learn/certificates', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const myCertificates = db.certificates.filter((c) => c.userId === user.id && !c.revoked);
    const myEnrollments = db.enrollments.filter((e) => e.userId === user.id && e.status === 'approved');

    const eligibilityByCourse: Record<
      string,
      ReturnType<typeof computeCourseCompletionStatus>
    > = {};
    for (const enr of myEnrollments) {
      const course = db.courses.find((c) => c.id === enr.courseId);
      if (!course) continue;
      eligibilityByCourse[course.id] = computeCourseCompletionStatus({
        course,
        lessons: db.lessons,
        enrollment: enr,
        exams: db.exams,
        examAttempts: db.examAttempts,
        assignments: db.assignments,
        submissions: db.assignmentSubmissions,
      });
    }

    res.json({ certificates: myCertificates, eligibilityByCourse });
  });

  router.post('/api/learn/courses/:id/claim-certificate', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const course = db.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'Course not found.' });
      return;
    }

    const enrollment = db.enrollments.find(
      (e) => e.userId === user.id && e.courseId === course.id && e.status === 'approved'
    );
    const evaluation = computeCourseCompletionStatus({
      course,
      lessons: db.lessons,
      enrollment,
      exams: db.exams,
      examAttempts: db.examAttempts,
      assignments: db.assignments,
      submissions: db.assignmentSubmissions,
    });

    if (!evaluation.eligibleForCertificate) {
      res.status(400).json({
        error:
          evaluation.unmetRequirements[0] ||
          'Course completion requirements are not yet met for a certificate.',
        unmetRequirements: evaluation.unmetRequirements,
        evaluation,
      });
      return;
    }

    const existing = db.certificates.find(
      (c) => c.courseId === course.id && c.userId === user.id && !c.revoked
    );
    if (existing) {
      res.json({ certificate: existing, evaluation });
      return;
    }

    const leadInstructor = db.instructors.find((i) => (course.instructorIds ?? []).includes(i.id));
    let certNo = generateCertificateNumber(course.id, user.id);
    while (db.certificates.some((c) => c.certificateNumber === certNo)) {
      certNo = generateCertificateNumber(course.id, user.id);
    }

    const certificate: CourseCertificate = {
      id: `cert-${Date.now()}`,
      certificateNumber: certNo,
      courseId: course.id,
      courseTitle: course.title,
      courseSlug: course.slug,
      userId: user.id,
      studentName: user.name,
      studentEmail: user.email,
      rollNumber: user.rollNumber,
      completionPercent: evaluation.progressPercent,
      examScorePercent: evaluation.bestExamPercent || undefined,
      instructorName: leadInstructor?.name || 'Alomgir Hossain',
      issuedAt: new Date().toISOString(),
      revoked: false,
    };

    db.certificates.unshift(certificate);
    recordAuditLog(
      db,
      user,
      'CERTIFICATE_ISSUE',
      course.title,
      `${certificate.certificateNumber} (${evaluation.progressPercent}%)`
    );
    saveDb(db);
    res.status(201).json({ certificate, evaluation });
  });

  router.get(
    '/api/portal/certificates',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      if (actor.role === 'teacher') {
        const assignedIds = getTeacherAssignedCourseIds(
          actor,
          db.courses,
          db.instructors,
          db.batches
        );
        res.json({
          certificates: db.certificates.filter((c) => assignedIds.has(c.courseId)),
        });
        return;
      }
      res.json({ certificates: db.certificates });
    }
  );

  router.patch(
    '/api/portal/certificates/:id/revoke',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const cert = db.certificates.find((c) => c.id === req.params.id);
      if (!cert) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
      cert.revoked = typeof req.body?.revoked === 'boolean' ? req.body.revoked : !cert.revoked;
      recordAuditLog(
        db,
        req.authUser!,
        'CERTIFICATE_REVOKE',
        cert.certificateNumber,
        cert.revoked ? 'Revoked' : 'Reinstated'
      );
      saveDb(db);
      res.json({ certificate: cert });
    }
  );

  router.get('/api/public/certificates/verify/:certNo', (req, res) => {
    const rateCheck = consumePublicRateLimit(
      `public-cert:${getClientIp(req)}`,
      30,
      5 * 60 * 1000
    );
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      res.status(429).json({
        error: `Too many certificate verification checks. Please try again in ${rateCheck.retryAfterSeconds}s.`,
      });
      return;
    }
    const rawNo = String(req.params.certNo ?? '').trim().toUpperCase();
    if (!rawNo) {
      res.status(400).json({ error: 'Certificate number is required.' });
      return;
    }
    const db = getDb();
    const certificate = db.certificates.find(
      (c) => c.certificateNumber.toUpperCase() === rawNo
    );
    if (!certificate) {
      res.status(404).json({ error: `No certificate found matching "${rawNo}".` });
      return;
    }
    res.json({
      valid: !certificate.revoked,
      certificate: sanitizePublicCertificate(certificate),
    });
  });

  // Public SEO JSON-LD helper endpoint (optional direct fetch)
  router.get('/api/public/courses/:slug/seo', (req, res) => {
    const db = getDb();
    const course = db.courses.find((c) => c.slug === req.params.slug);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const instructors = db.instructors.filter((i) => course.instructorIds.includes(i.id));
    res.json({
      jsonLd: buildCourseJsonLd(course, instructors, db.reviews),
    });
  });

  return router;
}
