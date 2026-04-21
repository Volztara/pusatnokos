// src/app/api/auth/check-blacklist/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Email didapat dari header yang di-inject middleware (sudah terverifikasi JWT)
  // Tidak lagi membaca dari URL param untuk mencegah IDOR
  const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ is_blacklisted: false });
  }

  const { data } = await db
    .from('profiles')
    .select('is_blacklisted')
    .eq('email', email)
    .single();

  return NextResponse.json({ is_blacklisted: data?.is_blacklisted ?? false });
}