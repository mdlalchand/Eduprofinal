import { CalendarClock, Layers, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Branch, Course, CourseBatch, Instructor } from '../types';

interface AdminBatchModalProps {
  open: boolean;
  batch: CourseBatch | null;
  courses: Course[];
  branches: Branch[];
  instructors: Instructor[];
  defaultCourseId?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}

export function AdminBatchModal({
  open,
  batch,
  courses,
  branches,
  instructors,
  defaultCourseId,
  onClose,
  onSaved,
}: AdminBatchModalProps) {
  const { apiFetch } = useAuth();
  const isEditing = Boolean(batch);

  const [courseId, setCourseId] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [branchId, setBranchId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [schedule, setSchedule] = useState('Sat · Mon · Wed (4:00 PM)');
  const [startDate, setStartDate] = useState('2026-05-05');
  const [seatLimit, setSeatLimit] = useState('60');
  const [enrolledSeats, setEnrolledSeats] = useState('0');
  const [mode, setMode] = useState<CourseBatch['mode']>('Hybrid');
  const [status, setStatus] = useState<CourseBatch['status']>('open');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (batch) {
      setCourseId(batch.courseId);
      setName(batch.name);
      setCode(batch.code);
      setBranchId(batch.branchId);
      setInstructorId(batch.instructorId);
      setSchedule(batch.schedule);
      setStartDate(batch.startDate);
      setSeatLimit(String(batch.seatLimit));
      setEnrolledSeats(String(batch.enrolledSeats));
      setMode(batch.mode);
      setStatus(batch.status);
    } else {
      setCourseId(defaultCourseId || courses[0]?.id || '');
      setName('');
      setCode('');
      setBranchId(branches[0]?.id || 'br-mirpur');
      setInstructorId(instructors[0]?.id || 'inst-1');
      setSchedule('Sat · Mon · Wed (4:00 PM)');
      setStartDate('2026-05-05');
      setSeatLimit('60');
      setEnrolledSeats('0');
      setMode('Hybrid');
      setStatus('open');
    }
  }, [open, batch, courses, branches, instructors, defaultCourseId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!courseId || !name.trim() || !code.trim()) {
      setError('Course, batch name, and batch code are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        courseId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        branchId,
        instructorId,
        schedule: schedule.trim(),
        startDate: startDate.trim(),
        seatLimit: Math.max(1, Number(seatLimit) || 60),
        enrolledSeats: Math.max(0, Number(enrolledSeats) || 0),
        mode,
        status,
      };

      if (isEditing && batch) {
        await apiFetch(`/api/portal/batches/${batch.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await onSaved(`Updated batch "${payload.name}" successfully.`);
      } else {
        await apiFetch('/api/portal/batches', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await onSaved(`Created batch "${payload.name}" successfully.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-studio-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-[#062436]">
              <Layers className="h-5 w-5" />
            </span>
            <div>
              <h2 id="batch-studio-title" className="text-base font-extrabold">
                {isEditing ? 'Modify Course Batch & Routine' : 'Create New Course Batch'}
              </h2>
              <p className="text-xs text-slate-300">
                Assign branch campus, faculty, routine timing & seat capacity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close batch studio"
            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="bat-course" className="mb-1 block text-xs font-bold text-slate-700">
                  Parent Course *
                </label>
                <select
                  id="bat-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="bat-name" className="mb-1 block text-xs font-bold text-slate-700">
                  Batch Name *
                </label>
                <input
                  id="bat-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mirpur Morning Batch A"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="bat-code" className="mb-1 block text-xs font-bold text-slate-700">
                  Batch Code *
                </label>
                <input
                  id="bat-code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SSC-27-MPR-02"
                  className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm uppercase"
                />
              </div>

              <div>
                <label htmlFor="bat-branch" className="mb-1 block text-xs font-bold text-slate-700">
                  Campus Branch
                </label>
                <select
                  id="bat-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="bat-instructor"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Lead Instructor
                </label>
                <select
                  id="bat-instructor"
                  value={instructorId}
                  onChange={(e) => setInstructorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  {instructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} — {inst.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="bat-schedule"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  Weekly Class Routine *
                </label>
                <div className="relative">
                  <CalendarClock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="bat-schedule"
                    type="text"
                    required
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="Sun · Tue · Thu (8:00 PM)"
                    className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bat-start" className="mb-1 block text-xs font-bold text-slate-700">
                  Start Date
                </label>
                <input
                  id="bat-start"
                  type="text"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="2026-05-05"
                  className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label htmlFor="bat-mode" className="mb-1 block text-xs font-bold text-slate-700">
                  Delivery Mode
                </label>
                <select
                  id="bat-mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as CourseBatch['mode'])}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="Online Live">Online Live</option>
                  <option value="Offline Branch">Offline Branch</option>
                  <option value="Hybrid">Hybrid (Branch + Online Live)</option>
                </select>
              </div>

              <div>
                <label htmlFor="bat-seats" className="mb-1 block text-xs font-bold text-slate-700">
                  Seat Capacity
                </label>
                <input
                  id="bat-seats"
                  type="number"
                  min={1}
                  value={seatLimit}
                  onChange={(e) => setSeatLimit(e.target.value)}
                  className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="bat-status" className="mb-1 block text-xs font-bold text-slate-700">
                  Admission Status
                </label>
                <select
                  id="bat-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CourseBatch['status'])}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="open">Open for Admission</option>
                  <option value="running">Running</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Visible on Course Detail & Classroom filters</span>
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#062436] px-5 py-2 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Batch Changes' : 'Create Batch'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
