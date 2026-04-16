// src/app/api/auth/check-blacklist/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ is_blacklisted: false });

  const { data } = await db
    .from('profiles')
    .select('is_blacklisted')
    .eq('email', email)
    .single();

  return NextResponse.json({ is_blacklisted: data?.is_blacklisted ?? false });
}