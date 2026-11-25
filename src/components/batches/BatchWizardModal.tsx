import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MapPin,
  Plus,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  BATCH_LIFECYCLE_LABELS,
  BATCH_WEEK_DAYS,
  getEffectiveBatchSlots,
  normalizeBatchLifecycle,
} from '../../lib/batchEnterprise';
import type {
  BatchLifecycleStatus,
  BatchScheduleSlot,
  BatchTeacherAssignment,
  BatchWeekDay,
  Branch,
  Course,
  CourseBatch,
  Instructor,
} from '../../types';

interface BatchWizardModalProps {
  open: boolean;
  batch: CourseBatch | null;
  courses: Course[];
  branches: Branch[];
  instructors: Instructor[];
  defaultCourseId?: string;
  onClose: () => void;
  onSaved: (message: string, savedBatch?: CourseBatch) => Promise<void> | void;
}

const STEPS = [
  { id: 1, label: 'Basic Info', icon: BookOpen },
  { id: 2, label: 'Teachers', icon: Users },
  { id: 3, label: 'Capacity', icon: CheckCircle2 },
  { id: 4, label: 'Schedule', icon: CalendarClock },
  { id: 5, label: 'Room / Online', icon: Video },
  { id: 6, label: 'Fees & Policy', icon: CreditCard },
] as const;

function offsetDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function BatchWizardModal({
  open,
  batch,
  courses,
  branches,
  instructors,
  defaultCourseId,
  onClose,
  onSaved,
}: BatchWizardModalProps) {
  const { apiFetch } = useAuth();
  const isEditing = Boolean(batch);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ message: string }[]>([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [courseId, setCourseId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [description, setDescription] = useState('');
  const [batchType, setBatchType] = useState<'Offline' | 'Online' | 'Hybrid'>('Hybrid');
  const [thumbnail, setThumbnail] = useState('/src/assets/images/hero_ielts_batch_1795411661577.jpg');
  const [lifecycleStatus, setLifecycleStatus] = useState<BatchLifecycleStatus>('enrollment_open');

  // Step 2: Teacher Assignment
  const [mainInstructorId, setMainInstructorId] = useState('');
  const [assistantInstructorId, setAssistantInstructorId] = useState('');
  const [coTeachers, setCoTeachers] = useState<BatchTeacherAssignment[]>([]);

  // Step 3: Student Capacity
  const [seatLimit, setSeatLimit] = useState('40');
  const [minStudents, setMinStudents] = useState('8');
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [enrollmentStartDate, setEnrollmentStartDate] = useState(() => offsetDateString(0));
  const [enrollmentClosingDate, setEnrollmentClosingDate] = useState(() => offsetDateString(30));
  const [enrollmentDeadline, setEnrollmentDeadline] = useState(() => offsetDateString(45));

  // Step 4: Batch Schedule
  const [startDate, setStartDate] = useState(() => offsetDateString(7));
  const [endDate, setEndDate] = useState(() => offsetDateString(150));
  const [weeklyFrequency, setWeeklyFrequency] = useState('3');
  const [totalClasses, setTotalClasses] = useState('36');
  const [classDurationMinutes, setClassDurationMinutes] = useState('90');
  const [breakMinutes, setBreakMinutes] = useState('10');
  const [schedules, setSchedules] = useState<BatchScheduleSlot[]>([]);

  // Step 5: Classroom / Online Settings
  const [classroomName, setClassroomName] = useState('Academic Hall A');
  const [building, setBuilding] = useState('Main Campus');
  const [floor, setFloor] = useState('2nd Floor');
  const [roomNumber, setRoomNumber] = useState('204');
  const [platform, setPlatform] = useState('Zoom');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [onlineInstructions, setOnlineInstructions] = useState(
    'Join 5 minutes prior to class start with your registered full name.'
  );

  // Step 6: Fee & Payment Settings
  const [admissionFee, setAdmissionFee] = useState('500');
  const [monthlyFee, setMonthlyFee] = useState('1500');
  const [courseFeeOverride, setCourseFeeOverride] = useState('');
  const [installmentEnabled, setInstallmentEnabled] = useState(true);
  const [installmentOptions, setInstallmentOptions] = useState('2 Monthly Installments (50% + 50%)');
  const [paymentDeadline, setPaymentDeadline] = useState(() => offsetDateString(25));
  const [latePaymentPolicy, setLatePaymentPolicy] = useState(
    '5-day grace period; ৳100 reminder fee applies after due date.'
  );
  const [batchDiscountPercent, setBatchDiscountPercent] = useState('0');
  const lastInitKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      lastInitKeyRef.current = null;
      return;
    }
    const initKey = `${batch?.id ?? 'new'}::${defaultCourseId ?? ''}`;
    if (lastInitKeyRef.current === initKey) return;
    lastInitKeyRef.current = initKey;
    setStep(1);
    setError(null);
    setConflicts([]);

    if (batch) {
      setName(batch.name);
      setCode(batch.code);
      setCourseId(batch.courseId);
      setBranchId(batch.branchId || branches[0]?.id || 'br-mirpur');
      setDescription(batch.description || '');
      setBatchType(
        batch.batchType ??
          (batch.mode === 'Online Live' ? 'Online' : batch.mode === 'Offline Branch' ? 'Offline' : 'Hybrid')
      );
      setThumbnail(batch.thumbnail || '/src/assets/images/hero_ielts_batch_1795411661577.jpg');
      setLifecycleStatus(normalizeBatchLifecycle(batch));

      setMainInstructorId(batch.instructorId || instructors[0]?.id || '');
      setAssistantInstructorId(batch.assistantInstructorId || '');
      setCoTeachers(batch.teacherAssignments ?? []);

      setSeatLimit(String(batch.seatLimit));
      setMinStudents(String(batch.minStudents ?? 8));
      setWaitlistEnabled(batch.waitlistEnabled !== false);
      setEnrollmentStartDate(batch.enrollmentStartDate || '2026-04-01');
      setEnrollmentClosingDate(batch.enrollmentClosingDate || '2026-05-15');
      setEnrollmentDeadline(batch.enrollmentDeadline || '2026-05-20');

      setStartDate(batch.startDate || '2026-05-01');
      setEndDate(batch.endDate || '2026-09-30');
      setWeeklyFrequency(String(batch.weeklyFrequency ?? 3));
      setTotalClasses(String(batch.totalClasses ?? 36));
      setClassDurationMinutes(String(batch.classDurationMinutes ?? 90));
      setBreakMinutes(String(batch.breakMinutes ?? 10));
      const existingSlots = getEffectiveBatchSlots(batch);
      setSchedules(
        existingSlots.length > 0
          ? existingSlots
          : [
              {
                id: `slot-${Date.now()}`,
                title: 'Regular Lecture',
                dayOfWeek: 'Sun',
                startTime: '16:30',
                endTime: '18:00',
                durationMinutes: 90,
                breakMinutes: 10,
                instructorId: batch.instructorId,
                roomLabel: batch.classroom?.roomNumber || 'Room 204',
                status: 'scheduled',
              },
            ]
      );

      setClassroomName(batch.classroom?.classroomName || 'Academic Hall A');
      setBuilding(batch.classroom?.building || 'Main Campus');
      setFloor(batch.classroom?.floor || '2nd Floor');
      setRoomNumber(batch.classroom?.roomNumber || '204');
      setPlatform(batch.onlineSettings?.platform || 'Zoom');
      setMeetingLink(batch.onlineSettings?.meetingLink || '');
      setMeetingId(batch.onlineSettings?.meetingId || '');
      setMeetingPassword(batch.onlineSettings?.meetingPassword || '');
      setOnlineInstructions(
        batch.onlineSettings?.instructions ||
          'Join 5 minutes prior to class start with your registered full name.'
      );

      setAdmissionFee(String(batch.feeSettings?.admissionFee ?? 500));
      setMonthlyFee(String(batch.feeSettings?.monthlyFee ?? 1500));
      setCourseFeeOverride(
        batch.feeSettings?.courseFeeOverride !== undefined &&
          batch.feeSettings?.courseFeeOverride !== null
          ? String(batch.feeSettings.courseFeeOverride)
          : ''
      );
      setInstallmentEnabled(Boolean(batch.feeSettings?.installmentEnabled ?? true));
      setInstallmentOptions(
        batch.feeSettings?.installmentOptions || '2 Monthly Installments (50% + 50%)'
      );
      setPaymentDeadline(batch.feeSettings?.paymentDeadline || '2026-05-15');
      setLatePaymentPolicy(
        batch.feeSettings?.latePaymentPolicy ||
          '5-day grace period; ৳100 reminder fee applies after due date.'
      );
      setBatchDiscountPercent(String(batch.feeSettings?.batchDiscountPercent ?? 0));
    } else {
      const defCourse = courses.find((c) => c.id === defaultCourseId) || courses[0];
      const defInst = instructors[0]?.id || 'inst-1';
      setName('');
      setCode(`AEC-${String(Date.now()).slice(-4)}`);
      setCourseId(defCourse?.id || '');
      setBranchId(branches[0]?.id || 'br-mirpur');
      setDescription('');
      setBatchType('Hybrid');
      setThumbnail(defCourse?.thumbnail || '/src/assets/images/hero_ielts_batch_1795411661577.jpg');
      setLifecycleStatus('enrollment_open');
      setMainInstructorId(defInst);
      setAssistantInstructorId('');
      setCoTeachers([]);
      setSeatLimit('40');
      setMinStudents('8');
      setWaitlistEnabled(true);
      setEnrollmentStartDate(offsetDateString(0));
      setEnrollmentClosingDate(offsetDateString(30));
      setEnrollmentDeadline(offsetDateString(45));
      setStartDate(offsetDateString(7));
      setEndDate(offsetDateString(150));
      setWeeklyFrequency('3');
      setTotalClasses('36');
      setClassDurationMinutes('90');
      setBreakMinutes('10');
      setSchedules([
        {
          id: `slot-${Date.now()}-1`,
          title: 'Lecture Session 1',
          dayOfWeek: 'Sun',
          startTime: '15:00',
          endTime: '16:30',
          durationMinutes: 90,
          breakMinutes: 10,
          instructorId: defInst,
          roomLabel: 'Room 204',
          status: 'scheduled',
        },
      ]);
      setClassroomName('Academic Hall A');
      setBuilding('Main Campus');
      setFloor('2nd Floor');
      setRoomNumber('204');
      setPlatform('Zoom');
      setMeetingLink('');
      setMeetingId('');
      setMeetingPassword('');
      setOnlineInstructions('Join 5 minutes prior to class start with your registered full name.');
      setAdmissionFee(String(defCourse?.admissionFee ?? 500));
      setMonthlyFee('1500');
      setCourseFeeOverride('');
      setInstallmentEnabled(true);
      setInstallmentOptions('2 Monthly Installments (50% + 50%)');
      setPaymentDeadline(offsetDateString(25));
      setLatePaymentPolicy('5-day grace period; ৳100 reminder fee applies after due date.');
      setBatchDiscountPercent('0');
    }
  }, [open, batch, courses, branches, instructors, defaultCourseId]);

  if (!open) return null;

  const addScheduleSlot = () => {
    setSchedules((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}-${prev.length + 1}`,
        title: `Class Session ${prev.length + 1}`,
        dayOfWeek: 'Tue',
        startTime: '15:00',
        endTime: '16:30',
        durationMinutes: Number(classDurationMinutes) || 90,
        breakMinutes: Number(breakMinutes) || 0,
        instructorId: mainInstructorId,
        roomLabel: batchType === 'Online' ? platform : roomNumber || classroomName,
        status: 'scheduled',
      },
    ]);
  };

  const runConflictCheck = async (): Promise<boolean> => {
    setCheckingConflicts(true);
    setError(null);
    try {
      const instructorIds = Array.from(
        new Set([
          mainInstructorId,
          ...(assistantInstructorId ? [assistantInstructorId] : []),
          ...coTeachers.map((c) => c.instructorId),
        ].filter(Boolean))
      );
      const res = await apiFetch<{ hasConflicts: boolean; conflicts: { message: string }[] }>(
        '/api/portal/batches/check-conflicts',
        {
          method: 'POST',
          body: JSON.stringify({
            batchId: batch?.id,
            startDate,
            endDate,
            instructorIds,
            classroomKey: batchType !== 'Online' ? roomNumber || classroomName : '',
            schedules,
          }),
        }
      );
      setConflicts(res.conflicts ?? []);
      return !res.hasConflicts;
    } catch {
      return true;
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!courseId || !name.trim() || !code.trim()) {
      setError('Course, Batch Name, and Unique Batch Code are required.');
      setStep(1);
      return;
    }
    if (endDate && endDate < startDate) {
      setError('Batch End Date cannot precede Batch Start Date.');
      setStep(4);
      return;
    }

    setSaving(true);
    try {
      const teacherAssignments: BatchTeacherAssignment[] = [
        {
          instructorId: mainInstructorId,
          role: 'main',
          responsibility: 'Lead Instruction & Syllabus Delivery',
          assignedAt: new Date().toISOString(),
        },
        ...(assistantInstructorId && assistantInstructorId !== mainInstructorId
          ? [
              {
                instructorId: assistantInstructorId,
                role: 'assistant' as const,
                responsibility: 'Attendance, Lab Practice & Grading Support',
                assignedAt: new Date().toISOString(),
              },
            ]
          : []),
        ...coTeachers.filter(
          (t) => t.instructorId !== mainInstructorId && t.instructorId !== assistantInstructorId
        ),
      ];

      const payload = {
        courseId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        branchId,
        description: description.trim(),
        batchType,
        thumbnail,
        lifecycleStatus,
        instructorId: mainInstructorId,
        assistantInstructorId: assistantInstructorId || null,
        teacherAssignments,
        seatLimit: Math.max(1, Number(seatLimit) || 40),
        minStudents: Math.max(0, Number(minStudents) || 0),
        waitlistEnabled,
        enrollmentStartDate,
        enrollmentClosingDate,
        enrollmentDeadline,
        startDate,
        endDate,
        weeklyFrequency: Math.max(1, Number(weeklyFrequency) || schedules.length || 1),
        totalClasses: Math.max(1, Number(totalClasses) || 36),
        classDurationMinutes: Math.max(15, Number(classDurationMinutes) || 90),
        breakMinutes: Math.max(0, Number(breakMinutes) || 0),
        schedules,
        classroom: {
          classroomName,
          building,
          floor,
          roomNumber,
        },
        onlineSettings: {
          platform,
          meetingLink,
          meetingId,
          meetingPassword,
          instructions: onlineInstructions,
        },
        feeSettings: {
          admissionFee: Math.max(0, Number(admissionFee) || 0),
          monthlyFee: Math.max(0, Number(monthlyFee) || 0),
          courseFeeOverride: courseFeeOverride.trim() ? Number(courseFeeOverride) : null,
          installmentEnabled,
          installmentOptions,
          paymentDeadline,
          latePaymentPolicy,
          batchDiscountPercent: Math.max(0, Math.min(90, Number(batchDiscountPercent) || 0)),
        },
      };

      const url = isEditing && batch
        ? `/api/portal/batches/${batch.id}/enterprise`
        : '/api/portal/batches/enterprise';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await apiFetch<{ batch: CourseBatch }>(url, {
        method,
        body: JSON.stringify(payload),
      });
      await onSaved(
        isEditing
          ? `Updated enterprise batch "${res.batch.name}" (${res.batch.code}).`
          : `Created enterprise batch "${res.batch.name}" (${res.batch.code}).`,
        res.batch
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-wizard-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#0F172A] px-6 py-4 text-white">
          <div>
            <h2 id="batch-wizard-title" className="text-base font-bold">
              {isEditing ? `Edit Batch: ${batch?.name}` : 'Create Enterprise Batch (6-Step Wizard)'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-300">
              Configure course link, faculty, capacity, conflict-free schedule, room/meeting &amp; fees
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close batch wizard"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-50 px-6 py-3">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const active = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : done
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>
                  {s.id}. {s.label}
                </span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: BASIC INFO */}
            {step === 1 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="bw-course" className="mb-1 block text-xs font-semibold text-slate-700">
                    Parent Course *
                  </label>
                  <select
                    id="bw-course"
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bw-name" className="mb-1 block text-xs font-semibold text-slate-700">
                    Batch Name *
                  </label>
                  <input
                    id="bw-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. HSC 27 Mirpur Morning Alpha"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="bw-code" className="mb-1 block text-xs font-semibold text-slate-700">
                    Unique Batch Code *
                  </label>
                  <input
                    id="bw-code"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. HSC27-MPR-01"
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm uppercase"
                  />
                </div>
                <div>
                  <label htmlFor="bw-type" className="mb-1 block text-xs font-semibold text-slate-700">
                    Batch Type
                  </label>
                  <select
                    id="bw-type"
                    value={batchType}
                    onChange={(e) =>
                      setBatchType(e.target.value as 'Offline' | 'Online' | 'Hybrid')
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    <option value="Offline">Offline (Classroom)</option>
                    <option value="Online">Online (Live Virtual)</option>
                    <option value="Hybrid">Hybrid (Branch + Live)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bw-branch" className="mb-1 block text-xs font-semibold text-slate-700">
                    Campus Branch
                  </label>
                  <select
                    id="bw-branch"
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
                  <label htmlFor="bw-status" className="mb-1 block text-xs font-semibold text-slate-700">
                    Lifecycle Status
                  </label>
                  <select
                    id="bw-status"
                    value={lifecycleStatus}
                    onChange={(e) => setLifecycleStatus(e.target.value as BatchLifecycleStatus)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                  >
                    {(Object.keys(BATCH_LIFECYCLE_LABELS) as BatchLifecycleStatus[]).map((st) => (
                      <option key={st} value={st}>
                        {BATCH_LIFECYCLE_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="bw-thumb" className="mb-1 block text-xs font-semibold text-slate-700">
                    Batch Thumbnail URL
                  </label>
                  <input
                    id="bw-thumb"
                    type="text"
                    value={thumbnail}
                    onChange={(e) => setThumbnail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bw-desc" className="mb-1 block text-xs font-semibold text-slate-700">
                    Batch Description
                  </label>
                  <textarea
                    id="bw-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Cohort objectives, exam focus, and classroom instructions..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: TEACHER ASSIGNMENT */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="bw-main-t" className="mb-1 block text-xs font-semibold text-slate-700">
                      Main Teacher *
                    </label>
                    <select
                      id="bw-main-t"
                      value={mainInstructorId}
                      onChange={(e) => setMainInstructorId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      {instructors.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} — {i.subject}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bw-asst-t" className="mb-1 block text-xs font-semibold text-slate-700">
                      Assistant Teacher (Optional)
                    </label>
                    <select
                      id="bw-asst-t"
                      value={assistantInstructorId}
                      onChange={(e) => setAssistantInstructorId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                    >
                      <option value="">None</option>
                      {instructors
                        .filter((i) => i.id !== mainInstructorId)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} — {i.subject}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-900">
                      Additional Co-Teachers &amp; Responsibilities
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const avail = instructors.find(
                          (i) =>
                            i.id !== mainInstructorId &&
                            i.id !== assistantInstructorId &&
                            !coTeachers.some((c) => c.instructorId === i.id)
                        );
                        if (!avail) return;
                        setCoTeachers((prev) => [
                          ...prev,
                          {
                            instructorId: avail.id,
                            role: 'co_teacher',
                            responsibility: 'Weekly Mock Test & Feedback',
                            assignedAt: new Date().toISOString(),
                          },
                        ]);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Co-Teacher</span>
                    </button>
                  </div>
                  {coTeachers.length === 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      No additional co-teachers added. Main &amp; Assistant teachers are assigned above.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {coTeachers.map((ct, idx) => (
                        <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-12 items-center">
                          <select
                            aria-label={`Co-teacher ${idx + 1}`}
                            value={ct.instructorId}
                            onChange={(e) =>
                              setCoTeachers((prev) =>
                                prev.map((row, rIdx) =>
                                  rIdx === idx ? { ...row, instructorId: e.target.value } : row
                                )
                              )
                            }
                            className="sm:col-span-5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                          >
                            {instructors.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={ct.responsibility}
                            onChange={(e) =>
                              setCoTeachers((prev) =>
                                prev.map((row, rIdx) =>
                                  rIdx === idx ? { ...row, responsibility: e.target.value } : row
                                )
                              )
                            }
                            placeholder="Responsibility..."
                            className="sm:col-span-6 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            aria-label="Remove co-teacher"
                            onClick={() =>
                              setCoTeachers((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                            }
                            className="sm:col-span-1 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 3: STUDENT CAPACITY */}
            {step === 3 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="bw-cap" className="mb-1 block text-xs font-semibold text-slate-700">
                    Maximum Seat Capacity *
                  </label>
                  <input
                    id="bw-cap"
                    type="number"
                    min={1}
                    value={seatLimit}
                    onChange={(e) => setSeatLimit(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="bw-min" className="mb-1 block text-xs font-semibold text-slate-700">
                    Minimum Student Requirement
                  </label>
                  <input
                    id="bw-min"
                    type="number"
                    min={0}
                    value={minStudents}
                    onChange={(e) => setMinStudents(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={waitlistEnabled}
                      onChange={(e) => setWaitlistEnabled(e.target.checked)}
                    />
                    Enable Waiting List when full
                  </label>
                </div>
                <div>
                  <label htmlFor="bw-es" className="mb-1 block text-xs font-semibold text-slate-700">
                    Enrollment Start Date
                  </label>
                  <input
                    id="bw-es"
                    type="date"
                    value={enrollmentStartDate}
                    onChange={(e) => setEnrollmentStartDate(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bw-ec" className="mb-1 block text-xs font-semibold text-slate-700">
                    Enrollment Closing Date
                  </label>
                  <input
                    id="bw-ec"
                    type="date"
                    value={enrollmentClosingDate}
                    onChange={(e) => setEnrollmentClosingDate(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bw-edl" className="mb-1 block text-xs font-semibold text-slate-700">
                    Enrollment Deadline
                  </label>
                  <input
                    id="bw-edl"
                    type="date"
                    value={enrollmentDeadline}
                    onChange={(e) => setEnrollmentDeadline(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                {batch && (
                  <div className="sm:col-span-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    Current Enrolled: <strong className="font-mono tabular-nums">{batch.enrolledSeats}</strong> ·
                    Available Seats:{' '}
                    <strong className="font-mono tabular-nums">
                      {Math.max(0, Number(seatLimit || 0) - batch.enrolledSeats)}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: SCHEDULE & CONFLICT CHECK */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                  <div className="sm:col-span-2">
                    <label htmlFor="bw-sd" className="mb-1 block text-xs font-semibold text-slate-700">
                      Batch Start Date *
                    </label>
                    <input
                      id="bw-sd"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="bw-ed" className="mb-1 block text-xs font-semibold text-slate-700">
                      Batch End Date
                    </label>
                    <input
                      id="bw-ed"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="bw-wf" className="mb-1 block text-xs font-semibold text-slate-700">
                      Classes/Wk
                    </label>
                    <input
                      id="bw-wf"
                      type="number"
                      min={1}
                      max={7}
                      value={weeklyFrequency}
                      onChange={(e) => setWeeklyFrequency(e.target.value)}
                      className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label htmlFor="bw-tc" className="mb-1 block text-xs font-semibold text-slate-700">
                      Total Classes
                    </label>
                    <input
                      id="bw-tc"
                      type="number"
                      min={1}
                      value={totalClasses}
                      onChange={(e) => setTotalClasses(e.target.value)}
                      className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="bw-dur" className="mb-1 block text-xs font-semibold text-slate-700">
                      Class Duration (minutes)
                    </label>
                    <input
                      id="bw-dur"
                      type="number"
                      min={15}
                      value={classDurationMinutes}
                      onChange={(e) => setClassDurationMinutes(e.target.value)}
                      className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor="bw-brk" className="mb-1 block text-xs font-semibold text-slate-700">
                      Break Time (minutes)
                    </label>
                    <input
                      id="bw-brk"
                      type="number"
                      min={0}
                      value={breakMinutes}
                      onChange={(e) => setBreakMinutes(e.target.value)}
                      className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-slate-900">
                      Weekly Class Schedule Slots ({schedules.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void runConflictCheck()}
                        disabled={checkingConflicts}
                        className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        {checkingConflicts ? 'Checking...' : 'Check Teacher & Room Conflicts'}
                      </button>
                      <button
                        type="button"
                        onClick={addScheduleSlot}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add Class Slot</span>
                      </button>
                    </div>
                  </div>

                  {conflicts.length > 0 && (
                    <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 space-y-1">
                      {conflicts.map((c, idx) => (
                        <p key={idx} className="font-semibold">
                          Conflict: {c.message}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 space-y-2.5">
                    {schedules.map((slot, idx) => (
                      <div
                        key={slot.id}
                        className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12 items-center"
                      >
                        <select
                          aria-label={`Slot ${idx + 1} Day`}
                          value={slot.dayOfWeek}
                          onChange={(e) =>
                            setSchedules((prev) =>
                              prev.map((s, i) =>
                                i === idx ? { ...s, dayOfWeek: e.target.value as BatchWeekDay } : s
                              )
                            )
                          }
                          className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"
                        >
                          {BATCH_WEEK_DAYS.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <input
                          type="time"
                          aria-label={`Slot ${idx + 1} Start Time`}
                          value={slot.startTime}
                          onChange={(e) =>
                            setSchedules((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, startTime: e.target.value } : s))
                            )
                          }
                          className="font-mono tabular-nums sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        />
                        <input
                          type="time"
                          aria-label={`Slot ${idx + 1} End Time`}
                          value={slot.endTime}
                          onChange={(e) =>
                            setSchedules((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, endTime: e.target.value } : s))
                            )
                          }
                          className="font-mono tabular-nums sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={slot.roomLabel || ''}
                          placeholder="Room / Link label"
                          onChange={(e) =>
                            setSchedules((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, roomLabel: e.target.value } : s))
                            )
                          }
                          className="sm:col-span-3 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <input
                          type="text"
                          value={slot.title || ''}
                          placeholder="Session title"
                          onChange={(e) =>
                            setSchedules((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, title: e.target.value } : s))
                            )
                          }
                          className="sm:col-span-2 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                        />
                        <button
                          type="button"
                          aria-label={`Delete slot ${idx + 1}`}
                          onClick={() => setSchedules((prev) => prev.filter((_, i) => i !== idx))}
                          className="sm:col-span-1 flex justify-center text-rose-600 hover:text-rose-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: CLASSROOM / ONLINE SETTINGS */}
            {step === 5 && (
              <div className="space-y-5">
                {batchType !== 'Online' && (
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <MapPin className="h-4 w-4 text-indigo-600" />
                      <span>Offline Classroom Details</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      <div>
                        <label htmlFor="bw-clname" className="mb-1 block text-xs font-semibold text-slate-700">
                          Classroom Name
                        </label>
                        <input
                          id="bw-clname"
                          type="text"
                          value={classroomName}
                          onChange={(e) => setClassroomName(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="bw-bld" className="mb-1 block text-xs font-semibold text-slate-700">
                          Building
                        </label>
                        <input
                          id="bw-bld"
                          type="text"
                          value={building}
                          onChange={(e) => setBuilding(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="bw-flr" className="mb-1 block text-xs font-semibold text-slate-700">
                          Floor
                        </label>
                        <input
                          id="bw-flr"
                          type="text"
                          value={floor}
                          onChange={(e) => setFloor(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="bw-room" className="mb-1 block text-xs font-semibold text-slate-700">
                          Room Number
                        </label>
                        <input
                          id="bw-room"
                          type="text"
                          value={roomNumber}
                          onChange={(e) => setRoomNumber(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {batchType !== 'Offline' && (
                  <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <Video className="h-4 w-4 text-indigo-600" />
                      <span>Online Meeting Credentials (Protected from non-enrolled users)</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor="bw-plat" className="mb-1 block text-xs font-semibold text-slate-700">
                          Meeting Platform
                        </label>
                        <select
                          id="bw-plat"
                          value={platform}
                          onChange={(e) => setPlatform(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                        >
                          <option value="Zoom">Zoom</option>
                          <option value="Google Meet">Google Meet</option>
                          <option value="Microsoft Teams">Microsoft Teams</option>
                          <option value="Alom Live">Alom Live Studio</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="bw-mlink" className="mb-1 block text-xs font-semibold text-slate-700">
                          Meeting Link
                        </label>
                        <input
                          id="bw-mlink"
                          type="url"
                          value={meetingLink}
                          onChange={(e) => setMeetingLink(e.target.value)}
                          placeholder="https://zoom.us/j/..."
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="bw-mid" className="mb-1 block text-xs font-semibold text-slate-700">
                          Meeting ID
                        </label>
                        <input
                          id="bw-mid"
                          type="text"
                          value={meetingId}
                          onChange={(e) => setMeetingId(e.target.value)}
                          placeholder="845 9201 3341"
                          className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label htmlFor="bw-mpass" className="mb-1 block text-xs font-semibold text-slate-700">
                          Meeting Password
                        </label>
                        <input
                          id="bw-mpass"
                          type="text"
                          value={meetingPassword}
                          onChange={(e) => setMeetingPassword(e.target.value)}
                          placeholder="Protected credential"
                          className="font-mono w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="bw-minst" className="mb-1 block text-xs font-semibold text-slate-700">
                          Online Class Instructions
                        </label>
                        <textarea
                          id="bw-minst"
                          rows={2}
                          value={onlineInstructions}
                          onChange={(e) => setOnlineInstructions(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: FEE & PAYMENT SETTINGS */}
            {step === 6 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="bw-admfee" className="mb-1 block text-xs font-semibold text-slate-700">
                    Batch Admission Fee (৳)
                  </label>
                  <input
                    id="bw-admfee"
                    type="number"
                    min={0}
                    value={admissionFee}
                    onChange={(e) => setAdmissionFee(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bw-monfee" className="mb-1 block text-xs font-semibold text-slate-700">
                    Monthly Fee (৳)
                  </label>
                  <input
                    id="bw-monfee"
                    type="number"
                    min={0}
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bw-ovrfee" className="mb-1 block text-xs font-semibold text-slate-700">
                    Course Fee Override (৳, optional)
                  </label>
                  <input
                    id="bw-ovrfee"
                    type="number"
                    min={0}
                    value={courseFeeOverride}
                    onChange={(e) => setCourseFeeOverride(e.target.value)}
                    placeholder="Inherit course price"
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bw-disc" className="mb-1 block text-xs font-semibold text-slate-700">
                    Batch Discount (%)
                  </label>
                  <input
                    id="bw-disc"
                    type="number"
                    min={0}
                    max={90}
                    value={batchDiscountPercent}
                    onChange={(e) => setBatchDiscountPercent(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="bw-pdl" className="mb-1 block text-xs font-semibold text-slate-700">
                    Payment Deadline
                  </label>
                  <input
                    id="bw-pdl"
                    type="date"
                    value={paymentDeadline}
                    onChange={(e) => setPaymentDeadline(e.target.value)}
                    className="font-mono tabular-nums w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={installmentEnabled}
                      onChange={(e) => setInstallmentEnabled(e.target.checked)}
                    />
                    Allow Installment Payments
                  </label>
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="bw-instopt" className="mb-1 block text-xs font-semibold text-slate-700">
                    Installment Plan Details
                  </label>
                  <input
                    id="bw-instopt"
                    type="text"
                    value={installmentOptions}
                    onChange={(e) => setInstallmentOptions(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="bw-latepol" className="mb-1 block text-xs font-semibold text-slate-700">
                    Late Payment Policy
                  </label>
                  <input
                    id="bw-latepol"
                    type="text"
                    value={latePaymentPolicy}
                    onChange={(e) => setLatePaymentPolicy(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5 | 6)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  Previous
                </button>
              )}
              {step < 6 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (step === 4) {
                      const clean = await runConflictCheck();
                      if (!clean) return;
                    }
                    setStep((s) => Math.min(6, s + 1) as 1 | 2 | 3 | 4 | 5 | 6);
                  }}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap shrink-0"
                >
                  Next Step
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 whitespace-nowrap shrink-0"
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
