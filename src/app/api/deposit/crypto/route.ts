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
 * Body: { email, amount }
 * amount = nominal dalam IDR
 */
export async function POST(request: Request) {
  try {
    const { email, amount } = await request.json();

    if (!email || !amount || amount < 10000) {
      return NextResponse.json(
        { error: 'Invalid request. Minimum deposit is Rp 10,000.' },
        { status: 400 }
      );
    }

    // Ambil user_id dari email
    const { data: profile } = await db
      .from('profiles')
      .select('id, is_blacklisted')
      .eq('email', email.toLowerCase())
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

    // Konversi IDR → USD (ambil dari admin_settings atau hardcode rate)
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
        merchant    : OXAPAY_API_KEY,
        amount      : amountUSD,
        currency    : 'USD',
        lifeTime    : 30,                           // 30 menit
        feePaidByPayer: 0,                          // fee ditanggung merchant
        callbackUrl : `${process.env.NEXT_PUBLIC_APP_URL}/api/deposit/crypto/webhook`,
        returnUrl   : `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
        description : `Deposit Pusat Nokos - ${email}`,
        orderId     : `${profile.id}_${Date.now()}`,
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

    // Simpan invoice ke DB untuk tracking
    await db.from('crypto_invoices').insert({
      user_id    : profile.id,
      track_id   : invoiceData.trackId,
      order_id   : `${profile.id}_${Date.now()}`,
      amount_idr : amount,
      amount_usd : amountUSD,
      status     : 'waiting',
      pay_link   : invoiceData.payLink,
    });

    return NextResponse.json({
      success : true,
      trackId : invoiceData.trackId,
      payLink : invoiceData.payLink,  // URL halaman pembayaran Oxapay
      amountUSD,
      amountIDR: amount,
      expiresIn: 30, // menit
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
 * Cek status invoice
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const trackId = searchParams.get('trackId');

    if (!trackId) {
      return NextResponse.json({ error: 'trackId required.' }, { status: 400 });
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

    // Status Oxapay: Waiting, Confirming, Paid, Expired, Error
    return NextResponse.json({
      status   : data.status ?? 'unknown',
      amountPaid: data.payAmount,
      currency : data.payCurrency,
    });

  } catch (err) {
    console.error('[GET /api/deposit/crypto]', err);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}