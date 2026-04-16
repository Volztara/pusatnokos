// src/app/api/order-v2/route.ts
//
// Versi baru dari order API menggunakan getNumberV2 + getStatusV2.
// V2 mendukung multi-service sekaligus dan notifikasi webhook yang lebih detail.
// Gunakan ini untuk layanan baru; /api/order tetap bisa dipakai untuk kompatibilitas.

import { NextResponse } from 'next/server';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

// ─── MARKUP ──────────────────────────────────────────────────────────
const IDR_RATE   = 17135.75;
const MARKUP_PCT = 0.25;
const MIN_PROFIT = 200;
const ROUND_TO   = 100;

function applyMarkup(costUSD: number): number {
  const modal  = costUSD * IDR_RATE;
  const profit = Math.max(modal * MARKUP_PCT, MIN_PROFIT);
  return Math.ceil((modal + profit) / ROUND_TO) * ROUND_TO;
}
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/order-v2
 * Pesan nomor menggunakan getNumberV2.
 *
 * Body JSON:
 *   {
 *     service  : string          // kode layanan utama, mis. "wa"
 *     country  : string          // default "6"
 *     operator : string          // default "0"
 *     multiService?: string[]    // opsional: layanan tambahan, mis. ["tg","ig"]
 *   }
 *
 * Response sukses:
 *   { activationId, phone, price, activationCost }
 *
 * Response error:
 *   { error, code? }
 */
export async function POST(request: Request) {
  try {
    const body        = await request.json();
    const service     = (body.service  ?? '').trim();
    const country     = (body.country  ?? '6').trim();
    const operator    = (body.operator ?? '0').trim();
    const multiService: string[] = Array.isArray(body.multiService) ? body.multiService : [];

    if (!service) {
      return NextResponse.json({ error: 'Parameter "service" wajib diisi.' }, { status: 400 });
    }

    // Bangun URL — V2 mendukung parameter multiService (dipisah koma)
    const serviceParam = multiService.length > 0
      ? `${service},${multiService.join(',')}`
      : service;

    const orderUrl =
      `${BASE_URL}?api_key=${API_KEY}&action=getNumberV2` +
      `&service=${serviceParam}&country=${country}&operator=${operator}`;

    const orderRes  = await fetch(orderUrl, { cache: 'no-store' });
    const orderText = (await orderRes.text()).trim();

    // V2 response: "ACCESS_NUMBER:{id}:{phone}:{cost}"
    // (sama seperti V1 tapi dengan field cost tambahan)
    if (orderText.startsWith('ACCESS_NUMBER:')) {
      const parts        = orderText.split(':');
      const activationId = parts[1] ?? '';
      const phone        = parts[2] ?? '';
      const costUSD      = parseFloat(parts[3] ?? '0') || 0;

      return NextResponse.json({
        activationId,
        phone,
        price          : applyMarkup(costUSD),   // harga setelah markup IDR
        activationCost : costUSD,                 // harga asli USD dari HeroSMS
      });
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

    const friendlyMsg = ERROR_MAP[orderText] ?? `Gagal memesan nomor (V2): ${orderText}`;
    return NextResponse.json({ error: friendlyMsg, code: orderText }, { status: 422 });

  } catch (err) {
    console.error('[POST /api/order-v2]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

/**
 * GET /api/order-v2?id={activationId}
 * Cek status OTP menggunakan getStatusV2.
 *
 * V2 bisa mengembalikan MULTIPLE OTP sekaligus (untuk multi-service).
 *
 * Response:
 *   {
 *     status   : 'waiting' | 'ok' | 'wait_resend' | 'cancel' | 'unknown'
 *     otpCodes : string[]   // bisa lebih dari 1 jika multi-service
 *     raw      : string     // raw string untuk debugging
 *   }
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();

    if (!id) {
      return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
    }

    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getStatusV2&id=${id}`,
      { cache: 'no-store' }
    );
    const text = (await res.text()).trim();

    if (text === 'STATUS_WAIT_CODE') {
      return NextResponse.json({ status: 'waiting', otpCodes: [], raw: text });
    }

    if (text === 'STATUS_WAIT_RESEND') {
      return NextResponse.json({ status: 'wait_resend', otpCodes: [], raw: text });
    }

    if (text === 'STATUS_CANCEL') {
      return NextResponse.json({ status: 'cancel', otpCodes: [], raw: text });
    }

    if (text.startsWith('STATUS_OK:')) {
      // V2 bisa: "STATUS_OK:111222:333444" (multi OTP dipisah ":")
      const parts    = text.split(':').slice(1);      // buang "STATUS_OK"
      const otpCodes = parts.filter(p => p.length > 0);
      return NextResponse.json({ status: 'ok', otpCodes, raw: text });
    }

    return NextResponse.json({ status: 'unknown', otpCodes: [], raw: text });

  } catch (err) {
    console.error('[GET /api/order-v2]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}