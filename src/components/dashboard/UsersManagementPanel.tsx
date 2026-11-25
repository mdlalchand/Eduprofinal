import {
  CheckCircle2,
  Download,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ImageUploadField } from '../ImageUploadField';
import {
  computeUserRoleSummary,
  filterUsersDirectory,
  formatUsersCsv,
} from '../../lib/usersAndTeaching';
import type {
  AttendanceRecord,
  Branch,
  Enrollment,
  ExamAttempt,
  LearnerRewardProfile,
  Order,
  User,
  UserRole,
} from '../../types';

interface UsersManagementPanelProps {
  currentUser: User;
  users: User[];
  branches: Branch[];
  darkMode?: boolean;
  defaultCreateRole?: UserRole;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Main Admin',
  teacher: 'Teacher',
  student: 'Student',
  guardian: 'Guardian',
  branch: 'Branch',
};

const ROLE_BADGE_COLORS: Record<UserRole, string> = {
  admin: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  teacher: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  student: 'bg-blue-50 text-blue-700 border-blue-200',
  guardian: 'bg-amber-100 text-amber-800 border-amber-200',
  branch: 'bg-purple-100 text-purple-800 border-purple-200',
};

interface UserDetailsPayload {
  user: User;
  enrollments: Enrollment[];
  examAttempts: ExamAttempt[];
  orders: Order[];
  attendance: AttendanceRecord[];
  rewards: LearnerRewardProfile | null;
}

export function UsersManagementPanel({
  currentUser,
  users,
  branches,
  darkMode = false,
  defaultCreateRole = 'student',
  onRefresh,
  onNotify,
}: UsersManagementPanelProps) {
  const { apiFetch } = useAuth();
  const isAdmin = currentUser.role === 'admin';

  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'active' | 'suspended' | 'rejected'
  >('all');
  const [search, setSearch] = useState('');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formRole, setFormRole] = useState<UserRole>(defaultCreateRole);
  const [formBranchId, setFormBranchId] = useState<string>(
    currentUser.branchId || branches[0]?.id || 'br-mirpur'
  );
  const [formRollNumber, setFormRollNumber] = useState('');
  const [formStatus, setFormStatus] = useState<'pending' | 'active' | 'suspended' | 'rejected'>(
    'active'
  );
  const [formSpecialty, setFormSpecialty] = useState('');
  const [formEducation, setFormEducation] = useState('');
  const [formApprovalNote, setFormApprovalNote] = useState('');
  const [formBranchName, setFormBranchName] = useState('');
  const [formBranchCode, setFormBranchCode] = useState('');
  const [formBranchCity, setFormBranchCity] = useState('');
  const [formBranchAddress, setFormBranchAddress] = useState('');
  const [formAvatar, setFormAvatar] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formLinkedStudents, setFormLinkedStudents] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Admin password reset token banner state
  const [issuedResetToken, setIssuedResetToken] = useState<{
    name: string;
    email: string;
    token: string;
    expiresAt: string;
  } | null>(null);

  // 360 Inspector modal state
  const [inspectData, setInspectData] = useState<UserDetailsPayload | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const summary = useMemo(() => computeUserRoleSummary(users), [users]);
  const filteredUsers = useMemo(
    () =>
      filterUsersDirectory(users, {
        role: roleFilter,
        branchId: branchFilter,
        status: statusFilter,
        search,
      }),
    [users, roleFilter, branchFilter, statusFilter, search]
  );

  const studentOptions = useMemo(
    () => users.filter((u) => u.role === 'student'),
    [users]
  );

  const branchNameMap = useMemo(
    () => new Map(branches.map((b) => [b.id, b.name])),
    [branches]
  );

  const openCreateModal = (presetRole?: UserRole) => {
    const resolvedRole = presetRole || defaultCreateRole;
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPhone('');
    setFormRole(resolvedRole);
    setFormBranchId(
      resolvedRole === 'branch' ? '' : currentUser.branchId || branches[0]?.id || 'br-mirpur'
    );
    setFormRollNumber('');
    setFormStatus('active');
    setFormSpecialty('');
    setFormEducation('');
    setFormApprovalNote('');
    setFormBranchName('');
    setFormBranchCode('');
    setFormBranchCity('');
    setFormBranchAddress('');
    setFormAvatar('');
    setFormBio('');
    setFormPassword('');
    setFormLinkedStudents([]);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPhone(u.phone || '');
    setFormRole(u.role);
    setFormBranchId(u.branchId || '');
    setFormRollNumber(u.rollNumber || '');
    setFormStatus(u.status ?? 'active');
    setFormSpecialty(u.subjectSpecialty || '');
    setFormEducation(u.education || '');
    setFormApprovalNote(u.approvalNote || '');
    const linkedBr = u.branchId ? branches.find((b) => b.id === u.branchId) : undefined;
    setFormBranchName(linkedBr?.name || '');
    setFormBranchCode(linkedBr?.code || '');
    setFormBranchCity(linkedBr?.city || '');
    setFormBranchAddress(linkedBr?.address || '');
    setFormAvatar(u.avatar || '');
    setFormBio(u.bio || '');
    setFormPassword('');
    setFormLinkedStudents(u.guardianLinkedStudentIds ?? []);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim(),
        role: formRole,
        branchId: formBranchId || null,
        status: formStatus,
        rollNumber: formRole === 'student' ? formRollNumber.trim() || undefined : undefined,
        subjectSpecialty: formSpecialty.trim() || undefined,
        education: formEducation.trim() || undefined,
        approvalNote: formApprovalNote.trim() || undefined,
        avatar: formAvatar.trim(),
        bio: formBio.trim() || undefined,
        guardianLinkedStudentIds: formRole === 'guardian' ? formLinkedStudents : undefined,
      };
      if (formRole === 'branch' && !formBranchId) {
        payload.branchName = formBranchName.trim() || undefined;
        payload.branchCode = formBranchCode.trim() || undefined;
        payload.branchCity = formBranchCity.trim() || undefined;
        payload.branchAddress = formBranchAddress.trim() || undefined;
      }
      if (!editingUser && !formPassword.trim()) {
        setFormError('Strong initial password (min 8 chars, letters and numbers) is required.');
        setSaving(false);
        return;
      }
      if (formPassword.trim()) {
        if (formPassword.trim().length < 8) {
          setFormError('Password must be at least 8 characters.');
          setSaving(false);
          return;
        }
        payload.password = formPassword.trim();
      }

      if (editingUser) {
        await apiFetch(`/api/portal/users/${editingUser.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        onNotify(`Updated user profile for "${formName.trim()}".`);
      } else {
        await apiFetch('/api/portal/users', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify(`Created new ${ROLE_LABELS[formRole]} account for "${formName.trim()}".`);
      }
      setModalOpen(false);
      await onRefresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const handleApproveUser = async (u: User) => {
    try {
      await apiFetch(`/api/portal/users/${u.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approvalNote: 'Approved by Main Admin' }),
      });
      await onRefresh();
      onNotify(`Approved ${ROLE_LABELS[u.role]} account for ${u.name}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not approve user.');
    }
  };

  const handleRejectUser = async (u: User) => {
    try {
      await apiFetch(`/api/portal/users/${u.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ approvalNote: 'Rejected by Main Admin' }),
      });
      await onRefresh();
      onNotify(`Marked ${u.name} as rejected.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not reject user.');
    }
  };

  const handleIssueResetToken = async (u: User) => {
    try {
      const res = await apiFetch<{
        ok: boolean;
        email: string;
        resetToken: string;
        expiresAt: string;
      }>(`/api/portal/users/${u.id}/issue-reset-token`, {
        method: 'POST',
      });
      setIssuedResetToken({
        name: u.name,
        email: res.email,
        token: res.resetToken,
        expiresAt: res.expiresAt,
      });
      await onRefresh();
      onNotify(`Issued recovery reset token for ${u.email}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not issue recovery token.');
    }
  };

  const handleToggleStatus = async (u: User) => {
    const nextStatus = (u.status ?? 'active') === 'active' ? 'suspended' : 'active';
    try {
      await apiFetch(`/api/portal/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefresh();
      onNotify(`${u.name} is now ${nextStatus}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update status.');
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (confirmDeleteId !== u.id) {
      setConfirmDeleteId(u.id);
      return;
    }
    try {
      await apiFetch(`/api/portal/users/${u.id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      await onRefresh();
      onNotify(`Removed user "${u.name}" from directory.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not delete user.');
    }
  };

  const handleInspect = async (u: User) => {
    setInspectLoading(true);
    try {
      const details = await apiFetch<UserDetailsPayload>(`/api/portal/users/${u.id}/details`);
      setInspectData(details);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load user details.');
    } finally {
      setInspectLoading(false);
    }
  };

  const handleExportCsv = () => {
    const csv = formatUsersCsv(filteredUsers, branches);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aloms-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify(`Exported ${filteredUsers.length} user records to CSV.`);
  };

  const cardSurface = darkMode
    ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
    : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className="space-y-6">
      {/* Pending Admin Approval Alert Banner */}
      {summary.pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-3.5 text-amber-950 shadow-xs">
          <div className="flex items-center gap-2.5 text-xs">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-extrabold">
                {summary.pending} Registration Request{summary.pending > 1 ? 's' : ''} Waiting for Main Admin Approval
              </p>
              <p className="text-[11px] text-amber-800">
                Review Student, Guardian, Teacher, or Branch sign-ups before granting portal login access.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRoleFilter('all');
              setStatusFilter('pending');
            }}
            className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700"
          >
            Review Pending ({summary.pending})
          </button>
        </div>
      )}

      {/* Admin-Issued Password Recovery Token Banner */}
      {issuedResetToken && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-3.5 text-xs text-indigo-950">
          <div>
            <p className="font-extrabold">
              Recovery Reset Token Generated for {issuedResetToken.name} ({issuedResetToken.email})
            </p>
            <p className="mt-0.5 text-[11px] text-indigo-800">
              Share this 1-hour recovery code for the /recover portal:{' '}
              <code className="font-mono-tabular rounded bg-white px-2 py-0.5 font-extrabold text-indigo-900 border border-indigo-200">
                {issuedResetToken.token}
              </code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIssuedResetToken(null)}
            className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 font-bold text-indigo-700 hover:bg-indigo-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Role Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {[
          { key: 'all' as const, label: 'All Users', count: summary.total, tone: 'bg-slate-900 text-white' },
          { key: 'student' as const, label: 'Students', count: summary.student, tone: 'bg-blue-50 text-blue-800 border-blue-200' },
          { key: 'teacher' as const, label: 'Teachers', count: summary.teacher, tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
          { key: 'guardian' as const, label: 'Guardians', count: summary.guardian, tone: 'bg-amber-50 text-amber-800 border-amber-200' },
          { key: 'branch' as const, label: 'Branches', count: summary.branch, tone: 'bg-purple-50 text-purple-800 border-purple-200' },
          { key: 'admin' as const, label: 'Main Admin', count: summary.admin, tone: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setRoleFilter(item.key);
              if (statusFilter === 'pending') setStatusFilter('all');
            }}
            className={`rounded-2xl border p-3.5 text-left transition-all ${
              roleFilter === item.key && statusFilter !== 'pending'
                ? 'ring-2 ring-blue-500 shadow-sm'
                : 'opacity-90 hover:opacity-100'
            } ${item.tone}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{item.label}</p>
            <p className="font-mono-tabular mt-1 text-2xl font-extrabold">{item.count}</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setRoleFilter('all');
            setStatusFilter((prev) => (prev === 'pending' ? 'all' : 'pending'));
          }}
          className={`rounded-2xl border border-amber-300 bg-amber-100/80 p-3.5 text-left text-amber-950 transition-all ${
            statusFilter === 'pending' ? 'ring-2 ring-amber-500 shadow-sm' : 'opacity-90 hover:opacity-100'
          }`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Pending</p>
          <p className="font-mono-tabular mt-1 text-2xl font-extrabold">{summary.pending}</p>
        </button>
      </div>

      {/* Directory Container */}
      <div className={`rounded-2xl border p-6 shadow-xs ${cardSurface}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Users, Faculty &amp; Role Access Control ({filteredUsers.length})</span>
            </h2>
            <p className="mt-0.5 text-xs opacity-70">
              {summary.active} Active · {summary.pending} Pending · {summary.suspended} Suspended · {summary.rejected} Rejected · Approve registrations, issue reset tokens &amp; manage roles
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('branch')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-bold text-purple-800 hover:bg-purple-100"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Add Branch</span>
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('teacher')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Add Teacher</span>
            </button>
            <button
              type="button"
              onClick={() => openCreateModal('student')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Add New User</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-5">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, roll, or specialty..."
              aria-label="Search users directory"
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserRole)}
            aria-label="Filter users by role"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 sm:col-span-3"
          >
            <option value="all">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="guardian">Guardians</option>
            <option value="branch">Branches</option>
            <option value="admin">Main Admin</option>
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            aria-label="Filter users by branch"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 sm:col-span-2"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(
                e.target.value as 'all' | 'pending' | 'active' | 'suspended' | 'rejected'
              )
            }
            aria-label="Filter users by status"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 sm:col-span-2"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
            <option value="rejected">Rejected Only</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="mt-5 overflow-x-auto">
          {filteredUsers.length === 0 ? (
            <p className="py-10 text-center text-xs opacity-60">
              No users match the active filters.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase opacity-65">
                  <th className="py-2.5 pr-4">User</th>
                  <th className="py-2.5 pr-4">Contact &amp; Roll</th>
                  <th className="py-2.5 pr-4">Role &amp; Branch</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const status = u.status ?? 'active';
                  const isSelf = u.id === currentUser.id;
                  const canEditTarget = isAdmin;
                  const confirming = confirmDeleteId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-white/5">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          {u.avatar ? (
                            <img
                              src={u.avatar}
                              alt={u.name}
                              referrerPolicy="no-referrer"
                              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-blue-500/20"
                            />
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-extrabold text-white">
                              {u.name
                                .split(' ')
                                .map((p) => p[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold truncate">
                              {u.name} {isSelf && <span className="text-[10px] text-indigo-600">(You)</span>}
                            </p>
                            <p className="text-[11px] opacity-70 truncate">
                              {u.subjectSpecialty || u.bio || u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <p className="font-medium">{u.email}</p>
                        <p className="font-mono-tabular opacity-70">
                          {u.rollNumber ? `${u.rollNumber} · ` : ''}
                          {u.phone}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-xs">
                        <span
                          className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-bold ${ROLE_BADGE_COLORS[u.role]}`}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                        <p className="mt-1 text-[11px] opacity-70">
                          {u.branchId ? branchNameMap.get(u.branchId) ?? u.branchId : 'Global / All Campuses'}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold uppercase ${
                            status === 'active'
                              ? 'bg-emerald-50 text-emerald-700'
                              : status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {status === 'active' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <ShieldAlert className="h-3 w-3" />
                          )}
                          <span>{status}</span>
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleInspect(u)}
                            aria-label={`Inspect ${u.name}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-blue-400 hover:text-blue-700"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Inspect</span>
                          </button>
                          {canEditTarget && (
                            <>
                              {!isSelf && status === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleApproveUser(u)}
                                    aria-label={`Approve ${u.name}`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleRejectUser(u)}
                                    aria-label={`Reject ${u.name}`}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                aria-label={`Edit ${u.name}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:border-indigo-400 hover:text-indigo-700"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleIssueResetToken(u)}
                                aria-label={`Reset Token ${u.name}`}
                                title="Issue 1-hour account recovery token"
                                className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                <span>Reset Token</span>
                              </button>
                              {!isSelf && status !== 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleStatus(u)}
                                  aria-label={
                                    status === 'active'
                                      ? `Suspend ${u.name}`
                                      : `Activate ${u.name}`
                                  }
                                  className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                                    status === 'active'
                                      ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                      : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                  }`}
                                >
                                  {status === 'active' ? 'Suspend' : 'Activate'}
                                </button>
                              )}
                              {isAdmin && !isSelf && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteUser(u)}
                                  aria-label={`Delete ${u.name}`}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${
                                    confirming
                                      ? 'bg-rose-600 text-white'
                                      : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  }`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {confirming && <span>Confirm</span>}
                                </button>
                              )}
                            </>
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
      </div>

      {/* Create / Edit User Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingUser ? 'Edit User Account' : 'Create User Account'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleSaveUser}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold flex items-center gap-2">
                <Plus className="h-5 w-5 text-indigo-600" />
                <span>{editingUser ? `Edit User: ${editingUser.name}` : 'Create New Platform User'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close user modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700">
                {formError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="usr-name" className="block text-xs font-bold text-slate-700">
                  Full Name *
                </label>
                <input
                  id="usr-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="usr-email" className="block text-xs font-bold text-slate-700">
                  Email Address *
                </label>
                <input
                  id="usr-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="usr-phone" className="block text-xs font-bold text-slate-700">
                  Phone Number
                </label>
                <input
                  id="usr-phone"
                  type="tel"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="01710000000"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="usr-role" className="block text-xs font-bold text-slate-700">
                  Role
                </label>
                <select
                  id="usr-role"
                  value={formRole}
                  disabled={Boolean(editingUser && editingUser.id === currentUser.id)}
                  onChange={(e) => setFormRole(e.target.value as UserRole)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="guardian">Guardian</option>
                  <option value="branch">Branch</option>
                  {editingUser?.role === 'admin' && <option value="admin">Main Admin</option>}
                </select>
              </div>
              <div>
                <label htmlFor="usr-branch" className="block text-xs font-bold text-slate-700">
                  Campus Branch
                </label>
                <select
                  id="usr-branch"
                  value={formBranchId}
                  disabled={!isAdmin}
                  onChange={(e) => setFormBranchId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="">
                    {formRole === 'branch' ? 'Auto-Create New Branch Campus' : 'Global / Online Only'}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="usr-status" className="block text-xs font-bold text-slate-700">
                  Account Status
                </label>
                <select
                  id="usr-status"
                  value={formStatus}
                  disabled={Boolean(editingUser && editingUser.id === currentUser.id)}
                  onChange={(e) =>
                    setFormStatus(
                      e.target.value as 'pending' | 'active' | 'suspended' | 'rejected'
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                >
                  <option value="active">Active (Login Allowed)</option>
                  <option value="pending">Pending Approval</option>
                  <option value="suspended">Suspended (Login Blocked)</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {formRole === 'student' && (
                <div>
                  <label htmlFor="usr-roll" className="block text-xs font-bold text-slate-700">
                    Roll Number (optional auto-generated)
                  </label>
                  <input
                    id="usr-roll"
                    type="text"
                    value={formRollNumber}
                    onChange={(e) => setFormRollNumber(e.target.value)}
                    placeholder="AEC-2026-101"
                    className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {formRole === 'teacher' && (
                <>
                  <div>
                    <label htmlFor="usr-specialty" className="block text-xs font-bold text-slate-700">
                      Teaching Specialty
                    </label>
                    <input
                      id="usr-specialty"
                      type="text"
                      value={formSpecialty}
                      onChange={(e) => setFormSpecialty(e.target.value)}
                      placeholder="e.g. HSC Grammar & IELTS Writing"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="usr-education" className="block text-xs font-bold text-slate-700">
                      Education / Qualification
                    </label>
                    <input
                      id="usr-education"
                      type="text"
                      value={formEducation}
                      onChange={(e) => setFormEducation(e.target.value)}
                      placeholder="e.g. MA in English, DU"
                      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {formRole === 'branch' && !formBranchId && (
                <div className="sm:col-span-2 grid grid-cols-1 gap-3 rounded-2xl border border-purple-200 bg-purple-50/70 p-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="usr-br-name" className="block text-xs font-bold text-purple-900">
                      New Branch Name
                    </label>
                    <input
                      id="usr-br-name"
                      type="text"
                      value={formBranchName}
                      onChange={(e) => setFormBranchName(e.target.value)}
                      placeholder="e.g. Sylhet Zindabazar Campus"
                      className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="usr-br-code" className="block text-xs font-bold text-purple-900">
                      Branch Code
                    </label>
                    <input
                      id="usr-br-code"
                      type="text"
                      value={formBranchCode}
                      onChange={(e) => setFormBranchCode(e.target.value)}
                      placeholder="e.g. AEC-SYL"
                      className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm uppercase"
                    />
                  </div>
                  <div>
                    <label htmlFor="usr-br-city" className="block text-xs font-bold text-purple-900">
                      City
                    </label>
                    <input
                      id="usr-br-city"
                      type="text"
                      value={formBranchCity}
                      onChange={(e) => setFormBranchCity(e.target.value)}
                      placeholder="e.g. Sylhet"
                      className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="usr-br-addr" className="block text-xs font-bold text-purple-900">
                      Campus Address
                    </label>
                    <input
                      id="usr-br-addr"
                      type="text"
                      value={formBranchAddress}
                      onChange={(e) => setFormBranchAddress(e.target.value)}
                      placeholder="Campus street address"
                      className="mt-1 w-full rounded-xl border border-purple-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="usr-approval-note" className="block text-xs font-bold text-slate-700">
                  Admin Approval / Audit Note (optional)
                </label>
                <input
                  id="usr-approval-note"
                  type="text"
                  value={formApprovalNote}
                  onChange={(e) => setFormApprovalNote(e.target.value)}
                  placeholder="Verification remarks for this account..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="usr-password" className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                  <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                  <span>
                    {editingUser
                      ? 'Reset Password (leave blank to keep current password)'
                      : 'Initial Strong Password (min 8 chars, letters + numbers) *'}
                  </span>
                </label>
                <input
                  id="usr-password"
                  type="password"
                  required={!editingUser}
                  minLength={editingUser ? undefined : 8}
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUser ? 'Enter new strong password (optional)' : 'Minimum 8 chars with letters & numbers'}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <ImageUploadField
                  label="Profile Photo (Upload from Device or Pick from My Storage)"
                  value={formAvatar}
                  onChange={setFormAvatar}
                  category="avatar"
                  placeholder="/uploads/... or /src/assets/images/..."
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="usr-bio" className="block text-xs font-bold text-slate-700">
                  Bio / Academic Note
                </label>
                <textarea
                  id="usr-bio"
                  rows={2}
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Optional faculty bio, batch assignment note, or student goal..."
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {formRole === 'guardian' && studentOptions.length > 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-xs font-bold text-amber-900">
                    Link Guardian to Student Accounts ({formLinkedStudents.length} selected)
                  </p>
                  <div className="mt-2 grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                    {studentOptions.map((st) => {
                      const checked = formLinkedStudents.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs border border-amber-100"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setFormLinkedStudents((prev) =>
                                e.target.checked
                                  ? [...prev, st.id]
                                  : prev.filter((id) => id !== st.id)
                              );
                            }}
                          />
                          <span className="truncate font-semibold text-slate-800">
                            {st.name} ({st.rollNumber || st.email})
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {saving ? 'Saving...' : editingUser ? 'Save User Changes' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 360 User Inspector Modal */}
      {(inspectData || inspectLoading) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="User 360 Profile Inspector"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold">
                {inspectLoading ? 'Loading User 360°...' : `${inspectData?.user.name} — 360° Activity Profile`}
              </h3>
              <button
                type="button"
                onClick={() => setInspectData(null)}
                aria-label="Close user inspector"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {inspectData && (
              <div className="mt-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-blue-50 p-3">
                    <p className="font-bold text-blue-700">Enrollments</p>
                    <p className="font-mono-tabular mt-1 text-xl font-extrabold text-blue-950">
                      {inspectData.enrollments.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="font-bold text-emerald-700">Exams Taken</p>
                    <p className="font-mono-tabular mt-1 text-xl font-extrabold text-emerald-950">
                      {inspectData.examAttempts.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="font-bold text-amber-700">Learner XP</p>
                    <p className="font-mono-tabular mt-1 text-xl font-extrabold text-amber-950">
                      {inspectData.rewards?.xp ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3">
                    <p className="font-bold text-violet-700">Attendance Logs</p>
                    <p className="font-mono-tabular mt-1 text-xl font-extrabold text-violet-950">
                      {inspectData.attendance.length}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200 p-4">
                  {inspectData.user.avatar && (
                    <img
                      src={inspectData.user.avatar}
                      alt={inspectData.user.name}
                      referrerPolicy="no-referrer"
                      className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p>
                      <strong>Email:</strong> {inspectData.user.email} · <strong>Phone:</strong> {inspectData.user.phone}
                    </p>
                    <p>
                      <strong>Role:</strong> {ROLE_LABELS[inspectData.user.role]} · <strong>Status:</strong>{' '}
                      {inspectData.user.status ?? 'active'}
                      {inspectData.user.rollNumber ? ` · Roll: ${inspectData.user.rollNumber}` : ''}
                    </p>
                    {inspectData.user.lastLoginAt && (
                      <p>
                        <strong>Last Login:</strong> {new Date(inspectData.user.lastLoginAt).toLocaleString()}
                      </p>
                    )}
                    {inspectData.user.bio && (
                      <p>
                        <strong>Bio:</strong> {inspectData.user.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-900">Enrolled Courses</h4>
                  {inspectData.enrollments.length === 0 ? (
                    <p className="mt-1 text-slate-500">No course enrollments.</p>
                  ) : (
                    <div className="mt-1.5 space-y-1.5">
                      {inspectData.enrollments.map((enr) => (
                        <div key={enr.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <span className="font-bold">{enr.courseTitle}</span>
                          <span className="font-mono-tabular">
                            {enr.status} · ৳{enr.amountPaid}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-900">Recent Exam Attempts</h4>
                  {inspectData.examAttempts.length === 0 ? (
                    <p className="mt-1 text-slate-500">No exam attempts recorded.</p>
                  ) : (
                    <div className="mt-1.5 space-y-1.5">
                      {inspectData.examAttempts.slice(0, 5).map((att) => (
                        <div key={att.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <span className="font-bold">{att.examTitle}</span>
                          <span className="font-mono-tabular">
                            {att.score}/{att.totalMarks} ({att.percentage}% · {att.grade})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
