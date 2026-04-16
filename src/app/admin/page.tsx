"use client";
// src/app/admin/page.tsx — Full Admin Panel

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, RefreshCw, AlertCircle, CheckCircle2, Clock, PhoneCall,
  Copy, Check, ShieldAlert, Activity, Zap, RotateCcw, Signal, Ban,
  Moon, Sun, Users, TrendingUp, ShoppingCart, DollarSign, Download,
  Settings, FileText, Search, ChevronDown, BarChart2, Sliders,
  UserX, UserCheck, XCircle, Eye, EyeOff, Package, LogOut, Lock, Mail
} from 'lucide-react';

// ─── TYPES ───────────────────────────────────────────────────────────
interface Stats {
  totalUsers    : number;
  totalOrders   : number;
  ordersToday   : number;
  activeOrders  : number;
  totalRevenue  : number;
  todayRevenue  : number;
  newUsersToday : number;
  chart         : { date: string; revenue: number }[];
}

interface User {
  id            : string;
  name          : string;
  email         : string;
  balance       : number;
  orderCount    : number;
  totalSpend    : number;
  is_blacklisted: boolean;
  created_at    : string;
}

interface Transaction {
  id            : number;
  activation_id : string;
  service_name  : string;
  phone         : string;
  price         : number;
  status        : string;
  created_at    : string;
  profiles      : { email: string; name: string } | null;
}

interface PricingConfig {
  idrRate   : number;
  markupPct : number;
  minProfit : number;
  roundTo   : number;
}

interface AdminLog {
  id         : number;
  action     : string;
  target_id  : string;
  details    : string;
  created_at : string;
}

interface Activation {
  activationId: string;
  phone       : string;
  service     : string;
  status      : string;
  statusLabel : string;
  otpCode     : string | null;
  priceIDR    : number | null;
}

// ─── HELPERS ─────────────────────────────────────────────────────────
const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');
const fmtUSD = (n: number) => '$ ' + n.toFixed(2);

const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  waiting    : { color: 'text-amber-600', bg: 'bg-amber-50',  border: 'border-amber-200' },
  success    : { color: 'text-green-600', bg: 'bg-green-50',  border: 'border-green-200' },
  cancelled  : { color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-200' },
  expired    : { color: 'text-red-500',   bg: 'bg-red-50',    border: 'border-red-200'   },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG['cancelled'];
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black border uppercase tracking-wider ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {status === 'cancelled' ? 'BATAL' : status === 'waiting' ? 'MENUNGGU' : status === 'success' ? 'BERHASIL' : status.toUpperCase()}
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-1.5 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
    </button>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${accent} p-2.5 rounded-xl`}>{icon}</div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'activations',  label: 'Aktivasi Live', icon: <Signal className="w-4 h-4" /> },
  { id: 'transactions', label: 'Transaksi',     icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'users',        label: 'Pengguna',      icon: <Users className="w-4 h-4" /> },
  { id: 'pricing',      label: 'Harga Global',  icon: <Sliders className="w-4 h-4" /> },
  { id: 'override',     label: 'Harga Layanan', icon: <Package className="w-4 h-4" /> },
  { id: 'revenue',      label: 'Revenue',       icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'deposit',      label: 'Deposit',       icon: <DollarSign className="w-4 h-4" /> },
  { id: 'admins',       label: 'Role Admin',    icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'logs',         label: 'Log Aktivitas', icon: <FileText className="w-4 h-4" /> },
];

// ─── MAIN ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab,         setTab]         = useState('dashboard');
  const [isDark,      setIsDark]      = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Auth ─────────────────────────────────────────────────────────────
  const [isAuthed,    setIsAuthed]    = useState(false);
  const [loginEmail,  setLoginEmail]  = useState('');
  const [loginPass,   setLoginPass]   = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loginErr,    setLoginErr]    = useState('');
  const [loginLoading,setLoginLoading]= useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAuthed(localStorage.getItem('admin_authed') === 'true');
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoginLoading(true);
    try {
      const r = await fetch('/api/admin/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: loginEmail, password: loginPass }),
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem('admin_authed', 'true');
        setIsAuthed(true);
      } else {
        setLoginErr(d.message ?? 'Email atau password salah.');
      }
    } catch {
      setLoginErr('Gagal terhubung ke server.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Login Screen ─────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 dark:bg-indigo-600 rounded-3xl shadow-xl mb-4">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pusat Nokos</div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-1">Admin Panel</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Masuk dengan akun administrator</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Email Admin</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="admin@email.com"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition"
                  >
                    {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {loginErr && (
                <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm font-bold px-4 py-3 rounded-2xl">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {loginErr}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-slate-900 dark:bg-indigo-600 text-white font-bold py-4 rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loginLoading
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Memverifikasi...</>
                  : <><ShieldAlert className="w-4 h-4" /> Masuk ke Panel</>
                }
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">Akses terbatas untuk administrator saja.</p>
        </div>
      </div>
    );
  }

  // HeroSMS
  const [balance,     setBalance]     = useState<{ balance: number } | null>(null);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loadingAct,  setLoadingAct]  = useState(true);

  // Dashboard
  const [stats,       setStats]       = useState<Stats | null>(null);

  // Users
  const [users,       setUsers]       = useState<User[]>([]);
  const [userTotal,   setUserTotal]   = useState(0);
  const [userPage,    setUserPage]    = useState(1);
  const [userSearch,  setUserSearch]  = useState('');
  const [loadingUsers,setLoadingUsers]= useState(false);

  // Transactions
  const [txns,        setTxns]        = useState<Transaction[]>([]);
  const [txnTotal,    setTxnTotal]    = useState(0);
  const [txnPage,     setTxnPage]     = useState(1);
  const [txnStatus,   setTxnStatus]   = useState('');
  const [txnSearch,   setTxnSearch]   = useState('');
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [actionLoading,setActionLoading] = useState<string | null>(null);

  // Pricing
  const [pricing,     setPricing]     = useState<PricingConfig>({ idrRate: 17135.75, markupPct: 0.25, minProfit: 200, roundTo: 100 });
  const [savingPrice, setSavingPrice] = useState(false);

  // Logs
  const [logs,        setLogs]        = useState<AdminLog[]>([]);
  const [logTotal,    setLogTotal]    = useState(0);
  const [logPage,     setLogPage]     = useState(1);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Dark mode
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const dark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
  }, []);

  const toggleDark = () => setIsDark(p => {
    const next = !p;
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    return next;
  });

  // ── Fetchers ────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    try { const r = await fetch('/api/balance'); setBalance(await r.json()); } catch {}
  }, []);

  const fetchActivations = useCallback(async () => {
    setLoadingAct(true);
    try { const r = await fetch('/api/activations'); setActivations(await r.json()); } catch { setActivations([]); }
    finally { setLoadingAct(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    try { const r = await fetch('/api/admin/stats'); setStats(await r.json()); } catch {}
  }, []);

  const fetchUsers = useCallback(async (p: number, s: string) => {
    setLoadingUsers(true);
    try {
      const r = await fetch(`/api/admin/users?page=${p}&search=${encodeURIComponent(s)}`);
      const d = await r.json();
      setUsers(d.users ?? []); setUserTotal(d.total ?? 0);
    } catch {}
    finally { setLoadingUsers(false); }
  }, []);

  const fetchTxns = useCallback(async (p: number, status: string, search: string) => {
    setLoadingTxns(true);
    try {
      const r = await fetch(`/api/admin/transactions?page=${p}&status=${status}&search=${encodeURIComponent(search)}`);
      const d = await r.json();
      setTxns(d.transactions ?? []); setTxnTotal(d.total ?? 0);
    } catch {}
    finally { setLoadingTxns(false); }
  }, []);

  const fetchPricing = useCallback(async () => {
    try { const r = await fetch('/api/admin/pricing'); setPricing(await r.json()); } catch {}
  }, []);

  const fetchLogs = useCallback(async (p: number) => {
    try {
      const r = await fetch(`/api/admin/logs?page=${p}`);
      const d = await r.json();
      setLogs(d.logs ?? []); setLogTotal(d.total ?? 0);
    } catch {}
  }, []);

  const refreshAll = useCallback(() => {
    fetchBalance(); fetchActivations(); fetchStats();
    setLastRefresh(new Date());
  }, [fetchBalance, fetchActivations, fetchStats]);

  useEffect(() => { refreshAll(); const t = setInterval(refreshAll, 15000); return () => clearInterval(t); }, [refreshAll]);
  useEffect(() => { if (tab === 'users') fetchUsers(userPage, userSearch); }, [tab, userPage]);
  useEffect(() => { if (tab === 'transactions') fetchTxns(txnPage, txnStatus, txnSearch); }, [tab, txnPage, txnStatus]);
  useEffect(() => { if (tab === 'pricing') fetchPricing(); }, [tab]);
  useEffect(() => { if (tab === 'logs') fetchLogs(logPage); }, [tab, logPage]);

  // ── Actions ─────────────────────────────────────────────────────────
  const handleTxnAction = async (txn: Transaction, action: 'cancel' | 'done') => {
    setActionLoading(txn.id + action);
    try {
      const r = await fetch('/api/admin/transactions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: txn.activation_id, action, orderId: txn.id }) });
      if ((await r.json()).success) { showToast(action === 'cancel' ? 'Order dibatalkan, saldo user direfund.' : 'Order selesai.'); fetchTxns(txnPage, txnStatus, txnSearch); }
    } catch { showToast('Gagal.'); }
    finally { setActionLoading(null); }
  };

  const handleUserAction = async (userId: string, action: 'blacklist' | 'unblacklist' | 'set_balance', value?: any) => {
    try {
      await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action: action === 'unblacklist' ? 'blacklist' : action, value: action === 'unblacklist' ? false : (value ?? true) }) });
      showToast(action === 'blacklist' ? 'User diblokir.' : action === 'unblacklist' ? 'User dibuka blokir.' : 'Saldo diperbarui.');
      fetchUsers(userPage, userSearch);
    } catch { showToast('Gagal.'); }
  };

  const handleSavePricing = async () => {
    setSavingPrice(true);
    try {
      await fetch('/api/admin/pricing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pricing) });
      showToast('Konfigurasi harga disimpan!');
    } catch { showToast('Gagal menyimpan.'); }
    finally { setSavingPrice(false); }
  };

  const handleExport = (type: string) => {
    window.open(`/api/admin/export?type=${type}`, '_blank');
  };

  const handleActivationAction = async (id: string, action: 'cancel' | 'done') => {
    setActionLoading(id + action);
    try {
      const r = await fetch('/api/order', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
      const d = await r.json();
      if (d.success) { showToast(d.message); fetchActivations(); }
    } catch { showToast('Gagal.'); }
    finally { setActionLoading(null); }
  };

  const maxChart = Math.max(...(stats?.chart ?? []).map(c => c.revenue), 1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400 dark:text-yellow-600" /> {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 dark:bg-indigo-600 p-2 rounded-xl"><ShieldAlert className="w-5 h-5 text-white" /></div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pusat Nokos</div>
            <div className="text-base font-black text-slate-900 dark:text-white">Admin Panel</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => { localStorage.removeItem('admin_authed'); window.location.href = '/'; }} className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 rounded-2xl flex items-center gap-2 transition-colors">
            <LogOut className="w-4 h-4"/> Keluar
          </button>
        </div>
      </header>

      {/* Body: Sidebar + Content */}
      <div className="flex min-h-[calc(100vh-65px)]">

        {/* ── SIDEBAR ── */}
        <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
          <nav className="flex-1 p-3 space-y-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={"w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left " + (tab === t.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <span className={tab === t.id ? 'text-white' : 'text-slate-400'}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <button onClick={() => { localStorage.removeItem('admin_authed'); window.location.href = '/'; }} className="w-full font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 py-3 px-4 rounded-2xl flex justify-center items-center transition-colors gap-2">
              <LogOut className="w-4 h-4"/> Keluar Akun
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 min-w-0 p-6 space-y-6 overflow-auto">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <>
            {/* Saldo HeroSMS */}
            <div className="bg-slate-900 dark:bg-indigo-600 rounded-2xl p-6 flex items-center justify-between text-white">
              <div>
                <div className="text-xs font-bold text-slate-400 dark:text-indigo-200 uppercase tracking-widest mb-1">Saldo HeroSMS</div>
                <div className="text-3xl font-black">{balance ? fmtUSD(balance.balance) : '—'}</div>
                <div className="text-slate-400 dark:text-indigo-200 text-sm mt-1">{balance ? `≈ ${fmtIDR(Math.round(balance.balance * 17135.75))}` : ''}</div>
              </div>
              <Wallet className="w-10 h-10 opacity-30" />
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={<Users className="w-5 h-5 text-indigo-600" />}      label="Total User"       value={stats?.totalUsers ?? '—'}   sub={`+${stats?.newUsersToday ?? 0} hari ini`} accent="bg-indigo-50 dark:bg-indigo-900/30" />
              <StatCard icon={<ShoppingCart className="w-5 h-5 text-blue-600" />} label="Total Order"      value={stats?.totalOrders ?? '—'}  sub={`${stats?.ordersToday ?? 0} hari ini`}    accent="bg-blue-50 dark:bg-blue-900/30" />
              <StatCard icon={<Activity className="w-5 h-5 text-amber-600" />}    label="Order Aktif"      value={stats?.activeOrders ?? '—'} sub="sedang menunggu OTP"                       accent="bg-amber-50 dark:bg-amber-900/30" />
              <StatCard icon={<TrendingUp className="w-5 h-5 text-green-600" />}  label="Revenue Hari Ini" value={stats ? fmtIDR(stats.todayRevenue) : '—'} sub={stats ? `Total: ${fmtIDR(stats.totalRevenue)}` : ''} accent="bg-green-50 dark:bg-green-900/30" />
            </div>

            {/* Chart 7 hari */}
            {stats?.chart && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6">Revenue 7 Hari Terakhir</h3>
                <div className="flex items-end gap-2 h-40">
                  {stats.chart.map((c, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[9px] font-bold text-slate-400">{fmtIDR(c.revenue).replace('Rp ', '')}</div>
                      <div className="w-full bg-indigo-600 dark:bg-indigo-500 rounded-t-md transition-all" style={{ height: `${Math.max(4, (c.revenue / maxChart) * 120)}px` }} />
                      <div className="text-[9px] font-bold text-slate-400 text-center">{c.date}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Export Data</h3>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => handleExport('users')} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-sm font-bold hover:bg-indigo-600 hover:text-white transition-colors">
                  <Download className="w-4 h-4" /> Export Users CSV
                </button>
                <button onClick={() => handleExport('transactions')} className="flex items-center gap-2 px-5 py-2.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800/50 rounded-xl text-sm font-bold hover:bg-green-600 hover:text-white transition-colors">
                  <Download className="w-4 h-4" /> Export Transaksi CSV
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── AKTIVASI LIVE ── */}
        {tab === 'activations' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {loadingAct ? (
              <div className="p-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Memuat...</div>
            ) : activations.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><Signal className="w-8 h-8 mx-auto mb-2 opacity-30" /><div className="font-bold">Tidak ada aktivasi aktif</div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <tr>{['ID','Nomor','Layanan','Status','OTP','Harga','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activations.map(a => (
                      <tr key={a.activationId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-slate-500">#{a.activationId}</td>
                        <td className="px-5 py-4"><div className="flex items-center"><PhoneCall className="w-3.5 h-3.5 text-slate-400 mr-1.5" /><span className="font-mono font-bold text-sm dark:text-white">{a.phone}</span><CopyBtn text={a.phone} /></div></td>
                        <td className="px-5 py-4 font-bold text-sm uppercase dark:text-white">{a.service}</td>
                        <td className="px-5 py-4"><StatusBadge status={a.status === 'STATUS_WAIT_CODE' ? 'waiting' : a.status === 'STATUS_OK' ? 'success' : 'cancelled'} /></td>
                        <td className="px-5 py-4">{a.otpCode ? <div className="flex items-center"><span className="font-mono font-black text-green-600 dark:text-green-400">{a.otpCode}</span><CopyBtn text={a.otpCode} /></div> : <span className="text-slate-300 dark:text-slate-600">—</span>}</td>
                        <td className="px-5 py-4 font-bold text-sm dark:text-slate-300">{a.priceIDR ? fmtIDR(a.priceIDR) : '—'}</td>
                        <td className="px-5 py-4">
                          {a.status === 'STATUS_WAIT_CODE' && (
                            <div className="flex gap-2">
                              <button onClick={() => handleActivationAction(a.activationId, 'done')} disabled={!!actionLoading} className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1">
                                {actionLoading === a.activationId + 'done' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Selesai
                              </button>
                              <button onClick={() => handleActivationAction(a.activationId, 'cancel')} disabled={!!actionLoading} className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold disabled:opacity-50 border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                {actionLoading === a.activationId + 'cancel' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />} Batal
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TRANSAKSI ── */}
        {tab === 'transactions' && (
          <>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input value={txnSearch} onChange={e => setTxnSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchTxns(1, txnStatus, txnSearch)} placeholder="Cari nomor HP..." className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white" />
              </div>
              <select value={txnStatus} onChange={e => { setTxnStatus(e.target.value); fetchTxns(1, e.target.value, txnSearch); }} className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none dark:text-white">
                <option value="">Semua Status</option>
                <option value="waiting">Menunggu</option>
                <option value="success">Berhasil</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="expired">Kadaluarsa</option>
              </select>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {loadingTxns ? <div className="p-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>{['User','Layanan','Nomor','Harga','Status','Waktu','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {txns.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-slate-400 font-bold">Tidak ada data</td></tr> : txns.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-5 py-4"><div className="font-bold text-sm dark:text-white">{(t.profiles as any)?.name ?? '—'}</div><div className="text-xs text-slate-400">{(t.profiles as any)?.email ?? ''}</div></td>
                          <td className="px-5 py-4 font-bold text-sm uppercase dark:text-white">{t.service_name}</td>
                          <td className="px-5 py-4"><div className="flex items-center font-mono text-sm dark:text-white">{t.phone}<CopyBtn text={t.phone} /></div></td>
                          <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(t.price)}</td>
                          <td className="px-5 py-4"><StatusBadge status={t.status} /></td>
                          <td className="px-5 py-4 text-xs text-slate-400">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                          <td className="px-5 py-4">
                            {t.status === 'waiting' && (
                              <div className="flex gap-1.5">
                                <button onClick={() => handleTxnAction(t, 'done')} disabled={!!actionLoading} className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold disabled:opacity-50">Selesai</button>
                                <button onClick={() => handleTxnAction(t, 'cancel')} disabled={!!actionLoading} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs font-bold border border-red-200 disabled:opacity-50">Batal</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Pagination */}
              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total: {txnTotal} transaksi</span>
                <div className="flex gap-2">
                  <button onClick={() => { const p = Math.max(1, txnPage-1); setTxnPage(p); fetchTxns(p, txnStatus, txnSearch); }} disabled={txnPage === 1} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50">← Prev</button>
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {txnPage}</span>
                  <button onClick={() => { const p = txnPage+1; setTxnPage(p); fetchTxns(p, txnStatus, txnSearch); }} disabled={txns.length < 20} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50">Next →</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers(1, userSearch)} placeholder="Cari email..." className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white" />
              </div>
              <button onClick={() => fetchUsers(1, userSearch)} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">Cari</button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              {loadingUsers ? <div className="p-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>{['User','Saldo','Order','Total Spend','Status','Terdaftar','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-slate-400 font-bold">Tidak ada user</td></tr> : users.map(u => (
                        <tr key={u.id} className={"hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors " + (u.is_blacklisted ? 'opacity-50' : '')}>
                          <td className="px-5 py-4"><div className="font-bold text-sm dark:text-white">{u.name}</div><div className="text-xs text-slate-400">{u.email}</div></td>
                          <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(u.balance)}</td>
                          <td className="px-5 py-4 font-bold text-sm dark:text-white">{u.orderCount}</td>
                          <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(u.totalSpend)}</td>
                          <td className="px-5 py-4">
                            {u.is_blacklisted
                              ? <span className="px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-black">DIBLOKIR</span>
                              : <span className="px-2.5 py-1 bg-green-50 text-green-600 border border-green-200 rounded-lg text-xs font-black">AKTIF</span>}
                          </td>
                          <td className="px-5 py-4 text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString('id-ID')}</td>
                          <td className="px-5 py-4">
                            <div className="flex gap-1.5">
                              {u.is_blacklisted
                                ? <button onClick={() => handleUserAction(u.id, 'unblacklist')} className="px-2.5 py-1.5 bg-green-50 hover:bg-green-600 text-green-600 hover:text-white rounded-lg text-xs font-bold border border-green-200 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Buka</button>
                                : <button onClick={() => handleUserAction(u.id, 'blacklist')} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs font-bold border border-red-200 flex items-center gap-1"><UserX className="w-3 h-3" /> Blokir</button>}
                              <button onClick={() => { const v = prompt(`Set saldo baru untuk ${u.email} (angka IDR):`); if (v && !isNaN(parseInt(v))) handleUserAction(u.id, 'set_balance', parseInt(v)); }} className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold border border-indigo-200 flex items-center gap-1"><Wallet className="w-3 h-3" /> Saldo</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total: {userTotal} user</span>
                <div className="flex gap-2">
                  <button onClick={() => { const p = Math.max(1, userPage-1); setUserPage(p); fetchUsers(p, userSearch); }} disabled={userPage === 1} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50">← Prev</button>
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {userPage}</span>
                  <button onClick={() => { const p = userPage+1; setUserPage(p); fetchUsers(p, userSearch); }} disabled={users.length < 20} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50">Next →</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── PRICING ── */}
        {tab === 'pricing' && (
          <div className="max-w-xl space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
              <h3 className="text-base font-black text-slate-900 dark:text-white">Konfigurasi Markup Harga</h3>
              <p className="text-xs text-slate-400">Perubahan di sini akan langsung mempengaruhi harga yang tampil ke user saat fetch layanan.</p>

              {[
                { key: 'idrRate',   label: 'Kurs USD → IDR',            min: 10000, step: 1,    suffix: 'IDR/USD' },
                { key: 'markupPct', label: 'Markup (%)',                  min: 0,     step: 0.01, suffix: '× harga modal' },
                { key: 'minProfit', label: 'Minimum Profit (IDR)',        min: 0,     step: 100,  suffix: 'IDR' },
                { key: 'roundTo',   label: 'Pembulatan ke (IDR)',         min: 1,     step: 1,    suffix: 'IDR' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">{f.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={f.min}
                      step={f.step}
                      value={(pricing as any)[f.key]}
                      onChange={e => setPricing(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-bold dark:text-white"
                    />
                    <span className="text-xs text-slate-400 font-bold w-20">{f.suffix}</span>
                  </div>
                </div>
              ))}

              {/* Preview */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-sm">
                <div className="font-bold text-slate-700 dark:text-slate-300 mb-2">Preview (modal $0.10 USD):</div>
                {(() => {
                  const modal  = 0.10 * pricing.idrRate;
                  const profit = Math.max(modal * pricing.markupPct, pricing.minProfit);
                  const final  = Math.ceil((modal + profit) / pricing.roundTo) * pricing.roundTo;
                  return <div className="font-black text-indigo-600 dark:text-indigo-400 text-lg">{fmtIDR(final)}</div>;
                })()}
              </div>

              <button onClick={handleSavePricing} disabled={savingPrice} className="w-full py-3.5 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {savingPrice ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                {savingPrice ? 'Menyimpan...' : 'Simpan Konfigurasi'}
              </button>
            </div>
          </div>
        )}

        {/* ── DEPOSIT ── */}
        {tab === 'deposit' && <DepositTab showToast={showToast} />}

        {/* ── REVENUE ── */}
        {tab === 'revenue' && <RevenueTab />}

        {/* ── OVERRIDE HARGA ── */}
        {tab === 'override' && <OverridePricingTab showToast={showToast} />}

        {/* ── ROLE ADMIN ── */}
        {tab === 'admins' && <AdminRolesTab showToast={showToast} />}

        {tab === 'logs' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-widest text-slate-400 font-black">
                  <tr>{['Aksi','Target','Detail','Waktu'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.length === 0 ? <tr><td colSpan={4} className="py-16 text-center text-slate-400 font-bold">Belum ada log</td></tr> : logs.map(l => (
                    <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4"><span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-xs font-black uppercase">{l.action.replace(/_/g, ' ')}</span></td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">{l.target_id}</td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{l.details}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Total: {logTotal} log</span>
              <div className="flex gap-2">
                <button onClick={() => { const p = Math.max(1, logPage-1); setLogPage(p); fetchLogs(p); }} disabled={logPage === 1} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50">← Prev</button>
                <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {logPage}</span>
                <button onClick={() => { const p = logPage+1; setLogPage(p); fetchLogs(p); }} disabled={logs.length < 30} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-50">Next →</button>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>
    </div>
  );
}

// ─── DEPOSIT TAB ──────────────────────────────────────────────────────
function DepositTab({ showToast }: { showToast: (msg: string) => void }) {
  const [requests,     setRequests]     = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading,      setLoading]      = useState(false);
  const [actionLoading,setActionLoading]= useState<number | null>(null);
  const [rejectNote,   setRejectNote]   = useState('');
  const [rejectId,     setRejectId]     = useState<number | null>(null);
  const [proofModal,   setProofModal]   = useState<string | null>(null);

  const fetchRequests = async (p: number, status: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/deposit?page=${p}&status=${status}`);
      const d = await r.json();
      setRequests(d.requests ?? []);
      setTotal(d.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(page, statusFilter); }, [page, statusFilter]);

  const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
    setActionLoading(requestId);
    try {
      const r = await fetch('/api/admin/deposit', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          requestId,
          action,
          adminNote: action === 'reject' ? (rejectNote || 'Ditolak oleh admin') : 'Disetujui oleh admin',
        }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(d.message);
        fetchRequests(page, statusFilter);
        setRejectId(null);
        setRejectNote('');
      } else {
        showToast(d.error ?? 'Gagal memproses.');
      }
    } catch {
      showToast('Kesalahan jaringan.');
    } finally {
      setActionLoading(null);
    }
  };

  const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    pending : { label: 'Menunggu',  color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500' },
    approved: { label: 'Disetujui', color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-800/50', dot: 'bg-green-500' },
    rejected: { label: 'Ditolak',   color: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-200 dark:border-red-800/50',     dot: 'bg-red-500'   },
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">

      {/* Proof image modal */}
      {proofModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setProofModal(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={proofModal} alt="Bukti Transfer" className="w-full rounded-2xl shadow-2xl" />
            <button onClick={() => setProofModal(null)} className="absolute -top-3 -right-3 bg-white dark:bg-slate-800 rounded-full p-2 shadow-lg">
              <XCircle className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRejectId(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl"><XCircle className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Konfirmasi</div>
                <div className="font-black text-slate-900 dark:text-white">Tolak Deposit</div>
              </div>
            </div>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Alasan penolakan (opsional)..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white resize-none h-24 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectId(null); setRejectNote(''); }} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Batal
              </button>
              <button
                onClick={() => handleAction(rejectId, 'reject')}
                disabled={!!actionLoading}
                className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading === rejectId ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Tolak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'pending',  label: 'Menunggu' },
          { key: 'approved', label: 'Disetujui' },
          { key: 'rejected', label: 'Ditolak' },
          { key: 'all',      label: 'Semua' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => { setStatusFilter(s.key); setPage(1); }}
            className={"px-5 py-2.5 rounded-xl text-sm font-bold transition-all border-2 " + (statusFilter === s.key
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300')}
          >
            {s.label}
            {s.key === 'pending' && pendingCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading && requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3" />
            <div className="font-bold text-sm">Memuat data...</div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <div className="font-bold">Tidak ada request deposit</div>
          </div>
        ) : requests.map((r: any) => {
          const cfg     = STATUS_CFG[r.status] ?? STATUS_CFG['pending'];
          const profile = r.profiles as any;
          return (
            <div key={r.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-5 sm:p-6 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-2xl font-black text-slate-900 dark:text-white">Rp {r.amount.toLocaleString('id-ID')}</span>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-400">
                      {profile?.name?.charAt(0)?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{profile?.name ?? 'Unknown'}</span>
                      <span className="text-slate-400 text-xs font-medium ml-1.5">{profile?.email}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 font-medium">
                    <span className="flex items-center gap-1">📱 {r.bank_name}</span>
                    <span>🕐 {new Date(r.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  {r.note && <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl">📝 {r.note}</div>}
                  {r.admin_note && r.status !== 'pending' && (
                    <div className={`text-xs px-3 py-2 rounded-xl font-medium ${r.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                      Admin: {r.admin_note}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 sm:flex-col sm:items-end flex-wrap">
                  {r.proof_url && (
                    <button
                      onClick={() => setProofModal(r.proof_url)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Lihat Bukti
                    </button>
                  )}
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleAction(r.id, 'approve')}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-colors shadow-sm shadow-green-600/20"
                      >
                        {actionLoading === r.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectId(r.id)}
                        disabled={!!actionLoading}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white rounded-xl text-sm font-bold border border-red-200 dark:border-red-800/50 disabled:opacity-50 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {requests.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Total: {total} request</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold disabled:opacity-50 hover:border-indigo-300 transition-colors dark:text-slate-300">
              ← Prev
            </button>
            <span className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">Hal {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={requests.length < 20} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold disabled:opacity-50 hover:border-indigo-300 transition-colors dark:text-slate-300">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── REVENUE TAB ──────────────────────────────────────────────────────
function RevenueTab() {
  const [period,   setPeriod]   = useState<'7d' | '30d' | '90d'>('30d');
  const [data,     setData]     = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [summary,  setSummary]  = useState({ total: 0, avgPerDay: 0, bestDay: '', bestAmount: 0, totalOrders: 0 });
  const [topSvcs,  setTopSvcs]  = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  const fetchRevenue = async (p: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/revenue?period=${p}`);
      const d = await r.json();
      setData(d.chart ?? []);
      setSummary(d.summary ?? { total: 0, avgPerDay: 0, bestDay: '', bestAmount: 0, totalOrders: 0 });
      setTopSvcs(d.topServices ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRevenue(period); }, [period]);

  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {[['7d','7 Hari'], ['30d','30 Hari'], ['90d','90 Hari']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k as any)} className={"px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all " + (period === k ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
            {l}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',     value: fmtIDR(summary.total),           icon: '💰' },
          { label: 'Rata-rata/Hari',    value: fmtIDR(summary.avgPerDay),        icon: '📈' },
          { label: 'Total Order',       value: summary.totalOrders + ' order',   icon: '📦' },
          { label: 'Hari Terbaik',      value: summary.bestDay || '—',           icon: '🏆' },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{c.label}</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{c.value}</div>
            {c.label === 'Hari Terbaik' && summary.bestAmount > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">{fmtIDR(summary.bestAmount)}</div>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6">Revenue per Hari</h3>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1.5 h-48 min-w-max">
              {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 w-8 group relative">
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10 shadow-lg">
                    {d.date}<br/>{fmtIDR(d.revenue)}<br/>{d.orders} order
                  </div>
                  <div
                    className="w-full bg-indigo-600 dark:bg-indigo-500 rounded-t-md hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors cursor-pointer"
                    style={{ height: `${Math.max(4, (d.revenue / maxRev) * 160)}px` }}
                  />
                  <div className="text-[8px] font-bold text-slate-400 text-center leading-tight w-8 overflow-hidden">{d.date.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Top services */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Top Layanan</h3>
        <div className="space-y-3">
          {topSvcs.length === 0 ? <div className="text-slate-400 text-sm text-center py-6">Belum ada data</div> : topSvcs.map((s, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">#{i+1}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{s.name}</span>
                  <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{fmtIDR(s.revenue)}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                  <div className="bg-indigo-600 dark:bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (s.revenue / (topSvcs[0]?.revenue || 1)) * 100)}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{s.count} order</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── OVERRIDE HARGA TAB ───────────────────────────────────────────────
function OverridePricingTab({ showToast }: { showToast: (msg: string) => void }) {
  const [overrides,  setOverrides]  = useState<Record<string, number>>({});
  const [allServices,setAllServices]= useState<{ code: string; name: string; price: number }[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [edited,     setEdited]     = useState<Record<string, number>>({});

  const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [svcRes, ovRes] = await Promise.all([
          fetch('/api/services?country=6&operator=0'),
          fetch('/api/admin/pricing/overrides'),
        ]);
        const svcs = await svcRes.json();
        const ovs  = await ovRes.json();
        setAllServices(svcs ?? []);
        setOverrides(ovs ?? {});
      } catch {}
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  // Filter by search
  const services = search
    ? allServices.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    : allServices;

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/pricing/overrides', {
        method : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ overrides: { ...overrides, ...edited } }),
      });
      const d = await r.json();
      if (d.success) {
        setOverrides(prev => ({ ...prev, ...edited }));
        setEdited({});
        showToast('Override harga disimpan!');
      }
    } catch { showToast('Gagal menyimpan.'); }
    finally { setSaving(false); }
  };

  const handleReset = async (code: string) => {
    const newOv = { ...overrides };
    delete newOv[code];
    setOverrides(newOv);
    const newEd = { ...edited };
    delete newEd[code];
    setEdited(newEd);
    await fetch('/api/admin/pricing/overrides', {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ overrides: newOv }),
    });
    showToast(`Override ${code} dihapus.`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Override Harga per Layanan</h2>
          <p className="text-xs text-slate-400 mt-1">Tetapkan harga khusus untuk layanan tertentu. Kosongkan untuk pakai harga markup global. Total: {allServices.length} layanan</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari layanan..." className="pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white w-48" />
          </div>
          {Object.keys(edited).length > 0 && (
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              Simpan {Object.keys(edited).length} Perubahan
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" /> Memuat layanan...
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-widest text-slate-400 font-black sticky top-0">
                <tr>
                  <th className="px-5 py-4">Layanan ({services.length})</th>
                  <th className="px-5 py-4">Harga Default</th>
                  <th className="px-5 py-4">Harga Override</th>
                  <th className="px-5 py-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {services.map(s => {
                  const hasOverride = overrides[s.code] !== undefined || edited[s.code] !== undefined;
                  const currentOverride = edited[s.code] ?? overrides[s.code] ?? '';
                  return (
                    <tr key={s.code} className={"hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors " + (hasOverride ? 'bg-amber-50/30 dark:bg-amber-900/10' : '')}>
                      <td className="px-5 py-3">
                        <div className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{s.code}</div>
                      </td>
                      <td className="px-5 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">{fmtIDR(s.price)}</td>
                      <td className="px-5 py-3">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-400 text-xs font-bold">Rp</span>
                          <input
                            type="number"
                            placeholder="—"
                            value={currentOverride}
                            onChange={e => setEdited(prev => ({ ...prev, [s.code]: parseInt(e.target.value) || 0 }))}
                            className={"pl-8 pr-3 py-2 border rounded-xl text-sm font-bold outline-none w-36 transition-colors " + (hasOverride ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 text-amber-700 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white focus:border-indigo-500')}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {hasOverride && (
                          <button onClick={() => handleReset(s.code)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2.5 py-1.5 rounded-lg transition-colors">
                            Reset
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN ROLES TAB ──────────────────────────────────────────────────
function AdminRolesTab({ showToast }: { showToast: (msg: string) => void }) {
  const [admins,     setAdmins]     = useState<any[]>([]);
  const [users,      setUsers]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [addMode,    setAddMode]    = useState<'existing' | 'new'>('existing');
  const [form,       setForm]       = useState({ email: '', name: '', role: 'moderator', password: '' });
  const [userSearch, setUserSearch] = useState('');
  const [saving,     setSaving]     = useState(false);

  const ROLES: Record<string, { label: string; color: string; bg: string; border: string; perms: string[] }> = {
    superadmin: { label: 'Super Admin', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800/50', perms: ['Semua akses'] },
    admin     : { label: 'Admin',       color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800/50', perms: ['Approve deposit', 'Kelola user', 'Lihat semua data'] },
    moderator : { label: 'Moderator',   color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800/50',    perms: ['Approve deposit', 'Lihat transaksi'] },
    viewer    : { label: 'Viewer',      color: 'text-slate-600 dark:text-slate-400',  bg: 'bg-slate-50 dark:bg-slate-800',     border: 'border-slate-200 dark:border-slate-700',     perms: ['Lihat dashboard saja'] },
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/roles');
      const d = await r.json();
      setAdmins(d ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const r = await fetch('/api/admin/users?limit=100');
      const d = await r.json();
      setUsers(d.users ?? []);
    } catch {}
  };

  useEffect(() => { fetchAdmins(); fetchUsers(); }, []);

  // Filter user yang belum jadi admin
  const adminIds  = new Set(admins.map(a => a.id));
  const filteredUsers = users
    .filter(u => !adminIds.has(u.id))
    .filter(u => !userSearch || u.email.toLowerCase().includes(userSearch.toLowerCase()) || u.name?.toLowerCase().includes(userSearch.toLowerCase()));

  const handleAddExisting = async (user: any) => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/roles', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ id: user.id, email: user.email, name: user.name, role: form.role, fromExisting: true }),
      });
      const d = await r.json();
      if (d.success) { showToast(`${user.name} berhasil dijadikan admin!`); setShowAdd(false); fetchAdmins(); }
      else showToast(d.error ?? 'Gagal.');
    } catch { showToast('Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  const handleAddNew = async () => {
    if (!form.email || !form.name || !form.password) { showToast('Semua field wajib diisi.'); return; }
    if (form.password.length < 8) { showToast('Password minimal 8 karakter.'); return; }
    setSaving(true);
    try {
      const r = await fetch('/api/admin/roles', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ ...form, fromExisting: false }),
      });
      const d = await r.json();
      if (d.success) { showToast('Admin baru berhasil ditambah!'); setShowAdd(false); setForm({ email: '', name: '', role: 'moderator', password: '' }); fetchAdmins(); }
      else showToast(d.error ?? 'Gagal menambah admin.');
    } catch { showToast('Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus admin ini?')) return;
    await fetch('/api/admin/roles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Admin dihapus.');
    fetchAdmins();
  };

  const handleChangeRole = async (id: string, role: string) => {
    await fetch('/api/admin/roles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    showToast('Role diubah.');
    fetchAdmins();
  };

  const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Role Admin</h2>
          <p className="text-xs text-slate-400 mt-1">Kelola akses admin berdasarkan role.</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
          + Tambah Admin
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(ROLES).map(([key, cfg]) => (
          <div key={key} className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}>
            <div className={`text-sm font-black mb-2 ${cfg.color}`}>{cfg.label}</div>
            {cfg.perms.map(p => <div key={p} className="text-[11px] text-slate-500 dark:text-slate-400">• {p}</div>)}
          </div>
        ))}
      </div>

      {/* Add admin form */}
      {showAdd && (
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white">Tambah Admin</h3>
            {/* Mode toggle */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
              <button onClick={() => setAddMode('existing')} className={"px-4 py-1.5 rounded-lg text-xs font-bold transition-colors " + (addMode === 'existing' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                User Terdaftar
              </button>
              <button onClick={() => setAddMode('new')} className={"px-4 py-1.5 rounded-lg text-xs font-bold transition-colors " + (addMode === 'new' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600')}>
                Akun Baru
              </button>
            </div>
          </div>

          {/* Role selector (shared) */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Role</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(ROLES).filter(([k]) => k !== 'superadmin').map(([k, v]) => (
                <button key={k} onClick={() => setForm(p => ({...p, role: k}))} className={"px-4 py-2 rounded-xl text-xs font-black border-2 transition-all " + (form.role === k ? `${v.bg} ${v.border} ${v.color}` : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300')}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode: existing user */}
          {addMode === 'existing' && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Cari nama atau email user..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none dark:text-white" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm font-bold">Tidak ada user ditemukan</div>
                ) : filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                    <button onClick={() => handleAddExisting(u)} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                      Jadikan Admin
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mode: new user */}
          {addMode === 'new' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Nama</label><input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} placeholder="Nama admin" className={inputCls} /></div>
                <div><label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Email</label><input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} placeholder="email@contoh.com" className={inputCls} /></div>
                <div className="sm:col-span-2"><label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">Password</label><input type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} placeholder="Min. 8 karakter" className={inputCls} /></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
                <button onClick={handleAddNew} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Buat & Tambah Admin
                </button>
              </div>
            </div>
          )}

          {addMode === 'existing' && (
            <button onClick={() => setShowAdd(false)} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
          )}
        </div>
      )}

      {/* Admin list */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? <div className="p-12 text-center text-slate-400"><RefreshCw className="w-6 h-6 animate-spin mx-auto" /></div> : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold">Belum ada admin terdaftar.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {admins.map((a: any) => {
              const roleCfg = ROLES[a.role] ?? ROLES['viewer'];
              return (
                <div key={a.id} className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-sm shrink-0">
                    {a.name?.charAt(0)?.toUpperCase() ?? 'A'}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{a.name}</div>
                    <div className="text-xs text-slate-400">{a.email}</div>
                    <div className="text-xs text-slate-400 mt-0.5">Ditambah: {new Date(a.created_at).toLocaleDateString('id-ID')}</div>
                  </div>
                  <select
                    value={a.role}
                    onChange={e => handleChangeRole(a.id, e.target.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-black border outline-none ${roleCfg.color} ${roleCfg.bg} ${roleCfg.border}`}
                  >
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                  {a.role !== 'superadmin' && (
                    <button onClick={() => handleDelete(a.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}