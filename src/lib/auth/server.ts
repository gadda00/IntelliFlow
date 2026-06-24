// Auth utilities — JWT + API key validation, password hashing
// Server-side only.

import crypto from 'crypto';
import { db } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'akili-dev-secret-change-in-production-2026';
const API_KEY_PREFIX = 'ifl_';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
}

// ─── Password Hashing (PBKDF2) ─────────────────────────────────────────────
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verify, 'hex'));
}

// ─── JWT (HS256) ───────────────────────────────────────────────────────────
function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - str.length % 4) % 4);
  return Buffer.from(padded, 'base64');
}

export function signToken(user: AuthUser, expiresInSec = 86400): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    plan: user.plan,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest();
  return `${data}.${base64UrlEncode(sig)}`;
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const data = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest();
    const providedSig = base64UrlDecode(sigB64);
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;
    const payload = JSON.parse(base64UrlDecode(payloadB64).toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      plan: payload.plan ?? 'free',
    };
  } catch {
    return null;
  }
}

// ─── API Key Generation & Hashing ──────────────────────────────────────────
export function generateApiKey(): { key: string; keyHash: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const key = `${API_KEY_PREFIX}${raw}`;
  const keyHash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 12);
  return { key, keyHash, prefix };
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ─── Auth Helpers (database-backed) ────────────────────────────────────────
export async function authenticate(email: string, password: string): Promise<AuthUser | null> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;
  return { id: user.id, email: user.email, name: user.name, plan: user.plan };
}

export async function createUser(email: string, password: string, name: string): Promise<AuthUser | null> {
  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return null;
  const user = await db.user.create({
    data: {
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      plan: 'free',
    },
  });
  return { id: user.id, email: user.email, name: user.name, plan: user.plan };
}

export async function upgradeUserPlan(userId: string, plan: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { plan },
  });
  // Upsert subscription
  await db.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      plan,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

export async function verifyApiKey(apiKey: string): Promise<AuthUser | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) return null;
  const keyHash = hashApiKey(apiKey);
  const record = await db.apiKey.findUnique({
    where: { keyHash },
    include: { user: true },
  });
  if (!record) return null;
  await db.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });
  return { id: record.user.id, email: record.user.email, name: record.user.name, plan: record.user.plan };
}

export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  // Try Bearer token
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);

    // 1. Try Supabase Auth first (if configured)
    const { isSupabaseConfigured, getUserFromSupabase } = await import('@/lib/supabase/server');
    if (isSupabaseConfigured()) {
      const supabaseUser = await getUserFromSupabase(token);
      if (supabaseUser) {
        return {
          id: supabaseUser.id,
          email: supabaseUser.email,
          name: supabaseUser.name,
          plan: supabaseUser.plan,
        };
      }
    }

    // 2. Fall back to custom JWT
    const user = verifyToken(token);
    if (user) return user;
  }
  // Try X-API-Key
  const apiKey = req.headers.get('X-API-Key') ?? '';
  if (apiKey) {
    return await verifyApiKey(apiKey);
  }
  return null;
}

// ─── Usage Tracking ────────────────────────────────────────────────────────
export async function getUsageForMonth(userId: string, month?: string): Promise<{ analysesUsed: number; limit: number }> {
  const now = new Date();
  const monthStr = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const record = await db.usageRecord.findUnique({
    where: { userId_month: { userId, month: monthStr } },
  });
  const user = await db.user.findUnique({ where: { id: userId } });
  const plan = user?.plan ?? 'free';
  const { PLANS } = await import('@/lib/flutterwave/server');
  const planDetails = PLANS[plan] ?? PLANS.free;
  return {
    analysesUsed: record?.analysesUsed ?? 0,
    limit: planDetails.analysesPerMonth,
  };
}

export async function incrementUsage(userId: string, agentsInvoked: number): Promise<void> {
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await db.usageRecord.upsert({
    where: { userId_month: { userId, month: monthStr } },
    create: { userId, month: monthStr, analysesUsed: 1, agentsInvoked },
    update: { analysesUsed: { increment: 1 }, agentsInvoked: { increment: agentsInvoked } },
  });
}
