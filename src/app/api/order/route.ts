// src/app/api/order/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rateLimit';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── KONFIGURASI MARKUP — baca dari DB ────────────────────────────────
const DEFAULT_CONFIG = {
  idrRate   : 17135.75,
  markupPct : 0.25,
  minProfit : 200,
  roundTo   : 100,
};

async function getMarkupConfig() {
  try {
    const { data } = await db.from('admin_settings').select('value').eq('key', 'markup_config').single();
    return data?.value ?? DEFAULT_CONFIG;
  } catch { return DEFAULT_CONFIG; }
}

function applyMarkup(
  costUSD  : number,
  idrRate  : number,
  markupPct: number,
  minProfit: number,
  roundTo  : number
): number {
  const modal  = costUSD * idrRate;
  const profit = Math.max(modal * markupPct, minProfit);
  return Math.ceil((modal + profit) / roundTo) * roundTo;
}

export async function POST(request: Request) {
  try {
    // ✅ Ambil email dari header terverifikasi middleware — tidak bisa dipalsukan
    const verifiedEmail  = request.headers.get('X-Verified-User-Email')?.trim().toLowerCase() ?? '';
    const verifiedUserId = request.headers.get('X-Verified-User-Id')?.trim() ?? '';

    const body     = await request.json();
    const service  = (body.service  ?? '').trim();
    const country  = (body.country  ?? '6').trim();
    const operator = (body.operator ?? '0').trim();

    if (!service) {
      return NextResponse.json({ error: 'Parameter "service" is required.' }, { status: 400 });
    }

    if (!verifiedEmail || !verifiedUserId) {
      return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });
    }

    // ✅ Rate limit — cek SEBELUM apapun, pakai userId supaya tidak bisa bypass ganti IP
    const rlFast = checkRateLimit(`order_fast_${verifiedUserId}`, RATE_LIMITS.orderFast);
    if (!rlFast.allowed) {
      return NextResponse.json(
        { error: 'Terlalu cepat. Tunggu sebentar sebelum order lagi.' },
        { status: 429 }
      );
    }

    const rlHour = checkRateLimit(`order_hour_${verifiedUserId}`, RATE_LIMITS.order);
    if (!rlHour.allowed) {
      return NextResponse.json(
        { error: 'Batas order per jam tercapai (10x). Coba lagi nanti.' },
        { status: 429 }
      );
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

    let priceIDR = 0;
    try {
      const countryData = priceRaw?.[country] ?? {};
      const serviceData = countryData[service];
      const opData =
        typeof serviceData?.cost === 'number'
          ? serviceData
          : (serviceData?.[operator] ?? serviceData?.['0'] ?? null);
      if (opData?.cost) priceIDR = applyMarkup(opData.cost, idrRate, markupPct, minProfit, roundTo);
    } catch { /* harga tidak kritis */ }

    // Cek saldo cukup (soft check sebelum atomic)
    if (priceIDR > 0 && profile && profile.balance < priceIDR) {
      return NextResponse.json(
        { error: 'Saldo tidak cukup. Silakan deposit terlebih dahulu.' },
        { status: 402 }
      );
    }

    // ✅ Potong saldo ATOMIC sebelum order ke HeroSMS
    if (priceIDR > 0) {
      const { data: deductResult } = await db.rpc('deduct_balance_for_order', {
        p_user_id: verifiedUserId,
        p_amount : priceIDR,
        p_desc   : `Beli ${service} (pending)`,
      });

      if (!deductResult?.success) {
        const reason = deductResult?.error ?? 'Gagal memproses pembayaran.';
        console.warn(`[order POST] Deduct failed for user ${verifiedEmail}: ${reason}`);
        return NextResponse.json({ error: reason }, { status: 402 });
      }
    }

    // Order ke HeroSMS — kalau gagal, refund saldo kembali
    const orderUrl =
      `${BASE_URL}?api_key=${API_KEY}&action=getNumber` +
      `&service=${service}&country=${country}&operator=${operator}`;

    let orderText = '';
    try {
      const orderRes = await fetch(orderUrl, { cache: 'no-store' });
      orderText = (await orderRes.text()).trim();
    } catch (e) {
      if (priceIDR > 0) {
        await db.rpc('update_balance', { p_email: verifiedEmail, p_amount: priceIDR });
        await db.from('mutations').insert({
          user_id    : verifiedUserId,
          type       : 'in',
          amount     : priceIDR,
          description: `Refund otomatis — gagal koneksi ke provider`,
        });
      }
      return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
    }

    if (orderText.startsWith('ACCESS_NUMBER:')) {
      const [, activationId, phone] = orderText.split(':');

      if (verifiedUserId && activationId) {
        try {
          await db.from('orders').insert({
            user_id      : verifiedUserId,
            activation_id: activationId,
            phone,
            price        : priceIDR,
            service_name : service,
            status       : 'waiting',
            refunded     : false,
          });
        } catch (e) {
          console.error('[order POST] Gagal insert order ke DB:', e);
        }
      }

      return NextResponse.json({ activationId, phone, price: priceIDR });
    }

    // HeroSMS error — refund saldo
    if (priceIDR > 0) {
      await db.rpc('update_balance', { p_email: verifiedEmail, p_amount: priceIDR });
      await db.from('mutations').insert({
        user_id    : verifiedUserId,
        type       : 'in',
        amount     : priceIDR,
        description: `Refund otomatis — ${orderText}`,
      });
    }

    const ERROR_MAP: Record<string, string> = {
      NO_NUMBERS      : 'Number stock is unavailable for this service. Try another country.',
      NO_BALANCE      : 'Service temporarily unavailable. Please contact support.',
      WRONG_SERVICE   : 'Invalid service. Please try again.',
      WRONG_COUNTRY   : 'Invalid country. Please try again.',
      BAD_ACTION      : 'Invalid request. Please try again.',
      BAD_KEY         : 'Service temporarily unavailable. Please contact support.',
      ERROR_SQL       : 'Server error. Please try again later.',
      BANNED          : 'Service temporarily unavailable. Please contact support.',
      REPEATED_NUMBER : 'This number has already been used for this service.',
    };

    console.error(`[POST /api/order] upstream error: ${orderText}`);
    return NextResponse.json({ error: ERROR_MAP[orderText] ?? 'Failed to order number. Please try again.' }, { status: 422 });

  } catch (err) {
    console.error('[POST /api/order]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();

    if (!id) {
      return NextResponse.json({ error: 'Parameter "id" is required.' }, { status: 400 });
    }

    const res  = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getStatus&id=${id}`,
      { cache: 'no-store' }
    );
    const text = (await res.text()).trim();

    if (text === 'STATUS_WAIT_CODE')   return NextResponse.json({ status: 'waiting' });
    if (text === 'STATUS_WAIT_RESEND') return NextResponse.json({ status: 'wait_resend' });
    if (text === 'STATUS_CANCEL')      return NextResponse.json({ status: 'cancel' });

    if (text.startsWith('STATUS_OK:')) {
      const fullText = text.slice('STATUS_OK:'.length);
      const numMatch = fullText.match(/\b(\d{4,10})\b/);
      const otpCode  = numMatch ? numMatch[1] : fullText;
      return NextResponse.json({ status: 'ok', otpCode });
    }

    return NextResponse.json({ status: 'unknown' });

  } catch (err) {
    console.error('[GET /api/order]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body   = await request.json();
    const id     = (body.id     ?? '').toString().trim();
    const action = (body.action ?? '').trim();

    if (!id || !action) {
      return NextResponse.json({ error: 'Parameters "id" and "action" are required.' }, { status: 400 });
    }

    const STATUS_CODE: Record<string, number> = { resend: 3, done: 6, cancel: 8 };
    const statusCode = STATUS_CODE[action];
    if (!statusCode) {
      return NextResponse.json({ error: 'Invalid "action". Use "cancel", "done", or "resend".' }, { status: 400 });
    }

    const url  = `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${id}&status=${statusCode}`;
    const res  = await fetch(url, { cache: 'no-store' });
    const text = (await res.text()).trim();

    const SUCCESS_TOKENS: Record<string, string[]> = {
      resend: ['ACCESS_RETRY_GET', 'STATUS_WAIT_RESEND'],
      done  : ['ACCESS_ACTIVATION', 'ACTIVATION_STATUS_CHANGED'],
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
              const { data: profile } = await db
                .from('profiles').select('email').eq('id', order.user_id).single();

              if (profile?.email) {
                await db.rpc('update_balance', { p_email: profile.email, p_amount: order.price });
              }

              await db.from('mutations').insert({
                user_id    : order.user_id,
                type       : 'in',
                amount     : order.price,
                description: `Refund pembatalan order #${order.id}`,
              });

              console.log(`[cancel] Refunded ${order.price} to user ${order.user_id} (order #${order.id})`);
            } else {
              console.log(`[cancel] Skip — order #${order?.id} status: ${order?.status}, refunded: ${order?.refunded}`);
            }
          }
        } catch (e) {
          console.error(`[cancel] Refund failed for activation ${id}:`, e);
        }
      }

      const MESSAGE: Record<string, string> = {
        resend: 'OTP resend request sent successfully.',
        done  : 'Order confirmed as completed.',
        cancel: 'Order cancelled. Balance will be refunded.',
      };
      return NextResponse.json({ success: true, message: MESSAGE[action] });
    }

    console.error(`[PATCH /api/order] upstream error: ${text}`);
    return NextResponse.json({ success: false, error: 'Failed to update order status.' }, { status: 422 });

  } catch (err) {
    console.error('[PATCH /api/order]', err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}