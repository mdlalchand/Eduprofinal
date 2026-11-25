import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DASHBOARD_CONFIG,
  buildCourseDraftFromPost,
  calculateDiscountedPrice,
  calculateNetPayroll,
  calculateOrderTotal,
  calculateOrderTotalWithCoupon,
  calculateStudentProgress,
  calculateXpAndBadges,
  canRoleAccessPortalSection,
  computeAverageRating,
  computeBatchSeatUsage,
  computeHomepageStats,
  filterActiveBranches,
  filterCourses,
  filterLessonsByTypeAndBatch,
  gradeExamSubmission,
  maskLeaderboardName,
  maskSecretValue,
  filterActivePaymentGateways,
  normalizeDashboardConfig,
  normalizeHeaderMenu,
  parseBulkQuestionBank,
  parseImageUploadDataUrl,
  reorderListItem,
  resolveDefaultActiveBranchId,
  sanitizeSafeUrl,
  splitCoursesIntoSections,
  toSafeVideoEmbedUrl,
  validateScormManifest,
} from './domain';
import type { Branch, CommunityPost, Course, CourseBatch, CourseLesson, ExamQuestion, HomepageConfig } from '../types';

test('calculateDiscountedPrice computes base discount and valid active coupon', () => {
  const res = calculateDiscountedPrice(3000, 5000, {
    code: 'AEC20',
    discountPercent: 20,
    active: true,
    description: '20% off',
  });
  assert.equal(res.baseDiscountPercent, 40);
  assert.equal(res.couponDiscountAmount, 600);
  assert.equal(res.finalPrice, 2400);
  assert.equal(res.appliedCouponCode, 'AEC20');
});

test('calculateDiscountedPrice ignores inactive coupon', () => {
  const res = calculateDiscountedPrice(2000, 2500, {
    code: 'EXPIRED',
    discountPercent: 50,
    active: false,
    description: 'Expired',
  });
  assert.equal(res.couponDiscountAmount, 0);
  assert.equal(res.finalPrice, 2000);
  assert.equal(res.appliedCouponCode, null);
});

test('gradeExamSubmission scores answers accurately and assigns letter grades', () => {
  const questions: ExamQuestion[] = [
    {
      id: 'q1',
      prompt: 'Choose the correct tense',
      options: ['go', 'went', 'gone', 'going'],
      correctIndex: 1,
      explanation: 'Past tense',
      marks: 2,
    },
    {
      id: 'q2',
      prompt: 'Choose article',
      options: ['a', 'an', 'the', 'none'],
      correctIndex: 1,
      explanation: 'Vowel sound',
      marks: 2,
    },
  ];

  const passRes = gradeExamSubmission(questions, { q1: 1, q2: 1 }, 40);
  assert.equal(passRes.score, 4);
  assert.equal(passRes.totalMarks, 4);
  assert.equal(passRes.percentage, 100);
  assert.equal(passRes.grade, 'A+');
  assert.equal(passRes.passed, true);

  const partialRes = gradeExamSubmission(questions, { q1: 1, q2: 0 }, 60);
  assert.equal(partialRes.score, 2);
  assert.equal(partialRes.percentage, 50);
  assert.equal(partialRes.grade, 'B');
  assert.equal(partialRes.passed, false);
});

test('canRoleAccessPortalSection enforces strict multi-role RBAC boundaries', () => {
  assert.equal(canRoleAccessPortalSection('admin', 'settings'), true);
  assert.equal(canRoleAccessPortalSection('admin', 'users'), true);
  assert.equal(canRoleAccessPortalSection('admin', 'academic_ops'), true);
  assert.equal(canRoleAccessPortalSection('admin', 'integrations'), true);
  assert.equal(canRoleAccessPortalSection('branch_manager' as never, 'enrollments'), false);
  assert.equal(canRoleAccessPortalSection('branch_manager' as never, 'settings'), false);
  assert.equal(canRoleAccessPortalSection('teacher', 'exams'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'courses'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'catalog_cms'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'attendance_finance'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'ai_ecosystem'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'enrollments'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'branches'), false);
  assert.equal(canRoleAccessPortalSection('teacher', 'users'), false);
  assert.equal(canRoleAccessPortalSection('teacher', 'integrations'), false);
  assert.equal(canRoleAccessPortalSection('student', 'my_learning'), true);
  assert.equal(canRoleAccessPortalSection('student', 'users'), false);
  assert.equal(canRoleAccessPortalSection('guardian', 'guardian_monitor'), true);
  assert.equal(canRoleAccessPortalSection('guardian', 'exams'), false);
  assert.equal(canRoleAccessPortalSection('admin', 'activity_logs'), true);
  assert.equal(canRoleAccessPortalSection('branch_manager' as never, 'activity_logs'), false);
  assert.equal(canRoleAccessPortalSection('teacher', 'activity_logs'), false);
  assert.equal(canRoleAccessPortalSection('student', 'activity_logs'), false);
  assert.equal(canRoleAccessPortalSection('guardian', 'activity_logs'), false);
  assert.equal(canRoleAccessPortalSection('admin', 'profile'), true);
  assert.equal(canRoleAccessPortalSection('branch', 'enrollments'), true);
  assert.equal(canRoleAccessPortalSection('branch', 'branches'), true);
  assert.equal(canRoleAccessPortalSection('branch', 'courses'), true);
  assert.equal(canRoleAccessPortalSection('branch', 'users'), false);
  assert.equal(canRoleAccessPortalSection('branch', 'settings'), false);
  assert.equal(canRoleAccessPortalSection('branch', 'profile'), true);
  assert.equal(canRoleAccessPortalSection('branch_manager' as never, 'profile'), false);
  assert.equal(canRoleAccessPortalSection('teacher', 'profile'), true);
  assert.equal(canRoleAccessPortalSection('student', 'profile'), true);
  assert.equal(canRoleAccessPortalSection('guardian', 'profile'), true);
});

test('filterCourses filters active courses by category, combo flag, levelTag, drafts, and sort', () => {
  const sample: Course[] = [
    {
      id: '1',
      slug: 'hsc-eng',
      title: 'HSC English Mastery',
      subtitle: 'Grammar & First Paper',
      category: 'HSC English',
      levelTag: 'HSC 27',
      isCombo: false,
      price: 1990,
      originalPrice: 3000,
      enrolledCount: 500,
      examSystemIncluded: true,
      branchIds: ['b1'],
      instructorIds: ['i1'],
      thumbnail: '',
      description: '',
      highlights: [],
      demoVideoTitle: '',
      demoYoutubeUrl: '',
      status: 'active',
    },
    {
      id: '2',
      slug: 'combo-all',
      title: 'SSC + Spoken Combo',
      subtitle: 'All-in-one bundle',
      category: 'Combo Packs',
      levelTag: 'SSC 27',
      isCombo: true,
      price: 2990,
      originalPrice: 4500,
      enrolledCount: 800,
      examSystemIncluded: true,
      branchIds: ['b1'],
      instructorIds: ['i1'],
      thumbnail: '',
      description: '',
      highlights: [],
      demoVideoTitle: '',
      demoYoutubeUrl: '',
      status: 'active',
    },
    {
      id: '3',
      slug: 'draft-course',
      title: 'Upcoming IELTS Batch',
      subtitle: 'Draft batch',
      category: 'IELTS & Spoken',
      levelTag: 'IELTS',
      isCombo: false,
      price: 990,
      originalPrice: 1500,
      enrolledCount: 10,
      examSystemIncluded: true,
      branchIds: ['b1'],
      instructorIds: ['i1'],
      thumbnail: '',
      description: '',
      highlights: [],
      demoVideoTitle: '',
      demoYoutubeUrl: '',
      status: 'draft',
    },
  ];

  assert.equal(filterCourses(sample, 'All Courses').length, 2);
  assert.equal(filterCourses(sample, 'All Courses', '', { includeDrafts: true }).length, 3);
  assert.equal(filterCourses(sample, 'HSC English').length, 1);
  assert.equal(filterCourses(sample, 'HSC 27').length, 1);
  assert.equal(filterCourses(sample, 'Combos').length, 1);
  assert.equal(filterCourses(sample, 'All Courses', 'spoken').length, 1);
  const asc = filterCourses(sample, 'All Courses', '', { sortBy: 'price_asc' });
  assert.equal(asc[0].id, '1');
  const pop = filterCourses(sample, 'All Courses', '', { sortBy: 'popular' });
  assert.equal(pop[0].id, '2');

  const split = splitCoursesIntoSections(sample.slice(0, 2));
  assert.equal(split.combos.length, 1);
  assert.equal(split.regular.length, 1);
});

test('sanitizeSafeUrl blocks dangerous schemes and permits http/https/relative paths', () => {
  assert.equal(sanitizeSafeUrl('javascript:alert(1)', '/fallback.jpg'), '/fallback.jpg');
  assert.equal(sanitizeSafeUrl('data:text/html,<script>', '/fallback.jpg'), '/fallback.jpg');
  assert.equal(sanitizeSafeUrl('/src/assets/images/hero.jpg', '/fallback.jpg'), '/src/assets/images/hero.jpg');
  assert.equal(sanitizeSafeUrl('https://youtube.com/watch?v=123', ''), 'https://youtube.com/watch?v=123');
});

test('calculateOrderTotal waives delivery fee on branch pickup', () => {
  const home = calculateOrderTotal([{ unitPrice: 799, quantity: 2 }], 'home');
  assert.equal(home.subtotal, 1598);
  assert.equal(home.deliveryFee, 80);
  assert.equal(home.totalAmount, 1678);

  const pickup = calculateOrderTotal([{ unitPrice: 799, quantity: 2 }], 'branch_pickup');
  assert.equal(pickup.deliveryFee, 0);
  assert.equal(pickup.totalAmount, 1598);
});

test('calculateStudentProgress caps at 100 and handles 0 lessons', () => {
  assert.equal(calculateStudentProgress(0, ['l1']), 0);
  assert.equal(calculateStudentProgress(4, ['l1', 'l1', 'l2']), 50);
  assert.equal(calculateStudentProgress(2, ['l1', 'l2', 'l3']), 100);
});

test('toSafeVideoEmbedUrl converts YouTube links and blocks unsafe schemes', () => {
  assert.equal(
    toSafeVideoEmbedUrl('https://www.youtube.com/watch?v=abc123XYZ'),
    'https://www.youtube.com/embed/abc123XYZ'
  );
  assert.equal(
    toSafeVideoEmbedUrl('https://youtu.be/xyz987'),
    'https://www.youtube.com/embed/xyz987'
  );
  assert.equal(toSafeVideoEmbedUrl('javascript:alert(1)'), '');
});

test('filterLessonsByTypeAndBatch filters recorded, live, and sheet items sorted by orderIndex', () => {
  const lessons: CourseLesson[] = [
    {
      id: 'l2',
      courseId: 'c1',
      batchId: 'b1',
      batchName: 'Batch A',
      lessonType: 'live',
      title: 'Live Doubt Solving',
      moduleName: 'Live',
      duration: '60:00',
      videoPreviewTitle: 'Live Doubt Solving',
      videoUrl: '',
      liveJoinUrl: 'https://meet.google.com/abc',
      liveStatus: 'live_now',
      sheetSummary: 'Live Q&A',
      isFreePreview: false,
      orderIndex: 2,
    },
    {
      id: 'l1',
      courseId: 'c1',
      batchId: 'b1',
      batchName: 'Batch A',
      lessonType: 'recorded',
      title: 'Right Form of Verbs',
      moduleName: 'Module 1',
      duration: '40:00',
      videoPreviewTitle: 'Right Form of Verbs',
      videoUrl: 'https://www.youtube.com/embed/abc',
      sheetSummary: 'Recorded video',
      isFreePreview: true,
      orderIndex: 1,
    },
  ];

  const all = filterLessonsByTypeAndBatch(lessons, 'all', 'b1');
  assert.equal(all.length, 2);
  assert.equal(all[0].id, 'l1');
  assert.equal(filterLessonsByTypeAndBatch(lessons, 'live').length, 1);
  assert.equal(filterLessonsByTypeAndBatch(lessons, 'recorded').length, 1);
});

test('computeBatchSeatUsage computes remaining seats and fill percentage accurately', () => {
  const batch: CourseBatch = {
    id: 'b1',
    courseId: 'c1',
    name: 'Mirpur Batch A',
    code: 'MPR-A',
    branchId: 'br-mirpur',
    instructorId: 'inst-1',
    schedule: 'Sun-Tue-Thu 4:00 PM',
    startDate: '2026-04-01',
    seatLimit: 50,
    enrolledSeats: 40,
    mode: 'Hybrid',
    status: 'open',
  };
  const usage = computeBatchSeatUsage(batch);
  assert.equal(usage.remainingSeats, 10);
  assert.equal(usage.fillPercent, 80);
  assert.equal(usage.isFull, false);
});

test('canRoleAccessPortalSection restricts homepage_cms strictly to admin', () => {
  assert.equal(canRoleAccessPortalSection('admin', 'homepage_cms'), true);
  assert.equal(canRoleAccessPortalSection('teacher', 'homepage_cms'), false);
  assert.equal(canRoleAccessPortalSection('branch_manager' as never, 'homepage_cms'), false);
  assert.equal(canRoleAccessPortalSection('student', 'homepage_cms'), false);
  assert.equal(canRoleAccessPortalSection('guardian', 'homepage_cms'), false);
});

test('computeHomepageStats respects auto vs custom mode cleanly', () => {
  const live = { students: 2450, courses: 6, teachers: 4, videos: 1320 };
  const autoStats = computeHomepageStats(live, {
    mode: 'auto',
    badge: 'Trusted',
    title: 'Stats',
    subtitle: 'Sub',
    ctaText: 'Go',
    ctaLink: '/courses',
    customValues: { students: 500000, courses: 90, teachers: 45, videos: 8200 },
    labels: { students: 'Students', courses: 'Courses', teachers: 'Teachers', videos: 'Videos' },
  });
  assert.deepEqual(autoStats, live);

  const customCfg: HomepageConfig['statsCard'] = {
    mode: 'custom',
    badge: 'Trusted',
    title: 'Stats',
    subtitle: 'Sub',
    ctaText: 'Go',
    ctaLink: '/courses',
    customValues: { students: 500000, courses: 90, teachers: 45, videos: 8200 },
    labels: { students: 'Students', courses: 'Courses', teachers: 'Teachers', videos: 'Videos' },
  };
  const customStats = computeHomepageStats(live, customCfg);
  assert.deepEqual(customStats, { students: 500000, courses: 90, teachers: 45, videos: 8200 });
});

test('computeAverageRating and reorderListItem operate deterministically', () => {
  assert.equal(computeAverageRating([]), '5.0');
  assert.equal(computeAverageRating([{ rating: 5 }, { rating: 4 }]), '4.5');

  const reordered = reorderListItem(['a', 'b', 'c'], 1, 'up');
  assert.deepEqual(reordered, ['b', 'a', 'c']);
  assert.deepEqual(reorderListItem(['a', 'b', 'c'], 0, 'up'), ['a', 'b', 'c']);
});

test('parseImageUploadDataUrl validates MIME types, rejects SVG, and checks size limits', () => {
  const validPng = parseImageUploadDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
  assert.equal(validPng.ok, true);
  if (validPng.ok) {
    assert.equal(validPng.value.extension, 'png');
    assert.equal(validPng.value.mimeType, 'image/png');
    assert.ok(validPng.value.estimatedBytes > 0);
  }

  const svgRejected = parseImageUploadDataUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
  assert.equal(svgRejected.ok, false);

  const tooLarge = parseImageUploadDataUrl('data:image/jpeg;base64,AAAA', 2);
  assert.equal(tooLarge.ok, false);
});

test('parseBulkQuestionBank parses pipe-delimited and JSON questions cleanly', () => {
  const pipeRes = parseBulkQuestionBank(
    'He ___ to Dhaka yesterday. | go | went | gone | going | B | Past indefinite | 2\nShe is ___ honest girl. | a | an | the | none | B',
    'HSC English 2nd Paper',
    'Right Form of Verbs',
    'Hard'
  );
  assert.equal(pipeRes.errors.length, 0);
  assert.equal(pipeRes.items.length, 2);
  assert.equal(pipeRes.items[0].correctIndex, 1);
  assert.equal(pipeRes.items[0].marks, 2);
  assert.equal(pipeRes.items[0].subject, 'HSC English 2nd Paper');
  assert.equal(pipeRes.items[1].correctIndex, 1);
});

test('validateScormManifest validates SCORM 1.2 XML and blocks path traversal', () => {
  const validXml = `<manifest identifier="AEC-SCORM-1"><metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata><organizations><organization><title>Tense Interactive</title></organization></organizations><resources><resource href="index.html" /></resources></manifest>`;
  const res = validateScormManifest(validXml);
  assert.equal(res.ok, true);
  assert.equal(res.identifier, 'AEC-SCORM-1');
  assert.equal(res.launchFile, 'index.html');

  const badPath = `<manifest identifier="BAD"><metadata><schemaversion>1.2</schemaversion></metadata><organizations></organizations><resources><resource href="../../etc/passwd" /></resources></manifest>`;
  assert.equal(validateScormManifest(badPath).ok, false);
});

test('calculateXpAndBadges, maskLeaderboardName, coupon cart total, and payroll work deterministically', () => {
  const rewards = calculateXpAndBadges({
    lessonsCompleted: 5,
    examsPassed: 2,
    scormCompleted: 1,
    attendancePresent: 5,
  });
  assert.equal(rewards.xp, 5 * 40 + 2 * 120 + 150 + 5 * 25);
  assert.ok(rewards.badges.includes('SCORM 1.2 Achiever'));
  assert.ok(rewards.badges.includes('5-Day Streak'));

  assert.equal(maskLeaderboardName('Rafiul Islam', true), 'Rafiul Islam');
  assert.equal(maskLeaderboardName('Rafiul Islam', false), 'R****l I***m');

  const cart = calculateOrderTotalWithCoupon(
    [{ unitPrice: 1000, quantity: 1 }],
    'home',
    { code: 'AEC20', discountPercent: 20, active: true, appliesTo: 'all', description: '20% off' }
  );
  assert.equal(cart.discountAmount, 200);
  assert.equal(cart.totalAmount, 880);

  assert.equal(calculateNetPayroll(25000, 3000, 2000, 500, 1000), 28500);
});

test('normalizeHeaderMenu sanitizes unsafe paths and falls back when empty', () => {
  const cleaned = normalizeHeaderMenu([
    { id: 'm1', label: '  Scholarship FAQ  ', path: '/page/faq', badge: 'New', visible: true },
    { id: 'm2', label: 'Bad JS', path: 'javascript:alert(1)', visible: true },
    { id: 'm3', label: 'Hidden Link', path: '/courses', visible: false, openInNewTab: true },
  ]);
  assert.equal(cleaned.length, 2);
  assert.equal(cleaned[0].label, 'Scholarship FAQ');
  assert.equal(cleaned[0].badge, 'New');
  assert.equal(cleaned[1].visible, false);
  assert.equal(cleaned[1].openInNewTab, true);

  const fallback = normalizeHeaderMenu([]);
  assert.ok(fallback.length >= 8);
  assert.equal(fallback[0].path, '/');
});

test('maskSecretValue, filterActivePaymentGateways, and payments portal RBAC work accurately', () => {
  assert.equal(maskSecretValue(''), 'Not Configured');
  assert.equal(maskSecretValue('sk_live_9876543210'), 'sk_l••••••••3210');
  assert.equal(maskSecretValue('bkash_••••4321'), 'bkash_••••4321');

  const filtered = filterActivePaymentGateways([
    { id: 'pg-2', active: true, sortOrder: 2 },
    { id: 'pg-off', active: false, sortOrder: 1 },
    { id: 'pg-1', active: true, sortOrder: 1 },
  ]);
  assert.deepEqual(
    filtered.map((g) => g.id),
    ['pg-1', 'pg-2']
  );

  assert.equal(canRoleAccessPortalSection('admin', 'payments'), true);
  assert.equal(canRoleAccessPortalSection('branch_manager' as never, 'payments'), false);
  assert.equal(canRoleAccessPortalSection('student', 'payments'), false);
  assert.equal(canRoleAccessPortalSection('teacher', 'payments'), false);
});

test('filterActiveBranches and resolveDefaultActiveBranchId strictly exclude inactive campuses', () => {
  const branches: Branch[] = [
    {
      id: 'br-1',
      name: 'Uttara Campus',
      code: 'UTT',
      city: 'Dhaka',
      address: 'Sector 7',
      phone: '01700',
      managerName: 'Karim',
      activeStudents: 200,
      status: 'inactive',
    },
    {
      id: 'br-2',
      name: 'Mirpur Campus',
      code: 'MPR',
      city: 'Dhaka',
      address: 'DOHS',
      phone: '01711',
      managerName: 'Rahim',
      activeStudents: 450,
      status: 'active',
    },
  ];
  const active = filterActiveBranches(branches);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'br-2');
  assert.equal(resolveDefaultActiveBranchId(branches, 'br-1'), 'br-2');
  assert.equal(resolveDefaultActiveBranchId([branches[0]]), '');
});

test('normalizeDashboardConfig merges partial settings, validates hex colors, sanitizes images, and enforces valid themes/presets', () => {
  const custom = normalizeDashboardConfig({
    themeMode: 'midnight_dark',
    accentPreset: 'emerald_teal',
    brandTitle: 'AEC Pro Studio',
    brandBadge: 'v4.0',
    heroTitle: 'Hello Director',
    kpiLabels: { students: 'Learners' },
    colors: {
      heroStart: '#123456',
      heroEnd: 'javascript:alert(1)',
      sidebarStart: '#0a0b0c',
    },
    images: {
      heroAvatarUrl: '/uploads/custom-avatar.png',
      heroBannerBgUrl: 'javascript:alert(9)',
      brandLogoUrl: '/uploads/logo.png',
    },
    widgets: { liveClassNow: false, quickActions: true },
  });
  assert.equal(custom.themeMode, 'midnight_dark');
  assert.equal(custom.accentPreset, 'emerald_teal');
  assert.equal(custom.brandTitle, 'AEC Pro Studio');
  assert.equal(custom.brandBadge, 'v4.0');
  assert.equal(custom.heroTitle, 'Hello Director');
  assert.equal(custom.heroQuote, DEFAULT_DASHBOARD_CONFIG.heroQuote);
  assert.equal(custom.kpiLabels.students, 'Learners');
  assert.equal(custom.kpiLabels.courses, 'Total Courses');
  assert.equal(custom.colors.heroStart, '#123456');
  assert.equal(custom.colors.heroEnd, DEFAULT_DASHBOARD_CONFIG.colors.heroEnd);
  assert.equal(custom.colors.sidebarStart, '#0A0B0C');
  assert.equal(custom.images.heroAvatarUrl, '/uploads/custom-avatar.png');
  assert.equal(custom.images.heroBannerBgUrl, DEFAULT_DASHBOARD_CONFIG.images.heroBannerBgUrl);
  assert.equal(custom.images.brandLogoUrl, '/uploads/logo.png');
  assert.equal(custom.widgets.liveClassNow, false);
  assert.equal(custom.widgets.heroBanner, true);
  assert.equal(custom.widgets.systemActivityLogs, true);
});

test('buildCourseDraftFromPost maps community post into structured course draft with active branches', () => {
  const post: CommunityPost = {
    id: 'post-44',
    title: 'IELTS Writing Task 2 Band 8 Structure',
    category: 'IELTS & Spoken',
    content: 'Use a clear 4-paragraph essay structure.\nInclude two strong topic sentences per body paragraph.\nAvoid memorized clichés in Task 2.',
    image: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
    authorId: 'u-admin',
    authorName: 'Alomgir',
    authorRole: 'admin',
    likes: 12,
    likedByUserIds: [],
    comments: [],
    status: 'published',
    createdAt: '2026-04-01T00:00:00Z',
  };
  const branches: Branch[] = [
    {
      id: 'br-off',
      name: 'Inactive Branch',
      code: 'OFF',
      city: 'Dhaka',
      address: 'Road 1',
      phone: '017',
      managerName: 'A',
      activeStudents: 10,
      status: 'inactive',
    },
    {
      id: 'br-on',
      name: 'Mirpur Active',
      code: 'MPR',
      city: 'Dhaka',
      address: 'Road 2',
      phone: '018',
      managerName: 'B',
      activeStudents: 100,
      status: 'active',
    },
  ];
  const draft = buildCourseDraftFromPost(post, [], branches, { price: 2490, status: 'active' });
  assert.equal(draft.sourcePostId, 'post-44');
  assert.equal(draft.category, 'IELTS & Spoken');
  assert.equal(draft.price, 2490);
  assert.equal(draft.status, 'active');
  assert.deepEqual(draft.branchIds, ['br-on']);
  assert.ok(draft.highlights.length >= 2);
});




