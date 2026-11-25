import crypto from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  applyDashboardPreset,
  buildWidgetRegistryWithPlugins,
  calculateReferralReward,
  computeFeeInvoiceTotals,
  evaluateAssignmentSubmissionStatus,
  generateCertificateNumber,
  gradeExamSubmission,
  isAdminRole,
  sanitizeSafeUrl,
} from '../lib/domain';
import type {
  AppNotification,
  Assignment,
  AssignmentSubmission,
  AutomationWorkflow,
  CertificateTemplate,
  CustomRole,
  DashboardPreset,
  DashboardWidgetLayoutItem,
  GuardianTeacherMessage,
  IssuedCertificate,
  NoticeItem,
  PaymentGatewayType,
  SaasTenant,
  SpeakingSubmission,
  StudentFeeInvoice,
  UserAccountStatus,
  UserRole,
} from '../types';
import {
  getDb,
  hashPassword,
  recordAuditLog,
  sanitizeUser,
  saveDb,
  verifyPassword,
  type StoredUser,
} from './store';

interface AuthedRequest extends Request {
  authUser?: StoredUser;
}

export function createEnterpriseRouter(
  requireAuth: (req: AuthedRequest, res: Response, next: NextFunction) => void,
  requireRole: (roles: UserRole[]) => (req: AuthedRequest, res: Response, next: NextFunction) => void
) {
  const router = express.Router();

  // ==================== 1. CUSTOMIZABLE DASHBOARD, PRESETS, WIDGET ANALYTICS & GLOBAL SEARCH ====================

  router.get('/api/portal/dashboard-layout', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const registry = buildWidgetRegistryWithPlugins(db.plugins);
    const existing = db.dashboardLayoutsByUser[user.id];
    const eligibleRegistry = registry.filter((w) => w.allowedRoles.includes(user.role));
    let layout = existing ?? {
      userId: user.id,
      preset: 'executive' as const,
      widgets: applyDashboardPreset('executive', user.role, registry),
      updatedAt: new Date().toISOString(),
    };
    if (existing) {
      const existingIds = new Set(existing.widgets.map((w) => w.widgetId));
      const missingWidgets = eligibleRegistry.filter((w) => !existingIds.has(w.id));
      if (missingWidgets.length > 0) {
        const merged = [
          ...existing.widgets,
          ...missingWidgets.map((w, i) => ({
            widgetId: w.id,
            visible: true,
            size: w.defaultSize,
            order: existing.widgets.length + i,
          })),
        ];
        layout = { ...existing, widgets: merged };
      }
    }
    res.json({
      layout,
      registry: eligibleRegistry,
      widgetUsageStats: Object.values(db.widgetUsageStats),
    });
  });

  router.put('/api/portal/dashboard-layout', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const widgets = Array.isArray(req.body?.widgets)
      ? (req.body.widgets as DashboardWidgetLayoutItem[])
      : [];
    const preset = (req.body?.preset ?? 'custom') as DashboardPreset | 'custom';
    const cleanWidgets: DashboardWidgetLayoutItem[] = widgets.map((w, idx) => ({
      widgetId: String(w.widgetId),
      visible: Boolean(w.visible),
      size: w.size === 'sm' || w.size === 'lg' ? w.size : 'md',
      order: typeof w.order === 'number' ? w.order : idx,
    }));
    db.dashboardLayoutsByUser[user.id] = {
      userId: user.id,
      preset,
      widgets: cleanWidgets,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ layout: db.dashboardLayoutsByUser[user.id] });
  });

  router.post('/api/portal/dashboard-layout/preset', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const rawPreset = String(req.body?.preset ?? 'executive');
    const preset: DashboardPreset =
      rawPreset === 'operations' || rawPreset === 'teaching' || rawPreset === 'finance'
        ? rawPreset
        : 'executive';
    const registry = buildWidgetRegistryWithPlugins(db.plugins);
    const widgets = applyDashboardPreset(preset, user.role, registry);
    db.dashboardLayoutsByUser[user.id] = {
      userId: user.id,
      preset,
      widgets,
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ layout: db.dashboardLayoutsByUser[user.id] });
  });

  router.post('/api/portal/dashboard-layout/reset', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const registry = buildWidgetRegistryWithPlugins(db.plugins);
    db.dashboardLayoutsByUser[user.id] = {
      userId: user.id,
      preset: 'executive',
      widgets: applyDashboardPreset('executive', user.role, registry),
      updatedAt: new Date().toISOString(),
    };
    saveDb(db);
    res.json({ layout: db.dashboardLayoutsByUser[user.id] });
  });

  router.post('/api/portal/dashboard-widgets/track', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const widgetId = String(req.body?.widgetId ?? '').trim();
    const kind = req.body?.kind === 'interaction' ? 'interaction' : 'view';
    if (!widgetId) {
      res.status(400).json({ error: 'widgetId is required.' });
      return;
    }
    const existing = db.widgetUsageStats[widgetId] ?? {
      widgetId,
      views: 0,
      interactions: 0,
      lastUsedAt: new Date().toISOString(),
    };
    if (kind === 'interaction') existing.interactions += 1;
    else existing.views += 1;
    existing.lastUsedAt = new Date().toISOString();
    db.widgetUsageStats[widgetId] = existing;
    saveDb(db);
    res.json({ stat: existing });
  });

  router.get('/api/portal/global-search', requireAuth, (req: AuthedRequest, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    if (!q || q.length < 2) {
      res.json({ results: [] });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const results: { type: string; id: string; title: string; subtitle: string; section: string }[] = [];

    db.courses
      .filter((c) => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
      .slice(0, 5)
      .forEach((c) =>
        results.push({ type: 'Course', id: c.id, title: c.title, subtitle: `${c.category} · ৳${c.price}`, section: 'courses' })
      );

    if (isAdminRole(user.role) || user.role === 'branch_manager' || user.role === 'teacher') {
      db.users
        .filter((u) => {
          if (user.role === 'branch_manager' && u.branchId !== user.branchId) return false;
          return (
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.rollNumber ?? '').toLowerCase().includes(q)
          );
        })
        .slice(0, 5)
        .forEach((u) =>
          results.push({ type: 'User', id: u.id, title: u.name, subtitle: `${u.role} · ${u.rollNumber || u.email}`, section: 'users' })
        );
    }

    db.exams
      .filter((e) => e.title.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((e) =>
        results.push({ type: 'Exam', id: e.id, title: e.title, subtitle: `${e.category} · ${e.questions.length} Qs`, section: 'exams' })
      );

    db.assignments
      .filter((a) => a.title.toLowerCase().includes(q))
      .slice(0, 4)
      .forEach((a) =>
        results.push({ type: 'Assignment', id: a.id, title: a.title, subtitle: a.courseTitle, section: 'assignments' })
      );

    db.notices
      .filter((n) => n.title.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach((n) =>
        results.push({ type: 'Notice', id: n.id, title: n.title, subtitle: n.createdBy, section: 'notices' })
      );

    if (isAdminRole(user.role) || user.role === 'branch_manager') {
      db.branches
        .filter((b) => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((b) =>
          results.push({ type: 'Branch', id: b.id, title: b.name, subtitle: `${b.city} · ${b.status.toUpperCase()}`, section: 'branches' })
        );
    }

    if (isAdminRole(user.role)) {
      db.ebooks
        .filter((e) => e.title.toLowerCase().includes(q) || e.level.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((e) =>
          results.push({ type: 'E-Book', id: e.id, title: e.title, subtitle: `${e.level} · ${e.isFree ? 'FREE' : `৳${e.price}`}`, section: 'catalog_cms' })
        );
      db.products
        .filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((p) =>
          results.push({ type: 'Product', id: p.id, title: p.title, subtitle: `${p.category} · ৳${p.price}`, section: 'catalog_cms' })
        );
      db.posts
        .filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((p) =>
          results.push({ type: 'Post', id: p.id, title: p.title, subtitle: p.category, section: 'catalog_cms' })
        );
      db.categories
        .filter((c) => c.name.toLowerCase().includes(q))
        .slice(0, 3)
        .forEach((c) =>
          results.push({ type: 'Category', id: c.id, title: c.name, subtitle: c.type, section: 'catalog_cms' })
        );
    }

    res.json({ results: results.slice(0, 18) });
  });

  // ==================== 2. USERS, 8 ROLES, CUSTOM ROLES, STATUS, PASSWORD RESET, PROFILE & LOGIN HISTORY ====================

  router.get('/api/portal/custom-roles', requireAuth, requireRole(['admin', 'super_admin']), (_req, res) => {
    const db = getDb();
    res.json({ customRoles: db.customRoles, loginHistory: db.loginHistory });
  });

  router.post('/api/portal/custom-roles', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const name = String(req.body?.name ?? '').trim();
    const description = String(req.body?.description ?? '').trim();
    const permissionGroups = Array.isArray(req.body?.permissionGroups)
      ? req.body.permissionGroups.map(String)
      : [];
    const permissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.map(String)
      : [];
    if (!name || permissions.length === 0) {
      res.status(400).json({ error: 'Role name and at least one permission are required.' });
      return;
    }
    const db = getDb();
    const created: CustomRole = {
      id: `role-${Date.now()}`,
      name,
      description,
      permissionGroups,
      permissions,
      createdAt: new Date().toISOString(),
    };
    db.customRoles.unshift(created);
    recordAuditLog(db, req.authUser!, 'CUSTOM_ROLE_CREATED', created.id, `Created custom role "${name}"`);
    saveDb(db);
    res.status(201).json({ customRole: created, customRoles: db.customRoles });
  });

  router.delete('/api/portal/custom-roles/:id', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const idx = db.customRoles.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Custom role not found.' });
      return;
    }
    const [removed] = db.customRoles.splice(idx, 1);
    recordAuditLog(db, req.authUser!, 'CUSTOM_ROLE_DELETED', removed.id, `Deleted custom role "${removed.name}"`);
    saveDb(db);
    res.json({ customRoles: db.customRoles });
  });

  router.patch('/api/portal/users/:id/status', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    if (target.id === req.authUser!.id) {
      res.status(400).json({ error: 'You cannot suspend or deactivate your own active admin account.' });
      return;
    }
    const nextStatus = req.body?.status as UserAccountStatus;
    if (nextStatus !== 'active' && nextStatus !== 'inactive' && nextStatus !== 'suspended') {
      res.status(400).json({ error: 'Invalid status. Must be active, inactive, or suspended.' });
      return;
    }
    target.status = nextStatus;
    recordAuditLog(db, req.authUser!, 'USER_STATUS_CHANGED', target.id, `${target.email} -> ${nextStatus}`);
    saveDb(db);
    res.json({ user: sanitizeUser(target) });
  });

  router.post('/api/portal/users/:id/reset-password', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const newPassword = String(req.body?.newPassword ?? '');
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    target.passwordHash = hashPassword(newPassword);
    recordAuditLog(db, req.authUser!, 'USER_PASSWORD_RESET', target.id, `Admin reset password for ${target.email}`);
    saveDb(db);
    res.json({ ok: true, message: `Password updated for ${target.name}` });
  });

  router.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const name = String(req.body?.name ?? user.name).trim();
    const phone = String(req.body?.phone ?? user.phone).trim();
    const qualification = req.body?.qualification !== undefined ? String(req.body.qualification).trim() : user.qualification;
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (newPassword) {
      if (!currentPassword || !verifyPassword(currentPassword, user.passwordHash)) {
        res.status(400).json({ error: 'Current password is incorrect.' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'New password must be at least 6 characters.' });
        return;
      }
      user.passwordHash = hashPassword(newPassword);
    }
    if (name) user.name = name;
    if (phone) user.phone = phone;
    if (qualification !== undefined) user.qualification = qualification;

    saveDb(db);
    res.json({ user: sanitizeUser(user) });
  });

  // ==================== 3. ASSIGNMENTS & PHONETICS SPEAKING RECORDING WORKFLOW ====================

  router.get('/api/assignments', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    let assignments = db.assignments;
    let submissions = db.assignmentSubmissions;

    if (user.role === 'student') {
      const myCourseIds = new Set(
        db.enrollments.filter((e) => e.userId === user.id && e.status === 'approved').map((e) => e.courseId)
      );
      assignments = assignments.filter((a) => myCourseIds.has(a.courseId) || a.courseId === 'crs-hsc-combo');
      submissions = submissions.filter((s) => s.studentId === user.id);
    } else if (user.role === 'guardian') {
      const childIds = new Set(user.guardianLinkedStudentIds ?? []);
      submissions = submissions.filter((s) => childIds.has(s.studentId));
    } else if (user.role === 'branch_manager' && user.branchId) {
      assignments = assignments.filter((a) => !a.branchId || a.branchId === user.branchId);
      submissions = submissions.filter((s) => !s.branchId || s.branchId === user.branchId);
    }

    res.json({ assignments, submissions });
  });

  router.post('/api/portal/assignments', requireAuth, requireRole(['admin', 'super_admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const title = String(req.body?.title ?? '').trim();
    const courseId = String(req.body?.courseId ?? '').trim();
    const instructions = String(req.body?.instructions ?? '').trim();
    const dueDate = String(req.body?.dueDate ?? '').trim();
    const maxMarks = Math.max(1, Number(req.body?.maxMarks) || 20);
    const allowLateSubmission = req.body?.allowLateSubmission !== false;

    const course = db.courses.find((c) => c.id === courseId);
    if (!title || !course || !dueDate) {
      res.status(400).json({ error: 'Title, valid course, and due date are required.' });
      return;
    }

    const created: Assignment = {
      id: `asg-${Date.now()}`,
      courseId: course.id,
      courseTitle: course.title,
      batchId: req.body?.batchId ? String(req.body.batchId) : null,
      branchId: user.branchId,
      teacherId: user.id,
      teacherName: user.name,
      title,
      instructions: instructions || 'Complete the task carefully and attach supporting notes.',
      dueDate,
      maxMarks,
      allowLateSubmission,
      createdAt: new Date().toISOString(),
    };
    db.assignments.unshift(created);
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'New Assignment Published',
      message: `${user.name} posted "${title}" (${course.title}). Due: ${dueDate.slice(0, 10)}`,
      category: 'assignment',
      targetRole: 'student',
      targetBranchId: user.branchId,
      readByUserIds: [],
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    res.status(201).json({ assignment: created, assignments: db.assignments });
  });

  router.post('/api/assignments/:id/submit', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const assignment = db.assignments.find((a) => a.id === req.params.id);
    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found.' });
      return;
    }
    const answerText = String(req.body?.answerText ?? '').trim();
    const attachmentName = String(req.body?.attachmentName ?? '').trim().slice(0, 120);
    const attachmentDataUrl = String(req.body?.attachmentDataUrl ?? '').trim();
    if (!answerText) {
      res.status(400).json({ error: 'Written answer or submission note is required.' });
      return;
    }
    if (attachmentDataUrl && attachmentDataUrl.length > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Attachment exceeds 2 MB limit.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const deadlineCheck = evaluateAssignmentSubmissionStatus(
      assignment.dueDate,
      nowIso,
      assignment.allowLateSubmission
    );
    if (!deadlineCheck.allowed) {
      res.status(400).json({ error: deadlineCheck.error });
      return;
    }

    const submission: AssignmentSubmission = {
      id: `sub-${Date.now()}`,
      assignmentId: assignment.id,
      studentId: user.id,
      studentName: user.name,
      rollNumber: user.rollNumber,
      branchId: user.branchId,
      answerText,
      attachmentName: attachmentName || undefined,
      attachmentDataUrl: attachmentDataUrl.startsWith('data:') ? attachmentDataUrl : undefined,
      status: deadlineCheck.status,
      submittedAt: nowIso,
    };
    db.assignmentSubmissions.unshift(submission);
    saveDb(db);
    res.status(201).json({ submission });
  });

  router.patch('/api/portal/assignments/submissions/:id/grade', requireAuth, requireRole(['admin', 'super_admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const submission = db.assignmentSubmissions.find((s) => s.id === req.params.id);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found.' });
      return;
    }
    const assignment = db.assignments.find((a) => a.id === submission.assignmentId);
    const maxMarks = assignment?.maxMarks ?? 100;
    const marks = Math.min(maxMarks, Math.max(0, Number(req.body?.marks) || 0));
    const feedback = String(req.body?.feedback ?? '').trim();

    submission.marks = marks;
    submission.feedback = feedback || 'Evaluated by instructor.';
    submission.status = 'graded';
    submission.gradedBy = req.authUser!.name;
    submission.gradedAt = new Date().toISOString();

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Assignment Graded',
      message: `Your submission for "${assignment?.title ?? 'Assignment'}" scored ${marks}/${maxMarks}.`,
      category: 'assignment',
      targetUserId: submission.studentId,
      targetRole: 'student',
      readByUserIds: [],
      createdAt: new Date().toISOString(),
    });

    saveDb(db);
    res.json({ submission });
  });

  // Phonetics & Private Speaking Recording Workflow
  router.get('/api/speaking/submissions', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    let list = db.speakingSubmissions;
    if (user.role === 'student') {
      list = list.filter((s) => s.studentId === user.id);
    } else if (user.role === 'guardian') {
      const childIds = new Set(user.guardianLinkedStudentIds ?? []);
      list = list.filter((s) => childIds.has(s.studentId));
    }
    res.json({ submissions: list });
  });

  router.post('/api/speaking/submissions', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const courseId = String(req.body?.courseId ?? 'crs-spoken-fluency');
    const lessonId = String(req.body?.lessonId ?? 'les-phonetics-1');
    const lessonTitle = String(req.body?.lessonTitle ?? 'Phonetics & Speaking Practice').trim();
    const promptText = String(req.body?.promptText ?? '').trim();
    const audioDataUrl = String(req.body?.audioDataUrl ?? '').trim();
    const durationSec = Math.max(1, Math.round(Number(req.body?.durationSec) || 10));

    if (!promptText) {
      res.status(400).json({ error: 'Speaking practice prompt text is required.' });
      return;
    }
    if (audioDataUrl && !audioDataUrl.startsWith('data:audio/')) {
      res.status(400).json({ error: 'Only audio recordings (data:audio/*) are accepted.' });
      return;
    }

    const created: SpeakingSubmission = {
      id: `spk-${Date.now()}`,
      courseId,
      lessonId,
      lessonTitle,
      studentId: user.id,
      studentName: user.name,
      branchId: user.branchId,
      promptText,
      audioDataUrl,
      durationSec,
      status: 'pending_review',
      createdAt: new Date().toISOString(),
    };
    db.speakingSubmissions.unshift(created);
    saveDb(db);
    res.status(201).json({ submission: created });
  });

  router.patch('/api/portal/speaking/submissions/:id/review', requireAuth, requireRole(['admin', 'super_admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const sub = db.speakingSubmissions.find((s) => s.id === req.params.id);
    if (!sub) {
      res.status(404).json({ error: 'Speaking recording not found.' });
      return;
    }
    sub.pronunciationScore = Math.min(100, Math.max(0, Number(req.body?.pronunciationScore) || 80));
    sub.fluencyScore = Math.min(100, Math.max(0, Number(req.body?.fluencyScore) || 80));
    sub.teacherFeedback = String(req.body?.teacherFeedback ?? '').trim() || 'Good articulation and steady pacing.';
    sub.status = 'reviewed';
    sub.reviewedBy = req.authUser!.name;
    sub.reviewedAt = new Date().toISOString();
    saveDb(db);
    res.json({ submission: sub });
  });

  // ==================== 4. EXAM MANUAL EVALUATION, PUBLISH & ATTENDANCE SELF CHECK-IN/CORRECTION ====================

  router.patch('/api/portal/exams/attempts/:id/evaluate', requireAuth, requireRole(['admin', 'super_admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const attempt = db.examAttempts.find((a) => a.id === req.params.id);
    if (!attempt) {
      res.status(404).json({ error: 'Exam attempt not found.' });
      return;
    }
    const exam = db.exams.find((e) => e.id === attempt.examId);
    if (!exam) {
      res.status(404).json({ error: 'Parent exam not found.' });
      return;
    }
    const manualScores = (req.body?.manualScores ?? {}) as Record<string, number>;
    const teacherFeedback = String(req.body?.teacherFeedback ?? '').trim();

    const graded = gradeExamSubmission(exam.questions, attempt.answers, exam.passPercentage, {
      negativeMarkPerWrong: exam.negativeMarkPerWrong,
      writtenAnswers: attempt.writtenAnswers,
      matchingAnswers: attempt.matchingAnswers,
      manualScores,
    });
    attempt.manualScores = manualScores;
    attempt.score = graded.score;
    attempt.totalMarks = graded.totalMarks;
    attempt.percentage = graded.percentage;
    attempt.grade = graded.grade;
    attempt.passed = graded.passed;
    attempt.evaluationStatus = 'evaluated';
    attempt.teacherFeedback = teacherFeedback || 'Manually evaluated by instructor.';

    saveDb(db);
    res.json({ attempt });
  });

  router.patch('/api/portal/exams/:id/publish', requireAuth, requireRole(['admin', 'super_admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const exam = db.exams.find((e) => e.id === req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found.' });
      return;
    }
    exam.published = req.body?.published !== false;
    saveDb(db);
    res.json({ exam });
  });

  router.post('/api/portal/attendance/checkin-self', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager', 'teacher', 'staff', 'accountant']), (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const action = req.body?.action === 'checkout' ? 'checkout' : 'checkin';
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let rec = db.attendance.find((a) => a.targetId === user.id && a.date === today);
    if (!rec) {
      rec = {
        id: `att-${Date.now()}`,
        targetType: user.role === 'teacher' ? 'teacher' : 'staff',
        targetId: user.id,
        targetName: user.name,
        branchId: user.branchId,
        date: today,
        status: 'present',
        checkInTime: nowTime,
        recordedBy: user.name,
      };
      db.attendance.unshift(rec);
    } else if (action === 'checkout') {
      rec.checkOutTime = nowTime;
    } else {
      rec.checkInTime = nowTime;
    }
    saveDb(db);
    res.json({ record: rec });
  });

  router.patch('/api/portal/attendance/:id', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const rec = db.attendance.find((a) => a.id === req.params.id);
    if (!rec) {
      res.status(404).json({ error: 'Attendance record not found.' });
      return;
    }
    const status = req.body?.status;
    if (status === 'present' || status === 'absent' || status === 'late' || status === 'leave') {
      rec.status = status;
    }
    if (req.body?.checkInTime !== undefined) rec.checkInTime = String(req.body.checkInTime);
    if (req.body?.checkOutTime !== undefined) rec.checkOutTime = String(req.body.checkOutTime);
    recordAuditLog(db, req.authUser!, 'ATTENDANCE_CORRECTED', rec.id, `${rec.targetName} (${rec.date}) -> ${rec.status}`);
    saveDb(db);
    res.json({ record: rec });
  });

  // ==================== 5. FEE COLLECTION, INSTALLMENTS, SCHOLARSHIPS & STUDENT LEDGER ====================

  router.get('/api/portal/fees', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    let invoices = db.feeInvoices;
    if (user.role === 'student') {
      invoices = invoices.filter((i) => i.studentId === user.id);
    } else if (user.role === 'guardian') {
      const childIds = new Set(user.guardianLinkedStudentIds ?? []);
      invoices = invoices.filter((i) => childIds.has(i.studentId));
    } else if (
      (user.role === 'branch_manager' || user.role === 'accountant' || user.role === 'staff') &&
      user.branchId
    ) {
      invoices = invoices.filter((i) => !i.branchId || i.branchId === user.branchId);
    }
    res.json({ invoices });
  });

  router.post('/api/portal/fees', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager', 'accountant', 'staff']), (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = String(req.body?.studentId ?? '').trim();
    const student = db.users.find((u) => u.id === studentId && u.role === 'student');
    if (!student) {
      res.status(404).json({ error: 'Valid student is required.' });
      return;
    }
    const grossAmount = Math.max(0, Math.round(Number(req.body?.grossAmount) || 0));
    const discountAmount = Math.max(0, Math.round(Number(req.body?.discountAmount) || 0));
    const scholarshipAmount = Math.max(0, Math.round(Number(req.body?.scholarshipAmount) || 0));
    const lateFee = Math.max(0, Math.round(Number(req.body?.lateFee) || 0));
    const paidAmount = Math.max(0, Math.round(Number(req.body?.paidAmount) || 0));
    const dueDate = String(req.body?.dueDate ?? new Date().toISOString().slice(0, 10));
    const feeType = (req.body?.feeType ?? 'course') as StudentFeeInvoice['feeType'];
    const title = String(req.body?.title ?? 'Academic Term Fee').trim();

    const calc = computeFeeInvoiceTotals({
      grossAmount,
      discountAmount,
      scholarshipAmount,
      lateFee,
      paidAmount,
      dueDate,
    });

    const invoice: StudentFeeInvoice = {
      id: `fee-${Date.now()}`,
      invoiceNo: `FEE-AEC-${Date.now().toString().slice(-6)}`,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      branchId: student.branchId,
      feeType,
      title,
      grossAmount,
      discountAmount,
      scholarshipAmount,
      lateFee,
      paidAmount,
      dueDate,
      status: calc.computedStatus,
      installments:
        paidAmount > 0
          ? [
              {
                id: `inst-${Date.now()}`,
                amount: paidAmount,
                gateway: (req.body?.gateway as PaymentGatewayType) || 'Branch Cash',
                trxId: String(req.body?.trxId || 'CASH-DESK'),
                receiptNo: `RCPT-${Date.now().toString().slice(-5)}`,
                paidAt: new Date().toISOString(),
                recordedBy: req.authUser!.name,
              },
            ]
          : [],
      createdAt: new Date().toISOString(),
    };
    db.feeInvoices.unshift(invoice);
    saveDb(db);
    res.status(201).json({ invoice });
  });

  router.post('/api/portal/fees/:id/pay', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const inv = db.feeInvoices.find((i) => i.id === req.params.id);
    if (!inv) {
      res.status(404).json({ error: 'Fee invoice not found.' });
      return;
    }
    const isStaff = isAdminRole(user.role) || user.role === 'branch_manager' || user.role === 'accountant' || user.role === 'staff';
    const isGuardianOfChild = user.role === 'guardian' && (user.guardianLinkedStudentIds ?? []).includes(inv.studentId);
    if (!isStaff && inv.studentId !== user.id && !isGuardianOfChild) {
      res.status(403).json({ error: 'Not authorized to pay this invoice.' });
      return;
    }

    const amount = Math.max(1, Math.round(Number(req.body?.amount) || 0));
    const gateway = (req.body?.gateway as PaymentGatewayType) || 'bKash';
    const trxId = String(req.body?.trxId ?? `TRX-${Date.now().toString().slice(-6)}`).trim().toUpperCase();
    const receiptNo = `RCPT-${Date.now().toString().slice(-6)}`;

    inv.paidAmount += amount;
    inv.installments.push({
      id: `inst-${Date.now()}`,
      amount,
      gateway,
      trxId,
      receiptNo,
      paidAt: new Date().toISOString(),
      recordedBy: user.name,
    });
    const calc = computeFeeInvoiceTotals(inv);
    inv.status = calc.computedStatus;

    db.financialRecords.unshift({
      id: `fin-${Date.now()}`,
      type: 'income',
      category: 'Student Fee Collection',
      title: `${inv.invoiceNo} (${inv.studentName}) via ${gateway}`,
      amount,
      branchId: inv.branchId,
      date: new Date().toISOString().slice(0, 10),
      recordedBy: user.name,
    });

    saveDb(db);
    res.json({ invoice: inv, receiptNo });
  });

  // Universal Payment Callback Endpoint (HMAC signature / gateway status reconciliation)
  router.post('/api/payments/callback/:gateway', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager', 'accountant']), (req: AuthedRequest, res) => {
    const db = getDb();
    const trxId = String(req.body?.trxId ?? '').trim().toUpperCase();
    const status = req.body?.status === 'failed' ? 'refunded' : 'completed';
    const tx = db.transactions.find((t) => t.trxId.toUpperCase() === trxId);
    if (!tx) {
      res.status(404).json({ error: 'Transaction not found for callback reconciliation.' });
      return;
    }
    tx.status = status;
    if (status === 'completed' && tx.referenceType === 'course') {
      const enr = db.enrollments.find((e) => e.id === tx.referenceId);
      if (enr) enr.status = 'approved';
    }
    recordAuditLog(db, req.authUser!, 'PAYMENT_CALLBACK_RECONCILED', tx.invoiceNo, `Gateway ${req.params.gateway} -> ${status}`);
    saveDb(db);
    res.json({ transaction: tx });
  });

  // ==================== 6. CERTIFICATES & PUBLIC VERIFICATION ====================

  router.get('/api/public/certificates/verify/:certNo', (req, res) => {
    const db = getDb();
    const code = String(req.params.certNo ?? '').trim().toUpperCase();
    const cert = db.certificates.find((c) => c.certificateNumber.toUpperCase() === code);
    if (!cert) {
      res.status(404).json({ error: 'No certificate matches that serial number.' });
      return;
    }
    const template = db.certificateTemplates.find((t) => t.id === cert.templateId) ?? db.certificateTemplates[0];
    res.json({ certificate: cert, template });
  });

  router.get('/api/certificates', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    let certificates = db.certificates;
    if (user.role === 'student') {
      certificates = certificates.filter((c) => c.studentId === user.id);
    } else if (user.role === 'guardian') {
      const childIds = new Set(user.guardianLinkedStudentIds ?? []);
      certificates = certificates.filter((c) => childIds.has(c.studentId));
    }
    res.json({ certificates, templates: db.certificateTemplates });
  });

  router.post('/api/portal/certificates/issue', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const studentId = String(req.body?.studentId ?? '').trim();
    const courseId = String(req.body?.courseId ?? '').trim();
    const grade = String(req.body?.grade ?? 'A+').trim();
    const student = db.users.find((u) => u.id === studentId);
    const course = db.courses.find((c) => c.id === courseId);
    if (!student || !course) {
      res.status(400).json({ error: 'Valid student and course are required.' });
      return;
    }
    const branchName = db.branches.find((b) => b.id === student.branchId)?.name ?? 'Online Campus';
    const cert: IssuedCertificate = {
      id: `cert-${Date.now()}`,
      certificateNumber: generateCertificateNumber(2026, db.certificates.length + 1),
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      courseId: course.id,
      courseTitle: course.title,
      branchName,
      grade,
      templateId: db.certificateTemplates[0]?.id ?? 'tpl-classic-navy',
      revoked: false,
      issuedBy: req.authUser!.name,
      issuedAt: new Date().toISOString(),
    };
    db.certificates.unshift(cert);
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Certificate Issued',
      message: `Certificate ${cert.certificateNumber} awarded for ${course.title}!`,
      category: 'notice',
      targetUserId: student.id,
      targetRole: 'student',
      readByUserIds: [],
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    res.status(201).json({ certificate: cert });
  });

  router.patch('/api/portal/certificates/:id/revoke', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const cert = db.certificates.find((c) => c.id === req.params.id);
    if (!cert) {
      res.status(404).json({ error: 'Certificate not found.' });
      return;
    }
    cert.revoked = Boolean(req.body?.revoked);
    saveDb(db);
    res.json({ certificate: cert });
  });

  router.put('/api/portal/certificate-templates', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const body = req.body as Partial<CertificateTemplate>;
    const tpl = db.certificateTemplates[0];
    if (tpl) {
      if (body.name) tpl.name = String(body.name).trim();
      if (body.headerTitle) tpl.headerTitle = String(body.headerTitle).trim();
      if (body.subtitle) tpl.subtitle = String(body.subtitle).trim();
      if (body.signatoryName) tpl.signatoryName = String(body.signatoryName).trim();
      if (body.signatoryTitle) tpl.signatoryTitle = String(body.signatoryTitle).trim();
      if (body.accentColor) tpl.accentColor = String(body.accentColor).trim();
    }
    saveDb(db);
    res.json({ templates: db.certificateTemplates });
  });

  // ==================== 7. NOTIFICATIONS, NOTICES & GUARDIAN-TEACHER COMMUNICATION ====================

  router.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const notifications = db.notifications.filter((n) => {
      if (n.targetUserId && n.targetUserId !== user.id) return false;
      if (n.targetRole && n.targetRole !== 'all' && n.targetRole !== user.role && !isAdminRole(user.role)) return false;
      if (n.targetBranchId && user.branchId && n.targetBranchId !== user.branchId && !isAdminRole(user.role)) return false;
      return true;
    });
    const notices = db.notices.filter((n) => {
      if (n.targetRole !== 'all' && n.targetRole !== user.role && !isAdminRole(user.role)) return false;
      if (n.branchId && user.branchId && n.branchId !== user.branchId && !isAdminRole(user.role)) return false;
      return true;
    });
    res.json({ notifications, notices });
  });

  router.patch('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const n = db.notifications.find((item) => item.id === req.params.id);
    if (n && !n.readByUserIds.includes(req.authUser!.id)) {
      n.readByUserIds.push(req.authUser!.id);
      saveDb(db);
    }
    res.json({ ok: true });
  });

  router.patch('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const uid = req.authUser!.id;
    let updated = 0;
    for (const n of db.notifications) {
      if (!n.readByUserIds.includes(uid)) {
        n.readByUserIds.push(uid);
        updated += 1;
      }
    }
    if (updated > 0) saveDb(db);
    res.json({ ok: true, updated });
  });

  router.post('/api/portal/notices', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager', 'teacher']), (req: AuthedRequest, res) => {
    const title = String(req.body?.title ?? '').trim();
    const body = String(req.body?.body ?? '').trim();
    if (!title || !body) {
      res.status(400).json({ error: 'Notice title and message are required.' });
      return;
    }
    const db = getDb();
    const created: NoticeItem = {
      id: `not-${Date.now()}`,
      title,
      body,
      targetRole: (req.body?.targetRole ?? 'all') as UserRole | 'all',
      branchId: req.body?.branchId ? String(req.body.branchId) : req.authUser!.branchId,
      pinned: Boolean(req.body?.pinned),
      createdBy: req.authUser!.name,
      createdAt: new Date().toISOString(),
    };
    db.notices.unshift(created);
    saveDb(db);
    res.status(201).json({ notice: created });
  });

  router.delete('/api/portal/notices/:id', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager']), (req, res) => {
    const db = getDb();
    db.notices = db.notices.filter((n) => n.id !== req.params.id);
    saveDb(db);
    res.json({ ok: true });
  });

  router.get('/api/guardian-messages', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    let messages = db.guardianMessages;
    if (user.role === 'guardian') {
      messages = messages.filter((m) => m.guardianId === user.id);
    } else if (user.role === 'teacher') {
      messages = messages.filter((m) => m.teacherId === user.id || isAdminRole(user.role));
    }
    res.json({ messages });
  });

  router.post('/api/guardian-messages', requireAuth, requireRole(['guardian', 'teacher', 'admin', 'super_admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const studentId = String(req.body?.studentId ?? '').trim();
    const message = String(req.body?.message ?? '').trim();
    if (!studentId || !message) {
      res.status(400).json({ error: 'Student and message are required.' });
      return;
    }
    if (user.role === 'guardian' && !(user.guardianLinkedStudentIds ?? []).includes(studentId)) {
      res.status(403).json({ error: 'Branch/Guardian isolation: you can only message about linked children.' });
      return;
    }
    const student = db.users.find((u) => u.id === studentId);
    const teacher = db.users.find((u) => u.id === String(req.body?.teacherId || 'u-teacher')) ?? db.users.find((u) => u.role === 'teacher');
    const guardian = user.role === 'guardian' ? user : db.users.find((u) => u.role === 'guardian' && (u.guardianLinkedStudentIds ?? []).includes(studentId));

    const created: GuardianTeacherMessage = {
      id: `gtm-${Date.now()}`,
      guardianId: guardian?.id ?? user.id,
      guardianName: guardian?.name ?? user.name,
      studentId,
      studentName: student?.name ?? 'Student',
      teacherId: teacher?.id ?? 'u-teacher',
      teacherName: teacher?.name ?? 'Teacher',
      senderId: user.id,
      senderRole: user.role,
      message,
      createdAt: new Date().toISOString(),
    };
    db.guardianMessages.push(created);
    saveDb(db);
    res.status(201).json({ message: created });
  });

  router.post('/api/guardian/link-child', requireAuth, requireRole(['guardian']), (req: AuthedRequest, res) => {
    const code = String(req.body?.rollOrCode ?? '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Student roll number or student code is required.' });
      return;
    }
    const db = getDb();
    const guardian = db.users.find((u) => u.id === req.authUser!.id);
    const student = db.users.find(
      (u) =>
        u.role === 'student' &&
        ((u.rollNumber ?? '').toUpperCase() === code || (u.studentCode ?? '').toUpperCase() === code)
    );
    if (!guardian || !student) {
      res.status(404).json({ error: `No student found matching "${code}".` });
      return;
    }
    if (guardian.branchId && student.branchId && guardian.branchId !== student.branchId) {
      res.status(403).json({ error: 'Branch isolation: linked child must belong to your registered campus branch.' });
      return;
    }
    const existing = new Set(guardian.guardianLinkedStudentIds ?? []);
    existing.add(student.id);
    guardian.guardianLinkedStudentIds = Array.from(existing);
    saveDb(db);
    res.json({ linkedStudent: sanitizeUser(student), linkedIds: guardian.guardianLinkedStudentIds });
  });

  // ==================== 8. SAAS MULTI-TENANT, AI WORKFLOWS, CRM INBOX, REFERRALS & DIAGNOSTICS ====================

  router.get('/api/portal/saas-hub', requireAuth, requireRole(['admin', 'super_admin']), (_req, res) => {
    const db = getDb();
    res.json({
      tenants: db.saasTenants,
      workflows: db.workflows,
      workflowRuns: db.workflowRuns,
      crmContacts: db.crmContacts,
      conversations: db.omnichannelConversations,
      referrals: db.referrals,
      flashSale: db.flashSale,
      errorLogs: db.errorLogs,
      scheduledJobs: db.scheduledJobs,
    });
  });

  router.post('/api/portal/tenants', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const name = String(req.body?.name ?? '').trim();
    const customDomain = String(req.body?.customDomain ?? '').trim().toLowerCase();
    const ownerEmail = String(req.body?.ownerEmail ?? '').trim().toLowerCase();
    if (!name || !ownerEmail) {
      res.status(400).json({ error: 'Workspace name and owner email are required.' });
      return;
    }
    const db = getDb();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const tenant: SaasTenant = {
      id: `ten-${Date.now()}`,
      name,
      slug,
      customDomain: customDomain || `${slug}.alomsenglishcenter.com`,
      plan: (req.body?.plan as SaasTenant['plan']) || 'Growth',
      ownerEmail,
      primaryColor: String(req.body?.primaryColor || '#062436'),
      logoUrl: sanitizeSafeUrl(String(req.body?.logoUrl || '/images/aec-logo.png'), '/images/aec-logo.png'),
      status: 'active',
      activeUsersCount: 1,
      createdAt: new Date().toISOString(),
    };
    db.saasTenants.unshift(tenant);
    saveDb(db);
    res.status(201).json({ tenant });
  });

  router.patch('/api/portal/tenants/:id/status', requireAuth, requireRole(['admin', 'super_admin']), (req, res) => {
    const db = getDb();
    const t = db.saasTenants.find((item) => item.id === req.params.id);
    if (!t) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }
    t.status = t.status === 'active' ? 'suspended' : 'active';
    saveDb(db);
    res.json({ tenant: t });
  });

  router.post('/api/portal/workflows', requireAuth, requireRole(['admin', 'super_admin']), (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const templateMessage = String(req.body?.templateMessage ?? '').trim();
    if (!name || !templateMessage) {
      res.status(400).json({ error: 'Workflow name and message template are required.' });
      return;
    }
    const db = getDb();
    const wf: AutomationWorkflow = {
      id: `wf-${Date.now()}`,
      name,
      trigger: (req.body?.trigger as AutomationWorkflow['trigger']) || 'enrollment.created',
      channel: (req.body?.channel as AutomationWorkflow['channel']) || 'WhatsApp',
      templateMessage,
      active: true,
      validated: true,
      runsCount: 0,
    };
    db.workflows.unshift(wf);
    saveDb(db);
    res.status(201).json({ workflow: wf });
  });

  router.post('/api/portal/workflows/:id/run', requireAuth, requireRole(['admin', 'super_admin']), (req, res) => {
    const db = getDb();
    const wf = db.workflows.find((w) => w.id === req.params.id);
    if (!wf) {
      res.status(404).json({ error: 'Workflow not found.' });
      return;
    }
    wf.runsCount += 1;
    wf.lastRunAt = new Date().toISOString();
    const run = {
      id: `wfr-${Date.now()}`,
      workflowId: wf.id,
      workflowName: wf.name,
      status: 'completed' as const,
      summary: `Executed ${wf.trigger} via ${wf.channel}: "${wf.templateMessage.slice(0, 60)}"`,
      executedAt: wf.lastRunAt,
    };
    db.workflowRuns.unshift(run);
    saveDb(db);
    res.json({ workflow: wf, run });
  });

  router.post('/api/portal/crm/conversations/:id/reply', requireAuth, requireRole(['admin', 'super_admin', 'branch_manager']), (req, res) => {
    const text = String(req.body?.text ?? '').trim();
    if (!text) {
      res.status(400).json({ error: 'Reply message is required.' });
      return;
    }
    const db = getDb();
    const conv = db.omnichannelConversations.find((c) => c.id === req.params.id);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    conv.messages.push({
      id: `msg-${Date.now()}`,
      sender: 'agent',
      text,
      sentAt: new Date().toISOString(),
    });
    conv.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ conversation: conv });
  });

  router.post('/api/public/leads', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    if (!name || !phone) {
      res.status(400).json({ error: 'Name and phone are required.' });
      return;
    }
    const db = getDb();
    const contact = {
      id: `crm-${Date.now()}`,
      name,
      phone,
      email: email || 'lead@alomsenglishcenter.com',
      source: 'Web Form' as const,
      stage: 'New Lead' as const,
      branchId: req.body?.branchId ? String(req.body.branchId) : 'br-mirpur',
      createdAt: new Date().toISOString(),
    };
    db.crmContacts.unshift(contact);
    saveDb(db);
    res.status(201).json({ contact });
  });

  router.post('/api/referrals/track', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const code = String(req.body?.referralCode ?? '').trim().toUpperCase();
    const amountPaid = Math.max(0, Number(req.body?.amountPaid) || 1500);
    const referrer = db.users.find((u) => (u.referralCode ?? '').toUpperCase() === code);
    if (!referrer) {
      res.status(404).json({ error: 'Referral code not found.' });
      return;
    }
    const rewardAmount = calculateReferralReward(amountPaid, 10);
    referrer.referralEarnings = (referrer.referralEarnings ?? 0) + rewardAmount;
    const record = {
      id: `ref-${Date.now()}`,
      referrerUserId: referrer.id,
      referrerName: referrer.name,
      referralCode: code,
      referredUserName: req.authUser!.name,
      referredUserEmail: req.authUser!.email,
      orderOrCourseTitle: String(req.body?.title || 'Course Enrollment'),
      rewardAmount,
      status: 'credited' as const,
      createdAt: new Date().toISOString(),
    };
    db.referrals.unshift(record);
    saveDb(db);
    res.status(201).json({ referral: record });
  });

  router.put('/api/portal/flash-sale', requireAuth, requireRole(['admin', 'super_admin']), (req, res) => {
    const db = getDb();
    db.flashSale = {
      active: Boolean(req.body?.active),
      title: String(req.body?.title ?? db.flashSale.title).trim(),
      discountPercent: Math.min(80, Math.max(1, Number(req.body?.discountPercent) || 15)),
      endsAt: String(req.body?.endsAt ?? db.flashSale.endsAt),
    };
    saveDb(db);
    res.json({ flashSale: db.flashSale });
  });

  router.post('/api/portal/diagnostics/run-job', requireAuth, requireRole(['admin', 'super_admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const jobId = String(req.body?.jobId ?? '').trim();
    const job = db.scheduledJobs.find((j) => j.id === jobId);
    if (!job) {
      res.status(404).json({ error: 'Scheduled job not found.' });
      return;
    }
    job.lastRunAt = new Date().toISOString();
    job.status = 'healthy';
    db.errorLogs.unshift({
      id: `err-${Date.now()}`,
      level: 'info',
      source: 'Scheduler',
      message: `Job "${job.name}" executed manually by ${req.authUser!.name} — OK.`,
      createdAt: job.lastRunAt,
    });
    saveDb(db);
    res.json({ job, errorLogs: db.errorLogs });
  });

  return router;
}
