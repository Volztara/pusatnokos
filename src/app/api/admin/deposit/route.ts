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

  // Kalau ada search, cari user yang cocok dulu
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

  // Filter by user_id kalau ada search
  if (userIds !== null) {
    if (userIds.length > 0) query = query.in('user_id', userIds);
    else query = query.eq('user_id', 'no-match'); // tidak ada user cocok
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
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request sudah diproses.' }, { status: 400 });

    if (action === 'approve') {
      const profile    = req.profiles as any;
      const newBalance = (profile.balance ?? 0) + req.amount;

      await db.from('profiles').update({ balance: newBalance }).eq('id', profile.id);

      await db.from('mutations').insert({
        user_id    : profile.id,
        type       : 'in',
        amount     : req.amount,
        description: 'Deposit manual disetujui admin',
      });

      await db.from('deposit_requests').update({
        status     : 'approved',
        admin_note : adminNote ?? 'Disetujui',
        approved_at: new Date().toISOString(),
      }).eq('id', requestId);

      await log('approve_deposit', String(requestId), `Deposit Rp ${req.amount.toLocaleString('id-ID')} untuk ${profile.email} disetujui`);

      return NextResponse.json({ success: true, message: `Deposit Rp ${req.amount.toLocaleString('id-ID')} berhasil disetujui.` });
    }

    if (action === 'reject') {
      await db.from('deposit_requests').update({
        status    : 'rejected',
        admin_note: adminNote ?? 'Ditolak',
      }).eq('id', requestId);

      await log('reject_deposit', String(requestId), `Deposit Rp ${req.amount.toLocaleString('id-ID')} untuk ${(req.profiles as any).email} ditolak`);

      return NextResponse.json({ success: true, message: 'Request deposit ditolak.' });
    }

    return NextResponse.json({ error: 'Action tidak valid.' }, { status: 400 });

  } catch (err) {
    console.error('[PATCH /api/admin/deposit]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}