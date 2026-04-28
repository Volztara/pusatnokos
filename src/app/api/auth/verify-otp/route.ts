// src/app/api/auth/verify-otp/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_OTP_ATTEMPTS = 5;

// ✅ Decrypt password yang dienkripsi AES-GCM di send-otp
async function decryptPassword(encrypted: string): Promise<string> {
  try {
    const [ivB64, encB64] = encrypted.split(':');
    if (!ivB64 || !encB64) return encrypted;
    const encoder = new TextEncoder();
    const keyMat = await crypto.subtle.importKey(
      'raw',
      encoder.encode((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(0, 32).padEnd(32, '0')),
      'AES-GCM', false, ['decrypt']
    );
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const encBytes = Uint8Array.from(atob(encB64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMat, encBytes);
    return new TextDecoder().decode(decrypted);
  } catch { return encrypted; }
}

export async function POST(request: Request) {
  try {
    const { email, code } = await request.json();
    if (!email || !code) {
      return NextResponse.json({ error: 'Email dan kode wajib diisi.' }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const { data: stored, error } = await supabaseAdmin
      .from('otp_codes').select('*').eq('email', normalizedEmail).single();

    if (!stored || error) {
      return NextResponse.json({ error: 'Kode tidak ditemukan. Minta kode baru.' }, { status: 400 });
    }

    // ✅ Brute force protection
    const attemptCount = stored.attempt_count ?? 0;
    if (attemptCount >= MAX_OTP_ATTEMPTS) {
      await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Minta kode baru.' }, { status: 429 });
    }

    if (Date.now() > stored.expires_at) {
      await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);
      return NextResponse.json({ error: 'Kode kadaluarsa. Minta kode baru.' }, { status: 400 });
    }

    if (stored.code !== String(code).trim()) {
      await supabaseAdmin
        .from('otp_codes')
        .update({ attempt_count: attemptCount + 1 })
        .eq('email', normalizedEmail);
      const remaining = MAX_OTP_ATTEMPTS - (attemptCount + 1);
      return NextResponse.json({
        error: remaining > 0
          ? `Kode salah. ${remaining} percobaan tersisa.`
          : 'Kode salah. Minta kode baru.',
      }, { status: 400 });
    }

    // Kode valid — hapus
    await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);

    if (stored.is_register) {
      // ✅ Decrypt password sebelum dikirim ke Supabase Auth
      const plainPassword = await decryptPassword(stored.password);

      const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: plainPassword, // ✅ plaintext asli
        email_confirm: true,
        user_metadata: { name: stored.name },
      });

      if (createErr) {
        console.error('[verify-otp] createUser error:', createErr);
        return NextResponse.json({ error: 'Gagal membuat akun. Coba lagi.' }, { status: 500 });
      }

      await new Promise(r => setTimeout(r, 500));
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('*').eq('id', newUser.user.id).single();

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