import { Award, CheckCircle2, Clock, FileCheck2, Lock, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { Exam, ExamAttempt } from '../types';

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

export function ExamsPage({ navigate }: ExamsPageProps) {
  const { user, apiFetch } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [review, setReview] = useState<SubmissionReview | null>(null);
  const [examError, setExamError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ userId: string; displayName: string; xp: number; streakDays: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ exams: Exam[]; myAttempts: ExamAttempt[] }>('/api/exams'),
      fetch('/api/public/community').then((r) => (r.ok ? r.json() : { leaderboard: [] })),
    ])
      .then(([res, comm]) => {
        setExams(res.exams);
        setAttempts(res.myAttempts);
        setLeaderboard(comm.leaderboard ?? []);
      })
      .finally(() => setLoading(false));
  }, [user, apiFetch]);

  useEffect(() => {
    if (!activeExam || secondsLeft <= 0) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [activeExam, secondsLeft]);

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Lock className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Sign in to explore exams</h1>
          <p className="mt-2 text-sm text-slate-600">
            Browse public and course-specific English MCQ exams, live timers, and instant merit
            scores once you are signed in.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-6 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-700"
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/80 via-slate-50 to-white pb-16 pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {activeExam ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
                          key={opt}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                            chosen
                              ? 'border-indigo-600 bg-indigo-50 font-bold text-indigo-900'
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
                className="rounded-xl bg-[#062436] px-7 py-3 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                {submitting ? 'Grading...' : 'Submit Exam Answers'}
              </button>
            </div>
          </div>
        ) : review ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
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
                className="mt-6 rounded-xl bg-[#062436] px-5 py-2.5 text-sm font-bold text-white"
              >
                Back to Exams List
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900">Online MCQ Exams</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Timed practice tests with instant automated grading and detailed grammar
                  explanations.
                </p>
              </div>
              <span className="font-mono-tabular rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-xs">
                Roll: {user.rollNumber || user.id.toUpperCase()}
              </span>
            </div>

            {loading ? (
              <p className="mt-10 text-center text-sm text-slate-500">Loading exams...</p>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {exams.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs"
                  >
                    <div>
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
                    </div>
                    <button
                      type="button"
                      onClick={() => startExam(ex)}
                      className="mt-6 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
                    >
                      Start Exam Now
                    </button>
                  </div>
                ))}
              </div>
            )}

            {leaderboard.length > 0 && (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
                <h2 className="text-base font-extrabold text-slate-900">
                  Top Exam & Learning Performers (Privacy-Aware)
                </h2>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {leaderboard.slice(0, 6).map((row, idx) => (
                    <div key={row.userId} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                      <span className="font-bold text-slate-900">
                        #{idx + 1} {row.displayName}
                      </span>
                      <span className="font-mono-tabular font-extrabold text-indigo-700">
                        {row.xp} XP
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {attempts.length > 0 && (
              <div className="mt-12 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
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
                          <td className="font-mono-tabular py-3 pr-4 font-bold text-indigo-700">
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
    </div>
  );
}
