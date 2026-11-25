import type { Branch, Enrollment } from '../types';

export interface EnrollmentFilterOptions {
  searchQuery?: string;
  statusFilter?: 'all' | Enrollment['status'];
  methodFilter?: string;
  branchFilter?: string;
}

export interface EnrollmentSummaryMetrics {
  totalCount: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  approvedRevenue: number;
  pendingRevenue: number;
}

export function filterEnrollments(
  enrollments: Enrollment[],
  options: EnrollmentFilterOptions = {}
): Enrollment[] {
  const q = String(options.searchQuery ?? '').trim().toLowerCase();
  const statusFilter = options.statusFilter ?? 'all';
  const methodFilter = String(options.methodFilter ?? 'all').trim();
  const branchFilter = String(options.branchFilter ?? 'all').trim();

  return enrollments.filter((enr) => {
    if (statusFilter !== 'all' && enr.status !== statusFilter) return false;
    if (methodFilter !== 'all' && enr.paymentMethod !== methodFilter) return false;
    if (branchFilter !== 'all' && enr.branchId !== branchFilter) return false;
    if (!q) return true;
    return (
      enr.studentName.toLowerCase().includes(q) ||
      enr.studentEmail.toLowerCase().includes(q) ||
      enr.courseTitle.toLowerCase().includes(q) ||
      enr.paymentMethod.toLowerCase().includes(q) ||
      String(enr.trxId ?? '').toLowerCase().includes(q) ||
      String(enr.invoiceNo ?? '').toLowerCase().includes(q)
    );
  });
}

export function computeEnrollmentMetrics(
  enrollments: Enrollment[]
): EnrollmentSummaryMetrics {
  let approvedCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let approvedRevenue = 0;
  let pendingRevenue = 0;

  for (const enr of enrollments) {
    const amt = Number(enr.amountPaid) || 0;
    if (enr.status === 'approved') {
      approvedCount += 1;
      approvedRevenue += amt;
    } else if (enr.status === 'pending') {
      pendingCount += 1;
      pendingRevenue += amt;
    } else {
      rejectedCount += 1;
    }
  }

  return {
    totalCount: enrollments.length,
    approvedCount,
    pendingCount,
    rejectedCount,
    approvedRevenue,
    pendingRevenue,
  };
}

export function formatEnrollmentsCsv(
  enrollments: Enrollment[],
  branches: Branch[] = []
): string {
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const escapeCell = (val: unknown) => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ');
    const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const header = [
    'ID',
    'Student',
    'Email',
    'Course',
    'Branch',
    'Payment Method',
    'Amount (BDT)',
    'TrxID',
    'Invoice',
    'Status',
    'Enrolled At',
  ];

  const rows = enrollments.map((e) =>
    [
      e.id,
      e.studentName,
      e.studentEmail,
      e.courseTitle,
      branchMap.get(e.branchId) || e.branchId,
      e.paymentMethod,
      e.amountPaid,
      e.trxId || '',
      e.invoiceNo || '',
      e.status,
      e.enrolledAt,
    ]
      .map(escapeCell)
      .join(',')
  );

  return [header.map(escapeCell).join(','), ...rows].join('\n');
}
