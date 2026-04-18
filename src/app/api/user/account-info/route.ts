// src/app/api/user/account-info/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/account-info?email=xxx
 * Ambil info akun: tanggal daftar, total order, total spend
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email) return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, created_at')
    .eq('email', email)
    .single();

  if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

  // Total order (exclude cancelled)
  const { count: totalOrders } = await supabaseAdmin
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .neq('status', 'cancelled');

  // Total spend dari mutasi out (exclude cancelled)
  const { data: spendData } = await supabaseAdmin
    .from('mutations')
    .select('amount, orders!inner(status)')
    .eq('user_id', profile.id)
    .eq('type', 'out')
    .neq('orders.status', 'cancelled');

  const totalSpend = (spendData ?? []).reduce((s: number, m: any) => s + (m.amount ?? 0), 0);

  return NextResponse.json({
    joinedAt    : profile.created_at,
    totalOrders : totalOrders ?? 0,
    totalSpend,
  });
}
