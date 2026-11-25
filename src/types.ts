export type UserRole = 'admin' | 'teacher' | 'student' | 'guardian' | 'branch';

export type UserAccountStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export type BranchStatus = 'active' | 'inactive' | 'suspended' | 'archived';

export interface Branch {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  phone: string;
  managerName: string;
  activeStudents: number;
  status: BranchStatus;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

export interface BranchStatusHistoryEntry {
  id: string;
  branchId: string;
  branchName: string;
  previousStatus: BranchStatus;
  newStatus: BranchStatus;
  reason: string;
  actorId: string;
  actorName: string;
  createdAt: string;
}

export interface RevokedLegacyAccount {
  id: string;
  originalUserId: string;
  name: string;
  email: string;
  previousRole: string;
  branchId: string | null;
  reason: string;
  revokedAt: string;
}

export interface MediaAsset {
  id: string;
  filename: string;
  url: string;
  originalName: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  sizeBytes: number;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedByRole: UserRole;
  category: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  branchId: string | null;
  rollNumber?: string;
  guardianLinkedStudentIds?: string[];
  avatar?: string;
  status?: UserAccountStatus;
  bio?: string;
  subjectSpecialty?: string;
  education?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvalNote?: string;
  mustResetPassword?: boolean;
  twoFactorEnabled?: boolean;
  communicationConsent?: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  lastLoginAt?: string;
  createdAt: string;
}

export interface Instructor {
  id: string;
  userId?: string;
  name: string;
  subject: string;
  roleTitle: string;
  education: string;
  panel: 'Head Faculty' | 'Branch Faculty';
  branchId: string;
  bio: string;
  avatar: string;
  youtubeUrl?: string;
  facebookUrl?: string;
}

export type LessonType =
  | 'recorded'
  | 'video'
  | 'text'
  | 'audio'
  | 'lecture_sheet'
  | 'pdf_notes'
  | 'document'
  | 'external'
  | 'quiz'
  | 'assignment'
  | 'live'
  | 'practice_test';

export type LiveClassStatus = 'scheduled' | 'live_now' | 'ended';

export type CourseStatus = 'draft' | 'published' | 'active' | 'unpublished' | 'archived';
export type CourseLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseDeliveryType = 'Offline' | 'Online' | 'Hybrid';
export type CourseVisibility = 'public' | 'unlisted' | 'private';
export type EnrollmentAvailability = 'open' | 'closed' | 'upcoming';

export interface CourseResource {
  id: string;
  title: string;
  url: string;
  kind: 'pdf' | 'document' | 'audio' | 'external' | 'slides';
  fileSize?: string;
}

export interface CourseModule {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  orderIndex: number;
  status?: 'draft' | 'published';
}

export interface CourseChapter {
  id: string;
  courseId: string;
  moduleId: string;
  title: string;
  orderIndex: number;
}

export type BatchLifecycleStatus =
  | 'draft'
  | 'upcoming'
  | 'enrollment_open'
  | 'enrollment_closed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type BatchWeekDay = 'Sat' | 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';

export interface BatchTeacherAssignment {
  instructorId: string;
  role: 'main' | 'assistant' | 'co_teacher';
  responsibility: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface BatchTeacherHistoryEntry {
  id: string;
  instructorId: string;
  instructorName: string;
  role: 'main' | 'assistant' | 'co_teacher';
  action: 'assigned' | 'role_changed' | 'removed';
  note: string;
  actorName: string;
  at: string;
}

export interface BatchScheduleSlot {
  id: string;
  title?: string;
  dayOfWeek: BatchWeekDay;
  startTime: string; // HH:MM (24h, e.g. "16:30")
  endTime: string;   // HH:MM (24h, e.g. "18:00")
  durationMinutes: number;
  breakMinutes?: number;
  instructorId?: string;
  roomLabel?: string;
  sessionDate?: string; // Optional specific date override YYYY-MM-DD
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  rescheduledFrom?: string;
  cancelReason?: string;
  topic?: string;
}

export interface BatchClassroomSettings {
  classroomName?: string;
  building?: string;
  floor?: string;
  roomNumber?: string;
}

export interface BatchOnlineSettings {
  platform?: 'Zoom' | 'Google Meet' | 'Microsoft Teams' | 'Alom Live' | string;
  meetingLink?: string;
  meetingId?: string;
  meetingPassword?: string;
  instructions?: string;
  credentialsProtected?: boolean;
}

export interface BatchFeeSettings {
  admissionFee?: number;
  monthlyFee?: number;
  courseFeeOverride?: number | null;
  installmentEnabled?: boolean;
  installmentOptions?: string;
  paymentDeadline?: string;
  latePaymentPolicy?: string;
  batchDiscountPercent?: number;
}

export interface BatchWaitlistEntry {
  id: string;
  batchId: string;
  courseId: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  phone?: string;
  priority: number;
  status: 'waiting' | 'promoted' | 'cancelled';
  note?: string;
  createdAt: string;
}

export interface BatchTransferRecord {
  id: string;
  enrollmentId: string;
  studentUserId: string;
  studentName: string;
  fromBatchId: string | null;
  fromBatchName: string;
  toBatchId: string;
  toBatchName: string;
  fromCourseId: string;
  toCourseId: string;
  reason: string;
  preservedAttendanceCount: number;
  preservedPaymentCount: number;
  actorName: string;
  transferredAt: string;
}

export interface BatchNotification {
  id: string;
  batchId: string;
  courseId: string;
  type:
    | 'enrollment'
    | 'batch_start'
    | 'upcoming_class'
    | 'schedule_change'
    | 'teacher_change'
    | 'class_cancelled'
    | 'exam_announcement'
    | 'payment_reminder'
    | 'batch_completed';
  title: string;
  message: string;
  recipientUserIds?: string[];
  channel: 'in_app' | 'email_sms_ready';
  readByUserIds?: string[];
  createdBy: string;
  createdAt: string;
}

export interface BatchActivityLog {
  id: string;
  batchId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  createdAt: string;
}

export interface CourseBatch {
  id: string;
  courseId: string;
  name: string;
  code: string;
  description?: string;
  thumbnail?: string;
  branchId: string;
  instructorId: string;
  assistantInstructorId?: string | null;
  teacherAssignments?: BatchTeacherAssignment[];
  teacherAssignmentHistory?: BatchTeacherHistoryEntry[];
  schedule: string;
  schedules?: BatchScheduleSlot[];
  classDurationMinutes?: number;
  breakMinutes?: number;
  weeklyFrequency?: number;
  totalClasses?: number;
  classroomOrMeeting?: string;
  classroom?: BatchClassroomSettings;
  onlineSettings?: BatchOnlineSettings;
  feeSettings?: BatchFeeSettings;
  startDate: string;
  endDate?: string;
  enrollmentStartDate?: string;
  enrollmentClosingDate?: string;
  enrollmentDeadline?: string;
  seatLimit: number;
  minStudents?: number;
  enrolledSeats: number;
  waitlistEnabled?: boolean;
  mode: 'Online Live' | 'Offline Branch' | 'Hybrid';
  batchType?: 'Offline' | 'Online' | 'Hybrid';
  status: 'open' | 'running' | 'closed';
  lifecycleStatus?: BatchLifecycleStatus;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseLesson {
  id: string;
  courseId: string;
  moduleId?: string;
  chapterId?: string;
  batchId?: string | null;
  batchName?: string;
  lessonType: LessonType;
  title: string;
  moduleName: string;
  chapterName?: string;
  duration: string;
  videoPreviewTitle: string;
  videoUrl: string;
  audioUrl?: string;
  textContent?: string;
  lectureSheetUrl?: string;
  externalUrl?: string;
  resources?: CourseResource[];
  linkedExamId?: string;
  linkedAssignmentId?: string;
  liveJoinUrl?: string;
  liveStatus?: LiveClassStatus;
  scheduledAt?: string;
  sheetSummary: string;
  isFreePreview: boolean;
  completionRequired?: boolean;
  sequentialLock?: boolean;
  status?: 'draft' | 'published';
  orderIndex: number;
}

export interface CertificateCriteria {
  enabled: boolean;
  minProgressPercent: number;
  requireExamPass: boolean;
  minExamPercent?: number;
  requireAssignmentCompletion: boolean;
}

export interface CourseSeoConfig {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  robotsIndex?: boolean;
  noIndex?: boolean;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  levelTag: string;
  level?: CourseLevel;
  language?: string;
  tags?: string[];
  isCombo: boolean;
  includedCourses?: string[];
  price: number;
  originalPrice: number;
  admissionFee?: number;
  isFree?: boolean;
  installmentEnabled?: boolean;
  installmentCount?: number;
  installmentOptions?: string;
  paymentPolicy?: string;
  couponEligible?: boolean;
  enrolledCount: number;
  examSystemIncluded: boolean;
  branchIds: string[];
  instructorIds: string[];
  createdByUserId?: string;
  thumbnail: string;
  bannerImage?: string;
  description: string;
  highlights: string[];
  prerequisites?: string[];
  learningOutcomes?: string[];
  targetAudience?: string[];
  demoVideoTitle: string;
  demoYoutubeUrl: string;
  courseType?: CourseDeliveryType;
  durationLabel?: string;
  totalClasses?: number;
  estimatedHours?: number;
  maxCapacity?: number;
  minEnrollment?: number;
  startDate?: string;
  endDate?: string;
  enrollmentStartDate?: string;
  enrollmentDeadline?: string;
  status: CourseStatus;
  featured?: boolean;
  visibility?: CourseVisibility;
  enrollmentAvailability?: EnrollmentAvailability;
  sequentialAccess?: boolean;
  certificateCriteria?: CertificateCriteria;
  seo?: CourseSeoConfig;
  sourcePostId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  batchId?: string | null;
  lessonId?: string;
  title: string;
  instructions: string;
  maxMarks: number;
  dueDate?: string;
  attachmentUrl?: string;
  createdByUserId: string;
  createdByName?: string;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  courseId: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  answerText?: string;
  submissionText?: string;
  attachmentUrl?: string;
  marks?: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'resubmit_requested';
  gradedBy?: string;
  gradedAt?: string;
  submittedAt: string;
}

export interface CourseAnnouncement {
  id: string;
  courseId: string;
  batchId?: string | null;
  title: string;
  message: string;
  pinned?: boolean;
  postedByUserId?: string;
  postedByName?: string;
  authorId?: string;
  authorName?: string;
  authorRole?: UserRole;
  createdAt: string;
}

export interface CourseCertificate {
  id: string;
  certificateNumber: string;
  certificateNo?: string;
  courseId: string;
  courseTitle: string;
  courseSlug?: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  rollNumber?: string;
  completionPercent: number;
  progressPercent?: number;
  examScorePercent?: number;
  instructorName?: string;
  issuedAt: string;
  issuedBy?: string;
  revoked?: boolean;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  marks: number;
  subject?: string;
  chapter?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  type?: 'mcq' | 'true_false' | 'written';
  questionType?: 'mcq' | 'true_false' | 'written';
}

export interface QuestionBankItem extends ExamQuestion {
  subject: string;
  chapter: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  type: 'mcq' | 'true_false' | 'written';
  createdAt: string;
}

export interface Exam {
  id: string;
  title: string;
  courseId: string | null;
  batchId?: string | null;
  category: string;
  durationMinutes: number;
  passPercentage: number;
  negativeMarkPerWrong?: number;
  examType?: 'mcq' | 'written' | 'mixed';
  visibility: 'public' | 'course';
  teacherId: string;
  questions: ExamQuestion[];
  createdAt: string;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  examTitle: string;
  userId: string;
  studentName: string;
  rollNumber: string;
  branchId: string | null;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  answers: Record<string, number>;
  writtenAnswers?: Record<string, string>;
  writtenScores?: Record<string, number>;
  gradingStatus?: 'auto_graded' | 'pending_manual' | 'graded';
  startedAt?: string;
  durationSecondsTaken?: number;
  teacherFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
  submittedAt: string;
}

export interface Product {
  id: string;
  title: string;
  category: 'Books' | 'Merchandise' | 'Study Kits' | string;
  price: number;
  originalPrice: number;
  stock: number;
  image: string;
  description: string;
}

export interface Ebook {
  id: string;
  title: string;
  level: 'HSC 27' | 'HSC 28' | 'SSC 26' | 'SSC 27' | 'IELTS' | 'Class 9' | string;
  isFree: boolean;
  price: number;
  originalPrice: number;
  author: string;
  pagesCount: number;
  pdfUrl?: string;
  fileSize?: string;
  salesCount?: number;
  status?: 'active' | 'draft';
  coverImage?: string;
  summary: string;
  sampleContent: string[];
}

export type PaymentGatewayType =
  | 'bKash'
  | 'Nagad'
  | 'Rocket'
  | 'SSLCommerz Card'
  | 'Manual Bank Transfer'
  | 'Branch Cash';

export type PaymentProviderType =
  | 'mobile_wallet'
  | 'card_gateway'
  | 'bank_transfer'
  | 'cash_desk';

export interface PaymentGatewayConfig {
  id: string;
  code: PaymentGatewayType | string;
  name: string;
  subtitle: string;
  providerType: PaymentProviderType;
  merchantAccount: string;
  instructions: string;
  mode: 'sandbox' | 'live';
  feePercent: number;
  apiKeyMasked: string;
  webhookSecretMasked: string;
  active: boolean;
  sortOrder: number;
}

export interface PublicPaymentGateway {
  id: string;
  code: string;
  name: string;
  subtitle: string;
  providerType: PaymentProviderType;
  merchantAccount: string;
  instructions: string;
  mode: 'sandbox' | 'live';
  feePercent: number;
  active: boolean;
  sortOrder: number;
}

export interface EnrollmentHistoryEntry {
  id?: string;
  at?: string;
  createdAt?: string;
  action: string;
  actorName: string;
  note: string;
}

export interface Enrollment {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  branchId: string;
  batchId?: string | null;
  batchName?: string;
  paymentMethod: PaymentGatewayType | 'Card';
  trxId?: string;
  invoiceNo?: string;
  amountPaid: number;
  refundAmount?: number;
  refundReason?: string;
  couponUsed?: string;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled' | 'transferred' | 'expired';
  expiresAt?: string | null;
  completedLessonIds: string[];
  history?: EnrollmentHistoryEntry[];
  enrolledAt: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  branchPickupId: string | null;
  items: { productId: string; title: string; quantity: number; unitPrice: number }[];
  deliveryFee: number;
  discountAmount?: number;
  couponUsed?: string;
  paymentMethod?: PaymentGatewayType;
  trxId?: string;
  invoiceNo?: string;
  totalAmount: number;
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
}

export interface Coupon {
  code: string;
  discountPercent: number;
  active: boolean;
  appliesTo?: 'all' | 'courses' | 'products';
  description: string;
}

export interface Review {
  id: string;
  courseId?: string;
  userId?: string;
  name: string;
  roleLabel: string;
  text: string;
  rating: number;
  row: 1 | 2;
  status?: 'approved' | 'pending' | 'hidden';
  featured?: boolean;
  courseTag?: string;
  avatar?: string;
  verified?: boolean;
  createdAt?: string;
}

export interface HeroSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaText: string;
  courseSlug: string;
  image: string;
  gradient: string;
  active?: boolean;
}

export type HighlightIconKey =
  | 'book'
  | 'briefcase'
  | 'award'
  | 'graduation'
  | 'languages'
  | 'layers'
  | 'landmark';

export type HighlightAccentKey = 'emerald' | 'amber' | 'sky' | 'indigo' | 'purple' | 'teal';

export interface FeaturedHighlightItem {
  id: string;
  title: string;
  desc: string;
  categoryLink: string;
  iconKey: HighlightIconKey;
  accentColor: HighlightAccentKey;
}

export interface LearningPathHighlight {
  id: string;
  title: string;
  desc: string;
  category: string;
  iconKey: HighlightIconKey;
  accentKey: HighlightAccentKey;
  image?: string;
}

export interface HomepageConfig {
  featuredCard: {
    badge: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    highlights: FeaturedHighlightItem[];
  };
  statsCard: {
    mode: 'auto' | 'custom';
    badge: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    customValues: {
      students: number;
      courses: number;
      teachers: number;
      videos: number;
    };
    labels: {
      students: string;
      courses: string;
      teachers: string;
      videos: string;
    };
  };
  learningPathsSection: {
    heading: string;
    subheading: string;
    items: LearningPathHighlight[];
  };
  reviewsSection: {
    kicker: string;
    heading: string;
    subheading: string;
  };
}

export interface CenterResultRecord {
  id?: string;
  rollNumber: string;
  studentName: string;
  batchName: string;
  branchName: string;
  examName: string;
  mcqScore: number;
  writtenScore: number;
  totalScore: number;
  maxScore: number;
  gpaOrGrade: string;
  meritPosition: number;
  status: 'Passed' | 'Distinction';
  publishedAt?: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  type: 'course' | 'product' | 'ebook' | 'post';
  description: string;
  image?: string;
  active: boolean;
}

export interface CommunityComment {
  id: string;
  authorName: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  title: string;
  category: string;
  content: string;
  image?: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  likes: number;
  likedByUserIds: string[];
  comments: CommunityComment[];
  status: 'published' | 'draft';
  createdAt: string;
}

export interface ScormPackage {
  id: string;
  courseId: string;
  title: string;
  version: '1.2';
  identifier: string;
  launchFile: string;
  manifestXml: string;
  htmlContent: string;
  maxScore: number;
  xpReward: number;
  createdAt: string;
}

export interface ScormAttempt {
  id: string;
  packageId: string;
  userId: string;
  lessonStatus: 'not attempted' | 'incomplete' | 'completed' | 'passed' | 'failed';
  scoreRaw: number;
  sessionTime: string;
  suspendData: string;
  updatedAt: string;
}

export interface LearnerRewardProfile {
  userId: string;
  studentName: string;
  branchId: string | null;
  xp: number;
  streakDays: number;
  badges: string[];
  showOnLeaderboard: boolean;
  completedScormIds: string[];
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  targetType: 'student' | 'teacher' | 'staff';
  targetId: string;
  targetName: string;
  branchId: string | null;
  batchId?: string | null;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'excused';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  recordedBy: string;
  correctionHistory?: Array<{
    id: string;
    previousStatus: AttendanceRecord['status'];
    newStatus: AttendanceRecord['status'];
    reason: string;
    actorName: string;
    createdAt: string;
  }>;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  role: UserRole | 'legacy_revoked';
  branchId: string | null;
  monthKey: string;
  baseSalary: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  advance: number;
  netSalary: number;
  status: 'pending' | 'approved' | 'paid';
  paidAt?: string;
}

export interface FinancialRecord {
  id: string;
  type: 'income' | 'expense' | 'refund';
  category: string;
  title: string;
  amount: number;
  branchId: string | null;
  date: string;
  recordedBy: string;
}

export interface PaymentTransaction {
  id: string;
  invoiceNo: string;
  referenceType: 'course' | 'order' | 'ebook';
  referenceId: string;
  branchId?: string | null;
  userId: string;
  payerName: string;
  gateway: PaymentGatewayType;
  walletOrLast4: string;
  trxId: string;
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  deliveryFee: number;
  totalAmount: number;
  status: 'completed' | 'pending_verification' | 'refunded';
  createdAt: string;
}

export interface BackupSnapshot {
  id: string;
  label: string;
  reason: 'manual' | 'pre_reset' | 'pre_restore';
  checksumSha256: string;
  verified: boolean;
  createdBy: string;
  createdAt: string;
  summary: {
    courses: number;
    users: number;
    exams: number;
    enrollments: number;
    reviews: number;
  };
  payloadJson?: string;
}

export interface RecycleBinItem {
  id: string;
  entityType:
    | 'course'
    | 'batch'
    | 'lesson'
    | 'exam'
    | 'product'
    | 'ebook'
    | 'review'
    | 'post'
    | 'question'
    | 'instructor'
    | 'category'
    | 'coupon'
    | 'branch'
    | 'payment_gateway'
    | 'plugin'
    | 'enrollment';
  originalId: string;
  label: string;
  deletedBy: string;
  deletedAt: string;
  snapshot: unknown;
}

export type AuditLogCategory = 'login' | 'course' | 'payment' | 'system';
export type AuditLogSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  category?: AuditLogCategory;
  severity?: AuditLogSeverity;
  action: string;
  target: string;
  details: string;
  createdAt: string;
}

export interface BroadcastCampaign {
  id: string;
  title: string;
  channel: 'SMS' | 'Email' | 'WhatsApp' | 'Notice';
  audience: string;
  message: string;
  sentCount: number;
  status: 'sent' | 'scheduled' | 'draft' | 'failed';
  createdAt: string;
}

export interface ApiPlugin {
  id: string;
  name: string;
  category: 'Payment' | 'Live Video' | 'AI' | 'Marketing' | 'LMS Widget' | 'SMS & Messaging';
  version: string;
  active: boolean;
  description: string;
  scopes: string[];
  endpointUrl?: string;
  apiKeyMasked?: string;
  environment?: 'sandbox' | 'production';
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  event: string;
  active: boolean;
  lastStatus?: string;
  secretMasked: string;
}

export interface CustomPage {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  body: string;
  coverImage?: string;
  published: boolean;
}

export interface FooterLinkItem {
  label: string;
  path: string;
}

export interface HeaderMenuItem {
  id: string;
  label: string;
  path: string;
  badge?: string;
  visible: boolean;
  openInNewTab?: boolean;
}

export type AiAgentRole = 'student' | 'teacher' | 'admin' | 'support' | 'learning';

export interface DashboardWidgetVisibility {
  heroBanner: boolean;
  kpiRow: boolean;
  analyticsOverview: boolean;
  courseProgress: boolean;
  liveClassNow: boolean;
  recentActivities: boolean;
  upcomingClasses: boolean;
  topStudents: boolean;
  quickActions: boolean;
  systemActivityLogs?: boolean;
}

export interface DashboardColorConfig {
  workspaceLightBg: string;
  workspaceLightBgEnd: string;
  workspaceDarkBg: string;
  sidebarStart: string;
  sidebarEnd: string;
  activeNavStart: string;
  activeNavEnd: string;
  heroStart: string;
  heroMid: string;
  heroEnd: string;
  heroButtonBg: string;
  heroButtonText: string;
  heroMottoColor: string;
  kpiStudentsStart: string;
  kpiStudentsEnd: string;
  kpiTeachersStart: string;
  kpiTeachersEnd: string;
  kpiCoursesStart: string;
  kpiCoursesEnd: string;
  kpiBatchesStart: string;
  kpiBatchesEnd: string;
  liveCardStart: string;
  liveCardEnd: string;
  chartStudentsColor: string;
  chartEnrollmentsColor: string;
  chartViewsColor: string;
}

export interface DashboardImageConfig {
  brandLogoUrl: string;
  heroAvatarUrl: string;
  heroBannerBgUrl: string;
  sidebarPromoImageUrl: string;
  adminAvatarUrl: string;
  liveClassBannerUrl: string;
}

export interface DashboardCustomizationConfig {
  themeMode: 'futuristic_light' | 'midnight_dark';
  accentPreset: 'electric_blue' | 'emerald_teal' | 'royal_purple' | 'sunset_amber' | 'custom';
  brandTitle: string;
  brandBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroQuote: string;
  heroMottoTop: string;
  heroMottoBottom: string;
  heroCtaLabel: string;
  heroCtaSection: 'courses' | 'enrollments' | 'exams' | 'lessons' | 'catalog_cms';
  sidebarPromoTitle: string;
  sidebarPromoSubtitle: string;
  kpiLabels: {
    students: string;
    teachers: string;
    courses: string;
    batches: string;
  };
  colors: DashboardColorConfig;
  images: DashboardImageConfig;
  widgets: DashboardWidgetVisibility;
}

export interface SiteSettings {
  brandName: string;
  tagline: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  whiteLabelDomain?: string;
  language?: 'en' | 'bn';
  phone: string;
  email: string;
  whatsappNumber: string;
  address: string;
  licenseNo: string;
  aboutMission: string;
  footerCopyright?: string;
  footerLinks?: FooterLinkItem[];
  headerMenu?: HeaderMenuItem[];
  socialLinks?: {
    youtube: string;
    facebook: string;
    linkedin?: string;
  };
  customPages?: CustomPage[];
  heroSlides: HeroSlide[];
  homepageConfig?: HomepageConfig;
  dashboardConfig?: DashboardCustomizationConfig;
  boardResultConfig?: {
    title: string;
    subtitle: string;
    portalHeading: string;
    portalDescription: string;
    eboardUrl: string;
    eboardLabel: string;
    educationBoardUrl: string;
    educationBoardLabel: string;
  };
}

export interface AcademicYear {
  id: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'active' | 'upcoming' | 'archived';
  createdAt: string;
}

export interface AcademicClassSection {
  id: string;
  academicYearId: string;
  branchId: string;
  className: string;
  sectionName: string;
  roomLabel?: string;
  capacity: number;
  classTeacherUserId?: string | null;
  status: 'active' | 'archived';
}

export interface AcademicSubject {
  id: string;
  code: string;
  name: string;
  classLevel: string;
  courseId?: string | null;
  creditsOrMarks: number;
  status: 'active' | 'archived';
}

export interface CourseRoutineItem {
  id: string;
  courseId: string;
  batchId?: string | null;
  branchId: string;
  subjectId?: string | null;
  teacherUserId?: string | null;
  dayOfWeek: BatchWeekDay;
  startTime: string;
  endTime: string;
  roomOrLink: string;
  status: 'active' | 'cancelled';
}

export interface StudentAdmissionRecord {
  id: string;
  admissionNo: string;
  studentUserId: string;
  studentName: string;
  rollNumber: string;
  branchId: string;
  academicYearId: string;
  classSectionId?: string | null;
  guardianName?: string;
  guardianPhone?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  admissionFeePaid: number;
  admissionStatus: 'active' | 'promoted' | 'transferred' | 'completed' | 'suspended';
  admittedAt: string;
}

export interface LessonProgressRecord {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  watchedSeconds: number;
  durationSeconds: number;
  percentWatched: number;
  completed: boolean;
  lastPositionAt: string;
}

export interface AttendanceCorrectionEntry {
  id: string;
  attendanceId: string;
  targetName: string;
  previousStatus: AttendanceRecord['status'];
  newStatus: AttendanceRecord['status'];
  reason: string;
  correctedById: string;
  correctedByName: string;
  correctedAt: string;
}

export interface FeeInvoice {
  id: string;
  invoiceNo: string;
  studentUserId: string;
  studentName: string;
  branchId: string;
  courseId?: string | null;
  batchId?: string | null;
  feeType: 'admission' | 'tuition' | 'installment' | 'exam' | 'ebook';
  title: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  dueDate: string;
  installmentPlanLabel?: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'refunded';
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSessionRecord {
  id: string;
  idempotencyKey: string;
  userId: string;
  referenceType: 'course' | 'order' | 'ebook' | 'invoice';
  referenceId: string;
  branchId: string | null;
  gateway: PaymentGatewayType | string;
  mode: 'sandbox' | 'live';
  amount: number;
  currency: 'BDT';
  status: 'initiated' | 'pending_verification' | 'verified' | 'failed' | 'expired';
  providerPaymentId?: string;
  checkoutUrl?: string;
  trxId?: string;
  webhookVerifiedAt?: string;
  metadataJson?: string;
  createdAt: string;
  expiresAt: string;
}

export type IntegrationCategory =
  | 'Payment'
  | 'SMS'
  | 'Email'
  | 'WhatsApp'
  | 'Google'
  | 'Live Video'
  | 'AI'
  | 'Analytics & Ads'
  | 'Cloud & Storage'
  | 'Webhooks';

export interface IntegrationConfig {
  id: string;
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  enabled: boolean;
  mode: 'sandbox' | 'live';
  configured: boolean;
  healthStatus: 'awaiting_configuration' | 'configured' | 'healthy' | 'error';
  lastTestedAt?: string;
  lastError?: string;
  publicConfig: Record<string, string>;
  secretsMasked: Record<string, string>;
  updatedAt: string;
}

export interface CommunicationLogEntry {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
  provider: string;
  recipient: string;
  recipientUserId?: string;
  subject?: string;
  bodyPreview: string;
  status: 'queued' | 'accepted' | 'delivered' | 'failed' | 'skipped_opt_out';
  providerMessageId?: string;
  errorMessage?: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'payment' | 'exam' | 'live_class' | 'attendance' | 'branch';
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}


