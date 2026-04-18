// src/app/api/admin/revenue/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') ?? '30d';
  const days   = period === '7d' ? 7 : period === '90d' ? 90 : 30;

  const from = new Date();
  from.setDate(from.getDate() - days);

  // Chart data per hari — hanya dari order SUCCESS
  const chart: { date: string; revenue: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d    = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(next.getDate() + 1);

    const { data: successOrders, count: orderCount } = await db
      .from('orders')
      .select('price', { count: 'exact' })
      .eq('status', 'success')
      .gte('created_at', d.toISOString())
      .lt('created_at', next.toISOString());

    const revenue = (successOrders ?? []).reduce((s: number, o: any) => s + (o.price ?? 0), 0);
    chart.push({
      date   : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      revenue,
      orders : orderCount ?? 0,
    });
  }

  // Summary
  const total       = chart.reduce((s, d) => s + d.revenue, 0);
  const avgPerDay   = Math.round(total / days);
  const totalOrders = chart.reduce((s, d) => s + d.orders, 0);
  const bestEntry   = chart.reduce((a, b) => b.revenue > a.revenue ? b : a, chart[0] ?? { date: '', revenue: 0 });

  // Top services — hanya dari order SUCCESS
  const { data: orderData } = await db
    .from('orders')
    .select('service_name, price')
    .gte('created_at', from.toISOString())
    .eq('status', 'success');

  const svcMap: Record<string, { count: number; revenue: number }> = {};
  for (const o of (orderData ?? [])) {
    if (!svcMap[o.service_name]) svcMap[o.service_name] = { count: 0, revenue: 0 };
    svcMap[o.service_name].count++;
    svcMap[o.service_name].revenue += o.price ?? 0;
  }

  const topServices = Object.entries(svcMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return NextResponse.json({
    chart,
    summary: { total, avgPerDay, totalOrders, bestDay: bestEntry?.date ?? '', bestAmount: bestEntry?.revenue ?? 0 },
    topServices,
  });
}