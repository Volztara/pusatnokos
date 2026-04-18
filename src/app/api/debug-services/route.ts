// src/app/api/debug-services/route.ts
// ⚠️ HAPUS FILE INI SETELAH DEBUGGING SELESAI (jangan deploy ke production)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.HEROSMS_API_KEY!;
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

export async function GET() {
  try {
    const [namesRes, pricesRes] = await Promise.all([
      fetch(`${BASE_URL}?api_key=${API_KEY}&action=getServicesList`),
      fetch(`${BASE_URL}?api_key=${API_KEY}&action=getPrices&country=6`),
    ]);

    const namesRaw  = await namesRes.json();
    const pricesRaw = await pricesRes.json();

    // Top 10 service codes dari Indonesia (country=6) berdasarkan stok terbanyak
    const countryData = pricesRaw?.['6'] ?? pricesRaw ?? {};
    const top10 = Object.entries(countryData)
      .map(([code, val]: any) => {
        const op = val?.['0'] ?? (typeof val?.cost === 'number' ? val : null);
        return { code, count: op?.count ?? 0 };
      })
      .filter((s) => s.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ code, count }) => ({
        code,
        count,
        // Nama dari API
        nameFromAPI: (namesRaw?.services ?? namesRaw)?.[code] ?? '(tidak ada di API)',
      }));

    return NextResponse.json({
      // Struktur root dari namesRaw — apakah ada field "services", "data", dll?
      namesRaw_keys: Object.keys(namesRaw ?? {}),
      // Apakah ada field .services?
      has_services_field: 'services' in (namesRaw ?? {}),
      // Contoh 5 entry pertama dari namesRaw
      namesRaw_sample: Object.fromEntries(Object.entries(namesRaw ?? {}).slice(0, 5)),
      // Top 10 layanan Indonesia dengan nama dari API
      top10_indonesia: top10,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
