import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import {
  calculateDiscountedPrice,
  calculateOrderTotal,
  computeBatchSeatUsage,
  computeHomepageStats,
  filterActivePaymentGateways,
  gradeExamSubmission,
  maskLeaderboardName,
  normalizeDashboardConfig,
  parseImageUploadDataUrl,
  sanitizeSafeUrl,
} from './src/lib/domain';
import {
  buildCourseJsonLd,
  calculateCoursePricingServerSide,
  canTeacherManageCourse,
  generateCourseSlug,
  getTeacherAssignedCourseIds,
  isCoursePubliclyListed,
  isCoursePubliclyLive,
  isCourseStatusLive,
  isLessonUnlockedForStudent,
  resolveTeacherInstructorIds,
  validateEnrollmentRequest,
} from './src/lib/courseEnterprise';
import {
  getTeacherAssignedBatches,
  redactBatchForViewer,
} from './src/lib/batchEnterprise';
import { recalculateExamAttemptGrade, validateProfileUpdate } from './src/lib/usersAndTeaching';
import { maskEmailForAudit } from './src/lib/auditLogs';
import { createAiRouter } from './src/server/aiRoutes';
import { createBatchEnterpriseRouter } from './src/server/batchEnterpriseRoutes';
import { createCourseEnterpriseRouter } from './src/server/courseEnterpriseRoutes';
import { createEnterpriseOpsRouter } from './src/server/enterpriseOpsRoutes';
import { createPlatformRouter } from './src/server/platformRoutes';
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  consumePasswordResetToken,
  createPasswordResetToken,
  createSessionRecord,
  findValidSessionByToken,
  isAdminConfiguredInDb,
  recordLoginFailure,
  revokeAllUserSessions,
  revokeSessionByToken,
} from './src/db/persistence';
import { initPostgresIfConfigured } from './src/db/postgresAdapter';
import { dispatchRealCommunication } from './src/server/communicationService';
import { assertBranchOperationalForTransactions } from './src/server/paymentService';
import {
  clearAuthSessionCookie,
  extractAuthTokenFromRequest,
  getClientIp,
  isStrongPassword,
  isValidBangladeshPhone,
  isValidRole,
  resolveSessionSecret,
  setAuthSessionCookie,
  signSessionToken,
  verifySignedSessionToken,
  verifyTotpCode,
} from './src/server/security';
import {
  createDefaultHomepageConfig,
  getDb,
  hashPassword,
  recordAuditLog,
  sanitizeUser,
  saveDb,
  verifyPassword,
  type StoredUser,
} from './src/server/store';
import {
  consumePublicRateLimit,
  deriveStudentGuardianLinkCode,
  pseudonymizeLeaderboardId,
  redactLessonForViewer,
  sanitizePublicEbook,
  sanitizePublicExamAttempt,
  sanitizePublicInstructor,
  verifyGuardianLinkCredential,
} from './src/server/publicRedaction';
import type {
  Branch,
  CertificateCriteria,
  Course,
  CourseBatch,
  CourseDeliveryType,
  CourseLesson,
  CourseLevel,
  CourseResource,
  CourseSeoConfig,
  CourseStatus,
  CourseVisibility,
  Enrollment,
  EnrollmentAvailability,
  Exam,
  ExamAttempt,
  ExamQuestion,
  HeroSlide,
  HomepageConfig,
  LessonType,
  LiveClassStatus,
  MediaAsset,
  PaymentGatewayType,
  Review,
  UserRole,
} from './src/types';

interface AuthedRequest extends Request {
  authUser?: StoredUser;
  authToken?: string;
  authSource?: 'bearer' | 'cookie';
}

function getAuthenticatedUser(req: Request): StoredUser | null {
  const { token } = extractAuthTokenFromRequest(req);
  if (!token) return null;
  const payload = verifySignedSessionToken(token);
  if (!payload) return null;
  const validSession = findValidSessionByToken(token);
  if (!validSession || validSession.userId !== payload.userId) return null;
  const db = getDb();
  const user = db.users.find((u) => u.id === payload.userId) ?? null;
  if (!user || !isValidRole(user.role) || user.role !== payload.role) return null;
  if (user.status === 'suspended' || user.status === 'pending' || user.status === 'rejected') return null;
  return user;
}

function isCookieCsrfSafe(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  if (req.path.startsWith('/api/payments/webhooks/')) return true;
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') return true;
  const origin = req.headers.origin;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return true;
    } catch {
      return false;
    }
  }
  return false;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const { token, source } = extractAuthTokenFromRequest(req);
  if (!token || !source) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (source === 'cookie' && !isCookieCsrfSafe(req)) {
    res.status(403).json({ error: 'Cross-site request blocked. Missing CSRF header.' });
    return;
  }
  const user = getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Session invalid or expired. Please sign in again.' });
    return;
  }
  req.authUser = user;
  req.authToken = token;
  req.authSource = source;
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!isValidRole(req.authUser.role) || !roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Insufficient permissions for this role' });
      return;
    }
    next();
  };
}

function hasValidImageMagicBytes(
  buf: Buffer,
  ext: 'png' | 'jpg' | 'webp' | 'gif'
): boolean {
  if (ext === 'png') {
    return (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    );
  }
  if (ext === 'jpg') {
    return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (ext === 'gif') {
    const header = buf.subarray(0, 4).toString('ascii');
    return buf.length >= 6 && header === 'GIF8';
  }
  if (ext === 'webp') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

async function startServer() {
  resolveSessionSecret();
  try {
    await initPostgresIfConfigured();
  } catch (err) {
    console.warn(
      '[LMS] PostgreSQL unavailable — falling back to local SQLite store:',
      err instanceof Error ? err.message : err
    );
  }
  getDb();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  const uploadsDir = path.resolve(process.cwd(), 'data', 'uploads');
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

  // Production security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production' || req.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Public bootstrap payload
  app.get('/api/public/bootstrap', (_req, res) => {
    const db = getDb();
    const publicCourses = db.courses.filter((c) => isCoursePubliclyListed(c));
    const totalStudents =
      db.users.filter((u) => u.role === 'student').length +
      db.enrollments.filter((e) => e.status === 'approved').length;

    const liveStats = {
      students: totalStudents,
      courses: publicCourses.length,
      teachers: db.instructors.length,
      videos: db.lessons.filter((l) => Boolean(l.videoUrl)).length || db.lessons.length,
    };

    const stats = computeHomepageStats(liveStats, db.settings.homepageConfig?.statsCard);
    const activeSlides = (db.settings.heroSlides ?? []).filter((s) => s.active !== false);
    const visibleReviews = db.reviews.filter(
      (r) => r.status !== 'hidden' && r.status !== 'pending'
    );
    const publicSecret = resolveSessionSecret();
    const leaderboardSummary = Object.values(db.rewardsByUser)
      .map((profile) => ({
        userId: pseudonymizeLeaderboardId(profile.userId, publicSecret),
        displayName: maskLeaderboardName(profile.studentName, profile.showOnLeaderboard !== false),
        isMasked: profile.showOnLeaderboard === false,
        xp: profile.xp,
        streakDays: profile.streakDays,
        badges: profile.badges,
      }))
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 10);

    res.json({
      settings: {
        ...db.settings,
        heroSlides: activeSlides.length ? activeSlides : db.settings.heroSlides.slice(0, 1),
      },
      branches: db.branches.filter((b) => b.status === 'active'),
      paymentGateways: filterActivePaymentGateways(db.paymentGateways).map(
        ({ apiKeyMasked: _k, webhookSecretMasked: _w, ...pub }) => pub
      ),
      courses: publicCourses,
      batches: db.batches.map((b) => redactBatchForViewer(b, null, [], db.instructors)),
      modules: db.modules.filter((m) => (m.status ?? 'published') !== 'draft'),
      instructors: db.instructors.map(sanitizePublicInstructor),
      products: db.products,
      ebooks: db.ebooks.filter((e) => e.status !== 'draft').map(sanitizePublicEbook),
      reviews: visibleReviews,
      categories: db.categories.filter((c) => c.active),
      leaderboardSummary,
      stats,
    });
  });

  app.get('/api/public/courses/:slug', (req, res) => {
    const db = getDb();
    const course = db.courses.find((c) => c.slug === req.params.slug && isCoursePubliclyLive(c));
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const instructors = db.instructors
      .filter((i) => course.instructorIds.includes(i.id))
      .map(sanitizePublicInstructor);
    const batches = db.batches
      .filter((b) => b.courseId === course.id)
      .map((b) => redactBatchForViewer(b, null, [], db.instructors));
    const modules = db.modules
      .filter((m) => m.courseId === course.id && (m.status ?? 'published') !== 'draft')
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const chapters = db.chapters
      .filter((ch) => ch.courseId === course.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const lessons = db.lessons
      .filter((l) => l.courseId === course.id && (l.status ?? 'published') !== 'draft')
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((l) => redactLessonForViewer(l, false));
    const branches = db.branches.filter(
      (b) => course.branchIds.includes(b.id) && b.status === 'active'
    );
    const approvedReviews = db.reviews.filter(
      (r) => (r.status ?? 'approved') === 'approved' && r.courseId === course.id
    );
    const fallbackReviews = db.reviews.filter(
      (r) => (r.status ?? 'approved') === 'approved' && !r.courseId
    );
    const courseReviews = approvedReviews.length > 0 ? approvedReviews : fallbackReviews.slice(0, 3);
    const averageRating =
      courseReviews.length > 0
        ? Number(
            (
              courseReviews.reduce((s, r) => s + Math.min(5, Math.max(1, r.rating || 5)), 0) /
              courseReviews.length
            ).toFixed(1)
          )
        : 5.0;

    res.json({
      course,
      instructors,
      batches,
      modules,
      chapters,
      lessons,
      branches,
      reviews: approvedReviews,
      averageRating,
      reviewCount: approvedReviews.length,
      seoJsonLd: buildCourseJsonLd(course, instructors, courseReviews),
    });
  });

  app.post('/api/public/coupons/validate', (req, res) => {
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const courseId = String(req.body?.courseId ?? '').trim();
    const ebookId = String(req.body?.ebookId ?? '').trim();
    const db = getDb();

    const coupon = db.coupons.find((c) => c.code.toUpperCase() === code && c.active);
    if (!coupon) {
      res.status(400).json({ error: 'Invalid or expired coupon code' });
      return;
    }

    if (ebookId) {
      const ebook = db.ebooks.find((e) => e.id === ebookId);
      if (!ebook) {
        res.status(404).json({ error: 'E-Book not found' });
        return;
      }
      const pricing = calculateDiscountedPrice(
        ebook.isFree ? 0 : ebook.price,
        ebook.originalPrice || ebook.price,
        coupon
      );
      res.json({ coupon, pricing });
      return;
    }

    const course = db.courses.find((c) => c.id === courseId);
    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const pricing = calculateDiscountedPrice(course.price, course.originalPrice, coupon);
    res.json({ coupon, pricing });
  });

  app.get('/api/public/results/lookup', (req, res) => {
    const rateCheck = consumePublicRateLimit(`public-lookup:${getClientIp(req)}`, 30, 5 * 60 * 1000);
    if (!rateCheck.allowed) {
      res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      res.status(429).json({
        error: `Too many result lookups. Please try again in ${rateCheck.retryAfterSeconds}s.`,
      });
      return;
    }
    const roll = String(req.query.roll ?? '').trim().toUpperCase();
    if (!roll) {
      res.status(400).json({ error: 'Please enter a valid Student Roll Number' });
      return;
    }
    const db = getDb();
    const record = db.results.find((r) => r.rollNumber.toUpperCase() === roll);
    const liveAttempts = db.examAttempts
      .filter((a) => a.rollNumber.toUpperCase() === roll)
      .map(sanitizePublicExamAttempt);
    if (!record && liveAttempts.length === 0) {
      res.status(404).json({ error: `No result record found for Roll ${roll}` });
      return;
    }
    res.json({ record: record ?? null, liveAttempts });
  });

  app.post('/api/public/contact', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const branchId = String(req.body?.branchId ?? 'br-mirpur').trim();
    const message = String(req.body?.message ?? '').trim();

    if (!name || !phone || !message) {
      res.status(400).json({ error: 'Name, phone, and message are required' });
      return;
    }
    const db = getDb();
    db.contactMessages.unshift({
      id: `msg-${Date.now()}`,
      name,
      email,
      phone,
      branchId,
      message,
      createdAt: new Date().toISOString(),
    });
    saveDb(db);
    res.status(201).json({ ok: true, message: 'Inquiry submitted successfully' });
  });

  // Auth & First-Time Main Admin Provisioning routes
  app.get('/api/auth/setup-status', (_req, res) => {
    const db = getDb();
    res.json({
      adminConfigured: isAdminConfiguredInDb(),
      totalUsers: db.users.length,
      requireStrongPasswords: true,
    });
  });

  app.post('/api/auth/setup-admin', (req, res) => {
    if (isAdminConfiguredInDb()) {
      res.status(409).json({
        error: 'Main Admin account is already configured. One-time setup is permanently locked.',
      });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = String(req.body?.phone ?? '').trim();
    const password = String(req.body?.password ?? '');

    if (!name || name.length < 2 || !email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid Main Admin name and email are required.' });
      return;
    }
    if (phone && !isValidBangladeshPhone(phone)) {
      res.status(400).json({ error: 'Enter a valid Bangladesh phone number (e.g. 017XXXXXXXX).' });
      return;
    }
    if (!isStrongPassword(password, 10)) {
      res.status(400).json({
        error: 'Main Admin password must be at least 10 characters and include both letters and numbers.',
      });
      return;
    }

    const db = getDb();
    const existingAdmins = db.users.filter((u) => u.role === 'admin');
    if (existingAdmins.length > 1) {
      res.status(409).json({ error: 'Multiple admin accounts detected; manual resolution required.' });
      return;
    }

    const now = new Date().toISOString();
    let admin = existingAdmins[0];
    if (admin) {
      if (db.users.some((u) => u.id !== admin!.id && u.email.toLowerCase() === email)) {
        res.status(409).json({ error: 'That email is already used by another account.' });
        return;
      }
      admin.name = name;
      admin.email = email;
      if (phone) admin.phone = phone;
      admin.passwordHash = hashPassword(password);
      admin.passwordUpdatedAt = now;
      admin.mustResetPassword = false;
      admin.status = 'active';
    } else {
      if (db.users.some((u) => u.email.toLowerCase() === email)) {
        res.status(409).json({ error: 'That email is already used by another account.' });
        return;
      }
      admin = {
        id: 'u-admin',
        name,
        email,
        phone: phone || '01710000001',
        role: 'admin',
        branchId: null,
        status: 'active',
        passwordHash: hashPassword(password),
        passwordUpdatedAt: now,
        mustResetPassword: false,
        twoFactorEnabled: false,
        communicationConsent: { email: true, sms: true, whatsapp: true },
        createdAt: now,
      };
      db.users.unshift(admin);
    }

    recordAuditLog(
      db,
      admin,
      'ADMIN_PROVISIONED',
      maskEmailForAudit(admin.email),
      'Main Admin initial credentials provisioned via one-time setup'
    );
    saveDb(db);

    const token = signSessionToken(admin.id, 'admin');
    createSessionRecord({
      userId: admin.id,
      rawToken: token,
      ipAddress: getClientIp(req),
      userAgent: String(req.headers['user-agent'] ?? 'unknown'),
    });
    setAuthSessionCookie(req, res, token);
    res.status(201).json({ token, user: sanitizeUser(admin) });
  });

  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = String(req.body?.phone ?? '').trim();
    const password = String(req.body?.password ?? '');
    const roleInput = String(req.body?.role ?? 'student').trim().toLowerCase();
    const requestedBranchId = String(req.body?.branchId ?? '').trim();
    const studentRollToLink = String(
      req.body?.studentRollToLink ?? req.body?.studentRollLink ?? ''
    )
      .trim()
      .toUpperCase();

    if (!name || !email || !email.includes('@') || !phone) {
      res.status(400).json({ error: 'Name, valid email, and phone number are required.' });
      return;
    }
    if (!isValidBangladeshPhone(phone)) {
      res.status(400).json({ error: 'Enter a valid Bangladesh mobile number (e.g. 017XXXXXXXX).' });
      return;
    }
    if (!isStrongPassword(password, 8)) {
      res.status(400).json({
        error: 'Password must be at least 8 characters and include both letters and numbers.',
      });
      return;
    }

    if (roleInput === 'admin') {
      res.status(403).json({
        error: 'Main Admin accounts cannot be self-registered.',
      });
      return;
    }

    const allowedRegisterRoles: UserRole[] = ['student', 'guardian', 'teacher', 'branch'];
    if (!allowedRegisterRoles.includes(roleInput as UserRole)) {
      res.status(400).json({
        error: 'Select a valid portal role: student, guardian, teacher, or branch.',
      });
      return;
    }
    const role = roleInput as UserRole;

    const db = getDb();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const now = new Date().toISOString();
    let branchId = '';
    let createdBranch: Branch | undefined;

    if (role === 'branch') {
      const branchName = String(req.body?.branchName ?? '').trim().slice(0, 120);
      const rawCode = String(req.body?.branchCode ?? '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 16);
      const branchCity = String(req.body?.branchCity ?? req.body?.city ?? '').trim().slice(0, 80);
      const branchAddress = String(req.body?.branchAddress ?? req.body?.address ?? '').trim().slice(0, 220);

      if (!branchName || branchName.length < 2 || !branchCity || !branchAddress) {
        res.status(400).json({
          error: 'Branch registration requires Branch Name, City, and Campus Address.',
        });
        return;
      }

      const derivedPrefix = branchName
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 3) || 'BRN';
      const branchCode = rawCode || `${derivedPrefix}-${String(db.branches.length + 101)}`;
      if (db.branches.some((b) => b.code.toUpperCase() === branchCode)) {
        res.status(409).json({ error: `Branch code "${branchCode}" already exists. Choose a unique code.` });
        return;
      }

      createdBranch = {
        id: `br-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        name: branchName,
        code: branchCode,
        city: branchCity,
        address: branchAddress,
        phone,
        managerName: name,
        activeStudents: 0,
        status: 'inactive',
        createdAt: now,
        updatedAt: now,
      };
      db.branches.push(createdBranch);
      branchId = createdBranch.id;
    } else {
      const activeFallback = db.branches.find((b) => b.status === 'active')?.id ?? 'online';
      branchId = requestedBranchId || activeFallback;
      if (branchId !== 'online') {
        const branchCheck = assertBranchOperationalForTransactions(branchId);
        if (!branchCheck.ok) {
          res.status(403).json({ error: branchCheck.error });
          return;
        }
      }
    }

    let guardianLinkedStudentIds: string[] | undefined;
    if (role === 'guardian' && studentRollToLink) {
      const verificationInput = String(
        req.body?.studentVerification ??
          req.body?.verificationCode ??
          req.body?.verification ??
          req.body?.studentPhone ??
          ''
      ).trim();
      const targetStudent = db.users.find(
        (u) => u.role === 'student' && (u.rollNumber ?? '').toUpperCase() === studentRollToLink
      );
      const admissionPhones = targetStudent
        ? db.studentAdmissions
            .filter((a) => a.studentUserId === targetStudent.id && a.guardianPhone)
            .map((a) => a.guardianPhone ?? '')
        : [];
      if (
        !targetStudent ||
        !verifyGuardianLinkCredential({
          actorRole: 'guardian',
          verificationInput,
          student: targetStudent,
          admissionGuardianPhones: admissionPhones,
          secret: resolveSessionSecret(),
        })
      ) {
        res.status(403).json({
          error:
            'Student verification failed. Enter the student’s matching registered phone number or guardian linking code (or leave Roll Number blank to link later).',
        });
        return;
      }
      guardianLinkedStudentIds = [targetStudent.id];
    }

    const rollNumber =
      role === 'student' ? `AEC-2026-${100 + db.users.length + 1}` : undefined;
    const subjectSpecialty =
      role === 'teacher'
        ? String(req.body?.subjectSpecialty ?? '').trim().slice(0, 120) || 'English Language'
        : undefined;
    const education =
      role === 'teacher'
        ? String(req.body?.education ?? '').trim().slice(0, 140) || undefined
        : undefined;
    const bio = req.body?.bio ? String(req.body.bio).trim().slice(0, 300) : undefined;

    const newUser: StoredUser = {
      id: `u-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name,
      email,
      phone,
      role,
      branchId: branchId || null,
      status: 'pending',
      rollNumber,
      subjectSpecialty,
      education,
      bio,
      guardianLinkedStudentIds,
      passwordHash: hashPassword(password),
      passwordUpdatedAt: now,
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: now,
    };

    db.users.push(newUser);
    const adminUser = db.users.find((u) => u.role === 'admin');
    if (adminUser) {
      db.inAppNotifications.unshift({
        id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId: adminUser.id,
        title: `New ${role.toUpperCase()} Registration Pending Approval`,
        message: `${newUser.name} (${maskEmailForAudit(newUser.email)}) submitted a ${role} account request${createdBranch ? ` for campus "${createdBranch.name}"` : ''}. Review in Users & Roles.`,
        type: role === 'branch' ? 'branch' : 'info',
        read: false,
        createdAt: now,
      });
    }

    recordAuditLog(
      db,
      newUser,
      'USER_REGISTER_PENDING',
      maskEmailForAudit(newUser.email),
      `Submitted ${role} registration awaiting Main Admin approval (${branchId || 'global'})`
    );
    saveDb(db);

    res.status(201).json({
      ok: true,
      pendingApproval: true,
      user: sanitizeUser(newUser),
      branch: createdBranch,
      message:
        role === 'branch'
          ? 'Branch & coordinator registration submitted! Your campus and account are awaiting Main Admin approval before sign-in.'
          : 'Registration submitted! Your account is awaiting Main Admin approval before sign-in.',
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    const expectedRoleRaw = req.body?.expectedRole ?? req.body?.portalRole;
    const expectedRole =
      typeof expectedRoleRaw === 'string' && expectedRoleRaw.trim()
        ? expectedRoleRaw.trim().toLowerCase()
        : '';
    const totpCode = String(req.body?.totpCode ?? '').trim();
    const recoveryCode = String(req.body?.recoveryCode ?? '').trim().toUpperCase();

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const ip = getClientIp(req);
    const rateKey = `${ip}:${email}`;
    const ipLimit = checkLoginRateLimit(`ip:${ip}`);
    const accountLimit = checkLoginRateLimit(rateKey);
    if (!ipLimit.allowed || !accountLimit.allowed) {
      const waitSeconds = Math.max(ipLimit.retryAfterSeconds, accountLimit.retryAfterSeconds);
      res.setHeader('Retry-After', String(waitSeconds));
      res.status(429).json({
        error: `Too many failed login attempts. Account temporarily locked for ${waitSeconds}s.`,
      });
      return;
    }

    const db = getDb();
    const revokedLegacy = db.revokedLegacyAccounts.find((r) => r.email.toLowerCase() === email);
    if (revokedLegacy) {
      res.status(403).json({
        error: 'This legacy branch manager account has been permanently revoked.',
      });
      return;
    }

    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (user && user.role === 'admin' && !user.passwordHash) {
      res.status(403).json({
        error: 'Main Admin password has not been provisioned yet. Complete First-Time Setup first.',
        setupRequired: true,
      });
      return;
    }

    if (!user || !isValidRole(user.role) || !verifyPassword(password, user.passwordHash)) {
      recordLoginFailure(rateKey, 5, 10 * 60 * 1000);
      recordLoginFailure(`ip:${ip}`, 20, 10 * 60 * 1000);
      recordAuditLog(
        db,
        {
          id: user?.id ?? 'anonymous',
          name: user?.name ?? 'Unknown Visitor',
          role: user && isValidRole(user.role) ? user.role : 'student',
        },
        'USER_LOGIN_FAILED',
        maskEmailForAudit(email),
        'Failed authentication attempt',
        'critical'
      );
      saveDb(db);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (expectedRole && isValidRole(expectedRole) && user.role !== expectedRole) {
      res.status(403).json({
        error: `This sign-in portal is dedicated to ${expectedRole} accounts. Please switch to the ${user.role} portal tab.`,
      });
      return;
    }

    if (user.status === 'pending') {
      recordAuditLog(
        db,
        user,
        'USER_LOGIN_BLOCKED',
        maskEmailForAudit(user.email),
        'Pending account login attempt before Main Admin approval',
        'warning'
      );
      saveDb(db);
      res.status(403).json({
        error:
          'Your account is pending Main Admin approval. Please wait until an administrator approves your registration.',
      });
      return;
    }

    if (user.status === 'rejected') {
      recordAuditLog(
        db,
        user,
        'USER_LOGIN_BLOCKED',
        maskEmailForAudit(user.email),
        'Declined account login attempt',
        'warning'
      );
      saveDb(db);
      res.status(403).json({
        error: `Your registration request was declined by Main Admin.${user.approvalNote ? ` Note: ${user.approvalNote}` : ''}`,
      });
      return;
    }

    if (user.status === 'suspended') {
      recordAuditLog(
        db,
        user,
        'USER_LOGIN_BLOCKED',
        maskEmailForAudit(user.email),
        'Suspended account login attempt',
        'warning'
      );
      saveDb(db);
      res.status(403).json({ error: 'This account is suspended. Please contact the Main Admin.' });
      return;
    }

    // Main Admin TOTP Two-Factor Verification when enabled
    if (user.role === 'admin' && user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode && !recoveryCode) {
        res.status(200).json({
          requires2fa: true,
          message: 'Enter the 6-digit code from your authenticator app or a recovery code.',
        });
        return;
      }

      let passed2fa = false;
      if (totpCode && verifyTotpCode(user.twoFactorSecret, totpCode)) {
        passed2fa = true;
      } else if (recoveryCode && Array.isArray(user.twoFactorRecoveryHashes)) {
        const hash = crypto.createHash('sha256').update(recoveryCode).digest('hex');
        const idx = user.twoFactorRecoveryHashes.indexOf(hash);
        if (idx >= 0) {
          user.twoFactorRecoveryHashes.splice(idx, 1);
          passed2fa = true;
        }
      }

      if (!passed2fa) {
        recordLoginFailure(rateKey, 5, 10 * 60 * 1000);
        recordAuditLog(
          db,
          user,
          'ADMIN_2FA_FAILED',
          maskEmailForAudit(user.email),
          'Invalid 2FA verification code on login',
          'critical'
        );
        saveDb(db);
        res.status(401).json({ error: 'Invalid two-factor authentication code.' });
        return;
      }
    }

    clearLoginRateLimit(rateKey);
    clearLoginRateLimit(`ip:${ip}`);

    user.lastLoginAt = new Date().toISOString();
    recordAuditLog(
      db,
      user,
      'USER_LOGIN',
      maskEmailForAudit(user.email),
      `Signed in to ${user.role} workspace`
    );
    saveDb(db);

    const token = signSessionToken(user.id, user.role);
    createSessionRecord({
      userId: user.id,
      rawToken: token,
      ipAddress: ip,
      userAgent: String(req.headers['user-agent'] ?? 'unknown'),
    });
    setAuthSessionCookie(req, res, token);
    res.json({ token, user: sanitizeUser(user) });
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const { token } = extractAuthTokenFromRequest(req);
    if (token) {
      revokeSessionByToken(token);
    }
    clearAuthSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.post('/api/auth/password-reset/request', async (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const expectedRoleRaw = req.body?.expectedRole ?? req.body?.portalRole;
    const expectedRole =
      typeof expectedRoleRaw === 'string' && expectedRoleRaw.trim()
        ? expectedRoleRaw.trim().toLowerCase()
        : '';
    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }
    const db = getDb();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === email &&
        (!expectedRole || !isValidRole(expectedRole) || u.role === expectedRole) &&
        u.status !== 'suspended' &&
        u.status !== 'rejected'
    );
    if (user) {
      const rawToken = createPasswordResetToken(user.id);
      const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
      await dispatchRealCommunication({
        channel: 'email',
        recipient: user.email,
        recipientUserId: user.id,
        subject: 'EDUPro Password Reset Request',
        message: `Reset token (${user.role} portal): ${rawToken}\nUse this token on ${appUrl}/recover/${user.role} within 30 minutes to set a new password.`,
      });
      const adminUser = db.users.find((u) => u.role === 'admin');
      if (adminUser && adminUser.id !== user.id) {
        db.inAppNotifications.unshift({
          id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
          userId: adminUser.id,
          title: `Password Recovery Request (${user.role.toUpperCase()})`,
          message: `${user.name} (${maskEmailForAudit(user.email)}) requested account recovery. You can issue a reset token from Users & Roles.`,
          type: user.role === 'branch' ? 'branch' : 'info',
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
      recordAuditLog(
        db,
        user,
        'PASSWORD_RESET_REQUEST',
        maskEmailForAudit(user.email),
        `Password reset token generated for ${user.role} portal`
      );
      saveDb(db);
    }
    res.json({
      ok: true,
      message:
        'If a matching account exists in this role portal, recovery instructions have been processed.',
    });
  });

  app.post('/api/auth/password-reset/confirm', (req, res) => {
    const token = String(req.body?.token ?? '').trim();
    const newPassword = String(req.body?.newPassword ?? '');
    if (!token || !isStrongPassword(newPassword, 8)) {
      res.status(400).json({
        error: 'Valid reset token and strong new password (min 8 chars with letters and numbers) are required.',
      });
      return;
    }
    const userId = consumePasswordResetToken(token);
    if (!userId) {
      res.status(400).json({ error: 'Password reset token is invalid or has expired.' });
      return;
    }
    const db = getDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    user.passwordHash = hashPassword(newPassword);
    user.passwordUpdatedAt = new Date().toISOString();
    user.mustResetPassword = false;
    revokeAllUserSessions(user.id);
    recordAuditLog(db, user, 'PASSWORD_RESET_COMPLETED', maskEmailForAudit(user.email), 'Password reset via verified token');
    saveDb(db);
    res.json({ ok: true, message: 'Password updated successfully. You may now sign in.' });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  // Self-service profile & security update for any authenticated user
  app.patch('/api/auth/profile', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = db.users.find((u) => u.id === req.authUser!.id);
    if (!actor) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const name = String(req.body?.name ?? actor.name).trim();
    const phone = String(req.body?.phone ?? actor.phone).trim();
    const bio = req.body?.bio !== undefined ? String(req.body.bio).trim().slice(0, 300) : actor.bio;
    const subjectSpecialty =
      req.body?.subjectSpecialty !== undefined
        ? String(req.body.subjectSpecialty).trim().slice(0, 120)
        : actor.subjectSpecialty;
    const avatar =
      req.body?.avatar !== undefined
        ? sanitizeSafeUrl(String(req.body.avatar), actor.avatar ?? '')
        : actor.avatar;
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    const check = validateProfileUpdate({ name, phone, currentPassword, newPassword });
    if (check.ok === false) {
      res.status(400).json({ error: check.error });
      return;
    }
    if (newPassword.trim()) {
      if (!isStrongPassword(newPassword.trim(), 8)) {
        res.status(400).json({
          error: 'New password must be at least 8 characters and include both letters and numbers.',
        });
        return;
      }
      if (!verifyPassword(currentPassword, actor.passwordHash)) {
        res.status(400).json({ error: 'Current password is incorrect' });
        return;
      }
      actor.passwordHash = hashPassword(newPassword.trim());
      actor.passwordUpdatedAt = new Date().toISOString();
    }
    actor.name = name;
    actor.phone = phone;
    actor.bio = bio;
    actor.subjectSpecialty = subjectSpecialty;
    if (avatar !== undefined) actor.avatar = avatar || undefined;

    recordAuditLog(
      db,
      actor,
      'PROFILE_UPDATE',
      maskEmailForAudit(actor.email),
      newPassword.trim() ? 'Updated profile & password' : 'Updated profile details'
    );
    saveDb(db);
    res.json({ user: sanitizeUser(actor) });
  });

  // Student Learning, Enrollments, Exams, Orders, Ebooks
  app.get('/api/enrollments/my', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const enrollments = db.enrollments.filter((e) => e.userId === user.id);
    const claimedEbookIds = db.claimedEbooksByUser[user.id] ?? [];
    const orders = db.orders.filter((o) => o.userId === user.id);
    const examAttempts = db.examAttempts.filter((a) => a.userId === user.id);
    res.json({ enrollments, claimedEbookIds, orders, examAttempts });
  });

  app.post('/api/enrollments', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const courseId = String(req.body?.courseId ?? '').trim();
    const batchId = req.body?.batchId ? String(req.body.batchId).trim() : null;
    const paymentMethod = req.body?.paymentMethod as
      | 'bKash'
      | 'Nagad'
      | 'Card'
      | 'Branch Cash'
      | undefined;
    const couponCode = String(req.body?.couponCode ?? '').trim().toUpperCase();

    if (
      !courseId ||
      !paymentMethod ||
      !['bKash', 'Nagad', 'Card', 'Branch Cash'].includes(paymentMethod)
    ) {
      res.status(400).json({ error: 'Valid course and payment method are required' });
      return;
    }

    const db = getDb();
    const course = db.courses.find((c) => c.id === courseId && isCourseStatusLive(c.status));
    const check = validateEnrollmentRequest({
      userId: user.id,
      course,
      batchId,
      batches: db.batches,
      enrollments: db.enrollments,
      branchId: req.body?.branchId ? String(req.body.branchId).trim() : null,
      branches: db.branches,
    });
    if (check.ok === false) {
      res.status(check.statusCode).json({ error: check.error });
      return;
    }

    const activeBranchFallback = db.branches.find((b) => b.status === 'active')?.id ?? 'online';
    const requestedBranchId = String(req.body?.branchId ?? '').trim() || activeBranchFallback;
    const resolvedBranchId = check.resolvedBatch?.branchId ?? requestedBranchId ?? 'online';
    if (resolvedBranchId !== 'online') {
      const branchOpCheck = assertBranchOperationalForTransactions(resolvedBranchId);
      if (!branchOpCheck.ok) {
        res.status(403).json({ error: branchOpCheck.error });
        return;
      }
    }

    const coupon = couponCode
      ? db.coupons.find((c) => c.code.toUpperCase() === couponCode && c.active)
      : undefined;
    const pricing = calculateCoursePricingServerSide(course!, coupon);

    // Paid courses remain pending until verified by server payment webhook or Main Admin
    const status: Enrollment['status'] = pricing.isFree ? 'approved' : 'pending';
    const enrollment: Enrollment = {
      id: `enr-${Date.now()}`,
      userId: user.id,
      studentName: user.name,
      studentEmail: user.email,
      courseId: course!.id,
      courseTitle: course!.title,
      batchId: check.resolvedBatch?.id ?? null,
      batchName: check.resolvedBatch?.name,
      branchId: resolvedBranchId,
      paymentMethod,
      amountPaid: pricing.totalPayable,
      couponUsed: pricing.appliedCouponCode ?? undefined,
      status: status as 'approved' | 'pending',
      completedLessonIds: [],
      history: [
        {
          id: `eh-${Date.now()}`,
          action: 'created',
          note: `Direct enrollment via ${paymentMethod} · ৳${pricing.totalPayable}`,
          actorName: user.name,
          createdAt: new Date().toISOString(),
        },
      ],
      enrolledAt: new Date().toISOString(),
    };

    db.enrollments.unshift(enrollment);
    if (status === 'approved') {
      course!.enrolledCount += 1;
      if (check.resolvedBatch) {
        check.resolvedBatch.enrolledSeats += 1;
      }
    }
    recordAuditLog(
      db,
      user,
      'ENROLLMENT_CREATE',
      course!.title,
      `${paymentMethod} · ৳${pricing.totalPayable} (${status})`
    );
    saveDb(db);
    res.status(201).json({ enrollment });
  });

  app.get('/api/learn/courses', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const nowMs = Date.now();
    const approvedIds = new Set(
      db.enrollments
        .filter(
          (e) =>
            e.userId === user.id &&
            e.status === 'approved' &&
            (!e.expiresAt || Date.parse(e.expiresAt) >= nowMs)
        )
        .map((e) => e.courseId)
    );
    const teacherCourseIds =
      user.role === 'teacher'
        ? getTeacherAssignedCourseIds(user, db.courses, db.instructors, db.batches)
        : new Set<string>();
    const isAdmin = user.role === 'admin';

    const accessibleCourses = db.courses.filter(
      (c) => isAdmin || teacherCourseIds.has(c.id) || approvedIds.has(c.id)
    );

    const lessonsByCourse: Record<string, CourseLesson[]> = {};
    const modulesByCourse: Record<string, typeof db.modules> = {};
    const chaptersByCourse: Record<string, typeof db.chapters> = {};
    const assignmentsByCourse: Record<string, typeof db.assignments> = {};

    for (const c of db.courses) {
      const canSeeAllInCourse = isAdmin || teacherCourseIds.has(c.id);
      const isEnrolledOrPriv = canSeeAllInCourse || approvedIds.has(c.id);

      const courseLessons = db.lessons
        .filter((l) => l.courseId === c.id && (canSeeAllInCourse || (l.status ?? 'published') !== 'draft'))
        .sort((a, b) => a.orderIndex - b.orderIndex);

      if (isEnrolledOrPriv) {
        lessonsByCourse[c.id] = courseLessons;
      } else {
        lessonsByCourse[c.id] = courseLessons.filter((l) => l.isFreePreview);
      }

      modulesByCourse[c.id] = db.modules
        .filter((m) => m.courseId === c.id && (canSeeAllInCourse || (m.status ?? 'published') !== 'draft'))
        .sort((a, b) => a.orderIndex - b.orderIndex);
      chaptersByCourse[c.id] = db.chapters
        .filter((ch) => ch.courseId === c.id)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      assignmentsByCourse[c.id] = isEnrolledOrPriv
        ? db.assignments.filter((a) => a.courseId === c.id)
        : [];
    }

    const enrollments = db.enrollments.filter((e) => e.userId === user.id);
    const submissions = db.assignmentSubmissions.filter((s) => s.userId === user.id);
    const announcements = db.announcements.filter(
      (a) => isAdmin || teacherCourseIds.has(a.courseId) || approvedIds.has(a.courseId)
    );
    const certificates = db.certificates.filter((c) => c.userId === user.id && !c.revoked);

    res.json({
      accessibleCourses,
      allCourses: db.courses.filter((c) => isAdmin || teacherCourseIds.has(c.id) || isCoursePubliclyListed(c) || approvedIds.has(c.id)),
      batches: db.batches,
      lessonsByCourse,
      modulesByCourse,
      chaptersByCourse,
      assignmentsByCourse,
      submissions,
      announcements,
      certificates,
      enrollments,
    });
  });

  app.post('/api/learn/progress', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const courseId = String(req.body?.courseId ?? '').trim();
    const lessonId = String(req.body?.lessonId ?? '').trim();
    const db = getDb();
    const enrollment = db.enrollments.find(
      (e) => e.userId === user.id && e.courseId === courseId && e.status === 'approved'
    );
    if (!enrollment) {
      res.status(403).json({ error: 'Approved course enrollment required to track progress' });
      return;
    }
    if (enrollment.expiresAt && Date.parse(enrollment.expiresAt) < Date.now()) {
      res.status(403).json({ error: 'Your course enrollment access has expired.' });
      return;
    }

    const course = db.courses.find((c) => c.id === courseId);
    const publishedLessons = db.lessons
      .filter((l) => l.courseId === courseId && (l.status ?? 'published') !== 'draft')
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const targetLesson = publishedLessons.find((l) => l.id === lessonId);
    if (!targetLesson) {
      res.status(404).json({ error: 'Lesson not found in this course.' });
      return;
    }

    const unlockCheck = isLessonUnlockedForStudent(
      course,
      publishedLessons,
      enrollment.completedLessonIds,
      lessonId
    );
    if (!unlockCheck.unlocked) {
      res.status(403).json({
        error: `Complete "${unlockCheck.blockingLessonTitle}" first before marking this lesson complete.`,
      });
      return;
    }

    if (!enrollment.completedLessonIds.includes(lessonId)) {
      enrollment.completedLessonIds.push(lessonId);
      saveDb(db);
    }
    res.json({ enrollment });
  });

  app.get('/api/exams', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const approvedCourseIds = new Set(
      db.enrollments
        .filter((e) => e.userId === user.id && e.status === 'approved')
        .map((e) => e.courseId)
    );
    const privileged = user.role === 'admin' || user.role === 'teacher';
    const exams = db.exams
      .filter(
        (ex) =>
          privileged ||
          ex.visibility === 'public' ||
          (ex.courseId && approvedCourseIds.has(ex.courseId))
      )
      .map((ex) => ({
        ...ex,
        questions: ex.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          marks: q.marks,
          ...(privileged ? { correctIndex: q.correctIndex, explanation: q.explanation } : {}),
        })),
      }));
    const myAttempts = db.examAttempts.filter((a) => a.userId === user.id);
    res.json({ exams, myAttempts });
  });

  app.post('/api/exams/:id/submit', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const exam = db.exams.find((e) => e.id === req.params.id);
    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }

    if (user.role === 'student' && exam.visibility === 'course' && exam.courseId) {
      const hasEnr = db.enrollments.some(
        (e) => e.userId === user.id && e.courseId === exam.courseId && e.status === 'approved'
      );
      if (!hasEnr) {
        res.status(403).json({ error: 'Approved course enrollment is required for this exam.' });
        return;
      }
    }

    // Check server-side timer if the user started a timed exam session
    const activeTimer = db.examSessionTimers.find(
      (t) => t.examId === exam.id && t.userId === user.id && !t.submittedAt
    );
    if (activeTimer) {
      const graceMs = 60 * 1000;
      if (Date.now() > Date.parse(activeTimer.expiresAt) + graceMs) {
        activeTimer.submittedAt = new Date().toISOString();
        saveDb(db);
        res.status(408).json({ error: 'Exam time window expired on server.' });
        return;
      }
      activeTimer.submittedAt = new Date().toISOString();
    }

    const answers = (req.body?.answers ?? {}) as Record<string, number>;
    const writtenAnswers =
      req.body?.writtenAnswers && typeof req.body.writtenAnswers === 'object'
        ? Object.fromEntries(
            Object.entries(req.body.writtenAnswers).map(([k, v]) => [k, String(v ?? '').trim().slice(0, 5000)])
          )
        : undefined;

    const mcqQuestions = exam.questions.filter((q) => (q.questionType ?? q.type ?? 'mcq') !== 'written' && q.options.length > 0);
    const writtenQuestions = exam.questions.filter((q) => (q.questionType ?? q.type) === 'written' || q.options.length === 0);
    const gradedMcq = gradeExamSubmission(mcqQuestions, answers, exam.passPercentage);
    const totalAllMarks = exam.questions.reduce((sum, q) => sum + Math.max(1, q.marks || 1), 0);
    const hasWritten = writtenQuestions.length > 0;
    const finalPercentage = totalAllMarks > 0 ? Math.round((gradedMcq.score / totalAllMarks) * 100) : gradedMcq.percentage;

    const attempt: ExamAttempt = {
      id: `att-${Date.now()}`,
      examId: exam.id,
      examTitle: exam.title,
      userId: user.id,
      studentName: user.name,
      rollNumber: user.rollNumber ?? user.id.toUpperCase(),
      branchId: user.branchId,
      score: gradedMcq.score,
      totalMarks: Math.max(1, totalAllMarks),
      percentage: hasWritten ? finalPercentage : gradedMcq.percentage,
      grade: hasWritten ? 'Pending' : gradedMcq.grade,
      passed: hasWritten ? false : gradedMcq.passed,
      answers,
      writtenAnswers,
      gradingStatus: hasWritten ? 'pending_manual' : 'auto_graded',
      submittedAt: new Date().toISOString(),
    };

    db.examAttempts.unshift(attempt);
    saveDb(db);

    res.status(201).json({
      attempt,
      graded: {
        ...gradedMcq,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        grade: attempt.grade,
        passed: attempt.passed,
      },
      reviewQuestions: exam.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        questionType: q.questionType ?? q.type ?? 'mcq',
        selectedIndex: typeof answers[q.id] === 'number' ? answers[q.id] : null,
        writtenResponse: writtenAnswers?.[q.id] ?? '',
      })),
    });
  });

  app.post('/api/orders', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const itemsInput = Array.isArray(req.body?.items) ? req.body.items : [];
    const deliveryAddress = String(req.body?.deliveryAddress ?? '').trim();
    const phone = String(req.body?.phone ?? user.phone).trim();
    const branchPickupId = req.body?.branchPickupId ? String(req.body.branchPickupId) : null;

    if (itemsInput.length === 0 || (!branchPickupId && !deliveryAddress)) {
      res.status(400).json({ error: 'Cart items and delivery address or branch pickup are required' });
      return;
    }

    const db = getDb();
    if (branchPickupId) {
      const pickupBranch = db.branches.find((b) => b.id === branchPickupId);
      if (!pickupBranch || pickupBranch.status !== 'active') {
        res.status(400).json({ error: 'Selected pickup branch is unavailable or inactive.' });
        return;
      }
    }
    const resolvedItems: { productId: string; title: string; quantity: number; unitPrice: number }[] = [];
    for (const raw of itemsInput) {
      const prod = db.products.find((p) => p.id === raw.productId);
      const qty = Math.max(1, Number(raw.quantity) || 1);
      if (!prod || prod.stock < qty) {
        res.status(400).json({ error: `Product unavailable or insufficient stock: ${raw.productId}` });
        return;
      }
      resolvedItems.push({
        productId: prod.id,
        title: prod.title,
        quantity: qty,
        unitPrice: prod.price,
      });
    }

    const totals = calculateOrderTotal(
      resolvedItems,
      branchPickupId ? 'branch_pickup' : 'home'
    );

    for (const item of resolvedItems) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (prod) prod.stock -= item.quantity;
    }

    const order = {
      id: `ord-${Date.now()}`,
      userId: user.id,
      customerName: user.name,
      phone,
      deliveryAddress: branchPickupId ? 'Branch Pickup' : deliveryAddress,
      branchPickupId,
      items: resolvedItems,
      deliveryFee: totals.deliveryFee,
      totalAmount: totals.totalAmount,
      status: 'processing' as const,
      createdAt: new Date().toISOString(),
    };
    db.orders.unshift(order);
    recordAuditLog(
      db,
      user,
      'ORDER_STATUS',
      order.id,
      `Order created · ৳${totals.totalAmount} (${resolvedItems.length} item(s))`
    );
    saveDb(db);
    res.status(201).json({ order });
  });

  app.post('/api/ebooks/claim', requireAuth, (req: AuthedRequest, res) => {
    const user = req.authUser!;
    const ebookId = String(req.body?.ebookId ?? '').trim();
    const db = getDb();
    const ebook = db.ebooks.find((e) => e.id === ebookId && e.status !== 'draft');
    if (!ebook) {
      res.status(404).json({ error: 'E-Book not found' });
      return;
    }
    const existing = db.claimedEbooksByUser[user.id] ?? [];
    if (!existing.includes(ebook.id) && !ebook.isFree && ebook.price > 0) {
      res.status(400).json({ error: 'Paid e-books must be purchased via payment checkout first.' });
      return;
    }
    if (!existing.includes(ebook.id)) {
      existing.push(ebook.id);
      db.claimedEbooksByUser[user.id] = existing;
      saveDb(db);
    }
    res.json({ claimedEbookIds: existing, ebook });
  });

  // ============================================================================
  // UNIFIED SINGLE PORTAL & ADMIN PANEL ROUTES (/api/portal/*)
  // ============================================================================
  app.get('/api/portal/overview', requireAuth, (req: AuthedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;

    if (user.role === 'admin') {
      const revenue = db.enrollments
        .filter((e) => e.status === 'approved')
        .reduce((s, e) => s + e.amountPaid, 0);
      return res.json({
        role: user.role,
        metrics: {
          totalStudents: db.users.filter((u) => u.role === 'student').length,
          totalCourses: db.courses.length,
          totalBranches: db.branches.length,
          totalRevenue: revenue,
          pendingApprovals: db.enrollments.filter((e) => e.status === 'pending').length,
          totalExams: db.exams.length,
          mediaCount: db.mediaAssets.length,
        },
        courses: db.courses,
        batches: db.batches,
        batchWaitlists: db.batchWaitlists,
        batchTransfers: db.batchTransfers,
        batchNotifications: db.batchNotifications,
        batchActivityLogs: db.batchActivityLogs,
        modules: db.modules,
        chapters: db.chapters,
        lessons: db.lessons,
        assignments: db.assignments,
        assignmentSubmissions: db.assignmentSubmissions,
        announcements: db.announcements,
        certificates: db.certificates,
        exams: db.exams,
        examAttempts: db.examAttempts,
        branches: db.branches,
        users: db.users.map(sanitizeUser),
        enrollments: db.enrollments,
        orders: db.orders,
        reviews: db.reviews,
        settings: db.settings,
        contactMessages: db.contactMessages,
        questionBank: db.questionBank,
        categories: db.categories,
        posts: db.posts,
        scormPackages: db.scormPackages,
        scormAttempts: db.scormAttempts,
        attendance: db.attendance,
        payrolls: db.payrolls,
        financialRecords: db.financialRecords,
        paymentGateways: db.paymentGateways,
        transactions: db.transactions,
        coupons: db.coupons,
        campaigns: db.campaigns,
        plugins: db.plugins,
        webhooks: db.webhooks,
        instructors: db.instructors,
        products: db.products,
        ebooks: db.ebooks,
        auditLogs: db.auditLogs.slice(0, 120),
      });
    }

    if (user.role === 'teacher') {
      const assignedIds = getTeacherAssignedCourseIds(user, db.courses, db.instructors, db.batches);
      const assignedCourses = db.courses.filter((c) => assignedIds.has(c.id));
      const assignedBatches = getTeacherAssignedBatches(user, db.batches, db.instructors);
      const assignedBatchIdSet = new Set(assignedBatches.map((b) => b.id));
      const assignedModules = db.modules.filter((m) => assignedIds.has(m.courseId));
      const assignedChapters = db.chapters.filter((ch) => assignedIds.has(ch.courseId));
      const assignedLessons = db.lessons.filter((l) => assignedIds.has(l.courseId));
      const assignedAssignments = db.assignments.filter((a) => assignedIds.has(a.courseId));
      const assignedSubmissions = db.assignmentSubmissions.filter((s) => assignedIds.has(s.courseId));
      const assignedAnnouncements = db.announcements.filter((a) => assignedIds.has(a.courseId));
      const assignedCertificates = db.certificates.filter((c) => assignedIds.has(c.courseId));
      const assignedEnrollments = db.enrollments.filter((e) => assignedIds.has(e.courseId));
      const assignedStudentIds = new Set(assignedEnrollments.map((e) => e.userId));

      const teacherExams = db.exams.filter(
        (ex) => ex.teacherId === user.id || (ex.courseId && assignedIds.has(ex.courseId))
      );
      const teacherExamIds = new Set(teacherExams.map((ex) => ex.id));
      const scopedAttempts = db.examAttempts.filter(
        (a) => teacherExamIds.has(a.examId) || assignedStudentIds.has(a.userId)
      );
      const scopedAttendance = db.attendance.filter(
        (a) =>
          (a.targetType === 'teacher' && a.targetId === user.id) ||
          (a.targetType === 'student' &&
            (assignedStudentIds.has(a.targetId) || (a.batchId && assignedBatchIdSet.has(a.batchId))))
      );
      const scopedRewards = Object.fromEntries(
        Object.entries(db.rewardsByUser).filter(([uid]) => assignedStudentIds.has(uid))
      );
      const scopedBranchIds = new Set<string>([
        ...(user.branchId ? [user.branchId] : []),
        ...assignedBatches.map((b) => b.branchId),
        ...assignedCourses.flatMap((c) => c.branchIds),
      ]);
      const scopedBranches = db.branches.filter((b) => scopedBranchIds.has(b.id));
      const scopedUsers = db.users
        .filter((u) => u.id === user.id || (u.role === 'student' && assignedStudentIds.has(u.id)))
        .map(sanitizeUser);

      return res.json({
        role: user.role,
        assignedCourseIds: Array.from(assignedIds),
        metrics: {
          activeCourses: assignedCourses.length,
          totalBatches: assignedBatches.length,
          totalLessons: assignedLessons.length,
          totalExams: teacherExams.length,
          submissionsGraded:
            scopedAttempts.filter((a) => a.gradingStatus !== 'pending_manual').length +
            assignedSubmissions.filter((s) => s.status === 'graded').length,
          pendingSubmissions:
            scopedAttempts.filter((a) => a.gradingStatus === 'pending_manual').length +
            assignedSubmissions.filter((s) => s.status !== 'graded').length,
          mediaCount: db.mediaAssets.filter((m) => m.uploadedByUserId === user.id).length,
        },
        courses: assignedCourses,
        batches: assignedBatches,
        batchWaitlists: db.batchWaitlists.filter((w) => assignedBatchIdSet.has(w.batchId)),
        batchTransfers: db.batchTransfers.filter(
          (t) => (t.fromBatchId && assignedBatchIdSet.has(t.fromBatchId)) || assignedBatchIdSet.has(t.toBatchId)
        ),
        batchNotifications: db.batchNotifications.filter((n) => assignedBatchIdSet.has(n.batchId)),
        batchActivityLogs: db.batchActivityLogs.filter((l) => assignedBatchIdSet.has(l.batchId)),
        modules: assignedModules,
        chapters: assignedChapters,
        lessons: assignedLessons,
        assignments: assignedAssignments,
        assignmentSubmissions: assignedSubmissions,
        announcements: assignedAnnouncements,
        certificates: assignedCertificates,
        exams: teacherExams,
        branches: scopedBranches,
        users: scopedUsers,
        enrollments: assignedEnrollments,
        examAttempts: scopedAttempts,
        rewardsByUser: scopedRewards,
        questionBank: db.questionBank,
        scormPackages: db.scormPackages,
        attendance: scopedAttendance,
        payrolls: db.payrolls.filter((p) => p.employeeId === user.id),
        posts: db.posts,
        ebooks: db.ebooks,
        categories: db.categories,
        instructors: db.instructors.filter((ins) => ins.userId === user.id),
        campaigns: [],
      });
    }

    if (user.role === 'guardian') {
      const linkedIds = user.guardianLinkedStudentIds ?? [];
      const linkedCourseIdSet = new Set<string>();
      const linkedApprovedCourseIdSet = new Set<string>();
      const linkedEnrollmentsAll: Enrollment[] = [];
      const linkedAttemptsAll: ExamAttempt[] = [];
      const linkedAttendanceAll: typeof db.attendance = [];
      const linkedTransactionsAll: typeof db.transactions = [];

      const children = db.users
        .filter((u) => linkedIds.includes(u.id))
        .map((child) => {
          const childEnrollments = db.enrollments.filter((e) => e.userId === child.id);
          const childAttempts = db.examAttempts.filter((a) => a.userId === child.id);
          const childAttendance = db.attendance.filter((a) => a.targetId === child.id);
          const childApprovedCourseIds = new Set(
            childEnrollments.filter((e) => e.status === 'approved').map((e) => e.courseId)
          );
          const childAssignments = db.assignments.filter((a) =>
            childApprovedCourseIds.has(a.courseId)
          );
          const childSubmissions = db.assignmentSubmissions.filter((s) => s.userId === child.id);
          const childCertificates = db.certificates.filter((c) => c.userId === child.id && !c.revoked);
          const childOrders = db.orders.filter((o) => o.userId === child.id);
          const childTransactions = db.transactions.filter((t) => t.userId === child.id);
          const childRewards = db.rewardsByUser[child.id] ?? null;
          const childLessonsCount: Record<string, number> = {};
          for (const enr of childEnrollments) {
            linkedCourseIdSet.add(enr.courseId);
            if (enr.status === 'approved') {
              linkedApprovedCourseIdSet.add(enr.courseId);
            }
            childLessonsCount[enr.courseId] = db.lessons.filter(
              (l) => l.courseId === enr.courseId && (l.status ?? 'published') !== 'draft'
            ).length;
          }
          linkedEnrollmentsAll.push(...childEnrollments);
          linkedAttemptsAll.push(...childAttempts);
          linkedAttendanceAll.push(...childAttendance);
          linkedTransactionsAll.push(...childTransactions);
          return {
            student: sanitizeUser(child),
            enrollments: childEnrollments,
            examAttempts: childAttempts,
            lessonsCountByCourse: childLessonsCount,
            attendance: childAttendance,
            assignments: childAssignments,
            assignmentSubmissions: childSubmissions,
            certificates: childCertificates,
            orders: childOrders,
            transactions: childTransactions,
            rewards: childRewards,
          };
        });

      const presentCount = linkedAttendanceAll.filter(
        (a) => a.status === 'present' || a.status === 'late'
      ).length;
      const avgAttendanceRate =
        linkedAttendanceAll.length > 0
          ? Math.round((presentCount / linkedAttendanceAll.length) * 100)
          : 100;
      const avgExamScore =
        linkedAttemptsAll.length > 0
          ? Math.round(
              linkedAttemptsAll.reduce((s, a) => s + a.percentage, 0) / linkedAttemptsAll.length
            )
          : 0;

      const relevantCourses = db.courses.filter(
        (c) => linkedCourseIdSet.has(c.id) || isCoursePubliclyListed(c)
      );
      const relevantLessons = db.lessons
        .filter(
          (l) => linkedApprovedCourseIdSet.has(l.courseId) && (l.status ?? 'published') !== 'draft'
        )
        .map((l) => redactLessonForViewer(l, true));

      return res.json({
        role: user.role,
        metrics: {
          linkedStudents: children.length,
          totalExamsTaken: linkedAttemptsAll.length,
          activeCourses: linkedEnrollmentsAll.filter((e) => e.status === 'approved').length,
          avgAttendanceRate,
          avgExamScore,
          mediaCount: db.mediaAssets.filter((m) => m.uploadedByUserId === user.id).length,
        },
        children,
        branches: db.branches,
        instructors: db.instructors.map(sanitizePublicInstructor),
        courses: relevantCourses,
        batches: db.batches.map((b) =>
          redactBatchForViewer(b, user, linkedEnrollmentsAll, db.instructors)
        ),
        lessons: relevantLessons,
        enrollments: linkedEnrollmentsAll,
        examAttempts: linkedAttemptsAll,
        attendance: linkedAttendanceAll,
        transactions: linkedTransactionsAll,
      });
    }

    if (user.role === 'branch') {
      const userBranch = db.branches.find((b) => b.id === user.branchId) ?? null;
      const bId = userBranch?.id ?? user.branchId ?? '';
      const scopedBatches = db.batches.filter((b) => b.branchId === bId);
      const scopedBatchIdSet = new Set(scopedBatches.map((b) => b.id));
      const scopedEnrollments = db.enrollments.filter((e) => e.branchId === bId);
      const scopedCourseIds = new Set<string>([
        ...db.courses.filter((c) => c.branchIds.includes(bId)).map((c) => c.id),
        ...scopedBatches.map((b) => b.courseId),
      ]);
      const scopedCourses = db.courses.filter((c) => scopedCourseIds.has(c.id));
      const scopedLessons = db.lessons.filter((l) => scopedCourseIds.has(l.courseId));
      const scopedUsers = db.users
        .filter((u) => u.id === user.id || (u.branchId === bId && u.role !== 'admin'))
        .map(sanitizeUser);
      const scopedUserIdSet = new Set(scopedUsers.map((u) => u.id));
      const scopedAttendance = db.attendance.filter(
        (a) => a.branchId === bId || (a.batchId && scopedBatchIdSet.has(a.batchId))
      );
      const scopedTransactions = db.transactions.filter(
        (t) =>
          t.branchId === bId ||
          scopedEnrollments.some((e) => e.id === t.referenceId)
      );
      const scopedFinancialRecords = db.financialRecords.filter((f) => f.branchId === bId);
      const scopedOrders = db.orders.filter(
        (o) => scopedUserIdSet.has(o.userId)
      );
      const scopedExams = db.exams.filter((ex) => !ex.courseId || scopedCourseIds.has(ex.courseId));
      const scopedExamAttempts = db.examAttempts.filter(
        (a) => a.branchId === bId || scopedUserIdSet.has(a.userId)
      );
      const branchRevenue = scopedEnrollments
        .filter((e) => e.status === 'approved')
        .reduce((s, e) => s + (e.amountPaid || 0), 0);

      return res.json({
        role: user.role,
        branch: userBranch ?? undefined,
        metrics: {
          totalStudents: scopedUsers.filter((u) => u.role === 'student').length,
          totalTeachers: scopedUsers.filter((u) => u.role === 'teacher').length,
          totalCourses: scopedCourses.length,
          totalBatches: scopedBatches.length,
          totalRevenue: branchRevenue,
          pendingApprovals: scopedEnrollments.filter((e) => e.status === 'pending').length,
          mediaCount: db.mediaAssets.filter((m) => m.uploadedByUserId === user.id).length,
        },
        branches: userBranch ? [userBranch] : [],
        courses: scopedCourses,
        batches: scopedBatches,
        batchWaitlists: db.batchWaitlists.filter((w) => scopedBatchIdSet.has(w.batchId)),
        batchTransfers: db.batchTransfers.filter(
          (t) => (t.fromBatchId && scopedBatchIdSet.has(t.fromBatchId)) || scopedBatchIdSet.has(t.toBatchId)
        ),
        batchNotifications: db.batchNotifications.filter((n) => scopedBatchIdSet.has(n.batchId)),
        batchActivityLogs: db.batchActivityLogs.filter((l) => scopedBatchIdSet.has(l.batchId)),
        modules: db.modules.filter((m) => scopedCourseIds.has(m.courseId)),
        chapters: db.chapters.filter((ch) => scopedCourseIds.has(ch.courseId)),
        lessons: scopedLessons,
        assignments: db.assignments.filter((a) => scopedCourseIds.has(a.courseId)),
        assignmentSubmissions: db.assignmentSubmissions.filter((s) => scopedCourseIds.has(s.courseId)),
        announcements: db.announcements.filter((a) => scopedCourseIds.has(a.courseId)),
        certificates: db.certificates.filter((c) => scopedCourseIds.has(c.courseId)),
        exams: scopedExams,
        examAttempts: scopedExamAttempts,
        users: scopedUsers,
        enrollments: scopedEnrollments,
        orders: scopedOrders,
        attendance: scopedAttendance,
        financialRecords: scopedFinancialRecords,
        transactions: scopedTransactions,
        instructors: db.instructors.filter((ins) => ins.branchId === bId || ins.panel === 'Head Faculty'),
        payrolls: db.payrolls.filter((p) => p.branchId === bId),
      });
    }

    // Student
    const nowMs = Date.now();
    const myEnrollments = db.enrollments.filter((e) => e.userId === user.id);
    const myAttempts = db.examAttempts.filter((a) => a.userId === user.id);
    const myOrders = db.orders.filter((o) => o.userId === user.id);
    const myApprovedCourseIds = new Set(
      myEnrollments
        .filter(
          (e) =>
            e.status === 'approved' && (!e.expiresAt || Date.parse(e.expiresAt) >= nowMs)
        )
        .map((e) => e.courseId)
    );
    return res.json({
      role: user.role,
      guardianLinkCode: deriveStudentGuardianLinkCode(user, resolveSessionSecret()),
      metrics: {
        enrolledCourses: myApprovedCourseIds.size,
        pendingCourses: myEnrollments.filter((e) => e.status === 'pending').length,
        examsTaken: myAttempts.length,
        ordersPlaced: myOrders.length,
        mediaCount: db.mediaAssets.filter((m) => m.uploadedByUserId === user.id).length,
      },
      enrollments: myEnrollments,
      examAttempts: myAttempts,
      orders: myOrders,
      courses: db.courses,
      batches: db.batches.map((b) => redactBatchForViewer(b, user, myEnrollments, db.instructors)),
      batchNotifications: db.batchNotifications.filter((n) =>
        myEnrollments.some((e) => e.batchId === n.batchId && e.status === 'approved')
      ),
      attendance: db.attendance.filter((a) => a.targetId === user.id),
      modules: db.modules.filter((m) => (m.status ?? 'published') !== 'draft'),
      lessons: db.lessons
        .filter((l) => (l.status ?? 'published') !== 'draft')
        .map((l) => redactLessonForViewer(l, myApprovedCourseIds.has(l.courseId))),
      assignments: db.assignments.filter((a) => myApprovedCourseIds.has(a.courseId)),
      assignmentSubmissions: db.assignmentSubmissions.filter((s) => s.userId === user.id),
      announcements: db.announcements.filter((a) => myApprovedCourseIds.has(a.courseId)),
      certificates: db.certificates.filter((c) => c.userId === user.id && !c.revoked),
      exams: db.exams
        .filter(
          (ex) => ex.visibility === 'public' || (ex.courseId && myApprovedCourseIds.has(ex.courseId))
        )
        .map(({ questions, ...rest }) => ({
          ...rest,
          questions: questions.map(({ correctIndex: _c, explanation: _e, ...q }) => q),
        })),
      scormPackages: db.scormPackages,
      scormAttempts: db.scormAttempts.filter((a) => a.userId === user.id),
      rewards: db.rewardsByUser[user.id] ?? null,
      transactions: db.transactions.filter((t) => t.userId === user.id),
      branches: db.branches,
      instructors: db.instructors.map(sanitizePublicInstructor),
    });
  });

  // Guardian: Self-service link / unlink student by Roll Number or Email (requires phone or linking code for guardians)
  app.post(
    '/api/portal/guardian/link-student',
    requireAuth,
    requireRole(['guardian', 'admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = db.users.find((u) => u.id === req.authUser!.id);
      if (!actor) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      const query = String(req.body?.query ?? req.body?.identifier ?? req.body?.rollNumber ?? '')
        .trim()
        .toLowerCase();
      const verificationInput = String(
        req.body?.verification ??
          req.body?.verificationCode ??
          req.body?.studentPhone ??
          req.body?.studentVerification ??
          ''
      ).trim();
      if (!query) {
        res.status(400).json({ error: 'Enter a student Roll Number or Email address.' });
        return;
      }
      const targetStudent = db.users.find(
        (u) =>
          u.role === 'student' &&
          ((u.rollNumber ?? '').toLowerCase() === query || u.email.toLowerCase() === query)
      );
      const admissionPhones = targetStudent
        ? db.studentAdmissions
            .filter((a) => a.studentUserId === targetStudent.id && a.guardianPhone)
            .map((a) => a.guardianPhone ?? '')
        : [];
      if (
        !targetStudent ||
        !verifyGuardianLinkCredential({
          actorRole: actor.role,
          verificationInput,
          student: targetStudent,
          admissionGuardianPhones: admissionPhones,
          secret: resolveSessionSecret(),
        })
      ) {
        res.status(403).json({
          error:
            'Verification failed. Confirm the student’s Roll Number/Email and matching registered phone or guardian linking code.',
        });
        return;
      }
      const existing = actor.guardianLinkedStudentIds ?? [];
      if (!existing.includes(targetStudent.id)) {
        actor.guardianLinkedStudentIds = [...existing, targetStudent.id];
        recordAuditLog(
          db,
          actor,
          'GUARDIAN_LINK_STUDENT',
          targetStudent.name,
          `Linked student ${targetStudent.rollNumber || targetStudent.email}`
        );
        saveDb(db);
      }
      res.status(200).json({
        student: sanitizeUser(targetStudent),
        linkedStudentIds: actor.guardianLinkedStudentIds ?? [],
      });
    }
  );

  app.delete(
    '/api/portal/guardian/link-student/:studentId',
    requireAuth,
    requireRole(['guardian', 'admin']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = db.users.find((u) => u.id === req.authUser!.id);
      if (!actor) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      const studentId = String(req.params.studentId ?? '');
      actor.guardianLinkedStudentIds = (actor.guardianLinkedStudentIds ?? []).filter(
        (id) => id !== studentId
      );
      recordAuditLog(db, actor, 'GUARDIAN_UNLINK_STUDENT', studentId, 'Removed linked student');
      saveDb(db);
      res.json({ linkedStudentIds: actor.guardianLinkedStudentIds ?? [] });
    }
  );

  const ALLOWED_COURSE_STATUSES: CourseStatus[] = [
    'draft',
    'published',
    'active',
    'unpublished',
    'archived',
  ];

  function parseCoursePayload(
    body: Record<string, unknown>,
    db: ReturnType<typeof getDb>,
    existing?: Course
  ) {
    const title = String(body?.title ?? existing?.title ?? '').trim().slice(0, 180);
    const subtitle = String(body?.subtitle ?? existing?.subtitle ?? '').trim().slice(0, 260);
    const rawCat = String(body?.category ?? existing?.category ?? 'HSC English').trim().slice(0, 80);
    const category: string = rawCat || 'HSC English';
    const levelTag = String(body?.levelTag ?? existing?.levelTag ?? 'HSC 27').trim().slice(0, 40) || 'HSC 27';
    const rawLevel = String(body?.level ?? existing?.level ?? 'Intermediate');
    const level: CourseLevel =
      rawLevel === 'Beginner' || rawLevel === 'Advanced' ? rawLevel : 'Intermediate';
    const rawType = String(body?.courseType ?? existing?.courseType ?? 'Hybrid');
    const courseType: CourseDeliveryType =
      rawType === 'Offline' || rawType === 'Online' ? rawType : 'Hybrid';
    const language = String(body?.language ?? existing?.language ?? 'Bangla & English').trim().slice(0, 60);
    const tags = Array.isArray(body?.tags)
      ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 15)
      : existing?.tags ?? [];

    const isCombo =
      typeof body?.isCombo === 'boolean'
        ? body.isCombo
        : category === 'Combo Packs'
          ? true
          : existing?.isCombo ?? false;

    const isFree =
      typeof body?.isFree === 'boolean' ? body.isFree : existing?.isFree ?? false;
    const price = isFree
      ? 0
      : Math.max(0, Math.round(Number(body?.price ?? existing?.price ?? 0) || 0));
    const rawOrig = Number(body?.originalPrice ?? existing?.originalPrice ?? price);
    const originalPrice = isFree
      ? 0
      : Math.max(price, Math.round(Number.isFinite(rawOrig) ? rawOrig : price));
    const admissionFee = isFree
      ? 0
      : Math.max(0, Math.round(Number(body?.admissionFee ?? existing?.admissionFee ?? 0) || 0));
    const installmentEnabled =
      typeof body?.installmentEnabled === 'boolean'
        ? body.installmentEnabled
        : existing?.installmentEnabled ?? false;
    const installmentCount = Math.max(
      1,
      Math.min(12, Math.round(Number(body?.installmentCount ?? existing?.installmentCount ?? 2) || 2))
    );
    const paymentPolicy = String(body?.paymentPolicy ?? existing?.paymentPolicy ?? '').trim().slice(0, 500) || undefined;
    const couponEligible =
      typeof body?.couponEligible === 'boolean'
        ? body.couponEligible
        : existing?.couponEligible ?? true;

    const durationLabel = String(body?.durationLabel ?? existing?.durationLabel ?? '4 Months').trim().slice(0, 60);
    const totalClasses =
      body?.totalClasses !== undefined
        ? Math.max(1, Math.round(Number(body.totalClasses) || 1))
        : existing?.totalClasses;
    const estimatedHours =
      body?.estimatedHours !== undefined
        ? Math.max(1, Math.round(Number(body.estimatedHours) || 1))
        : existing?.estimatedHours;
    const maxCapacity =
      body?.maxCapacity !== undefined && body.maxCapacity !== '' && body.maxCapacity !== null
        ? Math.max(1, Math.round(Number(body.maxCapacity) || 0))
        : existing?.maxCapacity;
    const minEnrollment =
      body?.minEnrollment !== undefined && body.minEnrollment !== '' && body.minEnrollment !== null
        ? Math.max(0, Math.round(Number(body.minEnrollment) || 0))
        : existing?.minEnrollment;
    const startDate =
      body?.startDate !== undefined ? String(body.startDate).trim().slice(0, 30) || undefined : existing?.startDate;
    const endDate =
      body?.endDate !== undefined ? String(body.endDate).trim().slice(0, 30) || undefined : existing?.endDate;
    const enrollmentStartDate =
      body?.enrollmentStartDate !== undefined
        ? String(body.enrollmentStartDate).trim().slice(0, 30) || undefined
        : existing?.enrollmentStartDate;
    const enrollmentDeadline =
      body?.enrollmentDeadline !== undefined
        ? String(body.enrollmentDeadline).trim().slice(0, 30) || undefined
        : existing?.enrollmentDeadline;

    const prerequisites = Array.isArray(body?.prerequisites)
      ? body.prerequisites.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : existing?.prerequisites ?? [];
    const learningOutcomes = Array.isArray(body?.learningOutcomes)
      ? body.learningOutcomes.map((x) => String(x).trim()).filter(Boolean).slice(0, 16)
      : existing?.learningOutcomes ?? [];
    const targetAudience = Array.isArray(body?.targetAudience)
      ? body.targetAudience.map((x) => String(x).trim()).filter(Boolean).slice(0, 12)
      : existing?.targetAudience ?? [];

    const description =
      String(body?.description ?? existing?.description ?? subtitle).trim().slice(0, 4000) || subtitle;
    const examSystemIncluded =
      typeof body?.examSystemIncluded === 'boolean'
        ? body.examSystemIncluded
        : existing?.examSystemIncluded ?? true;

    const rawStatus = String(body?.status ?? existing?.status ?? 'published');
    const status: CourseStatus = ALLOWED_COURSE_STATUSES.includes(rawStatus as CourseStatus)
      ? (rawStatus as CourseStatus)
      : existing?.status ?? 'published';

    const rawVis = String(body?.visibility ?? existing?.visibility ?? 'public');
    const visibility: CourseVisibility =
      rawVis === 'unlisted' || rawVis === 'private' ? rawVis : 'public';
    const rawAvail = String(body?.enrollmentAvailability ?? existing?.enrollmentAvailability ?? 'open');
    const enrollmentAvailability: EnrollmentAvailability =
      rawAvail === 'closed' || rawAvail === 'upcoming' ? rawAvail : 'open';
    const featured =
      typeof body?.featured === 'boolean' ? body.featured : existing?.featured ?? false;
    const sequentialAccess =
      typeof body?.sequentialAccess === 'boolean'
        ? body.sequentialAccess
        : existing?.sequentialAccess ?? false;

    const defaultThumb = '/src/assets/images/hero_hsc_english_1795411661478.jpg';
    const thumbnail = sanitizeSafeUrl(
      String(body?.thumbnail ?? existing?.thumbnail ?? defaultThumb),
      existing?.thumbnail || defaultThumb
    );
    const bannerImage =
      body?.bannerImage !== undefined
        ? sanitizeSafeUrl(String(body.bannerImage), '') || undefined
        : existing?.bannerImage;
    const demoVideoTitle =
      String(body?.demoVideoTitle ?? existing?.demoVideoTitle ?? `${title} — Orientation Class`)
        .trim()
        .slice(0, 180) || `${title} — Orientation Class`;
    const demoYoutubeUrl = sanitizeSafeUrl(
      String(body?.demoYoutubeUrl ?? existing?.demoYoutubeUrl ?? 'https://www.youtube.com/watch?v=M7lc1UVf-VE'),
      'https://www.youtube.com/watch?v=M7lc1UVf-VE'
    );

    const validBranchIds = new Set(db.branches.map((b) => b.id));
    const branchIds = Array.isArray(body?.branchIds)
      ? body.branchIds.map(String).filter((id) => validBranchIds.has(id))
      : existing?.branchIds ?? db.branches.map((b) => b.id);

    const validInstIds = new Set(db.instructors.map((i) => i.id));
    const instructorIds = Array.isArray(body?.instructorIds)
      ? body.instructorIds.map(String).filter((id) => validInstIds.has(id))
      : existing?.instructorIds ?? ['inst-1', 'inst-2'];

    const highlights = Array.isArray(body?.highlights)
      ? body.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 12)
      : existing?.highlights ?? [
          'Structured Bilingual Lectures',
          'Printed PDF Practice Sheets',
          'Automated Weekly MCQ Evaluation',
        ];

    const includedCourses = isCombo
      ? Array.isArray(body?.includedCourses)
        ? body.includedCourses.map((c) => String(c).trim()).filter(Boolean).slice(0, 10)
        : existing?.includedCourses ?? []
      : undefined;

    const rawCrit = (body?.certificateCriteria ?? existing?.certificateCriteria ?? {}) as Partial<CertificateCriteria>;
    const certificateCriteria: CertificateCriteria = {
      enabled: rawCrit.enabled !== false,
      minProgressPercent: Math.min(100, Math.max(0, Math.round(Number(rawCrit.minProgressPercent ?? 80)))),
      requireExamPass: Boolean(rawCrit.requireExamPass),
      minExamPercent: Math.min(100, Math.max(0, Math.round(Number(rawCrit.minExamPercent ?? 50)))),
      requireAssignmentCompletion: Boolean(rawCrit.requireAssignmentCompletion),
    };

    const rawSeo = (body?.seo ?? existing?.seo ?? {}) as Partial<CourseSeoConfig>;
    const seo: CourseSeoConfig = {
      metaTitle: String(rawSeo.metaTitle ?? '').trim().slice(0, 120) || undefined,
      metaDescription: String(rawSeo.metaDescription ?? '').trim().slice(0, 220) || undefined,
      metaKeywords: String(rawSeo.metaKeywords ?? '').trim().slice(0, 220) || undefined,
      canonicalUrl: rawSeo.canonicalUrl ? sanitizeSafeUrl(String(rawSeo.canonicalUrl), '') : undefined,
      ogTitle: String(rawSeo.ogTitle ?? '').trim().slice(0, 120) || undefined,
      ogDescription: String(rawSeo.ogDescription ?? '').trim().slice(0, 220) || undefined,
      ogImage: rawSeo.ogImage ? sanitizeSafeUrl(String(rawSeo.ogImage), '') : undefined,
      noIndex: Boolean(rawSeo.noIndex),
    };

    const customSlug = typeof body?.slug === 'string' && body.slug.trim()
      ? generateCourseSlug(body.slug, db.courses, existing?.id)
      : existing?.slug;

    return {
      slug: customSlug,
      title,
      subtitle,
      category,
      levelTag,
      level,
      courseType,
      language,
      tags,
      isCombo,
      includedCourses,
      price,
      originalPrice,
      admissionFee,
      installmentEnabled,
      installmentCount,
      paymentPolicy,
      isFree,
      couponEligible,
      durationLabel,
      totalClasses,
      estimatedHours,
      maxCapacity,
      minEnrollment,
      startDate,
      endDate,
      enrollmentStartDate,
      enrollmentDeadline,
      prerequisites,
      learningOutcomes,
      targetAudience,
      examSystemIncluded,
      branchIds: branchIds.length > 0 ? branchIds : db.branches.map((b) => b.id),
      instructorIds: instructorIds.length > 0 ? instructorIds : ['inst-1'],
      thumbnail,
      bannerImage,
      description,
      highlights:
        highlights.length > 0
          ? highlights
          : ['Structured Bilingual Lectures', 'Printable PDF Practice Sheets'],
      demoVideoTitle,
      demoYoutubeUrl,
      status,
      featured,
      visibility,
      enrollmentAvailability,
      sequentialAccess,
      certificateCriteria,
      seo,
    };
  }

  // Admin & Teacher: List courses (scoped to assigned for teachers), batches, modules, chapters, and lessons
  app.get('/api/portal/courses', requireAuth, requireRole(['admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    if (actor.role === 'teacher') {
      const assignedIds = getTeacherAssignedCourseIds(actor, db.courses, db.instructors, db.batches);
      return res.json({
        courses: db.courses.filter((c) => assignedIds.has(c.id)),
        batches: db.batches.filter((b) => assignedIds.has(b.courseId)),
        modules: db.modules.filter((m) => assignedIds.has(m.courseId)),
        chapters: db.chapters.filter((ch) => assignedIds.has(ch.courseId)),
        lessons: db.lessons.filter((l) => assignedIds.has(l.courseId)),
        assignedCourseIds: Array.from(assignedIds),
      });
    }
    res.json({
      courses: db.courses,
      batches: db.batches,
      modules: db.modules,
      chapters: db.chapters,
      lessons: db.lessons,
    });
  });

  // Admin & Teacher: Create Course or Combo (supports 5-step Wizard payloads)
  app.post('/api/portal/courses', requireAuth, requireRole(['admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    const parsed = parseCoursePayload((req.body ?? {}) as Record<string, unknown>, db);

    if (!parsed.title || !parsed.subtitle) {
      res.status(400).json({ error: 'Course title and subtitle are required' });
      return;
    }

    const slug = parsed.slug || generateCourseSlug(parsed.title, db.courses);
    const teacherInstIds =
      actor.role === 'teacher'
        ? Array.from(resolveTeacherInstructorIds(actor, db.instructors)).filter((id) =>
            db.instructors.some((i) => i.id === id)
          )
        : [];
    const instructorIds =
      teacherInstIds.length > 0
        ? Array.from(new Set([...teacherInstIds, ...parsed.instructorIds]))
        : parsed.instructorIds;

    const course: Course = {
      id: `crs-${Date.now()}`,
      ...parsed,
      slug,
      instructorIds,
      createdByUserId: actor.id,
      enrolledCount: Math.max(0, Math.round(Number(req.body?.enrolledCount) || 0)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.courses.unshift(course);

    // Optional initial batches from Step 4 of Wizard
    if (Array.isArray(req.body?.initialBatches)) {
      req.body.initialBatches.forEach((rawBatch: Record<string, unknown>, idx: number) => {
        const bName = String(rawBatch?.name ?? '').trim();
        if (!bName) return;
        const bParsed = parseBatchPayload({ ...rawBatch, courseId: course.id }, db);
        db.batches.unshift({
          id: `bat-${Date.now()}-${idx}`,
          ...bParsed,
          courseId: course.id,
          code: bParsed.code || `BAT-${Date.now().toString().slice(-4)}-${idx + 1}`,
        });
      });
    }

    // Optional template sample modules
    if (Array.isArray(req.body?.initialModules)) {
      req.body.initialModules.forEach((modTitle: unknown, idx: number) => {
        const cleanTitle = String(modTitle ?? '').trim();
        if (!cleanTitle) return;
        db.modules.push({
          id: `mod-${Date.now()}-${idx}`,
          courseId: course.id,
          title: cleanTitle,
          orderIndex: idx + 1,
          status: 'published',
        });
      });
    }

    recordAuditLog(
      db,
      actor,
      'COURSE_CREATE',
      course.title,
      `${course.category} · ৳${course.price} (${course.status})`
    );
    saveDb(db);
    res.status(201).json({ course });
  });

  // Admin & Teacher: Modify an existing Course or Combo (teacher must be assigned)
  app.put('/api/portal/courses/:id', requireAuth, requireRole(['admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    const idx = db.courses.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const existing = db.courses[idx];
    if (!canTeacherManageCourse(actor, existing, db.instructors, db.batches)) {
      res.status(403).json({ error: 'You are not assigned to edit this course.' });
      return;
    }
    const parsed = parseCoursePayload((req.body ?? {}) as Record<string, unknown>, db, existing);
    if (!parsed.title || !parsed.subtitle) {
      res.status(400).json({ error: 'Course title and subtitle are required' });
      return;
    }

    const updated: Course = {
      ...existing,
      ...parsed,
      slug: parsed.slug || existing.slug,
      updatedAt: new Date().toISOString(),
    };
    db.courses[idx] = updated;
    for (const enr of db.enrollments) {
      if (enr.courseId === updated.id) {
        enr.courseTitle = updated.title;
      }
    }
    recordAuditLog(
      db,
      actor,
      'COURSE_UPDATE',
      updated.title,
      `${updated.category} · ৳${updated.price} (${updated.status})`
    );
    saveDb(db);
    res.json({ course: updated });
  });

  // Admin & Teacher: Switch Course Status (draft | published | active | unpublished | archived)
  app.patch(
    '/api/portal/courses/:id/status',
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
        res.status(403).json({ error: 'You are not assigned to change status for this course.' });
        return;
      }
      const nextStatus = req.body?.status as CourseStatus;
      if (!ALLOWED_COURSE_STATUSES.includes(nextStatus)) {
        res.status(400).json({ error: 'Status must be draft, published, active, unpublished, or archived' });
        return;
      }
      const prevStatus = course.status;
      course.status = nextStatus;
      course.updatedAt = new Date().toISOString();
      recordAuditLog(
        db,
        actor,
        'COURSE_STATUS',
        course.title,
        `Status changed ${prevStatus} -> ${nextStatus}`
      );
      saveDb(db);
      res.json({ course });
    }
  );

  // Admin & Teacher: Duplicate Course (clones as Draft along with modules, chapters, and lessons)
  app.post(
    '/api/portal/courses/:id/duplicate',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const source = db.courses.find((c) => c.id === req.params.id);
      if (!source) {
        res.status(404).json({ error: 'Course not found' });
        return;
      }
      if (!canTeacherManageCourse(actor, source, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to duplicate this course.' });
        return;
      }
      const suffix = Date.now().toString().slice(-4);
      const cloneId = `crs-${Date.now()}`;
      const clone: Course = {
        ...source,
        id: cloneId,
        slug: generateCourseSlug(`${source.slug}-copy-${suffix}`, db.courses),
        title: `${source.title} (Copy)`,
        enrolledCount: 0,
        status: 'draft',
        createdByUserId: actor.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.courses.unshift(clone);

      const modIdMap = new Map<string, string>();
      const sourceModules = db.modules.filter((m) => m.courseId === source.id);
      sourceModules.forEach((m, i) => {
        const newModId = `mod-${Date.now()}-${i}`;
        modIdMap.set(m.id, newModId);
        db.modules.push({ ...m, id: newModId, courseId: clone.id });
      });

      const chapIdMap = new Map<string, string>();
      const sourceChapters = db.chapters.filter((ch) => ch.courseId === source.id);
      sourceChapters.forEach((ch, i) => {
        const newChapId = `chp-${Date.now()}-${i}`;
        chapIdMap.set(ch.id, newChapId);
        db.chapters.push({
          ...ch,
          id: newChapId,
          courseId: clone.id,
          moduleId: modIdMap.get(ch.moduleId) ?? ch.moduleId,
        });
      });

      const sourceLessons = db.lessons.filter((l) => l.courseId === source.id);
      sourceLessons.forEach((l, i) => {
        db.lessons.push({
          ...l,
          id: `les-${Date.now()}-${i}`,
          courseId: clone.id,
          moduleId: l.moduleId ? modIdMap.get(l.moduleId) : undefined,
          chapterId: l.chapterId ? chapIdMap.get(l.chapterId) : undefined,
        });
      });

      recordAuditLog(
        db,
        actor,
        'COURSE_DUPLICATE',
        clone.title,
        `Duplicated from "${source.title}" (${sourceLessons.length} lessons)`
      );
      saveDb(db);
      res.status(201).json({ course: clone });
    }
  );

  app.delete('/api/portal/courses/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const idx = db.courses.findIndex((c) => c.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }
    const [removed] = db.courses.splice(idx, 1);
    db.recycleBin.unshift({
      id: `bin-${Date.now()}`,
      entityType: 'course',
      originalId: removed.id,
      label: removed.title,
      deletedBy: req.authUser?.name ?? 'Admin',
      deletedAt: new Date().toISOString(),
      snapshot: removed,
    });
    recordAuditLog(db, req.authUser!, 'COURSE_DELETE', removed.title, 'Moved to Recycle Bin');
    saveDb(db);
    res.json({ ok: true, deletedId: removed.id });
  });

  // ============================================================================
  // BATCHES CRUD (Admin, Teacher & Branch Manager)
  // ============================================================================
  const ALLOWED_BATCH_MODES: CourseBatch['mode'][] = ['Online Live', 'Offline Branch', 'Hybrid'];
  const ALLOWED_BATCH_STATUSES: CourseBatch['status'][] = ['open', 'running', 'closed'];

  function parseBatchPayload(
    body: Record<string, unknown>,
    db: ReturnType<typeof getDb>,
    existing?: CourseBatch
  ) {
    const courseId = String(body?.courseId ?? existing?.courseId ?? '').trim();
    const name = String(body?.name ?? existing?.name ?? '').trim().slice(0, 140);
    const code = String(body?.code ?? existing?.code ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 32);
    const branchId = String(body?.branchId ?? existing?.branchId ?? db.branches[0]?.id ?? 'br-mirpur').trim();
    const instructorId = String(
      body?.instructorId ?? existing?.instructorId ?? db.instructors[0]?.id ?? 'inst-1'
    ).trim();
    const schedule = String(body?.schedule ?? existing?.schedule ?? 'Sun · Tue · Thu (4:00 PM)')
      .trim()
      .slice(0, 140);
    const startDate = String(body?.startDate ?? existing?.startDate ?? '2026-05-01').trim().slice(0, 40);
    const endDate =
      body?.endDate !== undefined ? String(body.endDate).trim().slice(0, 40) || undefined : existing?.endDate;
    const classDurationMinutes =
      body?.classDurationMinutes !== undefined
        ? Math.max(15, Math.min(300, Math.round(Number(body.classDurationMinutes) || 60)))
        : existing?.classDurationMinutes ?? 60;
    const classroomOrMeeting =
      body?.classroomOrMeeting !== undefined
        ? String(body.classroomOrMeeting).trim().slice(0, 180) || undefined
        : existing?.classroomOrMeeting;
    const seatLimit = Math.max(1, Math.min(5000, Math.round(Number(body?.seatLimit ?? existing?.seatLimit ?? 60) || 60)));
    const rawEnrolled = Number(body?.enrolledSeats ?? existing?.enrolledSeats ?? 0);
    const enrolledSeats = Math.max(0, Math.min(seatLimit, Math.round(Number.isFinite(rawEnrolled) ? rawEnrolled : 0)));
    const rawMode = String(body?.mode ?? existing?.mode ?? 'Hybrid');
    const mode: CourseBatch['mode'] = ALLOWED_BATCH_MODES.includes(rawMode as CourseBatch['mode'])
      ? (rawMode as CourseBatch['mode'])
      : 'Hybrid';
    const rawStatus = String(body?.status ?? existing?.status ?? 'open');
    const status: CourseBatch['status'] = ALLOWED_BATCH_STATUSES.includes(rawStatus as CourseBatch['status'])
      ? (rawStatus as CourseBatch['status'])
      : 'open';

    return {
      courseId,
      name,
      code,
      branchId,
      instructorId,
      schedule,
      startDate,
      endDate,
      classDurationMinutes,
      classroomOrMeeting,
      seatLimit,
      enrolledSeats,
      mode,
      status,
    };
  }

  app.post(
    '/api/portal/batches',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const parsed = parseBatchPayload((req.body ?? {}) as Record<string, unknown>, db);
      if (actor.role === 'branch') {
        if (!actor.branchId) {
          res.status(403).json({ error: 'Branch coordinator account is not linked to a campus.' });
          return;
        }
        parsed.branchId = actor.branchId;
      }
      if (!parsed.courseId || !parsed.name || !parsed.code) {
        res.status(400).json({ error: 'Course, batch name, and batch code are required' });
        return;
      }
      const course = db.courses.find((c) => c.id === parsed.courseId);
      if (!course) {
        res.status(404).json({ error: 'Target course not found' });
        return;
      }
      if (actor.role === 'teacher' && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to create batches for this course.' });
        return;
      }
      const branchCheck = assertBranchOperationalForTransactions(parsed.branchId);
      if (!branchCheck.ok) {
        res.status(403).json({ error: branchCheck.error });
        return;
      }
      const batch: CourseBatch = {
        id: `bat-${Date.now()}`,
        ...parsed,
      };
      db.batches.unshift(batch);
      recordAuditLog(db, actor, 'BATCH_CREATE', batch.name, `${batch.code} · ${batch.mode}`);
      saveDb(db);
      res.status(201).json({ batch });
    }
  );

  app.put(
    '/api/portal/batches/:id',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.batches.findIndex((b) => b.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Batch not found' });
        return;
      }
      const existing = db.batches[idx];
      if (actor.role === 'branch' && existing.branchId !== actor.branchId) {
        res.status(403).json({ error: 'Branch coordinators can only edit batches belonging to their campus.' });
        return;
      }
      const course = db.courses.find((c) => c.id === existing.courseId);
      if (actor.role === 'teacher' && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to edit batches for this course.' });
        return;
      }
      const parsed = parseBatchPayload((req.body ?? {}) as Record<string, unknown>, db, existing);
      if (actor.role === 'branch' && actor.branchId) {
        parsed.branchId = actor.branchId;
      }
      if (!parsed.name || !parsed.code) {
        res.status(400).json({ error: 'Batch name and code are required' });
        return;
      }
      const updated: CourseBatch = { ...existing, ...parsed };
      db.batches[idx] = updated;
      for (const l of db.lessons) {
        if (l.batchId === updated.id) {
          l.batchName = updated.name;
        }
      }
      recordAuditLog(db, actor, 'BATCH_UPDATE', updated.name, `${updated.code} · ${updated.status}`);
      saveDb(db);
      res.json({ batch: updated });
    }
  );

  app.patch(
    '/api/portal/batches/:id/status',
    requireAuth,
    requireRole(['admin', 'teacher', 'branch']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const batch = db.batches.find((b) => b.id === req.params.id);
      if (!batch) {
        res.status(404).json({ error: 'Batch not found' });
        return;
      }
      if (actor.role === 'branch' && batch.branchId !== actor.branchId) {
        res.status(403).json({ error: 'Branch coordinators can only update batches belonging to their campus.' });
        return;
      }
      const course = db.courses.find((c) => c.id === batch.courseId);
      if (actor.role === 'teacher' && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to manage this batch.' });
        return;
      }
      const nextStatus = req.body?.status;
      if (!ALLOWED_BATCH_STATUSES.includes(nextStatus)) {
        res.status(400).json({ error: 'Status must be open, running, or closed' });
        return;
      }
      const prevStatus = batch.status;
      batch.status = nextStatus;
      recordAuditLog(db, actor, 'BATCH_STATUS', batch.name, `${prevStatus} -> ${nextStatus}`);
      saveDb(db);
      res.json({ batch });
    }
  );

  app.delete(
    '/api/portal/batches/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.batches.findIndex((b) => b.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Batch not found' });
        return;
      }
      const existing = db.batches[idx];
      const course = db.courses.find((c) => c.id === existing.courseId);
      if (actor.role === 'teacher' && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to delete this batch.' });
        return;
      }
      const [removed] = db.batches.splice(idx, 1);
      for (const l of db.lessons) {
        if (l.batchId === removed.id) {
          l.batchId = null;
          l.batchName = undefined;
        }
      }
      db.recycleBin.unshift({
        id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        entityType: 'batch',
        originalId: removed.id,
        label: `${removed.name} (${removed.code})`,
        deletedBy: actor.name,
        deletedAt: new Date().toISOString(),
        snapshot: removed,
      });
      recordAuditLog(db, actor, 'BATCH_DELETE', removed.name, 'Moved to Recycle Bin');
      saveDb(db);
      res.json({ ok: true, deletedId: removed.id });
    }
  );

  // ============================================================================
  // LECTURES, LIVE CLASSES & RECORDED VIDEOS CRUD (Admin & Teacher)
  // ============================================================================
  const ALLOWED_LESSON_TYPES: LessonType[] = [
    'recorded',
    'video',
    'text',
    'audio',
    'lecture_sheet',
    'pdf_notes',
    'document',
    'external',
    'quiz',
    'assignment',
    'live',
    'practice_test',
  ];
  const ALLOWED_LIVE_STATUSES: LiveClassStatus[] = ['scheduled', 'live_now', 'ended'];

  function parseLessonPayload(
    body: Record<string, unknown>,
    db: ReturnType<typeof getDb>,
    existing?: CourseLesson
  ) {
    const courseId = String(body?.courseId ?? existing?.courseId ?? '').trim();
    const rawBatchId = body?.batchId !== undefined ? body.batchId : existing?.batchId;
    const batchId = rawBatchId ? String(rawBatchId).trim() : null;
    const linkedBatch = batchId ? db.batches.find((b) => b.id === batchId) : undefined;
    const batchName = linkedBatch
      ? linkedBatch.name
      : typeof body?.batchName === 'string' && body.batchName.trim()
        ? body.batchName.trim()
        : existing?.batchName;

    const rawType = String(body?.lessonType ?? existing?.lessonType ?? 'recorded');
    const lessonType: LessonType = ALLOWED_LESSON_TYPES.includes(rawType as LessonType)
      ? (rawType as LessonType)
      : 'recorded';

    const title = String(body?.title ?? existing?.title ?? '').trim().slice(0, 180);

    const moduleId = body?.moduleId !== undefined
      ? (body.moduleId ? String(body.moduleId).trim() : undefined)
      : existing?.moduleId;
    const linkedMod = moduleId ? db.modules.find((m) => m.id === moduleId && m.courseId === courseId) : undefined;
    const chapterId = body?.chapterId !== undefined
      ? (body.chapterId ? String(body.chapterId).trim() : undefined)
      : existing?.chapterId;
    const linkedChapter = chapterId
      ? db.chapters.find((ch) => ch.id === chapterId && ch.courseId === courseId)
      : undefined;

    const moduleName = linkedMod
      ? linkedMod.title
      : String(body?.moduleName ?? existing?.moduleName ?? 'Module 1: Core Grammar')
          .trim()
          .slice(0, 140);
    const duration = String(body?.duration ?? existing?.duration ?? '35:00').trim().slice(0, 40);
    const sheetSummary =
      String(body?.sheetSummary ?? existing?.sheetSummary ?? '').trim().slice(0, 2000) ||
      'Lecture notes and practice exercises included.';
    const isFreePreview =
      typeof body?.isFreePreview === 'boolean'
        ? body.isFreePreview
        : existing?.isFreePreview ?? false;
    const completionRequired =
      typeof body?.completionRequired === 'boolean'
        ? body.completionRequired
        : existing?.completionRequired ?? true;
    const sequentialLock =
      typeof body?.sequentialLock === 'boolean'
        ? body.sequentialLock
        : existing?.sequentialLock ?? false;
    const status: 'draft' | 'published' =
      body?.status === 'draft' ? 'draft' : body?.status === 'published' ? 'published' : existing?.status ?? 'published';

    const videoUrl =
      typeof body?.videoUrl === 'string'
        ? sanitizeSafeUrl(body.videoUrl, '')
        : existing?.videoUrl ?? '';
    const audioUrl =
      body?.audioUrl !== undefined
        ? sanitizeSafeUrl(String(body.audioUrl), '') || undefined
        : existing?.audioUrl;
    const textContent =
      body?.textContent !== undefined
        ? String(body.textContent).trim().slice(0, 15000) || undefined
        : existing?.textContent;
    const lectureSheetUrl =
      typeof body?.lectureSheetUrl === 'string'
        ? sanitizeSafeUrl(body.lectureSheetUrl, '')
        : existing?.lectureSheetUrl ?? '';
    const externalUrl =
      body?.externalUrl !== undefined
        ? sanitizeSafeUrl(String(body.externalUrl), '') || undefined
        : existing?.externalUrl;
    const liveJoinUrl =
      typeof body?.liveJoinUrl === 'string'
        ? sanitizeSafeUrl(body.liveJoinUrl, '')
        : existing?.liveJoinUrl ?? '';
    const linkedExamId =
      body?.linkedExamId !== undefined
        ? String(body.linkedExamId).trim() || undefined
        : existing?.linkedExamId;
    const linkedAssignmentId =
      body?.linkedAssignmentId !== undefined
        ? String(body.linkedAssignmentId).trim() || undefined
        : existing?.linkedAssignmentId;

    const ALLOWED_RESOURCE_KINDS: CourseResource['kind'][] = ['pdf', 'document', 'audio', 'external', 'slides'];
    const resources: CourseResource[] | undefined = Array.isArray(body?.resources)
      ? body.resources
          .map((r: Record<string, unknown>, i: number) => {
            const rawKind = String(r?.kind ?? r?.type ?? 'external').trim().toLowerCase();
            const mappedKind =
              rawKind === 'doc'
                ? 'document'
                : rawKind === 'link' || rawKind === 'video'
                  ? 'external'
                  : rawKind;
            const kind: CourseResource['kind'] = ALLOWED_RESOURCE_KINDS.includes(
              mappedKind as CourseResource['kind']
            )
              ? (mappedKind as CourseResource['kind'])
              : 'external';
            return {
              id: String(r?.id ?? `res-${Date.now()}-${i}`),
              title: String(r?.title ?? '').trim().slice(0, 120),
              kind,
              url: sanitizeSafeUrl(String(r?.url ?? ''), ''),
              ...(r?.fileSize ? { fileSize: String(r.fileSize).trim().slice(0, 40) } : {}),
            };
          })
          .filter((r) => r.title && r.url)
      : existing?.resources;

    const rawLiveStatus = String(body?.liveStatus ?? existing?.liveStatus ?? 'scheduled');
    const liveStatus: LiveClassStatus | undefined =
      lessonType === 'live'
        ? ALLOWED_LIVE_STATUSES.includes(rawLiveStatus as LiveClassStatus)
          ? (rawLiveStatus as LiveClassStatus)
          : 'scheduled'
        : undefined;
    const scheduledAt =
      lessonType === 'live'
        ? String(body?.scheduledAt ?? existing?.scheduledAt ?? '').trim().slice(0, 60)
        : undefined;

    return {
      courseId,
      moduleId: linkedMod?.id ?? moduleId,
      chapterId: linkedChapter?.id ?? chapterId,
      batchId: linkedBatch ? linkedBatch.id : batchId,
      batchName,
      lessonType,
      title,
      moduleName,
      duration,
      videoPreviewTitle: title,
      videoUrl:
        (lessonType === 'recorded' || lessonType === 'video') && !videoUrl
          ? 'https://www.youtube.com/embed/M7lc1UVf-VE'
          : videoUrl,
      audioUrl,
      textContent,
      lectureSheetUrl,
      externalUrl,
      liveJoinUrl,
      liveStatus,
      scheduledAt,
      linkedExamId,
      linkedAssignmentId,
      resources,
      sheetSummary,
      isFreePreview,
      completionRequired,
      sequentialLock,
      status,
    };
  }

  // Admin & Teacher: Add Lecture / Live Class / Recorded Video
  app.post(
    '/api/portal/lessons',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const parsed = parseLessonPayload((req.body ?? {}) as Record<string, unknown>, db);

      if (!parsed.courseId || !parsed.title) {
        res.status(400).json({ error: 'Course and lecture title are required' });
        return;
      }
      const course = db.courses.find((c) => c.id === parsed.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to add lessons to this course.' });
        return;
      }

      const existingCount = db.lessons.filter((l) => l.courseId === parsed.courseId).length;
      const lesson: CourseLesson = {
        id: `les-${Date.now()}`,
        ...parsed,
        orderIndex: existingCount + 1,
      };
      db.lessons.push(lesson);
      recordAuditLog(db, actor, 'CURRICULUM_UPDATE', course?.title ?? parsed.courseId, `Added lesson "${lesson.title}"`);
      saveDb(db);
      res.status(201).json({ lesson });
    }
  );

  // Admin & Teacher: Edit Lecture / Live Class / Recorded Video
  app.put(
    '/api/portal/lessons/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.lessons.findIndex((l) => l.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Lesson not found' });
        return;
      }
      const existing = db.lessons[idx];
      const course = db.courses.find((c) => c.id === existing.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to edit lessons in this course.' });
        return;
      }
      const parsed = parseLessonPayload((req.body ?? {}) as Record<string, unknown>, db, existing);
      if (!parsed.title) {
        res.status(400).json({ error: 'Lecture title is required' });
        return;
      }
      const updated: CourseLesson = {
        ...existing,
        ...parsed,
      };
      db.lessons[idx] = updated;
      saveDb(db);
      res.json({ lesson: updated });
    }
  );

  // Admin & Teacher: Quick Live Status Switch ('scheduled' | 'live_now' | 'ended')
  app.patch(
    '/api/portal/lessons/:id/live-status',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const lesson = db.lessons.find((l) => l.id === req.params.id);
      if (!lesson) {
        res.status(404).json({ error: 'Lesson not found' });
        return;
      }
      const course = db.courses.find((c) => c.id === lesson.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to manage this lesson.' });
        return;
      }
      const nextStatus = req.body?.liveStatus;
      if (!ALLOWED_LIVE_STATUSES.includes(nextStatus)) {
        res.status(400).json({ error: 'Live status must be scheduled, live_now, or ended' });
        return;
      }
      lesson.lessonType = 'live';
      lesson.liveStatus = nextStatus;
      if (typeof req.body?.videoUrl === 'string' && req.body.videoUrl.trim()) {
        lesson.videoUrl = sanitizeSafeUrl(req.body.videoUrl, lesson.videoUrl);
      }
      saveDb(db);
      res.json({ lesson });
    }
  );

  // Admin & Teacher: Reorder lesson up or down within course
  app.post(
    '/api/portal/lessons/:id/reorder',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const target = db.lessons.find((l) => l.id === req.params.id);
      if (!target) {
        res.status(404).json({ error: 'Lesson not found' });
        return;
      }
      const course = db.courses.find((c) => c.id === target.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to reorder lessons in this course.' });
        return;
      }
      const dir = req.body?.direction === 'up' ? -1 : 1;
      const courseLessons = db.lessons
        .filter((l) => l.courseId === target.courseId)
        .sort((a, b) => a.orderIndex - b.orderIndex);
      const pos = courseLessons.findIndex((l) => l.id === target.id);
      const swapPos = pos + dir;
      if (pos >= 0 && swapPos >= 0 && swapPos < courseLessons.length) {
        const temp = courseLessons[pos];
        courseLessons[pos] = courseLessons[swapPos];
        courseLessons[swapPos] = temp;
      }
      courseLessons.forEach((l, i) => {
        l.orderIndex = i + 1;
      });
      saveDb(db);
      res.json({ lessons: courseLessons });
    }
  );

  // Admin & Teacher: Duplicate lesson inside course
  app.post(
    '/api/portal/lessons/:id/duplicate',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const source = db.lessons.find((l) => l.id === req.params.id);
      if (!source) {
        res.status(404).json({ error: 'Lesson not found' });
        return;
      }
      const course = db.courses.find((c) => c.id === source.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to duplicate lessons in this course.' });
        return;
      }
      const existingCount = db.lessons.filter((l) => l.courseId === source.courseId).length;
      const clone: CourseLesson = {
        ...source,
        id: `les-${Date.now()}`,
        title: `${source.title} (Copy)`,
        videoPreviewTitle: `${source.title} (Copy)`,
        orderIndex: existingCount + 1,
      };
      db.lessons.push(clone);
      saveDb(db);
      res.status(201).json({ lesson: clone });
    }
  );

  // Admin & Teacher: Delete Lesson
  app.delete(
    '/api/portal/lessons/:id',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const idx = db.lessons.findIndex((l) => l.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Lesson not found' });
        return;
      }
      const existing = db.lessons[idx];
      const course = db.courses.find((c) => c.id === existing.courseId);
      if (!canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
        res.status(403).json({ error: 'You are not assigned to delete lessons in this course.' });
        return;
      }
      const [removed] = db.lessons.splice(idx, 1);
      db.lessons
        .filter((l) => l.courseId === removed.courseId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .forEach((l, i) => {
          l.orderIndex = i + 1;
        });
      db.recycleBin.unshift({
        id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        entityType: 'lesson',
        originalId: removed.id,
        label: removed.title,
        deletedBy: actor.name,
        deletedAt: new Date().toISOString(),
        snapshot: removed,
      });
      recordAuditLog(db, actor, 'LESSON_DELETE', removed.title, 'Moved to Recycle Bin');
      saveDb(db);
      res.json({ ok: true, deletedId: removed.id });
    }
  );

  // Admin & Teacher: Create MCQ Exam
  app.post(
    '/api/portal/exams',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const user = req.authUser!;
      const title = String(req.body?.title ?? '').trim();
      const category = String(req.body?.category ?? 'HSC English').trim();
      const courseId = req.body?.courseId ? String(req.body.courseId) : null;
      const durationMinutes = Math.max(5, Number(req.body?.durationMinutes) || 15);
      const visibility = req.body?.visibility === 'course' ? 'course' : 'public';
      const questionsInput = Array.isArray(req.body?.questions) ? req.body.questions : [];

      if (!title || questionsInput.length === 0) {
        res.status(400).json({ error: 'Exam title and at least one MCQ question are required' });
        return;
      }

      const questions: ExamQuestion[] = questionsInput.map((q: Record<string, unknown>, idx: number) => ({
        id: `q-${Date.now()}-${idx}`,
        prompt: String(q.prompt ?? '').trim(),
        options: Array.isArray(q.options) ? q.options.map((o) => String(o)) : ['A', 'B', 'C', 'D'],
        correctIndex: Math.min(3, Math.max(0, Number(q.correctIndex) || 0)),
        explanation: String(q.explanation ?? 'Verified by Aloms English Center faculty.').trim(),
        marks: Math.max(1, Number(q.marks) || 2),
      }));

      const db = getDb();
      const exam: Exam = {
        id: `exm-${Date.now()}`,
        title,
        courseId,
        category,
        durationMinutes,
        passPercentage: 50,
        visibility,
        teacherId: user.id,
        questions,
        createdAt: new Date().toISOString(),
      };
      db.exams.unshift(exam);
      saveDb(db);
      res.status(201).json({ exam });
    }
  );

  // Teacher & Admin: Inspect Exam Submissions (scoped for teachers)
  app.get(
    '/api/portal/exams/:id/attempts',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const db = getDb();
      const actor = req.authUser!;
      const exam = db.exams.find((e) => e.id === req.params.id);
      if (!exam) {
        res.status(404).json({ error: 'Exam not found' });
        return;
      }
      if (actor.role === 'teacher') {
        const course = exam.courseId ? db.courses.find((c) => c.id === exam.courseId) : undefined;
        if (exam.teacherId !== actor.id && !canTeacherManageCourse(actor, course, db.instructors, db.batches)) {
          res.status(403).json({ error: 'You can only view attempts for your assigned courses/exams.' });
          return;
        }
      }
      const attempts = db.examAttempts
        .filter((a) => a.examId === req.params.id)
        .sort((a, b) => (b.submittedAt > a.submittedAt ? 1 : -1));
      res.json({ attempts });
    }
  );

  // Teacher & Admin: Award Bonus XP & Coaching Feedback to a Student
  app.post(
    '/api/portal/teacher/award-xp',
    requireAuth,
    requireRole(['admin', 'teacher']),
    (req: AuthedRequest, res) => {
      const studentId = String(req.body?.studentId ?? '').trim();
      const xpDelta = Math.min(200, Math.max(5, Math.round(Number(req.body?.xpDelta) || 25)));
      const reason = String(req.body?.reason ?? 'Excellent class participation').trim().slice(0, 140);
      const db = getDb();
      const actor = req.authUser!;
      const student = db.users.find((u) => u.id === studentId && u.role === 'student');
      if (!student) {
        res.status(404).json({ error: 'Student not found' });
        return;
      }
      if (actor.role === 'teacher') {
        const assignedCourseIds = getTeacherAssignedCourseIds(
          actor,
          db.courses,
          db.instructors,
          db.batches
        );
        const enrolledWithTeacher = db.enrollments.some(
          (e) =>
            e.userId === student.id &&
            e.status === 'approved' &&
            assignedCourseIds.has(e.courseId)
        );
        if (!enrolledWithTeacher) {
          res.status(403).json({
            error: 'Teachers can only award XP to students enrolled in their assigned courses or batches.',
          });
          return;
        }
      }
      const existing = db.rewardsByUser[student.id] ?? {
        userId: student.id,
        studentName: student.name,
        branchId: student.branchId,
        xp: 0,
        streakDays: 1,
        badges: ['Active Learner'],
        showOnLeaderboard: true,
        completedScormIds: [],
        updatedAt: new Date().toISOString(),
      };
      existing.xp += xpDelta;
      existing.updatedAt = new Date().toISOString();
      if (existing.xp >= 500 && !existing.badges.includes('Faculty Star')) {
        existing.badges.push('Faculty Star');
      }
      db.rewardsByUser[student.id] = existing;
      recordAuditLog(
        db,
        req.authUser!,
        'TEACHER_AWARD_XP',
        student.name,
        `+${xpDelta} XP · ${reason}`
      );
      saveDb(db);
      res.json({ rewards: existing });
    }
  );

  // Admin: Create Branch
  app.post('/api/portal/branches', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const name = String(req.body?.name ?? '').trim();
    const code = String(req.body?.code ?? '').trim().toUpperCase();
    const city = String(req.body?.city ?? '').trim();
    const address = String(req.body?.address ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const managerName = String(req.body?.managerName ?? '').trim();
    const rawStatus = String(req.body?.status ?? 'active').trim();
    const status: Branch['status'] =
      rawStatus === 'inactive' || rawStatus === 'suspended' || rawStatus === 'archived'
        ? rawStatus
        : 'active';
    const image = sanitizeSafeUrl(String(req.body?.image ?? ''), '');

    if (!name || !code || !city || !address) {
      res.status(400).json({ error: 'Branch name, code, city, and address are required' });
      return;
    }

    const db = getDb();
    if (db.branches.some((b) => b.code.toUpperCase() === code)) {
      res.status(409).json({ error: `Branch code "${code}" already exists.` });
      return;
    }
    const now = new Date().toISOString();
    const branch: Branch = {
      id: `br-${Date.now()}`,
      name,
      code,
      city,
      address,
      phone: phone || '09617331133',
      managerName: managerName || 'Branch Coordinator',
      activeStudents: Math.max(0, Number(req.body?.activeStudents) || 0),
      status,
      image: image || undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.branches.push(branch);
    recordAuditLog(db, req.authUser!, 'BRANCH_CREATE', branch.name, `${branch.code} (${branch.city})`);
    saveDb(db);
    res.status(201).json({ branch });
  });

  // Main Admin (or own-campus Branch Coordinator for non-status fields): Update / Edit Branch
  app.put('/api/portal/branches/:id', requireAuth, requireRole(['admin', 'branch']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const db = getDb();
    const branch = db.branches.find((b) => b.id === req.params.id);
    if (!branch) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }
    if (actor.role === 'branch' && actor.branchId !== branch.id) {
      res.status(403).json({ error: 'Branch coordinators can only modify their own campus profile.' });
      return;
    }
    const name = String(req.body?.name ?? branch.name).trim();
    const code = String(req.body?.code ?? branch.code).trim().toUpperCase();
    const city = String(req.body?.city ?? branch.city).trim();
    const address = String(req.body?.address ?? branch.address).trim();
    const phone = String(req.body?.phone ?? branch.phone).trim();
    const managerName = String(req.body?.managerName ?? branch.managerName).trim();
    if (!name || !code || !city || !address) {
      res.status(400).json({ error: 'Branch name, code, city, and address are required' });
      return;
    }
    if (db.branches.some((b) => b.id !== branch.id && b.code.toUpperCase() === code)) {
      res.status(409).json({ error: `Branch code "${code}" already exists.` });
      return;
    }
    branch.name = name;
    branch.code = code;
    branch.city = city;
    branch.address = address;
    branch.phone = phone || branch.phone;
    branch.managerName = managerName || branch.managerName;
    if (req.body?.image !== undefined) {
      const cleaned = sanitizeSafeUrl(String(req.body.image ?? ''), '');
      branch.image = cleaned || undefined;
    }
    if (req.body?.activeStudents !== undefined && actor.role === 'admin') {
      branch.activeStudents = Math.max(0, Number(req.body.activeStudents) || 0);
    }
    const nextStatus = req.body?.status as Branch['status'] | undefined;
    if (
      actor.role === 'admin' &&
      nextStatus &&
      ['active', 'inactive', 'suspended', 'archived'].includes(nextStatus) &&
      nextStatus !== branch.status
    ) {
      const prevStatus = branch.status;
      branch.status = nextStatus;
      const now = new Date().toISOString();
      branch.updatedAt = now;
      if (nextStatus === 'archived') branch.archivedAt = now;
      else if (nextStatus === 'active') branch.archivedAt = null;
      db.branchStatusHistory.unshift({
        id: `bsh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        branchId: branch.id,
        branchName: branch.name,
        previousStatus: prevStatus,
        newStatus: nextStatus,
        reason: String(req.body?.reason ?? 'Updated via Branch Editor').trim(),
        actorId: actor.id,
        actorName: actor.name,
        createdAt: now,
      });
    } else {
      branch.updatedAt = new Date().toISOString();
    }
    recordAuditLog(db, actor, 'BRANCH_UPDATE', branch.name, `${branch.code} (${branch.status})`);
    saveDb(db);
    res.json({ branch, branches: actor.role === 'admin' ? db.branches : [branch] });
  });

  // Admin: Soft-Delete Branch to Recycle Bin
  app.delete('/api/portal/branches/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const idx = db.branches.findIndex((b) => b.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Branch not found' });
      return;
    }
    const [removed] = db.branches.splice(idx, 1);
    db.recycleBin.unshift({
      id: `bin-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      entityType: 'branch',
      originalId: removed.id,
      label: `${removed.name} (${removed.code})`,
      deletedBy: req.authUser!.name,
      deletedAt: new Date().toISOString(),
      snapshot: removed,
    });
    recordAuditLog(db, req.authUser!, 'BRANCH_DELETE', removed.name, 'Moved to Recycle Bin');
    saveDb(db);
    res.json({ deletedId: removed.id, branches: db.branches });
  });

  // Main Admin Only: Create, Update, Approve/Reject & Delete Enrollments (with Branch Status, Seat & Duplicate Guards)
  app.post(
    '/api/portal/enrollments',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const user = req.authUser!;
      const b = req.body ?? {};
      const studentName = String(b.studentName ?? '').trim();
      const studentEmail = String(b.studentEmail ?? '').trim().toLowerCase();
      const courseId = String(b.courseId ?? '').trim();
      const batchId = b.batchId ? String(b.batchId).trim() : null;
      const requestedBranchId = String(b.branchId ?? '').trim();
      const paymentMethod = String(b.paymentMethod ?? 'Branch Cash').trim();
      const amountPaid = Math.max(0, Number(b.amountPaid) || 0);
      const trxId = String(b.trxId ?? '').trim();
      const expiresAt = b.expiresAt ? String(b.expiresAt).trim() : null;
      const status = (
        ['approved', 'pending', 'rejected'].includes(b.status) ? b.status : 'pending'
      ) as Enrollment['status'];

      if (!studentName || !studentEmail || !courseId) {
        res.status(400).json({ error: 'Student name, email, and course are required.' });
        return;
      }

      const db = getDb();
      const course = db.courses.find((c) => c.id === courseId);
      if (!course) {
        res.status(404).json({ error: 'Selected course was not found.' });
        return;
      }

      const matchedUser =
        (b.userId ? db.users.find((u) => u.id === String(b.userId)) : undefined) ??
        db.users.find((u) => u.email.toLowerCase() === studentEmail);
      const userId = matchedUser?.id ?? `u-walkin-${Date.now()}`;

      const dup = db.enrollments.find(
        (e) =>
          (e.userId === userId || e.studentEmail.toLowerCase() === studentEmail) &&
          e.courseId === course.id &&
          (e.status === 'approved' || e.status === 'pending')
      );
      if (dup) {
        res.status(409).json({
          error: `Duplicate guard: ${studentName} already has a ${dup.status} enrollment in "${course.title}".`,
        });
        return;
      }

      const targetBatch = batchId
        ? db.batches.find((bat) => bat.id === batchId && bat.courseId === course.id)
        : undefined;
      if (batchId && !targetBatch) {
        res.status(400).json({ error: 'Selected batch does not belong to this course.' });
        return;
      }
      if (targetBatch && status === 'approved' && computeBatchSeatUsage(targetBatch).isFull) {
        res.status(409).json({ error: `Batch "${targetBatch.name}" is already at full capacity.` });
        return;
      }

      const activeFallback = db.branches.find((br) => br.status === 'active')?.id ?? 'online';
      const resolvedBranchId = targetBatch?.branchId || requestedBranchId || activeFallback;

      if (resolvedBranchId !== 'online') {
        const branchOpCheck = assertBranchOperationalForTransactions(resolvedBranchId);
        if (!branchOpCheck.ok) {
          res.status(403).json({ error: branchOpCheck.error });
          return;
        }
      }

      const invoiceNo = `INV-AEC-${Math.floor(100000 + Math.random() * 900000)}`;

      const enrollment: Enrollment = {
        id: `enr-${Date.now()}`,
        userId,
        studentName,
        studentEmail,
        courseId: course.id,
        courseTitle: course.title,
        batchId: targetBatch?.id ?? null,
        batchName: targetBatch?.name,
        branchId: resolvedBranchId,
        paymentMethod: paymentMethod as Enrollment['paymentMethod'],
        trxId: trxId || (paymentMethod === 'Branch Cash' ? `CASH-${Date.now().toString().slice(-4)}` : undefined),
        invoiceNo,
        amountPaid,
        status,
        completedLessonIds: [],
        expiresAt,
        history: [
          {
            id: `eh-${Date.now()}`,
            action: 'created',
            note: `Manual enrollment by ${user.name} (${status})${targetBatch ? ` · ${targetBatch.name}` : ''}`,
            actorName: user.name,
            createdAt: new Date().toISOString(),
          },
        ],
        enrolledAt: new Date().toISOString(),
      };

      db.enrollments.unshift(enrollment);
      if (status === 'approved') {
        course.enrolledCount += 1;
        if (targetBatch) targetBatch.enrolledSeats += 1;
      }

      db.transactions.unshift({
        id: `txn-${Date.now()}`,
        invoiceNo,
        referenceType: 'course',
        referenceId: enrollment.id,
        userId,
        payerName: studentName,
        gateway: paymentMethod as PaymentGatewayType,
        walletOrLast4: studentEmail.slice(0, 14),
        trxId: enrollment.trxId || invoiceNo,
        subtotal: amountPaid,
        discountAmount: 0,
        deliveryFee: 0,
        totalAmount: amountPaid,
        status: status === 'approved' ? 'completed' : 'pending_verification',
        createdAt: new Date().toISOString(),
      });

      if (status === 'approved' && amountPaid > 0) {
        db.financialRecords.unshift({
          id: `fin-${Date.now()}`,
          type: 'income',
          category: 'Course Tuition Fee',
          title: `${course.title} (${paymentMethod}) — ${studentName}`,
          amount: amountPaid,
          branchId: resolvedBranchId,
          date: new Date().toISOString().slice(0, 10),
          recordedBy: user.name,
        });
      }

      recordAuditLog(
        db,
        user,
        'ENROLLMENT_CREATE',
        course.title,
        `${studentName} · ${paymentMethod} · ৳${amountPaid} (${status})`
      );
      saveDb(db);
      res.status(201).json({ enrollment });
    }
  );

  app.put(
    '/api/portal/enrollments/:id',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const user = req.authUser!;
      const db = getDb();
      const enrollment = db.enrollments.find((e) => e.id === req.params.id);
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found.' });
        return;
      }

      const b = req.body ?? {};
      const nextStatus = (
        ['approved', 'pending', 'rejected', 'cancelled', 'expired'].includes(b.status)
          ? b.status
          : enrollment.status
      ) as Enrollment['status'];
      const nextCourseId = b.courseId ? String(b.courseId) : enrollment.courseId;
      const nextCourse = db.courses.find((c) => c.id === nextCourseId);
      if (!nextCourse) {
        res.status(404).json({ error: 'Selected course not found.' });
        return;
      }

      const nextBatchId = b.batchId !== undefined
        ? (b.batchId ? String(b.batchId).trim() : null)
        : enrollment.batchId ?? null;
      const nextBatch = nextBatchId
        ? db.batches.find((bat) => bat.id === nextBatchId && bat.courseId === nextCourse.id)
        : undefined;
      if (nextBatchId && !nextBatch) {
        res.status(400).json({ error: 'Selected batch does not belong to this course.' });
        return;
      }

      const targetBranchId = b.branchId ? String(b.branchId) : enrollment.branchId;
      if (nextStatus === 'approved' && targetBranchId && targetBranchId !== 'online') {
        const branchOpCheck = assertBranchOperationalForTransactions(targetBranchId);
        if (!branchOpCheck.ok) {
          res.status(403).json({ error: branchOpCheck.error });
          return;
        }
      }

      const prevCourseId = enrollment.courseId;
      const prevBatchId = enrollment.batchId ?? null;
      const prevStatus = enrollment.status;

      const becomingApprovedOrChangingBatch =
        nextStatus === 'approved' && (prevStatus !== 'approved' || prevBatchId !== (nextBatch?.id ?? null));
      if (becomingApprovedOrChangingBatch && nextBatch && computeBatchSeatUsage(nextBatch).isFull) {
        res.status(409).json({ error: `Batch "${nextBatch.name}" is already full.` });
        return;
      }

      if (prevStatus === 'approved' && (nextStatus !== 'approved' || prevCourseId !== nextCourseId)) {
        const prevCourse = db.courses.find((c) => c.id === prevCourseId);
        if (prevCourse) prevCourse.enrolledCount = Math.max(0, prevCourse.enrolledCount - 1);
      }
      if (prevStatus === 'approved' && prevBatchId && (nextStatus !== 'approved' || prevBatchId !== (nextBatch?.id ?? null))) {
        const prevBatch = db.batches.find((bat) => bat.id === prevBatchId);
        if (prevBatch) prevBatch.enrolledSeats = Math.max(0, prevBatch.enrolledSeats - 1);
      }
      if (nextStatus === 'approved' && (prevStatus !== 'approved' || prevCourseId !== nextCourseId)) {
        nextCourse.enrolledCount += 1;
      }
      if (becomingApprovedOrChangingBatch && nextBatch) {
        nextBatch.enrolledSeats += 1;
      }

      enrollment.studentName = String(b.studentName ?? enrollment.studentName).trim() || enrollment.studentName;
      enrollment.studentEmail =
        String(b.studentEmail ?? enrollment.studentEmail).trim().toLowerCase() || enrollment.studentEmail;
      enrollment.courseId = nextCourse.id;
      enrollment.courseTitle = nextCourse.title;
      enrollment.batchId = nextBatch?.id ?? null;
      enrollment.batchName = nextBatch?.name;
      if (b.expiresAt !== undefined) {
        enrollment.expiresAt = b.expiresAt ? String(b.expiresAt).trim() : null;
      }
      if (b.branchId) {
        enrollment.branchId = String(b.branchId);
      }
      if (b.paymentMethod) {
        enrollment.paymentMethod = String(b.paymentMethod).trim() as Enrollment['paymentMethod'];
      }
      if (b.amountPaid !== undefined) {
        enrollment.amountPaid = Math.max(0, Number(b.amountPaid) || 0);
      }
      if (b.trxId !== undefined) {
        enrollment.trxId = String(b.trxId).trim() || undefined;
      }
      enrollment.status = nextStatus;
      enrollment.history = [
        {
          id: `eh-${Date.now()}`,
          action: 'updated',
          note: `Updated by ${user.name} · Status: ${nextStatus}${nextBatch ? ` · ${nextBatch.name}` : ''}`,
          actorName: user.name,
          createdAt: new Date().toISOString(),
        },
        ...(enrollment.history ?? []),
      ];

      const linkedTxn = db.transactions.find(
        (t) => t.referenceType === 'course' && t.referenceId === enrollment.id
      );
      if (linkedTxn) {
        linkedTxn.payerName = enrollment.studentName;
        linkedTxn.gateway = enrollment.paymentMethod as PaymentGatewayType;
        linkedTxn.totalAmount = enrollment.amountPaid;
        if (enrollment.trxId) linkedTxn.trxId = enrollment.trxId;
        linkedTxn.status =
          nextStatus === 'approved'
            ? 'completed'
            : nextStatus === 'pending'
              ? 'pending_verification'
              : 'refunded';
      }

      recordAuditLog(
        db,
        user,
        'ENROLLMENT_UPDATE',
        enrollment.courseTitle,
        `${enrollment.studentName} · ${enrollment.paymentMethod} · ৳${enrollment.amountPaid} (${nextStatus})`
      );
      saveDb(db);
      res.json({ enrollment });
    }
  );

  app.patch(
    '/api/portal/enrollments/:id',
    requireAuth,
    requireRole(['admin', 'branch']),
    (req: AuthedRequest, res) => {
      const user = req.authUser!;
      const status = req.body?.status as Enrollment['status'];
      if (!['approved', 'pending', 'rejected', 'cancelled', 'expired'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }

      const db = getDb();
      const enrollment = db.enrollments.find((e) => e.id === req.params.id);
      if (!enrollment) {
        res.status(404).json({ error: 'Enrollment not found' });
        return;
      }
      if (user.role === 'branch' && enrollment.branchId !== user.branchId) {
        res.status(403).json({ error: 'Branch coordinators can only manage enrollments for their own campus.' });
        return;
      }

      if (status === 'approved' && enrollment.branchId && enrollment.branchId !== 'online') {
        const branchOpCheck = assertBranchOperationalForTransactions(enrollment.branchId);
        if (!branchOpCheck.ok) {
          res.status(403).json({ error: branchOpCheck.error });
          return;
        }
      }

      const prevStatus = enrollment.status;
      const batch = enrollment.batchId
        ? db.batches.find((bat) => bat.id === enrollment.batchId)
        : undefined;
      if (prevStatus !== 'approved' && status === 'approved' && batch && computeBatchSeatUsage(batch).isFull) {
        res.status(409).json({ error: `Cannot approve: Batch "${batch.name}" is already at full capacity.` });
        return;
      }

      enrollment.status = status;
      const course = db.courses.find((c) => c.id === enrollment.courseId);
      if (prevStatus !== 'approved' && status === 'approved') {
        if (course) course.enrolledCount += 1;
        if (batch) batch.enrolledSeats += 1;
      } else if (prevStatus === 'approved' && status !== 'approved') {
        if (course) course.enrolledCount = Math.max(0, course.enrolledCount - 1);
        if (batch) batch.enrolledSeats = Math.max(0, batch.enrolledSeats - 1);
      }

      enrollment.history = [
        {
          id: `eh-${Date.now()}`,
          action: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'updated',
          note: `Status changed ${prevStatus} -> ${status}`,
          actorName: user.name,
          createdAt: new Date().toISOString(),
        },
        ...(enrollment.history ?? []),
      ];

      const linkedTxn = db.transactions.find(
        (t) => t.referenceType === 'course' && t.referenceId === enrollment.id
      );
      if (linkedTxn) {
        linkedTxn.status =
          status === 'approved'
            ? 'completed'
            : status === 'pending'
              ? 'pending_verification'
              : 'refunded';
      }

      recordAuditLog(
        db,
        user,
        'ENROLLMENT_STATUS',
        enrollment.courseTitle,
        `${enrollment.studentName} · ${prevStatus} -> ${status} (৳${enrollment.amountPaid})`
      );
      saveDb(db);
      res.json({ enrollment });
    }
  );

  app.delete(
    '/api/portal/enrollments/:id',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const user = req.authUser!;
      const db = getDb();
      const idx = db.enrollments.findIndex((e) => e.id === req.params.id);
      if (idx === -1) {
        res.status(404).json({ error: 'Enrollment not found' });
        return;
      }

      const [removed] = db.enrollments.splice(idx, 1);
      if (removed.status === 'approved') {
        const course = db.courses.find((c) => c.id === removed.courseId);
        if (course) course.enrolledCount = Math.max(0, course.enrolledCount - 1);
        if (removed.batchId) {
          const batch = db.batches.find((bat) => bat.id === removed.batchId);
          if (batch) batch.enrolledSeats = Math.max(0, batch.enrolledSeats - 1);
        }
      }
      db.recycleBin.unshift({
        id: `bin-${Date.now()}`,
        entityType: 'enrollment',
        originalId: removed.id,
        label: `${removed.studentName} — ${removed.courseTitle}`,
        deletedBy: user.name,
        deletedAt: new Date().toISOString(),
        snapshot: removed,
      });
      recordAuditLog(
        db,
        user,
        'ENROLLMENT_DELETE',
        removed.courseTitle,
        `${removed.studentName} (৳${removed.amountPaid}) moved to Recycle Bin`
      );
      saveDb(db);
      res.json({ deletedId: removed.id });
    }
  );

  // Main Admin Only: Update Order Status
  app.patch(
    '/api/portal/orders/:id',
    requireAuth,
    requireRole(['admin']),
    (req: AuthedRequest, res) => {
      const status = req.body?.status as 'processing' | 'shipped' | 'delivered' | 'cancelled';
      if (!['processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
        res.status(400).json({ error: 'Invalid order status' });
        return;
      }
      const db = getDb();
      const order = db.orders.find((o) => o.id === req.params.id);
      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const prev = order.status;
      order.status = status;
      recordAuditLog(
        db,
        req.authUser!,
        'ORDER_STATUS',
        order.id,
        `${order.customerName} · ${prev} -> ${status} (৳${order.totalAmount})`
      );
      saveDb(db);
      res.json({ order });
    }
  );

  // Main Admin Only: Full User Management CRUD, Approval & Recovery Support (Single Main Admin Invariant Enforced)
  app.post('/api/portal/users', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const phone = String(req.body?.phone ?? '').trim();
    const password = String(req.body?.password ?? '');
    const role = req.body?.role;
    let branchId = req.body?.branchId ? String(req.body.branchId).trim() : null;
    const rawStatus = String(req.body?.status ?? 'active').trim();
    const status: StoredUser['status'] =
      rawStatus === 'pending' || rawStatus === 'suspended' || rawStatus === 'rejected'
        ? rawStatus
        : 'active';
    const bio = req.body?.bio ? String(req.body.bio).trim().slice(0, 300) : undefined;
    const subjectSpecialty = req.body?.subjectSpecialty
      ? String(req.body.subjectSpecialty).trim().slice(0, 120)
      : undefined;
    const education = req.body?.education
      ? String(req.body.education).trim().slice(0, 140)
      : undefined;
    const approvalNote = req.body?.approvalNote
      ? String(req.body.approvalNote).trim().slice(0, 300)
      : undefined;
    const linkedIds = Array.isArray(req.body?.guardianLinkedStudentIds)
      ? req.body.guardianLinkedStudentIds.map(String)
      : req.body?.linkedStudentId
        ? [String(req.body.linkedStudentId)]
        : undefined;

    if (!name || !email || !email.includes('@') || !isValidRole(role)) {
      res.status(400).json({ error: 'Name, valid email, and allowed role (teacher, student, guardian, branch) are required' });
      return;
    }
    if (role === 'admin') {
      res.status(403).json({
        error: 'Only one Main Admin account is permitted on the entire platform.',
      });
      return;
    }
    if (phone && !isValidBangladeshPhone(phone)) {
      res.status(400).json({ error: 'Enter a valid Bangladesh phone number (e.g. 017XXXXXXXX).' });
      return;
    }
    if (!isStrongPassword(password, 8)) {
      res.status(400).json({
        error: 'A strong password (min 8 chars with letters and numbers) is required for every new user.',
      });
      return;
    }

    const db = getDb();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }

    const now = new Date().toISOString();
    if (role === 'branch' && !branchId && String(req.body?.branchName ?? '').trim()) {
      const bName = String(req.body.branchName).trim().slice(0, 120);
      const bCode = String(req.body?.branchCode ?? '').trim().toUpperCase().slice(0, 16) || `BRN-${db.branches.length + 101}`;
      const bCity = String(req.body?.branchCity ?? 'Dhaka').trim().slice(0, 80);
      const bAddress = String(req.body?.branchAddress ?? 'Campus Office').trim().slice(0, 220);
      if (db.branches.some((b) => b.code.toUpperCase() === bCode)) {
        res.status(409).json({ error: `Branch code "${bCode}" already exists.` });
        return;
      }
      const newBr: Branch = {
        id: `br-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        name: bName,
        code: bCode,
        city: bCity,
        address: bAddress,
        phone: phone || '01700000000',
        managerName: name,
        activeStudents: 0,
        status: status === 'active' ? 'active' : 'inactive',
        createdAt: now,
        updatedAt: now,
      };
      db.branches.push(newBr);
      branchId = newBr.id;
    } else if (branchId && branchId !== 'online') {
      const targetBranch = db.branches.find((b) => b.id === branchId);
      if (!targetBranch) {
        res.status(404).json({ error: 'Selected branch was not found.' });
        return;
      }
      if (role !== 'branch' && status === 'active') {
        const branchCheck = assertBranchOperationalForTransactions(branchId);
        if (!branchCheck.ok) {
          res.status(403).json({ error: branchCheck.error });
          return;
        }
      }
    }

    const customRoll = String(req.body?.rollNumber ?? '').trim();
    const avatar = req.body?.avatar ? sanitizeSafeUrl(String(req.body.avatar), '') : '';
    const newUser: StoredUser = {
      id: `u-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      name,
      email,
      phone: phone || '01700000000',
      role,
      branchId,
      status,
      avatar: avatar || undefined,
      bio,
      subjectSpecialty,
      education,
      approvedAt: status === 'active' ? now : undefined,
      approvedBy: status === 'active' ? actor.name : undefined,
      approvalNote,
      rollNumber: role === 'student' ? customRoll || `AEC-2026-${100 + db.users.length + 1}` : undefined,
      guardianLinkedStudentIds: role === 'guardian' ? linkedIds : undefined,
      passwordHash: hashPassword(password),
      passwordUpdatedAt: now,
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: now,
    };
    db.users.push(newUser);
    recordAuditLog(db, actor, 'USER_CREATE', `${newUser.name} (${newUser.role})`, maskEmailForAudit(newUser.email));
    saveDb(db);
    res.status(201).json({ user: sanitizeUser(newUser) });
  });

  app.patch('/api/portal/users/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (req.body?.role !== undefined) {
      if (!isValidRole(req.body.role)) {
        res.status(400).json({ error: 'Invalid role specified.' });
        return;
      }
      if (target.id === actor.id && req.body.role !== actor.role) {
        res.status(403).json({ error: 'You cannot modify your own role.' });
        return;
      }
      if (req.body.role === 'admin' && target.role !== 'admin') {
        res.status(403).json({
          error: 'Privilege escalation blocked: only one Main Admin account may exist on the platform.',
        });
        return;
      }
      if (target.role === 'admin' && req.body.role !== 'admin') {
        res.status(403).json({ error: 'The Main Admin role cannot be downgraded.' });
        return;
      }
      target.role = req.body.role;
    }

    if (typeof req.body?.name === 'string' && req.body.name.trim()) {
      target.name = req.body.name.trim().slice(0, 120);
    }
    if (typeof req.body?.email === 'string' && req.body.email.trim()) {
      const nextEmail = req.body.email.trim().toLowerCase();
      if (nextEmail !== target.email.toLowerCase() && db.users.some((u) => u.email.toLowerCase() === nextEmail)) {
        res.status(409).json({ error: 'Another user already uses that email' });
        return;
      }
      target.email = nextEmail;
    }
    if (typeof req.body?.phone === 'string' && req.body.phone.trim()) {
      if (!isValidBangladeshPhone(req.body.phone.trim())) {
        res.status(400).json({ error: 'Enter a valid Bangladesh phone number (e.g. 017XXXXXXXX).' });
        return;
      }
      target.phone = req.body.phone.trim();
    }
    if (req.body?.branchId !== undefined) {
      target.branchId = req.body.branchId ? String(req.body.branchId) : null;
    }
    if (
      req.body?.status === 'pending' ||
      req.body?.status === 'active' ||
      req.body?.status === 'suspended' ||
      req.body?.status === 'rejected'
    ) {
      if (target.id === actor.id && req.body.status !== 'active') {
        res.status(400).json({ error: 'You cannot deactivate or suspend your own active Main Admin account.' });
        return;
      }
      const prevStatus = target.status ?? 'active';
      target.status = req.body.status;
      if (target.status === 'active' && prevStatus !== 'active') {
        target.approvedAt = new Date().toISOString();
        target.approvedBy = actor.name;
      }
      if (target.status === 'suspended' || target.status === 'rejected' || target.status === 'pending') {
        revokeAllUserSessions(target.id);
      }
    }
    if (typeof req.body?.rollNumber === 'string') {
      target.rollNumber = req.body.rollNumber.trim() || target.rollNumber;
    }
    if (req.body?.bio !== undefined) {
      target.bio = String(req.body.bio).trim().slice(0, 300) || undefined;
    }
    if (req.body?.avatar !== undefined) {
      const cleanedAvatar = sanitizeSafeUrl(String(req.body.avatar ?? ''), '');
      target.avatar = cleanedAvatar || undefined;
    }
    if (req.body?.subjectSpecialty !== undefined) {
      target.subjectSpecialty = String(req.body.subjectSpecialty).trim().slice(0, 120) || undefined;
    }
    if (req.body?.education !== undefined) {
      target.education = String(req.body.education).trim().slice(0, 140) || undefined;
    }
    if (req.body?.approvalNote !== undefined) {
      target.approvalNote = String(req.body.approvalNote).trim().slice(0, 300) || undefined;
    }
    if (Array.isArray(req.body?.guardianLinkedStudentIds)) {
      target.guardianLinkedStudentIds = req.body.guardianLinkedStudentIds.map(String);
    }
    if (typeof req.body?.password === 'string' && req.body.password.trim()) {
      if (!isStrongPassword(req.body.password.trim(), 8)) {
        res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers.' });
        return;
      }
      target.passwordHash = hashPassword(req.body.password.trim());
      target.passwordUpdatedAt = new Date().toISOString();
      revokeAllUserSessions(target.id);
    }

    if (target.role === 'branch' && target.branchId) {
      const linkedBranch = db.branches.find((b) => b.id === target.branchId);
      if (linkedBranch) {
        if (typeof req.body?.branchName === 'string' && req.body.branchName.trim()) {
          linkedBranch.name = req.body.branchName.trim().slice(0, 120);
        }
        if (typeof req.body?.branchCode === 'string' && req.body.branchCode.trim()) {
          const nextCode = req.body.branchCode.trim().toUpperCase().slice(0, 16);
          if (!db.branches.some((b) => b.id !== linkedBranch.id && b.code.toUpperCase() === nextCode)) {
            linkedBranch.code = nextCode;
          }
        }
        if (typeof req.body?.branchCity === 'string' && req.body.branchCity.trim()) {
          linkedBranch.city = req.body.branchCity.trim().slice(0, 80);
        }
        if (typeof req.body?.branchAddress === 'string' && req.body.branchAddress.trim()) {
          linkedBranch.address = req.body.branchAddress.trim().slice(0, 220);
        }
        if (typeof req.body?.branchPhone === 'string' && req.body.branchPhone.trim()) {
          linkedBranch.phone = req.body.branchPhone.trim();
        }
        linkedBranch.managerName = target.name;
        if (target.status === 'active' && linkedBranch.status === 'inactive') {
          linkedBranch.status = 'active';
        }
        linkedBranch.updatedAt = new Date().toISOString();
      }
    }

    recordAuditLog(
      db,
      actor,
      'USER_UPDATE',
      `${target.name} (${target.role})`,
      `Status: ${target.status ?? 'active'}`
    );
    saveDb(db);
    res.json({ user: sanitizeUser(target) });
  });

  app.post('/api/portal/users/:id/approve', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const now = new Date().toISOString();
    const note = req.body?.note ? String(req.body.note).trim().slice(0, 300) : undefined;
    target.status = 'active';
    target.approvedAt = now;
    target.approvedBy = actor.name;
    if (note !== undefined) target.approvalNote = note;

    let updatedBranch: Branch | undefined;
    if (target.role === 'branch' && target.branchId) {
      const linkedBranch = db.branches.find((b) => b.id === target.branchId);
      if (linkedBranch) {
        const prevBranchStatus = linkedBranch.status;
        linkedBranch.status = 'active';
        linkedBranch.managerName = target.name;
        linkedBranch.updatedAt = now;
        linkedBranch.archivedAt = null;
        if (prevBranchStatus !== 'active') {
          db.branchStatusHistory.unshift({
            id: `bsh-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
            branchId: linkedBranch.id,
            branchName: linkedBranch.name,
            previousStatus: prevBranchStatus,
            newStatus: 'active',
            reason: note || `Approved branch registration for ${target.name}`,
            actorId: actor.id,
            actorName: actor.name,
            createdAt: now,
          });
        }
        updatedBranch = linkedBranch;
      }
    }

    if (target.role === 'teacher' && !db.instructors.some((ins) => ins.userId === target.id)) {
      db.instructors.push({
        id: `inst-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId: target.id,
        name: target.name,
        subject: target.subjectSpecialty || 'English Grammar & Spoken',
        roleTitle: 'Faculty Member',
        education: target.education || 'Certified Faculty',
        panel: target.branchId && target.branchId !== 'online' ? 'Branch Faculty' : 'Head Faculty',
        branchId: target.branchId || 'online',
        bio: target.bio || `${target.subjectSpecialty || 'English'} instructor.`,
        avatar: target.avatar || '/src/assets/images/avatar_instructor_male_1795437875493.jpg',
      });
    }

    db.inAppNotifications.unshift({
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: target.id,
      title: 'Account Approved',
      message: `Your ${target.role} account has been approved by Main Admin. You may now sign in.`,
      type: target.role === 'branch' ? 'branch' : 'info',
      read: false,
      createdAt: now,
    });

    recordAuditLog(
      db,
      actor,
      'USER_APPROVED',
      `${target.name} (${target.role})`,
      `Approved by ${actor.name}${updatedBranch ? ` · Campus ${updatedBranch.name} activated` : ''}`
    );
    saveDb(db);
    res.json({ user: sanitizeUser(target), branch: updatedBranch });
  });

  app.post('/api/portal/users/:id/reject', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (target.role === 'admin' || target.id === actor.id) {
      res.status(403).json({ error: 'Cannot reject the Main Admin account.' });
      return;
    }
    const reason = String(req.body?.reason ?? 'Registration did not meet verification requirements.').trim().slice(0, 300);
    target.status = 'rejected';
    target.approvalNote = reason;
    revokeAllUserSessions(target.id);

    recordAuditLog(
      db,
      actor,
      'USER_REJECTED',
      `${target.name} (${target.role})`,
      reason,
      'warning'
    );
    saveDb(db);
    res.json({ user: sanitizeUser(target) });
  });

  app.post('/api/portal/users/:id/issue-reset-token', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const db = getDb();
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const resetToken = createPasswordResetToken(target.id);
    recordAuditLog(
      db,
      actor,
      'ADMIN_ISSUED_RESET_TOKEN',
      `${target.name} (${target.role})`,
      maskEmailForAudit(target.email),
      'warning'
    );
    saveDb(db);
    res.json({
      ok: true,
      resetToken,
      expiresInMinutes: 30,
      email: target.email,
      role: target.role,
    });
  });

  app.delete('/api/portal/users/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    if (req.params.id === actor.id) {
      res.status(400).json({ error: 'Cannot delete the currently logged-in admin account' });
      return;
    }
    const db = getDb();
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (db.users[idx].role === 'admin') {
      res.status(403).json({ error: 'The Main Admin account cannot be deleted.' });
      return;
    }
    const [removed] = db.users.splice(idx, 1);
    revokeAllUserSessions(removed.id);
    recordAuditLog(db, actor, 'USER_DELETE', `${removed.name} (${removed.role})`, maskEmailForAudit(removed.email), 'warning');
    saveDb(db);
    res.json({ ok: true, deletedId: removed.id });
  });

  app.get('/api/portal/users/:id/details', requireAuth, requireRole(['admin', 'teacher']), (req: AuthedRequest, res) => {
    const db = getDb();
    const actor = req.authUser!;
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (actor.role === 'teacher') {
      const assignedIds = getTeacherAssignedCourseIds(actor, db.courses, db.instructors, db.batches);
      const isEnrolledWithTeacher =
        target.role === 'student' &&
        db.enrollments.some(
          (e) => e.userId === target.id && e.status === 'approved' && assignedIds.has(e.courseId)
        );
      if (!isEnrolledWithTeacher && target.id !== actor.id) {
        res.status(403).json({
          error: 'Teachers can only inspect records of students enrolled in their assigned courses or batches.',
        });
        return;
      }
      const enrollments = db.enrollments.filter(
        (e) => e.userId === target.id && assignedIds.has(e.courseId)
      );
      const teacherExamIds = new Set(
        db.exams
          .filter(
            (ex) =>
              ex.teacherId === actor.id || (ex.courseId && assignedIds.has(ex.courseId))
          )
          .map((ex) => ex.id)
      );
      const assignedBatchIds = new Set(
        db.batches.filter((b) => assignedIds.has(b.courseId)).map((b) => b.id)
      );
      const examAttempts = db.examAttempts.filter(
        (a) => a.userId === target.id && teacherExamIds.has(a.examId)
      );
      const attendance = db.attendance.filter(
        (a) =>
          a.targetId === target.id &&
          (a.targetId === actor.id || (a.batchId && assignedBatchIds.has(a.batchId)))
      );
      const rewards = db.rewardsByUser[target.id] ?? null;
      res.json({
        user: sanitizeUser(target),
        enrollments,
        examAttempts,
        orders: [],
        attendance,
        rewards,
      });
      return;
    }
    const enrollments = db.enrollments.filter((e) => e.userId === target.id);
    const examAttempts = db.examAttempts.filter((a) => a.userId === target.id);
    const orders = db.orders.filter((o) => o.userId === target.id);
    const attendance = db.attendance.filter((a) => a.targetId === target.id);
    const rewards = db.rewardsByUser[target.id] ?? null;
    res.json({
      user: sanitizeUser(target),
      enrollments,
      examAttempts,
      orders,
      attendance,
      rewards,
    });
  });

  app.patch('/api/portal/settings', requireAuth, requireRole(['admin']), (req, res) => {
    const db = getDb();
    const allowedKeys = ['brandName', 'tagline', 'phone', 'email', 'whatsappNumber', 'address', 'licenseNo', 'aboutMission'] as const;
    for (const key of allowedKeys) {
      if (typeof req.body?.[key] === 'string' && req.body[key].trim()) {
        db.settings[key] = req.body[key].trim();
      }
    }
    if (req.body?.dashboardConfig && typeof req.body.dashboardConfig === 'object') {
      db.settings.dashboardConfig = normalizeDashboardConfig(
        req.body.dashboardConfig,
        db.settings.dashboardConfig
      );
    }
    saveDb(db);
    res.json({ settings: db.settings });
  });

  // Admin: Homepage CMS — Hero Slides update
  app.put('/api/portal/homepage/slides', requireAuth, requireRole(['admin']), (req, res) => {
    const db = getDb();
    const incoming = req.body?.heroSlides;
    if (!Array.isArray(incoming) || incoming.length === 0) {
      res.status(400).json({ error: 'At least one hero slide is required.' });
      return;
    }

    const normalized: HeroSlide[] = incoming.map((raw: Record<string, unknown>, idx: number) => {
      const title = String(raw.title ?? '').trim() || `Slide ${idx + 1}`;
      const badge = String(raw.badge ?? '').trim() || 'AEC 27';
      const subtitle = String(raw.subtitle ?? '').trim();
      const ctaText = String(raw.ctaText ?? '').trim() || 'Explore Course';
      const courseSlug = String(raw.courseSlug ?? '').trim() || 'ssc-english-final-revision';
      const image = sanitizeSafeUrl(
        String(raw.image ?? ''),
        '/src/assets/images/hero_hsc_english_1795411661478.jpg'
      );
      const gradient =
        String(raw.gradient ?? '').trim() || 'from-cyan-900/85 via-sky-950/75 to-slate-950/90';

      return {
        id: String(raw.id ?? `slide-${Date.now()}-${idx}`),
        badge,
        title,
        subtitle,
        ctaText,
        courseSlug,
        image,
        gradient,
        active: raw.active !== false,
      };
    });

    db.settings.heroSlides = normalized;
    saveDb(db);
    res.json({ settings: db.settings });
  });

  // Admin: Homepage CMS — Featured Highlights, Stats & Section Headers
  app.put('/api/portal/homepage/config', requireAuth, requireRole(['admin']), (req, res) => {
    const db = getDb();
    const fallback = createDefaultHomepageConfig();
    const current = db.settings.homepageConfig ?? fallback;
    const body = (req.body?.homepageConfig ?? {}) as Partial<HomepageConfig>;

    const nextConfig: HomepageConfig = {
      featuredCard: {
        badge: String(body.featuredCard?.badge ?? current.featuredCard.badge).trim() || fallback.featuredCard.badge,
        title: String(body.featuredCard?.title ?? current.featuredCard.title).trim() || fallback.featuredCard.title,
        subtitle: String(body.featuredCard?.subtitle ?? current.featuredCard.subtitle).trim(),
        ctaText: String(body.featuredCard?.ctaText ?? current.featuredCard.ctaText).trim() || 'See All Courses',
        ctaLink: sanitizeSafeUrl(String(body.featuredCard?.ctaLink ?? current.featuredCard.ctaLink), '/courses'),
        highlights: Array.isArray(body.featuredCard?.highlights)
          ? body.featuredCard.highlights.map((h, i) => ({
              id: String(h.id || `fhl-${Date.now()}-${i}`),
              title: String(h.title || '').trim() || 'Featured Track',
              desc: String(h.desc || '').trim(),
              categoryLink: sanitizeSafeUrl(String(h.categoryLink || '/courses'), '/courses'),
              iconKey: h.iconKey || 'book',
              accentColor: h.accentColor || 'emerald',
            }))
          : current.featuredCard.highlights,
      },
      statsCard: {
        mode: body.statsCard?.mode === 'custom' ? 'custom' : 'auto',
        badge: String(body.statsCard?.badge ?? current.statsCard.badge).trim() || fallback.statsCard.badge,
        title: String(body.statsCard?.title ?? current.statsCard.title).trim() || fallback.statsCard.title,
        subtitle: String(body.statsCard?.subtitle ?? current.statsCard.subtitle).trim(),
        ctaText: String(body.statsCard?.ctaText ?? current.statsCard.ctaText).trim() || 'See All Courses',
        ctaLink: sanitizeSafeUrl(String(body.statsCard?.ctaLink ?? current.statsCard.ctaLink), '/courses'),
        customValues: {
          students: Math.max(0, Number(body.statsCard?.customValues?.students ?? current.statsCard.customValues.students) || 0),
          courses: Math.max(0, Number(body.statsCard?.customValues?.courses ?? current.statsCard.customValues.courses) || 0),
          teachers: Math.max(0, Number(body.statsCard?.customValues?.teachers ?? current.statsCard.customValues.teachers) || 0),
          videos: Math.max(0, Number(body.statsCard?.customValues?.videos ?? current.statsCard.customValues.videos) || 0),
        },
        labels: {
          students: String(body.statsCard?.labels?.students ?? current.statsCard.labels.students).trim() || 'Students',
          courses: String(body.statsCard?.labels?.courses ?? current.statsCard.labels.courses).trim() || 'Courses',
          teachers: String(body.statsCard?.labels?.teachers ?? current.statsCard.labels.teachers).trim() || 'Teachers',
          videos: String(body.statsCard?.labels?.videos ?? current.statsCard.labels.videos).trim() || 'Videos',
        },
      },
      learningPathsSection: {
        heading:
          String(body.learningPathsSection?.heading ?? current.learningPathsSection.heading).trim() ||
          fallback.learningPathsSection.heading,
        subheading: String(
          body.learningPathsSection?.subheading ?? current.learningPathsSection.subheading
        ).trim(),
        items: Array.isArray(body.learningPathsSection?.items)
          ? body.learningPathsSection.items.map((item, i) => ({
              id: String(item.id || `lp-${Date.now()}-${i}`),
              title: String(item.title || '').trim() || 'Program Track',
              desc: String(item.desc || '').trim(),
              category: String(item.category || 'All Courses').trim() || 'All Courses',
              iconKey: item.iconKey || 'book',
              accentKey: item.accentKey || 'sky',
              image: item.image ? sanitizeSafeUrl(String(item.image), '') : undefined,
            }))
          : current.learningPathsSection.items,
      },
      reviewsSection: {
        kicker:
          String(body.reviewsSection?.kicker ?? current.reviewsSection.kicker).trim() ||
          fallback.reviewsSection.kicker,
        heading:
          String(body.reviewsSection?.heading ?? current.reviewsSection.heading).trim() ||
          fallback.reviewsSection.heading,
        subheading: String(
          body.reviewsSection?.subheading ?? current.reviewsSection.subheading
        ).trim(),
      },
    };

    db.settings.homepageConfig = nextConfig;
    saveDb(db);
    res.json({ settings: db.settings });
  });

  // Admin: Homepage Testimonials / Reviews CRUD (with moderation, featured, avatar & recycle-bin)
  app.post('/api/portal/reviews', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const { name, roleLabel, text, rating, row, status, featured, courseTag, avatar, verified } = req.body ?? {};
    if (!String(name ?? '').trim() || !String(text ?? '').trim()) {
      res.status(400).json({ error: 'Reviewer name and testimonial text are required.' });
      return;
    }

    const review: Review = {
      id: `rev-${Date.now()}`,
      name: String(name).trim(),
      roleLabel: String(roleLabel ?? 'Verified Student').trim(),
      text: String(text).trim(),
      rating: Math.min(5, Math.max(1, Number(rating) || 5)),
      row: Number(row) === 2 ? 2 : 1,
      status: ['approved', 'pending', 'hidden'].includes(status) ? status : 'approved',
      featured: Boolean(featured),
      courseTag: courseTag ? String(courseTag).trim() : undefined,
      avatar: avatar ? sanitizeSafeUrl(String(avatar), '') : undefined,
      verified: verified !== false,
      createdAt: new Date().toISOString(),
    };

    db.reviews.unshift(review);
    recordAuditLog(db, req.authUser!, 'REVIEW_CREATE', review.name, `status=${review.status}`);
    saveDb(db);
    res.status(201).json({ review, reviews: db.reviews });
  });

  app.put('/api/portal/reviews/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const review = db.reviews.find((r) => r.id === req.params.id);
    if (!review) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }

    const { name, roleLabel, text, rating, row, status, featured, courseTag, avatar, verified } = req.body ?? {};
    if (!String(name ?? '').trim() || !String(text ?? '').trim()) {
      res.status(400).json({ error: 'Reviewer name and testimonial text are required.' });
      return;
    }

    review.name = String(name).trim();
    review.roleLabel = String(roleLabel ?? review.roleLabel).trim();
    review.text = String(text).trim();
    review.rating = Math.min(5, Math.max(1, Number(rating) || 5));
    review.row = Number(row) === 2 ? 2 : 1;
    if (['approved', 'pending', 'hidden'].includes(status)) review.status = status;
    if (typeof featured === 'boolean') review.featured = featured;
    if (courseTag !== undefined) review.courseTag = String(courseTag).trim() || undefined;
    if (avatar !== undefined) review.avatar = avatar ? sanitizeSafeUrl(String(avatar), '') : undefined;
    if (typeof verified === 'boolean') review.verified = verified;

    saveDb(db);
    res.json({ review, reviews: db.reviews });
  });

  app.delete('/api/portal/reviews/:id', requireAuth, requireRole(['admin']), (req: AuthedRequest, res) => {
    const db = getDb();
    const idx = db.reviews.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Review not found.' });
      return;
    }
    const [removed] = db.reviews.splice(idx, 1);
    db.recycleBin.unshift({
      id: `bin-${Date.now()}`,
      entityType: 'review',
      originalId: removed.id,
      label: `${removed.name} (${removed.roleLabel})`,
      deletedBy: req.authUser?.name ?? 'Admin',
      deletedAt: new Date().toISOString(),
      snapshot: removed,
    });
    saveDb(db);
    res.json({ deletedId: removed.id, reviews: db.reviews });
  });

  // Universal Device Picture Upload & "My Storage" Library (All Authenticated Roles)
  const syncUploadsWithDb = () => {
    const db = getDb();
    if (!fs.existsSync(uploadsDir)) return db;
    const diskNames = fs
      .readdirSync(uploadsDir)
      .filter((name) => /^cms-\d+-[a-f0-9]{8}\.(png|jpg|webp|gif)$/.test(name));
    const diskSet = new Set(diskNames);
    const knownSet = new Set(db.mediaAssets.map((a) => a.filename));
    let dirty = false;

    for (const name of diskNames) {
      if (!knownSet.has(name)) {
        const stat = fs.statSync(path.join(uploadsDir, name));
        const ext = path.extname(name).slice(1).toLowerCase();
        const mimeMap: Record<string, MediaAsset['mimeType']> = {
          png: 'image/png',
          jpg: 'image/jpeg',
          webp: 'image/webp',
          gif: 'image/gif',
        };
        db.mediaAssets.push({
          id: `media-${name}`,
          filename: name,
          url: `/uploads/${name}`,
          originalName: name,
          mimeType: mimeMap[ext] ?? 'image/png',
          sizeBytes: stat.size,
          uploadedByUserId: 'u-admin',
          uploadedByName: 'System Library',
          uploadedByRole: 'admin',
          category: 'cms',
          createdAt: stat.mtime.toISOString(),
        });
        dirty = true;
      }
    }

    const beforeLen = db.mediaAssets.length;
    db.mediaAssets = db.mediaAssets.filter((a) => diskSet.has(a.filename));
    if (db.mediaAssets.length !== beforeLen) dirty = true;
    if (dirty) saveDb(db);
    return db;
  };

  app.get('/api/portal/uploads', requireAuth, (req: AuthedRequest, res) => {
    const db = syncUploadsWithDb();
    const actor = req.authUser!;
    const scoped = db.mediaAssets
      .filter((asset) => {
        if (actor.role === 'admin') return true;
        if (actor.role === 'teacher') {
          return (
            asset.uploadedByUserId === actor.id ||
            asset.uploadedByRole === 'admin' ||
            asset.uploadedByRole === 'teacher'
          );
        }
        return asset.uploadedByUserId === actor.id;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((asset) => ({
        ...asset,
        name: asset.filename,
      }));
    res.json({ files: scoped });
  });

  app.post('/api/portal/upload-image', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const rawDataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    const parsed = parseImageUploadDataUrl(rawDataUrl, 5 * 1024 * 1024);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const buffer = Buffer.from(parsed.value.base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'Uploaded image exceeds 5 MB size limit.' });
      return;
    }
    if (!hasValidImageMagicBytes(buffer, parsed.value.extension)) {
      res.status(400).json({
        error: 'Image file signature does not match a valid PNG, JPG, WEBP, or GIF file.',
      });
      return;
    }

    fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `cms-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${parsed.value.extension}`;
    const targetPath = path.resolve(uploadsDir, filename);
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid upload destination path.' });
      return;
    }
    fs.writeFileSync(targetPath, buffer);

    const rawName = String(req.body?.originalName ?? filename)
      .replace(/[/\\?%*:|"<>]/g, '_')
      .trim()
      .slice(0, 100);
    const allowedCats = ['avatar', 'branch', 'course', 'assignment', 'community', 'cms', 'general'];
    const rawCat = String(req.body?.category ?? 'general').trim().toLowerCase();
    const category = allowedCats.includes(rawCat) ? rawCat : 'general';

    const db = getDb();
    const asset: MediaAsset = {
      id: `media-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      filename,
      url: `/uploads/${filename}`,
      originalName: rawName || filename,
      mimeType: parsed.value.mimeType,
      sizeBytes: buffer.length,
      uploadedByUserId: actor.id,
      uploadedByName: actor.name,
      uploadedByRole: actor.role,
      category,
      createdAt: new Date().toISOString(),
    };
    db.mediaAssets.unshift(asset);
    recordAuditLog(db, actor, 'MEDIA_UPLOAD', asset.originalName, `${category} · ${Math.round(buffer.length / 1024)} KB`);
    saveDb(db);

    res.status(201).json({
      url: asset.url,
      name: filename,
      sizeBytes: buffer.length,
      asset: { ...asset, name: filename },
    });
  });

  app.delete('/api/portal/uploads/:filename', requireAuth, (req: AuthedRequest, res) => {
    const actor = req.authUser!;
    const filename = String(req.params.filename ?? '');
    if (!/^cms-\d+-[a-f0-9]{8}\.(png|jpg|webp|gif)$/.test(filename)) {
      res.status(400).json({ error: 'Invalid upload filename.' });
      return;
    }
    const targetPath = path.resolve(uploadsDir, filename);
    if (!targetPath.startsWith(uploadsDir + path.sep)) {
      res.status(400).json({ error: 'Invalid file path.' });
      return;
    }

    const db = getDb();
    const assetIdx = db.mediaAssets.findIndex((a) => a.filename === filename);
    const asset = assetIdx >= 0 ? db.mediaAssets[assetIdx] : null;
    if (actor.role !== 'admin' && (!asset || asset.uploadedByUserId !== actor.id)) {
      res.status(403).json({ error: 'You can only delete images from your own storage.' });
      return;
    }
    if (!fs.existsSync(targetPath) && !asset) {
      res.status(404).json({ error: 'Uploaded file not found.' });
      return;
    }
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
    }
    if (assetIdx >= 0) {
      db.mediaAssets.splice(assetIdx, 1);
    }
    recordAuditLog(db, actor, 'MEDIA_DELETE', filename, 'Removed from storage');
    saveDb(db);
    res.json({ deletedName: filename });
  });

  // Safe static download route for Laravel 13 White-Label Ready-to-Install ZIP
  const serveLaravelArchive = (_req: Request, res: Response) => {
    const zipPath = path.resolve(
      process.cwd(),
      'public',
      'downloads',
      'academy-lms-laravel13.zip'
    );
    if (!fs.existsSync(zipPath)) {
      res.status(404).json({ error: 'Laravel 13 installer archive is being prepared' });
      return;
    }
    res.download(zipPath, 'academy-lms-laravel13.zip');
  };
  app.get('/downloads/academy-lms-laravel13.zip', serveLaravelArchive);
  app.get('/downloads/aloms-english-center-laravel.zip', serveLaravelArchive);

  // Mount AI Agents, Enterprise Course Management, Enterprise Ops & Full-Platform Operations Routers
  app.use('/api/ai', createAiRouter(getAuthenticatedUser));
  app.use(createEnterpriseOpsRouter(requireAuth, requireRole));
  app.use(createBatchEnterpriseRouter(requireAuth, requireRole));
  app.use(createCourseEnterpriseRouter(requireAuth, requireRole));
  app.use(createPlatformRouter(requireAuth, requireRole));

  // Vite middleware in dev, dist static in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Aloms English Center running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
