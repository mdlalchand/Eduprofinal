import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { isCourseStatusLive } from '../../lib/courseEnterprise';
import { computeBatchSeatUsage, filterActiveBranches } from '../../lib/domain';
import {
  computeEnrollmentMetrics,
  filterEnrollments,
  formatEnrollmentsCsv,
} from '../../lib/enrollments';
import type {
  Branch,
  Course,
  CourseBatch,
  Enrollment,
  PaymentGatewayConfig,
  PaymentGatewayType,
  User,
  UserRole,
} from '../../types';

interface EnrollmentsFeePanelProps {
  role: UserRole;
  userBranchId?: string | null;
  enrollments: Enrollment[];
  courses: Course[];
  batches?: CourseBatch[];
  branches: Branch[];
  users?: User[];
  paymentGateways?: PaymentGatewayConfig[];
  darkMode?: boolean;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const DEFAULT_METHODS: PaymentGatewayType[] = [
  'bKash',
  'Nagad',
  'Rocket',
  'SSLCommerz Card',
  'Manual Bank Transfer',
  'Branch Cash',
];

export function EnrollmentsFeePanel({
  role,
  userBranchId,
  enrollments,
  courses,
  batches = [],
  branches,
  users = [],
  paymentGateways = [],
  darkMode = false,
  onRefresh,
  onNotify,
}: EnrollmentsFeePanelProps) {
  const { apiFetch } = useAuth();
  const canManage = role === 'admin';
  const canApproveStatus = role === 'admin' || role === 'branch';

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | Enrollment['status']>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnr, setEditingEnr] = useState<Enrollment | null>(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('bKash');
  const [amountPaid, setAmountPaid] = useState('0');
  const [trxId, setTrxId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState<Enrollment['status']>('pending');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Enterprise Action Modals: Transfer, Cancel & Refund, History
  const [transferEnr, setTransferEnr] = useState<Enrollment | null>(null);
  const [transferCourseId, setTransferCourseId] = useState('');
  const [transferBatchId, setTransferBatchId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferErr, setTransferErr] = useState<string | null>(null);

  const [refundEnr, setRefundEnr] = useState<Enrollment | null>(null);
  const [refundAmount, setRefundAmount] = useState('0');
  const [refundReason, setRefundReason] = useState('');
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundErr, setRefundErr] = useState<string | null>(null);

  const [historyEnr, setHistoryEnr] = useState<Enrollment | null>(null);

  const activeBranches = useMemo(() => filterActiveBranches(branches), [branches]);
  const branchNameMap = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const methodOptions = useMemo(() => {
    const set = new Set<string>(DEFAULT_METHODS);
    for (const gw of paymentGateways) {
      if (gw.code) set.add(gw.code);
    }
    for (const e of enrollments) {
      if (e.paymentMethod) set.add(e.paymentMethod);
    }
    return Array.from(set);
  }, [paymentGateways, enrollments]);

  const studentUsers = useMemo(
    () => users.filter((u) => u.role === 'student'),
    [users]
  );

  const metrics = useMemo(() => computeEnrollmentMetrics(enrollments), [enrollments]);

  const filteredEnrollments = useMemo(
    () =>
      filterEnrollments(enrollments, {
        searchQuery,
        statusFilter,
        methodFilter,
        branchFilter,
      }),
    [enrollments, searchQuery, statusFilter, methodFilter, branchFilter]
  );

  const openCreateModal = () => {
    const defaultCourse = courses.find((c) => isCourseStatusLive(c.status)) || courses[0];
    const defaultBranch = activeBranches[0]?.id || branches[0]?.id || 'online';
    const defaultBatch = batches.find(
      (b) => b.courseId === defaultCourse?.id && b.status !== 'closed' && !computeBatchSeatUsage(b).isFull
    );
    setEditingEnr(null);
    setSelectedUserId('');
    setStudentName('');
    setStudentEmail('');
    setCourseId(defaultCourse?.id || '');
    setBatchId(defaultBatch?.id || '');
    setBranchId(defaultBranch);
    setPaymentMethod(methodOptions[0] || 'bKash');
    setAmountPaid(String(defaultCourse?.price ?? 0));
    setTrxId('');
    setExpiresAt('');
    setStatus('pending');
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (enr: Enrollment) => {
    setEditingEnr(enr);
    setSelectedUserId(enr.userId || '');
    setStudentName(enr.studentName);
    setStudentEmail(enr.studentEmail);
    setCourseId(enr.courseId);
    setBatchId(enr.batchId || '');
    setBranchId(enr.branchId);
    setPaymentMethod(enr.paymentMethod);
    setAmountPaid(String(enr.amountPaid));
    setTrxId(enr.trxId || '');
    setExpiresAt(enr.expiresAt ? enr.expiresAt.slice(0, 10) : '');
    setStatus(enr.status);
    setModalError(null);
    setModalOpen(true);
  };

  const handleStatusChange = async (id: string, nextStatus: Enrollment['status']) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/portal/enrollments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefresh();
      onNotify(`Enrollment status updated to ${nextStatus}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update enrollment status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (enr: Enrollment) => {
    if (confirmDeleteId !== enr.id) {
      setConfirmDeleteId(enr.id);
      return;
    }
    setBusyId(enr.id);
    setConfirmDeleteId(null);
    setActionError(null);
    try {
      await apiFetch(`/api/portal/enrollments/${enr.id}`, { method: 'DELETE' });
      await onRefresh();
      onNotify(`Enrollment for "${enr.studentName}" moved to Recycle Bin.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete enrollment.');
    } finally {
      setBusyId(null);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!studentName.trim() || !studentEmail.trim() || !courseId) {
      setModalError('Student name, email, and course are required.');
      return;
    }
    const parsedAmount = Number(amountPaid);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setModalError('Fee amount must be 0 or greater.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        userId: selectedUserId || undefined,
        studentName: studentName.trim(),
        studentEmail: studentEmail.trim(),
        courseId,
        batchId: batchId || null,
        branchId,
        paymentMethod,
        amountPaid: parsedAmount,
        trxId: trxId.trim() || undefined,
        expiresAt: expiresAt ? expiresAt : null,
        status,
      };
      if (editingEnr) {
        await apiFetch(`/api/portal/enrollments/${editingEnr.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify(`Updated enrollment & fee for "${payload.studentName}".`);
      } else {
        await apiFetch('/api/portal/enrollments', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify(`Added enrollment & fee record for "${payload.studentName}".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Failed to save enrollment.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferEnr) return;
    setTransferBusy(true);
    setTransferErr(null);
    try {
      await apiFetch(`/api/portal/enrollments/${transferEnr.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          targetCourseId: transferCourseId,
          targetBatchId: transferBatchId || null,
          reason: transferReason.trim() || 'Administrative course/batch transfer',
        }),
      });
      onNotify(`Transferred "${transferEnr.studentName}" successfully.`);
      setTransferEnr(null);
      await onRefresh();
    } catch (err) {
      setTransferErr(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setTransferBusy(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundEnr) return;
    setRefundBusy(true);
    setRefundErr(null);
    try {
      await apiFetch(`/api/portal/enrollments/${refundEnr.id}/cancel-refund`, {
        method: 'POST',
        body: JSON.stringify({
          refundAmount: Math.max(0, Number(refundAmount) || 0),
          reason: refundReason.trim() || 'Cancelled upon admin/student request',
        }),
      });
      onNotify(`Cancelled enrollment for "${refundEnr.studentName}" and recorded refund.`);
      setRefundEnr(null);
      await onRefresh();
    } catch (err) {
      setRefundErr(err instanceof Error ? err.message : 'Cancel & refund failed.');
    } finally {
      setRefundBusy(false);
    }
  };

  const handleExportCsv = () => {
    const csv = formatEnrollmentsCsv(filteredEnrollments, branches);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `enrollments-fees-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const cardSurface = darkMode
    ? 'border-[#1E2E52] bg-[#0F1B3B] text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';

  const subSurface = darkMode
    ? 'border-[#1E2E52] bg-[#09122B]/80'
    : 'border-slate-200/80 bg-slate-50/70';

  const inputClass = darkMode
    ? 'border-[#253763] bg-[#0B142C] text-slate-100 placeholder:text-slate-400'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400';

  return (
    <div className="space-y-5">
      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={`rounded-2xl border p-4 shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-70">Total Enrollments</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold">{metrics.totalCount}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-70">Approved Revenue</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ৳{metrics.approvedRevenue.toLocaleString()}
          </p>
          <p className="text-[11px] opacity-70">{metrics.approvedCount} approved</p>
        </div>
        <button
          type="button"
          onClick={() => setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'))}
          className={`rounded-2xl border p-4 text-left shadow-xs transition-colors hover:border-amber-400 ${cardSurface}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-70">Pending Approvals</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {metrics.pendingCount}
          </p>
          <p className="font-mono-tabular text-[11px] opacity-70">
            ৳{metrics.pendingRevenue.toLocaleString()} awaiting verification
          </p>
        </button>
        <div className={`rounded-2xl border p-4 shadow-xs ${cardSurface}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold opacity-70">Rejected / Held</span>
            <XCircle className="h-4 w-4 text-rose-500" />
          </div>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {metrics.rejectedCount}
          </p>
        </div>
      </div>

      {/* Main Dynamic Enrollments & Fee Table Card */}
      <div className={`rounded-2xl border p-6 shadow-xs ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">
              Enrollments &amp; Fee Approvals ({filteredEnrollments.length})
            </h2>
            <p className="text-xs opacity-70">
              Manage student enrollments, verify payments, edit fee amounts, and control access in real time
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredEnrollments.length === 0}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors disabled:opacity-50 ${
                darkMode
                  ? 'border-[#253763] bg-[#09122B] text-slate-200 hover:bg-[#132347]'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                <span>Add Enrollment</span>
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Filter Controls */}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter enrollments by status">
            {(
              [
                { id: 'all', label: `All (${enrollments.length})` },
                { id: 'pending', label: `Pending (${metrics.pendingCount})` },
                { id: 'approved', label: `Approved (${metrics.approvedCount})` },
                { id: 'rejected', label: `Rejected (${metrics.rejectedCount})` },
                {
                  id: 'cancelled',
                  label: `Cancelled (${enrollments.filter((e) => e.status === 'cancelled').length})`,
                },
                {
                  id: 'expired',
                  label: `Expired (${enrollments.filter((e) => e.status === 'expired').length})`,
                },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                    active
                      ? 'bg-gradient-to-r from-[#2563EB] to-[#6366F1] text-white shadow-xs'
                      : darkMode
                        ? 'border border-[#253763] bg-[#09122B] text-slate-300 hover:bg-[#132347]'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, course, TrxID..."
                aria-label="Search enrollments"
                className={`w-full rounded-xl border py-1.5 pl-8 pr-3 text-xs focus:border-blue-500 focus:outline-none ${inputClass}`}
              />
            </div>

            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              aria-label="Filter by payment method"
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${inputClass}`}
            >
              <option value="all">All Methods</option>
              {methodOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {branches.length > 0 && (
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                aria-label="Filter by branch"
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${inputClass}`}
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
        </div>

        {actionError && (
          <p className="mt-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            {actionError}
          </p>
        )}

        {/* Table */}
        <div className={`mt-4 overflow-x-auto rounded-2xl border ${subSurface}`}>
          {filteredEnrollments.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs opacity-70">
              No enrollments match your active search or filters.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr
                  className={`border-b text-xs font-bold uppercase ${
                    darkMode
                      ? 'border-[#1E2E52] text-slate-400'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Course</th>
                  <th className="px-3 py-2.5">Method</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  {canApproveStatus && <th className="px-4 py-2.5">Actions</th>}
                </tr>
              </thead>
              <tbody className={`divide-y ${darkMode ? 'divide-[#1E2E52]' : 'divide-slate-200/70'}`}>
                {filteredEnrollments.map((enr) => {
                  const isBusy = busyId === enr.id;
                  const isConfirmDelete = confirmDeleteId === enr.id;
                  const branchName = branchNameMap.get(enr.branchId) || enr.branchId;
                  return (
                    <tr
                      key={enr.id}
                      className={darkMode ? 'hover:bg-[#132347]/60' : 'hover:bg-white'}
                    >
                      <td className="px-4 py-3">
                        <p className="font-bold">{enr.studentName}</p>
                        <p className="text-xs opacity-70">{enr.studentEmail}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-blue-600 dark:text-cyan-300">
                          {branchName}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <p className="font-semibold">{enr.courseTitle}</p>
                        {enr.batchName && (
                          <p className="mt-0.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                            Batch: {enr.batchName}
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] opacity-60">
                          {new Date(enr.enrolledAt).toLocaleDateString()}
                          {enr.expiresAt ? ` · Exp: ${enr.expiresAt.slice(0, 10)}` : ''}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold">
                          <CreditCard className="h-3.5 w-3.5 text-indigo-500" />
                          <span>{enr.paymentMethod}</span>
                        </span>
                        {(enr.trxId || enr.invoiceNo) && (
                          <p className="font-mono-tabular mt-0.5 text-[11px] opacity-70">
                            {enr.trxId || enr.invoiceNo}
                          </p>
                        )}
                      </td>
                      <td className="font-mono-tabular px-3 py-3 font-bold">
                        <p>৳{enr.amountPaid}</p>
                        {typeof enr.refundAmount === 'number' && enr.refundAmount > 0 && (
                          <span className="block text-[10px] font-bold text-rose-600">
                            Refunded: ৳{enr.refundAmount}
                          </span>
                        )}
                        {enr.couponUsed && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Code: {enr.couponUsed}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {canApproveStatus ? (
                          <select
                            value={enr.status}
                            disabled={isBusy}
                            aria-label={`Status for ${enr.studentName}`}
                            onChange={(e) =>
                              handleStatusChange(enr.id, e.target.value as Enrollment['status'])
                            }
                            className={`rounded-lg border px-2.5 py-1 text-xs font-extrabold uppercase ${
                              enr.status === 'approved'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : enr.status === 'pending'
                                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                                  : 'border-rose-300 bg-rose-50 text-rose-700'
                            }`}
                          >
                            <option value="approved">APPROVED</option>
                            <option value="pending">PENDING</option>
                            <option value="rejected">REJECTED</option>
                            {canManage && (
                              <>
                                <option value="cancelled">CANCELLED</option>
                                <option value="transferred">TRANSFERRED</option>
                                <option value="expired">EXPIRED</option>
                              </>
                            )}
                          </select>
                        ) : (
                          <span
                            className={`text-xs font-bold uppercase ${
                              enr.status === 'approved'
                                ? 'text-emerald-700'
                                : enr.status === 'pending'
                                  ? 'text-amber-700'
                                  : 'text-rose-700'
                            }`}
                          >
                            {enr.status}
                          </span>
                        )}
                      </td>
                      {canApproveStatus && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {enr.status !== 'approved' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(enr.id, 'approved')}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                              >
                                Approve
                              </button>
                            )}
                            {enr.status === 'pending' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(enr.id, 'rejected')}
                                className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                            {enr.status !== 'pending' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleStatusChange(enr.id, 'pending')}
                                title="Move back to Pending Verification"
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                                  darkMode
                                    ? 'border-[#253763] bg-[#09122B] text-amber-300 hover:bg-[#132347]'
                                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                }`}
                              >
                                <RotateCcw className="h-3 w-3" />
                                <span>Pending</span>
                              </button>
                            )}
                            {canManage && (
                              <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openEditModal(enr)}
                              aria-label={`Edit enrollment for ${enr.studentName}`}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                                darkMode
                                  ? 'border-[#253763] bg-[#09122B] text-slate-200 hover:bg-[#132347]'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setTransferEnr(enr);
                                setTransferCourseId(enr.courseId);
                                setTransferBatchId(enr.batchId || '');
                                setTransferReason('');
                                setTransferErr(null);
                              }}
                              aria-label={`Transfer enrollment for ${enr.studentName}`}
                              title="Transfer Course or Batch"
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                                darkMode
                                  ? 'border-[#253763] bg-[#09122B] text-sky-300 hover:bg-[#132347]'
                                  : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                              }`}
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                              <span>Transfer</span>
                            </button>
                            {enr.status !== 'cancelled' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setRefundEnr(enr);
                                  setRefundAmount(String(enr.amountPaid));
                                  setRefundReason('');
                                  setRefundErr(null);
                                }}
                                aria-label={`Cancel & Refund ${enr.studentName}`}
                                title="Cancel & Issue Refund"
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                                  darkMode
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                }`}
                              >
                                <Ban className="h-3 w-3" />
                                <span>Refund</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setHistoryEnr(enr)}
                              aria-label={`View history for ${enr.studentName}`}
                              title="Enrollment History"
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${
                                darkMode
                                  ? 'border-[#253763] bg-[#09122B] text-slate-300 hover:bg-[#132347]'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <History className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleDelete(enr)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
                                isConfirmDelete
                                  ? 'bg-rose-600 text-white'
                                  : darkMode
                                    ? 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
                                    : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              }`}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{isConfirmDelete ? 'Confirm?' : 'Delete'}</span>
                            </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add / Edit Enrollment & Fee Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingEnr ? 'Edit Enrollment & Fee' : 'Add Manual Enrollment'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold">
                  {editingEnr ? 'Edit Enrollment & Fee Record' : 'Add Enrollment & Record Fee'}
                </h3>
                <p className="text-xs text-slate-500">
                  Changes sync course enrollment counts, transactions, and audit logs
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close enrollment modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-3.5 overflow-y-auto p-6">
              {!editingEnr && studentUsers.length > 0 && (
                <div>
                  <label
                    htmlFor="enr-pick-user"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Quick-Select Registered Student (optional)
                  </label>
                  <select
                    id="enr-pick-user"
                    value={selectedUserId}
                    onChange={(e) => {
                      const uid = e.target.value;
                      setSelectedUserId(uid);
                      const picked = studentUsers.find((u) => u.id === uid);
                      if (picked) {
                        setStudentName(picked.name);
                        setStudentEmail(picked.email);
                        if (
                          picked.branchId &&
                          activeBranches.some((b) => b.id === picked.branchId)
                        ) {
                          setBranchId(picked.branchId);
                        }
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold"
                  >
                    <option value="">-- Enter Custom Student Below --</option>
                    {studentUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="enr-student-name"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Student Name
                  </label>
                  <input
                    id="enr-student-name"
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Tanvir Hasan"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="enr-student-email"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Student Email
                  </label>
                  <input
                    id="enr-student-email"
                    type="email"
                    required
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="enr-course"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Course / Combo Batch
                </label>
                <select
                  id="enr-course"
                  required
                  value={courseId}
                  onChange={(e) => {
                    const nextCourseId = e.target.value;
                    setCourseId(nextCourseId);
                    setBatchId('');
                    const matched = courses.find((c) => c.id === nextCourseId);
                    if (matched && !editingEnr) {
                      setAmountPaid(String(matched.price));
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} (৳{c.price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="enr-batch"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Assign Batch
                  </label>
                  <select
                    id="enr-batch"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="">-- No Specific Batch --</option>
                    {batches
                      .filter((b) => b.courseId === courseId)
                      .map((b) => {
                        const usage = computeBatchSeatUsage(b);
                        return (
                          <option
                            key={b.id}
                            value={b.id}
                            disabled={b.id !== editingEnr?.batchId && (b.status === 'closed' || usage.isFull)}
                          >
                            {b.name} ({usage.remainingSeats} left)
                          </option>
                        );
                      })}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="enr-expiry"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Access Expiry (Optional)
                  </label>
                  <input
                    id="enr-expiry"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="enr-branch"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Campus Branch
                  </label>
                  <select
                    id="enr-branch"
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold disabled:bg-slate-100"
                  >
                    {activeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                    {editingEnr &&
                      !activeBranches.some((b) => b.id === editingEnr.branchId) && (
                        <option value={editingEnr.branchId}>
                          {branchNameMap.get(editingEnr.branchId) || editingEnr.branchId} (Inactive)
                        </option>
                      )}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="enr-method"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Payment Method
                  </label>
                  <select
                    id="enr-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    {methodOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="enr-amount"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Amount Paid (৳)
                  </label>
                  <input
                    id="enr-amount"
                    type="number"
                    min={0}
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label
                    htmlFor="enr-trx"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    TrxID / Receipt Ref
                  </label>
                  <input
                    id="enr-trx"
                    type="text"
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value)}
                    placeholder="e.g. BK9911 or CASH-01"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label
                    htmlFor="enr-status"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Approval Status
                  </label>
                  <select
                    id="enr-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Enrollment['status'])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="transferred">Transferred</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              {modalError && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {modalError}
                </p>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-gradient-to-r from-[#2563EB] to-[#6366F1] px-5 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingEnr ? 'Save Changes' : 'Create Enrollment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course / Batch Transfer Modal */}
      {transferEnr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Transfer Student Enrollment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold">Transfer Course / Batch</h3>
              <button
                type="button"
                onClick={() => setTransferEnr(null)}
                aria-label="Close transfer modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-3">
              <p className="text-xs text-slate-600">
                Student: <strong className="text-slate-900">{transferEnr.studentName}</strong>
              </p>
              <div>
                <label htmlFor="tr-course" className="mb-1 block text-xs font-bold text-slate-700">
                  Target Course
                </label>
                <select
                  id="tr-course"
                  value={transferCourseId}
                  onChange={(e) => {
                    setTransferCourseId(e.target.value);
                    setTransferBatchId('');
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {courses
                    .filter((c) => isCourseStatusLive(c.status))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="tr-batch" className="mb-1 block text-xs font-bold text-slate-700">
                  Target Batch
                </label>
                <select
                  id="tr-batch"
                  value={transferBatchId}
                  onChange={(e) => setTransferBatchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="">-- No Specific Batch --</option>
                  {batches
                    .filter((b) => b.courseId === transferCourseId)
                    .map((b) => {
                      const usage = computeBatchSeatUsage(b);
                      return (
                        <option
                          key={b.id}
                          value={b.id}
                          disabled={b.id !== transferEnr.batchId && (b.status === 'closed' || usage.isFull)}
                        >
                          {b.name} ({usage.remainingSeats} left)
                        </option>
                      );
                    })}
                </select>
              </div>
              <div>
                <label htmlFor="tr-reason" className="mb-1 block text-xs font-bold text-slate-700">
                  Transfer Reason
                </label>
                <input
                  id="tr-reason"
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Schedule conflict / batch upgrade"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              {transferErr && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {transferErr}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTransferEnr(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferBusy}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {transferBusy ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel & Refund Modal */}
      {refundEnr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cancel & Refund Enrollment"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-rose-700">Cancel &amp; Refund Enrollment</h3>
              <button
                type="button"
                onClick={() => setRefundEnr(null)}
                aria-label="Close refund modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRefundSubmit} className="mt-4 space-y-3">
              <p className="text-xs text-slate-600">
                Student: <strong className="text-slate-900">{refundEnr.studentName}</strong> · Paid:{' '}
                <strong className="font-mono-tabular">৳{refundEnr.amountPaid}</strong>
              </p>
              <div>
                <label htmlFor="rf-amount" className="mb-1 block text-xs font-bold text-slate-700">
                  Refund Amount (BDT)
                </label>
                <input
                  id="rf-amount"
                  type="number"
                  min={0}
                  max={refundEnr.amountPaid}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
                />
              </div>
              <div>
                <label htmlFor="rf-reason" className="mb-1 block text-xs font-bold text-slate-700">
                  Cancellation / Refund Reason
                </label>
                <input
                  id="rf-reason"
                  type="text"
                  required
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  placeholder="Requested within 7-day refund policy"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              {refundErr && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {refundErr}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundEnr(null)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
                >
                  Keep Enrollment
                </button>
                <button
                  type="submit"
                  disabled={refundBusy}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {refundBusy ? 'Processing...' : 'Confirm Cancel & Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enrollment History Modal */}
      {historyEnr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Enrollment History"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-extrabold">Enrollment History Timeline</h3>
                <p className="text-xs text-slate-500">
                  {historyEnr.studentName} · {historyEnr.courseTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryEnr(null)}
                aria-label="Close history modal"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto p-6 text-xs">
              {(historyEnr.history ?? []).length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-slate-500">
                  Enrolled on {new Date(historyEnr.enrolledAt).toLocaleString()} via{' '}
                  {historyEnr.paymentMethod}.
                </p>
              ) : (
                (historyEnr.history ?? []).map((h, i) => (
                  <div
                    key={h.id || i}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-indigo-700">
                        {h.action}
                      </span>
                      <span className="font-mono-tabular text-[11px] text-slate-500">
                        {new Date(h.createdAt || h.at || historyEnr.enrolledAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1.5 font-semibold text-slate-800">{h.note}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">By {h.actorName}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
