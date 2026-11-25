import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAnalyticsOverviewSeries,
  buildCalendarGrid,
  buildCourseActivitySeries,
  buildCourseProgressSummary,
  buildEarningSeries,
  buildFuturisticKpiCards,
  buildKpiCards,
  buildLiveSpotlight,
  buildRecentActivityFeed,
  buildRecentEnrolledRows,
  buildTopInstructors,
  buildTopStudents,
  buildUpcomingClassRows,
  buildUpcomingSessions,
  buildUserActivitySeries,
} from './dashboardAnalytics';

const sampleData = {
  role: 'admin' as const,
  metrics: {
    totalStudents: 2450,
    totalCourses: 12,
    totalRevenue: 45000,
  },
  courses: [
    {
      id: 'c1',
      slug: 'hsc-eng',
      title: 'HSC English Mastery',
      subtitle: 'Grammar & Writing',
      category: 'HSC English' as const,
      levelTag: 'HSC 27',
      isCombo: false,
      price: 1990,
      originalPrice: 3000,
      enrolledCount: 450,
      examSystemIncluded: true,
      branchIds: ['b1'],
      instructorIds: ['i1'],
      thumbnail: '',
      description: '',
      highlights: [],
      demoVideoTitle: '',
      demoYoutubeUrl: '',
      status: 'active' as const,
    },
  ],
  enrollments: [
    {
      id: 'enr-1',
      userId: 'u1',
      studentName: 'Ayesha Siddika',
      studentEmail: 'ayesha@example.com',
      courseId: 'c1',
      courseTitle: 'HSC English Mastery',
      branchId: 'b1',
      paymentMethod: 'bKash' as const,
      invoiceNo: 'AEC-9001',
      amountPaid: 1990,
      status: 'approved' as const,
      completedLessonIds: [],
      enrolledAt: '2025-02-10T10:00:00Z',
    },
  ],
  instructors: [
    {
      id: 'i1',
      name: 'Prof. Alomgir Kabir',
      subject: 'HSC English',
      roleTitle: 'Lead Instructor',
      education: 'DU English',
      panel: 'Head Faculty' as const,
      branchId: 'b1',
      bio: '',
      avatar: '/src/assets/images/avatar_admin_director_1795437875081.jpg',
    },
  ],
};

test('buildKpiCards returns 4 distinct KPI cards with formatted real values', () => {
  const kpis = buildKpiCards(sampleData);
  assert.equal(kpis.length, 4);
  assert.deepEqual(
    kpis.map((k) => k.id),
    ['enrolled', 'students', 'courses', 'earnings']
  );
  assert.ok(kpis[3].valueDisplay.startsWith('৳'));
  assert.equal(kpis[0].positive, true);
  assert.equal(kpis[3].rawValue, 45000);
});

test('buildEarningSeries adjusts bars and headline across Yearly, Quarterly, and Monthly', () => {
  const yearly = buildEarningSeries(sampleData, 'Yearly');
  const quarterly = buildEarningSeries(sampleData, 'Quarterly');
  const monthly = buildEarningSeries(sampleData, 'Monthly');

  assert.equal(yearly.points.length, 12);
  assert.equal(quarterly.points.length, 4);
  assert.equal(monthly.points.length, 4);
  assert.equal(yearly.points[0].label, 'Jan');
  assert.equal(quarterly.points[0].label, 'Q1');
  assert.equal(monthly.points[0].label, 'W1');
});

test('buildCalendarGrid produces complete 7-column weeks and marks event dates', () => {
  const dec2025 = buildCalendarGrid(2025, 11);
  assert.equal(dec2025.monthLabel, 'December 2025');
  assert.equal(dec2025.cells.length % 7, 0);
  const day18 = dec2025.cells.find((c) => c.day === 18);
  assert.ok(day18);
  assert.equal(day18?.isoDate, '2025-12-18');
  assert.equal(day18?.hasEvent, true);
});

test('buildUserActivitySeries distributes real platform segments cleanly', () => {
  const segments = buildUserActivitySeries(sampleData, 'Yearly');
  assert.equal(segments.length, 4);
  const sumPct = segments.reduce((s, item) => s + item.percentage, 0);
  assert.ok(sumPct >= 98 && sumPct <= 102);
});

test('buildCourseActivitySeries returns aligned paid and free series', () => {
  const yearly = buildCourseActivitySeries(sampleData, 'Yearly');
  assert.equal(yearly.labels.length, 4);
  assert.equal(yearly.paidSeries.length, yearly.labels.length);
  assert.equal(yearly.freeSeries.length, yearly.labels.length);
});

test('buildUpcomingSessions and buildRecentEnrolledRows reflect real records without fake padding', () => {
  const allSessions = buildUpcomingSessions(sampleData);
  assert.equal(allSessions.length, 0);

  const rows = buildRecentEnrolledRows(sampleData.enrollments);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].student, 'Ayesha Siddika');
  const filteredRows = buildRecentEnrolledRows(sampleData.enrollments, 'Ayesha');
  assert.equal(filteredRows.length, 1);
});

test('buildTopStudents and buildTopInstructors return actual ranked records only', () => {
  const topStudents = buildTopStudents(sampleData);
  const topInstructors = buildTopInstructors(sampleData.instructors, []);
  assert.equal(topStudents.length, 1);
  assert.equal(topStudents[0].name, 'Ayesha Siddika');
  assert.equal(topInstructors.length, 1);
  assert.equal(topInstructors[0].name, 'Prof. Alomgir Kabir');
});

test('futuristic LMS builders return aligned KPI, analytics, progress, live spotlight, and feeds', () => {
  const fKpis = buildFuturisticKpiCards(sampleData);
  assert.equal(fKpis.length, 4);
  assert.deepEqual(
    fKpis.map((k) => k.id),
    ['students', 'teachers', 'courses', 'batches']
  );

  const overview6m = buildAnalyticsOverviewSeries(sampleData, 'Last 6 Months');
  assert.equal(overview6m.labels.length, overview6m.studentsSeries.length);
  assert.equal(overview6m.enrollmentsSeries.length, overview6m.viewsSeries.length);

  const progress = buildCourseProgressSummary(sampleData);
  assert.equal(progress.completedPct + progress.inProgressPct + progress.notStartedPct, 100);

  const spotlight = buildLiveSpotlight(sampleData);
  assert.ok(spotlight.title.length > 0);

  const feed = buildRecentActivityFeed(sampleData);
  assert.equal(feed.length, 2);
  assert.ok(feed[0].text.includes('Ayesha Siddika'));

  const upcoming = buildUpcomingClassRows(sampleData);
  assert.equal(upcoming.length, 0);
});

