import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEnrollmentMetrics,
  filterEnrollments,
  formatEnrollmentsCsv,
} from './enrollments';
import type { Branch, Enrollment } from '../types';

const SAMPLE_ENROLLMENTS: Enrollment[] = [
  {
    id: 'enr-1',
    userId: 'u-1',
    studentName: 'Arafat Rahman',
    studentEmail: 'arafat@example.com',
    courseId: 'c-1',
    courseTitle: 'SSC English Revision',
    branchId: 'br-mirpur',
    paymentMethod: 'bKash',
    trxId: 'BK9988',
    invoiceNo: 'INV-1001',
    amountPaid: 2490,
    status: 'approved',
    completedLessonIds: [],
    enrolledAt: '2026-11-20T10:00:00Z',
  },
  {
    id: 'enr-2',
    userId: 'u-2',
    studentName: 'Nusrat Jahan',
    studentEmail: 'nusrat@example.com',
    courseId: 'c-2',
    courseTitle: 'HSC Combo Mastery',
    branchId: 'br-uttara',
    paymentMethod: 'Branch Cash',
    trxId: 'CASH-12',
    amountPaid: 3500,
    status: 'pending',
    completedLessonIds: [],
    enrolledAt: '2026-11-21T10:00:00Z',
  },
  {
    id: 'enr-3',
    userId: 'u-3',
    studentName: '=SUM(A1)',
    studentEmail: 'bad@example.com',
    courseId: 'c-1',
    courseTitle: 'IELTS Band 8',
    branchId: 'br-mirpur',
    paymentMethod: 'Nagad',
    amountPaid: 4000,
    status: 'rejected',
    completedLessonIds: [],
    enrolledAt: '2026-11-22T10:00:00Z',
  },
];

test('filterEnrollments filters by status, method, branch, and search query cleanly', () => {
  assert.equal(filterEnrollments(SAMPLE_ENROLLMENTS, { statusFilter: 'pending' }).length, 1);
  assert.equal(filterEnrollments(SAMPLE_ENROLLMENTS, { methodFilter: 'bKash' }).length, 1);
  assert.equal(filterEnrollments(SAMPLE_ENROLLMENTS, { branchFilter: 'br-mirpur' }).length, 2);
  assert.equal(filterEnrollments(SAMPLE_ENROLLMENTS, { searchQuery: 'BK9988' }).length, 1);
  assert.equal(filterEnrollments(SAMPLE_ENROLLMENTS, { searchQuery: 'nusrat' }).length, 1);
});

test('computeEnrollmentMetrics aggregates status counts and approved/pending revenue', () => {
  const m = computeEnrollmentMetrics(SAMPLE_ENROLLMENTS);
  assert.equal(m.totalCount, 3);
  assert.equal(m.approvedCount, 1);
  assert.equal(m.pendingCount, 1);
  assert.equal(m.rejectedCount, 1);
  assert.equal(m.approvedRevenue, 2490);
  assert.equal(m.pendingRevenue, 3500);
});

test('formatEnrollmentsCsv maps branch names and neutralizes spreadsheet formulas', () => {
  const branches: Branch[] = [
    {
      id: 'br-mirpur',
      name: 'Mirpur Campus',
      code: 'MPR',
      city: 'Dhaka',
      address: 'Mirpur 10',
      phone: '017',
      managerName: 'Karim',
      activeStudents: 100,
      status: 'active',
    },
  ];
  const csv = formatEnrollmentsCsv(SAMPLE_ENROLLMENTS, branches);
  assert.ok(csv.includes('"Mirpur Campus"'));
  assert.ok(csv.includes('"\'=SUM(A1)"'));
});
