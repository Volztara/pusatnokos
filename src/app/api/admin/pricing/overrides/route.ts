// src/app/api/admin/pricing/overrides/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET() {
  const { data } = await db.from('admin_settings').select('value').eq('key', 'price_overrides').single();
  return NextResponse.json(data?.value ?? {});
}

export async function PUT(req: Request) {
  const { overrides } = await req.json();
  await db.from('admin_settings').upsert({ key: 'price_overrides', value: overrides });
  try {
    await db.from('admin_logs').insert({ action: 'update_price_overrides', target_id: 'global', details: `${Object.keys(overrides).length} override disimpan` });
  } catch {}
  return NextResponse.json({ success: true });
}
