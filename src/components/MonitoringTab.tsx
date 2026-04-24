// src/components/MonitoringTab.tsx
// Tambahkan komponen ini ke page.tsx admin panel
// Cara pakai:
// 1. Import: import { MonitoringTab } from '@/components/MonitoringTab'
// 2. Tambah tab di TABS array: { id: 'monitoring', label: 'Monitoring', icon: <ShieldAlert className="w-4 h-4" /> }
// 3. Tambah di render: {tab === 'monitoring' && <MonitoringTab showToast={showToast} />}

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Users, Ban, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// ─── TYPES ────────────────────────────────────────────────────────────
interface SuspiciousUser {
  user_id      : string;
  email        : string;
  saldo        : number;
  is_blacklisted: boolean;
  total_refund : number;
  total_deposit: number;
  jumlah_refund: number;
  rasio        : number;
}

interface DailySummary {
  tanggal     : string;
  jumlah_refund: number;
  total_refund : number;
  jumlah_user  : number;
}

interface MonitoringTabProps {
  showToast: (msg: string) => void;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────
export function MonitoringTab({ showToast }: MonitoringTabProps) {
  const [suspicious,    setSuspicious]    = useState<SuspiciousUser[]>([]);
  const [dailySummary,  setDailySummary]  = useState<DailySummary[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [blacklisting,  setBlacklisting]  = useState<string | null>(null);
  const [expandedUser,  setExpandedUser]  = useState<string | null>(null);
  const [lastRefresh,   setLastRefresh]   = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token') ?? '';
      const res = await fetch('/api/admin/monitoring', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setSuspicious(data.suspicious ?? []);
      setDailySummary(data.daily ?? []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBlacklist = async (userId: string, email: string) => {
    if (!confirm(`Blokir akun ${email}?`)) return;
    setBlacklisting(userId);
    try {
      const token = localStorage.getItem('admin_token') ?? '';
      const r = await fetch('/api/admin/users', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body   : JSON.stringify({ userId, action: 'blacklist', value: true }),
      });
      if ((await r.json()).success) {
        showToast(`✅ ${email} berhasil diblokir.`);
        fetchData();
      }
    } catch { showToast('Gagal memblokir user.'); }
    finally { setBlacklisting(null); }
  };

  // Hitung alert level
  const criticalCount = suspicious.filter(u => u.rasio >= 5 && !u.is_blacklisted).length;
  const warningCount  = suspicious.filter(u => u.rasio >= 2 && u.rasio < 5 && !u.is_blacklisted).length;
  const todayRefund   = dailySummary[0]?.total_refund ?? 0;
  const yesterdayRefund = dailySummary[1]?.total_refund ?? 0;
  const refundSpike   = yesterdayRefund > 0 && todayRefund > yesterdayRefund * 2;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            Security Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Terakhir diperbarui: {lastRefresh.toLocaleTimeString('id-ID')}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Alert Banner ── */}
      {criticalCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-black text-red-700 dark:text-red-400 text-sm">
              🚨 {criticalCount} user mencurigakan perlu ditindak!
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Rasio refund/deposit &gt; 5x — kemungkinan abuse double refund
            </div>
          </div>
        </div>
      )}

      {refundSpike && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-black text-amber-700 dark:text-amber-400 text-sm">
              ⚠️ Lonjakan refund hari ini!
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Hari ini: {fmtIDR(todayRefund)} vs kemarin: {fmtIDR(yesterdayRefund)} (2x lipat+)
            </div>
          </div>
        </div>
      )}

      {criticalCount === 0 && !refundSpike && !loading && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="font-bold text-green-700 dark:text-green-400 text-sm">
            Sistem aman — tidak ada aktivitas mencurigakan dalam 7 hari terakhir
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label  : 'Refund Hari Ini',
            value  : fmtIDR(todayRefund),
            sub    : `${dailySummary[0]?.jumlah_refund ?? 0} transaksi`,
            color  : refundSpike ? 'text-red-600' : 'text-green-600',
            bg     : refundSpike ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30',
            icon   : refundSpike ? <TrendingUp className="w-5 h-5 text-red-500" /> : <TrendingDown className="w-5 h-5 text-green-500" />,
          },
          {
            label  : 'User Mencurigakan',
            value  : criticalCount,
            sub    : 'rasio > 5x (kritis)',
            color  : criticalCount > 0 ? 'text-red-600' : 'text-green-600',
            bg     : criticalCount > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30',
            icon   : <ShieldAlert className={`w-5 h-5 ${criticalCount > 0 ? 'text-red-500' : 'text-green-500'}`} />,
          },
          {
            label  : 'Perlu Dipantau',
            value  : warningCount,
            sub    : 'rasio 2-5x (waspada)',
            color  : warningCount > 0 ? 'text-amber-600' : 'text-slate-600',
            bg     : warningCount > 0 ? 'bg-amber-50 dark:bg-amber-900/30' : 'bg-slate-50 dark:bg-slate-900/30',
            icon   : <AlertTriangle className={`w-5 h-5 ${warningCount > 0 ? 'text-amber-500' : 'text-slate-400'}`} />,
          },
          {
            label  : 'Total Refund 7 Hari',
            value  : fmtIDR(dailySummary.reduce((s, d) => s + d.total_refund, 0)),
            sub    : `${dailySummary.reduce((s, d) => s + d.jumlah_refund, 0)} transaksi`,
            color  : 'text-indigo-600',
            bg     : 'bg-indigo-50 dark:bg-indigo-900/30',
            icon   : <Users className="w-5 h-5 text-indigo-500" />,
          },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-[1.5rem] p-4 border border-transparent`}>
            <div className="flex items-center gap-2 mb-2">
              {card.icon}
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{card.label}</span>
            </div>
            <div className={`text-xl font-black ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-400 mt-1">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Refund Harian ── */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.07]">
          <h3 className="font-black text-slate-900 dark:text-white text-sm">Refund Harian (7 Hari Terakhir)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                {['Tanggal', 'Jumlah Refund', 'Total Nominal', 'User Terdampak', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                </td></tr>
              ) : dailySummary.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-bold">Tidak ada data</td></tr>
              ) : dailySummary.map((d, i) => {
                const prevTotal = dailySummary[i + 1]?.total_refund ?? d.total_refund;
                const isSpike = prevTotal > 0 && d.total_refund > prevTotal * 1.5;
                return (
                  <tr key={d.tanggal} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 font-bold text-sm dark:text-white">
                      {new Date(d.tanggal).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {i === 0 && <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black">Hari Ini</span>}
                    </td>
                    <td className="px-5 py-3 font-bold text-sm dark:text-white">{d.jumlah_refund}x</td>
                    <td className="px-5 py-3 font-bold text-sm dark:text-white">{fmtIDR(d.total_refund)}</td>
                    <td className="px-5 py-3 font-bold text-sm dark:text-white">{d.jumlah_user} user</td>
                    <td className="px-5 py-3">
                      {isSpike
                        ? <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-black">⚠️ LONJAKAN</span>
                        : <span className="px-2.5 py-1 bg-green-50 text-green-600 border border-green-200 rounded-lg text-xs font-black">✓ NORMAL</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── User Mencurigakan ── */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-white text-sm">
            User Mencurigakan (7 Hari)
            {suspicious.length > 0 && (
              <span className="ml-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-2 py-0.5 rounded-full font-black">
                {suspicious.filter(u => !u.is_blacklisted).length} aktif
              </span>
            )}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                {['User', 'Saldo', 'Total Refund', 'Total Deposit', 'Rasio', 'Jumlah', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto" />
                </td></tr>
              ) : suspicious.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-400 font-bold">
                  ✅ Tidak ada user mencurigakan
                </td></tr>
              ) : suspicious.map(u => {
                const isCritical = u.rasio >= 5;
                const isWarning  = u.rasio >= 2 && u.rasio < 5;
                return (
                  <React.Fragment key={u.user_id}>
                    <tr
                      className={`transition-colors cursor-pointer ${
                        u.is_blacklisted
                          ? 'opacity-50 bg-slate-50/50 dark:bg-white/[0.02]'
                          : isCritical
                            ? 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                            : 'hover:bg-amber-50/30 dark:hover:bg-white/[0.02]'
                      }`}
                      onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                    >
                      <td className="px-5 py-3">
                        <div className="font-bold text-sm dark:text-white flex items-center gap-2">
                          {expandedUser === u.user_id
                            ? <ChevronUp className="w-3 h-3 text-slate-400" />
                            : <ChevronDown className="w-3 h-3 text-slate-400" />
                          }
                          <div>
                            <div>{u.email}</div>
                            <div className="text-xs text-slate-400 font-normal">{u.user_id.slice(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-bold text-sm dark:text-white">{fmtIDR(u.saldo)}</td>
                      <td className="px-5 py-3 font-bold text-sm text-red-600 dark:text-red-400">{fmtIDR(u.total_refund)}</td>
                      <td className="px-5 py-3 font-bold text-sm dark:text-white">{fmtIDR(u.total_deposit)}</td>
                      <td className="px-5 py-3">
                        <span className={`font-black text-sm px-2 py-1 rounded-lg ${
                          isCritical
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                            : isWarning
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {u.rasio.toFixed(1)}x
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-sm dark:text-white">{u.jumlah_refund}x</td>
                      <td className="px-5 py-3">
                        {u.is_blacklisted
                          ? <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-xs font-black">DIBLOKIR</span>
                          : isCritical
                            ? <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-black">🚨 KRITIS</span>
                            : <span className="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-black">⚠️ WASPADA</span>
                        }
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        {!u.is_blacklisted && (
                          <button
                            onClick={() => handleBlacklist(u.user_id, u.email)}
                            disabled={blacklisting === u.user_id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs font-bold border border-red-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            {blacklisting === u.user_id
                              ? <RefreshCw className="w-3 h-3 animate-spin" />
                              : <Ban className="w-3 h-3" />
                            }
                            Blokir
                          </button>
                        )}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {expandedUser === u.user_id && (
                      <tr className="bg-slate-50/80 dark:bg-[#080b14]/80">
                        <td colSpan={8} className="px-5 py-4">
                          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-widest">Detail Perhitungan</div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="bg-white dark:bg-[#0d1020] rounded-xl p-3 border border-slate-200 dark:border-white/[0.07]">
                              <div className="text-xs text-slate-400 mb-1">Total Deposit</div>
                              <div className="font-black text-green-600">{fmtIDR(u.total_deposit)}</div>
                            </div>
                            <div className="bg-white dark:bg-[#0d1020] rounded-xl p-3 border border-slate-200 dark:border-white/[0.07]">
                              <div className="text-xs text-slate-400 mb-1">Total Refund (7 hari)</div>
                              <div className="font-black text-red-600">{fmtIDR(u.total_refund)}</div>
                              <div className="text-xs text-slate-400">{u.jumlah_refund}x transaksi</div>
                            </div>
                            <div className="bg-white dark:bg-[#0d1020] rounded-xl p-3 border border-slate-200 dark:border-white/[0.07]">
                              <div className="text-xs text-slate-400 mb-1">Estimasi Kerugian</div>
                              <div className="font-black text-red-600">{fmtIDR(Math.max(0, u.total_refund - u.total_deposit))}</div>
                              <div className="text-xs text-slate-400">refund - deposit</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}