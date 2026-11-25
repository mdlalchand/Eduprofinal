import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Layers,
  Radio,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  Video,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AnalyticsOverviewData,
  CourseProgressSummary,
  FuturisticKpiCard,
  LiveSpotlightItem,
  OverviewRange,
} from '../../lib/dashboardAnalytics';
import { DEFAULT_DASHBOARD_CONFIG } from '../../lib/domain';
import type { DashboardColorConfig, DashboardCustomizationConfig, UserRole } from '../../types';

/* ============================================================================
 * 1. VIVID GRADIENT KPI CARDS ROW
 * ========================================================================== */
const FUTURISTIC_KPI_ICONS = {
  students: Users,
  teachers: UserCheck,
  courses: BookOpen,
  batches: Layers,
};

export function FuturisticKpiGrid({
  items,
  lang,
  role = 'admin',
  colors = DEFAULT_DASHBOARD_CONFIG.colors,
  kpiLabels = DEFAULT_DASHBOARD_CONFIG.kpiLabels,
  onCardClick,
}: {
  items: FuturisticKpiCard[];
  lang: 'en' | 'bn';
  role?: UserRole;
  colors?: DashboardColorConfig;
  kpiLabels?: DashboardCustomizationConfig['kpiLabels'];
  onCardClick: (id: FuturisticKpiCard['id']) => void;
}) {
  const gradientById: Record<FuturisticKpiCard['id'], [string, string]> = {
    students: [colors.kpiStudentsStart, colors.kpiStudentsEnd],
    teachers: [colors.kpiTeachersStart, colors.kpiTeachersEnd],
    courses: [colors.kpiCoursesStart, colors.kpiCoursesEnd],
    batches: [colors.kpiBatchesStart, colors.kpiBatchesEnd],
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((card) => {
        const Icon = FUTURISTIC_KPI_ICONS[card.id];
        const [gradStart, gradEnd] = gradientById[card.id];
        const label =
          lang === 'bn'
            ? card.labelBn
            : role === 'admin'
              ? kpiLabels[card.id] || card.label
              : card.label;
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onCardClick(card.id)}
            style={{
              backgroundImage: `linear-gradient(to bottom right, ${gradStart}, ${gradEnd})`,
            }}
            className="group relative overflow-hidden rounded-2xl p-4 text-left text-white shadow-lg transition-transform hover:-translate-y-0.5"
          >
            {/* Translucent wave decoration */}
            <svg
              viewBox="0 0 220 80"
              className="pointer-events-none absolute -bottom-2 right-0 h-16 w-40 opacity-25"
              aria-hidden="true"
            >
              <path
                d="M0 60 C 45 20, 95 75, 145 35 C 175 10, 200 28, 220 12 L 220 80 L 0 80 Z"
                fill="white"
              />
            </svg>

            <div className="relative flex items-center gap-3.5">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/25 backdrop-blur-xs ${card.iconBg}`}
              >
                <Icon className="h-5 w-5" />
              </span>

              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-white/90">{label}</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="tabular-nums text-2xl font-extrabold tracking-tight">
                    {card.valueDisplay}
                  </span>
                  <span className="tabular-nums text-xs font-extrabold text-emerald-100">
                    {card.deltaPercent.includes('%') ? `↑ ${card.deltaPercent}` : card.deltaPercent}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-white/80">
                  {card.lastMonthText}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * 2. MULTI-LINE ANALYTICS OVERVIEW CARD
 * ========================================================================== */
interface AnalyticsOverviewCardProps {
  overview: AnalyticsOverviewData;
  range: OverviewRange;
  onRangeChange: (r: OverviewRange) => void;
  colors?: DashboardColorConfig;
  darkMode?: boolean;
}

export function AnalyticsOverviewCard({
  overview,
  range,
  onRangeChange,
  colors = DEFAULT_DASHBOARD_CONFIG.colors,
  darkMode = false,
}: AnalyticsOverviewCardProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const chartW = 470;
  const chartH = 210;
  const padL = 40;
  const padR = 24;
  const padT = 28;
  const padB = 26;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const maxVal = Math.max(
    20,
    ...overview.studentsSeries,
    ...overview.enrollmentsSeries,
    ...overview.viewsSeries
  );
  const stepUnit = maxVal > 10000 ? 5000 : maxVal > 1000 ? 500 : maxVal > 100 ? 50 : 20;
  const yScaleMax = Math.max(20, Math.ceil(maxVal / stepUnit) * stepUnit);
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => Math.round(yScaleMax * ratio));
  const seriesLabels = overview.seriesLabels ?? ['Students', 'Enrollments', 'Course Views'];

  const mapPoints = (vals: number[]) =>
    vals.map((v, idx) => {
      const x = padL + (idx / Math.max(1, vals.length - 1)) * plotW;
      const y = padT + plotH - (Math.min(yScaleMax, v) / yScaleMax) * plotH;
      return { x, y, val: v };
    });

  const stuPts = mapPoints(overview.studentsSeries);
  const enrPts = mapPoints(overview.enrollmentsSeries);
  const viewPts = mapPoints(overview.viewsSeries);

  const toPoly = (pts: { x: number; y: number }[]) =>
    pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const focusIdx = hoverIdx ?? stuPts.length - 1;
  const focusPt = stuPts[focusIdx];

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-5 shadow-sm ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
          : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg"
              style={{
                backgroundColor: `${colors.chartStudentsColor}22`,
                color: colors.chartStudentsColor,
              }}
            >
              <TrendingUp className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-extrabold">Analytics Overview</h2>
          </div>

          <select
            aria-label="Analytics overview timeframe"
            value={range}
            onChange={(e) => onRangeChange(e.target.value as OverviewRange)}
            className={`rounded-xl border px-3 py-1.5 text-xs font-bold focus:outline-none ${
              darkMode
                ? 'border-[#25365E] bg-[#132043] text-slate-100'
                : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            <option value="Last 6 Months">Last 6 Months</option>
            <option value="Last 12 Months">Last 12 Months</option>
            <option value="This Quarter">This Quarter</option>
          </select>
        </div>

        {/* Inline Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.chartStudentsColor }} />
            <span>{seriesLabels[0]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.chartEnrollmentsColor }} />
            <span>{seriesLabels[1]}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.chartViewsColor }} />
            <span>{seriesLabels[2]}</span>
          </span>
        </div>
      </div>

      <div className="relative mt-2 w-full">
        {/* Floating Callout Pill */}
        {focusPt && (
          <div
            className={`pointer-events-none absolute right-2 top-0 z-10 rounded-xl border px-3 py-1.5 text-center shadow-md ${
              darkMode
                ? 'border-blue-500/40 bg-[#132043] text-white'
                : 'border-blue-100 bg-white text-slate-900'
            }`}
          >
            <p className="tabular-nums text-xs font-extrabold" style={{ color: colors.chartStudentsColor }}>
              {overview.studentsSeries[focusIdx].toLocaleString()}
            </p>
            <p className="text-[10px] font-semibold opacity-75">
              {overview.labels[focusIdx]} {overview.highlightLabel}
            </p>
          </div>
        )}

        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full overflow-visible">
          {yTicks.map((tick) => {
            const y = padT + plotH - (tick / yScaleMax) * plotH;
            return (
              <g key={tick}>
                <line
                  x1={padL}
                  y1={y}
                  x2={chartW - padR}
                  y2={y}
                  stroke={darkMode ? '#1E2E52' : '#E2E8F0'}
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={padL - 7}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[9px] font-semibold"
                >
                  {tick >= 1000 ? `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}K` : tick}
                </text>
              </g>
            );
          })}

          <polyline
            fill="none"
            stroke={colors.chartStudentsColor}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={toPoly(stuPts)}
          />
          <polyline
            fill="none"
            stroke={colors.chartEnrollmentsColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={toPoly(enrPts)}
          />
          <polyline
            fill="none"
            stroke={colors.chartViewsColor}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={toPoly(viewPts)}
          />

          {overview.labels.map((lbl, idx) => {
            const s = stuPts[idx];
            const en = enrPts[idx];
            const vw = viewPts[idx];
            return (
              <g
                key={`${lbl}-${idx}`}
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                className="cursor-pointer"
              >
                <circle cx={s.x} cy={s.y} r="4" fill="#FFFFFF" stroke={colors.chartStudentsColor} strokeWidth="2.2" />
                <circle cx={en.x} cy={en.y} r="3.8" fill="#FFFFFF" stroke={colors.chartEnrollmentsColor} strokeWidth="2.2" />
                <circle cx={vw.x} cy={vw.y} r="3.8" fill="#FFFFFF" stroke={colors.chartViewsColor} strokeWidth="2.2" />
                <rect x={s.x - 14} y={padT} width="28" height={plotH} fill="transparent" />
                <text
                  x={s.x}
                  y={chartH - 5}
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] font-bold"
                >
                  {lbl}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/* ============================================================================
 * 3. COURSE PROGRESS DONUT CARD
 * ========================================================================== */
export function CourseProgressCard({
  progress,
  title = 'Course Progress',
  onViewDetails,
  colors = DEFAULT_DASHBOARD_CONFIG.colors,
  darkMode = false,
}: {
  progress: CourseProgressSummary;
  title?: string;
  onViewDetails: () => void;
  colors?: DashboardColorConfig;
  darkMode?: boolean;
}) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const completedDash = (progress.completedPct / 100) * circ;
  const progressDash = (progress.inProgressPct / 100) * circ;
  const notStartedDash = (progress.notStartedPct / 100) * circ;

  return (
    <div
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border p-5 shadow-sm ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0F1B3B] text-white'
          : 'border-white/80 bg-white/90 text-slate-900 backdrop-blur-md'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
            <Trophy className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-extrabold">{title}</h2>
        </div>
        <GraduationCap className="h-5 w-5 opacity-60" style={{ color: colors.chartStudentsColor }} />
      </div>

      <div className="my-3 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={darkMode ? '#1B2B52' : '#E2E8F0'}
              strokeWidth="18"
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors.chartStudentsColor}
              strokeWidth="18"
              strokeDasharray={`${completedDash} ${circ}`}
              strokeDashoffset={0}
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors.chartEnrollmentsColor}
              strokeWidth="18"
              strokeDasharray={`${progressDash} ${circ}`}
              strokeDashoffset={-completedDash}
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={colors.kpiBatchesStart}
              strokeWidth="18"
              strokeDasharray={`${notStartedDash} ${circ}`}
              strokeDashoffset={-(completedDash + progressDash)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="tabular-nums text-2xl font-extrabold">
              {progress.overallPercent}%
            </span>
            <span className="text-[10px] font-bold leading-tight opacity-70">
              Overall
              <br />
              Progress
            </span>
          </div>
        </div>

        <div className="w-full space-y-3 sm:w-auto sm:flex-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.chartStudentsColor }} />
              <span>Completed</span>
            </span>
            <strong className="tabular-nums font-extrabold">{progress.completedPct}%</strong>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.chartEnrollmentsColor }} />
              <span>In Progress</span>
            </span>
            <strong className="tabular-nums font-extrabold">{progress.inProgressPct}%</strong>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.kpiBatchesStart }} />
              <span>Not Started</span>
            </span>
            <strong className="tabular-nums font-extrabold">{progress.notStartedPct}%</strong>
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-1">
        <button
          type="button"
          onClick={onViewDetails}
          style={{
            backgroundImage: `linear-gradient(to right, ${colors.activeNavStart}, ${colors.activeNavEnd})`,
          }}
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95"
        >
          <span>View Details</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
 * 4. LIVE CLASS NOW SPOTLIGHT CARD
 * ========================================================================== */
export function LiveClassSpotlightCard({
  spotlight,
  colors = DEFAULT_DASHBOARD_CONFIG.colors,
  bannerOverride = '',
  onJoinClass,
}: {
  spotlight: LiveSpotlightItem;
  colors?: DashboardColorConfig;
  bannerOverride?: string;
  onJoinClass: (item: LiveSpotlightItem) => void;
}) {
  const displayBanner = bannerOverride.trim() || spotlight.bannerImage;
  const resolvedSpotlight: LiveSpotlightItem = { ...spotlight, bannerImage: displayBanner };

  return (
    <div
      style={{
        backgroundImage: `linear-gradient(to bottom, ${colors.liveCardStart}, ${colors.liveCardEnd})`,
      }}
      className="flex h-full flex-col justify-between rounded-2xl border border-[#1E3468] p-5 text-white shadow-lg"
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-amber-300">
              <Video className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-extrabold">Live Class Now</h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
            <Radio className="h-3 w-3" />
            <span>{spotlight.isLiveNow ? 'Live' : 'Next'}</span>
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl border border-white/15 bg-slate-950">
          <img
            src={displayBanner}
            alt={spotlight.title}
            referrerPolicy="no-referrer"
            className="h-32 w-full object-cover"
          />
        </div>

        <h3 className="mt-3 line-clamp-1 text-sm font-extrabold text-white">
          {spotlight.title}
        </h3>
        <p className="mt-1 text-[11px] font-medium text-blue-200">
          {spotlight.timeRange} · {spotlight.instructorName}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-100">
          <Users className="h-3.5 w-3.5 text-amber-300" />
          <span className="tabular-nums">{spotlight.watchingCount} Watching</span>
        </span>
        <button
          type="button"
          onClick={() => onJoinClass(resolvedSpotlight)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-rose-500"
        >
          <span>Join Class</span>
        </button>
      </div>
    </div>
  );
}
