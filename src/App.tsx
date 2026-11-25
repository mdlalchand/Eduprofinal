import { useCallback, useEffect, useState } from 'react';
import { AiChatbotWidget } from './components/AiChatbotWidget';
import { CartDrawer } from './components/CartDrawer';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { CommunityPage } from './pages/CommunityPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { CoursesPage } from './pages/CoursesPage';
import { EbooksPage } from './pages/EbooksPage';
import { ExamsPage } from './pages/ExamsPage';
import { HomePage } from './pages/HomePage';
import { InstructorsPage } from './pages/InstructorsPage';
import { LearnPage } from './pages/LearnPage';
import { LoginPage } from './pages/LoginPage';
import { PortalPage } from './pages/PortalPage';
import { ProductsPage } from './pages/ProductsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResultPage } from './pages/ResultPage';
import { AboutPage, ContactPage, PolicyPage } from './pages/StaticPages';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';

function CustomCmsPage({ slug }: { slug: string }) {
  const { bootstrap } = useAuth();
  const page = (bootstrap?.settings.customPages ?? []).find(
    (p) => p.published && p.slug.toLowerCase() === slug.toLowerCase()
  );
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The requested page could not be found or is currently unpublished.
        </p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-slate-900">{page.title}</h1>
      {page.subtitle ? (
        <p className="mt-2 text-base text-slate-600">{page.subtitle}</p>
      ) : null}
      <div className="mt-6 space-y-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-xs">
        {page.body}
      </div>
    </div>
  );
}

function AppRouter() {
  const [locationPath, setLocationPath] = useState(() =>
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/'
  );

  useEffect(() => {
    const onPop = () => {
      setLocationPath(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    if (!to) return;
    if (/^https?:\/\//i.test(to)) {
      window.open(to, '_blank', 'noopener,noreferrer');
      return;
    }
    const normalized = to.startsWith('/') ? to : `/${to}`;
    window.history.pushState({}, '', normalized);
    setLocationPath(normalized);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const [pathname, search = ''] = locationPath.split('?');
  const params = new URLSearchParams(search);
  const cleanPath = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const isPortal = cleanPath === '/portal' || cleanPath.startsWith('/portal/');

  const renderPage = () => {
    if (cleanPath === '/' || cleanPath === '') {
      return <HomePage navigate={navigate} />;
    }
    if (cleanPath === '/courses') {
      return (
        <CoursesPage
          navigate={navigate}
          initialCategory={params.get('cat') || 'All Courses'}
        />
      );
    }
    if (cleanPath.startsWith('/course/')) {
      const slug = decodeURIComponent(cleanPath.slice('/course/'.length));
      return <CourseDetailPage slug={slug} navigate={navigate} />;
    }
    if (cleanPath === '/learn') {
      return <LearnPage navigate={navigate} />;
    }
    if (cleanPath === '/instructors') {
      return <InstructorsPage />;
    }
    if (cleanPath === '/exams') {
      return <ExamsPage navigate={navigate} />;
    }
    if (cleanPath === '/products') {
      return <ProductsPage />;
    }
    if (cleanPath === '/ebooks') {
      return <EbooksPage navigate={navigate} />;
    }
    if (cleanPath === '/community') {
      return <CommunityPage />;
    }
    if (cleanPath === '/board-result') {
      return <ResultPage />;
    }
    if (cleanPath === '/verify-certificate') {
      return <VerifyCertificatePage initialCertNo={params.get('cert') || ''} navigate={navigate} />;
    }
    if (cleanPath.startsWith('/verify-certificate/')) {
      const certNo = decodeURIComponent(cleanPath.slice('/verify-certificate/'.length));
      return <VerifyCertificatePage initialCertNo={certNo} navigate={navigate} />;
    }
    if (cleanPath === '/about-us' || cleanPath === '/about') {
      return <AboutPage />;
    }
    if (cleanPath === '/contact-us' || cleanPath === '/contact') {
      return <ContactPage />;
    }
    if (cleanPath === '/terms-and-conditions') {
      return <PolicyPage title="Terms & Conditions" />;
    }
    if (cleanPath === '/privacy-policy') {
      return <PolicyPage title="Privacy Policy" />;
    }
    if (cleanPath === '/refund-policy') {
      return <PolicyPage title="Refund Policy" />;
    }
    if (cleanPath.startsWith('/page/')) {
      const slug = decodeURIComponent(cleanPath.slice('/page/'.length));
      return <CustomCmsPage slug={slug} />;
    }
    if (cleanPath === '/profile') {
      return <ProfilePage navigate={navigate} />;
    }
    if (
      cleanPath === '/login' ||
      cleanPath.startsWith('/login/') ||
      cleanPath === '/register' ||
      cleanPath.startsWith('/register/') ||
      cleanPath === '/recover' ||
      cleanPath.startsWith('/recover/')
    ) {
      const validRoles = new Set(['student', 'guardian', 'teacher', 'branch', 'admin']);
      const segments = cleanPath.split('/').filter(Boolean);
      const base = segments[0];
      const segRole = segments[1] || params.get('role') || 'student';
      const qMode = params.get('mode');
      const initialMode =
        base === 'register' || qMode === 'register'
          ? 'register'
          : base === 'recover' || qMode === 'reset' || qMode === 'recover'
            ? 'reset'
            : 'login';
      const initialRole = (validRoles.has(segRole) ? segRole : 'student') as
        | 'student'
        | 'guardian'
        | 'teacher'
        | 'branch'
        | 'admin';
      return (
        <LoginPage
          navigate={navigate}
          initialMode={initialMode}
          initialRole={initialRole}
        />
      );
    }
    if (isPortal) {
      return <PortalPage navigate={navigate} />;
    }
    return <HomePage navigate={navigate} />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {!isPortal && <Navbar currentPath={cleanPath} navigate={navigate} />}
      <main className="flex-1">{renderPage()}</main>
      {!isPortal && <Footer navigate={navigate} />}
      <CartDrawer navigate={navigate} />
      <AiChatbotWidget />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppRouter />
      </CartProvider>
    </AuthProvider>
  );
}
