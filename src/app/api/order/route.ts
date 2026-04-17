// src/app/api/order/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── KONFIGURASI MARKUP — baca dari DB ────────────────────────────────
const DEFAULT_CONFIG = {
  idrRate   : 17135.75,
  markupPct : 0.25,
  minProfit : 200,
  roundTo   : 100,
};

async function getMarkupConfig() {
  try {
    const { data } = await db.from('admin_settings').select('value').eq('key', 'markup_config').single();
    return data?.value ?? DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function applyMarkup(
  costUSD  : number,
  idrRate  : number,
  markupPct: number,
  minProfit: number,
  roundTo  : number
): number {
  const modal  = costUSD * idrRate;
  const profit = Math.max(modal * markupPct, minProfit);
  return Math.ceil((modal + profit) / roundTo) * roundTo;
}
// ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const service  = (body.service  ?? '').trim();
    const country  = (body.country  ?? '6').trim();
    const operator = (body.operator ?? '0').trim();
    const email    = (body.email    ?? '').trim();

    if (!service) {
      return NextResponse.json({ error: 'Parameter "service" wajib diisi.' }, { status: 400 });
    }

    // Cek blacklist jika email diberikan
    if (email) {
      const { data: profile } = await db
        .from('profiles')
        .select('is_blacklisted')
        .eq('email', email.toLowerCase())
        .single();

      if (profile?.is_blacklisted) {
        return NextResponse.json(
          { error: 'Akun kamu telah diblokir. Hubungi admin.' },
          { status: 403 }
        );
      }
    }

    // Fetch config markup dari DB (sama dengan /api/services)
    const config = await getMarkupConfig();
    const { idrRate, markupPct, minProfit, roundTo } = config;

    const priceRes = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getPrices&country=${country}&service=${service}`,
      { cache: 'no-store' }
    );
    const priceRaw = priceRes.ok ? await priceRes.json() : null;

    let priceIDR = 0;
    try {
      const countryData = priceRaw?.[country] ?? {};
      const serviceData = countryData[service];
      const opData =
        typeof serviceData?.cost === 'number'
          ? serviceData
          : (serviceData?.[operator] ?? serviceData?.['0'] ?? null);
      if (opData?.cost) priceIDR = applyMarkup(opData.cost, idrRate, markupPct, minProfit, roundTo);
    } catch { /* harga tidak kritis */ }

    const orderUrl =
      `${BASE_URL}?api_key=${API_KEY}&action=getNumber` +
      `&service=${service}&country=${country}&operator=${operator}`;

    const orderRes  = await fetch(orderUrl, { cache: 'no-store' });
    const orderText = (await orderRes.text()).trim();

    if (orderText.startsWith('ACCESS_NUMBER:')) {
      const [, activationId, phone] = orderText.split(':');
      return NextResponse.json({ activationId, phone, price: priceIDR });
    }

    const ERROR_MAP: Record<string, string> = {
      NO_NUMBERS      : 'Stok nomor habis untuk layanan ini. Coba negara lain.',
      NO_BALANCE      : 'Saldo HeroSMS tidak cukup (hubungi admin).',
      WRONG_SERVICE   : 'Kode layanan tidak valid.',
      WRONG_COUNTRY   : 'Kode negara tidak valid.',
      BAD_ACTION      : 'Permintaan tidak valid ke upstream.',
      BAD_KEY         : 'API key tidak valid (hubungi admin).',
      ERROR_SQL       : 'Kesalahan server upstream.',
      BANNED          : 'Akun API diblokir (hubungi admin).',
      REPEATED_NUMBER : 'Nomor sudah pernah dipesan untuk layanan ini.',
    };

    const friendlyMsg = ERROR_MAP[orderText] ?? `Gagal memesan nomor: ${orderText}`;
    return NextResponse.json({ error: friendlyMsg, code: orderText }, { status: 422 });

  } catch (err) {
    console.error('[POST /api/order]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();

    if (!id) {
      return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
    }

    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getStatus&id=${id}`,
      { cache: 'no-store' }
    );
    const text = (await res.text()).trim();

    if (text === 'STATUS_WAIT_CODE')   return NextResponse.json({ status: 'waiting' });
    if (text === 'STATUS_WAIT_RESEND') return NextResponse.json({ status: 'wait_resend' });
    if (text === 'STATUS_CANCEL')      return NextResponse.json({ status: 'cancel' });

    if (text.startsWith('STATUS_OK:')) {
      const otpCode = text.split(':')[1] ?? '';
      return NextResponse.json({ status: 'ok', otpCode });
    }

    return NextResponse.json({ status: 'unknown', raw: text });

  } catch (err) {
    console.error('[GET /api/order]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body   = await request.json();
    const id     = (body.id     ?? '').toString().trim();
    const action = (body.action ?? '').trim();

    if (!id || !action) {
      return NextResponse.json(
        { error: 'Parameter "id" dan "action" wajib diisi.' },
        { status: 400 }
      );
    }

    const STATUS_CODE: Record<string, number> = {
      resend: 3,
      done  : 6,
      cancel: 8,
    };

    const statusCode = STATUS_CODE[action];
    if (!statusCode) {
      return NextResponse.json(
        { error: 'Nilai "action" tidak valid. Gunakan "cancel", "done", atau "resend".' },
        { status: 400 }
      );
    }

    const url  = `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${id}&status=${statusCode}`;
    const res  = await fetch(url, { cache: 'no-store' });
    const text = (await res.text()).trim();

    const SUCCESS_TOKENS: Record<string, string[]> = {
      resend: ['ACCESS_RETRY_GET', 'STATUS_WAIT_RESEND'],
      done  : ['ACCESS_ACTIVATION', 'ACTIVATION_STATUS_CHANGED'],
      cancel: ['ACCESS_CANCEL'],
    };

    const isSuccess = (SUCCESS_TOKENS[action] ?? []).some(t => text.startsWith(t));

    if (isSuccess) {
      const MESSAGE: Record<string, string> = {
        resend: 'Permintaan kirim ulang OTP berhasil dikirim.',
        done  : 'Pesanan berhasil dikonfirmasi sebagai selesai.',
        cancel: 'Pesanan berhasil dibatalkan. Saldo akan dikembalikan.',
      };
      return NextResponse.json({ success: true, message: MESSAGE[action] });
    }

    return NextResponse.json(
      { success: false, error: `Gagal mengubah status: ${text}`, code: text },
      { status: 422 }
    );

  } catch (err) {
    console.error('[PATCH /api/order]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}