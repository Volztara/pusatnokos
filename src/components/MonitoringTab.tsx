'use client';
// src/components/MonitoringTab.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, RefreshCw, AlertTriangle, CheckCircle2,
  TrendingUp, Users, Ban, ChevronDown, ChevronUp,
  Zap, Search, DollarSign,
} from 'lucide-react';

const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

interface UserRow {
  user_id       : string;
  email         : string;
  saldo         : number;
  is_blacklisted: boolean;
  total_out     : number;
  total_in      : number;
  deposit_in    : number;
  refund_in     : number;
  admin_in      : number;
  order_count   : number;
  selisih       : number;
  burst_detected: boolean;
  is_anomaly    : boolean;
}

interface DailySummary {
  tanggal      : string;
  order_count  : number;
  total_spend  : number;
  total_deposit: number;
  jumlah_user  : number;
}

export function MonitoringTab({ showToast }: { showToast: (msg: string) => void }) {
  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  const [burstCount,   setBurstCount]   = useState(0);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [blacklisting, setBlacklisting] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [lastRefresh,  setLastRefresh]  = useState(new Date());
  const [confirmModal, setConfirmModal] = useState<{ userId: string; email: string } | null>(null);
  const [period,       setPeriod]       = useState<'1' | '7' | '30'>('7');
  const [search,       setSearch]       = useState('');
  const [showFilter,   setShowFilter]   = useState<'all' | 'anomaly' | 'burst' | 'normal'>('all');

  const fetchData = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
      const res  = await fetch(`/api/admin/monitoring?days=${p}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data.users          ?? []);
      setDailySummary(data.daily   ?? []);
      setBurstCount(data.burst_count   ?? 0);
      setAnomalyCount(data.anomaly_count ?? 0);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[monitoring] fetchData error:', err);
    } finally { setLoading(false); }
  }, []); // tidak ada dependency — semua state di-set via setter

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  const doBlacklist = async () => {
    if (!confirmModal) return;
    const { userId, email } = confirmModal;
    setConfirmModal(null);
    setBlacklisting(userId);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
      const r = await fetch('/api/admin/users', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body   : JSON.stringify({ userId, action: 'blacklist', value: true }),
      });
      if ((await r.json()).success) {
        showToast(`✅ ${email} berhasil diblokir.`);
        fetchData(period);
      }
    } catch { showToast('Gagal memblokir user.'); }
    finally { setBlacklisting(null); }
  };

  const filtered = users
    .filter(u => {
      if (showFilter === 'anomaly') return u.is_anomaly;
      if (showFilter === 'burst')   return u.burst_detected;
      if (showFilter === 'normal')  return !u.is_anomaly && !u.burst_detected;
      return true;
    })
    .filter(u => !search.trim() || u.email.toLowerCase().includes(search.toLowerCase()));

  const totalSelisih       = users.filter(u => u.is_anomaly).reduce((s, u) => s + u.selisih, 0);
  const totalRevenue       = dailySummary.reduce((s, d) => s + d.total_spend, 0);
  const totalDepositPeriod = dailySummary.reduce((s, d) => s + d.total_deposit, 0);

  // Hitung sekali, dipakai di daily table untuk cek "Hari ini"
  const _now       = new Date();
  const todayLocal = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`;

  return (
    <div className="space-y-6">

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmModal(null)}>
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-white/[0.07]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-50 dark:bg-red-900/30 p-2.5 rounded-xl">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konfirmasi</div>
                <div className="text-base font-black text-slate-900 dark:text-white">Blokir Akun</div>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Akun <span className="font-bold text-slate-900 dark:text-white">{confirmModal.email}</span> akan diblokir dan tidak bisa login. Lanjutkan?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/[0.09] transition-colors">
                Batal
              </button>
              <button onClick={doBlacklist}
                className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-colors flex items-center justify-center gap-2">
                <Ban className="w-4 h-4" /> Blokir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Security Monitoring
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {period === '1' ? 'Hari ini' : `${period} hari terakhir`} · Refresh: {lastRefresh.toLocaleTimeString('id-ID')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-[#0f1320] rounded-xl p-1 border border-slate-200 dark:border-white/[0.07]">
            {([['1', 'Hari Ini'], ['7', '7 Hari'], ['30', '30 Hari']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setPeriod(val)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${period === val ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => fetchData(period)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/[0.09] transition-colors border border-slate-200 dark:border-white/[0.09] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Alert Banners ── */}
      {anomalyCount > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-black text-red-700 dark:text-red-400 text-sm">
              🚨 {anomalyCount} user memiliki total pengeluaran melebihi semua pemasukan!
            </div>
            <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Total selisih: {fmtIDR(totalSelisih)} · Ini tidak mungkin terjadi secara normal
            </div>
          </div>
        </div>
      )}

      {burstCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3">
          <Zap className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-black text-amber-700 dark:text-amber-400 text-sm">
              ⚡ {burstCount} user order 3+ kali dalam 5 menit (24 jam terakhir)
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Indikasi percobaan race condition</div>
          </div>
        </div>
      )}

      {anomalyCount === 0 && burstCount === 0 && !loading && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <div className="font-bold text-green-700 dark:text-green-400 text-sm">
            Sistem aman — tidak ada anomali dalam periode ini
          </div>
        </div>
      )}

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'User Anomali',
            value: anomalyCount,
            sub  : 'pengeluaran > pemasukan',
            color: anomalyCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
            bg   : anomalyCount > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30',
            icon : <ShieldAlert className={`w-5 h-5 ${anomalyCount > 0 ? 'text-red-500' : 'text-green-500'}`} />,
          },
          {
            label: 'Total Selisih',
            value: fmtIDR(totalSelisih),
            sub  : 'estimasi kerugian',
            color: totalSelisih > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
            bg   : totalSelisih > 0 ? 'bg-red-50 dark:bg-red-900/30' : 'bg-green-50 dark:bg-green-900/30',
            icon : <DollarSign className={`w-5 h-5 ${totalSelisih > 0 ? 'text-red-500' : 'text-green-500'}`} />,
          },
          {
            label: 'User Aktif Periode',
            value: users.length,
            sub  : `${period === '1' ? 'hari ini' : period + ' hari terakhir'}`,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg   : 'bg-indigo-50 dark:bg-indigo-900/30',
            icon : <Users className="w-5 h-5 text-indigo-500" />,
          },
          {
            label: 'Revenue Periode',
            value: fmtIDR(totalRevenue),
            sub  : `deposit masuk: ${fmtIDR(totalDepositPeriod)}`,
            color: 'text-green-600 dark:text-green-400',
            bg   : 'bg-green-50 dark:bg-green-900/30',
            icon : <TrendingUp className="w-5 h-5 text-green-500" />,
          },
        ].map(c => (
          <div key={c.label} className={`${c.bg} rounded-[2rem] p-5`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-white/50 dark:bg-black/20">{c.icon}</div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{c.label}</span>
            </div>
            <div className={`text-2xl font-black ${c.color}`}>{c.value}</div>
            <div className="text-xs text-slate-400 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Tabel User ── */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.07] flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              Semua User Aktif
              <span className="ml-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full font-bold">{filtered.length}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Spend & pemasukan dihitung all time · user aktif berdasarkan periode</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {([
                ['all',     'Semua'],
                ['anomaly', `🚨 Anomali (${anomalyCount})`],
                ['burst',   `⚡ Burst (${burstCount})`],
                ['normal',  '✅ Normal'],
              ] as const).map(([val, label]) => (
                <button key={val} onClick={() => setShowFilter(val)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                    showFilter === val
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                      : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-400'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari email..."
                className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white w-44" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                {['User', 'Total Beli', 'Total Masuk', 'Selisih', 'Order', 'Saldo', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {loading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="hover:bg-indigo-50/40 dark:hover:bg-white/[0.02]">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" style={{ width: `${50 + j * 10}px` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <CheckCircle2 className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                    <div className="font-bold text-slate-400">Tidak ada user ditemukan</div>
                    <div className="text-xs text-slate-300 dark:text-slate-600 mt-1">Coba ubah filter atau periode</div>
                  </td>
                </tr>
              ) : filtered.map(u => (
                <React.Fragment key={u.user_id}>
                  <tr
                    onClick={() => setExpandedUser(expandedUser === u.user_id ? null : u.user_id)}
                    className={`cursor-pointer transition-colors ${
                      u.is_blacklisted  ? 'opacity-40'
                      : u.is_anomaly    ? 'bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/60 dark:hover:bg-red-900/20'
                      : u.burst_detected? 'bg-amber-50/20 dark:bg-amber-900/10 hover:bg-amber-50/40 dark:hover:bg-amber-900/20'
                      :                   'hover:bg-indigo-50/40 dark:hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {expandedUser === u.user_id
                          ? <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
                          : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
                        <div>
                          <div className="font-bold text-sm dark:text-white">{u.email}</div>
                          <div className="text-xs text-slate-400 font-mono">{u.user_id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(u.total_out)}</td>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(u.total_in)}</td>
                    <td className="px-5 py-4">
                      {u.selisih > 0 ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />+{fmtIDR(u.selisih)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />{fmtIDR(Math.abs(u.selisih))} sisa
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">{u.order_count}x</td>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(u.saldo)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {u.is_blacklisted && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />Diblokir
                          </span>
                        )}
                        {!u.is_blacklisted && u.is_anomaly && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />Anomali
                          </span>
                        )}
                        {u.burst_detected && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                            <Zap className="w-3 h-3" />Burst
                          </span>
                        )}
                        {!u.is_blacklisted && !u.is_anomaly && !u.burst_detected && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />Normal
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      {!u.is_blacklisted && u.is_anomaly && (
                        <button onClick={() => setConfirmModal({ userId: u.user_id, email: u.email })}
                          disabled={blacklisting === u.user_id}
                          className="px-2.5 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white rounded-lg text-xs font-bold border border-red-200 dark:border-red-800/50 flex items-center gap-1 transition-colors disabled:opacity-50">
                          {blacklisting === u.user_id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                          Blokir
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedUser === u.user_id && (
                    <tr className="bg-slate-50/80 dark:bg-[#080b14]/80">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Breakdown Saldo (All Time)</div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="bg-white dark:bg-[#0d1020] rounded-2xl p-3.5 border border-slate-200 dark:border-white/[0.07]">
                            <div className="text-xs text-slate-400 mb-1">Total Beli OTP</div>
                            <div className="font-black text-red-600 dark:text-red-400">{fmtIDR(u.total_out)}</div>
                            <div className="text-xs text-slate-400">{u.order_count} order</div>
                          </div>
                          <div className="bg-white dark:bg-[#0d1020] rounded-2xl p-3.5 border border-slate-200 dark:border-white/[0.07]">
                            <div className="text-xs text-slate-400 mb-1">Deposit</div>
                            <div className="font-black text-green-600 dark:text-green-400">{fmtIDR(u.deposit_in)}</div>
                          </div>
                          <div className="bg-white dark:bg-[#0d1020] rounded-2xl p-3.5 border border-slate-200 dark:border-white/[0.07]">
                            <div className="text-xs text-slate-400 mb-1">Refund Diterima</div>
                            <div className="font-black text-blue-600 dark:text-blue-400">{fmtIDR(u.refund_in)}</div>
                          </div>
                          <div className="bg-white dark:bg-[#0d1020] rounded-2xl p-3.5 border border-slate-200 dark:border-white/[0.07]">
                            <div className="text-xs text-slate-400 mb-1">Koreksi Admin</div>
                            <div className="font-black text-indigo-600 dark:text-indigo-400">{fmtIDR(u.admin_in)}</div>
                          </div>
                          <div className="bg-white dark:bg-[#0d1020] rounded-2xl p-3.5 border border-slate-200 dark:border-white/[0.07]">
                            <div className="text-xs text-slate-400 mb-1">Saldo Sekarang</div>
                            <div className="font-black text-slate-900 dark:text-white">{fmtIDR(u.saldo)}</div>
                            <div className={`text-xs font-semibold mt-1 ${u.selisih > 0 ? 'text-red-500' : 'text-green-500'}`}>
                              {u.selisih > 0 ? `⚠ Lebih ${fmtIDR(u.selisih)}` : `✓ Selisih ${fmtIDR(Math.abs(u.selisih))}`}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Daily Summary ── */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/[0.07]">
          <h3 className="font-black text-slate-900 dark:text-white text-sm">Ringkasan Harian</h3>
          <p className="text-xs text-slate-400 mt-0.5">Revenue & deposit dalam periode yang dipilih</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
              <tr>
                {['Tanggal', 'Order Berhasil', 'Revenue', 'Deposit Masuk', 'User Aktif'].map(h => (
                  <th key={h} className="px-5 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>{[1,2,3,4,5].map(j => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse w-24" />
                    </td>
                  ))}</tr>
                ))
              ) : dailySummary.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-slate-400 font-bold text-sm">Belum ada data</td></tr>
              ) : dailySummary.map(d => {
                const isToday = d.tanggal === todayLocal;
                return (
                  <tr key={d.tanggal} className={`transition-colors ${isToday ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : 'hover:bg-indigo-50/40 dark:hover:bg-white/[0.02]'}`}>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">
                      {d.tanggal}
                      {isToday && <span className="ml-2 text-xs bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black">Hari ini</span>}
                    </td>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">{d.order_count}x</td>
                    <td className="px-5 py-4 font-bold text-sm text-green-600 dark:text-green-400">{fmtIDR(d.total_spend)}</td>
                    <td className="px-5 py-4 font-bold text-sm text-indigo-600 dark:text-indigo-400">{fmtIDR(d.total_deposit)}</td>
                    <td className="px-5 py-4 font-bold text-sm dark:text-white">{d.jumlah_user} user</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}