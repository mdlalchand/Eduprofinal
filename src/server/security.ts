import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import type { UserRole } from '../types';

export const SESSION_COOKIE_NAME = 'edupro_session';

let resolvedSessionSecret: string | null = null;

export function resetResolvedSessionSecretForTests(): void {
  resolvedSessionSecret = null;
}

export function resolveSessionSecret(): string {
  if (resolvedSessionSecret) return resolvedSessionSecret;
  const envSecret = (process.env.SESSION_SECRET ?? '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (envSecret.length >= 32) {
    resolvedSessionSecret = envSecret;
    return resolvedSessionSecret;
  }

  if (isProd && process.env.ALLOW_LOCAL_SESSION_SECRET_FALLBACK !== 'true') {
    throw new Error(
      '[SECURITY] SESSION_SECRET must be configured with at least 32 characters in production.'
    );
  }

  if (envSecret.length > 0) {
    console.warn(
      '[SECURITY] Provided SESSION_SECRET is shorter than 32 characters; ignoring weak secret and generating a 64-char local secret.'
    );
  }

  // Dev/preview persistent local secret so sessions survive dev server restarts cleanly
  const dataDir = process.env.SQLITE_DB_PATH
    ? path.dirname(path.resolve(process.env.SQLITE_DB_PATH))
    : path.resolve(process.cwd(), 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const secretFile = path.join(dataDir, '.session_secret');
  if (fs.existsSync(secretFile)) {
    const fileSecret = fs.readFileSync(secretFile, 'utf8').trim();
    if (fileSecret.length >= 32) {
      resolvedSessionSecret = fileSecret;
      return resolvedSessionSecret;
    }
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(secretFile, generated, { mode: 0o600 });
  console.warn(
    '[SECURITY] SESSION_SECRET not set; using persistent development secret in data/.session_secret. Set SESSION_SECRET (>=32 chars) before deploying to production.'
  );
  resolvedSessionSecret = generated;
  return resolvedSessionSecret;
}

export function isValidRole(role: unknown): role is UserRole {
  return (
    role === 'admin' ||
    role === 'teacher' ||
    role === 'student' ||
    role === 'guardian' ||
    role === 'branch'
  );
}

export function isStrongPassword(password: string, minLength = 8): boolean {
  if (typeof password !== 'string' || password.length < minLength) return false;
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function isValidBangladeshPhone(phone: string): boolean {
  const clean = phone.replace(/[\s-]/g, '').trim();
  return /^(\+?88)?01[3-9]\d{8}$/.test(clean) || /^096\d{8}$/.test(clean);
}

export interface SignedTokenPayload {
  userId: string;
  role: UserRole;
  jti: string;
  exp: number;
}

export function signSessionToken(userId: string, role: UserRole, ttlMs = 1000 * 60 * 60 * 24 * 7): string {
  const payload: SignedTokenPayload = {
    userId,
    role,
    jti: crypto.randomBytes(12).toString('hex'),
    exp: Date.now() + ttlMs,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', resolveSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySignedSessionToken(token: string): SignedTokenPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac('sha256', resolveSessionSecret())
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedTokenPayload;
    if (!parsed.userId || !isValidRole(parsed.role) || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function extractAuthTokenFromRequest(req: Request): {
  token: string | null;
  source: 'bearer' | 'cookie' | null;
} {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    if (token) return { token, source: 'bearer' };
  }
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken) {
    return { token: cookieToken, source: 'cookie' };
  }
  return { token: null, source: null };
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] ?? '').toLowerCase();
  return proto.includes('https');
}

export function setAuthSessionCookie(req: Request, res: Response, token: string): void {
  const maxAgeSeconds = 60 * 60 * 24 * 7;
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSeconds}`,
    'HttpOnly',
  ];
  if (isHttpsRequest(req)) {
    attrs.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function clearAuthSessionCookie(req: Request, res: Response): void {
  const attrs = [`${SESSION_COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly'];
  if (isHttpsRequest(req)) {
    attrs.push('SameSite=None', 'Secure', 'Partitioned');
  } else {
    attrs.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', attrs.join('; '));
}

export function getClientIp(req: Request): string {
  const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim();
  return fwd || req.ip || req.socket.remoteAddress || 'unknown';
}

// ---------------- RFC 6238 TOTP TWO-FACTOR AUTHENTICATION ----------------

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function buildTotpUri(secret: string, email: string, issuer = 'EDUPro Admin'): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function computeTotpCode(secret: string, timeMs = Date.now(), stepOffset = 0): string {
  const counter = Math.floor(timeMs / 1000 / 30) + stepOffset;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, code: string, timeMs = Date.now()): boolean {
  const clean = String(code ?? '').replace(/\s+/g, '').trim();
  if (!/^\d{6}$/.test(clean)) return false;
  for (const offset of [-1, 0, 1]) {
    const expected = computeTotpCode(secret, timeMs, offset);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function generateRecoveryCodes(count = 6): { plainCodes: string[]; hashes: string[] } {
  const plainCodes: string[] = [];
  const hashes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const code = `${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto
      .randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    plainCodes.push(code);
    hashes.push(crypto.createHash('sha256').update(code).digest('hex'));
  }
  return { plainCodes, hashes };
}
