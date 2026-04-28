// src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Enkripsi password dengan AES-GCM — tidak pernah simpan plaintext
async function encryptPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    'raw',
    encoder.encode((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(0, 32).padEnd(32, '0')),
    'AES-GCM', false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMat, encoder.encode(password));
  const ivB64 = btoa(String.fromCharCode(...iv));
  const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  return `${ivB64}:${encB64}`;
}

async function verifyTurnstile(token: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch { return false; }
}

async function sendBrevoEmail(to: string, name: string, code: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': process.env.BREVO_API_KEY! },
    body: JSON.stringify({
      sender: { name: 'Pusat Nokos', email: 'noreply@pusatnokos.com' },
      to: [{ email: to }],
      subject: 'Aktivasi Akun Pusat Nokos',
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#fff;border-radius:24px;padding:40px;">
          <h2 style="color:#0f172a;">Halo, ${name}!</h2>
          <p style="color:#334155;">Masukkan kode berikut untuk mengaktifkan akun kamu:</p>
          <div style="background:#f1f5f9;border-radius:16px;padding:24px;text-align:center;margin:24px 0;">
            <div style="font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;">${code}</div>
            <p style="color:#94a3b8;font-size:13px;">Berlaku <strong>10 menit</strong></p>
          </div>
          <p style="color:#94a3b8;font-size:13px;text-align:center;">Jangan bagikan kode ini ke siapapun.</p>
        </div>`,
    }),
  });
  if (!res.ok) { const err = await res.json(); throw new Error(err?.message ?? 'Brevo error'); }
}

export async function POST(request: Request) {
  try {
    const { email, password, name, turnstileToken } = await request.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Semua field wajib diisi.' }, { status: 400 });
    }
    // ✅ Naik dari 6 ke 8 karakter
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });
    }

    if (!turnstileToken || !(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: 'Verifikasi CAPTCHA gagal. Coba lagi.' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const { data: existing } = await supabaseAdmin
      .from('profiles').select('id').eq('email', normalizedEmail).single();

    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login.' }, { status: 400 });
    }

    const { data: prev } = await supabaseAdmin
      .from('otp_codes').select('expires_at').eq('email', normalizedEmail).single();

    if (prev && prev.expires_at - 9 * 60 * 1000 > Date.now()) {
      return NextResponse.json({ error: 'Tunggu 60 detik sebelum minta kode baru.' }, { status: 429 });
    }

    const code = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    const encryptedPassword = await encryptPassword(password); // ✅ enkripsi dulu

    const { error: upsertErr } = await supabaseAdmin.from('otp_codes').upsert({
      email: normalizedEmail,
      code,
      expires_at: expiresAt,
      is_register: true,
      name,
      password: encryptedPassword, // ✅ AES-GCM encrypted
      attempt_count: 0,                 // ✅ reset brute force counter
    }, { onConflict: 'email' });

    if (upsertErr) {
      console.error('[register] Gagal simpan OTP:', upsertErr);
      return NextResponse.json({ error: 'Gagal menyimpan kode. Coba lagi.' }, { status: 500 });
    }

    try {
      await sendBrevoEmail(email, name, code);
    } catch (err) {
      console.error('[register] Brevo error:', err);
      return NextResponse.json({ error: 'Gagal mengirim email. Coba lagi.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}