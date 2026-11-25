import crypto from 'node:crypto';
import type {
  CourseCertificate,
  CourseLesson,
  Ebook,
  Enrollment,
  ExamAttempt,
  Instructor,
  UserRole,
} from '../types';

export interface PublicExamAttemptSummary {
  id: string;
  examId: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  passed: boolean;
  submittedAt: string;
}

export interface PublicCertificateSummary {
  id: string;
  certificateNumber: string;
  certificateNo?: string;
  courseId: string;
  courseTitle: string;
  courseSlug?: string;
  studentName: string;
  rollNumber?: string;
  completionPercent: number;
  progressPercent?: number;
  examScorePercent?: number;
  instructorName?: string;
  issuedAt: string;
  issuedBy?: string;
  revoked?: boolean;
}

export function sanitizePublicExamAttempt(attempt: ExamAttempt): PublicExamAttemptSummary {
  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: attempt.examTitle,
    score: attempt.score,
    totalMarks: attempt.totalMarks,
    percentage: attempt.percentage,
    grade: attempt.grade,
    passed: attempt.passed,
    submittedAt: attempt.submittedAt,
  };
}

export function sanitizePublicCertificate(cert: CourseCertificate): PublicCertificateSummary {
  return {
    id: cert.id,
    certificateNumber: cert.certificateNumber,
    ...(cert.certificateNo ? { certificateNo: cert.certificateNo } : {}),
    courseId: cert.courseId,
    courseTitle: cert.courseTitle,
    ...(cert.courseSlug ? { courseSlug: cert.courseSlug } : {}),
    studentName: cert.studentName,
    ...(cert.rollNumber ? { rollNumber: cert.rollNumber } : {}),
    completionPercent: cert.completionPercent,
    ...(cert.progressPercent !== undefined ? { progressPercent: cert.progressPercent } : {}),
    ...(cert.examScorePercent !== undefined ? { examScorePercent: cert.examScorePercent } : {}),
    ...(cert.instructorName ? { instructorName: cert.instructorName } : {}),
    issuedAt: cert.issuedAt,
    ...(cert.issuedBy ? { issuedBy: cert.issuedBy } : {}),
    revoked: Boolean(cert.revoked),
  };
}

export function sanitizePublicInstructor(inst: Instructor): Omit<Instructor, 'userId'> {
  const { userId: _uid, ...pub } = inst;
  return pub;
}

export function sanitizePublicEbook(ebook: Ebook): Ebook {
  if (ebook.isFree) return ebook;
  return {
    ...ebook,
    pdfUrl: '',
  };
}

export function pseudonymizeLeaderboardId(userId: string, secret: string): string {
  const digest = crypto.createHmac('sha256', secret).update(String(userId)).digest('hex');
  return `pub-${digest.slice(0, 12)}`;
}

export function redactLessonForViewer(lesson: CourseLesson, hasFullAccess: boolean): CourseLesson {
  if (hasFullAccess || lesson.isFreePreview) {
    return lesson;
  }
  return {
    ...lesson,
    videoUrl: '',
    audioUrl: undefined,
    textContent: undefined,
    liveJoinUrl: '',
    lectureSheetUrl: '',
    externalUrl: undefined,
    resources: [],
    sheetSummary: 'Available after enrollment',
  };
}

export function isStudentApprovedInCourse(
  enrollments: Enrollment[],
  userId: string,
  courseId: string,
  nowMs = Date.now()
): boolean {
  return enrollments.some(
    (e) =>
      e.userId === userId &&
      e.courseId === courseId &&
      e.status === 'approved' &&
      (!e.expiresAt || Date.parse(e.expiresAt) >= nowMs)
  );
}

export function normalizePhoneDigits(phone: string): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('8801') && digits.length >= 13) {
    return digits.slice(2);
  }
  return digits;
}

export function deriveStudentGuardianLinkCode(
  student: { id: string; createdAt?: string; passwordUpdatedAt?: string | null },
  secret: string
): string {
  const material = `${student.id}:${student.passwordUpdatedAt ?? student.createdAt ?? 'seed'}`;
  const mac = crypto.createHmac('sha256', secret).update(material).digest('hex').slice(0, 6).toUpperCase();
  return `AEC-${mac}`;
}

function timingSafeTextEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyGuardianLinkCredential(params: {
  actorRole: UserRole;
  verificationInput: string;
  student: { id: string; phone?: string; createdAt?: string; passwordUpdatedAt?: string | null };
  admissionGuardianPhones?: string[];
  secret: string;
}): boolean {
  if (params.actorRole === 'admin') {
    return true;
  }
  const rawInput = String(params.verificationInput ?? '').trim();
  if (!rawInput) return false;

  const expectedCode = deriveStudentGuardianLinkCode(params.student, params.secret);
  if (timingSafeTextEqual(rawInput.toUpperCase(), expectedCode)) {
    return true;
  }

  const inputDigits = normalizePhoneDigits(rawInput);
  if (inputDigits.length < 10) return false;

  const candidatePhones = [params.student.phone ?? '', ...(params.admissionGuardianPhones ?? [])]
    .map(normalizePhoneDigits)
    .filter((p) => p.length >= 10);

  return candidatePhones.some((candidate) => timingSafeTextEqual(inputDigits, candidate));
}

const publicRateBuckets = new Map<string, { count: number; resetAt: number }>();

export function consumePublicRateLimit(
  bucketKey: string,
  maxRequests: number,
  windowMs: number,
  nowMs = Date.now()
): { allowed: boolean; retryAfterSeconds: number } {
  const existing = publicRateBuckets.get(bucketKey);
  if (!existing || nowMs >= existing.resetAt) {
    publicRateBuckets.set(bucketKey, { count: 1, resetAt: nowMs + windowMs });
    if (publicRateBuckets.size > 5000) {
      for (const [k, v] of publicRateBuckets.entries()) {
        if (nowMs >= v.resetAt) publicRateBuckets.delete(k);
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (existing.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000)),
    };
  }
  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetPublicRateLimitsForTests(): void {
  publicRateBuckets.clear();
}
