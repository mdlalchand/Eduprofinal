import fs from 'node:fs';
import type { IntegrationConfig } from '../types';
import { getDecryptedIntegrationSecrets } from '../db/persistence';

export type PgSslConfig = false | { rejectUnauthorized: boolean; ca?: string };

export function isEnvSet(name: string): boolean {
  const val = process.env[name];
  return typeof val === 'string' && val.trim().length > 0;
}

export function firstEnvValue(names: string[]): string {
  for (const name of names) {
    const val = process.env[name];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

export function redactDatabaseUrl(input: string): string {
  if (!input) return '';
  return input.replace(
    /(postgres(?:ql)?:\/\/)([^:@/\s]+):([^@/\s]+)@/gi,
    '$1***:***@'
  );
}

export function parsePgSslConfig(
  pgSslRaw = process.env.PGSSL,
  databaseUrl = process.env.DATABASE_URL
): PgSslConfig {
  const normalized = (pgSslRaw ?? '').trim().toLowerCase();

  if (
    normalized === 'false' ||
    normalized === 'disable' ||
    normalized === '0' ||
    normalized === 'off' ||
    normalized === 'no'
  ) {
    return false;
  }

  if (
    normalized === 'verify-full' ||
    normalized === 'verify-ca' ||
    normalized === 'strict'
  ) {
    const caPath = (process.env.PGSSLROOTCERT ?? '').trim();
    const ca = caPath && fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : undefined;
    return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true };
  }

  if (
    normalized === 'true' ||
    normalized === 'require' ||
    normalized === '1' ||
    normalized === 'on' ||
    normalized === 'yes' ||
    normalized === 'no-verify' ||
    normalized === 'allow'
  ) {
    return { rejectUnauthorized: false };
  }

  // Fallback: inspect sslmode query parameter inside DATABASE_URL if PGSSL is unset
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      const sslMode = (parsed.searchParams.get('sslmode') ?? '').trim().toLowerCase();
      if (sslMode === 'disable') return false;
      if (sslMode === 'verify-full' || sslMode === 'verify-ca') {
        return { rejectUnauthorized: true };
      }
      if (sslMode === 'require' || sslMode === 'no-verify' || sslMode === 'prefer') {
        return { rejectUnauthorized: false };
      }
      const host = parsed.hostname.toLowerCase();
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        return false;
      }
      return { rejectUnauthorized: false };
    } catch {
      return false;
    }
  }

  return false;
}

export function describePgSslMode(
  pgSslRaw = process.env.PGSSL,
  databaseUrl = process.env.DATABASE_URL
): string {
  const cfg = parsePgSslConfig(pgSslRaw, databaseUrl);
  if (cfg === false) return 'disabled';
  return cfg.rejectUnauthorized ? 'enabled (verify-full)' : 'enabled (require / no-verify)';
}

export function isSmtpConfigured(integrations: IntegrationConfig[] = []): boolean {
  const cfg = integrations.find((i) => i.key === 'smtp_email');
  const secrets = getDecryptedIntegrationSecrets('smtp_email');
  const host = cfg?.publicConfig?.host || firstEnvValue(['SMTP_HOST']);
  const user = secrets.username || firstEnvValue(['SMTP_USER']);
  const pass = secrets.password || firstEnvValue(['SMTP_PASS']);
  return Boolean(host && user && pass);
}

export function isSmsGatewayConfigured(integrations: IntegrationConfig[] = []): boolean {
  const cfg = integrations.find((i) => i.key === 'bulksms_bd');
  const secrets = getDecryptedIntegrationSecrets('bulksms_bd');
  const apiKey = secrets.apiKey || firstEnvValue(['BULKSMSBD_API_KEY', 'BULKSMS_API_KEY']);
  const senderId =
    cfg?.publicConfig?.senderId || firstEnvValue(['BULKSMSBD_SENDER_ID', 'BULKSMS_SENDER_ID']);
  return Boolean(apiKey && senderId);
}

export function isWhatsappConfigured(integrations: IntegrationConfig[] = []): boolean {
  const cfg = integrations.find((i) => i.key === 'whatsapp_cloud');
  const secrets = getDecryptedIntegrationSecrets('whatsapp_cloud');
  const token = secrets.accessToken || firstEnvValue(['WHATSAPP_ACCESS_TOKEN']);
  const phoneId =
    cfg?.publicConfig?.phoneNumberId || firstEnvValue(['WHATSAPP_PHONE_NUMBER_ID']);
  return Boolean(token && phoneId);
}

export function isPaymentGatewayConfigured(
  gatewayCode: string,
  integrations: IntegrationConfig[] = []
): boolean {
  const lower = gatewayCode.trim().toLowerCase();
  // Offline/manual slip gateways require admin review rather than API merchant keys
  if (lower.includes('manual') || lower.includes('cash')) {
    return true;
  }

  if (lower.includes('bkash')) {
    const secrets = getDecryptedIntegrationSecrets('bkash');
    const appKey = secrets.appKey || firstEnvValue(['BKASH_APP_KEY']);
    const appSecret = secrets.appSecret || firstEnvValue(['BKASH_APP_SECRET']);
    return Boolean(appKey && appSecret);
  }

  if (lower.includes('nagad')) {
    const cfg = integrations.find((i) => i.key === 'nagad');
    const secrets = getDecryptedIntegrationSecrets('nagad');
    const merchantId = cfg?.publicConfig?.merchantId || firstEnvValue(['NAGAD_MERCHANT_ID']);
    const privateKey = secrets.privateKey || firstEnvValue(['NAGAD_PRIVATE_KEY']);
    return Boolean(merchantId && privateKey);
  }

  if (lower.includes('rocket')) {
    const secrets = getDecryptedIntegrationSecrets('rocket');
    const merchantId = secrets.merchantId || firstEnvValue(['ROCKET_MERCHANT_ID']);
    const apiKey = secrets.apiKey || firstEnvValue(['ROCKET_API_KEY']);
    return Boolean(merchantId && apiKey);
  }

  if (lower.includes('ssl')) {
    const cfg = integrations.find((i) => i.key === 'sslcommerz');
    const secrets = getDecryptedIntegrationSecrets('sslcommerz');
    const storeId = cfg?.publicConfig?.storeId || firstEnvValue(['SSLCOMMERZ_STORE_ID']);
    const storePass = secrets.storePassword || firstEnvValue(['SSLCOMMERZ_STORE_PASSWD']);
    return Boolean(storeId && storePass);
  }

  return false;
}

export interface SafeEnvVarCheckItem {
  key: string;
  category: 'Database' | 'Security & Admin' | 'Gmail SMTP' | 'Payment Gateways' | 'SMS & Messaging' | 'AI';
  required: boolean;
  configured: boolean;
  note: string;
}

export interface SafeEnvValidationReport {
  items: SafeEnvVarCheckItem[];
  missingRequired: string[];
  missingOptional: string[];
  totalConfigured: number;
  totalChecked: number;
  activeDatabaseEngine: 'postgresql' | 'sqlite';
  pgSslMode: string;
  integrationsStatus: {
    smtp: boolean;
    sms: boolean;
    whatsapp: boolean;
    bkash: boolean;
    nagad: boolean;
    rocket: boolean;
    sslcommerz: boolean;
  };
}

export function getSafeEnvironmentValidationReport(
  integrations: IntegrationConfig[] = []
): SafeEnvValidationReport {
  const isPg =
    isEnvSet('DATABASE_URL') && (process.env.DB_DRIVER ?? '').trim().toLowerCase() !== 'sqlite';

  const specs: Array<{
    key: string;
    altKeys?: string[];
    category: SafeEnvVarCheckItem['category'];
    required: boolean;
    note: string;
  }> = [
    {
      key: 'DATABASE_URL',
      category: 'Database',
      required: true,
      note: 'PostgreSQL connection URI (e.g. postgresql://user:pass@host:5432/edupro)',
    },
    {
      key: 'PGSSL',
      category: 'Database',
      required: false,
      note: 'PostgreSQL SSL mode: false | disable | require | verify-full',
    },
    {
      key: 'SESSION_SECRET',
      category: 'Security & Admin',
      required: true,
      note: 'Persistent secret (>= 32 chars) for session HMAC signing & AES-256-GCM integration storage',
    },
    {
      key: 'ADMIN_EMAIL',
      category: 'Security & Admin',
      required: true,
      note: 'Single Main Admin bootstrap email address',
    },
    {
      key: 'ADMIN_PASSWORD',
      category: 'Security & Admin',
      required: true,
      note: 'Single Main Admin bootstrap password (>= 10 chars, letters + numbers)',
    },
    {
      key: 'ADMIN_NAME',
      category: 'Security & Admin',
      required: false,
      note: 'Display name for the single Main Admin account',
    },
    {
      key: 'ADMIN_PHONE',
      category: 'Security & Admin',
      required: false,
      note: 'Contact phone number for the single Main Admin account',
    },
    {
      key: 'SMTP_HOST',
      category: 'Gmail SMTP',
      required: true,
      note: 'Gmail SMTP host (smtp.gmail.com)',
    },
    {
      key: 'SMTP_PORT',
      category: 'Gmail SMTP',
      required: true,
      note: 'SMTP port (587 for STARTTLS or 465 for SSL)',
    },
    {
      key: 'SMTP_USER',
      category: 'Gmail SMTP',
      required: true,
      note: 'Gmail SMTP account address',
    },
    {
      key: 'SMTP_PASS',
      category: 'Gmail SMTP',
      required: true,
      note: 'Gmail App Password (server-side only)',
    },
    {
      key: 'SMTP_FROM',
      category: 'Gmail SMTP',
      required: true,
      note: 'Sender header (e.g. "Aloms English Center <no-reply@...>")',
    },
    {
      key: 'PAYMENT_WEBHOOK_SECRET',
      category: 'Payment Gateways',
      required: false,
      note: 'Shared HMAC-SHA256 verification secret for payment webhooks',
    },
    {
      key: 'BKASH_APP_KEY',
      category: 'Payment Gateways',
      required: false,
      note: 'bKash Tokenized Checkout App Key (disabled gracefully if missing)',
    },
    {
      key: 'BKASH_APP_SECRET',
      category: 'Payment Gateways',
      required: false,
      note: 'bKash Tokenized Checkout App Secret',
    },
    {
      key: 'NAGAD_MERCHANT_ID',
      category: 'Payment Gateways',
      required: false,
      note: 'Nagad Merchant ID (disabled gracefully if missing)',
    },
    {
      key: 'NAGAD_PRIVATE_KEY',
      category: 'Payment Gateways',
      required: false,
      note: 'Nagad Merchant RSA Private Key',
    },
    {
      key: 'SSLCOMMERZ_STORE_ID',
      category: 'Payment Gateways',
      required: false,
      note: 'SSLCommerz Store ID (disabled gracefully if missing)',
    },
    {
      key: 'SSLCOMMERZ_STORE_PASSWD',
      category: 'Payment Gateways',
      required: false,
      note: 'SSLCommerz Store Password',
    },
    {
      key: 'BULKSMSBD_API_KEY',
      altKeys: ['BULKSMS_API_KEY'],
      category: 'SMS & Messaging',
      required: false,
      note: 'BulkSMSBD API Key (SMS disabled gracefully if missing)',
    },
    {
      key: 'BULKSMSBD_SENDER_ID',
      altKeys: ['BULKSMS_SENDER_ID'],
      category: 'SMS & Messaging',
      required: false,
      note: 'BulkSMSBD Approved Sender ID',
    },
    {
      key: 'WHATSAPP_PHONE_NUMBER_ID',
      category: 'SMS & Messaging',
      required: false,
      note: 'WhatsApp Business Cloud Phone Number ID',
    },
    {
      key: 'WHATSAPP_ACCESS_TOKEN',
      category: 'SMS & Messaging',
      required: false,
      note: 'WhatsApp Business Cloud API Access Token',
    },
    {
      key: 'GEMINI_API_KEY',
      category: 'AI',
      required: false,
      note: 'Server-side Gemini API key for AI Tutor & question generation',
    },
  ];

  // Never include actual env values in the report — booleans & variable names only
  const items: SafeEnvVarCheckItem[] = specs.map((s) => {
    const keys = [s.key, ...(s.altKeys ?? [])];
    const configured = keys.some((k) => isEnvSet(k));
    return {
      key: s.key,
      category: s.category,
      required: s.required,
      configured,
      note: s.note,
    };
  });

  const missingRequired = items.filter((i) => i.required && !i.configured).map((i) => i.key);
  const missingOptional = items.filter((i) => !i.required && !i.configured).map((i) => i.key);
  const totalConfigured = items.filter((i) => i.configured).length;

  return {
    items,
    missingRequired,
    missingOptional,
    totalConfigured,
    totalChecked: items.length,
    activeDatabaseEngine: isPg ? 'postgresql' : 'sqlite',
    pgSslMode: isEnvSet('DATABASE_URL') ? describePgSslMode() : 'not configured',
    integrationsStatus: {
      smtp: isSmtpConfigured(integrations),
      sms: isSmsGatewayConfigured(integrations),
      whatsapp: isWhatsappConfigured(integrations),
      bkash: isPaymentGatewayConfigured('bKash', integrations),
      nagad: isPaymentGatewayConfigured('Nagad', integrations),
      rocket: isPaymentGatewayConfigured('Rocket', integrations),
      sslcommerz: isPaymentGatewayConfigured('SSLCommerz Card', integrations),
    },
  };
}
