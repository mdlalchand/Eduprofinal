import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Lock,
  LockKeyhole,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';

export type AuthMode = 'login' | 'register' | 'reset';
export type SelfRegistrableRole = 'student' | 'guardian' | 'teacher' | 'branch';

interface LoginPageProps {
  navigate: (path: string) => void;
  initialMode?: AuthMode;
  initialRole?: UserRole;
}

const PORTAL_ROLES: {
  id: UserRole;
  label: string;
  shortDesc: string;
  icon: typeof GraduationCap;
  selfRegister: boolean;
  accent: string;
}[] = [
  {
    id: 'student',
    label: 'Student',
    shortDesc: 'Courses, live classes, exams & certificates',
    icon: GraduationCap,
    selfRegister: true,
    accent: 'border-blue-500 bg-blue-50 text-blue-800',
  },
  {
    id: 'guardian',
    label: 'Guardian',
    shortDesc: 'Monitor linked child attendance, marks & fees',
    icon: Users,
    selfRegister: true,
    accent: 'border-amber-500 bg-amber-50 text-amber-800',
  },
  {
    id: 'teacher',
    label: 'Teacher',
    shortDesc: 'Faculty lessons, batches, grading & attendance',
    icon: UserCheck,
    selfRegister: true,
    accent: 'border-emerald-500 bg-emerald-50 text-emerald-800',
  },
  {
    id: 'branch',
    label: 'Branch',
    shortDesc: 'Campus branch coordinator & local admissions',
    icon: Building2,
    selfRegister: true,
    accent: 'border-cyan-500 bg-cyan-50 text-cyan-800',
  },
  {
    id: 'admin',
    label: 'Main Admin',
    shortDesc: 'Central platform governance & approvals',
    icon: ShieldCheck,
    selfRegister: false,
    accent: 'border-indigo-500 bg-indigo-50 text-indigo-800',
  },
];

export function LoginPage({
  navigate,
  initialMode = 'login',
  initialRole = 'student',
}: LoginPageProps) {
  const {
    login,
    setupAdmin,
    register,
    requestPasswordReset,
    confirmPasswordReset,
    bootstrap,
    setupRequired,
    authError,
  } = useAuth();

  const normalizedInitialRole: UserRole =
    initialMode === 'register' && initialRole === 'admin' ? 'student' : initialRole;

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [portalRole, setPortalRole] = useState<UserRole>(normalizedInitialRole);

  // Sync props when navigating between /login/:role, /register/:role, /recover/:role
  useEffect(() => {
    setMode(initialMode);
    setPortalRole(initialMode === 'register' && initialRole === 'admin' ? 'student' : initialRole);
    setPendingNotice(null);
    setLocalError(null);
    setResetNotice(null);
  }, [initialMode, initialRole]);

  // Login state (zero hardcoded credentials or demo passwords)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // One-time First-Time Main Admin setup state
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminConfirm, setAdminConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Registration state for Student / Guardian / Teacher / Branch
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regBranchId, setRegBranchId] = useState(bootstrap?.branches[0]?.id || 'br-mirpur');
  const [regRollLink, setRegRollLink] = useState('');
  const [regStudentVerification, setRegStudentVerification] = useState('');
  const [regSpecialty, setRegSpecialty] = useState('');
  const [regEducation, setRegEducation] = useState('');
  const [regBio, setRegBio] = useState('');
  const [regBranchName, setRegBranchName] = useState('');
  const [regBranchCode, setRegBranchCode] = useState('');
  const [regBranchCity, setRegBranchCity] = useState('');
  const [regBranchAddress, setRegBranchAddress] = useState('');
  const [pendingNotice, setPendingNotice] = useState<{
    message: string;
    email: string;
    role: SelfRegistrableRole;
  } | null>(null);

  // Password reset state
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetNewPass, setResetNewPass] = useState('');
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!regBranchId && bootstrap?.branches?.length) {
      setRegBranchId(bootstrap.branches[0].id);
    }
  }, [bootstrap?.branches, regBranchId]);

  const activeRoleMeta =
    PORTAL_ROLES.find((r) => r.id === portalRole) ?? PORTAL_ROLES[0];
  const regRole: SelfRegistrableRole =
    portalRole === 'admin' ? 'student' : portalRole;

  const handleSelectRole = (nextRole: UserRole) => {
    setPortalRole(nextRole);
    setLocalError(null);
    setNeeds2fa(false);
    setPendingNotice(null);
    if (mode === 'register' && nextRole === 'admin') {
      setMode('login');
    }
  };

  const handleSwitchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setLocalError(null);
    setResetNotice(null);
    setPendingNotice(null);
    setNeeds2fa(false);
    if (nextMode === 'register' && portalRole === 'admin') {
      setPortalRole('student');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    const res = await login(
      email,
      password,
      needs2fa ? { totpCode: totpCode.trim(), recoveryCode: recoveryCode.trim() } : undefined,
      portalRole
    );
    setSubmitting(false);
    if (res.requires2fa) {
      setNeeds2fa(true);
      return;
    }
    if (res.ok) {
      navigate('/portal');
    }
  };

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (adminPassword !== adminConfirm) {
      setLocalError('Main Admin passwords do not match.');
      return;
    }
    setSubmitting(true);
    const ok = await setupAdmin({
      name: adminName,
      email: adminEmail,
      phone: adminPhone || undefined,
      password: adminPassword,
    });
    setSubmitting(false);
    if (ok) navigate('/portal');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setPendingNotice(null);
    setSubmitting(true);
    const res = await register({
      name: regName,
      email: regEmail,
      phone: regPhone,
      password: regPassword,
      role: regRole,
      branchId: regRole === 'branch' ? undefined : regBranchId,
      branchName: regRole === 'branch' ? regBranchName : undefined,
      branchCode: regRole === 'branch' ? regBranchCode : undefined,
      branchCity: regRole === 'branch' ? regBranchCity : undefined,
      branchAddress: regRole === 'branch' ? regBranchAddress : undefined,
      subjectSpecialty: regRole === 'teacher' ? regSpecialty : undefined,
      education: regRole === 'teacher' ? regEducation : undefined,
      bio: regRole === 'teacher' || regRole === 'branch' ? regBio : undefined,
      studentRollToLink: regRole === 'guardian' ? regRollLink : undefined,
      studentVerification: regRole === 'guardian' ? regStudentVerification : undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      if (res.pendingApproval) {
        setPendingNotice({
          message:
            res.message ||
            'Your registration was received and is awaiting Main Admin approval.',
          email: regEmail.trim().toLowerCase(),
          role: regRole,
        });
        setRegPassword('');
      } else {
        navigate('/portal');
      }
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetNotice(null);
    setSubmitting(true);
    const msg = await requestPasswordReset(resetEmail, portalRole);
    setSubmitting(false);
    if (msg) setResetNotice(msg);
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetNotice(null);
    setSubmitting(true);
    const ok = await confirmPasswordReset(resetToken, resetNewPass);
    setSubmitting(false);
    if (ok) {
      setResetNotice('Password updated successfully. You may now sign in.');
      setResetToken('');
      setResetNewPass('');
      setMode('login');
    }
  };

  const brandName = bootstrap?.settings?.brandName || 'Aloms English Center';
  const logoUrl = bootstrap?.settings?.logoUrl || '/images/aec-logo.png';

  if (setupRequired && mode === 'login' && portalRole === 'admin') {
    return (
      <div className="rm-pastel-bg flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-[0_14px_45px_rgba(15,23,42,0.08)] sm:p-9">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <ShieldAlert className="h-7 w-7" />
            </span>
            <h1 className="mt-3 text-xl font-extrabold text-slate-900">
              Initial Main Admin Setup
            </h1>
            <p className="mt-1 text-xs text-slate-600">
              Create the single Main Admin account for this installation. Once completed, this
              setup locks permanently.
            </p>
          </div>

          {(localError || authError) && (
            <p className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
              {localError || authError}
            </p>
          )}

          <form onSubmit={handleSetupAdmin} className="mt-5 space-y-3.5">
            <div>
              <label htmlFor="setup-name" className="mb-1 block text-xs font-bold text-slate-700">
                Main Admin Full Name
              </label>
              <input
                id="setup-name"
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Director / Principal Name"
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="setup-email" className="mb-1 block text-xs font-bold text-slate-700">
                  Admin Email
                </label>
                <input
                  id="setup-email"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@institution.edu"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="setup-phone" className="mb-1 block text-xs font-bold text-slate-700">
                  Phone (BD)
                </label>
                <input
                  id="setup-phone"
                  type="tel"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="setup-password" className="mb-1 block text-xs font-bold text-slate-700">
                Strong Password (min 10 chars, letters + numbers)
              </label>
              <input
                id="setup-password"
                type="password"
                required
                minLength={10}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="setup-confirm" className="mb-1 block text-xs font-bold text-slate-700">
                Confirm Main Admin Password
              </label>
              <input
                id="setup-confirm"
                type="password"
                required
                minLength={10}
                value={adminConfirm}
                onChange={(e) => setAdminConfirm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <Shield className="h-4 w-4" />
              <span>{submitting ? 'Provisioning Main Admin...' : 'Complete Main Admin Setup'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPortalRole('student');
                setMode('login');
                setLocalError(null);
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Switch to Student / Guardian / Teacher / Branch Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="rm-pastel-bg flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        {/* Top Brand Header */}
        <div className="text-center">
          <div className="mx-auto inline-flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt={brandName}
              className="h-10 w-10 rounded-lg object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="text-left text-base font-extrabold uppercase tracking-tight text-slate-900">
              {brandName}
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
            {activeRoleMeta.label} Portal{' '}
            {mode === 'login' ? 'Sign In' : mode === 'register' ? 'Registration' : 'Recovery'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">{activeRoleMeta.shortDesc}</p>
        </div>

        {/* Dedicated Role Portal Tabs */}
        <div className="mt-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Select Account Portal
          </p>
          <div
            role="tablist"
            aria-label="Account role portal selector"
            className="grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            {PORTAL_ROLES.map((item) => {
              const Icon = item.icon;
              const disabledInRegister = mode === 'register' && !item.selfRegister;
              const active = portalRole === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={disabledInRegister}
                  onClick={() => handleSelectRole(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs font-bold transition-all ${
                    active
                      ? `${item.accent} shadow-xs ring-1 ring-current/20`
                      : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100'
                  } ${disabledInRegister ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode Switcher Tabs: Sign In / Register / Recover */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => handleSwitchMode('login')}
            className={`rounded-lg py-2 text-xs font-bold transition-colors ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            disabled={portalRole === 'admin'}
            onClick={() => handleSwitchMode('register')}
            className={`rounded-lg py-2 text-xs font-bold transition-colors ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            } ${portalRole === 'admin' ? 'cursor-not-allowed opacity-45' : ''}`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('reset')}
            className={`rounded-lg py-2 text-xs font-bold transition-colors ${
              mode === 'reset'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Recover Account
          </button>
        </div>

        {setupRequired && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            <span className="font-semibold">
              Initial Main Admin password has not been provisioned yet.
            </span>
            <button
              type="button"
              onClick={() => {
                setPortalRole('admin');
                setMode('login');
                setLocalError(null);
              }}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700"
            >
              Setup Main Admin
            </button>
          </div>
        )}

        {(localError || authError) && (
          <p className="mt-4 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700">
            {localError || authError}
          </p>
        )}
        {resetNotice && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-700">
            {resetNotice}
          </p>
        )}

        {/* Pending Approval Confirmation Card */}
        {mode === 'register' && pendingNotice && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-slate-900">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="space-y-2 text-xs">
                <p className="text-sm font-extrabold text-amber-950">
                  Registration Submitted — Awaiting Admin Approval
                </p>
                <p className="leading-relaxed text-amber-900">{pendingNotice.message}</p>
                <p className="rounded-lg bg-white/80 px-3 py-2 font-mono-tabular text-[11px] text-slate-700">
                  Account: <strong>{pendingNotice.email}</strong> · Role:{' '}
                  <strong className="uppercase">{pendingNotice.role}</strong> · Status:{' '}
                  <strong className="text-amber-700">PENDING</strong>
                </p>
                <div className="pt-1 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(pendingNotice.email);
                      setPendingNotice(null);
                      setMode('login');
                    }}
                    className="rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white hover:bg-[#0b3854]"
                  >
                    Go to {activeRoleMeta.label} Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingNotice(null)}
                    className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-amber-100/50"
                  >
                    Submit Another Registration
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOGIN MODE */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="mt-5 space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                aria-label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`${activeRoleMeta.label} Email Address`}
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-10 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {needs2fa && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <LockKeyhole className="h-4 w-4 text-blue-600" />
                  <span>Two-Factor Verification Required</span>
                </div>
                <div>
                  <label htmlFor="login-totp" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    6-Digit Authenticator Code
                  </label>
                  <input
                    id="login-totp"
                    type="text"
                    inputMode="numeric"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    className="font-mono-tabular w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="login-recovery" className="mb-1 block text-[11px] font-semibold text-slate-700">
                    Or Recovery Code
                  </label>
                  <input
                    id="login-recovery"
                    type="text"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                    placeholder="XXXX-XXXX"
                    className="font-mono-tabular w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs uppercase"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting
                ? 'Signing In...'
                : needs2fa
                  ? 'Verify 2FA & Sign In'
                  : `Sign In to ${activeRoleMeta.label} Portal`}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs">
              <button
                type="button"
                onClick={() => handleSwitchMode('reset')}
                className="font-semibold text-blue-600 hover:underline"
              >
                Recover / Forgot Password?
              </button>
              {portalRole !== 'admin' && (
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="font-semibold text-slate-700 hover:text-blue-600 hover:underline"
                >
                  Register as {activeRoleMeta.label} →
                </button>
              )}
            </div>
          </form>
        )}

        {/* REGISTER MODE */}
        {mode === 'register' && !pendingNotice && (
          <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-[11px] font-semibold text-blue-900">
              All new {activeRoleMeta.label} registrations enter Main Admin review before sign-in is activated.
            </div>

            <div>
              <label htmlFor="reg-name" className="mb-1 block text-xs font-bold text-slate-700">
                {regRole === 'branch' ? 'Branch Coordinator / Manager Name *' : 'Full Name *'}
              </label>
              <input
                id="reg-name"
                type="text"
                required
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder={regRole === 'branch' ? 'Coordinator Full Name' : 'Enter full name'}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="reg-email" className="mb-1 block text-xs font-bold text-slate-700">
                  Email *
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="reg-phone" className="mb-1 block text-xs font-bold text-slate-700">
                  Phone (BD) *
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Branch Registration Fields */}
            {regRole === 'branch' ? (
              <div className="space-y-3 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-3.5">
                <p className="text-xs font-extrabold text-cyan-900">
                  New Campus Branch Details
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-branch-name" className="mb-1 block text-xs font-bold text-slate-700">
                      Branch Name *
                    </label>
                    <input
                      id="reg-branch-name"
                      type="text"
                      required
                      value={regBranchName}
                      onChange={(e) => setRegBranchName(e.target.value)}
                      placeholder="Uttara Sector 10 Campus"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-branch-code" className="mb-1 block text-xs font-bold text-slate-700">
                      Branch Code (optional)
                    </label>
                    <input
                      id="reg-branch-code"
                      type="text"
                      value={regBranchCode}
                      onChange={(e) => setRegBranchCode(e.target.value.toUpperCase())}
                      placeholder="AEC-UTT"
                      className="font-mono-tabular w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-branch-city" className="mb-1 block text-xs font-bold text-slate-700">
                      City *
                    </label>
                    <input
                      id="reg-branch-city"
                      type="text"
                      required
                      value={regBranchCity}
                      onChange={(e) => setRegBranchCity(e.target.value)}
                      placeholder="Dhaka"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-branch-address" className="mb-1 block text-xs font-bold text-slate-700">
                      Campus Address *
                    </label>
                    <input
                      id="reg-branch-address"
                      type="text"
                      required
                      value={regBranchAddress}
                      onChange={(e) => setRegBranchAddress(e.target.value)}
                      placeholder="House 14, Road 5, Sector 10"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <label htmlFor="reg-branch" className="mb-1 block text-xs font-bold text-slate-700">
                  Campus Branch
                </label>
                <select
                  id="reg-branch"
                  value={regBranchId}
                  onChange={(e) => setRegBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {(bootstrap?.branches ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                  {(!bootstrap?.branches || bootstrap.branches.length === 0) && (
                    <option value="online">Online / Virtual Campus</option>
                  )}
                </select>
              </div>
            )}

            {/* Teacher Registration Fields */}
            {regRole === 'teacher' && (
              <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                <p className="text-xs font-extrabold text-emerald-900">
                  Faculty Credentials &amp; Subject Focus
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="reg-specialty" className="mb-1 block text-xs font-bold text-slate-700">
                      Teaching Specialty *
                    </label>
                    <input
                      id="reg-specialty"
                      type="text"
                      required
                      value={regSpecialty}
                      onChange={(e) => setRegSpecialty(e.target.value)}
                      placeholder="IELTS Writing & Spoken English"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-education" className="mb-1 block text-xs font-bold text-slate-700">
                      Academic Qualification *
                    </label>
                    <input
                      id="reg-education"
                      type="text"
                      required
                      value={regEducation}
                      onChange={(e) => setRegEducation(e.target.value)}
                      placeholder="MA in English (DU), IELTS 8.0"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="reg-bio" className="mb-1 block text-xs font-bold text-slate-700">
                    Short Faculty Bio
                  </label>
                  <textarea
                    id="reg-bio"
                    rows={2}
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder="Experience summary or classes taught..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Guardian Verification Fields */}
            {regRole === 'guardian' && (
              <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
                <div>
                  <label htmlFor="reg-roll-link" className="mb-1 block text-xs font-bold text-slate-700">
                    Student Roll Number to Link (Optional, e.g. AEC-2026-101)
                  </label>
                  <input
                    id="reg-roll-link"
                    type="text"
                    value={regRollLink}
                    onChange={(e) => setRegRollLink(e.target.value)}
                    placeholder="AEC-2026-101"
                    className="font-mono-tabular w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
                  />
                </div>
                {regRollLink.trim() && (
                  <div>
                    <label
                      htmlFor="reg-student-verify"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Student Registered Phone or Linking Code (Required to Link)
                    </label>
                    <input
                      id="reg-student-verify"
                      type="text"
                      required
                      value={regStudentVerification}
                      onChange={(e) => setRegStudentVerification(e.target.value)}
                      placeholder="017XXXXXXXX or AEC-XXXXXX"
                      className="font-mono-tabular w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <label htmlFor="reg-password" className="mb-1 block text-xs font-bold text-slate-700">
                Strong Password (min 8 chars, letters + numbers) *
              </label>
              <input
                id="reg-password"
                type="password"
                required
                minLength={8}
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Submitting Registration...'
                  : `Submit ${activeRoleMeta.label} Registration`}
              </span>
            </button>
          </form>
        )}

        {/* RECOVER / RESET PASSWORD MODE */}
        {mode === 'reset' && (
          <div className="mt-5 space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] font-semibold text-slate-700">
              Recovering <strong>{activeRoleMeta.label}</strong> account access. Request an email token below, or paste a reset token issued by the Main Admin.
            </div>
            <form onSubmit={handleRequestReset} className="space-y-3">
              <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700">
                Step 1: Request {activeRoleMeta.label} Recovery Token
              </label>
              <div className="flex gap-2">
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={`${activeRoleMeta.label} email address`}
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  Send Token
                </button>
              </div>
            </form>

            <form onSubmit={handleConfirmReset} className="space-y-3 border-t border-slate-200 pt-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                <span>Step 2: Apply Reset Token</span>
              </p>
              <div>
                <label htmlFor="reset-token" className="mb-1 block text-[11px] font-semibold text-slate-600">
                  Reset Token
                </label>
                <input
                  id="reset-token"
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="font-mono-tabular w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label htmlFor="reset-new-pass" className="mb-1 block text-[11px] font-semibold text-slate-600">
                  New Strong Password (min 8 chars, letters + numbers)
                </label>
                <input
                  id="reset-new-pass"
                  type="password"
                  required
                  minLength={8}
                  value={resetNewPass}
                  onChange={(e) => setResetNewPass(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Confirm New Password
              </button>
            </form>
          </div>
        )}

        <p className="mt-6 text-center text-[11px] text-slate-500">
          By continuing, you agree to our{' '}
          <a
            href="/terms-and-conditions"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms-and-conditions');
            }}
            className="text-blue-600 hover:underline"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/privacy-policy"
            onClick={(e) => {
              e.preventDefault();
              navigate('/privacy-policy');
            }}
            className="text-blue-600 hover:underline"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
