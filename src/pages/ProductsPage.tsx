import { Pencil, Plus, Search, Settings2, ShoppingBag, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ImageUploadField } from '../components/ImageUploadField';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { sanitizeSafeUrl } from '../lib/domain';
import type { Product } from '../types';

export function ProductsPage() {
  const { user, bootstrap, apiFetch, refreshBootstrap } = useAuth();
  const { addToCart } = useCart();
  const isAdmin = user?.role === 'admin';
  const products = bootstrap?.products ?? [];

  const [categoryFilter, setCategoryFilter] = useState('All');
  const [search, setSearch] = useState('');

  // Admin CRUD state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [fTitle, setFTitle] = useState('');
  const [fCategory, setFCategory] = useState('Books');
  const [fPrice, setFPrice] = useState(450);
  const [fOriginalPrice, setFOriginalPrice] = useState(600);
  const [fStock, setFStock] = useState(50);
  const [fImage, setFImage] = useState(
    '/src/assets/images/course_english_books_1795411661325.jpg'
  );
  const [fDescription, setFDescription] = useState('');

  const showNotice = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const categories = useMemo(() => {
    const uniq = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));
    return ['All', ...uniq];
  }, [products]);

  const filtered = products.filter((p) => {
    if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
    if (
      search.trim() &&
      !`${p.title} ${p.description} ${p.category}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const openCreate = () => {
    setEditing(null);
    setFTitle('');
    setFCategory('Books');
    setFPrice(450);
    setFOriginalPrice(600);
    setFStock(50);
    setFImage('/src/assets/images/course_english_books_1795411661325.jpg');
    setFDescription('');
    setModalOpen(true);
  };

  const openEdit = (prod: Product) => {
    setEditing(prod);
    setFTitle(prod.title);
    setFCategory(prod.category);
    setFPrice(prod.price);
    setFOriginalPrice(prod.originalPrice);
    setFStock(prod.stock);
    setFImage(prod.image || '/src/assets/images/course_english_books_1795411661325.jpg');
    setFDescription(prod.description);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: fTitle.trim(),
      category: fCategory.trim(),
      price: Math.max(0, Number(fPrice) || 0),
      originalPrice: Math.max(Number(fPrice) || 0, Number(fOriginalPrice) || 0),
      stock: Math.max(0, Number(fStock) || 0),
      image: fImage,
      description: fDescription.trim(),
    };
    if (editing) {
      await apiFetch(`/api/portal/products/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showNotice(`Updated product "${payload.title}".`);
    } else {
      await apiFetch('/api/portal/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showNotice(`Added product "${payload.title}".`);
    }
    setModalOpen(false);
    await refreshBootstrap();
  };

  const handleDelete = async (prod: Product) => {
    if (confirmDeleteId !== prod.id) {
      setConfirmDeleteId(prod.id);
      return;
    }
    await apiFetch(`/api/portal/products/${prod.id}`, { method: 'DELETE' });
    setConfirmDeleteId(null);
    await refreshBootstrap();
    showNotice(`Deleted product "${prod.title}".`);
  };

  return (
    <div className="rm-pastel-bg min-h-screen pb-20 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-sky-500 sm:text-4xl">
            Study Store &amp; Books
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">
            Printed grammar masterbooks, practice workbooks, and study kits. Order for Home Delivery
            or Free Campus Pickup.
          </p>

          <div className="mx-auto mt-6 flex max-w-xl flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search printed books, workbooks, kits..."
                aria-label="Search products"
                className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 shadow-xs focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  categoryFilter === cat
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Admin Product CRUD Strip */}
        {isAdmin && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/95 px-5 py-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 text-xs font-bold text-slate-800">
              <Settings2 className="h-4 w-4 text-sky-600" />
              <span>Admin Store Inventory Control ({products.length} items)</span>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Product</span>
            </button>
          </div>
        )}

        {toast && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            {toast}
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {filtered.map((prod) => {
            const savings = Math.max(0, prod.originalPrice - prod.price);
            const outOfStock = prod.stock <= 0;
            const confirming = confirmDeleteId === prod.id;
            return (
              <article
                key={prod.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white shadow-[0_10px_32px_rgba(15,23,42,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={sanitizeSafeUrl(
                        prod.image,
                        '/src/assets/images/course_english_books_1795411661325.jpg'
                      )}
                      alt={prod.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {savings > 0 && (
                      <span className="font-mono-tabular absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                        Save ৳{savings}
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute right-3 top-3 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-bold text-white">
                        Stock Out
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>{prod.category}</span>
                      <span className="font-mono-tabular">Stock: {prod.stock}</span>
                    </div>
                    <h2 className="mt-1.5 text-base font-extrabold text-slate-900">{prod.title}</h2>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                      {prod.description}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono-tabular text-lg font-extrabold text-sky-600">
                        ৳{prod.price}
                      </span>
                      {prod.originalPrice > prod.price && (
                        <span className="font-mono-tabular text-xs text-slate-400 line-through">
                          ৳{prod.originalPrice}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => addToCart(prod)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3.5 py-2 text-xs font-bold text-sky-700 transition-colors hover:bg-sky-600 hover:text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>{outOfStock ? 'Unavailable' : 'Add to Cart'}</span>
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2">
                      <span className="text-[10px] font-bold text-slate-500">SKU {prod.id}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(prod)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-sky-400 hover:text-sky-700"
                        >
                          <Pencil className="h-3 w-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(prod)}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                            confirming
                              ? 'bg-rose-600 text-white'
                              : 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <Trash2 className="h-3 w-3" />
                          {confirming && <span>Confirm</span>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* Admin Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label={editing ? 'Edit Product' : 'Add Product'}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900">
                {editing ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close product modal"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Category</label>
                  <input
                    type="text"
                    value={fCategory}
                    onChange={(e) => setFCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Price (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={fPrice}
                    onChange={(e) => setFPrice(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Original (৳)</label>
                  <input
                    type="number"
                    min={0}
                    value={fOriginalPrice}
                    onChange={(e) => setFOriginalPrice(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={fStock}
                    onChange={(e) => setFStock(Number(e.target.value))}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={fDescription}
                  onChange={(e) => setFDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
              <ImageUploadField label="Product Image" value={fImage} onChange={setFImage} />
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
                  {editing ? 'Update Product' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
