// src/app/api/admin/roles/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const log = async (action: string, targetId: string, details: string) => {
  try { await db.from('admin_logs').insert({ action, target_id: targetId, details }); } catch {}
};

export async function GET() {
  const { data } = await db.from('admin_roles').select('*').order('created_at', { ascending: false });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { email, name, role, password, fromExisting, id } = body;

  if (!email || !name || !role) return NextResponse.json({ error: 'Field tidak lengkap.' }, { status: 400 });

  if (fromExisting && id) {
    const { error } = await db.from('admin_roles').insert({ id, email, name, role });
    if (error) return NextResponse.json({ error: 'Gagal menyimpan. Mungkin sudah terdaftar.' }, { status: 400 });
    await log('add_admin', id, `${name} (${email}) dijadikan ${role}`);
    return NextResponse.json({ success: true });
  }

  if (!password || password.length < 8) return NextResponse.json({ error: 'Password minimal 8 karakter.' }, { status: 400 });

  const { data: newUser, error } = await db.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name }
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await db.from('admin_roles').insert({ id: newUser.user.id, email, name, role });
  await log('add_admin', newUser.user.id, `${name} (${email}) ditambah sebagai ${role}`);

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request) {
  const { id, role } = await req.json();
  await db.from('admin_roles').update({ role }).eq('id', id);
  await log('change_admin_role', id, `Role diubah ke ${role}`);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await db.from('admin_roles').delete().eq('id', id);
  await log('remove_admin', id, 'Admin dihapus');
  return NextResponse.json({ success: true });
}