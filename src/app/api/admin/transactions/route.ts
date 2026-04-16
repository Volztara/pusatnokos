// src/app/api/admin/transactions/route.ts
import { NextResponse } from 'next/server';
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

  let query = db.from('orders')
    .select('*, profiles(name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page-1)*limit, page*limit-1);

  if (status) query = query.eq('status', status);
  if (search) query = query.ilike('phone', `%${search}%`);

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

  // Update status di DB
  const newStatus = action === 'cancel' ? 'cancelled' : 'success';
  await db.from('orders').update({ status: newStatus }).eq('id', orderId);
  try {
    await db.from('admin_logs').insert({ action: `order_${action}`, target_id: String(orderId), details: `Order ${activationId} di-${action} oleh admin` });
  } catch {}

  // Refund saldo jika cancel
  if (action === 'cancel') {
    const { data: order } = await db.from('orders').select('user_id, price').eq('id', orderId).single();
    if (order) {
      const { data: profile } = await db.from('profiles').select('balance').eq('id', order.user_id).single();
      await db.from('profiles').update({ balance: (profile?.balance ?? 0) + order.price }).eq('id', order.user_id);
      await db.from('mutations').insert({ user_id: order.user_id, type: 'in', amount: order.price, description: 'Refund cancel oleh admin' });
    }
  }

  return NextResponse.json({ success: true });
}