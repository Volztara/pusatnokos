// src/app/api/admin/broadcast/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — ambil riwayat broadcast
export async function GET() {
  const { data, error } = await db
    .from('broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST — kirim broadcast baru ke semua user
export async function POST(request: Request) {
  try {
    const { title, message, type } = await request.json();

    if (!title || !message) {
      return NextResponse.json({ error: 'Title dan message wajib diisi.' }, { status: 400 });
    }

    // Hitung jumlah user aktif
    const { count } = await db
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Simpan broadcast ke DB
    const { error } = await db.from('broadcasts').insert({
      title,
      message,
      type           : type ?? 'info',
      recipient_count: count ?? 0,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true, count });

  } catch (err) {
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

// DELETE — hapus broadcast
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await db.from('broadcasts').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Gagal menghapus.' }, { status: 500 });
  }
}