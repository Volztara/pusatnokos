// src/app/api/user/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getVerifiedEmail(request: NextRequest): string | null {
  // Coba semua header yang mungkin ada
  return (
    request.headers.get('X-Verified-User-Email')?.trim().toLowerCase() ??
    request.headers.get('X-User-Email')?.trim().toLowerCase() ??
    null
  );
}

// Validasi token JWT Supabase
async function validateToken(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  try {
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user.email?.toLowerCase() ?? null;
  } catch { return null; }
}

async function getAuthEmail(request: NextRequest): Promise<string | null> {
  // 1. Coba dari header langsung
  const headerEmail = getVerifiedEmail(request);
  if (headerEmail) return headerEmail;

  // 2. Coba validasi JWT
  const tokenEmail = await validateToken(request);
  if (tokenEmail) return tokenEmail;

  return null;
}

export async function GET(request: NextRequest) {
  const email = await getAuthEmail(request);
  if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('balance')
    .eq('email', email)
    .single();

  if (error || !data) return NextResponse.json({ balance: 0 });
  return NextResponse.json({ balance: data.balance ?? 0 });
}

export async function PATCH(request: NextRequest) {
  try {
    const email = await getAuthEmail(request);
    if (!email) return NextResponse.json({ error: 'Autentikasi diperlukan.' }, { status: 401 });

    const body = await request.json();
    const { amount, type, activationId } = body;

    if (!amount || !type) {
      return NextResponse.json({ error: 'Parameter tidak lengkap.' }, { status: 400 });
    }

    if (type === 'add') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, balance')
        .eq('email', email)
        .single();

      if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

      // Anti double-refund
      if (activationId) {
        const { data: existingMutation } = await supabaseAdmin
          .from('mutations')
          .select('id')
          .eq('user_id', profile.id)
          .eq('type', 'in')
          .ilike('description', `%#${activationId}%`)
          .maybeSingle();

        if (existingMutation) {
          return NextResponse.json(
            { error: 'Refund sudah diproses sebelumnya.', alreadyRefunded: true },
            { status: 409 }
          );
        }

        try {
          const { data: rpcData, error: rpcErr } = await supabaseAdmin
            .rpc('cancel_order_and_refund', {
              p_activation_id: activationId,
              p_email        : email,
            });

          if (rpcErr) throw new Error('fallback');

          if (!rpcData?.success) {
            const msg = (rpcData?.error ?? 'Refund sudah diproses.').toLowerCase();

            // Semua kondisi "sudah diproses" → 409 (bukan 400)
            const alreadyDone = msg.includes('already')
              || msg.includes('sudah')
              || msg.includes('not found')
              || msg.includes('tidak ditemukan')
              || msg.includes('cancelled')
              || msg.includes('dibatalkan')
              || msg.includes('duplicate')
              || msg.includes('processed')
              || msg.includes('diproses');

            return NextResponse.json(
              { error: rpcData?.error ?? 'Refund sudah diproses.', alreadyRefunded: alreadyDone },
              { status: alreadyDone ? 409 : 400 }
            );
          }

          return NextResponse.json({ success: true, balance: rpcData.balance });

        } catch (e: any) {
          if (e?.message !== 'fallback') throw e;
          // RPC tidak tersedia → fallback manual: cek dulu apakah sudah direfund
          const { data: existCheck } = await supabaseAdmin
            .from('mutations')
            .select('id')
            .eq('user_id', profile.id)
            .eq('type', 'in')
            .ilike('description', `%${activationId}%`)
            .maybeSingle();

          if (existCheck) {
            return NextResponse.json(
              { error: 'Refund sudah diproses sebelumnya.', alreadyRefunded: true },
              { status: 409 }
            );
          }
        }
      }

      const newBal = (profile.balance ?? 0) + amount;
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ balance: newBal })
        .eq('email', email);

      if (updateErr) return NextResponse.json({ error: 'Gagal update saldo.' }, { status: 500 });
      return NextResponse.json({ success: true, balance: newBal });
    }

    // SUBTRACT
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance')
      .eq('email', email)
      .single();

    if (!profile) return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 });

    const newBal = Math.max(0, (profile.balance ?? 0) - amount);
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBal })
      .eq('email', email);

    if (updateError) return NextResponse.json({ error: 'Gagal update saldo.' }, { status: 500 });
    return NextResponse.json({ success: true, balance: newBal });

  } catch (err) {
    console.error('[PATCH /api/user/balance]', err);
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}