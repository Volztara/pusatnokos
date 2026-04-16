// src/app/api/auth/reset-password/route.ts
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
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    const stored = otpStore.get(email);

    if (!stored || !stored.isReset)     return NextResponse.json({ error: 'Kode tidak ditemukan. Minta kode baru.' }, { status: 400 });
    if (Date.now() > stored.expiresAt)  { otpStore.delete(email); return NextResponse.json({ error: 'Kode kadaluarsa. Minta kode baru.' }, { status: 400 }); }
    if (stored.code !== code)           return NextResponse.json({ error: 'Kode salah. Coba lagi.' }, { status: 400 });

    otpStore.delete(email);

    // Cari user by email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    // Update password
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: newPassword });

    if (updateErr) {
      return NextResponse.json({ error: 'Gagal mengubah password. Coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}