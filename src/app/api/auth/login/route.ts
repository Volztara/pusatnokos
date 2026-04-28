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

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 menit

// ✅ Rate limit per email via Supabase — cross-instance, tidak bisa bypass
async function checkEmailRate(email: string): Promise<{ allowed: boolean; unlockIn?: string }> {
  try {
    const key = `login:${email.toLowerCase().trim()}`;
    const now = Date.now();
    const resetAt = new Date(now + WINDOW_MS).toISOString();

    const { data: existing } = await supabaseAdmin
      .from('rate_limits')
      .select('count, reset_at')
      .eq('key', key)
      .single();

    if (!existing || new Date(existing.reset_at) < new Date()) {
      // Entry tidak ada atau expired — buat baru
      await supabaseAdmin.from('rate_limits').upsert(
        { key, count: 1, reset_at: resetAt },
        { onConflict: 'key' }
      );
      return { allowed: true };
    }

    if (existing.count >= MAX_ATTEMPTS) {
      const sec = Math.ceil((new Date(existing.reset_at).getTime() - now) / 1000);
      return {
        allowed: false,
        unlockIn: sec > 60 ? `${Math.ceil(sec / 60)} menit` : `${sec} detik`,
      };
    }

    // Increment via RPC atomic
    await supabaseAdmin.rpc('increment_rate_limit', {
      p_key: key,
      p_max_count: MAX_ATTEMPTS,
      p_reset_at: existing.reset_at,
    });

    return { allowed: true };
  } catch {
    // Fallback: allow jika Supabase error — jangan block semua user
    return { allowed: true };
  }
}

async function clearEmailRate(email: string) {
  try {
    const key = `login:${email.toLowerCase().trim()}`;
    await supabaseAdmin.from('rate_limits').upsert(
      { key, count: 0, reset_at: new Date(Date.now() + WINDOW_MS).toISOString() },
      { onConflict: 'key' }
    );
  } catch { }
}

async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
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

    // ✅ Rate limit per email via Supabase (cross-instance)
    const rl = await checkEmailRate(email);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${rl.unlockIn}.` },
        { status: 429 }
      );
    }

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Coba lagi.' }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message.includes('Invalid login')
        ? 'Email atau password salah.'
        : error.message.includes('Email not confirmed')
          ? 'Email belum diverifikasi. Cek inbox kamu.'
          : error.message;
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, email, balance, is_blacklisted')
      .eq('id', data.user.id)
      .single();

    if (profile?.is_blacklisted) {
      return NextResponse.json({ error: 'Akun kamu telah diblokir. Hubungi admin.' }, { status: 403 });
    }

    // ✅ Login berhasil — reset rate limit
    await clearEmailRate(email);

    return NextResponse.json({
      success: true,
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
      expires_in: data.session?.expires_in,
      user: {
        id: data.user.id,
        name: profile?.name ?? email.split('@')[0],
        email: profile?.email ?? email,
        balance: profile?.balance ?? 0,
      },
    });

  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}