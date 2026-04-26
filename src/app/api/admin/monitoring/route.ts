// src/app/api/admin/monitoring/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // Auth — sama seperti admin routes lain (middleware handle, route cek header ada)
  const authHeader = req.headers.get('authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {

  const { searchParams } = new URL(req.url);
  const days = Math.min(30, Math.max(1, parseInt(searchParams.get('days') ?? '7')));

  // Fix: days=1 = hari ini (bukan kemarin)
  // days=7 = 7 hari terakhir termasuk hari ini
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceISO = since.toISOString();

  // ── 1. User aktif dalam periode (ada order berhasil) ─────────────
  const { data: activeOrders } = await db
    .from('orders')
    .select('user_id, price, created_at')
    .eq('status', 'success')
    .gte('created_at', sinceISO);

  const activeUserIds = [...new Set((activeOrders ?? []).map(o => o.user_id).filter(Boolean))];
  if (activeUserIds.length === 0) {
    return NextResponse.json({ users: [], daily: [], burst_count: 0, anomaly_count: 0 });
  }

  // Precompute order count per user — O(n) bukan O(n²)
  const orderCountMap: Record<string, number> = {};
  for (const o of activeOrders ?? []) {
    if (o.user_id) orderCountMap[o.user_id] = (orderCountMap[o.user_id] ?? 0) + 1;
  }

  // ── 2. ALL TIME mutations per user (pisah in dan out) ─────────────
  // Ini lebih akurat dari order+deposit karena mencatat semua:
  // - type='in'  : deposit, refund cancel, refund expired, koreksi admin
  // - type='out' : beli OTP (semua yang sudah dipotong dari saldo)
  const { data: allMutations } = await db
    .from('mutations')
    .select('user_id, type, amount, description')
    .in('user_id', activeUserIds);

  const mutMap: Record<string, {
    total_in    : number; // semua yang masuk (deposit + refund + koreksi)
    total_out   : number; // semua yang keluar (beli OTP)
    deposit_in  : number; // khusus deposit dari deposit_requests
    refund_in   : number; // khusus refund cancel/expired
    admin_in    : number; // koreksi manual admin
  }> = {};

  for (const m of allMutations ?? []) {
    const uid = m.user_id;
    if (!uid) continue;
    if (!mutMap[uid]) mutMap[uid] = { total_in: 0, total_out: 0, deposit_in: 0, refund_in: 0, admin_in: 0 };
    const amount = Number(m.amount) || 0;
    const desc   = (m.description ?? '').toLowerCase();

    if (m.type === 'in') {
      mutMap[uid].total_in += amount;
      if (desc.includes('deposit') || desc.includes('topup'))           mutMap[uid].deposit_in += amount;
      else if (desc.includes('refund') || desc.includes('kadaluarsa'))  mutMap[uid].refund_in  += amount;
      else                                                               mutMap[uid].admin_in   += amount;
    } else if (m.type === 'out') {
      mutMap[uid].total_out += amount;
    }
  }

  // ── 3. Profiles ───────────────────────────────────────────────────
  const { data: profiles } = await db
    .from('profiles')
    .select('id, email, balance, is_blacklisted')
    .in('id', activeUserIds);

  const profileMap: Record<string, { email: string; balance: number; is_blacklisted: boolean }> = {};
  for (const p of profiles ?? []) {
    profileMap[p.id] = { email: p.email ?? '', balance: p.balance ?? 0, is_blacklisted: p.is_blacklisted ?? false };
  }

  // ── 4. Burst detection ────────────────────────────────────────────
  const { data: recentOrders } = await db
    .from('orders')
    .select('user_id, created_at')
    .in('user_id', activeUserIds)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('user_id').order('created_at');

  const burstUserIds = new Set<string>();
  const ordersByUser: Record<string, number[]> = {};
  for (const o of recentOrders ?? []) {
    if (!o.user_id) continue;
    if (!ordersByUser[o.user_id]) ordersByUser[o.user_id] = [];
    ordersByUser[o.user_id].push(new Date(o.created_at).getTime());
  }
  for (const [uid, times] of Object.entries(ordersByUser)) {
    for (let i = 0; i <= times.length - 3; i++) {
      if (times[i + 2] - times[i] <= 5 * 60 * 1000) { burstUserIds.add(uid); break; }
    }
  }

  // ── 5. Bangun list user ───────────────────────────────────────────
  // Anomali = total_out (beli) > total_in (semua masuk termasuk refund & koreksi)
  // Ini benar-benar tidak mungkin terjadi secara normal
  const users = activeUserIds.map(uid => {
    const mut     = mutMap[uid] ?? { total_in: 0, total_out: 0, deposit_in: 0, refund_in: 0, admin_in: 0 };
    const profile = profileMap[uid] ?? { email: '', balance: 0, is_blacklisted: false };
    const selisih = mut.total_out - mut.total_in; // positif = spend > semua pemasukan = anomali nyata
    return {
      user_id       : uid,
      email         : profile.email,
      saldo         : profile.balance,
      is_blacklisted: profile.is_blacklisted,
      total_out     : mut.total_out,   // total beli (all time)
      total_in      : mut.total_in,    // total masuk: deposit + refund + koreksi (all time)
      deposit_in    : mut.deposit_in,  // khusus deposit
      refund_in     : mut.refund_in,   // khusus refund
      admin_in      : mut.admin_in,    // koreksi admin
      order_count   : orderCountMap[uid] ?? 0,
      selisih,
      burst_detected: burstUserIds.has(uid),
      is_anomaly    : selisih > 0,
    };
  }).sort((a, b) => {
    if (a.is_anomaly !== b.is_anomaly) return a.is_anomaly ? -1 : 1;
    return b.selisih - a.selisih;
  });

  // ── 6. Daily summary — reuse activeOrders (tidak query ulang) ────
  const { data: dailyDeposits } = await db
    .from('deposit_requests')
    .select('amount, created_at')
    .eq('status', 'approved')
    .gte('created_at', sinceISO);

  // Helper: format tanggal lokal (bukan UTC) untuk grouping harian
  const localDateStr = (dateStr: string) => {
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dayMap: Record<string, { tanggal: string; order_count: number; total_spend: number; total_deposit: number; _users: Set<string> }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = localDateStr(d.toISOString());
    dayMap[key] = { tanggal: key, order_count: 0, total_spend: 0, total_deposit: 0, _users: new Set() };
  }
  // Pakai activeOrders yang sudah ada — tidak perlu query baru
  for (const o of activeOrders ?? []) {
    const day = localDateStr(o.created_at as string);
    if (dayMap[day] && o.user_id) { dayMap[day].order_count++; dayMap[day].total_spend += Number(o.price) || 0; dayMap[day]._users.add(o.user_id); }
  }
  for (const d of dailyDeposits ?? []) {
    const day = localDateStr(d.created_at as string);
    if (dayMap[day]) dayMap[day].total_deposit += Number(d.amount) || 0;
  }

  const daily = Object.values(dayMap)
    .map(d => ({ tanggal: d.tanggal, order_count: d.order_count, total_spend: d.total_spend, total_deposit: d.total_deposit, jumlah_user: d._users.size }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

    return NextResponse.json({
      users,
      daily,
      burst_count  : burstUserIds.size,
      anomaly_count: users.filter(u => u.is_anomaly).length,
    });
  } catch (err) {
    console.error('[monitoring] error:', err);
    return NextResponse.json({ error: 'Gagal memuat data monitoring.' }, { status: 500 });
  }
}