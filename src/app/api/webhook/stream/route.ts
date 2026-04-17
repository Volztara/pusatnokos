// src/app/api/webhook/stream/route.ts
//
// Server-Sent Events (SSE) endpoint.
// Polling langsung ke Supabase — kompatibel dengan serverless (Netlify/Vercel).
// Tidak bergantung pada shared in-memory state antar invocation.

import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/webhook/stream?ids=id1,id2,id3
 *
 * Buka koneksi SSE. Client kirim activation IDs yang sedang ditunggu.
 * Server polling Supabase setiap 3 detik dan kirim event jika OTP masuk.
 * Koneksi otomatis tutup setelah 5 menit.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get('ids') ?? '';
  const watchIds = idsParam.split(',').map(s => s.trim()).filter(Boolean);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnect */ }
      };

      // Kirim comment awal agar koneksi tidak langsung timeout
      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch { return; }

      // Kalau tidak ada IDs, langsung tutup
      if (watchIds.length === 0) {
        controller.close();
        return;
      }

      const notified = new Set<string>(); // track yang sudah dikirim notifnya
      let closed = false;

      // Heartbeat setiap 25 detik
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          closed = true;
          clearInterval(heartbeat);
        }
      }, 25_000);

      // Polling Supabase setiap 3 detik
      const poll = setInterval(async () => {
        if (closed) return;

        const remaining = watchIds.filter(id => !notified.has(id));
        if (remaining.length === 0) {
          closed = true;
          clearInterval(poll);
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* sudah tertutup */ }
          return;
        }

        try {
          const { data: orders } = await db
            .from('orders')
            .select('activation_id, otp_code, status, service_name')
            .in('activation_id', remaining)
            .in('status', ['success', 'cancelled']);

          for (const order of orders ?? []) {
            if (notified.has(order.activation_id)) continue;
            notified.add(order.activation_id);

            if (order.status === 'success' && order.otp_code) {
              send({
                activationId: order.activation_id,
                smsCode     : order.otp_code,
                service     : order.service_name,
              });
            } else if (order.status === 'cancelled') {
              send({
                activationId: order.activation_id,
                status      : 'cancel',
                service     : order.service_name,
              });
            }
          }
        } catch { /* abaikan error jaringan sementara */ }
      }, 3_000);

      // Auto-close setelah 5 menit
      const timeout = setTimeout(() => {
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        try { controller.close(); } catch { /* sudah tertutup */ }
      }, 5 * 60 * 1000);

      // Cleanup saat client disconnect
      return () => {
        closed = true;
        clearInterval(poll);
        clearInterval(heartbeat);
        clearTimeout(timeout);
      };
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type'     : 'text/event-stream',
      'Cache-Control'    : 'no-cache, no-transform',
      'Connection'       : 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}