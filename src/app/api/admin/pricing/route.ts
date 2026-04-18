// src/app/api/admin/pricing/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// GET — ambil config markup saat ini
export async function GET() {
  const { data } = await db.from('admin_settings').select('*').eq('key', 'markup_config').single();
  const config = data?.value ?? { idrRate: 17135.75, markupPct: 0.25, minProfit: 200, roundTo: 100 };
  return NextResponse.json(config);
}

// PUT — update markup config
export async function PUT(req: Request) {
  const body = await req.json();
  const { idrRate, markupPct, minProfit, roundTo } = body;

  await db.from('admin_settings').upsert({ key: 'markup_config', value: { idrRate, markupPct, minProfit, roundTo } });
  try {
    await db.from('admin_logs').insert({ action: 'update_pricing', target_id: 'global', details: JSON.stringify({ idrRate, markupPct, minProfit, roundTo }) });
  } catch {}

  return NextResponse.json({ success: true });
}
