import { useEffect, useState } from 'react';
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
import { ResultPage } from './pages/ResultPage';
import { AboutPage, ContactPage, PolicyPage } from './pages/StaticPages';
import { VerifyCertificatePage } from './pages/VerifyCertificatePage';

function CustomCmsPage({ slug }: { slug: string }) {
  const { bootstrap } = useAuth();
  const page = (bootstrap?.settings.customPages ?? []).find(
    (p) => p.slug === slug && p.published
  );

  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">Page Not Found</h1>
        <p className="mt-2 text-sm text-slate-600">
          This custom page has not been published yet in Page Builder.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      {page.coverImage && (
        <img
          src={page.coverImage}
          alt={page.title}
          className="mb-8 h-64 w-full rounded-3xl object-cover shadow-md"
          referrerPolicy="no-referrer"
        />
      )}
      <h1 className="text-3xl font-extrabold text-[#062436]">{page.title}</h1>
      <p className="mt-2 text-base font-medium text-sky-700">{page.subtitle}</p>
      <div className="mt-6 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-700 shadow-xs">
        {page.body}
      </div>
    </div>
  );
}

function RouterShell() {
  const { bootstrap } = useAuth();
  const [fullPath, setFullPath] = useState(
    () => window.location.pathname + window.location.search
  );

  useEffect(() => {
    const onPop = () => setFullPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const fav = bootstrap?.settings.faviconUrl;
    if (fav) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = fav;
    }
    if (bootstrap?.settings.brandName) {
      document.title = `${bootstrap.settings.brandName} — ${bootstrap.settings.tagline || 'Online & Multi-Branch English Platform'}`;
    }
  }, [bootstrap?.settings.faviconUrl, bootstrap?.settings.brandName, bootstrap?.settings.tagline]);

  const navigate = (nextPath: string) => {
    if (nextPath === fullPath) return;
    window.history.pushState({}, '', nextPath);
    setFullPath(nextPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const url = new URL(fullPath, window.location.origin);
  const pathname = url.pathname;
  const catParam = url.searchParams.get('cat') || 'All Courses';

  let pageNode = <HomePage navigate={navigate} />;
  if (pathname === '/courses') {
    pageNode = <CoursesPage navigate={navigate} initialCategory={catParam} />;
  } else if (pathname.startsWith('/course/') || pathname.startsWith('/courses/')) {
    const slug = pathname.startsWith('/courses/')
      ? pathname.replace('/courses/', '')
      : pathname.replace('/course/', '');
    pageNode = <CourseDetailPage slug={slug} navigate={navigate} />;
  } else if (pathname === '/verify-certificate') {
    pageNode = (
      <VerifyCertificatePage
        initialCertNo={url.searchParams.get('cert') || ''}
        navigate={navigate}
      />
    );
  } else if (pathname === '/learn') {
    pageNode = <LearnPage navigate={navigate} />;
  } else if (pathname === '/instructors') {
    pageNode = <InstructorsPage />;
  } else if (pathname === '/exams') {
    pageNode = <ExamsPage navigate={navigate} />;
  } else if (pathname === '/products') {
    pageNode = <ProductsPage />;
  } else if (pathname === '/ebooks') {
    pageNode = <EbooksPage navigate={navigate} />;
  } else if (pathname === '/community') {
    pageNode = <CommunityPage />;
  } else if (pathname.startsWith('/page/')) {
    const slug = pathname.replace('/page/', '');
    pageNode = <CustomCmsPage slug={slug} />;
  } else if (pathname === '/board-result') {
    pageNode = <ResultPage />;
  } else if (pathname === '/login' || pathname === '/profile') {
    pageNode = <LoginPage navigate={navigate} />;
  } else if (pathname === '/portal' || pathname === '/dashboard') {
    pageNode = <PortalPage navigate={navigate} />;
  } else if (pathname === '/about-us') {
    pageNode = <AboutPage />;
  } else if (pathname === '/contact-us') {
    pageNode = <ContactPage />;
  } else if (pathname === '/terms-and-conditions') {
    pageNode = <PolicyPage title="Terms & Conditions" />;
  } else if (pathname === '/privacy-policy') {
    pageNode = <PolicyPage title="Privacy Policy" />;
  } else if (pathname === '/refund-policy') {
    pageNode = <PolicyPage title="Refund Policy" />;
  }

  const isPortalShell = pathname === '/portal' || pathname === '/dashboard';

  useEffect(() => {
    const isPrivate =
      pathname.startsWith('/portal') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/learn') ||
      pathname.startsWith('/login');
    let robots = document.querySelector<HTMLMetaElement>("meta[name='robots']");
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    if (!pathname.startsWith('/course/') && !pathname.startsWith('/courses/')) {
      robots.content = isPrivate ? 'noindex,nofollow' : 'index,follow';
    }
  }, [pathname]);

  if (isPortalShell) {
    return (
      <div className="min-h-screen">
        <main className="min-h-screen">{pageNode}</main>
        <CartDrawer navigate={navigate} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar currentPath={pathname} navigate={navigate} />
      <main className="flex-1">{pageNode}</main>
      <Footer navigate={navigate} />
      <CartDrawer navigate={navigate} />
      <AiChatbotWidget />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <RouterShell />
      </CartProvider>
    </AuthProvider>
  );
}
