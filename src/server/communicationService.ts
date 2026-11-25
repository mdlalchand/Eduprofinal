import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { getDecryptedIntegrationSecrets } from '../db/persistence';
import type { CommunicationLogEntry, InAppNotification, IntegrationConfig } from '../types';
import { getDb, saveDb } from './store';

function getIntegrationRecord(key: string): IntegrationConfig | undefined {
  return getDb().integrations.find((i) => i.key === key);
}

export async function dispatchRealCommunication(params: {
  channel: 'email' | 'sms' | 'whatsapp' | 'push' | 'in_app';
  recipient: string;
  recipientUserId?: string;
  subject?: string;
  message: string;
  notificationType?: InAppNotification['type'];
  actionUrl?: string;
}): Promise<CommunicationLogEntry> {
  const db = getDb();
  const now = new Date().toISOString();

  // Check user opt-out / consent preferences
  if (params.recipientUserId && params.channel !== 'in_app') {
    const targetUser = db.users.find((u) => u.id === params.recipientUserId);
    const consent = targetUser?.communicationConsent ?? { email: true, sms: true, whatsapp: true };
    if (
      (params.channel === 'email' && consent.email === false) ||
      (params.channel === 'sms' && consent.sms === false) ||
      (params.channel === 'whatsapp' && consent.whatsapp === false)
    ) {
      const skipped: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: params.channel,
        provider: 'Consent Filter',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: 'skipped_opt_out',
        errorMessage: 'Recipient opted out of this notification channel.',
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      };
      db.communicationLogs.unshift(skipped);
      saveDb(db);
      return skipped;
    }
  }

  if (params.channel === 'in_app' && params.recipientUserId) {
    const notif: InAppNotification = {
      id: `notif-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      userId: params.recipientUserId,
      title: params.subject || 'Platform Notification',
      message: params.message,
      type: params.notificationType || 'info',
      read: false,
      actionUrl: params.actionUrl,
      createdAt: now,
    };
    db.inAppNotifications.unshift(notif);
    const log: CommunicationLogEntry = {
      id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      channel: 'in_app',
      provider: 'EDUPro In-App Inbox',
      recipient: params.recipient,
      recipientUserId: params.recipientUserId,
      subject: params.subject,
      bodyPreview: params.message.slice(0, 140),
      status: 'delivered',
      providerMessageId: notif.id,
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    };
    db.communicationLogs.unshift(log);
    saveDb(db);
    return log;
  }

  if (params.channel === 'email') {
    const cfg = getIntegrationRecord('smtp_email');
    const secrets = getDecryptedIntegrationSecrets('smtp_email');
    const host = cfg?.publicConfig?.host || process.env.SMTP_HOST || '';
    const port = Number(cfg?.publicConfig?.port || process.env.SMTP_PORT || '587');
    const user = secrets.username || process.env.SMTP_USER || '';
    const pass = secrets.password || process.env.SMTP_PASS || '';
    const fromEmail = cfg?.publicConfig?.fromEmail || process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      const failed: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: 'email',
        provider: 'SMTP / Nodemailer',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: 'failed',
        errorMessage: 'SMTP gateway awaiting configuration (SMTP_HOST / SMTP_USER / SMTP_PASS missing).',
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      };
      db.communicationLogs.unshift(failed);
      saveDb(db);
      return failed;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
      const info = await transporter.sendMail({
        from: fromEmail,
        to: params.recipient,
        subject: params.subject || 'Aloms English Center Notice',
        text: params.message,
      });
      const delivered: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: 'email',
        provider: 'SMTP / Nodemailer',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: 'accepted',
        providerMessageId: info.messageId,
        attempts: 1,
        createdAt: now,
        updatedAt: new Date().toISOString(),
      };
      db.communicationLogs.unshift(delivered);
      saveDb(db);
      return delivered;
    } catch (err) {
      const failed: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: 'email',
        provider: 'SMTP / Nodemailer',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'SMTP delivery failed',
        attempts: 1,
        createdAt: now,
        updatedAt: new Date().toISOString(),
      };
      db.communicationLogs.unshift(failed);
      saveDb(db);
      return failed;
    }
  }

  if (params.channel === 'sms') {
    const cfg = getIntegrationRecord('bulksms_bd');
    const secrets = getDecryptedIntegrationSecrets('bulksms_bd');
    const apiKey = secrets.apiKey || process.env.BULKSMS_API_KEY || '';
    const senderId = cfg?.publicConfig?.senderId || process.env.BULKSMS_SENDER_ID || '';
    const endpoint = cfg?.publicConfig?.endpoint || 'https://bulksmsbd.net/api/smsapi';

    if (!apiKey || !senderId) {
      const failed: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: 'sms',
        provider: 'BulkSMS BD',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: 'failed',
        errorMessage: 'SMS gateway awaiting configuration (API Key / Sender ID missing).',
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      };
      db.communicationLogs.unshift(failed);
      saveDb(db);
      return failed;
    }

    try {
      const url = new URL(endpoint);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('type', 'text');
      url.searchParams.set('number', params.recipient);
      url.searchParams.set('senderid', senderId);
      url.searchParams.set('message', params.message);
      const resp = await fetch(url.toString(), { method: 'POST' });
      const bodyText = await resp.text();
      const ok = resp.ok && !bodyText.toLowerCase().includes('error');
      const entry: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: 'sms',
        provider: 'BulkSMS BD',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: ok ? 'accepted' : 'failed',
        providerMessageId: ok ? `sms-${Date.now()}` : undefined,
        errorMessage: ok ? undefined : bodyText.slice(0, 200),
        attempts: 1,
        createdAt: now,
        updatedAt: new Date().toISOString(),
      };
      db.communicationLogs.unshift(entry);
      saveDb(db);
      return entry;
    } catch (err) {
      const failed: CommunicationLogEntry = {
        id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        channel: 'sms',
        provider: 'BulkSMS BD',
        recipient: params.recipient,
        recipientUserId: params.recipientUserId,
        subject: params.subject,
        bodyPreview: params.message.slice(0, 140),
        status: 'failed',
        errorMessage: err instanceof Error ? err.message : 'SMS request error',
        attempts: 1,
        createdAt: now,
        updatedAt: new Date().toISOString(),
      };
      db.communicationLogs.unshift(failed);
      saveDb(db);
      return failed;
    }
  }

  // WhatsApp Business Cloud API
  const cfg = getIntegrationRecord('whatsapp_cloud');
  const secrets = getDecryptedIntegrationSecrets('whatsapp_cloud');
  const accessToken = secrets.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId = cfg?.publicConfig?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';

  if (!accessToken || !phoneNumberId) {
    const failed: CommunicationLogEntry = {
      id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      channel: params.channel,
      provider: params.channel === 'whatsapp' ? 'WhatsApp Cloud API' : 'Push Gateway',
      recipient: params.recipient,
      recipientUserId: params.recipientUserId,
      subject: params.subject,
      bodyPreview: params.message.slice(0, 140),
      status: 'failed',
      errorMessage: 'Provider credentials awaiting configuration in Central Integration Manager.',
      attempts: 1,
      createdAt: now,
      updatedAt: now,
    };
    db.communicationLogs.unshift(failed);
    saveDb(db);
    return failed;
  }

  try {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: params.recipient.replace(/[^\d]/g, ''),
        type: 'text',
        text: { body: params.message },
      }),
    });
    const data = (await resp.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    const ok = resp.ok && Boolean(data.messages?.[0]?.id);
    const entry: CommunicationLogEntry = {
      id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      channel: 'whatsapp',
      provider: 'WhatsApp Cloud API',
      recipient: params.recipient,
      recipientUserId: params.recipientUserId,
      subject: params.subject,
      bodyPreview: params.message.slice(0, 140),
      status: ok ? 'accepted' : 'failed',
      providerMessageId: data.messages?.[0]?.id,
      errorMessage: ok ? undefined : data.error?.message || `HTTP ${resp.status}`,
      attempts: 1,
      createdAt: now,
      updatedAt: new Date().toISOString(),
    };
    db.communicationLogs.unshift(entry);
    saveDb(db);
    return entry;
  } catch (err) {
    const failed: CommunicationLogEntry = {
      id: `comm-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
      channel: 'whatsapp',
      provider: 'WhatsApp Cloud API',
      recipient: params.recipient,
      recipientUserId: params.recipientUserId,
      subject: params.subject,
      bodyPreview: params.message.slice(0, 140),
      status: 'failed',
      errorMessage: err instanceof Error ? err.message : 'WhatsApp delivery error',
      attempts: 1,
      createdAt: now,
      updatedAt: new Date().toISOString(),
    };
    db.communicationLogs.unshift(failed);
    saveDb(db);
    return failed;
  }
}
