import {
  ArrowRight,
  Award,
  BookMarked,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  FolderPlus,
  GraduationCap,
  HardDrive,
  Layers,
  PackagePlus,
  Play,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Wallet,
  Zap,
} from 'lucide-react';
import type {
  RecentActivityItem,
  TopStudentItem,
  UpcomingClassRow,
} from '../../lib/dashboardAnalytics';
import type { UserRole } from '../../types';

export type QuickActionType =
  | 'add_student'
  | 'add_teacher'
  | 'create_batch'
  | 'add_course'
  | 'add_post'
  | 'create_category'
  | 'course_from_post'
  | 'add_ebook'
  | 'add_product'
  | 'take_exam'
  | 'resume_learning'
  | 'my_batches'
  | 'my_profile'
  | 'open_storage'
  | 'child_monitor'
  | 'link_student'
  | 'branch_edit'
  | 'branch_finance'
  | 'mark_attendance'
  | 'add_lesson'
  | 'grade_scripts'
  | 'student_roster'
  | 'manage_enrollments'
  | 'customize';

/* ============================================================================
 * 1. RECENT ACTIVITIES CARD
 * ========================================================================== */
const TONE_COLORS = {
  emerald: 'bg-emerald-500 text-white',
  blue: 'bg-blue-600 text-white',
  purple: 'bg-violet-600 text-white',
  amber: 'bg-amber-500 text-white',
  teal: 'bg-teal-600 text-white',
};

export function RecentActivitiesCard({
  items,
  onViewAll,
  darkMode = false,
}: {
  items: RecentActivityItem[];
  onViewAll: () => void;
  darkMode?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
          : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Zap className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-extrabold">Recent Activities</h2>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-300"
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {items.length === 0 ? (
            <p className="py-6 text-center text-xs opacity-60">No recent activity logged yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${TONE_COLORS[item.tone]}`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                  </span>
                  <span className="truncate font-semibold">{item.text}</span>
                </div>
                <span className="shrink-0 text-[10px] font-medium opacity-60">{item.timeAgo}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 2. UPCOMING CLASSES CARD
 * ========================================================================== */
const DATE_PILL_STYLES = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-700/40',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700/40',
  purple: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-200 dark:border-violet-700/40',
};

export function UpcomingClassesCard({
  rows,
  onViewCalendar,
  darkMode = false,
}: {
  rows: UpcomingClassRow[];
  onViewCalendar: () => void;
  darkMode?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
          : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-300">
              <Calendar className="h-4 w-4" />
            </span>
            <h2 className="truncate text-sm font-extrabold">Upcoming Classes</h2>
          </div>
          <button
            type="button"
            onClick={onViewCalendar}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-300"
          >
            <span>Schedule</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-3.5 space-y-2.5">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-xs opacity-60">No scheduled sessions yet.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className={`flex items-center justify-between gap-2 rounded-xl border p-2 ${
                  darkMode ? 'border-[#25365E] bg-[#132043]' : 'border-slate-100 bg-slate-50/80'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border text-center leading-none ${DATE_PILL_STYLES[row.tone]}`}
                  >
                    <span className="text-[9px] font-bold uppercase">{row.monthShort}</span>
                    <span className="tabular-nums mt-0.5 text-xs font-extrabold">{row.dayNum}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold">{row.title}</p>
                    <p className="truncate text-[10px] opacity-65">{row.instructorBy}</p>
                  </div>
                </div>

                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold ${DATE_PILL_STYLES[row.tone]}`}
                >
                  <span className="tabular-nums max-w-[78px] truncate">{row.timeText}</span>
                  <Video className="h-3 w-3" />
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. TOP STUDENTS / COURSE / CHILDREN PROGRESS CARD
 * ========================================================================== */
const MEDAL_BADGES = [
  'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950',
  'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900',
  'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950',
];

const BAR_GRADIENTS = [
  'from-emerald-400 to-emerald-600',
  'from-blue-500 to-indigo-600',
  'from-amber-400 to-orange-500',
];

export function TopStudentsProgressCard({
  students,
  title = 'Top Students',
  emptyText = 'No progress records yet.',
  onViewAll,
  darkMode = false,
}: {
  students: TopStudentItem[];
  title?: string;
  emptyText?: string;
  onViewAll: () => void;
  darkMode?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
          : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
              <Award className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-extrabold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-300"
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        <div className="mt-3.5 space-y-3">
          {students.length === 0 ? (
            <p className="py-6 text-center text-xs opacity-60">{emptyText}</p>
          ) : (
            students.slice(0, 3).map((stu, idx) => (
              <div key={stu.id} className="flex items-center justify-between gap-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold shadow-xs ${
                      MEDAL_BADGES[idx % MEDAL_BADGES.length]
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <img
                    src={stu.avatar}
                    alt={stu.name}
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 shrink-0 rounded-full object-cover ring-2 ring-blue-500/20"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold">{stu.name}</p>
                    <p className="truncate text-[10px] opacity-65">{stu.subtitle}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-[#1D2D57]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${BAR_GRADIENTS[idx % BAR_GRADIENTS.length]}`}
                      style={{ width: `${stu.marks}%` }}
                    />
                  </div>
                  <span className="tabular-nums w-8 text-right text-xs font-extrabold">
                    {stu.marks}%
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. ROLE-BASED QUICK ACTIONS WORKFLOW GRID
 * ========================================================================== */
interface QuickActionItem {
  id: QuickActionType;
  label: string;
  icon: typeof Users;
  bg: string;
}

const ADMIN_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'add_student', label: 'Add Student', icon: UserPlus, bg: 'from-sky-50 to-blue-100 text-blue-800 border-blue-200' },
  { id: 'add_teacher', label: 'Add Teacher', icon: Users, bg: 'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200' },
  { id: 'create_batch', label: 'New Batch', icon: Layers, bg: 'from-violet-50 to-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'add_course', label: 'Add Course', icon: BookOpen, bg: 'from-amber-50 to-orange-100 text-orange-800 border-orange-200' },
  { id: 'add_post', label: 'Add Post', icon: FilePlus2, bg: 'from-cyan-50 to-sky-100 text-cyan-800 border-cyan-200' },
  { id: 'create_category', label: 'New Category', icon: FolderPlus, bg: 'from-fuchsia-50 to-pink-100 text-pink-800 border-pink-200' },
  { id: 'course_from_post', label: 'Post to Course', icon: Sparkles, bg: 'from-indigo-50 to-violet-100 text-violet-800 border-violet-200' },
  { id: 'add_ebook', label: 'Add E-Book', icon: BookMarked, bg: 'from-lime-50 to-emerald-100 text-emerald-800 border-emerald-200' },
  { id: 'add_product', label: 'Add Product', icon: PackagePlus, bg: 'from-rose-50 to-orange-100 text-rose-800 border-rose-200' },
  { id: 'open_storage', label: 'My Storage', icon: HardDrive, bg: 'from-blue-50 to-cyan-100 text-sky-800 border-sky-200' },
];

const STUDENT_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'resume_learning', label: 'Continue Class', icon: Play, bg: 'from-sky-50 to-blue-100 text-blue-800 border-blue-200' },
  { id: 'take_exam', label: 'Take Live Exam', icon: ClipboardCheck, bg: 'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200' },
  { id: 'my_batches', label: 'My Courses & XP', icon: GraduationCap, bg: 'from-violet-50 to-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'open_storage', label: 'My Storage', icon: HardDrive, bg: 'from-amber-50 to-orange-100 text-orange-800 border-orange-200' },
  { id: 'my_profile', label: 'Photo & Profile', icon: UserCheck, bg: 'from-cyan-50 to-sky-100 text-cyan-800 border-cyan-200' },
  { id: 'add_post', label: 'Community Hub', icon: Sparkles, bg: 'from-rose-50 to-orange-100 text-rose-800 border-rose-200' },
];

const BRANCH_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'manage_enrollments', label: 'Approve Fees', icon: UserCheck, bg: 'from-sky-50 to-blue-100 text-blue-800 border-blue-200' },
  { id: 'create_batch', label: 'New Batch', icon: Layers, bg: 'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200' },
  { id: 'mark_attendance', label: 'Attendance & P&L', icon: CalendarCheck, bg: 'from-violet-50 to-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'my_profile', label: 'Account Profile', icon: UserPlus, bg: 'from-amber-50 to-orange-100 text-orange-800 border-orange-200' },
  { id: 'branch_edit', label: 'Campus & Photo', icon: Building2, bg: 'from-cyan-50 to-sky-100 text-cyan-800 border-cyan-200' },
  { id: 'open_storage', label: 'My Storage', icon: HardDrive, bg: 'from-rose-50 to-orange-100 text-rose-800 border-rose-200' },
];

const GUARDIAN_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'child_monitor', label: 'Child 360° Report', icon: GraduationCap, bg: 'from-sky-50 to-blue-100 text-blue-800 border-blue-200' },
  { id: 'link_student', label: 'Link Child Roll', icon: UserPlus, bg: 'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200' },
  { id: 'take_exam', label: 'Exam Scorecards', icon: ClipboardCheck, bg: 'from-violet-50 to-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'open_storage', label: 'My Storage', icon: HardDrive, bg: 'from-amber-50 to-orange-100 text-orange-800 border-orange-200' },
  { id: 'my_profile', label: 'Photo & Profile', icon: UserCheck, bg: 'from-cyan-50 to-sky-100 text-cyan-800 border-cyan-200' },
  { id: 'branch_finance', label: 'Fee Receipts', icon: Wallet, bg: 'from-rose-50 to-orange-100 text-rose-800 border-rose-200' },
];

const TEACHER_QUICK_ACTIONS: QuickActionItem[] = [
  { id: 'add_lesson', label: 'Live & Lessons', icon: Video, bg: 'from-sky-50 to-blue-100 text-blue-800 border-blue-200' },
  { id: 'grade_scripts', label: 'Grade Scripts', icon: ClipboardCheck, bg: 'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200' },
  { id: 'student_roster', label: 'Student Roster', icon: Users, bg: 'from-violet-50 to-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'mark_attendance', label: 'Take Attendance', icon: CalendarCheck, bg: 'from-amber-50 to-orange-100 text-orange-800 border-orange-200' },
  { id: 'open_storage', label: 'My Storage', icon: HardDrive, bg: 'from-cyan-50 to-sky-100 text-cyan-800 border-cyan-200' },
  { id: 'my_profile', label: 'Faculty Profile', icon: UserCheck, bg: 'from-rose-50 to-orange-100 text-rose-800 border-rose-200' },
];

export function QuickActionsCard({
  role = 'admin',
  onTrigger,
  canCustomize = false,
  darkMode = false,
}: {
  role?: UserRole;
  onTrigger: (action: QuickActionType) => void;
  canCustomize?: boolean;
  darkMode?: boolean;
}) {
  const items =
    role === 'student'
      ? STUDENT_QUICK_ACTIONS
      : role === 'guardian'
        ? GUARDIAN_QUICK_ACTIONS
        : role === 'teacher'
          ? TEACHER_QUICK_ACTIONS
          : role === 'branch'
            ? BRANCH_QUICK_ACTIONS
            : ADMIN_QUICK_ACTIONS;

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-4 shadow-sm ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
          : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-300">
              <Rocket className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-extrabold">Quick Actions</h2>
          </div>
          {canCustomize && (
            <button
              type="button"
              onClick={() => onTrigger('customize')}
              aria-label="Customize dashboard layout"
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Customize</span>
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTrigger(item.id)}
                className={`flex items-center gap-1.5 rounded-xl border bg-gradient-to-br px-2 py-2 text-left text-[11px] font-extrabold shadow-2xs transition-transform hover:-translate-y-0.5 ${item.bg}`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
