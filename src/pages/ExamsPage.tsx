import {
  Award,
  CheckCircle2,
  Clock,
  FileCheck2,
  Lock,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Exam, ExamAttempt, ExamQuestion } from '../types';

interface ExamsPageProps {
  navigate: (path: string) => void;
}

interface SubmissionReview {
  attempt: ExamAttempt;
  reviewQuestions: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    selectedIndex: number | null;
  }[];
}

const emptyQuestion = (): ExamQuestion => ({
  id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
  prompt: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
  marks: 2,
});

export function ExamsPage({ navigate }: ExamsPageProps) {
  const { user, bootstrap, apiFetch } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';

  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    { userId: string; displayName: string; xp: number; streakDays: number }[]
  >([]);

  // Admin CRUD state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [fTitle, setFTitle] = useState('');
  const [fCategory, setFCategory] = useState('HSC English');
  const [fCourseId, setFCourseId] = useState('');
  const [fDuration, setFDuration] = useState(20);
  const [fPassPct, setFPassPct] = useState(50);
  const [fNegMark, setFNegMark] = useState(0);
  const [fVisibility, setFVisibility] = useState<'public' | 'course'>('public');
  const [fQuestions, setFQuestions] = useState<ExamQuestion[]>([emptyQuestion()]);

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const loadExams = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [res, comm] = await Promise.all([
        apiFetch<{ exams: Exam[]; myAttempts: ExamAttempt[] }>('/api/exams'),
        fetch('/api/public/community').then((r) => (r.ok ? r.json() : { leaderboard: [] })),
      ]);
      setExams(res.exams);
      setAttempts(res.myAttempts);
      setLeaderboard(comm.leaderboard ?? []);
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  useEffect(() => {
    if (!activeExam || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeExam, secondsLeft]);

  if (!user) {
    return (
      <div className="rm-pastel-bg flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-3xl bg-white p-9 text-center shadow-[0_14px_45px_rgba(15,23,42,0.06)]">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Sign in to explore exams</h1>
          <p className="mt-2 text-sm text-slate-600">
            Access timed English MCQ exams, negative marking drills, and instant merit grading after
            signing in.
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

  const startExam = async (exam: Exam) => {
    setReview(null);
    setExamError(null);
    setAnswers({});
    setActiveExam(exam);
    setSecondsLeft(exam.durationMinutes * 60);
    try {
      const res = await apiFetch<{ remainingSeconds: number }>(
        `/api/portal/exams/${encodeURIComponent(exam.id)}/start`,
        { method: 'POST' }
      );
      if (typeof res.remainingSeconds === 'number') {
        setSecondsLeft(res.remainingSeconds);
      }
    } catch (err) {
      setExamError(err instanceof Error ? err.message : 'Could not sync exam timer with server.');
    }
  };

  const submitExam = async () => {
    if (!activeExam || submitting) return;
    setSubmitting(true);
    setExamError(null);
    try {
      const res = await apiFetch<SubmissionReview>(`/api/exams/${activeExam.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      });
      setReview(res);
      setAttempts((prev) => [res.attempt, ...prev]);
      setActiveExam(null);
    } catch (err) {
      setExamError(err instanceof Error ? err.message : 'Exam submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const openCreateModal = () => {
    setEditing(null);
    setFTitle('');
    setFCategory('HSC English');
    setFCourseId('');
    setFDuration(20);
    setFPassPct(50);
    setFNegMark(0);
    setFVisibility('public');
    setFQuestions([emptyQuestion()]);
    setModalOpen(true);
  };

  const openEditModal = (ex: Exam) => {
    setEditing(ex);
    setFTitle(ex.title);
    setFCategory(ex.category);
    setFCourseId(ex.courseId || '');
    setFDuration(ex.durationMinutes);
    setFPassPct(ex.passPercentage);
    setFNegMark(ex.negativeMarkPerWrong ?? 0);
    setFVisibility(ex.visibility === 'course' ? 'course' : 'public');
    setFQuestions(
      ex.questions.length > 0 ? ex.questions.map((q) => ({ ...q, options: [...q.options] })) : [emptyQuestion()]
    );
    setModalOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedQuestions = fQuestions.filter((q) => q.prompt.trim());
    if (cleanedQuestions.length === 0) return;

    const payload = {
      title: fTitle.trim(),
      category: fCategory.trim(),
      courseId: fCourseId || null,
      durationMinutes: Number(fDuration) || 20,
      passPercentage: Number(fPassPct) || 50,
      negativeMarkPerWrong: Number(fNegMark) || 0,
      visibility: fVisibility,
      questions: cleanedQuestions.map((q) => ({
        ...q,
        options: q.options.map((o, idx) => o.trim() || `Option ${String.fromCharCode(65 + idx)}`),
      })),
    };

    if (editing) {
      await apiFetch(`/api/portal/exams/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showNotice(`Updated exam "${payload.title}".`);
    } else {
      await apiFetch('/api/portal/exams', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(`Created exam "${payload.title}".`);
    }
    setModalOpen(false);
    await loadExams();
  };

  const handleDeleteExam = async (ex: Exam) => {
    if (confirmDeleteId !== ex.id) {
      setConfirmDeleteId(ex.id);
      return;
    }
    await apiFetch(`/api/portal/exams/${ex.id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await loadExams();
    showNotice(`Moved exam "${ex.title}" to Recycle Bin.`);
  };

  return (
    <div className="rm-pastel-bg min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {activeExam ? (
          <div className="rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                  {activeExam.category}
                </span>
                <h1 className="text-xl font-extrabold text-slate-900">{activeExam.title}</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-tabular inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2 text-sm font-bold text-amber-800">
                  <Clock className="h-4 w-4" />
                  {formatTimer(secondsLeft)}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveExam(null)}
                  className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600"
                >
                  Exit
                </button>
              </div>
            </div>

            {examError && (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
                {examError}
              </p>
            )}

            <div className="mt-6 space-y-6">
              {activeExam.questions.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-slate-200 p-5">
                  <p className="text-sm font-bold text-slate-900">
                    <span className="font-mono-tabular mr-2 text-sky-700">Q{idx + 1}.</span>
                    {q.prompt}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {q.options.map((opt, oIdx) => {
                      const chosen = answers[q.id] === oIdx;
                      return (
                        <button
                          key={opt + oIdx}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                            chosen
                              ? 'border-sky-600 bg-sky-50 font-bold text-sky-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-mono-tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
                            {String.fromCharCode(65 + oIdx)}
                          </span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={submitExam}
                disabled={submitting}
                className="rounded-xl bg-sky-600 px-7 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                {submitting ? 'Grading...' : 'Submit Exam Answers'}
              </button>
            </div>
          </div>
        ) : review ? (
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    Exam Evaluated
                  </span>
                  <h1 className="mt-1 text-2xl font-extrabold text-slate-900">
                    {review.attempt.examTitle}
                  </h1>
                </div>
                <div className="flex items-center gap-4">
                  <div className="rounded-xl bg-slate-50 px-4 py-2 text-center">
                    <p className="text-xs text-slate-500">Score</p>
                    <p className="font-mono-tabular text-xl font-extrabold text-slate-900">
                      {review.attempt.score}/{review.attempt.totalMarks}
                    </p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 px-4 py-2 text-center">
                    <p className="text-xs text-emerald-700">Grade</p>
                    <p className="font-mono-tabular text-xl font-extrabold text-emerald-800">
                      {review.attempt.grade} ({review.attempt.percentage}%)
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {review.reviewQuestions.map((rq, idx) => {
                  const ok = rq.selectedIndex === rq.correctIndex;
                  return (
                    <div key={rq.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">
                          {idx + 1}. {rq.prompt}
                        </p>
                        {ok ? (
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-600">
                        Your answer:{' '}
                        <strong className={ok ? 'text-emerald-700' : 'text-rose-700'}>
                          {rq.selectedIndex !== null ? rq.options[rq.selectedIndex] : 'Unanswered'}
                        </strong>{' '}
                        · Correct answer:{' '}
                        <strong className="text-emerald-700">{rq.options[rq.correctIndex]}</strong>
                      </p>
                      <p className="mt-1.5 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700">
                        {rq.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setReview(null)}
                className="mt-6 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white"
              >
                Back to Exams List
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-sky-500">Online MCQ Exams</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Timed practice tests with automated grading and detailed grammar explanations.
                </p>
              </div>
              <span className="font-mono-tabular rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs">
                Roll: {user.rollNumber || user.id.toUpperCase()}
              </span>
            </div>

            {canManage && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/95 px-5 py-3.5 shadow-xs">
                <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
                  <Settings2 className="h-4 w-4 text-sky-600" />
                  <span>Admin &amp; Faculty Exam Builder ({exams.length} exams)</span>
                </div>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Exam</span>
                </button>
              </div>
            )}

            {toast && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
                {toast}
              </div>
            )}

            {loading ? (
              <p className="mt-10 text-center text-sm text-slate-500">Loading exams...</p>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {exams.map((ex) => {
                  const confirming = confirmDeleteId === ex.id;
                  return (
                    <article
                      key={ex.id}
                      className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)]"
                    >
                      <div className="p-6">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                          <span>{ex.category}</span>
                          <span className="uppercase text-sky-600">{ex.visibility}</span>
                        </div>
                        <h2 className="mt-2 text-lg font-extrabold text-slate-900">{ex.title}</h2>
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span className="font-mono-tabular inline-flex items-center gap-1">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            {ex.questions.length} MCQs
                          </span>
                          <span className="font-mono-tabular inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {ex.durationMinutes} min
                          </span>
                          {Number(ex.negativeMarkPerWrong) > 0 && (
                            <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                              -{ex.negativeMarkPerWrong} / wrong
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => startExam(ex)}
                          className="mt-6 w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700"
                        >
                          Start Exam Now
                        </button>
                      </div>

                      {canManage && (
                        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5">
                          <span className="font-mono-tabular text-[11px] font-bold text-slate-500">
                            Pass {ex.passPercentage}%
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(ex)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteExam(ex)}
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                                confirming
                                  ? 'bg-rose-600 text-white'
                                  : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                              }`}
                            >
                              <Trash2 className="h-3 w-3" />
                              {confirming && <span>Confirm</span>}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {leaderboard.length > 0 && (
              <div className="mt-8 rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <h2 className="text-base font-extrabold text-slate-900">
                  Top Exam &amp; Learning Performers
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {leaderboard.slice(0, 6).map((row, idx) => (
                    <div
                      key={row.userId}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs"
                    >
                      <span className="font-bold text-slate-900">
                        #{idx + 1} {row.displayName}
                      </span>
                      <span className="font-mono-tabular font-extrabold text-sky-700">
                        {row.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attempts.length > 0 && (
              <div className="mt-10 rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-extrabold text-slate-900">My Recent Exam Results</h2>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                        <th className="py-2.5 pr-4">Exam</th>
                        <th className="py-2.5 pr-4">Score</th>
                        <th className="py-2.5 pr-4">Grade</th>
                        <th className="py-2.5 pr-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {attempts.map((att) => (
                        <tr key={att.id}>
                          <td className="py-3 pr-4 font-semibold text-slate-900">{att.examTitle}</td>
                          <td className="font-mono-tabular py-3 pr-4 text-slate-700">
                            {att.score}/{att.totalMarks} ({att.percentage}%)
                          </td>
                          <td className="font-mono-tabular py-3 pr-4 font-bold text-sky-700">
                            {att.grade}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`text-xs font-bold ${
                                att.passed ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {att.passed ? 'Passed' : 'Needs Review'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Admin Create / Edit Exam Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit Exam' : 'Create Exam'}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editing ? 'Edit MCQ Exam' : 'Create MCQ Exam'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close exam editor"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveExam} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Exam Title *</label>
                  <input
                    type="text"
                    required
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Category</label>
                  <input
                    type="text"
                    value={fCategory}
                    onChange={(e) => setFCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Duration (min)</label>
                  <input
                    type="number"
                    min={5}
                    value={fDuration}
                    onChange={(e) => setFDuration(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Pass %</label>
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={fPassPct}
                    onChange={(e) => setFPassPct(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Neg. Mark</label>
                  <input
                    type="number"
                    min={0}
                    step={0.25}
                    value={fNegMark}
                    onChange={(e) => setFNegMark(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Visibility</label>
                  <select
                    value={fVisibility}
                    onChange={(e) =>
                      setFVisibility(e.target.value === 'course' ? 'course' : 'public')
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="public">Public</option>
                    <option value="course">Enrolled Only</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Linked Course (Optional)</label>
                <select
                  value={fCourseId}
                  onChange={(e) => setFCourseId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                >
                  <option value="">Standalone Public Exam</option>
                  {(bootstrap?.courses ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 border-t border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-800">
                    MCQ Questions ({fQuestions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setFQuestions((prev) => [...prev, emptyQuestion()])}
                    className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-3 py-1.5 font-bold text-sky-700 hover:bg-sky-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {fQuestions.map((q, qIdx) => (
                  <div key={q.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700">Question {qIdx + 1}</span>
                      {fQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setFQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                          }
                          className="text-rose-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="Question prompt..."
                      value={q.prompt}
                      onChange={(e) =>
                        setFQuestions((prev) =>
                          prev.map((item, idx) =>
                            idx === qIdx ? { ...item, prompt: e.target.value } : item
                          )
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => (
                        <input
                          key={oIdx}
                          type="text"
                          required
                          placeholder={`Option ${String.fromCharCode(65 + oIdx)}`}
                          value={opt}
                          onChange={(e) =>
                            setFQuestions((prev) =>
                              prev.map((item, idx) => {
                                if (idx !== qIdx) return item;
                                const nextOpts = [...item.options];
                                nextOpts[oIdx] = e.target.value;
                                return { ...item, options: nextOpts };
                              })
                            )
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">
                          Correct Answer
                        </label>
                        <select
                          value={q.correctIndex}
                          onChange={(e) =>
                            setFQuestions((prev) =>
                              prev.map((item, idx) =>
                                idx === qIdx ? { ...item, correctIndex: Number(e.target.value) } : item
                              )
                            )
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                        >
                          <option value={0}>Option A</option>
                          <option value={1}>Option B</option>
                          <option value={2}>Option C</option>
                          <option value={3}>Option D</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">
                          Marks
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={q.marks}
                          onChange={(e) =>
                            setFQuestions((prev) =>
                              prev.map((item, idx) =>
                                idx === qIdx ? { ...item, marks: Number(e.target.value) || 1 } : item
                              )
                            )
                          }
                          className="font-mono-tabular w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">
                          Explanation
                        </label>
                        <input
                          type="text"
                          value={q.explanation}
                          onChange={(e) =>
                            setFQuestions((prev) =>
                              prev.map((item, idx) =>
                                idx === qIdx ? { ...item, explanation: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Grammar rule..."
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  {editing ? 'Update Exam' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
