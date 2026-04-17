// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server';

const SECRET     = process.env.ADMIN_TOKEN_SECRET ?? process.env.ADMIN_PASSWORD ?? 'fallback-secret';
const TOKEN_TTL  = 24 * 60 * 60 * 1000; // 24 jam ms

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;
const MAX_ATTEMPTS = 5;
const WINDOW_SEC   = 15 * 60;

async function redisCmd(...args: (string | number)[]) {
  const res = await fetch(`${REDIS_URL}/${args.join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

// Encode ke base64url tanpa padding
function toBase64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Buat token pakai Web Crypto HMAC-SHA256
async function createToken(): Promise<string> {
  const payload = btoa(JSON.stringify({
    role: 'admin',
    iat : Date.now(),
    jti : toBase64url(crypto.getRandomValues(new Uint8Array(16)).buffer),
  })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${toBase64url(sig)}`;
}

// Verifikasi token pakai Web Crypto HMAC-SHA256
async function verifyToken(token: string): Promise<boolean> {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
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

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // ── Mode verifikasi token (dari refresh halaman) ──────────────
    if (body.token) {
      const valid = await verifyToken(body.token);
      return NextResponse.json({ success: valid });
    }

    // ── Mode login biasa ──────────────────────────────────────────
    const { username, password } = body;
    const ip  = req.headers.get('x-forwarded-for') ?? 'unknown';
    const key = `admin_login:${ip}`;

    const { result: attempts } = await redisCmd('GET', key);
    const count = parseInt(attempts ?? '0');

    if (count >= MAX_ATTEMPTS) {
      const { result: ttl } = await redisCmd('TTL', key);
      const menit = Math.ceil((ttl ?? WINDOW_SEC) / 60);
      return NextResponse.json(
        { success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.` },
        { status: 429 }
      );
    }

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const usernameOk = username === process.env.ADMIN_USERNAME;
    const passwordOk = password === process.env.ADMIN_PASSWORD;

    if (!usernameOk || !passwordOk) {
      await redisCmd('INCR', key);
      if (count === 0) await redisCmd('EXPIRE', key, WINDOW_SEC);
      const sisa = MAX_ATTEMPTS - (count + 1);
      return NextResponse.json(
        { success: false, message: `Username atau password salah. Sisa percobaan: ${sisa}` },
        { status: 401 }
      );
    }

    await redisCmd('DEL', key);
    const token = await createToken();
    return NextResponse.json({ success: true, token });

  } catch {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}