// src/app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { email, code, newPassword } = await request.json();

    if (!email || !code || !newPassword) {
      return NextResponse.json(
        { error: 'All fields are required.' },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ── Ambil OTP dari Supabase ───────────────────────────────────────
    const { data: stored, error: otpErr } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    // FIX BUG 2: kondisi yang benar
    if (otpErr || !stored) {
      return NextResponse.json(
        { error: 'Code not found. Please request a new one.' },
        { status: 400 }
      );
    }

    // Pastikan ini OTP untuk reset password (bukan register)
    if (stored.is_register === true) {
      return NextResponse.json(
        { error: 'Invalid code. Please request a reset code.' },
        { status: 400 }
      );
    }

    // Cek kadaluarsa
    if (Date.now() > stored.expires_at) {
      await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);
      return NextResponse.json(
        { error: 'Code expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Cek kode cocok
    if (stored.code !== String(code).trim()) {
      return NextResponse.json(
        { error: 'Incorrect code. Please try again.' },
        { status: 400 }
      );
    }

    // ── Hapus OTP setelah tervalidasi ────────────────────────────────
    await supabaseAdmin.from('otp_codes').delete().eq('email', normalizedEmail);

    // FIX BUG 1: Cari user langsung by email, bukan loop listUsers()
    const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page    : 1,
      perPage : 1000,
    });

    if (listErr) {
      console.error('[reset-password] listUsers error:', listErr);
      return NextResponse.json(
        { error: 'Server error. Please try again.' },
        { status: 500 }
      );
    }

    // Case-insensitive email match
    const user = users.find(
      u => u.email?.toLowerCase().trim() === normalizedEmail
    );

    if (!user) {
      console.warn('[reset-password] User not found in auth.users:', normalizedEmail);
      return NextResponse.json(
        { error: 'Account not found. Please contact support.' },
        { status: 404 }
      );
    }

    // ── Update password ───────────────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateErr) {
      console.error('[reset-password] updateUserById error:', updateErr);
      return NextResponse.json(
        { error: 'Failed to update password. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/reset-password]', err);
    return NextResponse.json(
      { error: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}