// src/app/api/admin/deposit/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const log = async (action: string, targetId: string, details: string) => {
  try { await db.from('admin_logs').insert({ action, target_id: targetId, details }); } catch {}
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'pending';
  const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const search = searchParams.get('search') ?? '';
  const limit  = 20;

  let userIds: string[] | null = null;
  if (search) {
    const { data: matched } = await db
      .from('profiles')
      .select('id')
      .or(`email.ilike.%${search}%,name.ilike.%${search}%`);
    userIds = (matched ?? []).map((p: any) => p.id);
  }

  let query = db
    .from('deposit_requests')
    .select('*, profiles(name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (status !== 'all') query = query.eq('status', status);

  if (userIds !== null) {
    if (userIds.length > 0) query = query.in('user_id', userIds);
    else query = query.eq('user_id', 'no-match');
  }

  const { data, count } = await query;
  return NextResponse.json({ requests: data ?? [], total: count ?? 0 });
}

export async function PATCH(request: Request) {
  try {
    const { requestId, action, adminNote } = await request.json();

    if (!requestId || !action) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    const { data: req } = await db
      .from('deposit_requests')
      .select('*, profiles(id, email, balance)')
      .eq('id', requestId)
      .single();

    if (!req) return NextResponse.json({ error: 'Request tidak ditemukan.' }, { status: 404 });

    // ✅ Allow approve juga untuk status 'pending_payment' (deposit otomatis yang RPC-nya gagal)
    const allowedStatuses = ['pending', 'pending_payment'];
    if (!allowedStatuses.includes(req.status)) {
      return NextResponse.json({ error: 'Request sudah diproses.' }, { status: 400 });
    }

    if (action === 'approve') {
      const profile = req.profiles as any;

      // ✅ FIX: Pakai RPC atomic (bukan manual update balance) — sama seperti webhook
      // Ini mencegah race condition dan konsisten dengan deduct_balance_for_order
      const { error: rpcErr } = await db.rpc('update_balance', {
        p_email : profile.email,
        p_amount: req.amount,
      });

      if (rpcErr) {
        console.error('[admin/deposit approve] RPC gagal:', rpcErr);
        return NextResponse.json({ error: 'Gagal update saldo. Coba lagi.' }, { status: 500 });
      }

      await db.from('mutations').insert({
        user_id    : profile.id,
        type       : 'in',
        amount     : req.amount,
        description: `Deposit manual disetujui admin`,
      });

      await db.from('deposit_requests').update({
        status     : 'approved',
        admin_note : adminNote ?? 'Manual approve - selesai',
        approved_at: new Date().toISOString(),
      }).eq('id', requestId);

      await log(
        'approve_deposit',
        String(requestId),
        `Deposit Rp ${req.amount.toLocaleString('id-ID')} untuk ${profile.email} disetujui`
      );

      return NextResponse.json({
        success: true,
        message: `Deposit Rp ${req.amount.toLocaleString('id-ID')} berhasil disetujui.`,
      });
    }

    if (action === 'reject') {
      await db.from('deposit_requests').update({
        status    : 'rejected',
        admin_note: adminNote ?? 'Ditolak',
      }).eq('id', requestId);

      await log(
        'reject_deposit',
        String(requestId),
        `Deposit Rp ${req.amount.toLocaleString('id-ID')} untuk ${(req.profiles as any).email} ditolak`
      );

      return NextResponse.json({ success: true, message: 'Request deposit ditolak.' });
    }

    return NextResponse.json({ error: 'Action tidak valid.' }, { status: 400 });

  } catch (err) {
    console.error('[PATCH /api/admin/deposit]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}