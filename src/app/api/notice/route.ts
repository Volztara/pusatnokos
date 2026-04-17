// src/app/api/notice/route.ts
// Public endpoint — tampilkan papan info aktif ke semua user

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data } = await db
      .from('notices')
      .select('id, title, content, type')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([]);
  }
}