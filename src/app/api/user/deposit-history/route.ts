// src/app/api/user/deposit-history/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/deposit-history?email=xxx
 * Ambil semua riwayat deposit user (manual + paymenku + crypto)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email')?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Email required.' }, { status: 400 });
    }

    // Ambil user_id dari email
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      return NextResponse.json([], { status: 200 });
    }

    // Ambil semua deposit requests milik user
    const { data, error } = await db
      .from('deposit_requests')
      .select('id, amount, status, bank_name, note, admin_note, proof_url, created_at')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[deposit-history]', error);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(data ?? []);

  } catch (err) {
    console.error('[GET /api/user/deposit-history]', err);
    return NextResponse.json([], { status: 200 });
  }
}