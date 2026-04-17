// src/app/api/deposit/paymenku/webhook/route.ts
//
// Webhook dari Paymenku saat status transaksi berubah (paid/expired/cancelled).
// Jika paid → otomatis top up saldo user + update deposit_requests.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[paymenku/webhook]', JSON.stringify(body));

    const {
      event,
      trx_id,
      reference_id,
      status,
      amount,
      amount_received,
    } = body;

    // Hanya proses event payment
    if (event !== 'payment.status_updated') {
      return NextResponse.json({ ok: true });
    }

    if (status !== 'paid') {
      // Update status di DB tapi jangan tambah saldo
      await db
        .from('deposit_requests')
        .update({ status: status === 'expired' ? 'rejected' : 'rejected', admin_note: `Paymenku: ${status}` })
        .like('note', `%trx:${trx_id}%`);

      return NextResponse.json({ ok: true });
    }

    // Ambil deposit request berdasarkan trx_id di field note
    const { data: depositReq } = await db
      .from('deposit_requests')
      .select('id, user_id, amount, status')
      .like('note', `%trx:${trx_id}%`)
      .single();

    if (!depositReq) {
      console.error('[webhook] deposit request tidak ditemukan untuk trx_id:', trx_id);
      return NextResponse.json({ ok: true });
    }

    // Cegah double processing
    if (depositReq.status === 'approved') {
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    const finalAmount = amount_received ? Math.floor(parseFloat(amount_received)) : depositReq.amount;

    // Update status deposit request jadi approved
    await db
      .from('deposit_requests')
      .update({
        status    : 'approved',
        admin_note: `Otomatis via Paymenku. TrxID: ${trx_id}. Diterima: Rp ${finalAmount.toLocaleString('id-ID')}`,
      })
      .eq('id', depositReq.id);

    // Tambah saldo user
    const { data: profile } = await db
      .from('profiles')
      .select('balance')
      .eq('id', depositReq.user_id)
      .single();

    if (!profile) {
      console.error('[webhook] profil user tidak ditemukan:', depositReq.user_id);
      return NextResponse.json({ ok: true });
    }

    const newBalance = (profile.balance ?? 0) + finalAmount;

    await db
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', depositReq.user_id);

    // Catat ke mutasi
    await db.from('mutasi').insert({
      user_id    : depositReq.user_id,
      type       : 'in',
      amount     : finalAmount,
      description: `Deposit Otomatis via Paymenku (${reference_id})`,
    });

    console.log(`[webhook] Saldo user ${depositReq.user_id} bertambah Rp ${finalAmount}`);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[POST /api/deposit/paymenku/webhook]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}