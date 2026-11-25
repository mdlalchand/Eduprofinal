import { Minus, Plus, ShoppingBag, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  calculateOrderTotalWithCoupon,
  filterActiveBranches,
  resolveDefaultActiveBranchId,
} from '../lib/domain';
import type { Coupon } from '../types';
import { FourStepPaymentModal } from './FourStepPaymentModal';

interface CartDrawerProps {
  navigate: (path: string) => void;
}

export function CartDrawer({ navigate }: CartDrawerProps) {
  const { items, isOpen, setIsOpen, updateQuantity, removeItem, clearCart } = useCart();
  const { user, bootstrap } = useAuth();
  const activeBranches = useMemo(
    () => filterActiveBranches(bootstrap?.branches),
    [bootstrap?.branches]
  );
  const [deliveryMode, setDeliveryMode] = useState<'home' | 'branch_pickup'>('home');
  const [branchPickupId, setBranchPickupId] = useState(() =>
    resolveDefaultActiveBranchId(bootstrap?.branches)
  );
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<string | null>(null);

  useEffect(() => {
    setBranchPickupId((prev) => resolveDefaultActiveBranchId(activeBranches, prev));
    if (activeBranches.length === 0 && deliveryMode === 'branch_pickup') {
      setDeliveryMode('home');
    }
  }, [activeBranches, deliveryMode]);

  if (!isOpen && !checkoutOpen) return null;

  const totals = calculateOrderTotalWithCoupon(
    items.map((i) => ({ unitPrice: i.product.price, quantity: i.quantity })),
    deliveryMode,
    appliedCoupon
  );

  const handleValidateCoupon = async () => {
    setCouponMsg(null);
    if (!couponInput.trim()) return;
    try {
      const res = await fetch('/api/public/coupons/validate-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
          deliveryMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAppliedCoupon(null);
        setCouponMsg(json.error || 'Invalid coupon code.');
        return;
      }
      setAppliedCoupon(json.coupon);
      setCouponMsg(`Applied ${json.coupon.code} (${json.coupon.discountPercent}% OFF)`);
    } catch {
      setCouponMsg('Failed to validate coupon.');
    }
  };

  const handleProceed = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      setIsOpen(false);
      navigate('/login');
      return;
    }
    if (deliveryMode === 'home' && !address.trim()) {
      setError('Please enter your delivery address.');
      return;
    }
    setCheckoutOpen(true);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs">
          <div
            role="dialog"
            aria-label="Shopping Cart"
            className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-sky-600" />
                <h2 className="text-lg font-bold text-slate-900">Your Cart</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSuccessInvoice(null);
                  setIsOpen(false);
                }}
                aria-label="Close cart"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {successInvoice ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <h3 className="text-lg font-bold text-emerald-900">Order & Payment Verified!</h3>
                  <p className="mt-2 text-sm text-emerald-800">
                    Invoice{' '}
                    <span className="font-mono-tabular font-bold">{successInvoice}</span> has been
                    issued. Track your order anytime inside your Unified Portal.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSuccessInvoice(null);
                      setIsOpen(false);
                      navigate('/portal');
                    }}
                    className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    View Order in Portal
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="py-16 text-center text-slate-500">
                  <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="font-medium">Your cart is empty.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/products');
                    }}
                    className="mt-4 rounded-xl bg-[#062436] px-5 py-2.5 text-sm font-semibold text-white"
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <img
                        src={product.image}
                        alt={product.title}
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-bold text-slate-900">
                          {product.title}
                        </h4>
                        <p className="font-mono-tabular text-xs font-semibold text-sky-700">
                          ৳{product.price}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Decrease quantity of ${product.title}`}
                            onClick={() => updateQuantity(product.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="font-mono-tabular min-w-5 text-center text-xs font-bold">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Increase quantity of ${product.title}`}
                            onClick={() => updateQuantity(product.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${product.title}`}
                        onClick={() => removeItem(product.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <form onSubmit={handleProceed} className="space-y-4 border-t border-slate-200 pt-4">
                    {/* Product Coupon Input */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <label
                        htmlFor="cart-coupon"
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700"
                      >
                        <Tag className="h-3.5 w-3.5 text-indigo-600" />
                        <span>Product Coupon (Try BOOK15 or ALOMS10)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="cart-coupon"
                          type="text"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="BOOK15"
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs uppercase"
                        />
                        <button
                          type="button"
                          onClick={handleValidateCoupon}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Apply
                        </button>
                      </div>
                      {couponMsg && (
                        <p className="text-[11px] font-semibold text-emerald-700">{couponMsg}</p>
                      )}
                    </div>

                    <div>
                      <span className="mb-2 block text-xs font-semibold text-slate-700">
                        Delivery Option
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDeliveryMode('home')}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            deliveryMode === 'home'
                              ? 'border-sky-600 bg-sky-50 text-sky-700'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          Home Delivery (৳80)
                        </button>
                        <button
                          type="button"
                          disabled={activeBranches.length === 0}
                          onClick={() => setDeliveryMode('branch_pickup')}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            deliveryMode === 'branch_pickup'
                              ? 'border-sky-600 bg-sky-50 text-sky-700'
                              : 'border-slate-200 text-slate-600'
                          }`}
                        >
                          {activeBranches.length > 0 ? 'Branch Pickup (Free)' : 'Pickup Unavailable'}
                        </button>
                      </div>
                    </div>

                    {deliveryMode === 'branch_pickup' ? (
                      <div>
                        <label
                          htmlFor="cart-branch"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Select Active Pickup Branch
                        </label>
                        {activeBranches.length > 0 ? (
                          <select
                            id="cart-branch"
                            value={branchPickupId}
                            onChange={(e) => setBranchPickupId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                          >
                            {activeBranches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                            No active pickup branches currently available.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label
                          htmlFor="cart-address"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Delivery Address
                        </label>
                        <input
                          id="cart-address"
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="House, Road, Area, District"
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="cart-phone"
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Contact Phone
                      </label>
                      <input
                        id="cart-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>

                    {error && (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                        {error}
                      </p>
                    )}

                    <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-mono-tabular font-semibold">৳{totals.subtotal}</span>
                      </div>
                      {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-700">
                          <span>Discount ({totals.appliedCouponCode})</span>
                          <span className="font-mono-tabular font-semibold">
                            -৳{totals.discountAmount}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-slate-600">
                        <span>Delivery Fee</span>
                        <span className="font-mono-tabular font-semibold">
                          ৳{totals.deliveryFee}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-bold text-slate-900">
                        <span>Total</span>
                        <span className="font-mono-tabular">৳{totals.totalAmount}</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#062436] py-3 text-sm font-bold text-white transition-colors hover:bg-[#0b3854]"
                    >
                      {user
                        ? `4-Step Checkout · ৳${totals.totalAmount}`
                        : 'Login to Checkout'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && (
        <FourStepPaymentModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          referenceType="order"
          itemTitle={`${items.length} Study Store Item(s)`}
          baseAmount={totals.subtotal}
          deliveryFee={totals.deliveryFee}
          initialCouponCode={appliedCoupon?.code || ''}
          initialDiscount={totals.discountAmount}
          orderItems={items.map((i) => ({ productId: i.product.id, quantity: i.quantity }))}
          deliveryMode={deliveryMode}
          deliveryAddress={address.trim()}
          phone={phone.trim() || user?.phone}
          branchPickupId={deliveryMode === 'branch_pickup' ? branchPickupId : null}
          onSuccess={({ transaction }) => {
            clearCart();
            setSuccessInvoice(transaction.invoiceNo);
          }}
        />
      )}
    </>
  );
}
