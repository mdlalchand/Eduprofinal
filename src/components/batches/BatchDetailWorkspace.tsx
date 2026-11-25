import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRightLeft,
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  Download,
  FileText,
  Layers,
  Megaphone,
  Pencil,
  Plus,
  Printer,
  Settings,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  BATCH_LIFECYCLE_LABELS,
  BATCH_WEEK_DAYS,
  computeBatchDashboardAnalytics,
  normalizeBatchLifecycle,
} from '../../lib/batchEnterprise';
import type {
  AssignmentSubmission,
  AttendanceRecord,
  BatchActivityLog,
  BatchLifecycleStatus,
  BatchNotification,
  BatchScheduleSlot,
  BatchTeacherAssignment,
  BatchTransferRecord,
  BatchWaitlistEntry,
  BatchWeekDay,
  Branch,
  Course,
  CourseAnnouncement,
  CourseAssignment,
  CourseBatch,
  Enrollment,
  Exam,
  ExamAttempt,
  Instructor,
  PaymentTransaction,
  User,
  UserRole,
} from '../../types';

interface BatchDetailWorkspaceProps {
  batchId: string;
  courses: Course[];
  allBatches: CourseBatch[];
  branches: Branch[];
  instructors: Instructor[];
  userRole: UserRole;
  darkMode?: boolean;
  onBack: () => void;
  onOpenWizard: (batch: CourseBatch) => void;
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

interface BatchDetailPayload {
  batch: CourseBatch;
  course: Course | null;
  branch: Branch | null;
  capacity: {
    seatLimit: number;
    enrolledSeats: number;
    remainingSeats: number;
    fillPercent: number;
    isFull: boolean;
    waitlistCount: number;
    belowMinimum: boolean;
    minStudents: number;
  };
  slots: BatchScheduleSlot[];
  enrollments: Enrollment[];
  waitlist: BatchWaitlistEntry[];
  transfers: BatchTransferRecord[];
  teachers: Instructor[];
  teacherWorkload: {
    instructorId: string;
    name: string;
    subject: string;
    activeBatchesCount: number;
    weeklyClasses: number;
  }[];
  attendanceRecords: AttendanceRecord[];
  payments: PaymentTransaction[];
  exams: Exam[];
  examAttempts: ExamAttempt[];
  assignments: CourseAssignment[];
  submissions: AssignmentSubmission[];
  announcements: CourseAnnouncement[];
  activityLogs: BatchActivityLog[];
  notifications: BatchNotification[];
  eligibleStudents: User[];
}

type DetailTab =
  | 'overview'
  | 'students'
  | 'teachers'
  | 'routine'
  | 'attendance'
  | 'exams'
  | 'assignments'
  | 'payments'
  | 'announcements'
  | 'reports'
  | 'logs'
  | 'settings';

const DETAIL_TABS: { id: DetailTab; label: string; icon: typeof Layers }[] = [
  { id: 'overview', label: '1. Overview', icon: Layers },
  { id: 'students', label: '2. Students', icon: Users },
  { id: 'teachers', label: '3. Teachers', icon: BookOpen },
  { id: 'routine', label: '4. Routine', icon: CalendarClock },
  { id: 'attendance', label: '5. Attendance', icon: ClipboardCheck },
  { id: 'exams', label: '6. Exams & Merit', icon: Award },
  { id: 'assignments', label: '7. Assignments', icon: FileText },
  { id: 'payments', label: '8. Payments', icon: CreditCard },
  { id: 'announcements', label: '9. Notices', icon: Megaphone },
  { id: 'reports', label: '10. Reports', icon: BarChart3 },
  { id: 'logs', label: '11. Logs', icon: Activity },
  { id: 'settings', label: '12. Settings', icon: Settings },
];

type ReportKind =
  | 'enrollment'
  | 'capacity'
  | 'attendance'
  | 'teacher_perf'
  | 'student_perf'
  | 'payment_collection'
  | 'course_completion'
  | 'batch_comparison';

export function BatchDetailWorkspace({
  batchId,
  courses,
  allBatches,
  instructors,
  userRole,
  darkMode = false,
  onBack,
  onOpenWizard,
  onRefresh,
  onNotify,
}: BatchDetailWorkspaceProps) {
  const { apiFetch, token } = useAuth();
  const canAdminManage = userRole === 'admin';

  const [detail, setDetail] = useState<BatchDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');

  // Student tab state
  const [enrollStudentId, setEnrollStudentId] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [waitlistStudentId, setWaitlistStudentId] = useState('');
  const [transferEnrollment, setTransferEnrollment] = useState<Enrollment | null>(null);
  const [transferTargetBatchId, setTransferTargetBatchId] = useState('');
  const [transferReason, setTransferReason] = useState('Preferred schedule / branch shift');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  // Teachers tab state
  const [mainTeacherId, setMainTeacherId] = useState('');
  const [assistantTeacherId, setAssistantTeacherId] = useState('');
  const [teacherRespNote, setTeacherRespNote] = useState('Lead Instruction & Assessment');

  // Routine tab state
  const [routineView, setRoutineView] = useState<'weekly' | 'monthly' | 'daily'>('weekly');
  const [slotTitle, setSlotTitle] = useState('Grammar & Practice Session');
  const [slotDay, setSlotDay] = useState<BatchWeekDay>('Mon');
  const [slotStart, setSlotStart] = useState('17:00');
  const [slotEnd, setSlotEnd] = useState('18:30');
  const [slotRoom, setSlotRoom] = useState('');

  // Attendance tab state
  const [attDate, setAttDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attDrafts, setAttDrafts] = useState<Record<string, { status: string; notes: string }>>({});

  // Announcements tab state
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annPinned, setAnnPinned] = useState(false);

  // Reports tab state
  const [activeReport, setActiveReport] = useState<ReportKind>('enrollment');

  // Settings tab state
  const [nextLifecycle, setNextLifecycle] = useState<BatchLifecycleStatus>('active');
  const [deleteErrorInfo, setDeleteErrorInfo] = useState<{
    message: string;
    suggestArchive?: boolean;
  } | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<BatchDetailPayload>(`/api/portal/batches/${batchId}/detail`);
      setDetail(res);
      setMainTeacherId(res.batch.instructorId);
      setAssistantTeacherId(res.batch.assistantInstructorId || '');
      setSlotRoom(res.batch.classroom?.roomNumber || res.batch.classroomOrMeeting || '');
      setNextLifecycle(normalizeBatchLifecycle(res.batch));
      if (res.eligibleStudents.length > 0) {
        const firstId = res.eligibleStudents[0].id;
        setEnrollStudentId((prev) => prev || firstId);
        setWaitlistStudentId((prev) => prev || firstId);
      }
      const initialAtt: Record<string, { status: string; notes: string }> = {};
      for (const e of res.enrollments.filter((x) => x.status === 'approved')) {
        const existing = res.attendanceRecords.find(
          (a) => a.targetId === e.userId && a.date === attDate
        );
        initialAtt[e.userId] = {
          status: existing?.status || 'present',
          notes: existing?.notes || '',
        };
      }
      setAttDrafts(initialAtt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load batch workspace.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, batchId, attDate]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const clearAlerts = () => {
    setActionMsg(null);
    setActionErr(null);
  };

  const handleEnrollExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    const emails = bulkEmails
      .split(/[\n,;]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    try {
      const res = await apiFetch<{ enrolled: Enrollment[]; rejected: { studentName: string; reason: string }[] }>(
        `/api/portal/batches/${batchId}/students/enroll`,
        {
          method: 'POST',
          body: JSON.stringify(
            emails.length > 0 ? { emails } : { studentIds: enrollStudentId ? [enrollStudentId] : [] }
          ),
        }
      );
      setBulkEmails('');
      const msg = `Enrolled ${res.enrolled.length} student(s).${
        res.rejected.length > 0 ? ` Skipped ${res.rejected.length}: ${res.rejected[0].reason}` : ''
      }`;
      setActionMsg(msg);
      onNotify(msg);
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Enrollment failed.');
    }
  };

  const handleTransferStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferEnrollment || !transferTargetBatchId) return;
    clearAlerts();
    try {
      const res = await apiFetch<{
        transfer: BatchTransferRecord;
      }>(`/api/portal/batches/${batchId}/students/transfer`, {
        method: 'POST',
        body: JSON.stringify({
          enrollmentId: transferEnrollment.id,
          targetBatchId: transferTargetBatchId,
          reason: transferReason.trim() || 'Administrative transfer',
        }),
      });
      const msg = `Transferred ${res.transfer.studentName} to "${res.transfer.toBatchName}" (Preserved ${res.transfer.preservedAttendanceCount} attendance & ${res.transfer.preservedPaymentCount} payment records).`;
      setTransferEnrollment(null);
      setActionMsg(msg);
      onNotify(msg);
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Transfer failed.');
    }
  };

  const handleRemoveStudent = async (enrollmentId: string) => {
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/students/remove`, {
        method: 'POST',
        body: JSON.stringify({ enrollmentId }),
      });
      setActionMsg('Removed student from active roster (historical attendance & payments preserved).');
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Unable to remove student.');
    }
  };

  const handlePromoteStudent = async (enrollmentId: string) => {
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/students/promote`, {
        method: 'POST',
        body: JSON.stringify({ enrollmentId, note: 'Promoted on merit and attendance evaluation' }),
      });
      setActionMsg('Student promoted & recorded in enrollment history.');
      await loadDetail();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Promotion failed.');
    }
  };

  const handleAddWaitlist = async () => {
    if (!waitlistStudentId) return;
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/waitlist`, {
        method: 'POST',
        body: JSON.stringify({ studentId: waitlistStudentId }),
      });
      setActionMsg('Student added to batch waiting list.');
      await loadDetail();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Unable to add to waitlist.');
    }
  };

  const handlePromoteWaitlist = async (waitlistId: string) => {
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/waitlist/${waitlistId}/promote`, {
        method: 'POST',
      });
      setActionMsg('Promoted waiting list student into active batch roster.');
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Waitlist promotion failed.');
    }
  };

  const handleUpdateTeachers = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      const assignments: BatchTeacherAssignment[] = [
        {
          instructorId: mainTeacherId,
          role: 'main',
          responsibility: teacherRespNote.trim() || 'Main Instructor',
          assignedAt: new Date().toISOString(),
        },
        ...(assistantTeacherId && assistantTeacherId !== mainTeacherId
          ? [
              {
                instructorId: assistantTeacherId,
                role: 'assistant' as const,
                responsibility: 'Assistant Instructor & Lab Support',
                assignedAt: new Date().toISOString(),
              },
            ]
          : []),
      ];
      await apiFetch(`/api/portal/batches/${batchId}/teachers`, {
        method: 'POST',
        body: JSON.stringify({
          instructorId: mainTeacherId,
          assistantInstructorId: assistantTeacherId || null,
          teacherAssignments: assignments,
        }),
      });
      setActionMsg('Teacher assignments updated & checked for schedule conflicts.');
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Failed to update teachers.');
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/schedules`, {
        method: 'POST',
        body: JSON.stringify({
          title: slotTitle.trim() || 'Class Session',
          dayOfWeek: slotDay,
          startTime: slotStart,
          endTime: slotEnd,
          roomLabel: slotRoom.trim(),
        }),
      });
      setActionMsg(`Added ${slotDay} ${slotStart}–${slotEnd} class slot.`);
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Schedule conflict or invalid slot.');
    }
  };

  const handleSlotStatus = async (slotId: string, status: BatchScheduleSlot['status']) => {
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/schedules/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          cancelReason: status === 'cancelled' ? 'Cancelled by faculty/admin' : undefined,
        }),
      });
      setActionMsg(`Class slot marked as ${status}.`);
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Unable to update class slot.');
    }
  };

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    clearAlerts();
    const entries = detail.enrollments
      .filter((en) => en.status === 'approved')
      .map((en) => ({
        studentId: en.userId,
        status: attDrafts[en.userId]?.status || 'present',
        notes: attDrafts[en.userId]?.notes || '',
      }));
    if (entries.length === 0) {
      setActionErr('No approved students enrolled in this batch to mark attendance.');
      return;
    }
    try {
      const res = await apiFetch<{ count: number }>(`/api/portal/batches/${batchId}/attendance/bulk`, {
        method: 'POST',
        body: JSON.stringify({ date: attDate, entries }),
      });
      setActionMsg(`Saved attendance on ${attDate} for ${res.count} student(s).`);
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Attendance update failed.');
    }
  };

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/announcements`, {
        method: 'POST',
        body: JSON.stringify({
          title: annTitle.trim(),
          message: annMessage.trim(),
          pinned: annPinned,
        }),
      });
      setAnnTitle('');
      setAnnMessage('');
      setAnnPinned(false);
      setActionMsg('Announcement published and batch notification queued.');
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Failed to post announcement.');
    }
  };

  const handleSendPaymentReminder = async () => {
    clearAlerts();
    try {
      await apiFetch(`/api/portal/batches/${batchId}/notifications/remind`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'payment_reminder',
          title: `Fee Due Reminder — ${detail?.batch.name}`,
          message: `Please clear pending installment fees before ${
            detail?.batch.feeSettings?.paymentDeadline || 'the due date'
          }.`,
        }),
      });
      setActionMsg('In-app payment reminder dispatched to batch students.');
      await loadDetail();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Unable to send reminder.');
    }
  };

  const handleLifecycleUpdate = async (target: BatchLifecycleStatus) => {
    clearAlerts();
    setDeleteErrorInfo(null);
    try {
      await apiFetch(`/api/portal/batches/${batchId}/lifecycle`, {
        method: 'PATCH',
        body: JSON.stringify({ lifecycleStatus: target }),
      });
      setNextLifecycle(target);
      setActionMsg(`Batch lifecycle moved to "${BATCH_LIFECYCLE_LABELS[target]}".`);
      await Promise.all([loadDetail(), onRefresh()]);
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Lifecycle update failed.');
    }
  };

  const handleSafeDelete = async () => {
    clearAlerts();
    setDeleteErrorInfo(null);
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/portal/batches/${batchId}/safe`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });
      const json = (await res.json()) as { error?: string; suggestArchive?: boolean };
      if (!res.ok) {
        setDeleteErrorInfo({
          message: json.error || 'Safe delete blocked.',
          suggestArchive: json.suggestArchive,
        });
        return;
      }
      onNotify('Empty batch moved safely to Recycle Bin.');
      await onRefresh();
      onBack();
    } catch (err) {
      setActionErr(err instanceof Error ? err.message : 'Delete request failed.');
    }
  };

  const handleExportStudentsCsv = async () => {
    try {
      const headers: Record<string, string> = { 'X-Requested-With': 'XMLHttpRequest' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/portal/batches/${batchId}/export-students`, {
        credentials: 'include',
        headers,
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `batch-${detail?.batch.code || batchId}-students.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onNotify('Exported batch student roster CSV.');
    } catch {
      setActionErr('Failed to export batch student CSV.');
    }
  };

  const surface = darkMode
    ? 'border-slate-800 bg-slate-900 text-slate-100'
    : 'border-slate-200 bg-white text-slate-900';
  const muted = darkMode ? 'text-slate-400' : 'text-slate-500';

  if (loading && !detail) {
    return (
      <div className={`rounded-2xl border p-8 text-center text-xs ${surface}`}>
        Loading batch management workspace...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={`rounded-2xl border p-6 space-y-3 ${surface}`}>
        <p className="text-xs font-semibold text-rose-600">{error || 'Batch detail unavailable.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Batch Dashboard</span>
        </button>
      </div>
    );
  }

  const { batch, course, branch, capacity, slots } = detail;
  const lc = normalizeBatchLifecycle(batch);
  const approvedEnrollments = detail.enrollments.filter((e) => e.status === 'approved');
  const totalCollected = detail.payments.reduce((s, t) => s + t.totalAmount, 0);
  const presentRecords = detail.attendanceRecords.filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length;
  const overallAttRate =
    detail.attendanceRecords.length > 0
      ? Math.round((presentRecords / detail.attendanceRecords.length) * 100)
      : 100;
  const avgExamScore =
    detail.examAttempts.length > 0
      ? Math.round(
          detail.examAttempts.reduce((s, a) => s + a.percentage, 0) / detail.examAttempts.length
        )
      : 0;

  const targetTransferBatches = allBatches.filter(
    (b) => b.id !== batch.id && normalizeBatchLifecycle(b) !== 'archived' && normalizeBatchLifecycle(b) !== 'cancelled'
  );

  const comparisonAnalytics = computeBatchDashboardAnalytics({
    batches: allBatches,
    courses,
    enrollments: detail.enrollments,
    attendance: detail.attendanceRecords,
    transactions: detail.payments,
  });

  // Merit ranking from attempts
  const meritList = [...detail.examAttempts].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="space-y-5">
      {/* Top Batch Banner Header */}
      <div className={`rounded-2xl border p-5 ${surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All Batches</span>
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums text-xs font-bold text-indigo-700">
                  {batch.code}
                </span>
                <span aria-hidden="true">·</span>
                <h2 className="text-lg font-bold">{batch.name}</h2>
                <span className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 whitespace-nowrap">
                  {BATCH_LIFECYCLE_LABELS[lc]}
                </span>
              </div>
              <p className={`mt-1 text-xs ${muted}`}>
                Course: <strong className="text-slate-800">{course?.title || 'Unlinked'}</strong> · Branch:{' '}
                <strong className="text-slate-800">{branch?.name || 'Online'}</strong> · Mode:{' '}
                <strong className="text-slate-800">{batch.mode}</strong> · Routine:{' '}
                <strong className="text-slate-800">{batch.schedule}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportStudentsCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
            {canAdminManage && (
              <button
                type="button"
                onClick={() => onOpenWizard(batch)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 whitespace-nowrap shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Edit in Wizard</span>
              </button>
            )}
          </div>
        </div>

        {/* 12 Tabs Bar */}
        <div className="mt-5 flex items-center gap-1.5 overflow-x-auto border-t border-slate-200 pt-4">
          {DETAIL_TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  clearAlerts();
                  setActiveTab(t.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {actionMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}
      {actionErr && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{actionErr}</span>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className={`rounded-2xl border p-5 lg:col-span-8 space-y-5 ${surface}`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className={`text-[11px] font-medium ${muted}`}>Enrolled / Seats</p>
                <p className="font-mono tabular-nums mt-1 text-xl font-bold">
                  {capacity.enrolledSeats}/{capacity.seatLimit}
                </p>
                <p className={`text-[11px] ${muted}`}>{capacity.remainingSeats} remaining</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className={`text-[11px] font-medium ${muted}`}>Attendance Rate</p>
                <p className="font-mono tabular-nums mt-1 text-xl font-bold text-emerald-700">
                  {overallAttRate}%
                </p>
                <p className={`text-[11px] ${muted}`}>{detail.attendanceRecords.length} logs</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className={`text-[11px] font-medium ${muted}`}>Fee Collection</p>
                <p className="font-mono tabular-nums mt-1 text-xl font-bold text-indigo-700">
                  ৳{totalCollected.toLocaleString()}
                </p>
                <p className={`text-[11px] ${muted}`}>{detail.payments.length} invoices</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3.5">
                <p className={`text-[11px] font-medium ${muted}`}>Avg Exam Score</p>
                <p className="font-mono tabular-nums mt-1 text-xl font-bold">{avgExamScore}%</p>
                <p className={`text-[11px] ${muted}`}>{detail.examAttempts.length} attempts</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Seat Utilization ({capacity.fillPercent}%)</span>
                <span className="font-mono tabular-nums">
                  Min Required: {capacity.minStudents} · Waitlist: {capacity.waitlistCount}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${capacity.isFull ? 'bg-rose-600' : 'bg-indigo-600'}`}
                  style={{ width: `${capacity.fillPercent}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-slate-200 p-4 space-y-1.5">
                <h3 className="font-bold text-slate-900">Academic &amp; Schedule Dates</h3>
                <p>
                  Start Date: <strong className="font-mono tabular-nums">{batch.startDate}</strong>
                </p>
                <p>
                  End Date: <strong className="font-mono tabular-nums">{batch.endDate || 'Ongoing'}</strong>
                </p>
                <p>
                  Enrollment Deadline:{' '}
                  <strong className="font-mono tabular-nums">
                    {batch.enrollmentDeadline || batch.enrollmentClosingDate || 'Open'}
                  </strong>
                </p>
                <p>
                  Duration / Total Classes:{' '}
                  <strong className="font-mono tabular-nums">
                    {batch.classDurationMinutes || 90} min · {batch.totalClasses || 36} classes
                  </strong>
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 space-y-1.5">
                <h3 className="font-bold text-slate-900">Location &amp; Fee Settings</h3>
                <p>
                  Room / Meeting:{' '}
                  <strong>
                    {batch.classroom?.roomNumber
                      ? `${batch.classroom.classroomName} (Rm ${batch.classroom.roomNumber})`
                      : batch.classroomOrMeeting || batch.onlineSettings?.platform || 'Campus'}
                  </strong>
                </p>
                <p>
                  Admission Fee:{' '}
                  <strong className="font-mono tabular-nums">
                    ৳{batch.feeSettings?.admissionFee ?? course?.admissionFee ?? 0}
                  </strong>
                </p>
                <p>
                  Monthly Fee:{' '}
                  <strong className="font-mono tabular-nums">
                    ৳{batch.feeSettings?.monthlyFee ?? 0}
                  </strong>
                </p>
                <p>
                  Installments:{' '}
                  <strong>{batch.feeSettings?.installmentEnabled ? batch.feeSettings.installmentOptions || 'Enabled' : 'One-time'}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 lg:col-span-4 space-y-4 ${surface}`}>
            <h3 className="text-sm font-bold">Assigned Faculty</h3>
            <div className="space-y-2.5">
              {detail.teachers.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{t.name}</p>
                    <p className={muted}>
                      {t.id === batch.instructorId ? 'Main Teacher' : 'Co / Assistant Teacher'} · {t.subject}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-bold pt-2">Next Class Sessions</h3>
            <div className="space-y-2 text-xs">
              {slots.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="font-semibold">{s.title || 'Regular Lecture'}</p>
                    <p className={muted}>
                      {s.dayOfWeek} · {s.startTime}–{s.endTime}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums text-[11px] font-semibold uppercase text-indigo-700">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STUDENTS, TRANSFER, WAITLIST & HISTORY */}
      {activeTab === 'students' && (
        <div className="space-y-5">
          {canAdminManage && (
            <form onSubmit={handleEnrollExisting} className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                <span>Enroll Student or Bulk Enroll into {batch.name}</span>
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label htmlFor="bd-enroll-stu" className="mb-1 block text-xs font-semibold">
                    Select Existing Student
                  </label>
                  <select
                    id="bd-enroll-stu"
                    value={enrollStudentId}
                    onChange={(e) => setEnrollStudentId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
                  >
                    {detail.eligibleStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-5">
                  <label htmlFor="bd-bulk-emails" className="mb-1 block text-xs font-semibold">
                    Or Bulk Enroll Emails (comma/newline separated)
                  </label>
                  <input
                    id="bd-bulk-emails"
                    type="text"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    placeholder="student1@mail.com, student2@mail.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  />
                </div>
                <div className="flex items-end sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 whitespace-nowrap"
                  >
                    Enroll Student
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Transfer Modal / Inline Drawer */}
          {transferEnrollment && (
            <form
              onSubmit={handleTransferStudent}
              className="rounded-2xl border border-indigo-300 bg-indigo-50/60 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-950">
                  <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                  <span>
                    Safe Transfer: {transferEnrollment.studentName} (Preserves Attendance &amp; Payment History)
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setTransferEnrollment(null)}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <select
                  aria-label="Target batch for transfer"
                  value={transferTargetBatchId}
                  onChange={(e) => setTransferTargetBatchId(e.target.value)}
                  className="sm:col-span-5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="">Select destination batch...</option>
                  {targetTransferBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code}) — {b.seatLimit - b.enrolledSeats} seats left
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  aria-label="Transfer reason"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Transfer reason..."
                  className="sm:col-span-5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  disabled={!transferTargetBatchId}
                  className="sm:col-span-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          )}

          {/* Active & Historical Student Roster */}
          <div className={`rounded-2xl border p-5 ${surface}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Enrolled Student Roster ({detail.enrollments.length})</h3>
              <button
                type="button"
                onClick={handleExportStudentsCsv}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>CSV</span>
              </button>
            </div>
            <div className="mt-3 overflow-x-auto">
              {detail.enrollments.length === 0 ? (
                <p className={`py-6 text-center text-xs ${muted}`}>No students enrolled in this batch yet.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                      <th className="py-2.5 pr-3">Student</th>
                      <th className="py-2.5 pr-3">Payment</th>
                      <th className="py-2.5 pr-3">Status</th>
                      <th className="py-2.5 pr-3">Latest History</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detail.enrollments.map((enr) => (
                      <tr key={enr.id}>
                        <td className="py-2.5 pr-3">
                          <p className="font-bold text-slate-900">{enr.studentName}</p>
                          <p className={muted}>{enr.studentEmail}</p>
                        </td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums">
                          ৳{enr.amountPaid} · {enr.paymentMethod}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold uppercase">{enr.status}</td>
                        <td className="py-2.5 pr-3 max-w-xs truncate text-slate-600">
                          {enr.history?.[0]?.note || `Enrolled ${new Date(enr.enrolledAt).toLocaleDateString()}`}
                        </td>
                        <td className="py-2.5 text-right">
                          {canAdminManage && enr.status === 'approved' && (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferEnrollment(enr);
                                  setTransferTargetBatchId(targetTransferBatches[0]?.id || '');
                                }}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 whitespace-nowrap"
                              >
                                Transfer
                              </button>
                              <button
                                type="button"
                                onClick={() => void handlePromoteStudent(enr.id)}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 whitespace-nowrap"
                              >
                                Promote
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRemoveStudent(enr.id)}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Waitlist & Transfer History */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">
                  Waiting List ({detail.waitlist.filter((w) => w.status === 'waiting').length})
                </h3>
                {canAdminManage && (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Select student for waitlist"
                      value={waitlistStudentId}
                      onChange={(e) => setWaitlistStudentId(e.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                    >
                      {detail.eligibleStudents.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddWaitlist}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white whitespace-nowrap"
                    >
                      Add Waitlist
                    </button>
                  </div>
                )}
              </div>
              {detail.waitlist.length === 0 ? (
                <p className={`text-xs ${muted}`}>No students on the waiting list.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {detail.waitlist.map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                      <div>
                        <p className="font-bold">
                          #{w.priority} {w.studentName}
                        </p>
                        <p className={muted}>
                          {w.studentEmail} · {w.status}
                        </p>
                      </div>
                      {canAdminManage && w.status === 'waiting' && (
                        <button
                          type="button"
                          onClick={() => void handlePromoteWaitlist(w.id)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white"
                        >
                          Promote Seat
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
              <h3 className="text-sm font-bold">Batch Transfer Audit ({detail.transfers.length})</h3>
              {detail.transfers.length === 0 ? (
                <p className={`text-xs ${muted}`}>No transfers recorded for this batch.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {detail.transfers.map((tr) => (
                    <div key={tr.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="font-bold">
                        {tr.studentName}: {tr.fromBatchName} → {tr.toBatchName}
                      </p>
                      <p className={muted}>
                        Preserved {tr.preservedAttendanceCount} attendance &amp; {tr.preservedPaymentCount} payment record(s) · By {tr.actorName}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TEACHERS */}
      {activeTab === 'teachers' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <form onSubmit={handleUpdateTeachers} className={`rounded-2xl border p-5 lg:col-span-6 space-y-4 ${surface}`}>
            <h3 className="text-sm font-bold">Assign Main &amp; Assistant Teachers</h3>
            <div>
              <label htmlFor="bd-main-teacher" className="mb-1 block text-xs font-semibold">
                Main Teacher
              </label>
              <select
                id="bd-main-teacher"
                value={mainTeacherId}
                onChange={(e) => setMainTeacherId(e.target.value)}
                disabled={!canAdminManage}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
              >
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} — {i.subject}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bd-asst-teacher" className="mb-1 block text-xs font-semibold">
                Assistant Teacher
              </label>
              <select
                id="bd-asst-teacher"
                value={assistantTeacherId}
                onChange={(e) => setAssistantTeacherId(e.target.value)}
                disabled={!canAdminManage}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900"
              >
                <option value="">None</option>
                {instructors
                  .filter((i) => i.id !== mainTeacherId)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {i.subject}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="bd-resp" className="mb-1 block text-xs font-semibold">
                Teaching Responsibilities
              </label>
              <input
                id="bd-resp"
                type="text"
                value={teacherRespNote}
                onChange={(e) => setTeacherRespNote(e.target.value)}
                disabled={!canAdminManage}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
            </div>
            {canAdminManage && (
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Save Faculty Assignment (Conflict Checked)
              </button>
            )}
          </form>

          <div className={`rounded-2xl border p-5 lg:col-span-6 space-y-4 ${surface}`}>
            <h3 className="text-sm font-bold">Teacher Workload &amp; Assignment History</h3>
            <div className="space-y-2 text-xs">
              {detail.teacherWorkload.map((tw) => (
                <div key={tw.instructorId} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                  <div>
                    <p className="font-bold">{tw.name}</p>
                    <p className={muted}>{tw.subject}</p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-indigo-700">
                    {tw.activeBatchesCount} active batches · {tw.weeklyClasses} classes/wk
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-3">
              <h4 className="text-xs font-bold uppercase text-slate-500">Assignment History</h4>
              <div className="mt-2 space-y-2 text-xs">
                {(batch.teacherAssignmentHistory ?? []).length === 0 ? (
                  <p className={muted}>Initial assignment on batch creation.</p>
                ) : (
                  (batch.teacherAssignmentHistory ?? []).map((h) => (
                    <div key={h.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="font-semibold text-slate-900">
                        {h.instructorName} ({h.role}) — {h.action}
                      </p>
                      <p className={muted}>
                        {h.note} · By {h.actorName}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CLASS ROUTINE & SCHEDULES (Weekly, Monthly, Daily + Conflict Guard) */}
      {activeTab === 'routine' && (
        <div className="space-y-4">
          <div className={`rounded-2xl border p-5 ${surface}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Calendar className="h-4 w-4 text-indigo-600" />
                <span>Class Schedule &amp; Routine Calendar</span>
              </h3>
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 p-1 text-xs font-semibold">
                {(['weekly', 'monthly', 'daily'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRoutineView(mode)}
                    className={`rounded-lg px-3 py-1 capitalize ${
                      routineView === mode ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {mode} View
                  </button>
                ))}
              </div>
            </div>

            {routineView === 'weekly' && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-7">
                {BATCH_WEEK_DAYS.map((day) => {
                  const daySlots = slots.filter((s) => s.dayOfWeek === day);
                  return (
                    <div key={day} className="rounded-xl border border-slate-200 p-2.5 text-xs">
                      <p className="font-bold text-slate-900">{day}</p>
                      <div className="mt-2 space-y-2">
                        {daySlots.length === 0 ? (
                          <p className={`text-[11px] ${muted}`}>No class</p>
                        ) : (
                          daySlots.map((s) => (
                            <div
                              key={s.id}
                              className={`rounded-lg border p-2 ${
                                s.status === 'cancelled'
                                  ? 'border-rose-200 bg-rose-50/70'
                                  : 'border-indigo-200 bg-indigo-50/60'
                              }`}
                            >
                              <p className="font-mono tabular-nums font-bold text-indigo-900">
                                {s.startTime}–{s.endTime}
                              </p>
                              <p className="truncate font-semibold text-slate-800">{s.title || 'Class'}</p>
                              <p className="text-[10px] uppercase text-slate-600">{s.status}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {routineView === 'monthly' && (
              <div className="mt-4 grid grid-cols-7 gap-1.5 text-xs">
                {Array.from({ length: 28 }, (_, i) => {
                  const dayIdx = i % 7;
                  const weekday = BATCH_WEEK_DAYS[dayIdx];
                  const hasClass = slots.some((s) => s.dayOfWeek === weekday && s.status !== 'cancelled');
                  return (
                    <div
                      key={i}
                      className={`rounded-lg border p-2 ${
                        hasClass ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200'
                      }`}
                    >
                      <p className="font-mono tabular-nums text-[11px] font-bold">
                        Day {i + 1} ({weekday})
                      </p>
                      {hasClass && <p className="mt-0.5 text-[10px] font-semibold text-indigo-700">Class Scheduled</p>}
                    </div>
                  );
                })}
              </div>
            )}

            {routineView === 'daily' && (
              <div className="mt-4 space-y-2">
                {slots.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold">
                        {s.dayOfWeek} · <span className="font-mono tabular-nums">{s.startTime}–{s.endTime}</span> ·{' '}
                        {s.title || 'Regular Session'}
                      </p>
                      <p className={muted}>
                        Room/Platform: {s.roomLabel || batch.classroomOrMeeting || 'TBA'} · Status: {s.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleSlotStatus(s.id, 'completed')}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                      >
                        Mark Complete
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSlotStatus(s.id, 'rescheduled')}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSlotStatus(s.id, 'cancelled')}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddSlot} className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
            <h4 className="flex items-center gap-1.5 text-sm font-bold">
              <Plus className="h-4 w-4 text-indigo-600" />
              <span>Add New Class Slot (Auto-Checks Teacher &amp; Room Conflicts)</span>
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <input
                type="text"
                value={slotTitle}
                onChange={(e) => setSlotTitle(e.target.value)}
                placeholder="Topic / Session Title"
                className="sm:col-span-4 rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <select
                aria-label="Day of Week"
                value={slotDay}
                onChange={(e) => setSlotDay(e.target.value as BatchWeekDay)}
                className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold"
              >
                {BATCH_WEEK_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <input
                type="time"
                aria-label="Slot start time"
                value={slotStart}
                onChange={(e) => setSlotStart(e.target.value)}
                className="font-mono tabular-nums sm:col-span-2 rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
              />
              <input
                type="time"
                aria-label="Slot end time"
                value={slotEnd}
                onChange={(e) => setSlotEnd(e.target.value)}
                className="font-mono tabular-nums sm:col-span-2 rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
              />
              <button
                type="submit"
                className="sm:col-span-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Add Slot
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: BULK ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveAttendance} className={`rounded-2xl border p-5 space-y-4 ${surface}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Take Batch Attendance</h3>
                <p className={`text-xs ${muted}`}>
                  Overall Batch Attendance Rate:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">{overallAttRate}%</strong> ({detail.attendanceRecords.length} total records)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="bd-att-date" className="text-xs font-semibold">
                  Class Date:
                </label>
                <input
                  id="bd-att-date"
                  type="date"
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="font-mono tabular-nums rounded-xl border border-slate-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 whitespace-nowrap"
                >
                  Save Attendance
                </button>
              </div>
            </div>

            {approvedEnrollments.length === 0 ? (
              <p className={`py-6 text-center text-xs ${muted}`}>
                Enroll at least one approved student to mark batch attendance.
              </p>
            ) : (
              <div className="space-y-2">
                {approvedEnrollments.map((enr) => {
                  const stuRecords = detail.attendanceRecords.filter((a) => a.targetId === enr.userId);
                  const stuPresent = stuRecords.filter(
                    (a) => a.status === 'present' || a.status === 'late'
                  ).length;
                  const stuPct =
                    stuRecords.length > 0 ? Math.round((stuPresent / stuRecords.length) * 100) : 100;
                  const draft = attDrafts[enr.userId] || { status: 'present', notes: '' };
                  return (
                    <div
                      key={enr.id}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 text-xs sm:grid-cols-12 items-center"
                    >
                      <div className="sm:col-span-4">
                        <p className="font-bold text-slate-900">{enr.studentName}</p>
                        <p className={`font-mono tabular-nums ${muted}`}>
                          History: {stuPct}% ({stuPresent}/{stuRecords.length})
                        </p>
                      </div>
                      <select
                        aria-label={`Attendance status for ${enr.studentName}`}
                        value={draft.status}
                        onChange={(e) =>
                          setAttDrafts((prev) => ({
                            ...prev,
                            [enr.userId]: { ...draft, status: e.target.value },
                          }))
                        }
                        className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                        <option value="excused">Excused</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Attendance notes..."
                        value={draft.notes}
                        onChange={(e) =>
                          setAttDrafts((prev) => ({
                            ...prev,
                            [enr.userId]: { ...draft, notes: e.target.value },
                          }))
                        }
                        className="sm:col-span-5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 6: EXAMS & RESULTS */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
            <h3 className="text-sm font-bold">Batch &amp; Course Exams ({detail.exams.length})</h3>
            {detail.exams.length === 0 ? (
              <p className={`text-xs ${muted}`}>No exams linked to this course/batch yet.</p>
            ) : (
              detail.exams.map((ex) => (
                <div key={ex.id} className="rounded-xl border border-slate-200 p-3 text-xs">
                  <p className="font-bold">{ex.title}</p>
                  <p className={muted}>
                    {ex.questions.length} Questions · {ex.durationMinutes} min · Pass {ex.passPercentage}%
                  </p>
                </div>
              ))
            )}
          </div>
          <div className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
            <h3 className="text-sm font-bold">Batch Merit List ({meritList.length})</h3>
            {meritList.length === 0 ? (
              <p className={`text-xs ${muted}`}>No exam attempts submitted by this batch cohort yet.</p>
            ) : (
              meritList.map((att, idx) => (
                <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs">
                  <div>
                    <p className="font-bold">
                      #{idx + 1} {att.studentName}
                    </p>
                    <p className={muted}>{att.examTitle}</p>
                  </div>
                  <span className="font-mono tabular-nums font-bold text-indigo-700">
                    {att.score}/{att.totalMarks} ({att.percentage}% · {att.grade})
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className={`rounded-2xl border p-5 space-y-3 ${surface}`}>
          <h3 className="text-sm font-bold">
            Batch Assignments ({detail.assignments.length}) · Submissions ({detail.submissions.length})
          </h3>
          {detail.assignments.length === 0 ? (
            <p className={`text-xs ${muted}`}>No assignments created for this course/batch yet.</p>
          ) : (
            detail.assignments.map((asg) => {
              const subs = detail.submissions.filter((s) => s.assignmentId === asg.id);
              const graded = subs.filter((s) => s.status === 'graded').length;
              return (
                <div key={asg.id} className="rounded-xl border border-slate-200 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">{asg.title}</p>
                    <span className="font-mono tabular-nums font-semibold text-indigo-700">
                      {subs.length} submissions ({graded} graded) · Max {asg.maxMarks} marks
                    </span>
                  </div>
                  <p className={`mt-1 ${muted}`}>{asg.instructions}</p>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 8: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className={`rounded-2xl border p-5 space-y-4 ${surface}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold">
                Batch Fee Collection: <span className="font-mono tabular-nums text-indigo-700">৳{totalCollected.toLocaleString()}</span>
              </h3>
              <p className={`text-xs ${muted}`}>
                Admission Fee: ৳{batch.feeSettings?.admissionFee ?? 0} · Monthly: ৳
                {batch.feeSettings?.monthlyFee ?? 0} · Late Policy:{' '}
                {batch.feeSettings?.latePaymentPolicy || 'Standard center policy'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSendPaymentReminder()}
              className="rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-700 whitespace-nowrap"
            >
              Send Payment Reminder
            </button>
          </div>
          {detail.payments.length === 0 ? (
            <p className={`text-xs ${muted}`}>No payment invoices recorded for this batch yet.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {detail.payments.map((tx) => (
                <div key={tx.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-2.5">
                  <span>
                    <strong className="font-mono tabular-nums text-indigo-700">{tx.invoiceNo}</strong> ·{' '}
                    {tx.payerName} ({tx.gateway})
                  </span>
                  <span className="font-mono tabular-nums font-bold">
                    ৳{tx.totalAmount} · {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 9: ANNOUNCEMENTS & NOTIFICATIONS */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <form onSubmit={handlePostAnnouncement} className={`rounded-2xl border p-5 lg:col-span-5 space-y-3 ${surface}`}>
            <h3 className="text-sm font-bold">Post Batch Announcement</h3>
            <input
              type="text"
              required
              placeholder="Announcement Title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <textarea
              required
              rows={3}
              placeholder="Notice message for batch students..."
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
            />
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input
                type="checkbox"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
              />
              Pin announcement at top of student portal
            </label>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              Publish &amp; Notify Students
            </button>
          </form>

          <div className={`rounded-2xl border p-5 lg:col-span-7 space-y-3 ${surface}`}>
            <h3 className="text-sm font-bold">
              Announcements ({detail.announcements.length}) &amp; Dispatched Notifications ({detail.notifications.length})
            </h3>
            <div className="space-y-2 text-xs">
              {detail.announcements.map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-bold">
                    {a.pinned ? '[Pinned] ' : ''}
                    {a.title}
                  </p>
                  <p className="mt-0.5 text-slate-700">{a.message}</p>
                </div>
              ))}
              {detail.notifications.slice(0, 6).map((n) => (
                <div key={n.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <p className="font-bold text-indigo-900">
                    [{n.type.replace(/_/g, ' ')}] {n.title}
                  </p>
                  <p className="text-slate-700">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: REPORTS (8 Enterprise Reports + CSV/PDF) */}
      {activeTab === 'reports' && (
        <div className={`rounded-2xl border p-5 space-y-4 ${surface}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Batch Enterprise Reports Suite (8 Reports)</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportStudentsCsv}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
              >
                Print PDF
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['enrollment', 'Enrollment Report'],
                ['capacity', 'Seat Capacity'],
                ['attendance', 'Attendance Summary'],
                ['teacher_perf', 'Teacher Performance'],
                ['student_perf', 'Student Performance'],
                ['payment_collection', 'Payment Collection'],
                ['course_completion', 'Course Completion'],
                ['batch_comparison', 'Batch Comparison'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveReport(id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${
                  activeReport === id
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 p-4 text-xs">
            {activeReport === 'enrollment' && (
              <p>
                Approved Students: <strong className="font-mono tabular-nums">{approvedEnrollments.length}</strong> ·
                Transfers Recorded: <strong className="font-mono tabular-nums">{detail.transfers.length}</strong> ·
                Waiting List: <strong className="font-mono tabular-nums">{capacity.waitlistCount}</strong>
              </p>
            )}
            {activeReport === 'capacity' && (
              <p>
                Capacity Fill: <strong className="font-mono tabular-nums">{capacity.fillPercent}%</strong> ({capacity.enrolledSeats}/
                {capacity.seatLimit}) · Available: <strong className="font-mono tabular-nums">{capacity.remainingSeats}</strong> ·
                Below Minimum: <strong>{capacity.belowMinimum ? 'Yes' : 'No'}</strong>
              </p>
            )}
            {activeReport === 'attendance' && (
              <p>
                Total Attendance Entries:{' '}
                <strong className="font-mono tabular-nums">{detail.attendanceRecords.length}</strong> · Present/Late:{' '}
                <strong className="font-mono tabular-nums">{presentRecords}</strong> · Overall Rate:{' '}
                <strong className="font-mono tabular-nums">{overallAttRate}%</strong>
              </p>
            )}
            {activeReport === 'teacher_perf' && (
              <div className="space-y-2">
                {detail.teacherWorkload.map((tw) => (
                  <p key={tw.instructorId}>
                    <strong>{tw.name}</strong> ({tw.subject}): {tw.activeBatchesCount} active batches ·{' '}
                    {tw.weeklyClasses} weekly slots
                  </p>
                ))}
              </div>
            )}
            {activeReport === 'student_perf' && (
              <p>
                Graded Submissions:{' '}
                <strong className="font-mono tabular-nums">
                  {detail.submissions.filter((s) => s.status === 'graded').length}
                </strong>{' '}
                · Exam Attempts: <strong className="font-mono tabular-nums">{detail.examAttempts.length}</strong> ·
                Avg Score: <strong className="font-mono tabular-nums">{avgExamScore}%</strong>
              </p>
            )}
            {activeReport === 'payment_collection' && (
              <p>
                Total Collected: <strong className="font-mono tabular-nums">৳{totalCollected.toLocaleString()}</strong> ·
                Invoices: <strong className="font-mono tabular-nums">{detail.payments.length}</strong>
              </p>
            )}
            {activeReport === 'course_completion' && (
              <p>
                Approved Learners Tracked:{' '}
                <strong className="font-mono tabular-nums">{approvedEnrollments.length}</strong> · Completed Slot
                Sessions:{' '}
                <strong className="font-mono tabular-nums">
                  {slots.filter((s) => s.status === 'completed').length}/{slots.length}
                </strong>
              </p>
            )}
            {activeReport === 'batch_comparison' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                      <th className="py-2 pr-3">Batch</th>
                      <th className="py-2 pr-3">Seats</th>
                      <th className="py-2 pr-3">Fill %</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comparisonAnalytics.comparisonRows.slice(0, 8).map((r) => (
                      <tr key={r.batchId}>
                        <td className="py-1.5 pr-3 font-semibold">{r.name}</td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums">
                          {r.enrolledSeats}/{r.seatLimit}
                        </td>
                        <td className="py-1.5 pr-3 font-mono tabular-nums">{r.fillPercent}%</td>
                        <td className="py-1.5">{BATCH_LIFECYCLE_LABELS[r.lifecycle]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 11: ACTIVITY LOGS */}
      {activeTab === 'logs' && (
        <div className={`rounded-2xl border p-5 space-y-2 ${surface}`}>
          <h3 className="text-sm font-bold">Batch Activity Audit Logs ({detail.activityLogs.length})</h3>
          {detail.activityLogs.length === 0 ? (
            <p className={`py-4 text-xs ${muted}`}>No activity logs recorded yet for this batch.</p>
          ) : (
            detail.activityLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs">
                <div>
                  <p className="font-bold">
                    {log.action.replace(/_/g, ' ')} — {log.actorName} ({log.actorRole})
                  </p>
                  <p className={muted}>{log.details}</p>
                </div>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 12: LIFECYCLE SETTINGS, SAFE ARCHIVE & SAFE DELETE */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className={`rounded-2xl border p-5 space-y-4 ${surface}`}>
            <h3 className="text-sm font-bold">Batch Lifecycle Transitions</h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Select next lifecycle status"
                value={nextLifecycle}
                onChange={(e) => setNextLifecycle(e.target.value as BatchLifecycleStatus)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                {(Object.keys(BATCH_LIFECYCLE_LABELS) as BatchLifecycleStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {BATCH_LIFECYCLE_LABELS[st]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleLifecycleUpdate(nextLifecycle)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Apply Lifecycle Status
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => void handleLifecycleUpdate('archived')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-200"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archive Batch Safely</span>
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border border-rose-200 p-5 space-y-4 ${surface}`}>
            <h3 className="flex items-center gap-2 text-sm font-bold text-rose-700">
              <ShieldAlert className="h-4 w-4" />
              <span>Safe Delete Protection</span>
            </h3>
            <p className={`text-xs ${muted}`}>
              Batches with active students, historical attendance records, or payment invoices cannot be hard-deleted to preserve academic integrity. Empty batches are moved to Recycle Bin.
            </p>
            {deleteErrorInfo && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 space-y-2">
                <p className="font-semibold">{deleteErrorInfo.message}</p>
                {deleteErrorInfo.suggestArchive && (
                  <button
                    type="button"
                    onClick={() => void handleLifecycleUpdate('archived')}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white"
                  >
                    <Archive className="h-3 w-3" />
                    <span>Archive Batch Instead</span>
                  </button>
                )}
              </div>
            )}
            {canAdminManage && (
              <button
                type="button"
                onClick={() => void handleSafeDelete()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Safe Delete Batch</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
