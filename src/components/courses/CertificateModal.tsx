import { Award, CheckCircle2, ExternalLink, Printer, ShieldCheck, X } from 'lucide-react';
import type { CourseCertificate } from '../../types';

interface CertificateModalProps {
  certificate: CourseCertificate | null;
  onClose: () => void;
  onOpenVerifyPage?: (certNo: string) => void;
}

export function CertificateModal({
  certificate,
  onClose,
  onOpenVerifyPage,
}: CertificateModalProps) {
  if (!certificate) return null;

  const certCode = certificate.certificateNumber || certificate.certificateNo || '';
  const completionPct = certificate.completionPercent ?? certificate.progressPercent ?? 100;
  const issueDate = new Date(certificate.issuedAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Official Course Certificate"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <Award className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-extrabold">Official Completion Certificate</h2>
              <p className="font-mono-tabular text-[11px] text-sky-200">{certCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenVerifyPage && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVerifyPage(certCode);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Public Verify</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-300"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close certificate preview"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto bg-slate-100 p-4 sm:p-8">
          <div className="print-sheet relative mx-auto max-w-3xl overflow-hidden rounded-2xl border-8 border-double border-[#062436] bg-white p-8 text-center shadow-lg sm:p-12">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 text-left">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-indigo-700">
                  Alom&apos;s English Center LMS
                </p>
                <p className="text-[11px] text-slate-500">
                  Mirpur DOHS · Uttara · Chattogram · Digital Academy
                </p>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Verified Credential</span>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">
                Certificate of Achievement
              </p>
              <p className="mt-4 text-sm text-slate-600">This is to proudly certify that</p>
              <h3 className="mt-2 text-3xl font-extrabold tracking-tight text-[#062436] sm:text-4xl">
                {certificate.studentName}
              </h3>
              {certificate.rollNumber && (
                <p className="font-mono-tabular mt-1 text-xs font-bold text-slate-500">
                  Student Roll: {certificate.rollNumber} · {certificate.studentEmail}
                </p>
              )}
              <p className="mt-5 text-sm text-slate-600">
                has successfully fulfilled all academic requirements and completed
              </p>
              <h4 className="mt-2 text-xl font-extrabold text-indigo-700 sm:text-2xl">
                {certificate.courseTitle}
              </h4>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold text-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="font-mono-tabular">{completionPct}% Syllabus Completed</span>
                </span>
                {typeof certificate.examScorePercent === 'number' &&
                  certificate.examScorePercent > 0 && (
                    <span className="font-mono-tabular rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 font-bold text-indigo-700">
                      Assessment Score: {certificate.examScorePercent}%
                    </span>
                  )}
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 border-t border-slate-200 pt-6 text-left sm:grid-cols-3 sm:items-end">
              <div>
                <p className="text-sm font-extrabold text-[#062436]">
                  {certificate.instructorName || certificate.issuedBy || 'Alomgir Hossain'}
                </p>
                <p className="text-[11px] text-slate-500">Lead Instructor &amp; Director</p>
              </div>
              <div className="sm:text-center">
                <p className="font-mono-tabular text-xs font-bold text-slate-800">{issueDate}</p>
                <p className="text-[11px] text-slate-500">Date of Issuance</p>
              </div>
              <div className="sm:text-right">
                <p className="font-mono-tabular text-xs font-extrabold text-indigo-700">
                  {certCode}
                </p>
                <p className="text-[11px] text-slate-500">
                  Verify at /verify-certificate
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
