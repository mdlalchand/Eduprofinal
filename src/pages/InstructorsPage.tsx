import {
  BookOpen,
  Facebook,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
  Youtube,
} from 'lucide-react';
import { useState } from 'react';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../context/AuthContext';
import { sanitizeSafeUrl } from '../lib/domain';
import type { Instructor } from '../types';

export function InstructorsPage() {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const isAdmin = user?.role === 'admin';
  const instructors = bootstrap?.instructors ?? [];
  const branches = bootstrap?.branches ?? [];
  const socialDefaults = bootstrap?.settings?.socialLinks;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Instructor | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('English Grammar & IELTS');
  const [roleTitle, setRoleTitle] = useState('Senior Faculty');
  const [education, setEducation] = useState('MA in English Literature');
  const [panel, setPanel] = useState<'Head Faculty' | 'Branch Faculty'>('Head Faculty');
  const [branchId, setBranchId] = useState(branches[0]?.id || 'br-mirpur');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('/src/assets/images/instructor_portrait_lead_1795411661581.jpg');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');

  const headPanel = instructors.filter((i) => i.panel === 'Head Faculty');
  const branchPanel = instructors.filter((i) => i.panel !== 'Head Faculty');

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const branchName = (bId: string) =>
    branches.find((b) => b.id === bId)?.name || 'Main Campus';

  const openCreate = () => {
    setEditing(null);
    setName('');
    setSubject('English Grammar & IELTS');
    setRoleTitle('Senior Instructor');
    setEducation('BA (Hons), MA in English');
    setPanel('Head Faculty');
    setBranchId(branches[0]?.id || 'br-mirpur');
    setBio('');
    setAvatar('/src/assets/images/instructor_portrait_lead_1795411661581.jpg');
    setYoutubeUrl('');
    setFacebookUrl('');
    setModalOpen(true);
  };

  const openEdit = (inst: Instructor) => {
    setEditing(inst);
    setName(inst.name);
    setSubject(inst.subject);
    setRoleTitle(inst.roleTitle);
    setEducation(inst.education);
    setPanel(inst.panel);
    setBranchId(inst.branchId);
    setBio(inst.bio);
    setAvatar(inst.avatar);
    setYoutubeUrl(inst.youtubeUrl || '');
    setFacebookUrl(inst.facebookUrl || '');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      subject: subject.trim(),
      roleTitle: roleTitle.trim(),
      education: education.trim(),
      panel,
      branchId,
      bio: bio.trim(),
      avatar,
      youtubeUrl: youtubeUrl.trim(),
      facebookUrl: facebookUrl.trim(),
    };
    if (editing) {
      await apiFetch(`/api/portal/instructors/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showNotice(`Updated instructor "${payload.name}".`);
    } else {
      await apiFetch('/api/portal/instructors', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(`Added instructor "${payload.name}".`);
    }
    setModalOpen(false);
    await refreshBootstrap();
  };

  const handleDelete = async (inst: Instructor) => {
    if (confirmDeleteId !== inst.id) {
      setConfirmDeleteId(inst.id);
      return;
    }
    await apiFetch(`/api/portal/instructors/${inst.id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await refreshBootstrap();
    showNotice(`Removed instructor "${inst.name}".`);
  };

  const renderGrid = (list: Instructor[]) => (
    <div className="mt-8 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((inst) => {
        const yt = sanitizeSafeUrl(
          inst.youtubeUrl || socialDefaults?.youtube || 'https://www.youtube.com',
          'https://www.youtube.com'
        );
        const fb = sanitizeSafeUrl(
          inst.facebookUrl || socialDefaults?.facebook || 'https://www.facebook.com',
          'https://www.facebook.com'
        );
        const isConfirming = confirmDeleteId === inst.id;
        return (
          <article
            key={inst.id}
            className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-[0_10px_35px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
          >
            <div>
              {/* Solid sky-blue top banner matching Screenshot 3 */}
              <div className="h-24 w-full bg-[#0284c7]" />
              <div className="px-6 pb-6 text-center">
                <img
                  src={sanitizeSafeUrl(
                    inst.avatar,
                    '/src/assets/images/instructor_portrait_lead_1795411661581.jpg'
                  )}
                  alt={inst.name}
                  className="mx-auto -mt-12 h-24 w-24 rounded-full border-4 border-white bg-white object-cover ring-2 ring-sky-400"
                  referrerPolicy="no-referrer"
                />

                <h3 className="mt-4 text-lg font-extrabold text-slate-900">{inst.name}</h3>

                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-1 text-xs font-semibold text-sky-600">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{inst.subject}</span>
                </div>

                <p className="mt-3 text-xs font-medium text-slate-600">{inst.roleTitle}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {inst.education} · {branchName(inst.branchId)}
                </p>

                {/* Social circular icons matching Screenshot 3 */}
                <div className="mt-5 flex items-center justify-center gap-3">
                  <a
                    href={yt}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${inst.name} YouTube`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ff0000] text-white transition-transform hover:scale-105"
                  >
                    <Youtube className="h-4 w-4" />
                  </a>
                  <a
                    href={fb}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${inst.name} Facebook`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1877f2] text-white transition-transform hover:scale-105"
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                <span className="text-[11px] font-bold text-slate-500">{inst.panel}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(inst)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(inst)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                      isConfirming
                        ? 'bg-rose-600 text-white'
                        : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                    }`}
                  >
                    <Trash2 className="h-3 w-3" />
                    {isConfirming && <span>Confirm</span>}
                  </button>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="rm-pastel-bg min-h-screen pb-20 pt-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Centered Header matching Screenshot 3 */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-sky-500 sm:text-4xl">
            Our Expert Instructors
          </h1>
          <p className="mx-auto mt-2.5 max-w-2xl text-sm text-slate-600 sm:text-base">
            Meet our dedicated team of academic educators across Head Faculty and Branch panels.
          </p>
        </div>

        {isAdmin && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/95 px-5 py-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <Settings2 className="h-4 w-4 text-sky-600" />
              <span>Admin Faculty Management ({instructors.length} instructors)</span>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Instructor</span>
            </button>
          </div>
        )}

        {toast && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            {toast}
          </div>
        )}

        {headPanel.length > 0 && (
          <section className="mt-12">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-sky-500">Head Faculty Panel</h2>
              <div className="mx-auto mt-2 h-0.5 w-14 rounded-full bg-sky-500" />
            </div>
            {renderGrid(headPanel)}
          </section>
        )}

        {branchPanel.length > 0 && (
          <section className="mt-14">
            <div className="text-center">
              <h2 className="text-xl font-extrabold text-sky-500">Branch &amp; Academic Panel</h2>
              <div className="mx-auto mt-2 h-0.5 w-14 rounded-full bg-sky-500" />
            </div>
            {renderGrid(branchPanel)}
          </section>
        )}
      </div>

      {/* Create / Edit Instructor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit Instructor' : 'Add Instructor'}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editing ? 'Edit Instructor Profile' : 'Add New Instructor'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close instructor modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Subject *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Role Title</label>
                  <input
                    type="text"
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Education</label>
                  <input
                    type="text"
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Panel</label>
                  <select
                    value={panel}
                    onChange={(e) =>
                      setPanel(
                        e.target.value === 'Branch Faculty' ? 'Branch Faculty' : 'Head Faculty'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="Head Faculty">Head Faculty</option>
                    <option value="Branch Faculty">Branch Faculty</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Campus Branch</label>
                  <select
                    value={branchId}
                    onChange={(e) => setBranchId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">YouTube URL</label>
                  <input
                    type="url"
                    placeholder="https://youtube.com/..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Facebook URL</label>
                  <input
                    type="url"
                    placeholder="https://facebook.com/..."
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Short Bio</label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <ImageUploadField label="Portrait Photo" value={avatar} onChange={setAvatar} />
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  {editing ? 'Update Instructor' : 'Create Instructor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
