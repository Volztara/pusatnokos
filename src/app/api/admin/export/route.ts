// src/app/api/admin/export/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET /api/admin/export?type=users|transactions&from=2025-01-01&to=2025-12-31
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'transactions';
  const from = searchParams.get('from') ?? '';
  const to   = searchParams.get('to')   ?? '';

  let rows: any[] = [];
  let headers: string[] = [];

  if (type === 'users') {
    const { data } = await db.from('profiles').select('name, email, balance, created_at').order('created_at', { ascending: false });
    headers = ['Nama', 'Email', 'Saldo', 'Terdaftar'];
    rows = (data ?? []).map(u => [u.name, u.email, u.balance, new Date(u.created_at).toLocaleString('id-ID')]);
  } else {
    let query = db.from('orders').select('activation_id, service_name, phone, price, status, created_at, profiles(email)').order('created_at', { ascending: false });
    if (from) query = query.gte('created_at', from);
    if (to)   query = query.lte('created_at', to);
    const { data } = await query;
    headers = ['Activation ID', 'Layanan', 'Nomor', 'Harga', 'Status', 'Email User', 'Waktu'];
    rows = (data ?? []).map((o: any) => [o.activation_id, o.service_name, o.phone, o.price, o.status, (o.profiles as any)?.email ?? '', new Date(o.created_at).toLocaleString('id-ID')]);
  }

  const csv = [headers.join(','), ...rows.map(r => r.map((v: any) => `"${v}"`).join(','))].join('\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${type}-${Date.now()}.csv"` } });
}
