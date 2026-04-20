// src/app/api/webhook/stream/route.ts
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

function extractNumericOtp(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\b(\d{4,10})\b/);
  return match ? match[1] : null;
}

/** Ambil kode langsung dari HeroSMS getStatus, update Supabase, return kode */
async function resolveOtpFromHeroSMS(activationId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getStatus&id=${activationId}`,
      { cache: 'no-store', signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const text = (await res.text()).trim();

    let code: string | null = null;
    if (text.startsWith('STATUS_OK:')) {
      const fullText = text.slice('STATUS_OK:'.length);
      code = extractNumericOtp(fullText) || fullText;
    }

    if (code) {
      // Update Supabase supaya polling berikutnya tidak perlu fetch lagi
      await db.from('orders').update({ otp_code: code }).eq('activation_id', activationId);
    }
    return code;
  } catch {
    return null;
  }
}

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
        } catch {}
      };

      try {
        controller.enqueue(encoder.encode(': connected\n\n'));
      } catch { return; }

      if (watchIds.length === 0) { controller.close(); return; }

      const notified = new Set<string>();
      const fetching = new Set<string>(); // hindari double-fetch HeroSMS
      let closed = false;

      const heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(': ping\n\n')); }
        catch { closed = true; clearInterval(heartbeat); }
      }, 25_000);

      const poll = setInterval(async () => {
        if (closed) return;
        const remaining = watchIds.filter(id => !notified.has(id));
        if (remaining.length === 0) {
          closed = true; clearInterval(poll); clearInterval(heartbeat);
          try { controller.close(); } catch {}
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

            if (order.status === 'cancelled') {
              notified.add(order.activation_id);
              send({ activationId: order.activation_id, status: 'cancel', service: order.service_name });
              continue;
            }

            if (order.status === 'success' && order.otp_code) {
              let code = extractNumericOtp(order.otp_code);

              if (!code && !fetching.has(order.activation_id)) {
                // Kode tidak ada angka — fetch dari HeroSMS langsung
                fetching.add(order.activation_id);
                code = await resolveOtpFromHeroSMS(order.activation_id);
              }

              if (code) {
                notified.add(order.activation_id);
                send({ activationId: order.activation_id, smsCode: code, service: order.service_name });
              }
              // Kalau masih null, biarkan poll berikutnya coba lagi
            }
          }
        } catch {}
      }, 3_000);

      const timeout = setTimeout(() => {
        closed = true; clearInterval(poll); clearInterval(heartbeat);
        try { controller.close(); } catch {}
      }, 5 * 60 * 1000);

      return () => {
        closed = true; clearInterval(poll); clearInterval(heartbeat); clearTimeout(timeout);
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