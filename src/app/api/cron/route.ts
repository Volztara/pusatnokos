// src/app/api/cron/route.ts
//
// Cron job: auto-cancel semua aktivasi yang expired di HeroSMS.
//
// Cara setup di Vercel:
//   1. Tambah file vercel.json di root project (lihat bawah)
//   2. Deploy ke Vercel — cron otomatis jalan setiap 1 menit
//
// Cara setup manual (tanpa Vercel):
//   Panggil GET /api/cron?secret=xxx dari cron service eksternal (cron-job.org, dll)
//
// vercel.json:
// {
//   "crons": [
//     {
//       "path": "/api/cron",
//       "schedule": "* * * * *"
//     }
//   ]
// }

import { NextResponse } from 'next/server';

const API_KEY  = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

// Secret untuk proteksi endpoint dari akses luar
// Set CRON_SECRET di environment variable
const CRON_SECRET = process.env.CRON_SECRET ?? '';

/**
 * GET /api/cron
 *
 * Dipanggil oleh Vercel Cron atau service eksternal setiap 1 menit.
 *
 * Alur kerja:
 *   1. Ambil semua aktivasi aktif dari HeroSMS
 *   2. Filter yang sudah expired (created > 20 menit lalu)
 *   3. Cancel satu per satu via setStatus=8
 *
 * Response:
 *   { cancelled: number; skipped: number; errors: number; timestamp: string }
 */
export async function GET(request: Request) {
  // Verifikasi secret — skip jika CRON_SECRET tidak di-set (development)
  if (CRON_SECRET) {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret') ?? '';

    // Vercel Cron kirim Authorization header
    const authHeader = request.headers.get('authorization') ?? '';
    const bearerSecret = authHeader.replace('Bearer ', '');

    if (secret !== CRON_SECRET && bearerSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const startTime = Date.now();
  let cancelled = 0;
  let skipped   = 0;
  let errors    = 0;

  try {
    // 1. Ambil semua aktivasi aktif
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getActiveActivations`,
      { cache: 'no-store' }
    );

    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
    const raw = await res.json();

    if (typeof raw === 'string') {
      // Error dari HeroSMS
      console.error('[cron] HeroSMS error:', raw);
      return NextResponse.json({
        cancelled : 0,
        skipped   : 0,
        errors    : 1,
        message   : raw,
        timestamp : new Date().toISOString(),
      });
    }

    const items: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.activeActivations)
        ? raw.activeActivations
        : [];

    const EXPIRE_MS = 20 * 60 * 1000; // 20 menit dalam milidetik
    const now       = Date.now();

    // 2. Filter & cancel yang expired
    for (const item of items) {
      const id        = String(item.id ?? item.activationId ?? '');
      const createdAt = item.created_at ?? item.createdAt ?? null;
      const status    = String(item.status ?? '');

      if (!id) { skipped++; continue; }

      // Skip yang sudah selesai atau dibatalkan
      if (['STATUS_OK', 'STATUS_CANCEL', '6', '8'].includes(status)) {
        skipped++;
        continue;
      }

      // Cek apakah sudah expired berdasarkan waktu dibuat
      if (createdAt) {
        const createdMs = new Date(createdAt).getTime();
        if (!isNaN(createdMs) && now - createdMs < EXPIRE_MS) {
          skipped++; // Belum expired
          continue;
        }
      }

      // 3. Cancel via setStatus=8
      try {
        const cancelRes  = await fetch(
          `${BASE_URL}?api_key=${API_KEY}&action=setStatus&id=${id}&status=8`,
          { cache: 'no-store' }
        );
        const cancelText = (await cancelRes.text()).trim();

        if (cancelText.startsWith('ACCESS_CANCEL') || cancelText.startsWith('ACTIVATION_STATUS_CHANGED')) {
          cancelled++;
          console.log(`[cron] ✅ Cancelled activation ${id}`);
        } else {
          errors++;
          console.warn(`[cron] ⚠️ Unexpected response for ${id}: ${cancelText}`);
        }
      } catch (cancelErr) {
        errors++;
        console.error(`[cron] ❌ Failed to cancel ${id}:`, cancelErr);
      }

      // Rate limiting — jangan spam API HeroSMS
      await new Promise(r => setTimeout(r, 200));
    }

    const elapsed = Date.now() - startTime;
    console.log(`[cron] Done in ${elapsed}ms — cancelled: ${cancelled}, skipped: ${skipped}, errors: ${errors}`);

    return NextResponse.json({
      cancelled,
      skipped,
      errors,
      total    : items.length,
      elapsed  : `${elapsed}ms`,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('[cron] Fatal error:', err);
    return NextResponse.json(
      { error: 'Cron job gagal.', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}