// src/app/api/user/deposit-history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/deposit-history
 * Ambil riwayat deposit milik user yang sedang login
 */
export async function GET(request: NextRequest) {
  try {
    // ✅ FIX: Pakai header terverifikasi dari middleware
    // Sebelumnya pakai ?email=xxx dari URL — siapapun bisa lihat deposit history orang lain!
    const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    // Ambil user_id dari email terverifikasi
    const { data: profile } = await db
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      return NextResponse.json([], { status: 200 });
    }

    // ✅ FIX: Query pakai user_id dari profile, bukan dari parameter URL
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