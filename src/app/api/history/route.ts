// src/app/api/history/route.ts
import { NextResponse } from 'next/server';

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
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page         = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
  const limit        = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const statusFilter = searchParams.get('status') ?? '';
  const email        = searchParams.get('email')  ?? '';

  try {
    let query = db
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (email)        query = query.eq('email', email);
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
      createdAt    : o.created_at
        ? new Date(o.created_at).toLocaleString('id-ID')
        : null,
    }));

    return NextResponse.json({ page, limit, total: count, items });

  } catch (err) {
    console.error('[GET /api/history]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
