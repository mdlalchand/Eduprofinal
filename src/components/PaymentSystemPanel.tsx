import {
  Building2,
  CheckCircle2,
  CreditCard,
  Edit3,
  KeyRound,
  Power,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import type {
  PaymentGatewayConfig,
  PaymentProviderType,
  PaymentTransaction,
  UserRole,
} from '../types';

interface PaymentSystemPanelProps {
  role: UserRole;
  paymentGateways: PaymentGatewayConfig[];
  transactions: PaymentTransaction[];
  onRefresh: () => Promise<void>;
  onNotify: (msg: string) => void;
}

const PROVIDER_LABELS: Record<PaymentProviderType, string> = {
  mobile_wallet: 'Mobile Wallet (MFS)',
  card_gateway: 'Card / SSLCommerz Gateway',
  bank_transfer: 'Manual Bank Transfer',
  cash_desk: 'Branch Cash Counter',
};

export function PaymentSystemPanel({
  role,
  paymentGateways,
  transactions,
  onRefresh,
  onNotify,
}: PaymentSystemPanelProps) {
  const { apiFetch } = useAuth();
  const [subTab, setSubTab] = useState<'gateways' | 'transactions'>(
    role === 'admin' ? 'gateways' : 'transactions'
  );
  const [txnFilter, setTxnFilter] = useState<'all' | 'completed' | 'pending_verification' | 'refunded'>('all');

  // Gateway Create / Edit Form State (Admin)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gwName, setGwName] = useState('');
  const [gwCode, setGwCode] = useState('');
  const [gwSubtitle, setGwSubtitle] = useState('');
  const [gwProviderType, setGwProviderType] = useState<PaymentProviderType>('mobile_wallet');
  const [gwMerchantAccount, setGwMerchantAccount] = useState('');
  const [gwInstructions, setGwInstructions] = useState('');
  const [gwMode, setGwMode] = useState<'sandbox' | 'live'>('sandbox');
  const [gwFeePercent, setGwFeePercent] = useState('0');
  const [gwApiKey, setGwApiKey] = useState('');
  const [gwWebhookSecret, setGwWebhookSecret] = useState('');
  const [gwActive, setGwActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDeleteGwId, setConfirmDeleteGwId] = useState<string | null>(null);
  const [confirmRefundTxnId, setConfirmRefundTxnId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setGwName('');
    setGwCode('');
    setGwSubtitle('');
    setGwProviderType('mobile_wallet');
    setGwMerchantAccount('');
    setGwInstructions('');
    setGwMode('sandbox');
    setGwFeePercent('0');
    setGwApiKey('');
    setGwWebhookSecret('');
    setGwActive(true);
    setErrorMsg(null);
  };

  const startEditGateway = (gw: PaymentGatewayConfig) => {
    setEditingId(gw.id);
    setGwName(gw.name);
    setGwCode(gw.code);
    setGwSubtitle(gw.subtitle);
    setGwProviderType(gw.providerType);
    setGwMerchantAccount(gw.merchantAccount);
    setGwInstructions(gw.instructions);
    setGwMode(gw.mode);
    setGwFeePercent(String(gw.feePercent ?? 0));
    setGwApiKey('');
    setGwWebhookSecret('');
    setGwActive(gw.active);
    setErrorMsg(null);
  };

  const handleSaveGateway = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    try {
      const payload = {
        name: gwName.trim(),
        code: gwCode.trim() || gwName.trim(),
        subtitle: gwSubtitle.trim(),
        providerType: gwProviderType,
        merchantAccount: gwMerchantAccount.trim(),
        instructions: gwInstructions.trim(),
        mode: gwMode,
        feePercent: Number(gwFeePercent) || 0,
        apiKey: gwApiKey.trim() || undefined,
        webhookSecret: gwWebhookSecret.trim() || undefined,
        active: gwActive,
      };
      if (editingId) {
        await apiFetch(`/api/portal/payment-gateways/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotify(`Payment gateway "${payload.name}" updated.`);
      } else {
        await apiFetch('/api/portal/payment-gateways', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotify(`Payment gateway "${payload.name}" added.`);
      }
      resetForm();
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save payment gateway.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGateway = async (gw: PaymentGatewayConfig) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/portal/payment-gateways/${gw.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !gw.active }),
      });
      await onRefresh();
      onNotify(`"${gw.name}" ${!gw.active ? 'activated' : 'deactivated'} for checkout.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleDeleteGateway = async (id: string, name: string) => {
    if (confirmDeleteGwId !== id) {
      setConfirmDeleteGwId(id);
      return;
    }
    setConfirmDeleteGwId(null);
    await apiFetch(`/api/portal/payment-gateways/${id}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    await onRefresh();
    onNotify(`"${name}" moved to Recycle Bin.`);
  };

  const handleTransactionStatus = async (
    txnId: string,
    status: 'completed' | 'refunded'
  ) => {
    if (status === 'refunded' && confirmRefundTxnId !== txnId) {
      setConfirmRefundTxnId(txnId);
      return;
    }
    setConfirmRefundTxnId(null);
    await apiFetch(`/api/portal/payments/transactions/${txnId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await onRefresh();
    onNotify(`Transaction marked as ${status}.`);
  };

  const completedSum = transactions
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + t.totalAmount, 0);
  const pendingCount = transactions.filter((t) => t.status === 'pending_verification').length;
  const activeGatewaysCount = paymentGateways.filter((g) => g.active).length;

  const filteredTxns = transactions.filter((t) =>
    txnFilter === 'all' ? true : t.status === txnFilter
  );

  return (
    <div className="space-y-6">
      {/* Payment System Header & Sub-Tabs */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <Wallet className="h-5 w-5 text-indigo-600" />
              <span>Dedicated Payment System &amp; Gateways</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Configure checkout gateways (bKash, Nagad, Rocket, SSLCommerz, Bank, Branch Cash), toggle availability, and verify 4-step transactions separately from API connectors.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {role === 'admin' && (
              <button
                type="button"
                onClick={() => setSubTab('gateways')}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                  subTab === 'gateways'
                    ? 'bg-[#062436] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Gateways &amp; Credentials ({activeGatewaysCount}/{paymentGateways.length} Active)
              </button>
            )}
            <button
              type="button"
              onClick={() => setSubTab('transactions')}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-colors ${
                subTab === 'transactions'
                  ? 'bg-[#062436] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Transactions &amp; Approvals ({transactions.length})
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-[11px] font-bold uppercase text-slate-500">Active Checkout Gateways</p>
            <p className="font-mono-tabular mt-1 text-xl font-extrabold text-slate-900">
              {activeGatewaysCount} / {paymentGateways.length}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
            <p className="text-[11px] font-bold uppercase text-emerald-700">Verified Payments</p>
            <p className="font-mono-tabular mt-1 text-xl font-extrabold text-emerald-800">
              ৳{completedSum.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <p className="text-[11px] font-bold uppercase text-amber-700">Pending Verification</p>
            <p className="font-mono-tabular mt-1 text-xl font-extrabold text-amber-800">
              {pendingCount} Receipts
            </p>
          </div>
        </div>
      </div>

      {/* SUB-TAB 1: PAYMENT GATEWAYS CRUD & ADMIN API CONFIG */}
      {subTab === 'gateways' && role === 'admin' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveGateway}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-slate-900">
                {editingId ? 'Edit Payment Gateway Configuration' : 'Add Payment Gateway / Method'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {errorMsg && (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {errorMsg}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="gw-name" className="mb-1 block text-xs font-semibold text-slate-700">
                  Display Name *
                </label>
                <input
                  id="gw-name"
                  type="text"
                  required
                  placeholder="e.g. bKash Merchant Checkout"
                  value={gwName}
                  onChange={(e) => setGwName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold"
                />
              </div>
              <div>
                <label htmlFor="gw-code" className="mb-1 block text-xs font-semibold text-slate-700">
                  Gateway Code *
                </label>
                <input
                  id="gw-code"
                  type="text"
                  required
                  disabled={Boolean(editingId)}
                  placeholder="e.g. bKash or Upay"
                  value={gwCode}
                  onChange={(e) => setGwCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs disabled:bg-slate-100"
                />
              </div>
              <div>
                <label htmlFor="gw-provider" className="mb-1 block text-xs font-semibold text-slate-700">
                  Provider Type
                </label>
                <select
                  id="gw-provider"
                  value={gwProviderType}
                  onChange={(e) => setGwProviderType(e.target.value as PaymentProviderType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold"
                >
                  <option value="mobile_wallet">Mobile Wallet (bKash/Nagad/Rocket)</option>
                  <option value="card_gateway">Card / SSLCommerz Gateway</option>
                  <option value="bank_transfer">Manual Bank Transfer</option>
                  <option value="cash_desk">Branch Cash Counter</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="gw-merchant" className="mb-1 block text-xs font-semibold text-slate-700">
                  Merchant / Account Number
                </label>
                <input
                  id="gw-merchant"
                  type="text"
                  placeholder="e.g. 01710-000100 (Merchant)"
                  value={gwMerchantAccount}
                  onChange={(e) => setGwMerchantAccount(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label htmlFor="gw-subtitle" className="mb-1 block text-xs font-semibold text-slate-700">
                  Checkout Subtitle
                </label>
                <input
                  id="gw-subtitle"
                  type="text"
                  placeholder="Instant App / Dial *247#"
                  value={gwSubtitle}
                  onChange={(e) => setGwSubtitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="gw-mode" className="mb-1 block text-xs font-semibold text-slate-700">
                    Mode
                  </label>
                  <select
                    id="gw-mode"
                    value={gwMode}
                    onChange={(e) => setGwMode(e.target.value as 'sandbox' | 'live')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold"
                  >
                    <option value="live">LIVE</option>
                    <option value="sandbox">SANDBOX</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="gw-fee" className="mb-1 block text-xs font-semibold text-slate-700">
                    Fee %
                  </label>
                  <input
                    id="gw-fee"
                    type="number"
                    min={0}
                    max={20}
                    step="0.1"
                    value={gwFeePercent}
                    onChange={(e) => setGwFeePercent(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-2.5 py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="gw-apikey" className="mb-1 block text-xs font-semibold text-slate-700">
                  API Key / Store ID {editingId ? '(leave blank to keep existing)' : ''}
                </label>
                <input
                  id="gw-apikey"
                  type="password"
                  placeholder="Enter new API key or Store ID..."
                  value={gwApiKey}
                  onChange={(e) => setGwApiKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label htmlFor="gw-secret" className="mb-1 block text-xs font-semibold text-slate-700">
                  Webhook / Store Secret {editingId ? '(leave blank to keep existing)' : ''}
                </label>
                <input
                  id="gw-secret"
                  type="password"
                  placeholder="Enter webhook secret..."
                  value={gwWebhookSecret}
                  onChange={(e) => setGwWebhookSecret(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label htmlFor="gw-inst" className="mb-1 block text-xs font-semibold text-slate-700">
                Checkout Instructions Shown to Students
              </label>
              <textarea
                id="gw-inst"
                rows={2}
                placeholder="Instructions displayed at Step 3 of payment checkout..."
                value={gwInstructions}
                onChange={(e) => setGwInstructions(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={gwActive}
                  onChange={(e) => setGwActive(e.target.checked)}
                />
                <span>Active for Public 4-Step Checkout</span>
              </label>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-[#062436] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0b3854] disabled:opacity-60"
              >
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Update Payment Gateway'
                    : 'Add Payment Gateway'}
              </button>
            </div>
          </form>

          {/* Gateway Cards List */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {paymentGateways.map((gw) => {
              const Icon =
                gw.providerType === 'card_gateway'
                  ? CreditCard
                  : gw.providerType === 'mobile_wallet'
                    ? Smartphone
                    : Building2;
              const isConfirmingDel = confirmDeleteGwId === gw.id;
              return (
                <div
                  key={gw.id}
                  className={`flex flex-col justify-between rounded-2xl border p-5 shadow-xs transition-all ${
                    gw.active
                      ? 'border-slate-200 bg-white'
                      : 'border-slate-200 bg-slate-50/80 opacity-85'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            gw.active
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">{gw.name}</p>
                          <p className="text-[11px] font-semibold text-slate-500">
                            {PROVIDER_LABELS[gw.providerType]} · Code: {gw.code}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            gw.mode === 'live'
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {gw.mode}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            gw.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {gw.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                      <p>
                        <strong className="text-slate-800">Account / Merchant:</strong>{' '}
                        {gw.merchantAccount}
                      </p>
                      <p className="line-clamp-2">{gw.instructions}</p>
                      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <KeyRound className="h-3 w-3" />
                        <span>API: {gw.apiKeyMasked} · Secret: {gw.webhookSecretMasked}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => void handleToggleGateway(gw)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                        gw.active
                          ? 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{gw.active ? 'Deactivate' : 'Activate'}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditGateway(gw)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteGateway(gw.id, gw.name)}
                        className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                          isConfirmingDel
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{isConfirmingDel ? 'Confirm' : 'Delete'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TRANSACTIONS & MANUAL / CASH VERIFICATION */}
      {subTab === 'transactions' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
              <Receipt className="h-4 w-4 text-sky-600" />
              <span>Payment Transactions &amp; 4-Step Receipts ({filteredTxns.length})</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'completed', label: 'Completed' },
                  { id: 'pending_verification', label: 'Pending Verification' },
                  { id: 'refunded', label: 'Refunded' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTxnFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    txnFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                  <th className="py-2.5 pr-3">Invoice</th>
                  <th className="py-2.5 pr-3">Payer</th>
                  <th className="py-2.5 pr-3">Gateway</th>
                  <th className="py-2.5 pr-3">TrxID / Account</th>
                  <th className="py-2.5 pr-3">Amount</th>
                  <th className="py-2.5 pr-3">Status</th>
                  <th className="py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTxns.map((txn) => (
                  <tr key={txn.id}>
                    <td className="font-mono-tabular py-3 pr-3 font-bold text-slate-900">
                      {txn.invoiceNo}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-slate-800">{txn.payerName}</td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
                        <ShieldCheck className="h-3 w-3 text-indigo-600" />
                        {txn.gateway}
                      </span>
                    </td>
                    <td className="font-mono-tabular py-3 pr-3 text-slate-600">
                      {txn.trxId} · {txn.walletOrLast4}
                    </td>
                    <td className="font-mono-tabular py-3 pr-3 font-bold text-slate-900">
                      ৳{txn.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                          txn.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : txn.status === 'pending_verification'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {txn.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {txn.status === 'pending_verification' && (
                          <button
                            type="button"
                            onClick={() => void handleTransactionStatus(txn.id, 'completed')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Verify &amp; Approve
                          </button>
                        )}
                        {txn.status === 'completed' && (
                          <button
                            type="button"
                            onClick={() => void handleTransactionStatus(txn.id, 'refunded')}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold ${
                              confirmRefundTxnId === txn.id
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                            }`}
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>{confirmRefundTxnId === txn.id ? 'Confirm Refund' : 'Refund'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
