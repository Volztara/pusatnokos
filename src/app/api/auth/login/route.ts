// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const { email, password, turnstileToken } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    // Verifikasi Turnstile
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Coba lagi.' }, { status: 400 });
    }

    // Login via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const msg = error.message.includes('Invalid login')
        ? 'Email atau password salah.'
        : error.message.includes('Email not confirmed')
          ? 'Email belum diverifikasi. Cek inbox kamu.'
          : error.message;
      return NextResponse.json({ error: msg }, { status: 401 });
    }

    // Ambil profile + cek blacklist
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, email, balance, is_blacklisted')
      .eq('id', data.user.id)
      .single();

    // Tolak login jika user diblokir
    if (profile?.is_blacklisted) {
      return NextResponse.json(
        { error: 'Akun kamu telah diblokir. Hubungi admin untuk informasi lebih lanjut.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id     : data.user.id,
        name   : profile?.name   ?? email.split('@')[0],
        email  : profile?.email  ?? email,
        balance: profile?.balance ?? 0,
      },
    });

  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}