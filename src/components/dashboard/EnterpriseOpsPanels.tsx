import {
  Activity,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Database,
  KeyRound,
  Lock,
  Mail,
  Plug,
  Receipt,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type {
  AcademicClassSection,
  AcademicSubject,
  AcademicYear,
  Branch,
  CommunicationLogEntry,
  Course,
  CourseBatch,
  CourseRoutineItem,
  FeeInvoice,
  IntegrationConfig,
  PaymentTransaction,
  StudentAdmissionRecord,
  User,
  UserRole,
} from '../../types';
import { FourStepPaymentModal } from '../FourStepPaymentModal';

// ---------------- ACADEMIC OPS PANEL ----------------

interface AcademicOverviewPayload {
  academicYears: AcademicYear[];
  academicClasses: AcademicClassSection[];
  academicSubjects: AcademicSubject[];
  courseRoutines: CourseRoutineItem[];
  studentAdmissions: StudentAdmissionRecord[];
}

export function AcademicOpsPanel({
  role,
  branches,
  courses,
  batches,
  users,
  onNotify,
}: {
  role: UserRole;
  branches: Branch[];
  courses: Course[];
  batches: CourseBatch[];
  users: User[];
  onNotify: (msg: string) => void;
}) {
  const { apiFetch } = useAuth();
  const [tab, setTab] = useState<'years' | 'classes' | 'subjects' | 'routines' | 'admissions'>('years');
  const [overview, setOverview] = useState<AcademicOverviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Forms
  const [yrName, setYrName] = useState('');
  const [yrCode, setYrCode] = useState('');
  const [yrStart, setYrStart] = useState('2026-01-01');
  const [yrEnd, setYrEnd] = useState('2026-12-31');
  const [yrCurrent, setYrCurrent] = useState(true);

  const [clsBranchId, setClsBranchId] = useState(branches[0]?.id ?? '');
  const [clsYearId, setClsYearId] = useState('');
  const [clsName, setClsName] = useState('');
  const [clsSection, setClsSection] = useState('Section A');
  const [clsRoom, setClsRoom] = useState('Room 201');
  const [clsCap, setClsCap] = useState('40');

  const [subCode, setSubCode] = useState('');
  const [subName, setSubName] = useState('');
  const [subLevel, setSubLevel] = useState('HSC English');
  const [subCourseId, setSubCourseId] = useState(courses[0]?.id ?? '');

  const [rtnCourseId, setRtnCourseId] = useState(courses[0]?.id ?? '');
  const [rtnBranchId, setRtnBranchId] = useState(branches[0]?.id ?? '');
  const [rtnDay, setRtnDay] = useState<CourseRoutineItem['dayOfWeek']>('Sat');
  const [rtnStart, setRtnStart] = useState('16:00');
  const [rtnEnd, setRtnEnd] = useState('17:30');
  const [rtnRoom, setRtnRoom] = useState('Main Campus Room 1');

  const students = users.filter((u) => u.role === 'student');
  const [admStudentId, setAdmStudentId] = useState(students[0]?.id ?? '');
  const [admBranchId, setAdmBranchId] = useState(
    branches.find((b) => b.status === 'active')?.id ?? branches[0]?.id ?? ''
  );
  const [admGuardianName, setAdmGuardianName] = useState('');
  const [admGuardianPhone, setAdmGuardianPhone] = useState('');
  const [admFeePaid, setAdmFeePaid] = useState('1000');

  const loadAcademic = useCallback(async () => {
    try {
      const res = await apiFetch<AcademicOverviewPayload>('/api/portal/academic/overview');
      setOverview(res);
      if (res.academicYears[0]?.id && !clsYearId) {
        setClsYearId(res.academicYears[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load academic records.');
    }
  }, [apiFetch, clsYearId]);

  useEffect(() => {
    void loadAcademic();
  }, [loadAcademic]);

  const isAdmin = role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            <span>Academic Core &amp; Admissions Structure</span>
          </h2>
          <p className="text-xs text-slate-500">
            Academic Years, Class Sections, Subjects, Weekly Timetable Routines &amp; Student Admissions.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'years' as const, label: 'Academic Years' },
            { id: 'classes' as const, label: 'Classes & Sections' },
            { id: 'subjects' as const, label: 'Subjects' },
            { id: 'routines' as const, label: 'Routines' },
            { id: 'admissions' as const, label: 'Admissions' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-colors ${
                tab === t.id
                  ? 'bg-[#062436] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
          {error}
        </p>
      )}

      {tab === 'years' && (
        <div className="space-y-4">
          {isAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/portal/academic/years', {
                    method: 'POST',
                    body: JSON.stringify({
                      name: yrName,
                      code: yrCode,
                      startDate: yrStart,
                      endDate: yrEnd,
                      isCurrent: yrCurrent,
                    }),
                  });
                  setYrName('');
                  setYrCode('');
                  onNotify('Academic year added.');
                  await loadAcademic();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create academic year.');
                }
              }}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-5"
            >
              <input
                type="text"
                required
                placeholder="Year Name (e.g. Session 2026)"
                value={yrName}
                onChange={(e) => setYrName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Code (e.g. AY-2026)"
                value={yrCode}
                onChange={(e) => setYrCode(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs uppercase"
              />
              <input
                type="date"
                required
                value={yrStart}
                onChange={(e) => setYrStart(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="date"
                required
                value={yrEnd}
                onChange={(e) => setYrEnd(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={yrCurrent}
                    onChange={(e) => setYrCurrent(e.target.checked)}
                  />
                  Current
                </label>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  Add Year
                </button>
              </div>
            </form>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(overview?.academicYears ?? []).map((y) => (
              <div key={y.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular text-xs font-bold text-indigo-700">{y.code}</span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      y.isCurrent ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {y.isCurrent ? 'Current Session' : y.status}
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-extrabold text-slate-900">{y.name}</h3>
                <p className="font-mono-tabular mt-1 text-xs text-slate-500">
                  {y.startDate} → {y.endDate}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'classes' && (
        <div className="space-y-4">
          {isAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/portal/academic/classes', {
                    method: 'POST',
                    body: JSON.stringify({
                      academicYearId: clsYearId || overview?.academicYears[0]?.id,
                      branchId: clsBranchId,
                      className: clsName,
                      sectionName: clsSection,
                      roomLabel: clsRoom,
                      capacity: Number(clsCap) || 40,
                    }),
                  });
                  setClsName('');
                  onNotify('Class section created.');
                  await loadAcademic();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create class section.');
                }
              }}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-6"
            >
              <select
                value={clsBranchId}
                onChange={(e) => setClsBranchId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Class (e.g. HSC 2026)"
                value={clsName}
                onChange={(e) => setClsName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                required
                placeholder="Section (e.g. Morning A)"
                value={clsSection}
                onChange={(e) => setClsSection(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Room"
                value={clsRoom}
                onChange={(e) => setClsRoom(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="number"
                min={5}
                value={clsCap}
                onChange={(e) => setClsCap(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Add Section
              </button>
            </form>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {(overview?.academicClasses ?? []).map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <p className="text-sm font-extrabold text-slate-900">
                  {c.className} · {c.sectionName}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Branch: {branches.find((b) => b.id === c.branchId)?.name ?? c.branchId} ·{' '}
                  {c.roomLabel || 'Standard Room'} · Cap {c.capacity}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'subjects' && (
        <div className="space-y-4">
          {isAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/portal/academic/subjects', {
                    method: 'POST',
                    body: JSON.stringify({
                      code: subCode,
                      name: subName,
                      classLevel: subLevel,
                      courseId: subCourseId || null,
                    }),
                  });
                  setSubCode('');
                  setSubName('');
                  onNotify('Subject created.');
                  await loadAcademic();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create subject.');
                }
              }}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-5"
            >
              <input
                type="text"
                required
                placeholder="Code (ENG-101)"
                value={subCode}
                onChange={(e) => setSubCode(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs uppercase"
              />
              <input
                type="text"
                required
                placeholder="Subject Name"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Level"
                value={subLevel}
                onChange={(e) => setSubLevel(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <select
                value={subCourseId}
                onChange={(e) => setSubCourseId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                <option value="">-- Optional Course --</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Add Subject
              </button>
            </form>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {(overview?.academicSubjects ?? []).map((s) => (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                <span className="font-mono-tabular text-xs font-bold text-indigo-700">{s.code}</span>
                <p className="mt-1 text-sm font-extrabold text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.classLevel} · {s.creditsOrMarks} marks
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'routines' && (
        <div className="space-y-4">
          {(isAdmin || role === 'teacher') && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/portal/academic/routines', {
                    method: 'POST',
                    body: JSON.stringify({
                      courseId: rtnCourseId,
                      branchId: rtnBranchId,
                      batchId: batches.find((b) => b.courseId === rtnCourseId)?.id ?? null,
                      dayOfWeek: rtnDay,
                      startTime: rtnStart,
                      endTime: rtnEnd,
                      roomOrLink: rtnRoom,
                    }),
                  });
                  onNotify('Weekly routine slot published.');
                  await loadAcademic();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to create routine.');
                }
              }}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-6"
            >
              <select
                value={rtnCourseId}
                onChange={(e) => setRtnCourseId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <select
                value={rtnBranchId}
                onChange={(e) => setRtnBranchId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                value={rtnDay}
                onChange={(e) => setRtnDay(e.target.value as CourseRoutineItem['dayOfWeek'])}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold"
              >
                {(['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <div className="flex gap-1.5">
                <input
                  type="time"
                  value={rtnStart}
                  onChange={(e) => setRtnStart(e.target.value)}
                  className="w-1/2 rounded-xl border border-slate-300 px-2 py-2 text-xs"
                />
                <input
                  type="time"
                  value={rtnEnd}
                  onChange={(e) => setRtnEnd(e.target.value)}
                  className="w-1/2 rounded-xl border border-slate-300 px-2 py-2 text-xs"
                />
              </div>
              <input
                type="text"
                value={rtnRoom}
                onChange={(e) => setRtnRoom(e.target.value)}
                placeholder="Room or Live Link"
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Add Routine
              </button>
            </form>
          )}
          <div className="space-y-2">
            {(overview?.courseRoutines ?? []).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-xs"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-indigo-600" />
                  <span className="font-extrabold text-slate-900">
                    {r.dayOfWeek} · {r.startTime}–{r.endTime}
                  </span>
                  <span className="text-slate-600">
                    {courses.find((c) => c.id === r.courseId)?.title ?? r.courseId}
                  </span>
                </div>
                <span className="font-semibold text-slate-700">{r.roomOrLink}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'admissions' && (
        <div className="space-y-4">
          {isAdmin && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await apiFetch('/api/portal/academic/admissions', {
                    method: 'POST',
                    body: JSON.stringify({
                      studentUserId: admStudentId,
                      branchId: admBranchId,
                      academicYearId: overview?.academicYears[0]?.id,
                      guardianName: admGuardianName,
                      guardianPhone: admGuardianPhone,
                      admissionFeePaid: Number(admFeePaid) || 0,
                    }),
                  });
                  setAdmGuardianName('');
                  setAdmGuardianPhone('');
                  onNotify('Student admission recorded.');
                  await loadAcademic();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Admission failed.');
                }
              }}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:grid-cols-6"
            >
              <select
                value={admStudentId}
                onChange={(e) => setAdmStudentId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.rollNumber || s.email})
                  </option>
                ))}
              </select>
              <select
                value={admBranchId}
                onChange={(e) => setAdmBranchId(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.status})
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Guardian Name"
                value={admGuardianName}
                onChange={(e) => setAdmGuardianName(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="text"
                placeholder="Guardian Phone"
                value={admGuardianPhone}
                onChange={(e) => setAdmGuardianPhone(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <input
                type="number"
                min={0}
                placeholder="Admission Fee ৳"
                value={admFeePaid}
                onChange={(e) => setAdmFeePaid(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-xs"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Admit</span>
              </button>
            </form>
          )}
          <div className="space-y-2">
            {(overview?.studentAdmissions ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-xs"
              >
                <div>
                  <span className="font-mono-tabular font-extrabold text-indigo-700">
                    {a.admissionNo}
                  </span>{' '}
                  · <strong className="text-slate-900">{a.studentName}</strong> ({a.rollNumber})
                </div>
                <span className="font-mono-tabular font-bold text-emerald-700">
                  ৳{a.admissionFeePaid} · {a.admissionStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- INTEGRATIONS, COMMUNICATIONS & MAIN ADMIN 2FA PANEL ----------------

interface DbHealthPayload {
  sqlite: { ok: boolean; engine: string; integrity: string; adminCount: number; dbPath: string };
  postgres: { configured: boolean; connected: boolean; detail: string };
  revokedLegacyAccounts: { id: string; email: string; previousRole: string; reason: string; revokedAt: string }[];
  backupCount: number;
}

export function IntegrationsAndSecurityPanel({
  users,
  onNotify,
}: {
  users: User[];
  onNotify: (msg: string) => void;
}) {
  const { user, apiFetch, updateUser } = useAuth();
  const [dbHealth, setDbHealth] = useState<DbHealthPayload | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [commLogs, setCommLogs] = useState<CommunicationLogEntry[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editEnabled, setEditEnabled] = useState(false);
  const [editMode, setEditMode] = useState<'sandbox' | 'live'>('sandbox');
  const [editPublic, setEditPublic] = useState<Record<string, string>>({});
  const [editSecrets, setEditSecrets] = useState<Record<string, string>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  // 2FA Setup
  const [twoFaSetup, setTwoFaSetup] = useState<{
    secret: string;
    otpauthUri: string;
    recoveryCodes: string[];
  } | null>(null);
  const [twoFaVerifyCode, setTwoFaVerifyCode] = useState('');
  const [disablePw, setDisablePw] = useState('');
  const [disableCode, setDisableCode] = useState('');

  // Comms dispatch
  const [commChannel, setCommChannel] = useState<'in_app' | 'email' | 'sms' | 'whatsapp'>('in_app');
  const [commRecipient, setCommRecipient] = useState(users[0]?.email ?? '');
  const [commRecipientUserId, setCommRecipientUserId] = useState(users[0]?.id ?? '');
  const [commSubject, setCommSubject] = useState('');
  const [commMessage, setCommMessage] = useState('');

  const loadAll = useCallback(async () => {
    try {
      const [health, ints] = await Promise.all([
        apiFetch<DbHealthPayload>('/api/portal/security/db-health'),
        apiFetch<{ integrations: IntegrationConfig[]; communicationLogs: CommunicationLogEntry[] }>(
          '/api/portal/integrations'
        ),
      ]);
      setDbHealth(health);
      setIntegrations(ints.integrations ?? []);
      setCommLogs(ints.communicationLogs ?? []);
    } catch (err) {
      setPanelError(err instanceof Error ? err.message : 'Failed to load integrations & security health.');
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const startEditIntegration = (item: IntegrationConfig) => {
    setEditingKey(item.key);
    setEditEnabled(item.enabled);
    setEditMode(item.mode);
    setEditPublic({ ...item.publicConfig });
    setEditSecrets({});
  };

  return (
    <div className="space-y-6">
      {panelError && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700">
          {panelError}
        </p>
      )}

      {/* Database Health & Legacy Revocation Guard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Database className="h-5 w-5 text-emerald-600" />
              <span>Persistent Database &amp; Revocation Health</span>
            </h2>
            <button
              type="button"
              onClick={() => void loadAll()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
          {dbHealth && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="font-bold text-slate-700">
                  SQLite Engine ({dbHealth.sqlite.engine || 'sqlite'} · Admin {dbHealth.sqlite.adminCount}/1)
                </span>
                <span className="font-bold text-emerald-700">
                  {dbHealth.sqlite.ok ? 'HEALTHY (WAL + FK)' : 'ERROR'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="font-bold text-slate-700">PostgreSQL Adapter</span>
                <span className="font-semibold text-slate-700">
                  {dbHealth.postgres.connected
                    ? 'CONNECTED'
                    : dbHealth.postgres.configured
                      ? `ERROR: ${dbHealth.postgres.detail}`
                      : 'Standby (DATABASE_URL not set)'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5">
                <span className="font-bold text-slate-700">Verified Backups</span>
                <span className="font-mono-tabular font-extrabold text-indigo-700">
                  {dbHealth.backupCount} snapshots
                </span>
              </div>
              {dbHealth.revokedLegacyAccounts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-extrabold text-amber-900">
                    Revoked Legacy Accounts ({dbHealth.revokedLegacyAccounts.length})
                  </p>
                  {dbHealth.revokedLegacyAccounts.map((r) => (
                    <p key={r.id} className="mt-1 text-[11px] text-amber-800">
                      • {r.email} ({r.previousRole}) — {r.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Admin Two-Factor Authentication (TOTP 2FA) & Session Revocation */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <KeyRound className="h-5 w-5 text-indigo-600" />
              <span>Main Admin 2FA &amp; Session Guard</span>
            </h2>
            <span
              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold uppercase ${
                user?.twoFactorEnabled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {user?.twoFactorEnabled ? '2FA Enabled' : '2FA Optional (Off)'}
            </span>
          </div>

          {!user?.twoFactorEnabled ? (
            <div className="space-y-3">
              {!twoFaSetup ? (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await apiFetch<{
                      secret: string;
                      otpauthUri: string;
                      recoveryCodes: string[];
                    }>('/api/portal/security/2fa/setup', { method: 'POST' });
                    setTwoFaSetup(res);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Initialize TOTP 2FA Setup</span>
                </button>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setPanelError(null);
                    try {
                      await apiFetch('/api/portal/security/2fa/enable', {
                        method: 'POST',
                        body: JSON.stringify({ code: twoFaVerifyCode }),
                      });
                      if (user) updateUser({ ...user, twoFactorEnabled: true });
                      setTwoFaSetup(null);
                      setTwoFaVerifyCode('');
                      onNotify('Main Admin TOTP 2FA is now enabled!');
                    } catch (err) {
                      setPanelError(err instanceof Error ? err.message : 'Invalid 2FA code.');
                    }
                  }}
                  className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs"
                >
                  <p className="font-bold text-indigo-950">
                    Add secret to Google Authenticator / 1Password:
                  </p>
                  <p className="font-mono-tabular break-all rounded bg-white px-2.5 py-1.5 font-bold text-slate-900">
                    {twoFaSetup.secret}
                  </p>
                  <p className="font-bold text-slate-700">Single-use Recovery Codes (save safely):</p>
                  <p className="font-mono-tabular text-[11px] text-slate-800">
                    {twoFaSetup.recoveryCodes.join(' · ')}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={twoFaVerifyCode}
                      onChange={(e) => setTwoFaVerifyCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono-tabular text-xs"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 font-bold text-white"
                    >
                      Verify &amp; Enable 2FA
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setPanelError(null);
                try {
                  await apiFetch('/api/portal/security/2fa/disable', {
                    method: 'POST',
                    body: JSON.stringify({ password: disablePw, code: disableCode }),
                  });
                  if (user) updateUser({ ...user, twoFactorEnabled: false });
                  setDisablePw('');
                  setDisableCode('');
                  onNotify('2FA disabled on Main Admin account.');
                } catch (err) {
                  setPanelError(err instanceof Error ? err.message : 'Failed to disable 2FA.');
                }
              }}
              className="flex flex-wrap gap-2 text-xs"
            >
              <input
                type="password"
                required
                placeholder="Current Password"
                value={disablePw}
                onChange={(e) => setDisablePw(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                required
                placeholder="6-digit TOTP"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                className="w-32 rounded-xl border border-slate-300 px-3 py-2 font-mono-tabular"
              />
              <button
                type="submit"
                className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 font-bold text-rose-700 hover:bg-rose-100"
              >
                Disable 2FA
              </button>
            </form>
          )}

          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={async () => {
                const res = await apiFetch<{ revokedCount: number }>(
                  '/api/portal/security/revoke-all-sessions',
                  { method: 'POST', body: JSON.stringify({}) }
                );
                onNotify(`Revoked ${res.revokedCount} active session(s).`);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              <ShieldAlert className="h-4 w-4" />
              <span>Revoke All Active Main Admin Sessions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Central Integration Manager */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Plug className="h-5 w-5 text-indigo-600" />
            <span>Central Integration &amp; Credential Manager</span>
          </h2>
          <p className="text-xs text-slate-500">
            Secrets are encrypted at rest with AES-256-GCM. Unconfigured connectors display &ldquo;Awaiting Configuration&rdquo; instead of fake connected badges.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {integrations.map((item) => {
            const isEditing = editingKey === item.key;
            const statusBadge =
              item.healthStatus === 'healthy'
                ? 'bg-emerald-100 text-emerald-800'
                : item.healthStatus === 'configured'
                  ? 'bg-sky-100 text-sky-800'
                  : item.healthStatus === 'error'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800';
            const statusLabel =
              item.healthStatus === 'awaiting_configuration'
                ? 'Awaiting Configuration'
                : item.healthStatus.toUpperCase();

            return (
              <div
                key={item.key}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                      {item.category} · {item.mode}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900">{item.name}</h3>
                    <p className="text-xs text-slate-600">{item.description}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-extrabold ${statusBadge}`}>
                    {statusLabel}
                  </span>
                </div>

                {item.lastError && (
                  <p className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700">
                    <XCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.lastError}</span>
                  </p>
                )}

                {isEditing ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await apiFetch(`/api/portal/integrations/${item.key}`, {
                        method: 'PUT',
                        body: JSON.stringify({
                          enabled: editEnabled,
                          mode: editMode,
                          publicConfig: editPublic,
                          secrets: editSecrets,
                        }),
                      });
                      setEditingKey(null);
                      onNotify(`${item.name} configuration saved.`);
                      await loadAll();
                    }}
                    className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={editEnabled}
                          onChange={(e) => setEditEnabled(e.target.checked)}
                        />
                        Enabled
                      </label>
                      <select
                        value={editMode}
                        onChange={(e) => setEditMode(e.target.value as 'sandbox' | 'live')}
                        className="rounded-lg border border-slate-300 px-2 py-1 font-semibold"
                      >
                        <option value="sandbox">Sandbox Mode</option>
                        <option value="live">Live Production</option>
                      </select>
                    </div>

                    {Object.keys(item.publicConfig).map((k) => (
                      <div key={k}>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">
                          {k}
                        </label>
                        <input
                          type="text"
                          value={editPublic[k] ?? ''}
                          onChange={(e) =>
                            setEditPublic((prev) => ({ ...prev, [k]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                        />
                      </div>
                    ))}

                    {Object.keys(item.secretsMasked).map((sk) => (
                      <div key={sk}>
                        <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">
                          {sk} (stored: {item.secretsMasked[sk]})
                        </label>
                        <input
                          type="password"
                          value={editSecrets[sk] ?? ''}
                          onChange={(e) =>
                            setEditSecrets((prev) => ({ ...prev, [sk]: e.target.value }))
                          }
                          placeholder="Enter new secret to update"
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5"
                        />
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="rounded-lg bg-[#062436] px-3 py-1.5 font-bold text-white"
                      >
                        Save Credentials
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingKey(null)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 font-bold text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => startEditIntegration(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Lock className="h-3 w-3" />
                      <span>Configure</span>
                    </button>
                    <button
                      type="button"
                      disabled={testingKey === item.key}
                      onClick={async () => {
                        setTestingKey(item.key);
                        try {
                          const res = await apiFetch<{ ok: boolean; message: string }>(
                            `/api/portal/integrations/${item.key}/test`,
                            { method: 'POST' }
                          );
                          onNotify(res.message);
                          await loadAll();
                        } finally {
                          setTestingKey(null);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      <Activity className="h-3 w-3" />
                      <span>{testingKey === item.key ? 'Testing...' : 'Verify Connection'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Real Communications Dispatch & Delivery Audit */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          <Mail className="h-5 w-5 text-indigo-600" />
          <span>Communication Dispatch &amp; Delivery Logs</span>
        </h2>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPanelError(null);
            try {
              const res = await apiFetch<{ log: CommunicationLogEntry }>(
                '/api/portal/communications/send',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    channel: commChannel,
                    recipient: commRecipient,
                    recipientUserId: commRecipientUserId || undefined,
                    subject: commSubject,
                    message: commMessage,
                  }),
                }
              );
              setCommSubject('');
              setCommMessage('');
              onNotify(`Communication status: ${res.log.status}`);
              await loadAll();
            } catch (err) {
              setPanelError(err instanceof Error ? err.message : 'Failed to send communication.');
            }
          }}
          className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs sm:grid-cols-4"
        >
          <select
            value={commChannel}
            onChange={(e) =>
              setCommChannel(e.target.value as 'in_app' | 'email' | 'sms' | 'whatsapp')
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
          >
            <option value="in_app">In-App Notification</option>
            <option value="email">Real Email (SMTP)</option>
            <option value="sms">Bangladesh SMS (BulkSMSBD)</option>
            <option value="whatsapp">WhatsApp Cloud API</option>
          </select>
          <select
            value={commRecipientUserId}
            onChange={(e) => {
              const uid = e.target.value;
              setCommRecipientUserId(uid);
              const u = users.find((x) => x.id === uid);
              if (u) {
                setCommRecipient(commChannel === 'sms' || commChannel === 'whatsapp' ? u.phone : u.email);
              }
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">-- Custom Recipient --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <input
            type="text"
            required
            placeholder="Recipient Email or 01XXXXXXXXX"
            value={commRecipient}
            onChange={(e) => setCommRecipient(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
          />
          <input
            type="text"
            placeholder="Subject (for email/in-app)"
            value={commSubject}
            onChange={(e) => setCommSubject(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
          />
          <textarea
            rows={2}
            required
            placeholder="Message body..."
            value={commMessage}
            onChange={(e) => setCommMessage(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white p-2.5 sm:col-span-3"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#062436] px-4 py-2 font-bold text-white hover:bg-indigo-700"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Dispatch Now</span>
          </button>
        </form>

        <div className="space-y-2 text-xs">
          {commLogs.length === 0 ? (
            <p className="text-slate-500">No outbound communication attempts logged yet.</p>
          ) : (
            commLogs.slice(0, 15).map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
              >
                <div>
                  <span className="font-bold uppercase text-indigo-700">[{log.channel}]</span>{' '}
                  <strong className="text-slate-900">{log.recipient}</strong> — {log.bodyPreview}
                  {log.errorMessage && (
                    <p className="mt-0.5 text-[11px] font-semibold text-rose-700">{log.errorMessage}</p>
                  )}
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    log.status === 'delivered' || log.status === 'accepted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : log.status === 'failed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------- FEE INVOICES WIDGET ----------------

export function FeeInvoicesWidget({
  role,
  users = [],
  branches = [],
  onRefresh,
  onNotify,
}: {
  role: UserRole;
  users?: User[];
  branches?: Branch[];
  onRefresh?: () => Promise<void>;
  onNotify?: (msg: string) => void;
}) {
  const { apiFetch } = useAuth();
  const [invoices, setInvoices] = useState<FeeInvoice[]>([]);
  const [payingInvoice, setPayingInvoice] = useState<FeeInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const students = users.filter((u) => u.role === 'student');
  const [studentId, setStudentId] = useState(students[0]?.id ?? '');
  const [branchId, setBranchId] = useState(
    branches.find((b) => b.status === 'active')?.id ?? branches[0]?.id ?? ''
  );
  const [feeType, setFeeType] = useState<FeeInvoice['feeType']>('tuition');
  const [title, setTitle] = useState('Monthly Tuition Installment');
  const [amount, setAmount] = useState('2500');
  const [dueDate, setDueDate] = useState('2026-12-31');

  const loadInvoices = useCallback(async () => {
    try {
      const res = await apiFetch<{ invoices: FeeInvoice[] }>('/api/portal/invoices');
      setInvoices(res.invoices ?? []);
    } catch {
      setInvoices([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
          <Receipt className="h-4 w-4 text-indigo-600" />
          <span>Fee Invoices &amp; Installment Dues ({invoices.length})</span>
        </h3>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>
      )}

      {role === 'admin' && students.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await apiFetch('/api/portal/invoices', {
                method: 'POST',
                body: JSON.stringify({
                  studentUserId: studentId,
                  branchId,
                  feeType,
                  title,
                  totalAmount: Number(amount) || 0,
                  dueDate,
                }),
              });
              onNotify?.('Fee invoice generated.');
              await loadInvoices();
              if (onRefresh) await onRefresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to create invoice.');
            }
          }}
          className="grid grid-cols-1 gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:grid-cols-6"
        >
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.status})
              </option>
            ))}
          </select>
          <select
            value={feeType}
            onChange={(e) => setFeeType(e.target.value as FeeInvoice['feeType'])}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-semibold"
          >
            <option value="tuition">Tuition</option>
            <option value="admission">Admission</option>
            <option value="installment">Installment</option>
            <option value="exam">Exam Fee</option>
          </select>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Invoice Title"
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2"
          />
          <input
            type="number"
            min={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono-tabular"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#062436] px-3 py-2 font-bold text-white hover:bg-indigo-700"
          >
            Issue Invoice
          </button>
        </form>
      )}

      {invoices.length === 0 ? (
        <p className="text-xs text-slate-500">No open fee invoices found.</p>
      ) : (
        <div className="space-y-2 text-xs">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="font-bold text-slate-900">
                  <span className="font-mono-tabular text-indigo-700">{inv.invoiceNo}</span> ·{' '}
                  {inv.title} ({inv.studentName})
                </p>
                <p className="text-[11px] text-slate-500">
                  Type: {inv.feeType} · Due {inv.dueDate} · Paid ৳{inv.paidAmount} / ৳
                  {inv.totalAmount}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                    inv.status === 'paid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {inv.status} {inv.dueAmount > 0 ? `(Due ৳${inv.dueAmount})` : ''}
                </span>
                {inv.dueAmount > 0 && (role === 'student' || role === 'guardian' || role === 'admin') && (
                  <button
                    type="button"
                    onClick={() => setPayingInvoice(inv)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Pay ৳{inv.dueAmount}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {payingInvoice && (
        <FourStepPaymentModal
          open={Boolean(payingInvoice)}
          onClose={() => setPayingInvoice(null)}
          referenceType="invoice"
          invoiceId={payingInvoice.id}
          itemTitle={`${payingInvoice.invoiceNo} — ${payingInvoice.title}`}
          baseAmount={payingInvoice.dueAmount}
          branchId={payingInvoice.branchId}
          branches={branches}
          onSuccess={async (_res: { transaction: PaymentTransaction }) => {
            await loadInvoices();
            if (onRefresh) await onRefresh();
            onNotify?.(`Payment processed for ${payingInvoice.invoiceNo}`);
          }}
        />
      )}
    </div>
  );
}
