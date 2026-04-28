// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SECRET = process.env.ADMIN_TOKEN_SECRET ?? process.env.ADMIN_PASSWORD ?? 'fallback-secret';
const TOKEN_TTL = 24 * 60 * 60 * 1000;
const WEBHOOK_SECRET = process.env.HEROSMS_WEBHOOK_SECRET ?? '';

// ── Rate Limiting Store ───────────────────────────────────────────────
const rateStore = new Map<string, { count: number; resetAt: number }>();

function checkRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

// ✅ Dual rate limit — per IP + per user
function checkRateDual(
  ip: string,
  userId: string,
  ipLimit: number,
  userLimit: number,
  windowMs: number
): { allowed: boolean; reason?: string } {
  if (!checkRate(`ip:${ip}`, ipLimit, windowMs)) {
    return { allowed: false, reason: 'Terlalu banyak request dari jaringan ini.' };
  }
  if (!checkRate(`user:${userId}`, userLimit, windowMs)) {
    return { allowed: false, reason: 'Terlalu banyak request. Tunggu sebentar.' };
  }
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateStore.entries()) {
    if (now > val.resetAt) rateStore.delete(key);
  }
}, 5 * 60 * 1000);

// ── Admin JWT Verifier ────────────────────────────────────────────────
async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
    if (!valid) return false;
    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (Date.now() - data.iat > TOKEN_TTL) return false;
    return data.role === 'admin';
  } catch { return false; }
}

// ── Supabase JWT Verifier ─────────────────────────────────────────────
async function getUserFromToken(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  } catch { return null; }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  // ══ 1. ADMIN ROUTES ══════════════════════════════════════════════════
  if (pathname.startsWith('/api/admin/')) {
    if (!checkRate(`admin:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Terlalu banyak request.' }, { status: 429 });
    }
    if (pathname !== '/api/admin/login') {
      const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
      if (!token || !(await verifyAdminToken(token))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // ══ 2. AUTH ROUTES ═══════════════════════════════════════════════════
  if (pathname === '/api/auth/login' || pathname === '/api/auth/register') {
    if (!checkRate(`auth:${ip}`, 10, 15 * 60_000)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  // ══ 3. ORDER ROUTES ══════════════════════════════════════════════════
  if (
    pathname === '/api/order' ||
    pathname === '/api/order-v2' ||
    pathname === '/api/reactivation'
  ) {
    if (req.method === 'GET') {
      if (!checkRate(`order-get:${ip}`, 30, 60_000)) {
        return NextResponse.json({ error: 'Terlalu banyak request.' }, { status: 429 });
      }
      return NextResponse.next();
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const userInfo = await getUserFromToken(token);
    if (!userInfo) {
      return NextResponse.json({ error: 'Sesi habis. Silakan login ulang.' }, { status: 401 });
    }

    const rateCheck = checkRateDual(ip, userInfo.id, 15, 5, 60_000);
    if (!rateCheck.allowed) {
      console.warn(`[middleware] Order rate limit — user: ${userInfo.email}, ip: ${ip}`);
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-Verified-User-Id', userInfo.id);
    requestHeaders.set('X-Verified-User-Email', userInfo.email);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ══ 4. DEPOSIT ROUTES ════════════════════════════════════════════════
  // ✅ FIX: deposit routes sebelumnya tidak ada di middleware sama sekali!
  // Webhook deposit (Paymenku & Oxapay) — tidak butuh auth user, cukup rate limit
  if (
    pathname === '/api/deposit/paymenku/webhook' ||
    pathname === '/api/deposit/crypto/webhook'
  ) {
    // Rate limit webhook deposit — max 50/menit per IP
    if (!checkRate(`deposit-webhook:${ip}`, 50, 60_000)) {
      return new Response('Too Many Requests', { status: 429 });
    }
    // Signature verification dilakukan di dalam route handler masing-masing
    return NextResponse.next();
  }

  // Deposit create (Paymenku & Crypto) — butuh auth user
  if (
    pathname === '/api/deposit/paymenku/create' ||
    pathname === '/api/deposit/crypto'
  ) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const userInfo = await getUserFromToken(token);
    if (!userInfo) {
      return NextResponse.json({ error: 'Sesi habis. Silakan login ulang.' }, { status: 401 });
    }

    // ✅ Rate limit deposit: max 5 deposit per user per 10 menit
    const rateCheck = checkRateDual(ip, userInfo.id, 20, 5, 10 * 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-Verified-User-Id', userInfo.id);
    requestHeaders.set('X-Verified-User-Email', userInfo.email);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ══ 5. WEBHOOK ROUTES (HeroSMS) ═══════════════════════════════════════
  if (pathname.startsWith('/api/webhook')) {
    if (!checkRate(`webhook:${ip}`, 100, 60_000)) {
      return new Response('Too Many Requests', { status: 429 });
    }
    if (WEBHOOK_SECRET) {
      const { searchParams } = req.nextUrl;
      const secretParam = searchParams.get('secret') ?? '';
      const secretHeader = req.headers.get('x-webhook-secret') ?? '';
      if (secretParam !== WEBHOOK_SECRET && secretHeader !== WEBHOOK_SECRET) {
        console.warn(`[middleware] Webhook unauthorized from IP: ${ip}`);
        return new Response('OK', { status: 200 });
      }
    }
    return NextResponse.next();
  }

  // ══ 6. USER API ROUTES ═══════════════════════════════════════════════
  if (pathname.startsWith('/api/user/') || pathname === '/api/auth/check-blacklist') {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const userInfo = await getUserFromToken(token);
    if (!userInfo) {
      return NextResponse.json({ error: 'Sesi habis. Silakan login ulang.' }, { status: 401 });
    }

    const rateCheck = checkRateDual(ip, userInfo.id, 60, 120, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('X-Verified-User-Id', userInfo.id);
    requestHeaders.set('X-Verified-User-Email', userInfo.email);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ══ 7. Public API — tambah rate limit basic ═════════════════════════
  if (
    pathname === '/api/services' ||
    pathname === '/api/countries-rank'
  ) {
    if (!checkRate(`public:${ip}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Terlalu banyak request.' }, { status: 429 });
    }
    return NextResponse.next();
  }

  // ══ 8. Semua route lain ═══════════════════════════════════════════════
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/check-blacklist',
    '/api/user/:path*',
    '/api/order',
    '/api/order-v2',
    '/api/reactivation',
    '/api/webhook',
    '/api/webhook/:path*',
    // ✅ FIX: deposit routes ditambahkan
    '/api/deposit/paymenku/create',
    '/api/deposit/paymenku/webhook',
    '/api/deposit/crypto',
    '/api/deposit/crypto/webhook',
    '/api/services',
    '/api/countries-rank',
  ],
};