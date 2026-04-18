// src/app/api/sms/route.ts
import { NextResponse } from 'next/server';

const API_KEY = process.env.HEROSMS_API_KEY ?? '';
const BASE_URL = 'https://hero-sms.com/stubs/handler_api.php';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id')?.trim();

  if (!id) {
    return NextResponse.json({ error: 'Parameter "id" wajib diisi.' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `${BASE_URL}?api_key=${API_KEY}&action=getFullSms&id=${id}`,
      { cache: 'no-store' }
    );
    if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);

    // ✅ Baca sebagai text dulu — HeroSMS kadang return plain string bukan JSON
    const text = await res.text();

    const ERROR_MAP: Record<string, string> = {
      BAD_KEY     : 'API key tidak valid.',
      NO_ACTIVATE : 'Aktivasi tidak ditemukan.',
      STATUS_WAIT : 'SMS belum masuk.',
      ERROR_SQL   : 'Kesalahan server upstream.',
    };

    // Cek apakah plain string error dari HeroSMS
    const trimmed = text.trim();
    if (ERROR_MAP[trimmed]) {
      return NextResponse.json(
        { error: ERROR_MAP[trimmed], code: trimmed },
        { status: 422 }
      );
    }

    // Parse JSON
    let raw: any;
    try {
      raw = JSON.parse(text);
    } catch {
      // Bukan JSON dan bukan error yang dikenal — kembalikan array kosong
      console.warn('[GET /api/sms] Non-JSON response:', trimmed.slice(0, 100));
      return NextResponse.json([]);
    }

    if (typeof raw === 'string') {
      return NextResponse.json(
        { error: ERROR_MAP[raw] ?? `Gagal mengambil SMS: ${raw}`, code: raw },
        { status: 422 }
      );
    }

    const items: any[] = Array.isArray(raw) ? raw : Array.isArray(raw?.sms) ? raw.sms : [];

    const messages = items
      .map((item: any) => ({
        code   : String(item.code    ?? item.smsCode ?? item.text ?? ''),
        service: String(item.service ?? ''),
        text   : String(item.text    ?? item.fullSms ?? item.code ?? ''),
      }))
      .filter(m => m.code.length > 0);

    return NextResponse.json(messages);

  } catch (err) {
    console.error('[GET /api/sms]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}