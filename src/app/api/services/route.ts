// src/app/api/services/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

async function getPriceOverrides(): Promise<Record<string, number>> {
  try {
    const { data } = await db.from('admin_settings').select('value').eq('key', 'price_overrides').single();
    return data?.value ?? {};
  } catch { return {}; }
}

function applyMarkup(
  costUSD  : number,
  idrRate  : number,
  markupPct: number,
  minProfit: number,
  roundTo  : number
): { price: number; basePrice: number } {
  const basePrice = Math.round(costUSD * idrRate);
  const profit    = Math.max(basePrice * markupPct, minProfit);
  const price     = Math.ceil((basePrice + profit) / roundTo) * roundTo;
  return { price, basePrice };
}

const SERVICE_NAME_MAP: Record<string, string> = {
  wa: 'WhatsApp', tg: 'Telegram', li: 'Line', sg: 'Signal', dc: 'Discord',
  vb: 'Viber', wc: 'WeChat', sk: 'Skype', ic: 'ICQ New', kk: 'KakaoTalk',
  zl: 'Zalo', im: 'iMessage', imo: 'IMO', bi: 'Bigo Live', mm: 'MiChat',
  ig: 'Instagram', fb: 'Facebook', tw: 'Twitter / X', tk: 'TikTok',
  sc: 'Snapchat', pt: 'Pinterest', rd: 'Reddit', ln: 'LinkedIn',
  yt: 'YouTube', vk: 'VKontakte', gg: 'Google', gm: 'Gmail', ms: 'Microsoft',
  ol: 'Outlook', yh: 'Yahoo', ap: 'Apple ID', ya: 'Yandex', sp: 'Shopee',
  tpd: 'Tokopedia', lz: 'Lazada', bl: 'Bukalapak', am: 'Amazon',
  eb: 'eBay', al: 'AliExpress', gj: 'Gojek', gr: 'Grab', mx: 'Maxim',
  ub: 'Uber', ov: 'OVO', da: 'DANA', pp: 'PayPal', nf: 'Netflix',
  bt: 'Bumble', td: 'Tinder', rl: 'Roblox', gp: 'Google Play',
  st: 'Steam', ep: 'Epic Games', ml2: 'Mobile Legends', ff: 'Free Fire',
  pb: 'PUBG Mobile', nv: 'NVIDIA',
};

// Parse response — aman dari plain text error
async function safeJson(res: Response): Promise<any> {
  const text = (await res.text()).trim();
  try { return JSON.parse(text); } catch { return text; }
}

function extractNamesFlat(namesRaw: any): Record<string, string> {
  if (!namesRaw || typeof namesRaw !== 'object' || Array.isArray(namesRaw)) return {};
  const flat: Record<string, string> = {};
  if (Array.isArray(namesRaw.services)) {
    for (const item of namesRaw.services) {
      if (item?.code && item?.name) flat[item.code] = item.name;
    }
    return flat;
  }
  if (typeof namesRaw.services === 'object') return namesRaw.services;
  if (typeof namesRaw.data === 'object' && !Array.isArray(namesRaw.data)) return namesRaw.data;
  for (const [key, val] of Object.entries(namesRaw)) {
    if (typeof val === 'string') flat[key] = val;
  }
  return flat;
}

/**
 * Selalu pilih operator dengan stok TERTINGGI.
 * HeroSMS tiap negara punya operator berbeda (0, 3, 7, dll).
 * Dengan ini semua negara tampil stok yang sebenarnya, bukan cuma operator 0.
 */
function getBestOperator(val: any): { cost: number; count: number } {
  // Format flat: { cost, count } langsung
  if (typeof val?.cost === 'number') {
    return { cost: val.cost, count: val.count ?? 0 };
  }

  // Format nested: { "0": { cost, count }, "3": { cost, count }, ... }
  if (typeof val === 'object' && val !== null) {
    let best: { cost: number; count: number } | null = null;
    for (const op of Object.values(val) as any[]) {
      if (typeof op?.cost !== 'number') continue;
      const count = op.count ?? 0;
      // Pilih yang stok paling banyak; kalau sama, pilih yang harga lebih murah
      if (!best || count > best.count || (count === best.count && op.cost < best.cost)) {
        best = { cost: op.cost, count };
      }
    }
    if (best) return best;
  }

  return { cost: 0, count: 0 };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country') ?? '6';

  if (!API_KEY) {
    return NextResponse.json({ error: 'API key belum dikonfigurasi.' }, { status: 500 });
  }

  try {
    const [config, overrides, pricesRes, namesRes] = await Promise.all([
      getMarkupConfig(),
      getPriceOverrides(),
      fetch(`${BASE_URL}?api_key=${API_KEY}&action=getPrices&country=${country}`, { cache: 'no-store' }),
      fetch(`${BASE_URL}?api_key=${API_KEY}&action=getServicesList`, { cache: 'no-store' }),
    ]);

    const pricesRaw = await safeJson(pricesRes);
    const namesRaw  = await safeJson(namesRes);

    // Kalau HeroSMS return error string
    if (typeof pricesRaw === 'string') {
      console.error('[/api/services] HeroSMS prices error:', pricesRaw, 'country:', country);
      return NextResponse.json([]);
    }

    const namesFlat = typeof namesRaw === 'object' && namesRaw !== null
      ? extractNamesFlat(namesRaw)
      : {};

    // HeroSMS kadang nested di key negara, kadang langsung flat
    // Coba string key dulu, fallback number key, fallback root object
    const countryData: Record<string, any> =
      pricesRaw?.[country] ??
      pricesRaw?.[Number(country)] ??
      (typeof pricesRaw === 'object' && !Array.isArray(pricesRaw) ? pricesRaw : {});

    const { idrRate, markupPct, minProfit, roundTo } = config;

    const result = Object.entries(countryData)
      .map(([code, val]: [string, any]) => {
        // Selalu ambil operator dengan stok terbaik
        const { cost, count } = getBestOperator(val);

        const codeLower    = code.toLowerCase();
        const nameFromAPI  = namesFlat[code] ?? namesFlat[codeLower];
        const nameFromMap  = SERVICE_NAME_MAP[codeLower] ?? SERVICE_NAME_MAP[code];
        const resolvedName = nameFromAPI || nameFromMap || code.toUpperCase();

        // Sembunyikan service yang benar-benar tidak ada di HeroSMS
        if (cost <= 0 && count <= 0) return null;

        const { price: defaultPrice, basePrice } = applyMarkup(
          cost > 0 ? cost : 0.01,
          idrRate, markupPct, minProfit, roundTo
        );

        const overridePrice = overrides[code] ?? overrides[codeLower] ?? null;
        const price  = overridePrice ?? defaultPrice;
        const profit = price - basePrice;

        return {
          code,
          name       : resolvedName,
          price,
          basePrice,
          profit,
          count,
          outOfStock : count <= 0,
          isOverride : overridePrice !== null,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => {
        if (a.outOfStock && !b.outOfStock) return 1;
        if (!a.outOfStock && b.outOfStock) return -1;
        return b.count - a.count;
      });

    return NextResponse.json(result);

  } catch (err) {
    console.error('[/api/services]', err);
    return NextResponse.json({ error: 'Gagal mengambil data layanan' }, { status: 500 });
  }
}