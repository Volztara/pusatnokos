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
  // ── Auth ──────────────────────────────────────────────────────────
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url);
    const secret       = searchParams.get('secret') ?? '';
    const authHeader   = request.headers.get('authorization') ?? '';
    const bearerSecret = authHeader.replace('Bearer ', '');
    if (secret !== CRON_SECRET && bearerSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime     = Date.now();
  let cancelled       = 0;
  let errors          = 0;
  let depositRejected = 0; // ← declare di luar try agar bisa diakses di catch

  try {
    // ── 1. Expire + refund ATOMIK via SQL ─────────────────────────────
    // SQL function sudah handle: UPDATE orders, UPDATE profiles (balance), INSERT mutations
    // Tidak perlu refund lagi di sini
    const { data: expiredOrders, error: dbErr } = await db
      .rpc('expire_and_refund_orders', { p_batch_size: 100 });

    if (dbErr) throw dbErr;

    // ── 2. Auto-reject deposit pending_payment > 30 menit ─────────────
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
        refunded : 0,
        cancelled: 0,
        errors   : 0,
        depositRejected,
        message  : 'Tidak ada order expired.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[cron] Refunded ${expiredOrders.length} expired orders via SQL`);

    // ── 3. Cancel di HeroSMS saja (refund sudah dilakukan SQL) ────────
    for (const order of expiredOrders) {
      const { activation_id } = order;

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
            cancelText.startsWith('ACCESS_ALREADY_USED')
          ) {
            cancelled++;
          } else {
            console.warn(`[cron] HeroSMS cancel for ${activation_id}: ${cancelText}`);
          }
        } catch (e) {
          console.error(`[cron] HeroSMS cancel failed for ${activation_id}:`, e);
          errors++;
        }
      }

      await new Promise(r => setTimeout(r, 50));
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[cron] Done in ${elapsed}ms — ` +
      `refunded:${expiredOrders.length} cancelled:${cancelled} ` +
      `errors:${errors} depositRejected:${depositRejected}`
    );

    return NextResponse.json({
      refunded : expiredOrders.length,
      cancelled,
      errors,
      depositRejected,
      elapsed  : `${elapsed}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[cron] Fatal error:', err);
    return NextResponse.json(
      { error: 'Cron job gagal.', depositRejected, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}