// src/app/api/user/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('balance')
    .eq('email', email)
    .single();

  if (error || !data) return NextResponse.json({ balance: 0 });
  return NextResponse.json({ balance: data.balance ?? 0 });
}

export async function PATCH(request: NextRequest) {
  try {
    const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

    const body = await request.json();
    const { amount, type, activationId } = body;

    if (!amount || !type) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // ✅ FIX DOUBLE DEDUCTION: Blokir type='subtract' sepenuhnya
    // Pemotongan saldo sekarang HANYA dilakukan di /api/order POST via deduct_balance_for_order
    // Kalau frontend masih call ini dengan subtract, akan dapat error 410 Gone
    // → Frontend harus diupdate untuk tidak call endpoint ini untuk subtract
    if (type === 'subtract') {
      console.warn(`[user/balance PATCH] User ${email} masih pakai subtract — frontend perlu diupdate!`);
      return NextResponse.json(
        {
          error     : 'Operasi ini sudah tidak digunakan. Pemotongan saldo dilakukan otomatis saat order.',
          deprecated: true,
        },
        { status: 410 } // 410 Gone — endpoint ini sudah deprecated untuk subtract
      );
    }

    // type='add' — hanya untuk refund dari order cancel
    if (type === 'add') {
      if (!activationId) {
        console.warn(`[user/balance PATCH] User ${email} coba add balance tanpa activationId!`);
        return NextResponse.json({ error: 'Operasi tidak diizinkan.' }, { status: 403 });
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, balance')
        .eq('email', email)
        .single();

      if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

      // Anti double-refund
      const { data: existingMutation } = await supabaseAdmin
        .from('mutations')
        .select('id')
        .eq('user_id', profile.id)
        .eq('type', 'in')
        .ilike('description', `%#${activationId}%`)
        .maybeSingle();

      if (existingMutation) {
        return NextResponse.json(
          { error: 'Refund sudah diproses sebelumnya.', alreadyRefunded: true },
          { status: 409 }
        );
      }

      // Pakai RPC cancel_order_and_refund untuk atomic operation
      try {
        const { data: rpcData, error: rpcErr } = await supabaseAdmin
          .rpc('cancel_order_and_refund', {
            p_activation_id: activationId,
            p_email        : email,
          });

        if (rpcErr) throw new Error('fallback');

        if (!rpcData?.success) {
          const msg = (rpcData?.error ?? 'Refund sudah diproses.').toLowerCase();
          const alreadyDone =
            msg.includes('already') || msg.includes('sudah') ||
            msg.includes('not found') || msg.includes('tidak ditemukan') ||
            msg.includes('cancelled') || msg.includes('dibatalkan') ||
            msg.includes('duplicate') || msg.includes('processed') || msg.includes('diproses');

          return NextResponse.json(
            { error: rpcData?.error ?? 'Refund sudah diproses.', alreadyRefunded: alreadyDone },
            { status: alreadyDone ? 409 : 400 }
          );
        }

        return NextResponse.json({ success: true, balance: rpcData.balance });

      } catch (e: any) {
        if (e?.message !== 'fallback') throw e;

        // Fallback manual
        const { data: existCheck } = await supabaseAdmin
          .from('mutations')
          .select('id')
          .eq('user_id', profile.id)
          .eq('type', 'in')
          .ilike('description', `%${activationId}%`)
          .maybeSingle();

        if (existCheck) {
          return NextResponse.json(
            { error: 'Refund sudah diproses sebelumnya.', alreadyRefunded: true },
            { status: 409 }
          );
        }

        await supabaseAdmin.rpc('update_balance', {
          p_email : email,
          p_amount: amount,
        });

        const { data: updated } = await supabaseAdmin
          .from('profiles').select('balance').eq('email', email).single();

        return NextResponse.json({ success: true, balance: updated?.balance ?? 0 });
      }
    }

    return NextResponse.json(
      { error: 'Type tidak valid. Hanya "add" yang diizinkan.' },
      { status: 400 }
    );

  } catch (err) {
    console.error('[PATCH /api/user/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}