// src/app/api/admin/login/route.ts
import { NextResponse } from 'next/server';

const REDIS_URL   = process.env.UPSTASH_REDIS_REST_URL!;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN!;

const MAX_ATTEMPTS = 5;
const WINDOW_SEC   = 15 * 60; // lockout 15 menit

async function redisCmd(...args: (string | number)[]) {
  const res = await fetch(`${REDIS_URL}/${args.join('/')}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  return res.json();
}

export async function POST(req: Request) {
  try {
    const ip  = req.headers.get('x-forwarded-for') ?? 'unknown';
    const key = `admin_login:${ip}`;

    // Cek apakah sudah lockout
    const { result: attempts } = await redisCmd('GET', key);
    const count = parseInt(attempts ?? '0');

    if (count >= MAX_ATTEMPTS) {
      const { result: ttl } = await redisCmd('TTL', key);
      const menit = Math.ceil((ttl ?? WINDOW_SEC) / 60);
      return NextResponse.json(
        { success: false, message: `Terlalu banyak percobaan. Coba lagi dalam ${menit} menit.` },
        { status: 429 }
      );
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const usernameOk = username === process.env.ADMIN_USERNAME;
    const passwordOk = password === process.env.ADMIN_PASSWORD;

    if (!usernameOk || !passwordOk) {
      // Tambah counter gagal
      await redisCmd('INCR', key);
      if (count === 0) {
        // Set expiry hanya saat percobaan pertama
        await redisCmd('EXPIRE', key, WINDOW_SEC);
      }
      const sisa = MAX_ATTEMPTS - (count + 1);
      return NextResponse.json(
        { success: false, message: `Username atau password salah. Sisa percobaan: ${sisa}` },
        { status: 401 }
      );
    }

    // Login berhasil — reset counter
    await redisCmd('DEL', key);
    return NextResponse.json({ success: true });

  } catch {
    return NextResponse.json(
      { success: false, message: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}