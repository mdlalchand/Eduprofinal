import { ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export function ProductsPage() {
  const { bootstrap } = useAuth();
  const { addToCart } = useCart();
  const products = bootstrap?.products ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/90 via-slate-50 to-white pb-16 pt-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
            Home / Products · SHOP
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Products
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Physical grammar masterbooks, IELTS kits, and Aloms English Center study merchandise.
            Choose Home Delivery or Free Branch Pickup.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((prod) => {
            const savings = Math.max(0, prod.originalPrice - prod.price);
            const outOfStock = prod.stock <= 0;
            return (
              <div
                key={prod.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs"
              >
                <div>
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={prod.image}
                      alt={prod.title}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {savings > 0 && (
                      <span className="font-mono-tabular absolute left-3 top-3 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
                        SAVE ৳{savings}
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute right-3 top-3 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white">
                        STOCK OUT
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {prod.category}
                    </span>
                    <h2 className="mt-1 text-base font-extrabold text-slate-900">{prod.title}</h2>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-600">
                      {prod.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-4">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono-tabular text-lg font-extrabold text-slate-900">
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#062436] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>{outOfStock ? 'Unavailable' : 'Add to Cart'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
