import crypto from 'node:crypto';
import {
  getDecryptedIntegrationSecrets,
  recordWebhookEventIdempotent,
} from '../db/persistence';
import {
  calculateDiscountedPrice,
  calculateOrderTotalWithCoupon,
  computeBatchSeatUsage,
} from '../lib/domain';
import { calculateCoursePricingServerSide, validateEnrollmentRequest } from '../lib/courseEnterprise';
import type {
  Enrollment,
  FeeInvoice,
  Order,
  PaymentGatewayType,
  PaymentSessionRecord,
  PaymentTransaction,
} from '../types';
import { resolveSessionSecret } from './security';
import { getDb, recordAuditLog, saveDb } from './store';
import type { StoredUser } from './storeTypes';
import { dispatchRealCommunication } from './communicationService';

export function assertBranchOperationalForTransactions(branchId: string | null | undefined): {
  ok: true;
} | {
  ok: false;
  error: string;
} {
  if (!branchId) return { ok: true };
  const db = getDb();
  const branch = db.branches.find((b) => b.id === branchId);
  if (!branch) {
    return { ok: false, error: 'Selected branch does not exist.' };
  }
  if (branch.status !== 'active') {
    return {
      ok: false,
      error: `Branch "${branch.name}" is currently ${branch.status}. New admissions, enrollments, and payments are blocked for non-active branches.`,
    };
  }
  return { ok: true };
}

export function computeWebhookSignature(payloadString: string, gateway: string): string {
  const key = gateway.toLowerCase().includes('bkash')
    ? 'bkash'
    : gateway.toLowerCase().includes('nagad')
      ? 'nagad'
      : gateway.toLowerCase().includes('ssl')
        ? 'sslcommerz'
        : 'bkash';
  const secrets = getDecryptedIntegrationSecrets(key);
  const webhookSecret =
    secrets.webhookSecret ||
    process.env.PAYMENT_WEBHOOK_SECRET ||
    `${resolveSessionSecret()}:sandbox-webhook`;
  return crypto.createHmac('sha256', webhookSecret).update(payloadString).digest('hex');
}

export function verifyWebhookSignature(
  payloadString: string,
  gateway: string,
  providedSignature: string
): boolean {
  if (!providedSignature) return false;
  const expected = computeWebhookSignature(payloadString, gateway);
  const a = Buffer.from(providedSignature.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function initiateServerPaymentSession(params: {
  user: StoredUser;
  idempotencyKey: string;
  referenceType: 'course' | 'order' | 'ebook' | 'invoice';
  courseId?: string;
  ebookId?: string;
  invoiceId?: string;
  batchId?: string;
  branchId?: string;
  items?: Array<{ productId: string; quantity: number }>;
  deliveryMode?: 'home' | 'branch_pickup';
  deliveryAddress?: string;
  phone?: string;
  branchPickupId?: string;
  couponCode?: string;
  gateway: PaymentGatewayType | string;
}):
  | {
      ok: true;
      session: PaymentSessionRecord;
      sandboxSignPayload?: {
        sessionId: string;
        gateway: string;
        trxId: string;
        amount: number;
        signature: string;
      };
      immediateFreeActivation?: boolean;
      result?: unknown;
    }
  | { ok: false; status: number; error: string } {
  const db = getDb();
  const cleanKey = params.idempotencyKey.trim();
  if (!cleanKey) {
    return { ok: false, status: 400, error: 'Idempotency key is required.' };
  }

  const existing = db.paymentSessions.find((s) => s.idempotencyKey === cleanKey);
  if (existing) {
    return { ok: true, session: existing };
  }

  const targetBranchId = params.branchId || params.branchPickupId || params.user.branchId || 'br-mirpur';
  const branchCheck = assertBranchOperationalForTransactions(targetBranchId);
  if (!branchCheck.ok) {
    return { ok: false, status: 403, error: branchCheck.error };
  }

  const gw = db.paymentGateways.find((g) => g.code === params.gateway || g.name === params.gateway);
  if (gw && !gw.active) {
    return { ok: false, status: 400, error: `Gateway "${gw.name}" is disabled.` };
  }
  const safeGateway = (gw?.code || params.gateway || 'bKash') as PaymentGatewayType;
  const couponUpper = String(params.couponCode ?? '').trim().toUpperCase();
  const coupon = couponUpper
    ? db.coupons.find((c) => c.code.toUpperCase() === couponUpper && c.active)
    : undefined;

  let amount = 0;
  let referenceId = '';
  const metadata: Record<string, unknown> = {
    branchId: targetBranchId,
    batchId: params.batchId ?? null,
    couponCode: coupon?.code,
    phone: params.phone || params.user.phone,
    deliveryMode: params.deliveryMode,
    deliveryAddress: params.deliveryAddress,
    branchPickupId: params.branchPickupId,
    items: params.items,
  };

  if (params.referenceType === 'course') {
    const course = db.courses.find((c) => c.id === params.courseId);
    if (!course) return { ok: false, status: 404, error: 'Course not found.' };
    const validation = validateEnrollmentRequest({
      userId: params.user.id,
      course,
      batchId: params.batchId ?? null,
      batches: db.batches,
      enrollments: db.enrollments,
      branchId: params.branchId ?? null,
      branches: db.branches,
    });
    if (!validation.ok) {
      return { ok: false, status: validation.statusCode, error: validation.error };
    }
    const batch = validation.resolvedBatch;
    if (batch && batch.branchId) {
      const batchBranchCheck = assertBranchOperationalForTransactions(batch.branchId);
      if (!batchBranchCheck.ok) return { ok: false, status: 403, error: batchBranchCheck.error };
    }
    const pricing = calculateCoursePricingServerSide(course, coupon);
    amount = pricing.totalPayable;
    referenceId = course.id;
  } else if (params.referenceType === 'ebook') {
    const ebook = db.ebooks.find((e) => e.id === params.ebookId && e.status !== 'draft');
    if (!ebook) return { ok: false, status: 404, error: 'E-Book not found.' };
    const pricing = calculateDiscountedPrice(
      ebook.isFree ? 0 : ebook.price,
      ebook.originalPrice || ebook.price,
      coupon
    );
    amount = pricing.finalPrice;
    referenceId = ebook.id;
  } else if (params.referenceType === 'invoice') {
    const inv = db.feeInvoices.find((i) => i.id === params.invoiceId);
    if (!inv) return { ok: false, status: 404, error: 'Fee invoice not found.' };
    if (inv.studentUserId !== params.user.id && params.user.role !== 'admin') {
      return { ok: false, status: 403, error: 'Unauthorized to pay another student invoice.' };
    }
    const invBranchCheck = assertBranchOperationalForTransactions(inv.branchId);
    if (!invBranchCheck.ok) return { ok: false, status: 403, error: invBranchCheck.error };
    amount = inv.dueAmount;
    referenceId = inv.id;
  } else if (params.referenceType === 'order') {
    const rawItems = Array.isArray(params.items) ? params.items : [];
    if (!rawItems.length) return { ok: false, status: 400, error: 'Order items are required.' };
    const pricedItems: Array<{ unitPrice: number; quantity: number }> = [];
    for (const item of rawItems) {
      const prod = db.products.find((p) => p.id === item.productId);
      if (!prod) return { ok: false, status: 404, error: 'Product not found.' };
      const qty = Math.max(1, Number(item.quantity) || 1);
      if (prod.stock < qty) {
        return { ok: false, status: 400, error: `Insufficient stock for ${prod.title}.` };
      }
      pricedItems.push({ unitPrice: prod.price, quantity: qty });
    }
    const totals = calculateOrderTotalWithCoupon(
      pricedItems,
      params.deliveryMode === 'branch_pickup' ? 'branch_pickup' : 'home',
      coupon
    );
    amount = totals.totalAmount;
    referenceId = `ord-pending-${Date.now()}`;
  } else {
    return { ok: false, status: 400, error: 'Unsupported payment reference type.' };
  }

  const now = Date.now();
  const sessionId = `ps-${now}-${crypto.randomBytes(4).toString('hex')}`;
  const mode = gw?.mode === 'live' ? 'live' : 'sandbox';

  const session: PaymentSessionRecord = {
    id: sessionId,
    idempotencyKey: cleanKey,
    userId: params.user.id,
    referenceType: params.referenceType,
    referenceId,
    branchId: targetBranchId,
    gateway: safeGateway,
    mode,
    amount,
    currency: 'BDT',
    status: amount === 0 ? 'verified' : 'initiated',
    providerPaymentId: `PGW-${now.toString().slice(-6)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
    metadataJson: JSON.stringify(metadata),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
  };

  db.paymentSessions.unshift(session);

  if (amount === 0) {
    saveDb(db);
    const finalized = finalizeVerifiedPaymentSession(session.id, `FREE-${sessionId.slice(-6)}`, 'system-free');
    return { ok: true, session, immediateFreeActivation: true, result: finalized };
  }

  saveDb(db);

  // Build sandbox callback signature payload when in sandbox mode (never auto-completes without webhook verification)
  const sandboxTrxId = `SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const bodyForSig = JSON.stringify({
    sessionId: session.id,
    gateway: safeGateway,
    trxId: sandboxTrxId,
    amount: session.amount,
    status: 'SUCCESS',
  });
  const signature = computeWebhookSignature(bodyForSig, safeGateway);

  return {
    ok: true,
    session,
    sandboxSignPayload:
      mode === 'sandbox'
        ? {
            sessionId: session.id,
            gateway: safeGateway,
            trxId: sandboxTrxId,
            amount: session.amount,
            signature,
          }
        : undefined,
  };
}

export function finalizeVerifiedPaymentSession(
  sessionId: string,
  trxId: string,
  actorLabel: string
): {
  ok: true;
  transaction: PaymentTransaction;
  enrollment?: Enrollment;
  invoice?: FeeInvoice;
  order?: Order;
} | {
  ok: false;
  status: number;
  error: string;
} {
  const db = getDb();
  const session = db.paymentSessions.find((s) => s.id === sessionId);
  if (!session) return { ok: false, status: 404, error: 'Payment session not found.' };

  // Idempotent return if already verified
  if (session.status === 'verified' && session.trxId) {
    const existingTxn = db.transactions.find((t) => t.trxId === session.trxId);
    if (existingTxn) {
      return { ok: true, transaction: existingTxn };
    }
  }

  const cleanTrx = trxId.trim().toUpperCase();
  if (db.transactions.some((t) => t.trxId.toUpperCase() === cleanTrx)) {
    return { ok: false, status: 409, error: `Duplicate Transaction ID "${cleanTrx}" rejected.` };
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) return { ok: false, status: 404, error: 'Payer user account not found.' };

  const metadata = session.metadataJson ? (JSON.parse(session.metadataJson) as Record<string, unknown>) : {};
  const invoiceNo = `INV-AEC-${Date.now().toString().slice(-6)}`;
  const nowIso = new Date().toISOString();

  session.status = 'verified';
  session.trxId = cleanTrx;
  session.webhookVerifiedAt = nowIso;

  const txn: PaymentTransaction = {
    id: `txn-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    invoiceNo,
    referenceType: session.referenceType === 'invoice' ? 'course' : session.referenceType,
    referenceId: session.referenceId,
    userId: user.id,
    payerName: user.name,
    gateway: session.gateway as PaymentGatewayType,
    walletOrLast4: String(metadata.phone || user.phone).slice(-14),
    trxId: cleanTrx,
    subtotal: session.amount,
    discountAmount: 0,
    couponCode: metadata.couponCode ? String(metadata.couponCode) : undefined,
    deliveryFee: 0,
    totalAmount: session.amount,
    status: 'completed',
    createdAt: nowIso,
  };
  db.transactions.unshift(txn);

  let enrollment: Enrollment | undefined;
  let invoice: FeeInvoice | undefined;
  let order: Order | undefined;

  if (session.referenceType === 'course') {
    const course = db.courses.find((c) => c.id === session.referenceId);
    const batch = metadata.batchId
      ? db.batches.find((b) => b.id === String(metadata.batchId))
      : undefined;
    if (course) {
      const targetBranchId = String(metadata.branchId || batch?.branchId || user.branchId || 'br-mirpur');
      enrollment = {
        id: `enr-${Date.now()}`,
        userId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        courseId: course.id,
        courseTitle: course.title,
        branchId: targetBranchId,
        batchId: batch ? batch.id : null,
        batchName: batch ? batch.name : undefined,
        paymentMethod: session.gateway as PaymentGatewayType,
        trxId: cleanTrx,
        invoiceNo,
        amountPaid: session.amount,
        couponUsed: txn.couponCode,
        status: 'approved',
        completedLessonIds: [],
        history: [
          {
            id: `eh-${Date.now()}`,
            createdAt: nowIso,
            action: 'WEBHOOK_VERIFIED_ENROLLMENT',
            actorName: actorLabel,
            note: `Verified ${session.gateway} payment (${cleanTrx}) · ৳${session.amount}`,
          },
        ],
        enrolledAt: nowIso,
      };
      db.enrollments.unshift(enrollment);
      course.enrolledCount += 1;
      if (batch) {
        batch.enrolledSeats += 1;
        const usage = computeBatchSeatUsage(batch);
        if (usage.isFull) batch.status = 'closed';
      }
      invoice = {
        id: `inv-${Date.now()}`,
        invoiceNo,
        studentUserId: user.id,
        studentName: user.name,
        branchId: targetBranchId,
        courseId: course.id,
        batchId: batch?.id ?? null,
        feeType: 'tuition',
        title: `${course.title} (${session.gateway})`,
        totalAmount: session.amount,
        paidAmount: session.amount,
        dueAmount: 0,
        dueDate: nowIso.slice(0, 10),
        status: 'paid',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      db.feeInvoices.unshift(invoice);
    }
  } else if (session.referenceType === 'ebook') {
    const ebook = db.ebooks.find((e) => e.id === session.referenceId);
    if (ebook) {
      const claimed = db.claimedEbooksByUser[user.id] ?? [];
      if (!claimed.includes(ebook.id)) {
        claimed.push(ebook.id);
        db.claimedEbooksByUser[user.id] = claimed;
      }
      ebook.salesCount = (ebook.salesCount ?? 0) + 1;
    }
  } else if (session.referenceType === 'invoice') {
    invoice = db.feeInvoices.find((i) => i.id === session.referenceId);
    if (invoice) {
      invoice.paidAmount += session.amount;
      invoice.dueAmount = Math.max(0, invoice.totalAmount - invoice.paidAmount);
      invoice.status = invoice.dueAmount === 0 ? 'paid' : 'partial';
      invoice.updatedAt = nowIso;
    }
  } else if (session.referenceType === 'order') {
    const items = (metadata.items as Array<{ productId: string; quantity: number }>) ?? [];
    const orderItems = items
      .map((it) => {
        const prod = db.products.find((p) => p.id === it.productId);
        if (!prod) return null;
        prod.stock = Math.max(0, prod.stock - Math.max(1, it.quantity));
        return {
          productId: prod.id,
          title: prod.title,
          quantity: Math.max(1, it.quantity),
          unitPrice: prod.price,
        };
      })
      .filter(Boolean) as Order['items'];
    order = {
      id: `ord-${Date.now().toString().slice(-5)}`,
      userId: user.id,
      customerName: user.name,
      phone: String(metadata.phone || user.phone),
      deliveryAddress: String(metadata.deliveryAddress || 'Branch Pickup'),
      branchPickupId: metadata.branchPickupId ? String(metadata.branchPickupId) : null,
      items: orderItems,
      deliveryFee: metadata.deliveryMode === 'home' ? 80 : 0,
      couponUsed: txn.couponCode,
      paymentMethod: session.gateway as PaymentGatewayType,
      trxId: cleanTrx,
      invoiceNo,
      totalAmount: session.amount,
      status: 'processing',
      createdAt: nowIso,
    };
    db.orders.unshift(order);
  }

  db.financialRecords.unshift({
    id: `fin-${Date.now()}`,
    type: 'income',
    category: 'Verified Gateway Payment',
    title: `${session.gateway} (${invoiceNo}) — ${user.name}`,
    amount: session.amount,
    branchId: session.branchId,
    date: nowIso.slice(0, 10),
    recordedBy: actorLabel,
  });

  recordAuditLog(
    db,
    { id: user.id, name: user.name, role: user.role },
    'PAYMENT_WEBHOOK_VERIFIED',
    invoiceNo,
    `${session.gateway} verified trx=${cleanTrx} amount=৳${session.amount}`
  );
  saveDb(db);

  void dispatchRealCommunication({
    channel: 'in_app',
    recipient: user.email,
    recipientUserId: user.id,
    subject: `Payment Verified: ${invoiceNo}`,
    message: `Your payment of ৳${session.amount.toLocaleString()} via ${session.gateway} (TrxID: ${cleanTrx}) has been verified.`,
    notificationType: 'payment',
    actionUrl: '/portal',
  });

  return { ok: true, transaction: txn, enrollment, invoice, order };
}

export function processSignedWebhookCallback(params: {
  gateway: string;
  rawBody: string;
  signature: string;
  payload: {
    sessionId?: string;
    trxId?: string;
    status?: string;
    amount?: number;
    eventId?: string;
  };
}): { ok: true; result: unknown } | { ok: false; status: number; error: string } {
  const sigValid = verifyWebhookSignature(params.rawBody, params.gateway, params.signature);
  if (!sigValid) {
    return { ok: false, status: 401, error: 'Invalid payment gateway webhook signature.' };
  }

  const sessionId = String(params.payload.sessionId ?? '').trim();
  const trxId = String(params.payload.trxId ?? '').trim();
  const status = String(params.payload.status ?? '').toUpperCase();
  if (!sessionId || !trxId) {
    return { ok: false, status: 400, error: 'sessionId and trxId are required in webhook payload.' };
  }

  const eventKey = params.payload.eventId || `${params.gateway}:${sessionId}:${trxId}:${status}`;
  const isNew = recordWebhookEventIdempotent({
    eventKey,
    gateway: params.gateway,
    signatureValid: true,
    payload: params.payload,
  });
  if (!isNew) {
    return { ok: true, result: { deduplicated: true, message: 'Webhook event already processed.' } };
  }

  const db = getDb();
  const session = db.paymentSessions.find((s) => s.id === sessionId);
  if (!session) return { ok: false, status: 404, error: 'Payment session not found.' };

  if (typeof params.payload.amount === 'number' && Math.abs(params.payload.amount - session.amount) > 0.01) {
    return { ok: false, status: 400, error: 'Webhook amount mismatch against server session.' };
  }

  if (status !== 'SUCCESS' && status !== 'VALID' && status !== 'COMPLETED') {
    session.status = 'failed';
    saveDb(db);
    return { ok: false, status: 400, error: `Gateway reported payment status: ${status}` };
  }

  const finalized = finalizeVerifiedPaymentSession(sessionId, trxId, `${params.gateway} Webhook`);
  if (!finalized.ok) return finalized;
  return { ok: true, result: finalized };
}
