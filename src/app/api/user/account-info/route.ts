// src/app/api/user/account-info/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email) return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });

  const { data: profile } = await db
    .from('profiles').select('id, created_at').eq('email', email).single();

  if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

  const uid = profile.id;

  // Jalankan semua query paralel
  const [
    { count: totalOrders },
    { count: successOrders },
    { data: spendOrders },
    { data: depositMut },
  ] = await Promise.all([
    // Total order (exclude cancelled)
    db.from('orders').select('*', { count: 'exact', head: true })
      .eq('user_id', uid).neq('status', 'cancelled'),

    // Total sukses
    db.from('orders').select('*', { count: 'exact', head: true })
      .eq('user_id', uid).eq('status', 'success'),

    // Total belanja dari orders sukses (price_idr)
    db.from('orders').select('price')
      .eq('user_id', uid).eq('status', 'success'),

    // Total deposit dari mutasi in
    db.from('mutations').select('amount')
      .eq('user_id', uid).eq('type', 'in'),

  ]);

  // Total spend — hanya dari orders sukses saja
  const totalSpend = (spendOrders ?? []).reduce(
    (s: number, o: any) => s + (Number(o.price) || 0), 0
  );

  const totalDeposit = (depositMut ?? []).reduce(
    (s: number, m: any) => s + (Number(m.amount) || 0), 0
  );

  const tOrders  = totalOrders  ?? 0;
  const sOrders  = successOrders ?? 0;
  const successRate = tOrders > 0 ? Math.round((sOrders / tOrders) * 100) : 0;

  return NextResponse.json({
    joinedAt    : profile.created_at,
    totalOrders : tOrders,
    successOrders: sOrders,
    successRate,
    totalSpend,
    totalDeposit,
  });
}