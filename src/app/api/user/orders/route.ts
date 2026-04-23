// src/app/api/user/orders/route.ts
// Simpan dan ambil order dari Supabase

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/orders?email=xxx
 * Ambil semua order user (status waiting & success saja)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email) return NextResponse.json({ error: 'Email wajib diisi.' }, { status: 400 });

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id').eq('email', email).single();

  if (!profile) return NextResponse.json([]);

  // Ambil order yang masih relevan:
  // - 'waiting' dibuat dalam 20 menit terakhir (belum expired)
  // - 'success' dibuat dalam 10 menit terakhir (OTP masih bisa dilihat)
  const cutoff20min = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const cutoff10min = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data: waitingOrders } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('user_id', profile.id)
    .eq('status', 'waiting')
    .gte('created_at', cutoff20min)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: successOrders } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('user_id', profile.id)
    .eq('status', 'success')
    .gte('created_at', cutoff10min)
    .order('created_at', { ascending: false })
    .limit(20);

  const data = [
    ...(waitingOrders ?? []),
    ...(successOrders ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (!data) return NextResponse.json([]);
  return NextResponse.json(data);
}

/**
 * POST /api/user/orders
 * Simpan order baru ke database
 * Body: { email, activationId, serviceCode, serviceName, phone, price, country }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, activationId, serviceCode, serviceName, phone, price, country, isV2 } = body;

    if (!email || !activationId || !phone) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('id').eq('email', email.toLowerCase()).single();

    if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

    const { error } = await supabaseAdmin.from('orders').insert({
      user_id      : profile.id,
      activation_id: activationId,
      service_code : serviceCode,
      service_name : serviceName,
      phone,
      price,
      country      : country ?? '6',
      status       : 'waiting',
      is_v2        : isV2 ?? false,
      refunded     : false,           // ← pastikan default false saat insert
    });

    if (error) return NextResponse.json({ error: 'Gagal menyimpan order.' }, { status: 500 });

    // Catat mutasi saldo keluar
    await supabaseAdmin.from('mutations').insert({
      user_id    : profile.id,
      type       : 'out',
      amount     : price,
      description: `Beli ${serviceName}`,
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/user/orders]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/orders
 * Update status order + handle REFUND jika status = 'cancelled' atau 'expired'
 *
 * Body:
 *   - email        : string  → Email user (untuk validasi ownership)
 *   - activationId : string  → ID aktivasi dari provider
 *   - status       : string  → 'cancelled' | 'expired' | 'success'
 *   - otpCode?     : string  → (opsional) kode OTP jika status success
 *
 * Response:
 *   - { success: true, refunded: false }               → update biasa
 *   - { success: true, refunded: true, refundedAmount } → refund berhasil
 *   - { error: string }                                 → gagal
 */
export async function PATCH(request: Request) {
  try {
    const { email, activationId, status, otpCode } = await request.json();

    // ── Validasi input ────────────────────────────────────────────────
    if (!activationId || !status) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // ── FIX #1: Validasi Ownership ────────────────────────────────────
    // Pastikan order yang di-cancel benar-benar milik user yang request.
    // Mencegah user cancel order orang lain yang tahu activationId-nya.
    if (email && status === 'cancelled') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
      }

      const { data: ownerCheck } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('activation_id', activationId)
        .eq('user_id', profile.id)   // ← order harus milik user ini
        .single();

      if (!ownerCheck) {
        return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
      }
    }

    // ── Ambil data order ──────────────────────────────────────────────
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, price, service_name, status, activation_id, refunded')
      .eq('activation_id', activationId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order tidak ditemukan.' }, { status: 404 });
    }

    // ── FIX #2: Double Refund Protection ─────────────────────────────
    // Cek status='waiting' AND refunded=false sekaligus.
    // Mencegah double refund jika /api/order dan /api/user/orders
    // dipanggil bersamaan oleh user/cron.
    const shouldRefund =
      (status === 'cancelled' || status === 'expired') &&
      order.status === 'waiting'  &&
      order.refunded === false;    // ← BARU: guard kolom refunded

    // ── Siapkan data update ───────────────────────────────────────────
    const updateData: Record<string, unknown> = { status };
    if (otpCode) updateData.otp_code = otpCode;

    // ── FIX #3: Set refunded=true ATOMIC bersamaan update status ──────
    // Dengan ini, cron job tidak akan bisa refund lagi karena
    // kolom refunded sudah = true sebelum cron sempat membaca.
    if (shouldRefund) {
      updateData.refunded = true;  // ← BARU: atomic set
    }

    // ── Update status order dengan guard ganda ────────────────────────
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('activation_id', activationId)
      .eq('status', 'waiting')     // ← Guard 1: hanya jika masih waiting
      .eq('refunded', false)       // ← Guard 2 (BARU): hanya jika belum direfund
      .select('id');

    // Jika update ke 'success' (tidak butuh guard refund)
    if (updateError && !shouldRefund) {
      const { error: fallbackError } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('activation_id', activationId);

      if (fallbackError) {
        return NextResponse.json({ error: 'Gagal update order.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, refunded: false });
    }

    if (updateError) {
      return NextResponse.json({ error: 'Gagal update order.' }, { status: 500 });
    }

    // Tidak ada row yang ter-update → sudah direfund duluan (cron/route lain)
    if (shouldRefund && (!updated || updated.length === 0)) {
      console.log(`[PATCH] Skip — order ${activationId} sudah diproses sebelumnya`);
      return NextResponse.json({
        success : true,
        refunded: false,
        message : 'Order sudah diproses sebelumnya.',
      });
    }

    // ── Proses Refund ─────────────────────────────────────────────────
    if (shouldRefund && order.price > 0) {

      // 1. Kembalikan saldo ke user secara atomic via RPC
      const { error: balanceError } = await supabaseAdmin.rpc('increment_balance', {
        p_user_id: order.user_id,
        p_amount : order.price,
      });

      if (balanceError) {
        console.error('[REFUND] Gagal kembalikan saldo:', balanceError);
        return NextResponse.json(
          { error: 'Order dibatalkan tapi refund saldo gagal. Hubungi admin.' },
          { status: 500 }
        );
      }

      // 2. Catat mutasi saldo masuk (bukti refund)
      const reason = status === 'cancelled' ? 'dibatalkan user' : 'waktu habis (auto)';
      const { error: mutationError } = await supabaseAdmin.from('mutations').insert({
        user_id    : order.user_id,
        type       : 'in',
        amount     : order.price,
        description: `Refund ${order.service_name} — ${reason}`,
      });

      if (mutationError) {
        console.error('[REFUND] Gagal catat mutasi:', mutationError);
        // Tidak return error — saldo sudah kembali, mutasi hanya catatan
      }

      // 3. Return sukses dengan info refund
      return NextResponse.json({
        success       : true,
        refunded      : true,
        refundedAmount: order.price,
        reason        : status,
      });
    }

    // ── Update biasa (contoh: status = 'success') ─────────────────────
    return NextResponse.json({ success: true, refunded: false });

  } catch (err) {
    console.error('[PATCH /api/user/orders]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}