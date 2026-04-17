// src/app/api/admin/stats/route.ts
import { NextResponse } from 'next/server';
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
    db.from('mutations')
      .select('amount, orders!inner(status)')
      .eq('type', 'out')
      .neq('orders.status', 'cancelled'),
    db.from('mutations')
      .select('amount, orders!inner(status)')
      .eq('type', 'out')
      .gte('created_at', todayISO)
      .neq('orders.status', 'cancelled'),
    db.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ]);

  const totalRevenue = (revenueData ?? []).reduce((s: number, m: any) => s + (m.amount ?? 0), 0);
  const todayRevenue = (revenueToday ?? []).reduce((s: number, m: any) => s + (m.amount ?? 0), 0);

  // Revenue 7 hari terakhir untuk chart
  const days7: { date: string; revenue: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const { data } = await db.from('mutations')
      .select('amount, orders!inner(status)')
      .eq('type', 'out')
      .neq('orders.status', 'cancelled')
      .gte('created_at', d.toISOString())
      .lt('created_at', next.toISOString());
    days7.push({ date: d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }), revenue: (data ?? []).reduce((s: number, m: any) => s + (m.amount ?? 0), 0) });
  }

  return NextResponse.json({ totalUsers, totalOrders, ordersToday, activeOrders, totalRevenue, todayRevenue, newUsersToday, chart: days7 });
}