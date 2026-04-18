// src/app/api/broadcast/route.ts
// Public endpoint — user bisa baca broadcast tanpa auth

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Ambil broadcast 7 hari terakhir saja
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await db
      .from('broadcasts')
      .select('id, title, message, type, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) return NextResponse.json([]);
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
