// src/app/api/reactivation/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const IDR_RATE   = 17135.75;
const MARKUP_PCT = 0.25;
const MIN_PROFIT = 200;
const ROUND_TO   = 100;

function applyMarkup(costUSD: number): number {
  const modal  = costUSD * IDR_RATE;
  const profit = Math.max(modal * MARKUP_PCT, MIN_PROFIT);
  return Math.ceil((modal + profit) / ROUND_TO) * ROUND_TO;
}

/**
 * GET /api/reactivation?id={activationId}
 *
 * Cek harga reaktivasi untuk nomor yang sudah pernah dipakai.
 * Reaktivasi = pakai nomor yang sama untuk layanan lain tanpa beli baru.
 *
 * Response sukses:
 *   { priceIDR: number; priceUSD: number }
 *
 * Response error:
 *   { error: string }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'API key belum dikonfigurasi.' }, { status: 500 });
    }

    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getReactivationCost&id=${id}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    // HeroSMS kadang return plain text, bukan JSON
    const text = (await res.text()).trim();
    let raw: any = null;
    try { raw = JSON.parse(text); } catch { raw = text; }

    if (typeof raw === 'string') {
      const ERROR_MAP: Record<string, string> = {
        NO_BALANCE  : 'Saldo HeroSMS tidak cukup.',
        NO_ACTIVATE : 'Aktivasi tidak ditemukan.',
        BAD_KEY     : 'API key tidak valid.',
      };
      return NextResponse.json({ error: ERROR_MAP[raw] ?? `Gagal cek harga: ${raw}`, code: raw }, { status: 422 });
    }

    // Format: { cost: number } atau number langsung
    const costUSD = typeof raw?.cost === 'number'
      ? raw.cost
      : typeof raw === 'number'
        ? raw
        : 0;

    return NextResponse.json({
      priceUSD: costUSD,
      priceIDR: applyMarkup(costUSD),
    });

  } catch (err) {
    console.error('[GET /api/reactivation]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

/**
 * POST /api/reactivation
 *
 * Reaktivasi nomor yang sudah pernah dipakai untuk layanan lain.
 * User hemat saldo karena tidak perlu beli nomor baru.
 *
 * Body JSON:
 *   { id: string }   // activationId dari order sebelumnya
 *
 * Response sukses:
 *   { success: true; activationId: string; phone: string; priceIDR: number }
 *
 * Response error:
 *   { error: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id   = (body.id ?? '').toString().trim();

    if (!id) {
      return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key belum dikonfigurasi.' }, { status: 500 });
    }

    // 1. Ambil harga reaktivasi dulu
    let priceIDR = 0;
    try {
      const costRes = await fetch(
        `${BASE_URL}?api_key=${API_KEY}&action=getReactivationCost&id=${id}`,
        { cache: 'no-store' }
      );
      const costText = (await costRes.text()).trim();
      let costRaw: any = null;
      try { costRaw = JSON.parse(costText); } catch { costRaw = costText; }
      const costUSD = typeof costRaw?.cost === 'number' ? costRaw.cost
        : typeof costRaw === 'number' ? costRaw : 0;
      priceIDR = applyMarkup(costUSD);
    } catch { /* harga tidak kritis, lanjutkan */ }

    // 2. Request reaktivasi
    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getAdditionalService&id=${id}`,
      { cache: 'no-store' }
    );
    const text = (await res.text()).trim();

    // Response: "ACCESS_NUMBER:{newId}:{phone}" atau error
    if (text.startsWith('ACCESS_NUMBER:')) {
      const [, activationId, phone] = text.split(':');
      return NextResponse.json({ success: true, activationId, phone, priceIDR });
    }

    const ERROR_MAP: Record<string, string> = {
      NO_BALANCE        : 'Saldo HeroSMS tidak cukup (hubungi admin).',
      NO_ACTIVATE       : 'Aktivasi tidak ditemukan.',
      WRONG_ACTIVATION  : 'Aktivasi tidak valid untuk reaktivasi.',
      BAD_KEY           : 'API key tidak valid (hubungi admin).',
      ERROR_SQL         : 'Kesalahan server upstream.',
    };

    const friendlyMsg = ERROR_MAP[text] ?? `Gagal reaktivasi: ${text}`;
    return NextResponse.json({ error: friendlyMsg, code: text }, { status: 422 });

  } catch (err) {
    console.error('[POST /api/reactivation]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
