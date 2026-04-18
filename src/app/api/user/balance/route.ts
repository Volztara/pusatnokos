// src/app/api/user/balance/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

export async function PATCH(request: Request) {
  try {
    const { email, amount, type, activationId } = await request.json();

    if (!email || !amount || !type) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // ✅ Gunakan RPC atomic untuk cancel — mencegah race condition & double refund
    if (activationId && type === 'add') {
      const { data, error } = await supabaseAdmin
        .rpc('cancel_order_and_refund', {
          p_activation_id: activationId,
          p_email        : email.toLowerCase(),
        });

      if (error) {
        console.error('[PATCH /api/user/balance] RPC error:', error);
        return NextResponse.json({ error: 'Gagal memproses refund.' }, { status: 500 });
      }

      if (!data.success) {
        return NextResponse.json({ error: data.error }, { status: 409 });
      }

      return NextResponse.json({ success: true, balance: data.balance });
    }

    // ✅ Untuk subtract (beli nomor) — update langsung
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance')
      .eq('email', email.toLowerCase())
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    const newBal = Math.max(0, (profile.balance ?? 0) - amount);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBal })
      .eq('email', email.toLowerCase());

    if (updateError) {
      return NextResponse.json({ error: 'Gagal update saldo.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, balance: newBal });

  } catch (err) {
    console.error('[PATCH /api/user/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}