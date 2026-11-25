import {
  Activity,
  BookMarked,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  ExternalLink,
  FileText,
  GraduationCap,
  Home,
  Layers,
  LayoutTemplate,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Settings,
  ShoppingBag,
  Sparkles,
  UserCheck,
  Users,
  Video,
  X,
} from 'lucide-react';
import { DEFAULT_DASHBOARD_CONFIG, normalizeDashboardConfig, type PortalSection } from '../../lib/domain';
import type { DashboardCustomizationConfig, User } from '../../types';

export type OverviewSubView = 'lms' | 'school' | 'student' | 'teacher' | 'parent';

export type SidebarSubIntent =
  | 'courses'
  | 'batches'
  | 'ebooks'
  | 'products'
  | 'posts'
  | 'categories'
  | 'coupons'
  | undefined;

interface DashboardSidebarProps {
  user: User;
  brandName: string;
  roleLabel: string;
  allowedSections: PortalSection[];
  currentSection: PortalSection;
  activeSubIntent?: SidebarSubIntent;
  overviewSubView: OverviewSubView;
  accentPreset?: DashboardCustomizationConfig['accentPreset'];
  dashboardConfig?: DashboardCustomizationConfig;
  collapsed: boolean;
  mobileOpen: boolean;
  lang: 'en' | 'bn';
  unreadMessagesCount?: number;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onSelectSection: (section: PortalSection, intent?: SidebarSubIntent) => void;
  onSelectOverviewSubView: (view: OverviewSubView) => void;
  onNavigatePublic: (path: string) => void;
  onLogout: () => void;
}

interface SidebarNavItem {
  id: string;
  label: string;
  labelBn: string;
  icon: typeof Home;
  section: PortalSection;
  intent?: SidebarSubIntent;
  badgeCount?: number;
}

export function DashboardSidebar({
  user,
  brandName,
  allowedSections,
  currentSection,
  activeSubIntent,
  dashboardConfig,
  collapsed,
  mobileOpen,
  lang,
  unreadMessagesCount = 0,
  onToggleCollapse,
  onCloseMobile,
  onSelectSection,
  onSelectOverviewSubView,
  onNavigatePublic,
  onLogout,
}: DashboardSidebarProps) {
  const cfg = normalizeDashboardConfig(dashboardConfig ?? DEFAULT_DASHBOARD_CONFIG);

  const rawNavItems: SidebarNavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      labelBn: 'ড্যাশবোর্ড',
      icon: Home,
      section: 'overview',
    },
    {
      id: 'students',
      label:
        user.role === 'student'
          ? 'My Learning'
          : user.role === 'teacher'
            ? 'Student Roster'
            : user.role === 'guardian'
              ? 'Child Progress'
              : user.role === 'branch'
                ? 'Campus Admissions'
                : 'Students',
      labelBn:
        user.role === 'student'
          ? 'আমার কোর্স'
          : user.role === 'guardian'
            ? 'সন্তানের অগ্রগতি'
            : user.role === 'branch'
              ? 'শাখা ভর্তি'
              : 'শিক্ষার্থী',
      icon: GraduationCap,
      section: user.role === 'student' ? 'my_learning' : user.role === 'guardian' ? 'guardian_monitor' : 'enrollments',
    },
    {
      id: 'teachers',
      label: 'Teachers & Users',
      labelBn: 'শিক্ষক ও ইউজার',
      icon: UserCheck,
      section: 'users',
    },
    {
      id: 'courses',
      label: 'Courses',
      labelBn: 'কোর্স সমূহ',
      icon: BookOpen,
      section: 'courses',
      intent: 'courses',
    },
    {
      id: 'batches',
      label: 'Batches',
      labelBn: 'ব্যাচ সমূহ',
      icon: Layers,
      section: 'courses',
      intent: 'batches',
    },
    {
      id: 'lessons',
      label: 'Live & Videos',
      labelBn: 'লাইভ ও ভিডিও',
      icon: Video,
      section: 'lessons',
    },
    {
      id: 'exams',
      label: 'Exams',
      labelBn: 'পরীক্ষা',
      icon: ClipboardList,
      section: 'exams',
    },
    {
      id: 'attendance',
      label: 'Attendance & P&L',
      labelBn: 'উপস্থিতি ও আয়-ব্যয়',
      icon: CalendarCheck,
      section: 'attendance_finance',
    },
    {
      id: 'payments',
      label: 'Payments',
      labelBn: 'পেমেন্ট',
      icon: CreditCard,
      section: 'payments',
    },
    {
      id: 'ebooks',
      label: 'E-Books & PDFs',
      labelBn: 'ই-বুক ও পিডিএফ',
      icon: BookMarked,
      section: 'catalog_cms',
      intent: 'ebooks',
    },
    {
      id: 'products',
      label: 'Products',
      labelBn: 'পণ্য স্টোর',
      icon: ShoppingBag,
      section: 'catalog_cms',
      intent: 'products',
    },
    {
      id: 'posts',
      label: 'Posts & Categories',
      labelBn: 'পোস্ট ও ক্যাটাগরি',
      icon: FileText,
      section: 'catalog_cms',
      intent: 'posts',
    },
    {
      id: 'orders',
      label: 'Shop Orders',
      labelBn: 'অর্ডার সমূহ',
      icon: Package,
      section: 'orders',
      badgeCount: unreadMessagesCount,
    },
    {
      id: 'branches',
      label: user.role === 'branch' ? 'My Campus Branch' : 'Branches',
      labelBn: user.role === 'branch' ? 'আমার শাখা' : 'শাখা সমূহ',
      icon: Building2,
      section: 'branches',
    },
    {
      id: 'academic_ops',
      label: 'Academic Ops',
      labelBn: 'একাডেমিক অপারেশন',
      icon: CalendarDays,
      section: 'academic_ops',
    },
    {
      id: 'integrations',
      label: 'Integrations & 2FA',
      labelBn: 'ইন্টিগ্রেশন ও ২FA',
      icon: Plug,
      section: 'integrations',
    },
    {
      id: 'homepage_cms',
      label: 'Homepage CMS',
      labelBn: 'হোমপেজ CMS',
      icon: LayoutTemplate,
      section: 'homepage_cms',
    },
    {
      id: 'ai_ecosystem',
      label: 'AI & SCORM',
      labelBn: 'AI ও SCORM',
      icon: Sparkles,
      section: 'ai_ecosystem',
    },
    {
      id: 'activity_logs',
      label: 'Activity Logs',
      labelBn: 'অ্যাক্টিভিটি লগ',
      icon: Activity,
      section: 'activity_logs',
    },
    {
      id: 'profile',
      label: 'My Profile',
      labelBn: 'আমার প্রোফাইল',
      icon: Users,
      section: 'profile',
    },
    {
      id: 'settings',
      label: 'Settings',
      labelBn: 'সেটিংস',
      icon: Settings,
      section: 'settings',
    },
  ];
  const navItems = rawNavItems.filter((item) => allowedSections.includes(item.section));

  const isItemActive = (item: SidebarNavItem) => {
    if (currentSection !== item.section) return false;
    if (item.section === 'courses' && item.intent) {
      return (activeSubIntent || 'courses') === item.intent;
    }
    if (item.section === 'catalog_cms' && item.intent) {
      if (item.intent === 'posts' && activeSubIntent === 'categories') return true;
      return (activeSubIntent || 'ebooks') === item.intent;
    }
    return true;
  };

  const displayCenterName = cfg.brandTitle.trim() || brandName.trim() || "Alom's English Center";

  const sidebarContent = (
    <div
      className="relative flex h-full flex-col overflow-hidden text-slate-200"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${cfg.colors.sidebarStart}, ${cfg.colors.sidebarEnd})`,
      }}
    >
      {/* Subtle Futuristic Glow */}
      <div
        className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
        style={{ backgroundColor: cfg.colors.activeNavStart }}
      />

      {/* Top Emblem + Brand */}
      <div className="relative flex shrink-0 items-center justify-between px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={() => {
            onSelectSection('overview');
            onSelectOverviewSubView('lms');
            onCloseMobile();
          }}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-2 focus-visible:outline-blue-400"
          aria-label="Go to LMS Dashboard Home"
        >
          {cfg.images.brandLogoUrl ? (
            <img
              src={cfg.images.brandLogoUrl}
              alt={displayCenterName}
              referrerPolicy="no-referrer"
              className="h-10 w-10 shrink-0 rounded-xl border border-white/25 object-cover shadow-md"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-[#091538] shadow-md shadow-amber-500/25">
              <GraduationCap className="h-5 w-5" />
            </span>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight text-white">
                {displayCenterName}
              </p>
              <span className="mt-1 inline-block rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
                {cfg.brandBadge}
              </span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:flex"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation drawer"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Menu Links */}
      <nav
        aria-label="Dashboard Sidebar Navigation"
        className="relative mt-1 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.section === 'overview') {
                  onSelectOverviewSubView('lms');
                }
                onSelectSection(item.section, item.intent);
                onCloseMobile();
              }}
              title={collapsed ? item.label : undefined}
              style={
                active
                  ? {
                      backgroundImage: `linear-gradient(to right, ${cfg.colors.activeNavStart}, ${cfg.colors.activeNavEnd})`,
                    }
                  : undefined
              }
              className={`flex w-full items-center rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                collapsed ? 'justify-center' : 'justify-between'
              } ${
                active
                  ? 'text-white shadow-lg'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">{lang === 'bn' ? item.labelBn : item.label}</span>
                )}
              </span>
              {!collapsed && typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                <span className="font-mono-tabular rounded-md bg-rose-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-500/15 hover:text-rose-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>}
        </button>
      </nav>

      {/* Bottom Skyline Promo Card & Public Site Shortcut */}
      <div className="relative shrink-0 space-y-1.5 border-t border-white/10 p-2.5">
        {!collapsed && (
          <div className="group relative overflow-hidden rounded-2xl border border-white/15 bg-[#0F1E4C]">
            <img
              src={cfg.images.sidebarPromoImageUrl}
              alt={`${cfg.sidebarPromoTitle} ${cfg.sidebarPromoSubtitle}`}
              className="h-20 w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-[#071131] via-[#071131]/55 to-transparent p-3">
              <p className="text-xs font-extrabold italic leading-tight text-white">
                {cfg.sidebarPromoTitle}
              </p>
              <p className="text-[11px] font-bold text-amber-300">
                {cfg.sidebarPromoSubtitle}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => onNavigatePublic('/')}
          title="Open Public Website"
          className={`flex w-full items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition-colors hover:bg-white/10 hover:text-white ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <ExternalLink className="h-4 w-4 shrink-0 text-amber-300" />
          {!collapsed && (
            <span className="truncate">{lang === 'bn' ? 'পাবলিক সাইট' : 'Public Website'}</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={`hidden shrink-0 transition-all duration-200 lg:block ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
          />
          <aside className="relative z-10 h-full w-64 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
