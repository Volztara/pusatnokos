// src/app/api/deposit/paymenku/webhook/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PAYMENKU_KEY     = process.env.PAYMENKU_API_KEY ?? '';
// ✅ FIX: Secret khusus untuk verifikasi webhook Paymenku
// Set di .env: PAYMENKU_WEBHOOK_SECRET=xxx (ambil dari dashboard Paymenku)
const WEBHOOK_SECRET   = process.env.PAYMENKU_WEBHOOK_SECRET ?? '';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();

    // ✅ FIX: Verifikasi signature Paymenku SEBELUM proses apapun
    // Tanpa ini, siapapun bisa kirim fake webhook dan credit saldo gratis!
    if (WEBHOOK_SECRET) {
      // Paymenku mengirim signature di header X-Paymenku-Signature atau X-Signature
      const receivedSig = 
        req.headers.get('x-paymenku-signature') ?? 
        req.headers.get('x-signature') ?? '';

      const expectedSig = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      if (receivedSig !== expectedSig) {
        console.warn('[paymenku/webhook] Invalid signature — kemungkinan request palsu!');
        // Return 200 agar Paymenku tidak retry, tapi tidak proses
        return NextResponse.json({ ok: false, message: 'Invalid signature' }, { status: 200 });
      }
    } else {
      // ⚠️ WEBHOOK_SECRET belum di-set — log warning tapi tetap proses
      // Segera set PAYMENKU_WEBHOOK_SECRET di .env production!
      console.warn('[paymenku/webhook] ⚠️ PAYMENKU_WEBHOOK_SECRET belum di-set! Webhook tidak terverifikasi.');
    }

    const body = JSON.parse(rawBody);
    console.log('[paymenku/webhook]', JSON.stringify(body));

    const { event, trx_id, reference_id, status, amount_received } = body;

    // ✅ Validasi field wajib
    if (!trx_id || !status) {
      console.warn('[paymenku/webhook] Body tidak valid:', body);
      return NextResponse.json({ ok: true });
    }

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
      console.error('[paymenku/webhook] deposit request tidak ditemukan untuk trx_id:', trx_id);
      return NextResponse.json({ ok: true });
    }

    // ✅ Atomic idempotency guard — cegah double processing
    const { data: claimed } = await db
      .from('deposit_requests')
      .update({ status: 'approved', admin_note: `Otomatis via Paymenku. TrxID: ${trx_id}` })
      .eq('id', depositReq.id)
      .eq('status', 'pending_payment') // hanya proses sekali
      .select('id');

    if (!claimed || claimed.length === 0) {
      console.log('[paymenku/webhook] Already processed:', trx_id);
      return NextResponse.json({ ok: true, message: 'Already processed' });
    }

    const finalAmount = depositReq.amount;

    // Ambil email user
    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('id', depositReq.user_id)
      .single();

    if (!profile?.email) {
      console.error('[paymenku/webhook] profil user tidak ditemukan:', depositReq.user_id);
      return NextResponse.json({ ok: true });
    }

    // ✅ Credit saldo via RPC atomic
    const { error: rpcErr } = await db.rpc('update_balance', {
      p_email : profile.email,
      p_amount: finalAmount,
    });

    if (rpcErr) {
      console.error('[paymenku/webhook] RPC update_balance gagal:', rpcErr);
      // ⚠️ Rollback deposit status supaya bisa diproses ulang
      await db
        .from('deposit_requests')
        .update({ status: 'pending_payment', admin_note: 'RPC gagal, perlu retry' })
        .eq('id', depositReq.id);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    // Catat mutasi
    await db.from('mutations').insert({
      user_id    : depositReq.user_id,
      type       : 'in',
      amount     : finalAmount,
      description: `Deposit Otomatis via Paymenku (${reference_id})`,
    });

    console.log(`[paymenku/webhook] ✅ Saldo user ${depositReq.user_id} bertambah Rp ${finalAmount}`);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error('[POST /api/deposit/paymenku/webhook]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}