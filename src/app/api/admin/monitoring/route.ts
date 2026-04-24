// src/app/api/admin/monitoring/route.ts

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {

  // ── Rentang 7 hari ────────────────────────────────────────────────
  const since = new Date();
  since.setDate(since.getDate() - 7);
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  // ── 1. Ambil transaksi cancelled/expired 7 hari terakhir ──────────
  const { data: refundTxns, error: errTxns } = await db
    .from('orders')
    .select('user_id, price, status, created_at')
    .in('status', ['cancelled', 'expired'])
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: false });

  if (errTxns) {
    console.error('[monitoring] error:', errTxns);
    return NextResponse.json({ error: errTxns.message }, { status: 500 });
  }

  // ── 2. Grup per user ──────────────────────────────────────────────
  const userMap: Record<string, {
    user_id      : string;
    email        : string;
    saldo        : number;
    is_blacklisted: boolean;
    total_refund : number;
    jumlah_refund: number;
    total_deposit: number;
    rasio        : number;
  }> = {};

  for (const txn of refundTxns ?? []) {
    const uid = txn.user_id;
    if (!uid) continue;
    if (!userMap[uid]) {
      userMap[uid] = { user_id: uid, email: '', saldo: 0, is_blacklisted: false,
                       total_refund: 0, jumlah_refund: 0, total_deposit: 0, rasio: 0 };
    }
    userMap[uid].total_refund  += Number(txn.price) || 0;
    userMap[uid].jumlah_refund += 1;
  }

  const userIds = Object.keys(userMap);

  // ── 3. Ambil profiles ─────────────────────────────────────────────
  if (userIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email, name, balance, is_blacklisted')
      .in('id', userIds);

    for (const p of profiles ?? []) {
      if (userMap[p.id]) {
        userMap[p.id].email          = p.email         ?? '';
        userMap[p.id].saldo          = p.balance        ?? 0;
        userMap[p.id].is_blacklisted = p.is_blacklisted ?? false;
      }
    }
  }

  // ── 4. Ambil deposit approved ─────────────────────────────────────
  if (userIds.length > 0) {
    const { data: deposits } = await db
      .from('deposit_requests')
      .select('user_id, amount')
      .in('user_id', userIds)
      .eq('status', 'approved');

    for (const dep of deposits ?? []) {
      if (userMap[dep.user_id])
        userMap[dep.user_id].total_deposit += Number(dep.amount) || 0;
    }
  }

  // ── 5. Hitung rasio & filter ──────────────────────────────────────
  const suspicious = Object.values(userMap)
    .map(u => ({
      ...u,
      rasio: u.total_deposit > 0
        ? parseFloat((u.total_refund / u.total_deposit).toFixed(2))
        : u.jumlah_refund,
    }))
    .filter(u => u.rasio >= 2)
    .sort((a, b) => b.rasio - a.rasio);

  // ── 6. Daily summary ─────────────────────────────────────────────
  const dayMap: Record<string, { tanggal: string; jumlah_refund: number; total_refund: number; _users: Set<string> }> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayMap[key] = { tanggal: key, jumlah_refund: 0, total_refund: 0, _users: new Set() };
  }

  for (const txn of refundTxns ?? []) {
    const day = (txn.created_at as string).slice(0, 10);
    if (dayMap[day]) {
      dayMap[day].jumlah_refund += 1;
      dayMap[day].total_refund  += Number(txn.price) || 0;
      if (txn.user_id) dayMap[day]._users.add(txn.user_id);
    }
  }

  const daily = Object.values(dayMap)
    .map(d => ({ tanggal: d.tanggal, jumlah_refund: d.jumlah_refund,
                 total_refund: d.total_refund, jumlah_user: d._users.size }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  return NextResponse.json({ suspicious, daily });
}