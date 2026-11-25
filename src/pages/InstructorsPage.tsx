import { GraduationCap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function InstructorsPage() {
  const { bootstrap } = useAuth();
  const instructors = bootstrap?.instructors ?? [];
  const branches = bootstrap?.branches ?? [];

  const headPanel = instructors.filter((i) => i.panel === 'Head Faculty');
  const branchPanel = instructors.filter((i) => i.panel === 'Branch Faculty');

  const branchName = (branchId: string) =>
    branches.find((b) => b.id === branchId)?.name || 'Main Campus';

  const renderGrid = (list: typeof instructors) => (
    <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((inst) => (
        <div
          key={inst.id}
          className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs"
        >
          <img
            src={inst.avatar}
            alt={inst.name}
            className="h-24 w-24 rounded-full border-4 border-sky-50 object-cover shadow-sm"
            referrerPolicy="no-referrer"
          />
          <h3 className="mt-4 text-lg font-extrabold text-slate-900">{inst.name}</h3>
          <p className="text-xs font-bold uppercase tracking-wider text-sky-600">{inst.subject}</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">{inst.roleTitle}</p>
          <p className="mt-0.5 text-xs text-slate-500">{inst.education}</p>
          <p className="mt-3 text-xs leading-relaxed text-slate-600">{inst.bio}</p>
          <span className="mt-4 text-[11px] font-semibold text-emerald-700">
            Campus: {branchName(inst.branchId)}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/90 via-slate-50 to-white pb-16 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#062436] text-amber-400">
            <GraduationCap className="h-6 w-6" />
          </span>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Our Expert Instructors
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
            Meet our dedicated English faculty across Online, Mirpur, Uttara, and Chattogram
            campuses.
          </p>
        </div>

        <section className="mt-12">
          <h2 className="text-xl font-extrabold text-slate-900">Head Faculty Panel</h2>
          {renderGrid(headPanel)}
        </section>

        <section className="mt-14">
          <h2 className="text-xl font-extrabold text-slate-900">Branch & Academic Faculty</h2>
          {renderGrid(branchPanel)}
        </section>
      </div>
    </div>
  );
}
