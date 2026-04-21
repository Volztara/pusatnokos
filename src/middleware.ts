// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SECRET    = process.env.ADMIN_TOKEN_SECRET ?? process.env.ADMIN_PASSWORD ?? 'fallback-secret';
const TOKEN_TTL = 24 * 60 * 60 * 1000;

// ── Rate Limiting Store ───────────────────────────────────────────────
const rateStore = new Map<string, { count: number; resetAt: number }>();

function checkRate(key: string, limit: number, windowMs: number): boolean {
  const now   = Date.now();
  const entry = rateStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
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

  // ══ 3. USER API ROUTES ═══════════════════════════════════════════════
  if (pathname.startsWith('/api/user/') || pathname === '/api/auth/check-blacklist') {
    if (!checkRate(`user:${ip}`, 60, 60_000)) {
      return NextResponse.json({ error: 'Terlalu banyak request.' }, { status: 429 });
    }

    const requestHeaders = new Headers(req.headers);

    // ── Prioritas 1: Bearer token (Supabase JWT) ──────────────────────
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (token) {
      const userInfo = await getUserFromToken(token);
      if (userInfo) {
        // Token valid — inject email ke header
        requestHeaders.set('X-Verified-User-Id',    userInfo.id);
        requestHeaders.set('X-Verified-User-Email', userInfo.email);
        return NextResponse.next({ request: { headers: requestHeaders } });
      }
      // ⚠️ Token ada tapi expired/invalid — JANGAN langsung 401
      // Coba fallback ke X-User-Email dulu
      console.warn(`[middleware] Bearer token invalid/expired for ${pathname}, trying X-User-Email fallback`);
    }

    // ── Prioritas 2: X-User-Email header (fallback) ───────────────────
    // Dipakai saat token expired tapi email masih tersimpan di session
    const emailHeader = req.headers.get('X-User-Email')?.trim().toLowerCase();
    if (emailHeader && emailHeader.includes('@')) {
      requestHeaders.set('X-Verified-User-Email', emailHeader);
      return NextResponse.next({ request: { headers: requestHeaders } });
    }

    // ── Tidak ada autentikasi sama sekali ─────────────────────────────
    return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
  }

  // ══ 4. Semua route lain ═══════════════════════════════════════════════
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/admin/:path*',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/check-blacklist',
    '/api/user/:path*',
  ],
};