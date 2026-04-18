// src/app/api/activations/route.ts
// Ambil semua order yang sedang aktif (waiting) untuk Aktivasi Live admin

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data, error } = await db
    .from('orders')
    .select('*, profiles(name, email)')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json([]);

  const activations = (data ?? []).map((o: any) => ({
    id           : o.id,
    activationId : o.activation_id,
    phone        : o.phone,
    service      : o.service_name,
    status       : o.status,
    statusLabel  : 'Menunggu',
    otpCode      : o.otp_code ?? null,
    priceIDR     : o.price ?? null,
    userEmail    : o.profiles?.email ?? '',
    userName     : o.profiles?.name ?? '',
    createdAt    : o.created_at,
  }));

  return NextResponse.json(activations);
}