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
    // ── 1. Ambil semua order waiting yang sudah expired dari Supabase ──
    const cutoff = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    const { data: expiredOrders, error: dbErr } = await db
      .from('orders')
      .select('id, activation_id, email, price, service_name')
      .eq('status', 'waiting')
      .lt('created_at', cutoff);

    if (dbErr) throw dbErr;
    if (!expiredOrders || expiredOrders.length === 0) {
      return NextResponse.json({
        cancelled: 0, refunded: 0, skipped: 0, errors: 0,
        message: 'Tidak ada order expired.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[cron] Found ${expiredOrders.length} expired orders`);

    for (const order of expiredOrders) {
      const activationId = order.activation_id;

      // ── 2. Cancel di HeroSMS ───────────────────────────────────────
      if (activationId) {
        try {
          const cancelRes  = await fetch(
            `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${activationId}&status=8`,
            { cache: 'no-store' }
          );
          const cancelText = (await cancelRes.text()).trim();
          if (cancelText.startsWith('ACCESS_CANCEL') || cancelText.startsWith('ACTIVATION_STATUS_CHANGED')) {
            cancelled++;
            console.log(`[cron] ✅ HeroSMS cancelled ${activationId}`);
          } else {
            console.warn(`[cron] ⚠️ HeroSMS response for ${activationId}: ${cancelText}`);
          }
        } catch (e) {
          console.error(`[cron] ❌ HeroSMS cancel failed for ${activationId}:`, e);
          errors++;
        }
      }

      // ── 3. Update status di Supabase → expired ─────────────────────
      const { error: updateErr } = await db
        .from('orders')
        .update({ status: 'expired' })
        .eq('id', order.id);

      if (updateErr) {
        console.error(`[cron] ❌ Supabase update failed for order ${order.id}:`, updateErr);
        errors++;
        continue;
      }

      // ── 4. Refund saldo user ───────────────────────────────────────
      if (order.email && order.price > 0) {
        const { data: profile } = await db
          .from('profiles')
          .select('balance')
          .eq('email', order.email)
          .single();

        if (profile) {
          const newBalance = (profile.balance ?? 0) + order.price;
          const { error: balErr } = await db
            .from('profiles')
            .update({ balance: newBalance })
            .eq('email', order.email);

          if (!balErr) {
            // Catat mutasi refund
            await db.from('mutations').insert({
              email      : order.email,
              type       : 'in',
              amount     : order.price,
              description: `Refund Kadaluarsa: ${order.service_name}`,
              created_at : new Date().toISOString(),
            });
            refunded++;
            console.log(`[cron] 💰 Refunded Rp${order.price} to ${order.email}`);
          } else {
            console.error(`[cron] ❌ Refund failed for ${order.email}:`, balErr);
            errors++;
          }
        }
      }

      // Rate limit — jangan spam Supabase/HeroSMS
      await new Promise(r => setTimeout(r, 100));
    }

    const elapsed = Date.now() - startTime;
    console.log(`[cron] Done in ${elapsed}ms — cancelled: ${cancelled}, refunded: ${refunded}, skipped: ${skipped}, errors: ${errors}`);

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