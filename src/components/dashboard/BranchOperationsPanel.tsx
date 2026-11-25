import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  Download,
  History,
  PauseCircle,
  Pencil,
  Power,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Branch, BranchStatus, BranchStatusHistoryEntry, UserRole } from '../../types';
import { ImageUploadField } from '../ImageUploadField';

interface BranchStatRow {
  branchId: string;
  branchName: string;
  branchCode: string;
  status: BranchStatus;
  teachersCount: number;
  studentsCount: number;
  enrolledCount: number;
  batchesCount: number;
  totalIncome: number;
  totalExpenses: number;
  totalRefunds: number;
  netBalance: number;
  feesDue: number;
  attendanceTotal: number;
  attendanceRatePercent: number;
}

interface BranchAnalyticsPayload {
  branches: Branch[];
  branchStats: BranchStatRow[];
  statusHistory: BranchStatusHistoryEntry[];
}

interface BranchOperationsPanelProps {
  role?: UserRole;
  branches: Branch[];
  darkMode?: boolean;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const STATUS_BADGE: Record<BranchStatus, { label: string; cls: string }> = {
  active: { label: 'ACTIVE', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  inactive: { label: 'INACTIVE', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  suspended: { label: 'SUSPENDED', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  archived: { label: 'ARCHIVED', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export function BranchOperationsPanel({
  role = 'admin',
  branches: fallbackBranches,
  darkMode = false,
  onRefresh,
  onNotify,
}: BranchOperationsPanelProps) {
  const { apiFetch, token } = useAuth();
  const isMainAdmin = role === 'admin';
  const [analytics, setAnalytics] = useState<BranchAnalyticsPayload | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | BranchStatus>('all');
  const [loading, setLoading] = useState(false);

  // Create / Edit Branch form
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [brName, setBrName] = useState('');
  const [brCode, setBrCode] = useState('');
  const [brCity, setBrCity] = useState('');
  const [brAddress, setBrAddress] = useState('');
  const [brPhone, setBrPhone] = useState('');
  const [brManager, setBrManager] = useState('');
  const [brStudents, setBrStudents] = useState('0');
  const [brStatus, setBrStatus] = useState<BranchStatus>('active');
  const [brImage, setBrImage] = useState('');
  const [brError, setBrError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Audited 4-status transition modal/inline prompt
  const [transitionTarget, setTransitionTarget] = useState<{
    branch: Branch;
    nextStatus: BranchStatus;
  } | null>(null);
  const [transitionReason, setTransitionReason] = useState('');
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<BranchAnalyticsPayload>('/api/portal/branches/analytics');
      setAnalytics(res);
    } catch {
      // Fallback handled by prop
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const branches = analytics?.branches ?? fallbackBranches;
  const statsById = useMemo(() => {
    const map = new Map<string, BranchStatRow>();
    for (const s of analytics?.branchStats ?? []) {
      map.set(s.branchId, s);
    }
    return map;
  }, [analytics]);

  const filteredBranches = useMemo(
    () =>
      branches.filter((b) => (statusFilter === 'all' ? true : b.status === statusFilter)),
    [branches, statusFilter]
  );

  const totals = useMemo(() => {
    const list = analytics?.branchStats ?? [];
    return {
      activeCount: branches.filter((b) => b.status === 'active').length,
      restrictedCount: branches.filter((b) => b.status !== 'active').length,
      totalIncome: list.reduce((s, x) => s + x.totalIncome, 0),
      totalFeesDue: list.reduce((s, x) => s + x.feesDue, 0),
    };
  }, [analytics, branches]);

  const resetForm = () => {
    setEditingBranchId(null);
    setBrName('');
    setBrCode('');
    setBrCity('');
    setBrAddress('');
    setBrPhone('');
    setBrManager('');
    setBrStudents('0');
    setBrStatus('active');
    setBrImage('');
    setBrError(null);
  };

  const startEdit = (b: Branch) => {
    setEditingBranchId(b.id);
    setBrName(b.name);
    setBrCode(b.code);
    setBrCity(b.city);
    setBrAddress(b.address);
    setBrPhone(b.phone);
    setBrManager(b.managerName);
    setBrStudents(String(b.activeStudents));
    setBrStatus(b.status);
    setBrImage(b.image ?? '');
    setBrError(null);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrError(null);
    setSaving(true);
    try {
      const payload = {
        name: brName.trim(),
        code: brCode.trim().toUpperCase(),
        city: brCity.trim(),
        address: brAddress.trim(),
        phone: brPhone.trim(),
        managerName: brManager.trim(),
        activeStudents: Math.max(0, Number(brStudents) || 0),
        status: brStatus,
        image: brImage.trim(),
      };
      if (editingBranchId) {
        await apiFetch(`/api/portal/branches/${editingBranchId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify(`Branch "${payload.name}" updated.`);
      } else {
        await apiFetch('/api/portal/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify(`Branch "${payload.name}" created.`);
      }
      resetForm();
      await Promise.all([loadAnalytics(), onRefresh()]);
    } catch (err) {
      setBrError(err instanceof Error ? err.message : 'Failed to save branch.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmStatusTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitionTarget) return;
    if (transitionReason.trim().length < 3) {
      setTransitionError('Please enter an audit reason (minimum 3 characters).');
      return;
    }
    setTransitioning(true);
    setTransitionError(null);
    try {
      await apiFetch(`/api/portal/branches/${transitionTarget.branch.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: transitionTarget.nextStatus,
          reason: transitionReason.trim(),
        }),
      });
      onNotify(
        `Branch "${transitionTarget.branch.name}" transitioned to ${transitionTarget.nextStatus.toUpperCase()}.`
      );
      setTransitionTarget(null);
      setTransitionReason('');
      await Promise.all([loadAnalytics(), onRefresh()]);
    } catch (err) {
      setTransitionError(err instanceof Error ? err.message : 'Failed to update branch status.');
    } finally {
      setTransitioning(false);
    }
  };

  const handleDeleteBranch = async (b: Branch) => {
    if (confirmDeleteId !== b.id) {
      setConfirmDeleteId(b.id);
      return;
    }
    setConfirmDeleteId(null);
    await apiFetch(`/api/portal/branches/${b.id}`, { method: 'DELETE' });
    if (editingBranchId === b.id) resetForm();
    await Promise.all([loadAnalytics(), onRefresh()]);
    onNotify(`Branch "${b.name}" moved to Recycle Bin.`);
  };

  const handleDownloadCsv = async (b: Branch) => {
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/portal/branches/${encodeURIComponent(b.id)}/report-csv`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Failed to export CSV');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `branch-${b.code}-report.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onNotify(`Exported CSV report for ${b.name}.`);
    } catch {
      onNotify(`Could not export CSV for ${b.name}.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Admin Governance Banner & Summary KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Branches
          </p>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-emerald-700">
            {totals.activeCount} / {branches.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Open for admissions &amp; payments</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Restricted / Non-Active
          </p>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-amber-700">
            {totals.restrictedCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Inactive, suspended, or archived</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Branch Income
          </p>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-sky-700">
            ৳{totals.totalIncome.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Recorded financial income</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Branch Fees Due
          </p>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-rose-700">
            ৳{totals.totalFeesDue.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">Open student fee invoices</p>
        </div>
      </div>

      {/* Create / Edit Campus Form (Main Admin Create/Edit, Branch Self-Edit when editing) */}
      {(isMainAdmin || editingBranchId) && (
        <form
          onSubmit={handleSaveBranch}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
                <Building2 className="h-5 w-5 text-indigo-600" />
                <span>
                  {editingBranchId ? 'Edit Campus Branch' : 'Create New Campus Branch'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {isMainAdmin
                  ? 'Branches are operational campuses managed and governed by the Main Admin.'
                  : 'Update your assigned campus contact info, coordinator profile, and photo.'}
              </p>
            </div>
            {editingBranchId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel Edit
              </button>
            )}
          </div>

        {brError && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
            {brError}
          </p>
        )}

        <ImageUploadField
          label="Campus Branch Photo (Device Upload or My Storage)"
          value={brImage}
          onChange={setBrImage}
          category="branch"
          darkMode={darkMode}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            placeholder="Branch Name"
            value={brName}
            onChange={(e) => setBrName(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <input
            type="text"
            required
            placeholder="Code (e.g. AEC-DMD)"
            value={brCode}
            onChange={(e) => setBrCode(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900"
          />
          <input
            type="text"
            required
            placeholder="City"
            value={brCity}
            onChange={(e) => setBrCity(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            type="text"
            required
            placeholder="Full Address"
            value={brAddress}
            onChange={(e) => setBrAddress(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 sm:col-span-2"
          />
          <input
            type="text"
            placeholder="Hotline Phone"
            value={brPhone}
            onChange={(e) => setBrPhone(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600">
              Campus Coordinator / Contact Name
            </span>
            <input
              type="text"
              placeholder="Coordinator Name"
              value={brManager}
              onChange={(e) => setBrManager(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600">
              Active Students Baseline
            </span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={brStudents}
              onChange={(e) => setBrStudents(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-slate-600">
              Branch Operational Status
            </span>
            <select
              aria-label="Branch status"
              value={brStatus}
              disabled={!isMainAdmin}
              onChange={(e) => setBrStatus(e.target.value as BranchStatus)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 disabled:opacity-60"
            >
              <option value="active">Status: Active</option>
              <option value="inactive">Status: Inactive</option>
              <option value="suspended">Status: Suspended</option>
              <option value="archived">Status: Archived</option>
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0b3854] disabled:opacity-60"
        >
          {saving ? 'Saving...' : editingBranchId ? 'Update Campus Branch' : 'Create Branch'}
        </button>
      </form>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'active', 'inactive', 'suspended', 'archived'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold uppercase transition-colors ${
                statusFilter === st
                  ? 'bg-[#062436] text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {st === 'all' ? `All (${branches.length})` : st}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs font-semibold text-slate-500">Refreshing branch analytics...</span>}
      </div>

      {/* Inline Audited Status Transition Modal/Box */}
      {transitionTarget && (
        <form
          onSubmit={handleConfirmStatusTransition}
          className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-md space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-700" />
                <span>Audited Branch Status Change</span>
              </p>
              <h3 className="mt-1 text-base font-extrabold text-slate-900">
                Change &ldquo;{transitionTarget.branch.name}&rdquo; from{' '}
                <span className="uppercase">{transitionTarget.branch.status}</span> to{' '}
                <span className="uppercase text-indigo-700">{transitionTarget.nextStatus}</span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-700">
                {transitionTarget.nextStatus !== 'active'
                  ? 'Historical data stays preserved, while new admissions, enrollments, batches, and payments on this branch are blocked.'
                  : 'Branch will reopen for admissions, enrollments, batches, and payments.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setTransitionTarget(null);
                setTransitionReason('');
                setTransitionError(null);
              }}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700"
            >
              Cancel
            </button>
          </div>
          {transitionError && (
            <p className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-800">
              {transitionError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              required
              minLength={3}
              value={transitionReason}
              onChange={(e) => setTransitionReason(e.target.value)}
              placeholder="Mandatory audit reason (e.g. Facility renovation, compliance hold, seasonal reopen)"
              aria-label="Audit reason for branch status change"
              className="min-w-0 flex-1 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs text-slate-900"
            />
            <button
              type="submit"
              disabled={transitioning}
              className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {transitioning ? 'Applying...' : 'Confirm Status Change'}
            </button>
          </div>
        </form>
      )}

      {/* Branch Cards with KPIs + 4-State Controls + CSV */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredBranches.map((b) => {
          const st = statsById.get(b.id);
          const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.active;
          const confirming = confirmDeleteId === b.id;

          return (
            <div
              key={b.id}
              className={`flex flex-col justify-between overflow-hidden rounded-2xl border shadow-xs ${
                b.status === 'active'
                  ? 'border-slate-200 bg-white'
                  : 'border-slate-300 bg-slate-50/90'
              }`}
            >
              {b.image && (
                <div className="relative h-36 w-full overflow-hidden border-b border-slate-100 bg-slate-100">
                  <img
                    src={b.image}
                    alt={b.name}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tabular text-xs font-bold text-sky-700">
                      {b.code} · {b.city}
                    </span>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <h3 className="mt-1 text-base font-extrabold text-slate-900">{b.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-600">{b.address}</p>
                  <p className="mt-1.5 text-xs font-semibold text-slate-700">
                    Coordinator: {b.managerName} · Phone: {b.phone}
                  </p>

                  {st && (
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px]">
                      <div>
                        <span className="text-slate-500">Teachers / Students</span>
                        <p className="font-mono-tabular font-extrabold text-slate-900">
                          {st.teachersCount} / {st.studentsCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Batches / Enrolled</span>
                        <p className="font-mono-tabular font-extrabold text-slate-900">
                          {st.batchesCount} / {st.enrolledCount}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Attendance</span>
                        <p className="font-mono-tabular font-extrabold text-emerald-700">
                          {st.attendanceRatePercent}% ({st.attendanceTotal})
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Income</span>
                        <p className="font-mono-tabular font-extrabold text-sky-700">
                          ৳{st.totalIncome.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Expenses</span>
                        <p className="font-mono-tabular font-extrabold text-slate-700">
                          ৳{st.totalExpenses.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Net / Due</span>
                        <p className="font-mono-tabular font-extrabold text-indigo-700">
                          ৳{st.netBalance.toLocaleString()} / ৳{st.feesDue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3">
                  {/* 4-State Lifecycle Controls (Main Admin Only) */}
                  {isMainAdmin && (
                  <div className="flex flex-wrap gap-1.5">
                    {b.status !== 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransitionTarget({ branch: b, nextStatus: 'active' });
                          setTransitionReason('');
                          setTransitionError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Activate</span>
                      </button>
                    )}
                    {b.status !== 'inactive' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransitionTarget({ branch: b, nextStatus: 'inactive' });
                          setTransitionReason('');
                          setTransitionError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Power className="h-3 w-3" />
                        <span>Deactivate</span>
                      </button>
                    )}
                    {b.status !== 'suspended' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransitionTarget({ branch: b, nextStatus: 'suspended' });
                          setTransitionReason('');
                          setTransitionError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100"
                      >
                        <PauseCircle className="h-3 w-3" />
                        <span>Suspend</span>
                      </button>
                    )}
                    {b.status !== 'archived' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTransitionTarget({ branch: b, nextStatus: 'archived' });
                          setTransitionReason('');
                          setTransitionError(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100"
                      >
                        <Archive className="h-3 w-3" />
                        <span>Archive</span>
                      </button>
                    )}
                  </div>
                  )}

                  {/* Edit, CSV Export, Delete */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDownloadCsv(b)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export CSV</span>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>{isMainAdmin ? 'Edit' : 'Edit Campus Profile'}</span>
                      </button>
                      {isMainAdmin && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteBranch(b)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold ${
                            confirming
                              ? 'bg-rose-600 text-white'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                          }`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{confirming ? 'Confirm' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Immutable Branch Status Audit History */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <History className="h-4 w-4 text-indigo-600" />
          <span>Immutable Branch Status Audit History ({analytics?.statusHistory.length ?? 0})</span>
        </h3>
        {(analytics?.statusHistory ?? []).length === 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
            <span>No branch lifecycle status transitions recorded yet.</span>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Transition</th>
                  <th className="py-2 pr-3">Reason</th>
                  <th className="py-2">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(analytics?.statusHistory ?? []).slice(0, 20).map((entry) => (
                  <tr key={entry.id}>
                    <td className="font-mono-tabular py-2.5 pr-3 text-slate-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-3 font-bold text-slate-900">{entry.branchName}</td>
                    <td className="py-2.5 pr-3 font-mono-tabular font-bold uppercase text-indigo-700">
                      {entry.previousStatus} → {entry.newStatus}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-700">{entry.reason}</td>
                    <td className="py-2.5 font-semibold text-slate-700">{entry.actorName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
