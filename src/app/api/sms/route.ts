// src/app/api/sms/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractNumericOtp(text: string): string {
  if (!text) return text;
  const match = text.match(/\b(\d{4,10})\b/);
  return match ? match[1] : text;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  // ── 1. Coba ambil dari Supabase dulu (lebih reliable) ──────────────
  try {
    const { data: order } = await db
      .from('orders')
      .select('otp_code, status')
      .eq('activation_id', id)
      .single();

    if (order?.otp_code) {
      const code = extractNumericOtp(order.otp_code);
      return NextResponse.json({ otpCode: code, source: 'db' });
    }
  } catch (dbErr) {
    console.warn('[GET /api/sms] Supabase fallback error:', dbErr);
  }

  // ── 2. Fallback: coba HeroSMS API ──────────────────────────────────
  try {
    // Coba getStatus (lebih umum) daripada getFullSms
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getStatus&id=${id}`,
      { cache: 'no-store', signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) {
      console.warn('[GET /api/sms] HeroSMS HTTP error:', res.status);
      return NextResponse.json({ status: 'waiting' });
    }

    const text    = await res.text();
    const trimmed = text.trim();

    console.log('[GET /api/sms] HeroSMS response:', trimmed.slice(0, 100));

    const ERROR_CODES = new Set(['BAD_KEY', 'NO_ACTIVATE', 'STATUS_WAIT', 'ERROR_SQL', 'STATUS_WAIT_CODE', 'STATUS_WAIT_RESEND']);

    if (ERROR_CODES.has(trimmed)) {
      return NextResponse.json({ status: 'waiting' });
    }

    if (trimmed.startsWith('STATUS_OK:')) {
      const fullText = trimmed.slice('STATUS_OK:'.length);
      const code     = extractNumericOtp(fullText) || fullText;
      return NextResponse.json({ otpCode: code, source: 'herosms' });
    }

    if (trimmed === 'STATUS_CANCEL') {
      return NextResponse.json({ status: 'cancelled' });
    }

    // Coba parse JSON (getFullSms format)
    try {
      const raw   = JSON.parse(text);
      const items = Array.isArray(raw) ? raw : Array.isArray(raw?.sms) ? raw.sms : [];
      const messages = items
        .map((item: any) => {
          const rawCode = String(item.code ?? item.smsCode ?? item.text ?? '');
          return {
            code   : extractNumericOtp(rawCode) || rawCode,
            service: String(item.service ?? ''),
            text   : String(item.text ?? item.fullSms ?? rawCode),
          };
        })
        .filter((m: { code: string; service: string; text: string }) => m.code.length > 0);
      return NextResponse.json(messages);
    } catch {
      return NextResponse.json({ status: 'waiting' });
    }

  } catch (err) {
    console.error('[GET /api/sms] error:', err);
    return NextResponse.json({ status: 'waiting' });
  }
}