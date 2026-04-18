// src/app/api/user/change-password/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/user/change-password
 * Body: { email, oldPassword, newPassword }
 * Verifikasi password lama via Supabase Auth, lalu update ke password baru
 */
export async function POST(request: Request) {
  const { email, oldPassword, newPassword } = await request.json();

  if (!email || !oldPassword || !newPassword)
    return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });

  if (newPassword.length < 8)
    return NextResponse.json({ message: 'Password baru minimal 8 karakter.' }, { status: 400 });

  // 1. Verifikasi password lama dengan sign in
  const supabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email,
    password: oldPassword,
  });

  if (signInError)
    return NextResponse.json({ message: 'Password saat ini salah.' }, { status: 401 });

  // 2. Ambil user id
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile)
    return NextResponse.json({ message: 'User tidak ditemukan.' }, { status: 404 });

  // 3. Update password via Admin API (tidak perlu session)
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
    profile.id,
    { password: newPassword }
  );

  if (updateError)
    return NextResponse.json({ message: 'Gagal mengubah password.' }, { status: 500 });

  // 4. Catat di log (opsional, skip kalau tidak ada tabel admin_logs)
  try {
    await supabaseAdmin.from('admin_logs').insert({
      action   : 'change_password',
      target_id: profile.id,
      details  : 'User mengubah password sendiri',
    });
  } catch {}

  return NextResponse.json({ success: true });
}
