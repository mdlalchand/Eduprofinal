import { FileText, Radio, Sparkles, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  Course,
  CourseBatch,
  CourseLesson,
  LessonType,
  LiveClassStatus,
} from '../types';

interface AdminLessonModalProps {
  open: boolean;
  lesson: CourseLesson | null;
  courses: Course[];
  batches: CourseBatch[];
  defaultCourseId?: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}

export function AdminLessonModal({
  open,
  lesson,
  courses,
  batches,
  defaultCourseId,
  onClose,
  onSaved,
}: AdminLessonModalProps) {
  const { apiFetch } = useAuth();
  const isEditing = Boolean(lesson);

  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('recorded');
  const [title, setTitle] = useState('');
  const [moduleName, setModuleName] = useState('Module 1: Core Grammar');
  const [duration, setDuration] = useState('40:00');
  const [videoUrl, setVideoUrl] = useState('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  const [liveJoinUrl, setLiveJoinUrl] = useState('');
  const [liveStatus, setLiveStatus] = useState<LiveClassStatus>('scheduled');
  const [scheduledAt, setScheduledAt] = useState('2026-04-28 08:00 PM');
  const [lectureSheetUrl, setLectureSheetUrl] = useState('');
  const [sheetSummary, setSheetSummary] = useState('');
  const [isFreePreview, setIsFreePreview] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (lesson) {
      setCourseId(lesson.courseId);
      setBatchId(lesson.batchId ?? '');
      setLessonType(lesson.lessonType ?? 'recorded');
      setTitle(lesson.title);
      setModuleName(lesson.moduleName);
      setDuration(lesson.duration);
      setVideoUrl(lesson.videoUrl ?? '');
      setLiveJoinUrl(lesson.liveJoinUrl ?? '');
      setLiveStatus(lesson.liveStatus ?? 'scheduled');
      setScheduledAt(lesson.scheduledAt ?? '2026-04-28 08:00 PM');
      setLectureSheetUrl(lesson.lectureSheetUrl ?? '');
      setSheetSummary(lesson.sheetSummary ?? '');
      setIsFreePreview(Boolean(lesson.isFreePreview));
    } else {
      const initialCourse = defaultCourseId || courses[0]?.id || '';
      setCourseId(initialCourse);
      setBatchId('');
      setLessonType('recorded');
      setTitle('');
      setModuleName('Module 1: Core Grammar');
      setDuration('40:00');
      setVideoUrl('https://www.youtube.com/watch?v=M7lc1UVf-VE');
      setLiveJoinUrl('https://zoom.us/j/98541236000');
      setLiveStatus('scheduled');
      setScheduledAt('2026-04-28 08:00 PM');
      setLectureSheetUrl('');
      setSheetSummary('');
      setIsFreePreview(false);
    }
  }, [open, lesson, courses, defaultCourseId]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const courseBatches = batches.filter((b) => b.courseId === courseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!courseId || !title.trim()) {
      setError('Course and lecture title are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        courseId,
        batchId: batchId || null,
        lessonType,
        title: title.trim(),
        moduleName: moduleName.trim() || 'Module 1: Core Grammar',
        duration: duration.trim() || (lessonType === 'lecture_sheet' ? 'PDF Sheet' : '40:00'),
        videoUrl: videoUrl.trim(),
        liveJoinUrl: lessonType === 'live' ? liveJoinUrl.trim() : '',
        liveStatus: lessonType === 'live' ? liveStatus : undefined,
        scheduledAt: lessonType === 'live' ? scheduledAt.trim() : undefined,
        lectureSheetUrl: lectureSheetUrl.trim(),
        sheetSummary:
          sheetSummary.trim() || 'Structured class lecture notes and board practice exercises.',
        isFreePreview,
      };

      if (isEditing && lesson) {
        await apiFetch(`/api/portal/lessons/${lesson.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await onSaved(`Updated "${payload.title}" successfully.`);
      } else {
        await apiFetch('/api/portal/lessons', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        await onSaved(`Published "${payload.title}" successfully.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save class item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lesson-studio-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 text-[#062436]">
              {lessonType === 'live' ? (
                <Radio className="h-5 w-5" />
              ) : lessonType === 'lecture_sheet' ? (
                <FileText className="h-5 w-5" />
              ) : (
                <Video className="h-5 w-5" />
              )}
            </span>
            <div>
              <h2 id="lesson-studio-title" className="text-base font-extrabold">
                {isEditing
                  ? 'Modify Lecture / Live Class / Video'
                  : 'Create Lecture, Live Class or Recorded Video'}
              </h2>
              <p className="text-xs text-slate-300">
                Assign to course & batch, configure Live link, HD video embed & PDF sheet
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close lecture studio"
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

            {/* Type Selector */}
            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">Class Format Type *</p>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'recorded' as const,
                    label: 'Recorded Video',
                    icon: Video,
                    desc: 'HD Video + Sheet',
                  },
                  {
                    id: 'live' as const,
                    label: 'Live Class',
                    icon: Radio,
                    desc: 'Zoom / Live Stream',
                  },
                  {
                    id: 'lecture_sheet' as const,
                    label: 'Lecture Sheet',
                    icon: FileText,
                    desc: 'PDF Notes & Pack',
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = lessonType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLessonType(opt.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                        active
                          ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-500'}`}
                      />
                      <span className="mt-1.5 text-xs font-extrabold text-slate-900">
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-slate-500">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="les-course" className="mb-1 block text-xs font-bold text-slate-700">
                  Target Course *
                </label>
                <select
                  id="les-course"
                  value={courseId}
                  onChange={(e) => {
                    setCourseId(e.target.value);
                    setBatchId('');
                  }}
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
                <label htmlFor="les-batch" className="mb-1 block text-xs font-bold text-slate-700">
                  Course Batch (Optional)
                </label>
                <select
                  id="les-batch"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold"
                >
                  <option value="">All Course Students (General)</option>
                  {courseBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="les-title" className="mb-1 block text-xs font-bold text-slate-700">
                  Lecture / Class Title *
                </label>
                <input
                  id="les-title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Live 03. Modifiers & Connectors Marathon QA"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </div>

              <div>
                <label htmlFor="les-module" className="mb-1 block text-xs font-bold text-slate-700">
                  Module / Chapter
                </label>
                <input
                  id="les-module"
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="Module 2: Writing & Reading"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>

              <div>
                <label htmlFor="les-duration" className="mb-1 block text-xs font-bold text-slate-700">
                  Duration / Format Label
                </label>
                <input
                  id="les-duration"
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g. 45:00 or 60 min Live"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>
            </div>

            {lessonType === 'live' && (
              <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <p className="text-xs font-extrabold text-rose-900">Live Class Stream Controls</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="les-live-status"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Live Class Status
                    </label>
                    <select
                      id="les-live-status"
                      value={liveStatus}
                      onChange={(e) => setLiveStatus(e.target.value as LiveClassStatus)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold"
                    >
                      <option value="scheduled">Scheduled (Upcoming)</option>
                      <option value="live_now">LIVE NOW (Active Stream)</option>
                      <option value="ended">Ended (Switch to Replay)</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="les-scheduled-at"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Scheduled Date & Time
                    </label>
                    <input
                      id="les-scheduled-at"
                      type="text"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      placeholder="2026-04-28 08:00 PM"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="les-live-url"
                      className="mb-1 block text-xs font-bold text-slate-700"
                    >
                      Live Join URL (Zoom / Google Meet / YouTube Live)
                    </label>
                    <input
                      id="les-live-url"
                      type="url"
                      value={liveJoinUrl}
                      onChange={(e) => setLiveJoinUrl(e.target.value)}
                      placeholder="https://zoom.us/j/..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {lessonType !== 'lecture_sheet' && (
              <div>
                <label htmlFor="les-video-url" className="mb-1 block text-xs font-bold text-slate-700">
                  {lessonType === 'live'
                    ? 'Recorded Replay / Live Stream Embed URL (Optional)'
                    : 'Recorded Video URL (YouTube Watch, youtu.be, or Embed URL)'}
                </label>
                <input
                  id="les-video-url"
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                />
              </div>
            )}

            <div>
              <label htmlFor="les-sheet-url" className="mb-1 block text-xs font-bold text-slate-700">
                Lecture Sheet / PDF Resource URL (Optional)
              </label>
              <input
                id="les-sheet-url"
                type="text"
                value={lectureSheetUrl}
                onChange={(e) => setLectureSheetUrl(e.target.value)}
                placeholder="https://... or /downloads/sheet.pdf"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
              />
            </div>

            <div>
              <label htmlFor="les-summary" className="mb-1 block text-xs font-bold text-slate-700">
                Lecture Sheet Notes & Topic Breakdown
              </label>
              <textarea
                id="les-summary"
                rows={3}
                value={sheetSummary}
                onChange={(e) => setSheetSummary(e.target.value)}
                placeholder="Write key grammar rules, board questions covered, and homework instructions..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={isFreePreview}
                onChange={(e) => setIsFreePreview(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <span>Unlock as Free Public Demo Preview on Course Detail Page</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span>Syncs immediately with /learn Classroom & Syllabus</span>
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
                {saving ? 'Saving...' : isEditing ? 'Save Lecture Changes' : 'Publish Class'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
