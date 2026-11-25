import {
  Award,
  BadgeCheck,
  ExternalLink,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { sanitizeSafeUrl } from '../lib/domain';
import type { CenterResultRecord, ExamAttempt } from '../types';

const DEFAULT_BOARD_CFG = {
  title: 'Education Board Result 2026',
  subtitle: 'Check your official board examination results from the Education Board',
  portalHeading: 'Official Result Portals',
  portalDescription:
    'Access the official Education Board websites to check your board examination results instantly. Get your results with roll number, registration number, or name.',
  eboardUrl: 'https://eboardresults.com/',
  eboardLabel: 'Eboard Results',
  educationBoardUrl: 'http://www.educationboardresults.gov.bd/',
  educationBoardLabel: 'Education Board Portal',
};

export function ResultPage() {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  const cfg = {
    ...DEFAULT_BOARD_CFG,
    ...(bootstrap?.settings?.boardResultConfig ?? {}),
  };

  const [roll, setRoll] = useState('AEC-2026-101');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{
    record: CenterResultRecord | null;
    liveAttempts: ExamAttempt[];
  } | null>(null);

  // Admin Results CRUD state
  const [adminResults, setAdminResults] = useState<CenterResultRecord[]>([]);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<CenterResultRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [portalModalOpen, setPortalModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Result form fields
  const [fRoll, setFRoll] = useState('');
  const [fName, setFName] = useState('');
  const [fBatch, setFBatch] = useState('HSC 27 Batch');
  const [fBranch, setFBranch] = useState('Main Campus');
  const [fExamName, setFExamName] = useState('HSC Model Test 2026');
  const [fMcq, setFMcq] = useState(25);
  const [fWritten, setFWritten] = useState(65);
  const [fMax, setFMax] = useState(100);
  const [fGpa, setFGpa] = useState('A+ (GPA 5.00)');
  const [fMerit, setFMerit] = useState(1);
  const [fStatus, setFStatus] = useState('Passed with Distinction');

  // Portal links form fields
  const [pTitle, setPTitle] = useState(cfg.title);
  const [pSubtitle, setPSubtitle] = useState(cfg.subtitle);
  const [pHeading, setPHeading] = useState(cfg.portalHeading);
  const [pDesc, setPDesc] = useState(cfg.portalDescription);
  const [pEboardLabel, setPEboardLabel] = useState(cfg.eboardLabel);
  const [pEboardUrl, setPEboardUrl] = useState(cfg.eboardUrl);
  const [pEduLabel, setPEduLabel] = useState(cfg.educationBoardLabel);
  const [pEduUrl, setPEduUrl] = useState(cfg.educationBoardUrl);

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const loadAdminResults = useCallback(async () => {
    if (!isAdminOrTeacher) {
      setAdminResults([]);
      return;
    }
    try {
      const res = await apiFetch<{ results: CenterResultRecord[] }>('/api/portal/results');
      setAdminResults(res.results ?? []);
    } catch {
      setAdminResults([]);
    }
  }, [isAdminOrTeacher, apiFetch]);

  useEffect(() => {
    void loadAdminResults();
  }, [loadAdminResults]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/results/lookup?roll=${encodeURIComponent(roll.trim())}`
      );
      const json = await res.json();
      if (!res.ok) {
        setLookup(null);
        setError(json.error || 'Result not found');
      } else {
        setLookup(json);
      }
    } catch {
      setError('Failed to check result');
    } finally {
      setLoading(false);
    }
  };

  const openCreateResult = () => {
    setEditingResult(null);
    setFRoll('');
    setFName('');
    setFBatch('HSC 27 Batch');
    setFBranch('Main Campus');
    setFExamName('HSC Model Test 2026');
    setFMcq(25);
    setFWritten(65);
    setFMax(100);
    setFGpa('A+ (GPA 5.00)');
    setFMerit(1);
    setFStatus('Distinction');
    setResultModalOpen(true);
  };

  const openEditResult = (rec: CenterResultRecord) => {
    setEditingResult(rec);
    setFRoll(rec.rollNumber);
    setFName(rec.studentName);
    setFBatch(rec.batchName);
    setFBranch(rec.branchName);
    setFExamName(rec.examName);
    setFMcq(rec.mcqScore);
    setFWritten(rec.writtenScore);
    setFMax(rec.maxScore);
    setFGpa(rec.gpaOrGrade);
    setFMerit(rec.meritPosition);
    setFStatus(rec.status);
    setResultModalOpen(true);
  };

  const saveResultRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      rollNumber: fRoll.trim().toUpperCase(),
      studentName: fName.trim(),
      batchName: fBatch.trim(),
      branchName: fBranch.trim(),
      examName: fExamName.trim(),
      mcqScore: Number(fMcq) || 0,
      writtenScore: Number(fWritten) || 0,
      totalScore: (Number(fMcq) || 0) + (Number(fWritten) || 0),
      maxScore: Math.max(1, Number(fMax) || 100),
      gpaOrGrade: fGpa.trim(),
      meritPosition: Math.max(1, Number(fMerit) || 1),
      status: fStatus.trim(),
    };
    if (editingResult) {
      const editKey = encodeURIComponent(editingResult.id || editingResult.rollNumber);
      await apiFetch(`/api/portal/results/${editKey}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showNotice(`Updated result for ${payload.rollNumber}.`);
    } else {
      await apiFetch('/api/portal/results', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(`Published result for ${payload.rollNumber}.`);
    }
    setResultModalOpen(false);
    await loadAdminResults();
  };

  const deleteResultRecord = async (rec: CenterResultRecord) => {
    const recKey = rec.id || rec.rollNumber;
    if (confirmDeleteId !== recKey) {
      setConfirmDeleteId(recKey);
      return;
    }
    await apiFetch(`/api/portal/results/${encodeURIComponent(recKey)}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await loadAdminResults();
    showNotice(`Deleted result for ${rec.rollNumber}.`);
  };

  const openPortalLinksModal = () => {
    setPTitle(cfg.title);
    setPSubtitle(cfg.subtitle);
    setPHeading(cfg.portalHeading);
    setPDesc(cfg.portalDescription);
    setPEboardLabel(cfg.eboardLabel);
    setPEboardUrl(cfg.eboardUrl);
    setPEduLabel(cfg.educationBoardLabel);
    setPEduUrl(cfg.educationBoardUrl);
    setPortalModalOpen(true);
  };

  const savePortalLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/portal/branding', {
      method: 'PUT',
      body: JSON.stringify({
        boardResultConfig: {
          title: pTitle,
          subtitle: pSubtitle,
          portalHeading: pHeading,
          portalDescription: pDesc,
          eboardLabel: pEboardLabel,
          eboardUrl: pEboardUrl,
          educationBoardLabel: pEduLabel,
          educationBoardUrl: pEduUrl,
        },
      }),
    });
    setPortalModalOpen(false);
    await refreshBootstrap();
    showNotice('Board result portal links updated.');
  };

  return (
    <div className="rm-pastel-bg min-h-screen pb-20 pt-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Centered Header matching Screenshot 1 */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-sky-500 sm:text-4xl">
            {cfg.title}
          </h1>
          <p className="mx-auto mt-2.5 max-w-xl text-sm text-slate-600 sm:text-base">
            {cfg.subtitle}
          </p>
        </div>

        {/* Admin Toolbar */}
        {isAdminOrTeacher && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/90 px-5 py-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <Settings2 className="h-4 w-4 text-sky-600" />
              <span>Admin Result &amp; Portal Control Mode</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={openPortalLinksModal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Portal Links</span>
                </button>
              )}
              <button
                type="button"
                onClick={openCreateResult}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Student Result</span>
              </button>
            </div>
          </div>
        )}

        {toast && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            {toast}
          </div>
        )}

        {/* Primary Official Result Portals Card matching Screenshot 1 */}
        <section className="mt-10 rounded-3xl bg-white p-8 text-center shadow-[0_14px_45px_rgba(15,23,42,0.06)] sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 text-sky-600">
            <GraduationCap className="h-10 w-10" />
          </div>

          <h2 className="mt-6 text-2xl font-extrabold text-slate-900">{cfg.portalHeading}</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
            {cfg.portalDescription}
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <Search className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Quick Search</h3>
              <p className="mt-1 text-xs text-slate-500">Find results by roll number or name</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">Official Results</h3>
              <p className="mt-1 text-xs text-slate-500">Direct from Education Board</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                <GraduationCap className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-slate-900">All Boards</h3>
              <p className="mt-1 text-xs text-slate-500">Results from all education boards</p>
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href={sanitizeSafeUrl(cfg.eboardUrl, 'https://eboardresults.com/')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              <span>{cfg.eboardLabel}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={sanitizeSafeUrl(
                cfg.educationBoardUrl,
                'http://www.educationboardresults.gov.bd/'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl bg-[#0f172a] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800"
            >
              <span>{cfg.educationBoardLabel}</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </section>

        {/* Center Roll Lookup */}
        <section className="mt-8 rounded-3xl bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-8">
          <h2 className="text-lg font-extrabold text-slate-900">
            Student Roll Result Lookup
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Enter your institute Roll Number (e.g.{' '}
            <span className="font-mono-tabular font-bold">AEC-2026-101</span> or{' '}
            <span className="font-mono-tabular font-bold">AEC-2026-102</span>) to check live merit &amp; exam marks.
          </p>

          <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={roll}
                onChange={(e) => setRoll(e.target.value)}
                placeholder="Enter Student Roll (e.g. AEC-2026-101)"
                aria-label="Student Roll Number"
                className="font-mono-tabular w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm uppercase focus:border-sky-500 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-sky-700 disabled:opacity-60"
            >
              {loading ? 'Searching...' : 'Search Result'}
            </button>
          </form>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          {lookup?.record && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                    {lookup.record.examName}
                  </span>
                  <h3 className="text-xl font-extrabold text-slate-900">
                    {lookup.record.studentName}
                  </h3>
                  <p className="text-xs text-slate-600">
                    {lookup.record.batchName} · {lookup.record.branchName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono-tabular inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">
                    <Award className="h-3.5 w-3.5" />
                    Merit #{lookup.record.meritPosition}
                  </span>
                  <p className="font-mono-tabular mt-1 text-lg font-extrabold text-emerald-900">
                    {lookup.record.totalScore}/{lookup.record.maxScore} · {lookup.record.gpaOrGrade}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-emerald-200/80 pt-3 text-center text-xs">
                <div>
                  <span className="text-slate-500">MCQ Score</span>
                  <p className="font-mono-tabular font-bold text-slate-900">
                    {lookup.record.mcqScore}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Written Score</span>
                  <p className="font-mono-tabular font-bold text-slate-900">
                    {lookup.record.writtenScore}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Standing</span>
                  <p className="font-bold text-emerald-800">{lookup.record.status}</p>
                </div>
              </div>
            </div>
          )}

          {lookup && lookup.liveAttempts.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Online MCQ Exam Attempts
              </p>
              {lookup.liveAttempts.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm"
                >
                  <span className="font-semibold text-slate-900">{att.examTitle}</span>
                  <span className="font-mono-tabular font-bold text-sky-700">
                    {att.score}/{att.totalMarks} ({att.grade})
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Admin Published Results Table */}
        {isAdminOrTeacher && (
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-[0_10px_35px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Published Roll Result Records ({adminResults.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Create, update, or delete student exam merit records displayed in public lookup.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateResult}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Record</span>
              </button>
            </div>

            {adminResults.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">No published student result records yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 font-bold uppercase text-slate-500">
                      <th className="py-2.5 pr-3">Roll</th>
                      <th className="py-2.5 pr-3">Student</th>
                      <th className="py-2.5 pr-3">Exam</th>
                      <th className="py-2.5 pr-3">Score</th>
                      <th className="py-2.5 pr-3">Grade</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {adminResults.map((rec) => {
                      const recKey = rec.id || rec.rollNumber;
                      const confirming = confirmDeleteId === recKey;
                      return (
                        <tr key={recKey}>
                          <td className="font-mono-tabular py-3 pr-3 font-bold text-slate-900">
                            {rec.rollNumber}
                          </td>
                          <td className="py-3 pr-3 font-semibold text-slate-800">
                            {rec.studentName}
                          </td>
                          <td className="py-3 pr-3 text-slate-600">{rec.examName}</td>
                          <td className="font-mono-tabular py-3 pr-3 text-slate-800">
                            {rec.totalScore}/{rec.maxScore}
                          </td>
                          <td className="py-3 pr-3 font-bold text-emerald-700">{rec.gpaOrGrade}</td>
                          <td className="py-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditResult(rec)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => void deleteResultRecord(rec)}
                                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${
                                    confirming
                                      ? 'bg-rose-600 text-white'
                                      : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                  }`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                  {confirming && <span>Confirm</span>}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Add / Edit Result Record Modal */}
      {resultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editingResult ? 'Edit Result Record' : 'Add Result Record'}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editingResult ? 'Edit Student Result' : 'Publish Student Result'}
              </h3>
              <button
                type="button"
                onClick={() => setResultModalOpen(false)}
                aria-label="Close result modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={saveResultRecord} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Roll Number *</label>
                  <input
                    type="text"
                    required
                    value={fRoll}
                    onChange={(e) => setFRoll(e.target.value)}
                    placeholder="AEC-2026-103"
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2 uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Student Name *</label>
                  <input
                    type="text"
                    required
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Exam Name *</label>
                  <input
                    type="text"
                    required
                    value={fExamName}
                    onChange={(e) => setFExamName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Batch Name</label>
                  <input
                    type="text"
                    value={fBatch}
                    onChange={(e) => setFBatch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">MCQ Score</label>
                  <input
                    type="number"
                    min={0}
                    value={fMcq}
                    onChange={(e) => setFMcq(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Written</label>
                  <input
                    type="number"
                    min={0}
                    value={fWritten}
                    onChange={(e) => setFWritten(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Max Marks</label>
                  <input
                    type="number"
                    min={1}
                    value={fMax}
                    onChange={(e) => setFMax(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Grade / GPA</label>
                  <input
                    type="text"
                    value={fGpa}
                    onChange={(e) => setFGpa(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Merit #</label>
                  <input
                    type="number"
                    min={1}
                    value={fMerit}
                    onChange={(e) => setFMerit(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Status</label>
                  <select
                    value={fStatus === 'Distinction' ? 'Distinction' : 'Passed'}
                    onChange={(e) => setFStatus(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  >
                    <option value="Distinction">Distinction</option>
                    <option value="Passed">Passed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Branch Name</label>
                <input
                  type="text"
                  value={fBranch}
                  onChange={(e) => setFBranch(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setResultModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  {editingResult ? 'Save Changes' : 'Publish Result'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Official Portal Links Modal */}
      {portalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label="Edit Board Result Portal Settings"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                Edit Official Result Portal Page
              </h3>
              <button
                type="button"
                onClick={() => setPortalModalOpen(false)}
                aria-label="Close portal settings modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={savePortalLinks} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Page Headline</label>
                <input
                  type="text"
                  required
                  value={pTitle}
                  onChange={(e) => setPTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Page Subtitle</label>
                <input
                  type="text"
                  value={pSubtitle}
                  onChange={(e) => setPSubtitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Portal Card Heading</label>
                <input
                  type="text"
                  value={pHeading}
                  onChange={(e) => setPHeading(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Portal Card Description</label>
                <textarea
                  rows={3}
                  value={pDesc}
                  onChange={(e) => setPDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Primary Button Label</label>
                  <input
                    type="text"
                    value={pEboardLabel}
                    onChange={(e) => setPEboardLabel(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Primary Button URL</label>
                  <input
                    type="url"
                    value={pEboardUrl}
                    onChange={(e) => setPEboardUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Secondary Button Label</label>
                  <input
                    type="text"
                    value={pEduLabel}
                    onChange={(e) => setPEduLabel(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Secondary Button URL</label>
                  <input
                    type="url"
                    value={pEduUrl}
                    onChange={(e) => setPEduUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPortalModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  Save Portal Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
