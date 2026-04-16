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

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email dan password wajib diisi.' }, { status: 400 });
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

    // Ambil profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('name, email, balance')
      .eq('id', data.user.id)
      .single();

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