import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Printer,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { CourseCertificate } from '../types';

interface VerifyCertificatePageProps {
  initialCertNo?: string;
  navigate: (path: string) => void;
}

export function VerifyCertificatePage({
  initialCertNo = '',
  navigate,
}: VerifyCertificatePageProps) {
  const [certInput, setCertInput] = useState(initialCertNo);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    valid: boolean;
    certificate: CourseCertificate;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerify = useCallback(async (rawNo: string) => {
    const clean = rawNo.trim().toUpperCase();
    if (!clean) {
      setError('Please enter a certificate number (e.g. AEC-CERT-2026-...).');
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/certificates/verify/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (!res.ok) {
        setResult(null);
        setError(data.error || `No certificate found for "${clean}".`);
        return;
      }
      setResult(data as { valid: boolean; certificate: CourseCertificate });
    } catch {
      setError('Unable to reach certificate verification registry.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCertNo) {
      setCertInput(initialCertNo);
      void runVerify(initialCertNo);
    }
  }, [initialCertNo, runVerify]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runVerify(certInput);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-indigo-50/40 to-white px-4 py-14 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="no-print text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#062436] text-amber-400 shadow-md">
            <ShieldCheck className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
            Certificate Verification Portal
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Verify the authenticity of any official Alom&apos;s English Center course completion
            certificate using its unique certificate number.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-7 flex max-w-xl flex-col gap-2.5 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={certInput}
                onChange={(e) => setCertInput(e.target.value)}
                placeholder="Enter Certificate No (e.g. AEC-CERT-2026-...)"
                aria-label="Certificate Number"
                className="font-mono-tabular w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm uppercase shadow-xs focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? 'Verifying...' : 'Verify Credential'}
            </button>
          </form>
        </div>

        {error && (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
            <h2 className="mt-2 text-lg font-extrabold text-rose-900">Verification Failed</h2>
            <p className="mt-1 text-sm text-rose-700">{error}</p>
          </div>
        )}

        {result && (
          <div className="print-sheet mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
            <div
              className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-white ${
                result.valid ? 'bg-emerald-700' : 'bg-rose-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {result.valid ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <AlertTriangle className="h-5 w-5" />
                )}
                <span className="text-sm font-extrabold uppercase tracking-wide">
                  {result.valid
                    ? 'Authentic & Active Certificate'
                    : 'Certificate Revoked / Invalid'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="no-print inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/25"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Verification</span>
              </button>
            </div>

            <div className="space-y-4 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Recipient Name
                  </p>
                  <h2 className="mt-0.5 text-2xl font-extrabold text-slate-900">
                    {result.certificate.studentName}
                  </h2>
                  {result.certificate.rollNumber && (
                    <p className="font-mono-tabular text-xs font-semibold text-slate-500">
                      Roll: {result.certificate.rollNumber}
                    </p>
                  )}
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Certificate Number
                  </p>
                  <p className="font-mono-tabular mt-0.5 text-base font-extrabold text-indigo-700">
                    {result.certificate.certificateNumber || result.certificate.certificateNo}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Completed Course</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">
                    {result.certificate.courseTitle}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">Issued Date &amp; Instructor</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {new Date(result.certificate.issuedAt).toLocaleDateString()} ·{' '}
                    {result.certificate.instructorName || result.certificate.issuedBy || 'AEC Faculty'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
                  <Award className="h-4 w-4" />
                  <span className="font-mono-tabular">
                    {result.certificate.completionPercent ??
                      result.certificate.progressPercent ??
                      100}
                    % Syllabus Completion
                  </span>
                  {typeof result.certificate.examScorePercent === 'number' &&
                    result.certificate.examScorePercent > 0 && (
                      <span className="font-mono-tabular text-indigo-700">
                        · Exam Best: {result.certificate.examScorePercent}%
                      </span>
                    )}
                </span>
                {result.certificate.courseSlug && (
                  <button
                    type="button"
                    onClick={() => navigate(`/course/${result.certificate.courseSlug}`)}
                    className="no-print font-bold text-indigo-600 hover:underline"
                  >
                    View Course Details →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
