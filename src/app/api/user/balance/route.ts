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
 * Update saldo user secara atomic (mencegah race condition & double refund)
 * Body: { email, amount, type: 'add' | 'subtract', activationId? }
 */
export async function PATCH(request: Request) {
  try {
    const { email, amount, type, activationId } = await request.json();

    if (!email || !amount || !type) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // ✅ Idempotency check — cegah double refund saat cancel
    if (activationId && type === 'add') {
      // Coba tandai order sebagai 'cancelled' secara atomic
      // .neq('status', 'cancelled') memastikan hanya berhasil jika belum cancelled
      const { data: updated } = await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('activation_id', activationId)
        .neq('status', 'cancelled')
        .select('id');

      if (!updated || updated.length === 0) {
        // Order sudah cancelled sebelumnya → tolak refund duplikat
        return NextResponse.json(
          { error: 'Order sudah pernah di-refund. Tidak ada perubahan saldo.' },
          { status: 409 }
        );
      }
    }

    // ✅ Atomic update saldo via RPC
    const { data: newBalance, error: rpcError } = await supabaseAdmin
      .rpc('update_balance', {
        p_email : email.toLowerCase(),
        p_amount: type === 'add' ? amount : -amount,
      });

    // Fallback: kalau RPC belum ada atau error, pakai direct update
    if (rpcError) {
      console.warn('[PATCH /api/user/balance] RPC gagal, pakai fallback:', rpcError.message);

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('balance')
        .eq('email', email.toLowerCase())
        .single();

      const currentBalance = profile?.balance ?? 0;
      const newBal = type === 'add'
        ? currentBalance + amount
        : Math.max(0, currentBalance - amount);

      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({ balance: newBal })
        .eq('email', email.toLowerCase());

      if (updateError) {
        console.error('[PATCH /api/user/balance] Fallback gagal:', updateError);
        return NextResponse.json({ error: 'Gagal update saldo.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, balance: newBal });
    }

    // ✅ Catat mutasi hanya untuk refund (type === 'add')
    // Mutasi 'subtract' sudah dicatat di frontend & /api/user/orders
    if (type === 'add') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (profile) {
        await supabaseAdmin.from('mutations').insert({
          user_id    : profile.id,
          type       : 'in',
          amount     : amount,
          description: `Refund pembatalan order${activationId ? ` #${activationId}` : ''}`,
        });
      }
    }

    return NextResponse.json({ success: true, balance: newBalance });

  } catch (err) {
    console.error('[PATCH /api/user/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}