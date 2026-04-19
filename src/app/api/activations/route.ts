// src/app/api/activations/route.ts
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

const STATUS_LABEL: Record<string, string> = {
  STATUS_WAIT_CODE   : 'Menunggu OTP',
  STATUS_WAIT_RESEND : 'Menunggu Kirim Ulang',
  STATUS_CANCEL      : 'Dibatalkan',
};

export async function GET() {
  try {
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getActiveActivations`,
      { cache: 'no-store' }
    );

    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const raw = await res.json();

    if (typeof raw === 'string') {
      const ERROR_MAP: Record<string, string> = {
        BAD_KEY   : 'API key tidak valid (hubungi admin).',
        BANNED    : 'Akun API diblokir (hubungi admin).',
        ERROR_SQL : 'Kesalahan server upstream.',
      };
      const msg = ERROR_MAP[raw] ?? `Gagal mengambil aktivasi: ${raw}`;
      return NextResponse.json({ error: msg, code: raw }, { status: 422 });
    }

    // HeroSMS return: { status, data: [...], activeActivations: { rows: [...] } }
    let items: any[] = [];

    if (Array.isArray(raw)) {
      items = raw;
    } else if (Array.isArray(raw?.data)) {
      items = raw.data;
    } else if (Array.isArray(raw?.activeActivations?.rows)) {
      items = raw.activeActivations.rows;
    } else if (Array.isArray(raw?.activeActivations)) {
      items = raw.activeActivations;
    }

    const activations = items.map((item: any) => {
      const activationId = String(item.id ?? item.activationId ?? '');
      const phone        = String(item.phone ?? item.phoneNumber ?? '');
      const service      = String(item.service ?? item.serviceCode ?? '');
      const statusRaw    = String(item.status ?? item.activationStatus ?? 'STATUS_WAIT_CODE');
      const createdAt    = item.created_at ?? item.createdAt ?? item.createDate ?? null;

      const priceIDR =
        typeof item.sum === 'number' && item.sum > 0
          ? applyMarkup(item.sum)
          : typeof item.cost === 'number' && item.cost > 0
            ? applyMarkup(item.cost)
            : null;

      let otpCode: string | null = null;
      let normalizedStatus = statusRaw;

      // HeroSMS kadang pakai angka untuk status
      if (statusRaw === '1') normalizedStatus = 'STATUS_WAIT_CODE';
      else if (statusRaw === '2') normalizedStatus = 'STATUS_OK';
      else if (statusRaw === '3') normalizedStatus = 'STATUS_CANCEL';
      else if (statusRaw === '4') normalizedStatus = 'STATUS_CANCEL';

      if (statusRaw.startsWith('STATUS_OK:')) {
        otpCode          = statusRaw.split(':')[1] ?? null;
        normalizedStatus = 'STATUS_OK';
      }

      // OTP bisa dari smsCode atau smsText
      if (!otpCode && item.smsCode) otpCode = String(item.smsCode);

      const statusLabel =
        STATUS_LABEL[normalizedStatus] ??
        (normalizedStatus === 'STATUS_OK' ? 'OTP Diterima' : normalizedStatus);

      return {
        activationId,
        phone,
        service,
        status     : normalizedStatus,
        statusLabel,
        otpCode,
        priceIDR,
        createdAt  : createdAt ? String(createdAt) : null,
      };
    });

    const ORDER: Record<string, number> = {
      STATUS_WAIT_CODE   : 0,
      STATUS_WAIT_RESEND : 1,
      STATUS_OK          : 2,
      STATUS_CANCEL      : 3,
    };

    activations.sort(
      (a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
    );

    return NextResponse.json(activations);

  } catch (err) {
    console.error('[GET /api/activations]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}