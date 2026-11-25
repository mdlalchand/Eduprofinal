import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Megaphone,
  MessageSquare,
  Mic,
  Plus,
  Printer,
  Receipt,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  computeFeeInvoiceTotals,
  computeFeeLedgerSummary,
  isAdminRole,
} from '../lib/domain';
import type {
  Assignment,
  AssignmentSubmission,
  CertificateTemplate,
  Course,
  Exam,
  ExamAttempt,
  GuardianTeacherMessage,
  IssuedCertificate,
  NoticeItem,
  PaymentGatewayType,
  SpeakingSubmission,
  StudentFeeInvoice,
  User,
  UserRole,
} from '../types';

/* ==================== 1. ASSIGNMENTS & PHONETICS SPEAKING REVIEW ==================== */

interface AssignmentsAndSpeakingPanelProps {
  user: User;
  courses: Course[];
  onNotify: (msg: string) => void;
  onNavigate: (path: string) => void;
}

export function AssignmentsAndSpeakingPanel({
  user,
  courses,
  onNotify,
  onNavigate,
}: AssignmentsAndSpeakingPanelProps) {
  const { apiFetch } = useAuth();
  const canTeach = isAdminRole(user.role) || user.role === 'teacher';

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [speakingSubs, setSpeakingSubs] = useState<SpeakingSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Assignment Form (Teacher/Admin)
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? 'crs-hsc-combo');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [maxMarks, setMaxMarks] = useState(25);
  const [allowLate, setAllowLate] = useState(true);

  // Student submission state
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({});
  const [fileMap, setFileMap] = useState<Record<string, { name: string; dataUrl: string }>>({});

  // Teacher grading drafts
  const [gradeDrafts, setGradeDrafts] = useState<Record<string, { marks: string; feedback: string }>>({});
  const [spkDrafts, setSpkDrafts] = useState<
    Record<string, { pron: string; flu: string; feedback: string }>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [asgRes, spkRes] = await Promise.all([
        apiFetch<{ assignments: Assignment[]; submissions: AssignmentSubmission[] }>('/api/assignments'),
        apiFetch<{ submissions: SpeakingSubmission[] }>('/api/speaking/submissions'),
      ]);
      setAssignments(asgRes.assignments);
      setSubmissions(asgRes.submissions);
      setSpeakingSubs(spkRes.submissions);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/portal/assignments', {
      method: 'POST',
      body: JSON.stringify({
        title,
        courseId,
        instructions,
        dueDate: new Date(dueDate).toISOString(),
        maxMarks,
        allowLateSubmission: allowLate,
      }),
    });
    setTitle('');
    setInstructions('');
    await loadData();
    onNotify('Assignment published & students notified.');
  };

  const handleFileAttach = (asgId: string, file: File | null) => {
    if (!file) return;
    if (file.size > 1.8 * 1024 * 1024) {
      onNotify('Attachment exceeds 1.8 MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFileMap((prev) => ({ ...prev, [asgId]: { name: file.name, dataUrl: reader.result as string } }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleStudentSubmit = async (asgId: string) => {
    const answerText = (answerMap[asgId] ?? '').trim();
    if (!answerText) {
      onNotify('Please write your assignment response before submitting.');
      return;
    }
    try {
      const file = fileMap[asgId];
      await apiFetch(`/api/assignments/${asgId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answerText,
          attachmentName: file?.name,
          attachmentDataUrl: file?.dataUrl,
        }),
      });
      setAnswerMap((prev) => ({ ...prev, [asgId]: '' }));
      await loadData();
      onNotify('Assignment submitted successfully.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Submission failed.');
    }
  };

  const handleGradeSubmission = async (subId: string) => {
    const draft = gradeDrafts[subId] ?? { marks: '20', feedback: 'Well-structured response.' };
    await apiFetch(`/api/portal/assignments/submissions/${subId}/grade`, {
      method: 'PATCH',
      body: JSON.stringify({ marks: Number(draft.marks) || 0, feedback: draft.feedback }),
    });
    await loadData();
    onNotify('Assignment graded and feedback delivered.');
  };

  const handleReviewSpeaking = async (spkId: string) => {
    const draft = spkDrafts[spkId] ?? { pron: '86', flu: '84', feedback: 'Clear vowel articulation.' };
    await apiFetch(`/api/portal/speaking/submissions/${spkId}/review`, {
      method: 'PATCH',
      body: JSON.stringify({
        pronunciationScore: Number(draft.pron) || 85,
        fluencyScore: Number(draft.flu) || 85,
        teacherFeedback: draft.feedback,
      }),
    });
    await loadData();
    onNotify('Speaking recording scored and feedback sent.');
  };

  return (
    <div className="space-y-6">
      {canTeach && (
        <form
          onSubmit={handleCreateAssignment}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Plus className="h-4 w-4 text-indigo-600" />
            <span>Create Course Assignment</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              required
              placeholder="Assignment Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold sm:col-span-2"
            />
            <select
              aria-label="Assignment Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input
              type="date"
              required
              aria-label="Submission Deadline"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <textarea
              rows={2}
              placeholder="Detailed assignment instructions..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="rounded-xl border border-slate-300 p-3 text-xs sm:col-span-3"
            />
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-600">
                Max Marks
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                />
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                />
                <span>Allow Late</span>
              </label>
            </div>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#062436] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0b3854]"
          >
            Publish Assignment
          </button>
        </form>
      )}

      {/* Assignments List */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">
            Assignments ({assignments.length})
          </h2>
          {user.role === 'student' && (
            <button
              type="button"
              onClick={() => onNavigate('/learn')}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open Phonetics Speaking Lab
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Loading assignments...</p>
        ) : assignments.length === 0 ? (
          <p className="text-xs text-slate-500">No active assignments assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {assignments.map((asg) => {
              const relatedSubs = submissions.filter((s) => s.assignmentId === asg.id);
              const mySub = relatedSubs.find((s) => s.studentId === user.id);
              return (
                <div key={asg.id} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{asg.title}</p>
                      <p className="text-xs text-slate-500">
                        {asg.courseTitle} · By {asg.teacherName} · Due{' '}
                        <span className="font-mono tabular-nums">{asg.dueDate.slice(0, 10)}</span> ·
                        Max <span className="font-mono tabular-nums">{asg.maxMarks}</span> Marks
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-600">
                      {relatedSubs.length} Submission{relatedSubs.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">{asg.instructions}</p>

                  {user.role === 'student' && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      {mySub ? (
                        <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
                          <p className="font-semibold text-slate-900">
                            Status: {mySub.status.toUpperCase()}
                            {mySub.marks !== undefined
                              ? ` · Score: ${mySub.marks}/${asg.maxMarks}`
                              : ''}
                          </p>
                          <p className="text-slate-600">Submitted: {mySub.answerText}</p>
                          {mySub.feedback && (
                            <p className="font-semibold text-emerald-700">
                              Teacher Feedback: {mySub.feedback}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <textarea
                            rows={2}
                            placeholder="Write your assignment answer here..."
                            value={answerMap[asg.id] ?? ''}
                            onChange={(e) =>
                              setAnswerMap((prev) => ({ ...prev, [asg.id]: e.target.value }))
                            }
                            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs"
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              <Upload className="h-3.5 w-3.5" />
                              <span>
                                {fileMap[asg.id]?.name ?? 'Attach File (Optional, max 1.8 MB)'}
                              </span>
                              <input
                                type="file"
                                className="sr-only"
                                onChange={(e) =>
                                  handleFileAttach(asg.id, e.target.files?.[0] ?? null)
                                }
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => void handleStudentSubmit(asg.id)}
                              className="rounded-xl bg-[#062436] px-4 py-1.5 text-xs font-semibold text-white"
                            >
                              Submit Assignment
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {canTeach && relatedSubs.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <p className="text-xs font-bold text-slate-700">Student Submissions</p>
                      {relatedSubs.map((sub) => {
                        const draft = gradeDrafts[sub.id] ?? {
                          marks: String(sub.marks ?? Math.round(asg.maxMarks * 0.85)),
                          feedback: sub.feedback ?? '',
                        };
                        return (
                          <div
                            key={sub.id}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-slate-900">
                                {sub.studentName} · {sub.rollNumber ?? sub.studentId} ·{' '}
                                <span
                                  className={
                                    sub.status === 'late'
                                      ? 'text-amber-700'
                                      : sub.status === 'graded'
                                        ? 'text-emerald-700'
                                        : 'text-indigo-700'
                                  }
                                >
                                  {sub.status.toUpperCase()}
                                </span>
                              </span>
                              {sub.attachmentDataUrl && (
                                <a
                                  href={sub.attachmentDataUrl}
                                  download={sub.attachmentName || 'submission-file'}
                                  className="font-semibold text-indigo-700 hover:underline"
                                >
                                  Download {sub.attachmentName}
                                </a>
                              )}
                            </div>
                            <p className="text-slate-700">{sub.answerText}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={asg.maxMarks}
                                aria-label={`Marks for ${sub.studentName}`}
                                value={draft.marks}
                                onChange={(e) =>
                                  setGradeDrafts((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...draft, marks: e.target.value },
                                  }))
                                }
                                className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Grading feedback..."
                                value={draft.feedback}
                                onChange={(e) =>
                                  setGradeDrafts((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...draft, feedback: e.target.value },
                                  }))
                                }
                                className="flex-1 min-w-[180px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => void handleGradeSubmission(sub.id)}
                                className="rounded-lg bg-emerald-600 px-3 py-1 font-semibold text-white hover:bg-emerald-700"
                              >
                                {sub.status === 'graded' ? 'Update Grade' : 'Save Grade'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Phonetics Private Speaking Recording Review */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Mic className="h-4 w-4 text-rose-600" />
            <span>Phonetics &amp; Private Speaking Reviews ({speakingSubs.length})</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('/learn')}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Record in Classroom
          </button>
        </div>
        {speakingSubs.length === 0 ? (
          <p className="text-xs text-slate-500">No private speaking recordings submitted yet.</p>
        ) : (
          <div className="space-y-3">
            {speakingSubs.map((spk) => {
              const draft = spkDrafts[spk.id] ?? {
                pron: String(spk.pronunciationScore ?? 85),
                flu: String(spk.fluencyScore ?? 84),
                feedback: spk.teacherFeedback ?? '',
              };
              return (
                <div key={spk.id} className="rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">
                      {spk.studentName} · {spk.lessonTitle}
                    </p>
                    <span className="font-mono tabular-nums font-semibold text-indigo-700">
                      {spk.durationSec}s · {spk.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-slate-600">Prompt: “{spk.promptText}”</p>
                  {spk.audioDataUrl && (
                    <audio controls src={spk.audioDataUrl} className="w-full max-w-md h-9" />
                  )}
                  {spk.status === 'reviewed' && (
                    <p className="font-semibold text-emerald-700">
                      Pronunciation: {spk.pronunciationScore}% · Fluency: {spk.fluencyScore}% ·{' '}
                      {spk.teacherFeedback} (Reviewed by {spk.reviewedBy})
                    </p>
                  )}
                  {canTeach && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Pronunciation
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.pron}
                          onChange={(e) =>
                            setSpkDrafts((prev) => ({
                              ...prev,
                              [spk.id]: { ...draft, pron: e.target.value },
                            }))
                          }
                          className="ml-1.5 w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <label className="text-[11px] font-semibold text-slate-600">
                        Fluency
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={draft.flu}
                          onChange={(e) =>
                            setSpkDrafts((prev) => ({
                              ...prev,
                              [spk.id]: { ...draft, flu: e.target.value },
                            }))
                          }
                          className="ml-1.5 w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="Phonetics feedback..."
                        value={draft.feedback}
                        onChange={(e) =>
                          setSpkDrafts((prev) => ({
                            ...prev,
                            [spk.id]: { ...draft, feedback: e.target.value },
                          }))
                        }
                        className="flex-1 min-w-[160px] rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void handleReviewSpeaking(spk.id)}
                        className="rounded-lg bg-[#062436] px-3 py-1.5 font-semibold text-white"
                      >
                        Save Review
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== 2. FEE COLLECTION, INSTALLMENTS, SCHOLARSHIPS & RECEIPTS ==================== */

interface FeeLedgerPanelProps {
  user: User;
  users: User[];
  onNotify: (msg: string) => void;
}

export function FeeLedgerPanel({ user, users, onNotify }: FeeLedgerPanelProps) {
  const { apiFetch } = useAuth();
  const canCreateInvoice =
    isAdminRole(user.role) ||
    user.role === 'branch_manager' ||
    user.role === 'accountant' ||
    user.role === 'staff';

  const [invoices, setInvoices] = useState<StudentFeeInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptModal, setReceiptModal] = useState<{
    invoice: StudentFeeInvoice;
    receiptNo?: string;
  } | null>(null);

  const students = users.filter((u) => u.role === 'student');
  const [studentId, setStudentId] = useState(students[0]?.id ?? 'u-student');
  const [feeType, setFeeType] = useState<StudentFeeInvoice['feeType']>('course');
  const [feeTitle, setFeeTitle] = useState('Monthly Tuition & Practice Fee');
  const [grossAmount, setGrossAmount] = useState(3500);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [scholarshipAmount, setScholarshipAmount] = useState(0);
  const [lateFee, setLateFee] = useState(0);
  const [initialPaid, setInitialPaid] = useState(0);
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));

  const [payAmountMap, setPayAmountMap] = useState<Record<string, string>>({});
  const [payGatewayMap, setPayGatewayMap] = useState<Record<string, PaymentGatewayType>>({});

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ invoices: StudentFeeInvoice[] }>('/api/portal/fees');
      setInvoices(res.invoices);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  const summary = computeFeeLedgerSummary(invoices);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/portal/fees', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          feeType,
          title: feeTitle,
          grossAmount,
          discountAmount,
          scholarshipAmount,
          lateFee,
          paidAmount: initialPaid,
          dueDate,
        }),
      });
      await loadInvoices();
      onNotify('Fee invoice generated and added to student ledger.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create fee invoice.');
    }
  };

  const handlePayInstallment = async (inv: StudentFeeInvoice) => {
    const calc = computeFeeInvoiceTotals(inv);
    const amount = Number(payAmountMap[inv.id] || calc.dueAmount || 500);
    const gateway = payGatewayMap[inv.id] ?? 'bKash';
    try {
      const res = await apiFetch<{ invoice: StudentFeeInvoice; receiptNo: string }>(
        `/api/portal/fees/${inv.id}/pay`,
        {
          method: 'POST',
          body: JSON.stringify({ amount, gateway }),
        }
      );
      await loadInvoices();
      setReceiptModal({ invoice: res.invoice, receiptNo: res.receiptNo });
      onNotify(`Payment ৳${amount} recorded (Receipt ${res.receiptNo}).`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Payment failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-500">Total Billed</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900">
            ৳{summary.totalBilled.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-[11px] font-semibold text-emerald-700">Collected</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-800">
            ৳{summary.totalCollected.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-[11px] font-semibold text-amber-700">Total Due</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-800">
            ৳{summary.totalDue.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-500">Scholarships</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-indigo-700">
            ৳{summary.totalScholarship.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold text-slate-500">Advance Credits</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-sky-700">
            ৳{summary.totalAdvance.toLocaleString()}
          </p>
        </div>
      </div>

      {canCreateInvoice && students.length > 0 && (
        <form
          onSubmit={handleCreateInvoice}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h2 className="text-lg font-bold text-slate-900">
            Generate Student Fee Invoice (Admission / Tuition / Batch / Exam)
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              aria-label="Select Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rollNumber || s.email})
                </option>
              ))}
            </select>
            <select
              aria-label="Fee Type"
              value={feeType}
              onChange={(e) => setFeeType(e.target.value as StudentFeeInvoice['feeType'])}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
            >
              <option value="admission">Admission Fee</option>
              <option value="course">Course Fee</option>
              <option value="batch">Batch Fee</option>
              <option value="exam">Exam Fee</option>
            </select>
            <input
              type="text"
              required
              placeholder="Invoice Title"
              value={feeTitle}
              onChange={(e) => setFeeTitle(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold sm:col-span-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <label className="text-[11px] font-semibold text-slate-600">
              Gross ৳
              <input
                type="number"
                value={grossAmount}
                onChange={(e) => setGrossAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Discount ৳
              <input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Scholarship ৳
              <input
                type="number"
                value={scholarshipAmount}
                onChange={(e) => setScholarshipAmount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Late Fee ৳
              <input
                type="number"
                value={lateFee}
                onChange={(e) => setLateFee(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Initial Paid ৳
              <input
                type="number"
                value={initialPaid}
                onChange={(e) => setInitialPaid(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </label>
            <label className="text-[11px] font-semibold text-slate-600">
              Due Date
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </label>
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#062436] px-5 py-2 text-xs font-semibold text-white"
          >
            Issue Fee Invoice
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Receipt className="h-4 w-4 text-indigo-600" />
          <span>Student Fee Ledger &amp; Installments ({invoices.length})</span>
        </h2>

        {loading ? (
          <p className="text-xs text-slate-500">Loading ledger...</p>
        ) : invoices.length === 0 ? (
          <p className="text-xs text-slate-500">No fee invoices found.</p>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv) => {
              const calc = computeFeeInvoiceTotals(inv);
              return (
                <div key={inv.id} className="rounded-xl border border-slate-200 p-4 text-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">
                        {inv.title} · {inv.studentName}
                      </p>
                      <p className="font-mono tabular-nums text-slate-500">
                        {inv.invoiceNo} · {inv.feeType.toUpperCase()} · Due {inv.dueDate.slice(0, 10)}
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <p className="font-bold text-slate-900">
                        Net: ৳{calc.netPayable.toLocaleString()} · Paid: ৳{inv.paidAmount.toLocaleString()}
                      </p>
                      <p
                        className={`font-semibold ${
                          calc.dueAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {calc.dueAmount > 0
                          ? `Due: ৳${calc.dueAmount.toLocaleString()}`
                          : calc.advanceAmount > 0
                            ? `Advance: ৳${calc.advanceAmount.toLocaleString()}`
                            : 'Fully Paid'}
                      </p>
                    </div>
                  </div>

                  {inv.installments.length > 0 && (
                    <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600 space-y-1">
                      {inv.installments.map((inst) => (
                        <div key={inst.id} className="flex items-center justify-between">
                          <span>
                            {inst.receiptNo} · {inst.gateway} ({inst.trxId})
                          </span>
                          <span className="font-mono tabular-nums font-semibold">
                            ৳{inst.amount.toLocaleString()} · {inst.paidAt.slice(0, 10)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => setReceiptModal({ invoice: inv })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>View / Print Receipt</span>
                    </button>

                    {calc.dueAmount > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          placeholder={String(calc.dueAmount)}
                          value={payAmountMap[inv.id] ?? String(calc.dueAmount)}
                          onChange={(e) =>
                            setPayAmountMap((prev) => ({ ...prev, [inv.id]: e.target.value }))
                          }
                          aria-label={`Installment amount for ${inv.invoiceNo}`}
                          className="w-24 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-mono tabular-nums"
                        />
                        <select
                          aria-label={`Payment gateway for ${inv.invoiceNo}`}
                          value={payGatewayMap[inv.id] ?? 'bKash'}
                          onChange={(e) =>
                            setPayGatewayMap((prev) => ({
                              ...prev,
                              [inv.id]: e.target.value as PaymentGatewayType,
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        >
                          <option value="bKash">bKash</option>
                          <option value="Nagad">Nagad</option>
                          <option value="Rocket">Rocket</option>
                          <option value="SSLCommerz Card">SSLCommerz Card</option>
                          <option value="Branch Cash">Branch Cash</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void handlePayInstallment(inv)}
                          className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-semibold text-white hover:bg-emerald-700"
                        >
                          Record Payment
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {receiptModal && (
        <div
          role="dialog"
          aria-label="Fee Payment Receipt"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <p className="text-xs font-semibold text-indigo-700">
                Aloms English Center · Official Payment Receipt
              </p>
              <h3 className="text-lg font-bold text-slate-900">
                {receiptModal.invoice.studentName}
              </h3>
              <p className="font-mono text-xs text-slate-500">
                Invoice: {receiptModal.invoice.invoiceNo}
                {receiptModal.receiptNo ? ` · Receipt: ${receiptModal.receiptNo}` : ''}
              </p>
            </div>
            <div className="space-y-1.5 font-mono text-xs tabular-nums">
              <div className="flex justify-between">
                <span>Gross Fee</span>
                <span>৳{receiptModal.invoice.grossAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Discount &amp; Scholarship</span>
                <span>
                  -৳
                  {(
                    receiptModal.invoice.discountAmount + receiptModal.invoice.scholarshipAmount
                  ).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Late Fee</span>
                <span>+৳{receiptModal.invoice.lateFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                <span>Total Paid</span>
                <span>৳{receiptModal.invoice.paidAmount.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-[#062436] px-4 py-1.5 text-xs font-semibold text-white"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 3. CERTIFICATES, TEMPLATES & PUBLIC VERIFICATION ==================== */

interface CertificatesPanelProps {
  user: User;
  users: User[];
  courses: Course[];
  onNotify: (msg: string) => void;
}

export function CertificatesPanel({ user, users, courses, onNotify }: CertificatesPanelProps) {
  const { apiFetch } = useAuth();
  const canIssue = isAdminRole(user.role) || user.role === 'teacher' || user.role === 'branch_manager';
  const students = users.filter((u) => u.role === 'student');

  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [studentId, setStudentId] = useState(students[0]?.id ?? 'u-student');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? 'crs-hsc-combo');
  const [grade, setGrade] = useState('A+ (92%)');
  const [previewCert, setPreviewCert] = useState<IssuedCertificate | null>(null);

  const [tplHeader, setTplHeader] = useState('Certificate of Academic Excellence');
  const [tplSignatory, setTplSignatory] = useState('Md. Alomgir Hossain');

  const loadCerts = useCallback(async () => {
    try {
      const res = await apiFetch<{
        certificates: IssuedCertificate[];
        templates: CertificateTemplate[];
      }>('/api/certificates');
      setCertificates(res.certificates);
      setTemplates(res.templates);
      if (res.templates[0]) {
        setTplHeader(res.templates[0].headerTitle);
        setTplSignatory(res.templates[0].signatoryName);
      }
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadCerts();
  }, [loadCerts]);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ certificate: IssuedCertificate }>('/api/portal/certificates/issue', {
      method: 'POST',
      body: JSON.stringify({ studentId, courseId, grade }),
    });
    await loadCerts();
    onNotify(`Certificate ${res.certificate.certificateNumber} issued.`);
  };

  const handleToggleRevoke = async (cert: IssuedCertificate) => {
    await apiFetch(`/api/portal/certificates/${cert.id}/revoke`, {
      method: 'PATCH',
      body: JSON.stringify({ revoked: !cert.revoked }),
    });
    await loadCerts();
    onNotify(
      `Certificate ${cert.certificateNumber} ${!cert.revoked ? 'revoked' : 'reinstated'}.`
    );
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/portal/certificate-templates', {
      method: 'PUT',
      body: JSON.stringify({ headerTitle: tplHeader, signatoryName: tplSignatory }),
    });
    await loadCerts();
    onNotify('Certificate template updated.');
  };

  const activeTpl = templates[0];

  return (
    <div className="space-y-6">
      {canIssue && students.length > 0 && (
        <form
          onSubmit={handleIssue}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Award className="h-4 w-4 text-amber-600" />
            <span>Issue Verified Academic Certificate</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              aria-label="Certificate Student"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.rollNumber || s.email})
                </option>
              ))}
            </select>
            <select
              aria-label="Certificate Course"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold sm:col-span-2"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Grade (e.g. A+)"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-[#062436] px-5 py-2 text-xs font-semibold text-white"
          >
            Generate &amp; Issue Certificate
          </button>
        </form>
      )}

      {isAdminRole(user.role) && (
        <form
          onSubmit={handleSaveTemplate}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
        >
          <h3 className="text-sm font-bold text-slate-900">Certificate Template Designer</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={tplHeader}
              onChange={(e) => setTplHeader(e.target.value)}
              placeholder="Certificate Header Title"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={tplSignatory}
              onChange={(e) => setTplSignatory(e.target.value)}
              placeholder="Authorized Signatory Name"
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100"
          >
            Save Template Branding
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">
          Issued Certificates ({certificates.length})
        </h2>
        {certificates.length === 0 ? (
          <p className="text-xs text-slate-500">No certificates issued yet.</p>
        ) : (
          certificates.map((cert) => (
            <div
              key={cert.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 text-xs"
            >
              <div>
                <p className="font-bold text-slate-900">
                  {cert.studentName} · {cert.courseTitle}
                </p>
                <p className="font-mono text-slate-500">
                  Serial: {cert.certificateNumber} · Grade: {cert.grade} · Branch: {cert.branchName}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-semibold ${
                    cert.revoked ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {cert.revoked ? 'REVOKED' : 'VERIFIED'}
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewCert(cert)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Preview / Print</span>
                </button>
                {isAdminRole(user.role) && (
                  <button
                    type="button"
                    onClick={() => void handleToggleRevoke(cert)}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    {cert.revoked ? 'Reinstate' : 'Revoke'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {previewCert && (
        <div
          role="dialog"
          aria-label="Printable Certificate"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <div className="w-full max-w-xl rounded-2xl border-4 border-[#062436] bg-white p-8 text-center shadow-2xl space-y-4">
            <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Aloms English Center
            </p>
            <h3 className="text-2xl font-bold text-[#062436]">
              {activeTpl?.headerTitle ?? 'Certificate of Academic Excellence'}
            </h3>
            <p className="text-xs text-slate-600">This certifies that</p>
            <p className="text-2xl font-bold text-slate-900">{previewCert.studentName}</p>
            <p className="text-sm text-slate-700">
              has successfully completed <strong>{previewCert.courseTitle}</strong> with Grade{' '}
              <strong>{previewCert.grade}</strong> ({previewCert.branchName}).
            </p>
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-600">
              <div className="text-left">
                <p className="font-mono font-bold text-slate-900">
                  {previewCert.certificateNumber}
                </p>
                <p>Verify at /board-result</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900">
                  {activeTpl?.signatoryName ?? 'Md. Alomgir Hossain'}
                </p>
                <p>{activeTpl?.signatoryTitle ?? 'Principal & Academic Director'}</p>
              </div>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewCert(null)}
                className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-[#062436] px-4 py-1.5 text-xs font-semibold text-white"
              >
                Print Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== 4. NOTICES & GUARDIAN-TEACHER COMMUNICATION ==================== */

interface NoticesAndMessagesPanelProps {
  user: User;
  childrenData?: { student: User }[];
  teachers?: User[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function NoticesAndMessagesPanel({
  user,
  childrenData = [],
  teachers = [],
  onRefresh,
  onNotify,
}: NoticesAndMessagesPanelProps) {
  const { apiFetch } = useAuth();
  const canPostNotice =
    isAdminRole(user.role) || user.role === 'branch_manager' || user.role === 'teacher';

  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [messages, setMessages] = useState<GuardianTeacherMessage[]>([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeRole, setNoticeRole] = useState<UserRole | 'all'>('all');

  const [childRollCode, setChildRollCode] = useState('');
  const [msgStudentId, setMsgStudentId] = useState(childrenData[0]?.student.id ?? 'u-student');
  const [msgTeacherId, setMsgTeacherId] = useState(teachers[0]?.id ?? 'u-teacher');
  const [msgText, setMsgText] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [nRes, mRes] = await Promise.all([
        apiFetch<{ notices: NoticeItem[] }>('/api/notifications'),
        apiFetch<{ messages: GuardianTeacherMessage[] }>('/api/guardian-messages'),
      ]);
      setNotices(nRes.notices);
      setMessages(mRes.messages);
    } catch {
      // ignore
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/portal/notices', {
      method: 'POST',
      body: JSON.stringify({ title: noticeTitle, body: noticeBody, targetRole: noticeRole }),
    });
    setNoticeTitle('');
    setNoticeBody('');
    await loadAll();
    onNotify('Official notice published.');
  };

  const handleDeleteNotice = async (id: string) => {
    await apiFetch(`/api/portal/notices/${id}`, { method: 'DELETE' });
    await loadAll();
    onNotify('Notice deleted.');
  };

  const handleLinkChild = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ linkedStudent: User }>('/api/guardian/link-child', {
        method: 'POST',
        body: JSON.stringify({ rollOrCode: childRollCode }),
      });
      setChildRollCode('');
      await onRefresh();
      onNotify(`Linked student ${res.linkedStudent.name} to Guardian portal.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not link child.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim()) return;
    await apiFetch('/api/guardian-messages', {
      method: 'POST',
      body: JSON.stringify({
        studentId: msgStudentId,
        teacherId: msgTeacherId,
        message: msgText.trim(),
      }),
    });
    setMsgText('');
    await loadAll();
    onNotify('Message sent.');
  };

  return (
    <div className="space-y-6">
      {canPostNotice && (
        <form
          onSubmit={handlePostNotice}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
        >
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Megaphone className="h-4 w-4 text-indigo-600" />
            <span>Publish Campus / Portal Notice</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              required
              placeholder="Notice Title"
              value={noticeTitle}
              onChange={(e) => setNoticeTitle(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold sm:col-span-2"
            />
            <select
              aria-label="Target Audience"
              value={noticeRole}
              onChange={(e) => setNoticeRole(e.target.value as UserRole | 'all')}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
            >
              <option value="all">All Portal Users</option>
              <option value="student">Students Only</option>
              <option value="guardian">Guardians Only</option>
              <option value="teacher">Teachers Only</option>
            </select>
          </div>
          <textarea
            rows={2}
            required
            placeholder="Write announcement details..."
            value={noticeBody}
            onChange={(e) => setNoticeBody(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-3 text-xs"
          />
          <button
            type="submit"
            className="rounded-xl bg-[#062436] px-5 py-2 text-xs font-semibold text-white"
          >
            Publish Notice
          </button>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Official Notice Board ({notices.length})</h2>
        {notices.length === 0 ? (
          <p className="text-xs text-slate-500">No active notices right now.</p>
        ) : (
          notices.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs"
            >
              <div>
                <p className="font-bold text-slate-900">{n.title}</p>
                <p className="mt-1 text-slate-700">{n.body}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  By {n.createdBy} · Audience: {n.targetRole} · {n.createdAt.slice(0, 10)}
                </p>
              </div>
              {isAdminRole(user.role) && (
                <button
                  type="button"
                  onClick={() => void handleDeleteNotice(n.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {user.role === 'guardian' && (
        <form
          onSubmit={handleLinkChild}
          className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3"
        >
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <UserPlus className="h-4 w-4 text-emerald-600" />
            <span>Link Additional Child (Branch-Safe Roll Verification)</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              required
              placeholder="Enter Student Roll or Code (e.g. AEC-2701)"
              value={childRollCode}
              onChange={(e) => setChildRollCode(e.target.value)}
              className="flex-1 min-w-[220px] rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Link Child
            </button>
          </div>
        </form>
      )}

      {(user.role === 'guardian' || user.role === 'teacher' || isAdminRole(user.role)) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <MessageSquare className="h-4 w-4 text-sky-600" />
            <span>Guardian–Teacher Direct Communication</span>
          </h2>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {messages.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs"
              >
                <p className="font-semibold text-slate-900">
                  {m.senderRole === 'guardian' ? m.guardianName : m.teacherName} ({m.senderRole}) ·
                  Re: {m.studentName}
                </p>
                <p className="mt-0.5 text-slate-700">{m.message}</p>
              </div>
            ))}
          </div>
          <form onSubmit={handleSendMessage} className="flex flex-wrap gap-2">
            {childrenData.length > 0 && (
              <select
                aria-label="Child Student"
                value={msgStudentId}
                onChange={(e) => setMsgStudentId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                {childrenData.map((ch) => (
                  <option key={ch.student.id} value={ch.student.id}>
                    {ch.student.name}
                  </option>
                ))}
              </select>
            )}
            {teachers.length > 0 && (
              <select
                aria-label="Select Teacher"
                value={msgTeacherId}
                onChange={(e) => setMsgTeacherId(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              required
              placeholder="Write a message to teacher / guardian..."
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-xl bg-[#062436] px-4 py-2 text-xs font-semibold text-white"
            >
              <Send className="h-3.5 w-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/* ==================== 5. TEACHER MANUAL EXAM EVALUATION & PUBLISH QUEUE ==================== */

interface TeacherManualExamQueueProps {
  exams: Exam[];
  attempts: ExamAttempt[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export function TeacherManualExamQueue({
  exams,
  attempts,
  onRefresh,
  onNotify,
}: TeacherManualExamQueueProps) {
  const { apiFetch } = useAuth();
  const [scoresByAttempt, setScoresByAttempt] = useState<Record<string, Record<string, number>>>({});
  const [feedbackByAttempt, setFeedbackByAttempt] = useState<Record<string, string>>({});

  const togglePublish = async (ex: Exam) => {
    const next = ex.published === false;
    await apiFetch(`/api/portal/exams/${ex.id}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ published: next }),
    });
    await onRefresh();
    onNotify(`Exam "${ex.title}" ${next ? 'published' : 'hidden from students'}.`);
  };

  const evaluateAttempt = async (att: ExamAttempt) => {
    const manualScores = scoresByAttempt[att.id] ?? att.manualScores ?? {};
    const teacherFeedback = feedbackByAttempt[att.id] ?? att.teacherFeedback ?? 'Evaluated by faculty.';
    await apiFetch(`/api/portal/exams/attempts/${att.id}/evaluate`, {
      method: 'PATCH',
      body: JSON.stringify({ manualScores, teacherFeedback }),
    });
    await onRefresh();
    onNotify(`Evaluated attempt for ${att.studentName}.`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <FileText className="h-4 w-4 text-indigo-600" />
          <span>Result &amp; Exam Publication Control</span>
        </h3>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {exams.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
            >
              <div>
                <p className="font-semibold text-slate-900">{ex.title}</p>
                <p className="text-slate-500">
                  {ex.published !== false ? 'Published to Students' : 'Draft / Results Withheld'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void togglePublish(ex)}
                className={`rounded-lg px-3 py-1.5 font-semibold ${
                  ex.published !== false
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {ex.published !== false ? 'Published' : 'Publish Now'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          <span>Exam Attempts &amp; Written Script Evaluation ({attempts.length})</span>
        </h3>
        {attempts.length === 0 ? (
          <p className="text-xs text-slate-500">No student exam attempts submitted yet.</p>
        ) : (
          attempts.map((att) => {
            const parentExam = exams.find((e) => e.id === att.examId);
            const writtenQs = (parentExam?.questions ?? []).filter((q) => q.type === 'written');
            return (
              <div key={att.id} className="rounded-xl border border-slate-200 p-4 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">
                    {att.studentName} ({att.rollNumber}) · {att.examTitle}
                  </p>
                  <span className="font-mono tabular-nums font-bold text-indigo-700">
                    {att.score}/{att.totalMarks} ({att.grade}) ·{' '}
                    {(att.evaluationStatus ?? 'auto_graded').replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                {writtenQs.length > 0 && (
                  <div className="space-y-2 rounded-xl bg-slate-50 p-3">
                    {writtenQs.map((q) => (
                      <div key={q.id} className="space-y-1">
                        <p className="font-semibold text-slate-800">
                          Written Q: {q.prompt} (Max {q.marks})
                        </p>
                        <p className="text-slate-600">
                          Answer: {att.writtenAnswers?.[q.id] || 'No written text provided.'}
                        </p>
                        <input
                          type="number"
                          min={0}
                          max={q.marks}
                          placeholder={`Score (0-${q.marks})`}
                          value={scoresByAttempt[att.id]?.[q.id] ?? att.manualScores?.[q.id] ?? 0}
                          onChange={(e) =>
                            setScoresByAttempt((prev) => ({
                              ...prev,
                              [att.id]: {
                                ...(prev[att.id] ?? {}),
                                [q.id]: Number(e.target.value),
                              },
                            }))
                          }
                          className="w-28 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                        />
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Evaluator feedback..."
                        value={feedbackByAttempt[att.id] ?? att.teacherFeedback ?? ''}
                        onChange={(e) =>
                          setFeedbackByAttempt((prev) => ({ ...prev, [att.id]: e.target.value }))
                        }
                        className="flex-1 min-w-[180px] rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void evaluateAttempt(att)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Finalize Grade</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
