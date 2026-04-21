// src/app/api/auth/send-otp/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendBrevoEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender: { name: 'Pusat Nokos', email: 'noreply@pusatnokos.com' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.message ?? 'Brevo error');
  }
}

export async function POST(request: Request) {
  try {
    const body       = await request.json();
    const email      = (body.email ?? '').trim().toLowerCase();
    const name       = body.name   ?? '';
    const isRegister = Boolean(body.isRegister);
    const isReset    = Boolean(body.isReset);
    const password   = body.password ?? '';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 });
    }

    // Rate limiting — cek apakah OTP sudah dikirim dalam 60 detik terakhir
    const { data: existing } = await db
      .from('otp_codes')
      .select('expires_at')
      .eq('email', email)
      .single();

    if (existing && existing.expires_at - 9 * 60 * 1000 > Date.now()) {
      return NextResponse.json({ error: 'Tunggu 60 detik sebelum minta kode baru.' }, { status: 429 });
    }

    const code = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    // Simpan ke Supabase (upsert)
    await db.from('otp_codes').upsert({
      email,
      code,
      expires_at : expiresAt,
      is_register: isRegister,
      name,
      password,
    }, { onConflict: 'email' });

    const subject = isReset ? 'Kode Reset Password Pusat Nokos' : 'Kode Verifikasi Pusat Nokos';
    const heading = isReset ? 'Reset Password' : 'Verifikasi Email';
    const desc    = isReset
      ? 'Masukkan kode berikut untuk mereset password kamu:'
      : `Masukkan kode berikut untuk ${isRegister ? 'mengaktifkan akun' : 'masuk ke akun'} kamu:`;

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:24px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <h2 style="color:#0f172a;font-size:20px;font-weight:800;margin-bottom:8px;">${heading}</h2>
        <p style="color:#334155;font-size:15px;">${desc}</p>
        <div style="background:#f1f5f9;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
          <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;font-family:monospace;">${code}</div>
          <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">Berlaku <strong>10 menit</strong></p>
        </div>
        <p style="color:#94a3b8;font-size:13px;text-align:center;">Jangan bagikan kode ini ke siapapun.</p>
      </div>
    `;

    try {
      await sendBrevoEmail(email, subject, html);
    } catch (err) {
      return NextResponse.json({ error: 'Gagal mengirim email. Coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/send-otp]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}