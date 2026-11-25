import {
  Download,
  Facebook,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Youtube,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FooterProps {
  navigate: (path: string) => void;
}

export function Footer({ navigate }: FooterProps) {
  const { bootstrap } = useAuth();
  const s = bootstrap?.settings;

  const brandName = s?.brandName || 'Aloms English Center';
  const logoUrl = s?.logoUrl || '/images/aec-logo.png';
  const phone = s?.phone || '09617331133';
  const email = s?.email || 'info@alomsenglishcenter.com';
  const address = s?.address || 'House 42, Road 6/A, Avenue 8, Mirpur DOHS, Dhaka';
  const licenseNo = s?.licenseNo || 'TRAD/DNCC/058412/2026';
  const whatsapp = s?.whatsappNumber || '8801710000001';
  const mission =
    s?.aboutMission ||
    'Aloms English Center is a comprehensive online and multi-branch English learning platform delivering Academic, Spoken, Grammar, and IELTS programs nationwide.';
  const footerLinks =
    s?.footerLinks && s.footerLinks.length > 0
      ? s.footerLinks
      : [
          { label: 'Home', path: '/' },
          { label: 'About Us', path: '/about-us' },
          { label: 'Contact Us', path: '/contact-us' },
          { label: 'Community & Blog', path: '/community' },
          { label: 'Board Result', path: '/board-result' },
        ];
  const publishedPages = (s?.customPages ?? []).filter((pg) => pg.published);
  const copyrightText = s?.footerCopyright || `© 2026 ${brandName}. All Rights Reserved.`;
  const youtubeUrl = s?.socialLinks?.youtube || 'https://www.youtube.com';
  const facebookUrl = s?.socialLinks?.facebook || 'https://www.facebook.com';

  const go = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="bg-[#051d2b] text-slate-300">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
            {/* Brand + Mission */}
            <div className="space-y-4">
              <a
                href="/"
                onClick={(e) => go(e, '/')}
                className="inline-flex items-center gap-3"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 p-1">
                  <img
                    src={logoUrl}
                    alt={brandName}
                    className="h-full w-full rounded-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </span>
                <span className="text-lg font-extrabold tracking-tight text-white">
                  {brandName}
                </span>
              </a>
              <p className="text-sm leading-relaxed text-slate-400">{mission}</p>
              <div className="flex items-center gap-3 pt-1">
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${brandName} YouTube`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition-colors hover:bg-red-600 hover:text-white"
                >
                  <Youtube className="h-4 w-4" />
                </a>
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${brandName} Facebook`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-slate-200 transition-colors hover:bg-sky-600 hover:text-white"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <h3 className="mb-4 text-sm font-bold tracking-wide text-white">Links</h3>
              <ul className="space-y-2.5 text-sm">
                {footerLinks.map((link) => (
                  <li key={link.path + link.label}>
                    <a
                      href={link.path}
                      onClick={(e) => go(e, link.path)}
                      className="text-slate-400 transition-colors hover:text-amber-400"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                {publishedPages.map((pg) => (
                  <li key={pg.id}>
                    <a
                      href={`/page/${pg.slug}`}
                      onClick={(e) => go(e, `/page/${pg.slug}`)}
                      className="text-slate-400 transition-colors hover:text-amber-400"
                    >
                      {pg.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company Details */}
            <div>
              <h3 className="mb-4 text-sm font-bold tracking-wide text-white">
                Company Details
              </h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span>License No: {licenseNo}</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span>{address}</span>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-4 text-sm font-bold tracking-wide text-white">Contact</h3>
              <ul className="space-y-3 text-sm text-slate-400">
                <li className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 shrink-0 text-sky-400" />
                  <span className="font-mono-tabular">{phone}</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 shrink-0 text-sky-400" />
                  <span>{email}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>{copyrightText}</p>
            <div className="flex flex-wrap items-center gap-5">
              <a
                href="/downloads/academy-lms-laravel13.zip"
                download="academy-lms-laravel13.zip"
                className="inline-flex items-center gap-1.5 font-semibold text-amber-300 hover:text-amber-200"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Laravel 13 Installer (.zip)</span>
              </a>
              <a
                href="/terms-and-conditions"
                onClick={(e) => go(e, '/terms-and-conditions')}
                className="hover:text-white"
              >
                Terms & Conditions
              </a>
              <a
                href="/privacy-policy"
                onClick={(e) => go(e, '/privacy-policy')}
                className="hover:text-white"
              >
                Privacy Policy
              </a>
              <a
                href="/refund-policy"
                onClick={(e) => go(e, '/refund-policy')}
                className="hover:text-white"
              >
                Refund Policy
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Button matching reference */}
      <a
        href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(
          "Hi! I have a question about Aloms English Center courses."
        )}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with us on WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 hover:bg-emerald-600"
      >
        <MessageCircle className="h-6 w-6" />
      </a>
    </>
  );
}
