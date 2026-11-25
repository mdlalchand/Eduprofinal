import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyAuditCategory,
  computeAuditLogSummary,
  filterAuditLogs,
  formatAuditLogsCsv,
  inferAuditSeverity,
  maskEmailForAudit,
  mergeAuditLogStreamEntry,
} from './auditLogs';
import type { AuditLogEntry } from '../types';

const SAMPLE_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-10',
    actorId: 'u-admin',
    actorName: 'Alomgir Hossain',
    actorRole: 'admin',
    action: 'USER_LOGIN',
    target: 'ad***@alomsenglish.com',
    details: 'Signed in via password authentication',
    createdAt: '2026-11-23T05:00:00.000Z',
  },
  {
    id: 'audit-11',
    actorId: 'u-admin',
    actorName: 'Alomgir Hossain',
    actorRole: 'admin',
    action: 'COURSE_UPDATE',
    target: 'SSC-27 English Final Revision',
    details: 'Updated price to ৳2490 (active)',
    createdAt: '2026-11-23T05:05:00.000Z',
  },
  {
    id: 'audit-12',
    actorId: 'u-student',
    actorName: 'Arafat Rahman',
    actorRole: 'student',
    action: 'PAYMENT_CHECKOUT',
    target: 'HSC Combo Pack',
    details: 'bKash · ৳3490 · INV-AEC-100233',
    createdAt: '2026-11-23T05:10:00.000Z',
  },
  {
    id: 'audit-13',
    actorId: 'u-admin',
    actorName: 'Alomgir Hossain',
    actorRole: 'admin',
    action: 'USER_LOGIN_FAILED',
    target: 'st***@alomsenglish.com',
    details: 'Invalid password attempt',
    createdAt: '2026-11-23T05:12:00.000Z',
  },
  {
    id: 'audit-14',
    actorId: 'u-admin',
    actorName: 'Alomgir Hossain',
    actorRole: 'admin',
    action: 'BRANCH_UPDATE',
    target: 'Mirpur DOHS Main Campus',
    details: 'AEC-MPR (active)',
    createdAt: '2026-11-23T05:15:00.000Z',
  },
];

test('classifyAuditCategory maps logins, courses, payments, and system actions', () => {
  assert.equal(classifyAuditCategory('USER_LOGIN'), 'login');
  assert.equal(classifyAuditCategory('USER_LOGIN_FAILED'), 'login');
  assert.equal(classifyAuditCategory('USER_REGISTER'), 'login');
  assert.equal(classifyAuditCategory('COURSE_CREATE'), 'course');
  assert.equal(classifyAuditCategory('COURSE_STATUS'), 'course');
  assert.equal(classifyAuditCategory('BATCH_UPDATE'), 'course');
  assert.equal(classifyAuditCategory('PAYMENT_CHECKOUT'), 'payment');
  assert.equal(classifyAuditCategory('PAYMENT_TXN_STATUS'), 'payment');
  assert.equal(classifyAuditCategory('ENROLLMENT_STATUS'), 'payment');
  assert.equal(classifyAuditCategory('BRANCH_CREATE'), 'system');
});

test('inferAuditSeverity highlights failures, deletes, refunds, and resets', () => {
  assert.equal(inferAuditSeverity('USER_LOGIN'), 'info');
  assert.equal(inferAuditSeverity('COURSE_DELETE'), 'warning');
  assert.equal(inferAuditSeverity('PAYMENT_TXN_STATUS'), 'warning');
  assert.equal(inferAuditSeverity('USER_LOGIN_FAILED'), 'critical');
  assert.equal(inferAuditSeverity('SYSTEM_RESET_SAFE'), 'critical');
});

test('filterAuditLogs and computeAuditLogSummary filter accurately and tally category counts', () => {
  const summary = computeAuditLogSummary(SAMPLE_LOGS);
  assert.equal(summary.total, 5);
  assert.equal(summary.loginCount, 2);
  assert.equal(summary.courseCount, 1);
  assert.equal(summary.paymentCount, 1);
  assert.equal(summary.systemCount, 1);
  assert.equal(summary.warningCount, 1);

  const courseOnly = filterAuditLogs(SAMPLE_LOGS, { category: 'course' });
  assert.equal(courseOnly.length, 1);
  assert.equal(courseOnly[0].id, 'audit-11');

  const studentPayment = filterAuditLogs(SAMPLE_LOGS, {
    category: 'payment',
    actorRole: 'student',
    searchQuery: 'INV-AEC',
  });
  assert.equal(studentPayment.length, 1);
  assert.equal(studentPayment[0].actorName, 'Arafat Rahman');
});

test('mergeAuditLogStreamEntry deduplicates idempotent events and sorts newest-first', () => {
  const incoming: AuditLogEntry = {
    id: 'audit-12',
    actorId: 'u-student',
    actorName: 'Arafat Rahman',
    actorRole: 'student',
    action: 'PAYMENT_CHECKOUT',
    target: 'HSC Combo Pack',
    details: 'Re-delivered SSE event',
    createdAt: '2026-11-23T05:10:00.000Z',
  };
  const merged = mergeAuditLogStreamEntry(SAMPLE_LOGS, incoming, 4);
  assert.equal(merged.length, 4);
  assert.equal(merged[0].id, 'audit-14');
  assert.equal(merged.filter((item) => item.id === 'audit-12').length, 1);
});

test('maskEmailForAudit masks local-part cleanly and formatAuditLogsCsv neutralizes formula cells', () => {
  assert.equal(maskEmailForAudit('admin@alomsenglish.com'), 'ad***@alomsenglish.com');
  const csv = formatAuditLogsCsv([
    {
      ...SAMPLE_LOGS[0],
      details: '=CMD("calc")',
    },
  ]);
  assert.ok(csv.includes('"\'=CMD(""calc"")"'));
});
