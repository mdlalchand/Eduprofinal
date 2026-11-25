import { Award, CheckCircle2, Flame, Play, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type { LearnerRewardProfile, ScormPackage } from '../types';

declare global {
  interface Window {
    API?: {
      LMSInitialize: () => string;
      LMSGetValue: (key: string) => string;
      LMSSetValue: (key: string, val: string) => string;
      LMSCommit: () => string;
      LMSFinish: () => string;
    };
  }
}

interface ScormPlayerModalProps {
  pkg: ScormPackage | null;
  onClose: () => void;
  onCompleted?: (rewards: LearnerRewardProfile) => void;
}

export function ScormPlayerModal({ pkg, onClose, onCompleted }: ScormPlayerModalProps) {
  const { apiFetch } = useAuth();
  const [cmiState, setCmiState] = useState({
    lessonStatus: 'incomplete' as 'incomplete' | 'completed' | 'passed',
    scoreRaw: 0,
    suspendData: 'step:1',
  });
  const [selectedAns, setSelectedAns] = useState<number | null>(null);
  const [committing, setCommitting] = useState(false);
  const [awarded, setAwarded] = useState<LearnerRewardProfile | null>(null);
  const [apiLog, setApiLog] = useState<string[]>(['SCORM 1.2 RTE window.API initialized']);

  useEffect(() => {
    if (!pkg) return;
    setAwarded(null);
    setSelectedAns(null);
    setCmiState({ lessonStatus: 'incomplete', scoreRaw: 0, suspendData: 'step:1' });
    setApiLog([`LMSInitialize("") -> "true" [${pkg.identifier}]`]);

    const memory: Record<string, string> = {
      'cmi.core.lesson_status': 'incomplete',
      'cmi.core.score.raw': '0',
      'cmi.suspend_data': 'step:1',
    };

    window.API = {
      LMSInitialize: () => 'true',
      LMSGetValue: (key: string) => memory[key] || '',
      LMSSetValue: (key: string, val: string) => {
        memory[key] = val;
        setApiLog((prev) => [`LMSSetValue("${key}", "${val}")`, ...prev.slice(0, 5)]);
        return 'true';
      },
      LMSCommit: () => 'true',
      LMSFinish: () => 'true',
    };

    return () => {
      delete window.API;
    };
  }, [pkg]);

  if (!pkg) return null;

  const commitProgress = async (status: 'incomplete' | 'completed' | 'passed', score: number) => {
    window.API?.LMSSetValue('cmi.core.lesson_status', status);
    window.API?.LMSSetValue('cmi.core.score.raw', String(score));
    window.API?.LMSCommit();

    setCommitting(true);
    try {
      const res = await apiFetch<{ rewards: LearnerRewardProfile }>('/api/scorm/commit', {
        method: 'POST',
        body: JSON.stringify({
          packageId: pkg.id,
          lessonStatus: status,
          scoreRaw: score,
          sessionTime: '00:04:15',
          suspendData: `quiz:${selectedAns ?? 0}`,
        }),
      });
      setCmiState({ lessonStatus: status, scoreRaw: score, suspendData: 'completed' });
      setAwarded(res.rewards);
      setApiLog((prev) => [`LMSCommit() -> 200 OK (XP: ${res.rewards.xp})`, ...prev.slice(0, 5)]);
      onCompleted?.(res.rewards);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-label="SCORM 1.2 Learning Package Runtime"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between bg-[#062436] px-6 py-4 text-white">
          <div>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
              <ShieldCheck className="h-3 w-3" /> SCORM 1.2 Runtime · {pkg.identifier}
            </span>
            <h2 className="mt-1 text-base font-extrabold">{pkg.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close SCORM player"
            className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Launch Resource: {pkg.launchFile} · Reward: +{pkg.xpReward} XP
            </p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">{pkg.htmlContent}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
            <p className="text-sm font-extrabold text-slate-900">
              Interactive Checkpoint: Choose the grammatically correct sentence:
            </p>
            {[
              'Neither the teacher nor the students were absent yesterday.',
              'Neither the teacher nor the students was absent yesterday.',
              'Neither the teacher nor the students are absent yesterday.',
            ].map((opt, idx) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSelectedAns(idx)}
                className={`w-full rounded-xl border p-3 text-left text-xs font-semibold transition-colors ${
                  selectedAns === idx
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {opt}
              </button>
            ))}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={committing || selectedAns === null}
                onClick={() =>
                  void commitProgress(selectedAns === 0 ? 'passed' : 'completed', selectedAns === 0 ? 100 : 75)
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                <span>{committing ? 'Committing SCORM API...' : 'Submit & Commit SCORM Score'}</span>
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Status: <strong className="text-slate-800">{cmiState.lessonStatus}</strong> · Score:{' '}
                <strong className="font-mono-tabular text-indigo-600">{cmiState.scoreRaw}%</strong>
              </span>
            </div>
          </div>

          {awarded && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-amber-600" />
                <div>
                  <p className="text-sm font-extrabold text-amber-950">
                    Module Completed! Total XP: {awarded.xp}
                  </p>
                  <p className="text-xs text-amber-800 flex items-center gap-2 mt-0.5">
                    <Flame className="h-3.5 w-3.5 text-orange-600" />
                    Streak: {awarded.streakDays}d · Badges: {awarded.badges.join(', ')}
                  </p>
                </div>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
          )}

          <div className="rounded-xl bg-slate-900 p-3 font-mono text-[11px] text-emerald-300">
            {apiLog.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
