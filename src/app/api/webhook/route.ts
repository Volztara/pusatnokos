// src/app/api/webhook/route.ts
//
// Menerima notifikasi OTP dari HeroSMS secara real-time.
// HeroSMS akan POST ke URL ini setiap kali SMS masuk ke nomor yang aktif.
//
// Setup di HeroSMS:
//   Dashboard → Settings → Webhook URL → https://yourdomain.com/api/webhook
//
// ⚠️  Event disimpan in-memory — akan hilang saat server restart.
//     Untuk production, ganti dengan database (Redis, Postgres, dll).

import { NextResponse } from 'next/server';

// ─── IN-MEMORY EVENT STORE ────────────────────────────────────────────
// Map: activationId → OTP event terbaru
// Dibaca oleh /api/webhook/stream (SSE)

export const webhookEvents = new Map<string, WebhookEvent>();

export interface WebhookEvent {
  activationId : string;
  phone        : string;
  service      : string;
  smsCode      : string;
  smsText      : string;
  receivedAt   : string;   // ISO timestamp
}

// SSE subscribers: Set of ReadableStream controllers
export const sseClients = new Set<ReadableStreamDefaultController>();
// ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/webhook
 *
 * Dipanggil oleh HeroSMS saat OTP masuk.
 *
 * HeroSMS body (form-encoded atau JSON):
 *   activationId | id  — ID aktivasi
 *   phone               — nomor HP
 *   smsCode | code      — kode OTP
 *   service             — kode layanan
 *   smsText | text      — isi SMS lengkap
 *
 * Response: "OK" (HeroSMS expect string "OK")
 */
export async function POST(request: Request) {
  try {
    let body: Record<string, string> = {};

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // form-urlencoded
      const text   = await request.text();
      const params = new URLSearchParams(text);
      params.forEach((v, k) => { body[k] = v; });
    }

    const activationId = body.activationId ?? body.id          ?? '';
    const phone        = body.phone                            ?? '';
    const smsCode      = body.smsCode      ?? body.code        ?? '';
    const service      = body.service                          ?? '';
    const smsText      = body.smsText      ?? body.text        ?? smsCode;

    if (!activationId || !smsCode) {
      // Kembalikan OK tetap agar HeroSMS tidak retry
      return new Response('OK', { status: 200 });
    }

    const event: WebhookEvent = {
      activationId,
      phone,
      service,
      smsCode,
      smsText,
      receivedAt: new Date().toISOString(),
    };

    // Simpan ke store
    webhookEvents.set(activationId, event);

    // Broadcast ke semua SSE client yang terhubung
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const controller of sseClients) {
      try {
        controller.enqueue(new TextEncoder().encode(payload));
      } catch {
        sseClients.delete(controller);
      }
    }

    console.log(`[webhook] OTP masuk — id: ${activationId}, code: ${smsCode}`);
    return new Response('OK', { status: 200 });

  } catch (err) {
    console.error('[POST /api/webhook]', err);
    return new Response('OK', { status: 200 }); // selalu OK agar HeroSMS tidak retry
  }
}

/**
 * GET /api/webhook?id={activationId}
 *
 * Ambil event terakhir untuk activationId tertentu (one-shot, bukan SSE).
 * Berguna sebagai fallback jika SSE tidak tersedia.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  const event = webhookEvents.get(id);
  if (!event) {
    return NextResponse.json({ status: 'waiting' });
  }

  return NextResponse.json({ status: 'ok', ...event });
}