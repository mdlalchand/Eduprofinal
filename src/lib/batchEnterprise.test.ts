import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDeleteBatch,
  computeBatchCapacitySummary,
  computeBatchDashboardAnalytics,
  detectScheduleConflicts,
  getTeacherAssignedBatches,
  redactBatchForViewer,
  resolveCourseCategories,
  validateBatchStudentAddition,
  validateBatchTransfer,
} from './batchEnterprise';
import type {
  AttendanceRecord,
  CategoryItem,
  Course,
  CourseBatch,
  Enrollment,
  Instructor,
  PaymentTransaction,
  User,
} from '../types';

const SAMPLE_COURSES: Course[] = [
  {
    id: 'crs-1',
    slug: 'hsc-english',
    title: 'HSC 27 English',
    subtitle: 'Board Mastery',
    category: 'HSC English',
    levelTag: 'HSC 27',
    isCombo: false,
    price: 2500,
    originalPrice: 3500,
    enrolledCount: 20,
    examSystemIncluded: true,
    branchIds: ['br-1'],
    instructorIds: ['inst-1'],
    thumbnail: '/img.jpg',
    description: 'Full course',
    highlights: [],
    demoVideoTitle: 'Intro',
    demoYoutubeUrl: 'https://youtube.com/watch?v=123',
    status: 'active',
  },
];

const SAMPLE_INSTRUCTORS: Instructor[] = [
  {
    id: 'inst-1',
    userId: 'u-t1',
    name: 'Alomgir Hossain',
    subject: 'HSC English',
    roleTitle: 'Lead Instructor',
    education: 'DU',
    panel: 'Head Faculty',
    branchId: 'br-1',
    bio: '',
    avatar: '',
  },
  {
    id: 'inst-2',
    userId: 'u-t2',
    name: 'Nusrat Jahan',
    subject: 'IELTS',
    roleTitle: 'Senior Lecturer',
    education: 'CU',
    panel: 'Branch Faculty',
    branchId: 'br-1',
    bio: '',
    avatar: '',
  },
];

const SAMPLE_BATCHES: CourseBatch[] = [
  {
    id: 'bat-1',
    courseId: 'crs-1',
    name: 'Morning Batch A',
    code: 'HSC-M-A',
    branchId: 'br-1',
    instructorId: 'inst-1',
    schedule: 'Sun · Tue — 4:30 PM',
    schedules: [
      {
        id: 's1',
        dayOfWeek: 'Sun',
        startTime: '16:30',
        endTime: '18:00',
        durationMinutes: 90,
        instructorId: 'inst-1',
        roomLabel: 'Room 201',
        status: 'scheduled',
      },
    ],
    startDate: '2026-04-01',
    endDate: '2026-09-30',
    seatLimit: 30,
    enrolledSeats: 29,
    mode: 'Hybrid',
    status: 'running',
    lifecycleStatus: 'active',
    classroom: { classroomName: 'Room 201', building: 'Main', floor: '2nd', roomNumber: '201' },
    onlineSettings: {
      platform: 'Zoom',
      meetingLink: 'https://zoom.us/j/secret123',
      meetingId: '123 456 789',
      meetingPassword: 'TOP-SECRET-PASSWORD',
      instructions: 'Join 5 min early.',
    },
  },
  {
    id: 'bat-2',
    courseId: 'crs-1',
    name: 'Evening Batch B',
    code: 'HSC-E-B',
    branchId: 'br-1',
    instructorId: 'inst-2',
    schedule: 'Mon · Wed — 7:00 PM',
    schedules: [
      {
        id: 's2',
        dayOfWeek: 'Mon',
        startTime: '19:00',
        endTime: '20:30',
        durationMinutes: 90,
        instructorId: 'inst-2',
        roomLabel: 'Room 202',
        status: 'scheduled',
      },
    ],
    startDate: '2026-04-01',
    endDate: '2026-09-30',
    seatLimit: 40,
    enrolledSeats: 10,
    mode: 'Offline Branch',
    status: 'open',
    lifecycleStatus: 'enrollment_open',
  },
];

test('resolveCourseCategories merges dynamic active course categories and preserves defaults', () => {
  const cats: CategoryItem[] = [
    { id: 'c1', name: 'BCS & Job English', slug: 'bcs-job-english', type: 'course', description: '', active: true },
    { id: 'c2', name: 'Inactive Cat', slug: 'inactive', type: 'course', description: '', active: false },
    { id: 'c3', name: 'Books Only', slug: 'books', type: 'product', description: '', active: true },
  ];
  const resolved = resolveCourseCategories(cats, SAMPLE_COURSES);
  assert.ok(resolved.includes('BCS & Job English'));
  assert.ok(!resolved.includes('Inactive Cat'));
  assert.ok(!resolved.includes('Books Only'));
  assert.ok(resolved.includes('HSC English'));
});

test('detectScheduleConflicts prevents teacher and classroom double-booking', () => {
  // Overlapping time on Sunday with inst-1
  const teacherConflicts = detectScheduleConflicts({
    candidateBatchId: 'bat-new',
    candidateStartDate: '2026-05-01',
    candidateEndDate: '2026-08-01',
    candidateInstructorIds: ['inst-1'],
    candidateClassroomKey: 'Room 305',
    candidateSlots: [
      {
        id: 'new-1',
        dayOfWeek: 'Sun',
        startTime: '17:00',
        endTime: '18:30',
        durationMinutes: 90,
        status: 'scheduled',
      },
    ],
    existingBatches: SAMPLE_BATCHES,
  });
  assert.equal(teacherConflicts.length, 1);
  assert.equal(teacherConflicts[0].kind, 'teacher');

  // Classroom conflict on Sunday with different teacher
  const roomConflicts = detectScheduleConflicts({
    candidateBatchId: 'bat-new-2',
    candidateStartDate: '2026-05-01',
    candidateEndDate: '2026-08-01',
    candidateInstructorIds: ['inst-2'],
    candidateClassroomKey: 'Room 201',
    candidateSlots: [
      {
        id: 'new-2',
        dayOfWeek: 'Sun',
        startTime: '16:00',
        endTime: '17:00',
        durationMinutes: 60,
        status: 'scheduled',
      },
    ],
    existingBatches: SAMPLE_BATCHES,
  });
  assert.equal(roomConflicts.length, 1);
  assert.equal(roomConflicts[0].kind, 'classroom');

  // Non-overlapping time produces 0 conflicts
  const clean = detectScheduleConflicts({
    candidateBatchId: 'bat-new-3',
    candidateStartDate: '2026-05-01',
    candidateEndDate: '2026-08-01',
    candidateInstructorIds: ['inst-1'],
    candidateClassroomKey: 'Room 201',
    candidateSlots: [
      {
        id: 'new-3',
        dayOfWeek: 'Sun',
        startTime: '18:30',
        endTime: '20:00',
        durationMinutes: 90,
        status: 'scheduled',
      },
    ],
    existingBatches: SAMPLE_BATCHES,
  });
  assert.equal(clean.length, 0);
});

test('validateBatchStudentAddition enforces eligibility, duplicate, and seat capacity guards', () => {
  const validStudent: User = {
    id: 'u-stu-1',
    name: 'Arafat',
    email: 'a@example.com',
    phone: '017',
    role: 'student',
    branchId: 'br-1',
    status: 'active',
    createdAt: '2026-01-01',
  };
  const suspendedStudent: User = { ...validStudent, id: 'u-stu-susp', status: 'suspended' };
  const teacherUser: User = { ...validStudent, id: 'u-t1', role: 'teacher' };

  assert.equal(
    validateBatchStudentAddition({
      batch: SAMPLE_BATCHES[0],
      course: SAMPLE_COURSES[0],
      student: suspendedStudent,
      enrollments: [],
    }).ok,
    false
  );
  assert.equal(
    validateBatchStudentAddition({
      batch: SAMPLE_BATCHES[0],
      course: SAMPLE_COURSES[0],
      student: teacherUser,
      enrollments: [],
    }).ok,
    false
  );

  const fullBatch: CourseBatch = { ...SAMPLE_BATCHES[0], enrolledSeats: 30, seatLimit: 30 };
  const fullRes = validateBatchStudentAddition({
    batch: fullBatch,
    course: SAMPLE_COURSES[0],
    student: validStudent,
    enrollments: [],
  });
  assert.equal(fullRes.ok, false);
  if (!fullRes.ok) assert.equal(fullRes.statusCode, 409);

  const existingEnr: Enrollment[] = [
    {
      id: 'enr-1',
      userId: 'u-stu-1',
      studentName: 'Arafat',
      studentEmail: 'a@example.com',
      courseId: 'crs-1',
      courseTitle: 'HSC 27 English',
      branchId: 'br-1',
      batchId: 'bat-1',
      paymentMethod: 'bKash',
      amountPaid: 2500,
      status: 'approved',
      completedLessonIds: [],
      enrolledAt: '2026-04-02',
    },
  ];
  const dupRes = validateBatchStudentAddition({
    batch: SAMPLE_BATCHES[1],
    course: SAMPLE_COURSES[0],
    student: validStudent,
    enrollments: existingEnr,
  });
  assert.equal(dupRes.ok, false);
  if (!dupRes.ok) assert.equal(dupRes.statusCode, 409);
});

test('validateBatchTransfer, canDeleteBatch, redactBatchForViewer, and teacher RBAC enforce strict safety', () => {
  const enr: Enrollment = {
    id: 'enr-1',
    userId: 'u-stu-1',
    studentName: 'Arafat',
    studentEmail: 'a@example.com',
    courseId: 'crs-1',
    courseTitle: 'HSC 27 English',
    branchId: 'br-1',
    batchId: 'bat-1',
    paymentMethod: 'bKash',
    amountPaid: 2500,
    status: 'approved',
    completedLessonIds: [],
    enrolledAt: '2026-04-02',
  };

  assert.equal(
    validateBatchTransfer({
      enrollment: enr,
      sourceBatch: SAMPLE_BATCHES[0],
      targetBatch: SAMPLE_BATCHES[1],
      targetCourse: SAMPLE_COURSES[0],
      enrollments: [enr],
    }).ok,
    true
  );

  // Safe delete blocks when attendance/payment/enrollment depend on batch
  const att: AttendanceRecord[] = [
    {
      id: 'att-1',
      targetType: 'student',
      targetId: 'u-stu-1',
      targetName: 'Arafat',
      branchId: 'br-1',
      batchId: 'bat-1',
      date: '2026-04-05',
      status: 'present',
      recordedBy: 'Admin',
    },
  ];
  const txn: PaymentTransaction[] = [
    {
      id: 'txn-1',
      invoiceNo: 'INV-1',
      referenceType: 'course',
      referenceId: 'enr-1',
      userId: 'u-stu-1',
      payerName: 'Arafat',
      gateway: 'bKash',
      walletOrLast4: '017',
      trxId: 'TRX1',
      subtotal: 2500,
      discountAmount: 0,
      deliveryFee: 0,
      totalAmount: 2500,
      status: 'completed',
      createdAt: '2026-04-02',
    },
  ];
  const delBlock = canDeleteBatch({
    batch: SAMPLE_BATCHES[0],
    enrollments: [enr],
    attendance: att,
    transactions: txn,
  });
  assert.equal(delBlock.allowed, false);

  // Redaction hides meetingPassword from unauthenticated / non-enrolled users
  const anonRedacted = redactBatchForViewer(SAMPLE_BATCHES[0], null, [enr], SAMPLE_INSTRUCTORS);
  assert.equal(anonRedacted.onlineSettings?.meetingPassword, undefined);
  assert.equal(anonRedacted.onlineSettings?.credentialsProtected, true);

  const enrolledStudent: User = {
    id: 'u-stu-1',
    name: 'Arafat',
    email: 'a@example.com',
    phone: '017',
    role: 'student',
    branchId: 'br-1',
    createdAt: '2026-01-01',
  };
  const studentVisible = redactBatchForViewer(
    SAMPLE_BATCHES[0],
    enrolledStudent,
    [enr],
    SAMPLE_INSTRUCTORS
  );
  assert.equal(studentVisible.onlineSettings?.meetingPassword, 'TOP-SECRET-PASSWORD');

  // Teacher RBAC scopes to assigned batches only
  const teacher2: User = {
    id: 'u-t2',
    name: 'Nusrat Jahan',
    email: 't2@example.com',
    phone: '018',
    role: 'teacher',
    branchId: 'br-1',
    createdAt: '2026-01-01',
  };
  const t2Batches = getTeacherAssignedBatches(teacher2, SAMPLE_BATCHES, SAMPLE_INSTRUCTORS);
  assert.equal(t2Batches.length, 1);
  assert.equal(t2Batches[0].id, 'bat-2');

  const analytics = computeBatchDashboardAnalytics({
    batches: SAMPLE_BATCHES,
    courses: SAMPLE_COURSES,
    enrollments: [enr],
    attendance: att,
    transactions: txn,
    todayDayName: 'Sun',
  });
  assert.equal(analytics.kpis.totalBatches, 2);
  assert.equal(analytics.kpis.todaysClasses, 1);
  assert.equal(computeBatchCapacitySummary(SAMPLE_BATCHES[0], 3).waitlistCount, 3);
});
