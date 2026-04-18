// src/app/api/admin/notice/route.ts

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET — ambil semua papan info
export async function GET() {
  const { data } = await db
    .from('notices')
    .select('*')
    .order('created_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

// POST — tambah papan info baru
export async function POST(request: Request) {
  try {
    const { title, content, type, is_active } = await request.json();
    if (!title || !content) return NextResponse.json({ error: 'Title dan content wajib diisi.' }, { status: 400 });

    const { error } = await db.from('notices').insert({ title, content, type: type ?? 'info', is_active: is_active ?? true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

// PATCH — edit papan info
export async function PATCH(request: Request) {
  try {
    const { id, title, content, type, is_active } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID wajib.' }, { status: 400 });

    const update: any = {};
    if (title     !== undefined) update.title     = title;
    if (content   !== undefined) update.content   = content;
    if (type      !== undefined) update.type      = type;
    if (is_active !== undefined) update.is_active = is_active;

    const { error } = await db.from('notices').update(update).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

// DELETE — hapus papan info
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json();
    await db.from('notices').delete().eq('id', id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
