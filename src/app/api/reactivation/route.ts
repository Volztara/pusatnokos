// src/app/api/reactivation/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
 * Cek harga reaktivasi. Tidak butuh auth — hanya cek harga.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  // ✅ FIX: Validasi format id — harus angka saja
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Format id tidak valid.' }, { status: 400 });
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
 * Reaktivasi nomor. Butuh auth — email diambil dari header terverifikasi middleware.
 */
export async function POST(request: Request) {
  try {
    // ✅ FIX: Ambil email dari header yang sudah diverifikasi middleware
    // Tidak lagi percaya body/header yang bisa dimanipulasi user
    const verifiedEmail = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
    if (!verifiedEmail) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const body = await request.json();
    const id   = (body.id ?? '').toString().trim();

    if (!id) {
      return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
    }

    // ✅ FIX: Validasi format id
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Format id tidak valid.' }, { status: 400 });
    }

    if (!API_KEY) {
      return NextResponse.json({ error: 'API key belum dikonfigurasi.' }, { status: 500 });
    }

    // ✅ FIX: Cek blacklist sebelum proses
    const { data: profile } = await db
      .from('profiles')
      .select('balance, is_blacklisted')
      .eq('email', verifiedEmail)
      .single();

    if (profile?.is_blacklisted) {
      return NextResponse.json(
        { error: 'Akun Anda telah dinonaktifkan. Hubungi support.' },
        { status: 403 }
      );
    }

    // 1. Ambil harga reaktivasi dulu
    let priceIDR = 0;
    let costUSD  = 0;
    try {
      const costRes = await fetch(
        `${BASE_URL}?api_key=${API_KEY}&action=getReactivationCost&id=${id}`,
        { cache: 'no-store' }
      );
      const costText = (await costRes.text()).trim();
      let costRaw: any = null;
      try { costRaw = JSON.parse(costText); } catch { costRaw = costText; }
      costUSD  = typeof costRaw?.cost === 'number' ? costRaw.cost
        : typeof costRaw === 'number' ? costRaw : 0;
      priceIDR = applyMarkup(costUSD);
    } catch { /* harga tidak kritis, lanjutkan */ }

    // ✅ FIX: Cek saldo SEBELUM order — cegah spam reactivation
    if (priceIDR > 0 && profile && profile.balance < priceIDR) {
      return NextResponse.json(
        { error: 'Saldo tidak cukup. Silakan deposit terlebih dahulu.' },
        { status: 402 }
      );
    }

    // ✅ FIX: Verifikasi bahwa activation_id ini milik user yang sedang login
    // Mencegah user reactivate order milik orang lain
    const { data: originalOrder } = await db
      .from('orders')
      .select('id, user_id, status')
      .eq('activation_id', id)
      .maybeSingle();

    if (originalOrder) {
      // Cek user_id cocok dengan user yang login
      const { data: ownerProfile } = await db
        .from('profiles')
        .select('id')
        .eq('email', verifiedEmail)
        .single();

      if (ownerProfile && originalOrder.user_id !== ownerProfile.id) {
        console.warn(`[reactivation] User ${verifiedEmail} coba reactivate order milik user lain (order #${originalOrder.id})`);
        return NextResponse.json(
          { error: 'Order tidak ditemukan.' },
          { status: 404 }
        );
      }
    }

    // 2. Request reaktivasi ke HeroSMS
    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getAdditionalService&id=${id}`,
      { cache: 'no-store' }
    );
    const text = (await res.text()).trim();

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