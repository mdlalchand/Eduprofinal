import {
  Activity,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Award,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Flame,
  FolderOpen,
  GraduationCap,
  Heart,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  LogOut,
  Megaphone,
  Package,
  Pencil,
  Play,
  Plug,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Tag,
  Trash2,
  UserCheck,
  Users,
  Video,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { AdminLessonModal } from '../components/AdminLessonModal';
import { BatchDetailWorkspace } from '../components/batches/BatchDetailWorkspace';
import { BatchEnterpriseDashboard } from '../components/batches/BatchEnterpriseDashboard';
import { BatchWizardModal } from '../components/batches/BatchWizardModal';
import { StudentBatchPortal } from '../components/batches/StudentBatchPortal';
import { CertificateModal } from '../components/courses/CertificateModal';
import { CourseEnterpriseDashboard } from '../components/courses/CourseEnterpriseDashboard';
import { CourseWizardModal } from '../components/courses/CourseWizardModal';
import { CurriculumBuilderModal } from '../components/courses/CurriculumBuilderModal';
import { BranchOperationsPanel } from '../components/dashboard/BranchOperationsPanel';
import { DashboardCustomizerModal } from '../components/dashboard/DashboardCustomizerModal';
import { DashboardOverview } from '../components/dashboard/DashboardOverview';
import {
  DashboardSidebar,
  type OverviewSubView,
  type SidebarSubIntent,
} from '../components/dashboard/DashboardSidebar';
import { DashboardTopbar } from '../components/dashboard/DashboardTopbar';
import { type QuickActionType } from '../components/dashboard/DashboardWidgets';
import { EnrollmentsFeePanel } from '../components/dashboard/EnrollmentsFeePanel';
import {
  AcademicOpsPanel,
  FeeInvoicesWidget,
  IntegrationsAndSecurityPanel,
} from '../components/dashboard/EnterpriseOpsPanels';
import { SystemActivityLogsPanel } from '../components/dashboard/SystemActivityLogsPanel';
import {
  ExamSubmissionsModal,
  TeacherRosterPanel,
} from '../components/dashboard/TeacherRosterGradingPanel';
import { UserProfilePanel } from '../components/dashboard/UserProfilePanel';
import { UsersManagementPanel } from '../components/dashboard/UsersManagementPanel';
import { HomepageCmsStudio } from '../components/HomepageCmsStudio';
import { MyStorageModal } from '../components/MyStorageModal';
import { PaymentSystemPanel } from '../components/PaymentSystemPanel';
import {
  AiEcosystemSecurityPanel,
  AttendanceFinancePanel,
  CatalogContentPanel,
  ExamBankPanel,
  SecurityBackupPanel,
} from '../components/PortalOpsStudio';
import { ScormPlayerModal } from '../components/ScormPlayerModal';
import { useAuth } from '../context/AuthContext';
import { isCourseStatusLive } from '../lib/courseEnterprise';
import {
  calculateStudentProgress,
  DEFAULT_DASHBOARD_CONFIG,
  filterLessonsByTypeAndBatch,
  getAllowedPortalSections,
  normalizeDashboardConfig,
  type PortalSection,
} from '../lib/domain';
import type {
  ApiPlugin,
  AssignmentSubmission,
  AttendanceRecord,
  AuditLogEntry,
  Branch,
  BroadcastCampaign,
  CategoryItem,
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
  DashboardCustomizationConfig,
  Ebook,
  Enrollment,
  Exam,
  ExamAttempt,
  FinancialRecord,
  Instructor,
  LearnerRewardProfile,
  LessonType,
  LiveClassStatus,
  Order,
  PaymentGatewayConfig,
  PaymentTransaction,
  PayrollRecord,
  Product,
  QuestionBankItem,
  Review,
  ScormPackage,
  SiteSettings,
  User,
  UserRole,
  WebhookConfig,
} from '../types';

interface PortalPageProps {
  navigate: (path: string) => void;
}

interface GuardianChildData {
  student: User;
  enrollments: Enrollment[];
  examAttempts: ExamAttempt[];
  lessonsCountByCourse: Record<string, number>;
  attendance?: AttendanceRecord[];
  assignments?: CourseAssignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  certificates?: CourseCertificate[];
  orders?: Order[];
  transactions?: PaymentTransaction[];
  rewards?: LearnerRewardProfile | null;
}

interface PortalPayload {
  role: UserRole;
  guardianLinkCode?: string;
  branch?: Branch;
  metrics: Record<string, number>;
  courses?: Course[];
  batches?: CourseBatch[];
  modules?: CourseModule[];
  chapters?: CourseChapter[];
  lessons?: CourseLesson[];
  assignments?: CourseAssignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  announcements?: CourseAnnouncement[];
  certificates?: CourseCertificate[];
  assignedCourseIds?: string[];
  exams?: Exam[];
  examAttempts?: ExamAttempt[];
  branches?: Branch[];
  users?: User[];
  enrollments?: Enrollment[];
  orders?: Order[];
  reviews?: Review[];
  settings?: SiteSettings;
  children?: GuardianChildData[];
  questionBank?: QuestionBankItem[];
  categories?: CategoryItem[];
  posts?: CommunityPost[];
  scormPackages?: ScormPackage[];
  attendance?: AttendanceRecord[];
  payrolls?: PayrollRecord[];
  financialRecords?: FinancialRecord[];
  paymentGateways?: PaymentGatewayConfig[];
  transactions?: PaymentTransaction[];
  coupons?: Coupon[];
  campaigns?: BroadcastCampaign[];
  plugins?: ApiPlugin[];
  webhooks?: WebhookConfig[];
  instructors?: Instructor[];
  products?: Product[];
  ebooks?: Ebook[];
  rewards?: LearnerRewardProfile | null;
  rewardsByUser?: Record<string, LearnerRewardProfile>;
  auditLogs?: AuditLogEntry[];
}

const SECTION_META: Record<PortalSection, { label: string; icon: typeof LayoutDashboard }> = {
  overview: { label: 'Overview', icon: LayoutDashboard },
  courses: { label: 'Courses & Batches', icon: BookOpen },
  lessons: { label: 'Video Lessons', icon: Video },
  homepage_cms: { label: 'Homepage Studio', icon: LayoutTemplate },
  catalog_cms: { label: 'Catalog, Posts & Coupons', icon: Tag },
  exams: { label: 'Exams & Question Bank', icon: ClipboardList },
  payments: { label: 'Payments & Gateways', icon: CreditCard },
  attendance_finance: { label: 'Attendance, Payroll & P&L', icon: Wallet },
  enrollments: { label: 'Enrollments & Fees', icon: UserCheck },
  branches: { label: 'Branches', icon: Building2 },
  academic_ops: { label: 'Academic Ops', icon: BookOpen },
  integrations: { label: 'Integrations & 2FA', icon: Plug },
  users: { label: 'Users & Roles', icon: Users },
  orders: { label: 'Shop Orders', icon: Package },
  ai_ecosystem: { label: 'AI, SCORM & Security', icon: Bot },
  activity_logs: { label: 'System Activity Logs', icon: Activity },
  guardian_monitor: { label: 'Child Progress', icon: GraduationCap },
  my_learning: { label: 'My Courses & Rewards', icon: BookOpen },
  profile: { label: 'My Profile & Security', icon: UserCheck },
  settings: { label: 'Settings, Backups & Export', icon: Settings },
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Main Admin',
  teacher: 'Instructor',
  student: 'Student',
  guardian: 'Guardian',
  branch: 'Branch',
};

export function PortalPage({ navigate }: PortalPageProps) {
  const { user, bootstrap, logout, apiFetch, refreshBootstrap } = useAuth();
  const [data, setData] = useState<PortalPayload | null>(null);
  const [activeSection, setActiveSection] = useState<PortalSection>('overview');
  const [activeSidebarIntent, setActiveSidebarIntent] = useState<SidebarSubIntent>(undefined);
  const [overviewSubView, setOverviewSubView] = useState<OverviewSubView>('lms');
  const [dashboardConfig, setDashboardConfig] = useState<DashboardCustomizationConfig>(
    () => normalizeDashboardConfig(bootstrap?.settings?.dashboardConfig ?? DEFAULT_DASHBOARD_CONFIG)
  );
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => (bootstrap?.settings?.dashboardConfig?.themeMode ?? 'futuristic_light') === 'midnight_dark'
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [dashLang, setDashLang] = useState<'en' | 'bn'>('en');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Admin / Teacher: Advanced Course & Batch Studio state
  const [courseSubTab, setCourseSubTab] = useState<
    'courses' | 'batches' | 'assignments' | 'announcements' | 'certificates'
  >('courses');
  const [catalogInitialTab, setCatalogInitialTab] = useState<
    'ebooks' | 'products' | 'instructors' | 'categories' | 'posts' | 'coupons'
  >('ebooks');
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [wizardTemplateDefaults, setWizardTemplateDefaults] = useState<Partial<Course> | null>(null);
  const [wizardSampleModules, setWizardSampleModules] = useState<string[] | undefined>(undefined);
  const [curriculumCourse, setCurriculumCourse] = useState<Course | null>(null);
  const [previewCert, setPreviewCert] = useState<CourseCertificate | null>(null);

  // Assignments, Grading & Announcements forms
  const [asgCourseId, setAsgCourseId] = useState('');
  const [asgBatchId, setAsgBatchId] = useState('');
  const [asgTitle, setAsgTitle] = useState('');
  const [asgInstructions, setAsgInstructions] = useState('');
  const [asgDueDate, setAsgDueDate] = useState('2026-12-31');
  const [asgMaxMarks, setAsgMaxMarks] = useState('20');
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { marks: string; feedback: string }>>({});

  const [annCourseId, setAnnCourseId] = useState('');
  const [annBatchId, setAnnBatchId] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annPinned, setAnnPinned] = useState(false);

  // Batch Studio state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<CourseBatch | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  // Teacher / Admin: Lecture, Live Class & Recorded Video Studio state
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<CourseLesson | null>(null);
  const [lessonCourseFilter, setLessonCourseFilter] = useState<string>('all');
  const [lessonBatchFilter, setLessonBatchFilter] = useState<string>('all');
  const [lessonTypeFilter, setLessonTypeFilter] = useState<'all' | LessonType>('all');
  const [lessonSearch, setLessonSearch] = useState('');
  const [confirmLessonDeleteId, setConfirmLessonDeleteId] = useState<string | null>(null);

  // Teacher/Admin: New Exam form
  const [examTitle, setExamTitle] = useState('');
  const [examCategory, setExamCategory] = useState('HSC English');
  const [examQPrompt, setExamQPrompt] = useState('');
  const [examOptA, setExamOptA] = useState('');
  const [examOptB, setExamOptB] = useState('');
  const [examOptC, setExamOptC] = useState('');
  const [examOptD, setExamOptD] = useState('');
  const [examCorrect, setExamCorrect] = useState(0);

  // My Storage & Guardian link state
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [guardianLinkInput, setGuardianLinkInput] = useState('');
  const [guardianVerifyInput, setGuardianVerifyInput] = useState('');
  const [guardianLinkError, setGuardianLinkError] = useState<string | null>(null);
  const [guardianLinking, setGuardianLinking] = useState(false);

  // Quick Action target role for Users Studio
  const [uRole, setURole] = useState<UserRole>('teacher');

  // Admin: Settings & Menu shortcut state
  const [setPhone, setSetPhone] = useState('');
  const [setEmail, setSetEmail] = useState('');
  const [setAddress, setSetAddress] = useState('');
  const [activeStudentScorm, setActiveStudentScorm] = useState<ScormPackage | null>(null);
  const [confirmExamDeleteId, setConfirmExamDeleteId] = useState<string | null>(null);
  const [gradingExam, setGradingExam] = useState<Exam | null>(null);
  const [cmsInitialTab, setCmsInitialTab] = useState<'slides' | 'highlights' | 'stats' | 'reviews' | 'branding'>('slides');

  const loadPortal = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch<PortalPayload>('/api/portal/overview');
      setData(res);
      if (res.settings) {
        setSetPhone(res.settings.phone);
        setSetEmail(res.settings.email);
        setSetAddress(res.settings.address);
        if (res.settings.dashboardConfig) {
          const normalized = normalizeDashboardConfig(res.settings.dashboardConfig);
          setDashboardConfig(normalized);
          setDarkMode(normalized.themeMode === 'midnight_dark');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  if (!user) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-[#19212B] px-4 py-12 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-[#2F3B4D] bg-[#232D3B] p-8 text-center shadow-2xl">
          <div className="flex items-center justify-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#1FA894] text-white">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Aloms EDUPro LMS
            </span>
          </div>
          <h1 className="mt-5 text-2xl font-extrabold text-white">
            Authentication Required
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Sign in with your verified Main Admin, Branch, Teacher, Student, or Guardian credentials to access the EDUPro portal.
          </p>

          <div className="mt-6 flex items-center justify-center gap-3 border-t border-[#2F3B4D] pt-5">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="rounded-xl border border-[#344155] px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-[#2C3748]"
            >
              Back to Website
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-slate-900 hover:bg-slate-200"
            >
              <Shield className="h-3.5 w-3.5 text-[#1FA894]" />
              <span>Sign In to Portal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allowedSections = getAllowedPortalSections(user.role);
  const currentSection = allowedSections.includes(activeSection)
    ? activeSection
    : allowedSections[0];

  const notify = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 4000);
  };

  const handleToggleCourseStatus = async (course: Course) => {
    const nextStatus = isCourseStatusLive(course.status) ? 'unpublished' : 'published';
    await apiFetch(`/api/portal/courses/${course.id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await Promise.all([loadPortal(), refreshBootstrap()]);
    notify(`"${course.title}" status updated to ${nextStatus}.`);
  };

  const handleArchiveToggleCourse = async (course: Course) => {
    if (course.status === 'archived') {
      await apiFetch(`/api/portal/courses/${course.id}/restore`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'draft' }),
      });
      notify(`Restored "${course.title}" to Draft.`);
    } else {
      await apiFetch(`/api/portal/courses/${course.id}/archive`, { method: 'PATCH' });
      notify(`Archived "${course.title}".`);
    }
    await Promise.all([loadPortal(), refreshBootstrap()]);
  };

  const handleDuplicateCourse = async (course: Course) => {
    await apiFetch(`/api/portal/courses/${course.id}/duplicate`, {
      method: 'POST',
    });
    await Promise.all([loadPortal(), refreshBootstrap()]);
    notify(`Draft copy created for "${course.title}".`);
  };

  const handleDeleteCourse = async (id: string) => {
    await apiFetch(`/api/portal/courses/${id}`, { method: 'DELETE' });
    await Promise.all([loadPortal(), refreshBootstrap()]);
    notify('Course and its syllabus lessons moved to Recycle Bin.');
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCourseId = asgCourseId || data?.courses?.[0]?.id;
    if (!targetCourseId) return;
    await apiFetch(`/api/portal/courses/${targetCourseId}/assignments`, {
      method: 'POST',
      body: JSON.stringify({
        batchId: asgBatchId || null,
        title: asgTitle.trim(),
        instructions: asgInstructions.trim(),
        dueDate: asgDueDate,
        maxMarks: Number(asgMaxMarks) || 20,
      }),
    });
    setAsgTitle('');
    setAsgInstructions('');
    await loadPortal();
    notify('Course assignment created.');
  };

  const handleDeleteAssignment = async (id: string) => {
    await apiFetch(`/api/portal/assignments/${id}`, { method: 'DELETE' });
    await loadPortal();
    notify('Assignment removed.');
  };

  const handleGradeSubmission = async (sub: AssignmentSubmission) => {
    const draft = gradeDrafts[sub.id];
    const marks = Number(draft?.marks ?? sub.marks ?? 0);
    const feedback = draft?.feedback ?? sub.feedback ?? '';
    await apiFetch(`/api/portal/assignment-submissions/${sub.id}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ marks, feedback }),
    });
    await loadPortal();
    notify(`Graded ${sub.studentName}'s submission (${marks} marks).`);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCourseId = annCourseId || data?.courses?.[0]?.id;
    if (!targetCourseId) return;
    await apiFetch(`/api/portal/courses/${targetCourseId}/announcements`, {
      method: 'POST',
      body: JSON.stringify({
        batchId: annBatchId || null,
        title: annTitle.trim(),
        message: annMessage.trim(),
        pinned: annPinned,
      }),
    });
    setAnnTitle('');
    setAnnMessage('');
    setAnnPinned(false);
    await loadPortal();
    notify('Course announcement published.');
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await apiFetch(`/api/portal/announcements/${id}`, { method: 'DELETE' });
    await loadPortal();
    notify('Announcement deleted.');
  };

  const handleToggleRevokeCertificate = async (cert: CourseCertificate) => {
    await apiFetch(`/api/portal/certificates/${cert.id}/revoke`, {
      method: 'PATCH',
      body: JSON.stringify({ revoked: !cert.revoked }),
    });
    await loadPortal();
    notify(
      cert.revoked
        ? `Reinstated certificate ${cert.certificateNumber}.`
        : `Revoked certificate ${cert.certificateNumber}.`
    );
  };

  const handleToggleLiveStatus = async (lesson: CourseLesson, liveStatus: LiveClassStatus) => {
    await apiFetch(`/api/portal/lessons/${lesson.id}/live-status`, {
      method: 'PATCH',
      body: JSON.stringify({ liveStatus }),
    });
    await loadPortal();
    notify(
      liveStatus === 'live_now'
        ? `"${lesson.title}" is now LIVE NOW.`
        : `"${lesson.title}" live status changed to ${liveStatus}.`
    );
  };

  const handleReorderLesson = async (id: string, direction: 'up' | 'down') => {
    await apiFetch(`/api/portal/lessons/${id}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    });
    await loadPortal();
    notify(`Lecture order moved ${direction}.`);
  };

  const handleDuplicateLesson = async (lesson: CourseLesson) => {
    await apiFetch(`/api/portal/lessons/${lesson.id}/duplicate`, {
      method: 'POST',
    });
    await loadPortal();
    notify(`Cloned "${lesson.title}".`);
  };

  const handleDeleteLesson = async (id: string) => {
    if (confirmLessonDeleteId !== id) {
      setConfirmLessonDeleteId(id);
      return;
    }
    await apiFetch(`/api/portal/lessons/${id}`, { method: 'DELETE' });
    setConfirmLessonDeleteId(null);
    await loadPortal();
    notify('Lecture / Video removed.');
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/portal/exams', {
      method: 'POST',
      body: JSON.stringify({
        title: examTitle,
        category: examCategory,
        durationMinutes: 15,
        visibility: 'public',
        questions: [
          {
            prompt: examQPrompt,
            options: [examOptA, examOptB, examOptC, examOptD],
            correctIndex: examCorrect,
            marks: 2,
          },
        ],
      }),
    });
    setExamTitle('');
    setExamQPrompt('');
    setExamOptA('');
    setExamOptB('');
    setExamOptC('');
    setExamOptD('');
    await loadPortal();
    notify('MCQ Exam created and live.');
  };

  const handleOrderStatus = async (id: string, status: Order['status']) => {
    await apiFetch(`/api/portal/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadPortal();
    notify(`Order updated to ${status}.`);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/portal/settings', {
      method: 'PATCH',
      body: JSON.stringify({ phone: setPhone, email: setEmail, address: setAddress }),
    });
    await Promise.all([loadPortal(), refreshBootstrap()]);
    notify('Center settings saved.');
  };

  const handleLinkGuardianStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianLinkInput.trim()) return;
    if (!guardianVerifyInput.trim()) {
      setGuardianLinkError('Enter the student’s registered phone number or guardian linking code.');
      return;
    }
    setGuardianLinkError(null);
    setGuardianLinking(true);
    try {
      const res = await apiFetch<{ student: User }>('/api/portal/guardian/link-student', {
        method: 'POST',
        body: JSON.stringify({
          query: guardianLinkInput.trim(),
          verification: guardianVerifyInput.trim(),
        }),
      });
      setGuardianLinkInput('');
      setGuardianVerifyInput('');
      await Promise.all([loadPortal(), refreshBootstrap()]);
      notify(`Linked student ${res.student.name} (${res.student.rollNumber || res.student.email})!`);
    } catch (err) {
      setGuardianLinkError(err instanceof Error ? err.message : 'Could not link student.');
    } finally {
      setGuardianLinking(false);
    }
  };

  const handleUnlinkGuardianStudent = async (studentId: string, studentName: string) => {
    await apiFetch(`/api/portal/guardian/link-student/${encodeURIComponent(studentId)}`, {
      method: 'DELETE',
    });
    await Promise.all([loadPortal(), refreshBootstrap()]);
    notify(`Unlinked ${studentName} from guardian monitor.`);
  };

  const pendingApprovalsCount = (data?.enrollments ?? []).filter((e) => e.status === 'pending').length;
  const liveClassesCount = (data?.lessons ?? []).filter((l) => l.liveStatus === 'live_now').length;
  const portalNotifications = [
    ...(pendingApprovalsCount > 0
      ? [
          {
            id: 'notif-pending-enr',
            title: `${pendingApprovalsCount} Pending Enrollment(s)`,
            subtitle: 'Review and approve student payment requests',
            section: 'enrollments' as PortalSection,
          },
        ]
      : []),
    ...(liveClassesCount > 0
      ? [
          {
            id: 'notif-live-classes',
            title: `${liveClassesCount} Live Class(es) Active`,
            subtitle: 'Monitor or launch live video classroom sessions',
            section: 'lessons' as PortalSection,
          },
        ]
      : []),
    {
      id: 'notif-lms-ready',
      title: 'LMS Analytics Synchronized',
      subtitle: 'All branch metrics and recent enrollments are up to date',
      section: 'overview' as PortalSection,
    },
  ];

  const handleSelectOverviewSubView = (subView: OverviewSubView) => {
    setOverviewSubView(subView);
    setActiveSection('overview');
  };

  const handleSectionRoute = (sec: PortalSection, intent?: SidebarSubIntent) => {
    setActiveSection(sec);
    setActiveSidebarIntent(intent);
    if (sec === 'courses') {
      setSelectedBatchId(null);
      if (intent === 'courses' || intent === 'batches') {
        setCourseSubTab(intent);
      }
    }
    if (
      sec === 'catalog_cms' &&
      (intent === 'ebooks' ||
        intent === 'products' ||
        intent === 'posts' ||
        intent === 'categories' ||
        intent === 'coupons')
    ) {
      setCatalogInitialTab(intent);
    }
  };

  const handleQuickAction = (action: QuickActionType) => {
    switch (action) {
      case 'add_student':
        setURole('student');
        handleSectionRoute('users');
        break;
      case 'add_teacher':
        setURole('teacher');
        handleSectionRoute('users');
        break;
      case 'create_batch':
        setEditingBatch(null);
        setBatchModalOpen(true);
        break;
      case 'add_course':
        setEditingCourse(null);
        setWizardTemplateDefaults(null);
        setWizardSampleModules(undefined);
        setCourseModalOpen(true);
        break;
      case 'add_post':
        if (user.role === 'student' || user.role === 'guardian') {
          navigate('/community');
        } else {
          handleSectionRoute('catalog_cms', 'posts');
        }
        break;
      case 'create_category':
        handleSectionRoute('catalog_cms', 'categories');
        break;
      case 'course_from_post':
        handleSectionRoute('catalog_cms', 'posts');
        break;
      case 'add_ebook':
        handleSectionRoute('catalog_cms', 'ebooks');
        break;
      case 'add_product':
        handleSectionRoute('catalog_cms', 'products');
        break;
      case 'take_exam':
        if (user.role === 'student' || user.role === 'guardian') {
          navigate('/exams');
        } else {
          handleSectionRoute('exams');
        }
        break;
      case 'customize':
        setCustomizerOpen(true);
        break;
      case 'open_storage':
        setStorageModalOpen(true);
        break;
      case 'resume_learning':
        navigate('/learn');
        break;
      case 'my_batches':
        handleSectionRoute('my_learning');
        break;
      case 'my_profile':
        handleSectionRoute('profile');
        break;
      case 'child_monitor':
      case 'link_student':
        handleSectionRoute('guardian_monitor');
        break;
      case 'branch_edit':
        handleSectionRoute('branches');
        break;
      case 'branch_finance':
        if (user.role === 'guardian') {
          handleSectionRoute('guardian_monitor');
        } else {
          handleSectionRoute('attendance_finance');
        }
        break;
      case 'mark_attendance':
        handleSectionRoute('attendance_finance');
        break;
      case 'add_lesson':
        if (user.role === 'teacher' || user.role === 'admin') {
          setEditingLesson(null);
          setLessonModalOpen(true);
        } else {
          handleSectionRoute('lessons');
        }
        break;
      case 'grade_scripts':
        handleSectionRoute('exams');
        break;
      case 'student_roster':
      case 'manage_enrollments':
        handleSectionRoute('enrollments');
        break;
    }
  };

  const handleSaveDashboardConfig = async (nextConfig: DashboardCustomizationConfig) => {
    await apiFetch('/api/portal/settings', {
      method: 'PATCH',
      body: JSON.stringify({ dashboardConfig: nextConfig }),
    });
    setDashboardConfig(nextConfig);
    setDarkMode(nextConfig.themeMode === 'midnight_dark');
    await Promise.all([loadPortal(), refreshBootstrap()]);
    notify('Custom Admin Dashboard layout saved!');
  };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div
        style={
          darkMode
            ? { backgroundColor: dashboardConfig.colors.workspaceDarkBg }
            : {
                backgroundImage: `linear-gradient(to bottom right, ${dashboardConfig.colors.workspaceLightBg}, ${dashboardConfig.colors.workspaceLightBgEnd}, ${dashboardConfig.colors.workspaceLightBg})`,
              }
        }
        className={`flex min-h-screen transition-colors ${
          darkMode ? 'text-slate-100' : 'text-slate-900'
        }`}
      >
        {/* Left Navigation Sidebar */}
        <DashboardSidebar
          user={user}
          brandName={bootstrap?.settings.brandName || "Alom's English Center"}
          roleLabel={ROLE_LABELS[user.role]}
          allowedSections={allowedSections}
          currentSection={currentSection}
          activeSubIntent={activeSidebarIntent}
          overviewSubView={overviewSubView}
          accentPreset={dashboardConfig.accentPreset}
          dashboardConfig={dashboardConfig}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileMenuOpen}
          lang={dashLang}
          unreadMessagesCount={pendingApprovalsCount}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
          onCloseMobile={() => setMobileMenuOpen(false)}
          onSelectSection={handleSectionRoute}
          onSelectOverviewSubView={handleSelectOverviewSubView}
          onNavigatePublic={(path) => navigate(path)}
          onLogout={() => {
            logout();
            navigate('/');
          }}
        />

        {/* Right Main Column: Topbar + Workspace + Footer */}
        <div className="flex min-w-0 flex-1 flex-col">
          <DashboardTopbar
            user={user}
            roleLabel={ROLE_LABELS[user.role]}
            searchQuery={dashboardSearch}
            onSearchChange={setDashboardSearch}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((v) => !v)}
            lang={dashLang}
            onToggleLang={() => setDashLang((l) => (l === 'en' ? 'bn' : 'en'))}
            canCustomize={user.role === 'admin'}
            dashboardConfig={dashboardConfig}
            onOpenCustomizer={() => setCustomizerOpen(true)}
            unreadMessagesCount={pendingApprovalsCount}
            notifications={portalNotifications}
            onOpenMobileMenu={() => setMobileMenuOpen(true)}
            onSelectSection={(sec) => handleSectionRoute(sec)}
          />

          <section
            aria-label="Portal Workspace"
            className="min-w-0 flex-1 space-y-6 px-4 py-5 sm:px-6"
          >
            {feedback && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{feedback}</span>
              </div>
            )}

            {currentSection !== 'overview' && (
              <div
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 shadow-xs ${
                  darkMode
                    ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
                    : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
                }`}
              >
                <div>
                  <h1 className="text-base font-extrabold">
                    {currentSection === 'enrollments' && user.role === 'teacher'
                      ? 'Student Coaching Roster'
                      : SECTION_META[currentSection].label}
                  </h1>
                  <p className="text-xs opacity-70">
                    {ROLE_LABELS[user.role]} Workspace · {bootstrap?.settings.brandName || "Alom's English Center"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleSectionRoute('overview');
                    setOverviewSubView('lms');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to LMS Dashboard</span>
                </button>
              </div>
            )}

            {loading && !data ? (
              <div className="rounded-2xl border border-white/60 bg-white/85 p-12 text-center text-sm text-slate-600">
                Loading LMS dashboard workspace...
              </div>
            ) : (
              <>
                {/* OVERVIEW (Futuristic Alom's English Center LMS Dashboard) */}
                {currentSection === 'overview' && data && (
                  <DashboardOverview
                    viewerName={user.name}
                    viewerAvatar={user.avatar}
                    viewerRollNumber={user.rollNumber}
                    data={{
                      ...data,
                      instructors: data.instructors ?? bootstrap?.instructors ?? [],
                      reviews: data.reviews ?? bootstrap?.reviews ?? [],
                      posts: data.posts ?? [],
                    }}
                    auditLogs={data.auditLogs}
                    searchQuery={dashboardSearch}
                    overviewSubView={overviewSubView}
                    lang={dashLang}
                    darkMode={darkMode}
                    canCustomize={user.role === 'admin'}
                    dashboardConfig={dashboardConfig}
                    onSelectSection={handleSectionRoute}
                    onQuickAction={handleQuickAction}
                    onNavigate={navigate}
                  />
                )}

                {/* ADMIN REAL-TIME SYSTEM ACTIVITY LOGS CONSOLE */}
                {currentSection === 'activity_logs' && user.role === 'admin' && data && (
                  <SystemActivityLogsPanel
                    initialLogs={data.auditLogs}
                    darkMode={darkMode}
                  />
                )}

              {/* COURSES & BATCHES MANAGEMENT (Enterprise Course Studio) */}
              {currentSection === 'courses' && data && (() => {
                const allCourses = data.courses ?? [];
                const allBatches = data.batches ?? [];
                const allAssignments = data.assignments ?? [];
                const allSubmissions = data.assignmentSubmissions ?? [];
                const allAnnouncements = data.announcements ?? [];
                const allCertificates = data.certificates ?? [];
                const branchesList = data.branches ?? bootstrap?.branches ?? [];
                const instructorsList = data.instructors ?? bootstrap?.instructors ?? [];

                return (
                  <div className="space-y-6">
                    {/* Sub-Tab Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { id: 'courses', label: `Courses & Analytics (${allCourses.length})`, icon: BookOpen },
                            { id: 'batches', label: `Batches (${allBatches.length})`, icon: Layers },
                            { id: 'assignments', label: `Assignments (${allAssignments.length})`, icon: ClipboardList },
                            { id: 'announcements', label: `Announcements (${allAnnouncements.length})`, icon: Megaphone },
                            { id: 'certificates', label: `Certificates (${allCertificates.length})`, icon: Award },
                          ] as const
                        ).map((tab) => {
                          const Icon = tab.icon;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => {
                                setCourseSubTab(tab.id);
                                if (tab.id !== 'batches') setSelectedBatchId(null);
                              }}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                                courseSubTab === tab.id
                                  ? 'bg-[#062436] text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              <span>{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/courses')}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>View Live /courses</span>
                      </button>
                    </div>

                    {courseSubTab === 'courses' ? (
                      <CourseEnterpriseDashboard
                        courses={allCourses}
                        batches={allBatches}
                        enrollmentsCount={(data.enrollments ?? []).length}
                        instructors={instructorsList}
                        userRole={user.role}
                        darkMode={darkMode}
                        onOpenWizard={(courseObj, tplDefaults, sampleMods) => {
                          setEditingCourse(courseObj);
                          setWizardTemplateDefaults(tplDefaults ?? null);
                          setWizardSampleModules(sampleMods);
                          setCourseModalOpen(true);
                        }}
                        onOpenCurriculum={(courseObj) => setCurriculumCourse(courseObj)}
                        onToggleStatus={handleToggleCourseStatus}
                        onDuplicateCourse={handleDuplicateCourse}
                        onArchiveToggle={handleArchiveToggleCourse}
                        onDeleteCourse={handleDeleteCourse}
                        onNavigate={navigate}
                        onManageCategories={() => handleSectionRoute('catalog_cms', 'categories')}
                        onRefresh={async () => {
                          await Promise.all([loadPortal(), refreshBootstrap()]);
                        }}
                        onNotify={notify}
                      />
                    ) : courseSubTab === 'assignments' ? (
                      <div className="space-y-6">
                        <form
                          onSubmit={handleCreateAssignment}
                          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3"
                        >
                          <h2 className="text-lg font-extrabold text-slate-900">
                            Create Course Assignment
                          </h2>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <select
                              aria-label="Assignment Course"
                              value={asgCourseId || allCourses[0]?.id || ''}
                              onChange={(e) => {
                                setAsgCourseId(e.target.value);
                                setAsgBatchId('');
                              }}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                            >
                              {allCourses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="Assignment Batch"
                              value={asgBatchId}
                              onChange={(e) => setAsgBatchId(e.target.value)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                            >
                              <option value="">All Batches</option>
                              {allBatches
                                .filter((b) => b.courseId === (asgCourseId || allCourses[0]?.id))
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                            </select>
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={asgDueDate}
                                onChange={(e) => setAsgDueDate(e.target.value)}
                                aria-label="Assignment due date"
                                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                              />
                              <input
                                type="number"
                                min={5}
                                max={200}
                                value={asgMaxMarks}
                                onChange={(e) => setAsgMaxMarks(e.target.value)}
                                aria-label="Maximum marks"
                                placeholder="Marks"
                                className="font-mono-tabular w-20 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                              />
                            </div>
                          </div>
                          <input
                            type="text"
                            required
                            value={asgTitle}
                            onChange={(e) => setAsgTitle(e.target.value)}
                            placeholder="Assignment Title (e.g. IELTS Writing Task 2 — Environment Essay)"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                          />
                          <textarea
                            rows={2}
                            required
                            value={asgInstructions}
                            onChange={(e) => setAsgInstructions(e.target.value)}
                            placeholder="Write clear instructions & rubric..."
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                          >
                            Publish Assignment
                          </button>
                        </form>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                            <h3 className="text-base font-extrabold text-slate-900">
                              Published Assignments ({allAssignments.length})
                            </h3>
                            <div className="mt-3 space-y-2.5">
                              {allAssignments.length === 0 ? (
                                <p className="text-xs text-slate-500">No assignments yet.</p>
                              ) : (
                                allAssignments.map((a) => {
                                  const crs = allCourses.find((c) => c.id === a.courseId);
                                  return (
                                    <div
                                      key={a.id}
                                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs"
                                    >
                                      <div>
                                        <p className="font-extrabold text-slate-900">{a.title}</p>
                                        <p className="text-[11px] font-semibold text-indigo-700">
                                          {crs?.title || a.courseId} · Max {a.maxMarks} marks · Due {a.dueDate}
                                        </p>
                                        <p className="mt-1 text-slate-600">{a.instructions}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteAssignment(a.id)}
                                        aria-label={`Delete assignment ${a.title}`}
                                        className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                            <h3 className="text-base font-extrabold text-slate-900">
                              Student Submissions &amp; Grading ({allSubmissions.length})
                            </h3>
                            <div className="mt-3 space-y-3">
                              {allSubmissions.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No student submissions waiting for review.
                                </p>
                              ) : (
                                allSubmissions.map((sub) => {
                                  const asg = allAssignments.find((a) => a.id === sub.assignmentId);
                                  const draft = gradeDrafts[sub.id] ?? {
                                    marks: String(sub.marks ?? asg?.maxMarks ?? 20),
                                    feedback: sub.feedback ?? '',
                                  };
                                  return (
                                    <div
                                      key={sub.id}
                                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <p className="font-extrabold text-slate-900">
                                            {sub.studentName}
                                          </p>
                                          <p className="text-[11px] text-slate-500">
                                            {asg?.title || sub.assignmentId}
                                          </p>
                                        </div>
                                        <span
                                          className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                            sub.status === 'graded'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : 'bg-amber-100 text-amber-800'
                                          }`}
                                        >
                                          {sub.status}
                                        </span>
                                      </div>
                                      <p className="rounded-lg bg-white p-2.5 text-slate-700 border border-slate-200">
                                        {sub.answerText || sub.submissionText || '(Photo/Attachment Submission)'}
                                      </p>
                                      {sub.attachmentUrl && (
                                        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-2">
                                          <img
                                            src={sub.attachmentUrl}
                                            alt={`Homework submission from ${sub.studentName}`}
                                            referrerPolicy="no-referrer"
                                            className="h-14 w-20 rounded-md border border-indigo-200 object-cover"
                                            onError={(e) => {
                                              e.currentTarget.style.display = 'none';
                                            }}
                                          />
                                          <a
                                            href={sub.attachmentUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            <span>Inspect Uploaded Homework Photo</span>
                                          </a>
                                        </div>
                                      )}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <input
                                          type="number"
                                          min={0}
                                          max={asg?.maxMarks ?? 100}
                                          value={draft.marks}
                                          onChange={(e) =>
                                            setGradeDrafts((prev) => ({
                                              ...prev,
                                              [sub.id]: { ...draft, marks: e.target.value },
                                            }))
                                          }
                                          aria-label={`Marks for ${sub.studentName}`}
                                          className="font-mono-tabular w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                                        />
                                        <input
                                          type="text"
                                          value={draft.feedback}
                                          onChange={(e) =>
                                            setGradeDrafts((prev) => ({
                                              ...prev,
                                              [sub.id]: { ...draft, feedback: e.target.value },
                                            }))
                                          }
                                          placeholder="Teacher feedback..."
                                          className="min-w-[160px] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleGradeSubmission(sub)}
                                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                                        >
                                          Save Grade
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : courseSubTab === 'announcements' ? (
                      <div className="space-y-6">
                        <form
                          onSubmit={handleCreateAnnouncement}
                          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3"
                        >
                          <h2 className="text-lg font-extrabold text-slate-900">
                            Publish Course Announcement
                          </h2>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <select
                              aria-label="Announcement Course"
                              value={annCourseId || allCourses[0]?.id || ''}
                              onChange={(e) => {
                                setAnnCourseId(e.target.value);
                                setAnnBatchId('');
                              }}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                            >
                              {allCourses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                            </select>
                            <select
                              aria-label="Announcement Batch"
                              value={annBatchId}
                              onChange={(e) => setAnnBatchId(e.target.value)}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                            >
                              <option value="">All Batches</option>
                              {allBatches
                                .filter((b) => b.courseId === (annCourseId || allCourses[0]?.id))
                                .map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                            </select>
                            <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                              <input
                                type="checkbox"
                                checked={annPinned}
                                onChange={(e) => setAnnPinned(e.target.checked)}
                                className="h-4 w-4 accent-indigo-600"
                              />
                              <span>Pin Notice</span>
                            </label>
                          </div>
                          <input
                            type="text"
                            required
                            value={annTitle}
                            onChange={(e) => setAnnTitle(e.target.value)}
                            placeholder="Announcement Headline (e.g. Friday Live Class Rescheduled to 8:00 PM)"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                          />
                          <textarea
                            rows={2}
                            required
                            value={annMessage}
                            onChange={(e) => setAnnMessage(e.target.value)}
                            placeholder="Details for enrolled students..."
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                          />
                          <button
                            type="submit"
                            className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                          >
                            Post Announcement
                          </button>
                        </form>

                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-2.5">
                          <h3 className="text-base font-extrabold text-slate-900">
                            Recent Announcements ({allAnnouncements.length})
                          </h3>
                          {allAnnouncements.length === 0 ? (
                            <p className="text-xs text-slate-500">No announcements posted yet.</p>
                          ) : (
                            allAnnouncements.map((ann) => {
                              const crs = allCourses.find((c) => c.id === ann.courseId);
                              return (
                                <div
                                  key={ann.id}
                                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs"
                                >
                                  <div>
                                    <p className="font-extrabold text-slate-900">
                                      {ann.pinned ? '📌 ' : ''}
                                      {ann.title}
                                    </p>
                                    <p className="text-[11px] font-semibold text-indigo-700">
                                      {crs?.title || ann.courseId} · By {ann.postedByName || ann.authorName}
                                    </p>
                                    <p className="mt-1 text-slate-700">{ann.message}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAnnouncement(ann.id)}
                                    aria-label={`Delete announcement ${ann.title}`}
                                    className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : courseSubTab === 'certificates' ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-extrabold text-slate-900">
                              Issued Course Certificates ({allCertificates.length})
                            </h2>
                            <p className="text-xs text-slate-500">
                              Official credentials earned by students who passed course completion criteria.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigate('/verify-certificate')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            <span>Public Verification Portal</span>
                          </button>
                        </div>

                        <div className="mt-4 space-y-2.5">
                          {allCertificates.length === 0 ? (
                            <p className="py-8 text-center text-xs text-slate-500">
                              No certificates have been claimed yet.
                            </p>
                          ) : (
                            allCertificates.map((cert) => (
                              <div
                                key={cert.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs"
                              >
                                <div>
                                  <p className="font-mono-tabular font-extrabold text-indigo-700">
                                    {cert.certificateNumber}
                                  </p>
                                  <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                                    {cert.studentName} · {cert.courseTitle}
                                  </p>
                                  <p className="text-[11px] text-slate-500">
                                    Completion {cert.completionPercent}% · Issued{' '}
                                    {new Date(cert.issuedAt).toLocaleDateString()}
                                    {cert.revoked ? ' · REVOKED' : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewCert(cert)}
                                    className="rounded-lg bg-[#062436] px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-600"
                                  >
                                    View / Print
                                  </button>
                                  {user.role === 'admin' && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRevokeCertificate(cert)}
                                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                                        cert.revoked
                                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                          : 'border-rose-200 bg-rose-50 text-rose-700'
                                      }`}
                                    >
                                      {cert.revoked ? 'Reinstate' : 'Revoke'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : selectedBatchId ? (
                      <BatchDetailWorkspace
                        batchId={selectedBatchId}
                        courses={allCourses}
                        allBatches={allBatches}
                        branches={branchesList}
                        instructors={instructorsList}
                        userRole={user.role}
                        darkMode={darkMode}
                        onBack={() => setSelectedBatchId(null)}
                        onOpenWizard={(bat) => {
                          setEditingBatch(bat);
                          setBatchModalOpen(true);
                        }}
                        onRefresh={async () => {
                          await Promise.all([loadPortal(), refreshBootstrap()]);
                        }}
                        onNotify={notify}
                      />
                    ) : (
                      <BatchEnterpriseDashboard
                        batches={allBatches}
                        courses={allCourses}
                        branches={branchesList}
                        instructors={instructorsList}
                        enrollments={data.enrollments ?? []}
                        attendance={data.attendance ?? []}
                        transactions={data.transactions ?? []}
                        userRole={user.role}
                        darkMode={darkMode}
                        onOpenWizard={(bat) => {
                          setEditingBatch(bat);
                          setBatchModalOpen(true);
                        }}
                        onOpenDetail={(bId) => setSelectedBatchId(bId)}
                        onRefresh={async () => {
                          await Promise.all([loadPortal(), refreshBootstrap()]);
                        }}
                        onNotify={notify}
                      />
                    )}
                  </div>
                );
              })()}

              {/* LECTURE, LIVE & RECORDED VIDEO STUDIO (Admin & Teacher) */}
              {currentSection === 'lessons' && data && (() => {
                const allCourses = data.courses ?? [];
                const allBatches = data.batches ?? [];
                const allLessons = data.lessons ?? [];

                const courseScopedLessons =
                  lessonCourseFilter === 'all'
                    ? allLessons
                    : allLessons.filter((l) => l.courseId === lessonCourseFilter);

                const filteredLessons = filterLessonsByTypeAndBatch(
                  courseScopedLessons,
                  lessonTypeFilter,
                  lessonBatchFilter,
                  lessonSearch
                );

                const availableBatches =
                  lessonCourseFilter === 'all'
                    ? allBatches
                    : allBatches.filter((b) => b.courseId === lessonCourseFilter);

                const recordedCount = allLessons.filter(
                  (l) => (l.lessonType ?? 'recorded') === 'recorded'
                ).length;
                const liveCount = allLessons.filter((l) => l.lessonType === 'live').length;
                const liveNowCount = allLessons.filter(
                  (l) => l.lessonType === 'live' && l.liveStatus === 'live_now'
                ).length;
                const sheetCount = allLessons.filter(
                  (l) => l.lessonType === 'lecture_sheet'
                ).length;

                return (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <h2 className="text-lg font-extrabold text-slate-900">
                            Lecture, Live Class & Recorded Video Studio
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            <span className="font-mono-tabular font-bold text-sky-700">{recordedCount}</span> Recorded Videos ·{' '}
                            <span className="font-mono-tabular font-bold text-rose-700">
                              {liveCount}
                            </span>{' '}
                            Live Classes ({liveNowCount} LIVE NOW) ·{' '}
                            <span className="font-mono-tabular font-bold text-amber-700">{sheetCount}</span> Lecture Sheets
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigate('/learn')}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Open /learn Classroom</span>
                          </button>
                          {(user.role === 'admin' || user.role === 'teacher') && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLesson(null);
                                setLessonModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add Lecture / Live / Video</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Format Filter Pills */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {[
                          { id: 'all' as const, label: `All (${allLessons.length})` },
                          { id: 'recorded' as const, label: `Recorded Videos (${recordedCount})` },
                          { id: 'live' as const, label: `Live Classes (${liveCount})` },
                          { id: 'lecture_sheet' as const, label: `Lecture Sheets (${sheetCount})` },
                        ].map((tabItem) => (
                          <button
                            key={tabItem.id}
                            type="button"
                            onClick={() => setLessonTypeFilter(tabItem.id)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-colors ${
                              lessonTypeFilter === tabItem.id
                                ? 'bg-[#062436] text-white'
                                : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {tabItem.label}
                          </button>
                        ))}
                      </div>

                      {/* Filter Controls */}
                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
                        <div className="relative sm:col-span-4">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={lessonSearch}
                            onChange={(e) => setLessonSearch(e.target.value)}
                            placeholder="Search title, module or batch..."
                            aria-label="Search lectures and videos"
                            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <select
                          value={lessonCourseFilter}
                          onChange={(e) => {
                            setLessonCourseFilter(e.target.value);
                            setLessonBatchFilter('all');
                          }}
                          aria-label="Filter lessons by course"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold sm:col-span-4"
                        >
                          <option value="all">All Courses</option>
                          {allCourses.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </select>
                        <select
                          value={lessonBatchFilter}
                          onChange={(e) => setLessonBatchFilter(e.target.value)}
                          aria-label="Filter lessons by batch"
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold sm:col-span-4"
                        >
                          <option value="all">All Batches</option>
                          {availableBatches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Lessons List */}
                      <div className="mt-5 space-y-2.5">
                        {filteredLessons.length === 0 ? (
                          <p className="py-8 text-center text-xs text-slate-500">
                            No lectures, live sessions, or recorded videos match your filters.
                          </p>
                        ) : (
                          filteredLessons.map((les) => {
                            const lType = les.lessonType ?? 'recorded';
                            const parentCourse = allCourses.find((c) => c.id === les.courseId);
                            const isConfirming = confirmLessonDeleteId === les.id;

                            return (
                              <div
                                key={les.id}
                                className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-extrabold uppercase ${
                                        lType === 'live'
                                          ? les.liveStatus === 'live_now'
                                            ? 'bg-rose-600 text-white'
                                            : 'bg-rose-50 text-rose-700'
                                          : lType === 'lecture_sheet'
                                            ? 'bg-amber-50 text-amber-800'
                                            : 'bg-sky-50 text-sky-700'
                                      }`}
                                    >
                                      {lType === 'live' ? (
                                        <Radio className="h-3 w-3" />
                                      ) : lType === 'lecture_sheet' ? (
                                        <FileText className="h-3 w-3" />
                                      ) : (
                                        <Video className="h-3 w-3" />
                                      )}
                                      <span>
                                        {lType === 'live'
                                          ? les.liveStatus === 'live_now'
                                            ? 'Live Now'
                                            : les.liveStatus === 'ended'
                                              ? 'Live Ended'
                                              : 'Live Scheduled'
                                          : lType === 'lecture_sheet'
                                            ? 'Lecture Sheet'
                                            : 'Recorded Video'}
                                      </span>
                                    </span>

                                    {les.batchName && (
                                      <span className="rounded-lg bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                                        {les.batchName}
                                      </span>
                                    )}

                                    {les.isFreePreview && (
                                      <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                        Free Preview
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-1.5 text-sm font-extrabold text-slate-900">
                                    <span className="font-mono-tabular mr-1.5 text-slate-400">
                                      #{les.orderIndex}
                                    </span>
                                    {les.title}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {parentCourse?.title || 'Course'} · {les.moduleName} ·{' '}
                                    <span className="font-mono-tabular font-semibold">
                                      {les.duration}
                                    </span>
                                    {lType === 'live' && les.scheduledAt
                                      ? ` · Schedule: ${les.scheduledAt}`
                                      : ''}
                                  </p>
                                </div>

                                {(user.role === 'admin' || user.role === 'teacher') && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {lType === 'live' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleToggleLiveStatus(
                                          les,
                                          les.liveStatus === 'live_now' ? 'ended' : 'live_now'
                                        )
                                      }
                                      className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                                        les.liveStatus === 'live_now'
                                          ? 'bg-slate-900 text-white hover:bg-slate-700'
                                          : 'bg-rose-600 text-white hover:bg-rose-700'
                                      }`}
                                    >
                                      {les.liveStatus === 'live_now' ? 'End Live' : 'Go Live'}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleReorderLesson(les.id, 'up')}
                                    aria-label={`Move up ${les.title}`}
                                    title="Move Up"
                                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-700"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReorderLesson(les.id, 'down')}
                                    aria-label={`Move down ${les.title}`}
                                    title="Move Down"
                                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-700"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLesson(les);
                                      setLessonModalOpen(true);
                                    }}
                                    aria-label={`Edit lesson ${les.title}`}
                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    <span>Edit</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateLesson(les)}
                                    aria-label={`Duplicate lesson ${les.title}`}
                                    title="Duplicate Lecture"
                                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-700"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLesson(les.id)}
                                    aria-label={
                                      isConfirming
                                        ? `Confirm delete lesson ${les.title}`
                                        : `Delete lesson ${les.title}`
                                    }
                                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
                                      isConfirming
                                        ? 'bg-rose-600 text-white'
                                        : 'p-1.5 text-rose-600 hover:bg-rose-50'
                                    }`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {isConfirming && <span>Confirm</span>}
                                  </button>
                                </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* EXAMS & QUESTION BANK BUILDER (Admin & Teacher) */}
              {currentSection === 'exams' && data && (
                <div className="space-y-6">
                  <ExamBankPanel
                    questionBank={data.questionBank ?? []}
                    courses={data.courses ?? []}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />

                  <form
                    onSubmit={handleCreateExam}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
                  >
                    <h2 className="text-lg font-extrabold text-slate-900">Quick Single-Question Exam</h2>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        required
                        placeholder="Exam Title"
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Category (e.g. HSC English)"
                        value={examCategory}
                        onChange={(e) => setExamCategory(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Question 1 Prompt"
                      value={examQPrompt}
                      onChange={(e) => setExamQPrompt(e.target.value)}
                      className="mt-3 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Option A"
                        value={examOptA}
                        onChange={(e) => setExamOptA(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Option B"
                        value={examOptB}
                        onChange={(e) => setExamOptB(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Option C"
                        value={examOptC}
                        onChange={(e) => setExamOptC(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                      <input
                        type="text"
                        required
                        placeholder="Option D"
                        value={examOptD}
                        onChange={(e) => setExamOptD(e.target.value)}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <label htmlFor="correct-opt" className="text-xs font-bold text-slate-700">
                        Correct Option:
                      </label>
                      <select
                        id="correct-opt"
                        value={examCorrect}
                        onChange={(e) => setExamCorrect(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                      >
                        <option value={0}>Option A</option>
                        <option value={1}>Option B</option>
                        <option value={2}>Option C</option>
                        <option value={3}>Option D</option>
                      </select>
                      <button
                        type="submit"
                        className="ml-auto rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white"
                      >
                        Publish Exam
                      </button>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Published Exams ({data.exams?.length ?? 0})
                    </h2>
                    <div className="mt-4 space-y-2.5">
                      {(data.exams ?? []).map((ex) => {
                        const confirming = confirmExamDeleteId === ex.id;
                        const attemptsCount = (data.examAttempts ?? []).filter(
                          (a) => a.examId === ex.id
                        ).length;
                        return (
                          <div
                            key={ex.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{ex.title}</p>
                              <p className="text-xs text-slate-500">
                                {ex.category} · {ex.questions.length} MCQs · {ex.durationMinutes} min
                                {ex.negativeMarkPerWrong ? ` · -${ex.negativeMarkPerWrong} neg` : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-bold uppercase text-emerald-700">
                                {ex.visibility}
                              </span>
                              <button
                                type="button"
                                onClick={() => setGradingExam(ex)}
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                              >
                                <ClipboardList className="h-3.5 w-3.5" />
                                <span>Submissions &amp; Grade ({attemptsCount})</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirming) {
                                    setConfirmExamDeleteId(ex.id);
                                    return;
                                  }
                                  await apiFetch(`/api/portal/exams/${ex.id}`, { method: 'DELETE' });
                                  setConfirmExamDeleteId(null);
                                  await Promise.all([loadPortal(), refreshBootstrap()]);
                                  notify(`Exam "${ex.title}" moved to Recycle Bin.`);
                                }}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
                                  confirming
                                    ? 'bg-rose-600 text-white'
                                    : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                }`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>{confirming ? 'Confirm' : 'Delete'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* CATALOG, POSTS & COUPONS STUDIO (Admin & Teacher) */}
              {currentSection === 'catalog_cms' &&
                (user.role === 'admin' || user.role === 'teacher') &&
                data && (
                <CatalogContentPanel
                  role={user.role}
                  ebooks={data.ebooks ?? bootstrap?.ebooks ?? []}
                  products={data.products ?? bootstrap?.products ?? []}
                  instructors={data.instructors ?? bootstrap?.instructors ?? []}
                  categories={data.categories ?? bootstrap?.categories ?? []}
                  posts={data.posts ?? []}
                  coupons={data.coupons ?? []}
                  branches={data.branches ?? bootstrap?.branches ?? []}
                  transactions={data.transactions ?? []}
                  initialSubTab={catalogInitialTab}
                  onOpenCoursesSection={() => handleSectionRoute('courses', 'courses')}
                  onRefresh={async () => {
                    await Promise.all([loadPortal(), refreshBootstrap()]);
                  }}
                  onNotify={notify}
                />
              )}

              {/* ATTENDANCE, PAYROLL & FINANCE P&L */}
              {currentSection === 'attendance_finance' && data && (
                <div className="space-y-6">
                  <AttendanceFinancePanel
                    role={user.role}
                    users={data.users ?? []}
                    attendance={data.attendance ?? []}
                    payrolls={data.payrolls ?? []}
                    financialRecords={data.financialRecords ?? []}
                    transactions={data.transactions ?? []}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />
                  {user.role === 'admin' && (
                    <FeeInvoicesWidget
                      role={user.role}
                      users={data.users ?? []}
                      branches={data.branches ?? bootstrap?.branches ?? []}
                      onRefresh={async () => {
                        await Promise.all([loadPortal(), refreshBootstrap()]);
                      }}
                      onNotify={notify}
                    />
                  )}
                </div>
              )}

              {/* AI AGENTS, SCORM 1.2, BROADCASTS, PLUGINS & SECURITY */}
              {currentSection === 'ai_ecosystem' && data && (
                <AiEcosystemSecurityPanel
                  role={user.role}
                  scormPackages={data.scormPackages ?? []}
                  campaigns={data.campaigns ?? []}
                  plugins={data.plugins ?? []}
                  webhooks={data.webhooks ?? []}
                  courses={data.courses ?? []}
                  onRefresh={async () => {
                    await Promise.all([loadPortal(), refreshBootstrap()]);
                  }}
                  onNotify={notify}
                />
              )}

              {/* TEACHER STUDENT ROSTER OR ENROLLMENTS & FEES */}
              {currentSection === 'enrollments' &&
                data &&
                (user.role === 'teacher' ? (
                  <TeacherRosterPanel
                    users={data.users ?? []}
                    courses={data.courses ?? bootstrap?.courses ?? []}
                    lessons={data.lessons ?? []}
                    enrollments={data.enrollments ?? []}
                    examAttempts={data.examAttempts ?? []}
                    attendance={data.attendance ?? []}
                    rewardsByUser={data.rewardsByUser ?? {}}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />
                ) : (
                  <EnrollmentsFeePanel
                    role={user.role}
                    userBranchId={user.branchId}
                    enrollments={data.enrollments ?? []}
                    courses={data.courses ?? bootstrap?.courses ?? []}
                    batches={data.batches ?? []}
                    branches={data.branches ?? bootstrap?.branches ?? []}
                    users={data.users ?? []}
                    paymentGateways={data.paymentGateways ?? []}
                    darkMode={darkMode}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />
                ))}

              {/* DEDICATED PAYMENT SYSTEM & GATEWAYS */}
              {currentSection === 'payments' && data && (
                <PaymentSystemPanel
                  role={user.role}
                  paymentGateways={data.paymentGateways ?? []}
                  transactions={data.transactions ?? []}
                  onRefresh={async () => {
                    await Promise.all([loadPortal(), refreshBootstrap()]);
                  }}
                  onNotify={notify}
                />
              )}

              {/* BRANCHES (MAIN ADMIN 4-STATUS GOVERNANCE & BRANCH SELF-CAMPUS PROFILE) */}
              {currentSection === 'branches' &&
                (user.role === 'admin' || user.role === 'branch') &&
                data && (
                  <BranchOperationsPanel
                    role={user.role}
                    branches={data.branches ?? bootstrap?.branches ?? []}
                    darkMode={darkMode}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />
                )}

              {/* ACADEMIC CORE STRUCTURE & ADMISSIONS */}
              {currentSection === 'academic_ops' && data && (
                <AcademicOpsPanel
                  role={user.role}
                  branches={data.branches ?? bootstrap?.branches ?? []}
                  courses={data.courses ?? bootstrap?.courses ?? []}
                  batches={data.batches ?? []}
                  users={data.users ?? []}
                  onNotify={notify}
                />
              )}

              {/* INTEGRATIONS, REAL COMMUNICATIONS & MAIN ADMIN 2FA */}
              {currentSection === 'integrations' && user.role === 'admin' && data && (
                <IntegrationsAndSecurityPanel
                  users={data.users ?? []}
                  onNotify={notify}
                />
              )}

              {/* USERS & ROLES */}
              {currentSection === 'users' && data && (
                <UsersManagementPanel
                  currentUser={user}
                  users={data.users ?? []}
                  branches={data.branches ?? bootstrap?.branches ?? []}
                  darkMode={darkMode}
                  defaultCreateRole={uRole}
                  onRefresh={async () => {
                    await Promise.all([loadPortal(), refreshBootstrap()]);
                  }}
                  onNotify={notify}
                />
              )}

              {/* ORDERS */}
              {currentSection === 'orders' && data && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Study Material & Book Orders ({data.orders?.length ?? 0})
                  </h2>
                  <div className="mt-4 space-y-3">
                    {(data.orders ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500">No orders placed yet.</p>
                    ) : (
                      (data.orders ?? []).map((ord) => (
                        <div
                          key={ord.id}
                          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"
                        >
                          <div>
                            <p className="font-mono-tabular text-xs font-bold text-indigo-700">
                              {ord.id}
                            </p>
                            <p className="text-sm font-bold text-slate-900">
                              {ord.customerName} · {ord.deliveryAddress}
                            </p>
                            <p className="text-xs text-slate-500">
                              {ord.items.map((i) => `${i.title} (x${i.quantity})`).join(', ')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tabular text-base font-extrabold text-slate-900">
                              ৳{ord.totalAmount}
                            </span>
                            {user.role === 'admin' ? (
                              <select
                                aria-label={`Order status for ${ord.id}`}
                                value={ord.status}
                                onChange={(e) =>
                                  handleOrderStatus(ord.id, e.target.value as Order['status'])
                                }
                                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold"
                              >
                                <option value="processing">Processing</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            ) : (
                              <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                                {ord.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* STUDENT MY LEARNING, REWARDS, SCORM & INVOICES */}
              {currentSection === 'my_learning' && data && (
                <div className="space-y-6">
                  {data.rewards && (
                    <div className="rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-indigo-50 p-6 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-700">
                            <Award className="h-6 w-6" />
                          </span>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
                              Learning Rewards & Streak
                            </p>
                            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
                              <span>{data.rewards.xp} XP</span>
                              <span className="inline-flex items-center gap-1 rounded-lg bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                                <Flame className="h-3.5 w-3.5" /> {data.rewards.streakDays}d streak
                              </span>
                            </h2>
                            <p className="mt-1 text-xs text-slate-600">
                              Badges: {data.rewards.badges.join(' · ') || 'Active Learner'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch('/api/rewards/privacy', {
                              method: 'PATCH',
                              body: JSON.stringify({
                                showOnLeaderboard: !data.rewards?.showOnLeaderboard,
                              }),
                            });
                            await Promise.all([loadPortal(), refreshBootstrap()]);
                            notify(
                              !data.rewards?.showOnLeaderboard
                                ? 'Your full name is now visible on Leaderboards.'
                                : 'Leaderboard privacy ON: Your name is now masked.'
                            );
                          }}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                            data.rewards.showOnLeaderboard
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-slate-800 text-white hover:bg-slate-700'
                          }`}
                        >
                          {data.rewards.showOnLeaderboard
                            ? 'Leaderboard Name: Public (Click to Mask)'
                            : 'Leaderboard Name: Private/Masked (Click to Show)'}
                        </button>
                      </div>
                    </div>
                  )}

                  <StudentBatchPortal onNavigate={navigate} />

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900">My Enrolled Courses</h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setStorageModalOpen(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>My Storage ({data.metrics.mediaCount ?? 0})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate('/learn')}
                          className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white"
                        >
                          Continue Watching
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(data.enrollments ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500">
                          You have not enrolled in any courses yet.
                        </p>
                      ) : (
                        (data.enrollments ?? []).map((enr) => {
                          const totalLes = (data.lessons ?? []).filter(
                            (l) => l.courseId === enr.courseId
                          ).length;
                          const pct = calculateStudentProgress(totalLes, enr.completedLessonIds);
                          return (
                            <div
                              key={enr.id}
                              className="rounded-xl border border-slate-200 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-extrabold text-slate-900">
                                  {enr.courseTitle}
                                </h3>
                                <span
                                  className={`text-xs font-bold uppercase ${
                                    enr.status === 'approved'
                                      ? 'text-emerald-700'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {enr.status}
                                </span>
                              </div>
                              <div className="mt-3 flex items-center gap-3">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                                  <div
                                    className="h-full bg-emerald-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="font-mono-tabular text-xs font-bold text-slate-700">
                                  {pct}%
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Upcoming & Live Classes */}
                  {(() => {
                    const liveLessons = (data.lessons ?? []).filter(
                      (l) => l.lessonType === 'live'
                    );
                    if (liveLessons.length === 0) return null;
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                            <Radio className="h-4 w-4 text-rose-600" />
                            <span>Upcoming &amp; Live Classroom Sessions</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => navigate('/learn')}
                            className="text-xs font-bold text-indigo-600 hover:underline"
                          >
                            Open Classroom →
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {liveLessons.slice(0, 4).map((l) => (
                            <div
                              key={l.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase ${
                                      l.liveStatus === 'live_now'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-sky-100 text-sky-800'
                                    }`}
                                  >
                                    {l.liveStatus === 'live_now' ? 'LIVE NOW' : l.liveStatus || 'SCHEDULED'}
                                  </span>
                                  <span className="truncate text-[11px] font-semibold text-slate-500">
                                    {l.batchName || l.moduleName}
                                  </span>
                                </div>
                                <p className="mt-1 truncate font-bold text-slate-900">{l.title}</p>
                                {l.scheduledAt && (
                                  <p className="text-[11px] text-slate-500">{l.scheduledAt}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => navigate('/learn')}
                                className="shrink-0 rounded-lg bg-[#062436] px-3 py-1.5 font-bold text-white hover:bg-indigo-600"
                              >
                                Join
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* My Assignments & Homework Photo Submissions */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                        <ImageIcon className="h-4 w-4 text-sky-600" />
                        <span>My Assignments &amp; Homework Submissions ({(data.assignments ?? []).length})</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => navigate('/learn')}
                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100"
                      >
                        Submit Homework Photo →
                      </button>
                    </div>
                    {(data.assignments ?? []).length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        No active assignments for your enrolled courses yet.
                      </p>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {(data.assignments ?? []).map((asg) => {
                          const sub = (data.assignmentSubmissions ?? []).find(
                            (s) => s.assignmentId === asg.id
                          );
                          return (
                            <div
                              key={asg.id}
                              className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-extrabold text-slate-900">{asg.title}</p>
                                  <p className="text-[11px] text-slate-500">
                                    Due {asg.dueDate} · Max {asg.maxMarks} marks
                                  </p>
                                </div>
                                <span
                                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                    sub?.status === 'graded'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : sub
                                        ? 'bg-sky-100 text-sky-800'
                                        : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {sub?.status === 'graded'
                                    ? `Graded ${sub.marks}/${asg.maxMarks}`
                                    : sub
                                      ? 'Submitted'
                                      : 'Pending'}
                                </span>
                              </div>
                              <p className="text-slate-600 line-clamp-2">{asg.instructions}</p>
                              {sub?.attachmentUrl && (
                                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2">
                                  <img
                                    src={sub.attachmentUrl}
                                    alt={asg.title}
                                    referrerPolicy="no-referrer"
                                    className="h-10 w-14 rounded object-cover"
                                  />
                                  <span className="truncate text-[11px] font-semibold text-indigo-700">
                                    Uploaded attachment saved
                                  </span>
                                </div>
                              )}
                              {sub?.feedback && (
                                <p className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900">
                                  <strong>Teacher Feedback:</strong> {sub.feedback}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* My Exam Scorecards & Teacher Feedback */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                        <ClipboardList className="h-4 w-4 text-indigo-600" />
                        <span>My Exam Scorecards &amp; Teacher Feedback</span>
                      </h3>
                      <button
                        type="button"
                        onClick={() => navigate('/exams')}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        Take Mock Exam
                      </button>
                    </div>
                    {(data.examAttempts ?? []).length === 0 ? (
                      <p className="mt-3 text-xs text-slate-500">
                        No exam attempts yet. Attempt a live quiz in Exam Center to see your scorecard &amp; instructor feedback here.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2.5">
                        {(data.examAttempts ?? []).map((att) => (
                          <div
                            key={att.id}
                            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-bold text-slate-900">{att.examTitle}</p>
                                <p className="text-[11px] text-slate-500">
                                  Submitted {new Date(att.submittedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono-tabular rounded-lg bg-indigo-100 px-2.5 py-1 font-extrabold text-indigo-800">
                                  {att.score}/{att.totalMarks} ({att.percentage}%) · Grade {att.grade}
                                </span>
                                <span
                                  className={`rounded-lg px-2 py-1 font-bold uppercase ${
                                    att.passed
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {att.passed ? 'Passed' : 'Needs Review'}
                                </span>
                              </div>
                            </div>
                            {att.teacherFeedback && (
                              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                                <strong className="font-bold">Instructor Feedback:</strong>{' '}
                                {att.teacherFeedback}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(data.scormPackages ?? []).length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                      <h3 className="text-base font-extrabold text-slate-900">
                        Interactive SCORM 1.2 Modules
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(data.scormPackages ?? []).map((pkg) => (
                          <div
                            key={pkg.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5 text-xs"
                          >
                            <div>
                              <p className="font-bold text-slate-900">{pkg.title}</p>
                              <p className="text-slate-500">+{pkg.xpReward} XP · {pkg.identifier}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveStudentScorm(pkg)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white"
                            >
                              <Play className="h-3 w-3" /> Launch
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(data.certificates ?? []).length > 0 && (
                    <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-xs">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                        <Award className="h-4 w-4 text-amber-500" />
                        <span>My Earned Certificates ({(data.certificates ?? []).length})</span>
                      </h3>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {(data.certificates ?? []).map((cert) => (
                          <div
                            key={cert.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-xs"
                          >
                            <div>
                              <p className="font-mono-tabular font-extrabold text-emerald-800">
                                {cert.certificateNumber}
                              </p>
                              <p className="font-bold text-slate-900">{cert.courseTitle}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewCert(cert)}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700"
                            >
                              View PDF
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(data.announcements ?? []).length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                        <Megaphone className="h-4 w-4 text-indigo-600" />
                        <span>Course Announcements</span>
                      </h3>
                      <div className="mt-3 space-y-2 text-xs">
                        {(data.announcements ?? []).slice(0, 4).map((ann) => (
                          <div
                            key={ann.id}
                            className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5"
                          >
                            <p className="font-extrabold text-slate-900">{ann.title}</p>
                            <p className="mt-0.5 text-slate-700">{ann.message}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              By {ann.postedByName || ann.authorName} ·{' '}
                              {new Date(ann.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(data.transactions ?? []).length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                      <h3 className="text-base font-extrabold text-slate-900">
                        Official Payment Invoices
                      </h3>
                      <div className="mt-3 space-y-2 text-xs">
                        {(data.transactions ?? []).map((tx) => (
                          <div
                            key={tx.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
                          >
                            <span>
                              <strong className="font-mono-tabular text-indigo-700">{tx.invoiceNo}</strong>{' '}
                              · {tx.gateway} ({tx.trxId})
                            </span>
                            <span className="font-mono-tabular font-bold text-slate-900">
                              ৳{tx.totalAmount} · {tx.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <FeeInvoicesWidget
                    role={user.role}
                    branches={data.branches ?? bootstrap?.branches ?? []}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />
                </div>
              )}

              {/* GUARDIAN CHILD MONITOR (360 PROGRESS, ATTENDANCE, HOMEWORK, EXAMS, CERTIFICATES & STUDENT LINKING) */}
              {currentSection === 'guardian_monitor' && data && (
                <div className="space-y-6">
                  {/* Link Student Form */}
                  <form
                    onSubmit={handleLinkGuardianStudent}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
                          <Link2 className="h-4 w-4 text-indigo-600" />
                          <span>Link Another Child / Student Account</span>
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Enter a student&apos;s Roll Number (e.g. <span className="font-mono-tabular font-bold">AEC-2026-101</span>) or Email along with their registered phone or Guardian Linking Code.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStorageModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>My Storage ({data.metrics.mediaCount ?? 0})</span>
                      </button>
                    </div>
                    {guardianLinkError && (
                      <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        {guardianLinkError}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={guardianLinkInput}
                        onChange={(e) => setGuardianLinkInput(e.target.value)}
                        placeholder="Student Roll Number or Email (e.g. AEC-2026-101)"
                        aria-label="Student roll number or email"
                        className="min-w-[200px] flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium"
                      />
                      <input
                        type="text"
                        value={guardianVerifyInput}
                        onChange={(e) => setGuardianVerifyInput(e.target.value)}
                        placeholder="Student Phone or Linking Code"
                        aria-label="Student phone or guardian linking code"
                        className="font-mono-tabular min-w-[180px] flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-medium"
                      />
                      <button
                        type="submit"
                        disabled={guardianLinking}
                        className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
                      >
                        {guardianLinking ? 'Verifying...' : 'Verify & Link Student'}
                      </button>
                    </div>
                  </form>

                  {(data.children ?? []).length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
                      No linked students found for this guardian account. Use the Roll Number / Email bar above to link your child.
                    </div>
                  ) : (
                    (data.children ?? []).map((child) => {
                      const attendanceList = child.attendance ?? [];
                      const presentCount = attendanceList.filter(
                        (a) => a.status === 'present' || a.status === 'late'
                      ).length;
                      const attendanceRate =
                        attendanceList.length > 0
                          ? Math.round((presentCount / attendanceList.length) * 100)
                          : 100;
                      const branchName =
                        (data.branches ?? bootstrap?.branches ?? []).find(
                          (b) => b.id === child.student.branchId
                        )?.name || 'Main Campus';
                      const childAssignments = child.assignments ?? [];
                      const childSubmissions = child.assignmentSubmissions ?? [];
                      const childCertificates = child.certificates ?? [];
                      const childTransactions = child.transactions ?? [];
                      const childOrders = child.orders ?? [];

                      return (
                        <div
                          key={child.student.id}
                          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-6"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3.5">
                              {child.student.avatar ? (
                                <img
                                  src={child.student.avatar}
                                  alt={child.student.name}
                                  referrerPolicy="no-referrer"
                                  className="h-14 w-14 rounded-2xl border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-extrabold text-indigo-700">
                                  {child.student.name
                                    .split(' ')
                                    .slice(0, 2)
                                    .map((p) => p[0])
                                    .join('')
                                    .toUpperCase()}
                                </div>
                              )}
                              <div>
                                <h2 className="text-xl font-extrabold text-slate-900">
                                  {child.student.name}
                                </h2>
                                <p className="font-mono-tabular text-xs font-semibold text-sky-700">
                                  Roll: {child.student.rollNumber || child.student.id} ·{' '}
                                  {child.student.email} · {branchName}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {child.rewards && (
                                <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-extrabold text-amber-800">
                                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                                  {child.rewards.xp} XP · {child.rewards.streakDays}d Streak
                                </span>
                              )}
                              <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                                Attendance: {attendanceRate}%
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleUnlinkGuardianStudent(child.student.id, child.student.name)
                                }
                                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                              >
                                Unlink
                              </button>
                            </div>
                          </div>

                          {/* Course Progress & Fee Status */}
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Course Progress &amp; Fee Status
                            </h3>
                            <div className="mt-2.5 space-y-2.5">
                              {child.enrollments.length === 0 ? (
                                <p className="text-xs text-slate-500">No enrollments yet.</p>
                              ) : (
                                child.enrollments.map((enr) => {
                                  const totalLes = child.lessonsCountByCourse[enr.courseId] || 1;
                                  const pct = calculateStudentProgress(
                                    totalLes,
                                    enr.completedLessonIds
                                  );
                                  return (
                                    <div
                                      key={enr.id}
                                      className="rounded-xl border border-slate-200 p-3.5 text-xs space-y-2"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                          <p className="font-bold text-slate-900">{enr.courseTitle}</p>
                                          <p className="text-slate-500">
                                            Payment: {enr.paymentMethod} · ৳{enr.amountPaid} ({enr.status})
                                          </p>
                                        </div>
                                        <span className="font-mono-tabular font-bold text-emerald-700">
                                          {pct}% Completed
                                        </span>
                                      </div>
                                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div
                                          className="h-full rounded-full bg-emerald-500"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Attendance Log & Assignments Grid */}
                          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                            <div>
                              <h3 className="text-sm font-extrabold text-slate-900">
                                Recent Attendance Logs ({attendanceList.length})
                              </h3>
                              <div className="mt-2.5 space-y-2 text-xs">
                                {attendanceList.length === 0 ? (
                                  <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-500">
                                    No attendance entries recorded yet.
                                  </p>
                                ) : (
                                  attendanceList.slice(0, 5).map((att) => (
                                    <div
                                      key={att.id}
                                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2"
                                    >
                                      <span className="font-mono-tabular font-semibold text-slate-700">
                                        {att.date}
                                      </span>
                                      <span
                                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                          att.status === 'present'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : att.status === 'late'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-rose-100 text-rose-800'
                                        }`}
                                      >
                                        {att.status}
                                      </span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div>
                              <h3 className="text-sm font-extrabold text-slate-900">
                                Homework &amp; Assignment Submissions ({childAssignments.length})
                              </h3>
                              <div className="mt-2.5 space-y-2 text-xs">
                                {childAssignments.length === 0 ? (
                                  <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-slate-500">
                                    No assignments assigned to linked courses yet.
                                  </p>
                                ) : (
                                  childAssignments.slice(0, 4).map((asg) => {
                                    const sub = childSubmissions.find(
                                      (s) => s.assignmentId === asg.id
                                    );
                                    return (
                                      <div
                                        key={asg.id}
                                        className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 space-y-1.5"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-bold text-slate-900 truncate">
                                            {asg.title}
                                          </span>
                                          <span
                                            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                              sub?.status === 'graded'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : sub
                                                  ? 'bg-sky-100 text-sky-800'
                                                  : 'bg-amber-100 text-amber-800'
                                            }`}
                                          >
                                            {sub?.status === 'graded'
                                              ? `${sub.marks}/${asg.maxMarks}`
                                              : sub
                                                ? 'Submitted'
                                                : 'Due ' + asg.dueDate}
                                          </span>
                                        </div>
                                        {sub?.attachmentUrl && (
                                          <div className="flex items-center gap-2">
                                            <img
                                              src={sub.attachmentUrl}
                                              alt={asg.title}
                                              referrerPolicy="no-referrer"
                                              className="h-9 w-12 rounded border border-slate-200 object-cover"
                                            />
                                            <span className="text-[11px] text-slate-600">
                                              Homework photo uploaded
                                            </span>
                                          </div>
                                        )}
                                        {sub?.feedback && (
                                          <p className="text-[11px] text-emerald-800">
                                            Feedback: {sub.feedback}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Exam Performance History */}
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">
                              Exam Performance History ({child.examAttempts.length})
                            </h3>
                            <div className="mt-2.5 space-y-2">
                              {child.examAttempts.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No mock exams attempted yet.
                                </p>
                              ) : (
                                child.examAttempts.map((att) => (
                                  <div
                                    key={att.id}
                                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs space-y-1"
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-bold text-slate-900">{att.examTitle}</span>
                                      <span className="font-mono-tabular font-bold text-indigo-700">
                                        {att.score}/{att.totalMarks} ({att.percentage}%) · Grade {att.grade}
                                      </span>
                                    </div>
                                    {att.teacherFeedback && (
                                      <p className="text-[11px] text-amber-900">
                                        <strong>Teacher Remark:</strong> {att.teacherFeedback}
                                      </p>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Certificates & Fee Invoices */}
                          {(childCertificates.length > 0 ||
                            childTransactions.length > 0 ||
                            childOrders.length > 0) && (
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              {childCertificates.length > 0 && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-900">
                                    <Award className="h-4 w-4 text-emerald-600" />
                                    <span>Earned Certificates ({childCertificates.length})</span>
                                  </h4>
                                  <div className="mt-2 space-y-2">
                                    {childCertificates.map((cert) => (
                                      <div
                                        key={cert.id}
                                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-2xs"
                                      >
                                        <span className="font-bold text-slate-900">
                                          {cert.courseTitle} ({cert.certificateNumber})
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setPreviewCert(cert)}
                                          className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                                        >
                                          View PDF
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(childTransactions.length > 0 || childOrders.length > 0) && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-900">
                                    <CreditCard className="h-4 w-4 text-indigo-600" />
                                    <span>Fee Receipts &amp; Book Orders</span>
                                  </h4>
                                  <div className="mt-2 space-y-1.5 text-xs">
                                    {childTransactions.map((tx) => (
                                      <div
                                        key={tx.id}
                                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                                      >
                                        <span className="font-mono-tabular font-bold text-indigo-700">
                                          {tx.invoiceNo} ({tx.gateway})
                                        </span>
                                        <span className="font-mono-tabular font-bold text-slate-800">
                                          ৳{tx.totalAmount} · {tx.status}
                                        </span>
                                      </div>
                                    ))}
                                    {childOrders.map((ord) => (
                                      <div
                                        key={ord.id}
                                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                                      >
                                        <span className="font-semibold text-slate-700 truncate">
                                          Order {ord.id}: {ord.items.map((i) => i.title).join(', ')}
                                        </span>
                                        <span className="font-mono-tabular font-bold text-slate-800">
                                          ৳{ord.totalAmount} ({ord.status})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <FeeInvoicesWidget
                    role={user.role}
                    branches={data.branches ?? bootstrap?.branches ?? []}
                    onRefresh={async () => {
                      await Promise.all([loadPortal(), refreshBootstrap()]);
                    }}
                    onNotify={notify}
                  />
                </div>
              )}

              {/* HOMEPAGE VISUAL CMS STUDIO (Admin) */}
              {currentSection === 'homepage_cms' && user.role === 'admin' && data && data.settings && (
                <HomepageCmsStudio
                  settings={data.settings}
                  courses={data.courses ?? []}
                  reviews={data.reviews ?? bootstrap?.reviews ?? []}
                  initialTab={cmsInitialTab}
                  liveStats={{
                    students:
                      (data.users ?? []).filter((u) => u.role === 'student').length ||
                      (data.courses ?? []).reduce((s, c) => s + c.enrolledCount, 0),
                    courses: (data.courses ?? []).filter((c) => isCourseStatusLive(c.status)).length,
                    teachers: (bootstrap?.instructors ?? []).length,
                    videos: (data.lessons ?? []).length,
                  }}
                  onNavigateHome={() => navigate('/')}
                  onSaved={async (msg) => {
                    await Promise.all([loadPortal(), refreshBootstrap()]);
                    notify(msg);
                  }}
                />
              )}

              {/* ADMIN SETTINGS & LARAVEL EXPORT */}
              {currentSection === 'settings' && data && (
                <div className="space-y-6">
                  <form
                    onSubmit={handleSaveSettings}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
                  >
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Aloms English Center Contact & Branding Settings
                    </h2>
                    <div className="mt-4 space-y-3">
                      <div>
                        <label
                          htmlFor="set-phone"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          Helpline Phone
                        </label>
                        <input
                          id="set-phone"
                          type="text"
                          value={setPhone}
                          onChange={(e) => setSetPhone(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="set-email"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          Official Email
                        </label>
                        <input
                          id="set-email"
                          type="email"
                          value={setEmail}
                          onChange={(e) => setSetEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="set-address"
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          Head Office Address
                        </label>
                        <input
                          id="set-address"
                          type="text"
                          value={setAddress}
                          onChange={(e) => setSetAddress(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="mt-4 rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white"
                    >
                      Save Settings
                    </button>
                  </form>

                  {user.role === 'admin' && (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-extrabold text-slate-900">
                          Custom Header Navigation Menu &amp; Footer Builder
                        </h2>
                        <p className="mt-1 text-xs text-slate-600">
                          Add custom top navbar links, badges, visibility toggles, footer links, and Page Builder (/page/:slug) pages.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCmsInitialTab('branding');
                          setActiveSection('homepage_cms');
                        }}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#062436] px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-600"
                      >
                        <LayoutTemplate className="h-4 w-4" />
                        <span>Open Custom Menu Builder</span>
                      </button>
                    </div>
                  )}

                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      Ready-to-Install Laravel 13 White-Label Codebase
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Download the standalone Laravel 13 project archive containing the White-Label
                      Web Installer (/install), non-destructive domain update &amp; backup system,
                      zero demo data, and unified multi-role portal ready for production hosting.
                    </p>
                    <a
                      href="/downloads/academy-lms-laravel13.zip"
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download academy-lms-laravel13.zip</span>
                    </a>
                  </div>

                  {user.role === 'admin' && (
                    <SecurityBackupPanel
                      onRefresh={async () => {
                        await Promise.all([loadPortal(), refreshBootstrap()]);
                      }}
                      onNotify={notify}
                    />
                  )}
                </div>
              )}

              {/* SELF-SERVICE PROFILE & ACCOUNT SECURITY (ALL ROLES) */}
              {currentSection === 'profile' && (
                <UserProfilePanel
                  user={user}
                  branches={data?.branches ?? bootstrap?.branches ?? []}
                  darkMode={darkMode}
                  onNotify={notify}
                />
              )}
            </>
          )}
          </section>

          {/* Centered Dashboard Footer */}
          <footer
            className={`mt-auto border-t py-3.5 text-center text-xs ${
              darkMode
                ? 'border-[#1E2E52] bg-[#0B142C] text-slate-400'
                : 'border-white/70 bg-white/70 text-slate-600 backdrop-blur-md'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>© 2026</span>
              <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" />
              <span>{bootstrap?.settings.brandName || "Alom's English Center"} · LMS v3.0</span>
            </span>
          </footer>
        </div>
      </div>

      {user.role === 'admin' && (
        <DashboardCustomizerModal
          open={customizerOpen}
          config={dashboardConfig}
          onClose={() => setCustomizerOpen(false)}
          onSave={handleSaveDashboardConfig}
        />
      )}

      {(user.role === 'admin' || user.role === 'teacher') && data && (
        <CourseWizardModal
          open={courseModalOpen}
          course={editingCourse}
          templateDefaults={wizardTemplateDefaults}
          sampleModules={wizardSampleModules}
          allCourses={data.courses ?? []}
          branches={data.branches ?? bootstrap?.branches ?? []}
          instructors={bootstrap?.instructors ?? []}
          batches={data.batches ?? []}
          onClose={() => setCourseModalOpen(false)}
          onSaved={async (msg) => {
            await Promise.all([loadPortal(), refreshBootstrap()]);
            notify(msg);
          }}
        />
      )}

      {(user.role === 'admin' || user.role === 'teacher') && data && (
        <CurriculumBuilderModal
          open={Boolean(curriculumCourse)}
          course={curriculumCourse}
          batches={data.batches ?? []}
          onClose={() => setCurriculumCourse(null)}
          onChanged={async () => {
            await Promise.all([loadPortal(), refreshBootstrap()]);
          }}
          onNotify={notify}
        />
      )}

      <CertificateModal
        certificate={previewCert}
        onClose={() => setPreviewCert(null)}
        onOpenVerifyPage={(certNo) =>
          navigate(`/verify-certificate?cert=${encodeURIComponent(certNo)}`)
        }
      />

      {(user.role === 'admin' || user.role === 'teacher') &&
        data && (
          <BatchWizardModal
            open={batchModalOpen}
            batch={editingBatch}
            courses={data.courses ?? []}
            branches={data.branches ?? bootstrap?.branches ?? []}
            instructors={data.instructors ?? bootstrap?.instructors ?? []}
            onClose={() => setBatchModalOpen(false)}
            onSaved={async (msg) => {
              await Promise.all([loadPortal(), refreshBootstrap()]);
              notify(msg);
            }}
          />
        )}

      {(user.role === 'admin' || user.role === 'teacher') && data && (
        <AdminLessonModal
          open={lessonModalOpen}
          lesson={editingLesson}
          courses={data.courses ?? []}
          batches={data.batches ?? []}
          defaultCourseId={lessonCourseFilter !== 'all' ? lessonCourseFilter : undefined}
          onClose={() => setLessonModalOpen(false)}
          onSaved={async (msg) => {
            await Promise.all([loadPortal(), refreshBootstrap()]);
            notify(msg);
          }}
        />
      )}

      {gradingExam && data && (
        <ExamSubmissionsModal
          exam={gradingExam}
          attempts={(data.examAttempts ?? []).filter((a) => a.examId === gradingExam.id)}
          onClose={() => setGradingExam(null)}
          onRefresh={async () => {
            await Promise.all([loadPortal(), refreshBootstrap()]);
          }}
          onNotify={notify}
        />
      )}

      <ScormPlayerModal
        pkg={activeStudentScorm}
        onClose={() => setActiveStudentScorm(null)}
        onCompleted={() => {
          void Promise.all([loadPortal(), refreshBootstrap()]);
          notify('SCORM 1.2 module score & XP recorded!');
        }}
      />

      <MyStorageModal
        open={storageModalOpen}
        onClose={() => setStorageModalOpen(false)}
        darkMode={darkMode}
      />
    </div>
  );
}
