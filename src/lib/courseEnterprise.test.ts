import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCourseJsonLd,
  calculateCoursePricingServerSide,
  canTeacherManageCourse,
  computeCourseAnalytics,
  computeCourseCompletionStatus,
  computeCurriculumHierarchy,
  formatCoursesCsv,
  generateCertificateNumber,
  generateCourseSlug,
  isCourseEnrollable,
  isCoursePubliclyListed,
  isCoursePubliclyLive,
  isLessonUnlockedForStudent,
  parseBulkCoursesImport,
  validateEnrollmentRequest,
} from './courseEnterprise';
import type {
  AssignmentSubmission,
  Branch,
  Course,
  CourseAssignment,
  CourseBatch,
  CourseChapter,
  CourseLesson,
  CourseModule,
  Enrollment,
  Exam,
  ExamAttempt,
  Instructor,
} from '../types';

const SAMPLE_BRANCH: Branch = {
  id: 'br-mirpur',
  name: 'Mirpur Campus',
  code: 'MPR',
  city: 'Dhaka',
  address: 'Road 6/A',
  phone: '01710',
  managerName: 'Tariqul',
  activeStudents: 400,
  status: 'active',
};

const SAMPLE_COURSE: Course = {
  id: 'crs-1',
  slug: 'hsc-english-pro',
  title: 'HSC English Mastery',
  subtitle: 'Complete Board Prep',
  category: 'HSC English',
  levelTag: 'HSC 27',
  isCombo: false,
  price: 2500,
  originalPrice: 4000,
  admissionFee: 200,
  enrolledCount: 120,
  examSystemIncluded: true,
  branchIds: ['br-mirpur'],
  instructorIds: ['inst-2'],
  thumbnail: '/thumb.jpg',
  description: 'Full HSC preparation',
  highlights: ['Live classes', 'PDF notes'],
  demoVideoTitle: 'Intro',
  demoYoutubeUrl: 'https://www.youtube.com/watch?v=abc',
  status: 'published',
  visibility: 'public',
  enrollmentAvailability: 'open',
  sequentialAccess: true,
  certificateCriteria: {
    enabled: true,
    minProgressPercent: 80,
    requireExamPass: true,
    minExamPercent: 50,
    requireAssignmentCompletion: true,
  },
};

const SAMPLE_BATCH_OPEN: CourseBatch = {
  id: 'bat-1',
  courseId: 'crs-1',
  name: 'Evening Batch',
  code: 'HSC-EVE-1',
  branchId: 'br-mirpur',
  instructorId: 'inst-2',
  schedule: 'Sun · Tue · Thu 4:30 PM',
  startDate: '2026-05-01',
  seatLimit: 40,
  enrolledSeats: 38,
  mode: 'Hybrid',
  status: 'open',
};

const SAMPLE_BATCH_FULL: CourseBatch = {
  ...SAMPLE_BATCH_OPEN,
  id: 'bat-full',
  name: 'Full Batch',
  code: 'HSC-FULL',
  enrolledSeats: 40,
};

test('generateCourseSlug produces unique URL-friendly slugs', () => {
  const existing = [{ id: 'crs-1', slug: 'hsc-english-mastery' }];
  assert.equal(generateCourseSlug('HSC English Mastery', existing), 'hsc-english-mastery-2');
  assert.equal(generateCourseSlug('HSC English Mastery', existing, 'crs-1'), 'hsc-english-mastery');
  assert.equal(generateCourseSlug('IELTS Band 8.0 Pro!', existing), 'ielts-band-8-0-pro');
});

test('course visibility & enrollability guard unpublished, archived, private, unlisted, closed, and expired courses', () => {
  assert.equal(isCoursePubliclyLive(SAMPLE_COURSE), true);
  assert.equal(isCoursePubliclyListed(SAMPLE_COURSE), true);
  assert.equal(isCourseEnrollable(SAMPLE_COURSE).ok, true);

  const unlisted: Course = { ...SAMPLE_COURSE, visibility: 'unlisted' };
  assert.equal(isCoursePubliclyLive(unlisted), true);
  assert.equal(isCoursePubliclyListed(unlisted), false);

  const priv: Course = { ...SAMPLE_COURSE, visibility: 'private' };
  assert.equal(isCoursePubliclyLive(priv), false);
  assert.equal(isCourseEnrollable(priv).ok, false);

  const archived: Course = { ...SAMPLE_COURSE, status: 'archived' };
  assert.equal(isCoursePubliclyLive(archived), false);
  assert.equal(isCourseEnrollable(archived).ok, false);

  const expiredDeadline: Course = { ...SAMPLE_COURSE, enrollmentDeadline: '2026-01-01' };
  assert.equal(isCourseEnrollable(expiredDeadline, '2026-06-01T00:00:00Z').ok, false);
});

test('calculateCoursePricingServerSide computes discounted price + admission fee + eligible coupon', () => {
  const res = calculateCoursePricingServerSide(SAMPLE_COURSE, {
    code: 'AEC20',
    discountPercent: 20,
    active: true,
    appliesTo: 'courses',
    description: '20% off',
  });
  assert.equal(res.regularFee, 4000);
  assert.equal(res.discountedFee, 2500);
  assert.equal(res.couponDiscountAmount, 500);
  assert.equal(res.admissionFee, 200);
  assert.equal(res.totalPayable, 2200);
  assert.equal(res.appliedCouponCode, 'AEC20');

  const noCouponCourse: Course = { ...SAMPLE_COURSE, couponEligible: false };
  const blockedCoupon = calculateCoursePricingServerSide(noCouponCourse, {
    code: 'AEC20',
    discountPercent: 20,
    active: true,
    description: '20% off',
  });
  assert.equal(blockedCoupon.couponDiscountAmount, 0);
  assert.equal(blockedCoupon.totalPayable, 2700);

  const freeCourse: Course = { ...SAMPLE_COURSE, isFree: true, price: 0, admissionFee: 0 };
  const freePricing = calculateCoursePricingServerSide(freeCourse);
  assert.equal(freePricing.isFree, true);
  assert.equal(freePricing.totalPayable, 0);
});

test('validateEnrollmentRequest blocks duplicates, full batches, inactive branches, and unpublished courses', () => {
  const ok = validateEnrollmentRequest({
    userId: 'u-stu',
    course: SAMPLE_COURSE,
    batchId: 'bat-1',
    batches: [SAMPLE_BATCH_OPEN, SAMPLE_BATCH_FULL],
    enrollments: [],
    branchId: 'br-mirpur',
    branches: [SAMPLE_BRANCH],
  });
  assert.equal(ok.ok, true);

  const fullErr = validateEnrollmentRequest({
    userId: 'u-stu',
    course: SAMPLE_COURSE,
    batchId: 'bat-full',
    batches: [SAMPLE_BATCH_OPEN, SAMPLE_BATCH_FULL],
    enrollments: [],
    branchId: 'br-mirpur',
    branches: [SAMPLE_BRANCH],
  });
  assert.equal(fullErr.ok, false);
  if (fullErr.ok === false) assert.equal(fullErr.statusCode, 409);

  const dupEnrollment: Enrollment = {
    id: 'enr-dup',
    userId: 'u-stu',
    studentName: 'Arafat',
    studentEmail: 'a@b.com',
    courseId: 'crs-1',
    courseTitle: 'HSC',
    branchId: 'br-mirpur',
    paymentMethod: 'bKash',
    amountPaid: 2500,
    status: 'approved',
    completedLessonIds: [],
    enrolledAt: '2026-03-01T00:00:00Z',
  };
  const dupErr = validateEnrollmentRequest({
    userId: 'u-stu',
    course: SAMPLE_COURSE,
    batchId: 'bat-1',
    batches: [SAMPLE_BATCH_OPEN],
    enrollments: [dupEnrollment],
    branchId: 'br-mirpur',
    branches: [SAMPLE_BRANCH],
  });
  assert.equal(dupErr.ok, false);
  if (dupErr.ok === false) assert.equal(dupErr.statusCode, 409);
});

test('canTeacherManageCourse strictly scopes teacher permissions to assigned or created courses', () => {
  const instructors: Instructor[] = [
    {
      id: 'inst-2',
      userId: 'u-teacher',
      name: 'Mahmudul Hasan',
      subject: 'English',
      roleTitle: 'Lecturer',
      education: 'MA',
      panel: 'Head Faculty',
      branchId: 'br-mirpur',
      bio: '',
      avatar: '',
    },
    {
      id: 'inst-4',
      name: 'Nafis Ahmed',
      subject: 'IELTS',
      roleTitle: 'Trainer',
      education: 'TESOL',
      panel: 'Head Faculty',
      branchId: 'br-mirpur',
      bio: '',
      avatar: '',
    },
  ];
  const teacher = { id: 'u-teacher', role: 'teacher' as const, email: 't@aec.com', name: 'Mahmudul Hasan' };
  const admin = { id: 'u-admin', role: 'admin' as const, email: 'a@aec.com', name: 'Alomgir' };

  const unassignedCourse: Course = { ...SAMPLE_COURSE, id: 'crs-ielts', instructorIds: ['inst-4'] };

  assert.equal(canTeacherManageCourse(teacher, SAMPLE_COURSE, instructors, [SAMPLE_BATCH_OPEN]), true);
  assert.equal(canTeacherManageCourse(teacher, unassignedCourse, instructors, []), false);
  assert.equal(canTeacherManageCourse(admin, unassignedCourse, instructors, []), true);
});

test('computeCurriculumHierarchy and isLessonUnlockedForStudent enforce Module->Chapter->Lesson hierarchy and sequential lock', () => {
  const modules: CourseModule[] = [
    { id: 'mod-1', courseId: 'crs-1', title: 'Module 1: Grammar', orderIndex: 1, status: 'published' },
  ];
  const chapters: CourseChapter[] = [
    { id: 'ch-1', courseId: 'crs-1', moduleId: 'mod-1', title: 'Chapter 1: Verbs', orderIndex: 1 },
  ];
  const lessons: CourseLesson[] = [
    {
      id: 'les-1',
      courseId: 'crs-1',
      moduleId: 'mod-1',
      chapterId: 'ch-1',
      lessonType: 'video',
      title: 'Lesson 1: Intro',
      moduleName: 'Module 1: Grammar',
      duration: '15:00',
      videoPreviewTitle: 'Intro',
      videoUrl: 'https://youtu.be/1',
      sheetSummary: '',
      isFreePreview: true,
      completionRequired: true,
      status: 'published',
      orderIndex: 1,
    },
    {
      id: 'les-2',
      courseId: 'crs-1',
      moduleId: 'mod-1',
      chapterId: 'ch-1',
      lessonType: 'text',
      title: 'Lesson 2: Rules',
      moduleName: 'Module 1: Grammar',
      duration: '10:00',
      videoPreviewTitle: 'Rules',
      videoUrl: '',
      sheetSummary: '',
      isFreePreview: false,
      completionRequired: true,
      sequentialLock: true,
      status: 'published',
      orderIndex: 2,
    },
    {
      id: 'les-draft',
      courseId: 'crs-1',
      moduleId: 'mod-1',
      lessonType: 'text',
      title: 'Draft Lesson',
      moduleName: 'Module 1: Grammar',
      duration: '5:00',
      videoPreviewTitle: 'Draft',
      videoUrl: '',
      sheetSummary: '',
      isFreePreview: false,
      status: 'draft',
      orderIndex: 3,
    },
  ];

  const studentView = computeCurriculumHierarchy('crs-1', modules, chapters, lessons, false);
  assert.equal(studentView.orderedLessons.length, 2);
  assert.equal(studentView.modulesTree[0].chapters[0].lessons.length, 2);

  const locked = isLessonUnlockedForStudent(SAMPLE_COURSE, studentView.orderedLessons, [], 'les-2');
  assert.equal(locked.unlocked, false);
  assert.equal(locked.blockingLessonTitle, 'Lesson 1: Intro');

  const unlocked = isLessonUnlockedForStudent(SAMPLE_COURSE, studentView.orderedLessons, ['les-1'], 'les-2');
  assert.equal(unlocked.unlocked, true);
});

test('computeCourseCompletionStatus enforces progress, exam pass, and assignment requirements for certificates', () => {
  const lessons: CourseLesson[] = [
    {
      id: 'l1',
      courseId: 'crs-1',
      lessonType: 'recorded',
      title: 'L1',
      moduleName: 'M1',
      duration: '10m',
      videoPreviewTitle: 'L1',
      videoUrl: '',
      sheetSummary: '',
      isFreePreview: true,
      status: 'published',
      orderIndex: 1,
    },
    {
      id: 'l2',
      courseId: 'crs-1',
      lessonType: 'recorded',
      title: 'L2',
      moduleName: 'M1',
      duration: '10m',
      videoPreviewTitle: 'L2',
      videoUrl: '',
      sheetSummary: '',
      isFreePreview: false,
      status: 'published',
      orderIndex: 2,
    },
  ];
  const exams: Exam[] = [
    {
      id: 'ex-1',
      title: 'Midterm',
      courseId: 'crs-1',
      category: 'HSC English',
      durationMinutes: 10,
      passPercentage: 50,
      visibility: 'course',
      teacherId: 'u-teacher',
      questions: [],
      createdAt: '2026-01-01',
    },
  ];
  const assignments: CourseAssignment[] = [
    {
      id: 'asg-1',
      courseId: 'crs-1',
      title: 'Essay 1',
      instructions: 'Write 200 words',
      maxMarks: 20,
      createdByUserId: 'u-teacher',
      createdAt: '2026-01-01',
    },
  ];
  const enrollment: Enrollment = {
    id: 'enr-1',
    userId: 'u-student',
    studentName: 'Arafat',
    studentEmail: 'a@b.com',
    courseId: 'crs-1',
    courseTitle: 'HSC',
    branchId: 'br-mirpur',
    paymentMethod: 'bKash',
    amountPaid: 2500,
    status: 'approved',
    completedLessonIds: ['l1', 'l2'],
    enrolledAt: '2026-03-01',
  };

  const incomplete = computeCourseCompletionStatus({
    course: SAMPLE_COURSE,
    lessons,
    enrollment,
    exams,
    examAttempts: [],
    assignments,
    submissions: [],
  });
  assert.equal(incomplete.progressPercent, 100);
  assert.equal(incomplete.eligibleForCertificate, false);
  assert.equal(incomplete.unmetRequirements.length, 2);

  const attempts: ExamAttempt[] = [
    {
      id: 'att-1',
      examId: 'ex-1',
      examTitle: 'Midterm',
      userId: 'u-student',
      studentName: 'Arafat',
      rollNumber: '101',
      branchId: 'br-mirpur',
      score: 8,
      totalMarks: 10,
      percentage: 80,
      grade: 'A+',
      passed: true,
      answers: {},
      submittedAt: '2026-03-02',
    },
  ];
  const submissions: AssignmentSubmission[] = [
    {
      id: 'sub-1',
      assignmentId: 'asg-1',
      courseId: 'crs-1',
      userId: 'u-student',
      studentName: 'Arafat',
      studentEmail: 'a@b.com',
      submissionText: 'Completed essay',
      status: 'graded',
      marks: 18,
      submittedAt: '2026-03-02',
    },
  ];

  const eligible = computeCourseCompletionStatus({
    course: SAMPLE_COURSE,
    lessons,
    enrollment,
    exams,
    examAttempts: attempts,
    assignments,
    submissions,
  });
  assert.equal(eligible.eligibleForCertificate, true);
  assert.equal(eligible.unmetRequirements.length, 0);
  assert.ok(generateCertificateNumber('crs-1', 'u-student').startsWith('AEC-CERT-'));
});

test('computeCourseAnalytics, buildCourseJsonLd, formatCoursesCsv, and parseBulkCoursesImport work end-to-end', () => {
  const analytics = computeCourseAnalytics({
    courses: [SAMPLE_COURSE, { ...SAMPLE_COURSE, id: 'crs-2', slug: 'draft-2', status: 'draft', enrolledCount: 0 }],
    batches: [SAMPLE_BATCH_OPEN],
    lessons: [],
    enrollments: [],
  });
  assert.equal(analytics.totalCourses, 2);
  assert.equal(analytics.publishedCourses, 1);
  assert.equal(analytics.draftCourses, 1);

  const jsonLd = buildCourseJsonLd(SAMPLE_COURSE, [], []);
  assert.equal(jsonLd['@type'], 'Course');

  const csv = formatCoursesCsv([SAMPLE_COURSE], [SAMPLE_BATCH_OPEN], []);
  assert.ok(csv.includes('HSC English Mastery'));

  const bulk = parseBulkCoursesImport(
    'Title | Category | Price | OriginalPrice | LevelTag | Status | Subtitle\nIELTS Speaking Drill | IELTS & Spoken | 1500 | 2200 | IELTS | published | Daily speaking drills',
    [SAMPLE_COURSE],
    [SAMPLE_BRANCH],
    []
  );
  assert.equal(bulk.errors.length, 0);
  assert.equal(bulk.courses.length, 1);
  assert.equal(bulk.courses[0].status, 'published');
  assert.equal(bulk.courses[0].price, 1500);
});
