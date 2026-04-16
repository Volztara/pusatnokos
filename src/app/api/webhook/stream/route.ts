// src/app/api/webhook/stream/route.ts
//
// Server-Sent Events (SSE) endpoint.
// Frontend connect ke sini untuk terima notifikasi OTP secara real-time
// tanpa perlu polling setiap 5 detik.
//
// Cara pakai di frontend:
//   const es = new EventSource('/api/webhook/stream');
//   es.onmessage = (e) => {
//     const event = JSON.parse(e.data);
//     // event.activationId, event.smsCode, event.phone, dst
//   };

import { sseClients } from '../route';

export const runtime = 'nodejs'; // SSE butuh Node.js runtime, bukan Edge

/**
 * GET /api/webhook/stream
 *
 * Buka koneksi SSE. Client akan terima event setiap kali OTP masuk.
 * Koneksi otomatis tutup setelah 5 menit (timeout) untuk hemat resource.
 */
export async function GET() {
  let controller: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
      sseClients.add(controller);

      // Kirim comment awal agar koneksi tidak langsung timeout di beberapa browser
      controller.enqueue(new TextEncoder().encode(': connected\n\n'));

      // Heartbeat setiap 30 detik supaya koneksi tidak putus
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': ping\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30_000);

      // Auto-close setelah 5 menit
      const timeout = setTimeout(() => {
        clearInterval(heartbeat);
        sseClients.delete(controller);
        try { controller.close(); } catch { /* sudah tertutup */ }
      }, 5 * 60 * 1000);

      // Cleanup saat client disconnect
      return () => {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        sseClients.delete(controller);
      };
    },
    cancel() {
      sseClients.delete(controller);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type'                : 'text/event-stream',
      'Cache-Control'               : 'no-cache, no-transform',
      'Connection'                  : 'keep-alive',
      'X-Accel-Buffering'           : 'no',   // matikan buffering di Nginx
      'Access-Control-Allow-Origin' : '*',
    },
  });
}