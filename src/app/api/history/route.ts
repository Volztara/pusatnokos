// src/app/api/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STATUS_LABEL: Record<string, string> = {
  waiting   : 'Menunggu OTP',
  success   : 'Berhasil',
  cancelled : 'Dibatalkan',
  expired   : 'Kadaluarsa',
  completed : 'Selesai',
};

function getVerifiedEmail(request: NextRequest): string | null {
  return (
    request.headers.get('X-Verified-User-Email')?.trim().toLowerCase() ??
    request.headers.get('X-User-Email')?.trim().toLowerCase() ??
    null
  );
}

export async function GET(request: NextRequest) {
  // 1. Auth wajib
  const email = getVerifiedEmail(request);
  if (!email) {
    return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
  }

  // 2. Resolve user_id dari email — tabel orders pakai user_id, BUKAN email
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (profileErr || !profile) {
    return NextResponse.json({ items: [], total: 0, page: 1, limit: 20 });
  }

  const { searchParams } = new URL(request.url);
  const page         = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10));
  const limit        = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const statusFilter = searchParams.get('status') ?? '';

  try {
    // 3. Filter HANYA order milik user ini via user_id
    let query = db
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (statusFilter) query = query.eq('status', statusFilter);

    const { data, count, error } = await query;
    if (error) throw error;

    const items = (data ?? []).map((o: any) => ({
      activationId : o.activation_id ?? '',
      phone        : o.phone         ?? '',
      service      : o.service_name  ?? '',
      status       : o.status        ?? 'unknown',
      statusLabel  : STATUS_LABEL[o.status] ?? o.status ?? '—',
      otpCode      : o.otp_code      ?? null,
      priceIDR     : o.price         ?? null,
      country      : o.country       ?? null,
      createdAt    : o.created_at
        ? new Date(o.created_at).toLocaleString('id-ID')
        : null,
    }));

    return NextResponse.json({ page, limit, total: count ?? 0, items });

  } catch (err) {
    console.error('[GET /api/history]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}