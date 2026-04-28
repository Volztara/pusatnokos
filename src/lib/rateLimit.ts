// src/lib/rateLimit.ts
//
// Rate limiter dengan 2 layer:
// 1. In-memory (cepat, per-instance) — untuk burst detection dalam 1 menit
// 2. Supabase (persistent, cross-instance) — untuk limit per jam
//
// Kenapa hybrid?
// - In-memory saja: bypass di Vercel multi-instance (setiap instance punya store sendiri)
// - Supabase saja: latency tinggi karena setiap request harus hit DB
// - Hybrid: burst check in-memory (cepat), hourly limit via Supabase (akurat cross-instance)

import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── In-memory store (per-instance, untuk window pendek) ───────────────
declare global {
  var _rateLimitStore: Map<string, { count: number; resetAt: number }> | undefined;
  var _rateLimitLastClean: number | undefined;
}

const memStore: Map<string, { count: number; resetAt: number }> =
  globalThis._rateLimitStore ?? (globalThis._rateLimitStore = new Map());

// Cleanup entry expired dari memory — jalan setiap 5 menit
function cleanMemStore() {
  const now = Date.now();
  const lastClean = globalThis._rateLimitLastClean ?? 0;
  if (now - lastClean < 5 * 60 * 1000) return;
  globalThis._rateLimitLastClean = now;

  for (const [key, entry] of memStore.entries()) {
    if (now > entry.resetAt) memStore.delete(key);
  }
}

function checkMemLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  cleanMemStore();
  const now = Date.now();
  const entry = memStore.get(key);

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  if (entry.count >= max) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: max - entry.count };
}

// ── Supabase store (cross-instance, untuk window panjang) ─────────────
// Membutuhkan tabel di Supabase:
//
// CREATE TABLE IF NOT EXISTS rate_limits (
//   key       TEXT PRIMARY KEY,
//   count     INT NOT NULL DEFAULT 1,
//   reset_at  TIMESTAMPTZ NOT NULL
// );
//
// Tabel ini auto-cleanup karena kita overwrite entry expired.
// Tidak perlu cron untuk bersihkan.

async function checkSupabaseLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const now = new Date();
    const resetAt = new Date(Date.now() + windowMs);

    // Coba ambil entry yang ada
    const { data: existing } = await db
      .from('rate_limits')
      .select('count, reset_at')
      .eq('key', key)
      .single();

    // Entry tidak ada atau sudah expired → buat baru
    if (!existing || new Date(existing.reset_at) < now) {
      await db.from('rate_limits').upsert({
        key,
        count: 1,
        reset_at: resetAt.toISOString(),
      }, { onConflict: 'key' });
      return { allowed: true, remaining: max - 1 };
    }

    // Entry ada dan masih berlaku
    if (existing.count >= max) {
      return { allowed: false, remaining: 0 };
    }

    // Increment atomik via RPC — mencegah race condition di multi-instance
    const { data: updated } = await db.rpc('increment_rate_limit', {
      p_key: key,
      p_max_count: max,
      p_reset_at: existing.reset_at,
    });

    if (updated?.allowed === false) {
      return { allowed: false, remaining: 0 };
    }

    return { allowed: true, remaining: max - (existing.count + 1) };

  } catch (err) {
    // Kalau Supabase error → fallback allow (lebih baik lolos dari pada block semua user)
    console.warn('[rateLimit] Supabase error, fallback allow:', err);
    return { allowed: true, remaining: 1 };
  }
}

// ── Public API ────────────────────────────────────────────────────────

export interface RateLimitOptions {
  max: number;  // max request dalam window
  window: number;  // window dalam ms
  persistent?: boolean; // pakai Supabase (cross-instance) — default false
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

// Sync version — untuk window pendek (in-memory saja)
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const result = checkMemLimit(key, options.max, options.window);
  return { ...result, resetIn: options.window };
}

// Async version — untuk window panjang (Supabase, cross-instance)
export async function checkRateLimitAsync(
  key: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (options.persistent) {
    const result = await checkSupabaseLimit(key, options.max, options.window);
    return { ...result, resetIn: options.window };
  }
  return checkRateLimit(key, options);
}

// ── Preset configs ────────────────────────────────────────────────────
export const RATE_LIMITS = {
  // In-memory (window pendek — burst detection, per-instance sudah cukup)
  orderFast: { max: 5, window: 60 * 1000, persistent: false }, // 5/menit
  loginFast: { max: 5, window: 15 * 60 * 1000, persistent: false }, // 5/15 menit

  // Supabase (window panjang — harus cross-instance)
  order: { max: 20, window: 60 * 60 * 1000, persistent: true }, // 20/jam
  deposit: { max: 5, window: 60 * 60 * 1000, persistent: true }, // 5/jam
  login: { max: 10, window: 60 * 60 * 1000, persistent: true }, // 10/jam
};

// ── SQL untuk Supabase (jalankan sekali di SQL editor) ────────────────
//
// CREATE TABLE IF NOT EXISTS rate_limits (
//   key       TEXT PRIMARY KEY,
//   count     INT NOT NULL DEFAULT 1,
//   reset_at  TIMESTAMPTZ NOT NULL
// );
//
// CREATE OR REPLACE FUNCTION increment_rate_limit(
//   p_key       TEXT,
//   p_max_count INT,
//   p_reset_at  TIMESTAMPTZ
// ) RETURNS jsonb AS $$
// DECLARE
//   v_count INT;
// BEGIN
//   UPDATE rate_limits
//   SET count = count + 1
//   WHERE key = p_key
//     AND reset_at = p_reset_at
//     AND count < p_max_count
//   RETURNING count INTO v_count;
//
//   IF v_count IS NULL THEN
//     RETURN jsonb_build_object('allowed', false);
//   END IF;
//
//   RETURN jsonb_build_object('allowed', true, 'count', v_count);
// END;
// $$ LANGUAGE plpgsql;