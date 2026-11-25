import type {
  AttendanceRecord,
  Branch,
  CourseLesson,
  Enrollment,
  ExamAttempt,
  LearnerRewardProfile,
  User,
  UserRole,
} from '../types';
import { calculateStudentProgress } from './domain';

export interface UserDirectoryFilters {
  role: 'all' | UserRole;
  branchId: string;
  status: 'all' | 'pending' | 'active' | 'suspended' | 'rejected';
  search: string;
}

export interface UserRoleSummary {
  total: number;
  pending: number;
  active: number;
  suspended: number;
  rejected: number;
  admin: number;
  teacher: number;
  student: number;
  guardian: number;
  branch: number;
}

export function filterUsersDirectory(users: User[], filters: UserDirectoryFilters): User[] {
  const q = filters.search.trim().toLowerCase();
  return users.filter((u) => {
    const status = u.status ?? 'active';
    if (filters.role !== 'all' && u.role !== filters.role) return false;
    if (filters.branchId !== 'all' && (u.branchId ?? '') !== filters.branchId) return false;
    if (filters.status !== 'all' && status !== filters.status) return false;
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone ?? '').toLowerCase().includes(q) ||
      (u.rollNumber ?? '').toLowerCase().includes(q) ||
      (u.subjectSpecialty ?? '').toLowerCase().includes(q) ||
      (u.education ?? '').toLowerCase().includes(q)
    );
  });
}

export function computeUserRoleSummary(users: User[]): UserRoleSummary {
  const summary: UserRoleSummary = {
    total: users.length,
    pending: 0,
    active: 0,
    suspended: 0,
    rejected: 0,
    admin: 0,
    teacher: 0,
    student: 0,
    guardian: 0,
    branch: 0,
  };
  for (const u of users) {
    const status = u.status ?? 'active';
    if (status === 'pending') {
      summary.pending += 1;
    } else if (status === 'suspended') {
      summary.suspended += 1;
    } else if (status === 'rejected') {
      summary.rejected += 1;
    } else {
      summary.active += 1;
    }
    if (
      u.role === 'admin' ||
      u.role === 'teacher' ||
      u.role === 'student' ||
      u.role === 'guardian' ||
      u.role === 'branch'
    ) {
      summary[u.role] += 1;
    }
  }
  return summary;
}

function csvSafeCell(raw: unknown): string {
  const str = String(raw ?? '');
  const trimmed = str.replace(/\r?\n/g, ' ');
  const neutralized = /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

export function formatUsersCsv(users: User[], branches: Branch[]): string {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const header = ['ID', 'Name', 'Email', 'Phone', 'Role', 'Status', 'Branch', 'Roll Number', 'Created At'].join(',');
  const rows = users.map((u) =>
    [
      csvSafeCell(u.id),
      csvSafeCell(u.name),
      csvSafeCell(u.email),
      csvSafeCell(u.phone),
      csvSafeCell(u.role),
      csvSafeCell(u.status ?? 'active'),
      csvSafeCell(u.branchId ? branchMap.get(u.branchId) ?? u.branchId : 'Global / Online'),
      csvSafeCell(u.rollNumber ?? ''),
      csvSafeCell(u.createdAt),
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function recalculateExamAttemptGrade(
  rawScore: number,
  totalMarks: number,
  passPercentage = 40
): { score: number; totalMarks: number; percentage: number; grade: string; passed: boolean } {
  const safeTotal = Math.max(1, Math.round(totalMarks));
  const score = Math.min(safeTotal, Math.max(0, Number(rawScore) || 0));
  const percentage = Math.round((score / safeTotal) * 100);
  const passed = percentage >= passPercentage;

  let grade = 'F';
  if (percentage >= 80) grade = 'A+';
  else if (percentage >= 70) grade = 'A';
  else if (percentage >= 60) grade = 'A-';
  else if (percentage >= 50) grade = 'B';
  else if (percentage >= 40) grade = 'C';
  else if (percentage >= 33) grade = 'D';

  return { score, totalMarks: safeTotal, percentage, grade, passed };
}

export interface TeacherStudentRosterRow {
  studentId: string;
  name: string;
  email: string;
  phone: string;
  rollNumber: string;
  branchId: string | null;
  enrolledCoursesCount: number;
  courseTitles: string[];
  avgLessonProgress: number;
  examsTaken: number;
  avgExamPercent: number;
  presentCount: number;
  absentCount: number;
  xp: number;
  streakDays: number;
}

export function buildTeacherStudentRoster(params: {
  users: User[];
  enrollments: Enrollment[];
  lessons: CourseLesson[];
  examAttempts: ExamAttempt[];
  attendance: AttendanceRecord[];
  rewardsByUser: Record<string, LearnerRewardProfile>;
  courseIdFilter?: string;
  search?: string;
}): TeacherStudentRosterRow[] {
  const {
    users,
    enrollments,
    lessons,
    examAttempts,
    attendance,
    rewardsByUser,
    courseIdFilter = 'all',
    search = '',
  } = params;

  const q = search.trim().toLowerCase();
  const students = users.filter((u) => u.role === 'student');

  const rows: TeacherStudentRosterRow[] = [];

  for (const stu of students) {
    const stuEnrollments = enrollments.filter(
      (e) =>
        e.userId === stu.id &&
        e.status === 'approved' &&
        (courseIdFilter === 'all' || e.courseId === courseIdFilter)
    );
    if (courseIdFilter !== 'all' && stuEnrollments.length === 0) {
      continue;
    }

    if (q) {
      const hay = `${stu.name} ${stu.email} ${stu.rollNumber ?? ''} ${stu.phone ?? ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    const progressList = stuEnrollments.map((enr) => {
      const totalLes = lessons.filter((l) => l.courseId === enr.courseId).length;
      return calculateStudentProgress(totalLes, enr.completedLessonIds);
    });
    const avgLessonProgress =
      progressList.length > 0
        ? Math.round(progressList.reduce((s, v) => s + v, 0) / progressList.length)
        : 0;

    const stuAttempts = examAttempts.filter((a) => a.userId === stu.id);
    const avgExamPercent =
      stuAttempts.length > 0
        ? Math.round(stuAttempts.reduce((s, a) => s + a.percentage, 0) / stuAttempts.length)
        : 0;

    const stuAttendance = attendance.filter((a) => a.targetId === stu.id);
    const presentCount = stuAttendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const absentCount = stuAttendance.filter((a) => a.status === 'absent').length;
    const reward = rewardsByUser[stu.id];

    rows.push({
      studentId: stu.id,
      name: stu.name,
      email: stu.email,
      phone: stu.phone,
      rollNumber: stu.rollNumber || stu.id,
      branchId: stu.branchId,
      enrolledCoursesCount: stuEnrollments.length,
      courseTitles: stuEnrollments.map((e) => e.courseTitle),
      avgLessonProgress,
      examsTaken: stuAttempts.length,
      avgExamPercent,
      presentCount,
      absentCount,
      xp: reward?.xp ?? 0,
      streakDays: reward?.streakDays ?? 0,
    });
  }

  return rows.sort((a, b) => b.xp - a.xp || b.avgExamPercent - a.avgExamPercent);
}

export function validateProfileUpdate(input: {
  name: string;
  phone: string;
  currentPassword?: string;
  newPassword?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!input.name.trim() || input.name.trim().length < 2) {
    return { ok: false, error: 'Display name must be at least 2 characters.' };
  }
  if (!input.phone.trim() || input.phone.trim().length < 6) {
    return { ok: false, error: 'A valid phone number is required.' };
  }
  const nextPass = (input.newPassword ?? '').trim();
  if (nextPass) {
    if (nextPass.length < 6) {
      return { ok: false, error: 'New password must be at least 6 characters.' };
    }
    if (!(input.currentPassword ?? '').trim()) {
      return { ok: false, error: 'Current password is required to set a new password.' };
    }
  }
  return { ok: true };
}
