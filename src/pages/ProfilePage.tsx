import {
  CheckCircle2,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Settings2,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../context/AuthContext';
import { sanitizeSafeUrl } from '../lib/domain';
import type { User, UserRole } from '../types';

interface ProfilePageProps {
  navigate: (path: string) => void;
}

export function ProfilePage({ navigate }: ProfilePageProps) {
  const { user, bootstrap, apiFetch, updateUser } = useAuth();
  const isAdmin = user?.role === 'admin';
  const branches = bootstrap?.branches ?? [];

  // Self-service profile form
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [subjectSpecialty, setSubjectSpecialty] = useState(user?.subjectSpecialty || '');
  const [avatar, setAvatar] = useState(
    user?.avatar || '/src/assets/images/avatar_student_portrait_1795437875582.jpg'
  );
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingSelf, setSavingSelf] = useState(false);
  const [selfMessage, setSelfMessage] = useState<string | null>(null);
  const [selfError, setSelfError] = useState<string | null>(null);

  // Admin user directory management
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adminToast, setAdminToast] = useState<string | null>(null);

  const [uName, setUName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uPhone, setUPhone] = useState('');
  const [uRole, setURole] = useState<UserRole>('student');
  const [uBranchId, setUBranchId] = useState(branches[0]?.id || 'br-mirpur');
  const [uStatus, setUStatus] = useState<'active' | 'suspended'>('active');
  const [uRoll, setURoll] = useState('');
  const [uPassword, setUPassword] = useState('');

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhone(user.phone || '');
    setBio(user.bio || '');
    setSubjectSpecialty(user.subjectSpecialty || '');
    setAvatar(user.avatar || '/src/assets/images/avatar_student_portrait_1795437875582.jpg');
  }, [user]);

  const loadDirectory = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiFetch<{ users?: User[] }>('/api/portal/overview');
      if (Array.isArray(res.users)) setAllUsers(res.users);
    } catch {
      // Ignore
    }
  }, [isAdmin, apiFetch]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const showNotice = (msg: string) => {
    setAdminToast(msg);
    window.setTimeout(() => setAdminToast(null), 4000);
  };

  if (!user) {
    return (
      <div className="rm-pastel-bg flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-9 text-center shadow-[0_14px_45px_rgba(15,23,42,0.06)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Sign in to view profile</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage your student roll details, profile photo, security password, and linked campus
            information.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfError(null);
    setSelfMessage(null);
    setSavingSelf(true);
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          subjectSpecialty: subjectSpecialty.trim(),
          avatar,
          currentPassword: currentPassword.trim() || undefined,
          newPassword: newPassword.trim() || undefined,
        }),
      });
      updateUser(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setSelfMessage('Profile details saved successfully.');
    } catch (err) {
      setSelfError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingSelf(false);
    }
  };

  const openCreateUser = () => {
    setEditingUser(null);
    setUName('');
    setUEmail('');
    setUPhone('01710000000');
    setURole('student');
    setUBranchId(branches[0]?.id || 'br-mirpur');
    setUStatus('active');
    setURoll('');
    setUPassword('');
    setUserModalOpen(true);
  };

  const openEditUser = (target: User) => {
    setEditingUser(target);
    setUName(target.name);
    setUEmail(target.email);
    setUPhone(target.phone);
    setURole(target.role);
    setUBranchId(target.branchId || branches[0]?.id || 'br-mirpur');
    setUStatus(target.status === 'suspended' ? 'suspended' : 'active');
    setURoll(target.rollNumber || '');
    setUPassword('');
    setUserModalOpen(true);
  };

  const handleSaveAdminUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      await apiFetch(`/api/portal/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: uName.trim(),
          email: uEmail.trim(),
          phone: uPhone.trim(),
          role: editingUser.role === 'admin' ? undefined : uRole,
          branchId: uBranchId || null,
          status: uStatus,
          rollNumber: uRoll.trim() || undefined,
          password: uPassword.trim() || undefined,
        }),
      });
      showNotice(`Updated user "${uName}".`);
    } else {
      await apiFetch('/api/portal/users', {
        method: 'POST',
        body: JSON.stringify({
          name: uName.trim(),
          email: uEmail.trim(),
          phone: uPhone.trim(),
          role: uRole,
          branchId: uBranchId || null,
          status: uStatus,
          rollNumber: uRoll.trim() || undefined,
          password: uPassword.trim(),
        }),
      });
      showNotice(`Created ${uRole} account "${uName}".`);
    }
    setUserModalOpen(false);
    await loadDirectory();
  };

  const handleDeleteUser = async (target: User) => {
    if (confirmDeleteId !== target.id) {
      setConfirmDeleteId(target.id);
      return;
    }
    await apiFetch(`/api/portal/users/${target.id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await loadDirectory();
    showNotice(`Removed user "${target.name}".`);
  };

  const filteredUsers = allUsers.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return `${u.name} ${u.email} ${u.role} ${u.rollNumber || ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="rm-pastel-bg min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-sky-500 sm:text-4xl">
            My Profile &amp; Account Settings
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Update your personal info, profile avatar, and account password.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* Left Identity Summary Card */}
          <aside className="rounded-3xl bg-white p-7 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)] lg:col-span-4">
            <img
              src={sanitizeSafeUrl(
                avatar,
                '/src/assets/images/avatar_student_portrait_1795437875582.jpg'
              )}
              alt={user.name}
              className="mx-auto h-28 w-28 rounded-full border-4 border-sky-100 object-cover shadow-sm"
              referrerPolicy="no-referrer"
            />
            <h2 className="mt-4 text-xl font-extrabold text-slate-900">{user.name}</h2>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-0.5 text-xs font-bold uppercase text-sky-700">
              <Shield className="h-3.5 w-3.5" />
              <span>{user.role}</span>
            </p>
            <p className="mt-3 text-xs text-slate-500">{user.email}</p>
            {user.rollNumber && (
              <p className="font-mono-tabular mt-2 inline-block rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                Roll: {user.rollNumber}
              </p>
            )}
            <div className="mt-6 space-y-2 border-t border-slate-100 pt-5 text-left text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Phone</span>
                <span className="font-mono-tabular font-bold text-slate-900">{user.phone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Status</span>
                <span className="font-bold uppercase text-emerald-700">
                  {user.status || 'active'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>2FA Security</span>
                <span className="font-bold text-slate-800">
                  {user.twoFactorEnabled ? 'Enabled' : 'Standard'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/portal')}
              className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              Open Full Unified Portal
            </button>
          </aside>

          {/* Right Profile Editor Form */}
          <section className="rounded-3xl bg-white p-7 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8 lg:col-span-8">
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <UserIcon className="h-5 w-5 text-sky-600" />
              <span>Edit Personal Profile</span>
            </h2>

            {selfMessage && (
              <p className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{selfMessage}</span>
              </p>
            )}
            {selfError && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                {selfError}
              </p>
            )}

            <form onSubmit={handleSaveProfile} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Phone (BD) *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              {(user.role === 'teacher' || user.role === 'admin') && (
                <div>
                  <label className="mb-1 block font-bold text-slate-700">
                    Subject Specialty / Role Title
                  </label>
                  <input
                    type="text"
                    value={subjectSpecialty}
                    onChange={(e) => setSubjectSpecialty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block font-bold text-slate-700">Bio / Academic Notes</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <ImageUploadField label="Profile Photo" value={avatar} onChange={setAvatar} />

              <div className="border-t border-slate-100 pt-4">
                <p className="mb-3 flex items-center gap-1.5 font-extrabold text-slate-800">
                  <KeyRound className="h-4 w-4 text-sky-600" />
                  <span>Change Password (Optional)</span>
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">Current Password</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">
                      New Password (min 8 chars)
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSelf}
                  className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60"
                >
                  {savingSelf ? 'Saving...' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Admin User Profiles Directory */}
        {isAdmin && (
          <section className="mt-10 rounded-3xl bg-white p-7 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Settings2 className="h-5 w-5 text-sky-600" />
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Admin User Profiles Directory ({allUsers.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Add, edit, suspend, or remove student, guardian, and teacher profiles.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user or roll..."
                  aria-label="Search users directory"
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                />
                <button
                  type="button"
                  onClick={openCreateUser}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add User</span>
                </button>
              </div>
            </div>

            {adminToast && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
                {adminToast}
              </div>
            )}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-bold uppercase text-slate-500">
                    <th className="py-2.5 pr-3">Name</th>
                    <th className="py-2.5 pr-3">Email</th>
                    <th className="py-2.5 pr-3">Role</th>
                    <th className="py-2.5 pr-3">Roll / Branch</th>
                    <th className="py-2.5 pr-3">Status</th>
                    <th className="py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.map((u) => {
                    const confirming = confirmDeleteId === u.id;
                    return (
                      <tr key={u.id}>
                        <td className="py-3 pr-3 font-bold text-slate-900">{u.name}</td>
                        <td className="py-3 pr-3 text-slate-600">{u.email}</td>
                        <td className="py-3 pr-3 font-bold uppercase text-sky-700">{u.role}</td>
                        <td className="font-mono-tabular py-3 pr-3 text-slate-600">
                          {u.rollNumber || u.branchId || 'Main'}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`font-bold uppercase ${
                              u.status === 'suspended' ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditUser(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            {u.role !== 'admin' && (
                              <button
                                type="button"
                                onClick={() => void handleDeleteUser(u)}
                                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 font-bold ${
                                  confirming
                                    ? 'bg-rose-600 text-white'
                                    : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                }`}
                              >
                                <Trash2 className="h-3 w-3" />
                                {confirming && <span>Confirm</span>}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Admin Add / Edit User Modal */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editingUser ? 'Edit User Profile' : 'Add User Profile'}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editingUser ? 'Edit User Profile' : 'Create User Account'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                aria-label="Close user modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAdminUser} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={uName}
                  onChange={(e) => setUName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Email *</label>
                  <input
                    type="email"
                    required
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Phone (BD) *</label>
                  <input
                    type="tel"
                    required
                    value={uPhone}
                    onChange={(e) => setUPhone(e.target.value)}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Role</label>
                  <select
                    disabled={editingUser?.role === 'admin'}
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="student">Student</option>
                    <option value="guardian">Guardian</option>
                    <option value="teacher">Teacher</option>
                    {editingUser?.role === 'admin' && <option value="admin">Main Admin</option>}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Status</label>
                  <select
                    value={uStatus}
                    onChange={(e) =>
                      setUStatus(e.target.value === 'suspended' ? 'suspended' : 'active')
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Branch</label>
                  <select
                    value={uBranchId}
                    onChange={(e) => setUBranchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Roll Number</label>
                  <input
                    type="text"
                    value={uRoll}
                    onChange={(e) => setURoll(e.target.value)}
                    placeholder="AEC-2026-105"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  {editingUser ? 'Reset Password (Optional)' : 'Strong Password *'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  minLength={editingUser ? undefined : 8}
                  value={uPassword}
                  onChange={(e) => setUPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
