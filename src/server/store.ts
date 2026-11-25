import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type {
  ApiPlugin,
  AttendanceRecord,
  AuditLogEntry,
  BackupSnapshot,
  BatchActivityLog,
  BatchNotification,
  BatchTransferRecord,
  BatchWaitlistEntry,
  Branch,
  BroadcastCampaign,
  CategoryItem,
  CenterResultRecord,
  CommunityPost,
  Coupon,
  Course,
  CourseAnnouncement,
  CourseAssignment,
  CourseBatch,
  CourseCertificate,
  CourseChapter,
  CourseLesson,
  CourseModule,
  AssignmentSubmission,
  Ebook,
  Enrollment,
  Exam,
  ExamAttempt,
  FinancialRecord,
  HomepageConfig,
  Instructor,
  LearnerRewardProfile,
  MediaAsset,
  Order,
  PaymentGatewayConfig,
  PaymentTransaction,
  PayrollRecord,
  Product,
  QuestionBankItem,
  RecycleBinItem,
  Review,
  ScormAttempt,
  ScormPackage,
  SiteSettings,
  User,
  UserRole,
  WebhookConfig,
} from '../types';
import {
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_HEADER_MENU,
  normalizeDashboardConfig,
  normalizeHeaderMenu,
} from '../lib/domain';
import { enrichAuditLogEntry } from '../lib/auditLogs';
import {
  hashPassword as dbHashPassword,
  loadOrInitializeDatabase,
  persistStateToSqlite,
  verifyPassword as dbVerifyPassword,
  writeVerifiedDiskBackup,
} from '../db/persistence';
import { createDefaultAcademicCollections, createDefaultIntegrations } from './integrationSeed';
import { createExtendedSeedCollections } from './seedExtensions';
import type { ContactMessage, DatabaseState, StoredUser } from './storeTypes';

export type { ContactMessage, DatabaseState, StoredUser };

export function hashPassword(password: string): string {
  return dbHashPassword(password);
}

export function verifyPassword(password: string, stored: string): boolean {
  return dbVerifyPassword(password, stored);
}

export function sanitizeUser(user: StoredUser): User {
  const {
    passwordHash: _ignored,
    twoFactorSecret: _secret,
    twoFactorRecoveryHashes: _rec,
    passwordUpdatedAt: _pwAt,
    ...safe
  } = user;
  return safe;
}

function createInitialState(): DatabaseState {
  const now = new Date().toISOString();
  const envAdminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const envAdminPass = (process.env.ADMIN_PASSWORD ?? '').trim();
  const adminPasswordHash = envAdminPass.length >= 10 ? hashPassword(envAdminPass) : '';
  const randomSeedPass = () => hashPassword(crypto.randomBytes(18).toString('base64url'));

  const branches: Branch[] = [
    {
      id: 'br-mirpur',
      name: 'Mirpur DOHS Main Campus',
      code: 'AEC-MPR',
      city: 'Dhaka',
      address: 'House 42, Road 6/A, Avenue 8, Mirpur DOHS, Dhaka',
      phone: '09617331133',
      managerName: 'Tariqul Islam',
      activeStudents: 1420,
      status: 'active',
    },
    {
      id: 'br-uttara',
      name: 'Uttara Sector 7 Campus',
      code: 'AEC-UTR',
      city: 'Dhaka',
      address: 'Level 4, Plot 18, Road 12, Sector 7, Uttara, Dhaka',
      phone: '01711002233',
      managerName: 'Nusrat Jahan',
      activeStudents: 980,
      status: 'active',
    },
    {
      id: 'br-ctg',
      name: 'Chattogram GEC Campus',
      code: 'AEC-CTG',
      city: 'Chattogram',
      address: 'Suite 502, Academic Plaza, GEC Circle, Chattogram',
      phone: '01811004455',
      managerName: 'Sajid Chowdhury',
      activeStudents: 760,
      status: 'active',
    },
  ];

  const users: StoredUser[] = [
    {
      id: 'u-admin',
      name: 'Alomgir Hossain',
      email: envAdminEmail || 'admin@alomsenglish.com',
      phone: '01710000001',
      role: 'admin',
      branchId: null,
      avatar: '/src/assets/images/instructor_portrait_lead_1795411661581.jpg',
      passwordHash: adminPasswordHash,
      passwordUpdatedAt: adminPasswordHash ? now : null,
      mustResetPassword: !adminPasswordHash,
      twoFactorEnabled: false,
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: '2026-01-05T09:00:00.000Z',
    },
    {
      id: 'u-teacher',
      name: 'Mahmudul Hasan',
      email: 'teacher@alomsenglish.com',
      phone: '01710000003',
      role: 'teacher',
      branchId: 'br-mirpur',
      avatar: '/src/assets/images/instructor_portrait_lead_1795411661581.jpg',
      passwordHash: randomSeedPass(),
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: '2026-01-07T09:00:00.000Z',
    },
    {
      id: 'u-student',
      name: 'Arafat Rahman',
      email: 'student@alomsenglish.com',
      phone: '01710000004',
      role: 'student',
      branchId: 'br-mirpur',
      rollNumber: 'AEC-2026-101',
      passwordHash: randomSeedPass(),
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'u-student-2',
      name: 'Farhana Yasmin',
      email: 'farhana@alomsenglish.com',
      phone: '01710000006',
      role: 'student',
      branchId: 'br-uttara',
      rollNumber: 'AEC-2026-102',
      passwordHash: randomSeedPass(),
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: '2026-01-12T09:00:00.000Z',
    },
    {
      id: 'u-guardian',
      name: 'Kamrul Hasan (Guardian)',
      email: 'guardian@alomsenglish.com',
      phone: '01710000005',
      role: 'guardian',
      branchId: 'br-mirpur',
      guardianLinkedStudentIds: ['u-student'],
      passwordHash: randomSeedPass(),
      communicationConsent: { email: true, sms: true, whatsapp: true },
      createdAt: '2026-01-11T09:00:00.000Z',
    },
  ];

  const instructors: Instructor[] = [
    {
      id: 'inst-1',
      userId: 'u-admin',
      name: 'Alomgir Hossain',
      subject: 'English Grammar & IELTS',
      roleTitle: 'Founder & Lead Mentor, Aloms English Center',
      education: 'MA in English Literature, University of Dhaka',
      panel: 'Head Faculty',
      branchId: 'br-mirpur',
      bio: '12+ years coaching HSC, SSC, IELTS Band 8+ and University Admission English across Bangladesh.',
      avatar: '/src/assets/images/instructor_portrait_lead_1795411661581.jpg',
    },
    {
      id: 'inst-2',
      userId: 'u-teacher',
      name: 'Mahmudul Hasan',
      subject: 'HSC & Admission English',
      roleTitle: 'Senior Lecturer, Academic English',
      education: 'BA (Hons), MA in ELT, Jahangirnagar University',
      panel: 'Head Faculty',
      branchId: 'br-mirpur',
      bio: 'Specialist in Right Form of Verbs, Modifiers, Clauses, and DU B-Unit English.',
      avatar: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
    },
    {
      id: 'inst-3',
      name: 'Sabrina Karim',
      subject: 'Spoken English & Phonetics',
      roleTitle: 'Head of Fluency & Pronunciation',
      education: 'CELTA Certified, North South University',
      panel: 'Head Faculty',
      branchId: 'br-uttara',
      bio: 'Helps shy learners speak confident natural English through structured shadowing drills.',
      avatar: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
    },
    {
      id: 'inst-4',
      name: 'Nafis Ahmed',
      subject: 'IELTS Writing & Reading',
      roleTitle: 'IELTS Band 8.5 Trainer',
      education: 'TESOL Certified, BRAC University',
      panel: 'Head Faculty',
      branchId: 'br-mirpur',
      bio: 'Reviewed over 4,500 IELTS Task 1 & Task 2 essays with Band 7.5+ student outcomes.',
      avatar: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
    },
    {
      id: 'inst-5',
      name: 'Tasnim Tabassum',
      subject: 'SSC English 1st & 2nd Paper',
      roleTitle: 'Branch Faculty Coordinator',
      education: 'English, University of Chittagong',
      panel: 'Branch Faculty',
      branchId: 'br-ctg',
      bio: 'Focused on board-standard paragraph, formal letter, and passage comprehension mastery.',
      avatar: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
    },
    {
      id: 'inst-6',
      name: 'Rashedul Bari',
      subject: 'Vocabulary & Critical Reading',
      roleTitle: 'Admission English Mentor',
      education: 'IBA, University of Dhaka',
      panel: 'Branch Faculty',
      branchId: 'br-uttara',
      bio: 'Guides IBA, BUP, and Medical English candidates with root-word vocabulary systems.',
      avatar: '/src/assets/images/instructor_portrait_lead_1795411661581.jpg',
    },
  ];

  const courses: Course[] = [
    {
      id: 'crs-frpb-ssc',
      slug: 'ssc-english-final-revision',
      title: 'Final Revision Premium Batch for SSC-27 (English 1st & 2nd)',
      subtitle: 'Complete SSC Board Grammar, Writing & CQ/MCQ Mastery',
      category: 'SSC English',
      levelTag: 'SSC 27',
      isCombo: false,
      price: 2490,
      originalPrice: 3800,
      enrolledCount: 8920,
      examSystemIncluded: true,
      branchIds: ['br-mirpur', 'br-uttara', 'br-ctg'],
      instructorIds: ['inst-1', 'inst-2', 'inst-5'],
      thumbnail: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
      description:
        'প্রিয় SSC 27 ব্যাচের শিক্ষার্থীরা, ইংরেজি ১ম ও ২য় পত্রে A+ নিশ্চিত করতে Aloms English Center নিয়ে এসেছে সম্পূর্ণ সিলেবাসের Final Revision Premium Batch। এখানে প্রতিটি Grammar টপিক একদম বেসিক থেকে বোর্ড পরীক্ষার প্রশ্ন সমাধানসহ শেখানো হবে এবং প্রতিটি অধ্যায়ের পর থাকবে লাইভ MCQ ও Written মডেল টেস্ট।',
      highlights: [
        '65+ Live & Recorded Concept Classes',
        '100% Board Grammar & Freehand Writing Coverage',
        'Weekly Model Test + Instant Merit List',
        'Printable PDF Lecture Sheets & Suggestion Book',
      ],
      demoVideoTitle: 'SSC English 2nd Paper: Completing Sentence & Suffix-Prefix Tricks',
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status: 'active',
    },
    {
      id: 'crs-hsc-combo',
      slug: 'hsc-english-complete-combo',
      title: 'HSC 27-28 English 1st & 2nd Paper + Spoken Combo',
      subtitle: 'All-in-One Academic & Fluency Bundle for College Students',
      category: 'Combo Packs',
      levelTag: 'HSC 27',
      isCombo: true,
      includedCourses: [
        'HSC English 1st Paper Textual Mastery',
        'HSC English 2nd Paper Grammar Pro',
        'Freehand Writing & Flow Chart Lab',
      ],
      price: 3490,
      originalPrice: 5200,
      enrolledCount: 6410,
      examSystemIncluded: true,
      branchIds: ['br-mirpur', 'br-uttara', 'br-ctg'],
      instructorIds: ['inst-1', 'inst-2', 'inst-3'],
      thumbnail: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
      description:
        'HSC প্রথম ও দ্বিতীয় বর্ষের শিক্ষার্থীদের জন্য সম্পূর্ণ Academic English প্যাকেজ। Seen/Unseen Passage, Flow Chart, Summary থেকে শুরু করে Modifiers, Preposition, Connectors এবং Narration—সবকিছু ধাপে ধাপে শেখানো হয়।',
      highlights: [
        '3 Full Courses Included in One Bundle',
        '24/7 Doubt Solving & Guardian Progress Report',
        '30+ Chapter-wise Board Standard MCQ + CQ Exams',
        'Online + Any AEC Branch Hybrid Support',
      ],
      demoVideoTitle: 'HSC Modifiers & Connectors in 20 Minutes',
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status: 'active',
    },
    {
      id: 'crs-ielts-pro',
      slug: 'ielts-band-8-pro',
      title: 'IELTS Academic & GT Complete Band 8.0 Mastery',
      subtitle: 'Listening, Reading, Writing Task 1 & 2, and 1-on-1 Speaking',
      category: 'IELTS & Spoken',
      levelTag: 'IELTS',
      isCombo: false,
      price: 4990,
      originalPrice: 7500,
      enrolledCount: 4180,
      examSystemIncluded: true,
      branchIds: ['br-mirpur', 'br-uttara'],
      instructorIds: ['inst-1', 'inst-4', 'inst-3'],
      thumbnail: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
      description:
        'Target Band 7.5 to 8.5 with structured IELTS Writing Task 1 & Task 2 feedback, full computer-delivered mock tests, and live speaking mock interviews with certified trainers.',
      highlights: [
        '10 Full Computer-Delivered Mock Tests',
        '12 Evaluated Writing Task Scripts with Line Feedback',
        'Live 1-on-1 Speaking Mock Interviews',
        'Band 8+ Vocabulary & Cue Card Bank',
      ],
      demoVideoTitle: 'IELTS Writing Task 2: How to Score Band 8 in Coherence',
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status: 'active',
    },
    {
      id: 'crs-spoken-fluency',
      slug: 'spoken-english-phonetics',
      title: 'Spoken English & British/Neutral Phonetics Zero to Pro',
      subtitle: 'Speak Confidently in Interviews, Presentations & Daily Life',
      category: 'IELTS & Spoken',
      levelTag: 'Spoken',
      isCombo: false,
      price: 1990,
      originalPrice: 3000,
      enrolledCount: 7350,
      examSystemIncluded: true,
      branchIds: ['br-mirpur', 'br-uttara', 'br-ctg'],
      instructorIds: ['inst-3', 'inst-1'],
      thumbnail: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
      description:
        'ইংরেজিতে কথা বলতে জড়তা দূর করতে এবং প্রাত্যহিক জীবন, চাকরির ইন্টারভিউ ও প্রেজেন্টেশনে সাবলীলভাবে ইংরেজি বলার জন্য তৈরি এই কোর্স।',
      highlights: [
        '40 Practical Speaking Drills & IPA Pronunciation',
        'Daily Situational Dialogues & Roleplay',
        'Live Speaking Club Access at All Branches',
      ],
      demoVideoTitle: 'How to Think in English Without Translating Word by Word',
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status: 'active',
    },
    {
      id: 'crs-grammar-pro',
      slug: 'english-grammar-basic-to-pro',
      title: 'English Grammar Basic to Pro (Class 8 to University)',
      subtitle: 'Master Tense, Clause, Voice, Narration & Sentence Structure',
      category: 'Grammar Pro',
      levelTag: 'All Levels',
      isCombo: false,
      price: 1490,
      originalPrice: 2400,
      enrolledCount: 9540,
      examSystemIncluded: true,
      branchIds: ['br-mirpur', 'br-uttara', 'br-ctg'],
      instructorIds: ['inst-1', 'inst-2'],
      thumbnail: '/src/assets/images/course_english_books_1795411661325.jpg',
      description:
        'যাদের ইংরেজি গ্রামারের বেসিক দুর্বল, তাদের জন্য একদম শূন্য থেকে শুরু করে অ্যাডভান্সড লেভেল পর্যন্ত গাইডলাইন ও প্র্যাকটিস শিটসহ কমপ্লিট গ্রামার কোর্স।',
      highlights: [
        '50 Structured Grammar Modules',
        '1,500+ Practice MCQs with Explanations',
        'Lifetime Printable Grammar Handouts',
      ],
      demoVideoTitle: 'Parts of Speech & Clause Identification Shortcut',
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status: 'active',
    },
    {
      id: 'crs-admission-du',
      slug: 'university-admission-english',
      title: 'DU, IBA & Medical Admission English Thunder Batch',
      subtitle: 'High-Yield Admission Grammar, Pinpoint Error & Vocabulary',
      category: 'Admission',
      levelTag: 'Admission',
      isCombo: false,
      price: 2990,
      originalPrice: 4500,
      enrolledCount: 5120,
      examSystemIncluded: true,
      branchIds: ['br-mirpur', 'br-uttara', 'br-ctg'],
      instructorIds: ['inst-2', 'inst-6'],
      thumbnail: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
      description:
        'ঢাকা বিশ্ববিদ্যালয়, গুচ্ছ, মেডিক্যাল ও বিইউপি ভর্তি পরীক্ষার জন্য বিগত ২০ বছরের প্রশ্ন বিশ্লেষণসহ স্পেশাল ইংরেজি কোর্স।',
      highlights: [
        'DU, RU, CU, JU & Medical Past Paper Solved',
        'Pinpoint Error & Analogy Special Classes',
        'Daily Timed Admission Mock Exams',
      ],
      demoVideoTitle: 'DU B-Unit Pinpoint Error Detection Strategy',
      demoYoutubeUrl: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      status: 'active',
    },
  ];

  const batches: CourseBatch[] = [
    {
      id: 'bat-ssc-mpr-1',
      courseId: 'crs-frpb-ssc',
      name: 'SSC-27 Mirpur Evening Batch A',
      code: 'SSC27-MPR-A',
      branchId: 'br-mirpur',
      instructorId: 'inst-1',
      schedule: 'Sun · Tue · Thu — 4:30 PM',
      startDate: '2026-04-05',
      seatLimit: 60,
      enrolledSeats: 44,
      mode: 'Hybrid',
      status: 'running',
    },
    {
      id: 'bat-ssc-online-1',
      courseId: 'crs-frpb-ssc',
      name: 'SSC-27 Nationwide Live Batch',
      code: 'SSC27-ONL-1',
      branchId: 'br-mirpur',
      instructorId: 'inst-2',
      schedule: 'Sat · Mon · Wed — 8:00 PM',
      startDate: '2026-04-10',
      seatLimit: 250,
      enrolledSeats: 185,
      mode: 'Online Live',
      status: 'open',
    },
    {
      id: 'bat-hsc-utr-1',
      courseId: 'crs-hsc-combo',
      name: 'HSC-27 Uttara Morning Batch',
      code: 'HSC27-UTR-1',
      branchId: 'br-uttara',
      instructorId: 'inst-2',
      schedule: 'Fri · Sat — 10:00 AM',
      startDate: '2026-04-12',
      seatLimit: 50,
      enrolledSeats: 38,
      mode: 'Offline Branch',
      status: 'open',
    },
    {
      id: 'bat-ielts-1',
      courseId: 'crs-ielts-pro',
      name: 'IELTS Band 8.0 Weekend Live',
      code: 'IELTS-WKND-04',
      branchId: 'br-mirpur',
      instructorId: 'inst-4',
      schedule: 'Fri · Sat — 7:30 PM',
      startDate: '2026-04-15',
      seatLimit: 40,
      enrolledSeats: 31,
      mode: 'Online Live',
      status: 'running',
    },
  ];

  const modules: CourseModule[] = [
    {
      id: 'mod-ssc-1',
      courseId: 'crs-frpb-ssc',
      title: 'Module 1: Core Grammar',
      description: 'Foundational board grammar rules including Right Form of Verbs and Completing Sentences.',
      orderIndex: 1,
      status: 'published',
    },
    {
      id: 'mod-ssc-2',
      courseId: 'crs-frpb-ssc',
      title: 'Module 2: Transformation',
      description: 'Passage narration, transformation of sentences, and board writing templates.',
      orderIndex: 2,
      status: 'published',
    },
    {
      id: 'mod-hsc-1',
      courseId: 'crs-hsc-combo',
      title: 'HSC 2nd Paper Grammar',
      description: 'Modifiers, prepositions, and sentence connectors for board mastery.',
      orderIndex: 1,
      status: 'published',
    },
    {
      id: 'mod-hsc-2',
      courseId: 'crs-hsc-combo',
      title: 'HSC 1st Paper Writing',
      description: 'Flow charts, summary writing, and unseen passage strategy.',
      orderIndex: 2,
      status: 'published',
    },
    {
      id: 'mod-ielts-1',
      courseId: 'crs-ielts-pro',
      title: 'Writing Module',
      description: 'Task 1 data commentary and Task 2 Band 8 essay structure.',
      orderIndex: 1,
      status: 'published',
    },
  ];

  const chapters: CourseChapter[] = [
    {
      id: 'chp-ssc-1',
      courseId: 'crs-frpb-ssc',
      moduleId: 'mod-ssc-1',
      title: 'Board Grammar Essentials',
      orderIndex: 1,
    },
    {
      id: 'chp-ssc-2',
      courseId: 'crs-frpb-ssc',
      moduleId: 'mod-ssc-2',
      title: 'Narration & Sentence Synthesis',
      orderIndex: 1,
    },
    {
      id: 'chp-hsc-1',
      courseId: 'crs-hsc-combo',
      moduleId: 'mod-hsc-1',
      title: 'Modifiers & Connectors',
      orderIndex: 1,
    },
  ];

  const lessons: CourseLesson[] = [
    {
      id: 'les-1',
      courseId: 'crs-frpb-ssc',
      moduleId: 'mod-ssc-1',
      chapterId: 'chp-ssc-1',
      batchId: 'bat-ssc-mpr-1',
      batchName: 'SSC-27 Mirpur Evening Batch A',
      lessonType: 'recorded',
      title: '01. Right Form of Verbs — 12 Golden Board Rules',
      moduleName: 'Module 1: Core Grammar',
      duration: '42:15',
      videoPreviewTitle: 'Right Form of Verbs Masterclass',
      videoUrl: 'https://www.youtube.com/embed/M7lc1UVf-VE',
      lectureSheetUrl: 'https://alomsenglishcenter.com/sheets/ssc-right-form-verbs.pdf',
      sheetSummary:
        'Covers subject-verb agreement, conditional triggers, modal passives, and past board question patterns from Dhaka & Rajshahi boards.',
      isFreePreview: true,
      completionRequired: true,
      status: 'published',
      orderIndex: 1,
    },
    {
      id: 'les-2',
      courseId: 'crs-frpb-ssc',
      moduleId: 'mod-ssc-1',
      chapterId: 'chp-ssc-1',
      batchId: 'bat-ssc-online-1',
      batchName: 'SSC-27 Nationwide Live Batch',
      lessonType: 'live',
      title: '02. Live Completing Sentences & Board Doubt Solving',
      moduleName: 'Module 1: Core Grammar',
      duration: '60:00',
      videoPreviewTitle: 'Live Interactive Grammar Class',
      videoUrl: 'https://www.youtube.com/embed/M7lc1UVf-VE',
      liveJoinUrl: 'https://meet.google.com/aloms-ssc27-live',
      liveStatus: 'live_now',
      scheduledAt: '2026-11-23T20:00',
      lectureSheetUrl: 'https://alomsenglishcenter.com/sheets/completing-sentences-live.pdf',
      sheetSummary:
        'Live interactive workshop covering It is high time, Lest, No sooner had, Provided that, and student Q&A.',
      isFreePreview: false,
      completionRequired: true,
      status: 'published',
      orderIndex: 2,
    },
    {
      id: 'les-3',
      courseId: 'crs-frpb-ssc',
      moduleId: 'mod-ssc-2',
      chapterId: 'chp-ssc-2',
      batchId: 'bat-ssc-mpr-1',
      batchName: 'SSC-27 Mirpur Evening Batch A',
      lessonType: 'lecture_sheet',
      title: '03. Narration & Transformation Complete Formula Sheet (PDF)',
      moduleName: 'Module 2: Transformation',
      duration: 'PDF · 24 Pages',
      videoPreviewTitle: 'Passage Narration Shortcut Handout',
      videoUrl: '',
      lectureSheetUrl: 'https://alomsenglishcenter.com/sheets/narration-master-sheet.pdf',
      sheetSummary:
        'Complete rules for reporting verb shifts, universal truths, exclamation conversion, and 40 solved board passages.',
      isFreePreview: false,
      completionRequired: true,
      status: 'published',
      orderIndex: 3,
    },
    {
      id: 'les-4',
      courseId: 'crs-hsc-combo',
      moduleId: 'mod-hsc-1',
      chapterId: 'chp-hsc-1',
      batchId: 'bat-hsc-utr-1',
      batchName: 'HSC-27 Uttara Morning Batch',
      lessonType: 'recorded',
      title: '01. HSC Modifiers — Pre-Modifier & Post-Modifier Matrix',
      moduleName: 'HSC 2nd Paper Grammar',
      duration: '44:00',
      videoPreviewTitle: 'Modifiers 100% Accuracy System',
      videoUrl: 'https://www.youtube.com/embed/M7lc1UVf-VE',
      lectureSheetUrl: 'https://alomsenglishcenter.com/sheets/hsc-modifiers-guide.pdf',
      sheetSummary:
        'Distinguishes participle, appositive, determiner, intensifier, and infinitive modifiers with 25 board examples.',
      isFreePreview: true,
      completionRequired: true,
      status: 'published',
      orderIndex: 1,
    },
    {
      id: 'les-5',
      courseId: 'crs-hsc-combo',
      moduleId: 'mod-hsc-2',
      batchId: 'bat-hsc-utr-1',
      batchName: 'HSC-27 Uttara Morning Batch',
      lessonType: 'live',
      title: '02. Live Flow Chart & Summary Writing Clinic',
      moduleName: 'HSC 1st Paper Writing',
      duration: '50:00',
      videoPreviewTitle: '10/10 in Flow Charts (Scheduled Live)',
      videoUrl: 'https://www.youtube.com/embed/M7lc1UVf-VE',
      liveJoinUrl: 'https://zoom.us/j/aloms-hsc-flowchart',
      liveStatus: 'scheduled',
      scheduledAt: '2026-11-25T19:30',
      sheetSummary:
        'Gerund, infinitive, and noun phrase parallel structures for top marks in HSC 1st Paper Flow Charts.',
      isFreePreview: false,
      completionRequired: true,
      status: 'published',
      orderIndex: 2,
    },
    {
      id: 'les-6',
      courseId: 'crs-ielts-pro',
      moduleId: 'mod-ielts-1',
      batchId: 'bat-ielts-1',
      batchName: 'IELTS Band 8.0 Weekend Live',
      lessonType: 'recorded',
      title: '01. IELTS Writing Task 2 — Opinion & Discussion Essay Blueprint',
      moduleName: 'Writing Module',
      duration: '51:10',
      videoPreviewTitle: 'Band 8 Essay Structure',
      videoUrl: 'https://www.youtube.com/embed/M7lc1UVf-VE',
      lectureSheetUrl: 'https://alomsenglishcenter.com/sheets/ielts-task2-blueprint.pdf',
      sheetSummary:
        'Thesis framing, PEEL paragraph development, cohesive devices without repetition, and lexical precision.',
      isFreePreview: true,
      completionRequired: true,
      status: 'published',
      orderIndex: 1,
    },
  ];

  const assignments: CourseAssignment[] = [
    {
      id: 'asg-ssc-1',
      courseId: 'crs-frpb-ssc',
      batchId: 'bat-ssc-mpr-1',
      title: 'Board Completing Sentences & Narration Drill Sheet 01',
      instructions:
        'Write 10 complete sentences using "It is high time", "Lest", "Provided that", and convert the passage narration exercise into indirect speech.',
      dueDate: '2026-12-05',
      maxMarks: 20,
      createdByUserId: 'u-teacher',
      createdByName: 'Mahmudul Hasan',
      createdAt: '2026-03-01T10:00:00.000Z',
    },
  ];

  const assignmentSubmissions: AssignmentSubmission[] = [];

  const announcements: CourseAnnouncement[] = [
    {
      id: 'ann-ssc-1',
      courseId: 'crs-frpb-ssc',
      title: 'Weekly Model Test Schedule & Lecture Sheet Update',
      message:
        'Download the updated Right Form of Verbs PDF sheet before Friday 8:00 PM Live Doubt Solving session.',
      pinned: true,
      postedByUserId: 'u-teacher',
      postedByName: 'Mahmudul Hasan',
      createdAt: '2026-03-02T09:00:00.000Z',
    },
  ];

  const certificates: CourseCertificate[] = [];

  const exams: Exam[] = [
    {
      id: 'exm-ssc-grammar',
      title: 'SSC English Grammar Diagnostic Quiz (Public)',
      courseId: 'crs-frpb-ssc',
      category: 'SSC English',
      durationMinutes: 10,
      passPercentage: 50,
      visibility: 'public',
      teacherId: 'u-teacher',
      createdAt: '2026-02-01T10:00:00.000Z',
      questions: [
        {
          id: 'q1',
          prompt: 'It is high time we _____ our study habits before the board exam.',
          options: ['change', 'changed', 'changing', 'will change'],
          correctIndex: 1,
          explanation: '"It is high time + subject" takes the past simple verb (V2) to indicate urgent present action.',
          marks: 2,
        },
        {
          id: 'q2',
          prompt: 'Walk fast lest you _____ miss the morning class at Aloms English Center.',
          options: ['will', 'would', 'should', 'can'],
          correctIndex: 2,
          explanation: '"Lest" is always followed by "should" (or "might") + base verb without "not".',
          marks: 2,
        },
        {
          id: 'q3',
          prompt: 'Neither the teacher nor the students _____ absent yesterday.',
          options: ['was', 'were', 'is', 'has been'],
          correctIndex: 1,
          explanation: 'With "neither...nor", the verb agrees with the nearer subject ("students" -> plural "were").',
          marks: 2,
        },
        {
          id: 'q4',
          prompt: 'He is _____ honest man in our neighborhood.',
          options: ['a', 'an', 'the', 'no article'],
          correctIndex: 1,
          explanation: 'The "h" in "honest" is silent, so it begins with a vowel sound and takes "an".',
          marks: 2,
        },
        {
          id: 'q5',
          prompt: 'No sooner had the bell rung _____ the students entered the hall.',
          options: ['when', 'then', 'than', 'before'],
          correctIndex: 2,
          explanation: 'The correlative pair is "No sooner had ... than".',
          marks: 2,
        },
      ],
    },
    {
      id: 'exm-hsc-modifiers',
      title: 'HSC Modifiers, Prepositions & Connectors Live Test',
      courseId: 'crs-hsc-combo',
      category: 'HSC English',
      durationMinutes: 15,
      passPercentage: 60,
      visibility: 'public',
      teacherId: 'u-teacher',
      createdAt: '2026-02-10T10:00:00.000Z',
      questions: [
        {
          id: 'hq1',
          prompt: 'Bangladesh is famous _____ its hospitality and natural beauty.',
          options: ['with', 'for', 'at', 'by'],
          correctIndex: 1,
          explanation: '"Famous for" is the standard collocation for being well-known because of something.',
          marks: 2,
        },
        {
          id: 'hq2',
          prompt: 'The boy _____ in the front row is my younger brother. (Use participle post-modifier)',
          options: ['sit', 'sat', 'sitting', 'sits'],
          correctIndex: 2,
          explanation: 'A present participle phrase ("sitting in the front row") post-modifies "The boy".',
          marks: 2,
        },
        {
          id: 'hq3',
          prompt: '_____ he worked very hard, he could not finish the essay on time.',
          options: ['Because', 'Although', 'Therefore', 'Unless'],
          correctIndex: 1,
          explanation: '"Although" introduces a contrast between hard work and not finishing on time.',
          marks: 2,
        },
        {
          id: 'hq4',
          prompt: 'She insisted _____ going to the Mirpur campus seminar.',
          options: ['in', 'on', 'to', 'for'],
          correctIndex: 1,
          explanation: 'The verb "insist" takes the preposition "on" followed by a gerund.',
          marks: 2,
        },
      ],
    },
    {
      id: 'exm-ielts-vocab',
      title: 'IELTS Band 8 Academic Vocabulary & Reading Drill',
      courseId: 'crs-ielts-pro',
      category: 'IELTS & Spoken',
      durationMinutes: 12,
      passPercentage: 60,
      visibility: 'course',
      teacherId: 'u-teacher',
      createdAt: '2026-02-14T10:00:00.000Z',
      questions: [
        {
          id: 'iq1',
          prompt: 'Which word is closest in meaning to "ubiquitous" in academic writing?',
          options: ['scarce', 'omnipresent', 'temporary', 'ambiguous'],
          correctIndex: 1,
          explanation: '"Ubiquitous" means present, appearing, or found everywhere (omnipresent).',
          marks: 2,
        },
        {
          id: 'iq2',
          prompt: 'Choose the best formal verb to replace "make smaller" in Task 1:',
          options: ['mitigate', 'diminish', 'exacerbate', 'proliferate'],
          correctIndex: 1,
          explanation: '"Diminish" accurately conveys decreasing or becoming smaller in data descriptions.',
          marks: 2,
        },
        {
          id: 'iq3',
          prompt: 'In IELTS Reading, "NOT GIVEN" means:',
          options: [
            'The statement directly contradicts the passage',
            'There is insufficient information in the passage to confirm or deny the claim',
            'The keyword appears in the final paragraph',
            'The author agrees partially',
          ],
          correctIndex: 1,
          explanation: 'NOT GIVEN applies when the passage does not contain information verifying or contradicting the statement.',
          marks: 2,
        },
      ],
    },
  ];

  const examAttempts: ExamAttempt[] = [
    {
      id: 'att-seed-1',
      examId: 'exm-ssc-grammar',
      examTitle: 'SSC English Grammar Diagnostic Quiz (Public)',
      userId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      branchId: 'br-mirpur',
      score: 10,
      totalMarks: 10,
      percentage: 100,
      grade: 'A+',
      passed: true,
      answers: { q1: 1, q2: 2, q3: 1, q4: 1, q5: 2 },
      submittedAt: '2026-03-01T14:20:00.000Z',
    },
    {
      id: 'att-seed-2',
      examId: 'exm-hsc-modifiers',
      examTitle: 'HSC Modifiers, Prepositions & Connectors Live Test',
      userId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      branchId: 'br-mirpur',
      score: 6,
      totalMarks: 8,
      percentage: 75,
      grade: 'A',
      passed: true,
      answers: { hq1: 1, hq2: 2, hq3: 1, hq4: 0 },
      submittedAt: '2026-03-04T16:10:00.000Z',
    },
  ];

  const products: Product[] = [
    {
      id: 'prd-1',
      title: 'AEC English Grammar Masterbook (SSC & HSC)',
      category: 'Books',
      price: 490,
      originalPrice: 690,
      stock: 120,
      image: '/src/assets/images/course_english_books_1795411661325.jpg',
      description: '420-page hardcover grammar & freehand writing manual with bilingual Bangla-English explanations.',
    },
    {
      id: 'prd-2',
      title: 'AEC Customize Premium Water Flask (Matte Black)',
      category: 'Merchandise',
      price: 799,
      originalPrice: 999,
      stock: 48,
      image: '/src/assets/images/course_english_books_1795411661325.jpg',
      description: 'Double-wall stainless steel insulated flask laser-engraved with the Aloms English Center emblem.',
    },
    {
      id: 'prd-3',
      title: 'AEC IELTS Band 8+ Vocabulary & Cue Card Kit',
      category: 'Study Kits',
      price: 650,
      originalPrice: 900,
      stock: 85,
      image: '/src/assets/images/course_english_books_1795411661325.jpg',
      description: 'Printed flashcards + Writing Task 2 Band 8 sample booklet.',
    },
    {
      id: 'prd-4',
      title: 'AEC Varsity & Academic Premium Hoodie',
      category: 'Merchandise',
      price: 990,
      originalPrice: 1850,
      stock: 0,
      image: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
      description: '360 GSM fleece hoodie in deep teal with embroidered AEC crest.',
    },
  ];

  const ebooks: Ebook[] = [
    {
      id: 'ebk-1',
      title: 'SSC 2026-27 English 2nd Paper Final Suggestion',
      level: 'SSC 27',
      isFree: true,
      price: 0,
      originalPrice: 0,
      author: 'Alomgir Hossain',
      pagesCount: 48,
      pdfUrl: '',
      fileSize: '2.4 MB',
      salesCount: 38,
      status: 'active',
      coverImage: '/src/assets/images/course_english_books_1795411661325.jpg',
      summary: 'Complete suggestion covering Paragraph, Formal Letter, Email, CV, Composition, and 150 Board Grammar MCQs.',
      sampleContent: [
        'Chapter 1: High-Probability Paragraphs — Load Shedding, Tree Plantation, Smart Bangladesh, Climate Change, Metro Rail.',
        'Chapter 2: Formal Application Format — Notice how Date, Salutation, and Subject line align cleanly to the left margin for full board marks.',
        'Chapter 3: Top 30 Completing Sentence Structures with Bengali meaning and board year tags.',
      ],
    },
    {
      id: 'ebk-2',
      title: 'HSC English 1st Paper Flow Chart & Summary ShortNote',
      level: 'HSC 27',
      isFree: false,
      price: 99,
      originalPrice: 150,
      author: 'Mahmudul Hasan',
      pagesCount: 72,
      pdfUrl: '',
      fileSize: '4.1 MB',
      salesCount: 112,
      status: 'active',
      coverImage: '/src/assets/images/course_english_books_1795411661325.jpg',
      summary: 'অধ্যায়ভিত্তিক প্রতিটি টেক্সটের বাংলা অনুবাদ, গুরুত্বপূর্ণ Vocabulary, Flow Chart এবং Summary লেখার শর্টকাট ফর্মুলা।',
      sampleContent: [
        'Unit 1: People or Institutions Making History — Key Nelson Mandela & Bangabandhu speech vocabulary.',
        'Flow Chart Rule 1: Always start every box with the same grammatical form (e.g., Verb+ing or To+Verb) matching the given first box.',
        'Summary Rule: Write within 1/3rd length of the passage without copying full sentences verbatim.',
      ],
    },
    {
      id: 'ebk-3',
      title: 'Daily Spoken English 100 Essential Sentence Patterns',
      level: 'IELTS',
      isFree: true,
      price: 0,
      originalPrice: 0,
      author: 'Sabrina Karim',
      pagesCount: 36,
      pdfUrl: '',
      fileSize: '1.8 MB',
      salesCount: 64,
      status: 'active',
      coverImage: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
      summary: 'প্রাত্যহিক কথা বলার জন্য সবচেয়ে বেশি ব্যবহৃত ১০০টি ইংরেজি স্ট্রাকচার ও বাংলা অর্থসহ উদাহরণ।',
      sampleContent: [
        'Pattern 01: "It takes + time + to + verb" — It takes 20 minutes to reach Mirpur campus.',
        'Pattern 02: "I am looking forward to + Verb-ing" — I am looking forward to meeting you tomorrow.',
        'Pattern 03: "Would you mind + Verb-ing?" — Polite requests in formal and everyday English.',
      ],
    },
    {
      id: 'ebk-4',
      title: 'Class 9-10 Grammar & Punctuation Pocket Guide',
      level: 'Class 9',
      isFree: false,
      price: 99,
      originalPrice: 150,
      author: 'Aloms English Center Academic Team',
      pagesCount: 64,
      pdfUrl: '',
      fileSize: '3.2 MB',
      salesCount: 79,
      status: 'active',
      coverImage: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
      summary: 'Voice, Narration, Tag Questions, Connectors, এবং Punctuation-এর কমপ্লিট পকেট রিভিশন গাইড।',
      sampleContent: [
        'Tag Question Exceptions: Let us -> shall we?, Let me/him -> will you?, Everybody/Nobody -> plural pronoun "they".',
        'Connectors Quick Map: Contrast (However, Yet), Addition (Moreover, Furthermore), Result (Consequently, Thus).',
      ],
    },
  ];

  const enrollments: Enrollment[] = [
    {
      id: 'enr-1',
      userId: 'u-student',
      studentName: 'Arafat Rahman',
      studentEmail: 'student@alomsenglish.com',
      courseId: 'crs-frpb-ssc',
      courseTitle: 'Final Revision Premium Batch for SSC-27 (English 1st & 2nd)',
      branchId: 'br-mirpur',
      paymentMethod: 'bKash',
      amountPaid: 2490,
      status: 'approved',
      completedLessonIds: ['les-1'],
      enrolledAt: '2026-02-05T11:00:00.000Z',
    },
    {
      id: 'enr-2',
      userId: 'u-student',
      studentName: 'Arafat Rahman',
      studentEmail: 'student@alomsenglish.com',
      courseId: 'crs-hsc-combo',
      courseTitle: 'HSC 27-28 English 1st & 2nd Paper + Spoken Combo',
      branchId: 'br-mirpur',
      paymentMethod: 'Branch Cash',
      amountPaid: 3490,
      status: 'pending',
      completedLessonIds: [],
      enrolledAt: '2026-03-06T09:30:00.000Z',
    },
    {
      id: 'enr-3',
      userId: 'u-student-2',
      studentName: 'Farhana Yasmin',
      studentEmail: 'farhana@alomsenglish.com',
      courseId: 'crs-ielts-pro',
      courseTitle: 'IELTS Academic & GT Complete Band 8.0 Mastery',
      branchId: 'br-uttara',
      paymentMethod: 'Nagad',
      amountPaid: 4990,
      status: 'approved',
      completedLessonIds: ['les-6'],
      enrolledAt: '2026-02-18T15:00:00.000Z',
    },
  ];

  const orders: Order[] = [
    {
      id: 'ord-1001',
      userId: 'u-student',
      customerName: 'Arafat Rahman',
      phone: '01710000004',
      deliveryAddress: 'Mirpur 10, Dhaka',
      branchPickupId: 'br-mirpur',
      items: [
        {
          productId: 'prd-1',
          title: 'AEC English Grammar Masterbook (SSC & HSC)',
          quantity: 1,
          unitPrice: 490,
        },
      ],
      deliveryFee: 0,
      totalAmount: 490,
      status: 'delivered',
      createdAt: '2026-02-12T10:15:00.000Z',
    },
  ];

  const coupons: Coupon[] = [
    { code: 'AEC20', discountPercent: 20, active: true, description: '20% Launch Offer' },
    { code: 'ALOMS10', discountPercent: 10, active: true, description: '10% Student Discount' },
  ];

  const reviews: Review[] = [
    {
      id: 'rev-1',
      name: 'Tasannun Tarin',
      roleLabel: 'Verified Student · SSC Batch',
      text: 'আলম স্যার একটা গ্রামার রুল বোঝানোর মাধ্যমে দশটা বোর্ড প্রশ্ন সলভ করার টেকনিক দেখিয়ে দেন। পরীক্ষায় হুবহু কমন আসে!',
      rating: 5,
      row: 1,
    },
    {
      id: 'rev-2',
      name: 'Shamim Shohan',
      roleLabel: 'Verified Student · HSC 27',
      text: 'Before joining Aloms English Center, I struggled with Modifiers and Connectors. Now I score 56+ out of 60 in English 2nd Paper.',
      rating: 5,
      row: 1,
    },
    {
      id: 'rev-3',
      name: 'Mubina Khanom',
      roleLabel: 'Verified Student · Spoken',
      text: 'আলহামদুলিল্লাহ, Spoken English ও Phonetics ক্লাস করার পর আমার কথা বলার জড়তা একদম কেটে গেছে।',
      rating: 5,
      row: 1,
    },
    {
      id: 'rev-4',
      name: 'Borhan Uddin Shifat',
      roleLabel: 'Verified Student · IELTS',
      text: 'IELTS Writing Task 2-তে আগে 5.5 পেতাম, আলমস ইংলিশ সেন্টারের ফিডব্যাক ক্লাসের পর মক টেস্টে 7.5 পেয়েছি।',
      rating: 5,
      row: 2,
    },
    {
      id: 'rev-5',
      name: 'Afrina Jahan',
      roleLabel: 'Verified Student · Grammar Pro',
      text: 'বেসিক থেকে শুরু করে সব CQ, MCQ এবং ফ্রি-হ্যান্ড রাইটিং কভার হয়ে যায়। এক কথায় সেরা প্ল্যাটফর্ম!',
      rating: 5,
      row: 2,
    },
    {
      id: 'rev-6',
      name: 'Kamrul Hasan',
      roleLabel: 'Guardian · Mirpur Branch',
      text: 'গার্ডিয়ান পোর্টাল থেকে আমার ছেলের পরীক্ষার রেজাল্ট, ক্লাস প্রোগ্রেস আর ফি স্ট্যাটাস ঘরে বসেই দেখতে পারি—দারুণ সিস্টেম!',
      rating: 5,
      row: 2,
    },
  ];

  const results: CenterResultRecord[] = [
    {
      rollNumber: 'AEC-2026-101',
      studentName: 'Arafat Rahman',
      batchName: 'SSC-27 Final Revision Batch',
      branchName: 'Mirpur DOHS Main Campus',
      examName: 'Grand English Model Test 01',
      mcqScore: 28,
      writtenScore: 64,
      totalScore: 92,
      maxScore: 100,
      gpaOrGrade: 'A+ (5.00)',
      meritPosition: 3,
      status: 'Distinction',
    },
    {
      rollNumber: 'AEC-2026-102',
      studentName: 'Farhana Yasmin',
      batchName: 'IELTS Band 8.0 Mastery',
      branchName: 'Uttara Sector 7 Campus',
      examName: 'Full Mock Assessment 02',
      mcqScore: 36,
      writtenScore: 51,
      totalScore: 87,
      maxScore: 100,
      gpaOrGrade: 'Band 8.0',
      meritPosition: 1,
      status: 'Distinction',
    },
  ];

  const ext = createExtendedSeedCollections();
  const homepageConfig = createDefaultHomepageConfig();

  const settings: SiteSettings = {
    brandName: 'Aloms English Center',
    tagline: 'Master Academic English, Spoken Fluency & IELTS with Confidence',
    logoUrl: '/images/aec-logo.png',
    faviconUrl: '/images/aec-logo.png',
    primaryColor: '#062436',
    accentColor: '#f59e0b',
    whiteLabelDomain: 'portal.alomsenglish.com',
    language: 'en',
    phone: '09617331133',
    email: 'info@alomsenglishcenter.com',
    whatsappNumber: '8801710000001',
    address: 'House 42, Road 6/A, Avenue 8, Mirpur DOHS, Dhaka',
    licenseNo: 'TRAD/DNCC/058412/2026',
    aboutMission:
      'Aloms English Center is a premier online and multi-branch English learning platform delivering structured SSC, HSC, Spoken English, Grammar, and IELTS programs led by experienced educators across Bangladesh.',
    footerCopyright: '© 2026 Aloms English Center. All Rights Reserved.',
    footerLinks: ext.footerLinks,
    headerMenu: DEFAULT_HEADER_MENU.map((m) => ({ ...m })),
    socialLinks: {
      youtube: 'https://www.youtube.com',
      facebook: 'https://www.facebook.com',
      linkedin: 'https://www.linkedin.com',
    },
    customPages: ext.customPages,
    heroSlides: [
      {
        id: 'slide-1',
        badge: 'AEC 27',
        title: 'FINAL REVISION PREMIUM BATCH',
        subtitle: 'SSC & HSC English 1st + 2nd Paper (Complete Syllabus)',
        ctaText: 'Explore SSC Batch',
        courseSlug: 'ssc-english-final-revision',
        image: '/src/assets/images/hero_ielts_batch_1795411661577.jpg',
        gradient: 'from-fuchsia-800/85 via-purple-900/70 to-slate-950/90',
        active: true,
      },
      {
        id: 'slide-2',
        badge: 'IELTS 8.0',
        title: 'IELTS ACADEMIC & SPOKEN PRO',
        subtitle: 'Live Writing Evaluation + 1-on-1 Speaking Mock Tests',
        ctaText: 'View IELTS Program',
        courseSlug: 'ielts-band-8-pro',
        image: '/src/assets/images/hero_spoken_grammar_1795411660470.jpg',
        gradient: 'from-emerald-900/85 via-teal-900/70 to-slate-950/90',
        active: true,
      },
      {
        id: 'slide-3',
        badge: 'HSC 27-28',
        title: 'ENGLISH BASIC TO PRO COMBO',
        subtitle: 'Grammar, Freehand Writing, Flow Charts & Weekly Exams',
        ctaText: 'Join HSC Combo',
        courseSlug: 'hsc-english-complete-combo',
        image: '/src/assets/images/hero_hsc_english_1795411661478.jpg',
        gradient: 'from-cyan-900/85 via-sky-950/75 to-slate-950/90',
        active: true,
      },
    ],
    homepageConfig,
    dashboardConfig: normalizeDashboardConfig(DEFAULT_DASHBOARD_CONFIG),
  };

  const normalizedReviews = reviews.map((r) => ({
    ...r,
    status: r.status ?? ('approved' as const),
    verified: r.verified ?? true,
    featured: r.featured ?? r.row === 1,
  }));

  const normalizedCoupons = coupons.map((c) => ({
    ...c,
    appliesTo: c.appliesTo ?? ('all' as const),
  }));

  const academic = createDefaultAcademicCollections();

  return {
    settings,
    branches,
    branchStatusHistory: [],
    users,
    revokedLegacyAccounts: [],
    instructors,
    academicYears: academic.academicYears,
    academicClasses: academic.academicClasses,
    academicSubjects: academic.academicSubjects,
    courseRoutines: academic.courseRoutines,
    studentAdmissions: academic.studentAdmissions,
    courses,
    batches,
    batchWaitlists: [],
    batchTransfers: [],
    batchNotifications: [
      {
        id: 'bnot-seed-1',
        batchId: 'bat-ssc-mpr-1',
        courseId: 'crs-frpb-ssc',
        type: 'batch_start',
        title: 'SSC-27 Mirpur Evening Batch A — Class Routine Published',
        message: 'Sun · Tue · Thu at 4:30 PM (Mirpur DOHS Room 201 + Online Hybrid). Please bring Grammar Practice Sheet 01.',
        channel: 'in_app',
        readByUserIds: [],
        createdBy: 'Alomgir Hossain',
        createdAt: '2026-04-04T09:00:00.000Z',
      },
    ],
    batchActivityLogs: [
      {
        id: 'blog-seed-1',
        batchId: 'bat-ssc-mpr-1',
        actorId: 'u-admin',
        actorName: 'Alomgir Hossain',
        actorRole: 'admin',
        action: 'BATCH_INITIALIZED',
        details: 'Hybrid schedule & classroom Room 201 configured for SSC-27 Mirpur Evening Batch A.',
        createdAt: '2026-04-01T10:00:00.000Z',
      },
    ],
    modules,
    chapters,
    lessons,
    lessonProgress: [],
    assignments,
    assignmentSubmissions,
    announcements,
    certificates,
    exams,
    examSessionTimers: [],
    examAttempts,
    questionBank: ext.questionBank,
    products,
    ebooks,
    categories: ext.categories,
    posts: ext.posts,
    scormPackages: ext.scormPackages,
    scormAttempts: ext.scormAttempts,
    rewardsByUser: ext.rewardsByUser,
    attendance: ext.attendance,
    attendanceCorrections: [],
    payrolls: ext.payrolls,
    financialRecords: ext.financialRecords,
    feeInvoices: academic.feeInvoices,
    paymentGateways: ext.paymentGateways,
    paymentSessions: [],
    transactions: ext.transactions,
    enrollments,
    orders,
    coupons: normalizedCoupons,
    reviews: normalizedReviews,
    results,
    claimedEbooksByUser: {
      'u-student': ['ebk-1', 'ebk-3'],
    },
    contactMessages: [],
    integrations: createDefaultIntegrations(),
    communicationLogs: [],
    inAppNotifications: [],
    backups: [],
    recycleBin: [],
    auditLogs: ext.auditLogs,
    campaigns: ext.campaigns,
    plugins: ext.plugins,
    webhooks: ext.webhooks,
    mediaAssets: [],
  };
}

export function createDefaultHomepageConfig(): HomepageConfig {
  return {
    featuredCard: {
      badge: 'Online & Branch Course',
      title: 'Online Batches are ongoing!',
      subtitle: 'Book your seat now!',
      ctaText: 'See All Courses',
      ctaLink: '/courses',
      highlights: [
        {
          id: 'fhl-1',
          title: 'Class 9, 10',
          desc: 'SSC English 1st & 2nd Paper Preparation',
          categoryLink: '/courses?cat=SSC%20English',
          iconKey: 'book',
          accentColor: 'emerald',
        },
        {
          id: 'fhl-2',
          title: 'College & IELTS',
          desc: 'HSC English, Spoken & IELTS Band 8 Prep',
          categoryLink: '/courses?cat=HSC%20English',
          iconKey: 'briefcase',
          accentColor: 'amber',
        },
      ],
    },
    statsCard: {
      mode: 'auto',
      badge: 'Trusted Platform',
      title: 'See the stats!',
      subtitle: 'The trust we are building!',
      ctaText: 'See All Courses',
      ctaLink: '/courses',
      customValues: {
        students: 340241,
        courses: 70,
        teachers: 30,
        videos: 6476,
      },
      labels: {
        students: 'Students',
        courses: 'Courses',
        teachers: 'Teachers',
        videos: 'Videos',
      },
    },
    learningPathsSection: {
      heading: 'Choose Your Learning Path',
      subheading:
        'Discover structured English programs across academic boards, university admission, spoken fluency, and IELTS mastery.',
      items: [
        {
          id: 'lp-1',
          title: 'Academic English',
          desc: 'Comprehensive SSC & HSC 1st & 2nd Paper board preparation',
          category: 'SSC English',
          iconKey: 'book',
          accentKey: 'sky',
        },
        {
          id: 'lp-2',
          title: 'Admission Courses',
          desc: 'Specialized English prep for DU, IBA, Medical & GST admissions',
          category: 'Admission',
          iconKey: 'graduation',
          accentKey: 'indigo',
        },
        {
          id: 'lp-3',
          title: 'Spoken & Fluency',
          desc: 'Practical speaking drills, phonetics & presentation mastery',
          category: 'IELTS & Spoken',
          iconKey: 'languages',
          accentKey: 'emerald',
        },
        {
          id: 'lp-4',
          title: 'IELTS Mastery',
          desc: 'Band 8.0 Academic & GT Writing, Reading, Listening & Speaking',
          category: 'IELTS & Spoken',
          iconKey: 'award',
          accentKey: 'amber',
        },
        {
          id: 'lp-5',
          title: 'Grammar Basic to Pro',
          desc: 'Deep conceptual clarity in Tense, Clause, Modifiers & Syntax',
          category: 'Grammar Pro',
          iconKey: 'layers',
          accentKey: 'purple',
        },
        {
          id: 'lp-6',
          title: 'Branch & Community',
          desc: 'Hybrid study across Mirpur, Uttara & Chattogram AEC campuses',
          category: 'All Courses',
          iconKey: 'landmark',
          accentKey: 'teal',
        },
      ],
    },
    reviewsSection: {
      kicker: 'Student Reviews',
      heading: 'What Our Students Say',
      subheading:
        'Feedback from learners and guardians who transformed their English journey with Aloms English Center',
    },
  };
}

let cachedState: DatabaseState | null = null;
let cachedSqlitePath: string | null = null;

export function getDb(): DatabaseState {
  const currentTarget = process.env.SQLITE_DB_PATH || 'default';
  if (cachedState && cachedSqlitePath === currentTarget) return cachedState;
  cachedState = loadOrInitializeDatabase(createInitialState);
  cachedSqlitePath = currentTarget;
  return cachedState;
}

export function saveDb(state: DatabaseState): void {
  cachedState = state;
  cachedSqlitePath = process.env.SQLITE_DB_PATH || 'default';
  persistStateToSqlite(state);
}

export function resetDbToDefaults(): DatabaseState {
  const fresh = createInitialState();
  saveDb(fresh);
  return fresh;
}

const auditEventBus = new EventEmitter();
auditEventBus.setMaxListeners(100);

export function subscribeAuditLogs(listener: (entry: AuditLogEntry) => void): () => void {
  auditEventBus.on('audit_log', listener);
  return () => {
    auditEventBus.off('audit_log', listener);
  };
}

export function recordAuditLog(
  db: DatabaseState,
  actor: { id: string; name: string; role: UserRole },
  action: string,
  target: string,
  details: string,
  explicitSeverity?: AuditLogEntry['severity']
): AuditLogEntry {
  const entry = enrichAuditLogEntry({
    id: `audit-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    action,
    target,
    details,
    severity: explicitSeverity,
    createdAt: new Date().toISOString(),
  });
  db.auditLogs.unshift(entry);
  if (db.auditLogs.length > 250) {
    db.auditLogs = db.auditLogs.slice(0, 250);
  }
  auditEventBus.emit('audit_log', entry);
  return entry;
}

export function createVerifiedBackupSnapshot(
  db: DatabaseState,
  actorName: string,
  label: string,
  reason: 'manual' | 'pre_reset' | 'pre_restore'
): BackupSnapshot {
  const clone = { ...db, backups: [] };
  const payloadJson = JSON.stringify(clone);
  const { checksumSha256 } = writeVerifiedDiskBackup(label, payloadJson);
  const snapshot: BackupSnapshot = {
    id: `bkp-${Date.now()}`,
    label,
    reason,
    checksumSha256,
    verified: true,
    createdBy: actorName,
    createdAt: new Date().toISOString(),
    summary: {
      courses: db.courses.length,
      users: db.users.length,
      exams: db.exams.length,
      enrollments: db.enrollments.length,
      reviews: db.reviews.length,
    },
    payloadJson,
  };
  db.backups.unshift(snapshot);
  if (db.backups.length > 15) {
    db.backups = db.backups.slice(0, 15);
  }
  return snapshot;
}

export function verifyBackupSnapshotIntegrity(snapshot: BackupSnapshot): boolean {
  if (!snapshot.payloadJson || !snapshot.checksumSha256) return false;
  const computed = crypto.createHash('sha256').update(snapshot.payloadJson).digest('hex');
  return computed === snapshot.checksumSha256;
}


