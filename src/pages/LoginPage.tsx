import { KeyRound, LockKeyhole, Shield, ShieldAlert, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginPageProps {
  navigate: (path: string) => void;
}

export function LoginPage({ navigate }: LoginPageProps) {
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

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');

  // Login state (zero hardcoded credentials or demo passwords)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  // Register state (strictly Student / Guardian)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'student' | 'guardian'>('student');
  const [regBranchId, setRegBranchId] = useState(bootstrap?.branches[0]?.id || 'br-mirpur');
  const [regRollLink, setRegRollLink] = useState('');

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    const res = await login(
      email,
      password,
      needs2fa ? { totpCode: totpCode.trim(), recoveryCode: recoveryCode.trim() } : undefined
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
    setSubmitting(true);
    const ok = await register({
      name: regName,
      email: regEmail,
      phone: regPhone,
      password: regPassword,
      role: regRole,
      branchId: regBranchId,
      studentRollToLink: regRollLink,
    });
    setSubmitting(false);
    if (ok) navigate('/portal');
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetNotice(null);
    setSubmitting(true);
    const msg = await requestPasswordReset(resetEmail);
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
      setResetNotice('Password updated. You may now sign in with your new password.');
      setMode('login');
    }
  };

  if (setupRequired) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#042133] via-[#062d40] to-slate-100 pb-16 pt-12">
        <div className="mx-auto max-w-md px-4">
          <div className="rounded-2xl border border-amber-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <ShieldAlert className="h-7 w-7" />
              </span>
              <h1 className="mt-3 text-xl font-extrabold text-slate-900">
                Initial Main Admin Setup
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Create the single Main Admin account for this EDUPro installation. Once completed,
                this setup locks permanently.
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
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
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
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
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#062436] py-3 text-sm font-bold text-white hover:bg-[#0b3854] disabled:opacity-60"
              >
                <Shield className="h-4 w-4 text-amber-400" />
                <span>{submitting ? 'Provisioning Main Admin...' : 'Complete Main Admin Setup'}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#042133] via-[#062d40] to-slate-100 pb-16 pt-12">
      <div className="mx-auto max-w-md px-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#062436] p-1.5">
              <img
                src="/images/aec-logo.png"
                alt="Aloms English Center"
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">
              {bootstrap?.settings?.brandName || 'Aloms English Center'}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Unified Portal for Students, Guardians, Teachers &amp; Main Admin
            </p>
          </div>

          <div className="mt-6 grid grid-cols-3 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setNeeds2fa(false);
                setLocalError(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLocalError(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Student Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('reset');
                setLocalError(null);
              }}
              className={`rounded-lg py-2 text-xs font-bold transition-colors ${
                mode === 'reset' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Reset Password
            </button>
          </div>

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

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Email Address
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Password
                </label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              {needs2fa && (
                <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                    <LockKeyhole className="h-4 w-4 text-indigo-600" />
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
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#062436] py-3 text-sm font-bold text-white hover:bg-[#0b3854] disabled:opacity-60"
              >
                <Shield className="h-4 w-4 text-amber-400" />
                <span>
                  {submitting
                    ? 'Verifying...'
                    : needs2fa
                      ? 'Verify 2FA & Sign In'
                      : 'Sign In to Unified Portal'}
                </span>
              </button>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="mt-5 space-y-3.5">
              <div>
                <label htmlFor="reg-role" className="mb-1 block text-xs font-bold text-slate-700">
                  Account Type
                </label>
                <select
                  id="reg-role"
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as 'student' | 'guardian')}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="student">Student</option>
                  <option value="guardian">Guardian (Parent)</option>
                </select>
              </div>

              <div>
                <label htmlFor="reg-name" className="mb-1 block text-xs font-bold text-slate-700">
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-email"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="reg-phone"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Phone (BD)
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    required
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="reg-branch"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Active Campus Branch
                </label>
                <select
                  id="reg-branch"
                  value={regBranchId}
                  onChange={(e) => setRegBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
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

              {regRole === 'guardian' && (
                <div>
                  <label
                    htmlFor="reg-roll-link"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    Student Roll Number to Link (Optional, e.g. AEC-2026-101)
                  </label>
                  <input
                    id="reg-roll-link"
                    type="text"
                    value={regRollLink}
                    onChange={(e) => setRegRollLink(e.target.value)}
                    placeholder="AEC-2026-101"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="reg-password"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Strong Password (min 8 chars, letters + numbers)
                </label>
                <input
                  id="reg-password"
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                <UserPlus className="h-4 w-4" />
                <span>{submitting ? 'Creating Account...' : 'Register Account'}</span>
              </button>
            </form>
          )}

          {mode === 'reset' && (
            <div className="mt-5 space-y-5">
              <form onSubmit={handleRequestReset} className="space-y-3">
                <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700">
                  Step 1: Request Reset Token
                </label>
                <div className="flex gap-2">
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Account email address"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm"
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
                  <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
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
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
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
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  Confirm New Password
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
