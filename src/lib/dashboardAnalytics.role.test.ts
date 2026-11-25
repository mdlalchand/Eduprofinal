import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalyticsOverviewSeries,
  buildCourseProgressSummary,
  buildFuturisticKpiCards,
  buildRecentActivityFeed,
  buildTopStudents,
  buildUpcomingClassRows,
  type DashboardSourceData,
} from './dashboardAnalytics';

const baseCourse = {
  id: 'crs-1',
  slug: 'spoken-english',
  title: 'Spoken English Pro',
  subtitle: 'Fluency & Pronunciation',
  category: 'Spoken English' as const,
  levelTag: 'Intermediate',
  isCombo: false,
  price: 2500,
  originalPrice: 4000,
  enrolledCount: 120,
  examSystemIncluded: true,
  branchIds: ['br-1'],
  instructorIds: ['ins-1'],
  thumbnail: '',
  description: '',
  highlights: [],
  demoVideoTitle: '',
  demoYoutubeUrl: '',
  status: 'active' as const,
};

const baseLesson = {
  id: 'les-1',
  courseId: 'crs-1',
  batchId: 'bat-1',
  batchName: 'Morning Batch A',
  title: 'Phonetics & Intonation Live',
  moduleName: 'Module 1',
  duration: '45m',
  videoPreviewTitle: 'Phonetics Intro',
  videoUrl: '',
  sheetSummary: 'Pronunciation chart',
  orderIndex: 1,
  lessonType: 'live' as const,
  liveStatus: 'live_now' as const,
  scheduledAt: '2026-11-24T10:00:00Z',
  isFreePreview: false,
};

const baseBatch = {
  id: 'bat-1',
  name: 'Morning Batch A',
  code: 'BAT-2026A',
  courseId: 'crs-1',
  branchId: 'br-1',
  instructorId: 'ins-1',
  schedule: 'Sun & Tue · 10:00 AM',
  seatLimit: 40,
  enrolledSeats: 18,
  mode: 'Hybrid' as const,
  status: 'running' as const,
  startDate: '2026-10-01',
};

const baseEnrollment = {
  id: 'enr-1',
  userId: 'u-stu',
  studentName: 'Nadia Rahman',
  studentEmail: 'nadia@example.com',
  courseId: 'crs-1',
  courseTitle: 'Spoken English Pro',
  branchId: 'br-1',
  batchId: 'bat-1',
  paymentMethod: 'bKash' as const,
  invoiceNo: 'INV-101',
  amountPaid: 2500,
  status: 'approved' as const,
  completedLessonIds: ['les-1'],
  enrolledAt: '2026-11-01T08:00:00Z',
};

const baseAttempt = {
  id: 'att-1',
  examId: 'ex-1',
  examTitle: 'Midterm Fluency Test',
  userId: 'u-stu',
  studentName: 'Nadia Rahman',
  rollNumber: 'AEC-2026-101',
  branchId: 'br-1',
  score: 88,
  totalMarks: 100,
  percentage: 88,
  grade: 'A+',
  passed: true,
  submittedAt: '2026-11-15T12:00:00Z',
  answers: {},
};

const baseAttendance = {
  id: 'atnd-1',
  targetType: 'student' as const,
  targetId: 'u-stu',
  targetName: 'Nadia Rahman',
  branchId: 'br-1',
  date: '2026-11-20',
  status: 'present' as const,
  recordedBy: 'Tariq Sir',
};

const baseRewards = {
  userId: 'u-stu',
  studentName: 'Nadia Rahman',
  branchId: 'br-1',
  xp: 340,
  streakDays: 6,
  badges: ['Early Bird'],
  showOnLeaderboard: true,
  completedScormIds: [],
  updatedAt: '2026-11-20T00:00:00Z',
};

test('student dashboard builders compute student-specific KPIs, progress, analytics, and activities', () => {
  const studentData: DashboardSourceData = {
    role: 'student',
    metrics: { mediaCount: 3 },
    courses: [baseCourse],
    batches: [baseBatch],
    lessons: [baseLesson],
    enrollments: [baseEnrollment],
    examAttempts: [baseAttempt],
    attendance: [baseAttendance],
    certificates: [],
    assignmentSubmissions: [],
    rewards: baseRewards,
  };

  const kpis = buildFuturisticKpiCards(studentData);
  assert.equal(kpis.length, 4);
  assert.equal(kpis[0].label, 'Enrolled Courses');
  assert.equal(kpis[0].valueDisplay, '1');
  assert.equal(kpis[1].label, 'Lesson Progress');
  assert.equal(kpis[1].valueDisplay, '100%');
  assert.equal(kpis[2].label, 'Exam Average');
  assert.equal(kpis[2].valueDisplay, '88%');
  assert.equal(kpis[3].label, 'XP & Streak');
  assert.equal(kpis[3].valueDisplay, '340 XP');

  const overview = buildAnalyticsOverviewSeries(studentData, 'Last 6 Months');
  assert.deepEqual(overview.seriesLabels, ['Lesson Progress %', 'Exam Scores %', 'Attendance %']);
  assert.equal(overview.highlightValue, 100);

  const progress = buildCourseProgressSummary(studentData);
  assert.equal(progress.overallPercent, 100);
  assert.equal(progress.completedPct, 100);

  const feed = buildRecentActivityFeed(studentData);
  assert.ok(feed.length >= 3);
  assert.ok(feed.some((item) => item.text.includes('Midterm Fluency Test')));

  const upcoming = buildUpcomingClassRows(studentData);
  assert.equal(upcoming[0].timeText, 'LIVE NOW');
});

test('admin dashboard builders compute real database figures without fake minimum floors', () => {
  const adminData: DashboardSourceData = {
    role: 'admin',
    metrics: { totalCourses: 1, totalBatches: 1, enrollments: 1, activeBranches: 1, totalStudents: 1 },
    courses: [baseCourse],
    batches: [baseBatch],
    enrollments: [baseEnrollment],
    attendance: [baseAttendance],
    transactions: [
      {
        id: 'tx-1',
        invoiceNo: 'INV-900',
        referenceType: 'course',
        referenceId: 'crs-1',
        userId: 'u-stu',
        payerName: 'Nadia Rahman',
        gateway: 'bKash',
        walletOrLast4: '01711111111',
        trxId: 'TRX900',
        subtotal: 2500,
        discountAmount: 0,
        deliveryFee: 0,
        totalAmount: 2500,
        status: 'completed',
        createdAt: '2026-11-20T10:00:00Z',
      },
    ],
  };

  const kpis = buildFuturisticKpiCards(adminData);
  assert.equal(kpis[0].label, 'Total Students');
  assert.equal(kpis[0].valueDisplay, '1');
  assert.notEqual(kpis[0].valueDisplay, '3570');
  assert.equal(kpis[1].label, 'Total Teachers');
  assert.equal(kpis[2].label, 'Total Courses');
  assert.equal(kpis[2].valueDisplay, '1');
  assert.equal(kpis[3].label, 'Total Batches');
  assert.equal(kpis[3].valueDisplay, '1');

  const overview = buildAnalyticsOverviewSeries(adminData, 'This Quarter');
  assert.deepEqual(overview.seriesLabels, ['Students', 'Approved Enrollments', 'Lessons']);

  const feed = buildRecentActivityFeed(adminData);
  assert.ok(feed.some((item) => item.text.includes('INV-900')));
});

test('guardian dashboard builders aggregate linked children metrics, progress, and performers', () => {
  const guardianData: DashboardSourceData = {
    role: 'guardian',
    metrics: { avgExamScore: 88, avgAttendanceRate: 100 },
    children: [
      {
        student: {
          id: 'u-stu',
          name: 'Nadia Rahman',
          email: 'nadia@example.com',
          phone: '01711111111',
          role: 'student',
          branchId: 'br-1',
          rollNumber: 'AEC-2026-101',
          createdAt: '2026-10-01T00:00:00Z',
        },
        enrollments: [baseEnrollment],
        examAttempts: [baseAttempt],
        attendance: [baseAttendance],
        certificates: [],
        rewards: baseRewards,
      },
    ],
    lessons: [baseLesson],
  };

  const kpis = buildFuturisticKpiCards(guardianData);
  assert.equal(kpis[0].label, 'Linked Children');
  assert.equal(kpis[0].valueDisplay, '1');
  assert.equal(kpis[1].label, 'Child Avg Exam');
  assert.equal(kpis[1].valueDisplay, '88%');
  assert.equal(kpis[2].label, 'Attendance Rate');
  assert.equal(kpis[2].valueDisplay, '100%');

  const top = buildTopStudents(guardianData);
  assert.equal(top.length, 1);
  assert.equal(top[0].name, 'Nadia Rahman');
  assert.equal(top[0].marks, 88);

  const overview = buildAnalyticsOverviewSeries(guardianData, 'Last 6 Months');
  assert.deepEqual(overview.seriesLabels, ['Exam Score %', 'Attendance %', 'Course Mastery %']);
});

test('teacher dashboard builders compute coached students, graded scripts, and submissions feed', () => {
  const teacherData: DashboardSourceData = {
    role: 'teacher',
    metrics: { submissionsGraded: 1, pendingSubmissions: 1 },
    courses: [baseCourse],
    batches: [baseBatch],
    lessons: [baseLesson],
    enrollments: [baseEnrollment],
    exams: [
      {
        id: 'ex-1',
        title: 'Midterm Fluency Test',
        courseId: 'crs-1',
        category: 'Spoken English',
        durationMinutes: 30,
        passPercentage: 60,
        visibility: 'course',
        teacherId: 'u-teacher',
        questions: [],
        createdAt: '2026-10-15T00:00:00Z',
      },
    ],
    examAttempts: [baseAttempt],
    assignmentSubmissions: [
      {
        id: 'sub-1',
        assignmentId: 'asg-1',
        courseId: 'crs-1',
        userId: 'u-stu',
        studentName: 'Nadia Rahman',
        studentEmail: 'nadia@example.com',
        answerText: 'Completed homework',
        status: 'submitted',
        submittedAt: '2026-11-21T09:00:00Z',
      },
    ],
    attendance: [baseAttendance],
  };

  const kpis = buildFuturisticKpiCards(teacherData);
  assert.equal(kpis[0].label, 'Coached Students');
  assert.equal(kpis[1].label, 'Graded Scripts');
  assert.equal(kpis[1].deltaPercent, '1 pending');
  assert.equal(kpis[2].label, 'Assigned Courses');
  assert.equal(kpis[3].label, 'Assigned Batches');

  const feed = buildRecentActivityFeed(teacherData);
  assert.ok(feed.some((item) => item.text.includes('submitted assignment')));
});
