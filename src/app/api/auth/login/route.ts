// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Server-side rate limiting per email (lapisan kedua setelah middleware IP) ──
const emailAttempts = new Map<string, { count: number; firstAt: number }>();
const MAX_ATTEMPTS  = 5;
const WINDOW_MS     = 15 * 60 * 1000; // 15 menit

function checkEmailRate(email: string): { allowed: boolean; unlockIn?: string } {
  const now   = Date.now();
  const key   = email.toLowerCase().trim();
  const entry = emailAttempts.get(key);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    emailAttempts.set(key, { count: 1, firstAt: now });
    return { allowed: true };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    const sec = Math.ceil((WINDOW_MS - (now - entry.firstAt)) / 1000);
    return { allowed: false, unlockIn: sec > 60 ? `${Math.ceil(sec / 60)} menit` : `${sec} detik` };
  }
  entry.count++;
  return { allowed: true };
}

function recordEmailSuccess(email: string) {
  emailAttempts.delete(email.toLowerCase().trim());
}

async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        secret  : process.env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    });
    const data = await res.json();
    return data.success === true;
  } catch { return false; }
}

export async function POST(request: Request) {
  try {
    const { email, password, turnstileToken } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    // ── Rate limit per email (server-side) ──
    const rl = checkEmailRate(email);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${rl.unlockIn}.` },
        { status: 429 }
      );
    }

    // ── Verifikasi Turnstile ──
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Coba lagi.' }, { status: 400 });
    }

    // ── Login via Supabase Auth ──
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Jangan hapus attempt — biarkan counter naik
      const msg = error.message.includes('Invalid login')
        ? 'Email atau password salah.'
        : error.message.includes('Email not confirmed')
          ? 'Email belum diverifikasi. Cek inbox kamu.'
          : error.message;
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    // ── Ambil profile + cek blacklist ──
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, email, balance, is_blacklisted')
      .eq('id', data.user.id)
      .single();

    if (profile?.is_blacklisted) {
      return NextResponse.json(
        { error: 'Akun kamu telah diblokir. Hubungi admin.' },
        { status: 403 }
      );
    }

    // ── Login berhasil: reset rate limit ──
    recordEmailSuccess(email);

    // ── Return access_token agar client bisa autentikasi request berikutnya ──
    return NextResponse.json({
      success: true,
      // access_token dikirim ke client untuk dipakai sebagai Bearer token
      access_token : data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_in   : data.session?.expires_in,
      user: {
        id     : data.user.id,
        name   : profile?.name    ?? email.split('@')[0],
        email  : profile?.email   ?? email,
        balance: profile?.balance ?? 0,
      },
    });

  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}