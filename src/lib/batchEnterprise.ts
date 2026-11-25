import type {
  AttendanceRecord,
  BatchLifecycleStatus,
  BatchScheduleSlot,
  BatchWeekDay,
  CategoryItem,
  Course,
  CourseBatch,
  CourseLesson,
  Enrollment,
  Exam,
  Instructor,
  PaymentTransaction,
  User,
} from '../types';
import { computeBatchSeatUsage } from './domain';

function computeSafeSeatMetrics(batch: Pick<CourseBatch, 'seatLimit' | 'enrolledSeats'>): {
  seatLimit: number;
  enrolledSeats: number;
  remainingSeats: number;
  fillPercent: number;
  isFull: boolean;
} {
  const seatLimit = Math.max(1, Number(batch.seatLimit) || 1);
  const enrolledSeats = Math.max(0, Number(batch.enrolledSeats) || 0);
  const remainingSeats = Math.max(0, seatLimit - enrolledSeats);
  const fillPercent = Math.min(100, Math.round((enrolledSeats / seatLimit) * 100));
  return {
    seatLimit,
    enrolledSeats,
    remainingSeats,
    fillPercent,
    isFull: enrolledSeats >= seatLimit,
  };
}

export const DEFAULT_COURSE_CATEGORIES = [
  'HSC English',
  'SSC English',
  'IELTS & Spoken',
  'Grammar Pro',
  'Admission',
  'Combo Packs',
];

export const BATCH_LIFECYCLE_LABELS: Record<BatchLifecycleStatus, string> = {
  draft: 'Draft',
  upcoming: 'Upcoming',
  enrollment_open: 'Enrollment Open',
  enrollment_closed: 'Enrollment Closed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  archived: 'Archived',
};

export const BATCH_WEEK_DAYS: BatchWeekDay[] = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export function resolveCourseCategories(
  categories: CategoryItem[] = [],
  courses: Pick<Course, 'category'>[] = []
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushUnique = (name: string | undefined) => {
    const clean = String(name ?? '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  for (const cat of categories) {
    if (cat.type === 'course' && cat.active !== false) {
      pushUnique(cat.name);
    }
  }
  for (const fallback of DEFAULT_COURSE_CATEGORIES) {
    pushUnique(fallback);
  }
  for (const course of courses) {
    pushUnique(course.category);
  }

  return result;
}

export function mapLegacyStatusToLifecycle(
  status: CourseBatch['status'] | string | undefined
): BatchLifecycleStatus {
  if (status === 'running') return 'active';
  if (status === 'closed') return 'enrollment_closed';
  return 'enrollment_open';
}

export function normalizeBatchLifecycle(
  batch: Pick<CourseBatch, 'status' | 'lifecycleStatus'>
): BatchLifecycleStatus {
  if (batch.lifecycleStatus) return batch.lifecycleStatus;
  return mapLegacyStatusToLifecycle(batch.status);
}

export function syncLegacyStatusFromLifecycle(
  lifecycle: BatchLifecycleStatus
): CourseBatch['status'] {
  if (lifecycle === 'active') return 'running';
  if (
    lifecycle === 'enrollment_closed' ||
    lifecycle === 'completed' ||
    lifecycle === 'cancelled' ||
    lifecycle === 'archived'
  ) {
    return 'closed';
  }
  return 'open';
}

export function isBatchAcceptingEnrollment(
  batch: Pick<CourseBatch, 'status' | 'lifecycleStatus' | 'enrollmentDeadline' | 'seatLimit' | 'enrolledSeats'>,
  nowIso: string = new Date().toISOString()
): { ok: true } | { ok: false; reason: string } {
  const lifecycle = normalizeBatchLifecycle(batch);
  if (
    lifecycle === 'draft' ||
    lifecycle === 'enrollment_closed' ||
    lifecycle === 'completed' ||
    lifecycle === 'cancelled' ||
    lifecycle === 'archived'
  ) {
    return {
      ok: false,
      reason: `Batch is currently ${BATCH_LIFECYCLE_LABELS[lifecycle]} and not accepting enrollments.`,
    };
  }
  if (batch.enrollmentDeadline) {
    const raw = batch.enrollmentDeadline.trim();
    const deadlineIso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T23:59:59.999Z` : raw;
    const dlMs = Date.parse(deadlineIso);
    const nowMs = Date.parse(nowIso);
    if (Number.isFinite(dlMs) && Number.isFinite(nowMs) && nowMs > dlMs) {
      return {
        ok: false,
        reason: `Batch enrollment deadline (${batch.enrollmentDeadline}) has passed.`,
      };
    }
  }
  const usage = computeSafeSeatMetrics(batch);
  if (usage.isFull) {
    return {
      ok: false,
      reason: 'Batch seat capacity is full.',
    };
  }
  return { ok: true };
}

export function parseTimeToMinutes(timeStr: string | undefined): number | null {
  const raw = String(timeStr ?? '').trim();
  if (!raw) return null;

  // Support 24h "16:30" and 12h "4:30 PM"
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (m24) {
    const hh = Number(m24[1]);
    const mm = Number(m24[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return hh * 60 + mm;
  }
  const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(raw);
  if (m12) {
    let hh = Number(m12[1]);
    const mm = Number(m12[2]);
    const ampm = m12[3].toUpperCase();
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    if (ampm === 'PM' && hh !== 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
    return hh * 60 + mm;
  }
  return null;
}

export function doTimeWindowsOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const s1 = parseTimeToMinutes(aStart);
  const e1 = parseTimeToMinutes(aEnd);
  const s2 = parseTimeToMinutes(bStart);
  const e2 = parseTimeToMinutes(bEnd);
  if (s1 === null || e1 === null || s2 === null || e2 === null) return false;
  if (e1 <= s1 || e2 <= s2) return false;
  return s1 < e2 && s2 < e1;
}

export function doDateRangesOverlap(
  aStart?: string,
  aEnd?: string,
  bStart?: string,
  bEnd?: string
): boolean {
  const s1 = aStart ? Date.parse(aStart) : Number.NEGATIVE_INFINITY;
  const e1 = aEnd ? Date.parse(aEnd) : Number.POSITIVE_INFINITY;
  const s2 = bStart ? Date.parse(bStart) : Number.NEGATIVE_INFINITY;
  const e2 = bEnd ? Date.parse(bEnd) : Number.POSITIVE_INFINITY;
  if (
    !Number.isFinite(s1) && s1 !== Number.NEGATIVE_INFINITY ||
    !Number.isFinite(e1) && e1 !== Number.POSITIVE_INFINITY ||
    !Number.isFinite(s2) && s2 !== Number.NEGATIVE_INFINITY ||
    !Number.isFinite(e2) && e2 !== Number.POSITIVE_INFINITY
  ) {
    return true;
  }
  return s1 <= e2 && s2 <= e1;
}

export function getBatchAssignedInstructorIds(batch: Partial<CourseBatch>): string[] {
  const ids = new Set<string>();
  if (batch.instructorId) ids.add(batch.instructorId);
  if (batch.assistantInstructorId) ids.add(batch.assistantInstructorId);
  for (const t of batch.teacherAssignments ?? []) {
    if (t.instructorId) ids.add(t.instructorId);
  }
  return Array.from(ids);
}

export function getTeacherAssignedBatches(
  actor: Pick<User, 'id' | 'name' | 'role'>,
  batches: CourseBatch[],
  instructors: Instructor[]
): CourseBatch[] {
  if (actor.role !== 'teacher') return batches;
  const myInstIds = new Set(
    instructors
      .filter(
        (i) =>
          i.userId === actor.id ||
          i.name.trim().toLowerCase() === actor.name.trim().toLowerCase()
      )
      .map((i) => i.id)
  );

  return batches.filter((b) => {
    const assignedIds = getBatchAssignedInstructorIds(b);
    return assignedIds.some((id) => myInstIds.has(id));
  });
}

export function getEffectiveBatchSlots(batch: CourseBatch): BatchScheduleSlot[] {
  if (batch.schedules && batch.schedules.length > 0) {
    return batch.schedules;
  }
  // Parse legacy schedule text like "Sun · Tue · Thu — 4:30 PM"
  const raw = String(batch.schedule ?? '');
  const foundDays = BATCH_WEEK_DAYS.filter((d) => new RegExp(`\\b${d}\\b`, 'i').test(raw));
  const timeMatch = /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i.exec(raw);
  const startMin = timeMatch ? parseTimeToMinutes(timeMatch[1]) : null;
  if (foundDays.length === 0 || startMin === null) return [];

  const duration = Math.max(30, batch.classDurationMinutes || 60);
  const endMin = Math.min(23 * 60 + 59, startMin + duration);
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return foundDays.map((day, idx) => ({
    id: `legacy-${batch.id}-${idx}`,
    dayOfWeek: day,
    startTime: fmt(startMin),
    endTime: fmt(endMin),
    durationMinutes: duration,
    instructorId: batch.instructorId,
    roomLabel: batch.classroom?.roomNumber || batch.classroomOrMeeting || undefined,
    status: 'scheduled',
  }));
}

export interface ScheduleConflictItem {
  kind: 'teacher' | 'classroom' | 'batch_internal';
  conflictingBatchId: string;
  conflictingBatchName: string;
  dayOfWeek: BatchWeekDay;
  slotTime: string;
  message: string;
}

export function detectScheduleConflicts(params: {
  candidateBatchId?: string;
  candidateStartDate?: string;
  candidateEndDate?: string;
  candidateInstructorIds: string[];
  candidateClassroomKey?: string;
  candidateSlots: BatchScheduleSlot[];
  existingBatches: CourseBatch[];
}): ScheduleConflictItem[] {
  const {
    candidateBatchId,
    candidateStartDate,
    candidateEndDate,
    candidateInstructorIds,
    candidateClassroomKey,
    candidateSlots,
    existingBatches,
  } = params;

  const conflicts: ScheduleConflictItem[] = [];
  const activeCandidateSlots = candidateSlots.filter((s) => s.status !== 'cancelled');

  // 1. Check internal overlaps within candidateSlots themselves
  for (let i = 0; i < activeCandidateSlots.length; i += 1) {
    for (let j = i + 1; j < activeCandidateSlots.length; j += 1) {
      const a = activeCandidateSlots[i];
      const b = activeCandidateSlots[j];
      if (a.dayOfWeek !== b.dayOfWeek) continue;
      if (a.sessionDate && b.sessionDate && a.sessionDate !== b.sessionDate) continue;
      if (doTimeWindowsOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
        conflicts.push({
          kind: 'batch_internal',
          conflictingBatchId: candidateBatchId || 'new-batch',
          conflictingBatchName: 'Current Batch',
          dayOfWeek: a.dayOfWeek,
          slotTime: `${a.startTime}–${a.endTime}`,
          message: `Internal schedule overlap on ${a.dayOfWeek} (${a.startTime}–${a.endTime} overlaps ${b.startTime}–${b.endTime}).`,
        });
      }
    }
  }

  const normCandidateRoom = String(candidateClassroomKey ?? '').trim().toLowerCase();

  // 2. Check against other active/upcoming/open batches
  for (const other of existingBatches) {
    if (candidateBatchId && other.id === candidateBatchId) continue;
    const otherLifecycle = normalizeBatchLifecycle(other);
    if (
      otherLifecycle === 'cancelled' ||
      otherLifecycle === 'completed' ||
      otherLifecycle === 'archived'
    ) {
      continue;
    }

    if (!doDateRangesOverlap(candidateStartDate, candidateEndDate, other.startDate, other.endDate)) {
      continue;
    }

    const otherBatchInstructors = new Set(getBatchAssignedInstructorIds(other));
    const otherRoomKey = String(
      other.classroom?.roomNumber ||
        other.classroom?.classroomName ||
        (other.mode !== 'Online Live' ? other.classroomOrMeeting : '') ||
        ''
    )
      .trim()
      .toLowerCase();

    const otherSlots = getEffectiveBatchSlots(other).filter((s) => s.status !== 'cancelled');

    for (const cSlot of activeCandidateSlots) {
      const slotInstructors = new Set(candidateInstructorIds);
      if (cSlot.instructorId) slotInstructors.add(cSlot.instructorId);

      for (const oSlot of otherSlots) {
        if (cSlot.dayOfWeek !== oSlot.dayOfWeek) continue;
        if (cSlot.sessionDate && oSlot.sessionDate && cSlot.sessionDate !== oSlot.sessionDate) continue;
        if (!doTimeWindowsOverlap(cSlot.startTime, cSlot.endTime, oSlot.startTime, oSlot.endTime)) {
          continue;
        }

        const otherSlotInstructors = new Set(otherBatchInstructors);
        if (oSlot.instructorId) otherSlotInstructors.add(oSlot.instructorId);

        const sharedTeacher = Array.from(slotInstructors).find((id) =>
          otherSlotInstructors.has(id)
        );
        if (sharedTeacher) {
          conflicts.push({
            kind: 'teacher',
            conflictingBatchId: other.id,
            conflictingBatchName: other.name,
            dayOfWeek: cSlot.dayOfWeek,
            slotTime: `${cSlot.startTime}–${cSlot.endTime}`,
            message: `Teacher schedule conflict on ${cSlot.dayOfWeek} (${cSlot.startTime}–${cSlot.endTime}) with batch "${other.name}" (${other.code}).`,
          });
        }

        const cRoom = String(cSlot.roomLabel || normCandidateRoom).trim().toLowerCase();
        const oRoom = String(oSlot.roomLabel || otherRoomKey).trim().toLowerCase();
        if (cRoom && oRoom && cRoom === oRoom) {
          conflicts.push({
            kind: 'classroom',
            conflictingBatchId: other.id,
            conflictingBatchName: other.name,
            dayOfWeek: cSlot.dayOfWeek,
            slotTime: `${cSlot.startTime}–${cSlot.endTime}`,
            message: `Classroom "${cRoom}" conflict on ${cSlot.dayOfWeek} (${cSlot.startTime}–${cSlot.endTime}) with batch "${other.name}".`,
          });
        }
      }
    }
  }

  return conflicts;
}

export interface BatchCapacitySummary {
  maxCapacity: number;
  minRequirement: number;
  enrolledSeats: number;
  availableSeats: number;
  fillPercent: number;
  waitlistCount: number;
  isFull: boolean;
  meetsMinimum: boolean;
}

export function computeBatchCapacitySummary(
  batch: Pick<CourseBatch, 'seatLimit' | 'minStudents' | 'enrolledSeats'>,
  waitlistCount: number = 0
): BatchCapacitySummary {
  const usage = computeSafeSeatMetrics(batch);
  const minRequirement = Math.max(0, Math.round(Number(batch.minStudents) || 0));
  return {
    maxCapacity: usage.seatLimit,
    minRequirement,
    enrolledSeats: usage.enrolledSeats,
    availableSeats: usage.remainingSeats,
    fillPercent: usage.fillPercent,
    waitlistCount: Math.max(0, waitlistCount),
    isFull: usage.isFull,
    meetsMinimum: usage.enrolledSeats >= minRequirement,
  };
}

export function validateBatchStudentAddition(params: {
  batch: CourseBatch | undefined;
  course: Course | undefined;
  student: User | undefined;
  enrollments: Enrollment[];
  nowIso?: string;
}): { ok: true } | { ok: false; statusCode: number; error: string } {
  const { batch, course, student, enrollments, nowIso = new Date().toISOString() } = params;
  if (!batch) {
    return { ok: false, statusCode: 404, error: 'Target batch not found.' };
  }
  if (!course || batch.courseId !== course.id) {
    return { ok: false, statusCode: 400, error: 'Batch does not belong to an active valid course.' };
  }
  if (!student) {
    return { ok: false, statusCode: 404, error: 'Student account not found.' };
  }
  if (student.role !== 'student') {
    return {
      ok: false,
      statusCode: 403,
      error: `Only student accounts can be enrolled in a batch (found role: ${student.role}).`,
    };
  }
  if (student.status === 'suspended') {
    return {
      ok: false,
      statusCode: 403,
      error: `Student "${student.name}" is suspended and ineligible for batch enrollment.`,
    };
  }

  const dupSameBatch = enrollments.find(
    (e) =>
      e.userId === student.id &&
      e.batchId === batch.id &&
      (e.status === 'approved' || e.status === 'pending')
  );
  if (dupSameBatch) {
    return {
      ok: false,
      statusCode: 409,
      error: `${student.name} already has an active or pending enrollment in "${batch.name}".`,
    };
  }

  const dupSameCourse = enrollments.find(
    (e) =>
      e.userId === student.id &&
      e.courseId === course.id &&
      (e.status === 'approved' || e.status === 'pending')
  );
  if (dupSameCourse) {
    return {
      ok: false,
      statusCode: 409,
      error: `${student.name} is already enrolled in "${course.title}" (${dupSameCourse.batchName || 'another batch'}). Use Transfer Student to move them safely.`,
    };
  }

  const acceptCheck = isBatchAcceptingEnrollment(batch, nowIso);
  if (!acceptCheck.ok) {
    return {
      ok: false,
      statusCode: acceptCheck.reason.includes('capacity') ? 409 : 400,
      error: acceptCheck.reason,
    };
  }

  return { ok: true };
}

export function validateBatchTransfer(params: {
  enrollment: Enrollment | undefined;
  sourceBatch: CourseBatch | undefined;
  targetBatch: CourseBatch | undefined;
  targetCourse: Course | undefined;
  enrollments: Enrollment[];
}): { ok: true } | { ok: false; statusCode: number; error: string } {
  const { enrollment, sourceBatch, targetBatch, targetCourse, enrollments } = params;
  if (!enrollment) {
    return { ok: false, statusCode: 404, error: 'Enrollment record not found.' };
  }
  if (enrollment.status === 'cancelled' || enrollment.status === 'rejected') {
    return {
      ok: false,
      statusCode: 400,
      error: `Cannot transfer a ${enrollment.status} enrollment.`,
    };
  }
  if (!targetBatch || !targetCourse) {
    return { ok: false, statusCode: 404, error: 'Target batch or course not found.' };
  }
  if (targetBatch.courseId !== targetCourse.id) {
    return { ok: false, statusCode: 400, error: 'Target batch does not belong to target course.' };
  }
  if (sourceBatch && sourceBatch.id === targetBatch.id) {
    return { ok: false, statusCode: 400, error: 'Student is already in the selected target batch.' };
  }
  const targetLifecycle = normalizeBatchLifecycle(targetBatch);
  if (
    targetLifecycle === 'cancelled' ||
    targetLifecycle === 'completed' ||
    targetLifecycle === 'archived' ||
    targetLifecycle === 'draft'
  ) {
    return {
      ok: false,
      statusCode: 400,
      error: `Target batch "${targetBatch.name}" is ${BATCH_LIFECYCLE_LABELS[targetLifecycle]} and cannot receive transfers.`,
    };
  }
  if (computeBatchSeatUsage(targetBatch).isFull) {
    return {
      ok: false,
      statusCode: 409,
      error: `Target batch "${targetBatch.name}" is at full seat capacity.`,
    };
  }

  const conflictOther = enrollments.find(
    (e) =>
      e.id !== enrollment.id &&
      e.userId === enrollment.userId &&
      e.batchId === targetBatch.id &&
      (e.status === 'approved' || e.status === 'pending')
  );
  if (conflictOther) {
    return {
      ok: false,
      statusCode: 409,
      error: 'Student already has an active enrollment in the target batch.',
    };
  }
  return { ok: true };
}

export function canDeleteBatch(params: {
  batch: CourseBatch;
  enrollments: Enrollment[];
  attendance: AttendanceRecord[];
  transactions: PaymentTransaction[];
  lessons?: CourseLesson[];
  exams?: Exam[];
}): { allowed: true } | { allowed: false; reason: string; dependencyCount: number } {
  const { batch, enrollments, attendance, transactions } = params;
  const linkedEnrollments = enrollments.filter((e) => e.batchId === batch.id);
  const linkedAttendance = attendance.filter((a) => a.batchId === batch.id);
  const linkedEnrollmentIds = new Set(linkedEnrollments.map((e) => e.id));
  const linkedPayments = transactions.filter(
    (t) => t.referenceType === 'course' && linkedEnrollmentIds.has(t.referenceId)
  );

  const totalDeps = linkedEnrollments.length + linkedAttendance.length + linkedPayments.length;
  if (totalDeps > 0 || batch.enrolledSeats > 0) {
    return {
      allowed: false,
      dependencyCount: Math.max(totalDeps, batch.enrolledSeats),
      reason: `Cannot permanently delete "${batch.name}": ${linkedEnrollments.length} enrollment(s), ${linkedAttendance.length} attendance record(s), and ${linkedPayments.length} payment record(s) depend on it. Archive this batch instead to preserve historical data.`,
    };
  }
  return { allowed: true };
}

export function redactBatchForViewer(
  batch: CourseBatch,
  viewer: Pick<User, 'id' | 'name' | 'role' | 'branchId'> | null | undefined,
  enrollments: Enrollment[] = [],
  instructors: Instructor[] = []
): CourseBatch {
  if (!batch.onlineSettings) return batch;

  const isPrivileged = (() => {
    if (!viewer) return false;
    if (viewer.role === 'admin') return true;
    if (viewer.role === 'teacher') {
      const assigned = getTeacherAssignedBatches(viewer, [batch], instructors);
      if (assigned.length > 0) return true;
    }
    if (viewer.role === 'student') {
      const enrolled = enrollments.some(
        (e) => e.userId === viewer.id && e.batchId === batch.id && e.status === 'approved'
      );
      if (enrolled) return true;
    }
    return false;
  })();

  if (isPrivileged) return batch;

  return {
    ...batch,
    onlineSettings: {
      platform: batch.onlineSettings.platform,
      instructions: batch.onlineSettings.instructions,
      credentialsProtected: true,
    },
  };
}

export interface BatchDashboardKpis {
  totalBatches: number;
  activeBatches: number;
  upcomingBatches: number;
  completedBatches: number;
  cancelledBatches: number;
  totalEnrolledStudents: number;
  availableSeats: number;
  fullBatches: number;
  totalAssignedTeachers: number;
  todaysClasses: number;
}

export interface BatchComparisonRow {
  batchId: string;
  code: string;
  name: string;
  courseTitle: string;
  lifecycle: BatchLifecycleStatus;
  mode: string;
  enrolledSeats: number;
  seatLimit: number;
  fillPercent: number;
  attendanceRate: number;
  revenueCollected: number;
  assignedTeachersCount: number;
}

export function computeBatchDashboardAnalytics(params: {
  batches: CourseBatch[];
  courses: Course[];
  enrollments: Enrollment[];
  attendance: AttendanceRecord[];
  transactions: PaymentTransaction[];
  todayDayName?: BatchWeekDay;
}): {
  kpis: BatchDashboardKpis;
  comparisonRows: BatchComparisonRow[];
  statusBreakdown: { status: BatchLifecycleStatus; label: string; count: number }[];
} {
  const { batches, courses, enrollments, attendance, transactions, todayDayName } = params;
  const dayNames: BatchWeekDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDay = todayDayName ?? dayNames[new Date().getDay()];

  let activeBatches = 0;
  let upcomingBatches = 0;
  let completedBatches = 0;
  let cancelledBatches = 0;
  let totalEnrolledStudents = 0;
  let availableSeats = 0;
  let fullBatches = 0;
  let todaysClasses = 0;
  const uniqueTeacherIds = new Set<string>();
  const statusMap = new Map<BatchLifecycleStatus, number>();

  const comparisonRows: BatchComparisonRow[] = [];

  for (const batch of batches) {
    const lc = normalizeBatchLifecycle(batch);
    statusMap.set(lc, (statusMap.get(lc) ?? 0) + 1);

    if (lc === 'active' || lc === 'enrollment_open') activeBatches += 1;
    if (lc === 'upcoming') upcomingBatches += 1;
    if (lc === 'completed') completedBatches += 1;
    if (lc === 'cancelled') cancelledBatches += 1;

    const usage = computeSafeSeatMetrics(batch);
    totalEnrolledStudents += usage.enrolledSeats;
    availableSeats += usage.remainingSeats;
    if (usage.isFull) fullBatches += 1;

    const teacherIds = getBatchAssignedInstructorIds(batch);
    for (const tid of teacherIds) uniqueTeacherIds.add(tid);

    if (lc === 'active' || lc === 'enrollment_open') {
      const slots = getEffectiveBatchSlots(batch);
      const todaySlots = slots.filter(
        (s) => s.status !== 'cancelled' && s.dayOfWeek === currentDay
      );
      todaysClasses += todaySlots.length;
    }

    const batchAtt = attendance.filter((a) => a.batchId === batch.id && a.targetType === 'student');
    const presentCount = batchAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = batchAtt.length > 0 ? Math.round((presentCount / batchAtt.length) * 100) : 100;

    const batchEnrIds = new Set(enrollments.filter((e) => e.batchId === batch.id).map((e) => e.id));
    const batchEnrRevenue = enrollments
      .filter((e) => e.batchId === batch.id && e.status === 'approved')
      .reduce((s, e) => s + (Number(e.amountPaid) || 0), 0);
    const txnRevenue = transactions
      .filter((t) => t.referenceType === 'course' && batchEnrIds.has(t.referenceId) && t.status === 'completed')
      .reduce((s, t) => s + (Number(t.totalAmount) || 0), 0);

    const course = courses.find((c) => c.id === batch.courseId);
    comparisonRows.push({
      batchId: batch.id,
      code: batch.code,
      name: batch.name,
      courseTitle: course?.title || 'Course',
      lifecycle: lc,
      mode: batch.mode,
      enrolledSeats: usage.enrolledSeats,
      seatLimit: usage.seatLimit,
      fillPercent: usage.fillPercent,
      attendanceRate,
      revenueCollected: Math.max(batchEnrRevenue, txnRevenue),
      assignedTeachersCount: teacherIds.length,
    });
  }

  const statusBreakdown = (Object.keys(BATCH_LIFECYCLE_LABELS) as BatchLifecycleStatus[]).map(
    (status) => ({
      status,
      label: BATCH_LIFECYCLE_LABELS[status],
      count: statusMap.get(status) ?? 0,
    })
  );

  return {
    kpis: {
      totalBatches: batches.length,
      activeBatches,
      upcomingBatches,
      completedBatches,
      cancelledBatches,
      totalEnrolledStudents,
      availableSeats,
      fullBatches,
      totalAssignedTeachers: uniqueTeacherIds.size,
      todaysClasses,
    },
    comparisonRows,
    statusBreakdown,
  };
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function formatBatchStudentsCsv(
  batch: CourseBatch,
  enrollments: Enrollment[],
  attendance: AttendanceRecord[]
): string {
  const headers = [
    'Batch Code',
    'Batch Name',
    'Student Name',
    'Email',
    'Status',
    'Amount Paid (BDT)',
    'Invoice No',
    'Attendance Present',
    'Attendance Total',
    'Enrolled At',
  ];
  const rows = enrollments
    .filter((e) => e.batchId === batch.id)
    .map((e) => {
      const stuAtt = attendance.filter((a) => a.batchId === batch.id && a.targetId === e.userId);
      const present = stuAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
      return [
        batch.code,
        batch.name,
        e.studentName,
        e.studentEmail,
        e.status,
        e.amountPaid,
        e.invoiceNo || '',
        present,
        stuAtt.length,
        e.enrolledAt,
      ]
        .map(escapeCsvCell)
        .join(',');
    });
  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export function formatBatchComparisonCsv(rows: BatchComparisonRow[]): string {
  const headers = [
    'Batch Code',
    'Batch Name',
    'Course',
    'Lifecycle',
    'Mode',
    'Enrolled Seats',
    'Seat Limit',
    'Fill %',
    'Attendance %',
    'Revenue (BDT)',
    'Teachers',
  ];
  const lines = rows.map((r) =>
    [
      r.code,
      r.name,
      r.courseTitle,
      BATCH_LIFECYCLE_LABELS[r.lifecycle],
      r.mode,
      r.enrolledSeats,
      r.seatLimit,
      r.fillPercent,
      r.attendanceRate,
      r.revenueCollected,
      r.assignedTeachersCount,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  return [headers.map(escapeCsvCell).join(','), ...lines].join('\n');
}
