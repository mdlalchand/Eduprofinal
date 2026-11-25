import {
  Activity,
  Building2,
  Download,
  FileSpreadsheet,
  KeyRound,
  Lock,
  MessageSquare,
  Play,
  Printer,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  UserCog,
  Workflow,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  PERMISSION_GROUPS,
  buildCsvExport,
  computeAttendanceSummary,
  isAdminRole,
} from '../lib/domain';
import type {
  AttendanceRecord,
  AutomationWorkflow,
  Branch,
  Course,
  CrmContact,
  CustomRole,
  Enrollment,
  ExamAttempt,
  FinancialRecord,
  FlashSaleConfig,
  LoginHistoryEntry,
  OmnichannelConversation,
  Order,
  PaymentTransaction,
  PayrollRecord,
  ReferralRecord,
  SaasTenant,
  ScheduledJobRecord,
  SystemErrorLog,
  User,
  UserAccountStatus,
  WorkflowRunRecord,
} from '../types';

/* ==================== 1. USER ACCOUNT STATUS, PASSWORD RESET, SELF PROFILE & CUSTOM ROLES ==================== */

interface UserRoleManagementExtensionProps {
  currentUser: User;
  users: User[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function UserRoleManagementExtension({
  currentUser,
  users,
  onRefresh,
  onNotify,
}: UserRoleManagementExtensionProps) {
  const { apiFetch, refreshBootstrap } = useAuth();
  const isAdmin = isAdminRole(currentUser.role);

  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryEntry[]>([]);

  // Self Profile Form
  const [profName, setProfName] = useState(currentUser.name);
  const [profPhone, setProfPhone] = useState(currentUser.phone);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Custom Role Creator
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['dashboard.view', 'reports.export']);

  // Admin Password Reset inline state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassValue, setResetPassValue] = useState('Aloms@2026');

  const loadRbacDetails = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiFetch<{
        customRoles: CustomRole[];
        loginHistory: LoginHistoryEntry[];
      }>('/api/portal/custom-roles');
      setCustomRoles(res.customRoles);
      setLoginHistory(res.loginHistory);
    } catch {
      // ignore
    }
  }, [apiFetch, isAdmin]);

  useEffect(() => {
    void loadRbacDetails();
  }, [loadRbacDetails]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profName,
          phone: profPhone,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
        }),
      });
      setCurrentPassword('');
      setNewPassword('');
      await Promise.all([onRefresh(), refreshBootstrap()]);
      onNotify('Profile and security credentials updated.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Profile update failed.');
    }
  };

  const handleStatusChange = async (u: User, status: UserAccountStatus) => {
    try {
      await apiFetch(`/api/portal/users/${u.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await onRefresh();
      onNotify(`${u.name} status set to ${status}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not change status.');
    }
  };

  const handleAdminPasswordReset = async (userId: string) => {
    try {
      await apiFetch(`/api/portal/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: resetPassValue }),
      });
      setResetUserId(null);
      onNotify('User password reset successfully.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Password reset failed.');
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim() || selectedPerms.length === 0) return;
    await apiFetch('/api/portal/custom-roles', {
      method: 'POST',
      body: JSON.stringify({
        name: roleName.trim(),
        description: roleDesc.trim(),
        permissions: selectedPerms,
        permissionGroups: PERMISSION_GROUPS.filter((g) =>
          g.permissions.some((p) => selectedPerms.includes(p))
        ).map((g) => g.group),
      }),
    });
    setRoleName('');
    setRoleDesc('');
    await loadRbacDetails();
    onNotify('Custom RBAC role created.');
  };

  const togglePermission = (perm: string) => {
    setSelectedPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  return (
    <div className="space-y-6">
      {/* Self Profile & Password Management */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
      >
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <UserCog className="h-4 w-4 text-indigo-600" />
          <span>My Profile &amp; Security Password</span>
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            required
            placeholder="Full Name"
            value={profName}
            onChange={(e) => setProfName(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
          />
          <input
            type="tel"
            placeholder="Phone"
            value={profPhone}
            onChange={(e) => setProfPhone(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
          />
          <input
            type="password"
            placeholder="Current Password (if changing)"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="password"
            placeholder="New Password (optional)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
          />
        </div>
        <button
          type="submit"
          className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
        >
          Update My Profile
        </button>
      </form>

      {isAdmin && (
        <>
          {/* Account Activation, Suspension & Password Reset */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Lock className="h-4 w-4 text-rose-600" />
              <span>Account Status, Suspension &amp; Password Reset</span>
            </h3>
            <div className="space-y-2">
              {users.map((u) => {
                const st = u.status ?? 'active';
                return (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {u.name} · <span className="text-slate-500">{u.email}</span>
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Role: {u.role} · Account: {st.toUpperCase()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <select
                        aria-label={`Account status for ${u.name}`}
                        value={st}
                        disabled={u.id === currentUser.id}
                        onChange={(e) => void handleStatusChange(u, e.target.value as UserAccountStatus)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="suspended">Suspended</option>
                      </select>
                      {resetUserId === u.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={resetPassValue}
                            onChange={(e) => setResetPassValue(e.target.value)}
                            className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => void handleAdminPasswordReset(u.id)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setResetUserId(u.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <KeyRound className="h-3 w-3" />
                          <span>Reset Password</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Roles & Permission Groups */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Custom Roles &amp; Granular Permission Groups ({customRoles.length})</span>
            </h3>
            <form onSubmit={handleCreateCustomRole} className="space-y-3 rounded-xl bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  placeholder="Custom Role Name (e.g. Senior Coordinator)"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                />
                <input
                  type="text"
                  placeholder="Short role description..."
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {PERMISSION_GROUPS.map((grp) => (
                  <div key={grp.group} className="rounded-xl border border-slate-200 bg-white p-3 text-xs">
                    <p className="font-bold text-slate-800">{grp.group}</p>
                    <div className="mt-1.5 space-y-1">
                      {grp.permissions.map((perm) => (
                        <label key={perm} className="flex items-center gap-2 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={selectedPerms.includes(perm)}
                            onChange={() => togglePermission(perm)}
                          />
                          <span>{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
              >
                Create Custom Role
              </button>
            </form>

            <div className="space-y-2">
              {customRoles.map((cr) => (
                <div
                  key={cr.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900">{cr.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {cr.description || 'Custom RBAC policy'} · Permissions:{' '}
                      {cr.permissions.join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/portal/custom-roles/${cr.id}`, { method: 'DELETE' });
                      await loadRbacDetails();
                      onNotify(`Deleted role "${cr.name}".`);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 font-semibold text-rose-700"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Login History */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>Security Login History ({loginHistory.length})</span>
            </h3>
            <div className="max-h-60 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loginHistory.slice(0, 20).map((lh) => (
                    <tr key={lh.id}>
                      <td className="py-2 pr-3 font-semibold text-slate-900">
                        {lh.userName} ({lh.email})
                      </td>
                      <td className="py-2 pr-3">{lh.role}</td>
                      <td className="py-2 pr-3 font-semibold uppercase">{lh.status}</td>
                      <td className="py-2 pr-3 font-mono tabular-nums text-slate-500">{lh.ip}</td>
                      <td className="py-2 font-mono tabular-nums text-slate-500">
                        {lh.createdAt.slice(0, 19).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ==================== 2. SAAS MULTI-TENANT, WORKFLOWS, CRM INBOX, REFERRALS & DIAGNOSTICS ==================== */

interface SaasAutomationPanelProps {
  onNotify: (msg: string) => void;
}

export function SaasAutomationPanel({ onNotify }: SaasAutomationPanelProps) {
  const { apiFetch } = useAuth();
  const [subTab, setSubTab] = useState<'tenants' | 'workflows' | 'crm' | 'growth' | 'diagnostics'>('tenants');

  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>([]);
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [conversations, setConversations] = useState<OmnichannelConversation[]>([]);
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [flashSale, setFlashSale] = useState<FlashSaleConfig | null>(null);
  const [errorLogs, setErrorLogs] = useState<SystemErrorLog[]>([]);
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJobRecord[]>([]);

  // Form States
  const [tenName, setTenName] = useState('');
  const [tenEmail, setTenEmail] = useState('');
  const [tenDomain, setTenDomain] = useState('');
  const [wfName, setWfName] = useState('');
  const [wfTrigger, setWfTrigger] = useState<AutomationWorkflow['trigger']>('enrollment.created');
  const [wfChannel, setWfChannel] = useState<AutomationWorkflow['channel']>('WhatsApp');
  const [wfMsg, setWfMsg] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [refCodeInput, setRefCodeInput] = useState('ALOM-TANVIR');

  const loadHub = useCallback(async () => {
    try {
      const res = await apiFetch<{
        tenants: SaasTenant[];
        workflows: AutomationWorkflow[];
        workflowRuns: WorkflowRunRecord[];
        crmContacts: CrmContact[];
        conversations: OmnichannelConversation[];
        referrals: ReferralRecord[];
        flashSale: FlashSaleConfig;
        errorLogs: SystemErrorLog[];
        scheduledJobs: ScheduledJobRecord[];
      }>('/api/portal/saas-hub');
      setTenants(res.tenants);
      setWorkflows(res.workflows);
      setRuns(res.workflowRuns);
      setCrmContacts(res.crmContacts);
      setConversations(res.conversations);
      setReferrals(res.referrals);
      setFlashSale(res.flashSale);
      setErrorLogs(res.errorLogs);
      setScheduledJobs(res.scheduledJobs);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadHub();
  }, [loadHub]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        {(
          [
            { id: 'tenants', label: 'SaaS Multi-Tenant', icon: Building2 },
            { id: 'workflows', label: 'AI & Automation Workflows', icon: Workflow },
            { id: 'crm', label: 'CRM Leads & Inbox', icon: MessageSquare },
            { id: 'growth', label: 'Flash Sale & Referrals', icon: Tag },
            { id: 'diagnostics', label: 'Diagnostics & Jobs', icon: Activity },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold ${
                subTab === t.id ? 'bg-[#062436] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TENANTS */}
      {subTab === 'tenants' && (
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/portal/tenants', {
                method: 'POST',
                body: JSON.stringify({ name: tenName, ownerEmail: tenEmail, customDomain: tenDomain }),
              });
              setTenName('');
              setTenEmail('');
              setTenDomain('');
              await loadHub();
              onNotify('White-label SaaS tenant provisioned.');
            }}
            className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
          >
            <h2 className="text-base font-bold text-slate-900">
              Provision White-Label SaaS Workspace
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                required
                placeholder="Institute / Tenant Name"
                value={tenName}
                onChange={(e) => setTenName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
              <input
                type="email"
                required
                placeholder="Owner Email"
                value={tenEmail}
                onChange={(e) => setTenEmail(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Custom Domain (optional)"
                value={tenDomain}
                onChange={(e) => setTenDomain(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
            >
              Provision Tenant
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {tenants.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {t.name} · {t.plan}
                  </p>
                  <p className="text-slate-500">
                    {t.customDomain} · {t.ownerEmail}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/portal/tenants/${t.id}/status`, { method: 'PATCH' });
                    await loadHub();
                    onNotify(`Tenant "${t.name}" status toggled.`);
                  }}
                  className={`rounded-lg px-3 py-1.5 font-semibold ${
                    t.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {t.status.toUpperCase()}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI & AUTOMATION WORKFLOWS */}
      {subTab === 'workflows' && (
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/portal/workflows', {
                method: 'POST',
                body: JSON.stringify({
                  name: wfName,
                  trigger: wfTrigger,
                  channel: wfChannel,
                  templateMessage: wfMsg,
                }),
              });
              setWfName('');
              setWfMsg('');
              await loadHub();
              onNotify('Automation workflow created and validated.');
            }}
            className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
          >
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Create Automation Workflow</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                required
                placeholder="Workflow Name"
                value={wfName}
                onChange={(e) => setWfName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
              />
              <select
                aria-label="Workflow Trigger"
                value={wfTrigger}
                onChange={(e) => setWfTrigger(e.target.value as AutomationWorkflow['trigger'])}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="enrollment.created">enrollment.created</option>
                <option value="payment.verified">payment.verified</option>
                <option value="assignment.late">assignment.late</option>
                <option value="exam.passed">exam.passed</option>
                <option value="lead.captured">lead.captured</option>
              </select>
              <select
                aria-label="Workflow Channel"
                value={wfChannel}
                onChange={(e) => setWfChannel(e.target.value as AutomationWorkflow['channel'])}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="SMS">SMS</option>
                <option value="Webhook">Webhook</option>
              </select>
            </div>
            <input
              type="text"
              required
              placeholder="Automated message template..."
              value={wfMsg}
              onChange={(e) => setWfMsg(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
            >
              Validate &amp; Save Workflow
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {workflows.map((wf) => (
              <div
                key={wf.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{wf.name}</p>
                  <p className="text-slate-500">
                    Trigger: {wf.trigger} · {wf.channel} · Runs: {wf.runsCount}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/portal/workflows/${wf.id}/run`, { method: 'POST' });
                    await loadHub();
                    onNotify(`Executed "${wf.name}".`);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white"
                >
                  <Play className="h-3 w-3" />
                  <span>Run Now</span>
                </button>
              </div>
            ))}
          </div>

          {runs.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-500">Recent Workflow Runs</h3>
              {runs.slice(0, 6).map((r) => (
                <div key={r.id} className="flex justify-between text-xs text-slate-700">
                  <span>
                    <strong>{r.workflowName}</strong> · {r.summary}
                  </span>
                  <span className="font-mono text-slate-500">{r.executedAt.slice(0, 16)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OMNICHANNEL CRM */}
      {subTab === 'crm' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Omnichannel Support Inbox ({conversations.length})
            </h2>
            {conversations.map((conv) => (
              <div key={conv.id} className="rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>
                    {conv.contactName} · {conv.channel}
                  </span>
                  <span className="uppercase text-emerald-700">{conv.status}</span>
                </div>
                <div className="space-y-1 rounded-lg bg-slate-50 p-2.5">
                  {conv.messages.map((m) => (
                    <p key={m.id}>
                      <strong className="uppercase">{m.sender}:</strong> {m.text}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type omnichannel agent reply..."
                    value={replyTextMap[conv.id] ?? ''}
                    onChange={(e) =>
                      setReplyTextMap((prev) => ({ ...prev, [conv.id]: e.target.value }))
                    }
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const text = (replyTextMap[conv.id] ?? '').trim();
                      if (!text) return;
                      await apiFetch(`/api/portal/crm/conversations/${conv.id}/reply`, {
                        method: 'POST',
                        body: JSON.stringify({ text }),
                      });
                      setReplyTextMap((prev) => ({ ...prev, [conv.id]: '' }));
                      await loadHub();
                      onNotify('Reply dispatched.');
                    }}
                    className="rounded-lg bg-[#062436] px-3.5 py-1.5 font-semibold text-white"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">
              Captured Admission Leads ({crmContacts.length})
            </h3>
            {crmContacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-xs"
              >
                <span>
                  <strong>{c.name}</strong> · {c.phone} · {c.source}
                </span>
                <span className="font-semibold text-indigo-700">{c.stage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FLASH SALE & REFERRALS */}
      {subTab === 'growth' && (
        <div className="space-y-4">
          {flashSale && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/portal/flash-sale', {
                  method: 'PUT',
                  body: JSON.stringify(flashSale),
                });
                await loadHub();
                onNotify('Flash Sale settings updated.');
              }}
              className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
            >
              <h2 className="text-base font-bold text-slate-900">Flash Sale Campaign Control</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={flashSale.title}
                  onChange={(e) => setFlashSale({ ...flashSale, title: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold sm:col-span-2"
                />
                <input
                  type="number"
                  min={1}
                  max={80}
                  value={flashSale.discountPercent}
                  onChange={(e) =>
                    setFlashSale({ ...flashSale, discountPercent: Number(e.target.value) })
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={flashSale.active}
                    onChange={(e) => setFlashSale({ ...flashSale, active: e.target.checked })}
                  />
                  <span>Flash Sale Active</span>
                </label>
                <button
                  type="submit"
                  className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
                >
                  Save Flash Sale
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Share2 className="h-4 w-4 text-emerald-600" />
                <span>Affiliate &amp; Referral Tracking ({referrals.length})</span>
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refCodeInput}
                  onChange={(e) => setRefCodeInput(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs uppercase"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await apiFetch('/api/referrals/track', {
                        method: 'POST',
                        body: JSON.stringify({
                          referralCode: refCodeInput,
                          amountPaid: 2500,
                          title: 'HSC Combo Pack',
                        }),
                      });
                      await loadHub();
                      onNotify('Referral reward credited.');
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : 'Referral code invalid.');
                    }
                  }}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                >
                  Credit Referral
                </button>
              </div>
            </div>
            {referrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-xs"
              >
                <span>
                  <strong>{r.referrerName}</strong> ({r.referralCode}) → {r.referredUserName} ·{' '}
                  {r.orderOrCourseTitle}
                </span>
                <span className="font-mono font-bold text-emerald-700">+৳{r.rewardAmount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SYSTEM DIAGNOSTICS & SCHEDULED JOBS */}
      {subTab === 'diagnostics' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">
              Scheduled Background Jobs ({scheduledJobs.length})
            </h2>
            {scheduledJobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3.5 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {job.name} · <span className="font-mono text-slate-500">{job.schedule}</span>
                  </p>
                  <p className="text-slate-600">
                    {job.description} · Last run: {job.lastRunAt.slice(0, 19).replace('T', ' ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/portal/diagnostics/run-job', {
                      method: 'POST',
                      body: JSON.stringify({ jobId: job.id }),
                    });
                    await loadHub();
                    onNotify(`Job "${job.name}" completed successfully.`);
                  }}
                  className="rounded-lg bg-[#062436] px-3.5 py-1.5 font-semibold text-white"
                >
                  Run Job Now
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-2">
            <h3 className="text-sm font-bold text-slate-900">
              System Diagnostics &amp; Event Log ({errorLogs.length})
            </h3>
            {errorLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-xs"
              >
                <span>
                  <strong className="uppercase">{log.level}</strong> [{log.source}] · {log.message}
                </span>
                <span className="font-mono text-slate-500">{log.createdAt.slice(0, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 3. REPORTING & EXPORT CENTER (CSV / EXCEL / PRINT PDF) ==================== */

interface ReportsExportCenterPanelProps {
  data: {
    courses?: Course[];
    users?: User[];
    branches?: Branch[];
    enrollments?: Enrollment[];
    attendance?: AttendanceRecord[];
    payrolls?: PayrollRecord[];
    financialRecords?: FinancialRecord[];
    transactions?: PaymentTransaction[];
    orders?: Order[];
    examAttempts?: ExamAttempt[];
  };
  onNotify: (msg: string) => void;
}

export function ReportsExportCenterPanel({ data, onNotify }: ReportsExportCenterPanelProps) {
  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify(`Downloaded ${filename}`);
  };

  const attSummary = computeAttendanceSummary(data.attendance ?? []);
  const totalIncome = (data.financialRecords ?? [])
    .filter((f) => f.type === 'income')
    .reduce((s, f) => s + f.amount, 0);
  const totalExpense = (data.financialRecords ?? [])
    .filter((f) => f.type !== 'income')
    .reduce((s, f) => s + f.amount, 0);

  const reportDefinitions = [
    {
      id: 'students',
      title: 'Students & Admissions Report',
      count: (data.users ?? []).filter((u) => u.role === 'student').length,
      build: () =>
        buildCsvExport(
          ['ID', 'Name', 'Email', 'Roll', 'Branch', 'Status'],
          (data.users ?? [])
            .filter((u) => u.role === 'student')
            .map((u) => [u.id, u.name, u.email, u.rollNumber ?? '', u.branchId ?? '', u.status ?? 'active'])
        ),
    },
    {
      id: 'attendance',
      title: 'Attendance Analytics Report',
      count: (data.attendance ?? []).length,
      build: () =>
        buildCsvExport(
          ['ID', 'Type', 'Name', 'Date', 'Status', 'Check In', 'Check Out', 'Recorded By'],
          (data.attendance ?? []).map((a) => [
            a.id,
            a.targetType,
            a.targetName,
            a.date,
            a.status,
            a.checkInTime ?? '',
            a.checkOutTime ?? '',
            a.recordedBy,
          ])
        ),
    },
    {
      id: 'enrollments',
      title: 'Course Enrollments & Revenue',
      count: (data.enrollments ?? []).length,
      build: () =>
        buildCsvExport(
          ['Invoice', 'Student', 'Email', 'Course', 'Gateway', 'AmountPaid', 'Status', 'Date'],
          (data.enrollments ?? []).map((e) => [
            e.invoiceNo ?? e.id,
            e.studentName,
            e.studentEmail,
            e.courseTitle,
            e.paymentMethod,
            e.amountPaid,
            e.status,
            e.enrolledAt,
          ])
        ),
    },
    {
      id: 'finance',
      title: 'Income, Expense & Financial P&L',
      count: (data.financialRecords ?? []).length,
      build: () =>
        buildCsvExport(
          ['ID', 'Type', 'Category', 'Title', 'Amount', 'Branch', 'Date', 'Recorded By'],
          (data.financialRecords ?? []).map((f) => [
            f.id,
            f.type,
            f.category,
            f.title,
            f.amount,
            f.branchId ?? 'All',
            f.date,
            f.recordedBy,
          ])
        ),
    },
    {
      id: 'payroll',
      title: 'Monthly Payroll & Salary Sheet',
      count: (data.payrolls ?? []).length,
      build: () =>
        buildCsvExport(
          ['ID', 'Employee', 'Role', 'Month', 'Base', 'Allowances', 'Bonuses', 'Deductions', 'NetSalary', 'Status'],
          (data.payrolls ?? []).map((p) => [
            p.id,
            p.employeeName,
            p.role,
            p.monthKey,
            p.baseSalary,
            p.allowances,
            p.bonuses,
            p.deductions,
            p.netSalary,
            p.status,
          ])
        ),
    },
    {
      id: 'exams',
      title: 'Exam Results & Rankings',
      count: (data.examAttempts ?? []).length,
      build: () =>
        buildCsvExport(
          ['AttemptID', 'Exam', 'Student', 'Roll', 'Score', 'Total', 'Percentage', 'Grade', 'Status'],
          (data.examAttempts ?? []).map((a) => [
            a.id,
            a.examTitle,
            a.studentName,
            a.rollNumber,
            a.score,
            a.totalMarks,
            `${a.percentage}%`,
            a.grade,
            a.passed ? 'Passed' : 'Failed',
          ])
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <span>Exportable Reports &amp; Print Center</span>
            </h2>
            <p className="text-xs text-slate-500">
              Download sanitized CSV or Excel spreadsheets or print PDF summaries for management
              audits.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Summary PDF</span>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <p className="text-slate-500">Attendance Rate</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700">
              {attSummary.attendanceRate}% ({attSummary.present}/{attSummary.total})
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <p className="text-slate-500">Total Logged Income</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
              ৳{totalIncome.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <p className="text-slate-500">Net Operating Surplus</p>
            <p className="mt-1 font-mono text-xl font-bold tabular-nums text-indigo-700">
              ৳{(totalIncome - totalExpense).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reportDefinitions.map((rep) => (
          <div
            key={rep.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs"
          >
            <div>
              <p className="text-sm font-bold text-slate-900">{rep.title}</p>
              <p className="mt-0.5 font-mono tabular-nums text-slate-500">{rep.count} records ready</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  triggerDownload(`aec-${rep.id}-report.csv`, rep.build(), 'text/csv;charset=utf-8;')
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  triggerDownload(
                    `aec-${rep.id}-report.xls`,
                    rep.build(),
                    'application/vnd.ms-excel;charset=utf-8;'
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
