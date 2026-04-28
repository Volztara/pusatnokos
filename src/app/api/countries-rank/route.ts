// src/app/api/countries-rank/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const COUNTRY_NAMES: Record<number, { name: string; flag: string }> = {
  0: { name: 'Russia', flag: '🇷🇺' },
  1: { name: 'Ukraine', flag: '🇺🇦' },
  2: { name: 'Kazakhstan', flag: '🇰🇿' },
  3: { name: 'China', flag: '🇨🇳' },
  4: { name: 'Philippines', flag: '🇵🇭' },
  5: { name: 'Myanmar', flag: '🇲🇲' },
  6: { name: 'Indonesia', flag: '🇮🇩' },
  7: { name: 'Malaysia', flag: '🇲🇾' },
  8: { name: 'Kenya', flag: '🇰🇪' },
  9: { name: 'Tanzania', flag: '🇹🇿' },
  10: { name: 'Vietnam', flag: '🇻🇳' },
  11: { name: 'Kyrgyzstan', flag: '🇰🇬' },
  12: { name: 'USA', flag: '🇺🇸' },
  13: { name: 'Israel', flag: '🇮🇱' },
  14: { name: 'Hong Kong', flag: '🇭🇰' },
  15: { name: 'Poland', flag: '🇵🇱' },
  16: { name: 'England', flag: '🇬🇧' },
  17: { name: 'Madagascar', flag: '🇲🇬' },
  18: { name: 'Congo', flag: '🇨🇩' },
  19: { name: 'Nigeria', flag: '🇳🇬' },
  20: { name: 'Macao', flag: '🇲🇴' },
  21: { name: 'Egypt', flag: '🇪🇬' },
  22: { name: 'India', flag: '🇮🇳' },
  23: { name: 'Ireland', flag: '🇮🇪' },
  24: { name: 'Cambodia', flag: '🇰🇭' },
  25: { name: 'Laos', flag: '🇱🇦' },
  26: { name: 'Haiti', flag: '🇭🇹' },
  27: { name: 'Ivory Coast', flag: '🇨🇮' },
  28: { name: 'Gambia', flag: '🇬🇲' },
  29: { name: 'Serbia', flag: '🇷🇸' },
  30: { name: 'Yemen', flag: '🇾🇪' },
  31: { name: 'South Africa', flag: '🇿🇦' },
  32: { name: 'Romania', flag: '🇷🇴' },
  33: { name: 'Colombia', flag: '🇨🇴' },
  34: { name: 'Estonia', flag: '🇪🇪' },
  35: { name: 'Azerbaijan', flag: '🇦🇿' },
  36: { name: 'Canada', flag: '🇨🇦' },
  37: { name: 'Morocco', flag: '🇲🇦' },
  38: { name: 'Ghana', flag: '🇬🇭' },
  39: { name: 'Argentina', flag: '🇦🇷' },
  40: { name: 'Uzbekistan', flag: '🇺🇿' },
  41: { name: 'Cameroon', flag: '🇨🇲' },
  42: { name: 'Chad', flag: '🇹🇩' },
  43: { name: 'Germany', flag: '🇩🇪' },
  44: { name: 'Lithuania', flag: '🇱🇹' },
  45: { name: 'Croatia', flag: '🇭🇷' },
  46: { name: 'Sweden', flag: '🇸🇪' },
  47: { name: 'Iraq', flag: '🇮🇶' },
  48: { name: 'Netherlands', flag: '🇳🇱' },
  49: { name: 'Latvia', flag: '🇱🇻' },
  50: { name: 'Austria', flag: '🇦🇹' },
  51: { name: 'Belarus', flag: '🇧🇾' },
  52: { name: 'Thailand', flag: '🇹🇭' },
  53: { name: 'Saudi Arabia', flag: '🇸🇦' },
  54: { name: 'Mexico', flag: '🇲🇽' },
  55: { name: 'Taiwan', flag: '🇹🇼' },
  56: { name: 'Spain', flag: '🇪🇸' },
  57: { name: 'Iran', flag: '🇮🇷' },
  58: { name: 'Algeria', flag: '🇩🇿' },
  59: { name: 'Slovenia', flag: '🇸🇮' },
  60: { name: 'Bangladesh', flag: '🇧🇩' },
  61: { name: 'Senegal', flag: '🇸🇳' },
  62: { name: 'Turkey', flag: '🇹🇷' },
  63: { name: 'Czech Republic', flag: '🇨🇿' },
  64: { name: 'Sri Lanka', flag: '🇱🇰' },
  65: { name: 'Peru', flag: '🇵🇪' },
  66: { name: 'Pakistan', flag: '🇵🇰' },
  67: { name: 'New Zealand', flag: '🇳🇿' },
  68: { name: 'Guinea', flag: '🇬🇳' },
  69: { name: 'Mali', flag: '🇲🇱' },
  70: { name: 'Venezuela', flag: '🇻🇪' },
  71: { name: 'Ethiopia', flag: '🇪🇹' },
  72: { name: 'Mongolia', flag: '🇲🇳' },
  73: { name: 'Brazil', flag: '🇧🇷' },
  74: { name: 'Afghanistan', flag: '🇦🇫' },
  75: { name: 'Uganda', flag: '🇺🇬' },
  76: { name: 'Angola', flag: '🇦🇴' },
  77: { name: 'Cyprus', flag: '🇨🇾' },
  78: { name: 'France', flag: '🇫🇷' },
  79: { name: 'Papua New Guinea', flag: '🇵🇬' },
  80: { name: 'Mozambique', flag: '🇲🇿' },
  81: { name: 'Nepal', flag: '🇳🇵' },
  82: { name: 'Belgium', flag: '🇧🇪' },
  83: { name: 'Bulgaria', flag: '🇧🇬' },
  84: { name: 'Hungary', flag: '🇭🇺' },
  85: { name: 'Moldova', flag: '🇲🇩' },
  86: { name: 'Italy', flag: '🇮🇹' },
  87: { name: 'Paraguay', flag: '🇵🇾' },
  88: { name: 'Honduras', flag: '🇭🇳' },
  89: { name: 'Tunisia', flag: '🇹🇳' },
  90: { name: 'Nicaragua', flag: '🇳🇮' },
  91: { name: 'Timor-Leste', flag: '🇹🇱' },
  92: { name: 'Bolivia', flag: '🇧🇴' },
  93: { name: 'Costa Rica', flag: '🇨🇷' },
  94: { name: 'Guatemala', flag: '🇬🇹' },
  95: { name: 'UAE', flag: '🇦🇪' },
  96: { name: 'Zimbabwe', flag: '🇿🇼' },
  97: { name: 'Puerto Rico', flag: '🇵🇷' },
  98: { name: 'Sudan', flag: '🇸🇩' },
  99: { name: 'Togo', flag: '🇹🇬' },
  100: { name: 'Kuwait', flag: '🇰🇼' },
  101: { name: 'El Salvador', flag: '🇸🇻' },
  102: { name: 'Libya', flag: '🇱🇾' },
  103: { name: 'Jamaica', flag: '🇯🇲' },
  104: { name: 'Trinidad and Tobago', flag: '🇹🇹' },
  105: { name: 'Ecuador', flag: '🇪🇨' },
  106: { name: 'Eswatini', flag: '🇸🇿' },
  107: { name: 'Bahrain', flag: '🇧🇭' },
  108: { name: 'Oman', flag: '🇴🇲' },
  109: { name: 'Botswana', flag: '🇧🇼' },
  110: { name: 'Mauritius', flag: '🇲🇺' },
  111: { name: 'Benin', flag: '🇧🇯' },
  112: { name: 'Burundi', flag: '🇧🇮' },
  113: { name: 'Jordan', flag: '🇯🇴' },
  114: { name: 'Burkina Faso', flag: '🇧🇫' },
  115: { name: 'Zambia', flag: '🇿🇲' },
  116: { name: 'Finland', flag: '🇫🇮' },
  117: { name: 'Somalia', flag: '🇸🇴' },
  118: { name: 'Denmark', flag: '🇩🇰' },
  119: { name: 'Dominican Republic', flag: '🇩🇴' },
  120: { name: 'Syria', flag: '🇸🇾' },
  121: { name: 'Qatar', flag: '🇶🇦' },
  122: { name: 'Panama', flag: '🇵🇦' },
  123: { name: 'Cuba', flag: '🇨🇺' },
  124: { name: 'Malawi', flag: '🇲🇼' },
  125: { name: 'Sierra Leone', flag: '🇸🇱' },
  126: { name: 'Liberia', flag: '🇱🇷' },
  127: { name: 'Slovakia', flag: '🇸🇰' },
  128: { name: 'Norway', flag: '🇳🇴' },
  129: { name: 'Switzerland', flag: '🇨🇭' },
  130: { name: 'Portugal', flag: '🇵🇹' },
  131: { name: 'Greece', flag: '🇬🇷' },
  132: { name: 'Japan', flag: '🇯🇵' },
  133: { name: 'Australia', flag: '🇦🇺' },
  134: { name: 'South Korea', flag: '🇰🇷' },
  135: { name: 'Singapore', flag: '🇸🇬' },
  136: { name: 'Tajikistan', flag: '🇹🇯' },
  137: { name: 'Armenia', flag: '🇦🇲' },
  138: { name: 'Chile', flag: '🇨🇱' },
  139: { name: 'Lebanon', flag: '🇱🇧' },
  140: { name: 'Rwanda', flag: '🇷🇼' },
  141: { name: 'Albania', flag: '🇦🇱' },
  142: { name: 'Georgia', flag: '🇬🇪' },
  143: { name: 'Turkmenistan', flag: '🇹🇲' },
  144: { name: 'Brunei', flag: '🇧🇳' },
  145: { name: 'Bosnia', flag: '🇧🇦' },
  146: { name: 'North Macedonia', flag: '🇲🇰' },
};

// Indonesia paling atas, lalu negara populer lainnya
const PRIORITY = [6, 7, 12, 22, 52, 10, 4, 16, 62, 73, 66, 53, 95, 3, 0, 15, 19];

// In-memory cache — data negara tidak perlu update setiap request
let cachedResult: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 jam

export async function GET() {
  // Kembalikan cache kalau masih fresh
  if (cachedResult && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json(cachedResult);
  }

  try {
    const url = `${BASE_URL}?api_key=${API_KEY}&action=getTopCountriesByService&freePrice=true&rank=true`;
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000), // timeout 8 detik, jangan sampai > 10s Vercel limit
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Kumpulkan country id dari response API
    const seen = new Set<number>();
    const entries = Array.isArray(raw)
      ? raw
      : Object.values(raw).flatMap((v: any) =>
        Array.isArray(v) ? v : typeof v === 'object' ? Object.values(v) : []
      );
    for (const e of entries as any[]) {
      const cid = Number(e.country ?? e.countryId ?? -1);
      if (cid >= 0) seen.add(cid);
    }

    // Gabungkan dengan semua dari COUNTRY_NAMES supaya lengkap
    for (const id of Object.keys(COUNTRY_NAMES)) seen.add(Number(id));

    const result = [...seen]
      .map(cid => {
        const info = COUNTRY_NAMES[cid];
        if (!info) return null;
        const priority = PRIORITY.indexOf(cid);
        return {
          id: String(cid),
          name: `${info.flag} ${info.name}`,
          rank: priority >= 0 ? priority : 999 + cid,
          count: 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.rank - b.rank);

    // Simpan ke cache
    cachedResult = result;
    cacheTime = Date.now();

    return NextResponse.json(result);

  } catch (err) {
    console.error('[GET /api/countries-rank]', err);
    // Kalau ada cache lama → pakai itu daripada fallback hardcoded
    if (cachedResult) {
      console.log('[GET /api/countries-rank] Menggunakan cache lama karena HeroSMS error');
      return NextResponse.json(cachedResult);
    }
    return NextResponse.json([
      { id: '6', name: '🇮🇩 Indonesia', rank: 1, count: 0 },
      { id: '7', name: '🇲🇾 Malaysia', rank: 2, count: 0 },
      { id: '12', name: '🇺🇸 USA', rank: 3, count: 0 },
      { id: '22', name: '🇮🇳 India', rank: 4, count: 0 },
      { id: '52', name: '🇹🇭 Thailand', rank: 5, count: 0 },
      { id: '10', name: '🇻🇳 Vietnam', rank: 6, count: 0 },
      { id: '16', name: '🇬🇧 England', rank: 7, count: 0 },
    ]);
  }
}