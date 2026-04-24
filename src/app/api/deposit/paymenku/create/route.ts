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
    // ✅ FIX: Ambil email dari header terverifikasi middleware
    // Sebelumnya pakai body.email yang bisa dipalsukan user
    const verifiedEmail  = req.headers.get('X-Verified-User-Email')?.trim().toLowerCase() ?? '';
    const verifiedUserId = req.headers.get('X-Verified-User-Id')?.trim() ?? '';

    if (!verifiedEmail || !verifiedUserId) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    const { amount, channelCode } = await req.json();

    if (!amount || amount < 5000) {
      return NextResponse.json(
        { error: 'Nominal minimal Rp 5.000.' },
        { status: 400 }
      );
    }

    // ✅ Cek blacklist
    const { data: profile } = await db
      .from('profiles')
      .select('id, name, is_blacklisted')
      .eq('id', verifiedUserId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    if (profile.is_blacklisted) {
      return NextResponse.json(
        { error: 'Akun Anda telah dinonaktifkan. Hubungi support.' },
        { status: 403 }
      );
    }

    // Hitung fee & total bayar
    const fee        = CHANNEL_FEE[channelCode] ?? CHANNEL_FEE['qris'];
    const totalFee   = Math.round(fee.flat + amount * fee.pct);
    const totalBayar = amount + totalFee;
    const saldoMasuk = amount;

    const referenceId = `NOKOS-${verifiedUserId}-${Date.now()}`;

    // Kirim ke Paymenku
    const payRes = await fetch(`${BASE_URL}/transaction/create`, {
      method : 'POST',
      headers: {
        'Authorization': `Bearer ${PAYMENKU_KEY}`,
        'Content-Type' : 'application/json',
      },
      body: JSON.stringify({
        reference_id   : referenceId,
        amount         : totalBayar,
        customer_name  : profile.name ?? verifiedEmail,
        customer_email : verifiedEmail,
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

    // Simpan deposit request
    await db.from('deposit_requests').insert({
      user_id  : verifiedUserId,  // ✅ pakai verifiedUserId, bukan dari body
      amount   : saldoMasuk,
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