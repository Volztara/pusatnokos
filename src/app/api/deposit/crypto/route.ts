// src/app/api/deposit/crypto/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OXAPAY_API_KEY  = process.env.OXAPAY_MERCHANT_KEY ?? '';
const OXAPAY_BASE_URL = 'https://api.oxapay.com';

/**
 * POST /api/deposit/crypto
 * Buat invoice crypto via Oxapay
 */
export async function POST(request: Request) {
  try {
    // ✅ FIX: Ambil dari header terverifikasi middleware
    // Sebelumnya pakai body.email yang bisa dipalsukan user
    const verifiedEmail  = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase() ?? '';
    const verifiedUserId = request.headers.get('X-Verified-User-Id')?.trim() ?? '';

    if (!verifiedEmail || !verifiedUserId) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const { amount } = await request.json();

    if (!amount || amount < 10000) {
      return NextResponse.json(
        { error: 'Invalid request. Minimum deposit is Rp 10,000.' },
        { status: 400 }
      );
    }

    // Ambil profil via user_id (bukan email dari body)
    const { data: profile } = await db
      .from('profiles')
      .select('id, is_blacklisted')
      .eq('id', verifiedUserId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (profile.is_blacklisted) {
      return NextResponse.json(
        { error: 'Your account has been suspended.' },
        { status: 403 }
      );
    }

    // Konversi IDR → USD
    const { data: rateData } = await db
      .from('admin_settings')
      .select('value')
      .eq('key', 'markup_config')
      .single();

    const idrRate: number = rateData?.value?.idrRate ?? 16000;
    const amountUSD = parseFloat((amount / idrRate).toFixed(2));

    if (amountUSD < 0.5) {
      return NextResponse.json(
        { error: 'Amount too small. Minimum $0.50 USD.' },
        { status: 400 }
      );
    }

    // Buat invoice di Oxapay
    const invoiceRes = await fetch(`${OXAPAY_BASE_URL}/merchants/request`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        merchant      : OXAPAY_API_KEY,
        amount        : amountUSD,
        currency      : 'USD',
        lifeTime      : 30,
        feePaidByPayer: 0,
        callbackUrl   : `${process.env.NEXT_PUBLIC_APP_URL}/api/deposit/crypto/webhook`,
        returnUrl     : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        description   : `Deposit Pusat Nokos - ${verifiedEmail}`,
        orderId       : `${verifiedUserId}_${Date.now()}`,
      }),
    });

    const invoiceData = await invoiceRes.json();

    if (invoiceData.result !== 100) {
      console.error('[crypto] Oxapay error:', invoiceData);
      return NextResponse.json(
        { error: 'Failed to create payment. Please try again.' },
        { status: 500 }
      );
    }

    // Simpan invoice ke DB
    await db.from('crypto_invoices').insert({
      user_id    : verifiedUserId,  // ✅ pakai verifiedUserId
      track_id   : invoiceData.trackId,
      order_id   : `${verifiedUserId}_${Date.now()}`,
      amount_idr : amount,
      amount_usd : amountUSD,
      status     : 'waiting',
      pay_link   : invoiceData.payLink,
    });

    return NextResponse.json({
      success  : true,
      trackId  : invoiceData.trackId,
      payLink  : invoiceData.payLink,
      amountUSD,
      amountIDR: amount,
      expiresIn: 30,
    });

  } catch (err) {
    console.error('[POST /api/deposit/crypto]', err);
    return NextResponse.json(
      { error: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/deposit/crypto?trackId=xxx
 * Cek status invoice — tidak butuh auth
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json({ error: 'trackId required.' }, { status: 400 });
    }

    // ✅ Validasi format trackId
    if (trackId.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(trackId)) {
      return NextResponse.json({ error: 'Format trackId tidak valid.' }, { status: 400 });
    }

    const res = await fetch(`${OXAPAY_BASE_URL}/merchants/inquiry`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        merchant: OXAPAY_API_KEY,
        trackId,
      }),
    });

    const data = await res.json();

    return NextResponse.json({
      status    : data.status ?? 'unknown',
      amountPaid: data.payAmount,
      currency  : data.payCurrency,
    });

  } catch (err) {
    console.error('[GET /api/deposit/crypto]', err);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}