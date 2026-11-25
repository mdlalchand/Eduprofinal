import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  consumePublicRateLimit,
  deriveStudentGuardianLinkCode,
  isStudentApprovedInCourse,
  normalizePhoneDigits,
  pseudonymizeLeaderboardId,
  redactLessonForViewer,
  resetPublicRateLimitsForTests,
  sanitizePublicCertificate,
  sanitizePublicEbook,
  sanitizePublicExamAttempt,
  sanitizePublicInstructor,
  verifyGuardianLinkCredential,
} from './publicRedaction';
import type {
  CourseCertificate,
  CourseLesson,
  Ebook,
  Enrollment,
  ExamAttempt,
  Instructor,
} from '../types';

after(() => {
  resetPublicRateLimitsForTests();
});

describe('Public API Redaction, Student Data Access & Rate Limiting', () => {
  const testSecret = 'unit-test-secret-edupro-2026-minimum-32-chars';

  test('sanitizePublicExamAttempt strips sensitive user, answer, and grading internals', () => {
    const rawAttempt: ExamAttempt = {
      id: 'att-101',
      examId: 'ex-1',
      examTitle: 'HSC English Model Test 1',
      userId: 'u-student',
      studentName: 'Arafat Rahman',
      rollNumber: 'AEC-2026-101',
      branchId: 'br-mirpur',
      score: 46,
      totalMarks: 50,
      percentage: 92,
      grade: 'A+',
      passed: true,
      answers: { q1: 1, q2: 3 },
      writtenAnswers: { q3: 'My essay draft' },
      writtenScores: { q3: 8 },
      teacherFeedback: 'Good work',
      gradedBy: 'Teacher X',
      gradedAt: '2026-02-01T10:00:00.000Z',
      submittedAt: '2026-02-01T09:00:00.000Z',
    };

    const sanitized = sanitizePublicExamAttempt(rawAttempt) as unknown as Record<string, unknown>;
    assert.equal(sanitized.id, 'att-101');
    assert.equal(sanitized.examTitle, 'HSC English Model Test 1');
    assert.equal(sanitized.score, 46);
    assert.equal(sanitized.grade, 'A+');
    assert.equal('userId' in sanitized, false);
    assert.equal('answers' in sanitized, false);
    assert.equal('writtenAnswers' in sanitized, false);
    assert.equal('writtenScores' in sanitized, false);
    assert.equal('teacherFeedback' in sanitized, false);
    assert.equal('gradedBy' in sanitized, false);
    assert.equal('branchId' in sanitized, false);
    assert.equal('studentName' in sanitized, false);
    assert.equal('rollNumber' in sanitized, false);
  });

  test('sanitizePublicCertificate strips studentEmail and userId from public verify payload', () => {
    const rawCert: CourseCertificate = {
      id: 'cert-1',
      certificateNumber: 'AEC-CERT-2026-0001',
      courseId: 'c-1',
      courseTitle: 'IELTS Band 8+ Masterclass',
      userId: 'u-student',
      studentName: 'Arafat Rahman',
      studentEmail: 'student@alomsenglish.com',
      rollNumber: 'AEC-2026-101',
      completionPercent: 100,
      instructorName: 'Alomgir Hossain',
      issuedAt: '2026-02-10T10:00:00.000Z',
      revoked: false,
    };

    const sanitized = sanitizePublicCertificate(rawCert) as unknown as Record<string, unknown>;
    assert.equal(sanitized.certificateNumber, 'AEC-CERT-2026-0001');
    assert.equal(sanitized.studentName, 'Arafat Rahman');
    assert.equal(sanitized.rollNumber, 'AEC-2026-101');
    assert.equal('studentEmail' in sanitized, false);
    assert.equal('userId' in sanitized, false);
  });

  test('public bootstrap sanitizers strip instructor userId, paid ebook pdfUrl, and pseudonymize leaderboard IDs', () => {
    const inst: Instructor = {
      id: 'inst-1',
      userId: 'u-admin',
      name: 'Alomgir Hossain',
      subject: 'English Grammar',
      roleTitle: 'Lead Mentor',
      education: 'MA Dhaka Univ',
      panel: 'Head Faculty',
      branchId: 'br-mirpur',
      bio: '12 years experience',
      avatar: '/avatar.jpg',
    };
    const pubInst = sanitizePublicInstructor(inst) as unknown as Record<string, unknown>;
    assert.equal('userId' in pubInst, false);
    assert.equal(pubInst.name, 'Alomgir Hossain');

    const paidBook: Ebook = {
      id: 'eb-paid',
      title: 'Paid Grammar Book',
      level: 'HSC 27',
      isFree: false,
      price: 350,
      originalPrice: 500,
      author: 'AEC',
      pagesCount: 120,
      pdfUrl: 'https://private.example.com/paid.pdf',
      summary: 'Paid summary',
      sampleContent: ['Sample page'],
    };
    const freeBook: Ebook = {
      ...paidBook,
      id: 'eb-free',
      isFree: true,
      price: 0,
      pdfUrl: 'https://public.example.com/free.pdf',
    };
    assert.equal(sanitizePublicEbook(paidBook).pdfUrl, '');
    assert.equal(sanitizePublicEbook(freeBook).pdfUrl, 'https://public.example.com/free.pdf');

    const pseudo1 = pseudonymizeLeaderboardId('u-student', testSecret);
    const pseudo2 = pseudonymizeLeaderboardId('u-student', testSecret);
    const pseudoOther = pseudonymizeLeaderboardId('u-student-2', testSecret);
    assert.equal(pseudo1, pseudo2);
    assert.notEqual(pseudo1, 'u-student');
    assert.notEqual(pseudo1, pseudoOther);
    assert.match(pseudo1, /^pub-[0-9a-f]{12}$/);
  });

  test('redactLessonForViewer hides paid lesson media for unenrolled viewers but preserves free previews', () => {
    const paidLesson: CourseLesson = {
      id: 'les-paid',
      courseId: 'c-1',
      lessonType: 'recorded',
      title: 'Paid Lesson',
      moduleName: 'Module 1',
      duration: '30m',
      videoPreviewTitle: 'Preview',
      videoUrl: 'https://video.example.com/secret.mp4',
      audioUrl: 'https://audio.example.com/secret.mp3',
      textContent: 'Full paid notes',
      liveJoinUrl: 'https://zoom.us/j/123456',
      lectureSheetUrl: 'https://docs.example.com/sheet.pdf',
      externalUrl: 'https://external.example.com',
      resources: [{ id: 'r1', title: 'Sheet', url: 'https://r.example.com', kind: 'pdf' }],
      sheetSummary: 'Full summary',
      isFreePreview: false,
      orderIndex: 1,
    };

    const redacted = redactLessonForViewer(paidLesson, false);
    assert.equal(redacted.videoUrl, '');
    assert.equal(redacted.audioUrl, undefined);
    assert.equal(redacted.textContent, undefined);
    assert.equal(redacted.liveJoinUrl, '');
    assert.equal(redacted.lectureSheetUrl, '');
    assert.equal(redacted.externalUrl, undefined);
    assert.deepEqual(redacted.resources, []);

    const enrolledView = redactLessonForViewer(paidLesson, true);
    assert.equal(enrolledView.videoUrl, 'https://video.example.com/secret.mp4');
    assert.equal(enrolledView.liveJoinUrl, 'https://zoom.us/j/123456');

    const freeLesson: CourseLesson = { ...paidLesson, id: 'les-free', isFreePreview: true };
    const freeView = redactLessonForViewer(freeLesson, false);
    assert.equal(freeView.videoUrl, 'https://video.example.com/secret.mp4');
  });

  test('guardian linking requires matching student phone, admission guardianPhone, or student linking code', () => {
    const student = {
      id: 'u-student',
      phone: '01710000004',
      createdAt: '2026-01-10T09:00:00.000Z',
      passwordUpdatedAt: null,
    };

    const code = deriveStudentGuardianLinkCode(student, testSecret);
    assert.match(code, /^AEC-[0-9A-F]{6}$/);

    // Missing or wrong verification must fail for guardian
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'guardian',
        verificationInput: '',
        student,
        secret: testSecret,
      }),
      false
    );
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'guardian',
        verificationInput: '01799999999',
        student,
        secret: testSecret,
      }),
      false
    );
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'guardian',
        verificationInput: 'AEC-WRONG1',
        student,
        secret: testSecret,
      }),
      false
    );

    // Matching student phone (including +88 prefix / formatting) succeeds
    assert.equal(normalizePhoneDigits('+880 1710-000004'), '01710000004');
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'guardian',
        verificationInput: '+8801710-000004',
        student,
        secret: testSecret,
      }),
      true
    );

    // Matching admission guardian phone succeeds
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'guardian',
        verificationInput: '01811223344',
        student,
        admissionGuardianPhones: ['01811223344'],
        secret: testSecret,
      }),
      true
    );

    // Matching student linking code succeeds (case-insensitive)
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'guardian',
        verificationInput: code.toLowerCase(),
        student,
        secret: testSecret,
      }),
      true
    );

    // Admin bypasses student verification check
    assert.equal(
      verifyGuardianLinkCredential({
        actorRole: 'admin',
        verificationInput: '',
        student,
        secret: testSecret,
      }),
      true
    );
  });

  test('isStudentApprovedInCourse rejects pending, rejected, and expired enrollments', () => {
    const now = Date.parse('2026-06-01T00:00:00.000Z');
    const base: Omit<Enrollment, 'id' | 'status' | 'expiresAt'> = {
      userId: 'u-student',
      studentName: 'Arafat',
      studentEmail: 'student@alomsenglish.com',
      courseId: 'c-1',
      courseTitle: 'Course 1',
      branchId: 'br-mirpur',
      paymentMethod: 'bKash',
      amountPaid: 1000,
      completedLessonIds: [],
      enrolledAt: '2026-01-01T00:00:00.000Z',
    };

    assert.equal(
      isStudentApprovedInCourse([{ ...base, id: 'e1', status: 'pending' }], 'u-student', 'c-1', now),
      false
    );
    assert.equal(
      isStudentApprovedInCourse(
        [{ ...base, id: 'e2', status: 'approved', expiresAt: '2026-05-01T00:00:00.000Z' }],
        'u-student',
        'c-1',
        now
      ),
      false
    );
    assert.equal(
      isStudentApprovedInCourse(
        [{ ...base, id: 'e3', status: 'approved', expiresAt: '2026-07-01T00:00:00.000Z' }],
        'u-student',
        'c-1',
        now
      ),
      true
    );
  });

  test('consumePublicRateLimit blocks after maxRequests and recovers after window expires', () => {
    resetPublicRateLimitsForTests();
    const t0 = 1_700_000_000_000;
    assert.equal(consumePublicRateLimit('bucket-a', 2, 10_000, t0).allowed, true);
    assert.equal(consumePublicRateLimit('bucket-a', 2, 10_000, t0 + 100).allowed, true);
    const blocked = consumePublicRateLimit('bucket-a', 2, 10_000, t0 + 200);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);

    // Different bucket unaffected
    assert.equal(consumePublicRateLimit('bucket-b', 2, 10_000, t0 + 200).allowed, true);

    // Window expires
    assert.equal(consumePublicRateLimit('bucket-a', 2, 10_000, t0 + 10_001).allowed, true);
  });

  test('parsePgSslConfig enforces CA certs, strict verification, and safe remote defaults', async () => {
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const { parsePgSslConfig, describePgSslMode } = await import('./envConfig');

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edupro-ssl-test-'));
    const caFile = path.join(tmpDir, 'ca.pem');
    fs.writeFileSync(caFile, '-----BEGIN CERTIFICATE-----\nTESTCA\n-----END CERTIFICATE-----\n');

    try {
      assert.equal(parsePgSslConfig('disable', 'postgresql://u:p@db.example.com:5432/app'), false);
      assert.equal(parsePgSslConfig(undefined, 'postgresql://u:p@localhost:5432/app'), false);

      // verify-full attaches CA cert and requires strict verification
      const strictCfg = parsePgSslConfig('verify-full', '', '', caFile);
      assert.deepEqual(strictCfg, {
        rejectUnauthorized: true,
        ca: '-----BEGIN CERTIFICATE-----\nTESTCA\n-----END CERTIFICATE-----\n',
      });
      assert.equal(describePgSslMode('verify-full', '', '', caFile), 'enabled (verify-full + CA)');

      // PGSSL=require now enforces certificate verification instead of rejectUnauthorized=false
      assert.deepEqual(parsePgSslConfig('require', '', '', ''), { rejectUnauthorized: true });

      // Missing CA path fails fast rather than silently disabling verification
      assert.throws(
        () => parsePgSslConfig('verify-full', '', '', path.join(tmpDir, 'missing.pem')),
        /CA root certificate not found/i
      );

      // Remote DATABASE_URL and remote PGHOST default to verified TLS
      assert.deepEqual(
        parsePgSslConfig(undefined, 'postgresql://u:p@db.prod.example.com:5432/app', '', ''),
        { rejectUnauthorized: true }
      );
      assert.deepEqual(parsePgSslConfig(undefined, '', 'db.prod.example.com', ''), {
        rejectUnauthorized: true,
      });

      // Explicit no-verify opts out of certificate chain checks when needed
      assert.deepEqual(parsePgSslConfig('no-verify', '', '', ''), { rejectUnauthorized: false });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('resolveSessionSecret requires a 32+ char secret in production unless fallback opted in', async () => {
    const { resetResolvedSessionSecretForTests, resolveSessionSecret } = await import('./security');
    const prevEnv = process.env.NODE_ENV;
    const prevSecret = process.env.SESSION_SECRET;
    const prevFallback = process.env.ALLOW_LOCAL_SESSION_SECRET_FALLBACK;

    try {
      process.env.NODE_ENV = 'production';
      process.env.SESSION_SECRET = 'too-short-secret';
      delete process.env.ALLOW_LOCAL_SESSION_SECRET_FALLBACK;
      resetResolvedSessionSecretForTests();

      assert.throws(() => resolveSessionSecret(), /at least 32 characters in production/i);

      process.env.SESSION_SECRET = 'prod-strong-session-secret-with-more-than-32-chars';
      resetResolvedSessionSecretForTests();
      assert.equal(
        resolveSessionSecret(),
        'prod-strong-session-secret-with-more-than-32-chars'
      );
    } finally {
      resetResolvedSessionSecretForTests();
      if (prevEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevEnv;
      if (prevSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = prevSecret;
      if (prevFallback === undefined) delete process.env.ALLOW_LOCAL_SESSION_SECRET_FALLBACK;
      else process.env.ALLOW_LOCAL_SESSION_SECRET_FALLBACK = prevFallback;
    }
  });
});
