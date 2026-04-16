// src/app/api/auth/send-otp/route.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

declare global { var _otpStore: Map<string, any> | undefined; }
const otpStore: Map<string, any> = globalThis._otpStore ?? (globalThis._otpStore = new Map());

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body       = await request.json();
    const email      = (body.email ?? '').trim().toLowerCase();
    const name       = body.name   ?? '';
    const isRegister = Boolean(body.isRegister);
    const isReset    = Boolean(body.isReset);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email tidak valid.' }, { status: 400 });
    }

    // Rate limiting
    const prev = otpStore.get(email);
    if (prev && prev.expiresAt - 9 * 60 * 1000 > Date.now()) {
      return NextResponse.json({ error: 'Tunggu 60 detik sebelum minta kode baru.' }, { status: 429 });
    }

    const code = generateOTP();
    otpStore.set(email, {
      code,
      expiresAt : Date.now() + 10 * 60 * 1000,
      name,
      isRegister,
      isReset,
    });

    const subject = isReset ? 'Kode Reset Password Pusat Nokos' : 'Kode Verifikasi Pusat Nokos';
    const heading = isReset ? 'Reset Password' : 'Verifikasi Email';
    const desc    = isReset
      ? 'Masukkan kode berikut untuk mereset password kamu:'
      : `Masukkan kode berikut untuk ${isRegister ? 'mengaktifkan akun' : 'masuk ke akun'} kamu:`;

    const { error: sendErr } = await resend.emails.send({
      from   : 'Pusat Nokos <noreply@pusatnokos.com>',
      to     : email,
      subject,
      html   : `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:24px;padding:40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
          <h2 style="color:#0f172a;font-size:20px;font-weight:800;margin-bottom:8px;">${heading}</h2>
          <p style="color:#334155;font-size:15px;">${desc}</p>
          <div style="background:#f1f5f9;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
            <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;font-family:monospace;">${code}</div>
            <p style="color:#94a3b8;font-size:13px;margin:12px 0 0;">Berlaku <strong>10 menit</strong></p>
          </div>
          <p style="color:#94a3b8;font-size:13px;text-align:center;">Jangan bagikan kode ini ke siapapun.</p>
        </div>
      `,
    });

    if (sendErr) {
      return NextResponse.json({ error: 'Gagal mengirim email. Coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/send-otp]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}