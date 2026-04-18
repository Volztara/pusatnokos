// src/app/api/admin/logs/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = 30;

  const { data, count } = await db.from('admin_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range((page-1)*limit, page*limit-1);
  return NextResponse.json({ logs: data ?? [], total: count ?? 0 });
}
