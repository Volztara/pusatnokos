import { NextResponse } from 'next/server';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

// Map country ID (number) → nama + flag
const COUNTRY_NAMES: Record<number, { name: string; flag: string }> = {
  0:  { name: 'Russia',        flag: '🇷🇺' },
  1:  { name: 'Ukraine',       flag: '🇺🇦' },
  2:  { name: 'Kazakhstan',    flag: '🇰🇿' },
  3:  { name: 'China',         flag: '🇨🇳' },
  4:  { name: 'Philippines',   flag: '🇵🇭' },
  5:  { name: 'Myanmar',       flag: '🇲🇲' },
  6:  { name: 'Indonesia',     flag: '🇮🇩' },
  7:  { name: 'Malaysia',      flag: '🇲🇾' },
  8:  { name: 'Kenya',         flag: '🇰🇪' },
  9:  { name: 'Tanzania',      flag: '🇹🇿' },
  10: { name: 'Vietnam',       flag: '🇻🇳' },
  11: { name: 'Kyrgyzstan',    flag: '🇰🇬' },
  12: { name: 'USA',           flag: '🇺🇸' },
  13: { name: 'Israel',        flag: '🇮🇱' },
  14: { name: 'Hong Kong',     flag: '🇭🇰' },
  15: { name: 'Poland',        flag: '🇵🇱' },
  16: { name: 'England',       flag: '🇬🇧' },
  17: { name: 'Madagascar',    flag: '🇲🇬' },
  18: { name: 'Congo',         flag: '🇨🇩' },
  19: { name: 'Nigeria',       flag: '🇳🇬' },
  20: { name: 'Macao',         flag: '🇲🇴' },
  21: { name: 'Egypt',         flag: '🇪🇬' },
  22: { name: 'India',         flag: '🇮🇳' },
  23: { name: 'Ireland',       flag: '🇮🇪' },
  24: { name: 'Cambodia',      flag: '🇰🇭' },
  25: { name: 'Laos',          flag: '🇱🇦' },
  26: { name: 'Haiti',         flag: '🇭🇹' },
  27: { name: 'Ivory Coast',   flag: '🇨🇮' },
  28: { name: 'Gambia',        flag: '🇬🇲' },
  29: { name: 'Serbia',        flag: '🇷🇸' },
  30: { name: 'Yemen',         flag: '🇾🇪' },
  31: { name: 'South Africa',  flag: '🇿🇦' },
  32: { name: 'Romania',       flag: '🇷🇴' },
  33: { name: 'Colombia',      flag: '🇨🇴' },
  34: { name: 'Estonia',       flag: '🇪🇪' },
  35: { name: 'Azerbaijan',    flag: '🇦🇿' },
  36: { name: 'Canada',        flag: '🇨🇦' },
  37: { name: 'Morocco',       flag: '🇲🇦' },
  38: { name: 'Ghana',         flag: '🇬🇭' },
  39: { name: 'Argentina',     flag: '🇦🇷' },
  40: { name: 'Uzbekistan',    flag: '🇺🇿' },
  41: { name: 'Cameroon',      flag: '🇨🇲' },
  42: { name: 'Chad',          flag: '🇹🇩' },
  43: { name: 'Germany',       flag: '🇩🇪' },
  44: { name: 'Lithuania',     flag: '🇱🇹' },
  45: { name: 'Croatia',       flag: '🇭🇷' },
  46: { name: 'Sweden',        flag: '🇸🇪' },
  47: { name: 'Iraq',          flag: '🇮🇶' },
  48: { name: 'Netherlands',   flag: '🇳🇱' },
  49: { name: 'Latvia',        flag: '🇱🇻' },
  50: { name: 'Austria',       flag: '🇦🇹' },
  51: { name: 'Belarus',       flag: '🇧🇾' },
  52: { name: 'Thailand',      flag: '🇹🇭' },
  53: { name: 'Saudi Arabia',  flag: '🇸🇦' },
  54: { name: 'Mexico',        flag: '🇲🇽' },
  55: { name: 'Taiwan',        flag: '🇹🇼' },
  56: { name: 'Spain',         flag: '🇪🇸' },
  57: { name: 'Iran',          flag: '🇮🇷' },
  58: { name: 'Algeria',       flag: '🇩🇿' },
  59: { name: 'Slovenia',      flag: '🇸🇮' },
  60: { name: 'Bangladesh',    flag: '🇧🇩' },
  61: { name: 'Senegal',       flag: '🇸🇳' },
  62: { name: 'Turkey',        flag: '🇹🇷' },
  63: { name: 'Czech Republic',flag: '🇨🇿' },
  64: { name: 'Sri Lanka',     flag: '🇱🇰' },
  65: { name: 'Peru',          flag: '🇵🇪' },
  66: { name: 'Pakistan',      flag: '🇵🇰' },
  67: { name: 'New Zealand',   flag: '🇳🇿' },
  68: { name: 'Guinea',        flag: '🇬🇳' },
  69: { name: 'Mali',          flag: '🇲🇱' },
  70: { name: 'Venezuela',     flag: '🇻🇪' },
  71: { name: 'Ethiopia',      flag: '🇪🇹' },
  72: { name: 'Mongolia',      flag: '🇲🇳' },
  73: { name: 'Brazil',        flag: '🇧🇷' },
  74: { name: 'Afghanistan',   flag: '🇦🇫' },
  75: { name: 'Uganda',        flag: '🇺🇬' },
  76: { name: 'Angola',        flag: '🇦🇴' },
  77: { name: 'Cyprus',        flag: '🇨🇾' },
  78: { name: 'France',        flag: '🇫🇷' },
  79: { name: 'Papua New Guinea', flag: '🇵🇬' },
  80: { name: 'Mozambique',    flag: '🇲🇿' },
  81: { name: 'Nepal',         flag: '🇳🇵' },
  82: { name: 'Belgium',       flag: '🇧🇪' },
  83: { name: 'Bulgaria',      flag: '🇧🇬' },
  84: { name: 'Hungary',       flag: '🇭🇺' },
  85: { name: 'Moldova',       flag: '🇲🇩' },
  86: { name: 'Italy',         flag: '🇮🇹' },
  87: { name: 'Paraguay',      flag: '🇵🇾' },
  88: { name: 'Honduras',      flag: '🇭🇳' },
  89: { name: 'Tunisia',       flag: '🇹🇳' },
  90: { name: 'Nicaragua',     flag: '🇳🇮' },
  91: { name: 'Timor-Leste',   flag: '🇹🇱' },
  92: { name: 'Bolivia',       flag: '🇧🇴' },
  93: { name: 'Costa Rica',    flag: '🇨🇷' },
  94: { name: 'Guatemala',     flag: '🇬🇹' },
  95: { name: 'UAE',           flag: '🇦🇪' },
  96: { name: 'Zimbabwe',      flag: '🇿🇼' },
  97: { name: 'Puerto Rico',   flag: '🇵🇷' },
  98: { name: 'Sudan',         flag: '🇸🇩' },
  99: { name: 'Togo',          flag: '🇹🇬' },
};

export async function GET() {
  try {
    // Fetch top countries for all services (no service filter = semua)
    const url = `${BASE_URL}?api_key=${API_KEY}&action=getTopCountriesByService&freePrice=true`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('API error');

    const raw = await res.json();

    // DEBUG: lihat struktur response API
    console.log('[/api/countries] raw keys:', Object.keys(raw).slice(0, 5));
    console.log('[/api/countries] sample:', JSON.stringify(Object.values(raw)[0])?.slice(0, 200));

    // Response format: { "ig": [ { country: 6, count: 5477, ... }, ... ], "wa": [...], ... }
    // Kita aggregate count per country dari semua service
    const countryCount: Record<number, number> = {};

    for (const entries of Object.values(raw) as any) {
      if (!entries || typeof entries !== 'object') continue;
      const items = Array.isArray(entries) ? entries : Object.values(entries);
      for (const entry of items as any[]) {
        const cid = Number(entry.country);
        countryCount[cid] = (countryCount[cid] ?? 0) + (entry.count ?? 0);
      }
    }

    // Build response, urutkan by total stock desc
    const countries = Object.entries(countryCount)
      .map(([id, totalCount]) => {
        const cid = Number(id);
        const info = COUNTRY_NAMES[cid];
        if (!info) return null;
        return {
          id: String(cid),
          name: `${info.flag} ${info.name}`,
          totalCount,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.totalCount - a.totalCount);

    return NextResponse.json(countries);
  } catch (err) {
    console.error('[/api/countries]', err);
    // Fallback: return static top countries
    return NextResponse.json([
      { id: '6',  name: '🇮🇩 Indonesia' },
      { id: '12', name: '🇺🇸 USA' },
      { id: '7',  name: '🇲🇾 Malaysia' },
      { id: '52', name: '🇹🇭 Thailand' },
      { id: '22', name: '🇮🇳 India' },
      { id: '16', name: '🇬🇧 England' },
    ]);
  }
}