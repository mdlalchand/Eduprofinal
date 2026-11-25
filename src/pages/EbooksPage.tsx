import {
  ArrowRight,
  Download,
  ExternalLink,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { FourStepPaymentModal } from '../components/FourStepPaymentModal';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../context/AuthContext';
import { sanitizeSafeUrl } from '../lib/domain';
import type { Ebook } from '../types';

interface EbooksPageProps {
  navigate: (path: string) => void;
}

export function EbooksPage({ navigate }: EbooksPageProps) {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'teacher';
  const isAdmin = user?.role === 'admin';

  const [levelFilter, setLevelFilter] = useState<string>('All E-Books');
  const [priceFilter, setPriceFilter] = useState<'All' | 'Free' | 'Premium' | 'My E-Books'>(
    'All'
  );
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [readingBook, setReadingBook] = useState<Ebook | null>(null);
  const [checkoutBook, setCheckoutBook] = useState<Ebook | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Admin CRUD state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ebook | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [fTitle, setFTitle] = useState('');
  const [fLevel, setFLevel] = useState('SSC 27');
  const [fAuthor, setFAuthor] = useState('Aloms English Academic Team');
  const [fIsFree, setFIsFree] = useState(false);
  const [fPrice, setFPrice] = useState(99);
  const [fOriginalPrice, setFOriginalPrice] = useState(150);
  const [fPagesCount, setFPagesCount] = useState(120);
  const [fFileSize, setFFileSize] = useState('3.2 MB');
  const [fPdfUrl, setFPdfUrl] = useState('');
  const [fCoverImage, setFCoverImage] = useState(
    '/src/assets/images/course_english_books_1795411661325.jpg'
  );
  const [fStatus, setFStatus] = useState<'active' | 'draft'>('active');
  const [fSummary, setFSummary] = useState('');

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

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
    () => (bootstrap?.ebooks ?? []).filter((eb) => canManage || eb.status !== 'draft'),
    [bootstrap?.ebooks, canManage]
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

  const openCreate = () => {
    setEditing(null);
    setFTitle('');
    setFLevel('SSC 27');
    setFAuthor('Aloms English Academic Team');
    setFIsFree(false);
    setFPrice(99);
    setFOriginalPrice(150);
    setFPagesCount(120);
    setFFileSize('3.2 MB');
    setFPdfUrl('');
    setFCoverImage('/src/assets/images/course_english_books_1795411661325.jpg');
    setFStatus('active');
    setFSummary('');
    setModalOpen(true);
  };

  const openEdit = (book: Ebook) => {
    setEditing(book);
    setFTitle(book.title);
    setFLevel(book.level);
    setFAuthor(book.author);
    setFIsFree(book.isFree);
    setFPrice(book.price);
    setFOriginalPrice(book.originalPrice);
    setFPagesCount(book.pagesCount);
    setFFileSize(book.fileSize || '2.8 MB');
    setFPdfUrl(book.pdfUrl || '');
    setFCoverImage(
      book.coverImage || '/src/assets/images/course_english_books_1795411661325.jpg'
    );
    setFStatus(book.status === 'draft' ? 'draft' : 'active');
    setFSummary(book.summary);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: fTitle.trim(),
      level: fLevel.trim(),
      author: fAuthor.trim(),
      isFree: fIsFree,
      price: fIsFree ? 0 : Number(fPrice) || 0,
      originalPrice: fIsFree ? 0 : Number(fOriginalPrice) || Number(fPrice) || 0,
      pagesCount: Math.max(1, Number(fPagesCount) || 100),
      fileSize: fFileSize.trim(),
      pdfUrl: fPdfUrl.trim(),
      coverImage: fCoverImage,
      status: fStatus,
      summary: fSummary.trim(),
    };
    if (editing) {
      await apiFetch(`/api/portal/ebooks/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showNotice(`Updated E-Book "${payload.title}".`);
    } else {
      await apiFetch('/api/portal/ebooks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(`Created E-Book "${payload.title}".`);
    }
    setModalOpen(false);
    await refreshBootstrap();
  };

  const handleDelete = async (book: Ebook) => {
    if (confirmDeleteId !== book.id) {
      setConfirmDeleteId(book.id);
      return;
    }
    await apiFetch(`/api/portal/ebooks/${book.id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await refreshBootstrap();
    showNotice(`Deleted E-Book "${book.title}".`);
  };

  return (
    <div className="rm-pastel-bg min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-sky-500 sm:text-4xl">
            All E-Books &amp; Digital PDF Library
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Concise grammar short-notes, final suggestions, and high-yield exam guides with instant digital access.
          </p>

          {/* Filter controls */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {levels.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  levelFilter === lvl
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(['All', 'Free', 'Premium', 'My E-Books'] as const).map((pf) => (
              <button
                key={pf}
                type="button"
                onClick={() => setPriceFilter(pf)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  priceFilter === pf
                    ? 'bg-slate-900 text-white'
                    : 'bg-white/80 text-slate-700 hover:bg-white'
                }`}
              >
                {pf}
              </button>
            ))}
          </div>
        </div>

        {/* Admin Toolbar */}
        {canManage && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/95 px-5 py-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <Settings2 className="h-4 w-4 text-sky-600" />
              <span>Admin E-Book Library Control ({ebooks.length} titles)</span>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add E-Book</span>
            </button>
          </div>
        )}

        {toast && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            {toast}
          </div>
        )}

        {/* Portrait Cover Grid matching Screenshot 5 */}
        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
            const confirming = confirmDeleteId === book.id;

            return (
              <article
                key={book.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-900">
                    <img
                      src={cover}
                      alt={book.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <span
                      className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-xs ${
                        book.isFree ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    >
                      {book.isFree ? 'FREE' : 'PREMIUM'}
                    </span>

                    {!book.isFree && discountPct > 0 && (
                      <span className="font-mono-tabular absolute right-3 top-3 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-xs">
                        -{discountPct}%
                      </span>
                    )}

                    {book.status === 'draft' && (
                      <span className="absolute bottom-3 left-3 rounded bg-slate-900/90 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                        Draft
                      </span>
                    )}
                  </div>

                  <div className="p-4 pb-2">
                    <h2 className="line-clamp-2 text-sm font-extrabold text-slate-900">
                      {book.title}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{book.summary}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between px-4 pb-4 pt-2">
                    <div>
                      {book.isFree ? (
                        <span className="text-base font-extrabold text-emerald-600">Free</span>
                      ) : (
                        <div className="flex flex-col leading-tight">
                          <span className="font-mono-tabular text-base font-extrabold text-sky-600">
                            ৳{book.price}
                          </span>
                          {book.originalPrice > book.price && (
                            <span className="font-mono-tabular text-[11px] text-slate-400 line-through">
                              ৳{book.originalPrice}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAction(book)}
                      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold text-sky-600 transition-colors hover:bg-sky-100"
                    >
                      <span>{owned ? 'Read' : book.isFree ? 'Get free' : 'View'}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {canManage && (
                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500">
                        {book.level}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(book)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(book)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold ${
                              confirming
                                ? 'bg-rose-600 text-white'
                                : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                            }`}
                          >
                            <Trash2 className="h-3 w-3" />
                            {confirming && <span>Confirm</span>}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </article>
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

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/70 px-4 py-3">
              <div className="text-xs font-semibold text-slate-800">
                Full PDF &amp; Study Guide Unlocked for {user?.name || 'Student'}
              </div>
              <div className="flex flex-wrap gap-2">
                {sanitizeSafeUrl(readingBook.pdfUrl || '') && (
                  <a
                    href={sanitizeSafeUrl(readingBook.pdfUrl || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-white px-3.5 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Open PDF Link</span>
                  </a>
                )}
                <button
                  type="button"
                  disabled={downloading}
                  onClick={() => void handleDownloadEbook(readingBook)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-60"
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

      {/* Admin Create / Edit E-Book Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit E-Book' : 'Add E-Book'}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editing ? 'Edit E-Book' : 'Create E-Book'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close e-book editor"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Level / Batch</label>
                  <input
                    type="text"
                    value={fLevel}
                    onChange={(e) => setFLevel(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Author</label>
                  <input
                    type="text"
                    value={fAuthor}
                    onChange={(e) => setFAuthor(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={fIsFree}
                    onChange={(e) => setFIsFree(e.target.checked)}
                    className="h-4 w-4 rounded accent-sky-600"
                  />
                  <span>Free E-Book</span>
                </label>
                <select
                  value={fStatus}
                  onChange={(e) => setFStatus(e.target.value === 'draft' ? 'draft' : 'active')}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5"
                >
                  <option value="active">Active (Published)</option>
                  <option value="draft">Draft (Hidden)</option>
                </select>
              </div>
              {!fIsFree && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">Sale Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={fPrice}
                      onChange={(e) => setFPrice(Number(e.target.value))}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">Original Price (৳)</label>
                    <input
                      type="number"
                      min={0}
                      value={fOriginalPrice}
                      onChange={(e) => setFOriginalPrice(Number(e.target.value))}
                      className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Pages</label>
                  <input
                    type="number"
                    min={1}
                    value={fPagesCount}
                    onChange={(e) => setFPagesCount(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">File Size</label>
                  <input
                    type="text"
                    value={fFileSize}
                    onChange={(e) => setFFileSize(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">PDF Download URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={fPdfUrl}
                  onChange={(e) => setFPdfUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Summary Description</label>
                <textarea
                  rows={2}
                  value={fSummary}
                  onChange={(e) => setFSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <ImageUploadField label="Portrait Cover Image" value={fCoverImage} onChange={setFCoverImage} />
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-bold text-white hover:bg-sky-700"
                >
                  {editing ? 'Update E-Book' : 'Create E-Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
