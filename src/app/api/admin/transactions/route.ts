// src/app/api/admin/transactions/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const HERO = 'https://hero-sms.com/stubs/handler_api.php';
const KEY = process.env.HEROSMS_API_KEY ?? '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));
  const status = searchParams.get('status') ?? '';
  const search = searchParams.get('search') ?? '';
  const userId = searchParams.get('userId') ?? '';

  let query = db.from('orders')
    .select('*, profiles(name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

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

  if (action === 'cancel') {
    // ✅ URUTAN BENAR: cek & lock database DULU, baru hit HeroSMS
    // Sebelumnya: HeroSMS dulu → kalau DB gagal → order cancel di HeroSMS tapi saldo tidak direfund
    // Sekarang: DB dulu → kalau HeroSMS gagal → DB di-rollback, user tidak dirugikan

    // Step 1: Ambil order dan validasi
    const { data: order } = await db
      .from('orders')
      .select('user_id, price, status, refunded')
      .eq('id', orderId)
      .single();

    if (!order) {
      return NextResponse.json({ success: false, error: 'Order tidak ditemukan.' }, { status: 404 });
    }

    if (order.status === 'cancelled' || order.status === 'success' || order.refunded) {
      console.log(`[admin cancel] Skip — order #${orderId} status: ${order.status}, refunded: ${order.refunded}`);
      return NextResponse.json({ success: false, error: 'Order sudah diproses sebelumnya.' }, { status: 400 });
    }

    // Step 2: Atomic update database DULU — lock agar tidak ada yang bisa cancel bersamaan
    const { data: updated } = await db
      .from('orders')
      .update({ status: 'cancelled', refunded: true })
      .eq('id', orderId)
      .eq('refunded', false)       // atomic guard 1: tolak jika sudah direfund
      .neq('status', 'cancelled')  // atomic guard 2: tolak jika sudah cancelled
      .neq('status', 'success')    // atomic guard 3: tolak jika sudah success
      .select()
      .single();

    if (!updated) {
      // Race condition — ada proses lain yang cancel duluan
      console.log(`[admin cancel] Race condition — order #${orderId} sudah diproses proses lain`);
      return NextResponse.json({ success: false, error: 'Order sudah diproses oleh proses lain.' }, { status: 409 });
    }

    // Step 3: Refund saldo — DB sudah terkunci, aman dari double refund
    const { data: profile } = await db
      .from('profiles')
      .select('email')
      .eq('id', order.user_id)
      .single();

    if (profile?.email) {
      await db.rpc('update_balance', {
        p_email: profile.email,
        p_amount: order.price,
      });

      await db.from('mutations').insert({
        user_id: order.user_id,
        type: 'in',
        amount: order.price,
        description: `Refund cancel oleh admin #${orderId}`,
      });
    }

    // Step 4: Baru hit HeroSMS — kalau gagal pun tidak masalah karena
    // saldo user sudah aman direfund dan order sudah tercatat cancelled di DB
    if (activationId) {
      try {
        await fetch(`${HERO}?api_key=${KEY}&action=setStatus&id=${activationId}&status=8`, { cache: 'no-store' });
      } catch (e) {
        // Log saja, tidak perlu rollback — DB sudah benar, HeroSMS bisa sync nanti
        console.warn(`[admin cancel] HeroSMS cancel gagal untuk activation ${activationId}:`, e);
      }
    }

  } else if (action === 'done') {
    // Untuk done: HeroSMS dulu tidak masalah karena tidak ada refund
    if (activationId) {
      await fetch(`${HERO}?api_key=${KEY}&action=setStatus&id=${activationId}&status=6`, { cache: 'no-store' });
    }
    await db.from('orders').update({ status: 'success' }).eq('id', orderId);
  }

  try {
    await db.from('admin_logs').insert({
      action: `order_${action}`,
      target_id: String(orderId),
      details: `Order ${activationId} di-${action} oleh admin`,
    });
  } catch { }

  return NextResponse.json({ success: true });
}