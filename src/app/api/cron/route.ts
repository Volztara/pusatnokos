// src/app/api/cron/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const API_KEY     = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL    = 'https://hero-sms.com/stubs/handler_api.php';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url);
    const secret       = searchParams.get('secret') ?? '';
    const authHeader   = request.headers.get('authorization') ?? '';
    const bearerSecret = authHeader.replace('Bearer ', '');
    if (secret !== CRON_SECRET && bearerSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  let cancelled       = 0;
  let refunded        = 0;
  let skipped         = 0;
  let errors          = 0;
  let doubleRefundPrevented = 0;

  try {
    // ── 1. Claim expired orders secara ATOMIK via SQL function ────────
    // UPDATE...RETURNING dalam satu query — eliminasi race condition
    // Semua negara ditangani (tidak ada filter country)
    const { data: expiredOrders, error: dbErr } = await db
      .rpc('expire_and_refund_orders');

    if (dbErr) throw dbErr;

    // ── Auto-reject deposit pending_payment > 30 menit ─────────────
    let depositRejected = 0;
    try {
      const depositCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: expiredDeposits } = await db
        .from('deposit_requests')
        .update({ status: 'rejected', admin_note: 'Auto-reject: tidak dibayar dalam 30 menit' })
        .eq('status', 'pending_payment')
        .lt('created_at', depositCutoff)
        .select('id');
      depositRejected = expiredDeposits?.length ?? 0;
      if (depositRejected > 0) {
        console.log(`[cron] Auto-rejected ${depositRejected} expired deposit requests`);
      }
    } catch (e) {
      console.error('[cron] Auto-reject deposit failed:', e);
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({
        cancelled: 0, refunded: 0, skipped: 0, errors: 0,
        doubleRefundPrevented: 0,
        depositRejected,
        message  : 'Tidak ada order expired.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[cron] Claimed ${expiredOrders.length} expired orders (all countries)`);

    for (const order of expiredOrders) {
      const { activation_id, user_id, price, service_name, country } = order;

      // ── 2. Anti double-refund: cek apakah sudah pernah di-refund ──
      // Cek di tabel mutations sebelum melakukan refund apapun
      if (activation_id && user_id) {
        try {
          const { data: existingRefund } = await db
            .from('mutations')
            .select('id')
            .eq('user_id', user_id)
            .eq('type', 'in')
            .ilike('description', `%#${activation_id}%`)
            .maybeSingle();

          if (existingRefund) {
            console.log(`[cron] SKIP double-refund: order ${activation_id} already refunded (mutation #${existingRefund.id})`);
            doubleRefundPrevented++;
            continue; // sudah di-refund, lewati
          }
        } catch (e) {
          console.error(`[cron] Double-refund check failed for ${activation_id}:`, e);
          // Lanjutkan dengan hati-hati
        }
      }

      // ── 3. Cancel di HeroSMS (semua negara) ────────────────────────
      // status=8 adalah cancel universal di HeroSMS API
      if (activation_id) {
        try {
          const cancelRes  = await fetch(
            `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${activation_id}&status=8`,
            { cache: 'no-store', signal: AbortSignal.timeout(5000) }
          );
          const cancelText = (await cancelRes.text()).trim();
          if (
            cancelText.startsWith('ACCESS_CANCEL') ||
            cancelText.startsWith('ACTIVATION_STATUS_CHANGED') ||
            cancelText.startsWith('ACCESS_ALREADY_USED') // sudah dipakai, tetap lanjut refund
          ) {
            cancelled++;
          } else {
            // Log tapi tetap lanjut refund — jangan blokir refund karena HeroSMS
            console.warn(`[cron] HeroSMS cancel for ${activation_id} (country:${country ?? '?'}): ${cancelText}`);
            // Tetap lanjut ke refund
          }
        } catch (e) {
          // Timeout/network error — tetap lanjut refund user
          console.error(`[cron] HeroSMS cancel failed for ${activation_id}:`, e);
          errors++;
          // TIDAK return/continue — user tetap harus dapat refund
        }
      }

      // ── 4. Refund saldo user (semua negara) ────────────────────────
      if (user_id && price > 0) {
        try {
          const { data: profile } = await db
            .from('profiles')
            .select('email')
            .eq('id', user_id)
            .single();

          if (!profile?.email) {
            console.warn(`[cron] Profile not found for user ${user_id}, skipping refund`);
            skipped++;
            continue;
          }

          // Gunakan update_balance RPC (atomic)
          const { error: rpcErr } = await db.rpc('update_balance', {
            p_email : profile.email,
            p_amount: price,
          });

          if (rpcErr) {
            console.error(`[cron] RPC update_balance failed for user ${user_id}:`, rpcErr);
            errors++;
            continue;
          }

          // Catat mutasi refund dengan activation_id di description
          // (dipakai oleh anti double-refund check di atas)
          const { error: mutErr } = await db.from('mutations').insert({
            user_id    : user_id,
            type       : 'in',
            amount     : price,
            description: `Refund Kadaluarsa: ${service_name} #${activation_id}`,
            created_at : new Date().toISOString(),
          });

          if (mutErr) {
            // Refund sudah masuk tapi mutasi gagal dicatat — log saja
            console.error(`[cron] Mutation insert failed for ${activation_id}:`, mutErr);
          }

          refunded++;
          console.log(`[cron] Refunded Rp${price} to user ${user_id} (${service_name} | country:${country ?? 'ID'} | #${activation_id})`);

        } catch (e) {
          console.error(`[cron] Refund error for user ${user_id}:`, e);
          errors++;
        }
      } else {
        if (price <= 0) console.log(`[cron] Skip refund: price=0 for ${activation_id}`);
        skipped++;
      }

      // Delay kecil antar order agar tidak spam DB
      await new Promise(r => setTimeout(r, 80));
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[cron] Done in ${elapsed}ms — ` +
      `cancelled:${cancelled} refunded:${refunded} skipped:${skipped} ` +
      `errors:${errors} doubleRefundPrevented:${doubleRefundPrevented} depositRejected:${depositRejected}`
    );

    return NextResponse.json({
      cancelled,
      refunded,
      skipped,
      errors,
      doubleRefundPrevented,
      depositRejected,
      total    : expiredOrders.length,
      elapsed  : `${elapsed}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[cron] Fatal error:', err);
    return NextResponse.json(
      { error: 'Cron job gagal.', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}