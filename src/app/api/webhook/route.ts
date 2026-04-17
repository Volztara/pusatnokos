// src/app/api/webhook/route.ts
//
// Menerima notifikasi OTP dari HeroSMS secara real-time.
// OTP disimpan ke tabel orders di Supabase (persistent, works on Netlify).
//
// Setup di HeroSMS:
//   Dashboard → Settings → Webhook URL → https://pusatnokos.com/api/webhook

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Shared map untuk SSE clients — di-import oleh stream/route.ts
// ⚠️  Catatan: di serverless (Netlify), map ini hanya hidup per-invocation.
//    Untuk real-time cross-request, stream/route.ts sebaiknya polling Supabase.
const sseClients = new Set<ReadableStreamDefaultController>();

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    let body: Record<string, string> = {};

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      const text = await request.text();
      new URLSearchParams(text).forEach((v, k) => { body[k] = v; });
    }

    const activationId = body.activationId ?? body.id    ?? '';
    const smsCode      = body.smsCode      ?? body.code  ?? '';
    const smsText      = body.smsText      ?? body.text  ?? smsCode;

    console.log('[webhook] OTP masuk — id:', activationId, 'code:', smsCode);

    if (!activationId || !smsCode) {
      return new Response('OK', { status: 200 });
    }

    // Update otp_code & status di tabel orders berdasarkan activation_id
    const { error } = await db
      .from('orders')
      .update({
        otp_code  : smsCode,
        status    : 'success',
        updated_at: new Date().toISOString(),
      })
      .eq('activation_id', activationId)
      .eq('status', 'waiting'); // hanya update yang masih waiting

    if (error) {
      console.error('[webhook] gagal update orders:', error);
    } else {
      console.log('[webhook] OTP tersimpan untuk activation_id:', activationId);
    }

    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('[POST /api/webhook]', err);
    return new Response('OK', { status: 200 }); // selalu OK agar HeroSMS tidak retry
  }
}

/**
 * GET /api/webhook?id={activationId}
 * Ambil OTP dari Supabase — fallback jika SSE tidak tersedia.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  const { data: order } = await db
    .from('orders')
    .select('otp_code, status, updated_at')
    .eq('activation_id', id)
    .single();

  if (!order?.otp_code) {
    return NextResponse.json({ status: 'waiting' });
  }

  return NextResponse.json({
    status   : 'ok',
    smsCode  : order.otp_code,
    receivedAt: order.updated_at,
  });
}