import {
  Archive,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { resolveCourseCategories } from '../../lib/batchEnterprise';
import {
  type CourseAnalyticsSummary,
  COURSE_TEMPLATES,
  isCourseStatusLive,
} from '../../lib/courseEnterprise';
import { calculateDiscountedPrice } from '../../lib/domain';
import type { AuditLogEntry, Course, CourseBatch, Instructor, UserRole } from '../../types';

interface CourseEnterpriseDashboardProps {
  courses: Course[];
  batches: CourseBatch[];
  enrollmentsCount: number;
  instructors: Instructor[];
  userRole: UserRole;
  darkMode?: boolean;
  onOpenWizard: (
    course: Course | null,
    templateDefaults?: Partial<Course> | null,
    sampleModules?: string[]
  ) => void;
  onOpenCurriculum: (course: Course) => void;
  onToggleStatus: (course: Course) => Promise<void>;
  onDuplicateCourse: (course: Course) => Promise<void>;
  onArchiveToggle: (course: Course) => Promise<void>;
  onDeleteCourse: (courseId: string) => Promise<void>;
  onNavigate: (path: string) => void;
  onManageCategories?: () => void;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const PAGE_SIZE = 6;

export function CourseEnterpriseDashboard({
  courses,
  batches,
  instructors,
  userRole,
  darkMode = false,
  onOpenWizard,
  onOpenCurriculum,
  onToggleStatus,
  onDuplicateCourse,
  onArchiveToggle,
  onDeleteCourse,
  onNavigate,
  onManageCategories,
  onRefresh,
  onNotify,
}: CourseEnterpriseDashboardProps) {
  const { bootstrap, apiFetch, token } = useAuth();
  const dynamicCategories = resolveCourseCategories(bootstrap?.categories ?? [], courses);
  const [summary, setSummary] = useState<CourseAnalyticsSummary | null>(null);
  const [activities, setActivities] = useState<AuditLogEntry[]>([]);
  const [chartMetric, setChartMetric] = useState<'enrollments' | 'revenue'>('enrollments');

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modals: Templates & Bulk Import
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkInput, setBulkInput] = useState(
    'Academic Paragraph & Essay Clinic | HSC English | 1490 | 2200 | HSC 27 | published | Board-standard freehand writing mastery\nSpoken Phonetics Intensive | IELTS & Spoken | 1890 | 2800 | Spoken | draft | Fluency & pronunciation lab'
  );
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErr, setBulkErr] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiFetch<{
        summary: CourseAnalyticsSummary;
        recentActivities: AuditLogEntry[];
      }>('/api/portal/courses/analytics');
      setSummary(res.summary);
      setActivities(res.recentActivities ?? []);
    } catch {
      // Keep UI functional using props if analytics endpoint is busy
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics, courses.length]);

  const q = search.trim().toLowerCase();
  const filteredCourses = courses.filter((c) => {
    if (statusFilter === 'live') {
      if (!isCourseStatusLive(c.status)) return false;
    } else if (statusFilter !== 'all' && c.status !== statusFilter) {
      return false;
    }
    if (categoryFilter === 'combos') {
      if (!c.isCombo) return false;
    } else if (categoryFilter !== 'all' && c.category !== categoryFilter) {
      return false;
    }
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.levelTag.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredCourses.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedCourses = filteredCourses.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const handleExportCsv = async () => {
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/portal/courses/export-csv', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('CSV export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aec-courses-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Exported courses CSV report.');
    } catch {
      onNotify('Unable to export CSV report.');
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkErr(null);
    setBulkBusy(true);
    try {
      const res = await apiFetch<{ importedCount: number; errors: string[] }>(
        '/api/portal/courses/bulk-import',
        {
          method: 'POST',
          body: JSON.stringify({ rawInput: bulkInput }),
        }
      );
      setBulkOpen(false);
      await Promise.all([onRefresh(), loadAnalytics()]);
      onNotify(`Imported ${res.importedCount} course(s) successfully.`);
    } catch (err) {
      setBulkErr(err instanceof Error ? err.message : 'Bulk import failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const chartItems = (summary?.popularCourses ?? []).slice(0, 6);
  const maxVal = Math.max(
    1,
    ...chartItems.map((item) => (chartMetric === 'enrollments' ? item.enrollments : item.revenue))
  );

  const surfaceClass = darkMode
    ? 'border-[#1E2E52] bg-[#0F1B3B] text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';

  const instMap = new Map(instructors.map((i) => [i.id, i.name]));

  return (
    <div className="space-y-6">
      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          {
            label: 'Total Courses',
            val: summary?.totalCourses ?? courses.length,
            tone: 'text-slate-900 dark:text-white',
          },
          {
            label: 'Published / Active',
            val:
              summary?.publishedCourses ?? courses.filter((c) => isCourseStatusLive(c.status)).length,
            tone: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Drafts',
            val: summary?.draftCourses ?? courses.filter((c) => c.status === 'draft').length,
            tone: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Unpublished',
            val:
              summary?.unpublishedCourses ??
              courses.filter((c) => c.status === 'unpublished').length,
            tone: 'text-slate-600 dark:text-slate-300',
          },
          {
            label: 'Archived',
            val: summary?.archivedCourses ?? courses.filter((c) => c.status === 'archived').length,
            tone: 'text-rose-600 dark:text-rose-400',
          },
          {
            label: 'Enrollments',
            val: (summary?.totalEnrollments ?? 0).toLocaleString(),
            tone: 'text-indigo-600 dark:text-indigo-400',
          },
          {
            label: 'Course Revenue',
            val: `৳${(summary?.courseRevenue ?? 0).toLocaleString()}`,
            tone: 'text-sky-600 dark:text-sky-400',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`rounded-2xl border p-4 shadow-xs ${surfaceClass}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{kpi.label}</p>
            <p className={`font-mono-tabular mt-1 text-xl font-extrabold ${kpi.tone}`}>{kpi.val}</p>
          </div>
        ))}
      </div>

      {/* Interactive Analytics + Popular & Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={`rounded-2xl border p-5 shadow-xs lg:col-span-7 ${surfaceClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-extrabold">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                <span>Course Performance Analytics</span>
              </h3>
              <p className="text-[11px] opacity-70">
                Avg Completion Rate:{' '}
                <strong className="font-mono-tabular">{summary?.avgCompletionRate ?? 0}%</strong> ·{' '}
                Certificates Issued:{' '}
                <strong className="font-mono-tabular">
                  {summary?.totalCertificatesIssued ?? 0}
                </strong>
              </p>
            </div>
            <div className="flex gap-1.5 rounded-xl border border-slate-200 p-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setChartMetric('enrollments')}
                className={`rounded-lg px-2.5 py-1 ${
                  chartMetric === 'enrollments' ? 'bg-indigo-600 text-white' : 'opacity-70'
                }`}
              >
                Enrollments
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('revenue')}
                className={`rounded-lg px-2.5 py-1 ${
                  chartMetric === 'revenue' ? 'bg-indigo-600 text-white' : 'opacity-70'
                }`}
              >
                Revenue
              </button>
            </div>
          </div>

          {chartItems.length === 0 ? (
            <p className="py-12 text-center text-xs opacity-60">No course telemetry available yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <svg
                viewBox="0 0 600 175"
                role="img"
                aria-label="Course Analytics Bar Chart"
                className="h-44 w-full overflow-visible"
              >
                {chartItems.map((item, i) => {
                  const val = chartMetric === 'enrollments' ? item.enrollments : item.revenue;
                  const barH = Math.max(8, Math.round((val / maxVal) * 115));
                  const x = 22 + i * 96;
                  const y = 135 - barH;
                  return (
                    <g key={item.courseId}>
                      <rect
                        x={x}
                        y={y}
                        width={56}
                        height={barH}
                        rx={8}
                        fill={chartMetric === 'enrollments' ? '#4F46E5' : '#0EA5E9'}
                      />
                      <text
                        x={x + 28}
                        y={y - 6}
                        textAnchor="middle"
                        className="fill-current text-[10px] font-bold"
                      >
                        {chartMetric === 'revenue' ? `৳${val}` : val}
                      </text>
                      <text
                        x={x + 28}
                        y={155}
                        textAnchor="middle"
                        className="fill-current text-[10px] opacity-70"
                      >
                        {item.title.slice(0, 11)}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Category Breakdown */}
              <div className="grid grid-cols-1 gap-2 border-t border-slate-200/70 pt-3 sm:grid-cols-3">
                {(summary?.categoryBreakdown ?? []).slice(0, 3).map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2 text-xs dark:bg-[#09122B]"
                  >
                    <p className="font-bold">{cat.category}</p>
                    <p className="font-mono-tabular text-[11px] opacity-75">
                      {cat.courses} courses · {cat.enrollments} seats
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Popular Courses & Recent Course Activities */}
        <div className={`rounded-2xl border p-5 shadow-xs lg:col-span-5 ${surfaceClass}`}>
          <h3 className="text-sm font-extrabold">Recent Course &amp; Curriculum Activities</h3>
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 text-xs">
            {activities.length === 0 ? (
              <p className="py-8 text-center opacity-60">No recent course activity logged yet.</p>
            ) : (
              activities.slice(0, 8).map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2 dark:bg-[#09122B]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-indigo-600 dark:text-cyan-300">
                      {act.action}
                    </span>
                    <span className="font-mono-tabular text-[10px] opacity-60">
                      {new Date(act.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate font-semibold">{act.target}</p>
                  <p className="truncate text-[11px] opacity-75">
                    {act.actorName} · {act.details}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Enterprise Course Directory Card */}
      <div className={`print-sheet rounded-2xl border p-6 shadow-xs ${surfaceClass}`}>
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">
              Enterprise Course Catalog &amp; Lifecycle Manager ({filteredCourses.length})
            </h2>
            <p className="mt-0.5 text-xs opacity-70">
              Create with 5-step wizard, manage drag-and-drop modules, import/export, or archive courses.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setTemplatesOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Templates</span>
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Bulk Import</span>
            </button>
            {onManageCategories && userRole === 'admin' && (
              <button
                type="button"
                onClick={onManageCategories}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Manage Categories</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenWizard(null, null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              <Plus className="h-4 w-4" />
              <span>New Course Wizard</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="no-print mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug, category, tag..."
              aria-label="Search enterprise courses"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter courses by category"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 sm:col-span-3"
          >
            <option value="all">All Categories</option>
            <option value="combos">Combos Only</option>
            {dynamicCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter courses by status"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 sm:col-span-3"
          >
            <option value="all">All Statuses</option>
            <option value="live">Published &amp; Active (Live)</option>
            <option value="draft">Draft</option>
            <option value="unpublished">Unpublished</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Courses Table */}
        <div className="mt-5 overflow-x-auto">
          {paginatedCourses.length === 0 ? (
            <p className="py-10 text-center text-xs opacity-65">No courses match your filters.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                  <th className="py-2.5 pr-4">Course &amp; Delivery</th>
                  <th className="py-2.5 pr-4">Category &amp; Faculty</th>
                  <th className="py-2.5 pr-4">Pricing</th>
                  <th className="py-2.5 pr-4">Batches &amp; Seats</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="no-print py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCourses.map((c) => {
                  const pricing = calculateDiscountedPrice(c.price, c.originalPrice);
                  const cBatches = batches.filter((b) => b.courseId === c.id);
                  const isLive = isCourseStatusLive(c.status);
                  const isConfirming = confirmDeleteId === c.id;
                  const instNames = (c.instructorIds ?? [])
                    .map((id) => instMap.get(id) || id)
                    .slice(0, 2)
                    .join(', ');

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={c.thumbnail}
                            alt={c.title}
                            className="h-11 w-16 shrink-0 rounded-lg border border-slate-200 object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-bold">{c.title}</p>
                            <p className="text-[11px] opacity-70">
                              {c.courseType || 'Hybrid'} · {c.level || c.levelTag} ·{' '}
                              <button
                                type="button"
                                onClick={() => onNavigate(`/course/${c.slug}`)}
                                className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline"
                              >
                                <span>/{c.slug}</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </button>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <p className="font-semibold">{c.category}</p>
                        <p className="truncate text-[11px] opacity-70">{instNames || 'AEC Faculty'}</p>
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-xs">
                        <p className="font-extrabold">
                          {c.isFree || c.price === 0 ? 'Free' : `৳${c.price}`}
                        </p>
                        {pricing.baseDiscountPercent > 0 && (
                          <p className="text-[11px] text-emerald-700">-{pricing.baseDiscountPercent}%</p>
                        )}
                      </td>
                      <td className="font-mono-tabular py-3 pr-4 text-xs">
                        <p className="font-bold">
                          <Users className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                          {c.enrolledCount.toLocaleString()}
                        </p>
                        <p className="text-[11px] opacity-70">{cBatches.length} batch(es)</p>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => onToggleStatus(c)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${
                            isLive
                              ? 'bg-emerald-50 text-emerald-700'
                              : c.status === 'archived'
                                ? 'bg-rose-50 text-rose-700'
                                : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isLive ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                          <span>{c.status}</span>
                        </button>
                      </td>
                      <td className="no-print py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onOpenWizard(c, null)}
                            aria-label={`Edit wizard for ${c.title}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Wizard</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenCurriculum(c)}
                            aria-label={`Curriculum builder for ${c.title}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            <Layers className="h-3 w-3" />
                            <span>Curriculum</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateCourse(c)}
                            aria-label={`Duplicate ${c.title}`}
                            title="Duplicate Course"
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-indigo-700"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onArchiveToggle(c)}
                            aria-label={
                              c.status === 'archived'
                                ? `Restore ${c.title}`
                                : `Archive ${c.title}`
                            }
                            title={c.status === 'archived' ? 'Restore Course' : 'Archive Course'}
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:text-amber-700"
                          >
                            {c.status === 'archived' ? (
                              <RotateCcw className="h-3.5 w-3.5" />
                            ) : (
                              <Archive className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {userRole === 'admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (!isConfirming) {
                                  setConfirmDeleteId(c.id);
                                  return;
                                }
                                setConfirmDeleteId(null);
                                void onDeleteCourse(c.id);
                              }}
                              aria-label={`Delete ${c.title}`}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold ${
                                isConfirming
                                  ? 'bg-rose-600 text-white'
                                  : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isConfirming && <span>Confirm</span>}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="no-print mt-4 flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
            <span className="font-mono-tabular font-semibold opacity-70">
              Page {safePage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-300 px-3 py-1 font-bold disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-300 px-3 py-1 font-bold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Templates Picker Modal */}
      {templatesOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Course Blueprint Templates"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-extrabold">Launch Course from Blueprint Template</h3>
              </div>
              <button
                type="button"
                onClick={() => setTemplatesOpen(false)}
                aria-label="Close templates modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {COURSE_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-extrabold text-slate-900">{tpl.name}</h4>
                    <p className="mt-0.5 text-xs text-slate-600">{tpl.description}</p>
                    <p className="mt-1 text-[11px] font-semibold text-indigo-700">
                      Includes {tpl.sampleModules.length} starter modules
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplatesOpen(false);
                      onOpenWizard(null, { ...tpl.defaults, title: tpl.name }, tpl.sampleModules);
                    }}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                  >
                    Use Blueprint
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {bulkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bulk Import Courses"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
        >
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="text-base font-extrabold">Bulk Import Courses (CSV / Pipe / JSON)</h3>
              </div>
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                aria-label="Close bulk import"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleBulkImport} className="mt-4 space-y-3 text-xs">
              <p className="text-slate-600">
                Format: <code>Title | Category | Price | OriginalPrice | LevelTag | Status | Subtitle</code>{' '}
                or paste a JSON array.
              </p>
              <textarea
                rows={7}
                value={bulkInput}
                onChange={(e) => setBulkInput(e.target.value)}
                className="font-mono-tabular w-full rounded-xl border border-slate-300 p-3 text-xs"
              />
              {bulkErr && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-700">{bulkErr}</p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBulkOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{bulkBusy ? 'Importing...' : 'Import Courses'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
