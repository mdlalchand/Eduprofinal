import {
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  DASHBOARD_PRESET_PALETTES,
  DEFAULT_DASHBOARD_CONFIG,
  normalizeDashboardConfig,
} from '../../lib/domain';
import type {
  DashboardColorConfig,
  DashboardCustomizationConfig,
  DashboardImageConfig,
  DashboardWidgetVisibility,
} from '../../types';
import { ImageUploadField } from '../ImageUploadField';

interface DashboardCustomizerModalProps {
  open: boolean;
  config: DashboardCustomizationConfig;
  onClose: () => void;
  onSave: (nextConfig: DashboardCustomizationConfig) => Promise<void> | void;
}

type CustomizerTab = 'colors' | 'images' | 'content';

const WIDGET_LABELS: { key: keyof DashboardWidgetVisibility; label: string; desc: string }[] = [
  { key: 'heroBanner', label: 'Welcome Hero Banner', desc: 'Campus banner with quote & quick jump CTA' },
  { key: 'kpiRow', label: '4 Gradient KPI Cards', desc: 'Students, Teachers, Courses & Batches cards' },
  { key: 'analyticsOverview', label: 'Analytics Overview Chart', desc: 'Multi-line growth graph & range filter' },
  { key: 'courseProgress', label: 'Course Progress Donut', desc: 'Completion breakdown donut & button' },
  { key: 'liveClassNow', label: 'Live Class Now Spotlight', desc: 'Featured live session card & Join Class' },
  { key: 'recentActivities', label: 'Recent Activities Feed', desc: 'Latest enrollments, payments & updates' },
  { key: 'upcomingClasses', label: 'Upcoming Classes List', desc: 'Next batch schedule cards' },
  { key: 'topStudents', label: 'Top Students Leaderboard', desc: 'Top ranked learners with progress bars' },
  { key: 'quickActions', label: 'Quick Actions Grid', desc: 'One-click Add Post, Batch, E-Book & Course' },
  { key: 'systemActivityLogs', label: 'Real-Time System Activity Logs', desc: 'Live stream of logins, course edits & payments' },
];

const COLOR_GROUPS: {
  title: string;
  items: { key: keyof DashboardColorConfig; label: string }[];
}[] = [
  {
    title: 'Workspace & Sidebar',
    items: [
      { key: 'workspaceLightBg', label: 'Light Canvas Start' },
      { key: 'workspaceLightBgEnd', label: 'Light Canvas End' },
      { key: 'workspaceDarkBg', label: 'Dark Mode Canvas' },
      { key: 'sidebarStart', label: 'Sidebar Top' },
      { key: 'sidebarEnd', label: 'Sidebar Bottom' },
      { key: 'activeNavStart', label: 'Active Accent Start' },
      { key: 'activeNavEnd', label: 'Active Accent End' },
    ],
  },
  {
    title: 'Hero Welcome Banner',
    items: [
      { key: 'heroStart', label: 'Hero Gradient Start' },
      { key: 'heroMid', label: 'Hero Gradient Mid' },
      { key: 'heroEnd', label: 'Hero Gradient End' },
      { key: 'heroButtonBg', label: 'Hero CTA Button' },
      { key: 'heroButtonText', label: 'Hero CTA Text' },
      { key: 'heroMottoColor', label: 'Motto Highlight' },
    ],
  },
  {
    title: '4 Gradient KPI Cards',
    items: [
      { key: 'kpiStudentsStart', label: 'Students Card Start' },
      { key: 'kpiStudentsEnd', label: 'Students Card End' },
      { key: 'kpiTeachersStart', label: 'Teachers Card Start' },
      { key: 'kpiTeachersEnd', label: 'Teachers Card End' },
      { key: 'kpiCoursesStart', label: 'Courses Card Start' },
      { key: 'kpiCoursesEnd', label: 'Courses Card End' },
      { key: 'kpiBatchesStart', label: 'Batches Card Start' },
      { key: 'kpiBatchesEnd', label: 'Batches Card End' },
    ],
  },
  {
    title: 'Charts & Live Class Card',
    items: [
      { key: 'chartStudentsColor', label: 'Chart: Students' },
      { key: 'chartEnrollmentsColor', label: 'Chart: Enrollments' },
      { key: 'chartViewsColor', label: 'Chart: Course Views' },
      { key: 'liveCardStart', label: 'Live Card Top' },
      { key: 'liveCardEnd', label: 'Live Card Bottom' },
    ],
  },
];

export function DashboardCustomizerModal({
  open,
  config,
  onClose,
  onSave,
}: DashboardCustomizerModalProps) {
  const [tab, setTab] = useState<CustomizerTab>('colors');
  const [draft, setDraft] = useState<DashboardCustomizationConfig>(() =>
    normalizeDashboardConfig(config)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(normalizeDashboardConfig(config));
      setError(null);
      setTab('colors');
    }
  }, [open, config]);

  if (!open) return null;

  const setColor = (key: keyof DashboardColorConfig, value: string) => {
    setDraft((prev) => ({
      ...prev,
      accentPreset: 'custom',
      colors: {
        ...prev.colors,
        [key]: value,
      },
    }));
  };

  const setImage = (key: keyof DashboardImageConfig, value: string) => {
    setDraft((prev) => ({
      ...prev,
      images: {
        ...prev.images,
        [key]: value,
      },
    }));
  };

  const applyPreset = (preset: Exclude<DashboardCustomizationConfig['accentPreset'], 'custom'>) => {
    const palette = DASHBOARD_PRESET_PALETTES[preset];
    setDraft((prev) => ({
      ...prev,
      accentPreset: preset,
      colors: {
        ...prev.colors,
        ...palette,
      },
    }));
  };

  const toggleWidget = (key: keyof DashboardWidgetVisibility) => {
    setDraft((prev) => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        [key]: !prev.widgets[key],
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(normalizeDashboardConfig(draft));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard layout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customize Admin Dashboard"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        {/* Modal Header with Live Gradient Preview */}
        <div
          style={{
            backgroundImage: `linear-gradient(to right, ${draft.colors.sidebarStart}, ${draft.colors.activeNavStart}, ${draft.colors.heroEnd})`,
          }}
          className="flex items-center justify-between border-b border-slate-200 px-6 py-4 text-white"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-5 w-5 text-amber-300" />
            <div>
              <h2 className="text-base font-extrabold">Customize Admin LMS Dashboard</h2>
              <p className="text-[11px] text-blue-100">
                Change every image, color, gradient, branding, KPI label, and visible module dynamically
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dashboard customizer"
            className="rounded-lg p-1.5 text-blue-100 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Studio Section Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-6 py-3">
          {[
            { id: 'colors' as const, label: 'Colors & Theme', icon: Palette },
            { id: 'images' as const, label: 'Images & Branding', icon: ImageIcon },
            { id: 'content' as const, label: 'Hero, KPIs & Modules', icon: LayoutGrid },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition-all ${
                  active
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto p-6">
            {/* TAB 1: COLORS & THEME */}
            {tab === 'colors' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      Workspace Theme Mode
                    </span>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      {[
                        { id: 'futuristic_light' as const, label: 'Glass Light' },
                        { id: 'midnight_dark' as const, label: 'Midnight Dark' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, themeMode: opt.id }))}
                          className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                            draft.themeMode === opt.id
                              ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      Quick Color Palette Presets
                    </span>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { id: 'electric_blue' as const, label: 'Blue', dot: 'bg-blue-600' },
                        { id: 'emerald_teal' as const, label: 'Emerald', dot: 'bg-emerald-600' },
                        { id: 'royal_purple' as const, label: 'Purple', dot: 'bg-violet-600' },
                        { id: 'sunset_amber' as const, label: 'Sunset', dot: 'bg-orange-600' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => applyPreset(opt.id)}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors ${
                            draft.accentPreset === opt.id
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {COLOR_GROUPS.map((group) => (
                  <div key={group.title} className="rounded-2xl border border-slate-200 p-4">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                      {group.title}
                    </h3>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {group.items.map((item) => {
                        const val = draft.colors[item.key];
                        return (
                          <div
                            key={item.key}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                          >
                            <label
                              htmlFor={`color-${item.key}`}
                              className="truncate text-xs font-bold text-slate-700"
                            >
                              {item.label}
                            </label>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <input
                                id={`color-${item.key}`}
                                type="color"
                                value={/^#[0-9a-fA-F]{6}$/.test(val) ? val : DEFAULT_DASHBOARD_CONFIG.colors[item.key]}
                                onChange={(e) => setColor(item.key, e.target.value)}
                                className="h-7 w-9 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
                              />
                              <input
                                type="text"
                                aria-label={`${item.label} hex code`}
                                value={val}
                                onChange={(e) => {
                                  const next = e.target.value;
                                  setDraft((prev) => ({
                                    ...prev,
                                    accentPreset: 'custom',
                                    colors: { ...prev.colors, [item.key]: next },
                                  }));
                                }}
                                className="font-mono-tabular w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold uppercase text-slate-800"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2: IMAGES & BRANDING */}
            {tab === 'images' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Sidebar Center Brand & Promo Banner Copy
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="cust-brand-title" className="mb-1 block text-xs font-bold text-slate-700">
                        Sidebar Brand Name (optional override)
                      </label>
                      <input
                        id="cust-brand-title"
                        type="text"
                        placeholder="Alom's English Center"
                        value={draft.brandTitle}
                        onChange={(e) => setDraft((p) => ({ ...p, brandTitle: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-brand-badge" className="mb-1 block text-xs font-bold text-slate-700">
                        Sidebar Badge Pill
                      </label>
                      <input
                        id="cust-brand-badge"
                        type="text"
                        value={draft.brandBadge}
                        onChange={(e) => setDraft((p) => ({ ...p, brandBadge: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-promo-title" className="mb-1 block text-xs font-bold text-slate-700">
                        Sidebar Promo Title
                      </label>
                      <input
                        id="cust-promo-title"
                        type="text"
                        value={draft.sidebarPromoTitle}
                        onChange={(e) => setDraft((p) => ({ ...p, sidebarPromoTitle: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-promo-sub" className="mb-1 block text-xs font-bold text-slate-700">
                        Sidebar Promo Subtitle
                      </label>
                      <input
                        id="cust-promo-sub"
                        type="text"
                        value={draft.sidebarPromoSubtitle}
                        onChange={(e) =>
                          setDraft((p) => ({ ...p, sidebarPromoSubtitle: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    All Dashboard Images (Upload File or Paste URL)
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <ImageUploadField
                      label="Sidebar Custom Emblem Logo (blank = icon)"
                      value={draft.images.brandLogoUrl}
                      onChange={(url) => setImage('brandLogoUrl', url)}
                      placeholder="Leave empty for default cap icon or upload"
                    />
                    <ImageUploadField
                      label="Admin Topbar Profile Avatar"
                      value={draft.images.adminAvatarUrl}
                      onChange={(url) => setImage('adminAvatarUrl', url)}
                    />
                    <ImageUploadField
                      label="Hero Welcome Circle Portrait"
                      value={draft.images.heroAvatarUrl}
                      onChange={(url) => setImage('heroAvatarUrl', url)}
                    />
                    <ImageUploadField
                      label="Hero Campus Right Backdrop Image"
                      value={draft.images.heroBannerBgUrl}
                      onChange={(url) => setImage('heroBannerBgUrl', url)}
                    />
                    <ImageUploadField
                      label="Sidebar Bottom Promo Card Photo"
                      value={draft.images.sidebarPromoImageUrl}
                      onChange={(url) => setImage('sidebarPromoImageUrl', url)}
                    />
                    <ImageUploadField
                      label="Live Class Now Cover Override (blank = auto)"
                      value={draft.images.liveClassBannerUrl}
                      onChange={(url) => setImage('liveClassBannerUrl', url)}
                      placeholder="Leave empty for active live class photo"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: HERO TEXT, KPI LABELS & MODULES */}
            {tab === 'content' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Welcome Hero Banner Copy & CTA Target
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="cust-hero-title" className="mb-1 block text-xs font-bold text-slate-700">
                        Greeting Title
                      </label>
                      <input
                        id="cust-hero-title"
                        type="text"
                        value={draft.heroTitle}
                        onChange={(e) => setDraft((p) => ({ ...p, heroTitle: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-hero-sub" className="mb-1 block text-xs font-bold text-slate-700">
                        LMS Subtitle
                      </label>
                      <input
                        id="cust-hero-sub"
                        type="text"
                        value={draft.heroSubtitle}
                        onChange={(e) => setDraft((p) => ({ ...p, heroSubtitle: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-hero-quote" className="mb-1 block text-xs font-bold text-slate-700">
                        Motivational Quote
                      </label>
                      <input
                        id="cust-hero-quote"
                        type="text"
                        value={draft.heroQuote}
                        onChange={(e) => setDraft((p) => ({ ...p, heroQuote: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="cust-hero-cta" className="mb-1 block text-xs font-bold text-slate-700">
                          CTA Button Text
                        </label>
                        <input
                          id="cust-hero-cta"
                          type="text"
                          value={draft.heroCtaLabel}
                          onChange={(e) => setDraft((p) => ({ ...p, heroCtaLabel: e.target.value }))}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                        />
                      </div>
                      <div>
                        <label htmlFor="cust-hero-target" className="mb-1 block text-xs font-bold text-slate-700">
                          CTA Opens Section
                        </label>
                        <select
                          id="cust-hero-target"
                          value={draft.heroCtaSection}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              heroCtaSection: e.target.value as DashboardCustomizationConfig['heroCtaSection'],
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold"
                        >
                          <option value="courses">Courses</option>
                          <option value="enrollments">Students</option>
                          <option value="lessons">Live Classes</option>
                          <option value="exams">Exams</option>
                          <option value="catalog_cms">E-Books &amp; Posts</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="cust-motto-top" className="mb-1 block text-xs font-bold text-slate-700">
                        Right Motto Line 1
                      </label>
                      <input
                        id="cust-motto-top"
                        type="text"
                        value={draft.heroMottoTop}
                        onChange={(e) => setDraft((p) => ({ ...p, heroMottoTop: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label htmlFor="cust-motto-bottom" className="mb-1 block text-xs font-bold text-slate-700">
                        Right Motto Line 2
                      </label>
                      <input
                        id="cust-motto-bottom"
                        type="text"
                        value={draft.heroMottoBottom}
                        onChange={(e) => setDraft((p) => ({ ...p, heroMottoBottom: e.target.value }))}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Custom KPI Card Labels */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    4 KPI Card Titles
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    {(
                      [
                        ['students', 'Card 1 (Blue)'],
                        ['teachers', 'Card 2 (Green)'],
                        ['courses', 'Card 3 (Purple)'],
                        ['batches', 'Card 4 (Orange)'],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <label
                          htmlFor={`kpi-label-${key}`}
                          className="mb-1 block text-xs font-bold text-slate-700"
                        >
                          {label}
                        </label>
                        <input
                          id={`kpi-label-${key}`}
                          type="text"
                          value={draft.kpiLabels[key]}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              kpiLabels: { ...p.kpiLabels, [key]: e.target.value },
                            }))
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Widget Visibility Toggles */}
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                    Visible Dashboard Modules
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {WIDGET_LABELS.map((w) => {
                      const checked = draft.widgets[w.key] !== false;
                      return (
                        <label
                          key={w.key}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
                            checked
                              ? 'border-blue-200 bg-blue-50/70'
                              : 'border-slate-200 bg-slate-50 opacity-75'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleWidget(w.key)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">{w.label}</p>
                            <p className="text-[11px] text-slate-500">{w.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={() => setDraft(normalizeDashboardConfig(DEFAULT_DASHBOARD_CONFIG))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  backgroundImage: `linear-gradient(to right, ${draft.colors.activeNavStart}, ${draft.colors.activeNavEnd})`,
                }}
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? 'Saving...' : 'Save Dashboard Layout'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
