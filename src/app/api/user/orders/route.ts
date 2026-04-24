// src/app/api/user/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/user/orders
 * Ambil semua order aktif milik user yang sedang login
 */
export async function GET(request: NextRequest) {
  // ✅ FIX: Pakai header terverifikasi — sebelumnya pakai ?email=xxx dari URL
  // yang memungkinkan siapapun lihat order orang lain hanya dengan tau emailnya
  const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('id').eq('email', email).single();

  if (!profile) return NextResponse.json([]);

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

  return NextResponse.json(data ?? []);
}

/**
 * POST /api/user/orders
 * Simpan order baru ke database
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ FIX: Pakai header terverifikasi — sebelumnya pakai body.email
    const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

    const body = await request.json();
    const { activationId, serviceCode, serviceName, phone, price, country, isV2 } = body;

    if (!activationId || !phone) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // ✅ FIX: Ambil profile dari email terverifikasi, bukan dari body.email
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('id').eq('email', email).single();

    if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

    // ✅ FIX: Cek apakah activation_id sudah ada (cegah duplikat insert)
    const { data: existing } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('activation_id', activationId)
      .maybeSingle();

    if (existing) {
      // Order sudah ada, tidak perlu insert lagi
      return NextResponse.json({ success: true, duplicate: true });
    }

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
      refunded     : false,
    });

    if (error) return NextResponse.json({ error: 'Gagal menyimpan order.' }, { status: 500 });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error('[POST /api/user/orders]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/orders
 * Update status order + handle refund
 */
export async function PATCH(request: NextRequest) {
  try {
    // ✅ FIX: Pakai header terverifikasi — sebelumnya pakai body.email
    const email = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

    const { activationId, status, otpCode } = await request.json();

    if (!activationId || !status) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    // Ambil profile dari email terverifikasi
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // ✅ FIX: Validasi ownership — order harus milik user yang sedang login
    const { data: ownerCheck } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('activation_id', activationId)
      .eq('user_id', profile.id)
      .maybeSingle();

    if (!ownerCheck) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }

    // Ambil data order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, price, service_name, status, activation_id, refunded')
      .eq('activation_id', activationId)
      .eq('user_id', profile.id) // ✅ tambah filter user_id
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order tidak ditemukan.' }, { status: 404 });
    }

    const shouldRefund =
      (status === 'cancelled' || status === 'expired') &&
      order.status === 'waiting' &&
      order.refunded === false;

    const updateData: Record<string, unknown> = { status };
    if (otpCode) updateData.otp_code = otpCode;
    if (shouldRefund) updateData.refunded = true;

    // Update dengan atomic guard
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('orders')
      .update(updateData)
      .eq('activation_id', activationId)
      .eq('user_id', profile.id)   // ✅ tambah filter user_id
      .eq('status', 'waiting')
      .eq('refunded', false)
      .select('id');

    if (updateError && !shouldRefund) {
      const { error: fallbackError } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('activation_id', activationId)
        .eq('user_id', profile.id); // ✅ tambah filter user_id

      if (fallbackError) {
        return NextResponse.json({ error: 'Gagal update order.' }, { status: 500 });
      }
      return NextResponse.json({ success: true, refunded: false });
    }

    if (updateError) {
      return NextResponse.json({ error: 'Gagal update order.' }, { status: 500 });
    }

    if (shouldRefund && (!updated || updated.length === 0)) {
      return NextResponse.json({
        success : true,
        refunded: false,
        message : 'Order sudah diproses sebelumnya.',
      });
    }

    // Proses refund
    if (shouldRefund && order.price > 0) {
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

      const reason = status === 'cancelled' ? 'dibatalkan user' : 'waktu habis (auto)';
      await supabaseAdmin.from('mutations').insert({
        user_id    : order.user_id,
        type       : 'in',
        amount     : order.price,
        description: `Refund ${order.service_name} — ${reason}`,
      });

      return NextResponse.json({
        success       : true,
        refunded      : true,
        refundedAmount: order.price,
        reason        : status,
      });
    }

    return NextResponse.json({ success: true, refunded: false });

  } catch (err) {
    console.error('[PATCH /api/user/orders]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}