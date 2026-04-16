// src/app/api/countries-rank/route.ts
//
// Negara terpopuler berdasarkan rank user — lebih akurat dari getTopCountriesByService
// karena diurutkan berdasarkan permintaan nyata user, bukan hanya stok.

import { NextResponse } from 'next/server';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

const COUNTRY_NAMES: Record<number, { name: string; flag: string }> = {
  0:  { name: 'Russia',         flag: '🇷🇺' },
  1:  { name: 'Ukraine',        flag: '🇺🇦' },
  2:  { name: 'Kazakhstan',     flag: '🇰🇿' },
  3:  { name: 'China',          flag: '🇨🇳' },
  4:  { name: 'Philippines',    flag: '🇵🇭' },
  5:  { name: 'Myanmar',        flag: '🇲🇲' },
  6:  { name: 'Indonesia',      flag: '🇮🇩' },
  7:  { name: 'Malaysia',       flag: '🇲🇾' },
  8:  { name: 'Kenya',          flag: '🇰🇪' },
  9:  { name: 'Tanzania',       flag: '🇹🇿' },
  10: { name: 'Vietnam',        flag: '🇻🇳' },
  11: { name: 'Kyrgyzstan',     flag: '🇰🇬' },
  12: { name: 'USA',            flag: '🇺🇸' },
  13: { name: 'Israel',         flag: '🇮🇱' },
  14: { name: 'Hong Kong',      flag: '🇭🇰' },
  15: { name: 'Poland',         flag: '🇵🇱' },
  16: { name: 'England',        flag: '🇬🇧' },
  17: { name: 'Madagascar',     flag: '🇲🇬' },
  18: { name: 'Congo',          flag: '🇨🇩' },
  19: { name: 'Nigeria',        flag: '🇳🇬' },
  20: { name: 'Macao',          flag: '🇲🇴' },
  21: { name: 'Egypt',          flag: '🇪🇬' },
  22: { name: 'India',          flag: '🇮🇳' },
  23: { name: 'Ireland',        flag: '🇮🇪' },
  24: { name: 'Cambodia',       flag: '🇰🇭' },
  25: { name: 'Laos',           flag: '🇱🇦' },
  52: { name: 'Thailand',       flag: '🇹🇭' },
  53: { name: 'Saudi Arabia',   flag: '🇸🇦' },
  54: { name: 'Mexico',         flag: '🇲🇽' },
  56: { name: 'Spain',          flag: '🇪🇸' },
  62: { name: 'Turkey',         flag: '🇹🇷' },
  66: { name: 'Pakistan',       flag: '🇵🇰' },
  73: { name: 'Brazil',         flag: '🇧🇷' },
  78: { name: 'France',         flag: '🇫🇷' },
  86: { name: 'Italy',          flag: '🇮🇹' },
  95: { name: 'UAE',            flag: '🇦🇪' },
};

/**
 * GET /api/countries-rank?service=wa
 *
 * Negara terpopuler berdasarkan user rank untuk layanan tertentu.
 * Lebih relevan dari /api/countries karena mencerminkan permintaan nyata.
 *
 * Query params:
 *   service — kode layanan, mis. "wa" (opsional, default semua)
 *
 * Response:
 *   Array<{ id: string; name: string; rank: number; count: number }>
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const service = searchParams.get('service') ?? '';

  try {
    const serviceParam = service ? `&service=${service}` : '';
    const url = `${BASE_URL}?api_key=${API_KEY}&action=getTopCountriesByService&freePrice=true&rank=true${serviceParam}`;

    const res = await fetch(url, { next: { revalidate: 300 } }); // cache 5 menit
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    const raw = await res.json();

    // Aggregate count + rank per country dari semua service
    const countryData: Record<number, { count: number; rankSum: number; entries: number }> = {};

    const allEntries = Array.isArray(raw)
      ? raw
      : Object.values(raw).flatMap((v: any) =>
          Array.isArray(v) ? v : typeof v === 'object' ? Object.values(v) : []
        );

    for (const entry of allEntries as any[]) {
      const cid   = Number(entry.country ?? entry.countryId ?? -1);
      const count = Number(entry.count ?? 0);
      const rank  = Number(entry.rank  ?? 999);
      if (cid < 0) continue;

      if (!countryData[cid]) countryData[cid] = { count: 0, rankSum: 0, entries: 0 };
      countryData[cid].count   += count;
      countryData[cid].rankSum += rank;
      countryData[cid].entries += 1;
    }

    const result = Object.entries(countryData)
      .map(([id, d]) => {
        const cid  = Number(id);
        const info = COUNTRY_NAMES[cid];
        if (!info) return null;
        return {
          id      : String(cid),
          name    : `${info.flag} ${info.name}`,
          rank    : Math.round(d.rankSum / d.entries),   // rata-rata rank
          count   : d.count,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.rank - b.rank || b.count - a.count); // rank kecil = lebih populer

    return NextResponse.json(result);

  } catch (err) {
    console.error('[GET /api/countries-rank]', err);
    // Fallback ke negara default
    return NextResponse.json([
      { id: '6',  name: '🇮🇩 Indonesia',   rank: 1, count: 0 },
      { id: '12', name: '🇺🇸 USA',          rank: 2, count: 0 },
      { id: '7',  name: '🇲🇾 Malaysia',     rank: 3, count: 0 },
      { id: '52', name: '🇹🇭 Thailand',     rank: 4, count: 0 },
      { id: '22', name: '🇮🇳 India',        rank: 5, count: 0 },
    ]);
  }
}