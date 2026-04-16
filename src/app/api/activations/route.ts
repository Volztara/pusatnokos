// src/app/api/activations/route.ts
import { NextResponse } from 'next/server';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

// ─── KONFIGURASI MARKUP (sama seperti route lain) ────────────────────
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
 * Map status code HeroSMS → label yang ramah untuk frontend.
 * Referensi: https://hero-sms.com/api
 */
const STATUS_LABEL: Record<string, string> = {
  STATUS_WAIT_CODE   : 'Menunggu OTP',
  STATUS_WAIT_RESEND : 'Menunggu Kirim Ulang',
  STATUS_CANCEL      : 'Dibatalkan',
};

/**
 * GET /api/activations
 *
 * Mengambil semua aktivasi yang sedang aktif (menunggu OTP).
 *
 * Response sukses:
 *   Array<{
 *     activationId : string
 *     phone        : string
 *     service      : string
 *     status       : string          // raw status dari HeroSMS
 *     statusLabel  : string          // label bahasa Indonesia
 *     otpCode      : string | null   // terisi jika OTP sudah masuk
 *     priceIDR     : number | null   // harga dalam IDR (jika tersedia di API)
 *     createdAt    : string | null   // ISO timestamp jika tersedia
 *   }>
 *
 * Response error:
 *   { error: string }
 *
 * Catatan:
 *   HeroSMS mengembalikan array objek aktivasi aktif.
 *   Struktur setiap item: { id, phone, service, status, sum, created_at, ... }
 */
export async function GET() {
  try {
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getActiveActivations`,
      { cache: 'no-store' }
    );

    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const raw = await res.json();

    // Tangani respons error string (misal: "BAD_KEY")
    if (typeof raw === 'string') {
      const ERROR_MAP: Record<string, string> = {
        BAD_KEY   : 'API key tidak valid (hubungi admin).',
        BANNED    : 'Akun API diblokir (hubungi admin).',
        ERROR_SQL : 'Kesalahan server upstream.',
      };
      const msg = ERROR_MAP[raw] ?? `Gagal mengambil aktivasi: ${raw}`;
      return NextResponse.json({ error: msg, code: raw }, { status: 422 });
    }

    // HeroSMS bisa return: array langsung, atau { activeActivations: [...] }
    const items: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.activeActivations)
        ? raw.activeActivations
        : [];

    const activations = items.map((item: any) => {
      // Normalkan field — HeroSMS kadang pakai camelCase, kadang snake_case
      const activationId = String(item.id ?? item.activationId ?? '');
      const phone        = String(item.phone ?? item.phoneNumber ?? '');
      const service      = String(item.service ?? item.serviceCode ?? '');
      const statusRaw    = String(item.status ?? 'STATUS_WAIT_CODE');
      const createdAt    = item.created_at ?? item.createdAt ?? null;

      // Harga dari API (dalam USD) → markup ke IDR
      const priceIDR =
        typeof item.sum === 'number' && item.sum > 0
          ? applyMarkup(item.sum)
          : typeof item.cost === 'number' && item.cost > 0
            ? applyMarkup(item.cost)
            : null;

      // OTP sudah masuk jika status STATUS_OK:{kode}
      let otpCode: string | null = null;
      let normalizedStatus = statusRaw;

      if (statusRaw.startsWith('STATUS_OK:')) {
        otpCode          = statusRaw.split(':')[1] ?? null;
        normalizedStatus = 'STATUS_OK';
      }

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

    // Urutkan: yang masih menunggu OTP di atas, yang sudah OK/cancel di bawah
    const ORDER: Record<string, number> = {
      STATUS_WAIT_CODE   : 0,
      STATUS_WAIT_RESEND : 1,
      STATUS_OK          : 2,
      STATUS_CANCEL      : 3,
    };

    activations.sort(
      (a, b) =>
        (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9)
    );

    return NextResponse.json(activations);

  } catch (err) {
    console.error('[GET /api/activations]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}