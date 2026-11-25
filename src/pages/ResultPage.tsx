import { Award, ExternalLink, Search } from 'lucide-react';
import { useState } from 'react';
import type { CenterResultRecord, ExamAttempt } from '../types';

export function ResultPage() {
  const [roll, setRoll] = useState('AEC-2026-101');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{
    record: CenterResultRecord | null;
    liveAttempts: ExamAttempt[];
  } | null>(null);

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/90 via-slate-50 to-white pb-16 pt-10">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Exam & Education Board Result 2026
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Check your Aloms English Center model test result by Roll Number or open official
            Education Board portals.
          </p>
        </div>

        {/* Center Roll Lookup */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-lg font-extrabold text-slate-900">
            Aloms English Center — Student Roll Result Lookup
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Try sample roll numbers: <span className="font-mono-tabular font-bold">AEC-2026-101</span>{' '}
            or <span className="font-mono-tabular font-bold">AEC-2026-102</span>
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
                className="font-mono-tabular w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#062436] px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-600"
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
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5">
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
                  <span className="font-mono-tabular font-bold text-indigo-700">
                    {att.score}/{att.totalMarks} ({att.grade})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Official Board Portals matching Redwan's Method */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          <h2 className="text-lg font-extrabold text-slate-900">Official Result Portals</h2>
          <p className="mt-1 text-sm text-slate-600">
            Access official Education Board websites to check your SSC/HSC board examination
            results with roll and registration number.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Quick Search</h3>
              <p className="mt-1 text-xs text-slate-600">Find results by roll number or board</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">Official Results</h3>
              <p className="mt-1 text-xs text-slate-600">Direct from Bangladesh Education Board</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold text-slate-900">All Boards</h3>
              <p className="mt-1 text-xs text-slate-600">Dhaka, Chattogram, Rajshahi & all boards</p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="https://eboardresults.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
            >
              <span>Eboard Results</span>
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href="http://www.educationboardresults.gov.bd/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              <span>Education Board Portal</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
