// src/app/api/deposit/paymenku/create/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db           = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const PAYMENKU_KEY = process.env.PAYMENKU_API_KEY!;
const BASE_URL     = process.env.PAYMENKU_BASE_URL ?? 'https://paymenku.com/api/v1';
const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'https://pusatnokos.com';

// Fee per channel
const CHANNEL_FEE: Record<string, { flat: number; pct: number }> = {
  qris    : { flat: 200, pct: 0.007 },
  dana    : { flat: 200, pct: 0.03  },
  linkaja : { flat: 200, pct: 0.03  },
};

export async function POST(req: Request) {
  try {
    const { email, amount, channelCode } = await req.json();

    if (!email || !amount || amount < 5000) {
      return NextResponse.json(
        { error: 'Nominal minimal Rp 5.000.' },
        { status: 400 }
      );
    }

    // Hitung fee & total bayar
    const fee       = CHANNEL_FEE[channelCode] ?? CHANNEL_FEE['qris'];
    const totalFee  = Math.round(fee.flat + amount * fee.pct);
    const totalBayar = amount + totalFee; // yang dikirim ke Paymenku
    const saldoMasuk = amount;            // yang masuk ke akun user setelah bayar

    // Ambil profil user
    const { data: profile } = await db
      .from('profiles')
      .select('id, name')
      .eq('email', email.toLowerCase())
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const referenceId = `NOKOS-${profile.id}-${Date.now()}`;

    // Kirim totalBayar ke Paymenku (termasuk fee)
    const payRes = await fetch(`${BASE_URL}/transaction/create`, {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENKU_KEY}`,
        'Content-Type' : 'application/json',
      },
      body: JSON.stringify({
        reference_id   : referenceId,
        amount         : totalBayar,   // ← total bayar user (saldo + fee)
        customer_name  : profile.name ?? email,
        customer_email : email,
        channel_code   : channelCode ?? 'qris',
        return_url     : `${APP_URL}?deposit=success&ref=${referenceId}`,
      }),
    });

    const payData = await payRes.json();

    if (payData.status !== 'success' || !payData.data?.pay_url) {
      console.error('[paymenku/create]', payData);
      return NextResponse.json(
        { error: payData.message ?? 'Gagal membuat transaksi.' },
        { status: 500 }
      );
    }

    // Simpan saldoMasuk (bukan totalBayar) ke deposit_requests
    // Webhook akan tambah saldoMasuk ke akun user
    await db.from('deposit_requests').insert({
      user_id  : profile.id,
      amount   : saldoMasuk,  // ← saldo yang akan masuk ke user
      bank_name: `Paymenku - ${(channelCode ?? 'qris').toUpperCase()}`,
      proof_url: null,
      note     : `ref:${referenceId}|trx:${payData.data.trx_id}|fee:${totalFee}`,
      status   : 'pending_payment',
    });

    return NextResponse.json({
      success   : true,
      payUrl    : payData.data.pay_url,
      trxId     : payData.data.trx_id,
      referenceId,
    });

  } catch (err) {
    console.error('[POST /api/deposit/paymenku/create]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
