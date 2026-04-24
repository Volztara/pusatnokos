// src/app/api/admin/transactions/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db    = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const HERO  = 'https://hero-sms.com/stubs/handler_api.php';
const KEY   = process.env.HEROSMS_API_KEY ?? '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const userId = searchParams.get('userId') ?? '';

  let query = db.from('orders')
    .select('*, profiles(name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page-1)*limit, page*limit-1);

  if (status) query = query.eq('status', status);
  if (userId) query = query.eq('user_id', userId);
  if (search) {
    // Cari by nomor HP atau email user
    if (search.includes('@')) {
      // Kalau ada @, cari by email via profiles
      const { data: matchedProfiles } = await db
        .from('profiles')
        .select('id')
        .ilike('email', `%${search}%`);
      const ids = (matchedProfiles ?? []).map((p: any) => p.id);
      if (ids.length > 0) query = query.in('user_id', ids);
      else query = query.eq('user_id', 'no-match'); // tidak ada hasil
    } else {
      query = query.ilike('phone', `%${search}%`);
    }
  }

  const { data, count } = await query;
  return NextResponse.json({ transactions: data ?? [], total: count ?? 0 });
}

// PATCH — admin cancel/done order
export async function PATCH(req: Request) {
  const { activationId, action, orderId } = await req.json();

  // Cancel/done di HeroSMS
  if (activationId && action) {
    const code = action === 'cancel' ? 8 : 6;
    await fetch(`${HERO}?api_key=${KEY}&action=setStatus&id=${activationId}&status=${code}`, { cache: 'no-store' });
  }

  // ✅ Refund saldo jika cancel — dengan idempotency check
  if (action === 'cancel') {
    const { data: order } = await db
      .from('orders')
      .select('user_id, price, status, refunded') // ✅ FIX: tambah refunded
      .eq('id', orderId)
      .single();

    if (
      order &&
      order.status !== 'cancelled' &&  // ✅ belum di-cancel
      order.status !== 'success'  &&   // ✅ jangan cancel order yang sudah success
      !order.refunded                  // ✅ FIX: belum pernah direfund (cegah double refund dari cron)
    ) {
      // ✅ FIX: atomic update — set KEDUANYA status + refunded sekaligus
      // Ini mencegah cron expire refund lagi order yang sudah di-cancel admin
      const { data: updated } = await db
        .from('orders')
        .update({ status: 'cancelled', refunded: true }) // ✅ FIX: tambah refunded: true
        .eq('id', orderId)
        .eq('refunded', false)    // ✅ atomic guard 1
        .neq('status', 'cancelled') // ✅ atomic guard 2
        .select()
        .single();

      if (updated) {
        // ✅ Idempotency check via mutations
        const { data: existingRefund } = await db
          .from('mutations')
          .select('id')
          .eq('user_id', order.user_id)
          .eq('description', `Refund cancel oleh admin #${orderId}`)
          .limit(1);

        if (!existingRefund || existingRefund.length === 0) {
          const { data: profile } = await db
            .from('profiles')
            .select('email')
            .eq('id', order.user_id)
            .single();

          if (profile?.email) {
            await db.rpc('update_balance', {
              p_email : profile.email,
              p_amount: order.price,
            });

            await db.from('mutations').insert({
              user_id    : order.user_id,
              type       : 'in',
              amount     : order.price,
              description: `Refund cancel oleh admin #${orderId}`,
            });
          }
        }
      }
    } else if (order) {
      // ✅ FIX: log kenapa refund di-skip
      console.log(`[admin cancel] Skip refund order #${orderId} — status: ${order.status}, refunded: ${order.refunded}`);
    }
  } else {
    // Update status done/success
    await db.from('orders').update({ status: 'success' }).eq('id', orderId);
  }

  try {
    await db.from('admin_logs').insert({
      action   : `order_${action}`,
      target_id: String(orderId),
      details  : `Order ${activationId} di-${action} oleh admin`,
    });
  } catch {}

  return NextResponse.json({ success: true });
}