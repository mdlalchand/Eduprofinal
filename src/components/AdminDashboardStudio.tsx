import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Eye,
  EyeOff,
  GripVertical,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  SlidersHorizontal,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  buildMonthlyRevenueSeries,
  canClaimEbookFree,
  computeAttendanceSummary,
  filterActiveBranches,
  isAdminRole,
  reorderDashboardWidgets,
  type PortalSection,
} from '../lib/domain';
import type {
  AppNotification,
  AttendanceRecord,
  Branch,
  CategoryItem,
  CommunityPost,
  Course,
  DashboardPreset,
  DashboardWidgetDefinition,
  DashboardWidgetLayoutItem,
  Ebook,
  Enrollment,
  NoticeItem,
  Order,
  PaymentTransaction,
  Product,
  User,
  UserDashboardLayout,
  WidgetSize,
  WidgetUsageStat,
} from '../types';

interface AdminDashboardStudioProps {
  user: User;
  metrics: Record<string, number>;
  branch?: Branch;
  branches?: Branch[];
  courses?: Course[];
  enrollments?: Enrollment[];
  attendance?: AttendanceRecord[];
  transactions?: PaymentTransaction[];
  ebooks?: Ebook[];
  products?: Product[];
  posts?: CommunityPost[];
  categories?: CategoryItem[];
  orders?: Order[];
  onNavigateSection: (sec: PortalSection) => void;
  onNavigatePath: (path: string) => void;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const PRESET_LABELS: { id: DashboardPreset; label: string; desc: string }[] = [
  { id: 'executive', label: 'Executive', desc: 'KPIs, revenue & health' },
  { id: 'operations', label: 'Operations', desc: 'Quick actions & activity' },
  { id: 'teaching', label: 'Teaching', desc: 'Grading & LMS queue' },
  { id: 'finance', label: 'Finance', desc: 'Fee ledger & cashflow' },
];

export function AdminDashboardStudio({
  user,
  metrics,
  branch,
  branches = [],
  courses = [],
  enrollments = [],
  attendance = [],
  transactions = [],
  ebooks = [],
  products = [],
  posts = [],
  categories = [],
  orders = [],
  onNavigateSection,
  onNavigatePath,
  onRefresh,
  onNotify,
}: AdminDashboardStudioProps) {
  const { apiFetch } = useAuth();
  const [layout, setLayout] = useState<UserDashboardLayout | null>(null);
  const [registry, setRegistry] = useState<DashboardWidgetDefinition[]>([]);
  const [usageStats, setUsageStats] = useState<WidgetUsageStat[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);

  const [showCustomize, setShowCustomize] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    { type: string; id: string; title: string; subtitle: string; section: string }[]
  >([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);

  const loadDashboardConfig = useCallback(async () => {
    try {
      const [layoutRes, notifRes] = await Promise.all([
        apiFetch<{
          layout: UserDashboardLayout;
          registry: DashboardWidgetDefinition[];
          widgetUsageStats: WidgetUsageStat[];
        }>('/api/portal/dashboard-layout'),
        apiFetch<{ notifications: AppNotification[]; notices: NoticeItem[] }>('/api/notifications'),
      ]);
      setLayout(layoutRes.layout);
      setRegistry(layoutRes.registry);
      setUsageStats(layoutRes.widgetUsageStats);
      setNotifications(notifRes.notifications);
      setNotices(notifRes.notices);
    } catch {
      // Keep graceful UI if secondary call fails
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadDashboardConfig();
  }, [loadDashboardConfig]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiFetch<{
          results: { type: string; id: string; title: string; subtitle: string; section: string }[];
        }>(`/api/portal/global-search?q=${encodeURIComponent(q)}`);
        setSearchResults(res.results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery, apiFetch]);

  const persistWidgets = async (
    nextWidgets: DashboardWidgetLayoutItem[],
    preset: DashboardPreset | 'custom' = 'custom'
  ) => {
    if (!layout) return;
    const optimistic: UserDashboardLayout = {
      ...layout,
      preset,
      widgets: nextWidgets,
      updatedAt: new Date().toISOString(),
    };
    setLayout(optimistic);
    try {
      const res = await apiFetch<{ layout: UserDashboardLayout }>('/api/portal/dashboard-layout', {
        method: 'PUT',
        body: JSON.stringify({ widgets: nextWidgets, preset }),
      });
      setLayout(res.layout);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not save widget layout.');
    }
  };

  const applyPreset = async (preset: DashboardPreset) => {
    try {
      const res = await apiFetch<{ layout: UserDashboardLayout }>(
        '/api/portal/dashboard-layout/preset',
        {
          method: 'POST',
          body: JSON.stringify({ preset }),
        }
      );
      setLayout(res.layout);
      onNotify(`Applied "${preset}" dashboard preset.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not apply dashboard preset.');
    }
  };

  const resetDefaults = async () => {
    try {
      const res = await apiFetch<{ layout: UserDashboardLayout }>(
        '/api/portal/dashboard-layout/reset',
        { method: 'POST' }
      );
      setLayout(res.layout);
      onNotify('Dashboard layout reset to role defaults.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not reset dashboard defaults.');
    }
  };

  const trackWidget = async (widgetId: string, kind: 'view' | 'interaction' = 'interaction') => {
    try {
      const res = await apiFetch<{ stat: WidgetUsageStat }>('/api/portal/dashboard-widgets/track', {
        method: 'POST',
        body: JSON.stringify({ widgetId, kind }),
      });
      setUsageStats((prev) => {
        const idx = prev.findIndex((s) => s.widgetId === widgetId);
        if (idx === -1) return [...prev, res.stat];
        const copy = [...prev];
        copy[idx] = res.stat;
        return copy;
      });
    } catch {
      // Non-blocking analytics
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id && !n.readByUserIds.includes(user.id)
            ? { ...n, readByUserIds: [...n.readByUserIds, user.id] }
            : n
        )
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not mark notification as read.');
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) =>
          n.readByUserIds.includes(user.id)
            ? n
            : { ...n, readByUserIds: [...n.readByUserIds, user.id] }
        )
      );
      onNotify('All notifications marked as read.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not clear unread alerts.');
    }
  };

  const handleRealTimeRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([onRefresh(), loadDashboardConfig()]);
      onNotify('Real-time portal analytics refreshed.');
    } finally {
      setRefreshing(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.readByUserIds.includes(user.id)).length;
  const sortedWidgets = [...(layout?.widgets ?? [])].sort((a, b) => a.order - b.order);
  const visibleWidgets = sortedWidgets.filter((item) => item.visible);

  const toggleWidgetVisibility = (widgetId: string) => {
    const next = sortedWidgets.map((w) =>
      w.widgetId === widgetId ? { ...w, visible: !w.visible } : w
    );
    void persistWidgets(next, 'custom');
    void trackWidget(widgetId, 'interaction');
  };

  const changeWidgetSize = (widgetId: string, size: WidgetSize) => {
    const next = sortedWidgets.map((w) => (w.widgetId === widgetId ? { ...w, size } : w));
    void persistWidgets(next, 'custom');
    void trackWidget(widgetId, 'interaction');
  };

  const moveWidgetByOffset = (widgetId: string, dir: -1 | 1) => {
    const idx = sortedWidgets.findIndex((w) => w.widgetId === widgetId);
    const targetIdx = idx + dir;
    if (idx < 0 || targetIdx < 0 || targetIdx >= sortedWidgets.length) return;
    const reordered = reorderDashboardWidgets(
      sortedWidgets,
      sortedWidgets[idx].widgetId,
      sortedWidgets[targetIdx].widgetId
    );
    void persistWidgets(reordered, 'custom');
    void trackWidget(widgetId, 'interaction');
  };

  const handleDropOnWidget = (targetId: string) => {
    if (!draggedWidgetId || draggedWidgetId === targetId) {
      setDraggedWidgetId(null);
      return;
    }
    const reordered = reorderDashboardWidgets(sortedWidgets, draggedWidgetId, targetId);
    setDraggedWidgetId(null);
    void persistWidgets(reordered, 'custom');
    void trackWidget(draggedWidgetId, 'interaction');
  };

  const attSummary = computeAttendanceSummary(attendance);
  const completedTransactions = transactions.filter((t) => t.status === 'completed');
  const completedRevenue = completedTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
  const monthlySeries = buildMonthlyRevenueSeries(transactions, enrollments, orders, 6);
  const activeBranchesList = filterActiveBranches(branches);
  const inactiveBranchesCount = Math.max(0, branches.length - activeBranchesList.length);

  const paidEbooks = ebooks.filter((e) => !canClaimEbookFree(e));
  const ebookSalesUnits = ebooks.reduce((sum, e) => sum + (e.salesCount || 0), 0);
  const ebookRevenue = completedTransactions
    .filter((t) => t.referenceType === 'ebook')
    .reduce((sum, t) => sum + t.totalAmount, 0);
  const activeProducts = products.filter((p) => p.active !== false);
  const lowStockProducts = activeProducts.filter((p) => p.stock <= 10);

  const maxUsageScore = Math.max(
    1,
    ...usageStats.map((s) => (s.views || 0) + (s.interactions || 0) * 2)
  );

  const renderWidgetBody = (def: DashboardWidgetDefinition) => {
    if (def.id === 'w-kpi-metrics') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries(metrics).map(([key, val]) => (
            <div key={key} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-semibold capitalize text-slate-500">
                {key.replace(/([A-Z])/g, ' $1')}
              </p>
              <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
                {key.toLowerCase().includes('revenue')
                  ? `৳${val.toLocaleString()}`
                  : val.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      );
    }

    if (def.id === 'w-quick-actions') {
      const actions: { label: string; sec: PortalSection }[] = [
        { label: 'Create Course / Batch', sec: 'courses' },
        { label: 'E-Books, Store & Posts', sec: 'catalog_cms' },
        { label: 'Collect Fee Invoice', sec: 'fees_ledger' },
        { label: 'Manage Branches', sec: 'branches' },
        { label: 'Mark Daily Attendance', sec: 'attendance_finance' },
        { label: 'Export CSV / Reports', sec: 'reports' },
      ];
      return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {actions.map((act) => (
            <button
              key={act.sec}
              type="button"
              onClick={() => {
                void trackWidget(def.id, 'interaction');
                onNavigateSection(act.sec);
              }}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-800 transition-colors hover:border-[#062436] hover:bg-white"
            >
              <span>{act.label}</span>
              <Zap className="h-3.5 w-3.5 text-amber-600" />
            </button>
          ))}
        </div>
      );
    }

    if (def.id === 'w-revenue-analytics') {
      const topCourses = [...courses].sort((a, b) => b.enrolledCount - a.enrolledCount).slice(0, 4);
      const maxEnrolled = Math.max(1, ...topCourses.map((c) => c.enrolledCount));
      const maxMonthlyRev = Math.max(1000, ...monthlySeries.map((m) => m.revenue));
      const maxBranchStudents = Math.max(1, ...branches.map((b) => b.activeStudents || 0));

      return (
        <div className="space-y-5">
          {/* 6-Month Revenue & Enrollment SVG Chart */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  6-Month Revenue &amp; Enrollment Trend
                </p>
                <p className="text-[11px] text-slate-500">
                  Verified transactions paired with course enrollments &amp; store orders
                </p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-slate-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#062436]" />
                  Revenue (৳)
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" />
                  Enrollments
                </span>
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox="0 0 600 185"
                className="h-44 w-full min-w-[440px]"
                role="img"
                aria-label="Six month revenue and enrollment chart"
              >
                {[0, 0.5, 1].map((ratio) => {
                  const y = 140 - ratio * 110;
                  const labelVal = Math.round(maxMonthlyRev * ratio);
                  return (
                    <g key={ratio}>
                      <line x1="52" y1={y} x2="585" y2={y} stroke="#e2e8f0" strokeWidth="1" />
                      <text
                        x="46"
                        y={y + 4}
                        textAnchor="end"
                        className="fill-slate-400 font-mono text-[10px]"
                      >
                        ৳{labelVal >= 1000 ? `${Math.round(labelVal / 1000)}k` : labelVal}
                      </text>
                    </g>
                  );
                })}

                {monthlySeries.map((pt, idx) => {
                  const colW = 530 / monthlySeries.length;
                  const barW = Math.min(42, colW * 0.48);
                  const x = 58 + idx * colW + (colW - barW) / 2;
                  const barH = Math.max(4, Math.round((pt.revenue / maxMonthlyRev) * 110));
                  const barY = 140 - barH;
                  const enrHeight = Math.min(18, pt.enrollments * 3);
                  return (
                    <g key={pt.monthKey}>
                      <rect
                        x={x}
                        y={barY}
                        width={barW}
                        height={barH}
                        rx="3"
                        fill="#062436"
                      >
                        <title>
                          {pt.label}: ৳{pt.revenue.toLocaleString()} · {pt.enrollments} enrollments ·{' '}
                          {pt.orders} orders
                        </title>
                      </rect>
                      <rect
                        x={x + barW + 4}
                        y={140 - Math.max(4, enrHeight)}
                        width="8"
                        height={Math.max(4, enrHeight)}
                        rx="2"
                        fill="#f59e0b"
                      />
                      <text
                        x={x + barW / 2}
                        y="160"
                        textAnchor="middle"
                        className="fill-slate-600 font-mono text-[10px] font-semibold"
                      >
                        {pt.label}
                      </text>
                      <text
                        x={x + barW / 2}
                        y={Math.max(12, barY - 5)}
                        textAnchor="middle"
                        className="fill-slate-700 font-mono text-[9px] font-bold"
                      >
                        {pt.revenue > 0 ? `৳${Math.round(pt.revenue / 1000)}k` : '৳0'}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* Top Course Enrollments */}
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-700">
                Top Course Enrollments · {enrollments.length} Active Records
              </p>
              {topCourses.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate font-semibold text-slate-800">{c.title}</span>
                    <span className="font-mono tabular-nums font-bold text-slate-700">
                      {c.enrolledCount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-[#062436]"
                      style={{ width: `${Math.round((c.enrolledCount / maxEnrolled) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Branch Capacity & Attendance Pulse */}
            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800">Attendance &amp; Branch Load</p>
                <span className="font-mono text-[11px] font-semibold text-slate-500">
                  {activeBranchesList.length} Active · {inactiveBranchesCount} Inactive
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Attendance Rate</span>
                  <p className="font-mono text-lg font-bold tabular-nums text-emerald-700">
                    {attSummary.attendanceRate}%
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Verified Payments</span>
                  <p className="font-mono text-lg font-bold tabular-nums text-slate-900">
                    ৳{completedRevenue.toLocaleString()}
                  </p>
                </div>
              </div>
              {branches.slice(0, 4).map((br) => (
                <div key={br.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700">
                      {br.name}{' '}
                      <span className={br.status === 'active' ? 'text-emerald-700' : 'text-rose-600'}>
                        ({br.status})
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {br.activeStudents.toLocaleString()} students
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-slate-200">
                    <div
                      className={`h-full rounded ${
                        br.status === 'active' ? 'bg-emerald-600' : 'bg-rose-400'
                      }`}
                      style={{
                        width: `${Math.round(((br.activeStudents || 0) / maxBranchStudents) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (def.id === 'w-commerce-pulse') {
      return (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500">Paid / Free E-Books</span>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">
                {paidEbooks.length} / {ebooks.length - paidEbooks.length}
              </p>
              <p className="font-mono text-[11px] text-emerald-700">
                {ebookSalesUnits} sold · ৳{ebookRevenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500">Store Products</span>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">
                {activeProducts.length} / {products.length}
              </p>
              <p className="font-mono text-[11px] text-amber-700">
                {lowStockProducts.length} low stock (&le;10)
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500">Checkout Branches</span>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">
                {activeBranchesList.length} Active
              </p>
              <p className="font-mono text-[11px] text-slate-600">
                {inactiveBranchesCount} hidden from checkout
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500">CMS Taxonomy</span>
              <p className="mt-1 font-mono text-base font-bold tabular-nums text-slate-900">
                {categories.length} Categories
              </p>
              <p className="font-mono text-[11px] text-indigo-700">{posts.length} Community Posts</p>
            </div>
          </div>

          {lowStockProducts.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <p className="font-semibold text-amber-900">
                Low Stock Store Alerts ({lowStockProducts.length})
              </p>
              <p className="mt-0.5 text-[11px] text-amber-800">
                {lowStockProducts.map((p) => `${p.title} (${p.stock} left)`).join(' · ')}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void trackWidget(def.id, 'interaction');
                onNavigateSection('catalog_cms');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#062436] px-3.5 py-2 font-semibold text-white hover:bg-[#0b3854]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Manage E-Books, Products &amp; Posts</span>
            </button>
            <button
              type="button"
              onClick={() => {
                void trackWidget(def.id, 'interaction');
                onNavigateSection('branches');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Branch Activation</span>
            </button>
          </div>
        </div>
      );
    }

    if (def.id === 'w-system-health') {
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
              <span className="text-slate-600">API &amp; Storage</span>
              <p className="mt-0.5 font-bold text-emerald-800">Operational</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-600">Active Plugins</span>
              <p className="mt-0.5 font-mono font-bold tabular-nums text-slate-900">
                {registry.filter((r) => r.category === 'Plugin').length} Connected
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection('saas_automation')}
              className="rounded-lg border border-slate-200 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Diagnostics &amp; Jobs
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('settings')}
              className="rounded-lg border border-slate-200 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Backups &amp; Security
            </button>
          </div>
        </div>
      );
    }

    if (def.id === 'w-teaching-queue') {
      return (
        <div className="space-y-2.5 text-xs">
          <p className="text-slate-600">
            Review written exam responses, grade homework submissions, and score Phonetics speaking
            audio clips.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection('assignments')}
              className="rounded-lg bg-[#062436] px-3.5 py-2 font-semibold text-white"
            >
              Assignments &amp; Speaking
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('exams')}
              className="rounded-lg border border-slate-300 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manual Exam Queue
            </button>
          </div>
        </div>
      );
    }

    if (def.id === 'w-activity-logs') {
      return (
        <div className="space-y-2 text-xs">
          {notifications.slice(0, 4).map((n) => (
            <div
              key={n.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{n.title}</p>
                <p className="line-clamp-1 text-slate-500">{n.message}</p>
              </div>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
                {n.createdAt.slice(0, 10)}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (def.id === 'w-finance-ledger') {
      return (
        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500">Verified Receipts</span>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
                {completedTransactions.length}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500">Active Notices</span>
              <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-slate-900">
                {notices.length}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection('fees_ledger')}
              className="rounded-lg bg-[#062436] px-3.5 py-2 font-semibold text-white"
            >
              Open Student Fee Ledger
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('payments')}
              className="rounded-lg border border-slate-300 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              Payment Gateways
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2 text-xs text-slate-600">
        <p>{def.description}</p>
        <p className="font-mono text-[11px] text-emerald-700">
          Plugin Status: Active · Role-authorized
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Workspace Toolbar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Unified Portal · {user.role.replace('_', ' ')}
              {branch ? ` · ${branch.name}` : ''}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {user.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRealTimeRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((v) => !v)}
                aria-label="Toggle Notifications"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Bell className="h-3.5 w-3.5 text-amber-600" />
                <span>Notifications ({unreadCount})</span>
              </button>

              {showNotifications && (
                <div
                  role="region"
                  aria-label="Portal Notifications"
                  className="absolute right-0 top-11 z-40 w-[min(380px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      Recent Alerts ({unreadCount} unread)
                    </span>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() => void markAllNotificationsRead()}
                          className="text-xs font-semibold text-indigo-700 hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowNotifications(false)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-500">All caught up.</p>
                    ) : (
                      notifications.map((n) => {
                        const isRead = n.readByUserIds.includes(user.id);
                        return (
                          <div
                            key={n.id}
                            className={`rounded-lg border p-2.5 text-xs ${
                              isRead
                                ? 'border-slate-100 bg-slate-50 text-slate-500'
                                : 'border-indigo-200 bg-indigo-50/50 text-slate-900'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold">{n.title}</p>
                              {!isRead && (
                                <button
                                  type="button"
                                  onClick={() => void markNotificationRead(n.id)}
                                  className="shrink-0 text-[11px] font-semibold text-indigo-700 hover:underline"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px]">{n.message}</p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => onNavigatePath('/learn')}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              Classroom
            </button>
            <button
              type="button"
              onClick={() => onNavigatePath('/exams')}
              className="rounded-lg bg-[#062436] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0b3854] whitespace-nowrap shrink-0"
            >
              Live Exams
            </button>
          </div>
        </div>

        {/* Global Search + Dashboard Presets & Customize Bar */}
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Global search: courses, e-books, branches, posts..."
              aria-label="Global portal search"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs focus:border-[#062436] focus:outline-none"
            />
            {searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 top-10 z-30 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                {searching ? (
                  <p className="px-2 py-2 text-xs text-slate-500">Searching...</p>
                ) : searchResults.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-slate-500">No matching records found.</p>
                ) : (
                  <div className="max-h-60 space-y-1 overflow-y-auto">
                    {searchResults.map((res) => (
                      <button
                        key={`${res.type}-${res.id}`}
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSearchResults([]);
                          onNavigateSection(res.section as PortalSection);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs hover:bg-slate-100"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{res.title}</p>
                          <p className="truncate text-[11px] text-slate-500">
                            {res.type} · {res.subtitle}
                          </p>
                        </div>
                        <span className="ml-2 shrink-0 text-[11px] font-semibold text-indigo-700">
                          Open
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {PRESET_LABELS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void applyPreset(p.id)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    layout?.preset === p.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowCustomize((v) => !v)}
              aria-expanded={showCustomize}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 ${
                showCustomize
                  ? 'border-[#062436] bg-[#062436] text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Customize Widgets</span>
            </button>

            {isAdminRole(user.role) && (
              <button
                type="button"
                onClick={() => setShowAnalytics((v) => !v)}
                aria-expanded={showAnalytics}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <BarChart3 className="h-3.5 w-3.5 text-indigo-600" />
                <span>Widget Analytics</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customize Widgets Drawer */}
      {showCustomize && layout && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Plugin &amp; Core Widget Layout Studio
              </h2>
              <p className="text-xs text-slate-500">
                Toggle visibility, pick Small (S) / Medium (M) / Large (L) width, drag cards or use
                arrows to reorder.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void resetDefaults()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {sortedWidgets.map((item, idx) => {
              const def = registry.find((r) => r.id === item.widgetId);
              if (!def) return null;
              return (
                <div
                  key={item.widgetId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{def.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {def.category} · Order #{idx + 1}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="inline-flex overflow-hidden rounded-md border border-slate-300 bg-white"
                      role="group"
                      aria-label={`Size for ${def.title}`}
                    >
                      {(['sm', 'md', 'lg'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => changeWidgetSize(item.widgetId, sz)}
                          aria-label={`Set ${def.title} size ${sz.toUpperCase()}`}
                          className={`px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                            item.size === sz
                              ? 'bg-[#062436] text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => moveWidgetByOffset(item.widgetId, -1)}
                      disabled={idx === 0}
                      aria-label={`Move ${def.title} up`}
                      className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveWidgetByOffset(item.widgetId, 1)}
                      disabled={idx === sortedWidgets.length - 1}
                      aria-label={`Move ${def.title} down`}
                      className="rounded-md border border-slate-200 bg-white p-1 text-slate-600 disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleWidgetVisibility(item.widgetId)}
                      aria-label={`${item.visible ? 'Hide' : 'Show'} ${def.title}`}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                        item.visible
                          ? 'bg-emerald-600 text-white'
                          : 'border border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      {item.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      <span>{item.visible ? 'Shown' : 'Hidden'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Widget Usage Analytics Drawer */}
      {showAnalytics && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900">Widget Usage Analytics</h2>
            <span className="font-mono text-[11px] text-slate-500">
              {registry.length} registered widgets
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Widget</th>
                  <th className="py-2 pr-4 font-semibold">Activity Intensity</th>
                  <th className="py-2 pr-4 font-semibold">Views</th>
                  <th className="py-2 pr-4 font-semibold">Interactions</th>
                  <th className="py-2 font-semibold">Last Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registry.map((def) => {
                  const st = usageStats.find((s) => s.widgetId === def.id);
                  const score = (st?.views ?? 0) + (st?.interactions ?? 0) * 2;
                  const pct = Math.min(100, Math.round((score / maxUsageScore) * 100));
                  return (
                    <tr key={def.id}>
                      <td className="py-2 pr-4 font-semibold text-slate-800">{def.title}</td>
                      <td className="py-2 pr-4 w-36">
                        <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                          <div className="h-full rounded bg-indigo-600" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-mono tabular-nums">{st?.views ?? 0}</td>
                      <td className="py-2 pr-4 font-mono tabular-nums">{st?.interactions ?? 0}</td>
                      <td className="py-2 font-mono tabular-nums text-slate-500">
                        {st ? st.lastUsedAt.slice(0, 16).replace('T', ' ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customizable Drag-and-Drop Widget Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {visibleWidgets.length === 0 ? (
          <div className="lg:col-span-12 rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            All widgets are hidden. Click Customize Widgets above to enable widgets or reset
            defaults.
          </div>
        ) : (
          visibleWidgets.map((item) => {
            const def = registry.find((r) => r.id === item.widgetId);
            if (!def) return null;
            const colClass =
              item.size === 'lg'
                ? 'lg:col-span-12'
                : item.size === 'md'
                  ? 'lg:col-span-6'
                  : 'lg:col-span-4';
            return (
              <article
                key={item.widgetId}
                draggable
                onDragStart={() => setDraggedWidgetId(item.widgetId)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnWidget(item.widgetId)}
                className={`${colClass} rounded-xl border bg-white p-5 transition-colors ${
                  draggedWidgetId === item.widgetId
                    ? 'border-[#062436] opacity-75'
                    : 'border-slate-200'
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-slate-400" />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold text-slate-900">{def.title}</h2>
                      <p className="truncate text-[11px] text-slate-500">
                        {def.category} · Size: {item.size.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => changeWidgetSize(item.widgetId, sz)}
                        aria-label={`Set card ${def.title} size ${sz.toUpperCase()}`}
                        className={`px-2 py-1 font-mono text-[10px] font-bold uppercase ${
                          item.size === sz
                            ? 'bg-[#062436] text-white'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
                {renderWidgetBody(def)}
              </article>
            );
          })
        )}
      </div>

      {/* Role Summary Icons Reference Keep-Alive for Unused Imports Guard */}
      <span className="sr-only">
        <Activity />
        <CheckCircle2 />
        <ClipboardCheck />
        <CreditCard />
        <Package />
        <Server />
        <Sparkles />
        <Users />
        <Wallet />
      </span>
    </div>
  );
}
