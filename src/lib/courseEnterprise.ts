import type {
  AssignmentSubmission,
  Branch,
  Coupon,
  Course,
  CourseAssignment,
  CourseBatch,
  CourseCertificate,
  CourseChapter,
  CourseLesson,
  CourseModule,
  CourseStatus,
  Enrollment,
  Exam,
  ExamAttempt,
  Instructor,
  Review,
  User,
} from '../types';
import { calculateDiscountedPrice, computeBatchSeatUsage, sanitizeSafeUrl } from './domain';

export function isCourseStatusLive(status: CourseStatus | string | undefined): boolean {
  return status === 'active' || status === 'published';
}

export function isCoursePubliclyLive(course: Pick<Course, 'status' | 'visibility'>): boolean {
  return isCourseStatusLive(course.status) && (course.visibility ?? 'public') !== 'private';
}

export function isCoursePubliclyListed(course: Pick<Course, 'status' | 'visibility'>): boolean {
  return isCourseStatusLive(course.status) && (course.visibility ?? 'public') === 'public';
}

export function generateCourseSlug(
  rawTitleOrSlug: string,
  existingCourses: Pick<Course, 'id' | 'slug'>[] = [],
  ignoreCourseId?: string
): string {
  const base =
    String(rawTitleOrSlug ?? '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `course-${Date.now().toString().slice(-5)}`;

  let candidate = base;
  let counter = 2;
  while (
    existingCourses.some(
      (c) => c.slug.toLowerCase() === candidate && (!ignoreCourseId || c.id !== ignoreCourseId)
    )
  ) {
    candidate = `${base}-${counter}`;
    counter += 1;
  }
  return candidate;
}

export function isCourseEnrollable(
  course: Course,
  nowIso: string = new Date().toISOString()
): { ok: true } | { ok: false; reason: string } {
  if (!isCourseStatusLive(course.status)) {
    return { ok: false, reason: `Course "${course.title}" is currently ${course.status} and not open for enrollment.` };
  }
  if ((course.visibility ?? 'public') === 'private') {
    return { ok: false, reason: 'This course is private and requires an administrator invitation.' };
  }
  const avail = course.enrollmentAvailability ?? 'open';
  if (avail === 'closed') {
    return { ok: false, reason: 'Enrollment for this course is closed.' };
  }
  if (avail === 'upcoming') {
    return { ok: false, reason: 'Enrollment for this course has not opened yet.' };
  }

  const nowMs = Date.parse(nowIso);
  if (course.enrollmentStartDate) {
    const startMs = Date.parse(course.enrollmentStartDate);
    if (Number.isFinite(startMs) && Number.isFinite(nowMs) && nowMs < startMs) {
      return { ok: false, reason: `Enrollment opens on ${course.enrollmentStartDate}.` };
    }
  }
  if (course.enrollmentDeadline) {
    // Allow whole deadline date (23:59:59Z if date-only YYYY-MM-DD)
    const rawDeadline = course.enrollmentDeadline.trim();
    const deadlineIso = /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline)
      ? `${rawDeadline}T23:59:59.999Z`
      : rawDeadline;
    const deadlineMs = Date.parse(deadlineIso);
    if (Number.isFinite(deadlineMs) && Number.isFinite(nowMs) && nowMs > deadlineMs) {
      return { ok: false, reason: `Enrollment deadline (${course.enrollmentDeadline}) has passed.` };
    }
  }
  if (course.maxCapacity && course.maxCapacity > 0 && course.enrolledCount >= course.maxCapacity) {
    return { ok: false, reason: 'Course maximum capacity has been reached.' };
  }
  return { ok: true };
}

export interface ServerCoursePricingResult {
  isFree: boolean;
  regularFee: number;
  discountedFee: number;
  admissionFee: number;
  couponDiscountAmount: number;
  appliedCouponCode: string | null;
  totalPayable: number;
}

export function calculateCoursePricingServerSide(
  course: Pick<Course, 'price' | 'originalPrice' | 'admissionFee' | 'isFree' | 'couponEligible'>,
  coupon?: Coupon | null
): ServerCoursePricingResult {
  const isFree = Boolean(course.isFree) || (Math.round(course.price || 0) === 0 && Math.round(course.admissionFee || 0) === 0);
  if (isFree) {
    return {
      isFree: true,
      regularFee: 0,
      discountedFee: 0,
      admissionFee: 0,
      couponDiscountAmount: 0,
      appliedCouponCode: null,
      totalPayable: 0,
    };
  }

  const allowCoupon = course.couponEligible !== false;
  const eligibleCoupon =
    allowCoupon &&
    coupon &&
    coupon.active &&
    (!coupon.appliesTo || coupon.appliesTo === 'all' || coupon.appliesTo === 'courses')
      ? coupon
      : null;

  const breakdown = calculateDiscountedPrice(course.price, course.originalPrice, eligibleCoupon);
  const admissionFee = Math.max(0, Math.round(Number(course.admissionFee) || 0));

  return {
    isFree: false,
    regularFee: breakdown.originalPrice,
    discountedFee: breakdown.basePrice,
    admissionFee,
    couponDiscountAmount: breakdown.couponDiscountAmount,
    appliedCouponCode: breakdown.appliedCouponCode,
    totalPayable: Math.max(0, breakdown.finalPrice + admissionFee),
  };
}

export function validateEnrollmentRequest(params: {
  userId: string;
  course: Course | undefined;
  batchId?: string | null;
  batches: CourseBatch[];
  enrollments: Enrollment[];
  branchId?: string | null;
  branches: Branch[];
  allowReenrollAfterCancelled?: boolean;
  nowIso?: string;
}): { ok: true; resolvedBatch: CourseBatch | null } | { ok: false; statusCode: number; error: string } {
  const { userId, course, batchId, batches, enrollments, branchId, branches, nowIso } = params;
  if (!course) {
    return { ok: false, statusCode: 404, error: 'Course not found or unavailable.' };
  }

  const enrollCheck = isCourseEnrollable(course, nowIso);
  if (enrollCheck.ok === false) {
    return { ok: false, statusCode: 400, error: enrollCheck.reason };
  }

  // Duplicate check: block if already approved or pending
  const existing = enrollments.find(
    (e) =>
      e.userId === userId &&
      e.courseId === course.id &&
      (e.status === 'approved' || e.status === 'pending')
  );
  if (existing) {
    return {
      ok: false,
      statusCode: 409,
      error:
        existing.status === 'approved'
          ? 'You are already enrolled in this course.'
          : 'You already have a pending enrollment request for this course.',
    };
  }

  // Branch active check
  if (branchId && branchId !== 'online') {
    const branch = branches.find((b) => b.id === branchId);
    if (branch && branch.status !== 'active') {
      return { ok: false, statusCode: 400, error: `Branch "${branch.name}" is currently inactive.` };
    }
  }

  // Batch capacity & status check
  const courseBatches = batches.filter((b) => b.courseId === course.id);
  let resolvedBatch: CourseBatch | null = null;
  if (batchId) {
    resolvedBatch = courseBatches.find((b) => b.id === batchId) ?? null;
    if (!resolvedBatch) {
      return { ok: false, statusCode: 400, error: 'Selected batch does not belong to this course.' };
    }
    if (resolvedBatch.status === 'closed') {
      return { ok: false, statusCode: 400, error: `Batch "${resolvedBatch.name}" is closed for admission.` };
    }
    const usage = computeBatchSeatUsage(resolvedBatch);
    if (usage.isFull) {
      return {
        ok: false,
        statusCode: 409,
        error: `Batch "${resolvedBatch.name}" has reached full seat capacity (${resolvedBatch.seatLimit}/${resolvedBatch.seatLimit}).`,
      };
    }
  }

  return { ok: true, resolvedBatch };
}

export function resolveTeacherInstructorIds(
  user: Pick<User, 'id' | 'email' | 'name'>,
  instructors: Instructor[]
): Set<string> {
  const ids = new Set<string>([user.id]);
  const cleanName = user.name.trim().toLowerCase();
  for (const inst of instructors) {
    if (inst.userId === user.id || inst.name.trim().toLowerCase() === cleanName) {
      ids.add(inst.id);
    }
  }
  return ids;
}

export function canTeacherManageCourse(
  user: Pick<User, 'id' | 'role' | 'email' | 'name'>,
  course: Course | undefined,
  instructors: Instructor[],
  batches: CourseBatch[] = []
): boolean {
  if (!course) return false;
  if (user.role === 'admin') return true;
  if (user.role !== 'teacher') return false;

  if (course.createdByUserId && course.createdByUserId === user.id) return true;

  const teacherIds = resolveTeacherInstructorIds(user, instructors);
  if ((course.instructorIds ?? []).some((id) => teacherIds.has(id))) {
    return true;
  }
  return batches.some((b) => b.courseId === course.id && teacherIds.has(b.instructorId));
}

export function getTeacherAssignedCourseIds(
  user: Pick<User, 'id' | 'role' | 'email' | 'name'>,
  courses: Course[],
  instructors: Instructor[],
  batches: CourseBatch[] = []
): Set<string> {
  const set = new Set<string>();
  for (const c of courses) {
    if (canTeacherManageCourse(user, c, instructors, batches)) {
      set.add(c.id);
    }
  }
  return set;
}

export interface CurriculumChapterNode {
  chapter: CourseChapter;
  lessons: CourseLesson[];
}

export interface CurriculumModuleNode {
  module: CourseModule;
  chapters: CurriculumChapterNode[];
  directLessons: CourseLesson[];
  totalLessons: number;
}

export function computeCurriculumHierarchy(
  courseId: string,
  modules: CourseModule[],
  chapters: CourseChapter[],
  lessons: CourseLesson[],
  includeDrafts = true
): {
  modulesTree: CurriculumModuleNode[];
  unassignedLessons: CourseLesson[];
  orderedLessons: CourseLesson[];
} {
  const courseLessons = [...lessons]
    .filter((l) => l.courseId === courseId && (includeDrafts || (l.status ?? 'published') !== 'draft'))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const courseModules = [...modules]
    .filter((m) => m.courseId === courseId && (includeDrafts || (m.status ?? 'published') !== 'draft'))
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Synthesize virtual modules from lesson.moduleName if no explicit CourseModule records exist
  const workingModules: CourseModule[] = [...courseModules];
  const titleToModuleId = new Map<string, string>();
  for (const m of workingModules) {
    titleToModuleId.set(m.title.trim().toLowerCase(), m.id);
  }
  for (const les of courseLessons) {
    if (les.moduleId && workingModules.some((m) => m.id === les.moduleId)) continue;
    const modName = (les.moduleName || 'Module 1: Core Curriculum').trim();
    const key = modName.toLowerCase();
    if (!titleToModuleId.has(key)) {
      const synthId = `mod-virt-${courseId}-${workingModules.length + 1}`;
      workingModules.push({
        id: synthId,
        courseId,
        title: modName,
        orderIndex: workingModules.length + 1,
        status: 'published',
      });
      titleToModuleId.set(key, synthId);
    }
  }

  const courseChapters = [...chapters]
    .filter((ch) => ch.courseId === courseId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const assignedLessonIds = new Set<string>();
  const orderedLessons: CourseLesson[] = [];

  const modulesTree: CurriculumModuleNode[] = workingModules.map((mod) => {
    const modChapters = courseChapters.filter((ch) => ch.moduleId === mod.id);
    const modLessons = courseLessons.filter((l) => {
      if (l.moduleId) return l.moduleId === mod.id;
      return (l.moduleName || 'Module 1: Core Curriculum').trim().toLowerCase() === mod.title.trim().toLowerCase();
    });

    const chapterNodes: CurriculumChapterNode[] = modChapters.map((ch) => {
      const chLessons = modLessons.filter((l) => l.chapterId === ch.id);
      chLessons.forEach((l) => {
        assignedLessonIds.add(l.id);
        orderedLessons.push(l);
      });
      return { chapter: ch, lessons: chLessons };
    });

    const directLessons = modLessons.filter((l) => !assignedLessonIds.has(l.id));
    directLessons.forEach((l) => {
      assignedLessonIds.add(l.id);
      orderedLessons.push(l);
    });

    return {
      module: mod,
      chapters: chapterNodes,
      directLessons,
      totalLessons: directLessons.length + chapterNodes.reduce((s, c) => s + c.lessons.length, 0),
    };
  });

  const unassignedLessons = courseLessons.filter((l) => !assignedLessonIds.has(l.id));
  unassignedLessons.forEach((l) => orderedLessons.push(l));

  return { modulesTree, unassignedLessons, orderedLessons };
}

export function isLessonUnlockedForStudent(
  course: Pick<Course, 'sequentialAccess'> | undefined,
  orderedPublishedLessons: CourseLesson[],
  completedLessonIds: string[],
  targetLessonId: string
): { unlocked: boolean; blockingLessonTitle?: string } {
  const targetIdx = orderedPublishedLessons.findIndex((l) => l.id === targetLessonId);
  if (targetIdx <= 0) return { unlocked: true };
  const target = orderedPublishedLessons[targetIdx];
  if (target.isFreePreview) return { unlocked: true };

  const enforceSequential = Boolean(course?.sequentialAccess) || Boolean(target.sequentialLock);
  if (!enforceSequential) return { unlocked: true };

  const completedSet = new Set(completedLessonIds);
  for (let i = 0; i < targetIdx; i += 1) {
    const prev = orderedPublishedLessons[i];
    if (prev.completionRequired !== false && !completedSet.has(prev.id)) {
      return { unlocked: false, blockingLessonTitle: prev.title };
    }
  }
  return { unlocked: true };
}

export interface CourseCompletionEvaluation {
  progressPercent: number;
  completedLessonsCount: number;
  totalPublishedLessons: number;
  passedExamsCount: number;
  totalCourseExams: number;
  bestExamPercent: number;
  completedAssignmentsCount: number;
  totalAssignmentsCount: number;
  eligibleForCertificate: boolean;
  unmetRequirements: string[];
}

export function computeCourseCompletionStatus(params: {
  course: Course;
  lessons: CourseLesson[];
  enrollment: Enrollment | undefined;
  exams: Exam[];
  examAttempts: ExamAttempt[];
  assignments: CourseAssignment[];
  submissions: AssignmentSubmission[];
}): CourseCompletionEvaluation {
  const { course, lessons, enrollment, exams, examAttempts, assignments, submissions } = params;
  const publishedLessons = lessons.filter(
    (l) => l.courseId === course.id && (l.status ?? 'published') !== 'draft'
  );
  const completedSet = new Set(enrollment?.completedLessonIds ?? []);
  const completedLessonsCount = publishedLessons.filter((l) => completedSet.has(l.id)).length;
  const totalPublishedLessons = publishedLessons.length;
  const progressPercent =
    totalPublishedLessons > 0
      ? Math.min(100, Math.round((completedLessonsCount / totalPublishedLessons) * 100))
      : 0;

  const courseExams = exams.filter((ex) => ex.courseId === course.id);
  const userId = enrollment?.userId ?? '';
  const userCourseAttempts = examAttempts.filter(
    (a) => a.userId === userId && courseExams.some((ex) => ex.id === a.examId)
  );
  const passedExamsCount = new Set(
    userCourseAttempts.filter((a) => a.passed).map((a) => a.examId)
  ).size;
  const bestExamPercent = userCourseAttempts.reduce(
    (max, a) => Math.max(max, a.percentage || 0),
    0
  );

  const courseAssignments = assignments.filter((a) => a.courseId === course.id);
  const userSubs = submissions.filter(
    (s) => s.userId === userId && s.courseId === course.id
  );
  const completedAssignmentsCount = new Set(
    userSubs
      .filter((s) => s.status === 'submitted' || s.status === 'graded')
      .map((s) => s.assignmentId)
  ).size;

  const criteria = course.certificateCriteria ?? {
    enabled: true,
    minProgressPercent: 80,
    requireExamPass: false,
    minExamPercent: 50,
    requireAssignmentCompletion: false,
  };

  const unmetRequirements: string[] = [];
  if (!enrollment || enrollment.status !== 'approved') {
    unmetRequirements.push('Approved course enrollment required.');
  }
  if (!criteria.enabled) {
    unmetRequirements.push('Certificate issuance is disabled for this course.');
  } else {
    if (progressPercent < (criteria.minProgressPercent ?? 80)) {
      unmetRequirements.push(
        `Complete at least ${criteria.minProgressPercent ?? 80}% of course lessons (currently ${progressPercent}%).`
      );
    }
    if (criteria.requireExamPass && courseExams.length > 0) {
      const minExam = criteria.minExamPercent ?? 50;
      if (passedExamsCount === 0 || bestExamPercent < minExam) {
        unmetRequirements.push(
          `Pass a course exam with at least ${minExam}% score (best: ${bestExamPercent}%).`
        );
      }
    }
    if (criteria.requireAssignmentCompletion && courseAssignments.length > 0) {
      if (completedAssignmentsCount < courseAssignments.length) {
        unmetRequirements.push(
          `Submit all ${courseAssignments.length} course assignment(s) (${completedAssignmentsCount}/${courseAssignments.length} done).`
        );
      }
    }
  }

  return {
    progressPercent,
    completedLessonsCount,
    totalPublishedLessons,
    passedExamsCount,
    totalCourseExams: courseExams.length,
    bestExamPercent,
    completedAssignmentsCount,
    totalAssignmentsCount: courseAssignments.length,
    eligibleForCertificate: unmetRequirements.length === 0,
    unmetRequirements,
  };
}

export function generateCertificateNumber(
  courseId: string,
  userId: string,
  now = new Date()
): string {
  const year = now.getUTCFullYear();
  const cTag = courseId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-4) || 'CRS1';
  const uTag = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-4) || 'STD1';
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AEC-CERT-${year}-${cTag}-${uTag}-${rand}`;
}

export interface CourseAnalyticsSummary {
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  unpublishedCourses: number;
  archivedCourses: number;
  featuredCourses: number;
  totalEnrollments: number;
  activeApprovedEnrollments: number;
  courseRevenue: number;
  avgCompletionRate: number;
  totalCertificatesIssued: number;
  totalAssignments: number;
  popularCourses: {
    courseId: string;
    title: string;
    category: string;
    status: CourseStatus;
    enrollments: number;
    revenue: number;
    completionRate: number;
    batchCount: number;
  }[];
  categoryBreakdown: {
    category: string;
    courses: number;
    enrollments: number;
    revenue: number;
  }[];
}

export function computeCourseAnalytics(params: {
  courses: Course[];
  batches: CourseBatch[];
  lessons: CourseLesson[];
  enrollments: Enrollment[];
  certificates?: CourseCertificate[];
  assignments?: CourseAssignment[];
}): CourseAnalyticsSummary {
  const { courses, batches, lessons, enrollments, certificates = [], assignments = [] } = params;

  const publishedCourses = courses.filter((c) => isCourseStatusLive(c.status)).length;
  const draftCourses = courses.filter((c) => c.status === 'draft').length;
  const unpublishedCourses = courses.filter((c) => c.status === 'unpublished').length;
  const archivedCourses = courses.filter((c) => c.status === 'archived').length;
  const featuredCourses = courses.filter((c) => Boolean(c.featured)).length;

  const approvedEnrollments = enrollments.filter((e) => e.status === 'approved');
  const courseRevenue = approvedEnrollments.reduce((s, e) => s + (Number(e.amountPaid) || 0), 0);

  let completionPctSum = 0;
  let completionSamples = 0;

  const catMap = new Map<string, { category: string; courses: number; enrollments: number; revenue: number }>();

  const popularCourses = courses
    .map((c) => {
      const courseApproved = approvedEnrollments.filter((e) => e.courseId === c.id);
      const rev = courseApproved.reduce((s, e) => s + (Number(e.amountPaid) || 0), 0);
      const pubLessons = lessons.filter(
        (l) => l.courseId === c.id && (l.status ?? 'published') !== 'draft'
      );
      let courseCompletionSum = 0;
      for (const e of courseApproved) {
        const pct =
          pubLessons.length > 0
            ? Math.min(100, Math.round((e.completedLessonIds.length / pubLessons.length) * 100))
            : 0;
        courseCompletionSum += pct;
        completionPctSum += pct;
        completionSamples += 1;
      }
      const completionRate =
        courseApproved.length > 0 ? Math.round(courseCompletionSum / courseApproved.length) : 0;

      const catEntry = catMap.get(c.category) ?? {
        category: c.category,
        courses: 0,
        enrollments: 0,
        revenue: 0,
      };
      catEntry.courses += 1;
      catEntry.enrollments += c.enrolledCount + courseApproved.length;
      catEntry.revenue += rev;
      catMap.set(c.category, catEntry);

      return {
        courseId: c.id,
        title: c.title,
        category: c.category,
        status: c.status,
        enrollments: c.enrolledCount,
        revenue: rev,
        completionRate,
        batchCount: batches.filter((b) => b.courseId === c.id).length,
      };
    })
    .sort((a, b) => b.enrollments - a.enrollments || b.revenue - a.revenue);

  return {
    totalCourses: courses.length,
    publishedCourses,
    draftCourses,
    unpublishedCourses,
    archivedCourses,
    featuredCourses,
    totalEnrollments: courses.reduce((s, c) => s + (Number(c.enrolledCount) || 0), 0),
    activeApprovedEnrollments: approvedEnrollments.length,
    courseRevenue,
    avgCompletionRate: completionSamples > 0 ? Math.round(completionPctSum / completionSamples) : 0,
    totalCertificatesIssued: certificates.filter((c) => !c.revoked).length,
    totalAssignments: assignments.length,
    popularCourses,
    categoryBreakdown: Array.from(catMap.values()).sort((a, b) => b.enrollments - a.enrollments),
  };
}

export function buildCourseJsonLd(
  course: Course,
  instructors: Instructor[],
  reviews: Review[],
  originUrl = 'https://alomsenglishcenter.com'
): Record<string, unknown> {
  const approvedReviews = reviews.filter(
    (r) => (r.status ?? 'approved') === 'approved' && (!r.courseId || r.courseId === course.id)
  );
  const avgRating =
    approvedReviews.length > 0
      ? (
          approvedReviews.reduce((s, r) => s + Math.min(5, Math.max(1, r.rating || 5)), 0) /
          approvedReviews.length
        ).toFixed(1)
      : '5.0';

  const safeCanonical =
    sanitizeSafeUrl(course.seo?.canonicalUrl ?? '', '') ||
    `${originUrl.replace(/\/$/, '')}/course/${course.slug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.seo?.metaTitle || course.title,
    description: course.seo?.metaDescription || course.subtitle || course.description.slice(0, 160),
    url: safeCanonical,
    provider: {
      '@type': 'EducationalOrganization',
      name: "Alom's English Center",
      sameAs: originUrl,
    },
    educationalLevel: course.level || course.levelTag,
    inLanguage: course.language || 'English & Bangla',
    courseMode: course.courseType || 'Hybrid',
    instructor: instructors.map((inst) => ({
      '@type': 'Person',
      name: inst.name,
      jobTitle: inst.roleTitle,
    })),
    offers: {
      '@type': 'Offer',
      price: String(course.isFree ? 0 : course.price),
      priceCurrency: 'BDT',
      availability: isCourseEnrollable(course).ok
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
    ...(approvedReviews.length > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating,
            reviewCount: approvedReviews.length,
          },
        }
      : {}),
  };
}

function csvSafeCell(val: unknown): string {
  const str = String(val ?? '').replace(/\r?\n/g, ' ');
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function formatCoursesCsv(
  courses: Course[],
  batches: CourseBatch[] = [],
  instructors: Instructor[] = []
): string {
  const instMap = new Map(instructors.map((i) => [i.id, i.name]));
  const header = [
    'ID',
    'Title',
    'Slug',
    'Category',
    'Level',
    'Type',
    'Status',
    'Visibility',
    'Price (BDT)',
    'Original Price',
    'Admission Fee',
    'Enrolled',
    'Batches',
    'Instructors',
  ];

  const rows = courses.map((c) => {
    const batchCount = batches.filter((b) => b.courseId === c.id).length;
    const instNames = (c.instructorIds ?? []).map((id) => instMap.get(id) || id).join('; ');
    return [
      c.id,
      c.title,
      c.slug,
      c.category,
      c.level || c.levelTag,
      c.courseType || 'Hybrid',
      c.status,
      c.visibility || 'public',
      c.price,
      c.originalPrice,
      c.admissionFee || 0,
      c.enrolledCount,
      batchCount,
      instNames,
    ]
      .map(csvSafeCell)
      .join(',');
  });

  return [header.map(csvSafeCell).join(','), ...rows].join('\n');
}

const VALID_CATEGORIES: Course['category'][] = [
  'HSC English',
  'SSC English',
  'IELTS & Spoken',
  'Grammar Pro',
  'Admission',
  'Combo Packs',
];

export function parseBulkCoursesImport(
  rawInput: string,
  existingCourses: Course[],
  branches: Branch[],
  instructors: Instructor[]
): { courses: Course[]; errors: string[] } {
  const trimmed = rawInput.trim();
  const courses: Course[] = [];
  const errors: string[] = [];
  if (!trimmed) {
    return { courses, errors: ['Import payload cannot be empty.'] };
  }

  const defaultBranches = branches.filter((b) => b.status === 'active').map((b) => b.id);
  const fallbackBranchIds = defaultBranches.length ? [defaultBranches[0]] : ['br-mirpur'];
  const fallbackInstructorIds = instructors.length ? [instructors[0].id] : ['inst-1'];

  const buildRow = (row: Record<string, unknown>, idx: number) => {
    const title = String(row.title ?? '').trim().slice(0, 180);
    if (!title) {
      errors.push(`Row #${idx + 1}: missing course title.`);
      return;
    }
    const rawCat = String(row.category ?? 'HSC English').trim();
    const category = VALID_CATEGORIES.includes(rawCat as Course['category'])
      ? (rawCat as Course['category'])
      : 'HSC English';
    const price = Math.max(0, Math.round(Number(row.price ?? 1990) || 0));
    const originalPrice = Math.max(price, Math.round(Number(row.originalPrice ?? price) || price));
    const statusRaw = String(row.status ?? 'draft').toLowerCase();
    const status: CourseStatus =
      statusRaw === 'published' || statusRaw === 'active'
        ? 'published'
        : statusRaw === 'unpublished'
          ? 'unpublished'
          : statusRaw === 'archived'
            ? 'archived'
            : 'draft';

    const slug = generateCourseSlug(String(row.slug ?? title), [...existingCourses, ...courses]);
    courses.push({
      id: `crs-${Date.now()}-${idx}`,
      slug,
      title,
      subtitle: String(row.subtitle ?? `${category} structured program`).trim().slice(0, 260),
      category,
      levelTag: String(row.levelTag ?? '2026 Batch').trim().slice(0, 40),
      level:
        row.level === 'Beginner' || row.level === 'Advanced' ? row.level : 'Intermediate',
      courseType:
        row.courseType === 'Offline' || row.courseType === 'Online' ? row.courseType : 'Hybrid',
      isCombo: category === 'Combo Packs' || Boolean(row.isCombo),
      price,
      originalPrice,
      isFree: price === 0,
      enrolledCount: 0,
      examSystemIncluded: true,
      branchIds: fallbackBranchIds,
      instructorIds: fallbackInstructorIds,
      thumbnail: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
      description: String(row.description ?? `${title} — Enterprise LMS program`).trim(),
      highlights: ['Structured Curriculum', 'PDF Lecture Notes', 'Assessments & Certificate'],
      demoVideoTitle: `${title} — Intro`,
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status,
      visibility: 'public',
      enrollmentAvailability: 'open',
      createdAt: new Date().toISOString(),
    });
  };

  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as Array<Record<string, unknown>>;
      if (!Array.isArray(parsed)) {
        return { courses, errors: ['JSON import must be an array of course objects.'] };
      }
      parsed.forEach((row, idx) => buildRow(row, idx));
      return { courses, errors };
    } catch {
      return { courses, errors: ['Invalid JSON syntax in bulk course import.'] };
    }
  }

  // Pipe or CSV lines: Title | Category | Price | OriginalPrice | LevelTag | Status | Subtitle
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  lines.forEach((line, idx) => {
    const delimiter = line.includes('|') ? '|' : ',';
    const parts = line.split(delimiter).map((p) => p.replace(/^"|"$/g, '').trim());
    if (idx === 0 && parts[0].toLowerCase() === 'title') return; // skip header row
    if (parts.length < 2) {
      errors.push(`Line ${idx + 1}: expected "Title | Category | Price | OriginalPrice | LevelTag | Status | Subtitle"`);
      return;
    }
    buildRow(
      {
        title: parts[0],
        category: parts[1],
        price: parts[2],
        originalPrice: parts[3],
        levelTag: parts[4],
        status: parts[5],
        subtitle: parts[6],
      },
      idx
    );
  });

  return { courses, errors };
}

export const COURSE_TEMPLATES: {
  id: string;
  name: string;
  description: string;
  defaults: Partial<Course>;
  sampleModules: string[];
}[] = [
  {
    id: 'tpl-hsc-academic',
    name: 'HSC Academic English Intensive',
    description: 'Pre-configured 2-paper grammar, flowchart, summary & weekly CQ/MCQ assessment layout.',
    defaults: {
      category: 'HSC English',
      levelTag: 'HSC 27',
      level: 'Intermediate',
      courseType: 'Hybrid',
      language: 'Bangla & English',
      durationLabel: '6 Months',
      totalClasses: 60,
      estimatedHours: 90,
      sequentialAccess: false,
      highlights: [
        'HSC 1st & 2nd Paper Complete Coverage',
        'Modifiers, Connectors, Narration & Flow Charts',
        'Weekly Board-Standard Model Tests',
        'Printable Bilingual Lecture Sheets',
      ],
      certificateCriteria: {
        enabled: true,
        minProgressPercent: 80,
        requireExamPass: true,
        minExamPercent: 50,
        requireAssignmentCompletion: false,
      },
    },
    sampleModules: ['Module 1: HSC 2nd Paper Grammar', 'Module 2: HSC 1st Paper Text & Flow Charts', 'Module 3: Freehand Writing & Mock Exams'],
  },
  {
    id: 'tpl-ielts-mastery',
    name: 'IELTS Band 8.0 Mastery Bootcamp',
    description: '4-module IELTS Academic & GT blueprint with Writing Task evaluation and Speaking drills.',
    defaults: {
      category: 'IELTS & Spoken',
      levelTag: 'IELTS 8.0',
      level: 'Advanced',
      courseType: 'Online',
      language: 'English',
      durationLabel: '3 Months',
      totalClasses: 42,
      estimatedHours: 75,
      sequentialAccess: true,
      highlights: [
        'Listening, Reading, Writing Task 1 & 2, Speaking',
        'Line-by-Line Essay Feedback',
        'Timed Mock Tests & Cue Card Bank',
      ],
      certificateCriteria: {
        enabled: true,
        minProgressPercent: 85,
        requireExamPass: true,
        minExamPercent: 60,
        requireAssignmentCompletion: true,
      },
    },
    sampleModules: ['Module 1: IELTS Listening & Reading', 'Module 2: Writing Task 1 & 2', 'Module 3: Speaking Interviews & Mock Tests'],
  },
  {
    id: 'tpl-spoken-fluency',
    name: 'Spoken English & Phonetics Bootcamp',
    description: 'Practical daily fluency, pronunciation shadowing, and presentation confidence course.',
    defaults: {
      category: 'IELTS & Spoken',
      levelTag: 'Spoken Pro',
      level: 'Beginner',
      courseType: 'Hybrid',
      language: 'English & Bangla',
      durationLabel: '10 Weeks',
      totalClasses: 30,
      estimatedHours: 45,
      sequentialAccess: false,
      highlights: [
        '40 Practical Speaking Drills',
        'IPA Pronunciation & Accent Clarity',
        'Interview & Presentation Roleplays',
      ],
      certificateCriteria: {
        enabled: true,
        minProgressPercent: 75,
        requireExamPass: false,
        requireAssignmentCompletion: true,
      },
    },
    sampleModules: ['Module 1: Phonetics & Pronunciation', 'Module 2: Everyday Dialogues & Roleplay'],
  },
];
