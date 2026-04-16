// src/app/api/user/balance/route.ts
// Ambil dan update saldo user dari Supabase

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/balance?email=xxx
 * Ambil saldo user
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email) return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('balance')
    .eq('email', email)
    .single();

  if (error || !data) return NextResponse.json({ balance: 0 });
  return NextResponse.json({ balance: data.balance ?? 0 });
}

/**
 * PATCH /api/user/balance
 * Update saldo user
 * Body: { email, amount, type: 'add' | 'subtract' }
 */
export async function PATCH(request: Request) {
  try {
    const { email, amount, type } = await request.json();

    if (!email || !amount || !type) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // Ambil saldo sekarang
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('email', email.toLowerCase())
      .single();

    const currentBalance = profile?.balance ?? 0;
    const newBalance = type === 'add'
      ? currentBalance + amount
      : Math.max(0, currentBalance - amount);

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('email', email.toLowerCase());

    if (error) return NextResponse.json({ error: 'Gagal update saldo.' }, { status: 500 });

    return NextResponse.json({ success: true, balance: newBalance });

  } catch (err) {
    console.error('[PATCH /api/user/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}