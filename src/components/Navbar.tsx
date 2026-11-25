import { ExternalLink, Menu, ShoppingBag, User as UserIcon, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { DEFAULT_HEADER_MENU, normalizeHeaderMenu } from '../lib/domain';

interface NavbarProps {
  currentPath: string;
  navigate: (path: string) => void;
}

export function Navbar({ currentPath, navigate }: NavbarProps) {
  const { user, bootstrap } = useAuth();
  const { totalCount, setIsOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const brandName = bootstrap?.settings.brandName || 'Aloms English Center';
  const logoUrl = bootstrap?.settings.logoUrl || '/images/aec-logo.png';
  const langBadge = bootstrap?.settings.language === 'bn' ? 'BN' : 'EN';
  const menuItems = normalizeHeaderMenu(
    bootstrap?.settings.headerMenu,
    DEFAULT_HEADER_MENU
  ).filter((item) => item.visible !== false);

  const handleNav = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  const isExternalPath = (path: string) => /^https?:\/\//i.test(path);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-5 sm:px-6 lg:px-8">
        {/* Brand Zone */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="flex min-w-0 shrink items-center gap-2 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:shrink-0 sm:gap-2.5"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#062436] p-1 shadow-sm sm:h-10 sm:w-10">
            <img
              src={logoUrl}
              alt={`${brandName} Logo`}
              className="h-full w-full object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
          </span>
          <span className="truncate text-sm font-extrabold tracking-tight text-[#062436] sm:text-base">
            {brandName}
          </span>
          <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 xl:inline-block">
            {langBadge}
          </span>
        </a>

        {/* Navigation Zone */}
        <nav className="hidden min-w-0 flex-1 overflow-x-auto px-2 lg:flex" aria-label="Primary Navigation">
          <div className="mx-auto flex items-center gap-3.5 xl:gap-4">
          {menuItems.map((item) => {
            const external = isExternalPath(item.path) || Boolean(item.openInNewTab);
            const active =
              !external &&
              (item.path === '/'
                ? currentPath === '/'
                : currentPath.startsWith(item.path) ||
                  (item.path === '/courses' && currentPath.startsWith('/course/')));
            return (
              <a
                key={item.id || item.path + item.label}
                href={item.path}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                onClick={(e) => {
                  if (!external) {
                    e.preventDefault();
                    handleNav(item.path);
                  }
                }}
                className={`inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-sm font-medium transition-colors ${
                  active
                    ? 'text-sky-600 underline decoration-2 underline-offset-8'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-amber-800">
                    {item.badge}
                  </span>
                )}
                {external && <ExternalLink className="h-3 w-3 text-slate-400" />}
              </a>
            );
          })}
          </div>
        </nav>

        {/* Action Zone */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {totalCount > 0 && (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label={`Open shopping cart with ${totalCount} items`}
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:bg-slate-100 sm:h-10 sm:w-10"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="font-mono-tabular absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">
                {totalCount}
              </span>
            </button>
          )}

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleNav('/profile')}
                aria-label="Open Profile"
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full border text-xs font-semibold transition-colors sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3.5 sm:text-sm ${
                  currentPath === '/profile'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <UserRound className="h-4 w-4 text-sky-600" />
                <span className="hidden sm:inline">Profile</span>
              </button>
              <button
                type="button"
                onClick={() => handleNav('/portal')}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#062436] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#0b3854] sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <UserIcon className="h-3.5 w-3.5 text-amber-400 sm:h-4 sm:w-4" />
                <span className="sm:hidden">Portal</span>
                <span className="hidden sm:inline">Unified Portal</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => handleNav('/register')}
                className="hidden h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:inline-flex sm:h-10 sm:px-4 sm:text-sm"
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => handleNav('/login')}
                className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full bg-indigo-50 px-3.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 sm:h-10 sm:px-5 sm:text-sm"
              >
                Login
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 sm:h-10 sm:w-10 lg:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {menuItems.map((item) => {
              const external = isExternalPath(item.path) || Boolean(item.openInNewTab);
              const active = !external && currentPath === item.path;
              return (
                <a
                  key={item.id || item.path + item.label}
                  href={item.path}
                  target={external ? '_blank' : undefined}
                  rel={external ? 'noreferrer' : undefined}
                  onClick={(e) => {
                    if (!external) {
                      e.preventDefault();
                      handleNav(item.path);
                    } else {
                      setMobileOpen(false);
                    }
                  }}
                  className={`flex min-h-[44px] items-center justify-between gap-1 rounded-lg px-3 text-sm font-medium ${
                    active
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
