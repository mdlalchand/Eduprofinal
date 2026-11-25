import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CreditCard,
  Download,
  LogIn,
  Pause,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  computeAuditLogSummary,
  enrichAuditLogEntry,
  filterAuditLogs,
  formatAuditLogsCsv,
  mergeAuditLogStreamEntry,
} from '../../lib/auditLogs';
import type { AuditLogCategory, AuditLogEntry, UserRole } from '../../types';

interface SystemActivityLogsPanelProps {
  initialLogs?: AuditLogEntry[];
  darkMode?: boolean;
  compact?: boolean;
  onOpenFullView?: () => void;
}

type StreamConnectionState = 'connecting' | 'live' | 'paused' | 'reconnecting';

const CATEGORY_TABS: {
  id: 'all' | AuditLogCategory;
  label: string;
  icon: typeof Activity;
}[] = [
  { id: 'all', label: 'All Events', icon: Activity },
  { id: 'login', label: 'User Logins', icon: LogIn },
  { id: 'course', label: 'Course Changes', icon: BookOpen },
  { id: 'payment', label: 'Payment Updates', icon: CreditCard },
  { id: 'system', label: 'System & Security', icon: Terminal },
];

const CATEGORY_BADGES: Record<
  AuditLogCategory,
  { label: string; light: string; dark: string }
> = {
  login: {
    label: 'LOGIN',
    light: 'bg-sky-50 text-sky-700 border-sky-200',
    dark: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  course: {
    label: 'COURSE',
    light: 'bg-violet-50 text-violet-700 border-violet-200',
    dark: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
  payment: {
    label: 'PAYMENT',
    light: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dark: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  system: {
    label: 'SYSTEM',
    light: 'bg-slate-100 text-slate-700 border-slate-200',
    dark: 'bg-slate-700/50 text-slate-300 border-slate-600',
  },
};

function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SystemActivityLogsPanel({
  initialLogs = [],
  darkMode = false,
  compact = false,
  onOpenFullView,
}: SystemActivityLogsPanelProps) {
  const { token, apiFetch } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>(() =>
    initialLogs.map(enrichAuditLogEntry)
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | AuditLogCategory>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paused, setPaused] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamConnectionState>('connecting');
  const [refreshing, setRefreshing] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [recentIncomingIds, setRecentIncomingIds] = useState<string[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (initialLogs.length > 0) {
      setLogs((prev) => {
        let merged = prev;
        for (const item of initialLogs) {
          merged = mergeAuditLogStreamEntry(merged, item, 250);
        }
        return merged;
      });
    }
  }, [initialLogs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setStreamError(null);
    try {
      const res = await apiFetch<{ auditLogs: AuditLogEntry[]; serverTime?: string }>(
        '/api/portal/audit-logs?limit=200'
      );
      if (!mountedRef.current) return;
      setLogs(res.auditLogs.map(enrichAuditLogEntry));
      setLastSyncedAt(res.serverTime || new Date().toISOString());
    } catch (err) {
      if (mountedRef.current) {
        setStreamError(err instanceof Error ? err.message : 'Unable to fetch audit logs.');
      }
    } finally {
      if (mountedRef.current) {
        setRefreshing(false);
      }
    }
  }, [apiFetch]);

  useEffect(() => {
    if (!token || paused) {
      setStreamStatus(paused ? 'paused' : 'connecting');
      return;
    }

    let cancelled = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;
    let activeController: AbortController | null = null;

    const processSseFrame = (frame: string) => {
      const lines = frame.split(/\r?\n/);
      let eventType = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (!line || line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      if (dataLines.length === 0) return;
      const rawData = dataLines.join('\n');

      try {
        const parsed = JSON.parse(rawData);
        if (eventType === 'init' && Array.isArray(parsed.logs)) {
          setLogs(parsed.logs.map(enrichAuditLogEntry));
          setLastSyncedAt(parsed.serverTime || new Date().toISOString());
        } else if (eventType === 'log' && parsed && typeof parsed.id === 'string') {
          const entry = enrichAuditLogEntry(parsed as AuditLogEntry);
          setLogs((prev) => mergeAuditLogStreamEntry(prev, entry, 250));
          setLastSyncedAt(new Date().toISOString());
          setRecentIncomingIds((prev) => [entry.id, ...prev].slice(0, 6));
        }
      } catch {
        // Ignore malformed SSE JSON payload frames cleanly
      }
    };

    const connectStream = async () => {
      if (cancelled) return;
      activeController = new AbortController();
      setStreamStatus(attempt === 0 ? 'connecting' : 'reconnecting');
      setStreamError(null);

      try {
        const response = await fetch('/api/portal/audit-logs/stream', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          cache: 'no-store',
          signal: activeController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream connection rejected (${response.status})`);
        }

        if (cancelled) return;
        attempt = 0;
        setStreamStatus('live');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundaryIdx = buffer.search(/\r?\n\r?\n/);
          while (boundaryIdx !== -1) {
            const rawFrame = buffer.slice(0, boundaryIdx);
            const match = buffer.slice(boundaryIdx).match(/^\r?\n\r?\n/);
            const sepLen = match ? match[0].length : 2;
            buffer = buffer.slice(boundaryIdx + sepLen);
            if (rawFrame.trim()) {
              processSseFrame(rawFrame);
            }
            boundaryIdx = buffer.search(/\r?\n\r?\n/);
          }
        }

        if (!cancelled) {
          throw new Error('Audit stream disconnected');
        }
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === 'AbortError')) {
          return;
        }
        attempt += 1;
        setStreamStatus('reconnecting');
        const delayMs = Math.min(8000, 1200 * attempt);
        reconnectTimer = window.setTimeout(() => {
          void connectStream();
        }, delayMs);
      }
    };

    void connectStream();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }
      if (activeController) {
        activeController.abort();
      }
    };
  }, [token, paused]);

  const summary = useMemo(() => computeAuditLogSummary(logs), [logs]);

  const filteredLogs = useMemo(
    () =>
      filterAuditLogs(logs, {
        category: categoryFilter,
        actorRole: roleFilter,
        searchQuery,
      }),
    [logs, categoryFilter, roleFilter, searchQuery]
  );

  const visibleLogs = compact ? filteredLogs.slice(0, 8) : filteredLogs.slice(0, 120);

  const handleExportCsv = () => {
    const csv = formatAuditLogsCsv(filteredLogs);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const containerCard = darkMode
    ? 'border-[#1E2E52] bg-[#0F1B3B] text-slate-100'
    : 'border-white/80 bg-white/95 text-slate-900 backdrop-blur-md';

  const subSurface = darkMode
    ? 'border-[#1E2E52] bg-[#09122B]/80'
    : 'border-slate-200/80 bg-slate-50/80';

  const inputClass = darkMode
    ? 'border-[#253763] bg-[#0B142C] text-slate-100 placeholder:text-slate-400'
    : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400';

  const statusMeta: Record<
    StreamConnectionState,
    { label: string; dot: string; badge: string }
  > = {
    live: {
      label: 'Live Stream',
      dot: 'bg-emerald-400 animate-pulse',
      badge: darkMode
        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    connecting: {
      label: 'Connecting...',
      dot: 'bg-amber-400 animate-pulse',
      badge: darkMode
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
        : 'border-amber-200 bg-amber-50 text-amber-700',
    },
    reconnecting: {
      label: 'Reconnecting...',
      dot: 'bg-amber-400 animate-ping',
      badge: darkMode
        ? 'border-amber-500/30 bg-amber-500/15 text-amber-300'
        : 'border-amber-200 bg-amber-50 text-amber-700',
    },
    paused: {
      label: 'Paused',
      dot: 'bg-slate-400',
      badge: darkMode
        ? 'border-slate-600 bg-slate-800 text-slate-300'
        : 'border-slate-300 bg-slate-100 text-slate-700',
    },
  };

  const activeStatus = statusMeta[streamStatus];

  return (
    <section
      aria-label="System Activity Logs"
      className={`rounded-3xl border p-5 shadow-sm transition-colors ${containerCard}`}
    >
      {/* Top Title Bar & Stream Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              darkMode
                ? 'bg-blue-500/20 text-cyan-300'
                : 'bg-gradient-to-br from-[#2563EB] to-[#6366F1] text-white shadow-sm'
            }`}
          >
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-extrabold tracking-tight">
                System Activity Logs
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${activeStatus.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${activeStatus.dot}`} />
                <span>{activeStatus.label}</span>
              </span>
            </div>
            <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Real-time audit trail for user logins, course modifications, and payment updates
              {lastSyncedAt ? ` · Synced ${formatAuditTimestamp(lastSyncedAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
              darkMode
                ? 'border-[#253763] bg-[#09122B] text-slate-200 hover:bg-[#132347]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {paused ? <Play className="h-3.5 w-3.5 text-emerald-500" /> : <Pause className="h-3.5 w-3.5 text-amber-500" />}
            <span>{paused ? 'Resume Live' : 'Pause Live'}</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
              darkMode
                ? 'border-[#253763] bg-[#09122B] text-slate-200 hover:bg-[#132347]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
              darkMode
                ? 'border-[#253763] bg-[#09122B] text-slate-200 hover:bg-[#132347]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          {compact && onOpenFullView && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:opacity-95"
            >
              <span>Full Audit Console</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Audit Metrics Summary Row */}
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {[
          {
            label: 'Total Events',
            value: summary.total,
            tone: darkMode ? 'text-white' : 'text-slate-900',
          },
          {
            label: 'User Logins',
            value: summary.loginCount,
            tone: darkMode ? 'text-sky-300' : 'text-sky-700',
          },
          {
            label: 'Course Changes',
            value: summary.courseCount,
            tone: darkMode ? 'text-violet-300' : 'text-violet-700',
          },
          {
            label: 'Payment Updates',
            value: summary.paymentCount,
            tone: darkMode ? 'text-emerald-300' : 'text-emerald-700',
          },
          {
            label: 'Alerts & Warnings',
            value: summary.warningCount,
            tone: darkMode ? 'text-amber-300' : 'text-amber-700',
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className={`rounded-2xl border px-3.5 py-2.5 ${subSurface}`}
          >
            <p className={`text-[11px] font-bold ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {metric.label}
            </p>
            <p className={`font-mono-tabular mt-0.5 text-lg font-extrabold ${metric.tone}`}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Category Filter Tabs + Search + Role Filter */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter logs by category">
          {CATEGORY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? 'bg-gradient-to-r from-[#2563EB] to-[#6366F1] text-white shadow-xs'
                    : darkMode
                      ? 'border border-[#253763] bg-[#09122B] text-slate-300 hover:bg-[#132347]'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action, actor, target..."
              aria-label="Search activity logs"
              className={`w-full rounded-xl border py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none ${inputClass}`}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            aria-label="Filter logs by actor role"
            className={`rounded-xl border px-3 py-1.5 text-xs font-semibold focus:border-blue-500 focus:outline-none ${inputClass}`}
          >
            <option value="all">All Roles</option>
            <option value="admin">Main Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="guardian">Guardian</option>
          </select>
        </div>
      </div>

      {streamError && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>{streamError}</span>
        </div>
      )}

      {/* Activity Table */}
      <div className={`mt-4 overflow-x-auto rounded-2xl border ${subSurface}`}>
        {visibleLogs.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs opacity-70">
            No matching system activity events found for the active filters.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr
                className={`border-b text-[11px] font-bold uppercase tracking-wider ${
                  darkMode
                    ? 'border-[#1E2E52] text-slate-400'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Event Action</th>
                <th className="px-3 py-2.5">Actor</th>
                <th className="px-3 py-2.5">Target &amp; Details</th>
              </tr>
            </thead>
            <tbody
              className={`divide-y ${
                darkMode ? 'divide-[#1E2E52]' : 'divide-slate-200/70'
              }`}
            >
              {visibleLogs.map((entry) => {
                const catStyle = CATEGORY_BADGES[entry.category];
                const isNew = recentIncomingIds.includes(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={`transition-colors ${
                      isNew
                        ? darkMode
                          ? 'bg-emerald-500/10'
                          : 'bg-emerald-50/70'
                        : darkMode
                          ? 'hover:bg-[#132347]/60'
                          : 'hover:bg-white'
                    }`}
                  >
                    <td className="font-mono-tabular whitespace-nowrap px-4 py-2.5 text-[11px] opacity-80">
                      {formatAuditTimestamp(entry.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-extrabold tracking-wide ${
                          darkMode ? catStyle.dark : catStyle.light
                        }`}
                      >
                        {catStyle.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {entry.severity === 'critical' && (
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        )}
                        {entry.severity === 'warning' && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        )}
                        <span
                          className={`font-mono-tabular font-bold ${
                            entry.severity === 'critical'
                              ? 'text-rose-500'
                              : entry.severity === 'warning'
                                ? darkMode
                                  ? 'text-amber-300'
                                  : 'text-amber-700'
                                : ''
                          }`}
                        >
                          {entry.action}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <p className="font-bold">{entry.actorName}</p>
                      <p className="text-[10px] uppercase tracking-wider opacity-65">
                        {entry.actorRole.replace('_', ' ')}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold">{entry.target}</p>
                      <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {entry.details}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {compact && filteredLogs.length > visibleLogs.length && (
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className={darkMode ? 'text-slate-400' : 'text-slate-500'}>
            Showing latest {visibleLogs.length} of {filteredLogs.length} matching events
          </span>
          {onOpenFullView && (
            <button
              type="button"
              onClick={onOpenFullView}
              className="font-bold text-blue-600 hover:underline dark:text-cyan-300"
            >
              View all {filteredLogs.length} audit logs
            </button>
          )}
        </div>
      )}
    </section>
  );
}
