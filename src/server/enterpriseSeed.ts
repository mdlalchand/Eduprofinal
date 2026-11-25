import type {
  AppNotification,
  Assignment,
  AssignmentSubmission,
  AutomationWorkflow,
  CertificateTemplate,
  CrmContact,
  CustomRole,
  FlashSaleConfig,
  GuardianTeacherMessage,
  IssuedCertificate,
  LoginHistoryEntry,
  NoticeItem,
  OmnichannelConversation,
  ReferralRecord,
  SaasTenant,
  ScheduledJobRecord,
  SpeakingSubmission,
  StudentFeeInvoice,
  SystemErrorLog,
  UserDashboardLayout,
  WidgetUsageStat,
  WorkflowRunRecord,
} from '../types';

export function createEnterpriseSeedCollections() {
  const customRoles: CustomRole[] = [
    {
      id: 'role-academic-coord',
      name: 'Academic Coordinator',
      description: 'Manages courses, assignments, exams, and certificates without finance access.',
      permissionGroups: ['Dashboard & Analytics', 'Academics & LMS', 'Branches & Operations'],
      permissions: ['dashboard.view', 'courses.manage', 'lessons.manage', 'assignments.manage', 'exams.manage', 'certificates.manage'],
      createdAt: '2026-01-10T09:00:00.000Z',
    },
    {
      id: 'role-branch-cashier',
      name: 'Branch Cash Officer',
      description: 'Collects admission/batch fees, issues receipts, and views fee ledgers.',
      permissionGroups: ['Dashboard & Analytics', 'Finance & Payroll'],
      permissions: ['dashboard.view', 'fees.collect', 'payments.verify'],
      createdAt: '2026-01-12T09:00:00.000Z',
    },
  ];

  const loginHistory: LoginHistoryEntry[] = [
    {
      id: 'lh-1',
      userId: 'u-admin',
      userName: 'Alomgir Hossain',
      email: 'admin@alomsenglish.com',
      role: 'admin',
      status: 'success',
      ip: '103.145.22.18',
      userAgent: 'Chrome 132 / Windows 11',
      createdAt: '2026-11-23T08:15:00.000Z',
    },
    {
      id: 'lh-2',
      userId: 'u-teacher',
      userName: 'Mahmudul Hasan',
      email: 'teacher@alomsenglish.com',
      role: 'teacher',
      status: 'success',
      ip: '103.145.22.44',
      userAgent: 'Safari / macOS',
      createdAt: '2026-11-23T09:05:00.000Z',
    },
    {
      id: 'lh-3',
      userId: 'u-student',
      userName: 'Arafat Rahman',
      email: 'student@alomsenglish.com',
      role: 'student',
      status: 'success',
      ip: '27.147.180.92',
      userAgent: 'Android Chrome Mobile',
      createdAt: '2026-11-23T09:42:00.000Z',
    },
  ];

  const assignments: Assignment[] = [
    {
      id: 'asg-1',
      courseId: 'crs-hsc-combo',
      courseTitle: 'HSC 27-28 English 1st & 2nd Paper + Spoken Combo',
      batchId: 'bat-hsc-utr-1',
      branchId: 'br-mirpur',
      teacherId: 'u-teacher',
      teacherName: 'Mahmudul Hasan',
      title: 'Paragraph & Flow Chart Drill: Dream & Adolescence',
      instructions: 'Write a 150-word formal paragraph on "Role of Youth in Digital Literacy" and attach your scanned worksheet or PDF if available.',
      dueDate: '2026-12-15T23:59:00.000Z',
      maxMarks: 20,
      allowLateSubmission: true,
      createdAt: '2026-11-18T10:00:00.000Z',
    },
    {
      id: 'asg-2',
      courseId: 'crs-ielts-pro',
      courseTitle: 'IELTS Academic & GT Complete Band 8.0 Mastery',
      batchId: null,
      branchId: 'br-mirpur',
      teacherId: 'u-teacher',
      teacherName: 'Sabrina Karim',
      title: 'IELTS Writing Task 2: Technology in Education',
      instructions: 'Submit a 250-word opinion essay addressing both advantages and potential drawbacks of AI-assisted language classrooms.',
      dueDate: '2026-12-20T23:59:00.000Z',
      maxMarks: 25,
      allowLateSubmission: false,
      createdAt: '2026-11-20T11:30:00.000Z',
    },
  ];

  const assignmentSubmissions: AssignmentSubmission[] = [
    {
      id: 'sub-1',
      assignmentId: 'asg-1',
      studentId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      branchId: 'br-mirpur',
      answerText: 'Youth plays a decisive role in bridging digital literacy gaps through peer mentoring, community ICT clubs, and structured bilingual English communication...',
      attachmentName: 'arafat-flowchart-drill.txt',
      status: 'graded',
      marks: 18,
      feedback: 'Excellent topic sentence and coherent transitions. Review subject-verb agreement in paragraph 2.',
      gradedBy: 'Mahmudul Hasan',
      submittedAt: '2026-11-19T16:20:00.000Z',
      gradedAt: '2026-11-20T10:00:00.000Z',
    },
  ];

  const speakingSubmissions: SpeakingSubmission[] = [
    {
      id: 'spk-1',
      courseId: 'crs-spoken-fluency',
      lessonId: 'les-phonetics-1',
      lessonTitle: 'Phonetics Lab: /θ/ vs /ð/ & Connected Speech',
      studentId: 'u-student',
      studentName: 'Arafat Rahman',
      branchId: 'br-mirpur',
      promptText: 'Read aloud: "Think carefully before choosing whether these phonetic rhythms sound natural in everyday conversation."',
      audioDataUrl: '',
      durationSec: 14,
      status: 'reviewed',
      pronunciationScore: 86,
      fluencyScore: 84,
      teacherFeedback: 'Clear /θ/ articulation on "think". Work slightly on linking "whether these" smoothly.',
      reviewedBy: 'Sabrina Karim',
      createdAt: '2026-11-21T14:00:00.000Z',
      reviewedAt: '2026-11-22T09:30:00.000Z',
    },
  ];

  const feeInvoices: StudentFeeInvoice[] = [
    {
      id: 'fee-1',
      invoiceNo: 'FEE-AEC-2026-101',
      studentId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      branchId: 'br-mirpur',
      courseId: 'crs-hsc-combo',
      batchId: 'bat-hsc-utr-1',
      feeType: 'course',
      title: 'HSC 27-28 English 1st & 2nd Paper + Spoken Combo — Term Fee',
      grossAmount: 4500,
      discountAmount: 500,
      scholarshipAmount: 500,
      lateFee: 0,
      paidAmount: 2500,
      dueDate: '2026-12-30',
      status: 'partial',
      installments: [
        {
          id: 'inst-fee-1',
          amount: 2500,
          gateway: 'bKash',
          trxId: 'BKX9021451',
          receiptNo: 'RCPT-1001',
          paidAt: '2026-11-05T11:00:00.000Z',
          recordedBy: 'Tariqul Islam',
        },
      ],
      createdAt: '2026-11-01T09:00:00.000Z',
    },
    {
      id: 'fee-2',
      invoiceNo: 'FEE-AEC-2026-102',
      studentId: 'u-student-2',
      studentName: 'Farhana Yasmin',
      rollNumber: 'AEC-2026-102',
      branchId: 'br-uttara',
      courseId: 'crs-frpb-ssc',
      feeType: 'admission',
      title: 'SSC Admission + Study Kit Fee',
      grossAmount: 3500,
      discountAmount: 0,
      scholarshipAmount: 0,
      lateFee: 0,
      paidAmount: 3500,
      dueDate: '2026-11-20',
      status: 'paid',
      installments: [
        {
          id: 'inst-fee-2',
          amount: 3500,
          gateway: 'Nagad',
          trxId: 'NGD5542108',
          receiptNo: 'RCPT-1002',
          paidAt: '2026-11-10T15:20:00.000Z',
          recordedBy: 'System Checkout',
        },
      ],
      createdAt: '2026-11-10T15:00:00.000Z',
    },
  ];

  const certificateTemplates: CertificateTemplate[] = [
    {
      id: 'tpl-classic-navy',
      name: 'AEC Gold & Navy Honors',
      headerTitle: 'Certificate of Academic Achievement',
      subtitle: 'Awarded for successful mastery and assessment completion at Aloms English Center',
      signatoryName: 'Alomgir Hossain',
      signatoryTitle: 'Founder & Chief Academic Mentor',
      accentColor: '#062436',
    },
  ];

  const certificates: IssuedCertificate[] = [
    {
      id: 'cert-1',
      certificateNumber: 'AEC-CERT-2026-0001',
      studentId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      courseId: 'crs-frpb-ssc',
      courseTitle: 'SSC 2027 Final Revision Premium Batch',
      branchName: 'Mirpur DOHS Main Campus',
      grade: 'A+',
      templateId: 'tpl-classic-navy',
      revoked: false,
      issuedBy: 'Alomgir Hossain',
      issuedAt: '2026-11-18T12:00:00.000Z',
    },
  ];

  const notifications: AppNotification[] = [
    {
      id: 'notif-1',
      title: 'Assignment Graded',
      message: 'Mahmudul Hasan graded your Paragraph & Flow Chart Drill (18/20).',
      category: 'assignment',
      targetUserId: 'u-student',
      targetRole: 'student',
      targetBranchId: 'br-mirpur',
      readByUserIds: [],
      createdAt: '2026-11-20T10:05:00.000Z',
    },
    {
      id: 'notif-2',
      title: 'Partial Fee Installment Due',
      message: 'Remaining balance of ৳1,000 for HSC English Mastery is due on 2026-12-30.',
      category: 'payment',
      targetRole: 'all',
      targetBranchId: 'br-mirpur',
      readByUserIds: [],
      createdAt: '2026-11-22T09:00:00.000Z',
    },
  ];

  const notices: NoticeItem[] = [
    {
      id: 'not-1',
      title: 'HSC 2027 Model Test & Phonetics Workshop Schedule',
      body: 'All Mirpur and Uttara batch learners are invited to attend the Friday Phonetics & Speaking Lab at 3:00 PM (Room 402 & Zoom Live).',
      targetRole: 'all',
      branchId: null,
      pinned: true,
      createdBy: 'Alomgir Hossain',
      createdAt: '2026-11-21T08:00:00.000Z',
    },
    {
      id: 'not-2',
      title: 'Guardian Parent-Teacher Progress Meet',
      body: 'Guardians can review monthly attendance, exam merit ranks, and communicate directly with batch mentors from the Guardian Portal.',
      targetRole: 'guardian',
      branchId: 'br-mirpur',
      pinned: false,
      createdBy: 'Tariqul Islam',
      createdAt: '2026-11-22T10:30:00.000Z',
    },
  ];

  const guardianMessages: GuardianTeacherMessage[] = [
    {
      id: 'gtm-1',
      guardianId: 'u-guardian',
      guardianName: 'Kamrul Hasan (Guardian)',
      studentId: 'u-student',
      studentName: 'Arafat Rahman',
      teacherId: 'u-teacher',
      teacherName: 'Mahmudul Hasan',
      senderId: 'u-guardian',
      senderRole: 'guardian',
      message: 'Assalamu Alaikum Sir, how is Arafat performing in HSC 2nd Paper Grammar drills this week?',
      createdAt: '2026-11-21T18:00:00.000Z',
    },
    {
      id: 'gtm-2',
      guardianId: 'u-guardian',
      guardianName: 'Kamrul Hasan (Guardian)',
      studentId: 'u-student',
      studentName: 'Arafat Rahman',
      teacherId: 'u-teacher',
      teacherName: 'Mahmudul Hasan',
      senderId: 'u-teacher',
      senderRole: 'teacher',
      message: 'Walaikum Assalam! Arafat scored 18/20 on his latest writing drill and maintains 96% attendance.',
      createdAt: '2026-11-21T19:15:00.000Z',
    },
  ];

  const saasTenants: SaasTenant[] = [
    {
      id: 'ten-aec-main',
      name: 'Aloms English Center (Flagship)',
      slug: 'aloms-main',
      customDomain: 'learn.alomsenglishcenter.com',
      plan: 'Enterprise',
      ownerEmail: 'admin@alomsenglish.com',
      primaryColor: '#062436',
      logoUrl: '/images/aec-logo.png',
      status: 'active',
      activeUsersCount: 2450,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'ten-ctg-partner',
      name: 'Chattogram Academic Hub',
      slug: 'ctg-hub',
      customDomain: 'ctg.alomsenglishcenter.com',
      plan: 'Growth',
      ownerEmail: 'ctg@alomsenglish.com',
      primaryColor: '#0f766e',
      logoUrl: '/images/aec-logo.png',
      status: 'active',
      activeUsersCount: 760,
      createdAt: '2026-02-15T00:00:00.000Z',
    },
  ];

  const workflows: AutomationWorkflow[] = [
    {
      id: 'wf-1',
      name: 'Instant Welcome & Invoice Receipt on Enrollment',
      trigger: 'enrollment.created',
      channel: 'WhatsApp',
      templateMessage: 'Welcome to Aloms English Center! Your batch seat and invoice {{invoiceNo}} are confirmed.',
      active: true,
      validated: true,
      runsCount: 42,
      lastRunAt: '2026-11-22T14:00:00.000Z',
    },
    {
      id: 'wf-2',
      name: 'Guardian Alert on Late Assignment or Absence',
      trigger: 'assignment.late',
      channel: 'SMS',
      templateMessage: 'Notice: Student {{studentName}} submitted assignment {{title}} after deadline.',
      active: true,
      validated: true,
      runsCount: 11,
      lastRunAt: '2026-11-21T19:00:00.000Z',
    },
  ];

  const workflowRuns: WorkflowRunRecord[] = [
    {
      id: 'wfr-1',
      workflowId: 'wf-1',
      workflowName: 'Instant Welcome & Invoice Receipt on Enrollment',
      status: 'completed',
      summary: 'Dispatched WhatsApp confirmation to Arafat Rahman (INV-AEC-1001).',
      executedAt: '2026-11-22T14:00:00.000Z',
    },
  ];

  const crmContacts: CrmContact[] = [
    {
      id: 'crm-1',
      name: 'Nadia Sultana',
      phone: '01755889911',
      email: 'nadia.hsc27@gmail.com',
      source: 'Web Form',
      stage: 'Demo Booked',
      branchId: 'br-mirpur',
      createdAt: '2026-11-21T12:00:00.000Z',
    },
    {
      id: 'crm-2',
      name: 'Tanvir Ahmed',
      phone: '01844223399',
      email: 'tanvir.ielts@gmail.com',
      source: 'Referral',
      stage: 'New Lead',
      branchId: 'br-uttara',
      createdAt: '2026-11-22T16:40:00.000Z',
    },
  ];

  const omnichannelConversations: OmnichannelConversation[] = [
    {
      id: 'conv-1',
      contactId: 'crm-1',
      contactName: 'Nadia Sultana',
      channel: 'WhatsApp',
      status: 'open',
      assignedTo: 'Tariqul Islam',
      updatedAt: '2026-11-22T17:10:00.000Z',
      messages: [
        {
          id: 'msg-1',
          sender: 'contact',
          text: 'Hello! Can I join the Mirpur HSC 27 batch offline and also get recorded backup classes?',
          sentAt: '2026-11-22T17:05:00.000Z',
        },
        {
          id: 'msg-2',
          sender: 'agent',
          text: 'Yes! All Mirpur offline batches include full HD recorded backup videos and PDF sheets.',
          sentAt: '2026-11-22T17:10:00.000Z',
        },
      ],
    },
  ];

  const referrals: ReferralRecord[] = [
    {
      id: 'ref-1',
      referrerUserId: 'u-student',
      referrerName: 'Arafat Rahman',
      referralCode: 'AEC-ARAFAT10',
      referredUserName: 'Farhana Yasmin',
      referredUserEmail: 'farhana@alomsenglish.com',
      orderOrCourseTitle: 'SSC English A+ Masterplan',
      rewardAmount: 250,
      status: 'credited',
      createdAt: '2026-11-12T10:00:00.000Z',
    },
  ];

  const flashSale: FlashSaleConfig = {
    active: true,
    title: 'Winter Admission Flash Sale — Extra 15% Off Selected Bundles',
    discountPercent: 15,
    endsAt: '2026-12-31T23:59:59.000Z',
  };

  const errorLogs: SystemErrorLog[] = [
    {
      id: 'err-1',
      level: 'info',
      source: 'BootCheck',
      message: 'All database collections, RBAC policies, and payment gateway adapters initialized cleanly.',
      createdAt: '2026-11-23T00:00:00.000Z',
    },
  ];

  const scheduledJobs: ScheduledJobRecord[] = [
    {
      id: 'job-backup-nightly',
      name: 'Verified SHA-256 Snapshot Check',
      schedule: '0 2 * * *',
      lastRunAt: '2026-11-23T02:00:00.000Z',
      status: 'healthy',
      description: 'Validates JSON datastore checksums and prunes expired session tokens.',
    },
    {
      id: 'job-fee-overdue',
      name: 'Student Installment Due & Reminder Sync',
      schedule: '0 8 * * *',
      lastRunAt: '2026-11-23T08:00:00.000Z',
      status: 'healthy',
      description: 'Flags overdue fee invoices and queues automated guardian notifications.',
    },
    {
      id: 'job-webhook-retry',
      name: 'Webhook Delivery Queue Dispatcher',
      schedule: '*/15 * * * *',
      lastRunAt: '2026-11-23T09:15:00.000Z',
      status: 'healthy',
      description: 'Retries pending webhook deliveries with HMAC-SHA256 signatures.',
    },
  ];

  const dashboardLayoutsByUser: Record<string, UserDashboardLayout> = {};
  const widgetUsageStats: Record<string, WidgetUsageStat> = {
    'w-kpi-metrics': { widgetId: 'w-kpi-metrics', views: 124, interactions: 38, lastUsedAt: '2026-11-23T09:00:00.000Z' },
    'w-revenue-analytics': { widgetId: 'w-revenue-analytics', views: 89, interactions: 27, lastUsedAt: '2026-11-23T09:00:00.000Z' },
    'w-quick-actions': { widgetId: 'w-quick-actions', views: 95, interactions: 54, lastUsedAt: '2026-11-23T09:00:00.000Z' },
  };

  return {
    customRoles,
    loginHistory,
    assignments,
    assignmentSubmissions,
    speakingSubmissions,
    feeInvoices,
    certificateTemplates,
    certificates,
    notifications,
    notices,
    guardianMessages,
    saasTenants,
    workflows,
    workflowRuns,
    crmContacts,
    omnichannelConversations,
    referrals,
    flashSale,
    errorLogs,
    scheduledJobs,
    dashboardLayoutsByUser,
    widgetUsageStats,
  };
}
