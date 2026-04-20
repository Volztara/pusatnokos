// src/app/api/admin/users/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — daftar semua user dengan stats
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));
  const search = searchParams.get('search') ?? '';

  let query = db.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page-1)*limit, page*limit-1);
  if (search) query = query.ilike('email', `%${search}%`);

  const { data: users, count } = await query;

  // Ambil semua orders sekaligus (1 query, bukan N query per user)
  const userIds = (users ?? []).map((u: any) => u.id);

  const { data: allOrders } = await db
    .from('orders')
    .select('user_id, price, status')
    .in('user_id', userIds);

  // Hitung orderCount & totalSpend per user di memori (tanpa loop async)
  const enriched = (users ?? []).map((u: any) => {
    const userOrders = (allOrders ?? []).filter((o: any) => o.user_id === u.id);
    const orderCount = userOrders.filter((o: any) => o.status !== 'cancelled').length;
    const totalSpend = userOrders
      .filter((o: any) => o.status === 'success')
      .reduce((s: number, o: any) => s + (o.price ?? 0), 0);
    return { ...u, orderCount, totalSpend };
  });

  return NextResponse.json({ users: enriched, total: count ?? 0 });
}

// PATCH — update user (blacklist/unblacklist, ubah saldo)
export async function PATCH(req: Request) {
  const { userId, action, value } = await req.json();
  if (!userId || !action) return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });

  if (action === 'blacklist') {
    await db.from('profiles').update({ is_blacklisted: value }).eq('id', userId);
    try {
      await db.from('admin_logs').insert({ action: value ? 'blacklist_user' : 'unblacklist_user', target_id: userId, details: `User ${value ? 'diblokir' : 'dibuka blokir'}` });
    } catch {}
    return NextResponse.json({ success: true });
  }

  if (action === 'set_balance') {
    // Ambil saldo lama untuk hitung selisih mutasi
    const { data: profile } = await db.from('profiles').select('balance, email').eq('id', userId).single();
    const oldBalance = profile?.balance ?? 0;
    const diff = value - oldBalance;

    // Update saldo
    await db.from('profiles').update({ balance: value }).eq('id', userId);

    // Catat mutasi agar riwayat user tercatat
    if (diff !== 0) {
      try {
        await db.from('mutations').insert({
          user_id    : userId,
          type       : diff > 0 ? 'in' : 'out',
          amount     : Math.abs(diff),
          description: diff > 0
            ? `Penambahan saldo oleh admin (set ke ${value.toLocaleString('id-ID')})`
            : `Pengurangan saldo oleh admin (set ke ${value.toLocaleString('id-ID')})`,
        });
      } catch {}
    }

    try {
      await db.from('admin_logs').insert({
        action   : 'set_balance',
        target_id: userId,
        details  : `Saldo diubah dari ${oldBalance} → ${value} (selisih: ${diff >= 0 ? '+' : ''}${diff})`,
      });
    } catch {}
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Action tidak valid.' }, { status: 400 });
}