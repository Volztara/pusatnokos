// src/app/api/order-v2/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, checkRateLimitAsync, RATE_LIMITS } from '@/lib/rateLimit';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_CONFIG = {
  idrRate: 17135.75,
  markupPct: 0.25,
  minProfit: 200,
  roundTo: 100,
};

async function getMarkupConfig() {
  try {
    const { data } = await db.from('admin_settings').select('value').eq('key', 'markup_config').single();
    return data?.value ?? DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function applyMarkup(
  costUSD: number,
  idrRate: number,
  markupPct: number,
  minProfit: number,
  roundTo: number
): number {
  const modal = costUSD * idrRate;
  const profit = Math.max(modal * markupPct, minProfit);
  return Math.ceil((modal + profit) / roundTo) * roundTo;
}

export async function POST(request: Request) {
  try {
    const verifiedEmail = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase() ?? '';
    const verifiedUserId = request.headers.get('X-Verified-User-Id')?.trim() ?? '';

    if (!verifiedEmail || !verifiedUserId) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    // ✅ Rate limit — cek SEBELUM apapun
    const rlFast = checkRateLimit(`order_fast_${verifiedUserId}`, RATE_LIMITS.orderFast);
    if (!rlFast.allowed) {
      return NextResponse.json(
        { error: 'Terlalu cepat. Tunggu sebentar sebelum order lagi.' },
        { status: 429 }
      );
    }

    const rlHour = await checkRateLimitAsync(`order_hour_${verifiedUserId}`, RATE_LIMITS.order);
    if (!rlHour.allowed) {
      return NextResponse.json(
        { error: 'Batas order per jam tercapai. Coba lagi nanti.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const service = (body.service ?? '').trim();
    const country = (body.country ?? '6').trim();
    const operator = (body.operator ?? '0').trim();
    const multiService: string[] = Array.isArray(body.multiService) ? body.multiService : [];

    if (!service) {
      return NextResponse.json({ error: 'Parameter "service" wajib diisi.' }, { status: 400 });
    }

    // Cek blacklist
    const { data: profile } = await db
      .from('profiles')
      .select('balance, is_blacklisted')
      .eq('email', verifiedEmail)
      .single();

    if (profile?.is_blacklisted) {
      return NextResponse.json(
        { error: 'Your account has been suspended. Please contact support.' },
        { status: 403 }
      );
    }

    const config = await getMarkupConfig();
    const { idrRate, markupPct, minProfit, roundTo } = config;

    // Ambil harga dari HeroSMS
    const priceRes = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getPrices&country=${country}&service=${service}`,
      { cache: 'no-store' }
    );
    const priceRaw = priceRes.ok ? await priceRes.json() : null;

    let estimatedPrice = 0;
    try {
      const countryData = priceRaw?.[country] ?? {};
      const serviceData = countryData[service];
      const opData =
        typeof serviceData?.cost === 'number'
          ? serviceData
          : (serviceData?.[operator] ?? serviceData?.['0'] ?? null);
      if (opData?.cost) estimatedPrice = applyMarkup(opData.cost, idrRate, markupPct, minProfit, roundTo);
    } catch { /* estimasi harga gagal */ }

    // Soft check saldo
    if (estimatedPrice > 0 && profile && profile.balance < estimatedPrice) {
      return NextResponse.json(
        { error: 'Saldo tidak cukup. Silakan deposit terlebih dahulu.' },
        { status: 402 }
      );
    }

    // ✅ Potong saldo ATOMIC sebelum order
    if (estimatedPrice > 0) {
      const { data: deductResult } = await db.rpc('deduct_balance_for_order', {
        p_user_id: verifiedUserId,
        p_amount: estimatedPrice,
        p_desc: `Beli ${service} V2 (pending)`,
      });

      if (!deductResult?.success) {
        const reason = deductResult?.error ?? 'Gagal memproses pembayaran.';
        console.warn(`[order-v2 POST] Deduct failed for user ${verifiedEmail}: ${reason}`);
        return NextResponse.json({ error: reason }, { status: 402 });
      }
    }

    const serviceParam = multiService.length > 0
      ? `${service},${multiService.join(',')}`
      : service;

    const orderUrl =
      `${BASE_URL}?api_key=${API_KEY}&action=getNumberV2` +
      `&service=${serviceParam}&country=${country}&operator=${operator}`;

    let orderText = '';
    try {
      const orderRes = await fetch(orderUrl, { cache: 'no-store' });
      orderText = (await orderRes.text()).trim();
    } catch (e) {
      if (estimatedPrice > 0) {
        await db.rpc('update_balance', { p_email: verifiedEmail, p_amount: estimatedPrice });
        await db.from('mutations').insert({
          user_id: verifiedUserId,
          type: 'in',
          amount: estimatedPrice,
          description: `Refund otomatis — gagal koneksi ke provider`,
        });
      }
      return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
    }

    if (orderText.startsWith('ACCESS_NUMBER:')) {
      const parts = orderText.split(':');
      const activationId = parts[1] ?? '';
      const phone = parts[2] ?? '';
      const costUSD = parseFloat(parts[3] ?? '0') || 0;
      const finalPrice = costUSD > 0 ? applyMarkup(costUSD, idrRate, markupPct, minProfit, roundTo) : estimatedPrice;

      // Kalau harga aktual beda dari estimasi, adjust saldo
      if (estimatedPrice > 0 && finalPrice !== estimatedPrice) {
        const diff = estimatedPrice - finalPrice; // positif = estimasi lebih mahal → refund selisih
        if (diff > 0) {
          // Harga aktual lebih murah → kembalikan selisih ke user
          await db.rpc('update_balance', { p_email: verifiedEmail, p_amount: diff });
          await db.from('mutations').insert({
            user_id: verifiedUserId,
            type: 'in',
            amount: diff,
            description: `Selisih harga order ${service} #${activationId} (lebih murah)`,
          });
        } else if (diff < 0) {
          // Harga aktual lebih mahal → potong selisih tambahan dari saldo
          const extra = Math.abs(diff);
          const { data: deductExtra } = await db.rpc('deduct_balance_for_order', {
            p_user_id: verifiedUserId,
            p_amount: extra,
            p_desc: `Selisih harga order ${service} #${activationId} (lebih mahal)`,
          });
          if (!deductExtra?.success) {
            // Saldo tidak cukup untuk selisih — log saja, tidak batalkan order
            console.warn(`[order-v2] Gagal potong selisih harga ${extra} untuk user ${verifiedUserId}`);
          }
        }
      }

      if (verifiedUserId && activationId) {
        try {
          await db.from('orders').insert({
            user_id: verifiedUserId,
            activation_id: activationId,
            phone,
            price: finalPrice,
            service_name: service,
            status: 'waiting',
            refunded: false,
          });
        } catch (e) {
          console.error('[order-v2 POST] Gagal insert order ke DB:', e);
        }
      }

      return NextResponse.json({
        activationId,
        phone,
        price: finalPrice,
        activationCost: costUSD,
      });
    }

    // HeroSMS error — refund saldo
    if (estimatedPrice > 0) {
      await db.rpc('update_balance', { p_email: verifiedEmail, p_amount: estimatedPrice });
      await db.from('mutations').insert({
        user_id: verifiedUserId,
        type: 'in',
        amount: estimatedPrice,
        description: `Refund otomatis — ${orderText}`,
      });
    }

    const ERROR_MAP: Record<string, string> = {
      NO_NUMBERS: 'Stok nomor habis untuk layanan ini. Coba negara lain.',
      NO_BALANCE: 'Saldo HeroSMS tidak cukup (hubungi admin).',
      WRONG_SERVICE: 'Kode layanan tidak valid.',
      WRONG_COUNTRY: 'Kode negara tidak valid.',
      BAD_ACTION: 'Permintaan tidak valid ke upstream.',
      BAD_KEY: 'API key tidak valid (hubungi admin).',
      ERROR_SQL: 'Kesalahan server upstream.',
      BANNED: 'Akun API diblokir (hubungi admin).',
      REPEATED_NUMBER: 'Nomor sudah pernah dipesan untuk layanan ini.',
    };

    return NextResponse.json({ error: ERROR_MAP[orderText] ?? `Gagal memesan nomor: ${orderText}`, code: orderText }, { status: 422 });

  } catch (err) {
    console.error('[POST /api/order-v2]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();

    if (!id) return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });

    const res = await fetch(`${BASE_URL}?api_key=${API_KEY}&action=getStatusV2&id=${id}`, { cache: 'no-store' });
    const text = (await res.text()).trim();

    if (text === 'STATUS_WAIT_CODE') return NextResponse.json({ status: 'waiting', otpCodes: [], raw: text });
    if (text === 'STATUS_WAIT_RESEND') return NextResponse.json({ status: 'wait_resend', otpCodes: [], raw: text });
    if (text === 'STATUS_CANCEL') return NextResponse.json({ status: 'cancel', otpCodes: [], raw: text });

    if (text.startsWith('STATUS_OK:')) {
      const otpCodes = text.split(':').slice(1).filter(p => p.length > 0);
      return NextResponse.json({ status: 'ok', otpCodes, raw: text });
    }

    return NextResponse.json({ status: 'unknown', otpCodes: [], raw: text });

  } catch (err) {
    console.error('[GET /api/order-v2]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = (body.id ?? '').toString().trim();
    const action = (body.action ?? '').trim();

    if (!id || !action) {
      return NextResponse.json({ error: 'Parameters "id" and "action" are required.' }, { status: 400 });
    }

    const STATUS_CODE: Record<string, number> = { resend: 3, done: 6, cancel: 8 };
    const statusCode = STATUS_CODE[action];
    if (!statusCode) {
      return NextResponse.json({ error: 'Invalid "action". Use "cancel", "done", or "resend".' }, { status: 400 });
    }

    const url = `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${id}&status=${statusCode}`;
    const res = await fetch(url, { cache: 'no-store' });
    const text = (await res.text()).trim();

    const SUCCESS_TOKENS: Record<string, string[]> = {
      resend: ['ACCESS_RETRY_GET', 'STATUS_WAIT_RESEND'],
      done: ['ACCESS_ACTIVATION', 'ACTIVATION_STATUS_CHANGED'],
      cancel: ['ACCESS_CANCEL', 'ACTIVATION_STATUS_CHANGED', 'ACCESS_ALREADY_USED'],
    };

    const isSuccess = (SUCCESS_TOKENS[action] ?? []).some(t => text.startsWith(t));

    if (isSuccess) {
      if (action === 'cancel') {
        try {
          const { data: order } = await db
            .from('orders')
            .select('id, user_id, price, service_name, refunded, status')
            .eq('activation_id', id)
            .maybeSingle();

          if (
            order && order.user_id && order.price > 0 &&
            !order.refunded &&
            order.status !== 'expired' &&
            order.status !== 'cancelled' &&
            order.status !== 'success'
          ) {
            const { data: updated } = await db
              .from('orders')
              .update({ status: 'cancelled', refunded: true })
              .eq('id', order.id)
              .eq('refunded', false)
              .eq('status', 'waiting')
              .select('id');

            if (updated && updated.length > 0) {
              // Atomic update berhasil — sekarang refund saldo
              try {
                const { data: profile } = await db
                  .from('profiles').select('email').eq('id', order.user_id).single();

                if (!profile?.email) throw new Error('Profile tidak ditemukan');

                const { error: rpcErr } = await db.rpc('update_balance', {
                  p_email: profile.email,
                  p_amount: order.price,
                });

                if (rpcErr) throw new Error(`update_balance gagal: ${rpcErr.message}`);

                await db.from('mutations').insert({
                  user_id: order.user_id,
                  type: 'in',
                  amount: order.price,
                  description: `Refund pembatalan order #${order.id}`,
                });

                console.log(`[order-v2 cancel] Refunded ${order.price} to user ${order.user_id} (order #${order.id})`);
              } catch (refundErr) {
                // CRITICAL: order sudah cancelled & refunded=true di DB tapi saldo belum kembali
                console.error(`[order-v2 cancel] CRITICAL — refund gagal order #${order.id}, user ${order.user_id}, amount ${order.price}:`, refundErr);
                try {
                  await db.from('admin_logs').insert({
                    action: 'refund_failed',
                    target_id: String(order.id),
                    details: `CRITICAL: Refund Rp ${order.price} gagal untuk user ${order.user_id} (order-v2 #${order.id}). Perlu manual refund.`,
                  });
                } catch { }
              }
            } else {
              // Atomic update gagal → sudah direfund proses lain → skip
              console.log(`[order-v2 cancel] Skip double refund — order #${order?.id} sudah diproses`);
            }
          }
        } catch (e) {
          console.error(`[order-v2 cancel] Refund failed for activation ${id}:`, e);
        }
      }

      const MESSAGE: Record<string, string> = {
        resend: 'OTP resend request sent successfully.',
        done: 'Order confirmed as completed.',
        cancel: 'Order cancelled. Balance will be refunded.',
      };
      return NextResponse.json({ success: true, message: MESSAGE[action] });
    }

    console.error(`[PATCH /api/order-v2] upstream error: ${text}`);
    return NextResponse.json({ success: false, error: 'Failed to update order status.' }, { status: 422 });

  } catch (err) {
    console.error('[PATCH /api/order-v2]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}