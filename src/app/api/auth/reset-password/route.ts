// src/app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_OTP_ATTEMPTS = 5;

export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Ambil OTP dari Supabase
    const { data: stored, error: otpErr } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (otpErr || !stored) {
      return NextResponse.json({ error: 'Code not found. Please request a new one.' }, { status: 400 });
    }

    if (stored.is_register === true) {
      return NextResponse.json({ error: 'Invalid code. Please request a reset code.' }, { status: 400 });
    }

    // ✅ Brute force protection
    const attemptCount = stored.attempt_count ?? 0;
    if (attemptCount >= MAX_OTP_ATTEMPTS) {
      await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 429 });
    }

    if (Date.now() > stored.expires_at) {
      await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);
      return NextResponse.json({ error: 'Code expired. Please request a new one.' }, { status: 400 });
    }

    if (stored.code !== String(code).trim()) {
      await supabaseAdmin
        .from('otp_codes')
        .update({ attempt_count: attemptCount + 1 })
        .eq('email', normalizedEmail);
      const remaining = MAX_OTP_ATTEMPTS - (attemptCount + 1);
      return NextResponse.json({
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempts remaining.`
          : 'Incorrect code. Please request a new one.',
      }, { status: 400 });
    }

    // Hapus OTP setelah tervalidasi
    await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);

    // ✅ Gunakan listUsers dengan filter email — tidak perlu load semua user
    // Supabase Admin API support filter by email langsung
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    // ✅ Cara yang benar: cari user by email via filter
    const { data: userByEmail } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (!userByEmail?.id) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      userByEmail.id,
      { password: newPassword }
    );

    if (updateErr) {
      console.error('[reset-password] updateUserById error:', updateErr);
      return NextResponse.json({ error: 'Failed to update password. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}