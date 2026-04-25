"use client";
// src/app/admin/page.tsx — Full Admin Panel

import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, RefreshCw, AlertCircle, CheckCircle2, Clock, PhoneCall,
  Copy, Check, ShieldAlert, Activity, Zap, RotateCcw, Signal, Ban,
  Moon, Sun, Users, TrendingUp, ShoppingCart, DollarSign, Download,
  Settings, FileText, Search, ChevronDown, BarChart2, Sliders,
  UserX, UserCheck, XCircle, Eye, EyeOff, Package, LogOut, Lock, Mail, Megaphone, Bell, ClipboardList, Globe
} from 'lucide-react';
import { MonitoringTab } from '@/components/MonitoringTab';

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
const fmtIDR = (n: number | undefined | null) => n == null ? '—' : 'Rp ' + n.toLocaleString('id-ID');
const fmtUSD = (n: number | undefined | null) => n == null ? '—' : '$ ' + n.toFixed(2);

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
    <button onClick={async () => { await navigator.clipboard.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="ml-1.5 p-1 rounded hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
    </button>
  );
}

function StatCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`${accent} p-2.5 rounded-xl`}>{icon}</div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

// ─── STATUS DROPDOWN (proper component — no hooks-in-IIFE) ─────────────
const STATUS_OPTS = [
  { value: '',          label: 'Semua Status', dot: 'bg-slate-400'  },
  { value: 'waiting',   label: 'Menunggu',     dot: 'bg-amber-400'  },
  { value: 'success',   label: 'Berhasil',     dot: 'bg-green-500'  },
  { value: 'cancelled', label: 'Dibatalkan',   dot: 'bg-slate-400'  },
  { value: 'expired',   label: 'Kadaluarsa',   dot: 'bg-red-400'    },
];

function StatusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const selected = STATUS_OPTS.find(o => o.value === value) ?? STATUS_OPTS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none dark:text-white hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors min-w-[160px]"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${selected.dot}`} />
        <span className="flex-1 text-left">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-xl z-30 overflow-hidden py-1.5">
          {STATUS_OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold transition-colors text-left ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
              {opt.label}
              {value === opt.value && <Check className="w-3.5 h-3.5 ml-auto text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TABS ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'activations',  label: 'Aktivasi Live', icon: <Signal className="w-4 h-4" /> },
  { id: 'transactions', label: 'Transaksi',     icon: <ShoppingCart className="w-4 h-4" /> },
  { id: 'users',        label: 'Pengguna',      icon: <Users className="w-4 h-4" /> },
  { id: 'monitoring',   label: 'Monitoring',    icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'pricing',      label: 'Harga Global',  icon: <Sliders className="w-4 h-4" /> },
  { id: 'override',     label: 'Harga Layanan', icon: <Package className="w-4 h-4" /> },
  { id: 'revenue',      label: 'Revenue',       icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'deposit',      label: 'Deposit',       icon: <DollarSign className="w-4 h-4" /> },
  { id: 'admins',       label: 'Role Admin',    icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'logs',         label: 'Log Aktivitas', icon: <FileText className="w-4 h-4" /> },
  { id: 'broadcast',    label: 'Broadcast',     icon: <Megaphone className="w-4 h-4" /> },
  { id: 'notice',       label: 'Papan Info',    icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'blacklist',    label: 'Riwayat Blokir', icon: <Ban className="w-4 h-4" /> },
];

// ─── MAIN ─────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [tab,         setTab]         = useState('dashboard');
  const [isDark,      setIsDark]      = useState(false);
  const [toast,       setToast]       = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // ── Auth ─────────────────────────────────────────────────────────────
  const [isAuthed,      setIsAuthed]      = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPass,     setLoginPass]     = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [loginErr,      setLoginErr]      = useState('');
  const [loginLoading,  setLoginLoading]  = useState(false);

  // HeroSMS
  const [balance,     setBalance]     = useState<{ balance: number } | null>(null);
  const [activations, setActivations] = useState<Activation[]>([]);
  const [loadingAct,  setLoadingAct]  = useState(true);

  // Dashboard
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [chartPeriod,  setChartPeriod]  = useState<7 | 30>(7);
  const [chartStats,   setChartStats]   = useState<{ date: string; revenue: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

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
  const [txnDateFrom, setTxnDateFrom] = useState('');
  const [txnDateTo,   setTxnDateTo]   = useState('');
  const [loadingTxns, setLoadingTxns] = useState(false);
  const [actionLoading,setActionLoading] = useState<string | null>(null);

  // Bulk action users
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkLoading,   setBulkLoading]   = useState(false);

  // Deposit notifikasi real-time
  const [depositNotifCount, setDepositNotifCount] = useState(0);
  const [lastDepositCheck,  setLastDepositCheck]  = useState(Date.now());

  // Pricing
  const [pricing,     setPricing]     = useState<PricingConfig>({ idrRate: 17135.75, markupPct: 0.25, minProfit: 200, roundTo: 100 });
  const [savingPrice, setSavingPrice] = useState(false);

  // Logs
  const [logs,        setLogs]        = useState<AdminLog[]>([]);
  const [logTotal,    setLogTotal]    = useState(0);
  const [logPage,     setLogPage]     = useState(1);

  // Detail Mutasi per User (modal)
  const [userDetailModal,    setUserDetailModal]    = useState<User | null>(null);
  const [userTxns,           setUserTxns]           = useState<Transaction[]>([]);
  const [loadingUserTxns,    setLoadingUserTxns]    = useState(false);
  const [userTxnsLoaded,     setUserTxnsLoaded]     = useState(false);

  // Refund vs Revenue chart
  const [refundChartData,    setRefundChartData]    = useState<{ date: string; revenue: number; refund: number }[]>([]);
  const [loadingRefundChart, setLoadingRefundChart] = useState(false);
  const [refundChartPeriod,  setRefundChartPeriod]  = useState<7 | 30>(7);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  // Set Saldo Modal
  const [saldoModal, setSaldoModal] = useState<{ userId: string; email: string; currentBalance: number } | null>(null);
  const [saldoInput, setSaldoInput] = useState('');
  const [saldoMode,  setSaldoMode]  = useState<'kurangi' | 'tambah' | 'set'>('kurangi');

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

  // Auth check — verifikasi token ke server, bukan cuma cek localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('admin_token');
    if (!token) { setIsCheckingAuth(false); return; }
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(r => r.json()).then(d => {
      if (d.success) setIsAuthed(true);
      else localStorage.removeItem('admin_token');
    }).catch(() => localStorage.removeItem('admin_token'))
    .finally(() => setIsCheckingAuth(false));
  }, []);

  // ── Fetchers ────────────────────────────────────────────────────────
  // Helper fetch yang otomatis kirim token — harus di atas semua fetcher lain
  const authFetch = useCallback((url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('admin_token') ?? '';
    return fetch(url, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        'Authorization': `Bearer ${token}`,
      },
    }).then(r => {
      if (r.status === 401) {
        localStorage.removeItem('admin_token');
        setIsAuthed(false);
      }
      return r;
    });
  }, []);

  const fetchBalance = useCallback(async () => {
    try { const r = await fetch('/api/balance'); setBalance(await r.json()); } catch {}
  }, []);

  const fetchActivations = useCallback(async () => {
    setLoadingAct(true);
    try { const r = await fetch('/api/activations'); setActivations(await r.json()); } catch { setActivations([]); }
    finally { setLoadingAct(false); }
  }, []);

  const fetchStats = useCallback(async () => {
    try { const r = await authFetch('/api/admin/stats'); setStats(await r.json()); } catch {}
  }, []);

  const fetchUsers = useCallback(async (p: number, s: string) => {
    setLoadingUsers(true);
    try {
      const r = await authFetch(`/api/admin/users?page=${p}&search=${encodeURIComponent(s)}`);
      const d = await r.json();
      setUsers(d.users ?? []); setUserTotal(d.total ?? 0);
    } catch {}
    finally { setLoadingUsers(false); }
  }, []);

  const fetchTxns = useCallback(async (p: number, status: string, search: string, dateFrom = '', dateTo = '') => {
    setLoadingTxns(true);
    try {
      const params = new URLSearchParams({ page: String(p), status, search });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo',   dateTo);
      const r = await authFetch(`/api/admin/transactions?${params}`);
      const d = await r.json();
      setTxns(d.transactions ?? []); setTxnTotal(d.total ?? 0);
    } catch {}
    finally { setLoadingTxns(false); }
  }, []);

  const fetchPricing = useCallback(async () => {
    try { const r = await authFetch('/api/admin/pricing'); setPricing(await r.json()); } catch {}
  }, []);

  const fetchLogs = useCallback(async (p: number) => {
    try {
      const r = await authFetch(`/api/admin/logs?page=${p}`);
      const d = await r.json();
      setLogs(d.logs ?? []); setLogTotal(d.total ?? 0);
    } catch {}
  }, []);

  const refreshAll = useCallback(() => {
    fetchBalance(); fetchActivations(); fetchStats();
    setLastRefresh(new Date());
  }, [fetchBalance, fetchActivations, fetchStats]);

  // ── Deposit notifikasi real-time (poll setiap 30 detik) ─────────
  useEffect(() => {
    if (!isAuthed) return;
    const checkDeposit = async () => {
      try {
        const r = await authFetch('/api/admin/deposit?page=1&status=pending');
        const d = await r.json();
        const count = d.total ?? 0;
        if (count > depositNotifCount && depositNotifCount !== 0) {
          showToast(`🔔 Ada ${count - depositNotifCount} deposit baru masuk!`);
        }
        setDepositNotifCount(count);
        setLastDepositCheck(Date.now());
      } catch {}
    };
    checkDeposit();
    const t = setInterval(checkDeposit, 30000);
    return () => clearInterval(t);
  }, [isAuthed]);

  // ── Bulk action users ────────────────────────────────────────────
  const handleBulkAction = async (action: 'blacklist' | 'unblacklist') => {
    if (selectedUsers.size === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all([...selectedUsers].map(userId =>
        authFetch('/api/admin/users', {
          method : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ userId, action: action === 'unblacklist' ? 'blacklist' : action, value: action !== 'unblacklist' }),
        })
      ));
      showToast(`${selectedUsers.size} user berhasil di-${action === 'blacklist' ? 'blokir' : 'aktifkan'}.`);
      setSelectedUsers(new Set());
      fetchUsers(userPage, userSearch);
    } catch { showToast('Gagal bulk action.'); }
    finally { setBulkLoading(false); }
  };

  useEffect(() => {
    if (!isAuthed) return;
    refreshAll();
    const t = setInterval(refreshAll, 15000);
    return () => clearInterval(t);
  }, [refreshAll, isAuthed]);
  useEffect(() => { if (!isAuthed) return; if (tab === 'users') fetchUsers(userPage, userSearch); }, [tab, userPage, isAuthed]);
  useEffect(() => { if (!isAuthed) return; if (tab === 'transactions') fetchTxns(txnPage, txnStatus, txnSearch, txnDateFrom, txnDateTo); }, [tab, txnPage, txnStatus, isAuthed]);
  useEffect(() => { if (!isAuthed) return; if (tab === 'pricing') fetchPricing(); }, [tab, isAuthed]);
  useEffect(() => { if (!isAuthed) return; if (tab === 'logs') fetchLogs(logPage); }, [tab, logPage, isAuthed]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    setLoginLoading(true);
    try {
      const r = await fetch('/api/admin/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ username: loginUsername, password: loginPass }),
      });
      const d = await r.json();
      if (d.success) {
        localStorage.setItem('admin_token', d.token ?? 'authed');
        setIsAuthed(true);
      } else {
        setLoginErr(d.message ?? 'Username atau password salah.');
      }
    } catch {
      setLoginErr('Gagal terhubung ke server.');
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchChartData = useCallback(async (period: 7 | 30) => {
    setLoadingChart(true);
    try {
      const r = await authFetch(`/api/admin/stats?period=${period}`);
      const d = await r.json();
      setChartStats(d.chart ?? []);
    } catch {}
    finally { setLoadingChart(false); }
  }, [authFetch]);

  const fetchUserTxns = useCallback(async (userId: string, userEmail: string) => {
    setLoadingUserTxns(true);
    setUserTxns([]);
    setUserTxnsLoaded(false);
    try {
      // FIX: 1 request saja, filter by userId di server (bukan while-loop)
      const r = await authFetch(`/api/admin/transactions?userId=${userId}&limit=50`);
      const d = await r.json();
      setUserTxns(d.transactions ?? []);
      setUserTxnsLoaded(true);
    } catch { setUserTxns([]); setUserTxnsLoaded(true); }
    finally { setLoadingUserTxns(false); }
  }, [authFetch]);

  const fetchRefundChart = useCallback(async (period: 7 | 30) => {
    setLoadingRefundChart(true);
    try {
      const r = await authFetch(`/api/admin/stats?period=${period}&refund=1`);
      const d = await r.json();
      const chart: { date: string; revenue: number; refund?: number }[] = d.refundChart ?? d.chart ?? [];
      setRefundChartData(chart.map(c => ({ date: c.date, revenue: c.revenue, refund: c.refund ?? 0 })));
    } catch {}
    finally { setLoadingRefundChart(false); }
  }, [authFetch]);

  // Init chart saat pertama login
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAuthed) { fetchChartData(7); fetchRefundChart(7); } }, [isAuthed]);

  // ── Skeleton Loading (saat cek auth) ─────────────────────────────
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col">
        {/* Header skeleton */}
        <div className="bg-white dark:bg-[#0d1020] border-b border-slate-200 dark:border-white/[0.07] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            <div className="space-y-1.5">
              <div className="w-16 h-2 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
              <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            </div>
          </div>
          <div className="w-20 h-8 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
        </div>
        <div className="flex flex-1">
          {/* Sidebar skeleton */}
          <div className="w-64 bg-white dark:bg-[#0d1020] border-r border-slate-200 dark:border-white/[0.07] p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-11 bg-slate-100 dark:bg-[#0f1320] rounded-2xl animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
            ))}
          </div>
          {/* Content skeleton */}
          <div className="flex-1 p-6 space-y-4">
            <div className="h-32 bg-slate-200 dark:bg-[#0f1320] rounded-2xl animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.07] rounded-[2rem] animate-pulse" />
              ))}
            </div>
            <div className="h-56 bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.07] rounded-[2rem] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ── Login Screen ─────────────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-4">
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
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] shadow-xl p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username */}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                    placeholder="Username admin"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white transition"
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
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white transition"
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

  const handleTxnAction = async (txn: Transaction, action: 'cancel' | 'done') => {
    setActionLoading(txn.id + action);
    try {
      const r = await authFetch('/api/admin/transactions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: txn.activation_id, action, orderId: txn.id }) });
      if ((await r.json()).success) { showToast(action === 'cancel' ? 'Order dibatalkan, saldo user direfund.' : 'Order selesai.'); fetchTxns(txnPage, txnStatus, txnSearch, txnDateFrom, txnDateTo); }
    } catch { showToast('Gagal.'); }
    finally { setActionLoading(null); }
  };

  const handleUserAction = async (userId: string, action: 'blacklist' | 'unblacklist' | 'set_balance' | 'adjust_balance', value?: any) => {
    try {
      await authFetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, action: action === 'unblacklist' ? 'blacklist' : action, value: action === 'unblacklist' ? false : (value ?? true) }) });
      showToast(action === 'blacklist' ? 'User diblokir.' : action === 'unblacklist' ? 'User dibuka blokir.' : action === 'adjust_balance' ? (value >= 0 ? `Saldo ditambah ${fmtIDR(Math.abs(value))}.` : `Saldo dikurangi ${fmtIDR(Math.abs(value))}.`) : 'Saldo diperbarui.');
      fetchUsers(userPage, userSearch);
    } catch { showToast('Gagal.'); }
  };

  const handleSavePricing = async () => {
    setSavingPrice(true);
    try {
      await authFetch('/api/admin/pricing', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pricing) });
      showToast('Konfigurasi harga disimpan!');
    } catch { showToast('Gagal menyimpan.'); }
    finally { setSavingPrice(false); }
  };

  const handleExport = async (type: string) => {
    try {
      showToast('⏳ Menyiapkan file...');
      const token = localStorage.getItem('admin_token') ?? '';
      const r = await fetch(`/api/admin/export?type=${type}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!r.ok) { showToast('❌ Gagal export, cek koneksi.'); return; }
      const blob     = await r.blob();
      const url      = URL.createObjectURL(blob);
      const a        = document.createElement('a');
      a.href         = url;
      a.download     = `${type}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('✅ Export berhasil!');
    } catch {
      showToast('❌ Gagal export.');
    }
  };

  const handleActivationAction = async (id: string, action: 'cancel' | 'done') => {
    setActionLoading(id + action);
    try {
      const r = await authFetch('/api/order', { method: 'PATCH', body: JSON.stringify({ id, action }) });
      const d = await r.json();
      if (d.success) { showToast(d.message); fetchActivations(); }
    } catch { showToast('Gagal.'); }
    finally { setActionLoading(null); }
  };

  const maxChart = Math.max(...(stats?.chart ?? []).map(c => c.revenue), 1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] transition-colors">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400 dark:text-yellow-600" /> {toast}
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-[#0d1020] border-b border-slate-200 dark:border-white/[0.07] px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 dark:bg-indigo-600 p-2 rounded-xl"><ShieldAlert className="w-5 h-5 text-white" /></div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pusat Nokos</div>
            <div className="text-base font-black text-slate-900 dark:text-white">Admin Panel</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 transition-colors">
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button onClick={() => { localStorage.removeItem('admin_token'); window.location.href = '/'; }} className="font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 px-4 py-2 rounded-2xl flex items-center gap-2 transition-colors">
            <LogOut className="w-4 h-4"/> Keluar
          </button>
        </div>
      </header>

      {/* Body: Sidebar + Content */}
      <div className="flex min-h-[calc(100vh-65px)]">

        {/* ── SIDEBAR ── */}
        <aside className="w-64 shrink-0 bg-white dark:bg-[#0d1020] border-r border-slate-200 dark:border-white/[0.07] flex flex-col sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
          <nav className="flex-1 p-3 space-y-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={"w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left " + (tab === t.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 rounded-2xl'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <span className={tab === t.id ? 'text-white' : 'text-slate-400'}>{t.icon}</span>
                <span className="flex-1">{t.label}</span>
                {t.id === 'deposit' && depositNotifCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {depositNotifCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-slate-100 dark:border-white/[0.07] space-y-1">
            <button onClick={() => { localStorage.removeItem('admin_token'); window.location.href = '/'; }} className="w-full font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 py-3 px-4 rounded-2xl flex justify-center items-center transition-colors gap-2">
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
            <div className="bg-slate-900 dark:bg-indigo-600 rounded-[2rem] p-6 flex items-center justify-between text-white">
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

            {/* ── CHART MODERN ── */}
            {(() => {
              const data    = chartStats.length > 0 ? chartStats : (stats?.chart ?? []);
              if (data.length === 0) return null;
              const maxVal  = Math.max(...(data as any[]).map((c: any) => c.revenue), 1);
              const total   = (data as any[]).reduce((s: number, c: any) => s + c.revenue, 0);
              const avgVal  = Math.round(total / data.length);
              const todayV  = (data as any[])[data.length - 1]?.revenue ?? 0;
              const yesterV = (data as any[])[data.length - 2]?.revenue ?? 0;
              const n       = data.length;

              // Nice round Y-axis max (ceil to next clean step)
              const niceMax = (() => {
                const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
                return Math.ceil(maxVal / mag) * mag;
              })();

              const Y_STEPS = 5;
              const Y_TICKS = Array.from({ length: Y_STEPS + 1 }, (_, i) => {
                const val = (niceMax / Y_STEPS) * (Y_STEPS - i);
                const lbl = val === 0 ? '0'
                  : val >= 1_000_000 ? (val / 1_000_000).toFixed(1) + 'jt'
                  : val >= 1_000 ? Math.round(val / 1_000) + 'k'
                  : String(val);
                return { val, lbl };
              });

              const W = 900, H = 260, PL = 58, PR = 16, PT = 24, PB = 40;
              const cW = W - PL - PR, cH = H - PT - PB;

              const xOf = (i: number) => PL + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
              const yOf = (rev: number) => PT + cH - Math.max(0, Math.min(niceMax, rev)) / niceMax * cH;

              const pts = (data as any[]).map((c: any, i: number) => ({
                x: xOf(i), y: yOf(c.revenue), revenue: c.revenue, date: c.date,
              }));

              // Straight-line polyline points string
              const polyline = pts.map((p: any) => `${p.x},${p.y}`).join(' ');
              // Closed area path for hatch fill
              const areaPath = `M${pts[0].x},${pts[0].y} `
                + pts.slice(1).map((p: any) => `L${p.x},${p.y}`).join(' ')
                + ` L${pts[n-1].x},${PT+cH} L${pts[0].x},${PT+cH} Z`;

              const peakIdx = pts.reduce((best: number, p: any, i: number) =>
                p.revenue > pts[best].revenue ? i : best, 0);

              return (
                <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6 md:p-8">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Revenue Chart</h3>
                      <p className="text-xs text-slate-400 mt-1">Hanya order berhasil · auto-update tiap 15 detik</p>
                    </div>
                    <div className="flex gap-1 bg-slate-100 dark:bg-[#0f1320] rounded-xl p-1 border border-slate-200 dark:border-white/[0.07]">
                      {([7, 30] as const).map(p => (
                        <button key={p}
                          onClick={() => { setChartPeriod(p); fetchChartData(p); }}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${chartPeriod === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                          {p} Hari
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mini stat row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: `Total ${chartPeriod}H`, value: fmtIDR(total),   cls: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300' },
                      { label: 'Rata-rata/Hari',         value: fmtIDR(avgVal),  cls: 'bg-slate-50 dark:bg-[#0f1320] border-slate-100 dark:border-white/[0.06] text-slate-700 dark:text-slate-200' },
                      { label: 'Kemarin',                value: fmtIDR(yesterV), cls: 'bg-slate-50 dark:bg-[#0f1320] border-slate-100 dark:border-white/[0.06] text-slate-600 dark:text-slate-300' },
                      { label: 'Hari Ini',               value: fmtIDR(todayV),  cls: todayV >= yesterV ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/40 text-green-600 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40 text-red-500 dark:text-red-300' },
                    ].map(s => (
                      <div key={s.label} className={`rounded-2xl px-4 py-3 border ${s.cls}`}>
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{s.label}</div>
                        <div className="text-sm font-black leading-tight">{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Chart */}
                  {loadingChart ? (
                    <div className="rounded-2xl bg-slate-50 dark:bg-[#080b14] overflow-hidden" style={{ height: '260px' }}>
                      <div className="h-full flex items-end gap-2 px-6 pb-6 pt-8">
                        {Array.from({ length: chartPeriod === 7 ? 7 : 14 }).map((_, i) => (
                          <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                            <div
                              className="w-full bg-slate-200 dark:bg-slate-700 rounded-t-md animate-pulse"
                              style={{ height: `${30 + Math.sin(i * 0.8) * 20 + Math.cos(i * 1.3) * 30 + 60}px`, animationDelay: `${i * 60}ms` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (() => {
                    // Build smooth cubic bezier path from pts
                    const smoothLinePath = (() => {
                      if (pts.length < 2) return pts.length === 1 ? `M${pts[0].x},${pts[0].y}` : '';
                      let d = `M${pts[0].x},${pts[0].y}`;
                      for (let i = 1; i < pts.length; i++) {
                        const prev = pts[i - 1] as any;
                        const curr = pts[i] as any;
                        const tension = 0.38;
                        const dx = (curr.x - prev.x) * tension;
                        d += ` C${prev.x + dx},${prev.y} ${curr.x - dx},${curr.y} ${curr.x},${curr.y}`;
                      }
                      return d;
                    })();
                    const smoothAreaPath = smoothLinePath
                      + ` L${pts[n-1].x},${PT+cH} L${pts[0].x},${PT+cH} Z`;
                    return (
                      // FIX ZOOM BUG: fixed height container — chart tidak ikut membesar saat zoom out
                      <div className="w-full rounded-2xl overflow-hidden bg-white dark:bg-[#080b14] border border-slate-100 dark:border-white/[0.04]"
                        style={{ height: '260px' }}>
                        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" style={{display:"block"}}>
                          <defs>
                            {/* Gradient fill — light */}
                            <linearGradient id="areaGradLight" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.22"/>
                              <stop offset="60%"  stopColor="#6366f1" stopOpacity="0.06"/>
                              <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
                            </linearGradient>
                            {/* Gradient fill — dark */}
                            <linearGradient id="areaGradDark" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%"   stopColor="#818cf8" stopOpacity="0.30"/>
                              <stop offset="60%"  stopColor="#818cf8" stopOpacity="0.08"/>
                              <stop offset="100%" stopColor="#818cf8" stopOpacity="0"/>
                            </linearGradient>
                            {/* Glow filter for peak dot */}
                            <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
                              <feGaussianBlur stdDeviation="3" result="blur"/>
                              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <clipPath id="chartClip">
                              <rect x={PL} y={PT} width={cW} height={cH} />
                            </clipPath>
                          </defs>

                          {/* Subtle horizontal grid lines + Y labels */}
                          {Y_TICKS.map((tick, i) => {
                            const y = PT + cH - (tick.val / niceMax) * cH;
                            return (
                              <g key={i}>
                                <line x1={PL} y1={y} x2={W - PR} y2={y}
                                  stroke="#e2e8f0" strokeWidth={i === Y_STEPS ? 1.5 : 0.8}
                                  strokeDasharray={i === Y_STEPS ? undefined : "4,6"}
                                  className="dark:stroke-white/[0.07]" />
                                <text x={PL - 8} y={y + 4} textAnchor="end"
                                  fill="#94a3b8" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif">
                                  {tick.lbl}
                                </text>
                              </g>
                            );
                          })}

                          {/* Smooth gradient area fill */}
                          <path d={smoothAreaPath} fill="url(#areaGradLight)" clipPath="url(#chartClip)"
                            className="dark:opacity-0" />
                          <path d={smoothAreaPath} fill="url(#areaGradDark)" clipPath="url(#chartClip)"
                            className="opacity-0 dark:opacity-100" />

                          {/* Smooth indigo line */}
                          <path
                            d={smoothLinePath}
                            fill="none"
                            stroke="#6366f1"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            clipPath="url(#chartClip)"
                            className="dark:stroke-indigo-400"
                          />

                          {/* X-axis labels */}
                          {pts.map((p: any, i: number) => {
                            const show = chartPeriod === 30 ? (i % 5 === 0 || i === n - 1) : true;
                            if (!show) return null;
                            const raw = (data as any[])[i]?.date ?? '';
                            const lbl = chartPeriod === 7 ? raw.slice(0, 3) + ',' : raw.slice(0, 5);
                            return (
                              <text key={`xl-${i}`} x={p.x} y={H - 6} textAnchor="middle"
                                fill="#94a3b8" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif">
                                {lbl}
                              </text>
                            );
                          })}

                          {/* Dots + hover tooltips */}
                          {pts.map((p: any, i: number) => {
                            const isPeak = i === peakIdx;
                            const tipW = 136, tipH = 48;
                            const tipX = Math.min(Math.max(p.x - tipW / 2, PL), W - PR - tipW);
                            const tipY = Math.max(p.y - tipH - 14, PT + 2);
                            return (
                              <g key={`dot-${i}`} className="group/dot cursor-pointer">
                                {/* Vertical dashed indicator */}
                                <line x1={p.x} y1={PT} x2={p.x} y2={PT + cH}
                                  stroke="#6366f1" strokeWidth="1" strokeDasharray="3,5"
                                  strokeOpacity="0"
                                  className="group-hover/dot:stroke-opacity-30 transition-all dark:stroke-indigo-400"
                                />
                                {/* Wide hit area */}
                                <rect x={p.x - 18} y={PT} width={36} height={cH} fill="transparent" />
                                {/* Outer glow ring on hover */}
                                <circle cx={p.x} cy={p.y} r="12" fill="#6366f1" fillOpacity="0"
                                  className="group-hover/dot:fill-opacity-[0.08] transition-all duration-150" />
                                {/* Peak dot — larger + glowing */}
                                {isPeak ? (
                                  <>
                                    <circle cx={p.x} cy={p.y} r="7" fill="#6366f1" fillOpacity="0.18"
                                      filter="url(#dotGlow)" className="dark:fill-indigo-400" />
                                    <circle cx={p.x} cy={p.y} r="4.5" fill="#6366f1"
                                      className="dark:fill-indigo-400" />
                                    <circle cx={p.x} cy={p.y} r="2" fill="white" />
                                  </>
                                ) : (
                                  <>
                                    <circle cx={p.x} cy={p.y} r="3.5" fill="white"
                                      stroke="#6366f1" strokeWidth="1.8"
                                      className="dark:fill-[#080b14] dark:stroke-indigo-400" />
                                  </>
                                )}
                                {/* Tooltip */}
                                <g transform={`translate(${tipX},${tipY})`}
                                  className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-150 pointer-events-none">
                                  <rect rx="12" width={tipW} height={tipH}
                                    fill="white" filter="drop-shadow(0 6px 18px rgba(99,102,241,0.18))"
                                    className="dark:fill-[#0d1020]" />
                                  <rect rx="12" width={tipW} height={tipH}
                                    fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.3"
                                    className="dark:stroke-indigo-500/40" />
                                  {/* Coloured top strip */}
                                  <rect rx="12" width={tipW} height="4" fill="#6366f1" fillOpacity="0.7"
                                    className="dark:fill-indigo-500" />
                                  <text x={tipW / 2} y="22" textAnchor="middle"
                                    fill="#1e293b" fontSize="11.5" fontWeight="900" fontFamily="system-ui,sans-serif"
                                    className="dark:fill-white">
                                    {fmtIDR(p.revenue)}
                                  </text>
                                  <text x={tipW / 2} y="36" textAnchor="middle"
                                    fill="#94a3b8" fontSize="9" fontWeight="600" fontFamily="system-ui,sans-serif">
                                    {p.date}
                                  </text>
                                </g>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}

            {/* ── EXPORT ── */}
            <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6">
              <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">Export Data</h3>
              <p className="text-xs text-slate-400 mb-4">Download semua data dalam format CSV</p>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => handleExport('users')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-indigo-600/30">
                  <Download className="w-4 h-4" /> Export Users CSV
                </button>
                <button onClick={() => handleExport('transactions')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-emerald-600/30">
                  <Download className="w-4 h-4" /> Export Transaksi CSV
                </button>
                <button onClick={() => handleExport('monitoring')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 active:scale-95 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-violet-600/30">
                  <Download className="w-4 h-4" /> Export Monitoring CSV
                </button>
              </div>
            </div>

            {/* ── REFUND VS REVENUE CHART ── */}
            {(() => {
              const data = refundChartData;
              if (data.length === 0) return null;
              const maxRev    = Math.max(...data.map(d => d.revenue), 1);
              const maxRefund = Math.max(...data.map(d => d.refund), 1);
              const maxVal    = Math.max(maxRev, maxRefund, 1);
              const totalRev  = data.reduce((s, d) => s + d.revenue, 0);
              const totalRef  = data.reduce((s, d) => s + d.refund, 0);
              const profit    = totalRev - totalRef;
              return (
                <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6">
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white">Revenue vs Refund</h3>
                      <p className="text-xs text-slate-400 mt-1">Perbandingan pendapatan vs total refund per hari · profit bersih sebenarnya</p>
                    </div>
                    <div className="flex gap-1 bg-slate-100 dark:bg-[#0f1320] rounded-xl p-1 border border-slate-200 dark:border-white/[0.07]">
                      {([7, 30] as const).map(p => (
                        <button key={p}
                          onClick={() => { setRefundChartPeriod(p); fetchRefundChart(p); }}
                          className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${refundChartPeriod === p ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}>
                          {p} Hari
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40 rounded-2xl px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 mb-1">Total Revenue</div>
                      <div className="text-sm font-black text-indigo-700 dark:text-indigo-300">{fmtIDR(totalRev)}</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-2xl px-4 py-3">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">Total Refund</div>
                      <div className="text-sm font-black text-red-600 dark:text-red-400">{fmtIDR(totalRef)}</div>
                    </div>
                    <div className={`border rounded-2xl px-4 py-3 ${profit >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/40' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/40'}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>Profit Bersih</div>
                      <div className={`text-sm font-black ${profit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-600 dark:text-red-400'}`}>{fmtIDR(profit)}</div>
                    </div>
                  </div>

                  {/* Grouped bar chart */}
                  {loadingRefundChart ? (
                    <div className="rounded-2xl bg-slate-50 dark:bg-[#080b14] overflow-hidden h-44">
                      <div className="h-full flex items-end gap-2 px-4 pb-4 pt-6">
                        {Array.from({ length: refundChartPeriod === 7 ? 7 : 14 }).map((_, i) => (
                          <div key={i} className="flex-1 flex items-end gap-0.5">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t-md animate-pulse"
                              style={{ height: `${25 + Math.abs(Math.sin(i * 1.1)) * 80}px`, animationDelay: `${i * 50}ms` }} />
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-t-md animate-pulse"
                              style={{ height: `${10 + Math.abs(Math.cos(i * 1.4)) * 40}px`, animationDelay: `${i * 50 + 25}ms` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Legend */}
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-indigo-500" /><span className="text-xs font-bold text-slate-500">Revenue</span></div>
                        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /><span className="text-xs font-bold text-slate-500">Refund</span></div>
                      </div>
                      <div className="overflow-x-auto">
                        <div className="flex items-end gap-2 h-44 min-w-max pb-1">
                          {data.map((d, i) => (
                            <div key={i} className="flex items-end gap-0.5 group relative">
                              {/* Tooltip */}
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-2.5 py-1.5 rounded-xl whitespace-nowrap z-10 shadow-lg text-left pointer-events-none">
                                <div className="font-black mb-0.5">{d.date}</div>
                                <div className="text-indigo-300 dark:text-indigo-600">↑ Rev: {fmtIDR(d.revenue)}</div>
                                <div className="text-red-300 dark:text-red-500">↓ Refund: {fmtIDR(d.refund)}</div>
                                <div className={d.revenue - d.refund >= 0 ? 'text-green-300 dark:text-green-600' : 'text-red-300 dark:text-red-500'}>
                                  = Profit: {fmtIDR(d.revenue - d.refund)}
                                </div>
                              </div>
                              {/* Revenue bar */}
                              <div className="w-5 bg-indigo-500 dark:bg-indigo-400 rounded-t-md hover:bg-indigo-400 dark:hover:bg-indigo-300 transition-colors cursor-pointer"
                                style={{ height: `${Math.max(3, (d.revenue / maxVal) * 160)}px` }} />
                              {/* Refund bar */}
                              <div className="w-5 bg-red-400 dark:bg-red-500 rounded-t-md hover:bg-red-300 dark:hover:bg-red-400 transition-colors cursor-pointer"
                                style={{ height: `${Math.max(d.refund > 0 ? 3 : 0, (d.refund / maxVal) * 160)}px` }} />
                            </div>
                          ))}
                        </div>
                        {/* X-axis labels */}
                        <div className="flex items-start gap-2 mt-1 min-w-max">
                          {data.map((d, i) => (
                            <div key={i} className="w-[42px] text-[8px] font-bold text-slate-400 text-center truncate">{d.date.split(' ')[0]}</div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ── AKTIVASI LIVE ── */}
        {tab === 'activations' && (
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
            {loadingAct ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <tr>{['ID','Nomor','Layanan','Status','OTP','Harga','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}>
                        <td className="px-5 py-4"><div className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                        <td className="px-5 py-4"><div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                        <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                        <td className="px-5 py-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                        <td className="px-5 py-4"><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                        <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                        <td className="px-5 py-4"><div className="h-7 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : activations.length === 0 ? (
              <div className="p-12 text-center text-slate-400"><Signal className="w-8 h-8 mx-auto mb-2 opacity-30" /><div className="font-bold">Tidak ada aktivasi aktif</div></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                    <tr>{['ID','Nomor','Layanan','Status','OTP','Harga','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {activations.map(a => (
                      <tr key={a.activationId} className="hover:bg-indigo-50/40 dark:hover:bg-white/[0.05]/40 transition-colors">
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
                              <button onClick={() => handleActivationAction(a.activationId, 'cancel')} disabled={!!actionLoading} className="px-2.5 py-1.5 bg-slate-100 dark:bg-[#0f1320] hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-bold disabled:opacity-50 border border-slate-200 dark:border-white/[0.09] flex items-center gap-1">
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
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input value={txnSearch} onChange={e => setTxnSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchTxns(1, txnStatus, txnSearch, txnDateFrom, txnDateTo)} placeholder="Cari nomor HP atau email..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white" />
              </div>
              {/* ── Custom Status Dropdown ── */}
              <StatusDropdown value={txnStatus} onChange={v => { setTxnStatus(v); fetchTxns(1, v, txnSearch, txnDateFrom, txnDateTo); }} />
              {/* Filter tanggal */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <input type="date" value={txnDateFrom} onChange={e => setTxnDateFrom(e.target.value)} className="px-3 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none dark:text-white dark:[color-scheme:dark]" title="Dari tanggal" />
                </div>
                <span className="text-slate-400 text-xs font-bold shrink-0">s/d</span>
                <div className="relative">
                  <input type="date" value={txnDateTo} onChange={e => setTxnDateTo(e.target.value)} className="px-3 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none dark:text-white dark:[color-scheme:dark]" title="Sampai tanggal" />
                </div>
                <button onClick={() => fetchTxns(1, txnStatus, txnSearch, txnDateFrom, txnDateTo)} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shrink-0">Filter</button>
                {(txnDateFrom || txnDateTo) && (
                  <button onClick={() => { setTxnDateFrom(''); setTxnDateTo(''); fetchTxns(1, txnStatus, txnSearch, '', ''); }} className="px-3 py-2.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors shrink-0">Reset</button>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
              {loadingTxns ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>{['User','Layanan','Nomor','Harga','Status','Waktu','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-5 py-4 space-y-1.5"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /><div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-7 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>{['User','Layanan','Nomor','Harga','Status','Waktu','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {txns.length === 0 ? <tr><td colSpan={7} className="py-16 text-center text-slate-400 font-bold">Tidak ada data</td></tr> : txns.map(t => (
                        <tr key={t.id} className="hover:bg-indigo-50/40 dark:hover:bg-white/[0.05]/40 transition-colors">
                          <td className="px-5 py-4"><div className="font-bold text-sm dark:text-white">{(t.profiles as any)?.name ?? '—'}</div><div className="text-xs text-slate-400">{(t.profiles as any)?.email ?? ''}</div></td>
                          <td className="px-5 py-4 font-bold text-sm uppercase dark:text-white">{t.service_name}</td>
                          <td className="px-5 py-4"><div className="flex items-center font-mono text-sm dark:text-white">{t.phone}<CopyBtn text={t.phone} /></div></td>
                          <td className="px-5 py-4 font-bold text-sm dark:text-white">{fmtIDR(t.price)}</td>
                          <td className="px-5 py-4">
                            <StatusBadge status={t.status} />
                            {(t.status === 'cancelled' || t.status === 'expired') && (
                              <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-md text-[10px] font-black text-green-600 dark:text-green-400">
                                ↩ Saldo dikembalikan
                              </div>
                            )}
                          </td>
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
              <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
                <span className="text-xs text-slate-400">Total: {txnTotal} transaksi</span>
                <div className="flex gap-2">
                  <button onClick={() => { const p = Math.max(1, txnPage-1); setTxnPage(p); fetchTxns(p, txnStatus, txnSearch, txnDateFrom, txnDateTo); }} disabled={txnPage === 1} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">← Prev</button>
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {txnPage}</span>
                  <button onClick={() => { const p = txnPage+1; setTxnPage(p); fetchTxns(p, txnStatus, txnSearch, txnDateFrom, txnDateTo); }} disabled={txns.length < 20} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">Next →</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <>
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers(1, userSearch)} placeholder="Cari email..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white" />
              </div>
              <button onClick={() => fetchUsers(1, userSearch)} className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">Cari</button>
            </div>

            {/* Bulk action bar */}
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3">
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex-1">{selectedUsers.size} user dipilih</span>
                <button onClick={() => handleBulkAction('blacklist')} disabled={bulkLoading} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1">
                  {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />} Blokir Semua
                </button>
                <button onClick={() => handleBulkAction('unblacklist')} disabled={bulkLoading} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1">
                  {bulkLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />} Aktifkan Semua
                </button>
                <button onClick={() => setSelectedUsers(new Set())} className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-300 transition-colors">Batal</button>
              </div>
            )}

            <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
              {loadingUsers ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>
                        <th className="px-5 py-4 w-10" />
                        {['User','Saldo','Order','Total Spend','Status','Terdaftar','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-5 py-4"><div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4 space-y-1.5"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /><div className="h-2.5 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-5 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-4"><div className="flex gap-1.5"><div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /><div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /><div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>
                        <th className="px-5 py-4 w-10">
                          <input type="checkbox" className="rounded"
                            checked={users.length > 0 && users.every(u => selectedUsers.has(u.id))}
                            onChange={e => {
                              if (e.target.checked) setSelectedUsers(new Set(users.map(u => u.id)));
                              else setSelectedUsers(new Set());
                            }}
                          />
                        </th>
                        {['User','Saldo','Order','Total Spend','Status','Terdaftar','Aksi'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {users.length === 0 ? <tr><td colSpan={8} className="py-16 text-center text-slate-400 font-bold">Tidak ada user</td></tr> : users.map(u => (
                        <tr key={u.id} className={"hover:bg-indigo-50/40 dark:hover:bg-white/[0.05]/40 transition-colors " + (u.is_blacklisted ? 'opacity-50' : '') + (selectedUsers.has(u.id) ? ' bg-indigo-50/50 dark:bg-indigo-900/10' : '')}>
                          <td className="px-5 py-4">
                            <input type="checkbox" className="rounded"
                              checked={selectedUsers.has(u.id)}
                              onChange={e => {
                                const next = new Set(selectedUsers);
                                if (e.target.checked) next.add(u.id); else next.delete(u.id);
                                setSelectedUsers(next);
                              }}
                            />
                          </td>
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
                              <button onClick={() => { setSaldoModal({ userId: u.id, email: u.email, currentBalance: u.balance }); setSaldoInput(''); setSaldoMode('kurangi'); }} className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold border border-indigo-200 flex items-center gap-1"><Wallet className="w-3 h-3" /> Saldo</button>
                              <button onClick={() => { setUserDetailModal(u); fetchUserTxns(u.id, u.email); }} className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-700 text-slate-600 hover:text-white rounded-lg text-xs font-bold border border-slate-200 flex items-center gap-1"><FileText className="w-3 h-3" /> Mutasi</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
                <span className="text-xs text-slate-400">Total: {userTotal} user</span>
                <div className="flex gap-2">
                  <button onClick={() => { const p = Math.max(1, userPage-1); setUserPage(p); fetchUsers(p, userSearch); }} disabled={userPage === 1} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">← Prev</button>
                  <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {userPage}</span>
                  <button onClick={() => { const p = userPage+1; setUserPage(p); fetchUsers(p, userSearch); }} disabled={users.length < 20} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">Next →</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── PRICING ── */}
        {tab === 'pricing' && (
          <div className="max-w-xl space-y-6">
            <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6 space-y-5">
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
                      className="flex-1 px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-bold dark:text-white"
                    />
                    <span className="text-xs text-slate-400 font-bold w-20">{f.suffix}</span>
                  </div>
                </div>
              ))}

              {/* Preview */}
              <div className="bg-slate-50 dark:bg-[#0f1320] rounded-xl p-4 text-sm">
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
        {tab === 'deposit' && <DepositTab showToast={showToast} isAuthed={isAuthed} />}

        {/* ── REVENUE ── */}
        {tab === 'revenue' && <RevenueTab isAuthed={isAuthed} />}

        {/* ── OVERRIDE HARGA ── */}
        {tab === 'override' && <OverridePricingTab showToast={showToast} />}

        {/* ── ROLE ADMIN ── */}
        {tab === 'admins' && <AdminRolesTab showToast={showToast} />}
        {tab === 'broadcast' && <BroadcastTab showToast={showToast} />}
        {tab === 'notice' && <NoticeBoardTab showToast={showToast} />}
        {tab === 'blacklist' && <BlacklistHistoryTab showToast={showToast} />}

        {/* ── MONITORING ── */}
        {tab === 'monitoring' && <MonitoringTab showToast={showToast} />}

        {tab === 'logs' && (
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                  <tr>{['Aksi','Target','Detail','Waktu'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                  {logs.length === 0 ? <tr><td colSpan={4} className="py-16 text-center text-slate-400 font-bold">Belum ada log</td></tr> : logs.map(l => (
                    <tr key={l.id} className="hover:bg-indigo-50/40 dark:hover:bg-white/[0.05]/40 transition-colors">
                      <td className="px-5 py-4"><span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-xs font-black uppercase">{l.action.replace(/_/g, ' ')}</span></td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-500">{l.target_id}</td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{l.details}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
              <span className="text-xs text-slate-400">Total: {logTotal} log</span>
              <div className="flex gap-2">
                <button onClick={() => { const p = Math.max(1, logPage-1); setLogPage(p); fetchLogs(p); }} disabled={logPage === 1} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">← Prev</button>
                <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {logPage}</span>
                <button onClick={() => { const p = logPage+1; setLogPage(p); fetchLogs(p); }} disabled={logs.length < 30} className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">Next →</button>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>

      {/* ── Modal Detail Mutasi User ─────────────────────────────────── */}
      {userDetailModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setUserDetailModal(null)}>
          <div className="bg-white dark:bg-[#0d1020] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-2xl">
                  <FileText className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Riwayat Mutasi</h2>
                  <p className="text-xs text-slate-400">{userDetailModal.name} · {userDetailModal.email}</p>
                </div>
              </div>
              <button onClick={() => setUserDetailModal(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            {/* Summary strip */}
            <div className="grid grid-cols-3 gap-3 p-4 shrink-0 border-b border-slate-100 dark:border-white/[0.07]">
              <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl px-3 py-2.5 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Saldo</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{fmtIDR(userDetailModal.balance)}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl px-3 py-2.5 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Order</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{userDetailModal.orderCount}</div>
              </div>
              <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl px-3 py-2.5 text-center">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Spend</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{fmtIDR(userDetailModal.totalSpend)}</div>
              </div>
            </div>
            {/* Transaction list */}
            <div className="flex-1 overflow-y-auto">
              {loadingUserTxns && userTxns.length === 0 ? (
                <div className="p-4">
                  <div className="px-5 py-2.5 mb-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl">
                    <div className="h-3 w-40 bg-amber-200 dark:bg-amber-800 rounded animate-pulse" />
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-[#080b14] border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                      <tr>{['Layanan','Nomor','Harga','Status','Waktu'].map(h => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-5 py-3"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-3"><div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-3"><div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                          <td className="px-5 py-3"><div className="h-5 w-18 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                          <td className="px-5 py-3"><div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : userTxns.length === 0 && userTxnsLoaded ? (
                <div className="p-12 text-center text-slate-400 font-bold">Belum ada transaksi untuk user ini</div>
              ) : (
                <>
                  <div className={`px-5 py-2.5 border-b text-xs font-black flex items-center gap-2 ${loadingUserTxns ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/40 text-amber-600 dark:text-amber-400' : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400'}`}>
                    {loadingUserTxns && <RefreshCw className="w-3 h-3 animate-spin" />}
                    {loadingUserTxns
                      ? `Memuat... ${userTxns.length} transaksi ditemukan sejauh ini`
                      : `✓ ${userTxns.length} transaksi (data lengkap dari awal)`}
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black sticky top-0">
                      <tr>{['Layanan','Nomor','Harga','Status','Waktu'].map(h => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                      {userTxns.map(t => (
                        <tr key={t.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-5 py-3 font-bold text-xs uppercase dark:text-white">{t.service_name}</td>
                          <td className="px-5 py-3"><div className="flex items-center font-mono text-xs dark:text-white">{t.phone}<CopyBtn text={t.phone} /></div></td>
                          <td className="px-5 py-3 font-bold text-xs dark:text-white">{fmtIDR(t.price)}</td>
                          <td className="px-5 py-3"><StatusBadge status={t.status} /></td>
                          <td className="px-5 py-3 text-[11px] text-slate-400">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Koreksi Saldo ───────────────────────────────────────── */}
      {saldoModal && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSaldoModal(null)}>
          <div className="bg-white dark:bg-[#0d1020] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/[0.07] w-full max-w-sm" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07]">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-2xl">
                  <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">Koreksi Saldo</h2>
                  <p className="text-xs text-slate-400 truncate max-w-[180px]">{saldoModal.email}</p>
                </div>
              </div>
              <button onClick={() => setSaldoModal(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 transition-colors">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Saldo saat ini */}
            <div className="mx-6 mt-5 bg-slate-50 dark:bg-[#0f1320] rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Saldo Saat Ini</span>
              <span className="font-black text-slate-900 dark:text-white">{fmtIDR(saldoModal.currentBalance)}</span>
            </div>

            {/* Mode tabs */}
            <div className="px-6 pt-4">
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl p-1">
                {([
                  { id: 'kurangi', label: '− Kurangi', color: 'text-red-600 dark:text-red-400' },
                  { id: 'tambah',  label: '+ Tambah',  color: 'text-green-600 dark:text-green-400' },
                  { id: 'set',     label: '= Set',      color: 'text-indigo-600 dark:text-indigo-400' },
                ] as const).map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSaldoMode(m.id); setSaldoInput(''); }}
                    className={`py-2 rounded-lg text-xs font-black transition-all ${saldoMode === m.id ? `bg-white dark:bg-slate-700 shadow-sm ${m.color}` : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Label konteks */}
              <p className="text-xs text-slate-400 mt-2 mb-3">
                {saldoMode === 'kurangi' && '⚠️ Tarik balik saldo yang salah diisi. Saldo akan dikurangi sebesar nominal.'}
                {saldoMode === 'tambah'  && '✅ Tambah saldo manual ke akun user.'}
                {saldoMode === 'set'     && '🔒 Set saldo ke nilai absolut (hati-hati, akan override saldo saat ini).'}
              </p>
            </div>

            <div className="px-6 pb-4 space-y-3">
              {/* Input nominal */}
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">
                  {saldoMode === 'kurangi' ? 'Nominal yang Dikurangi' : saldoMode === 'tambah' ? 'Nominal yang Ditambahkan' : 'Saldo Baru (Absolut)'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-sm font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    min="0"
                    autoFocus
                    value={saldoInput}
                    onChange={e => setSaldoInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && saldoInput && !isNaN(parseInt(saldoInput))) {
                        const val = parseInt(saldoInput);
                        if (saldoMode === 'set') {
                          handleUserAction(saldoModal.userId, 'set_balance', val);
                        } else {
                          const delta = saldoMode === 'kurangi' ? -val : val;
                          const newBal = Math.max(0, saldoModal.currentBalance + delta);
                          handleUserAction(saldoModal.userId, 'set_balance', newBal);
                        }
                        setSaldoModal(null);
                      }
                    }}
                    placeholder="0"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-base font-bold dark:text-white"
                  />
                </div>

                {/* Preview hasil */}
                {saldoInput && !isNaN(parseInt(saldoInput)) && (() => {
                  const val = parseInt(saldoInput);
                  const result = saldoMode === 'set'
                    ? val
                    : saldoMode === 'kurangi'
                    ? Math.max(0, saldoModal.currentBalance - val)
                    : saldoModal.currentBalance + val;
                  const diff = result - saldoModal.currentBalance;
                  return (
                    <div className={`mt-2 flex items-center justify-between text-xs font-bold rounded-xl px-3 py-2 ${diff < 0 ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : diff > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-slate-50 dark:bg-[#0f1320] text-slate-500'}`}>
                      <span>Saldo baru</span>
                      <span>{fmtIDR(result)} {diff !== 0 && `(${diff > 0 ? '+' : ''}${fmtIDR(diff)})`}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-1.5">
                {[10000, 25000, 50000, 100000].map(n => (
                  <button key={n} onClick={() => setSaldoInput(String(n))}
                    className={`py-2 text-xs font-bold rounded-xl transition-colors ${saldoInput === String(n) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-[#0f1320] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-400'}`}>
                    {(n/1000)}rb
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] flex gap-3">
              <button onClick={() => setSaldoModal(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors">
                Batal
              </button>
              <button
                onClick={() => {
                  if (saldoInput && !isNaN(parseInt(saldoInput))) {
                    const val = parseInt(saldoInput);
                    if (saldoMode === 'set') {
                      handleUserAction(saldoModal.userId, 'set_balance', val);
                    } else {
                      const delta = saldoMode === 'kurangi' ? -val : val;
                      const newBal = Math.max(0, saldoModal.currentBalance + delta);
                      handleUserAction(saldoModal.userId, 'set_balance', newBal);
                    }
                    setSaldoModal(null);
                  }
                }}
                disabled={!saldoInput || isNaN(parseInt(saldoInput))}
                className={`flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${saldoMode === 'kurangi' ? 'bg-red-500 hover:bg-red-600' : saldoMode === 'tambah' ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {saldoMode === 'kurangi' ? '− Kurangi Saldo' : saldoMode === 'tambah' ? '+ Tambah Saldo' : '= Set Saldo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DEPOSIT TAB ──────────────────────────────────────────────────────
function DepositTab({ showToast, isAuthed }: { showToast: (msg: string) => void; isAuthed: boolean }) {

  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}` } });
  };
  const [requests,     setRequests]     = useState<any[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading,      setLoading]      = useState(false);
  const [actionLoading,setActionLoading]= useState<number | null>(null);
  const [rejectNote,   setRejectNote]   = useState('');
  const [rejectId,     setRejectId]     = useState<number | null>(null);
  const [proofModal,   setProofModal]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');

  const fetchRequests = async (p: number, status: string, q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), status });
      if (q) params.set('search', q);
      const r = await authFetch(`/api/admin/deposit?${params}`);
      const d = await r.json();
      setRequests(d.requests ?? []);
      setTotal(d.total ?? 0);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (!isAuthed) return; fetchRequests(page, statusFilter, search); }, [page, statusFilter, isAuthed]);

  const handleAction = async (requestId: number, action: 'approve' | 'reject') => {
    setActionLoading(requestId);
    try {
      const r = await authFetch('/api/admin/deposit', {
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
            <button onClick={() => setProofModal(null)} className="absolute -top-3 -right-3 bg-white dark:bg-[#0f1320] rounded-full p-2 shadow-lg">
              <XCircle className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setRejectId(null)}>
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] p-8 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-white/[0.07]" onClick={e => e.stopPropagation()}>
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
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-500/50 dark:text-white resize-none h-24 mb-5"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectId(null); setRejectNote(''); }} className="flex-1 py-3.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-white/[0.09] transition-colors">
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

      {/* Filter tabs + Search — sama dengan pola Riwayat Blokir */}
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
              : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-400 dark:hover:border-indigo-500')}
          >
            {s.label}
            {s.key === 'pending' && pendingCount > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchRequests(1, statusFilter, search)}
            placeholder="Cari nama atau email user..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white"
          />
        </div>
        <button
          onClick={() => { setPage(1); fetchRequests(1, statusFilter, search); }}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
        >Cari</button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading && requests.length === 0 ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                      <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                      <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    </div>
                    <div className="flex gap-4">
                      <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-9 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                    <div className="h-9 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-12 text-center text-slate-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <div className="font-bold">Tidak ada request deposit</div>
          </div>
        ) : requests.map((r: any) => {
          const cfg     = STATUS_CFG[r.status] ?? STATUS_CFG['pending'];
          const profile = r.profiles as any;
          return (
            <div key={r.id} className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5 sm:p-6 transition-colors">
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
                    <span className="flex items-center gap-1">
                      {r.method?.startsWith('crypto') ? '🪙' : '📱'}
                      {r.method?.startsWith('crypto')
                        ? `Crypto (${r.method.replace('crypto_', '').toUpperCase()})`
                        : r.bank_name ?? r.method ?? 'Transfer'}
                    </span>
                    <span>🕐 {new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.note && <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0f1320] px-3 py-2 rounded-xl">📝 {r.note}</div>}
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
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-[#0f1320] hover:bg-slate-200 dark:hover:bg-white/[0.09] text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
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
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.09] rounded-xl text-xs font-bold disabled:opacity-50 hover:border-indigo-300 transition-colors dark:text-slate-300">
              ← Prev
            </button>
            <span className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400">Hal {page}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={requests.length < 20} className="px-4 py-2 bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.09] rounded-xl text-xs font-bold disabled:opacity-50 hover:border-indigo-300 transition-colors dark:text-slate-300">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── REVENUE TAB ──────────────────────────────────────────────────────
function RevenueTab({ isAuthed }: { isAuthed: boolean }) {

  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}` } });
  };
  const [period,   setPeriod]   = useState<'7d' | '30d' | '90d'>('30d');
  const [data,     setData]     = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [summary,  setSummary]  = useState({ total: 0, avgPerDay: 0, bestDay: '', bestAmount: 0, totalOrders: 0 });
  const [topSvcs,  setTopSvcs]  = useState<{ name: string; count: number; revenue: number }[]>([]);
  const [loading,  setLoading]  = useState(true);

  const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  const fetchRevenue = async (p: string) => {
    setLoading(true);
    try {
      const r = await authFetch(`/api/admin/revenue?period=${p}`);
      const d = await r.json();
      setData(d.chart ?? []);
      setSummary(d.summary ?? { total: 0, avgPerDay: 0, bestDay: '', bestAmount: 0, totalOrders: 0 });
      setTopSvcs(d.topServices ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (!isAuthed) return; fetchRevenue(period); }, [period, isAuthed]);

  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {[['7d','7 Hari'], ['30d','30 Hari'], ['90d','90 Hari']].map(([k, l]) => (
          <button key={k} onClick={() => setPeriod(k as any)} className={"px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all " + (period === k ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-400 dark:hover:border-indigo-500')}>
            {l}
          </button>
        ))}
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-xl">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Revenue</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{fmtIDR(summary.total)}</div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">periode {period.replace('d',' hari')}</div>
        </div>

        {/* Rata-rata/Hari */}
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-2.5 rounded-xl">
              <BarChart2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Rata-rata/Hari</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{fmtIDR(summary.avgPerDay)}</div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">per hari rata-rata</div>
        </div>

        {/* Total Order */}
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-50 dark:bg-amber-900/30 p-2.5 rounded-xl">
              <ShoppingCart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Order</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{summary.totalOrders} <span className="text-base font-bold text-slate-400">order</span></div>
          <div className="text-[10px] text-slate-400 font-medium mt-1">transaksi berhasil</div>
        </div>

        {/* Hari Terbaik */}
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-2.5 rounded-xl">
              <Zap className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Hari Terbaik</span>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">{summary.bestDay || '—'}</div>
          {summary.bestAmount > 0 && (
            <div className="text-xs text-green-600 dark:text-green-400 font-black mt-1">{fmtIDR(summary.bestAmount)}</div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6">
        <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6">Revenue per Hari</h3>
        {loading ? (
          <div className="rounded-2xl bg-slate-50 dark:bg-[#0f1320] overflow-hidden h-40">
            <div className="h-full flex items-end gap-1.5 px-4 pb-4 pt-6">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-t-md animate-pulse"
                  style={{ height: `${20 + Math.abs(Math.sin(i * 0.9)) * 90}px`, animationDelay: `${i * 40}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1.5 h-48 min-w-max">
              {data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-1 w-8 group relative">
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

      {/* ── Top Layanan ── */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-50 dark:bg-amber-900/30 p-2.5 rounded-xl">
            <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Top Layanan</h3>
        </div>
        <div className="space-y-4">
          {topSvcs.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-6">Belum ada data</div>
          ) : topSvcs.map((s, i) => {
            const pct = Math.min(100, (s.revenue / (topSvcs[0]?.revenue || 1)) * 100);

            // Medal config: gold / silver / bronze / the rest
            const medal = i === 0
              ? { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/50', bar: 'from-amber-400 to-yellow-500', rev: 'text-amber-600 dark:text-amber-400', label: '🥇' }
              : i === 1
              ? { bg: 'bg-slate-100 dark:bg-white/[0.06]', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-white/[0.09]', bar: 'from-slate-400 to-slate-500', rev: 'text-slate-600 dark:text-slate-300', label: '🥈' }
              : i === 2
              ? { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50', bar: 'from-orange-400 to-amber-600', rev: 'text-orange-600 dark:text-orange-400', label: '🥉' }
              : { bg: 'bg-slate-50 dark:bg-[#0f1320]', text: 'text-slate-500 dark:text-slate-500', border: 'border-slate-100 dark:border-white/[0.05]', bar: 'from-indigo-500 to-indigo-600', rev: 'text-indigo-600 dark:text-indigo-400', label: `#${i+1}` };

            return (
              <div key={i} className="flex items-center gap-4">
                {/* Rank badge */}
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-black border shrink-0 ${medal.bg} ${medal.text} ${medal.border}`}>
                  {i < 3 ? medal.label : <span className="text-xs">{medal.label}</span>}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate mr-3">{s.name}</span>
                    <span className={`text-sm font-black shrink-0 ${medal.rev}`}>{fmtIDR(s.revenue)}</span>
                  </div>
                  {/* Gradient progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-[#0f1320] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full bg-gradient-to-r ${medal.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400 font-medium">{s.count} order</span>
                    <span className="text-[10px] text-slate-400 font-medium">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── OVERRIDE HARGA TAB ───────────────────────────────────────────────
const OVERRIDE_COUNTRIES = [
  { id: '6',   label: '🇮🇩 Indonesia' },
  { id: '7',   label: '🇲🇾 Malaysia' },
  { id: '12',  label: '🇺🇸 USA' },
  { id: '16',  label: '🇬🇧 UK' },
  { id: '52',  label: '🇹🇭 Thailand' },
  { id: '10',  label: '🇻🇳 Vietnam' },
  { id: '4',   label: '🇵🇭 Philippines' },
  { id: '0',   label: '🇷🇺 Russia' },
  { id: '22',  label: '🇮🇳 India' },
  { id: '43',  label: '🇩🇪 Germany' },
  { id: '73',  label: '🇧🇷 Brazil' },
  { id: '135', label: '🇸🇬 Singapore' },
  { id: '133', label: '🇦🇺 Australia' },
  { id: '132', label: '🇯🇵 Japan' },
];

function OverridePricingTab({ showToast }: { showToast: (msg: string) => void }) {

  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}` } });
  };
  const [overrides,      setOverrides]      = useState<Record<string, number>>({});
  const [allServices,    setAllServices]    = useState<{ code: string; name: string; price: number }[]>([]);
  const [search,         setSearch]         = useState('');
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [edited,         setEdited]         = useState<Record<string, number>>({});
  const [selectedCountry,setSelectedCountry]= useState('6');

  const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  // key unik per negara + layanan
  const overrideKey = (code: string) => `${selectedCountry}_${code}`;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setEdited({});
      try {
        const [svcRes, ovRes] = await Promise.all([
          fetch(`/api/services?country=${selectedCountry}&operator=0`),
          authFetch('/api/admin/pricing/overrides'),
        ]);
        const svcs = await svcRes.json();
        const ovs  = await ovRes.json();
        setAllServices(svcs ?? []);
        setOverrides(ovs ?? {});
      } catch {}
      finally { setLoading(false); }
    };
    fetchData();
  }, [selectedCountry]);

  // Filter by search
  const services = search
    ? allServices.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase()))
    : allServices;

  const handleSave = async () => {
    setSaving(true);
    try {
      const r = await authFetch('/api/admin/pricing/overrides', {
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
    const key = overrideKey(code);
    const newOv = { ...overrides };
    delete newOv[key];
    setOverrides(newOv);
    const newEd = { ...edited };
    delete newEd[key];
    setEdited(newEd);
    await authFetch('/api/admin/pricing/overrides', {
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
          <p className="text-xs text-slate-400 mt-1">Tetapkan harga khusus untuk layanan & negara tertentu. Kosongkan untuk pakai harga markup global. Total: {allServices.length} layanan</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Country selector */}
          <div className="relative">
            <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white appearance-none cursor-pointer"
            >
              {OVERRIDE_COUNTRIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari layanan..." className="pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white w-48" />
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
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                <tr>
                  <th className="px-5 py-4">Layanan</th>
                  <th className="px-5 py-4">Harga Default</th>
                  <th className="px-5 py-4">Harga Override</th>
                  <th className="px-5 py-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3 space-y-1.5"><div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /><div className="h-2.5 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-8 w-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" /></td>
                    <td className="px-5 py-3"><div className="h-7 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black sticky top-0">
                <tr>
                  <th className="px-5 py-4">Layanan ({services.length})</th>
                  <th className="px-5 py-4">Harga Default</th>
                  <th className="px-5 py-4">Harga Override</th>
                  <th className="px-5 py-4">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {services.map(s => {
                  const key = overrideKey(s.code);
                  const hasOverride = overrides[key] !== undefined || edited[key] !== undefined;
                  const currentOverride = edited[key] ?? overrides[key] ?? '';
                  return (
                    <tr key={s.code} className={"hover:bg-indigo-50/40 dark:hover:bg-white/[0.05]/40 transition-colors " + (hasOverride ? 'bg-amber-50/30 dark:bg-amber-900/10' : '')}>
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
                            onChange={e => setEdited(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                            className={"pl-8 pr-3 py-2 border rounded-xl text-sm font-bold outline-none w-36 transition-colors " + (hasOverride ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600 text-amber-700 dark:text-amber-400' : 'border-slate-200 dark:border-white/[0.09] bg-slate-50 dark:bg-[#0f1320] dark:text-white focus:border-indigo-500')}
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

  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}` } });
  };
  const [admins,     setAdmins]     = useState<any[]>([]);
  const [users,      setUsers]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showAdd,    setShowAdd]    = useState(false);
  const [addMode,    setAddMode]    = useState<'existing' | 'new'>('existing');
  const [form,       setForm]       = useState({ email: '', name: '', role: 'moderator', password: '' });
  const [userSearch, setUserSearch] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const ROLES: Record<string, { label: string; color: string; bg: string; border: string; perms: string[] }> = {
    superadmin: { label: 'Super Admin', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800/50', perms: ['Semua akses'] },
    admin     : { label: 'Admin',       color: 'text-indigo-700 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800/50', perms: ['Approve deposit', 'Kelola user', 'Lihat semua data'] },
    moderator : { label: 'Moderator',   color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20',    border: 'border-blue-200 dark:border-blue-800/50',    perms: ['Approve deposit', 'Lihat transaksi'] },
    viewer    : { label: 'Viewer',      color: 'text-slate-600 dark:text-slate-400',  bg: 'bg-slate-50 dark:bg-[#0f1320]',     border: 'border-slate-200 dark:border-white/[0.09]',     perms: ['Lihat dashboard saja'] },
  };

  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/api/admin/roles');
      const d = await r.json();
      setAdmins(d ?? []);
    } catch {}
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const r = await authFetch('/api/admin/users?limit=100');
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
      const r = await authFetch('/api/admin/roles', {
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
      const r = await authFetch('/api/admin/roles', {
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
    await authFetch('/api/admin/roles', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    showToast('Admin dihapus.');
    setDeleteConfirm(null);
    fetchAdmins();
  };

  const handleChangeRole = async (id: string, role: string) => {
    await authFetch('/api/admin/roles', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    showToast('Role diubah.');
    fetchAdmins();
  };

  const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white";

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
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white">Tambah Admin</h3>
            {/* Mode toggle */}
            <div className="flex gap-1 bg-slate-100 dark:bg-[#0f1320] rounded-xl p-1">
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
                <button key={k} onClick={() => setForm(p => ({...p, role: k}))} className={"px-4 py-2 rounded-xl text-xs font-black border-2 transition-all " + (form.role === k ? `${v.bg} ${v.border} ${v.color}` : 'border-slate-200 dark:border-white/[0.09] text-slate-400 hover:border-slate-300')}>
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
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Cari nama atau email user..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl text-sm font-medium outline-none dark:text-white" />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 text-sm font-bold">Tidak ada user ditemukan</div>
                ) : filteredUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-4">
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
                <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
                <button onClick={handleAddNew} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null} Buat & Tambah Admin
                </button>
              </div>
            </div>
          )}

          {addMode === 'existing' && (
            <button onClick={() => setShowAdd(false)} className="w-full py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
          )}
        </div>
      )}

      {/* Admin list */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-2.5 w-40 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-bold">Belum ada admin terdaftar.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
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
                    <button onClick={() => setDeleteConfirm({ id: a.id, name: a.name })} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal Konfirmasi Hapus Admin ─────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white dark:bg-[#0d1020] rounded-3xl shadow-2xl border border-slate-200 dark:border-white/[0.07] w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-4 mb-5">
              <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-2xl shrink-0">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">Hapus Admin</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Aksi ini tidak dapat dibatalkan</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#0f1320] rounded-2xl px-4 py-3 mb-5">
              Yakin ingin menghapus <span className="font-bold text-slate-900 dark:text-white">{deleteConfirm.name}</span> dari daftar admin?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm">
                Batal
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl transition-colors text-sm">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ─── BROADCAST TAB ────────────────────────────────────────────────────
function BroadcastTab({ showToast }: { showToast: (msg: string) => void }) {

  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
  };

  const [title,    setTitle]    = useState('');
  const [message,  setMessage]  = useState('');
  const [type,     setType]     = useState<'info' | 'warning' | 'promo' | 'maintenance'>('info');
  const [sending,  setSending]  = useState(false);
  const [history,  setHistory]  = useState<any[]>([]);
  const [loadHist, setLoadHist] = useState(true);

  const TYPE_CFG = {
    info        : { label: 'Info',        emoji: 'ℹ️',  color: 'bg-blue-50 border-blue-200 text-blue-700' },
    promo       : { label: 'Promo',       emoji: '🎉',  color: 'bg-green-50 border-green-200 text-green-700' },
    warning     : { label: 'Peringatan',  emoji: '⚠️',  color: 'bg-amber-50 border-amber-200 text-amber-700' },
    maintenance : { label: 'Maintenance', emoji: '🔧',  color: 'bg-red-50 border-red-200 text-red-700' },
  };

  const fetchHistory = async () => {
    setLoadHist(true);
    try {
      const r = await authFetch('/api/admin/broadcast');
      const d = await r.json();
      setHistory(Array.isArray(d) ? d : []);
    } catch {}
    finally { setLoadHist(false); }
  };

  useEffect(() => { fetchHistory(); }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) { showToast('Judul dan pesan wajib diisi.'); return; }
    setSending(true);
    try {
      const r = await authFetch('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), message: message.trim(), type }),
      });
      const d = await r.json();
      if (d.success) {
        showToast(`✅ Broadcast terkirim ke ${d.count ?? 'semua'} user!`);
        setTitle('');
        setMessage('');
        setType('info');
        fetchHistory();
      } else {
        showToast(d.error ?? 'Gagal mengirim broadcast.');
      }
    } catch { showToast('Terjadi kesalahan jaringan.'); }
    finally { setSending(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await authFetch('/api/admin/broadcast', { method: 'DELETE', body: JSON.stringify({ id }) });
      showToast('Broadcast dihapus.');
      fetchHistory();
    } catch { showToast('Gagal menghapus.'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">Broadcast Notifikasi</h2>
        <p className="text-xs text-slate-400 mt-1">Kirim pengumuman ke semua user. Notifikasi akan muncul di halaman user saat mereka login.</p>
      </div>

      {/* Form kirim broadcast */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6 space-y-5">
        <h3 className="font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-indigo-600" /> Buat Broadcast Baru
        </h3>

        {/* Tipe */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Tipe Notifikasi</label>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(TYPE_CFG) as any[]).map(([k, v]) => (
              <button key={k} onClick={() => setType(k as any)}
                className={"px-4 py-2 rounded-xl text-xs font-black border-2 transition-all " + (type === k ? v.color + ' border-current' : 'border-slate-200 dark:border-white/[0.09] text-slate-400 hover:border-slate-300 dark:bg-[#0f1320]')}>
                {v.emoji} {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Judul */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Judul</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Contoh: Promo Deposit Bonus 10%!"
            maxLength={100}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white"
          />
          <div className="text-right text-[10px] text-slate-400 mt-1">{title.length}/100</div>
        </div>

        {/* Pesan */}
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Pesan</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Tulis isi pengumuman di sini..."
            maxLength={500}
            rows={4}
            className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white resize-none"
          />
          <div className="text-right text-[10px] text-slate-400 mt-1">{message.length}/500</div>
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className={`rounded-2xl border p-4 ${TYPE_CFG[type].color}`}>
            <div className="font-black text-sm mb-1">{TYPE_CFG[type].emoji} {title || 'Judul broadcast...'}</div>
            <div className="text-sm opacity-90">{message || 'Isi pesan...'}</div>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-2xl transition-colors flex items-center justify-center gap-2"
        >
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
          {sending ? 'Mengirim...' : 'Kirim ke Semua User'}
        </button>
      </div>

      {/* Riwayat broadcast */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6">
        <h3 className="font-black text-slate-900 dark:text-white mb-4">Riwayat Broadcast</h3>
        {loadHist ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-[#0f1320] rounded-2xl">
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-2.5 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-2 w-32 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                </div>
                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-bold">Belum ada broadcast dikirim.</div>
        ) : (
          <div className="space-y-3">
            {history.map((b: any) => {
              const cfg = TYPE_CFG[b.type as keyof typeof TYPE_CFG] ?? TYPE_CFG.info;
              return (
                <div key={b.id} className="flex items-start gap-4 p-4 bg-slate-50 dark:bg-[#0f1320] rounded-2xl">
                  <div className="text-2xl shrink-0">{cfg.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-sm text-slate-900 dark:text-white">{b.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{b.message}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {new Date(b.created_at).toLocaleString('id-ID')} · {b.recipient_count ?? 'semua'} user
                    </div>
                  </div>
                  <button onClick={() => handleDelete(b.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
// ─── PAPAN INFO TAB ───────────────────────────────────────────────────
function NoticeBoardTab({ showToast }: { showToast: (msg: string) => void }) {

  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } });
  };

  const [notices,  setNotices]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ title: '', content: '', type: 'info', is_active: true });

  const TYPE_CFG: Record<string, { label: string; emoji: string; color: string }> = {
    info     : { label: 'Info',        emoji: 'ℹ️',  color: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400' },
    promo    : { label: 'Promo',       emoji: '🎉',  color: 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400' },
    warning  : { label: 'Peringatan',  emoji: '⚠️',  color: 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-400' },
    maintenance: { label: 'Maintenance', emoji: '🔧', color: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400' },
  };

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const r = await authFetch('/api/admin/notice');
      const d = await r.json();
      setNotices(Array.isArray(d) ? d : []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotices(); }, []);

  const resetForm = () => { setForm({ title: '', content: '', type: 'info', is_active: true }); setEditId(null); setShowForm(false); };

  const handleEdit = (n: any) => {
    setForm({ title: n.title, content: n.content, type: n.type, is_active: n.is_active });
    setEditId(n.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) { showToast('Judul dan isi wajib diisi.'); return; }
    setSaving(true);
    try {
      const r = await authFetch('/api/admin/notice', {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify(editId ? { ...form, id: editId } : form),
      });
      const d = await r.json();
      if (d.success) { showToast(editId ? 'Papan info diperbarui!' : 'Papan info ditambahkan!'); resetForm(); fetchNotices(); }
      else showToast(d.error ?? 'Gagal menyimpan.');
    } catch { showToast('Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus papan info ini?')) return;
    await authFetch('/api/admin/notice', { method: 'DELETE', body: JSON.stringify({ id }) });
    showToast('Dihapus.');
    fetchNotices();
  };

  const handleToggle = async (id: number, is_active: boolean) => {
    await authFetch('/api/admin/notice', { method: 'PATCH', body: JSON.stringify({ id, is_active: !is_active }) });
    fetchNotices();
  };

  const inputCls = "w-full px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Papan Info</h2>
          <p className="text-xs text-slate-400 mt-1">Pengumuman yang tampil permanen di halaman utama user.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(v => !v); }}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
          + Tambah Info
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-6 space-y-5">
          <h3 className="font-black text-slate-900 dark:text-white">{editId ? 'Edit Papan Info' : 'Tambah Papan Info'}</h3>

          {/* Tipe */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Tipe</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_CFG).map(([k, v]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, type: k }))}
                  className={"px-4 py-2 rounded-xl text-xs font-black border-2 transition-all " + (form.type === k ? v.color + ' border-current' : 'border-slate-200 dark:border-white/[0.09] text-slate-400 hover:border-slate-300 dark:bg-[#0f1320]')}>
                  {v.emoji} {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Judul */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Judul</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Contoh: Server sedang maintenance..." maxLength={100} className={inputCls} />
          </div>

          {/* Isi */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">Isi Pengumuman</label>
            <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              placeholder="Tulis detail pengumuman di sini..." maxLength={500} rows={4} className={inputCls + ' resize-none'} />
          </div>

          {/* Status aktif */}
          <div className="flex items-center gap-3">
            <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={"w-11 h-6 rounded-full transition-colors " + (form.is_active ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700')}>
              <div className={"w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 " + (form.is_active ? 'translate-x-5' : 'translate-x-0')} />
            </button>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {form.is_active ? 'Aktif (tampil ke user)' : 'Nonaktif (tersembunyi)'}
            </span>
          </div>

          {/* Preview */}
          {(form.title || form.content) && (
            <div className={`rounded-2xl border p-4 ${TYPE_CFG[form.type]?.color}`}>
              <div className="font-black text-sm mb-1">{TYPE_CFG[form.type]?.emoji} {form.title || 'Judul...'}</div>
              <div className="text-sm opacity-90">{form.content || 'Isi pengumuman...'}</div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={resetForm} className="flex-1 py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors">Batal</button>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambahkan'}
            </button>
          </div>
        </div>
      )}

      {/* Daftar papan info */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5 flex items-start gap-4">
              <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                <div className="h-2.5 w-full max-w-xs bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-24 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              </div>
              <div className="flex gap-2 shrink-0">
                <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
                <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-12 text-center text-slate-400 font-bold">
          Belum ada papan info. Klik "+ Tambah Info" untuk mulai.
        </div>
      ) : (
        <div className="space-y-3">
          {notices.map((n: any) => {
            const cfg = TYPE_CFG[n.type] ?? TYPE_CFG.info;
            return (
              <div key={n.id} className={`rounded-[2rem] border p-5 flex items-start gap-4 ${n.is_active ? cfg.color : 'bg-slate-50 dark:bg-[#0f1320]/50 border-slate-200 dark:border-white/[0.09] opacity-50'}`}>
                <div className="text-2xl shrink-0">{cfg.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-sm mb-1">{n.title}</div>
                  <div className="text-sm opacity-80 line-clamp-2">{n.content}</div>
                  <div className="text-[10px] opacity-60 mt-1">{new Date(n.created_at).toLocaleString('id-ID')}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Toggle aktif */}
                  <button onClick={() => handleToggle(n.id, n.is_active)}
                    className={"w-10 h-5 rounded-full transition-colors " + (n.is_active ? 'bg-current opacity-70' : 'bg-slate-300 dark:bg-slate-600')}
                    title={n.is_active ? 'Nonaktifkan' : 'Aktifkan'}>
                    <div className={"w-4 h-4 bg-white rounded-full shadow transition-transform mx-0.5 " + (n.is_active ? 'translate-x-5' : 'translate-x-0')} />
                  </button>
                  <button onClick={() => handleEdit(n)} className="p-2 hover:bg-white/30 rounded-xl transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(n.id)} className="p-2 hover:bg-white/30 rounded-xl transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ─── RIWAYAT BLOKIR TAB ───────────────────────────────────────────────
function BlacklistHistoryTab({ showToast }: { showToast: (msg: string) => void }) {
  const authFetch = (url: string, options: RequestInit = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') ?? '' : '';
    return fetch(url, { ...options, headers: { ...(options.headers ?? {}), 'Authorization': `Bearer ${token}` } });
  };

  const [logs,    setLogs]    = useState<any[]>([]);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(false);
  const [filter,  setFilter]  = useState<'all' | 'blacklist' | 'unblacklist'>('all');

  const fetchBlacklistLogs = async (p: number, s: string, f: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (s) params.set('search', s);
      const r = await authFetch(`/api/admin/logs?${params}`);
      const d = await r.json();
      const allLogs: any[] = d.logs ?? [];
      const filtered = allLogs.filter((l: any) => {
        const a = (l.action ?? '').toLowerCase();
        if (!a.includes('blacklist') && !a.includes('banned') && !a.includes('block')) return false;
        if (f === 'unblacklist') return a.includes('unblacklist') || a.includes('unbanned') || a.includes('unblock');
        if (f === 'blacklist')   return !a.includes('unblacklist') && !a.includes('unbanned') && !a.includes('unblock');
        return true;
      });
      setLogs(filtered);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchBlacklistLogs(page, search, filter); }, [page, filter]);

  const getActionType = (action: string) => {
    const a = (action ?? '').toLowerCase();
    if (a.includes('unblacklist') || a.includes('unbanned') || a.includes('unblock')) return 'unblacklist';
    return 'blacklist';
  };

  const ACTION_CFG = {
    blacklist:   { label: 'Diblokir',       color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-red-200 dark:border-red-800/50',   icon: '🚫' },
    unblacklist: { label: 'Dibuka Blokir',  color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/50', icon: '✅' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">Riwayat Blokir User</h2>
          <p className="text-xs text-slate-400 mt-1">Log semua aktivitas blokir & buka blokir akun user beserta waktu kejadian</p>
        </div>
        <button onClick={() => fetchBlacklistLogs(page, search, filter)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/[0.09] transition-colors border border-slate-200 dark:border-white/[0.09]">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'all',         label: 'Semua'            },
          { key: 'blacklist',   label: '🚫 Diblokir'      },
          { key: 'unblacklist', label: '✅ Dibuka Blokir' },
        ] as const).map(f => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${filter === f.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-400 dark:hover:border-indigo-500'}`}>
            {f.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchBlacklistLogs(1, search, filter)}
            placeholder="Cari user ID atau detail..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-white" />
        </div>
        <button onClick={() => fetchBlacklistLogs(1, search, filter)}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
          Cari
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                <tr>{['Status Aksi','Target User ID','Detail / Alasan','Waktu'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4"><div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" /></td>
                    <td className="px-5 py-4"><div className="h-5 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" /></td>
                    <td className="px-5 py-4"><div className="h-3 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                    <td className="px-5 py-4"><div className="h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <Ban className="w-10 h-10 mx-auto mb-3 text-slate-200 dark:text-slate-700" />
            <div className="font-bold text-slate-400">Belum ada riwayat blokir</div>
            <p className="text-xs text-slate-400 mt-1">Aktivitas blokir & buka blokir akan otomatis tercatat di sini</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 border-b border-slate-200 dark:border-white/[0.07] text-[10px] uppercase tracking-widest text-slate-400 font-black">
                <tr>{['Status Aksi','Target User ID','Detail / Alasan','Waktu'].map(h => <th key={h} className="px-5 py-4">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {logs.map((l: any) => {
                  const aType = getActionType(l.action ?? '');
                  const cfg   = ACTION_CFG[aType];
                  return (
                    <tr key={l.id} className="hover:bg-indigo-50/30 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border inline-flex items-center gap-1.5 ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-[#0f1320] px-2 py-1 rounded-lg">{l.target_id ?? '—'}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300 max-w-xs">{l.details || l.action || '—'}</div>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-400 whitespace-nowrap">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-4 border-t border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
          <span className="text-xs text-slate-400">{logs.length} entri ditampilkan</span>
          <div className="flex gap-2">
            <button onClick={() => { const p = Math.max(1, page-1); setPage(p); }} disabled={page === 1}
              className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">← Prev</button>
            <span className="px-3 py-1.5 text-xs font-bold text-slate-500">Hal {page}</span>
            <button onClick={() => setPage(p => p+1)} disabled={logs.length < 20}
              className="px-3 py-1.5 bg-slate-100 dark:bg-[#0f1320] rounded-xl text-xs font-bold disabled:opacity-50">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}