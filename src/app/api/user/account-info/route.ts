// src/app/api/user/account-info/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Email dari middleware (JWT terverifikasi) — tidak dari URL param
  const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

  const { data: profile } = await db
    .from('profiles').select('id, created_at').eq('email', email).single();
  if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

  const uid = profile.id;

  const [
    { count: totalOrders },
    { count: successOrders },
    { data: spendOrders },
    { data: depositMut },
  ] = await Promise.all([
    db.from('orders').select('*', { count: 'exact', head: true })
      .eq('user_id', uid).neq('status', 'cancelled'),
    db.from('orders').select('*', { count: 'exact', head: true })
      .eq('user_id', uid).eq('status', 'success'),
    db.from('orders').select('price')
      .eq('user_id', uid).eq('status', 'success'),
    db.from('mutations').select('amount')
      .eq('user_id', uid).eq('type', 'in'),
  ]);

  const totalSpend   = (spendOrders ?? []).reduce((s: number, o: Record<string, unknown>) => s + (Number(o.price) || 0), 0);
  const totalDeposit = (depositMut ?? []).reduce((s: number, m: Record<string, unknown>) => s + (Number(m.amount) || 0), 0);
  const tOrders      = totalOrders  ?? 0;
  const sOrders      = successOrders ?? 0;
  const successRate  = tOrders > 0 ? Math.round((sOrders / tOrders) * 100) : 0;

  return NextResponse.json({
    joinedAt     : profile.created_at,
    totalOrders  : tOrders,
    successOrders: sOrders,
    successRate,
    totalSpend,
    totalDeposit,
  });
}