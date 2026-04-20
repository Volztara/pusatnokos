// src/app/api/webhook/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

/** Ekstrak angka OTP 4-10 digit dari teks */
function extractNumericOtp(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{4,10})\b/);
  return match ? match[1] : null;
}

/** Scan semua field body untuk cari angka OTP */
function findOtpFromBody(body: Record<string, string>): string | null {
  const priorityFields = ['code', 'smsCode', 'smsText', 'text', 'otp', 'sms'];
  for (const field of priorityFields) {
    if (body[field]) {
      const found = extractNumericOtp(body[field]);
      if (found) return found;
    }
  }
  for (const val of Object.values(body)) {
    if (typeof val === 'string') {
      const found = extractNumericOtp(val);
      if (found) return found;
    }
  }
  return null;
}

/** Fallback: ambil kode langsung dari HeroSMS API via getStatus */
async function fetchOtpFromHeroSMS(activationId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getStatus&id=${activationId}`,
      { cache: 'no-store', signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    console.log('[webhook] getStatus fallback:', text.slice(0, 80));

    if (text.startsWith('STATUS_OK:')) {
      const fullText = text.slice('STATUS_OK:'.length);
      return extractNumericOtp(fullText) || fullText;
    }
  } catch (err) {
    console.warn('[webhook] getStatus fallback error:', err);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    let body: Record<string, string> = {};

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      new URLSearchParams(text).forEach((v, k) => { body[k] = v; });
    }

    const activationId = body.activationId ?? body.id ?? '';
    const rawText      = body.smsCode ?? body.code ?? body.smsText ?? body.text ?? '';

    console.log('[webhook] body:', JSON.stringify(body));

    if (!activationId || !rawText) {
      return new Response('OK', { status: 200 });
    }

    // Cari OTP dari body dulu
    let smsCode = findOtpFromBody(body);

    // Kalau tidak ada angka di body → fallback ke HeroSMS getStatus
    if (!smsCode) {
      console.log('[webhook] angka tidak ditemukan di body, fallback ke getStatus...');
      smsCode = await fetchOtpFromHeroSMS(activationId);
    }

    // Kalau masih tidak dapat angka → simpan teks asli
    const finalCode = smsCode ?? rawText;

    console.log('[webhook] OTP final:', finalCode, '→ activation_id:', activationId);

    const { error } = await db
      .from('orders')
      .update({
        otp_code  : finalCode,
        status    : 'success',
        updated_at: new Date().toISOString(),
      })
      .eq('activation_id', activationId)
      .eq('status', 'waiting');

    if (error) console.error('[webhook] gagal update orders:', error);

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('[POST /api/webhook]', err);
    return new Response('OK', { status: 200 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  const { data: order } = await db
    .from('orders')
    .select('otp_code, status, updated_at')
    .eq('activation_id', id)
    .single();

  if (!order?.otp_code) {
    return NextResponse.json({ status: 'waiting' });
  }

  return NextResponse.json({
    status    : 'ok',
    smsCode   : order.otp_code,
    receivedAt: order.updated_at,
  });
}