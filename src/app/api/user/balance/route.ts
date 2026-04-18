// src/app/api/user/balance/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
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
 * Update saldo user secara atomic (mencegah race condition & double refund)
 * Body: { email, amount, type: 'add' | 'subtract', activationId? }
 */
export async function PATCH(request: Request) {
  try {
    const { email, amount, type, activationId } = await request.json();

    if (!email || !amount || !type) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    if (activationId && type === 'add') {
      // ✅ Idempotency check
      const { data: existingRefund } = await supabaseAdmin
        .from('mutations')
        .select('id')
        .eq('description', `Refund pembatalan order #${activationId}`)
        .limit(1);

      if (existingRefund && existingRefund.length > 0) {
        return NextResponse.json({ error: 'Order sudah pernah di-refund.' }, { status: 409 });
      }

      // ✅ Gate utama — tandai cancelled, hanya kalau masih waiting
      const { data: updatedOrder } = await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('activation_id', activationId)
        .eq('status', 'waiting')
        .select()
        .single();

      // Kalau order tidak ditemukan / sudah bukan waiting → tolak
      if (!updatedOrder) {
        return NextResponse.json({ error: 'Order tidak bisa dibatalkan.' }, { status: 409 });
      }
    }

    // ✅ Ambil profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance')
      .eq('email', email.toLowerCase())
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // ✅ Update saldo langsung — simple, reliable, tidak ada fallback yg bisa skip mutation
    const currentBalance = profile.balance ?? 0;
    const newBal = type === 'add'
      ? currentBalance + amount
      : Math.max(0, currentBalance - amount);

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBal })
      .eq('email', email.toLowerCase());

    if (updateError) {
      return NextResponse.json({ error: 'Gagal update saldo.' }, { status: 500 });
    }

    // ✅ Insert mutation SELALU setelah update berhasil — tidak bisa di-skip
    if (type === 'add') {
      await supabaseAdmin.from('mutations').insert({
        user_id    : profile.id,
        type       : 'in',
        amount     : amount,
        description: `Refund pembatalan order${activationId ? ` #${activationId}` : ''}`,
      });
    }

    return NextResponse.json({ success: true, balance: newBal });

  } catch (err) {
    console.error('[PATCH /api/user/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}