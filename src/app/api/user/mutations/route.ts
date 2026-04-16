// src/app/api/user/mutations/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/mutations?email=xxx&page=1&limit=20&type=in|out
 * Ambil riwayat mutasi saldo user dari Supabase
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email  = searchParams.get('email')?.trim().toLowerCase();
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
  const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const type   = searchParams.get('type') ?? '';  // 'in' | 'out' | ''

  if (!email) return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });

  // Ambil user id
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id').eq('email', email).single();

  if (!profile) return NextResponse.json({ items: [], total: 0 });

  let query = supabaseAdmin
    .from('mutations')
    .select('*', { count: 'exact' })
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (type === 'in' || type === 'out') query = query.eq('type', type);

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ items: [], total: 0 });

  const items = (data ?? []).map((m: any) => ({
    id    : m.id,
    date  : new Date(m.created_at).toLocaleString('id-ID'),
    type  : m.type,
    amount: m.amount,
    desc  : m.description,
  }));

  return NextResponse.json({ items, total: count ?? 0 });
}