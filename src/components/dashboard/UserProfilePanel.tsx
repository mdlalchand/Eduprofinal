import { CheckCircle2, KeyRound, Save, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { Branch, User } from '../../types';
import { ImageUploadField } from '../ImageUploadField';

interface UserProfilePanelProps {
  user: User;
  branches: Branch[];
  darkMode?: boolean;
  onNotify: (msg: string) => void;
}

export function UserProfilePanel({
  user,
  branches,
  darkMode = false,
  onNotify,
}: UserProfilePanelProps) {
  const { apiFetch, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [bio, setBio] = useState(user.bio || '');
  const [subjectSpecialty, setSubjectSpecialty] = useState(user.subjectSpecialty || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const branchName =
    branches.find((b) => b.id === user.branchId)?.name || 'Global / Online Campus';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);
    setSaving(true);
    try {
      const res = await apiFetch<{ user: User }>('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone,
          avatar,
          bio,
          subjectSpecialty: user.role === 'teacher' ? subjectSpecialty : undefined,
          currentPassword: newPassword.trim() ? currentPassword : '',
          newPassword: newPassword.trim(),
        }),
      });
      updateUser(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setSavedNotice(true);
      onNotify('Your profile & account security settings were updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const cardClass = darkMode
    ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
    : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Identity Card */}
      <div className={`rounded-2xl border p-6 shadow-xs lg:col-span-4 ${cardClass}`}>
        <div className="flex flex-col items-center text-center">
          <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-blue-500/30 bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-extrabold text-white">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            )}
          </div>
          <h2 className="mt-4 text-lg font-extrabold">{user.name}</h2>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
            {user.role.replace('_', ' ')}
          </p>
          <p className="mt-1 text-xs opacity-70">{user.email}</p>

          <div className="mt-5 w-full space-y-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 text-left text-xs text-slate-700">
            <p className="flex justify-between">
              <span className="font-semibold text-slate-500">Branch</span>
              <span className="font-bold text-slate-900">{branchName}</span>
            </p>
            {user.rollNumber && (
              <p className="flex justify-between">
                <span className="font-semibold text-slate-500">Roll No</span>
                <span className="font-mono-tabular font-bold text-indigo-700">{user.rollNumber}</span>
              </p>
            )}
            <p className="flex justify-between">
              <span className="font-semibold text-slate-500">Status</span>
              <span className="font-bold uppercase text-emerald-700">{user.status ?? 'active'}</span>
            </p>
            <p className="flex justify-between">
              <span className="font-semibold text-slate-500">Joined</span>
              <span className="font-mono-tabular">{new Date(user.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Editable Profile & Password Form */}
      <form
        onSubmit={handleSubmit}
        className={`rounded-2xl border p-6 shadow-xs lg:col-span-8 space-y-4 ${cardClass}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-indigo-600" />
              <span>My Profile &amp; Account Security</span>
            </h2>
            <p className="text-xs opacity-70">
              Update your personal contact info, bio, avatar, and account password.
            </p>
          </div>
          {savedNotice && (
            <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Saved</span>
            </span>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-bold opacity-80">
              Display Name *
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label htmlFor="prof-phone" className="block text-xs font-bold opacity-80">
              Phone Number *
            </label>
            <input
              id="prof-phone"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
            />
          </div>

          {user.role === 'teacher' && (
            <div className="sm:col-span-2">
              <label htmlFor="prof-specialty" className="block text-xs font-bold opacity-80">
                Faculty Subject Specialty
              </label>
              <input
                id="prof-specialty"
                type="text"
                value={subjectSpecialty}
                onChange={(e) => setSubjectSpecialty(e.target.value)}
                placeholder="e.g. IELTS Band 8 & HSC Grammar"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
              />
            </div>
          )}

          <div className="sm:col-span-2">
            <ImageUploadField
              label="Profile Photo (Upload from Device or Pick from My Storage)"
              value={avatar}
              onChange={setAvatar}
              category="avatar"
              darkMode={darkMode}
              placeholder="/uploads/... or /src/assets/images/..."
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="prof-bio" className="block text-xs font-bold opacity-80">
              Personal Bio / Study Goal
            </label>
            <textarea
              id="prof-bio"
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your learning goal or teaching philosophy..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-slate-900">
          <p className="text-xs font-extrabold flex items-center gap-1.5">
            <KeyRound className="h-4 w-4 text-indigo-600" />
            <span>Change Account Password (Optional)</span>
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="prof-curr-pw" className="block text-xs font-bold text-slate-700">
                Current Password
              </label>
              <input
                id="prof-curr-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="prof-new-pw" className="block text-xs font-bold text-slate-700">
                New Password (min 6 chars)
              </label>
              <input
                id="prof-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Saving Changes...' : 'Save My Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
