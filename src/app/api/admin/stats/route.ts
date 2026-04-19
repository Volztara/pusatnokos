// src/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayISO = today.toISOString();

  const [
    { count: totalUsers },
    { count: totalOrders },
    { count: ordersToday },
    { count: activeOrders },
    { data: revenueData },
    { data: revenueToday },
    { count: newUsersToday },
  ] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('orders').select('*', { count: 'exact', head: true }).in('status', ['waiting', 'success']),
    db.from('orders').select('*', { count: 'exact', head: true }).gte('created_at', todayISO).in('status', ['waiting', 'success']),
    db.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'waiting'),
    db.from('orders').select('price').eq('status', 'success'),
    db.from('orders').select('price').eq('status', 'success').gte('created_at', todayISO),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ]);

  const totalRevenue = (revenueData ?? []).reduce((s: number, o: any) => s + (o.price ?? 0), 0);
  const todayRevenue = (revenueToday ?? []).reduce((s: number, o: any) => s + (o.price ?? 0), 0);

  const days7: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const { data } = await db.from('orders')
      .select('price')
      .eq('status', 'success')
      .gte('created_at', d.toISOString())
      .lt('created_at', next.toISOString());
    days7.push({ date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }), revenue: (data ?? []).reduce((s: number, o: any) => s + (o.price ?? 0), 0) });
  }

  return NextResponse.json({ totalUsers, totalOrders, ordersToday, activeOrders, totalRevenue, todayRevenue, newUsersToday, chart: days7 });
}