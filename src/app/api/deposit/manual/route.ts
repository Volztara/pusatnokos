// src/app/api/deposit/manual/route.ts
//
// User submit request deposit manual.
// Admin approve di panel → saldo bertambah otomatis.
//
// Flow:
//   1. User isi nominal + pilih rekening tujuan
//   2. User transfer ke rekening admin
//   3. User upload bukti transfer (base64 image)
//   4. Request masuk ke tabel deposit_requests dengan status 'pending'
//   5. Admin approve di panel → saldo user bertambah

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/deposit/manual
 * Submit request deposit manual.
 *
 * Body JSON:
 *   {
 *     email       : string        // email user
 *     amount      : number        // nominal transfer (IDR)
 *     bankName    : string        // nama bank/metode yang ditransfer
 *     proofImage  : string        // base64 bukti transfer (opsional jika pakai URL)
 *     proofUrl    : string        // URL bukti jika sudah diupload ke storage
 *     note        : string        // catatan tambahan (opsional)
 *   }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, amount, bankName, proofImage, proofUrl, note } = body;

    if (!email || !amount || amount < 10000) {
      return NextResponse.json(
        { error: 'Email dan nominal minimal Rp 10.000 wajib diisi.' },
        { status: 400 }
      );
    }

    // Ambil user id
    const { data: profile } = await db
      .from('profiles')
      .select('id, name')
      .eq('email', email.toLowerCase())
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });
    }

    // Simpan bukti gambar ke Supabase Storage jika ada base64
    let imageUrl = proofUrl ?? null;
    if (proofImage && proofImage.startsWith('data:image')) {
      const base64Data = proofImage.split(',')[1];
      const buffer     = Buffer.from(base64Data, 'base64');
      const fileName   = `deposit-${profile.id}-${Date.now()}.jpg`;

      const { error: uploadErr } = await db.storage
        .from('deposit-proofs')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = db.storage.from('deposit-proofs').getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    }

    // Cek apakah user sudah punya pending request
    const { count } = await db
      .from('deposit_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('status', 'pending');

    if ((count ?? 0) >= 3) {
      return NextResponse.json(
        { error: 'Kamu sudah punya 3 request deposit yang belum diproses. Tunggu admin approve dulu.' },
        { status: 429 }
      );
    }

    // Simpan request ke database
    const { data: depositReq, error: insertErr } = await db
      .from('deposit_requests')
      .insert({
        user_id   : profile.id,
        amount,
        bank_name : bankName ?? 'Tidak disebutkan',
        proof_url : imageUrl,
        note      : note ?? '',
        status    : 'pending',
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[deposit/manual]', insertErr);
      return NextResponse.json({ error: 'Gagal menyimpan request.' }, { status: 500 });
    }

    return NextResponse.json({
      success  : true,
      requestId: depositReq.id,
      message  : 'Request deposit berhasil dikirim. Admin akan memproses dalam 1x24 jam.',
    });

  } catch (err) {
    console.error('[POST /api/deposit/manual]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

/**
 * GET /api/deposit/manual?email=xxx
 * Ambil semua request deposit user.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email')?.trim().toLowerCase();

  if (!email) return NextResponse.json([], { status: 200 });

  const { data: profile } = await db.from('profiles').select('id').eq('email', email).single();
  if (!profile) return NextResponse.json([]);

  const { data } = await db
    .from('deposit_requests')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(data ?? []);
}
