import {
  Bell,
  Globe,
  Mail,
  Maximize2,
  Menu,
  Moon,
  Search,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { DEFAULT_DASHBOARD_CONFIG, normalizeDashboardConfig, type PortalSection } from '../../lib/domain';
import type { DashboardCustomizationConfig, User } from '../../types';

interface NotificationItem {
  id: string;
  title: string;
  subtitle: string;
  section: PortalSection;
}

interface DashboardTopbarProps {
  user: User;
  roleLabel: string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  lang: 'en' | 'bn';
  onToggleLang: () => void;
  canCustomize?: boolean;
  dashboardConfig?: DashboardCustomizationConfig;
  onOpenCustomizer?: () => void;
  unreadMessagesCount?: number;
  notifications: NotificationItem[];
  onOpenMobileMenu: () => void;
  onSelectSection: (section: PortalSection) => void;
}

export function DashboardTopbar({
  user,
  roleLabel,
  searchQuery,
  onSearchChange,
  darkMode,
  onToggleDarkMode,
  lang,
  onToggleLang,
  canCustomize = false,
  dashboardConfig,
  onOpenCustomizer,
  unreadMessagesCount = 0,
  notifications,
  onOpenMobileMenu,
  onSelectSection,
}: DashboardTopbarProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const cfg = normalizeDashboardConfig(dashboardConfig ?? DEFAULT_DASHBOARD_CONFIG);

  const handleFullscreen = () => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const avatar =
    (user.role === 'admin' && cfg.images.adminAvatarUrl) ||
    user.avatar ||
    cfg.images.adminAvatarUrl;

  return (
    <header
      className={`sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-md transition-colors sm:px-6 ${
        darkMode
          ? 'border-[#1E2E52] bg-[#0B142C]/90 text-slate-100'
          : 'border-white/60 bg-white/80 text-slate-900 shadow-xs'
      }`}
    >
      {/* Left: Drawer Trigger + Rounded Search Pill with Blue Action Button */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors lg:hidden ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] text-slate-200 hover:bg-[#1A2B58]'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Menu className="h-4 w-4" />
        </button>

        <form
          onSubmit={(e) => e.preventDefault()}
          className={`flex w-full max-w-md items-center overflow-hidden rounded-full border p-1 shadow-xs ${
            darkMode
              ? 'border-[#25365E] bg-[#132043]'
              : 'border-slate-200/90 bg-white'
          }`}
        >
          <label htmlFor="edudash-search" className="sr-only">
            Search students, courses, or teachers
          </label>
          <Search className="ml-3 h-4 w-4 shrink-0 text-slate-400" />
          <input
            id="edudash-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'শিক্ষার্থী, কোর্স বা শিক্ষক খুঁজুন...'
                : 'Search students, courses, teachers...'
            }
            className={`min-w-0 flex-1 bg-transparent px-2.5 py-1 text-xs focus:outline-none ${
              darkMode
                ? 'text-slate-100 placeholder:text-slate-400'
                : 'text-slate-800 placeholder:text-slate-400'
            }`}
          />
          <button
            type="submit"
            aria-label="Submit dashboard search"
            style={{ backgroundColor: cfg.colors.activeNavStart }}
            className="flex h-8 w-10 shrink-0 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>

      {/* Right: Customize, Bell, Messages, Fullscreen, Theme, Language, Admin Chip */}
      <div className="relative flex shrink-0 items-center gap-2">
        {canCustomize && onOpenCustomizer && (
          <button
            type="button"
            onClick={onOpenCustomizer}
            style={{
              backgroundImage: `linear-gradient(to right, ${cfg.colors.activeNavStart}, ${cfg.colors.activeNavEnd})`,
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-95"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {lang === 'bn' ? 'কাস্টমাইজ' : 'Customize'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setNotifOpen((v) => !v)}
          aria-label="Open notifications"
          aria-expanded={notifOpen}
          className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] text-slate-200 hover:border-blue-400'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400'
          }`}
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <span className="font-mono-tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white">
              {notifications.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('orders')}
          aria-label="Open messages and orders"
          title="Messages & Orders"
          className={`relative hidden h-9 w-9 items-center justify-center rounded-full border transition-colors sm:flex ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] text-slate-200 hover:border-blue-400'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400'
          }`}
        >
          <Mail className="h-4 w-4" />
          {unreadMessagesCount > 0 && (
            <span className="font-mono-tabular absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-extrabold text-white">
              {unreadMessagesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleFullscreen}
          aria-label="Toggle fullscreen"
          title="Fullscreen"
          className={`hidden h-9 w-9 items-center justify-center rounded-full border transition-colors md:flex ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] text-slate-200 hover:border-blue-400'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400'
          }`}
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Switch to light glass mode' : 'Switch to midnight dark mode'}
          title={darkMode ? 'Glass Light Mode' : 'Midnight Dark Mode'}
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] text-amber-300 hover:border-blue-400'
              : 'border-slate-200 bg-white text-slate-700 hover:border-blue-400'
          }`}
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onToggleLang}
          aria-label={`Switch language (current ${lang.toUpperCase()})`}
          className={`flex h-9 items-center gap-1 rounded-full border px-2.5 text-[11px] font-bold transition-colors ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] text-slate-200'
              : 'border-slate-200 bg-white text-slate-700'
          }`}
        >
          <Globe className="h-3.5 w-3.5 text-blue-600" />
          <span>{lang.toUpperCase()}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection('profile')}
          aria-label="Open My Profile and Account Security"
          className={`hidden items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition-colors sm:flex ${
            darkMode
              ? 'border-[#25365E] bg-[#132043] hover:border-blue-400'
              : 'border-slate-200 bg-white hover:border-blue-400'
          }`}
        >
          <img
            src={avatar}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="h-7 w-7 rounded-full object-cover ring-2 ring-blue-500/40"
          />
          <div className="leading-tight">
            <p className={`max-w-[96px] truncate text-xs font-extrabold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              {user.name.split(' ')[0]}
            </p>
            <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-300">
              {roleLabel}
            </p>
          </div>
        </button>

        {notifOpen && (
          <div
            className={`absolute right-0 top-12 z-40 w-80 rounded-2xl border p-3 shadow-2xl ${
              darkMode
                ? 'border-[#25365E] bg-[#0F1B3B] text-white'
                : 'border-slate-200 bg-white text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 dark:border-[#25365E]">
              <p className="text-xs font-extrabold">
                {lang === 'bn' ? 'সাম্প্রতিক বিজ্ঞপ্তি' : 'LMS Notifications'}
              </p>
              <span className="font-mono-tabular text-[11px] font-bold text-blue-600">
                {notifications.length} active
              </span>
            </div>
            <div className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">All caught up.</p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      onSelectSection(n.section);
                    }}
                    className={`block w-full rounded-xl border p-2.5 text-left transition-colors ${
                      darkMode
                        ? 'border-[#25365E] bg-[#132043] hover:border-blue-400'
                        : 'border-slate-100 bg-slate-50 hover:border-blue-300'
                    }`}
                  >
                    <p className="text-xs font-bold">{n.title}</p>
                    <p className="mt-0.5 text-[11px] opacity-75">{n.subtitle}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
