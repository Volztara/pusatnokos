// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const SECRET    = process.env.ADMIN_TOKEN_SECRET ?? process.env.ADMIN_PASSWORD ?? 'fallback-secret';
const TOKEN_TTL = 24 * 60 * 60 * 1000; // 24 jam dalam ms

// ── Rate Limiting ─────────────────────────────────────────────────────
const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT  = 30;
const WINDOW = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + WINDOW });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;

    // Web Crypto API — kompatibel dengan Edge Runtime
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Decode signature dari base64url ke bytes
    const sigBytes = Uint8Array.from(
      atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
    if (!valid) return false;

    const data = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (Date.now() - data.iat > TOKEN_TTL) return false;
    return data.role === 'admin';
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/admin/')) {
    // Rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Terlalu banyak request. Coba lagi dalam 1 menit.' },
        { status: 429 }
      );
    }

    // Auth check
    if (pathname !== '/api/admin/login') {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

      if (!token || !(await verifyToken(token))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*'],
};