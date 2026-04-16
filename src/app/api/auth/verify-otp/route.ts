// src/app/api/auth/verify-otp/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

declare global { var _otpStore: Map<string, any> | undefined; }
const otpStore: Map<string, any> = globalThis._otpStore ?? (globalThis._otpStore = new Map());

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email dan kode wajib diisi.' }, { status: 400 });
    }

    const stored = otpStore.get(email);

    if (!stored)                        return NextResponse.json({ error: 'Kode tidak ditemukan. Minta kode baru.' }, { status: 400 });
    if (Date.now() > stored.expiresAt)  { otpStore.delete(email); return NextResponse.json({ error: 'Kode kadaluarsa. Minta kode baru.' }, { status: 400 }); }
    if (stored.code !== code)           return NextResponse.json({ error: 'Kode salah. Coba lagi.' }, { status: 400 });

    // Kode valid — hapus dari store
    otpStore.delete(email);

    if (stored.isRegister) {
      // Buat akun di Supabase dengan password yang disimpan
      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password      : stored.password,
        email_confirm : true,
        user_metadata : { name: stored.name },
      });

      if (createErr) {
        return NextResponse.json({ error: 'Gagal membuat akun. Coba lagi.' }, { status: 500 });
      }

      // Tunggu trigger buat profile
      await new Promise(r => setTimeout(r, 500));
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', newUser.user.id).single();

      return NextResponse.json({
        success: true, isNew: true,
        user: { id: newUser.user.id, name: profile?.name ?? stored.name, email, balance: 0 },
      });
    }

    return NextResponse.json({ success: true, isNew: false });

  } catch (err) {
    console.error('[POST /api/auth/verify-otp]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}