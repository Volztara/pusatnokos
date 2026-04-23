// src/app/api/deposit/crypto/webhook/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OXAPAY_MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY ?? '';

/**
 * POST /api/deposit/crypto/webhook
 * Oxapay kirim notifikasi ke sini saat pembayaran dikonfirmasi
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const data = JSON.parse(body);

    // ── Verifikasi HMAC signature dari Oxapay ─────────────────────────
    const receivedHmac = request.headers.get('hmac') ?? '';
    const expectedHmac = crypto
      .createHmac('sha512', OXAPAY_MERCHANT_KEY)
      .update(body)
      .digest('hex');

    if (receivedHmac !== expectedHmac) {
      console.warn('[webhook] Invalid HMAC signature');
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
    }

    const { trackId, status, amount, currency, orderId } = data;

    console.log(`[webhook] trackId=${trackId} status=${status}`);

    // ── Hanya proses jika status = Paid ───────────────────────────────
    if (status !== 'Paid') {
      // Update status di DB tapi tidak credit saldo
      await db
        .from('crypto_invoices')
        .update({ status: status.toLowerCase() })
        .eq('track_id', trackId);

      return NextResponse.json({ received: true });
    }

    // ── Cek invoice ada dan belum diproses (idempotency) ──────────────
    const { data: invoice } = await db
      .from('crypto_invoices')
      .select('*')
      .eq('track_id', trackId)
      .eq('status', 'waiting')   // hanya proses sekali
      .single();

    if (!invoice) {
      console.log(`[webhook] Invoice ${trackId} sudah diproses atau tidak ditemukan`);
      return NextResponse.json({ received: true });
    }

    // ── Update status invoice ─────────────────────────────────────────
    const { error: updateErr } = await db
      .from('crypto_invoices')
      .update({
        status      : 'paid',
        paid_at     : new Date().toISOString(),
        pay_amount  : amount,
        pay_currency: currency,
      })
      .eq('track_id', trackId)
      .eq('status', 'waiting');   // atomic guard

    if (updateErr) {
      console.error('[webhook] Failed to update invoice:', updateErr);
      return NextResponse.json({ error: 'DB error.' }, { status: 500 });
    }

    // ── Credit saldo user secara atomic ──────────────────────────────
    const { error: balanceErr } = await db.rpc('increment_balance', {
      p_user_id: invoice.user_id,
      p_amount : invoice.amount_idr,
    });

    if (balanceErr) {
      console.error('[webhook] Failed to credit balance:', balanceErr);
      return NextResponse.json({ error: 'Balance update failed.' }, { status: 500 });
    }

    // ── Catat mutasi deposit ──────────────────────────────────────────
    await db.from('mutations').insert({
      user_id    : invoice.user_id,
      type       : 'in',
      amount     : invoice.amount_idr,
      description: `Crypto Deposit (${currency}) — ${trackId}`,
    });

    // ── Catat ke deposit_requests untuk riwayat ──────────────────────
    await db.from('deposit_requests').insert({
      user_id   : invoice.user_id,
      amount    : invoice.amount_idr,
      method    : `crypto_${currency?.toLowerCase() ?? 'unknown'}`,
      status    : 'approved',
      admin_note: `Auto-approved via Oxapay. TrackID: ${trackId}`,
    });

    console.log(`[webhook] ✅ Credited Rp${invoice.amount_idr} to user ${invoice.user_id}`);

    return NextResponse.json({ received: true, credited: true });

  } catch (err) {
    console.error('[webhook] Fatal error:', err);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}