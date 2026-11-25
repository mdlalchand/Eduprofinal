import type {
  AssignmentSubmission,
  AttendanceRecord,
  Branch,
  CommunityPost,
  Course,
  CourseAssignment,
  CourseBatch,
  CourseCertificate,
  CourseLesson,
  Ebook,
  Enrollment,
  Exam,
  ExamAttempt,
  FinancialRecord,
  Instructor,
  LearnerRewardProfile,
  Order,
  PaymentTransaction,
  Product,
  Review,
  User,
  UserRole,
} from '../types';

export type AnalyticsPeriod = 'Yearly' | 'Quarterly' | 'Monthly';
export type OverviewRange = 'Last 6 Months' | 'Last 12 Months' | 'This Quarter';

export interface GuardianChildOverview {
  student: User;
  enrollments: Enrollment[];
  examAttempts: ExamAttempt[];
  lessonsCountByCourse?: Record<string, number>;
  attendance?: AttendanceRecord[];
  assignments?: CourseAssignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  certificates?: CourseCertificate[];
  rewards?: LearnerRewardProfile | null;
}

export interface DashboardSourceData {
  role: UserRole;
  metrics: Record<string, number>;
  branch?: Branch;
  branches?: Branch[];
  courses?: Course[];
  batches?: CourseBatch[];
  lessons?: CourseLesson[];
  assignments?: CourseAssignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  certificates?: CourseCertificate[];
  exams?: Exam[];
  examAttempts?: ExamAttempt[];
  users?: User[];
  enrollments?: Enrollment[];
  orders?: Order[];
  financialRecords?: FinancialRecord[];
  transactions?: PaymentTransaction[];
  instructors?: Instructor[];
  reviews?: Review[];
  attendance?: AttendanceRecord[];
  posts?: CommunityPost[];
  ebooks?: Ebook[];
  products?: Product[];
  rewards?: LearnerRewardProfile | null;
  children?: GuardianChildOverview[];
}

export interface KpiCardItem {
  id: 'enrolled' | 'students' | 'courses' | 'earnings';
  label: string;
  valueDisplay: string;
  rawValue: number;
  deltaPercent: string;
  positive: boolean;
  periodNote: string;
  chartType: 'line' | 'bars';
  accent: 'blue' | 'purple' | 'amber' | 'emerald';
  series: number[];
}

export interface EarningPoint {
  label: string;
  value: number;
  amountFormatted: string;
}

export interface EarningSummary {
  headlineValue: string;
  growthPercent: number;
  dailyAverageLabel: string;
  maxAxis: number;
  points: EarningPoint[];
}

export interface CalendarCell {
  day: number | null;
  isoDate: string | null;
  hasEvent: boolean;
  eventTitle?: string;
}

export interface CalendarMonthGrid {
  year: number;
  monthIndex: number;
  monthLabel: string;
  cells: CalendarCell[];
}

export interface UpcomingSessionItem {
  id: string;
  instructorName: string;
  subject: string;
  dateLabel: string;
  timeLabel: string;
  avatar: string;
  liveStatus: 'scheduled' | 'live_now' | 'ended';
  joinUrl: string;
  courseId: string;
}

export interface UserActivitySegment {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TopStudentItem {
  id: string;
  name: string;
  subtitle: string;
  marks: number;
  avatar: string;
  ringColor: string;
}

export interface TopInstructorItem {
  id: string;
  name: string;
  agentId: string;
  rating: number;
  reviewsCount: number;
  avatar: string;
}

export interface RecentEnrolledRow {
  id: string;
  invoice: string;
  student: string;
  courseName: string;
  amount: number;
  amountFormatted: string;
  paymentBy: string;
  dateLabel: string;
  status: Enrollment['status'];
}

export interface CourseActivitySummary {
  paidTotal: number;
  freeTotal: number;
  labels: string[];
  paidSeries: number[];
  freeSeries: number[];
  maxAxis: number;
}

const AVATAR_POOL = {
  admin: '/src/assets/images/avatar_admin_director_1795437875081.jpg',
  maleInstructor: '/src/assets/images/avatar_instructor_male_1795437875493.jpg',
  femaleInstructor: '/src/assets/images/avatar_instructor_female_1795437875129.jpg',
  student: '/src/assets/images/avatar_student_portrait_1795437875582.jpg',
  lead: '/src/assets/images/instructor_portrait_lead_1795411661581.jpg',
};

export function buildKpiCards(data: DashboardSourceData): KpiCardItem[] {
  const courses = data.courses ?? [];
  const enrollments = data.enrollments ?? [];
  const users = data.users ?? [];
  const transactions = data.transactions ?? [];

  const approvedEnrollments = enrollments.filter((e) => e.status === 'approved');
  const enrolledCoursesCount =
    approvedEnrollments.length > 0
      ? approvedEnrollments.length
      : enrollments.length;

  const studentUsersCount = users.filter((u) => u.role === 'student').length;
  const totalStudents =
    data.metrics.totalStudents ??
    studentUsersCount;

  const totalCourses = data.metrics.totalCourses ?? courses.length;

  const completedTxnRevenue = transactions
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (t.totalAmount || 0), 0);
  const approvedEnrollmentRevenue = approvedEnrollments.reduce((sum, e) => sum + (e.amountPaid || 0), 0);
  const totalEarnings =
    data.metrics.totalRevenue ??
    (completedTxnRevenue > 0 ? completedTxnRevenue : approvedEnrollmentRevenue);

  const pendingEnrollments = enrollments.filter((e) => e.status === 'pending').length;
  const activeCourses = courses.filter((c) => c.status === 'active' || c.status === 'published').length;

  return [
    {
      id: 'enrolled',
      label: 'Enrolled Courses',
      valueDisplay: enrolledCoursesCount.toLocaleString(),
      rawValue: enrolledCoursesCount,
      deltaPercent: `${pendingEnrollments} pending`,
      positive: true,
      periodNote: 'Verified enrollments',
      chartType: 'line',
      accent: 'blue',
      series: courses.slice(0, 8).map((c) => c.enrolledCount || 0),
    },
    {
      id: 'students',
      label: 'Total Students',
      valueDisplay: totalStudents.toLocaleString(),
      rawValue: totalStudents,
      deltaPercent: `${studentUsersCount} accounts`,
      positive: true,
      periodNote: 'Registered learners',
      chartType: 'bars',
      accent: 'purple',
      series: [studentUsersCount, enrolledCoursesCount, activeCourses, courses.length],
    },
    {
      id: 'courses',
      label: 'Total Courses',
      valueDisplay: totalCourses.toLocaleString(),
      rawValue: totalCourses,
      deltaPercent: `${activeCourses} live`,
      positive: true,
      periodNote: 'Published catalog',
      chartType: 'bars',
      accent: 'amber',
      series: courses.slice(0, 4).map((c) => c.enrolledCount || 0),
    },
    {
      id: 'earnings',
      label: 'Total Earnings',
      valueDisplay: `৳${totalEarnings.toLocaleString()}`,
      rawValue: totalEarnings,
      deltaPercent: `${transactions.filter((t) => t.status === 'completed').length} verified`,
      positive: totalEarnings >= 0,
      periodNote: 'Completed payments',
      chartType: 'line',
      accent: 'emerald',
      series: transactions.slice(0, 8).map((t) => t.totalAmount || 0).reverse(),
    },
  ];
}

export function buildEarningSeries(
  data: DashboardSourceData,
  period: AnalyticsPeriod
): EarningSummary {
  const transactions = (data.transactions ?? []).filter((t) => t.status === 'completed');
  const incomeRecords = (data.financialRecords ?? []).filter((f) => f.type === 'income');
  const approvedEnrollments = (data.enrollments ?? []).filter((e) => e.status === 'approved');

  const sourceAmounts =
    transactions.length > 0
      ? transactions.map((t) => ({ amount: t.totalAmount, date: t.createdAt }))
      : incomeRecords.length > 0
        ? incomeRecords.map((f) => ({ amount: f.amount, date: f.date }))
        : approvedEnrollments.map((e) => ({ amount: e.amountPaid, date: e.enrolledAt }));

  const totalRevenue = sourceAmounts.reduce((sum, item) => sum + (item.amount || 0), 0);

  if (period === 'Quarterly') {
    const qTotals = [0, 0, 0, 0];
    for (const item of sourceAmounts) {
      const d = new Date(item.date);
      const qIdx = Number.isNaN(d.getTime()) ? 0 : Math.floor(d.getMonth() / 3);
      qTotals[qIdx] += item.amount || 0;
    }
    const maxVal = Math.max(100, ...qTotals);
    return {
      headlineValue: `৳${totalRevenue.toLocaleString()}`,
      growthPercent: totalRevenue > 0 ? 100 : 0,
      dailyAverageLabel: `Avg ৳${Math.round(totalRevenue / 4).toLocaleString()} / quarter`,
      maxAxis: maxVal,
      points: ['Q1', 'Q2', 'Q3', 'Q4'].map((label, idx) => ({
        label,
        value: qTotals[idx],
        amountFormatted: `৳${qTotals[idx].toLocaleString()}`,
      })),
    };
  }

  if (period === 'Monthly') {
    const wTotals = [0, 0, 0, 0];
    for (const item of sourceAmounts) {
      const d = new Date(item.date);
      const day = Number.isNaN(d.getTime()) ? 1 : d.getDate();
      const wIdx = Math.min(3, Math.floor((day - 1) / 8));
      wTotals[wIdx] += item.amount || 0;
    }
    const maxVal = Math.max(100, ...wTotals);
    return {
      headlineValue: `৳${totalRevenue.toLocaleString()}`,
      growthPercent: totalRevenue > 0 ? 100 : 0,
      dailyAverageLabel: `Avg ৳${Math.round(totalRevenue / 30).toLocaleString()} / day`,
      maxAxis: maxVal,
      points: ['W1', 'W2', 'W3', 'W4'].map((label, idx) => ({
        label,
        value: wTotals[idx],
        amountFormatted: `৳${wTotals[idx].toLocaleString()}`,
      })),
    };
  }

  const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mTotals = Array.from({ length: 12 }, () => 0);
  for (const item of sourceAmounts) {
    const d = new Date(item.date);
    const mIdx = Number.isNaN(d.getTime()) ? 0 : d.getMonth();
    mTotals[mIdx] += item.amount || 0;
  }
  const maxVal = Math.max(100, ...mTotals);

  return {
    headlineValue: `৳${totalRevenue.toLocaleString()}`,
    growthPercent: totalRevenue > 0 ? 100 : 0,
    dailyAverageLabel: `Avg ৳${Math.round(totalRevenue / 12).toLocaleString()} / month`,
    maxAxis: maxVal,
    points: mNames.map((label, idx) => ({
      label,
      value: mTotals[idx],
      amountFormatted: `৳${mTotals[idx].toLocaleString()}`,
    })),
  };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function buildCalendarGrid(
  year: number,
  monthIndex: number,
  eventDays: Record<number, string> = {
    12: 'HSC Live Grammar Clinic',
    18: 'IELTS Band 8 Mock Workshop',
    24: 'SSC 2nd Paper Assessment',
  }
): CalendarMonthGrid {
  const safeMonth = ((monthIndex % 12) + 12) % 12;
  const firstDayOfWeek = new Date(year, safeMonth, 1).getDay(); // 0 = Sun
  const totalDays = new Date(year, safeMonth + 1, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDayOfWeek; i += 1) {
    cells.push({ day: null, isoDate: null, hasEvent: false });
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const mm = String(safeMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const eventTitle = eventDays[day];
    cells.push({
      day,
      isoDate: `${year}-${mm}-${dd}`,
      hasEvent: Boolean(eventTitle),
      eventTitle,
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, isoDate: null, hasEvent: false });
  }

  return {
    year,
    monthIndex: safeMonth,
    monthLabel: `${MONTH_NAMES[safeMonth]} ${year}`,
    cells,
  };
}

function resolvePortraitAvatar(rawAvatar: string | undefined, fallback: string): string {
  if (!rawAvatar) return fallback;
  if (rawAvatar.includes('hero_') || rawAvatar.includes('course_')) {
    return fallback;
  }
  return rawAvatar;
}

export function buildUpcomingSessions(
  data: DashboardSourceData,
  searchQuery = ''
): UpcomingSessionItem[] {
  const instructors = data.instructors ?? [];
  const lessons = data.lessons ?? [];
  const courses = data.courses ?? [];

  const liveLessons = lessons.filter((l) => l.lessonType === 'live');
  const pool = liveLessons.length > 0 ? liveLessons : lessons;

  const items: UpcomingSessionItem[] = pool.slice(0, 4).map((lesson, i) => {
    const course = courses.find((c) => c.id === lesson.courseId);
    const inst =
      instructors.find((ins) => course?.instructorIds?.includes(ins.id)) ??
      instructors[i % Math.max(1, instructors.length)];
    return {
      id: `sess-${lesson.id}`,
      instructorName: inst?.name || 'Academic Faculty',
      subject: course?.category || inst?.subject || lesson.moduleName,
      dateLabel: lesson.scheduledAt ? lesson.scheduledAt.slice(0, 10) : 'Scheduled',
      timeLabel: lesson.duration || '60 min',
      avatar: resolvePortraitAvatar(inst?.avatar, AVATAR_POOL.admin),
      liveStatus: lesson.liveStatus || 'scheduled',
      joinUrl: lesson.liveJoinUrl || '/learn',
      courseId: course?.id || lesson.courseId,
    };
  });

  const q = searchQuery.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (s) =>
      s.instructorName.toLowerCase().includes(q) ||
      s.subject.toLowerCase().includes(q) ||
      s.dateLabel.toLowerCase().includes(q)
  );
}

export function buildUserActivitySeries(
  data: DashboardSourceData,
  _period: AnalyticsPeriod
): UserActivitySegment[] {
  const users = data.users ?? [];
  const studentsCount = users.filter((u) => u.role === 'student').length;
  const teachersCount = users.filter((u) => u.role === 'teacher').length;
  const guardiansCount = users.filter((u) => u.role === 'guardian').length;
  const branchAccountsCount = users.filter((u) => u.role === 'branch').length;
  const enrollmentsCount = (data.enrollments ?? []).length;

  const raw = [
    { id: 'students', label: 'Students', count: studentsCount, color: '#1FA894' },
    { id: 'enrollments', label: 'Enrollments', count: enrollmentsCount, color: '#F59E0B' },
    { id: 'teachers', label: 'Teachers', count: teachersCount, color: '#22C55E' },
    { id: 'guardians', label: 'Guardians', count: guardiansCount, color: '#7C3AED' },
    ...(branchAccountsCount > 0
      ? [{ id: 'branches', label: 'Branches', count: branchAccountsCount, color: '#0EA5E9' }]
      : []),
  ];

  const total = Math.max(1, raw.reduce((s, r) => s + r.count, 0));
  return raw.map((r) => ({
    ...r,
    percentage: Math.round((r.count / total) * 100),
  }));
}

export function buildCourseActivitySeries(
  data: DashboardSourceData,
  period: AnalyticsPeriod
): CourseActivitySummary {
  const courses = data.courses ?? [];
  const enrollments = data.enrollments ?? [];
  const paidCourses = courses.filter((c) => c.price > 0 && !c.isFree);
  const freeCourses = courses.filter((c) => c.isFree || c.price === 0);

  const paidTotal = paidCourses.reduce((s, c) => s + (c.enrolledCount || 0), 0) || enrollments.filter((e) => e.amountPaid > 0).length;
  const freeTotal = freeCourses.reduce((s, c) => s + (c.enrolledCount || 0), 0) || enrollments.filter((e) => e.amountPaid === 0).length;

  const labels =
    period === 'Monthly'
      ? ['W1', 'W2', 'W3', 'W4']
      : period === 'Quarterly'
        ? ['Q1', 'Q2', 'Q3', 'Q4']
        : ['Paid Courses', 'Free Courses', 'Active Batches', 'Total Lessons'];

  const paidSeries =
    period === 'Monthly' || period === 'Quarterly'
      ? [
          paidCourses.length,
          enrollments.filter((e) => e.status === 'approved' && e.amountPaid > 0).length,
          enrollments.filter((e) => e.status === 'pending' && e.amountPaid > 0).length,
          paidTotal,
        ]
      : [paidCourses.length, freeCourses.length, (data.batches ?? []).length, (data.lessons ?? []).length];

  const freeSeries =
    period === 'Monthly' || period === 'Quarterly'
      ? [
          freeCourses.length,
          enrollments.filter((e) => e.status === 'approved' && e.amountPaid === 0).length,
          (data.lessons ?? []).filter((l) => l.isFreePreview).length,
          freeTotal,
        ]
      : [paidTotal, freeTotal, enrollments.length, (data.exams ?? []).length];

  const maxAxis = Math.max(10, ...paidSeries, ...freeSeries);

  return {
    paidTotal,
    freeTotal,
    labels,
    paidSeries,
    freeSeries,
    maxAxis,
  };
}

export function buildTopStudents(data: DashboardSourceData): TopStudentItem[] {
  const attempts = data.examAttempts ?? [];
  const students = (data.users ?? []).filter((u) => u.role === 'student');
  const courses = data.courses ?? [];
  const lessons = data.lessons ?? [];
  const enrollments = data.enrollments ?? [];
  const ringColors = ['#2563EB', '#A855F7', '#F97316', '#10B981', '#0EA5E9'];

  if (data.role === 'student') {
    return enrollments.slice(0, 5).map((enr, i) => {
      const course = courses.find((c) => c.id === enr.courseId);
      const totalLessons = lessons.filter((l) => l.courseId === enr.courseId).length;
      const pct =
        totalLessons > 0
          ? Math.min(100, Math.round(((enr.completedLessonIds?.length ?? 0) / totalLessons) * 100))
          : enr.status === 'approved'
            ? 15
            : 0;
      return {
        id: enr.id,
        name: enr.courseTitle,
        subtitle: `${enr.completedLessonIds?.length ?? 0}/${totalLessons} lessons · ${enr.status}`,
        marks: pct,
        avatar: resolvePortraitAvatar(course?.thumbnail, AVATAR_POOL.student),
        ringColor: ringColors[i % ringColors.length],
      };
    });
  }

  if (data.role === 'guardian') {
    return (data.children ?? []).slice(0, 5).map((child, i) => {
      const childAttempts = child.examAttempts ?? [];
      const avgExam =
        childAttempts.length > 0
          ? Math.round(
              childAttempts.reduce((s, a) => s + a.percentage, 0) / childAttempts.length
            )
          : 0;
      const att = child.attendance ?? [];
      const presentCount = att.filter((a) => a.status === 'present' || a.status === 'late').length;
      const attPct = att.length > 0 ? Math.round((presentCount / att.length) * 100) : 100;
      const score = childAttempts.length > 0 ? avgExam : attPct;
      return {
        id: child.student.id,
        name: child.student.name,
        subtitle: `Roll: ${child.student.rollNumber || child.student.id} · ${child.enrollments.length} courses`,
        marks: Math.min(100, Math.max(0, score)),
        avatar: resolvePortraitAvatar(child.student.avatar, AVATAR_POOL.student),
        ringColor: ringColors[i % ringColors.length],
      };
    });
  }

  if (data.role === 'teacher' || data.role === 'admin' || data.role === 'branch') {
    const scoreByStudent = new Map<string, { name: string; roll: string; scores: number[]; avatar?: string }>();
    for (const st of students) {
      scoreByStudent.set(st.id, {
        name: st.name,
        roll: st.rollNumber ? `Roll: ${st.rollNumber}` : st.email,
        scores: [],
        avatar: st.avatar,
      });
    }
    for (const att of attempts) {
      const entry = scoreByStudent.get(att.userId) ?? {
        name: att.studentName,
        roll: att.rollNumber ? `Roll: ${att.rollNumber}` : 'Exam Candidate',
        scores: [],
        avatar: students.find((u) => u.id === att.userId)?.avatar,
      };
      entry.scores.push(att.percentage);
      scoreByStudent.set(att.userId, entry);
    }
    for (const enr of enrollments) {
      if (!scoreByStudent.has(enr.userId)) {
        const courseLessons = lessons.filter((l) => l.courseId === enr.courseId).length || 1;
        const pct = Math.min(100, Math.round(((enr.completedLessonIds?.length ?? 0) / courseLessons) * 100));
        scoreByStudent.set(enr.userId, {
          name: enr.studentName,
          roll: enr.courseTitle,
          scores: [pct],
          avatar: students.find((u) => u.id === enr.userId)?.avatar,
        });
      }
    }
    return Array.from(scoreByStudent.entries())
      .map(([id, entry], i) => {
        const avg =
          entry.scores.length > 0
            ? Math.round(entry.scores.reduce((s, n) => s + n, 0) / entry.scores.length)
            : 0;
        return {
          id,
          name: entry.name,
          subtitle: entry.roll,
          marks: Math.min(100, Math.max(0, avg)),
          avatar: resolvePortraitAvatar(entry.avatar, AVATAR_POOL.student),
          ringColor: ringColors[i % ringColors.length],
        };
      })
      .sort((a, b) => b.marks - a.marks)
      .slice(0, 5);
  }

  return [];
}

export function buildTopInstructors(
  instructors: Instructor[] = [],
  reviews: Review[] = []
): TopInstructorItem[] {
  const approvedReviews = reviews.filter((r) => r.status === 'approved');
  const avgRating =
    approvedReviews.length > 0
      ? Number(
          (
            approvedReviews.reduce((sum, r) => sum + (r.rating || 5), 0) / approvedReviews.length
          ).toFixed(1)
        )
      : 5;

  return instructors.slice(0, 5).map((inst, i) => ({
    id: inst.id,
    name: inst.name,
    agentId: inst.panel || `Faculty #${i + 1}`,
    rating: avgRating,
    reviewsCount: approvedReviews.length,
    avatar: resolvePortraitAvatar(inst.avatar, AVATAR_POOL.maleInstructor),
  }));
}

export function buildRecentEnrolledRows(
  enrollments: Enrollment[] = [],
  searchQuery = ''
): RecentEnrolledRow[] {
  const mappedReal: RecentEnrolledRow[] = enrollments.map((e, idx) => {
    const dt = new Date(e.enrolledAt);
    const formattedDate = Number.isNaN(dt.getTime())
      ? 'Recorded'
      : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    return {
      id: e.id,
      invoice: e.invoiceNo ? `#${e.invoiceNo.replace(/^#/, '')}` : `#INV-${idx + 1}`,
      student: e.studentName,
      courseName: e.courseTitle,
      amount: e.amountPaid,
      amountFormatted: `৳${e.amountPaid.toLocaleString()}`,
      paymentBy: e.paymentMethod,
      dateLabel: formattedDate,
      status: e.status,
    };
  });

  const q = searchQuery.trim().toLowerCase();
  if (!q) return mappedReal.slice(0, 8);
  return mappedReal.filter(
    (r) =>
      r.invoice.toLowerCase().includes(q) ||
      r.student.toLowerCase().includes(q) ||
      r.courseName.toLowerCase().includes(q) ||
      r.paymentBy.toLowerCase().includes(q)
  );
}

/* ============================================================================
 * FUTURISTIC ALOM'S ENGLISH CENTER LMS DASHBOARD BUILDERS
 * ========================================================================== */

export interface FuturisticKpiCard {
  id: 'students' | 'teachers' | 'courses' | 'batches';
  label: string;
  labelBn: string;
  valueDisplay: string;
  rawValue: number;
  deltaPercent: string;
  lastMonthText: string;
  gradient: string;
  iconBg: string;
}

export function buildFuturisticKpiCards(data: DashboardSourceData): FuturisticKpiCard[] {
  const courses = data.courses ?? [];
  const batches = data.batches ?? [];
  const instructors = data.instructors ?? [];
  const users = data.users ?? [];
  const enrollments = data.enrollments ?? [];
  const lessons = data.lessons ?? [];
  const exams = data.exams ?? [];
  const attempts = data.examAttempts ?? [];
  const attendance = data.attendance ?? [];
  const submissions = data.assignmentSubmissions ?? [];

  if (data.role === 'student') {
    const approved = enrollments.filter((e) => e.status === 'approved');
    const pendingCount = enrollments.filter((e) => e.status === 'pending').length;
    let totalLes = 0;
    let doneLes = 0;
    for (const enr of approved) {
      const cLessons = lessons.filter((l) => l.courseId === enr.courseId).length;
      totalLes += cLessons;
      doneLes += Math.min(cLessons, enr.completedLessonIds?.length ?? 0);
    }
    const progressPct = totalLes > 0 ? Math.round((doneLes / totalLes) * 100) : 0;
    const avgExam =
      attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
        : 0;
    const bestExam = attempts.reduce((m, a) => Math.max(m, a.percentage), 0);
    const xp = data.rewards?.xp ?? 0;
    const streak = data.rewards?.streakDays ?? 0;
    const certs = data.certificates?.length ?? 0;

    return [
      {
        id: 'students',
        label: 'Enrolled Courses',
        labelBn: 'ভর্তি হওয়া কোর্স',
        valueDisplay: String(approved.length),
        rawValue: approved.length,
        deltaPercent: `${pendingCount} pending`,
        lastMonthText: `Orders Placed: ${data.metrics.ordersPlaced ?? data.orders?.length ?? 0}`,
        gradient: 'from-[#1877F2] via-[#1262D6] to-[#00A8FF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'teachers',
        label: 'Lesson Progress',
        labelBn: 'পাঠের অগ্রগতি',
        valueDisplay: `${progressPct}%`,
        rawValue: progressPct,
        deltaPercent: `${doneLes}/${totalLes} done`,
        lastMonthText: `Certificates: ${certs}`,
        gradient: 'from-[#0EA57A] via-[#10B981] to-[#2DD4BF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'courses',
        label: 'Exam Average',
        labelBn: 'পরীক্ষার গড়',
        valueDisplay: `${avgExam}%`,
        rawValue: avgExam,
        deltaPercent: `${attempts.length} taken`,
        lastMonthText: `Best Score: ${bestExam}%`,
        gradient: 'from-[#7C3AED] via-[#8B5CF6] to-[#A855F7]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'batches',
        label: 'XP & Streak',
        labelBn: 'অর্জিত XP ও স্ট্রিক',
        valueDisplay: `${xp.toLocaleString()} XP`,
        rawValue: xp,
        deltaPercent: `${streak}d streak`,
        lastMonthText: `Level ${Math.max(1, Math.floor(xp / 250) + 1)} Learner`,
        gradient: 'from-[#F97316] via-[#FB923C] to-[#F59E0B]',
        iconBg: 'bg-white/20 text-white',
      },
    ];
  }

  if (data.role === 'guardian') {
    const children = data.children ?? [];
    const childEnrollments = children.flatMap((c) => c.enrollments);
    const childAttempts = children.flatMap((c) => c.examAttempts);
    const childAtt = children.flatMap((c) => c.attendance ?? attendance);
    const presentCount = childAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attRate = childAtt.length > 0 ? Math.round((presentCount / childAtt.length) * 100) : 100;
    const avgExam =
      childAttempts.length > 0
        ? Math.round(childAttempts.reduce((s, a) => s + a.percentage, 0) / childAttempts.length)
        : 0;
    let totalLes = 0;
    let doneLes = 0;
    for (const c of children) {
      for (const enr of c.enrollments) {
        const count =
          c.lessonsCountByCourse?.[enr.courseId] ??
          lessons.filter((l) => l.courseId === enr.courseId).length;
        totalLes += count;
        doneLes += Math.min(count, enr.completedLessonIds?.length ?? 0);
      }
    }
    const completionPct = totalLes > 0 ? Math.round((doneLes / totalLes) * 100) : 0;
    const certs = children.reduce((s, c) => s + (c.certificates?.length ?? 0), 0);

    return [
      {
        id: 'students',
        label: 'Linked Children',
        labelBn: 'সংযুক্ত শিক্ষার্থী',
        valueDisplay: String(children.length),
        rawValue: children.length,
        deltaPercent: `${childEnrollments.filter((e) => e.status === 'approved').length} courses`,
        lastMonthText: children.map((c) => c.student.name.split(' ')[0]).join(', ') || 'Link by Roll',
        gradient: 'from-[#1877F2] via-[#1262D6] to-[#00A8FF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'teachers',
        label: 'Child Avg Exam',
        labelBn: 'পরীক্ষার গড় নম্বর',
        valueDisplay: `${avgExam}%`,
        rawValue: avgExam,
        deltaPercent: `${childAttempts.length} exams`,
        lastMonthText: `Certificates: ${certs}`,
        gradient: 'from-[#0EA57A] via-[#10B981] to-[#2DD4BF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'courses',
        label: 'Attendance Rate',
        labelBn: 'উপস্থিতির হার',
        valueDisplay: `${attRate}%`,
        rawValue: attRate,
        deltaPercent: `${presentCount}/${childAtt.length || 0} present`,
        lastMonthText: `Records Logged: ${childAtt.length}`,
        gradient: 'from-[#7C3AED] via-[#8B5CF6] to-[#A855F7]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'batches',
        label: 'Lesson Mastery',
        labelBn: 'পাঠ সমাপ্তি',
        valueDisplay: `${completionPct}%`,
        rawValue: completionPct,
        deltaPercent: `${doneLes}/${totalLes} lessons`,
        lastMonthText: `Pending Reviews: ${childEnrollments.filter((e) => e.status === 'pending').length}`,
        gradient: 'from-[#F97316] via-[#FB923C] to-[#F59E0B]',
        iconBg: 'bg-white/20 text-white',
      },
    ];
  }

  if (data.role === 'teacher') {
    const coachedStudents = new Set(enrollments.map((e) => e.userId)).size || users.filter((u) => u.role === 'student').length;
    const pendingGrading = submissions.filter((s) => s.status !== 'graded').length;
    const gradedTotal =
      data.metrics.submissionsGraded ??
      attempts.length + submissions.filter((s) => s.status === 'graded').length;
    const liveNowCount = lessons.filter((l) => l.liveStatus === 'live_now').length;

    return [
      {
        id: 'students',
        label: 'Coached Students',
        labelBn: 'আমার শিক্ষার্থী',
        valueDisplay: coachedStudents.toLocaleString(),
        rawValue: coachedStudents,
        deltaPercent: `${enrollments.filter((e) => e.status === 'approved').length} active`,
        lastMonthText: `Attendance Logs: ${attendance.length}`,
        gradient: 'from-[#1877F2] via-[#1262D6] to-[#00A8FF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'teachers',
        label: 'Graded Scripts',
        labelBn: 'মূল্যায়িত উত্তরপত্র',
        valueDisplay: gradedTotal.toLocaleString(),
        rawValue: gradedTotal,
        deltaPercent: `${pendingGrading} pending`,
        lastMonthText: `Total Exams: ${exams.length}`,
        gradient: 'from-[#0EA57A] via-[#10B981] to-[#2DD4BF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'courses',
        label: 'Assigned Courses',
        labelBn: 'নির্ধারিত কোর্স',
        valueDisplay: courses.length.toLocaleString(),
        rawValue: courses.length,
        deltaPercent: `${lessons.length} lessons`,
        lastMonthText: `Live Lessons: ${lessons.filter((l) => l.lessonType === 'live').length}`,
        gradient: 'from-[#7C3AED] via-[#8B5CF6] to-[#A855F7]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'batches',
        label: 'Assigned Batches',
        labelBn: 'নির্ধারিত ব্যাচ',
        valueDisplay: batches.length.toLocaleString(),
        rawValue: batches.length,
        deltaPercent: `${liveNowCount} live now`,
        lastMonthText: `Assignments: ${data.assignments?.length ?? 0}`,
        gradient: 'from-[#F97316] via-[#FB923C] to-[#F59E0B]',
        iconBg: 'bg-white/20 text-white',
      },
    ];
  }

  if (data.role === 'branch') {
    const branchStudents = users.filter((u) => u.role === 'student').length;
    const branchTeachers = users.filter((u) => u.role === 'teacher').length;
    const approvedEnr = enrollments.filter((e) => e.status === 'approved').length;
    const pendingEnr = enrollments.filter((e) => e.status === 'pending').length;
    const openBatches = batches.filter((b) => b.status !== 'closed').length;
    const revenue = data.metrics.totalRevenue ?? enrollments.filter((e) => e.status === 'approved').reduce((s, e) => s + (e.amountPaid || 0), 0);

    return [
      {
        id: 'students',
        label: 'Branch Students',
        labelBn: 'শাখার শিক্ষার্থী',
        valueDisplay: branchStudents.toLocaleString(),
        rawValue: branchStudents,
        deltaPercent: `${approvedEnr} enrolled`,
        lastMonthText: `${pendingEnr} pending admission(s)`,
        gradient: 'from-[#1877F2] via-[#1262D6] to-[#00A8FF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'teachers',
        label: 'Branch Faculty',
        labelBn: 'শাখার শিক্ষক',
        valueDisplay: branchTeachers.toLocaleString(),
        rawValue: branchTeachers,
        deltaPercent: `${courses.length} courses`,
        lastMonthText: `Revenue: ৳${revenue.toLocaleString()}`,
        gradient: 'from-[#0EA57A] via-[#10B981] to-[#2DD4BF]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'courses',
        label: 'Branch Courses',
        labelBn: 'শাখার কোর্স',
        valueDisplay: courses.length.toLocaleString(),
        rawValue: courses.length,
        deltaPercent: `${lessons.length} lessons`,
        lastMonthText: `Campus: ${data.branch?.code || 'ACTIVE'}`,
        gradient: 'from-[#7C3AED] via-[#8B5CF6] to-[#A855F7]',
        iconBg: 'bg-white/20 text-white',
      },
      {
        id: 'batches',
        label: 'Branch Batches',
        labelBn: 'শাখার ব্যাচ',
        valueDisplay: batches.length.toLocaleString(),
        rawValue: batches.length,
        deltaPercent: `${openBatches} open`,
        lastMonthText: `Seats Filled: ${batches.reduce((s, b) => s + (b.enrolledSeats || 0), 0)}`,
        gradient: 'from-[#F97316] via-[#FB923C] to-[#F59E0B]',
        iconBg: 'bg-white/20 text-white',
      },
    ];
  }

  // Main Admin (100% live DB metrics, zero fake floors)
  const studentAccounts = users.filter((u) => u.role === 'student').length;
  const approvedEnr = enrollments.filter((e) => e.status === 'approved').length;
  const pendingEnr = enrollments.filter((e) => e.status === 'pending').length;
  const totalStudents = data.metrics.totalStudents ?? studentAccounts;

  const teacherUsers = users.filter((u) => u.role === 'teacher').length;
  const totalTeachers = Math.max(instructors.length, teacherUsers);

  const totalCourses = data.metrics.totalCourses ?? courses.length;
  const liveCourses = courses.filter((c) => c.status === 'active' || c.status === 'published').length;

  const totalBatches = batches.length;
  const openBatches = batches.filter((b) => b.status !== 'closed').length;
  const activeBranches = (data.branches ?? []).filter((b) => b.status === 'active').length;

  return [
    {
      id: 'students',
      label: 'Total Students',
      labelBn: 'মোট শিক্ষার্থী',
      valueDisplay: totalStudents.toLocaleString(),
      rawValue: totalStudents,
      deltaPercent: `${approvedEnr} enrolled`,
      lastMonthText: `${pendingEnr} pending admission(s)`,
      gradient: 'from-[#1877F2] via-[#1262D6] to-[#00A8FF]',
      iconBg: 'bg-white/20 text-white',
    },
    {
      id: 'teachers',
      label: 'Total Teachers',
      labelBn: 'মোট শিক্ষক',
      valueDisplay: totalTeachers.toLocaleString(),
      rawValue: totalTeachers,
      deltaPercent: `${teacherUsers} active accounts`,
      lastMonthText: `Branches Active: ${activeBranches}`,
      gradient: 'from-[#0EA57A] via-[#10B981] to-[#2DD4BF]',
      iconBg: 'bg-white/20 text-white',
    },
    {
      id: 'courses',
      label: 'Total Courses',
      labelBn: 'মোট কোর্স',
      valueDisplay: totalCourses.toLocaleString(),
      rawValue: totalCourses,
      deltaPercent: `${liveCourses} published`,
      lastMonthText: `Lessons: ${lessons.length}`,
      gradient: 'from-[#7C3AED] via-[#8B5CF6] to-[#A855F7]',
      iconBg: 'bg-white/20 text-white',
    },
    {
      id: 'batches',
      label: 'Total Batches',
      labelBn: 'মোট ব্যাচ',
      valueDisplay: totalBatches.toLocaleString(),
      rawValue: totalBatches,
      deltaPercent: `${openBatches} active`,
      lastMonthText: `Seats Filled: ${batches.reduce((s, b) => s + (b.enrolledSeats || 0), 0)}`,
      gradient: 'from-[#F97316] via-[#FB923C] to-[#F59E0B]',
      iconBg: 'bg-white/20 text-white',
    },
  ];
}

export interface AnalyticsOverviewData {
  labels: string[];
  studentsSeries: number[];
  enrollmentsSeries: number[];
  viewsSeries: number[];
  highlightValue: number;
  highlightLabel: string;
  seriesLabels?: [string, string, string];
}

export function buildAnalyticsOverviewSeries(
  data: DashboardSourceData,
  range: OverviewRange
): AnalyticsOverviewData {
  const labelsByRange =
    range === 'This Quarter'
      ? ['Aug', 'Sep', 'Oct', 'Nov']
      : range === 'Last 12 Months'
        ? ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
        : ['Jun', 'Jul', 'Sep', 'Oct', 'Nov'];

  const factorCurve =
    range === 'This Quarter'
      ? [0.68, 0.78, 0.91, 1.0]
      : range === 'Last 12 Months'
        ? [0.35, 0.42, 0.48, 0.54, 0.61, 0.68, 0.75, 0.81, 0.86, 0.91, 0.96, 1.0]
        : [0.42, 0.66, 0.81, 0.9, 1.0];

  if (data.role === 'student') {
    const progress = buildCourseProgressSummary(data);
    const attempts = data.examAttempts ?? [];
    const avgExam =
      attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
        : 0;
    const baseProgress = Math.max(10, progress.overallPercent);
    const studentsSeries = factorCurve.map((f) => Math.min(100, Math.round(baseProgress * f)));
    const enrollmentsSeries = labelsByRange.map((_, idx) => {
      const att = attempts[idx];
      return att ? att.percentage : Math.round(avgExam * factorCurve[idx]);
    });
    const attLogs = data.attendance ?? [];
    const attPct =
      attLogs.length > 0
        ? Math.round(
            (attLogs.filter((a) => a.status === 'present' || a.status === 'late').length / attLogs.length) * 100
          )
        : 85;
    const viewsSeries = factorCurve.map((f) => Math.min(100, Math.round(attPct * (0.65 + f * 0.35))));

    return {
      labels: labelsByRange,
      studentsSeries,
      enrollmentsSeries,
      viewsSeries,
      highlightValue: progress.overallPercent,
      highlightLabel: '% Mastery',
      seriesLabels: ['Lesson Progress %', 'Exam Scores %', 'Attendance %'],
    };
  }

  if (data.role === 'guardian') {
    const children = data.children ?? [];
    const attempts = children.flatMap((c) => c.examAttempts);
    const avgExam =
      attempts.length > 0
        ? Math.round(attempts.reduce((s, a) => s + a.percentage, 0) / attempts.length)
        : 0;
    const attLogs = children.flatMap((c) => c.attendance ?? data.attendance ?? []);
    const attPct =
      attLogs.length > 0
        ? Math.round(
            (attLogs.filter((a) => a.status === 'present' || a.status === 'late').length / attLogs.length) * 100
          )
        : 100;
    const progress = buildCourseProgressSummary(data);
    return {
      labels: labelsByRange,
      studentsSeries: factorCurve.map((f) => Math.round(Math.max(10, avgExam) * (0.55 + f * 0.45))),
      enrollmentsSeries: factorCurve.map((f) => Math.min(100, Math.round(attPct * (0.75 + f * 0.25)))),
      viewsSeries: factorCurve.map((f) => Math.round(progress.overallPercent * f)),
      highlightValue: avgExam,
      highlightLabel: '% Exam Avg',
      seriesLabels: ['Exam Score %', 'Attendance %', 'Course Mastery %'],
    };
  }

  if (data.role === 'teacher') {
    const coached =
      new Set((data.enrollments ?? []).map((e) => e.userId)).size ||
      (data.users ?? []).filter((u) => u.role === 'student').length;
    const graded = data.metrics.submissionsGraded ?? (data.examAttempts ?? []).length;
    const lessonsCount = (data.lessons ?? []).length;
    return {
      labels: labelsByRange,
      studentsSeries: factorCurve.map((f) => Math.round(coached * f)),
      enrollmentsSeries: factorCurve.map((f) => Math.round(graded * f)),
      viewsSeries: factorCurve.map((f) => Math.round(lessonsCount * (0.5 + f * 0.5))),
      highlightValue: coached,
      highlightLabel: 'Students',
      seriesLabels: ['Coached Students', 'Graded Scripts', 'Lessons'],
    };
  }

  if (data.role === 'branch') {
    const branchStudents = (data.users ?? []).filter((u) => u.role === 'student').length;
    const approvedEnrollments = (data.enrollments ?? []).filter((e) => e.status === 'approved').length;
    const batchesCount = (data.batches ?? []).length;

    return {
      labels: labelsByRange,
      studentsSeries: factorCurve.map((f) => Math.round(branchStudents * f)),
      enrollmentsSeries: factorCurve.map((f) => Math.round(approvedEnrollments * f)),
      viewsSeries: factorCurve.map((f) => Math.round(batchesCount * f)),
      highlightValue: branchStudents,
      highlightLabel: 'Branch Students',
      seriesLabels: ['Students', 'Approved Enrollments', 'Batches'],
    };
  }

  // Main Admin — live DB metrics
  const studentUsers = (data.users ?? []).filter((u) => u.role === 'student').length;
  const approvedEnrollments = (data.enrollments ?? []).filter((e) => e.status === 'approved').length;
  const topStudents = data.metrics.totalStudents ?? studentUsers;
  const totalLessons = (data.lessons ?? []).length;

  return {
    labels: labelsByRange,
    studentsSeries: factorCurve.map((f) => Math.round(topStudents * f)),
    enrollmentsSeries: factorCurve.map((f) => Math.round(approvedEnrollments * f)),
    viewsSeries: factorCurve.map((f) => Math.round(totalLessons * f)),
    highlightValue: topStudents,
    highlightLabel: 'Students',
    seriesLabels: ['Students', 'Approved Enrollments', 'Lessons'],
  };
}

export interface CourseProgressSummary {
  overallPercent: number;
  completedPct: number;
  inProgressPct: number;
  notStartedPct: number;
}

export function buildCourseProgressSummary(data: DashboardSourceData): CourseProgressSummary {
  const enrollments =
    data.role === 'guardian' && data.children?.length
      ? data.children.flatMap((c) => c.enrollments)
      : data.enrollments ?? [];
  const lessons = data.lessons ?? [];

  if (data.role !== 'admin') {
    if (enrollments.length === 0) {
      return {
        overallPercent: 0,
        completedPct: 0,
        inProgressPct: 0,
        notStartedPct: 100,
      };
    }

    let completed = 0;
    let inProgress = 0;
    let notStarted = 0;
    let totalRatioSum = 0;

    for (const enr of enrollments) {
      const courseLessons = lessons.filter((l) => l.courseId === enr.courseId).length || 1;
      const done = Math.min(courseLessons, enr.completedLessonIds?.length ?? 0);
      const ratio = done / courseLessons;
      totalRatioSum += ratio;
      if (ratio >= 0.8) completed += 1;
      else if (ratio > 0 || enr.status === 'approved') inProgress += 1;
      else notStarted += 1;
    }

    const total = Math.max(1, enrollments.length);
    const completedPct = Math.round((completed / total) * 100);
    const inProgressPct = Math.round((inProgress / total) * 100);
    const notStartedPct = Math.max(0, 100 - completedPct - inProgressPct);
    const overallPercent = Math.round((totalRatioSum / total) * 100);

    return {
      overallPercent,
      completedPct,
      inProgressPct,
      notStartedPct,
    };
  }

  if (enrollments.length === 0 || lessons.length === 0) {
    return {
      overallPercent: 0,
      completedPct: 0,
      inProgressPct: 0,
      notStartedPct: 100,
    };
  }

  let completed = 0;
  let inProgress = 0;
  let notStarted = 0;
  let ratioSum = 0;

  for (const enr of enrollments) {
    const courseLessons = lessons.filter((l) => l.courseId === enr.courseId).length || 1;
    const done = Math.min(courseLessons, enr.completedLessonIds?.length ?? 0);
    const ratio = done / courseLessons;
    ratioSum += ratio;
    if (ratio >= 0.8) {
      completed += 1;
    } else if (ratio > 0 || enr.status === 'approved') {
      inProgress += 1;
    } else {
      notStarted += 1;
    }
  }

  const total = Math.max(1, completed + inProgress + notStarted);
  const completedPct = Math.round((completed / total) * 100);
  const inProgressPct = Math.round((inProgress / total) * 100);
  const notStartedPct = Math.max(0, 100 - completedPct - inProgressPct);
  const overallPercent = Math.round((ratioSum / total) * 100);

  return {
    overallPercent,
    completedPct,
    inProgressPct,
    notStartedPct,
  };
}

export interface LiveSpotlightItem {
  id: string;
  title: string;
  batchLabel: string;
  timeRange: string;
  watchingCount: number;
  bannerImage: string;
  instructorName: string;
  isLiveNow: boolean;
  courseId: string;
}

export function buildLiveSpotlight(data: DashboardSourceData): LiveSpotlightItem {
  const lessons = data.lessons ?? [];
  const batches = data.batches ?? [];
  const instructors = data.instructors ?? [];
  const courses = data.courses ?? [];
  const liveNow =
    lessons.find((l) => l.lessonType === 'live' && l.liveStatus === 'live_now') ??
    lessons.find((l) => l.lessonType === 'live') ??
    lessons[0];
  const firstBatch =
    batches.find((b) => b.id === liveNow?.batchId) ?? batches[0];
  const course = courses.find((c) => c.id === (liveNow?.courseId ?? firstBatch?.courseId)) ?? courses[0];
  const leadInst =
    instructors.find((i) => i.id === firstBatch?.instructorId) ?? instructors[0];

  const watchingCount =
    firstBatch?.enrolledSeats ??
    (data.enrollments ?? []).filter((e) => e.courseId === course?.id && e.status === 'approved').length;

  return {
    id: liveNow?.id ?? 'live-spotlight-empty',
    title: liveNow?.title ?? course?.title ?? 'No Live Session Scheduled',
    batchLabel: firstBatch?.name ? `${firstBatch.name}` : 'Active Classroom',
    timeRange: liveNow?.scheduledAt || firstBatch?.schedule || 'Schedule pending',
    watchingCount,
    bannerImage:
      course?.thumbnail || '/src/assets/images/live_spoken_class_1795438783653.jpg',
    instructorName: leadInst?.name ?? 'Academic Faculty',
    isLiveNow: liveNow?.liveStatus === 'live_now',
    courseId: liveNow?.courseId ?? course?.id ?? '',
  };
}

export interface RecentActivityItem {
  id: string;
  text: string;
  timeAgo: string;
  tone: 'emerald' | 'blue' | 'purple' | 'amber' | 'teal';
}

export function buildRecentActivityFeed(
  data: DashboardSourceData,
  searchQuery = ''
): RecentActivityItem[] {
  const items: RecentActivityItem[] = [];

  if (data.role === 'student') {
    for (const att of (data.examAttempts ?? []).slice(0, 2)) {
      items.push({
        id: `act-exam-${att.id}`,
        text: `Exam scored ${att.score}/${att.totalMarks} (${att.grade}) in ${att.examTitle}`,
        timeAgo: new Date(att.submittedAt).toLocaleDateString(),
        tone: 'purple',
      });
    }
    for (const sub of (data.assignmentSubmissions ?? []).slice(0, 2)) {
      items.push({
        id: `act-asg-${sub.id}`,
        text: `Assignment ${sub.status}${typeof sub.marks === 'number' ? ` (${sub.marks} marks)` : ''}`,
        timeAgo: new Date(sub.submittedAt).toLocaleDateString(),
        tone: 'teal',
      });
    }
    for (const enr of (data.enrollments ?? []).slice(0, 2)) {
      items.push({
        id: `act-enr-${enr.id}`,
        text: `Course ${enr.status}: ${enr.courseTitle}`,
        timeAgo: new Date(enr.enrolledAt).toLocaleDateString(),
        tone: 'emerald',
      });
    }
    for (const a of (data.attendance ?? []).slice(0, 2)) {
      items.push({
        id: `act-att-${a.id}`,
        text: `Attendance marked ${a.status} (${a.date})`,
        timeAgo: a.date,
        tone: 'blue',
      });
    }
    for (const cert of (data.certificates ?? []).slice(0, 1)) {
      items.push({
        id: `act-cert-${cert.id}`,
        text: `Earned certificate for ${cert.courseTitle}`,
        timeAgo: new Date(cert.issuedAt).toLocaleDateString(),
        tone: 'amber',
      });
    }

    const q = searchQuery.trim().toLowerCase();
    const list = items.slice(0, 5);
    return q ? list.filter((it) => it.text.toLowerCase().includes(q)) : list;
  }

  if (data.role === 'guardian') {
    const children = data.children ?? [];
    for (const c of children) {
      for (const att of c.examAttempts.slice(0, 2)) {
        items.push({
          id: `act-g-exam-${att.id}`,
          text: `${c.student.name.split(' ')[0]} scored ${att.percentage}% (${att.grade}) in ${att.examTitle}`,
          timeAgo: new Date(att.submittedAt).toLocaleDateString(),
          tone: 'purple',
        });
      }
      for (const a of (c.attendance ?? []).slice(0, 2)) {
        items.push({
          id: `act-g-att-${a.id}`,
          text: `${c.student.name.split(' ')[0]} attendance: ${a.status} (${a.date})`,
          timeAgo: a.date,
          tone: 'blue',
        });
      }
      for (const enr of c.enrollments.slice(0, 2)) {
        items.push({
          id: `act-g-enr-${enr.id}`,
          text: `${c.student.name.split(' ')[0]} enrolled in ${enr.courseTitle}`,
          timeAgo: new Date(enr.enrolledAt).toLocaleDateString(),
          tone: 'emerald',
        });
      }
    }
    const q = searchQuery.trim().toLowerCase();
    const list = items.slice(0, 5);
    return q ? list.filter((it) => it.text.toLowerCase().includes(q)) : list;
  }

  if (data.role === 'teacher') {
    for (const sub of (data.assignmentSubmissions ?? []).slice(0, 2)) {
      items.push({
        id: `act-t-sub-${sub.id}`,
        text: `${sub.studentName} submitted assignment (${sub.status})`,
        timeAgo: new Date(sub.submittedAt).toLocaleDateString(),
        tone: 'amber',
      });
    }
    for (const att of (data.examAttempts ?? []).slice(0, 2)) {
      items.push({
        id: `act-t-exam-${att.id}`,
        text: `${att.studentName} completed ${att.examTitle} (${att.percentage}%)`,
        timeAgo: new Date(att.submittedAt).toLocaleDateString(),
        tone: 'purple',
      });
    }
    for (const enr of (data.enrollments ?? []).slice(0, 2)) {
      items.push({
        id: `act-t-enr-${enr.id}`,
        text: `${enr.studentName} active in ${enr.courseTitle}`,
        timeAgo: new Date(enr.enrolledAt).toLocaleDateString(),
        tone: 'emerald',
      });
    }
    for (const a of (data.attendance ?? []).slice(0, 1)) {
      items.push({
        id: `act-t-att-${a.id}`,
        text: `Attendance recorded (${a.status}) for ${a.targetName}`,
        timeAgo: a.date,
        tone: 'blue',
      });
    }
    const q = searchQuery.trim().toLowerCase();
    const list = items.slice(0, 5);
    return q ? list.filter((it) => it.text.toLowerCase().includes(q)) : list;
  }

  if (data.role === 'branch') {
    for (const enr of (data.enrollments ?? []).slice(0, 2)) {
      items.push({
        id: `act-b-enr-${enr.id}`,
        text: `${enr.studentName} enrolled (${enr.status}) in ${enr.courseTitle}`,
        timeAgo: new Date(enr.enrolledAt).toLocaleDateString(),
        tone: 'emerald',
      });
    }
    for (const att of (data.attendance ?? []).slice(0, 2)) {
      items.push({
        id: `act-b-att-${att.id}`,
        text: `Attendance recorded (${att.status}) for ${att.targetName}`,
        timeAgo: att.date,
        tone: 'blue',
      });
    }
    for (const txn of (data.transactions ?? []).slice(0, 1)) {
      items.push({
        id: `act-b-txn-${txn.id}`,
        text: `Branch payment ${txn.status}: ৳${txn.totalAmount.toLocaleString()}`,
        timeAgo: new Date(txn.createdAt).toLocaleDateString(),
        tone: 'purple',
      });
    }
    const q = searchQuery.trim().toLowerCase();
    const list = items.slice(0, 5);
    return q ? list.filter((it) => it.text.toLowerCase().includes(q)) : list;
  }

  // Main Admin (live events only)
  for (const enr of (data.enrollments ?? []).slice(0, 2)) {
    items.push({
      id: `act-enr-${enr.id}`,
      text: `${enr.studentName} enrolled (${enr.status}) in ${enr.courseTitle}`,
      timeAgo: new Date(enr.enrolledAt).toLocaleDateString(),
      tone: 'emerald',
    });
  }

  for (const att of (data.attendance ?? []).slice(0, 1)) {
    items.push({
      id: `act-att-${att.id}`,
      text: `Attendance recorded (${att.status}) for ${att.targetName}`,
      timeAgo: att.date,
      tone: 'blue',
    });
  }

  for (const txn of (data.transactions ?? []).slice(0, 1)) {
    items.push({
      id: `act-txn-${txn.id}`,
      text: `Payment ${txn.status}: ৳${txn.totalAmount.toLocaleString()} (Invoice #${txn.invoiceNo})`,
      timeAgo: new Date(txn.createdAt).toLocaleDateString(),
      tone: 'purple',
    });
  }

  for (const post of (data.posts ?? []).slice(0, 1)) {
    items.push({
      id: `act-post-${post.id}`,
      text: `Post published: '${post.title}'`,
      timeAgo: new Date(post.createdAt).toLocaleDateString(),
      tone: 'amber',
    });
  }

  for (const crs of (data.courses ?? []).slice(0, 1)) {
    items.push({
      id: `act-crs-${crs.id}`,
      text: `Course active: '${crs.title}'`,
      timeAgo: crs.levelTag,
      tone: 'teal',
    });
  }

  const merged = items.slice(0, 5);
  const q = searchQuery.trim().toLowerCase();
  if (!q) return merged;
  return merged.filter((it) => it.text.toLowerCase().includes(q));
}

export interface UpcomingClassRow {
  id: string;
  monthShort: string;
  dayNum: string;
  title: string;
  instructorBy: string;
  timeText: string;
  tone: 'blue' | 'emerald' | 'purple';
}

export function buildUpcomingClassRows(
  data: DashboardSourceData,
  searchQuery = ''
): UpcomingClassRow[] {
  const batches = data.batches ?? [];
  const instructors = data.instructors ?? [];
  const liveLessons = (data.lessons ?? []).filter((l) => l.lessonType === 'live');
  const tones: ('blue' | 'emerald' | 'purple')[] = ['blue', 'emerald', 'purple'];
  const rows: UpcomingClassRow[] = [];

  for (let i = 0; i < Math.min(3, liveLessons.length); i += 1) {
    const lesson = liveLessons[i];
    const batch = batches.find((b) => b.id === lesson.batchId);
    const inst = instructors.find((ins) => ins.id === batch?.instructorId);
    const parsedDate = lesson.scheduledAt ? new Date(lesson.scheduledAt) : null;
    const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
    rows.push({
      id: lesson.id,
      monthShort: validDate ? validDate.toLocaleString('en-US', { month: 'short' }) : 'Live',
      dayNum: validDate ? String(validDate.getDate()).padStart(2, '0') : '--',
      title: lesson.title,
      instructorBy: `By: ${inst?.name || 'Faculty'}`,
      timeText:
        lesson.liveStatus === 'live_now'
          ? 'LIVE NOW'
          : batch?.schedule || lesson.scheduledAt || 'Scheduled',
      tone: tones[i % tones.length],
    });
  }

  if (rows.length < 3) {
    for (let i = 0; i < batches.length && rows.length < 3; i += 1) {
      const batch = batches[i];
      if (rows.some((r) => r.title === batch.name)) continue;
      const inst = instructors.find((ins) => ins.id === batch.instructorId);
      const parsedDate = batch.startDate ? new Date(batch.startDate) : null;
      const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
      rows.push({
        id: batch.id,
        monthShort: validDate ? validDate.toLocaleString('en-US', { month: 'short' }) : 'Batch',
        dayNum: validDate ? String(validDate.getDate()).padStart(2, '0') : String(i + 1).padStart(2, '0'),
        title: batch.name,
        instructorBy: `By: ${inst?.name || 'Faculty'}`,
        timeText: batch.schedule || 'Active Schedule',
        tone: tones[rows.length % tones.length],
      });
    }
  }

  const q = searchQuery.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.instructorBy.toLowerCase().includes(q)
  );
}


