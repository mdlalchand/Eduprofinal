import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edupro-sec-test-'));
const tempDbPath = path.join(tempDir, 'edupro-test.db');
const prevSqliteEnv = process.env.SQLITE_DB_PATH;
const prevSessionSecret = process.env.SESSION_SECRET;
process.env.SQLITE_DB_PATH = tempDbPath;
process.env.SESSION_SECRET = 'test-session-secret-minimum-32-chars-edupro-2026';

import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  closeSqliteDb,
  createSessionRecord,
  findValidSessionByToken,
  getSqliteDb,
  hashPassword,
  recordLoginFailure,
  revokeAllUserSessions,
  sanitizeLegacyStateForRelationalMigration,
  verifyPassword,
} from '../db/persistence';
import {
  computeTotpCode,
  generateTotpSecret,
  isStrongPassword,
  isValidRole,
  signSessionToken,
  verifySignedSessionToken,
  verifyTotpCode,
} from './security';
import {
  assertBranchOperationalForTransactions,
  computeWebhookSignature,
  initiateServerPaymentSession,
  processSignedWebhookCallback,
} from './paymentService';
import {
  createVerifiedBackupSnapshot,
  getDb,
  saveDb,
  verifyBackupSnapshotIntegrity,
} from './store';

after(() => {
  closeSqliteDb();
  if (prevSqliteEnv === undefined) {
    delete process.env.SQLITE_DB_PATH;
  } else {
    process.env.SQLITE_DB_PATH = prevSqliteEnv;
  }
  if (prevSessionSecret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = prevSessionSecret;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('EDUPro Security, RBAC, DB Constraints & Payments', () => {
  test('only allows the 4 authorized roles and blocks legacy/escalation roles', () => {
    assert.equal(isValidRole('admin'), true);
    assert.equal(isValidRole('teacher'), true);
    assert.equal(isValidRole('student'), true);
    assert.equal(isValidRole('guardian'), true);

    assert.equal(isValidRole('branch_manager'), false);
    assert.equal(isValidRole('super_admin'), false);
    assert.equal(isValidRole('sub_admin'), false);
    assert.equal(isValidRole('branch_admin'), false);
  });

  test('enforces single Main Admin constraint at SQLite schema level (idx_single_main_admin)', () => {
    const state = getDb();
    assert.equal(state.users.filter((u) => u.role === 'admin').length, 1);

    const sqlite = getSqliteDb();
    assert.throws(() => {
      sqlite
        .prepare(
          `INSERT INTO users (id, name, email, phone, role, status, password_hash, created_at)
           VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)`
        )
        .run('u-rogue-admin', 'Rogue Admin', 'rogue@example.com', '01700009999', 'salt:hash', new Date().toISOString());
    }, /UNIQUE constraint failed/i);
  });

  test('legacy state migration aborts on multiple admins and revokes branch_manager without promotion', () => {
    const baseState = getDb();

    // Abort if >1 admin exists in legacy JSON
    assert.throws(() => {
      sanitizeLegacyStateForRelationalMigration(
        {
          users: [
            { ...baseState.users[0], id: 'a1', email: 'a1@example.com', role: 'admin' },
            { ...baseState.users[0], id: 'a2', email: 'a2@example.com', role: 'admin' },
          ],
        },
        () => baseState
      );
    }, /CRITICAL SECURITY HALT/i);

    // Revoke branch_manager into revokedAccounts without promoting to teacher
    const prevAdminEmail = process.env.ADMIN_EMAIL;
    const prevAdminPass = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const migrated = sanitizeLegacyStateForRelationalMigration(
      {
        users: [
          {
            ...baseState.users[0],
            id: 'u-admin',
            role: 'admin',
            passwordUpdatedAt: null,
          },
          {
            id: 'u-manager',
            name: 'Legacy Manager',
            email: 'manager@alomsenglish.com',
            phone: '01711112222',
            role: 'branch_manager' as unknown as 'teacher',
            branchId: 'br-mirpur',
            status: 'active',
            createdAt: new Date().toISOString(),
            passwordHash: '',
            passwordUpdatedAt: null,
          } as unknown as typeof baseState.users[number],
        ],
      },
      () => baseState
    );

    if (prevAdminEmail !== undefined) process.env.ADMIN_EMAIL = prevAdminEmail;
    if (prevAdminPass !== undefined) process.env.ADMIN_PASSWORD = prevAdminPass;

    assert.equal(migrated.adminNeedsProvisioning, true);
    assert.equal(migrated.state.users.some((u) => u.id === 'u-manager'), false);
    assert.equal(
      migrated.revokedAccounts.some((r) => r.originalUserId === 'u-manager' && r.previousRole === 'branch_manager'),
      true
    );
  });

  test('password hashing, strength checks, signed session tokens, and session revocation work properly', () => {
    assert.equal(isStrongPassword('short1', 8), false);
    assert.equal(isStrongPassword('onlyletters', 8), false);
    assert.equal(isStrongPassword('StrongPass123', 10), true);

    const hashed = hashPassword('MySecretPass99!');
    assert.equal(verifyPassword('MySecretPass99!', hashed), true);
    assert.equal(verifyPassword('WrongPass99!', hashed), false);

    const state = getDb();
    const student = state.users.find((u) => u.role === 'student');
    assert.ok(student);

    const token = signSessionToken(student.id, student.role);
    const verified = verifySignedSessionToken(token);
    assert.ok(verified);
    assert.equal(verified.userId, student.id);
    assert.equal(verified.role, 'student');

    // Tampered token must fail
    const tampered = `${token.slice(0, -4)}XXXX`;
    assert.equal(verifySignedSessionToken(tampered), null);

    // Persisted session record & revocation
    createSessionRecord({
      userId: student.id,
      rawToken: token,
      ipAddress: '127.0.0.1',
      userAgent: 'node-test',
    });
    assert.ok(findValidSessionByToken(token));
    const revokedCount = revokeAllUserSessions(student.id);
    assert.ok(revokedCount >= 1);
    assert.equal(findValidSessionByToken(token), null);
  });

  test('login rate limiter locks out after 5 failures and clears on reset', () => {
    const rateKey = `ip:127.0.0.1:email:locktest-${Date.now()}@example.com`;
    for (let i = 0; i < 4; i += 1) {
      const res = recordLoginFailure(rateKey, 5, 60_000);
      assert.equal(res.locked, false);
    }
    const fifth = recordLoginFailure(rateKey, 5, 60_000);
    assert.equal(fifth.locked, true);
    const limitStatus = checkLoginRateLimit(rateKey);
    assert.equal(limitStatus.allowed, false);
    assert.ok(limitStatus.retryAfterSeconds > 0);

    clearLoginRateLimit(rateKey);
    assert.equal(checkLoginRateLimit(rateKey).allowed, true);
  });

  test('RFC 6238 TOTP 2FA accepts valid time-window code and rejects invalid codes', () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    const code = computeTotpCode(secret, now);
    assert.match(code, /^\d{6}$/);
    assert.equal(verifyTotpCode(secret, code, now), true);
    assert.equal(verifyTotpCode(secret, '000000', now), code === '000000');
    assert.equal(verifyTotpCode(secret, 'not-a-code', now), false);
  });

  test('verified backup snapshots compute valid SHA-256 checksums and detect tampering', () => {
    const state = getDb();
    const snapshot = createVerifiedBackupSnapshot(state, 'Main Admin', 'unit-test-backup', 'manual');
    assert.equal(verifyBackupSnapshotIntegrity(snapshot), true);

    const tampered = {
      ...snapshot,
      payloadJson: `${snapshot.payloadJson} `,
    };
    assert.equal(verifyBackupSnapshotIntegrity(tampered), false);
  });

  test('non-active branches block new transactions while active branches allow them', () => {
    const state = getDb();
    const branch = state.branches[0];
    assert.ok(branch);
    const origStatus = branch.status;

    for (const blockedStatus of ['inactive', 'suspended', 'archived'] as const) {
      branch.status = blockedStatus;
      saveDb(state);
      const check = assertBranchOperationalForTransactions(branch.id);
      assert.equal(check.ok, false);
    }

    branch.status = 'active';
    saveDb(state);
    assert.equal(assertBranchOperationalForTransactions(branch.id).ok, true);

    branch.status = origStatus;
    saveDb(state);
  });

  test('payment sessions require signed webhook callback, verify HMAC strictly, and deduplicate replays', () => {
    const state = getDb();
    const student = state.users.find((u) => u.role === 'student');
    const course = state.courses.find((c) => c.price > 0 && !state.enrollments.some((e) => e.userId === student?.id && e.courseId === c.id));
    assert.ok(student);
    assert.ok(course);

    // Ensure student's branch is active
    const targetBranch = state.branches.find((b) => b.status === 'active');
    assert.ok(targetBranch);

    const idempotencyKey = `test-idem-${crypto.randomBytes(6).toString('hex')}`;
    const init1 = initiateServerPaymentSession({
      user: student,
      idempotencyKey,
      referenceType: 'course',
      courseId: course.id,
      branchId: targetBranch.id,
      gateway: 'bKash',
    });
    assert.equal(init1.ok, true);
    if (!init1.ok || !init1.sandboxSignPayload) {
      assert.fail('Expected sandboxSignPayload for paid course initiation');
    }

    // Re-calling with same idempotencyKey returns existing session without creating duplicate
    const init2 = initiateServerPaymentSession({
      user: student,
      idempotencyKey,
      referenceType: 'course',
      courseId: course.id,
      branchId: targetBranch.id,
      gateway: 'bKash',
    });
    assert.equal(init2.ok, true);
    if (init2.ok) {
      assert.equal(init2.session.id, init1.session.id);
    }

    const webhookBodyObj = {
      sessionId: init1.sandboxSignPayload.sessionId,
      gateway: init1.sandboxSignPayload.gateway,
      trxId: init1.sandboxSignPayload.trxId,
      amount: init1.sandboxSignPayload.amount,
      status: 'SUCCESS',
    };
    const rawBody = JSON.stringify(webhookBodyObj);

    // Bad signature must be rejected with 401
    const badWebhook = processSignedWebhookCallback({
      gateway: 'bKash',
      rawBody,
      signature: 'invalid-hmac-signature',
      payload: webhookBodyObj,
    });
    assert.equal(badWebhook.ok, false);
    if (!badWebhook.ok) {
      assert.equal(badWebhook.status, 401);
    }

    // Valid signature settles payment once
    const validSig = computeWebhookSignature(rawBody, 'bKash');
    const goodWebhook = processSignedWebhookCallback({
      gateway: 'bKash',
      rawBody,
      signature: validSig,
      payload: webhookBodyObj,
    });
    assert.equal(goodWebhook.ok, true);

    // Replaying identical webhook event deduplicates idempotently
    const replayWebhook = processSignedWebhookCallback({
      gateway: 'bKash',
      rawBody,
      signature: validSig,
      payload: webhookBodyObj,
    });
    assert.equal(replayWebhook.ok, true);
    if (replayWebhook.ok) {
      assert.deepEqual(
        (replayWebhook.result as { deduplicated?: boolean }).deduplicated,
        true
      );
    }
  });
});
