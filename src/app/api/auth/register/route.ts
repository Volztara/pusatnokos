// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    const { email, password, name, turnstileToken } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 });
    }

    // Verifikasi Turnstile
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Coba lagi.' }, { status: 400 });
    }

    // Cek email sudah terdaftar
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login.' }, { status: 400 });
    }

    // Rate limiting via Supabase
    const { data: prev } = await supabaseAdmin
      .from('otp_codes')
      .select('expires_at')
      .eq('email', email.toLowerCase())
      .single();

    if (prev && prev.expires_at - 9 * 60 * 1000 > Date.now()) {
      return NextResponse.json({ error: 'Tunggu 60 detik sebelum minta kode baru.' }, { status: 429 });
    }

    const code = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Simpan ke Supabase
    const { error: upsertErr } = await supabaseAdmin.from('otp_codes').upsert({
      email      : email.toLowerCase(),
      code,
      expires_at : expiresAt,
      is_register: true,
      name,
      password,
    }, { onConflict: 'email' });

    if (upsertErr) {
      console.error('[register] Gagal simpan OTP:', upsertErr);
      return NextResponse.json({ error: 'Gagal menyimpan kode. Coba lagi.' }, { status: 500 });
    }

    // Kirim email verifikasi
    const { error: sendErr } = await resend.emails.send({
      from   : 'Pusat Nokos <noreply@pusatnokos.com>',
      to     : email,
      subject: 'Aktivasi Akun Pusat Nokos',
      html   : `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:24px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <h2 style="color:#0f172a;font-size:20px;font-weight:800;margin-bottom:8px;">Halo, ${name}!</h2>
          <p style="color:#334155;font-size:15px;">Masukkan kode berikut untuk mengaktifkan akun kamu:</p>
          <div style="background:#f1f5f9;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
            <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;font-family:monospace;">${code}</div>
            <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">Berlaku <strong>10 menit</strong></p>
          </div>
          <p style="color:#94a3b8;font-size:13px;text-align:center;">Jangan bagikan kode ini ke siapapun.</p>
        </div>
      `,
    });

    if (sendErr) {
      console.error('[register] Resend error:', sendErr);
      return NextResponse.json({ error: 'Gagal mengirim email. Coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}