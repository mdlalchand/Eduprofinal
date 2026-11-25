import { BookOpen, Download, ExternalLink, FileText, Lock, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FourStepPaymentModal } from '../components/FourStepPaymentModal';
import { useAuth } from '../context/AuthContext';
import { sanitizeSafeUrl } from '../lib/domain';
import type { Ebook } from '../types';

interface EbooksPageProps {
  navigate: (path: string) => void;
}

export function EbooksPage({ navigate }: EbooksPageProps) {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const [levelFilter, setLevelFilter] = useState<string>('All E-Books');
  const [priceFilter, setPriceFilter] = useState<'All' | 'Free' | 'Premium' | 'My E-Books'>(
    'All'
  );
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [readingBook, setReadingBook] = useState<Ebook | null>(null);
  const [checkoutBook, setCheckoutBook] = useState<Ebook | null>(null);
  const [downloading, setDownloading] = useState(false);

  const syncOwnedEbooks = () => {
    if (!user) {
      setClaimedIds([]);
      return;
    }
    apiFetch<{ claimedEbookIds: string[] }>('/api/enrollments/my')
      .then((res) => setClaimedIds(res.claimedEbookIds))
      .catch(() => {});
  };

  useEffect(() => {
    syncOwnedEbooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const ebooks = useMemo(
    () => (bootstrap?.ebooks ?? []).filter((eb) => eb.status !== 'draft'),
    [bootstrap?.ebooks]
  );

  const levels = useMemo(() => {
    const uniq = Array.from(new Set(ebooks.map((eb) => eb.level).filter(Boolean)));
    return ['All E-Books', ...uniq];
  }, [ebooks]);

  const filtered = ebooks.filter((eb) => {
    if (levelFilter !== 'All E-Books' && eb.level !== levelFilter) return false;
    if (priceFilter === 'Free' && !eb.isFree) return false;
    if (priceFilter === 'Premium' && eb.isFree) return false;
    if (priceFilter === 'My E-Books' && !claimedIds.includes(eb.id)) return false;
    return true;
  });

  const handleAction = async (book: Ebook) => {
    if (claimedIds.includes(book.id)) {
      setReadingBook(book);
      return;
    }
    if (!user) {
      navigate('/login');
      return;
    }
    if (!book.isFree && book.price > 0) {
      setCheckoutBook(book);
      return;
    }
    const res = await apiFetch<{ claimedEbookIds: string[] }>('/api/ebooks/claim', {
      method: 'POST',
      body: JSON.stringify({ ebookId: book.id }),
    });
    setClaimedIds(res.claimedEbookIds);
    setReadingBook(book);
  };

  const handleDownloadEbook = async (book: Ebook) => {
    setDownloading(true);
    try {
      const payload = await apiFetch<{
        title: string;
        author: string;
        pdfUrl: string;
        contentText: string;
      }>(`/api/ebooks/${encodeURIComponent(book.id)}/download`);

      const safePdf = sanitizeSafeUrl(payload.pdfUrl || '');
      if (safePdf && (safePdf.endsWith('.pdf') || safePdf.startsWith('http'))) {
        const a = document.createElement('a');
        a.href = safePdf;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.click();
        return;
      }

      const blob = new Blob([payload.contentText || `${book.title}\n\n${book.summary}`], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${book.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/90 via-slate-50 to-white pb-16 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            All E-Books &amp; Digital PDF Library
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Concise bilingual grammar short-notes, board suggestions, and IELTS speaking guides with instant PDF access.
          </p>

          {/* Level Tabs */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  levelFilter === lvl
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Price / Owned Filter */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(['All', 'Free', 'Premium', 'My E-Books'] as const).map((pf) => (
              <button
                key={pf}
                type="button"
                onClick={() => setPriceFilter(pf)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  priceFilter === pf
                    ? 'bg-[#062436] text-white'
                    : 'bg-slate-200/70 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {pf}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((book) => {
            const owned = claimedIds.includes(book.id);
            const discountPct =
              !book.isFree && book.originalPrice > book.price
                ? Math.round(((book.originalPrice - book.price) / book.originalPrice) * 100)
                : 0;
            const cover = sanitizeSafeUrl(
              book.coverImage || '',
              '/src/assets/images/course_english_books_1795411661325.jpg'
            );
            return (
              <div
                key={book.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                    <img
                      src={cover}
                      alt={book.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute left-3 top-3 flex items-center gap-1.5">
                      <span
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold shadow-xs ${
                          book.isFree
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {book.isFree
                          ? 'FREE PDF'
                          : discountPct > 0
                            ? `PREMIUM · -${discountPct}%`
                            : 'PREMIUM PDF'}
                      </span>
                      {owned && (
                        <span className="rounded-lg bg-slate-900/90 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                          OWNED
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-6 pb-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                      <span>{book.level}</span>
                      <span className="font-mono-tabular">
                        {book.pagesCount} pages{book.fileSize ? ` · ${book.fileSize}` : ''}
                      </span>
                    </div>

                    <h2 className="mt-2.5 text-lg font-extrabold text-slate-900">{book.title}</h2>
                    <p className="mt-1 text-xs font-medium text-slate-500">By {book.author}</p>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{book.summary}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 px-6 py-4">
                  <div>
                    {book.isFree ? (
                      <span className="text-base font-extrabold text-emerald-700">Free</span>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono-tabular text-lg font-extrabold text-indigo-700">
                          ৳{book.price}
                        </span>
                        {book.originalPrice > book.price && (
                          <span className="font-mono-tabular text-xs text-slate-400 line-through">
                            ৳{book.originalPrice}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAction(book)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#062436] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600"
                  >
                    {owned ? (
                      <BookOpen className="h-3.5 w-3.5" />
                    ) : book.isFree ? (
                      <FileText className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {owned ? 'Read & PDF' : book.isFree ? 'Get Free PDF' : 'Buy E-Book'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Paid E-Book 4-Step Checkout */}
      {checkoutBook && (
        <FourStepPaymentModal
          open={Boolean(checkoutBook)}
          onClose={() => setCheckoutBook(null)}
          referenceType="ebook"
          ebookId={checkoutBook.id}
          itemTitle={checkoutBook.title}
          baseAmount={checkoutBook.price}
          onSuccess={async () => {
            const purchased = checkoutBook;
            await refreshBootstrap();
            syncOwnedEbooks();
            setCheckoutBook(null);
            setReadingBook(purchased);
          }}
        />
      )}

      {/* E-Book Reader & Download Modal */}
      {readingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={readingBook.title}
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-sky-600">
                  {readingBook.level} Digital PDF Reader · {readingBook.pagesCount} pages
                  {readingBook.fileSize ? ` · ${readingBook.fileSize}` : ''}
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">
                  {readingBook.title}
                </h2>
                <p className="mt-1 text-xs font-medium text-slate-500">By {readingBook.author}</p>
              </div>
              <button
                type="button"
                onClick={() => setReadingBook(null)}
                aria-label="Close e-book reader"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
              <div className="text-xs font-semibold text-indigo-950">
                Full PDF &amp; Study Guide Unlocked for {user?.name || 'Student'}
              </div>
              <div className="flex flex-wrap gap-2">
                {sanitizeSafeUrl(readingBook.pdfUrl || '') && (
                  <a
                    href={sanitizeSafeUrl(readingBook.pdfUrl || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open PDF Link</span>
                  </a>
                )}
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownloadEbook(readingBook)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloading ? 'Preparing...' : 'Download Copy'}</span>
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {readingBook.sampleContent.map((para, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800"
                >
                  {para}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
