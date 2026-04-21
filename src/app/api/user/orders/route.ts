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
 * Update status order
 * Body: { activationId, status, otpCode? }
 */
export async function PATCH(request: Request) {
  try {
    const { activationId, status, otpCode } = await request.json();

    if (!activationId || !status) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    const updateData: any = { status };
    if (otpCode) updateData.otp_code = otpCode;

    const { error } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('activation_id', activationId);

    if (error) return NextResponse.json({ error: 'Gagal update order.' }, { status: 500 });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[PATCH /api/user/orders]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}