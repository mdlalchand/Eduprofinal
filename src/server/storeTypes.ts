import type {
  AcademicClassSection,
  AcademicSubject,
  AcademicYear,
  ApiPlugin,
  AssignmentSubmission,
  AttendanceCorrectionEntry,
  AttendanceRecord,
  AuditLogEntry,
  BackupSnapshot,
  BatchActivityLog,
  BatchNotification,
  BatchTransferRecord,
  BatchWaitlistEntry,
  Branch,
  BranchStatusHistoryEntry,
  BroadcastCampaign,
  CategoryItem,
  CenterResultRecord,
  CommunicationLogEntry,
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
  CourseRoutineItem,
  Ebook,
  Enrollment,
  Exam,
  ExamAttempt,
  FeeInvoice,
  FinancialRecord,
  InAppNotification,
  Instructor,
  IntegrationConfig,
  LearnerRewardProfile,
  LessonProgressRecord,
  MediaAsset,
  Order,
  PaymentGatewayConfig,
  PaymentSessionRecord,
  PaymentTransaction,
  PayrollRecord,
  Product,
  QuestionBankItem,
  RecycleBinItem,
  Review,
  RevokedLegacyAccount,
  ScormAttempt,
  ScormPackage,
  SiteSettings,
  StudentAdmissionRecord,
  User,
  WebhookConfig,
} from '../types';

export interface StoredUser extends User {
  passwordHash: string;
  passwordUpdatedAt?: string | null;
  twoFactorSecret?: string | null;
  twoFactorRecoveryHashes?: string[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string;
  branchId: string;
  message: string;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
}

export interface ExamSessionTimer {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string | null;
}

export interface DatabaseState {
  settings: SiteSettings;
  branches: Branch[];
  branchStatusHistory: BranchStatusHistoryEntry[];
  users: StoredUser[];
  revokedLegacyAccounts: RevokedLegacyAccount[];
  instructors: Instructor[];
  academicYears: AcademicYear[];
  academicClasses: AcademicClassSection[];
  academicSubjects: AcademicSubject[];
  courseRoutines: CourseRoutineItem[];
  studentAdmissions: StudentAdmissionRecord[];
  courses: Course[];
  batches: CourseBatch[];
  batchWaitlists: BatchWaitlistEntry[];
  batchTransfers: BatchTransferRecord[];
  batchNotifications: BatchNotification[];
  batchActivityLogs: BatchActivityLog[];
  modules: CourseModule[];
  chapters: CourseChapter[];
  lessons: CourseLesson[];
  lessonProgress: LessonProgressRecord[];
  assignments: CourseAssignment[];
  assignmentSubmissions: AssignmentSubmission[];
  announcements: CourseAnnouncement[];
  certificates: CourseCertificate[];
  exams: Exam[];
  examSessionTimers: ExamSessionTimer[];
  examAttempts: ExamAttempt[];
  questionBank: QuestionBankItem[];
  products: Product[];
  ebooks: Ebook[];
  categories: CategoryItem[];
  posts: CommunityPost[];
  scormPackages: ScormPackage[];
  scormAttempts: ScormAttempt[];
  rewardsByUser: Record<string, LearnerRewardProfile>;
  attendance: AttendanceRecord[];
  attendanceCorrections: AttendanceCorrectionEntry[];
  payrolls: PayrollRecord[];
  financialRecords: FinancialRecord[];
  feeInvoices: FeeInvoice[];
  paymentGateways: PaymentGatewayConfig[];
  paymentSessions: PaymentSessionRecord[];
  transactions: PaymentTransaction[];
  enrollments: Enrollment[];
  orders: Order[];
  coupons: Coupon[];
  reviews: Review[];
  results: CenterResultRecord[];
  claimedEbooksByUser: Record<string, string[]>;
  contactMessages: ContactMessage[];
  integrations: IntegrationConfig[];
  communicationLogs: CommunicationLogEntry[];
  inAppNotifications: InAppNotification[];
  backups: BackupSnapshot[];
  recycleBin: RecycleBinItem[];
  auditLogs: AuditLogEntry[];
  campaigns: BroadcastCampaign[];
  plugins: ApiPlugin[];
  webhooks: WebhookConfig[];
  mediaAssets: MediaAsset[];
}
