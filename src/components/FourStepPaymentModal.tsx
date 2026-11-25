import {
  Building2,
  CheckCircle2,
  CreditCard,
  Lock,
  Receipt,
  ShieldCheck,
  Smartphone,
  Tag,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  computeBatchSeatUsage,
  filterActiveBranches,
  filterActivePaymentGateways,
  resolveDefaultActiveBranchId,
} from '../lib/domain';
import type { Branch, CourseBatch, PaymentGatewayType, PaymentTransaction } from '../types';

interface FourStepPaymentModalProps {
  open: boolean;
  onClose: () => void;
  referenceType: 'course' | 'order' | 'ebook' | 'invoice';
  itemTitle: string;
  baseAmount: number;
  deliveryFee?: number;
  initialCouponCode?: string;
  initialDiscount?: number;
  courseId?: string;
  ebookId?: string;
  invoiceId?: string;
  branchId?: string;
  branches?: Branch[];
  batches?: CourseBatch[];
  selectedBatchId?: string;
  orderItems?: { productId: string; quantity: number }[];
  deliveryMode?: 'home' | 'branch_pickup';
  deliveryAddress?: string;
  phone?: string;
  branchPickupId?: string | null;
  onSuccess: (result: { transaction: PaymentTransaction }) => Promise<void> | void;
}

const GATEWAYS: {
  id: PaymentGatewayType;
  label: string;
  sub: string;
  accent: string;
  icon: typeof Smartphone;
}[] = [
  { id: 'bKash', label: 'bKash Merchant', sub: 'Instant App / Dial *247#', accent: 'border-pink-500 bg-pink-50 text-pink-800', icon: Smartphone },
  { id: 'Nagad', label: 'Nagad Payment', sub: 'Instant Wallet Checkout', accent: 'border-orange-500 bg-orange-50 text-orange-800', icon: Smartphone },
  { id: 'Rocket', label: 'Rocket DBBL', sub: 'Mobile Banking Pay', accent: 'border-purple-500 bg-purple-50 text-purple-800', icon: Smartphone },
  { id: 'SSLCommerz Card', label: 'Visa / Mastercard / Amex', sub: 'Online 3DS Secure Card', accent: 'border-sky-600 bg-sky-50 text-sky-900', icon: CreditCard },
  { id: 'Manual Bank Transfer', label: 'Manual Bank / Slip', sub: 'Dutch-Bangla / City Bank', accent: 'border-slate-500 bg-slate-50 text-slate-900', icon: Building2 },
  { id: 'Branch Cash', label: 'Branch Desk Cash', sub: 'Pay at Mirpur / Uttara / CTG', accent: 'border-emerald-600 bg-emerald-50 text-emerald-900', icon: Building2 },
];

export function FourStepPaymentModal({
  open,
  onClose,
  referenceType,
  itemTitle,
  baseAmount,
  deliveryFee = 0,
  initialCouponCode = '',
  initialDiscount = 0,
  courseId,
  ebookId,
  invoiceId,
  branchId,
  branches = [],
  batches = [],
  selectedBatchId = '',
  orderItems,
  deliveryMode,
  deliveryAddress,
  phone,
  branchPickupId,
  onSuccess,
}: FourStepPaymentModalProps) {
  const { user, bootstrap, apiFetch } = useAuth();
  const activeBranches = useMemo(() => {
    const source = branches.length > 0 ? branches : (bootstrap?.branches ?? []);
    return filterActiveBranches(source);
  }, [branches, bootstrap?.branches]);

  const courseBatches = useMemo(() => {
    if (referenceType !== 'course' || !courseId) return [];
    const source = batches.length > 0 ? batches : (bootstrap?.batches ?? []);
    return source.filter((b) => b.courseId === courseId);
  }, [batches, bootstrap?.batches, referenceType, courseId]);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [couponInput, setCouponInput] = useState(initialCouponCode);
  const [appliedCoupon, setAppliedCoupon] = useState(initialCouponCode);
  const [discountAmount, setDiscountAmount] = useState(initialDiscount);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState(() =>
    resolveDefaultActiveBranchId(activeBranches, branchId)
  );
  const [selectedBatch, setSelectedBatch] = useState(selectedBatchId);

  const activeGateways = useMemo(() => {
    const liveList = filterActivePaymentGateways(bootstrap?.paymentGateways);
    if (liveList.length > 0) {
      return liveList.map((g) => ({
        id: g.code as PaymentGatewayType,
        label: g.name,
        sub: g.subtitle || g.merchantAccount,
        merchantAccount: g.merchantAccount,
        instructions: g.instructions,
        providerType: g.providerType,
        mode: g.mode,
        accent:
          g.code === 'bKash'
            ? 'border-pink-500 bg-pink-50 text-pink-800'
            : g.code === 'Nagad'
              ? 'border-orange-500 bg-orange-50 text-orange-800'
              : g.code === 'Rocket'
                ? 'border-purple-500 bg-purple-50 text-purple-800'
                : g.providerType === 'card_gateway'
                  ? 'border-sky-600 bg-sky-50 text-sky-900'
                  : g.providerType === 'cash_desk'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                    : 'border-slate-500 bg-slate-50 text-slate-900',
        icon:
          g.providerType === 'card_gateway'
            ? CreditCard
            : g.providerType === 'mobile_wallet'
              ? Smartphone
              : Building2,
      }));
    }
    return GATEWAYS.map((g) => ({
      ...g,
      merchantAccount: '01710-000100',
      instructions: `Send payable amount via ${g.label} and enter your TrxID.`,
      providerType: g.id === 'Branch Cash' ? 'cash_desk' : 'mobile_wallet',
      mode: 'live' as const,
    }));
  }, [bootstrap?.paymentGateways]);

  const [gateway, setGateway] = useState<PaymentGatewayType>(activeGateways[0]?.id ?? 'bKash');
  const [walletOrLast4, setWalletOrLast4] = useState(user?.phone || '');
  const [trxId, setTrxId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentTransaction | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setError(null);
      setReceipt(null);
      setCouponMsg(null);
      setCouponInput(initialCouponCode);
      setAppliedCoupon(initialCouponCode);
      setDiscountAmount(initialDiscount);
      setWalletOrLast4(user?.phone || '');
      setTrxId('');
      if (selectedBatchId) {
        setSelectedBatch(selectedBatchId);
      } else {
        const firstOpen = courseBatches.find(
          (b) => b.status !== 'closed' && !computeBatchSeatUsage(b).isFull
        );
        setSelectedBatch(firstOpen?.id || '');
      }
    }
  }, [open, initialCouponCode, initialDiscount, selectedBatchId, courseBatches, user?.phone]);

  useEffect(() => {
    const resolved = resolveDefaultActiveBranchId(activeBranches, branchId);
    setSelectedBranch(resolved);
  }, [activeBranches, branchId]);

  useEffect(() => {
    if (activeGateways.length > 0 && !activeGateways.some((g) => g.id === gateway)) {
      setGateway(activeGateways[0].id);
    }
  }, [activeGateways, gateway]);

  if (!open) return null;

  const selectedGwObj = activeGateways.find((g) => g.id === gateway) ?? activeGateways[0];
  const netPayable = Math.max(0, baseAmount - discountAmount + deliveryFee);
  const isCash = gateway === 'Branch Cash' || selectedGwObj?.providerType === 'cash_desk';
  const isManualSlip = gateway === 'Manual Bank Transfer' || selectedGwObj?.providerType === 'bank_transfer';

  const handleApplyCoupon = async () => {
    setCouponMsg(null);
    if (!couponInput.trim()) return;
    try {
      if (referenceType === 'course' && courseId) {
        const res = await fetch('/api/public/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponInput.trim(), courseId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid coupon');
        setAppliedCoupon(data.coupon.code);
        setDiscountAmount(data.pricing.couponDiscountAmount);
        setCouponMsg(`Applied ${data.coupon.code} (-৳${data.pricing.couponDiscountAmount})`);
      } else if (referenceType === 'ebook' && ebookId) {
        const res = await fetch('/api/public/coupons/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: couponInput.trim(), ebookId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid coupon');
        setAppliedCoupon(data.coupon.code);
        setDiscountAmount(data.pricing.couponDiscountAmount);
        setCouponMsg(`Applied ${data.coupon.code} (-৳${data.pricing.couponDiscountAmount})`);
      } else {
        const res = await fetch('/api/public/coupons/validate-cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: couponInput.trim(),
            items: orderItems ?? [],
            deliveryMode: deliveryMode ?? 'home',
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid coupon');
        setAppliedCoupon(data.coupon.code);
        setDiscountAmount(data.totals.discountAmount);
        setCouponMsg(`Applied ${data.coupon.code} (-৳${data.totals.discountAmount})`);
      }
    } catch (err) {
      setCouponMsg(err instanceof Error ? err.message : 'Coupon check failed');
      setAppliedCoupon('');
      setDiscountAmount(0);
    }
  };

  const handleCompletePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const effectiveBranchId =
        referenceType === 'course' || referenceType === 'invoice'
          ? selectedBranch || branchId || 'online'
          : branchId;

      const useManualSubmission = isCash || isManualSlip || (trxId.trim().length >= 5 && referenceType !== 'invoice');
      if (!useManualSubmission) {
        const idempotencyKey = `web-${user?.id ?? 'anon'}-${referenceType}-${courseId || ebookId || invoiceId || Date.now()}`;
        const initRes = await apiFetch<{
          session: { id: string; mode: 'sandbox' | 'live'; amount: number };
          sandboxSignPayload?: {
            sessionId: string;
            gateway: string;
            trxId: string;
            amount: number;
            signature: string;
          };
          immediateFreeActivation?: boolean;
          result?: { transaction?: PaymentTransaction };
        }>('/api/payments/initiate', {
          method: 'POST',
          body: JSON.stringify({
            idempotencyKey,
            referenceType,
            courseId,
            ebookId,
            invoiceId,
            batchId: referenceType === 'course' && selectedBatch ? selectedBatch : undefined,
            branchId: effectiveBranchId,
            items: orderItems,
            deliveryMode,
            deliveryAddress,
            phone: phone || walletOrLast4.trim() || user?.phone,
            branchPickupId,
            couponCode: appliedCoupon,
            gateway,
          }),
        });

        if (initRes.immediateFreeActivation && initRes.result?.transaction) {
          setReceipt(initRes.result.transaction);
          setStep(4);
          await onSuccess({ transaction: initRes.result.transaction });
          return;
        }

        if (initRes.sandboxSignPayload) {
          const whRes = await apiFetch<{ transaction: PaymentTransaction }>(
            `/api/payments/webhooks/${encodeURIComponent(gateway.toLowerCase())}`,
            {
              method: 'POST',
              headers: {
                'X-Webhook-Signature': initRes.sandboxSignPayload.signature,
              },
              body: JSON.stringify({
                ...initRes.sandboxSignPayload,
                status: 'SUCCESS',
              }),
            }
          );
          if (whRes.transaction) {
            setReceipt(whRes.transaction);
            setStep(4);
            await onSuccess({ transaction: whRes.transaction });
            return;
          }
        }
      }

      if (referenceType === 'invoice') {
        throw new Error('Invoice payments require an active gateway session or sandbox webhook callback.');
      }

      const res = await apiFetch<{ transaction: PaymentTransaction }>('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({
          referenceType,
          courseId,
          ebookId,
          batchId: referenceType === 'course' && selectedBatch ? selectedBatch : undefined,
          branchId: effectiveBranchId,
          items: orderItems,
          deliveryMode,
          deliveryAddress,
          phone: phone || user?.phone,
          branchPickupId,
          couponCode: appliedCoupon,
          gateway,
          walletOrLast4: walletOrLast4.trim(),
          trxId:
            netPayable === 0
              ? `FREE-${Date.now().toString().slice(-6)}`
              : isCash
                ? 'CASH-DESK'
                : trxId.trim(),
        }),
      });
      setReceipt(res.transaction);
      setStep(4);
      await onSuccess({ transaction: res.transaction });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
      <div
        role="dialog"
        aria-label="4-Step Payment Checkout"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        {/* Header + 4-Step Progress Bar */}
        <div className="border-b border-slate-200 bg-[#062436] px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <h2 className="text-base font-extrabold">Aloms Secure 4-Step Checkout</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close checkout modal"
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 text-[11px] font-bold">
            {[
              { n: 1, t: '1. Order & Coupon' },
              { n: 2, t: '2. Gateway' },
              { n: 3, t: '3. Verify TrxID' },
              { n: 4, t: '4. Invoice' },
            ].map((s) => (
              <div
                key={s.n}
                className={`rounded-lg px-2 py-1.5 text-center ${
                  step >= s.n
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-white/10 text-slate-300'
                }`}
              >
                {s.t}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {referenceType === 'course'
                    ? 'Course Admission'
                    : referenceType === 'ebook'
                      ? 'Digital E-Book / PDF Purchase'
                      : 'Product Order'}
                </p>
                <h3 className="mt-1 text-lg font-extrabold text-slate-900">{itemTitle}</h3>
                {referenceType === 'course' && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor="pay-branch"
                        className="mb-1 block text-xs font-semibold text-slate-700"
                      >
                        Active Campus / Branch
                      </label>
                      {activeBranches.length > 0 ? (
                        <select
                          id="pay-branch"
                          value={selectedBranch}
                          onChange={(e) => setSelectedBranch(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          {activeBranches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                          Online / Virtual Campus Only — all physical campus desks are currently inactive.
                        </p>
                      )}
                    </div>

                    {courseBatches.length > 0 && (
                      <div>
                        <label
                          htmlFor="pay-batch"
                          className="mb-1 block text-xs font-semibold text-slate-700"
                        >
                          Select Batch &amp; Schedule
                        </label>
                        <select
                          id="pay-batch"
                          value={selectedBatch}
                          onChange={(e) => setSelectedBatch(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">-- Flexible / Default Batch --</option>
                          {courseBatches.map((bat) => {
                            const usage = computeBatchSeatUsage(bat);
                            const unavailable = bat.status === 'closed' || usage.isFull;
                            return (
                              <option key={bat.id} value={bat.id} disabled={unavailable}>
                                {bat.name} ({bat.schedule}) —{' '}
                                {bat.status === 'closed'
                                  ? 'Closed'
                                  : usage.isFull
                                    ? 'Seat Full'
                                    : `${usage.remainingSeats} seats left`}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <label
                  htmlFor="pay-coupon"
                  className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-700"
                >
                  <Tag className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Promo / Coupon Code (Try AEC20 or ALOMS10)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="pay-coupon"
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter coupon code"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Apply Coupon
                  </button>
                </div>
                {couponMsg && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">{couponMsg}</p>
                )}
              </div>

              <div className="space-y-1.5 rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Base Price</span>
                  <span className="font-mono-tabular font-semibold">৳{baseAmount}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Coupon Discount ({appliedCoupon})</span>
                    <span className="font-mono-tabular font-semibold">-৳{discountAmount}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Fee</span>
                    <span className="font-mono-tabular font-semibold">৳{deliveryFee}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-slate-900">
                  <span>Net Payable</span>
                  <span className="font-mono-tabular text-indigo-600">৳{netPayable}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Continue to Payment Method →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-extrabold text-slate-900">
                Select Payment Gateway (৳{netPayable})
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activeGateways.map((g) => {
                  const Icon = g.icon;
                  const active = gateway === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGateway(g.id)}
                      className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition-all ${
                        active ? g.accent : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold">{g.label}</p>
                        <p className="text-[11px] opacity-80">{g.sub}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                >
                  Continue to Verification →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleCompletePayment} className="space-y-4">
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-xs text-indigo-900">
                <p className="font-extrabold">
                  Selected Method: {selectedGwObj?.label ?? gateway}{' '}
                  {selectedGwObj?.merchantAccount ? `· ${selectedGwObj.merchantAccount}` : ''}
                </p>
                <p className="mt-1">
                  {selectedGwObj?.instructions ||
                    (isCash
                      ? 'Cash receipt will be generated with Pending Verification status until confirmed at your campus counter.'
                      : `Send ৳${netPayable} via ${gateway} and enter your Wallet / Card Last-4 & Transaction ID below.`)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="pay-wallet"
                  className="mb-1 block text-xs font-bold text-slate-700"
                >
                  {gateway === 'SSLCommerz Card'
                    ? 'Card Last 4 Digits'
                    : 'Payer Mobile / Account Number'}
                </label>
                <input
                  id="pay-wallet"
                  type="text"
                  required
                  value={walletOrLast4}
                  onChange={(e) => setWalletOrLast4(e.target.value)}
                  placeholder="017XXXXXXXX or 4242"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                />
              </div>

              {!isCash && netPayable > 0 && (
                <div>
                  <label
                    htmlFor="pay-trxid"
                    className="mb-1 block text-xs font-bold text-slate-700"
                  >
                    {isManualSlip
                      ? 'Bank Slip / Reference ID (Required)'
                      : 'Transaction ID (Optional in Sandbox — auto-verified via gateway callback)'}
                  </label>
                  <input
                    id="pay-trxid"
                    type="text"
                    required={isManualSlip}
                    value={trxId}
                    onChange={(e) => setTrxId(e.target.value.toUpperCase())}
                    placeholder={isManualSlip ? 'e.g. SLIP-40921' : 'Leave blank for instant sandbox verification, or enter manual TrxID'}
                    className="font-mono-tabular w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm uppercase"
                  />
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                    <Lock className="h-3 w-3" />
                    Duplicate TrxID fraud check enabled server-side. Manual entries remain Pending Verification until confirmed.
                  </p>
                </div>
              )}

              {error && (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {error}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-xl border border-slate-300 py-2.5 text-sm font-bold text-slate-700"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? 'Verifying...' : `Confirm & Pay ৳${netPayable}`}
                </button>
              </div>
            </form>
          )}

          {step === 4 && receipt && (
            <div className="space-y-4 text-center">
              <div
                className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                  receipt.status === 'pending_verification'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-900">
                {receipt.status === 'pending_verification'
                  ? 'Payment Submitted — Pending Verification'
                  : 'Verified Payment Receipt Issued!'}
              </h3>
              {receipt.status === 'pending_verification' && (
                <p className="mx-auto max-w-md text-xs text-amber-800">
                  Your receipt reference has been logged. Access will unlock automatically after gateway webhook settlement or campus admin verification.
                </p>
              )}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice Number</span>
                  <span className="font-mono-tabular font-extrabold text-indigo-700">
                    {receipt.invoiceNo}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Gateway & Reference</span>
                  <span className="font-bold text-slate-900">
                    {receipt.gateway} · {receipt.trxId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span
                    className={`font-bold uppercase ${
                      receipt.status === 'pending_verification'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    {receipt.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-extrabold text-slate-900">
                  <span>{receipt.status === 'pending_verification' ? 'Amount Submitted' : 'Amount Paid'}</span>
                  <span className="font-mono-tabular">৳{receipt.totalAmount}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-xl bg-[#062436] px-6 py-3 text-sm font-bold text-white hover:bg-[#0b3854]"
              >
                <Receipt className="h-4 w-4" />
                <span>Done & Continue</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
