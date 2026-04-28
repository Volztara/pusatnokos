// src/app/api/cron/route.ts
import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';
const CRON_SECRET = process.env.CRON_SECRET ?? '';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') ?? '';
    const authHeader = request.headers.get('authorization') ?? '';
    const bearerSecret = authHeader.replace('Bearer ', '');
    if (secret !== CRON_SECRET && bearerSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // ── Concurrent execution lock via Supabase ────────────────────────
  // Mencegah cron jalan 2x bersamaan (Vercel cron + manual trigger)
  // Lock expire otomatis setelah 2 menit kalau cron crash
  const LOCK_KEY = 'cron_running';
  const LOCK_TTL_MS = 2 * 60 * 1000;
  const now = Date.now();

  try {
    const { data: lockData } = await db
      .from('admin_settings')
      .select('value')
      .eq('key', LOCK_KEY)
      .single();

    if (lockData?.value?.startedAt) {
      const lockedAt = Number(lockData.value.startedAt);
      if (now - lockedAt < LOCK_TTL_MS) {
        console.log('[cron] Already running, skip.');
        return NextResponse.json({ message: 'Already running, skipped.' });
      }
    }

    // Set lock
    await db.from('admin_settings').upsert(
      { key: LOCK_KEY, value: { startedAt: now } },
      { onConflict: 'key' }
    );
  } catch (lockErr) {
    // Kalau lock gagal → lanjut saja, jangan block cron
    console.warn('[cron] Lock check failed, continuing anyway:', lockErr);
  }

  const startTime = Date.now();
  let cancelled = 0;
  let errors = 0;
  let depositRejected = 0;

  try {
    // ── 1. Expire + refund ATOMIK via SQL ─────────────────────────────
    // Proses semua expired sekaligus — tidak ada batas batch
    // SQL function handle: UPDATE orders, UPDATE profiles.balance, INSERT mutations
    const { data: expiredOrders, error: dbErr } = await db
      .rpc('expire_and_refund_orders', { p_batch_size: 500 });

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
      await db.from('admin_settings').upsert(
        { key: LOCK_KEY, value: { startedAt: 0 } },
        { onConflict: 'key' }
      );
      return NextResponse.json({
        refunded: 0,
        cancelled: 0,
        errors: 0,
        depositRejected,
        message: 'Tidak ada order expired.',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[cron] Refunded ${expiredOrders.length} expired orders via SQL`);

    // ── 3. Cancel di HeroSMS — parallel dengan concurrency limit ──────
    // Ganti sequential loop + 50ms delay dengan parallel requests
    // Max 10 request bersamaan → tidak overwhelm HeroSMS, tidak timeout
    const CONCURRENCY = 10;
    const chunks: typeof expiredOrders[] = [];
    for (let i = 0; i < expiredOrders.length; i += CONCURRENCY) {
      chunks.push(expiredOrders.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      const results = await Promise.allSettled(
        chunk
          .filter((o: any) => o.activation_id)
          .map(async (order: any) => {
            const cancelRes = await fetch(
              `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${order.activation_id}&status=8`,
              { cache: 'no-store', signal: AbortSignal.timeout(5000) }
            );
            const cancelText = (await cancelRes.text()).trim();
            return { activation_id: order.activation_id, text: cancelText };
          })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { activation_id, text } = result.value;
          if (
            text.startsWith('ACCESS_CANCEL') ||
            text.startsWith('ACTIVATION_STATUS_CHANGED') ||
            text.startsWith('ACCESS_ALREADY_USED')
          ) {
            cancelled++;
          } else {
            console.warn(`[cron] HeroSMS cancel for ${activation_id}: ${text}`);
            errors++;
          }
        } else {
          console.error('[cron] HeroSMS cancel failed:', result.reason);
          errors++;
        }
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(
      `[cron] Done in ${elapsed}ms — ` +
      `refunded:${expiredOrders.length} cancelled:${cancelled} ` +
      `errors:${errors} depositRejected:${depositRejected}`
    );

    return NextResponse.json({
      refunded: expiredOrders.length,
      cancelled,
      errors,
      depositRejected,
      elapsed: `${elapsed}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[cron] Fatal error:', err);
    return NextResponse.json(
      { error: 'Cron job gagal.', depositRejected, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  } finally {
    // ── Release lock — selalu dilepas meski ada error ─────────────
    try {
      await db.from('admin_settings').upsert(
        { key: LOCK_KEY, value: { startedAt: 0 } },
        { onConflict: 'key' }
      );
    } catch { }
  }
}