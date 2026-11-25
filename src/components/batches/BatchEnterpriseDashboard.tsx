import {
  Activity,
  BarChart3,
  Calendar,
  Download,
  ExternalLink,
  Layers,
  Pencil,
  Plus,
  Printer,
  Search,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  BATCH_LIFECYCLE_LABELS,
  computeBatchDashboardAnalytics,
  normalizeBatchLifecycle,
} from '../../lib/batchEnterprise';
import { computeBatchSeatUsage } from '../../lib/domain';
import type {
  AttendanceRecord,
  BatchActivityLog,
  BatchLifecycleStatus,
  Branch,
  Course,
  CourseBatch,
  Enrollment,
  Instructor,
  PaymentTransaction,
  UserRole,
} from '../../types';

interface BatchEnterpriseDashboardProps {
  batches: CourseBatch[];
  courses: Course[];
  branches: Branch[];
  instructors: Instructor[];
  enrollments: Enrollment[];
  attendance: AttendanceRecord[];
  transactions: PaymentTransaction[];
  userRole: UserRole;
  darkMode?: boolean;
  onOpenWizard: (batch: CourseBatch | null) => void;
  onOpenDetail: (batchId: string) => void;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const LIFECYCLE_BADGE: Record<BatchLifecycleStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  upcoming: 'bg-sky-50 text-sky-700 border-sky-200',
  enrollment_open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  enrollment_closed: 'bg-amber-50 text-amber-800 border-amber-200',
  active: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  completed: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  archived: 'bg-slate-200 text-slate-600 border-slate-300',
};

export function BatchEnterpriseDashboard({
  batches,
  courses,
  branches,
  instructors,
  enrollments,
  attendance,
  transactions,
  userRole,
  darkMode = false,
  onOpenWizard,
  onOpenDetail,
  onNotify,
}: BatchEnterpriseDashboardProps) {
  const { apiFetch, token } = useAuth();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modeFilter, setModeFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [teacherFilter, setTeacherFilter] = useState('all');
  const [recentActivities, setRecentActivities] = useState<BatchActivityLog[]>([]);
  const [upcomingSchedule, setUpcomingSchedule] = useState<
    {
      batchId: string;
      batchName: string;
      batchCode: string;
      courseTitle: string;
      instructorName: string;
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      mode: string;
    }[]
  >([]);
  const [waitlistCounts, setWaitlistCounts] = useState<Record<string, number>>({});

  const loadDashboardMeta = useCallback(async () => {
    try {
      const res = await apiFetch<{
        recentActivities: BatchActivityLog[];
        upcomingSchedule: typeof upcomingSchedule;
        waitlistCounts: Record<string, number>;
      }>('/api/portal/batches/dashboard');
      setRecentActivities(res.recentActivities ?? []);
      setUpcomingSchedule(res.upcomingSchedule ?? []);
      setWaitlistCounts(res.waitlistCounts ?? {});
    } catch {
      // Fall back gracefully to local computed analytics
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadDashboardMeta();
  }, [loadDashboardMeta, batches.length]);

  const analytics = computeBatchDashboardAnalytics({
    batches,
    courses,
    enrollments,
    attendance,
    transactions,
  });

  const q = search.trim().toLowerCase();
  const filteredBatches = batches.filter((b) => {
    const lc = normalizeBatchLifecycle(b);
    if (courseFilter !== 'all' && b.courseId !== courseFilter) return false;
    if (statusFilter !== 'all' && lc !== statusFilter) return false;
    if (modeFilter !== 'all' && b.mode !== modeFilter) return false;
    if (branchFilter !== 'all' && b.branchId !== branchFilter) return false;
    if (teacherFilter !== 'all' && b.instructorId !== teacherFilter && b.assistantInstructorId !== teacherFilter) {
      return false;
    }
    if (!q) return true;
    return (
      b.name.toLowerCase().includes(q) ||
      b.code.toLowerCase().includes(q) ||
      b.schedule.toLowerCase().includes(q)
    );
  });

  const handleExportComparison = async () => {
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch('/api/portal/batches/export-comparison', {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aec-batch-comparison-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Exported batch comparison CSV report.');
    } catch {
      onNotify('Unable to export comparison CSV.');
    }
  };

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  const kpiList = [
    { label: 'Total Batches', value: analytics.kpis.totalBatches },
    { label: 'Active Batches', value: analytics.kpis.activeBatches },
    { label: 'Upcoming Batches', value: analytics.kpis.upcomingBatches },
    { label: 'Completed Batches', value: analytics.kpis.completedBatches },
    { label: 'Cancelled Batches', value: analytics.kpis.cancelledBatches },
    { label: 'Enrolled Students', value: analytics.kpis.totalEnrolledStudents },
    { label: 'Available Seats', value: analytics.kpis.availableSeats },
    { label: 'Full Batches', value: analytics.kpis.fullBatches },
    { label: 'Assigned Teachers', value: analytics.kpis.totalAssignedTeachers },
    { label: "Today's Classes", value: analytics.kpis.todaysClasses },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Grid (10 Metrics) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {kpiList.map((k) => (
          <div key={k.label} className={`rounded-xl border p-4 ${surface}`}>
            <p className={`text-xs font-medium ${muted}`}>{k.label}</p>
            <p className="font-mono tabular-nums mt-1.5 text-2xl font-bold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Analytics Row: Capacity Bars + Upcoming Classes + Recent Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={`rounded-2xl border p-5 lg:col-span-5 ${surface}`}>
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <span>Batch Capacity Utilization</span>
            </h3>
            <span className={`text-xs ${muted}`}>Top {Math.min(5, batches.length)} batches</span>
          </div>
          <div className="mt-4 space-y-3">
            {analytics.comparisonRows.slice(0, 5).map((row) => (
              <div key={row.batchId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-semibold">{row.name}</span>
                  <span className="font-mono tabular-nums shrink-0 font-semibold">
                    {row.enrolledSeats}/{row.seatLimit} ({row.fillPercent}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full transition-all ${
                      row.fillPercent >= 95
                        ? 'bg-rose-600'
                        : row.fillPercent >= 70
                          ? 'bg-indigo-600'
                          : 'bg-emerald-600'
                    }`}
                    style={{ width: `${row.fillPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 lg:col-span-4 ${surface}`}>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Calendar className="h-4 w-4 text-indigo-600" />
            <span>Upcoming Class Schedule</span>
          </h3>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {upcomingSchedule.length === 0 ? (
              <p className={`py-4 text-xs ${muted}`}>No upcoming scheduled slots yet.</p>
            ) : (
              upcomingSchedule.slice(0, 6).map((slot, i) => (
                <button
                  key={`${slot.batchId}-${i}`}
                  type="button"
                  onClick={() => onOpenDetail(slot.batchId)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 px-3 py-2 text-left text-xs hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{slot.batchName}</p>
                    <p className={`truncate ${muted}`}>
                      {slot.dayOfWeek} · {slot.startTime}–{slot.endTime} · {slot.instructorName}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums shrink-0 text-[11px] font-semibold text-indigo-600">
                    {slot.batchCode}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 lg:col-span-3 ${surface}`}>
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <Activity className="h-4 w-4 text-indigo-600" />
            <span>Recent Batch Activity</span>
          </h3>
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {recentActivities.length === 0 ? (
              <p className={`py-4 text-xs ${muted}`}>No batch activity recorded yet.</p>
            ) : (
              recentActivities.slice(0, 6).map((log) => (
                <div key={log.id} className="border-b border-slate-100 pb-2 text-xs last:border-b-0">
                  <p className="font-semibold text-slate-800">{log.action.replace(/_/g, ' ')}</p>
                  <p className={`line-clamp-2 ${muted}`}>{log.details}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Batch Table & Filters */}
      <div className={`rounded-2xl border p-6 ${surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">
              {userRole === 'teacher'
                ? 'Teacher Batch Portal — Assigned Batches & Routine'
                : 'Enterprise Batch Management'}
            </h2>
            <p className={`mt-0.5 text-xs ${muted}`}>
              Manage batch lifecycles, conflict-free routines, capacity, student transfers, attendance &amp; reports
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportComparison}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Comparison CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print PDF</span>
            </button>
            {(userRole === 'admin' || userRole === 'branch') && (
              <button
                type="button"
                onClick={() => onOpenWizard(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                <Plus className="h-4 w-4" />
                <span>Create Batch Wizard</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Filter Bar */}
        <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
          <div className="relative sm:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search batch name, code, routine..."
              aria-label="Search batches"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900"
            />
          </div>
          <select
            aria-label="Filter by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by lifecycle status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all">All Statuses</option>
            {(Object.keys(BATCH_LIFECYCLE_LABELS) as BatchLifecycleStatus[]).map((st) => (
              <option key={st} value={st}>
                {BATCH_LIFECYCLE_LABELS[st]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by mode"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all">All Modes</option>
            <option value="Online Live">Online Live</option>
            <option value="Offline Branch">Offline Branch</option>
            <option value="Hybrid">Hybrid</option>
          </select>
          <select
            aria-label="Filter by teacher"
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
          >
            <option value="all">All Teachers</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          {branches.length > 1 && (
            <select
              aria-label="Filter by branch"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="sm:col-span-3 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold text-slate-800"
            >
              <option value="all">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Batches Table */}
        <div className="mt-5 overflow-x-auto">
          {filteredBatches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center">
              <Layers className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No batches match your filters</p>
              <p className="text-xs text-slate-500">
                Try clearing filters or create a new batch for any course.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-3 pr-4">Batch &amp; Course</th>
                  <th className="py-3 pr-4">Faculty &amp; Branch</th>
                  <th className="py-3 pr-4">Schedule &amp; Mode</th>
                  <th className="py-3 pr-4">Capacity &amp; Waitlist</th>
                  <th className="py-3 pr-4">Lifecycle</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((bat) => {
                  const course = courses.find((c) => c.id === bat.courseId);
                  const branch = branches.find((br) => br.id === bat.branchId);
                  const inst = instructors.find((i) => i.id === bat.instructorId);
                  const seats = computeBatchSeatUsage(bat);
                  const lc = normalizeBatchLifecycle(bat);
                  const waitCount = waitlistCounts[bat.id] ?? 0;
                  return (
                    <tr key={bat.id} className="hover:bg-slate-50/70">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums font-bold text-indigo-700">
                            {bat.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-slate-900">{bat.name}</span>
                        </div>
                        <p className={`mt-0.5 ${muted}`}>{course?.title || 'Unlinked Course'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-800">{inst?.name || 'Faculty'}</p>
                        <p className={muted}>{branch?.name || 'Online'}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-800">{bat.schedule}</p>
                        <p className={muted}>
                          {bat.mode} · Starts <span className="font-mono tabular-nums">{bat.startDate}</span>
                        </p>
                      </td>
                      <td className="py-3 pr-4 min-w-[160px]">
                        <div className="flex items-center justify-between font-mono tabular-nums text-[11px] font-semibold">
                          <span>
                            {bat.enrolledSeats}/{bat.seatLimit}
                          </span>
                          <span>
                            {seats.remainingSeats} left{waitCount > 0 ? ` · ${waitCount} wait` : ''}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${seats.isFull ? 'bg-rose-600' : 'bg-indigo-600'}`}
                            style={{ width: `${seats.fillPercent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${
                            LIFECYCLE_BADGE[lc]
                          }`}
                        >
                          {BATCH_LIFECYCLE_LABELS[lc]}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(bat.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-600 whitespace-nowrap shrink-0"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Manage (12 Tabs)</span>
                          </button>
                          {(userRole === 'admin' || userRole === 'branch') && (
                            <button
                              type="button"
                              aria-label={`Edit ${bat.name}`}
                              onClick={() => onOpenWizard(bat)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
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

        {/* Teacher Workload Summary when Teacher or Admin views */}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Users className="h-3.5 w-3.5" />
            <span>Instructor Batch Workload Overview</span>
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {instructors.slice(0, 6).map((inst) => {
              const instBatches = batches.filter(
                (b) => b.instructorId === inst.id || b.assistantInstructorId === inst.id
              );
              const totalStu = instBatches.reduce((s, b) => s + b.enrolledSeats, 0);
              return (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{inst.name}</p>
                    <p className={`truncate ${muted}`}>{inst.subject}</p>
                  </div>
                  <div className="font-mono tabular-nums text-right shrink-0">
                    <p className="font-bold text-indigo-700">{instBatches.length} batches</p>
                    <p className={muted}>{totalStu} students</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
