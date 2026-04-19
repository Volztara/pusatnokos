// src/app/api/auth/verify-otp/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: 'Email dan kode wajib diisi.' }, { status: 400 });
    }

    // Ambil OTP dari Supabase
    const { data: stored, error } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (!stored || error) {
      return NextResponse.json({ error: 'Kode tidak ditemukan. Minta kode baru.' }, { status: 400 });
    }

    if (Date.now() > stored.expires_at) {
      await supabaseAdmin.from('otp_codes').delete().eq('email', email);
      return NextResponse.json({ error: 'Kode kadaluarsa. Minta kode baru.' }, { status: 400 });
    }

    if (stored.code !== String(code).trim()) {
      return NextResponse.json({ error: 'Kode salah. Coba lagi.' }, { status: 400 });
    }

    // Kode valid — hapus dari database
    await supabaseAdmin.from('otp_codes').delete().eq('email', email);

    if (stored.is_register) {
      // Buat akun di Supabase
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