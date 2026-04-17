// src/app/api/cron/route.ts
import { NextResponse } from 'next/server';
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
  let cancelled = 0;
  let refunded  = 0;
  let skipped   = 0;
  let errors    = 0;

  try {
    // ── 1. Ambil order waiting yang sudah > 20 menit ─────────────────
    const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: expiredOrders, error: dbErr } = await db
      .from('orders')
      .select('id, activation_id, user_id, price, service_name')
      .eq('status', 'waiting')
      .lt('created_at', cutoff);

    if (dbErr) throw dbErr;

    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({
        cancelled: 0, refunded: 0, skipped: 0, errors: 0,
        message  : 'Tidak ada order expired.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[cron] Found ${expiredOrders.length} expired orders`);

    for (const order of expiredOrders) {
      const { activation_id, user_id, price, service_name } = order;

      // ── 2. Cancel di HeroSMS ───────────────────────────────────────
      if (activation_id) {
        try {
          const cancelRes  = await fetch(
            `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${activation_id}&status=8`,
            { cache: 'no-store' }
          );
          const cancelText = (await cancelRes.text()).trim();
          if (cancelText.startsWith('ACCESS_CANCEL') || cancelText.startsWith('ACTIVATION_STATUS_CHANGED')) {
            cancelled++;
          } else {
            console.warn(`[cron] HeroSMS response for ${activation_id}: ${cancelText}`);
          }
        } catch (e) {
          console.error(`[cron] HeroSMS cancel failed for ${activation_id}:`, e);
          errors++;
        }
      }

      // ── 3. Update status order → expired (atomic, hanya jika masih waiting)
      // ✅ Idempotency: .eq('status', 'waiting') pastikan tidak di-update 2x
      const { data: updated, error: updateErr } = await db
        .from('orders')
        .update({ status: 'expired' })
        .eq('id', order.id)
        .eq('status', 'waiting') // ← atomic check
        .select('id');

      if (updateErr) {
        console.error(`[cron] Supabase update failed for order ${order.id}:`, updateErr);
        errors++;
        continue;
      }

      // Kalau 0 rows updated → order sudah di-handle sebelumnya, skip refund
      if (!updated || updated.length === 0) {
        skipped++;
        console.log(`[cron] Order ${order.id} sudah diproses sebelumnya, skip.`);
        continue;
      }

      // ── 4. Refund saldo user via atomic RPC ───────────────────────
      if (user_id && price > 0) {
        // Cari email user untuk RPC
        const { data: profile } = await db
          .from('profiles')
          .select('email')
          .eq('id', user_id)
          .single();

        if (profile?.email) {
          // ✅ Atomic update via RPC — tidak pakai read-then-write
          const { error: rpcErr } = await db.rpc('update_balance', {
            p_email : profile.email,
            p_amount: price,
          });

          if (!rpcErr) {
            await db.from('mutations').insert({
              user_id    : user_id,
              type       : 'in',
              amount     : price,
              description: `Refund Kadaluarsa: ${service_name}`,
              created_at : new Date().toISOString(),
            });
            refunded++;
            console.log(`[cron] Refunded Rp${price} to user ${user_id}`);
          } else {
            console.error(`[cron] RPC refund failed for user ${user_id}:`, rpcErr);
            errors++;
          }
        } else {
          skipped++;
        }
      }

      await new Promise(r => setTimeout(r, 100));
    }

    const elapsed = Date.now() - startTime;
    console.log(`[cron] Done in ${elapsed}ms — cancelled:${cancelled} refunded:${refunded} skipped:${skipped} errors:${errors}`);

    return NextResponse.json({
      cancelled,
      refunded,
      skipped,
      errors,
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