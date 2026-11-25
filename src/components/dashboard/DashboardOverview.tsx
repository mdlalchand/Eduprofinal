import {
  ArrowRight,
  Award,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Flame,
  GraduationCap,
  HardDrive,
  MapPin,
  Phone,
  Play,
  Radio,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { useState } from 'react';
import {
  buildAnalyticsOverviewSeries,
  buildCourseProgressSummary,
  buildFuturisticKpiCards,
  buildLiveSpotlight,
  buildRecentActivityFeed,
  buildTopStudents,
  buildUpcomingClassRows,
  type DashboardSourceData,
  type FuturisticKpiCard,
  type LiveSpotlightItem,
  type OverviewRange,
} from '../../lib/dashboardAnalytics';
import {
  calculateStudentProgress,
  DEFAULT_DASHBOARD_CONFIG,
  normalizeDashboardConfig,
  type PortalSection,
} from '../../lib/domain';
import type { AuditLogEntry, DashboardCustomizationConfig } from '../../types';
import {
  AnalyticsOverviewCard,
  CourseProgressCard,
  FuturisticKpiGrid,
  LiveClassSpotlightCard,
} from './DashboardCharts';
import type { OverviewSubView, SidebarSubIntent } from './DashboardSidebar';
import {
  QuickActionsCard,
  RecentActivitiesCard,
  TopStudentsProgressCard,
  UpcomingClassesCard,
  type QuickActionType,
} from './DashboardWidgets';
import { SystemActivityLogsPanel } from './SystemActivityLogsPanel';

interface DashboardOverviewProps {
  data: DashboardSourceData;
  viewerName?: string;
  viewerAvatar?: string;
  viewerRollNumber?: string;
  auditLogs?: AuditLogEntry[];
  searchQuery: string;
  overviewSubView: OverviewSubView;
  lang: 'en' | 'bn';
  darkMode?: boolean;
  canCustomize?: boolean;
  dashboardConfig?: DashboardCustomizationConfig;
  onSelectSection: (section: PortalSection, intent?: SidebarSubIntent) => void;
  onQuickAction: (action: QuickActionType) => void;
  onNavigate: (path: string) => void;
}

export function DashboardOverview({
  data,
  viewerName,
  viewerAvatar,
  viewerRollNumber,
  auditLogs = [],
  searchQuery,
  lang,
  darkMode = false,
  canCustomize = false,
  dashboardConfig = DEFAULT_DASHBOARD_CONFIG,
  onSelectSection,
  onQuickAction,
  onNavigate,
}: DashboardOverviewProps) {
  const [range, setRange] = useState<OverviewRange>('Last 6 Months');
  const [liveModal, setLiveModal] = useState<LiveSpotlightItem | null>(null);

  const cfg = normalizeDashboardConfig(dashboardConfig);
  const kpiCards = buildFuturisticKpiCards(data);
  const analyticsOverview = buildAnalyticsOverviewSeries(data, range);
  const courseProgress = buildCourseProgressSummary(data);
  const liveSpotlight = buildLiveSpotlight(data);
  const recentActivities = buildRecentActivityFeed(data, searchQuery);
  const upcomingClasses = buildUpcomingClassRows(data, searchQuery);
  const topStudents = buildTopStudents(data);

  const handleKpiClick = (id: FuturisticKpiCard['id']) => {
    if (data.role === 'student') {
      if (id === 'courses') onNavigate('/exams');
      else onSelectSection('my_learning');
      return;
    }
    if (data.role === 'guardian') {
      onSelectSection('guardian_monitor');
      return;
    }
    if (id === 'students') {
      onSelectSection('enrollments');
    } else if (id === 'teachers') {
      onSelectSection(
        data.role === 'admin' ? 'users' : data.role === 'branch' ? 'attendance_finance' : 'exams'
      );
    } else if (id === 'courses') {
      onSelectSection('courses', 'courses');
    } else if (id === 'batches') {
      onSelectSection('courses', 'batches');
    }
  };

  const heroSubtitle =
    data.role === 'student'
      ? `Student Learning Hub${viewerRollNumber ? ` · Roll ${viewerRollNumber}` : ''}`
      : data.role === 'guardian'
        ? `Guardian Academic Watch · ${(data.children ?? []).length} Linked Student(s)`
        : data.role === 'teacher'
          ? `Faculty Coaching Studio · ${(data.courses ?? []).length} Assigned Course(s)`
          : data.role === 'branch'
            ? `Campus Branch Operations · ${data.branch?.name ?? 'Assigned Campus'}`
            : cfg.heroSubtitle;

  const heroAvatarSrc = viewerAvatar?.trim() || cfg.images.heroAvatarUrl;
  const heroBgSrc = cfg.images.heroBannerBgUrl;

  const progressCardTitle =
    data.role === 'student'
      ? 'My Course Progress'
      : data.role === 'guardian'
        ? 'Children Course Progress'
        : 'Course Progress';

  const topListTitle =
    data.role === 'student'
      ? 'My Enrolled Courses'
      : data.role === 'guardian'
        ? 'Linked Children'
        : 'Top Students';

  const topListEmptyText =
    data.role === 'student'
      ? 'Enroll in a course to track progress here.'
      : data.role === 'guardian'
        ? 'Link a student by Roll Number to view progress.'
        : 'No student exam or course metrics recorded yet.';

  return (
    <div className="space-y-5">
      {/* ROW 0: FUTURISTIC ROLE-AWARE WELCOME HERO BANNER */}
      {cfg.widgets.heroBanner && (
        <div
          style={{
            backgroundImage: `linear-gradient(to right, ${cfg.colors.heroStart}, ${cfg.colors.heroMid}, ${cfg.colors.heroEnd})`,
          }}
          className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl sm:px-7 sm:py-5"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-cyan-300/25 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-28 w-72 rounded-full bg-blue-400/20 blur-2xl" />

          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-72 overflow-hidden lg:block">
            <img
              src={heroBgSrc}
              alt="Campus Banner Backdrop"
              className="h-full w-full object-cover opacity-75"
              referrerPolicy="no-referrer"
            />
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to right, ${cfg.colors.heroEnd}, ${cfg.colors.heroEnd}88, transparent)`,
              }}
            />
          </div>

          <div className="relative flex flex-col items-center justify-between gap-5 lg:flex-row">
            <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-cyan-300/70 bg-blue-900 shadow-lg sm:h-28 sm:w-28">
                <img
                  src={heroAvatarSrc}
                  alt={viewerName || 'Dashboard User Avatar'}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {data.role !== 'admin' || cfg.heroTitle === DEFAULT_DASHBOARD_CONFIG.heroTitle
                    ? data.role === 'admin'
                      ? cfg.heroTitle
                      : `Welcome Back, ${viewerName?.split(' ')[0] || 'Member'}!`
                    : cfg.heroTitle}
                </h1>
                <p className="mt-0.5 text-sm font-bold text-cyan-100">{heroSubtitle}</p>
                <p className="mt-1 text-xs italic text-blue-100/90">{cfg.heroQuote}</p>
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectSection(
                        data.role === 'teacher'
                          ? 'enrollments'
                          : data.role === 'branch'
                            ? 'enrollments'
                            : data.role === 'student'
                              ? 'my_learning'
                              : data.role === 'guardian'
                                ? 'guardian_monitor'
                                : cfg.heroCtaSection
                      )
                    }
                    style={{
                      backgroundColor: cfg.colors.heroButtonBg,
                      color: cfg.colors.heroButtonText,
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-extrabold shadow-md transition-transform hover:-translate-y-0.5 hover:opacity-95"
                  >
                    <span>
                      {data.role === 'teacher'
                        ? 'Open Student Roster'
                        : data.role === 'branch'
                          ? 'Manage Campus Admissions'
                          : data.role === 'student'
                            ? 'Open My Learning'
                            : data.role === 'guardian'
                              ? 'Child 360° Monitor'
                              : cfg.heroCtaLabel}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onQuickAction('open_storage')}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur-xs transition-colors hover:bg-white/25"
                  >
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>My Storage ({data.metrics.mediaCount ?? 0})</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="relative hidden pr-44 text-right lg:block">
              <p
                style={{ color: cfg.colors.heroMottoColor }}
                className="text-xl font-extrabold italic leading-snug drop-shadow-xs"
              >
                &ldquo;{cfg.heroMottoTop}
                <br />
                {cfg.heroMottoBottom}&rdquo;
              </p>
              <div
                className="mt-1.5 ml-auto h-1 w-28 rounded-full"
                style={{
                  backgroundImage: `linear-gradient(to right, ${cfg.colors.heroMottoColor}, #67E8F9)`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ROW 1: 4 VIVID GRADIENT KPI CARDS */}
      {cfg.widgets.kpiRow && (
        <FuturisticKpiGrid
          items={kpiCards}
          lang={lang}
          role={data.role}
          colors={cfg.colors}
          kpiLabels={cfg.kpiLabels}
          onCardClick={handleKpiClick}
        />
      )}

      {/* ROLE-SPECIFIC DYNAMIC WORKSPACE SPOTLIGHT */}
      {data.role === 'student' && (
        <div
          className={`grid grid-cols-1 gap-4 rounded-2xl border p-4 shadow-sm lg:grid-cols-12 ${
            darkMode
              ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
              : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
          }`}
        >
          <div className="lg:col-span-7 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-extrabold">
                <Play className="h-4 w-4 text-sky-500" />
                <span>Resume Active Courses</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('/learn')}
                className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-300"
              >
                Open Classroom →
              </button>
            </div>
            {(data.enrollments ?? []).length === 0 ? (
              <div className="flex items-center justify-between rounded-xl border border-dashed border-slate-300/80 p-3 text-xs">
                <span className="opacity-75">You are not enrolled in any active course yet.</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/courses')}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 font-bold text-white"
                >
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {(data.enrollments ?? []).slice(0, 2).map((enr) => {
                  const totalLes = (data.lessons ?? []).filter((l) => l.courseId === enr.courseId).length;
                  const pct = calculateStudentProgress(totalLes, enr.completedLessonIds);
                  return (
                    <div
                      key={enr.id}
                      className={`rounded-xl border p-3 ${
                        darkMode ? 'border-[#25365E] bg-[#132043]' : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-extrabold">{enr.courseTitle}</p>
                        <span className="tabular-nums text-[11px] font-extrabold text-emerald-600 dark:text-emerald-300">
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] opacity-75">
                        <span>
                          {enr.completedLessonIds?.length ?? 0}/{totalLes} lessons
                        </span>
                        <button
                          type="button"
                          onClick={() => onNavigate('/learn')}
                          className="font-bold text-blue-600 hover:underline dark:text-blue-300"
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-extrabold">Rewards, Assignments &amp; Photo</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-0.5 text-[11px] font-extrabold text-amber-700 dark:text-amber-300">
                <Flame className="h-3 w-3" /> {data.rewards?.streakDays ?? 0}d Streak
              </span>
            </div>
            <p className="text-xs opacity-80">
              Pending assignments: <strong>{(data.assignments ?? []).length - (data.assignmentSubmissions ?? []).length < 0 ? 0 : (data.assignments ?? []).length - (data.assignmentSubmissions ?? []).length}</strong> ·
              Certificates earned: <strong>{(data.certificates ?? []).length}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate('/learn')}
                className="rounded-lg bg-[#062436] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-600"
              >
                Upload Homework Photo
              </button>
              <button
                type="button"
                onClick={() => onSelectSection('profile')}
                className="rounded-lg border border-slate-300/70 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-white"
              >
                Update My Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Legacy branch manager banner removed; branch administration lives in Main Admin Branch Operations */}

      {data.role === 'guardian' && (
        <div
          className={`rounded-2xl border p-4 shadow-sm ${
            darkMode
              ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
              : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <GraduationCap className="h-4 w-4 text-blue-500" />
              <span>Linked Students Overview</span>
            </h2>
            <button
              type="button"
              onClick={() => onSelectSection('guardian_monitor')}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Link / View 360° Progress</span>
            </button>
          </div>

          {(data.children ?? []).length === 0 ? (
            <p className="mt-2.5 text-xs opacity-75">
              No students linked yet. Click &ldquo;Link / View 360° Progress&rdquo; to connect a student by Roll Number.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(data.children ?? []).map((child) => {
                const avg =
                  child.examAttempts.length > 0
                    ? Math.round(
                        child.examAttempts.reduce((s, a) => s + a.percentage, 0) /
                          child.examAttempts.length
                      )
                    : 0;
                const att = child.attendance ?? [];
                const present = att.filter((a) => a.status === 'present' || a.status === 'late').length;
                const attPct = att.length > 0 ? Math.round((present / att.length) * 100) : 100;

                return (
                  <div
                    key={child.student.id}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                      darkMode ? 'border-[#25365E] bg-[#132043]' : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {child.student.avatar ? (
                        <img
                          src={child.student.avatar}
                          alt={child.student.name}
                          referrerPolicy="no-referrer"
                          className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-blue-500/30"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-extrabold text-white">
                          {child.student.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold">{child.student.name}</p>
                        <p className="font-mono-tabular truncate text-[10px] opacity-70">
                          {child.student.rollNumber || child.student.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-[11px]">
                      <p className="tabular-nums font-extrabold text-emerald-600 dark:text-emerald-300">
                        Exam: {avg}%
                      </p>
                      <p className="tabular-nums opacity-75">Att: {attPct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {data.role === 'teacher' && (
        <div
          className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${
            darkMode
              ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
              : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold">Faculty Teaching &amp; Grading Desk</h2>
              <p className="text-xs opacity-75">
                Pending assignment reviews:{' '}
                <strong className="tabular-nums">{data.metrics.pendingSubmissions ?? 0}</strong> ·
                Scheduled live lessons:{' '}
                <strong className="tabular-nums">
                  {(data.lessons ?? []).filter((l) => l.lessonType === 'live').length}
                </strong>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectSection('lessons')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Go Live / Lessons</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('attendance_finance')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300/70 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/10"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>Take Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSection('exams')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#062436] px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-600"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Grade Scripts</span>
            </button>
          </div>
        </div>
      )}

      {/* ROW 2: ANALYTICS OVERVIEW + COURSE PROGRESS DONUT + LIVE CLASS NOW */}
      {(cfg.widgets.analyticsOverview || cfg.widgets.courseProgress || cfg.widgets.liveClassNow) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {cfg.widgets.analyticsOverview && (
            <div className="lg:col-span-5">
              <AnalyticsOverviewCard
                overview={analyticsOverview}
                range={range}
                onRangeChange={setRange}
                colors={cfg.colors}
                darkMode={darkMode}
              />
            </div>
          )}

          {cfg.widgets.courseProgress && (
            <div className="lg:col-span-4">
              <CourseProgressCard
                progress={courseProgress}
                title={progressCardTitle}
                colors={cfg.colors}
                darkMode={darkMode}
                onViewDetails={() =>
                  onSelectSection(
                    data.role === 'student'
                      ? 'my_learning'
                      : data.role === 'guardian'
                        ? 'guardian_monitor'
                        : 'enrollments'
                  )
                }
              />
            </div>
          )}

          {cfg.widgets.liveClassNow && (
            <div className="lg:col-span-3">
              <LiveClassSpotlightCard
                spotlight={liveSpotlight}
                colors={cfg.colors}
                bannerOverride={data.role === 'admin' ? cfg.images.liveClassBannerUrl : ''}
                onJoinClass={(item) => setLiveModal(item)}
              />
            </div>
          )}
        </div>
      )}

      {/* ROW 3: RECENT ACTIVITIES + UPCOMING CLASSES + TOP STUDENTS + QUICK ACTIONS */}
      {(cfg.widgets.recentActivities ||
        cfg.widgets.upcomingClasses ||
        cfg.widgets.topStudents ||
        cfg.widgets.quickActions) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
          {cfg.widgets.recentActivities && (
            <div className="xl:col-span-3">
              <RecentActivitiesCard
                items={recentActivities}
                darkMode={darkMode}
                onViewAll={() =>
                  onSelectSection(
                    data.role === 'admin'
                      ? 'attendance_finance'
                      : data.role === 'student'
                        ? 'my_learning'
                        : data.role === 'guardian'
                          ? 'guardian_monitor'
                          : 'enrollments'
                  )
                }
              />
            </div>
          )}

          {cfg.widgets.upcomingClasses && (
            <div className="xl:col-span-3">
              <UpcomingClassesCard
                rows={upcomingClasses}
                darkMode={darkMode}
                onViewCalendar={() =>
                  onSelectSection(
                    data.role === 'student'
                      ? 'my_learning'
                      : data.role === 'guardian'
                        ? 'guardian_monitor'
                        : 'lessons'
                  )
                }
              />
            </div>
          )}

          {cfg.widgets.topStudents && (
            <div className="xl:col-span-3">
              <TopStudentsProgressCard
                students={topStudents}
                title={topListTitle}
                emptyText={topListEmptyText}
                darkMode={darkMode}
                onViewAll={() =>
                  onSelectSection(
                    data.role === 'student'
                      ? 'my_learning'
                      : data.role === 'guardian'
                        ? 'guardian_monitor'
                        : 'enrollments'
                  )
                }
              />
            </div>
          )}

          {cfg.widgets.quickActions && (
            <div className="xl:col-span-3">
              <QuickActionsCard
                role={data.role}
                onTrigger={onQuickAction}
                canCustomize={canCustomize}
                darkMode={darkMode}
              />
            </div>
          )}
        </div>
      )}

      {/* ROW 4: ADMIN REAL-TIME SYSTEM ACTIVITY LOGS */}
      {data.role === 'admin' && cfg.widgets.systemActivityLogs !== false && (
        <SystemActivityLogsPanel
          compact
          darkMode={darkMode}
          initialLogs={auditLogs}
          onOpenFullView={() => onSelectSection('activity_logs')}
        />
      )}

      {/* Live Classroom Launch Modal */}
      {liveModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Live Class Classroom"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={liveModal.bannerImage}
                  alt={liveModal.title}
                  referrerPolicy="no-referrer"
                  className="h-12 w-16 rounded-xl object-cover"
                />
                <div>
                  <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-rose-700">
                    Live Classroom Ready
                  </span>
                  <h3 className="mt-1 text-base font-extrabold">{liveModal.title}</h3>
                  <p className="text-xs text-slate-500">
                    {liveModal.instructorName} · {liveModal.timeRange}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLiveModal(null)}
                aria-label="Close live classroom modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Launch the interactive Alom&apos;s English Center live stream &amp; lesson player, or manage your batch lessons and live links directly.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setLiveModal(null);
                  onNavigate('/learn');
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                <Video className="h-4 w-4" />
                <span>Enter Live Class</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLiveModal(null);
                  onSelectSection(
                    data.role === 'student'
                      ? 'my_learning'
                      : data.role === 'guardian'
                        ? 'guardian_monitor'
                        : 'lessons'
                  );
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{data.role === 'student' ? 'My Learning' : 'Manage Lessons'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
