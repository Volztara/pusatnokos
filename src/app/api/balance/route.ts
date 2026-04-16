// src/app/api/balance/route.ts
import { NextResponse } from 'next/server';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

/**
 * GET /api/balance
 *
 * Mengambil saldo akun HeroSMS saat ini.
 *
 * Response sukses:
 *   { balance: number, currency: string, raw: string }
 *
 * Response error:
 *   { error: string, code?: string }
 *
 * Contoh penggunaan di frontend:
 *   const { balance } = await fetch('/api/balance').then(r => r.json());
 *   // balance → 12345.67  (dalam USD)
 */
export async function GET() {
  try {
    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getBalance`,
      { cache: 'no-store' }          // selalu fresh, jangan cache saldo
    );

    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const text = (await res.text()).trim();

    // HeroSMS response: "ACCESS_BALANCE:{amount}"
    // Contoh: "ACCESS_BALANCE:12345.67"
    if (text.startsWith('ACCESS_BALANCE:')) {
      const raw     = text.split(':')[1] ?? '0';
      const balance = parseFloat(raw);

      return NextResponse.json({
        balance,          // number, dalam USD
        currency: 'USD',
        raw: text,        // raw string untuk debugging
      });
    }

    // Error resmi dari HeroSMS
    const ERROR_MAP: Record<string, string> = {
      BAD_KEY   : 'API key tidak valid (hubungi admin).',
      BANNED    : 'Akun API diblokir (hubungi admin).',
      ERROR_SQL : 'Kesalahan server upstream.',
    };

    const friendlyMsg = ERROR_MAP[text] ?? `Gagal mengambil saldo: ${text}`;
    return NextResponse.json({ error: friendlyMsg, code: text }, { status: 422 });

  } catch (err) {
    console.error('[GET /api/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}