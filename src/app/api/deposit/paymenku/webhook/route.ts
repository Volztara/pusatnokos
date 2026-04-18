// src/app/api/deposit/paymenku/webhook/route.ts

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('[paymenku/webhook]', JSON.stringify(body));

    const { event, trx_id, reference_id, status, amount_received } = body;

    if (event !== 'payment.status_updated') {
      return NextResponse.json({ ok: true });
    }

    if (status !== 'paid') {
      await db
        .from('deposit_requests')
        .update({ status: 'rejected', admin_note: `Paymenku: ${status}` })
        .like('note', `%trx:${trx_id}%`);
      return NextResponse.json({ ok: true });
    }

    // Ambil deposit request
    const { data: depositReq } = await db
      .from('deposit_requests')
      .select('id, user_id, amount, status')
      .like('note', `%trx:${trx_id}%`)
      .single();

    if (!depositReq) {
      console.error('[webhook] deposit request tidak ditemukan untuk trx_id:', trx_id);
      return NextResponse.json({ ok: true });
    }

    // ✅ Cegah double processing secara atomic
    const { data: claimed } = await db
      .from('deposit_requests')
      .update({ status: 'approved', admin_note: `Otomatis via Paymenku. TrxID: ${trx_id}` })
      .eq('id', depositReq.id)
      .eq('status', 'pending_payment') // hanya update jika masih pending
      .select('id');

    if (!claimed || claimed.length === 0) {
      console.log('[webhook] Already processed:', trx_id);
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    const finalAmount = amount_received
      ? Math.floor(parseFloat(amount_received))
      : depositReq.amount;

    // ✅ Tambah saldo via RPC atomic (tidak pakai read-then-write)
    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('id', depositReq.user_id)
      .single();

    if (!profile?.email) {
      console.error('[webhook] profil user tidak ditemukan:', depositReq.user_id);
      return NextResponse.json({ ok: true });
    }

    const { error: rpcErr } = await db.rpc('update_balance', {
      p_email : profile.email,
      p_amount: finalAmount,
    });

    if (rpcErr) {
      console.error('[webhook] RPC update_balance gagal:', rpcErr);
      return NextResponse.json({ ok: true });
    }

    // ✅ Catat ke mutations (bukan mutasi!)
    await db.from('mutations').insert({
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
