// src/lib/rateLimit.ts
// In-memory rate limiter untuk proteksi spam order
// Untuk production multi-instance, ganti dengan Redis/Upstash

declare global {
  var _rateLimitStore: Map<string, { count: number; resetAt: number }> | undefined;
}

const store: Map<string, { count: number; resetAt: number }> =
  globalThis._rateLimitStore ?? (globalThis._rateLimitStore = new Map());

interface RateLimitOptions {
  max    : number;  // max request
  window : number;  // window dalam ms
}

interface RateLimitResult {
  allowed   : boolean;
  remaining : number;
  resetIn   : number; // ms sampai reset
}

export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + options.window });
    return { allowed: true, remaining: options.max - 1, resetIn: options.window };
  }

  if (entry.count >= options.max) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: options.max - entry.count, resetIn: entry.resetAt - now };
}

// Preset configs
export const RATE_LIMITS = {
  order     : { max: 20, window: 60 * 60 * 1000 },   // 20 order/jam
  orderFast : { max: 5,  window: 60 * 1000 },         // 5 order/menit (anti-spam)
  deposit   : { max: 5,  window: 60 * 60 * 1000 },   // 5 deposit request/jam
  login     : { max: 5,  window: 15 * 60 * 1000 },   // 5 login attempt/15 menit
};