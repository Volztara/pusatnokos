// src/app/api/history/route.ts
import { NextResponse } from 'next/server';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
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
 * Map status string HeroSMS → status internal app.
 */
const STATUS_MAP: Record<string, string> = {
  // Aktif / menunggu
  '1'  : 'waiting',
  '2'  : 'wait_resend',
  // Selesai
  '6'  : 'success',
  // Dibatalkan / expired
  '8'  : 'cancelled',
  '10' : 'expired',
  // Alternatif string
  'STATUS_WAIT_CODE'   : 'waiting',
  'STATUS_WAIT_RESEND' : 'wait_resend',
  'STATUS_OK'          : 'success',
  'STATUS_CANCEL'      : 'cancelled',
};

const STATUS_LABEL: Record<string, string> = {
  waiting     : 'Menunggu OTP',
  wait_resend : 'Menunggu Kirim Ulang',
  success     : 'Berhasil',
  cancelled   : 'Dibatalkan',
  expired     : 'Kadaluarsa',
  unknown     : 'Tidak Diketahui',
};

function normalizeStatus(raw: string | number): { status: string; label: string } {
  const key    = String(raw);
  const status = STATUS_MAP[key] ?? (key.startsWith('STATUS_OK') ? 'success' : 'unknown');
  return { status, label: STATUS_LABEL[status] ?? key };
}

/**
 * GET /api/history?page=1&limit=20&service=wa&status=success
 *
 * Mengambil riwayat aktivasi (pesanan selesai maupun dibatalkan).
 *
 * Query params:
 *   page    — halaman (default: 1)
 *   limit   — jumlah per halaman (default: 20, max: 50)
 *   service — filter kode layanan, opsional
 *   status  — filter status: waiting | success | cancelled | expired
 *
 * Response sukses:
 *   {
 *     page      : number
 *     limit     : number
 *     total     : number | null
 *     items     : Array<{
 *       activationId : string
 *       phone        : string
 *       service      : string
 *       status       : string
 *       statusLabel  : string
 *       otpCode      : string | null
 *       priceIDR     : number | null
 *       createdAt    : string | null
 *     }>
 *   }
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
  const limit   = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const service = searchParams.get('service') ?? '';
  const statusFilter = searchParams.get('status') ?? '';

  try {
    // HeroSMS getActivationHistory — parameter: page, rowCount, service (opsional)
    const serviceParam = service ? `&service=${service}` : '';
    const url =
      `${BASE_URL}?api_key=${API_KEY}&action=getActivationHistory` +
      `&page=${page}&rowCount=${limit}${serviceParam}`;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const raw = await res.json();

    // Tangani error string
    if (typeof raw === 'string') {
      const ERROR_MAP: Record<string, string> = {
        BAD_KEY   : 'API key tidak valid (hubungi admin).',
        BANNED    : 'Akun API diblokir (hubungi admin).',
        ERROR_SQL : 'Kesalahan server upstream.',
      };
      const msg = ERROR_MAP[raw] ?? `Gagal mengambil riwayat: ${raw}`;
      return NextResponse.json({ error: msg, code: raw }, { status: 422 });
    }

    // Response format: { data: [...], totalRows: N }
    // atau flat array langsung
    const items: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.activations)
          ? raw.activations
          : [];

    const total: number | null =
      typeof raw?.totalRows  === 'number' ? raw.totalRows  :
      typeof raw?.total      === 'number' ? raw.total      :
      null;

    const mapped = items
      .map((item: any) => {
        const activationId = String(item.id ?? item.activationId ?? '');
        const phone        = String(item.phone ?? item.phoneNumber ?? '');
        const svc          = String(item.service ?? item.serviceCode ?? '');
        const rawStatus    = String(item.status ?? '');
        const { status, label: statusLabel } = normalizeStatus(rawStatus);
        const createdAt    = item.created_at ?? item.createdAt ?? null;

        // Ekstrak OTP jika ada
        let otpCode: string | null = null;
        if (rawStatus.startsWith('STATUS_OK:')) {
          otpCode = rawStatus.split(':')[1] ?? null;
        } else if (item.smsCode ?? item.otpCode) {
          otpCode = String(item.smsCode ?? item.otpCode);
        }

        const costUSD = item.sum ?? item.cost ?? null;
        const priceIDR = typeof costUSD === 'number' && costUSD > 0
          ? applyMarkup(costUSD)
          : null;

        return {
          activationId,
          phone,
          service    : svc,
          status,
          statusLabel,
          otpCode,
          priceIDR,
          createdAt  : createdAt ? String(createdAt) : null,
        };
      })
      // Filter status jika ada query param
      .filter(item => !statusFilter || item.status === statusFilter);

    return NextResponse.json({ page, limit, total, items: mapped });

  } catch (err) {
    console.error('[GET /api/history]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}