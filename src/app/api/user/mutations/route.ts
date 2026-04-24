// src/app/api/user/mutations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fetchMutations(email: string, page: number, limit: number, type: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id').eq('email', email).single();
  if (!profile) return { items: [], total: 0 };

  let query = supabaseAdmin
    .from('mutations')
    .select('*', { count: 'exact' })
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (type === 'in' || type === 'out') query = query.eq('type', type);

  const { data, count, error } = await query;
  if (error) return { items: [], total: 0 };

  const items = (data ?? []).map((m: Record<string, unknown>) => ({
    id    : m.id,
    date  : new Date(m.created_at as string).toLocaleString('id-ID'),
    type  : m.type,
    amount: m.amount,
    desc  : m.description,
  }));

  return { items, total: count ?? 0 };
}

/** GET /api/user/mutations */
export async function GET(request: NextRequest) {
  // ✅ FIX: Hanya pakai X-Verified-User-Email dari middleware
  // Hapus fallback X-User-Email dan URL param yang bisa dipalsukan
  const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20', 10));
  const type  = searchParams.get('type') ?? '';

  return NextResponse.json(await fetchMutations(email, page, limit, type));
}

/** POST /api/user/mutations */
export async function POST(request: NextRequest) {
  try {
    // ✅ FIX: Hanya pakai X-Verified-User-Email dari middleware
    const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const page  = Math.max(1, parseInt(String(body.page  ?? 1), 10));
    const limit = Math.min(50, parseInt(String(body.limit ?? 20), 10));
    const type  = String(body.type ?? '');

    return NextResponse.json(await fetchMutations(email, page, limit, type));
  } catch (err) {
    console.error('[POST /api/user/mutations]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}