import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Megaphone,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { buildTeacherStudentRoster } from '../../lib/usersAndTeaching';
import type {
  AttendanceRecord,
  Course,
  CourseLesson,
  Enrollment,
  Exam,
  ExamAttempt,
  LearnerRewardProfile,
  User,
} from '../../types';

interface TeacherRosterPanelProps {
  users: User[];
  courses: Course[];
  lessons: CourseLesson[];
  enrollments: Enrollment[];
  examAttempts: ExamAttempt[];
  attendance: AttendanceRecord[];
  rewardsByUser: Record<string, LearnerRewardProfile>;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function TeacherRosterPanel({
  users,
  courses,
  lessons,
  enrollments,
  examAttempts,
  attendance,
  rewardsByUser,
  onRefresh,
  onNotify,
}: TeacherRosterPanelProps) {
  const { apiFetch } = useAuth();
  const [courseFilter, setCourseFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Award XP Modal
  const [awardTarget, setAwardTarget] = useState<{ id: string; name: string } | null>(null);
  const [xpDelta, setXpDelta] = useState(25);
  const [xpReason, setXpReason] = useState('Outstanding class participation & speaking drill');
  const [awardBusy, setAwardBusy] = useState(false);

  // Quick Batch Notice Form
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeAudience, setNoticeAudience] = useState('All Active Students');
  const [noticeMessage, setNoticeMessage] = useState('');
  const [noticeBusy, setNoticeBusy] = useState(false);

  const roster = useMemo(
    () =>
      buildTeacherStudentRoster({
        users,
        enrollments,
        lessons,
        examAttempts,
        attendance,
        rewardsByUser,
        courseIdFilter: courseFilter,
        search,
      }),
    [users, enrollments, lessons, examAttempts, attendance, rewardsByUser, courseFilter, search]
  );

  const handleAwardXp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardTarget) return;
    setAwardBusy(true);
    try {
      await apiFetch('/api/portal/teacher/award-xp', {
        method: 'POST',
        body: JSON.stringify({
          studentId: awardTarget.id,
          xpDelta,
          reason: xpReason,
        }),
      });
      setAwardTarget(null);
      await onRefresh();
      onNotify(`Awarded +${xpDelta} XP to ${awardTarget.name}!`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not award XP.');
    } finally {
      setAwardBusy(false);
    }
  };

  const handleSendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noticeTitle.trim() || !noticeMessage.trim()) return;
    setNoticeBusy(true);
    try {
      await apiFetch('/api/portal/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: noticeTitle.trim(),
          channel: 'Notice',
          audience: noticeAudience.trim() || 'All Active Students',
          message: noticeMessage.trim(),
        }),
      });
      setNoticeTitle('');
      setNoticeMessage('');
      setNoticeOpen(false);
      await onRefresh();
      onNotify('Batch notice broadcasted to students.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to broadcast notice.');
    } finally {
      setNoticeBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <span>Student Coaching Roster &amp; Progress ({roster.length})</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Track student lesson completion, exam scores, attendance, and reward participation XP directly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNoticeOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Megaphone className="h-3.5 w-3.5" />
            <span>{noticeOpen ? 'Hide Batch Notice' : 'Send Batch Notice'}</span>
          </button>
        </div>

        {noticeOpen && (
          <form
            onSubmit={handleSendNotice}
            className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="text"
                required
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                placeholder="Notice Title (e.g. Tomorrow's IELTS Writing Mock)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={noticeAudience}
                onChange={(e) => setNoticeAudience(e.target.value)}
                placeholder="Audience (e.g. HSC 27 Batch / All Active Students)"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
              />
            </div>
            <textarea
              rows={2}
              required
              value={noticeMessage}
              onChange={(e) => setNoticeMessage(e.target.value)}
              placeholder="Write instructions, homework reminder, or live class agenda..."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={noticeBusy}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                {noticeBusy ? 'Broadcasting...' : 'Publish Notice'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-7">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student by name, roll number, email, or phone..."
              aria-label="Search teacher student roster"
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-xs"
            />
          </div>
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            aria-label="Filter roster by course"
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold sm:col-span-5"
          >
            <option value="all">All Enrolled Students</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 overflow-x-auto">
          {roster.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No students match the selected course or search query.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500">
                  <th className="py-2.5 pr-4">Student</th>
                  <th className="py-2.5 pr-4">Courses</th>
                  <th className="py-2.5 pr-4">Lesson Progress</th>
                  <th className="py-2.5 pr-4">Exam Avg</th>
                  <th className="py-2.5 pr-4">XP &amp; Attendance</th>
                  <th className="py-2.5">Coach Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((row) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-4">
                      <p className="font-bold text-slate-900">{row.name}</p>
                      <p className="font-mono-tabular text-[11px] text-slate-500">
                        {row.rollNumber} · {row.phone}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-slate-700">
                      {row.enrolledCoursesCount === 0 ? (
                        <span className="text-slate-400">No active course</span>
                      ) : (
                        <span className="line-clamp-2 max-w-[210px]">
                          {row.courseTitles.join(', ')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${row.avgLessonProgress}%` }}
                          />
                        </div>
                        <span className="font-mono-tabular text-xs font-bold text-slate-700">
                          {row.avgLessonProgress}%
                        </span>
                      </div>
                    </td>
                    <td className="font-mono-tabular py-3 pr-4 text-xs font-bold text-slate-800">
                      {row.examsTaken > 0 ? `${row.avgExamPercent}% (${row.examsTaken})` : 'No exams'}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <div className="flex items-center gap-2 font-bold text-amber-700">
                        <Award className="h-3.5 w-3.5" />
                        <span className="font-mono-tabular">{row.xp} XP</span>
                        <span className="inline-flex items-center gap-0.5 text-orange-600">
                          <Flame className="h-3 w-3" /> {row.streakDays}d
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Present: {row.presentCount} · Absent: {row.absentCount}
                      </p>
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setAwardTarget({ id: row.studentId, name: row.name });
                          setXpDelta(25);
                        }}
                        aria-label={`Award XP to ${row.name}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Award XP</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Award XP Modal */}
      {awardTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Award Student XP"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
        >
          <form
            onSubmit={handleAwardXp}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold">
                Award Bonus XP to {awardTarget.name}
              </h3>
              <button
                type="button"
                onClick={() => setAwardTarget(null)}
                aria-label="Close XP award modal"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="xp-amount" className="block text-xs font-bold text-slate-700">
                  Bonus XP Amount (5 – 200)
                </label>
                <input
                  id="xp-amount"
                  type="number"
                  min={5}
                  max={200}
                  value={xpDelta}
                  onChange={(e) => setXpDelta(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="xp-reason" className="block text-xs font-bold text-slate-700">
                  Coaching Note / Reason
                </label>
                <input
                  id="xp-reason"
                  type="text"
                  required
                  value={xpReason}
                  onChange={(e) => setXpReason(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAwardTarget(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={awardBusy}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
              >
                {awardBusy ? 'Awarding...' : `Award +${xpDelta} XP`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
 * EXAM SUBMISSIONS & TEACHER GRADING MODAL
 * ========================================================================== */
interface ExamSubmissionsModalProps {
  exam: Exam;
  attempts: ExamAttempt[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function ExamSubmissionsModal({
  exam,
  attempts,
  onClose,
  onRefresh,
  onNotify,
}: ExamSubmissionsModalProps) {
  const { apiFetch } = useAuth();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState<number>(0);
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const startEdit = (att: ExamAttempt) => {
    setEditingId(att.id);
    setScoreInput(att.score);
    setFeedbackInput(att.teacherFeedback || '');
  };

  const handleSaveGrade = async (e: React.FormEvent, att: ExamAttempt) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/portal/exam-attempts/${att.id}/grade`, {
        method: 'PATCH',
        body: JSON.stringify({
          score: scoreInput,
          teacherFeedback: feedbackInput,
        }),
      });
      setEditingId(null);
      await onRefresh();
      onNotify(`Updated grade & feedback for ${att.studentName}.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not update grade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Exam submissions for ${exam.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-indigo-600" />
              <span>{exam.title} — Submissions ({attempts.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Review student scores, override written/bonus marks, and attach faculty feedback.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close exam submissions modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {attempts.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-500">
              No student submissions recorded for this exam yet.
            </p>
          ) : (
            attempts.map((att) => {
              const isEditing = editingId === att.id;
              return (
                <div key={att.id} className="rounded-2xl border border-slate-200 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{att.studentName}</p>
                      <p className="font-mono-tabular text-slate-500">
                        Roll: {att.rollNumber} · Submitted {new Date(att.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono-tabular rounded-lg px-2.5 py-1 font-extrabold ${
                          att.passed
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {att.score}/{att.totalMarks} ({att.percentage}% · {att.grade})
                      </span>
                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingId(null) : startEdit(att))}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        {isEditing ? 'Cancel' : 'Grade / Feedback'}
                      </button>
                    </div>
                  </div>

                  {att.teacherFeedback && !isEditing && (
                    <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-emerald-50/70 px-3 py-1.5 text-emerald-900">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>
                        <strong>{att.gradedBy || 'Faculty'}:</strong> {att.teacherFeedback}
                      </span>
                    </p>
                  )}

                  {isEditing && (
                    <form
                      onSubmit={(e) => void handleSaveGrade(e, att)}
                      className="mt-3 space-y-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <label className="block font-bold text-slate-700">
                            Adjusted Score (Max {att.totalMarks})
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={att.totalMarks}
                            value={scoreInput}
                            onChange={(e) => setScoreInput(Number(e.target.value))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono-tabular"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block font-bold text-slate-700">
                            Teacher Feedback / Written Remarks
                          </label>
                          <input
                            type="text"
                            value={feedbackInput}
                            onChange={(e) => setFeedbackInput(e.target.value)}
                            placeholder="Great grammar accuracy — revise modifier rules."
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-lg bg-indigo-600 px-4 py-1.5 font-bold text-white hover:bg-indigo-700"
                        >
                          {saving ? 'Saving...' : 'Save Grade & Feedback'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
