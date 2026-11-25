import type { AuditLogCategory, AuditLogEntry, AuditLogSeverity, UserRole } from '../types';

export interface AuditLogFilterOptions {
  category?: 'all' | AuditLogCategory;
  actorRole?: 'all' | UserRole;
  searchQuery?: string;
}

export interface AuditLogSummary {
  total: number;
  loginCount: number;
  courseCount: number;
  paymentCount: number;
  systemCount: number;
  warningCount: number;
}

export function classifyAuditCategory(action: string): AuditLogCategory {
  const norm = String(action ?? '').trim().toUpperCase();
  if (
    norm.startsWith('USER_LOGIN') ||
    norm.startsWith('USER_LOGOUT') ||
    norm.startsWith('USER_REGISTER') ||
    norm.includes('AUTH_')
  ) {
    return 'login';
  }
  if (
    norm.startsWith('COURSE_') ||
    norm.startsWith('BATCH_') ||
    norm.startsWith('LESSON_')
  ) {
    return 'course';
  }
  if (
    norm.startsWith('PAYMENT_') ||
    norm.startsWith('EBOOK_CHECKOUT') ||
    norm.startsWith('PRODUCT_CHECKOUT') ||
    norm.startsWith('ENROLLMENT_') ||
    norm.startsWith('ORDER_STATUS') ||
    norm.startsWith('COUPON_') ||
    norm.startsWith('PAYROLL_')
  ) {
    return 'payment';
  }
  return 'system';
}

export function inferAuditSeverity(action: string, explicit?: AuditLogSeverity): AuditLogSeverity {
  if (explicit === 'info' || explicit === 'warning' || explicit === 'critical') {
    return explicit;
  }
  const norm = String(action ?? '').trim().toUpperCase();
  if (
    norm.includes('FAILED') ||
    norm.includes('SYSTEM_RESET') ||
    norm.includes('PURGE')
  ) {
    return 'critical';
  }
  if (
    norm.includes('DELETE') ||
    norm.includes('REFUND') ||
    norm.includes('REJECTED') ||
    norm.includes('DEACTIVATED') ||
    norm.includes('STATUS')
  ) {
    return 'warning';
  }
  return 'info';
}

export function enrichAuditLogEntry(entry: AuditLogEntry): Required<AuditLogEntry> {
  const category = entry.category ?? classifyAuditCategory(entry.action);
  const severity = inferAuditSeverity(entry.action, entry.severity);
  return {
    ...entry,
    category,
    severity,
  };
}

export function maskEmailForAudit(email: string): string {
  const clean = String(email ?? '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 1) return clean || 'unknown-account';
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, Math.min(5, local.length - visible.length)))}${domain}`;
}

export function mergeAuditLogStreamEntry(
  existing: AuditLogEntry[],
  incoming: AuditLogEntry,
  maxItems = 250
): AuditLogEntry[] {
  const enriched = enrichAuditLogEntry(incoming);
  const deduped = existing.filter((item) => item.id !== enriched.id);
  return [enriched, ...deduped]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, Math.max(1, maxItems));
}

export function filterAuditLogs(
  logs: AuditLogEntry[],
  options: AuditLogFilterOptions = {}
): Required<AuditLogEntry>[] {
  const category = options.category ?? 'all';
  const actorRole = options.actorRole ?? 'all';
  const q = String(options.searchQuery ?? '').trim().toLowerCase();

  return logs
    .map(enrichAuditLogEntry)
    .filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (actorRole !== 'all' && entry.actorRole !== actorRole) return false;
      if (!q) return true;
      return (
        entry.action.toLowerCase().includes(q) ||
        entry.target.toLowerCase().includes(q) ||
        entry.details.toLowerCase().includes(q) ||
        entry.actorName.toLowerCase().includes(q) ||
        entry.actorRole.toLowerCase().includes(q)
      );
    });
}

export function computeAuditLogSummary(logs: AuditLogEntry[]): AuditLogSummary {
  let loginCount = 0;
  let courseCount = 0;
  let paymentCount = 0;
  let systemCount = 0;
  let warningCount = 0;

  for (const raw of logs) {
    const entry = enrichAuditLogEntry(raw);
    if (entry.category === 'login') loginCount += 1;
    else if (entry.category === 'course') courseCount += 1;
    else if (entry.category === 'payment') paymentCount += 1;
    else systemCount += 1;

    if (entry.severity === 'warning' || entry.severity === 'critical') {
      warningCount += 1;
    }
  }

  return {
    total: logs.length,
    loginCount,
    courseCount,
    paymentCount,
    systemCount,
    warningCount,
  };
}

export function formatAuditLogsCsv(logs: AuditLogEntry[]): string {
  const escapeCell = (val: unknown) => {
    const str = String(val ?? '').replace(/\r?\n/g, ' ');
    // Mitigate spreadsheet formula injection
    const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  const header = ['Timestamp', 'Category', 'Severity', 'Action', 'Actor', 'Role', 'Target', 'Details'];
  const rows = logs.map((raw) => {
    const e = enrichAuditLogEntry(raw);
    return [
      e.createdAt,
      e.category,
      e.severity,
      e.action,
      e.actorName,
      e.actorRole,
      e.target,
      e.details,
    ]
      .map(escapeCell)
      .join(',');
  });

  return [header.map(escapeCell).join(','), ...rows].join('\n');
}
