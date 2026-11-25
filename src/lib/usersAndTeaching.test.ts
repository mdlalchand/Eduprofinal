import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTeacherStudentRoster,
  computeUserRoleSummary,
  filterUsersDirectory,
  formatUsersCsv,
  recalculateExamAttemptGrade,
  validateProfileUpdate,
} from './usersAndTeaching';
import type { Branch, CourseLesson, Enrollment, ExamAttempt, LearnerRewardProfile, User } from '../types';

const SAMPLE_USERS: User[] = [
  {
    id: 'u-1',
    name: 'Admin Director',
    email: 'admin@alomsenglish.com',
    phone: '01710000001',
    role: 'admin',
    branchId: 'br-mirpur',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u-2',
    name: 'Mahmudul Hasan',
    email: 'teacher@alomsenglish.com',
    phone: '01710000003',
    role: 'teacher',
    branchId: 'br-uttara',
    subjectSpecialty: 'IELTS & Spoken',
    status: 'active',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'u-3',
    name: 'Arafat Rahman',
    email: 'student@alomsenglish.com',
    phone: '01710000004',
    role: 'student',
    branchId: 'br-mirpur',
    rollNumber: 'AEC-2026-104',
    status: 'active',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    id: 'u-4',
    name: '=Suspended User',
    email: 'bad@example.com',
    phone: '01710000099',
    role: 'student',
    branchId: 'br-uttara',
    rollNumber: 'AEC-2026-109',
    status: 'suspended',
    createdAt: '2026-01-04T00:00:00.000Z',
  },
];

test('filterUsersDirectory and computeUserRoleSummary filter by role, branch, status, and search', () => {
  const summary = computeUserRoleSummary(SAMPLE_USERS);
  assert.equal(summary.total, 4);
  assert.equal(summary.active, 3);
  assert.equal(summary.suspended, 1);
  assert.equal(summary.student, 2);
  assert.equal(summary.teacher, 1);

  const byRole = filterUsersDirectory(SAMPLE_USERS, {
    role: 'teacher',
    branchId: 'all',
    status: 'all',
    search: 'ielts',
  });
  assert.equal(byRole.length, 1);
  assert.equal(byRole[0].id, 'u-2');

  const suspended = filterUsersDirectory(SAMPLE_USERS, {
    role: 'all',
    branchId: 'br-uttara',
    status: 'suspended',
    search: '',
  });
  assert.equal(suspended.length, 1);
  assert.equal(suspended[0].id, 'u-4');

  const extended = [
    ...SAMPLE_USERS,
    {
      id: 'u-5',
      name: 'Banani Campus Lead',
      email: 'banani@example.com',
      phone: '01710000105',
      role: 'branch' as const,
      branchId: 'br-mirpur',
      status: 'pending' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
    },
  ];
  const extSummary = computeUserRoleSummary(extended);
  assert.equal(extSummary.pending, 1);
  assert.equal(extSummary.branch, 1);

  const pendingBranches = filterUsersDirectory(extended, {
    role: 'branch',
    branchId: 'all',
    status: 'pending',
    search: '',
  });
  assert.equal(pendingBranches.length, 1);
  assert.equal(pendingBranches[0].id, 'u-5');
});

test('formatUsersCsv neutralizes spreadsheet formula cells and maps branch names', () => {
  const branches: Branch[] = [
    {
      id: 'br-mirpur',
      name: 'Mirpur Campus',
      code: 'MPR',
      city: 'Dhaka',
      address: 'Road 6',
      phone: '01700',
      managerName: 'Tariqul',
      activeStudents: 100,
      status: 'active',
    },
  ];
  const csv = formatUsersCsv(SAMPLE_USERS, branches);
  assert.ok(csv.includes('Mirpur Campus'));
  assert.ok(csv.includes('"\'=Suspended User"'));
});

test('recalculateExamAttemptGrade clamps scores and computes accurate percentage and letter grades', () => {
  const pass = recalculateExamAttemptGrade(17, 20, 40);
  assert.equal(pass.score, 17);
  assert.equal(pass.percentage, 85);
  assert.equal(pass.grade, 'A+');
  assert.equal(pass.passed, true);

  const fail = recalculateExamAttemptGrade(5, 20, 40);
  assert.equal(fail.percentage, 25);
  assert.equal(fail.grade, 'F');
  assert.equal(fail.passed, false);

  const clamped = recalculateExamAttemptGrade(999, 20, 40);
  assert.equal(clamped.score, 20);
  assert.equal(clamped.percentage, 100);
});

test('buildTeacherStudentRoster aggregates enrollments, progress, exam averages, attendance, and XP', () => {
  const enrollments: Enrollment[] = [
    {
      id: 'enr-1',
      userId: 'u-3',
      studentName: 'Arafat Rahman',
      studentEmail: 'student@alomsenglish.com',
      courseId: 'crs-1',
      courseTitle: 'HSC English Mastery',
      branchId: 'br-mirpur',
      paymentMethod: 'bKash',
      amountPaid: 2500,
      status: 'approved',
      completedLessonIds: ['les-1'],
      enrolledAt: '2026-02-01T00:00:00.000Z',
    },
  ];
  const lessons: CourseLesson[] = [
    {
      id: 'les-1',
      courseId: 'crs-1',
      lessonType: 'recorded',
      title: 'Lesson 1',
      moduleName: 'M1',
      duration: '20:00',
      videoPreviewTitle: 'Lesson 1',
      videoUrl: 'https://youtube.com/watch?v=abc',
      sheetSummary: 'Notes',
      isFreePreview: true,
      orderIndex: 1,
    },
    {
      id: 'les-2',
      courseId: 'crs-1',
      lessonType: 'recorded',
      title: 'Lesson 2',
      moduleName: 'M1',
      duration: '25:00',
      videoPreviewTitle: 'Lesson 2',
      videoUrl: 'https://youtube.com/watch?v=def',
      sheetSummary: 'Notes',
      isFreePreview: false,
      orderIndex: 2,
    },
  ];
  const attempts: ExamAttempt[] = [
    {
      id: 'att-1',
      examId: 'ex-1',
      examTitle: 'Grammar Quiz',
      userId: 'u-3',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-104',
      branchId: 'br-mirpur',
      score: 18,
      totalMarks: 20,
      percentage: 90,
      grade: 'A+',
      passed: true,
      answers: {},
      submittedAt: '2026-02-05T00:00:00.000Z',
    },
  ];
  const rewardsByUser: Record<string, LearnerRewardProfile> = {
    'u-3': {
      userId: 'u-3',
      studentName: 'Arafat Rahman',
      branchId: 'br-mirpur',
      xp: 320,
      streakDays: 6,
      badges: ['Quiz Challenger'],
      showOnLeaderboard: true,
      completedScormIds: [],
      updatedAt: '2026-02-05T00:00:00.000Z',
    },
  };

  const roster = buildTeacherStudentRoster({
    users: SAMPLE_USERS,
    enrollments,
    lessons,
    examAttempts: attempts,
    attendance: [],
    rewardsByUser,
    courseIdFilter: 'crs-1',
    search: 'arafat',
  });
  assert.equal(roster.length, 1);
  assert.equal(roster[0].avgLessonProgress, 50);
  assert.equal(roster[0].avgExamPercent, 90);
  assert.equal(roster[0].xp, 320);
});

test('validateProfileUpdate enforces name, phone, and current password when changing password', () => {
  assert.equal(validateProfileUpdate({ name: 'Alomgir', phone: '01710000001' }).ok, true);
  assert.equal(validateProfileUpdate({ name: 'A', phone: '01710000001' }).ok, false);
  assert.equal(
    validateProfileUpdate({
      name: 'Alomgir',
      phone: '01710000001',
      newPassword: 'newpass123',
      currentPassword: '',
    }).ok,
    false
  );
  assert.equal(
    validateProfileUpdate({
      name: 'Alomgir',
      phone: '01710000001',
      newPassword: 'newpass123',
      currentPassword: 'oldpass',
    }).ok,
    true
  );
});
