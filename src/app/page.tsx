"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import NextImage from 'next/image';
import { 
  Smartphone, MessageCircle, Send, ShoppingBag, Camera, Search, Menu, X, 
  Zap, ShieldCheck, Clock, Code, ChevronRight, User, Wallet, LogOut, 
  Mail, Lock, Eye, EyeOff, CheckCircle, RefreshCw, AlertCircle, ShoppingCart,
  CreditCard, History, Settings, QrCode, Copy, Check, ChevronDown, Filter, 
  ArrowRight, CheckCircle2, PlayCircle, Minimize2, Bell, MessageSquare,
  Globe, ShieldAlert, Star, ArrowUpDown, Receipt, Moon, Sun, Server, Users, Gift, Share2, RotateCcw, Upload,
  BarChart2, TrendingUp, Package, Activity
} from 'lucide-react';

// ==========================================
// TYPES & INTERFACES
// ==========================================
interface UserData {
  name   : string;
  email  : string;
  balance?: number;
}

interface Order {
  id: number;
  activationId: string;
  date: string;
  serviceName: string;
  price: number;
  icon: React.ReactNode;
  number: string;
  status: 'waiting' | 'success' | 'cancelled' | 'expired' | 'completed';
  autoDismissAt?: number;
  timeLeft: number;
  otpCode: string | null;
  isV2?: boolean;
  bundleServices?: string[];
  otpCodes?: { service: string; code: string }[];
  allSms?: { text: string; code: string; createdAt: string }[];
}

interface Mutasi {
  id: number;
  date: string;
  type: 'in' | 'out';
  amount: number;
  desc: string;
}

interface Service {
  id: number;
  code: string;
  name: string;
  category: string;
  price: number;
  basePrice: number;
  profit: number;
  stock: number;
  outOfStock: boolean;
  icon: React.ReactNode;
}

interface PaymentMethod {
  id: string;
  name: string;
  fee: number;
  type: 'qr' | 'va' | 'ewallet';
}

interface Country {
  id: string;
  name: string;
}

interface NavItem {
  id: string;
  name: string;
  icon: React.ReactNode;
}

// ==========================================
// CONSTANTS
// ==========================================
const CS_WA        = '6287862306726';
const CS_TELEGRAM  = '@PusatNokosCS';
const SESSION_TTL  = 3 * 24 * 60 * 60 * 1000; // 3 hari dalam ms

// ── Security helpers ─────────────────────────────────────────────────
// Generate token kriptografis (32 hex chars)
const genToken = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

// In-memory session store (tidak bisa dicuri via XSS dari tab lain)
let _sessionToken: string | null = null;
let _csrfToken: string | null = null;

const setSecureSession = (userData: UserData, accessToken?: string) => {
  _sessionToken = accessToken ?? genToken(); // pakai Supabase JWT jika tersedia
  _csrfToken    = genToken();
  const payload = { ...userData, _savedAt: Date.now(), _st: _sessionToken, _at: accessToken ?? '' };
  // sessionStorage: auto-hapus saat browser/tab ditutup (lebih aman dari localStorage)
  try {
    // Bersihkan session lama sebelum set baru agar tidak quota exceeded
    sessionStorage.removeItem('nokos_s');
    sessionStorage.setItem('nokos_s', JSON.stringify(payload));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      try { sessionStorage.clear(); sessionStorage.setItem('nokos_s', JSON.stringify(payload)); } catch {}
    }
  }
};

const clearSecureSession = () => {
  _sessionToken = null;
  _csrfToken    = null;
  try { sessionStorage.removeItem('nokos_s'); } catch {}
  try { localStorage.removeItem('nokos_session'); } catch {} // hapus lama juga
};

// Bersihkan localStorage dari keys lama agar tidak QuotaExceededError
const cleanupStorage = () => {
  try {
    const now = Date.now();
    const keysToDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Hapus semua rate limit keys (expired atau tidak)
      if (key.startsWith('rl_')) {
        keysToDelete.push(key);
        continue;
      }
      // Hapus cache keys lama
      if (key.startsWith('cache_') || key.startsWith('sw_') || key.startsWith('workbox-')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));

    // Kalau masih penuh, cek total size dan clear agresif
    try {
      const testKey = '__quota_test__';
      localStorage.setItem(testKey, 'x');
      localStorage.removeItem(testKey);
    } catch {
      // Masih penuh — hapus semua kecuali theme dan lang
      const keep = new Set(['theme', 'lang']);
      const allKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && !keep.has(k)) allKeys.push(k);
      }
      allKeys.forEach(k => localStorage.removeItem(k));
    }
  } catch {}
};

// Wrapper setItem yang bersihkan storage jika quota exceeded
const safeLocalSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      cleanupStorage();
      try { localStorage.setItem(key, value); } catch {} // retry sekali
    }
  }
};

const restoreSecureSession = (): (UserData & { _savedAt: number }) | null => {
  try {
    // Coba sessionStorage dulu (sesi aktif)
    const s = sessionStorage.getItem('nokos_s');
    if (s) {
      const parsed = JSON.parse(s) as UserData & { _savedAt: number; _st: string; _at?: string };
      if (parsed?.email && parsed._savedAt && Date.now() - parsed._savedAt < SESSION_TTL) {
        // ✅ FIX: Hanya pakai _at (Supabase JWT) — _st adalah random string, bukan JWT valid
        // Kalau _at kosong, paksa re-login agar user dapat token Supabase yang baru
        if (!parsed._at) {
          sessionStorage.removeItem('nokos_s');
          return null;
        }
        _sessionToken = parsed._at;
        _csrfToken    = genToken();
        return parsed;
      }
      sessionStorage.removeItem('nokos_s');
    }
    // Fallback: localStorage lama (migrasi 1x — lalu hapus)
    const old = localStorage.getItem('nokos_session');
    if (old) {
      const parsed = JSON.parse(old) as UserData & { _savedAt?: number };
      if (parsed?.email && parsed._savedAt && Date.now() - parsed._savedAt < SESSION_TTL) {
        // Sesi lama tidak punya access_token → hapus, paksa login ulang
        localStorage.removeItem('nokos_session');
        return null; // paksa re-login agar user dapat token baru
      }
      localStorage.removeItem('nokos_session');
    }
  } catch {}
  return null;
};

// Helper: tambahkan security headers ke semua fetch yang membutuhkan auth
// _sessionToken sekarang berisi Supabase access_token (JWT) dari login response
const authHeaders = (extra?: Record<string, string>): Record<string, string> => ({
  'Content-Type': 'application/json',
  // Authorization: Bearer <supabase_access_token> — divalidasi server via supabase.auth.getUser()
  ...((_sessionToken) ? { 'Authorization': `Bearer ${_sessionToken}` } : {}),
  ...((_csrfToken)    ? { 'X-CSRF-Token': _csrfToken }                : {}),
  ...extra,
});

// Fallback kosong — data live dari API, tidak pakai harga hardcoded
const ALL_SERVICES: Service[] = [];

const CATEGORIES_BASE: string[] = ['Chat', 'Social', 'E-Commerce', 'Transport', 'Finance', 'Gaming', 'Streaming', 'Dating', 'Travel', 'Tech'];

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'qris', name: 'QRIS Otomatis', fee: 0, type: 'qr' },
  { id: 'va_bca', name: 'BCA Virtual Account', fee: 4000, type: 'va' },
  { id: 'dana', name: 'DANA E-Wallet', fee: 150, type: 'ewallet' },
  { id: 'ovo', name: 'OVO E-Wallet', fee: 150, type: 'ewallet' }
];

const COUNTRIES: Country[] = [
  { id: '6',   name: '🇮🇩 Indonesia (+62)' },
  { id: '7',   name: '🇲🇾 Malaysia (+60)' },
  { id: '12',  name: '🇺🇸 United States (+1)' },
  { id: '16',  name: '🇬🇧 United Kingdom (+44)' },
  { id: '52',  name: '🇹🇭 Thailand (+66)' },
  { id: '10',  name: '🇻🇳 Vietnam (+84)' },
  { id: '4',   name: '🇵🇭 Philippines (+63)' },
  { id: '0',   name: '🇷🇺 Russia (+7)' },
  { id: '22',  name: '🇮🇳 India (+91)' },
  { id: '43',  name: '🇩🇪 Germany (+49)' },
  { id: '73',  name: '🇧🇷 Brazil (+55)' },
  { id: '135', name: '🇸🇬 Singapore (+65)' },
];

const copyToClipboard = async (text: string, fallbackCallback: (msg: string) => void) => {
  try {
    await navigator.clipboard.writeText(text);
    fallbackCallback("Disalin: " + text);
  } catch (err) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      fallbackCallback("Disalin: " + text);
    } catch (err) {
      fallbackCallback('Failed to copy');
    }
    document.body.removeChild(textArea);
  }
};

const formatTimeStr = (s: number): string => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return m + ":" + sec;
};

const extractOtp = (text: string | null): string => {
  if (!text) return '';
  const match = text.match(/\b(\d{4,8})\b/);
  return match ? match[1] : text;
};


// ==========================================
// TRANSLATIONS (ID / EN / ZH)
// ==========================================
type Lang = 'id' | 'en' | 'zh';

const T: Record<Lang, Record<string, string>> = {
  id: {
    // Nav
    dashboard:'Dashboard', buy:'Beli Nomor', topup:'Deposit Saldo',
    history:'Riwayat Transaksi', mutasi:'Mutasi Saldo', profile:'Pengaturan Akun',
    // Header
    logout:'Keluar', topupBtn:'+ Topup', notifications:'Notifikasi',
    clearAll:'Hapus semua', noNotif:'Belum ada notifikasi', yourBalance:'Saldo Anda',
    // Buy page
    buyTitle:'Beli Nomor OTP', buySubtitle:'Pilih layanan aplikasi. Harga & stok diperbarui secara real-time.',
    serverCountry:'Negara Server', search:'Pencarian', sort:'Urutkan',
    serviceCol:'Layanan App', stockCol:'Stok Server', priceCol:'Harga / OTP', actionCol:'Aksi',
    buyBtn:'Beli Nomor', modeBundle:'⚡ Mode Bundle', cancelBundle:'✕ Batal Bundle',
    searchPlaceholder:'Cari layanan...', recommended:'Rekomendasi',
    // Active orders
    activeOrders:'Pesanan Aktif', scrollTop:'Atas',
    phoneReceived:'Nomor HP Diterima', otpCode:'Kode Verifikasi (OTP)',
    waitingOTP:'Menunggu SMS Masuk...', viewAllSMS:'Lihat Semua SMS',
    resend:'Resend', sms:'SMS', cancel:'Batal',
    // Dashboard
    totalBalance:'Total Saldo', totalOrder:'Total Order', successOrder:'Order Sukses',
    activeOrder:'Sedang Aktif', successRate:'Sukses Rate',
    financeSummary:'Ringkasan Keuangan', totalDeposit:'Total Deposit',
    totalSpend:'Total Belanja', remainBalance:'Sisa Saldo',
    recentTx:'Transaksi Terakhir', viewAll:'Lihat semua →',
    quickActions:'Aksi Cepat',
    // Deposit
    depositTitle:'Deposit Saldo', depositNew:'+ Deposit Baru', depositHistory:'📋 Riwayat',
    autoDeposit:'Deposit Otomatis', manualDeposit:'Transfer Manual',
    nominalDeposit:'Nominal Deposit', paymentMethod:'Metode Pembayaran',
    balanceIn:'Saldo masuk', totalPay:'Total Bayar', payNow:'Bayar Sekarang',
    processing:'Memproses...', back:'← Back',
    // History
    historyTitle:'Riwayat Transaksi',
    // Mutasi
    mutasiTitle:'Buku Mutasi Saldo', mutasiSubtitle:'Catatan rinci pemasukan dan pengeluaran saldo Anda.',
    timeDesc:'Waktu & Deskripsi', nominal:'Nominal',
    // Profile
    fullName:'Full Name', updateProfile:'Perbarui Profil',
    changePassword:'Ganti Password', currentPass:'Password Saat Ini',
    newPass:'Password Baru', confirmPass:'Confirm Password Baru',
    joinedAt:'Bergabung Sejak', totalOrders:'Total Order', totalPurchase:'Total Pembelian',
    savePassword:'Simpan Password Baru', saving:'Menyimpan...',
    // Dashboard greeting
    greeting:'Halo', welcomeMsg:'Selamat datang di Pusat Nokos',
    // Profile misc
    accountInfo:'Informasi Akun', passStrWeak:'Lemah', passStrMed:'Sedang', passStrStrong:'Kuat', passStrVeryStrong:'Sangat Kuat',
    passMismatch:'Password tidak cocok.', changePassTitle:'Ganti Password',
    // History filters
    filterAll:'Semua', filterSuccess:'✅ Berhasil', filterWaiting:'⏳ Menunggu',
    filterCancelled:'❌ Batal', filterExpired:'🕐 Kadaluarsa',
    // Mutasi filters
    mutasiAll:'Semua', mutasiIn:'Masuk (+)', mutasiOut:'Keluar (-)',
    // Load more
    loadMore:'Muat lebih banyak', noMoreData:'Tidak ada data lagi',
    noData:'Tidak ada data',
    // Extra
    legalDocs:'Dokumen Legal', outOfStock:'Habis', perOTP:'per OTP',
    allSMS:'Semua SMS Masuk', cancelBtn:'BATAL', waitingBtn:'MENUNGGU',
    successBtn:'BERHASIL', expiredBtn:'KADALUARSA', pickCol:'Pilih',
    appDetailCol:'Detail Aplikasi & Waktu', phoneOtpCol:'Nomor HP & Kode OTP',
    statusCol:'Status', otomatis:'OTOMATIS', categoryAll:'Semua', categoryOthers:'Lainnya',
    depositAutoDesc:'Berbagai metode pembayaran tersedia. Saldo masuk otomatis setelah bayar.',
    depositManualDesc:'Transfer ke rekening/QRIS admin, upload bukti, admin approve dalam 1x24 jam.',
    sortPriceAsc:'Harga Terendah',
    legalTerms:'Syarat & Ketentuan', legalPrivacy:'Kebijakan Privasi', legalRefund:'Kebijakan Refund', legalDeposit:'Kebijakan Deposit', legalAntiAbuse:'Anti Penyalahgunaan', legalDisclaimer:'Disclaimer', logoutBtn:'Keluar Akun', cancelBtn2:'Batal', confirmBtn:'Ya, Lanjutkan', sortPriceDesc:'Harga Tertinggi', sortStockMost:'Stok Terbanyak',
    selectCountry:'Pilih Negara', searchCountry:'Cari negara...', depositStatusPending:'Menunggu', depositStatusApproved:'Disetujui', depositStatusRejected:'Ditolak',
  },
  en: {
    // Nav
    dashboard:'Dashboard', buy:'Buy Number', topup:'Deposit',
    history:'Transaction History', mutasi:'Balance History', profile:'Account Settings',
    // Header
    logout:'Logout', topupBtn:'+ Top Up', notifications:'Notifications',
    clearAll:'Clear all', noNotif:'No notifications yet', yourBalance:'Your Balance',
    // Buy page
    buyTitle:'Buy OTP Number', buySubtitle:'Select app service. Prices & stock updated real-time.',
    serverCountry:'Server Country', search:'Search', sort:'Sort',
    serviceCol:'App Service', stockCol:'Server Stock', priceCol:'Price / OTP', actionCol:'Action',
    buyBtn:'Buy Number', modeBundle:'⚡ Bundle Mode', cancelBundle:'✕ Cancel Bundle',
    searchPlaceholder:'Search service...', recommended:'Recommended',
    // Active orders
    activeOrders:'Active Orders', scrollTop:'Top',
    phoneReceived:'Phone Number Received', otpCode:'Verification Code (OTP)',
    waitingOTP:'Waiting for SMS...', viewAllSMS:'View All SMS',
    resend:'Resend', sms:'SMS', cancel:'Cancel',
    // Dashboard
    totalBalance:'Total Balance', totalOrder:'Total Orders', successOrder:'Successful',
    activeOrder:'Active', successRate:'Success Rate',
    financeSummary:'Financial Summary', totalDeposit:'Total Deposit',
    totalSpend:'Total Spent', remainBalance:'Remaining Balance',
    recentTx:'Recent Transactions', viewAll:'View all →',
    quickActions:'Quick Actions',
    // Deposit
    depositTitle:'Deposit Balance', depositNew:'+ New Deposit', depositHistory:'📋 History',
    autoDeposit:'Auto Deposit', manualDeposit:'Manual Transfer',
    nominalDeposit:'Deposit Amount', paymentMethod:'Payment Method',
    balanceIn:'Balance in', totalPay:'Total Pay', payNow:'Pay Now',
    processing:'Processing...', back:'← Back',
    // History
    historyTitle:'Transaction History',
    // Mutasi
    mutasiTitle:'Balance Book', mutasiSubtitle:'Detailed record of your balance in and out.',
    timeDesc:'Time & Description', nominal:'Amount',
    // Profile
    fullName:'Full Name', updateProfile:'Update Profile',
    changePassword:'Change Password', currentPass:'Current Password',
    newPass:'New Password', confirmPass:'Confirm New Password',
    joinedAt:'Joined Since', totalOrders:'Total Orders', totalPurchase:'Total Purchase',
    savePassword:'Save New Password', saving:'Saving...',
    greeting:'Hello', welcomeMsg:'Welcome to Pusat Nokos',
    accountInfo:'Account Information', passStrWeak:'Weak', passStrMed:'Medium', passStrStrong:'Strong', passStrVeryStrong:'Very Strong',
    passMismatch:'Passwords do not match.', changePassTitle:'Change Password',
    filterAll:'All', filterSuccess:'✅ Success', filterWaiting:'⏳ Waiting',
    filterCancelled:'❌ Cancelled', filterExpired:'🕐 Expired',
    mutasiAll:'All', mutasiIn:'Income (+)', mutasiOut:'Expense (-)',
    loadMore:'Load more', noMoreData:'No more data', noData:'No data',
    // Extra
    legalDocs:'Legal Documents', outOfStock:'Out of Stock', perOTP:'per OTP',
    allSMS:'All SMS', cancelBtn:'CANCELLED', waitingBtn:'WAITING',
    successBtn:'SUCCESS', expiredBtn:'EXPIRED', pickCol:'Pick',
    appDetailCol:'App Detail & Time', phoneOtpCol:'Phone & OTP Code',
    statusCol:'Status', otomatis:'INSTANT', categoryAll:'All', categoryOthers:'Others',
    depositAutoDesc:'Various payment methods available. Balance credited automatically after payment.',
    depositManualDesc:'Transfer to admin account, upload proof, admin approves within 24 hours.',
    sortPriceAsc:'Lowest Price',
    legalTerms:'Terms of Service', legalPrivacy:'Privacy Policy', legalRefund:'Refund Policy', legalDeposit:'Deposit Policy', legalAntiAbuse:'Anti-Abuse Policy', legalDisclaimer:'Disclaimer', logoutBtn:'Sign Out', cancelBtn2:'Cancel', confirmBtn:'Yes, Continue', sortPriceDesc:'Highest Price', sortStockMost:'Most Stock',
    selectCountry:'Select Country', searchCountry:'Search country...', depositStatusPending:'Pending', depositStatusApproved:'Approved', depositStatusRejected:'Rejected',
  },
  zh: {
    // Nav
    dashboard:'仪表盘', buy:'购买号码', topup:'充值',
    history:'交易记录', mutasi:'余额记录', profile:'账户设置',
    // Header
    logout:'退出', topupBtn:'+ 充值', notifications:'通知',
    clearAll:'清除全部', noNotif:'暂无通知', yourBalance:'您的余额',
    // Buy page
    buyTitle:'购买OTP号码', buySubtitle:'选择应用服务。价格和库存实时更新。',
    serverCountry:'服务器国家', search:'搜索', sort:'排序',
    serviceCol:'应用服务', stockCol:'服务器库存', priceCol:'价格 / OTP', actionCol:'操作',
    buyBtn:'购买号码', modeBundle:'⚡ 套餐模式', cancelBundle:'✕ 取消套餐',
    searchPlaceholder:'搜索服务...', recommended:'推荐',
    // Active orders
    activeOrders:'活跃订单', scrollTop:'顶部',
    phoneReceived:'已接收号码', otpCode:'验证码 (OTP)',
    waitingOTP:'等待短信...', viewAllSMS:'查看全部短信',
    resend:'重发', sms:'短信', cancel:'取消',
    // Dashboard
    totalBalance:'总余额', totalOrder:'总订单', successOrder:'成功',
    activeOrder:'活跃', successRate:'成功率',
    financeSummary:'财务摘要', totalDeposit:'总充值',
    totalSpend:'总消费', remainBalance:'剩余余额',
    recentTx:'最近交易', viewAll:'查看全部 →',
    quickActions:'快捷操作',
    // Deposit
    depositTitle:'充值余额', depositNew:'+ 新充值', depositHistory:'📋 记录',
    autoDeposit:'自动充值', manualDeposit:'手动转账',
    nominalDeposit:'充值金额', paymentMethod:'支付方式',
    balanceIn:'入账余额', totalPay:'总支付', payNow:'立即支付',
    processing:'处理中...', back:'← 返回',
    // History
    historyTitle:'交易记录',
    // Mutasi
    mutasiTitle:'余额账本', mutasiSubtitle:'详细记录您的余额收支。',
    timeDesc:'时间与描述', nominal:'金额',
    // Profile
    fullName:'全名', updateProfile:'更新资料',
    changePassword:'修改密码', currentPass:'当前密码',
    newPass:'新密码', confirmPass:'确认新密码',
    joinedAt:'加入时间', totalOrders:'总订单', totalPurchase:'总消费',
    savePassword:'保存新密码', saving:'保存中...',
    greeting:'你好', welcomeMsg:'欢迎来到 Pusat Nokos',
    accountInfo:'账户信息', passStrWeak:'弱', passStrMed:'中', passStrStrong:'强', passStrVeryStrong:'非常强',
    passMismatch:'密码不匹配。', changePassTitle:'修改密码',
    filterAll:'全部', filterSuccess:'✅ 成功', filterWaiting:'⏳ 等待中',
    filterCancelled:'❌ 已取消', filterExpired:'🕐 已过期',
    mutasiAll:'全部', mutasiIn:'入账 (+)', mutasiOut:'支出 (-)',
    loadMore:'加载更多', noMoreData:'没有更多数据', noData:'暂无数据',
    // Extra
    legalDocs:'法律文件', outOfStock:'缺货', perOTP:'每次OTP',
    allSMS:'所有短信', cancelBtn:'已取消', waitingBtn:'等待中',
    successBtn:'成功', expiredBtn:'已过期', pickCol:'选择',
    appDetailCol:'应用详情 & 时间', phoneOtpCol:'手机号 & OTP',
    statusCol:'状态', otomatis:'即时', categoryAll:'全部', categoryOthers:'其他',
    depositAutoDesc:'多种支付方式可选。支付后余额自动到账。',
    depositManualDesc:'转账至管理员账户，上传凭证，管理员在24小时内审核。',
    sortPriceAsc:'最低价格',
    legalTerms:'服务条款', legalPrivacy:'隐私政策', legalRefund:'退款政策', legalDeposit:'充值政策', legalAntiAbuse:'反滥用政策', legalDisclaimer:'免责声明', logoutBtn:'退出登录', cancelBtn2:'取消', confirmBtn:'是的，继续', sortPriceDesc:'最高价格', sortStockMost:'库存最多',
    selectCountry:'选择国家', searchCountry:'搜索国家...', depositStatusPending:'待处理', depositStatusApproved:'已批准', depositStatusRejected:'已拒绝',
  },
};

// ==========================================
// ANIMATION UTILS
// ==========================================
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    let fired = false;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting && !fired) { fired = true; setInView(true); io.disconnect(); } },
      { threshold, rootMargin: '0px 0px -10% 0px' }
    );
    const el = ref.current;
    if (el) io.observe(el);
    // Fallback: jika setelah 1.2 detik masih belum visible, paksa visible
    const t = window.setTimeout(() => { if (!fired) { fired = true; setInView(true); } }, 1200);
    return () => { io.disconnect(); window.clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { ref, inView };
}

function useCountUp(end: number, duration = 1300, trigger = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    let frame = 0;
    const total = Math.round(duration / 16);
    const t = setInterval(() => {
      frame++;
      const eased = 1 - Math.pow(1 - frame / total, 3);
      setCount(Math.round(eased * end));
      if (frame >= total) { setCount(end); clearInterval(t); }
    }, 16);
    return () => clearInterval(t);
  }, [end, duration, trigger]);
  return count;
}

function FadeInSection({ children, delay = 0, className = '' }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  // Render langsung tanpa animasi — IntersectionObserver tidak reliable di dev mode
  return <div className={className}>{children}</div>;
}
// ── Modal Konfirmasi (ganti window.confirm) ───────────────────────────
function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" style={{background:'rgba(0,0,0,0.5)'}}>
      <div className="bg-white dark:bg-[#0a0d16] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/[0.09] p-6 max-w-sm w-full">
        <div className="flex items-start gap-3 mb-5">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-xl shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400"/>
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/[0.09] text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.07] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors">
            Yes, Continue
          </button>
        </div>
      </div>
    </div>
  );
}


// ==========================================
// MODULE-LEVEL SERVICE ICON HELPER
// Dual-source: simpleicons (verified slugs) + Google Favicon CDN (universal fallback)
// Google Favicon API: no CORS, no auth, works dari localhost & production.
// ==========================================
type LogoCfg =
  | { type: 'si';  slug: string; color: string; bg: string }   // simpleicons CDN
  | { type: 'fav'; domain: string; bg: string };               // Google Favicon CDN

const SERVICE_LOGO_MAP: [string[], LogoCfg][] = [
  // ── Chat ──────────────────────────────────────────────────────────────
  [['whatsapp'],             { type:'si',  slug:'whatsapp',      color:'25D366', bg:'#dcfce7' }],
  [['telegram'],             { type:'si',  slug:'telegram',      color:'26A5E4', bg:'#dbeafe' }],
  [['line'],                 { type:'si',  slug:'line',          color:'00C300', bg:'#dcfce7' }],
  [['signal'],               { type:'si',  slug:'signal',        color:'3A76F0', bg:'#dbeafe' }],
  [['discord'],              { type:'si',  slug:'discord',       color:'5865F2', bg:'#ede9fe' }],
  [['wechat'],               { type:'si',  slug:'wechat',        color:'07C160', bg:'#dcfce7' }],
  [['viber'],                { type:'si',  slug:'viber',         color:'7360F2', bg:'#ede9fe' }],
  [['skype'],                { type:'si',  slug:'skype',         color:'00AFF0', bg:'#dbeafe' }],
  [['kakao'],                { type:'fav', domain:'kakao.com',               bg:'#fef9c3' }],
  [['imo'],                  { type:'fav', domain:'imo.im',                  bg:'#dbeafe' }],
  [['zalo'],                 { type:'fav', domain:'zalo.me',                 bg:'#dbeafe' }],
  [['bigo'],                 { type:'fav', domain:'bigo.tv',                 bg:'#dcfce7' }],
  [['michat'],               { type:'fav', domain:'michat.mobi',             bg:'#fee2e2' }],
  [['icq'],                  { type:'fav', domain:'icq.com',                 bg:'#dcfce7' }],
  // ── Social ────────────────────────────────────────────────────────────
  [['instagram'],            { type:'si',  slug:'instagram',     color:'E1306C', bg:'#fce7f3' }],
  [['tiktok'],               { type:'si',  slug:'tiktok',        color:'010101', bg:'#f1f5f9' }],
  [['facebook'],             { type:'si',  slug:'facebook',      color:'1877F2', bg:'#dbeafe' }],
  [['twitter','x.com'],      { type:'si',  slug:'x',             color:'000000', bg:'#f1f5f9' }],
  [['linkedin','linked in'], { type:'fav', domain:'linkedin.com',                bg:'#dbeafe' }],
  [['snapchat'],             { type:'si',  slug:'snapchat',      color:'FFFC00', bg:'#fef9c3' }],
  [['pinterest'],            { type:'si',  slug:'pinterest',     color:'E60023', bg:'#fee2e2' }],
  [['reddit'],               { type:'si',  slug:'reddit',        color:'FF4500', bg:'#fee2e2' }],
  [['youtube'],              { type:'si',  slug:'youtube',       color:'FF0000', bg:'#fee2e2' }],
  [['twitch'],               { type:'si',  slug:'twitch',        color:'9146FF', bg:'#ede9fe' }],
  [['vk','vkontakte'],       { type:'si',  slug:'vk',            color:'4A76A8', bg:'#dbeafe' }],
  [['tumblr'],               { type:'si',  slug:'tumblr',        color:'34526F', bg:'#dbeafe' }],
  [['quora'],                { type:'fav', domain:'quora.com',               bg:'#fee2e2' }],
  [['clubhouse'],            { type:'fav', domain:'joinclubhouse.com',       bg:'#fef9c3' }],
  [['odnoklassniki'],        { type:'fav', domain:'ok.ru',                   bg:'#fef3c7' }],
  [['behance'],              { type:'si',  slug:'behance',       color:'1769FF', bg:'#dbeafe' }],
  // ── E-Commerce ────────────────────────────────────────────────────────
  [['shopee'],               { type:'si',  slug:'shopee',        color:'EE4D2D', bg:'#fee2e2' }],
  [['amazon','amazon.com'],  { type:'fav', domain:'amazon.com',                   bg:'#fef3c7' }],
  [['ebay'],                 { type:'si',  slug:'ebay',          color:'E53238', bg:'#fee2e2' }],
  [['aliexpress'],           { type:'fav', domain:'aliexpress.com',          bg:'#fee2e2' }],
  [['tokopedia'],            { type:'fav', domain:'tokopedia.com',           bg:'#dcfce7' }],
  [['lazada'],               { type:'fav', domain:'lazada.co.id',            bg:'#dbeafe' }],
  [['temu'],                 { type:'fav', domain:'temu.com',                bg:'#fee2e2' }],
  [['wildberries'],          { type:'fav', domain:'wildberries.ru',          bg:'#fce7f3' }],
  [['bukalapak'],            { type:'fav', domain:'bukalapak.com',           bg:'#fee2e2' }],
  [['blibli'],               { type:'fav', domain:'blibli.com',              bg:'#dbeafe' }],
  [['meesho'],               { type:'fav', domain:'meesho.com',              bg:'#ede9fe' }],
  [['flipkart'],             { type:'fav', domain:'flipkart.com',            bg:'#dbeafe' }],
  [['ozon'],                 { type:'fav', domain:'ozon.ru',                 bg:'#dbeafe' }],
  [['avito'],                { type:'fav', domain:'avito.ru',                bg:'#dcfce7' }],
  [['coupang'],              { type:'fav', domain:'coupang.com',             bg:'#fee2e2' }],
  [['daraz'],                { type:'fav', domain:'daraz.pk',                bg:'#fee2e2' }],
  [['mercadolibre','mercado libre'],{ type:'fav', domain:'mercadolibre.com', bg:'#fef9c3' }],
  [['poshmark'],             { type:'fav', domain:'poshmark.com',            bg:'#fee2e2' }],
  [['jd.com'],               { type:'fav', domain:'jd.com',                  bg:'#fee2e2' }],
  // ── Transport ─────────────────────────────────────────────────────────
  [['gojek'],                { type:'si',  slug:'gojek',         color:'00AA13', bg:'#dcfce7' }],
  [['grab'],                 { type:'si',  slug:'grab',          color:'00B14F', bg:'#dcfce7' }],
  [['uber'],                 { type:'si',  slug:'uber',          color:'000000', bg:'#f1f5f9' }],
  [['lyft'],                 { type:'si',  slug:'lyft',          color:'FF00BF', bg:'#fce7f3' }],
  [['indriver'],             { type:'fav', domain:'indrive.com',              bg:'#dcfce7' }],
  [['maxim'],                { type:'fav', domain:'taximaxim.com',            bg:'#fef9c3' }],
  [['didi'],                 { type:'fav', domain:'didiglobal.com',           bg:'#fee2e2' }],
  [['lalamove'],             { type:'fav', domain:'lalamove.com',             bg:'#fee2e2' }],
  [['borzo'],                { type:'fav', domain:'borzo.com',                bg:'#fce7f3' }],
  [['doordash'],             { type:'fav', domain:'doordash.com',             bg:'#fee2e2' }],
  [['rappi'],                { type:'fav', domain:'rappi.com',                bg:'#fee2e2' }],
  // ── Finance / Crypto ──────────────────────────────────────────────────
  [['paypal'],               { type:'si',  slug:'paypal',        color:'003087', bg:'#dbeafe' }],
  [['binance'],              { type:'si',  slug:'binance',        color:'F3BA2F', bg:'#fef9c3' }],
  [['coinbase','coin base'], { type:'si',  slug:'coinbase',       color:'0052FF', bg:'#dbeafe' }],
  [['okx'],                  { type:'si',  slug:'okx',            color:'000000', bg:'#f1f5f9' }],
  [['dana'],                 { type:'fav', domain:'dana.id',                  bg:'#dbeafe' }],
  [['ovo','ovo id'],         { type:'fav', domain:'ovo.id',                   bg:'#ede9fe' }],
  [['gopay'],                { type:'fav', domain:'gopay.co.id',              bg:'#dcfce7' }],
  [['linkaja','link aja'],   { type:'fav', domain:'linkaja.id',               bg:'#fee2e2' }],
  [['shopeepay'],            { type:'fav', domain:'shopee.co.id',             bg:'#fee2e2' }],
  [['bybit'],                { type:'fav', domain:'bybit.com',                bg:'#fef9c3' }],
  [['cashapp'],              { type:'fav', domain:'cash.app',                 bg:'#dcfce7' }],
  [['revolut'],              { type:'fav', domain:'revolut.com',              bg:'#f1f5f9' }],
  [['paytm'],                { type:'fav', domain:'paytm.com',                bg:'#dbeafe' }],
  [['bkash'],                { type:'fav', domain:'bkash.com',                bg:'#fce7f3' }],
  [['phonepe'],              { type:'fav', domain:'phonepe.com',              bg:'#ede9fe' }],
  [['metamask'],             { type:'fav', domain:'metamask.io',              bg:'#fef3c7' }],
  // ── Tech / Mail ───────────────────────────────────────────────────────
  [['google','gmail'],       { type:'si',  slug:'google',        color:'EA4335', bg:'#fee2e2' }],
  [['microsoft','outlook','ms365','office 365'], { type:'fav', domain:'microsoft.com', bg:'#dbeafe' }],
  [['apple','icloud'],       { type:'si',  slug:'apple',         color:'000000', bg:'#f1f5f9' }],
  [['yahoo','yahoo mail'],   { type:'fav', domain:'yahoo.com',                    bg:'#ede9fe' }],
  [['proton'],               { type:'fav', domain:'proton.me',                bg:'#ede9fe' }],
  [['yandex'],               { type:'fav', domain:'yandex.com',               bg:'#fee2e2' }],
  [['mail.ru'],              { type:'fav', domain:'mail.ru',                  bg:'#dbeafe' }],
  // ── Streaming ─────────────────────────────────────────────────────────
  [['netflix'],              { type:'si',  slug:'netflix',       color:'E50914', bg:'#fee2e2' }],
  [['spotify'],              { type:'si',  slug:'spotify',       color:'1DB954', bg:'#dcfce7' }],
  [['disney'],               { type:'fav', domain:'disneyplus.com',           bg:'#dbeafe' }],
  [['hbo'],                  { type:'fav', domain:'hbomax.com',               bg:'#ede9fe' }],
  [['prime video','primevideo'],{ type:'fav', domain:'primevideo.com',        bg:'#dbeafe' }],
  [['hulu'],                 { type:'fav', domain:'hulu.com',                 bg:'#dcfce7' }],
  [['peacock'],              { type:'fav', domain:'peacocktv.com',            bg:'#f1f5f9' }],
  [['crunchyroll'],          { type:'fav', domain:'crunchyroll.com',          bg:'#fee2e2' }],
  [['iqiyi'],                { type:'fav', domain:'iqiyi.com',                bg:'#dcfce7' }],
  [['wetv'],                 { type:'fav', domain:'wetv.vip',                 bg:'#fee2e2' }],
  [['viu'],                  { type:'fav', domain:'viu.com',                  bg:'#fef9c3' }],
  // ── Gaming ────────────────────────────────────────────────────────────
  [['steam'],                { type:'si',  slug:'steam',         color:'000000', bg:'#e2e8f0' }],
  [['roblox'],               { type:'si',  slug:'roblox',        color:'E02525', bg:'#fee2e2' }],
  [['epic'],                 { type:'si',  slug:'epicgames',     color:'313131', bg:'#f1f5f9' }],
  [['playstation'],          { type:'si',  slug:'playstation',   color:'003087', bg:'#dbeafe' }],
  [['xbox'],                 { type:'si',  slug:'xbox',          color:'107C10', bg:'#dcfce7' }],
  [['minecraft'],            { type:'fav', domain:'minecraft.net',             bg:'#dcfce7' }],
  [['fortnite'],             { type:'fav', domain:'fortnite.com',              bg:'#dbeafe' }],
  [['valorant'],             { type:'fav', domain:'playvalorant.com',          bg:'#fee2e2' }],
  [['pubg'],                 { type:'fav', domain:'pubg.com',                  bg:'#fef3c7' }],
  [['free fire','freefire'], { type:'fav', domain:'ff.garena.com',             bg:'#fee2e2' }],
  [['mobile legend','mlbb'], { type:'fav', domain:'mobilelegends.net',         bg:'#fee2e2' }],
  [['clash'],                { type:'fav', domain:'supercell.com',             bg:'#fef9c3' }],
  // ── Dating ────────────────────────────────────────────────────────────
  [['tinder'],               { type:'si',  slug:'tinder',        color:'FF6B6B', bg:'#fee2e2' }],
  [['bumble','bumble dating'],{ type:'fav', domain:'bumble.com',                 bg:'#fef9c3' }],
  [['badoo'],                { type:'fav', domain:'badoo.com',                 bg:'#fce7f3' }],
  [['hinge','hinge dating'], { type:'fav', domain:'hinge.co',                  bg:'#fee2e2' }],
  // ── Travel ────────────────────────────────────────────────────────────
  [['airbnb'],               { type:'si',  slug:'airbnb',        color:'FF5A5F', bg:'#fee2e2' }],
  [['booking'],              { type:'fav', domain:'booking.com',               bg:'#dbeafe' }],
  [['traveloka'],            { type:'fav', domain:'traveloka.com',             bg:'#dbeafe' }],
  [['agoda'],                { type:'fav', domain:'agoda.com',                 bg:'#fee2e2' }],
  [['tiket'],                { type:'fav', domain:'tiket.com',                 bg:'#dbeafe' }],
  [['expedia'],              { type:'fav', domain:'expedia.com',               bg:'#dbeafe' }],
  [['pegipegi'],             { type:'fav', domain:'pegipegi.com',              bg:'#fee2e2' }],
  // ── Lainnya ───────────────────────────────────────────────────────────
  [['irctc'],                { type:'fav', domain:'irctc.co.in',               bg:'#fee2e2' }],
  [['shopify'],              { type:'si',  slug:'shopify',       color:'96BF48', bg:'#dcfce7' }],
  // ── Chat Tambahan ─────────────────────────────────────────────────────
  [['threads'],              { type:'si',  slug:'threads',       color:'000000', bg:'#f1f5f9' }],
  [['bereal'],               { type:'fav', domain:'bereal.com',                bg:'#f1f5f9' }],
  [['kik'],                  { type:'fav', domain:'kik.com',                   bg:'#dcfce7' }],
  [['textfree','textnow'],   { type:'fav', domain:'textnow.com',               bg:'#dcfce7' }],
  [['truecaller'],           { type:'fav', domain:'truecaller.com',            bg:'#dbeafe' }],
  [['textplus'],             { type:'fav', domain:'textplus.com',              bg:'#dbeafe' }],
  [['whatsapp business'],    { type:'si',  slug:'whatsapp',      color:'25D366', bg:'#dcfce7' }],
  [['naver'],                { type:'fav', domain:'naver.com',                 bg:'#dcfce7' }],
  [['kakaotalk'],            { type:'fav', domain:'kakao.com',                 bg:'#fef9c3' }],
  // ── Social Tambahan ───────────────────────────────────────────────────
  [['vimeo'],                { type:'si',  slug:'vimeo',         color:'1AB7EA', bg:'#dbeafe' }],
  [['flickr'],               { type:'si',  slug:'flickr',        color:'FF0084', bg:'#fce7f3' }],
  [['mastodon'],             { type:'si',  slug:'mastodon',      color:'6364FF', bg:'#ede9fe' }],
  [['mewe'],                 { type:'fav', domain:'mewe.com',                  bg:'#dbeafe' }],
  [['truth social'],         { type:'fav', domain:'truthsocial.com',           bg:'#dbeafe' }],
  [['mix'],                  { type:'fav', domain:'mix.com',                   bg:'#fee2e2' }],
  [['parler'],               { type:'fav', domain:'parler.com',                bg:'#fee2e2' }],
  // ── Food Delivery ─────────────────────────────────────────────────────
  [['gofood'],               { type:'fav', domain:'gofood.co.id',              bg:'#fee2e2' }],
  [['grabfood'],             { type:'fav', domain:'grab.com',                  bg:'#dcfce7' }],
  [['shopeefood'],           { type:'fav', domain:'shopee.co.id',              bg:'#fee2e2' }],
  [['foodpanda','pandamart'],{ type:'fav', domain:'foodpanda.com',             bg:'#fce7f3' }],
  [['ubereats','uber eats'], { type:'fav', domain:'ubereats.com',              bg:'#f1f5f9' }],
  [['swiggy'],               { type:'fav', domain:'swiggy.com',                bg:'#fef3c7' }],
  [['zomato'],               { type:'fav', domain:'zomato.com',                bg:'#fee2e2' }],
  [['glovo','glovoapp'],     { type:'fav', domain:'glovoapp.com',              bg:'#fef9c3' }],
  [['ifood'],                { type:'fav', domain:'ifood.com.br',              bg:'#fee2e2' }],
  // ── Transport Tambahan ────────────────────────────────────────────────
  [['bolt'],                 { type:'fav', domain:'bolt.eu',                   bg:'#dcfce7' }],
  [['bluebird'],             { type:'fav', domain:'bluebirdgroup.com',         bg:'#dbeafe' }],
  [['ola'],                  { type:'fav', domain:'olacabs.com',               bg:'#fef9c3' }],
  [['pathao'],               { type:'fav', domain:'pathao.com',                bg:'#fee2e2' }],
  [['tada'],                 { type:'fav', domain:'tada.global',               bg:'#dbeafe' }],
  [['yandex taxi'],          { type:'fav', domain:'taxi.yandex.ru',            bg:'#fef9c3' }],
  // ── E-Commerce Tambahan ───────────────────────────────────────────────
  [['carousell'],            { type:'fav', domain:'carousell.com',             bg:'#fee2e2' }],
  [['etsy'],                 { type:'si',  slug:'etsy',          color:'F16521', bg:'#fef3c7' }],
  [['wish'],                 { type:'fav', domain:'wish.com',                  bg:'#dbeafe' }],
  [['taobao'],               { type:'fav', domain:'taobao.com',                bg:'#fee2e2' }],
  [['jumia'],                { type:'fav', domain:'jumia.com',                 bg:'#fee2e2' }],
  [['noon'],                 { type:'fav', domain:'noon.com',                  bg:'#fef9c3' }],
  [['vinted'],               { type:'fav', domain:'vinted.com',                bg:'#dcfce7' }],
  [['depop'],                { type:'fav', domain:'depop.com',                 bg:'#fee2e2' }],
  [['rakuten'],              { type:'fav', domain:'rakuten.com',                  bg:'#fee2e2' }],
  [['zalora'],               { type:'fav', domain:'zalora.com',                bg:'#f1f5f9' }],
  [['jd id'],                { type:'fav', domain:'jd.id',                     bg:'#fee2e2' }],
  [['harbolnas','harbo'],    { type:'fav', domain:'harbolnas.com',             bg:'#fee2e2' }],
  // ── Finance Tambahan ──────────────────────────────────────────────────
  [['wise','transferwise'],  { type:'fav', domain:'wise.com',                     bg:'#dcfce7' }],
  [['alipay'],               { type:'fav', domain:'alipay.com',                bg:'#dbeafe' }],
  [['webmoney'],             { type:'fav', domain:'webmoney.ru',               bg:'#dbeafe' }],
  [['qiwi'],                 { type:'fav', domain:'qiwi.com',                  bg:'#fee2e2' }],
  [['perfectmoney'],         { type:'fav', domain:'perfectmoney.com',          bg:'#fef9c3' }],
  [['skrill'],               { type:'fav', domain:'skrill.com',                bg:'#ede9fe' }],
  [['neteller'],             { type:'fav', domain:'neteller.com',              bg:'#fee2e2' }],
  [['paxful'],               { type:'fav', domain:'paxful.com',                bg:'#fef9c3' }],
  [['crypto.com','cryptocom','crypto'],{ type:'fav', domain:'crypto.com',      bg:'#dbeafe' }],
  [['kucoin'],               { type:'fav', domain:'kucoin.com',                bg:'#dcfce7' }],
  [['huobi'],                { type:'fav', domain:'huobi.com',                 bg:'#fef3c7' }],
  [['gate.io'],              { type:'fav', domain:'gate.io',                   bg:'#fee2e2' }],
  [['bitfinex'],             { type:'fav', domain:'bitfinex.com',              bg:'#dcfce7' }],
  [['kraken'],               { type:'fav', domain:'kraken.com',                bg:'#ede9fe' }],
  [['freecash'],             { type:'fav', domain:'freecash.com',              bg:'#dcfce7' }],
  [['akulaku'],              { type:'fav', domain:'akulaku.com',               bg:'#fef9c3' }],
  [['kredivo'],              { type:'fav', domain:'kredivo.com',               bg:'#dbeafe' }],
  // ── Gaming Tambahan ───────────────────────────────────────────────────
  [['garena'],               { type:'fav', domain:'garena.com',                bg:'#fee2e2' }],
  [['genshin','mihoyo'],     { type:'fav', domain:'mihoyo.com',               bg:'#dbeafe' }],
  [['honor of kings','hok'], { type:'fav', domain:'honorofkings.com',         bg:'#fef9c3' }],
  [['league of legends','lol'],{ type:'fav', domain:'leagueoflegends.com',    bg:'#dbeafe' }],
  [['dota'],                 { type:'fav', domain:'dota2.com',                 bg:'#fee2e2' }],
  [['brawl stars'],          { type:'fav', domain:'supercell.com',             bg:'#fef9c3' }],
  [['call of duty','cod'],   { type:'fav', domain:'callofduty.com',            bg:'#f1f5f9' }],
  [['stumble guys'],         { type:'fav', domain:'stumbleguys.com',           bg:'#ede9fe' }],
  [['among us'],             { type:'fav', domain:'innersloth.com',            bg:'#ede9fe' }],
  [['lifeafter'],            { type:'fav', domain:'lifeafter.163.com',         bg:'#fee2e2' }],
  [['ragnarok'],             { type:'fav', domain:'ragnarokonline.com',        bg:'#dbeafe' }],
  [['point blank','pb'],     { type:'fav', domain:'pointblank.co.id',          bg:'#fee2e2' }],
  [['arena of valor','aov'], { type:'fav', domain:'arenaofvalor.com',          bg:'#fef9c3' }],
  [['chess.com'],            { type:'fav', domain:'chess.com',                 bg:'#dcfce7' }],
  [['8ball','8 ball pool'],  { type:'fav', domain:'miniclip.com',              bg:'#dbeafe' }],
  // ── Freelance / Bisnis ────────────────────────────────────────────────
  [['fiverr'],               { type:'si',  slug:'fiverr',        color:'1DBF73', bg:'#dcfce7' }],
  [['upwork'],               { type:'si',  slug:'upwork',        color:'6FDA44', bg:'#dcfce7' }],
  [['freelancer'],           { type:'fav', domain:'freelancer.com',            bg:'#dbeafe' }],
  [['99designs'],            { type:'fav', domain:'99designs.com',             bg:'#ede9fe' }],
  [['toptal'],               { type:'fav', domain:'toptal.com',                bg:'#dbeafe' }],
  [['taskrabbit'],           { type:'fav', domain:'taskrabbit.com',            bg:'#fee2e2' }],
  // ── Pendidikan ────────────────────────────────────────────────────────
  [['coursera'],             { type:'fav', domain:'coursera.org',              bg:'#dbeafe' }],
  [['udemy'],                { type:'fav', domain:'udemy.com',                 bg:'#ede9fe' }],
  [['duolingo'],             { type:'fav', domain:'duolingo.com',              bg:'#dcfce7' }],
  [['ruangguru'],            { type:'fav', domain:'ruangguru.com',             bg:'#dbeafe' }],
  [['zenius'],               { type:'fav', domain:'zenius.net',                bg:'#ede9fe' }],
  // ── Kesehatan ─────────────────────────────────────────────────────────
  [['halodoc'],              { type:'fav', domain:'halodoc.com',               bg:'#dcfce7' }],
  [['alodokter'],            { type:'fav', domain:'alodokter.com',             bg:'#dbeafe' }],
  [['good doctor'],          { type:'fav', domain:'gooddoctor.co.id',          bg:'#dcfce7' }],
  // ── Dating Tambahan ───────────────────────────────────────────────────
  [['justdating','just dating'],    { type:'fav', domain:'justdating.com',     bg:'#fce7f3' }],
  [['asiandating','asian dating'],  { type:'fav', domain:'asiandating.com',    bg:'#fce7f3' }],
  [['lovoo'],                { type:'fav', domain:'lovoo.com',                 bg:'#fee2e2' }],
  [['meetic'],               { type:'fav', domain:'meetic.com',                bg:'#fee2e2' }],
  [['match'],                { type:'fav', domain:'match.com',                 bg:'#fee2e2' }],
  [['okcupid'],              { type:'fav', domain:'okcupid.com',               bg:'#dbeafe' }],
  [['grindr'],               { type:'fav', domain:'grindr.com',                bg:'#fef9c3' }],
  [['zoosk'],                { type:'fav', domain:'zoosk.com',                 bg:'#dbeafe' }],
  [['happn'],                { type:'fav', domain:'happn.com',                 bg:'#fee2e2' }],
  [['mamba'],                { type:'fav', domain:'mamba.ru',                  bg:'#fce7f3' }],
  // ── AI / Tech Tambahan ────────────────────────────────────────────────
  [['claude','anthropic'],   { type:'fav', domain:'claude.ai',                 bg:'#fef3c7' }],
  [['chatgpt','openai'],     { type:'fav', domain:'openai.com',                bg:'#dcfce7' }],
  [['gemini','bard'],        { type:'fav', domain:'gemini.google.com',         bg:'#dbeafe' }],
  [['github'],               { type:'si',  slug:'github',        color:'181717', bg:'#f1f5f9' }],
  [['gitlab'],               { type:'si',  slug:'gitlab',        color:'FC6D26', bg:'#fef3c7' }],
  [['dropbox'],              { type:'si',  slug:'dropbox',       color:'0061FF', bg:'#dbeafe' }],
  [['notion'],               { type:'si',  slug:'notion',        color:'000000', bg:'#f1f5f9' }],
  [['slack'],                { type:'si',  slug:'slack',         color:'4A154B', bg:'#ede9fe' }],
  [['zoom'],                 { type:'si',  slug:'zoom',          color:'2D8CFF', bg:'#dbeafe' }],
  [['figma'],                { type:'si',  slug:'figma',         color:'F24E1E', bg:'#fee2e2' }],
  [['canva'],                { type:'fav', domain:'canva.com',                 bg:'#dbeafe' }],
  [['adobe'],                { type:'fav', domain:'adobe.com',                   bg:'#fee2e2' }],
  [['wordpress'],            { type:'si',  slug:'wordpress',     color:'21759B', bg:'#dbeafe' }],
  [['icloud'],               { type:'fav', domain:'icloud.com',                bg:'#f1f5f9' }],
  [['onedrive'],             { type:'fav', domain:'onedrive.com',              bg:'#dbeafe' }],
  [['googledrive','google drive'],{ type:'fav', domain:'drive.google.com',    bg:'#fee2e2' }],
  // ── Telco / Operator ──────────────────────────────────────────────────
  [['telkomsel','tsel'],     { type:'fav', domain:'telkomsel.com',             bg:'#fee2e2' }],
  [['indosat','im3','ooredoo'],{ type:'fav', domain:'indosatooredoo.com',      bg:'#fef9c3' }],
  [['xl','axiata'],          { type:'fav', domain:'xl.co.id',                  bg:'#dbeafe' }],
  [['smartfren'],            { type:'fav', domain:'smartfren.com',             bg:'#fee2e2' }],
  [['three','tri'],          { type:'fav', domain:'three.co.id',               bg:'#fef9c3' }],
  [['airtel'],               { type:'fav', domain:'airtel.in',                 bg:'#fee2e2' }],
  [['jio'],                  { type:'fav', domain:'jio.com',                   bg:'#dbeafe' }],
  [['maxis'],                { type:'fav', domain:'maxis.com.my',              bg:'#dbeafe' }],
  [['celcom'],               { type:'fav', domain:'celcom.com.my',             bg:'#dbeafe' }],
];


// Warna avatar deterministik berdasarkan nama — konsisten di setiap render
const AVATAR_PALETTES = [
  { bg: '#dbeafe', color: '#1d4ed8' }, // biru
  { bg: '#dcfce7', color: '#15803d' }, // hijau
  { bg: '#fce7f3', color: '#be185d' }, // pink
  { bg: '#ede9fe', color: '#6d28d9' }, // ungu
  { bg: '#fef9c3', color: '#854d0e' }, // kuning
  { bg: '#fee2e2', color: '#b91c1c' }, // merah
  { bg: '#fef3c7', color: '#92400e' }, // oranye
  { bg: '#f0fdf4', color: '#166534' }, // hijau muda
  { bg: '#f0f9ff', color: '#0369a1' }, // biru muda
  { bg: '#fdf4ff', color: '#7e22ce' }, // lavender
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}


// Komponen gambar logo dengan dual fallback:
// primary src → fallbackSrc (icon.horse) → inisial
// Fixes icon tidak muncul di iOS/Android karena Google Favicon diblok privacy filter
function ServiceLogoImg({
  src, fallbackSrc, bg, initial, color,
}: { src: string; fallbackSrc?: string; bg: string; initial: string; color: string }) {
  const [state, setState] = React.useState<'primary' | 'fallback' | 'error'>('primary');

  if (state === 'error') {
    return (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-base font-black"
        style={{ background: bg, color }}>
        {initial}
      </div>
    );
  }

  const currentSrc = state === 'primary' ? src : (fallbackSrc ?? src);

  return (
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden"
      style={{ background: bg }}>
      <img
        src={currentSrc}
        alt={initial}
        width={26}
        height={26}
        style={{ width: 26, height: 26, objectFit: 'contain', display: 'block' }}
        onError={() => {
          if (state === 'primary' && fallbackSrc) {
            setState('fallback'); // coba sumber kedua dulu
          } else {
            setState('error');   // baru tampilkan inisial
          }
        }}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function getServiceIconByName(name: string): React.ReactNode {
  const n = name.toLowerCase();

  for (const [keys, cfg] of SERVICE_LOGO_MAP) {
    if (keys.some(k => n.includes(k))) {
      const initial = name.charAt(0).toUpperCase();

      if (cfg.type === 'si') {
        // Simple Icons CDN — SVG logo dengan warna brand asli
        // fallback: Google Favicon jika SimpleIcons gagal
        return (
          <ServiceLogoImg
            src={`https://cdn.simpleicons.org/${cfg.slug}/${cfg.color}`}
            fallbackSrc={`https://icon.horse/icon/${cfg.slug}.com`}
            bg={cfg.bg}
            initial={initial}
            color={`#${cfg.color}`}
          />
        );
      }

      if (cfg.type === 'fav') {
        // Google Favicon CDN — primary
        // fallback: icon.horse (lebih reliable di iOS/Android, tidak diblok privacy filter)
        return (
          <ServiceLogoImg
            src={`https://www.google.com/s2/favicons?sz=64&domain=${cfg.domain}`}
            fallbackSrc={`https://icon.horse/icon/${cfg.domain}`}
            bg={cfg.bg}
            initial={initial}
            color="#4f46e5"
          />
        );
      }
    }
  }

  // Fallback: inisial dengan warna deterministik dari nama layanan
  const palette = getAvatarPalette(name);
  return (
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-base font-black shrink-0"
      style={{ background: palette.bg, color: palette.color }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}


// ==========================================
// APP LOADING SKELETON — tampil saat cek session, mencegah flash landing page
// ==========================================
function AppLoadingSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060810] flex">
      {/* Sidebar skeleton (desktop) */}
      <div className="hidden md:flex flex-col w-64 shrink-0 bg-white dark:bg-[#0d1020] border-r border-slate-200 dark:border-white/[0.07] p-4 gap-3">
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 py-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-white/[0.08] animate-pulse" />
          <div className="space-y-1.5">
            <div className="w-24 h-3 bg-slate-200 dark:bg-white/[0.08] rounded animate-pulse" />
            <div className="w-16 h-2 bg-slate-100 dark:bg-white/[0.04] rounded animate-pulse" />
          </div>
        </div>
        {/* Nav items */}
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.05] animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
        ))}
        <div className="flex-1" />
        <div className="h-11 rounded-2xl bg-slate-100 dark:bg-white/[0.05] animate-pulse opacity-50" />
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header skeleton */}
        <div className="h-16 bg-white dark:bg-[#0d1020] border-b border-slate-200 dark:border-white/[0.07] px-4 md:px-8 flex items-center justify-between">
          <div className="w-32 h-5 bg-slate-200 dark:bg-white/[0.08] rounded-lg animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="w-24 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 animate-pulse" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-4 sm:p-8 space-y-6 overflow-hidden">
          {/* Balance + stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] p-5 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
                <div className="w-20 h-3 bg-slate-200 dark:bg-white/[0.08] rounded animate-pulse" />
                <div className="w-28 h-6 bg-slate-200 dark:bg-white/[0.08] rounded-lg animate-pulse" />
              </div>
            ))}
          </div>

          {/* Table / list skeleton */}
          <div className="bg-white dark:bg-[#0d1020] rounded-[2rem] border border-slate-200 dark:border-white/[0.07] overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-white/[0.07]">
              <div className="w-36 h-5 bg-slate-200 dark:bg-white/[0.08] rounded-lg animate-pulse" />
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-slate-100 dark:border-white/[0.06] last:border-0" style={{ opacity: 1 - i * 0.1 }}>
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.06] animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-3.5 bg-slate-200 dark:bg-white/[0.08] rounded animate-pulse" />
                  <div className="w-20 h-2.5 bg-slate-100 dark:bg-white/[0.04] rounded animate-pulse" />
                </div>
                <div className="w-20 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom nav skeleton (mobile) */}
        <div className="md:hidden h-16 bg-white dark:bg-[#0d1020] border-t border-slate-200 dark:border-white/[0.07] flex items-center justify-around px-2"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-white/[0.06] animate-pulse" />
              <div className="w-10 h-2 rounded bg-slate-100 dark:bg-white/[0.04] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState<string>('landing');
  const [isInitializing, setIsInitializing] = useState<boolean>(true); // cegah flash landing page
  const [user, setUser] = useState<UserData | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [lang, setLang] = useState<Lang>(() => (typeof window !== 'undefined' ? (localStorage.getItem('lang') as Lang) ?? 'en' : 'en'));
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceError,    setServiceError]    = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>('6');
  const [countries, setCountries] = useState<Country[]>([
    { id: '6',  name: '🇮🇩 Indonesia' },
    { id: '12', name: '🇺🇸 USA' },
    { id: '7',  name: '🇲🇾 Malaysia' },
    { id: '52', name: '🇹🇭 Thailand' },
    { id: '22', name: '🇮🇳 India' },
    { id: '16', name: '🇬🇧 England' },
  ]);

  const IDR_RATE = 16300;

  // Scroll to top saat pertama load (cegah browser restore posisi scroll lama)
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    cleanupStorage(); // bersihkan storage lama saat pertama load
  }, []);

  // Bersihkan Service Worker cache lama agar tidak QuotaExceededError
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const killSW = () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(reg => reg.unregister());
        }).catch(() => {});
        // Juga hapus semua SW controller
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      if ('caches' in window) {
        caches.keys().then(keys => {
          keys.forEach(key => caches.delete(key));
        }).catch(() => {});
      }
    };
    killSW();
    // Jalankan lagi setelah 2 detik karena SW kadang re-register
    const t = setTimeout(killSW, 2000);
    return () => clearTimeout(t);
  }, []);

  // Baca preferensi saat pertama mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved === 'dark' || (!saved && prefersDark);
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    // ── Restore session (sessionStorage → localStorage fallback → hapus) ─
    const restoredSession = restoreSecureSession();
    if (restoredSession) {
      setUser(restoredSession);
      setCurrentView('dashboard');
    }
    // Selesai cek session — apapun hasilnya, hapus skeleton
    setIsInitializing(false);
  }, []);

  // ── Inject mobile CSS fixes (iOS/Android) — sekali saja ──────────────
  useEffect(() => {
    if (document.getElementById('_mobile_fix')) return;
    const style = document.createElement('style');
    style.id = '_mobile_fix';
    style.textContent = `
      /* Prevent iOS input zoom — font-size < 16px trigger auto-zoom */
      @media (max-width: 639px) {
        input, select, textarea { font-size: 16px !important; }
      }
      /* Safe area variables untuk iPhone notch & home indicator */
      :root {
        --safe-top: env(safe-area-inset-top, 0px);
        --safe-bottom: env(safe-area-inset-bottom, 0px);
      }
      /* Prevent overscroll bounce di iOS */
      html { overscroll-behavior-y: none; }
    `;
    document.head.appendChild(style);
  }, []);

  // Apply/remove class 'dark' di <html> setiap kali isDarkMode berubah
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      safeLocalSet('theme', 'dark');
    } else {
      root.classList.remove('dark');
      safeLocalSet('theme', 'light');
    }
  }, [isDarkMode]);

  const getCategory = (name: string): string => {
    const n = name.toLowerCase();
    if (['whatsapp','telegram','line','signal','wechat','viber','zalo','discord','kakao','imessage','skype','icq','imo','bigo','michat','zalo'].some(k => n.includes(k))) return 'Chat';
    if (['shopee','tokopedia','lazada','bukalapak','amazon','ebay','blibli','temu','aliexpress','jd.com','coupang','daraz','flipkart','meesho','mercado','poshmark','ozon','wildberries','avito'].some(k => n.includes(k))) return 'E-Commerce';
    if (['gojek','grab','maxim','uber','indriver','lyft','didi','borzo','lalamove','doordash','gofood','grabfood','shopeefood','ifood','rappi'].some(k => n.includes(k))) return 'Transport';
    if (['instagram','tiktok','facebook','twitter','snapchat','pinterest','linkedin','reddit','vkontakte','odnoklassniki','tumblr','clubhouse','mewe','quora','truthsocial','x.com','behance'].some(k => n.includes(k))) return 'Social';
    if (['google','gmail','apple','microsoft','outlook','yahoo','mail.ru','yandex','rambler','proton'].some(k => n.includes(k))) return 'Tech';
    if (['netflix','spotify','disney','hbo','prime video','hulu','twitch','youtube','crunchyroll','peacock','paramount','funimation','wetv','iqiyi','viu'].some(k => n.includes(k))) return 'Streaming';
    if (['roblox','steam','xbox','playstation','epic','mobile legend','free fire','pubg','minecraft','fortnite','league of legends','valorant','dota','clash','brawl','stumble','honor of kings','call of duty'].some(k => n.includes(k))) return 'Gaming';
    if (['paypal','ovo','dana','gopay','shopeepay','linkaja','binance','coinbase','crypto','bybit','okx','trust wallet','metamask','cashapp','revolut','paytm','bkash','nagad','phonepe'].some(k => n.includes(k))) return 'Finance';
    if (['tinder','bumble','badoo','hinge','lovoo','dating'].some(k => n.includes(k))) return 'Dating';
    if (['airbnb','booking','expedia','agoda','traveloka','tiket','pegipegi'].some(k => n.includes(k))) return 'Travel';
    return 'Lainnya';
  };

  // Delegasikan ke fungsi module-level — satu sumber kebenaran untuk semua ikon
  const getServiceIcon = (_code: string, name: string): React.ReactNode => getServiceIconByName(name);

  // Fetch countries sekali saat load
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await fetch('/api/countries-rank');
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) setCountries(data);
      } catch {
        // Tetap pakai fallback static countries
      }
    };
    fetchCountries();
  }, []);

  // Fetch services setiap kali selectedCountry berubah
  useEffect(() => {
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await fetch(`/api/services?country=${selectedCountry}&operator=0`);
        if (!res.ok) throw new Error('API error');
        const data: { code: string; name: string; price: number; basePrice?: number; count: number; outOfStock?: boolean }[] = await res.json();

        const IDR_RATE = 17135.75;
        const mapped: Service[] = data.map((item, idx) => {
          const basePrice = item.basePrice ?? Math.round((item.price / 1.25));
          const profit = item.price - basePrice;
          return {
            id: idx + 1,
            code: item.code,
            name: item.name,
            category: getCategory(item.name),
            price: item.price,
            basePrice,
            profit,
            stock: item.count,
            outOfStock: item.outOfStock ?? false,
            icon: getServiceIcon(item.code, item.name),
          };
        });

        setServices(mapped.length > 0 ? mapped : []);
      } catch {
        setServices([]);
        setServiceError(true);
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, [selectedCountry]);

  // Gabung: data live + fallback ALL_SERVICES jika API gagal
  const activeServices = services.length > 0 ? services : ALL_SERVICES;

  const showToast = useCallback((msg: string) => { 
    setToastMsg(msg); 
    setTimeout(() => setToastMsg(null), 3000); 
  }, []);

  const navigate = (view: string) => { 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
    setCurrentView(view); 
  };

  const handleLogin = (userData: UserData, accessToken?: string) => { 
    setUser(userData);
    // Simpan session + access_token ke sessionStorage sekaligus
    setSecureSession(userData, accessToken);
    showToast("Login successful, welcome " + userData.name + "!"); 
    navigate('dashboard'); 
  };

  const handleLogout = () => { 
    setUser(null);
    clearSecureSession();
    showToast("You have been signed out successfully."); 
    navigate('landing'); 
  };

  // Cek blacklist setiap 30 detik — auto logout jika diblokir
  useEffect(() => {
    if (!user?.email) return;
    const checkBlacklist = async () => {
      try {
        const res = await fetch('/api/auth/check-blacklist', { headers: authHeaders() });
        const data = await res.json();
        if (data.is_blacklisted) {
          setUser(null);
          clearSecureSession();
          navigate('login');
          showToast('Your account has been blocked by an admin.');
        }
      } catch { /* abaikan error jaringan */ }
    };
    checkBlacklist();
    const interval = setInterval(checkBlacklist, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  return (
    <div className="relative text-slate-800 dark:text-slate-200 font-sans selection:bg-indigo-200 selection:text-indigo-900 bg-slate-50 dark:bg-[#060810] min-h-screen transition-colors duration-300" style={{WebkitTapHighlightColor:"transparent"}}>
      
      {/* GLOBAL TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-20 md:top-6 left-1/2 transform -translate-x-1/2 z-[200] bg-slate-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-[calc(100vw-2rem)] text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400 dark:text-green-600" /><span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* Skeleton saat cek session — mencegah flash landing page */}
      {isInitializing ? (
        <AppLoadingSkeleton isDark={isDarkMode} />
      ) : currentView === 'login' || currentView === 'register' ? (
        <AuthView type={currentView} onNavigate={navigate} onAuth={handleLogin} showToast={showToast} isDarkMode={isDarkMode} />
      ) : currentView === 'dashboard' ? (
        <DashboardLayout user={user} onLogout={handleLogout} showToast={showToast} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeServices={activeServices} serviceError={serviceError} countries={countries} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} lang={lang} setLang={setLang} />
      ) : (
        <LandingPage onNavigate={navigate} showToast={showToast} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeServices={activeServices} loadingServices={loadingServices} />
      )}
    </div>
  );
}

// ==========================================
// LANDING PAGE
// ==========================================
interface LandingPageProps {
  onNavigate: (view: string) => void;
  showToast: (msg: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  activeServices: Service[];
  loadingServices?: boolean;
}

function LandingPage({ onNavigate, showToast, isDarkMode, setIsDarkMode, activeServices, loadingServices = false }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showSyarat, setShowSyarat] = useState(false);
  const [showPrivasi, setShowPrivasi] = useState(false);

  // Animation hooks
  // Stats counter — trigger langsung setelah mount (500ms) agar angka selalu muncul
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsOn, setStatsOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setStatsOn(true), 500); return () => clearTimeout(t); }, []);
  const cnt500 = useCountUp(500, 1300, statsOn);
  const cnt50  = useCountUp(50,  1200, statsOn);
  const cnt99  = useCountUp(99,  1000, statsOn);

  useEffect(() => {
    if (isMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; }
  }, [isMenuOpen]);

  const filteredServices = activeServices.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);

  const faqs = [
    { q: "What is Pusat Nokos?", a: "A virtual number service for receiving SMS OTP to safely verify accounts — single-use, instant, and private." },
    { q: "Is my account secure?", a: "Absolutely. We use encryption and account protection systems to ensure your balance and transactions are always safe." },
    { q: "What if I don't receive the OTP?", a: "If the OTP doesn't arrive within the time limit or the order is cancelled, your balance is automatically refunded 100% (Auto Refund)." },
    { q: "Is this service available 24/7?", a: "Yes, our system operates fully automatically around the clock. You can access the service anytime." }
  ];

  const scrollToId = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.preventDefault(); 
    setIsMenuOpen(false);
    const el = document.getElementById(id); 
    if(el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] dark:bg-[#050810] transition-colors duration-300" style={{minHeight:"100svh", overflowX:"clip"}}>
      <style>{`
        @keyframes _heroIn { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        ._h1{animation:_heroIn .55s ease .05s both}
        ._h2{animation:_heroIn .55s ease .20s both}
        ._h3{animation:_heroIn .55s ease .35s both}
        ._h4{animation:_heroIn .55s ease .50s both}
        ._h5{animation:_heroIn .55s ease .65s both}
        @keyframes _orb1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.1)} 66%{transform:translate(-30px,50px) scale(0.95)} }
        @keyframes _orb2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,60px) scale(1.05)} 66%{transform:translate(70px,-30px) scale(0.9)} }
        ._orb1{animation:_orb1 18s ease-in-out infinite}
        ._orb2{animation:_orb2 22s ease-in-out infinite}
        ._dot-grid{background-image:radial-gradient(circle,#6366f130 1px,transparent 1px);background-size:28px 28px}
        .dark ._dot-grid{background-image:radial-gradient(circle,#6366f118 1px,transparent 1px)}
        ._glow-text{text-shadow:0 0 80px rgba(99,102,241,0.3)}
        .dark ._glow-text{text-shadow:0 0 80px rgba(139,92,246,0.5),0 0 160px rgba(99,102,241,0.2)}
        .dark ._glass-card{background:linear-gradient(135deg,rgba(255,255,255,0.07) 0%,rgba(255,255,255,0.02) 100%);border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(12px)}
        ._glass-card{background:rgba(255,255,255,0.95);border:1px solid rgba(255,255,255,0.9)}
        ._chip{transition:transform .2s ease,box-shadow .2s ease}
        ._chip:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(99,102,241,0.2)}
        .dark ._bento-hover:hover{box-shadow:0 0 0 1px rgba(99,102,241,0.4),0 20px 40px rgba(0,0,0,0.4)!important}
        ._bento-hover:hover{box-shadow:0 20px 40px rgba(0,0,0,0.08)!important}
        @keyframes _spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ._spin-slow{animation:_spin-slow 30s linear infinite}
      `}</style>
      <a href={`https://wa.me/${CS_WA}?text=Halo%20CS%20Pusat%20Nokos%2C%20saya%20butuh%20bantuan.`} target="_blank" rel="noopener noreferrer" aria-label="Hubungi Customer Service via WhatsApp"
        className="fixed bottom-6 right-4 z-[90] md:bottom-8 md:right-8 bg-[#25D366] text-white shadow-[0_4px_20px_rgba(37,211,102,0.5)] hover:bg-[#1ebd5a] transition-all hover:scale-105 flex items-center gap-2 group
          w-12 h-12 rounded-full justify-center
          md:w-auto md:h-auto md:rounded-full md:px-4 md:py-3">
        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 shrink-0 md:w-6 md:h-6"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <div className="text-left hidden md:block">
          <div className="text-[10px] font-bold opacity-80 leading-none mb-0.5">Chat Kami</div>
          <div className="text-sm font-black leading-none">WhatsApp CS</div>
        </div>
      </a>

      <nav className="fixed w-full z-50 top-0 transition-all bg-white/70 dark:bg-[#050810]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center">
            <div className="flex items-center cursor-pointer" onClick={() => onNavigate('landing')}>
              <img src="/logo.png" className="h-10 w-10 rounded-xl object-cover" alt="Pusat Nokos" />
              <span className="ml-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Pusat Nokos<span className="text-indigo-600">.</span></span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#beranda" onClick={(e) => scrollToId(e, 'beranda')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Home</a>
              <a href="#cara" onClick={(e) => scrollToId(e, 'cara')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">How It Works</a>
              <a href="#demo" onClick={(e) => scrollToId(e, 'demo')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Pricing & Demo</a>
              <a href="#fitur" onClick={(e) => scrollToId(e, 'fitur')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Security</a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle dark mode" className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => onNavigate('login')} className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2.5 rounded-xl transition hover:bg-slate-100 dark:hover:bg-white/[0.07]">Login</button>
              <button onClick={() => onNavigate('register')} className="text-sm font-bold bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform active:scale-95">Get Started Free</button>
            </div>
            <div className="md:hidden flex items-center space-x-2">
              <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle dark mode" className="p-2 text-slate-500 dark:text-slate-400">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle Menu" className="p-2 text-slate-800 dark:text-slate-200">{isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
            </div>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-[#0a0d16] border-b border-slate-100 dark:border-white/[0.07] absolute w-full shadow-2xl pb-6 px-4 animate-in slide-in-from-top-4">
            <div className="flex flex-col space-y-2 pt-4">
              <a href="#demo" onClick={(e) => scrollToId(e, 'demo')} className="font-bold text-slate-800 dark:text-slate-200 p-3 hover:bg-slate-50 dark:hover:bg-white/[0.07] rounded-xl transition">Pricing & Demo</a>
              <a href="#fitur" onClick={(e) => scrollToId(e, 'fitur')} className="font-bold text-slate-800 dark:text-slate-200 p-3 hover:bg-slate-50 dark:hover:bg-white/[0.07] rounded-xl transition">Security</a>
              <hr className="border-slate-100 dark:border-white/[0.07] my-2" />
              <button onClick={() => onNavigate('login')} className="w-full font-bold border-2 border-slate-200 dark:border-white/[0.09] text-slate-700 dark:text-slate-200 px-4 py-3.5 rounded-xl">Login</button>
              <button onClick={() => onNavigate('register')} className="w-full font-bold bg-indigo-600 text-white px-4 py-3.5 rounded-xl shadow-md">Get Started Free</button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <div id="beranda" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 text-center overflow-hidden">
        {/* Dot grid background */}
        <div className="_dot-grid absolute inset-0 -z-10 opacity-60" />
        {/* Animated orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none overflow-hidden">
          <div className="_orb1 absolute top-[-10%] left-[15%] w-[500px] h-[500px] bg-indigo-500/20 dark:bg-indigo-600/15 blur-[120px] rounded-full" />
          <div className="_orb2 absolute top-[10%] right-[10%] w-[400px] h-[400px] bg-violet-500/15 dark:bg-violet-600/10 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 left-[30%] w-[300px] h-[300px] bg-cyan-400/10 dark:bg-cyan-500/05 blur-[90px] rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center px-4 py-2 rounded-full _glass-card border shadow-sm text-indigo-700 dark:text-indigo-300 text-sm font-bold mb-8 _h1">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 mr-2.5 animate-pulse"></span> Trusted by 50K+ Active Users
          </div>
          <h1 className="_glow-text text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-tight _h2">
            Secure Account <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-600">Verification.</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed _h3">
            Enterprise-level Virtual Number Platform with 100% Auto Refund guarantee and 24/7 stable servers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center _h4">
            <button onClick={() => onNavigate('register')} className="relative flex items-center justify-center px-8 py-4 text-base font-bold rounded-2xl text-white overflow-hidden group shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-1" style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
              <span className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              Open Dashboard <ArrowRight className="ml-2 w-5 h-5"/>
            </button>
            <button onClick={(e) => scrollToId(e, 'fitur')} className="flex items-center justify-center px-8 py-4 border border-slate-200 dark:border-white/10 text-base font-bold rounded-2xl text-slate-700 dark:text-slate-300 _glass-card hover:border-indigo-300 dark:hover:border-indigo-500/50 transition-all hover:-translate-y-0.5">
              <ShieldCheck className="mr-2 w-5 h-5 text-indigo-500 dark:text-indigo-400"/> Explore Features
            </button>
          </div>

          {/* Floating app chips */}
          <div className="flex items-center justify-center gap-2 flex-wrap mt-10 _h5">
            {[
              { name: 'WhatsApp',  domain: 'whatsapp.com'   },
              { name: 'Telegram',  domain: 'telegram.org'   },
              { name: 'Shopee',    domain: 'shopee.co.id'   },
              { name: 'Tokopedia', domain: 'tokopedia.com'  },
              { name: 'Gojek',     domain: 'gojek.com'      },
              { name: 'Instagram', domain: 'instagram.com'  },
              { name: 'TikTok',    domain: 'tiktok.com'     },
              { name: 'Facebook',  domain: 'facebook.com'   },
            ].map(app => (
              <div key={app.name} className="_chip _glass-card border rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-sm text-xs font-bold text-slate-600 dark:text-slate-300">
                <img src={`https://www.google.com/s2/favicons?domain=${app.domain}&sz=32`} width={14} height={14} className="w-3.5 h-3.5 object-contain" alt={app.name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {app.name}
              </div>
            ))}
            <div className="_chip _glass-card border border-indigo-200/50 dark:border-indigo-500/20 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400">+500 more</div>
          </div>

          {/* Stats strip */}
          <div ref={statsRef} className="mt-14 max-w-3xl mx-auto">
            <div className="_glass-card border rounded-3xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-white/[0.06]">
                {[
                  { val: statsOn ? `${cnt500}+` : '0+',  label: 'Services Available', icon: <Package className="w-5 h-5 text-indigo-500"/>,  color: 'text-indigo-600 dark:text-indigo-400', i: 0 },
                  { val: statsOn ? `${cnt50}K+` : '0K+', label: 'Active Users',        icon: <Users className="w-5 h-5 text-violet-500"/>,    color: 'text-violet-600 dark:text-violet-400', i: 1 },
                  { val: statsOn ? `${cnt99}%`  : '0%',  label: 'Success Rate',        icon: <TrendingUp className="w-5 h-5 text-emerald-500"/>, color: 'text-emerald-600 dark:text-emerald-400', i: 2 },
                  { val: '24/7',                          label: 'Server Online',       icon: <Activity className="w-5 h-5 text-sky-500"/>,     color: 'text-sky-600 dark:text-sky-400', i: 3 },
                ].map(s => (
                  <div key={s.label} className="flex flex-col items-center justify-center py-7 px-4 text-center gap-2 hover:-translate-y-1 transition-transform">
                    <div className="w-10 h-10 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/[0.06]">{s.icon}</div>
                    <div className={`text-3xl font-black ${s.color}`}>{s.val}</div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-tight">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CARA KERJA */}
      <div id="cara" className="py-24 bg-slate-50/80 dark:bg-[#07090f] border-y border-slate-200/70 dark:border-white/[0.04] relative overflow-hidden">
        <div className="absolute inset-0 _dot-grid opacity-40 pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-sm mb-3">How It Works</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Just 3 Simple Steps</h2>
            </div>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-indigo-300 dark:via-indigo-500/40 to-transparent"/>
            {[
              { step: '01', icon: <Wallet className="w-7 h-7 text-indigo-500"/>, title: 'Add Balance', desc: 'Top up your balance using available payment methods. Processed automatically in seconds.', glow: 'rgba(99,102,241,0.15)' },
              { step: '02', icon: <ShoppingCart className="w-7 h-7 text-violet-500"/>, title: 'Pick & Buy Number', desc: 'Find the service you need, select a country, and click Buy Number. Number is instantly active.', glow: 'rgba(139,92,246,0.15)' },
              { step: '03', icon: <CheckCircle className="w-7 h-7 text-emerald-500"/>, title: 'Receive OTP Code', desc: 'OTP code appears automatically in your dashboard within seconds. Copy & use it!', glow: 'rgba(16,185,129,0.15)' },
            ].map((s, i) => (
              <FadeInSection key={i} delay={i * 130}>
                <div
                  className="_glass-card _bento-hover relative rounded-3xl p-8 border text-center transition-all"
                  style={{ transition: 'transform .25s ease, box-shadow .25s ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-6px)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; }}
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 relative z-10" style={{background:`radial-gradient(circle, ${s.glow} 0%, transparent 70%)`, boxShadow:`0 0 0 1px ${s.glow}`}}>{s.icon}</div>
                  <div className="absolute top-5 right-6 text-6xl font-black text-slate-100 dark:text-white/[0.04] select-none">{s.step}</div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-3">{s.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </div>

      {/* DEMO HARGA */}
      <div id="demo" className="py-24 text-white relative border-t border-white/[0.06] overflow-hidden" style={{background:'linear-gradient(135deg,#0d1117 0%,#0f0c1e 50%,#0d1117 100%)'}}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-600/10 blur-[100px] rounded-full" />
          <div className="_dot-grid absolute inset-0 opacity-20" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative">
          <div className="order-2 lg:order-1">
            <div className="rounded-[2rem] p-2 border border-white/10 shadow-2xl" style={{background:'rgba(255,255,255,0.04)',backdropFilter:'blur(20px)'}}>
              <div className="bg-[#0d1117] rounded-3xl overflow-hidden text-slate-200 flex flex-col h-[500px] border border-white/[0.06]">
                <div className="p-6 border-b border-white/[0.06] flex justify-between items-center" style={{background:'rgba(99,102,241,0.08)'}}>
                  <div><h3 className="font-bold text-lg text-white">Check Real-time Service Prices</h3><p className="text-xs text-slate-400">Find the app you need</p></div>
                </div>
                <div className="p-4 border-b border-white/[0.06]" style={{background:'#0d1117'}}>
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-500"/>
                    <input type="text" placeholder="e.g. Shopee, Telegram..." className="w-full rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-1 focus:ring-indigo-500 text-base font-medium text-white" style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)'}} id="search-service" name="search" aria-label="Search service" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-[#0a0d16]/50 p-3">
                  {loadingServices ? (
                    // Loading skeleton
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="bg-white dark:bg-[#0f1320] p-3.5 rounded-2xl border border-slate-100 dark:border-white/[0.09] flex justify-between items-center mb-3 animate-pulse">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-slate-200 dark:bg-[#161b28] rounded-xl shrink-0"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded w-24"></div>
                            <div className="h-3 bg-slate-100 dark:bg-[#161b28] rounded w-16"></div>
                          </div>
                        </div>
                        <div className="space-y-2 items-end flex flex-col">
                          <div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded w-20"></div>
                          <div className="h-6 bg-slate-100 dark:bg-[#161b28] rounded w-16"></div>
                        </div>
                      </div>
                    ))
                  ) : filteredServices.length > 0 ? filteredServices.map((s) => (
                    <div key={s.id} className="p-3.5 rounded-2xl flex justify-between items-center mb-2 transition-colors hover:bg-white/5" style={{border:'1px solid rgba(255,255,255,0.06)'}}>
                      <div className="flex items-center space-x-4">
                        <div className="p-2.5 rounded-xl" style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.08)'}}>{s.icon}</div>
                        <div><div className="font-bold text-sm text-white">{s.name}</div><div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Stock: <span className="text-emerald-400">{s.stock}</span></div></div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-indigo-400 text-sm">Rp {s.price.toLocaleString('id-ID')}</div>
                        <button onClick={() => { showToast('Please login to start buying!'); onNavigate('login'); }} className="text-[10px] font-bold px-3.5 py-1.5 rounded-lg mt-1.5 transition-colors hover:bg-indigo-500 hover:text-white text-indigo-400" style={{background:'rgba(99,102,241,0.15)'}}>BUY NUMBER</button>
                      </div>
                    </div>
                  )) : <div className="text-center py-16 text-slate-500 text-sm font-medium"><Search className="w-10 h-10 mx-auto text-slate-600 mb-3"/>No services found.</div>}
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <h2 className="text-indigo-400 font-bold tracking-wide uppercase mb-3 text-sm">Transparent & Real-time</h2>
            <h3 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">Lowest Prices,<br/>Always In Stock.</h3>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Try searching for services in the demo panel without signing up. We guarantee <i>fresh</i> number stock updated in real-time from dozens of countries.
            </p>
            <ul className="space-y-4 text-left inline-block lg:block">
              {[
                'Service prices starting from Rp 1,000 / OTP.',
                'Fully encrypted transactions (End-to-End).',
                'Premium number quality, 99% success rate.',
              ].map(item => (
                <li key={item} className="flex items-center text-slate-300 font-medium">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mr-3 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400"/>
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* BENTO GRID (FITUR KEAMANAN) */}
      <div id="fitur" className="py-24 bg-[#f8f9fc] dark:bg-[#050810] relative overflow-hidden">
        <div className="absolute inset-0 _dot-grid opacity-30 pointer-events-none dark:opacity-20" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <FadeInSection>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-2 text-sm">Security & Trust</h2>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">Enterprise-Level Platform</h3>
            </div>
          </FadeInSection>
          <FadeInSection delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto auto-rows-[minmax(250px,auto)]">
              {/* Box 1: Auto Refund */}
              <div className="_glass-card _bento-hover md:col-span-2 rounded-3xl p-8 border relative overflow-hidden group transition-all"
                style={{ transition: 'transform .25s ease, box-shadow .25s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; }}
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl flex items-center justify-center mb-5"><ShieldAlert className="w-7 h-7 text-indigo-600 dark:text-indigo-400"/></div>
                  <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Auto Refund 100%</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md leading-relaxed">Our smart system tracks every OTP in real-time. If the code doesn't arrive within the waiting period, your balance is automatically returned in full with no deductions.</p>
                </div>
                <RefreshCw className="absolute -right-4 -bottom-12 w-64 h-64 text-indigo-500 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:rotate-180" />
              </div>
              {/* Box 2: Transaksi */}
              <div className="_bento-hover rounded-3xl p-8 flex flex-col justify-center relative overflow-hidden group transition-all"
                style={{ background:'linear-gradient(135deg,#4f46e5,#7c3aed)', transition: 'transform .25s ease, box-shadow .25s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; }}
              >
                <div className="relative z-10">
                  <Wallet className="w-12 h-12 text-indigo-200 mb-5"/>
                  <h4 className="text-xl font-bold mb-2 text-white">Instant Transactions</h4>
                  <p className="text-indigo-200 text-sm leading-relaxed">Deposits processed automatically in seconds. History recorded transparently.</p>
                </div>
                <Zap className="w-40 h-40 text-white opacity-10 absolute -right-8 -bottom-8 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Box 3: Privasi */}
              <div className="_glass-card _bento-hover rounded-3xl p-8 border flex flex-col justify-center relative overflow-hidden group transition-all"
                style={{ transition: 'transform .25s ease, box-shadow .25s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; }}
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl flex items-center justify-center mb-5"><EyeOff className="w-7 h-7 text-slate-700 dark:text-slate-300"/></div>
                  <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Privacy Protected</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Keep your personal number safe from spam, telemarketing, or data breaches.</p>
                </div>
              </div>
              {/* Box 4: Server */}
              <div className="_bento-hover md:col-span-2 text-white rounded-3xl p-8 flex items-center justify-between relative overflow-hidden border border-white/[0.06] group transition-all"
                style={{ background:'linear-gradient(135deg,#0d1117 0%,#0f0c1e 100%)', transition: 'transform .25s ease, box-shadow .25s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; }}
              >
                <div className="w-full sm:w-2/3 relative z-10">
                  <Server className="w-12 h-12 text-sky-400 mb-5"/>
                  <h4 className="text-xl font-bold mb-2">99.9% Stable Infrastructure</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">We use cutting-edge server technology to ensure the platform stays responsive and accessible 24 hours a day without interruption.</p>
                </div>
                <Globe className="hidden sm:block _spin-slow w-48 h-48 text-indigo-500 opacity-10 absolute -right-6 top-1/2 -translate-y-1/2" />
                <div className="absolute inset-0 pointer-events-none" style={{background:'radial-gradient(circle at 80% 50%, rgba(99,102,241,0.08) 0%, transparent 60%)'}} />
              </div>
            </div>
          </FadeInSection>
        </div>
      </div>

      {/* TESTIMONIAL */}
      <div className="py-20 relative border-t border-slate-200/70 dark:border-white/[0.04]" style={{background:'linear-gradient(180deg,#f1f3f9 0%,#f8f9fc 100%)'}}>
        <style>{`.dark .testimonial-section{background:linear-gradient(180deg,#07090f 0%,#050810 100%)!important}`}</style>
        <div className="testimonial-section py-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-sm mb-3">Testimonials</div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Trusted by Thousands of Users</h2>
            </div>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: 'Andi R.', role: 'Online Reseller', text: 'Instantly created a new marketplace account. OTP came in super fast, less than 30 seconds. Highly recommended!', rating: 5, color:'from-indigo-500/10 to-violet-500/5' },
              { name: 'Siti N.', role: 'Freelancer', text: 'Auto refund actually worked when my number failed to receive OTP. Balance returned in seconds. Honest and trustworthy!', rating: 5, color:'from-violet-500/10 to-purple-500/5' },
              { name: 'Budi S.', role: 'Developer', text: "Huge and varied number stock. Can choose from many countries. Prices are competitive — the cheapest I've ever tried.", rating: 5, color:'from-sky-500/10 to-indigo-500/5' },
            ].map((t, i) => (
              <FadeInSection key={i} delay={i * 120}>
                <div className="_glass-card _bento-hover relative rounded-3xl p-7 border transition-all overflow-hidden"
                  style={{ transition: 'transform .25s ease, box-shadow .25s ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${t.color} pointer-events-none rounded-3xl`} />
                  <div className="relative z-10">
                    <div className="flex gap-1 mb-4">
                      {[...Array(t.rating)].map((_, j) => <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400"/>)}
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">"{t.text}"</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-indigo-600 dark:text-indigo-300" style={{background:'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))',border:'1px solid rgba(99,102,241,0.2)'}}>{t.name[0]}</div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</div>
                        <div className="text-xs text-slate-400 font-medium">{t.role}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-[#fafafa] dark:bg-[#060810] py-24 border-t border-slate-200 dark:border-white/[0.07]/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FadeInSection>
            <div className="text-center mb-12"><h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Frequently Asked Questions</h2></div>
          </FadeInSection>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <div className="bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-white/[0.07] rounded-2xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)} 
                    className="w-full px-6 py-5 text-left flex justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.07]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 transition-colors"
                  >
                    {faq.q} <ChevronDown className={"w-5 h-5 text-slate-400 transition-transform " + (activeFaq === i ? 'rotate-180' : '')} />
                  </button>
                  {activeFaq === i && <div className="px-6 pb-5 pt-1 text-slate-600 dark:text-slate-400 text-sm leading-relaxed animate-in slide-in-from-top-2">{faq.a}</div>}
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </div>

      {/* CTA SECTION */}
      <div className="py-24 relative overflow-hidden" style={{background:'linear-gradient(135deg,#3730a3 0%,#4f46e5 40%,#7c3aed 100%)'}}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="_dot-grid absolute inset-0 opacity-20" />
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/10 blur-[80px] rounded-full"/>
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-violet-400/20 blur-[80px] rounded-full"/>
        </div>
        <FadeInSection>
          <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">Ready to Verify<br/>Without the Hassle?</h2>
            <p className="text-indigo-100 text-lg mb-10">Sign up for free. No credit card required. Buy your first OTP number right away.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => onNavigate('register')} className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-indigo-600 font-black text-base rounded-2xl hover:bg-indigo-50 shadow-xl transition-all hover:-translate-y-0.5 active:scale-95">
                Get Started Free <ArrowRight className="w-5 h-5"/>
              </button>
              <button onClick={() => onNavigate('login')} className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-bold text-base rounded-2xl hover:bg-white/10 transition-all">
                Already have an account? Login
              </button>
            </div>
          </div>
        </FadeInSection>
      </div>

      <footer className="bg-white dark:bg-[#030508] pt-10 pb-5 border-t border-slate-200 dark:border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="col-span-2 md:col-span-1 md:pr-6">
              <div className="flex items-center mb-3">
                <img src="/logo.png" className="h-8 w-8 rounded-xl object-cover" alt="Pusat Nokos" />
                <span className="ml-2 text-base font-black text-slate-900 dark:text-white">Pusat Nokos.</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">Platform penyedia nomor virtual otomatis terpercaya untuk verifikasi OTP yang aman dan cepat.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 uppercase text-xs tracking-wider">Services</h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <li><a href="#demo" onClick={(e)=>scrollToId(e as any, 'demo')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Real-time Pricing</a></li>
                <li><a href="#" onClick={() => {onNavigate('login'); showToast("Login to deposit");}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Add Balance</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 uppercase text-xs tracking-wider">Company</h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <li><a href="#" onClick={(e)=>{e.preventDefault(); setShowSyarat(true);}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Terms of Service</a></li>
                <li><a href="#" onClick={(e)=>{e.preventDefault(); setShowPrivasi(true);}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#faq" onClick={(e)=>scrollToId(e as any, 'faq')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Help & FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 uppercase text-xs tracking-wider">Contact Us</h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <li>
                  <a href={`https://wa.me/${CS_WA}?text=Halo%20CS%20Pusat%20Nokos%2C%20saya%20butuh%20bantuan.`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-green-600 dark:hover:text-green-400 transition-colors gap-1.5">
                    <div className="w-3.5 h-3.5 shrink-0"><svg viewBox="0 0 24 24" fill="currentColor" className="text-green-500"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></div>
                    087862306726
                  </a>
                </li>
                <li>
                  <a href={`https://t.me/${CS_TELEGRAM.replace("@","")}`} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-blue-500 dark:hover:text-blue-400 transition-colors gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    {CS_TELEGRAM}
                  </a>
                </li>
                <li>
                  <a href="mailto:cs@pusatnokos.com" className="flex items-center hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    cs@pusatnokos.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-100 dark:border-white/[0.07] pt-4 flex flex-row justify-between items-center gap-2">
            <div className="text-slate-400 dark:text-slate-500 text-xs">&copy; {new Date().getFullYear()} Pusat Nokos. All rights reserved.</div>
            <div className="flex gap-2 shrink-0">
              <span className="bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400">E2E</span>
              <span className="bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400">E2E Encrypted</span>
            </div>
          </div>
        </div>
      </footer>
      {/* ── Modal Syarat & Ketentuan ─────────────────────────────── */}
      {showSyarat && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSyarat(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-2xl"><ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Syarat & Ketentuan</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p>
                </div>
              </div>
              <button onClick={() => setShowSyarat(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">1. Acceptance of Terms</h3>
                <p>By accessing, registering for, or using Pusat Nokos services in any form, you are deemed to have read, understood, and agreed to all the terms and conditions stated here. If you do not agree to any part of these terms, you must immediately stop using our services.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">2. Service Description</h3>
                <p>Pusat Nokos is a virtual phone number (virtual number) provider platform used to receive OTP (One-Time Password) codes from various digital services. Our service is on-demand, meaning numbers are provided in real-time from third-party providers and their availability cannot be fully guaranteed by Pusat Nokos.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">3. Terms of Use</h3>
                <p>Pusat Nokos services may only be used for lawful, legal purposes that comply with applicable laws and regulations in the user's jurisdiction. Users are strictly prohibited from using this service for: (a) fraud, phishing, or social engineering; (b) registering fake accounts or violating third-party service terms; (c) distributing spam, malware, or harmful content; (d) any illegal activity. Violations will result in permanent account suspension without balance compensation.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">4. Balance, Deposit & Refund</h3>
                <p>Balance deposited into your Pusat Nokos account is non-refundable to bank accounts and cannot be withdrawn as cash. Balance can only be used to purchase services on our platform. Automatic balance refund (100% Auto Refund) will be issued when: (a) an OTP code is not received within the allotted time; or (b) the user actively cancels an order before OTP is received. Refunds are processed directly to account balance in seconds.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">5. Service Availability & Quality</h3>
                <p>Pusat Nokos strives to deliver the highest possible uptime but does not guarantee 100% uninterrupted service availability. Number stock for each country and service may change at any time depending on upstream provider availability. We reserve the right to perform system maintenance at any time with or without prior notice.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">6. Responsibility & Limitation of Liability</h3>
                <p>Users are fully responsible for the security of their account, email, and password. Pusat Nokos is not responsible for losses arising from: user negligence, unauthorized access to user accounts, or third-party service failures beyond our control. Under any circumstances, Pusat Nokos's total liability to users shall not exceed the value of the user's active balance at the time of the incident.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">7. Account Suspension & Termination</h3>
                <p>Pusat Nokos reserves the right to unilaterally suspend or terminate user accounts if indications of terms violations, fraudulent activity, or system abuse are found. Suspension decisions are final and do not require detailed explanations in order to maintain overall platform security.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">8. Changes to Terms</h3>
                <p>Pusat Nokos reserves the right to modify, update, or revoke any part or all of these terms at any time without special notice. Changes take effect immediately upon publication on our platform. Continued use of the service after changes constitutes your acceptance of the updated terms.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">9. Governing Law</h3>
                <p>These terms are governed and interpreted in accordance with applicable law. Any disputes arising from use of the service will be resolved amicably where possible, and if no agreement is reached, through applicable legal mechanisms.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">10. Contact Us</h3>
                <p>For questions, complaints, or clarifications regarding these terms, please contact our team via WhatsApp at 087862306726 or via our official email at cs@pusatnokos.com. Our team is ready to help at any time.</p>
              </section>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowSyarat(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kebijakan Privasi ───────────────────────────────── */}
      {showPrivasi && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrivasi(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/40 p-2.5 rounded-2xl"><ShieldAlert className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Kebijakan Privasi</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p>
                </div>
              </div>
              <button onClick={() => setShowPrivasi(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">1. Data We Collect</h3>
                <p>Pusat Nokos mengumpulkan data yang Anda berikan secara langsung pada saat registrasi, antara lain: nama lengkap dan alamat email. Selain itu, kami secara otomatis mencatat data operasional yang diperlukan untuk menjalankan layanan, meliputi: riwayat transaksi dan pembelian nomor OTP, riwayat mutasi saldo, informasi teknis seperti alamat IP dan jenis perangkat untuk keperluan keamanan dan pencegahan penipuan.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">2. Tujuan Penggunaan Data</h3>
                <p>Data yang kami kumpulkan digunakan semata-mata untuk keperluan operasional layanan, meliputi: (a) pengelolaan akun dan autentikasi pengguna; (b) pemrosesan transaksi dan pengembalian saldo (refund); (c) peningkatan kualitas dan keandalan layanan secara berkelanjutan; (d) pengiriman notifikasi penting terkait akun dan transaksi Anda; (e) deteksi dan pencegahan penipuan, penyalahgunaan, serta aktivitas tidak sah; (f) pemenuhan kewajiban hukum dan regulasi yang berlaku.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">3. Keamanan & Perlindungan Data</h3>
                <p>Kami menerapkan standar keamanan industri untuk melindungi data Anda, termasuk enkripsi data saat transmisi (TLS/HTTPS) dan saat penyimpanan. Kata sandi pengguna disimpan dalam format hash terenkripsi menggunakan algoritma yang aman dan tidak dapat dibaca oleh siapapun, termasuk seluruh tim internal Pusat Nokos. Akses ke data pengguna dibatasi hanya kepada personel yang membutuhkan akses tersebut untuk menjalankan tugasnya.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">4. Pembagian Data kepada Pihak Ketiga</h3>
                <p>Pusat Nokos does not sell, rent, or trade your personal data to any third party for commercial purposes. User data may only be shared under the following conditions: (a) with OTP number service provider partners required to process your transactions, under binding confidentiality agreements; (b) with legal authorities when required by valid law or court order; (c) in the event of a business acquisition or merger, where data will remain protected under equivalent terms.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">5. Penyimpanan Sesi & Data Lokal</h3>
                <p>Untuk kenyamanan penggunaan, kami menyimpan data sesi login Anda secara terenkripsi di sessionStorage perangkat Anda. Data ini bersifat sementara dan akan dihapus otomatis saat browser atau tab ditutup. Kami tidak menggunakan cookie pihak ketiga untuk pelacakan aktivitas pengguna di luar platform kami.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">6. Retensi Data</h3>
                <p>We retain account and transaction data for as long as your account is active or as required to operate the service. Transaction history is kept for audit and financial reconciliation purposes. After account deletion, personal data will be anonymised or permanently deleted within 30 business days, unless required by law to be retained longer.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">7. Hak-Hak Pengguna</h3>
                <p>You have the full right to: (a) access and review your personal data we hold; (b) request correction of inaccurate data; (c) request deletion of your account and all personal data at any time; (d) object to certain data processing. To exercise these rights, please contact our CS team. Account deletion will be processed within a maximum of 7 business days.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">8. Privacy Policy Changes</h3>
                <p>This privacy policy may be updated at any time to reflect changes in our service practices or applicable regulations. Significant changes will be notified via platform notifications or registered email. Continued use of the service after changes are published constitutes your acceptance. For questions about this policy, please contact us at cs@pusatnokos.com.</p>
              </section>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowPrivasi(false)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
interface AuthViewProps {
  type: string;
  onNavigate: (view: string) => void;
  onAuth: (user: UserData, accessToken?: string) => void;
  showToast: (msg: string) => void;
  isDarkMode: boolean;
}

// ── Standalone components — HARUS di luar AuthView agar tidak re-mount saat re-render ──
function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Verification Code (6 digits)</label>
      <input
        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required
        value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
        className="w-full px-6 py-5 bg-slate-50 dark:bg-[#0f1320] border-2 border-slate-200 dark:border-white/[0.09] rounded-2xl outline-none focus:border-indigo-500 dark:text-white text-3xl font-black tracking-[0.5em] text-center transition-all"
        placeholder="000000"
      />
      <p className="text-xs text-slate-400 mt-2 text-center">Valid for 10 minutes</p>
    </div>
  );
}
function ResendRow({ onBack, onResend, countdown, isLoading }: {
  onBack: () => void;
  onResend: () => void;
  countdown: number;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button type="button" onClick={onBack} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition">← Back</button>
      <button type="button" onClick={onResend} disabled={countdown > 0 || isLoading} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 disabled:text-slate-400 disabled:cursor-not-allowed transition">
        {countdown > 0 ? `Resend (${countdown}s)` : "Resend"}
      </button>
    </div>
  );
}

function AuthView({ type, onNavigate, onAuth, showToast, isDarkMode }: AuthViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [isLoading,    setIsLoading]    = useState(false);
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [confirmPass,  setConfirmPass]  = useState('');
  const [name,         setName]         = useState('');
  const [error,        setError]        = useState('');
  const [step,         setStep]         = useState<'form' | 'verify' | 'forgot' | 'reset'>('form');
  const [otpCode,      setOtpCode]      = useState('');
  const [countdown,    setCountdown]    = useState(0);

  // Cloudflare Turnstile
  const [turnstileToken,     setTurnstileToken]     = useState<string | null>(null);
  const turnstileLoginRef    = useRef<HTMLDivElement>(null);
  const turnstileRegisterRef = useRef<HTMLDivElement>(null);
  const turnstileLoginId     = useRef<string | null>(null);
  const turnstileRegisterId  = useRef<string | null>(null);

  const isLogin = type === 'login';

  // Load Turnstile script sekali
  useEffect(() => {
    if (document.getElementById('cf-turnstile-script')) return;
    const s = document.createElement('script');
    s.id  = 'cf-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true; s.defer = true;
    document.head.appendChild(s);
  }, []);

  // Render widget Turnstile setiap kali step = 'form'
  useEffect(() => {
    if (step !== 'form') return;
    const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
    if (!sitekey) return;

    const tryRender = () => {
      const w = (window as any).turnstile;
      if (!w) { setTimeout(tryRender, 300); return; }

      if (isLogin && turnstileLoginRef.current && !turnstileLoginId.current) {
        turnstileLoginId.current = w.render(turnstileLoginRef.current, {
          sitekey,
          theme   : isDarkMode ? 'dark' : 'light',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null),
          'error-callback'  : () => setTurnstileToken(null),
        });
      }
      if (!isLogin && turnstileRegisterRef.current && !turnstileRegisterId.current) {
        turnstileRegisterId.current = w.render(turnstileRegisterRef.current, {
          sitekey,
          theme   : isDarkMode ? 'dark' : 'light',
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(null),
          'error-callback'  : () => setTurnstileToken(null),
        });
      }
    };
    tryRender();

    return () => {
      const w = (window as any).turnstile;
      if (!w) return;
      if (turnstileLoginId.current)    { w.remove(turnstileLoginId.current);    turnstileLoginId.current    = null; }
      if (turnstileRegisterId.current) { w.remove(turnstileRegisterId.current); turnstileRegisterId.current = null; }
      setTurnstileToken(null);
    };
  }, [step, isLogin, isDarkMode]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Rate limiting: maks 5 gagal login per 15 menit (client-side guard) ──
  const MAX_ATTEMPTS  = 5;
  const LOCKOUT_MS    = 15 * 60 * 1000; // 15 menit
  const getRateKey    = () => `rl_${email.toLowerCase().trim()}`;

  const checkRateLimit = (): { blocked: boolean; remaining: number; unlockIn: string } => {
    try {
      const raw = localStorage.getItem(getRateKey());
      if (!raw) return { blocked: false, remaining: MAX_ATTEMPTS, unlockIn: '' };
      const { count, firstAt } = JSON.parse(raw) as { count: number; firstAt: number };
      const elapsed = Date.now() - firstAt;
      if (elapsed > LOCKOUT_MS) {
        localStorage.removeItem(getRateKey());
        return { blocked: false, remaining: MAX_ATTEMPTS, unlockIn: '' };
      }
      const blocked   = count >= MAX_ATTEMPTS;
      const remaining = Math.max(0, MAX_ATTEMPTS - count);
      const unlockSec = Math.ceil((LOCKOUT_MS - elapsed) / 1000);
      const unlockIn  = unlockSec > 60 ? `${Math.ceil(unlockSec / 60)} menit` : `${unlockSec} detik`;
      return { blocked, remaining, unlockIn };
    } catch { return { blocked: false, remaining: MAX_ATTEMPTS, unlockIn: '' }; }
  };

  const recordFailedAttempt = () => {
    try {
      const raw = localStorage.getItem(getRateKey());
      const prev = raw ? JSON.parse(raw) as { count: number; firstAt: number } : { count: 0, firstAt: Date.now() };
      const updated = { count: prev.count + 1, firstAt: prev.firstAt };
      safeLocalSet(getRateKey(), JSON.stringify(updated));
    } catch {}
  };

  const clearAttempts = () => {
    try { localStorage.removeItem(getRateKey()); } catch {}
  };

  // ── LOGIN ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email dan password wajib diisi.'); return; }
    if (!turnstileToken) { setError('Harap selesaikan verifikasi CAPTCHA.'); return; }
    // Rate limit check
    const rl = checkRateLimit();
    if (rl.blocked) {
      setError(`Terlalu banyak percobaan gagal. Coba lagi dalam ${rl.unlockIn}.`);
      return;
    }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        recordFailedAttempt();
        const rlAfter = checkRateLimit();
        const hint = rlAfter.remaining > 0
          ? ` (${rlAfter.remaining} percobaan tersisa)`
          : ` — akun dikunci ${rlAfter.unlockIn}`;
        setError((data.error ?? 'Email atau password salah.') + hint);
        return;
      }
      clearAttempts(); // reset rate limit setelah login berhasil
      onAuth({ name: data.user.name, email: data.user.email }, data.access_token);
      showToast(`Selamat datang kembali, ${data.user.name}!`);
    } catch { setError('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  // ── REGISTER step 1: submit form ───────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name)  { setError('Nama wajib diisi.'); return; }
    if (password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    if (password !== confirmPass) { setError('Passwords do not match.'); return; }
    if (!turnstileToken) { setError('Harap selesaikan verifikasi CAPTCHA.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, turnstileToken }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Gagal mendaftar.'); return; }
      setStep('verify');
      setCountdown(60);
      showToast(`Kode verifikasi dikirim ke ${email}`);
    } catch { setError('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  // ── REGISTER step 2: verifikasi kode ──────────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.length !== 6) { setError('Kode harus 6 digit.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Kode salah.'); return; }
      onAuth({ name: data.user.name, email: data.user.email }, data.access_token);
      showToast(`Akun berhasil dibuat, selamat datang ${data.user.name}!`);
    } catch { setError('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  // ── FORGOT PASSWORD: kirim kode reset ─────────────────────────────
  const handleForgotSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email) { setError('Email wajib diisi.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, isRegister: false, isReset: true }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Gagal mengirim kode.'); return; }
      setStep('reset');
      setCountdown(60);
      showToast(`Kode reset dikirim ke ${email}`);
    } catch { setError('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  // ── RESET PASSWORD: verifikasi kode + password baru ────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.length !== 6) { setError('Kode harus 6 digit.'); return; }
    if (password.length < 6)  { setError('Password minimal 6 karakter.'); return; }
    if (password !== confirmPass) { setError('Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Gagal reset password.'); return; }
      showToast('Password changed successfully! Please login.');
      setStep('form');
      setPassword(''); setConfirmPass(''); setOtpCode('');
      onNavigate('login');
    } catch { setError('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    setError(''); setIsLoading(true);
    try {
      const isReset = step === 'reset';
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, isRegister: !isReset && !isLogin, isReset }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Failed to resend.'); return; }
      setCountdown(60); setOtpCode('');
      showToast('Kode baru telah dikirim!');
    } catch { setError('Failed to resend.'); }
    finally { setIsLoading(false); }
  };

  const inputCls = "w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl outline-none focus:bg-white dark:focus:bg-[#0a0d16] focus:ring-2 focus:ring-indigo-500/50 dark:text-white text-base font-medium transition-all";
  const btnCls   = (loading: boolean) => "w-full flex justify-center items-center py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-70 " + (loading ? "bg-indigo-400" : "bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700");

  const ErrorBox = () => error ? (
    <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 rounded-2xl">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words min-w-0">{error}</span>
    </div>
  ) : null;

  const titles: Record<string, string> = {
    form:   isLogin ? "Welcome Back" : "Create Account",
    verify : "Verify Email",
    forgot : "Forgot Password",
    reset  : "Reset Password",
  };
  const subtitles: Record<string, React.ReactNode> = {
    form:   <>{isLogin ? "Don't have an account? " : "Already have an account? "}<button onClick={() => onNavigate(isLogin ? "register" : "login")} className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition">{isLogin ? "Sign Up" : "Login"}</button></>,
    verify : <span>Code sent to <strong className="text-slate-800 dark:text-white">{email}</strong></span>,
    forgot : "Enter your email to receive a reset code",
    reset  : <span>Reset code sent to <strong className="text-slate-800 dark:text-white">{email}</strong></span>,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060810] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300" style={{minHeight:"100svh"}}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[min(800px,100vh)] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="mx-auto w-full max-w-md text-center mb-8 relative z-10">
        <div className="flex justify-center cursor-pointer mb-6 hover:scale-105 transition-transform" onClick={() => onNavigate("landing")}>
          <img src="/logo.png" className="h-16 w-16 rounded-2xl object-cover shadow-md" alt="Pusat Nokos" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{titles[step]}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">{subtitles[step]}</p>
      </div>

      <div className="mx-auto w-full max-w-md bg-white/90 dark:bg-[#0a0d16]/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl border border-slate-200/50 dark:border-white/[0.07]/50 rounded-3xl relative z-10" style={{paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom,0px))"}}>

        {/* ── LOGIN FORM ── */}
        {step === "form" && isLogin && (
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Email Address</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="login-email" name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="Your email" aria-label="Email" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">Password</label>
                <button type="button" onClick={() => { setStep("forgot"); setError(""); }} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800">Forgot password?</button>
              </div>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="••••••••" aria-label="Password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <ErrorBox />
            {/* Cloudflare Turnstile */}
            <div ref={turnstileLoginRef} className="flex justify-center" />
            <button type="submit" disabled={isLoading || !turnstileToken} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : null}
              {isLoading ? "Processing..." : "Login to Dashboard"}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {step === "form" && !isLogin && (
          <form className="space-y-5" onSubmit={handleRegister}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Full Name</label>
              <div className="relative"><User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="reg-name" name="name" type="text" required value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Your Name" aria-label="Name" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Email Address</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="login-email" name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="Your email" aria-label="Email" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Password</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="reg-password" name="password" type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="Min. 6 characters" aria-label="New password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Confirm Password</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="reg-confirm" name="confirm_password" type={showConfirm ? "text" : "password"} required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className={inputCls + " pr-12"} placeholder="Repeat password" aria-label="Confirm password" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showConfirm ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <ErrorBox />
            {/* Cloudflare Turnstile */}
            <div ref={turnstileRegisterRef} className="flex justify-center" />
            <button type="submit" disabled={isLoading || !turnstileToken} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : null}
              {isLoading ? "Sending Code..." : "Sign Up"}
            </button>
          </form>
        )}

        {/* ── VERIFY EMAIL (setelah register) ── */}
        {step === "verify" && (
          <form className="space-y-5" onSubmit={handleVerify}>
            <OtpInput value={otpCode} onChange={setOtpCode} />
            <ErrorBox />
            <button type="submit" disabled={isLoading || otpCode.length !== 6} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : <CheckCircle2 className="w-5 h-5 mr-2"/>}
              {isLoading ? "Verifying..." : "Activate Account"}
            </button>
            <ResendRow onBack={() => { setStep("form"); setError(""); setOtpCode(""); }} onResend={handleResendOTP} countdown={countdown} isLoading={isLoading} />
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {step === "forgot" && (
          <form className="space-y-5" onSubmit={handleForgotSend}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Email Address</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="login-email" name="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="Your email" aria-label="Email" />
              </div>
            </div>
            <ErrorBox />
            <button type="submit" disabled={isLoading} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : <Mail className="w-5 h-5 mr-2"/>}
              {isLoading ? "Sending..." : "Send Reset Code"}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setStep("form"); setError(""); }} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition">← Back to Login</button>
            </div>
          </form>
        )}

        {/* ── RESET PASSWORD ── */}
        {step === "reset" && (
          <form className="space-y-5" onSubmit={handleReset}>
            <OtpInput value={otpCode} onChange={setOtpCode} />
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">New Password</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="reg-password" name="password" type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="Min. 6 characters" aria-label="New password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Confirm Password</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input id="reset-confirm" name="confirm_password" type={showConfirm ? "text" : "password"} required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className={inputCls + " pr-12"} placeholder="Repeat new password" aria-label="Confirm new password" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showConfirm ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <ErrorBox />
            <button type="submit" disabled={isLoading || otpCode.length !== 6} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : <CheckCircle2 className="w-5 h-5 mr-2"/>}
              {isLoading ? 'Sending...' : 'Verify'}
            </button>
            <ResendRow onBack={() => { setStep("forgot"); setError(""); setOtpCode(""); }} onResend={handleResendOTP} countdown={countdown} isLoading={isLoading} />
          </form>
        )}
      </div>
    </div>
  );
}


// ==========================================
// DASHBOARD LAYOUT & SIDEPANEL
// ==========================================
interface DashboardLayoutProps {
  user: UserData | null;
  onLogout: () => void;
  showToast: (msg: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  activeServices: Service[];
  serviceError?: boolean;
  countries: Country[];
  selectedCountry: string;
  setSelectedCountry: (val: string) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
}

function DashboardLayout({ user, onLogout, showToast, isDarkMode, setIsDarkMode, activeServices, serviceError, countries, selectedCountry, setSelectedCountry, lang, setLang }: DashboardLayoutProps) {
  const t = T[lang];
  const [activeTab, setActiveTab] = useState<string>('buy');
  const [balance, setBalance] = useState<number>(user?.balance ?? 0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mutasi, setMutasi] = useState<Mutasi[]>([]);
  const [favorites, setFavorites] = useState<number[]>([1, 2]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [autoRetryQueue, setAutoRetryQueue] = useState<{serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[]>([]);

  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [showSyaratDash,     setShowSyaratDash]     = useState<boolean>(false);
  const [showPrivasiDash,    setShowPrivasiDash]    = useState<boolean>(false);
  const [showRefundDash,     setShowRefundDash]     = useState<boolean>(false);
  const [showDepositDash,    setShowDepositDash]    = useState<boolean>(false);
  const [showAntiAbuseDash,  setShowAntiAbuseDash]  = useState<boolean>(false);
  const [showDisclaimerDash, setShowDisclaimerDash] = useState<boolean>(false);
  const [showLegalMenu,      setShowLegalMenu]      = useState<boolean>(false);
  // Blacklist nomor yang pernah gagal/expired (shared ke BuyView)
  const failedNumbers = useRef<Set<string>>(new Set());

  // ── Fetch saldo + order dari Supabase saat pertama load ────────────
  useEffect(() => {
    if (!user?.email) return;

    // Fetch saldo
    fetch('/api/user/balance', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (typeof d.balance === 'number') setBalance(d.balance); })
      .catch(() => {});

    // Fetch orders aktif
    fetch('/api/user/orders', { headers: authHeaders() })
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const mapped: Order[] = data.map(o => ({
          id           : o.id,
          activationId : o.activation_id,
          date         : new Date(o.created_at).toLocaleString('id-ID'),
          serviceName  : o.service_name,
          price        : o.price,
          icon         : <Smartphone className="w-5 h-5" />,
          number       : o.phone,
          // 'success' dari DB → tetap 'success' jika masih <10 menit (agar OTP masih tampil setelah refresh)
          // 'success' >10 menit → 'completed' agar tidak muncul di panel aktif
          // 'waiting' yang sudah lewat 20 menit → 'expired'
          status       : o.status === 'success'
            ? (Date.now() - new Date(o.created_at).getTime() < 10 * 60 * 1000
                ? 'success' as Order['status']
                : 'completed' as Order['status'])
            : (o.status === 'waiting' && Date.now() - new Date(o.created_at).getTime() > 1200000)
              ? 'expired' as Order['status']
              : o.status as Order['status'],
          timeLeft     : Math.max(0, 1200 - Math.floor((Date.now() - new Date(o.created_at).getTime()) / 1000)),
          otpCode      : o.otp_code ?? null,
          isV2         : o.is_v2 ?? false,
        }));
        setOrders(mapped);
      })
      .catch(() => {});
  }, [user?.email]);

  // ── Fetch papan info dari admin ──────────────────────────────────────
  const [notices, setNotices] = useState<{ id: number; title: string; content: string; type: string }[]>([]);

  useEffect(() => {
    fetch('/api/notice')
      .then(r => r.json())
      .then((data: any[]) => { if (Array.isArray(data)) setNotices(data); })
      .catch(() => {});
  }, []);

  // ── Fetch broadcast dari admin saat login ─────────────────────────
  useEffect(() => {
    if (!user?.email) return;
    fetch('/api/broadcast')
      .then(r => r.json())
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) return;
        const TYPE_EMOJI: Record<string, string> = {
          info: 'ℹ️', promo: '🎉', warning: '⚠️', maintenance: '🔧'
        };
        const broadcastNotifs = data.map(b => ({
          id     : Date.now() + b.id,
          msg    : `${TYPE_EMOJI[b.type] ?? 'ℹ️'} ${b.title}: ${b.message}`,
          time   : new Date(b.created_at).toLocaleString('id-ID'),
          read   : false,
        }));
        setNotifItems(prev => [...broadcastNotifs, ...prev].slice(0, 20));
        setNotifCount(c => c + broadcastNotifs.length);
      })
      .catch(() => {});
  }, [user?.email]);

  // ── Helper: update saldo di Supabase + state ───────────────────────
  // ✅ Fetch saldo terbaru dari DB
  const refreshBalance = async () => {
    if (!user?.email) return;
    try {
      const res = await fetch('/api/user/balance', { headers: authHeaders() });
      const d = await res.json();
      if (typeof d.balance === 'number') setBalance(d.balance);
    } catch {}
  };

  const updateBalance = async (amount: number, type: 'add' | 'subtract', activationId?: string) => {
    if (!amount || amount <= 0) return;
    const prevBal = balance;
    const newBal = type === 'add' ? balance + amount : Math.max(0, balance - amount);
    setBalance(newBal);
    if (!user?.email) return;
    try {
      const res = await fetch('/api/user/balance', {
        method : 'PATCH',
        headers: authHeaders({ 'X-User-Email': user.email }),
        body   : JSON.stringify({ email: user.email, amount, type, activationId }),
      });

      if (res.ok) return; // sukses

      if (res.status === 409 || (res.status === 400 && type === 'add')) {
        // 409 = double refund, 400 + add = server sudah proses via webhook
        // Jangan rollback — sync saldo dari DB untuk memastikan angka benar
        console.info('[balance] Refund sudah diproses server:', activationId);
        setTimeout(() => refreshBalance(), 600);
        return;
      }

      if (res.status === 400 && type === 'subtract') {
        // Beli nomor gagal → rollback saldo lokal
        setBalance(prevBal);
        showToast('Transaksi gagal diproses. Coba lagi.');
        return;
      }

      if (res.status === 401) {
        // Token expired → gunakan onLogout yang sudah tersedia
        setBalance(prevBal);
        showToast('Sesi berakhir. Silakan login kembali.');
        setTimeout(() => onLogout(), 1500);
      }
    } catch { /* network error — optimistic update tetap */ }
  };

  const handleCancelOrder = async (orderId: number) => {
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!orderToCancel || orderToCancel.status !== 'waiting') return;

    // ✅ Tandai di ref SEGERA — cegah polling refund lagi sebelum React re-render
    ordersRef.current = ordersRef.current.map(o =>
      o.id === orderId ? { ...o, status: 'cancelled' as Order['status'], timeLeft: 0 } : o
    );

    if (orderToCancel.activationId) {
      try {
        await fetch('/api/order', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: orderToCancel.activationId, action: 'cancel' }),
        });
      } catch { /* lanjutkan refund meski API gagal */ }
    }

    // ✅ Kirim activationId → backend cegah double refund via idempotency check
    await updateBalance(orderToCancel.price, 'add', orderToCancel.activationId);
    // Update status order di Supabase + kirim email untuk validasi ownership
    fetch('/api/user/orders', {
      method : 'PATCH',
      headers: authHeaders(),
      body   : JSON.stringify({ email: user?.email, activationId: orderToCancel.activationId, status: 'cancelled' }),
    }).catch(() => {});

    setOrders(current => current.map(order =>
      order.id === orderId ? { ...order, status: 'cancelled', timeLeft: 0 } : order
    ));
    showToast('Order cancelled. Balance Rp ' + orderToCancel.price.toLocaleString('id-ID') + ' refunded.');
    // ✅ Refresh saldo dari DB agar tampilan selalu akurat
    setTimeout(() => refreshBalance(), 1000);
  };

  const [notifCount,  setNotifCount]  = useState(0);
  const [notifItems,  setNotifItems]  = useState<{ id: number; msg: string; time: string; read: boolean }[]>([]);
  const [showNotif,   setShowNotif]   = useState(false);

  // Tambah notifikasi baru — stable setter, aman dipanggil dari dalam interval/SSE
  const addNotif = useCallback((msg: string) => {
    const item = { id: Date.now(), msg, time: new Date().toLocaleTimeString('id-ID'), read: false };
    setNotifItems(prev => [item, ...prev].slice(0, 20));
    setNotifCount(c => c + 1);
  }, []);

  // Ref selalu berisi orders terbaru — agar interval tidak perlu di-reset setiap render
  const ordersRef = useRef(orders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);


  // ── Polling OTP setiap 5 detik ─────────────────────────────────────
  useEffect(() => {
    // SSE: terima notifikasi OTP real-time dari webhook
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/webhook/stream');
      es.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (!event.activationId || !event.smsCode) return;
          setOrders(current => current.map(o => {
            if (o.activationId !== event.activationId) return o;
            if (o.isV2) {
              const otpCodes = [...(o.otpCodes ?? []), { service: event.service, code: event.smsCode }];
              return { ...o, status: 'success', otpCodes, autoDismissAt: Date.now() + 10 * 60 * 1000 };
            }
            return { ...o, status: 'success', otpCode: event.smsCode, autoDismissAt: Date.now() + 10 * 60 * 1000 };
          }));
          // Auto-dismiss dari panel aktif setelah 10 menit
          setTimeout(() => {
            setOrders(cur => cur.map(o =>
              o.activationId === event.activationId && o.status === 'success'
                ? { ...o, status: 'completed' as Order['status'] }
                : o
            ));
          }, 10 * 60 * 1000);
          showToast(`OTP masuk: ${event.smsCode}`);
          addNotif(`🔑 OTP masuk untuk ${event.service ?? 'pesanan kamu'}: ${event.smsCode}`);
        } catch { /* abaikan parse error */ }
      };
      es.onerror = () => { es?.close(); es = null; };
    } catch { /* fallback ke polling */ }

    // Polling fallback setiap 5 detik — pakai ordersRef agar tidak stale
    const pollInterval = setInterval(async () => {
      const waitingOrders = ordersRef.current.filter(o => o.status === 'waiting');
      for (const order of waitingOrders) {
        if (!order.activationId) continue;
        try {
          const endpoint = order.isV2
            ? `/api/order-v2?id=${order.activationId}`
            : `/api/order?id=${order.activationId}`;
          const res  = await fetch(endpoint);
          const data = await res.json();

          if (data.status === 'ok') {
            if (order.isV2 && Array.isArray(data.otpCodes) && data.otpCodes.length > 0) {
              const otpCodes = data.otpCodes.map((code: string, i: number) => ({
                service: order.bundleServices?.[i] ?? `Service ${i + 1}`,
                code,
              }));
              setOrders(current => current.map(o =>
                o.id === order.id ? { ...o, status: 'success', otpCodes, autoDismissAt: Date.now() + 10 * 60 * 1000 } : o
              ));
              fetch('/api/user/orders', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ activationId: order.activationId, status: 'success', otpCode: data.otpCodes[0] }) }).catch(() => {});
              showToast(`OTP bundle ${order.serviceName} masuk!`);
              addNotif(`🔑 OTP Bundle ${order.serviceName} masuk!`);
              setTimeout(() => {
                setOrders(cur => cur.map(o =>
                  o.id === order.id && o.status === 'success' ? { ...o, status: 'completed' as Order['status'] } : o
                ));
              }, 10 * 60 * 1000);
            } else if (!order.isV2 && data.otpCode) {
              setOrders(current => current.map(o =>
                o.id === order.id ? { ...o, status: 'success', otpCode: data.otpCode, autoDismissAt: Date.now() + 10 * 60 * 1000 } : o
              ));
              fetch('/api/user/orders', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ activationId: order.activationId, status: 'success', otpCode: data.otpCode }) }).catch(() => {});
              showToast(`OTP code for ${order.serviceName} received!`);
              addNotif(`🔑 OTP ${order.serviceName}: ${data.otpCode}`);
              setTimeout(() => {
                setOrders(cur => cur.map(o =>
                  o.id === order.id && o.status === 'success' ? { ...o, status: 'completed' as Order['status'] } : o
                ));
              }, 10 * 60 * 1000);
            }
          } else if (data.status === 'cancel') {
            // ✅ Update ref dulu — cegah polling berikutnya refund lagi
            ordersRef.current = ordersRef.current.map(o =>
              o.id === order.id ? { ...o, status: 'cancelled' as Order['status'], timeLeft: 0 } : o
            );
            setOrders(current => current.map(o =>
              o.id === order.id ? { ...o, status: 'cancelled', timeLeft: 0 } : o
            ));
            fetch('/api/user/orders', { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ activationId: order.activationId, status: 'cancelled' }) }).catch(() => {});
            // ✅ Kirim activationId → backend cegah double refund via idempotency check
            await updateBalance(order.price, 'add', order.activationId);
            showToast(`Number ${order.serviceName} cancelled by provider. Balance Rp ${order.price.toLocaleString()} refunded.`);
            addNotif(`↩ Refund Rp ${order.price.toLocaleString('id-ID')} untuk ${order.serviceName} berhasil refunded.`);
            // ✅ Refresh saldo dari DB
            setTimeout(() => refreshBalance(), 1000);
          }
        } catch { /* abaikan error jaringan sementara */ }
      }
    }, 3000);

    return () => {
      es?.close();
      clearInterval(pollInterval);
    };
  }, [showToast, addNotif]); // showToast & addNotif stable (useCallback) — interval dibuat SEKALI saja

  // ── Countdown timer setiap detik ────────────────────────────────────
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setOrders(current => {
        const expiredOrders: Order[] = [];
        const updated = current.map(order => {
          if (order.status !== 'waiting') return order;
          const newTimeLeft = order.timeLeft - 1;
          if (newTimeLeft <= 0) {
            expiredOrders.push(order);
            return { ...order, status: 'expired' as const, timeLeft: 0 };
          }
          return { ...order, timeLeft: newTimeLeft };
        });

        if (expiredOrders.length > 0) {
          setTimeout(() => {
            expiredOrders.forEach(order => {
              // ✅ Refund ditangani SEPENUHNYA oleh cron job — tidak refund dari frontend
              // Ini mencegah race condition antara frontend timer dan cron job
              showToast(`⏱ Number ${order.serviceName} expired. Balance will be auto refunded.`);
              if (order.number) failedNumbers.current.add(order.number);
              setAutoRetryQueue(prev => [...prev, {
                serviceName: order.serviceName,
                serviceCode: '',
                price: order.price,
                icon: order.icon,
              }]);
            });
          }, 0);
        }

        return updated;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [showToast, updateBalance]);

  const navItems: NavItem[] = [
    { id: 'dashboard', name: t.dashboard, icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'buy',       name: t.buy,       icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'topup',     name: t.topup,     icon: <CreditCard className="w-5 h-5" /> },
    { id: 'history',   name: t.history,   icon: <History className="w-5 h-5" /> },
    { id: 'mutasi',    name: t.mutasi,    icon: <Receipt className="w-5 h-5" /> },
    { id: 'profile',   name: t.profile,   icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#f4f5f9] dark:bg-[#060810] flex flex-col md:flex-row font-sans relative transition-colors duration-300 overflow-x-hidden" style={{minHeight:"100svh"}}>
      <style>{`
        /* ── Dashboard dark mode depth ── */
        .dark .dash-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%) !important;
          border-color: rgba(255,255,255,0.07) !important;
          backdrop-filter: blur(8px);
        }
        .dark .dash-table {
          background: linear-gradient(180deg, #0d1020 0%, #0a0d18 100%) !important;
        }
        .dark .dash-row:hover { background: rgba(255,255,255,0.04) !important; }
        .dark .dash-thead { background: rgba(6,8,16,0.8) !important; }
        .dark .dash-input {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        .dark .dash-input:focus {
          background: rgba(255,255,255,0.07) !important;
          border-color: rgba(99,102,241,0.5) !important;
        }
        .dark .dash-badge {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        .dark .dash-section {
          background: linear-gradient(180deg,#060810 0%,#07090f 100%);
        }
        /* Subtle dot grid on main content */
        .dark main::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          z-index: 0;
        }
        main > * { position: relative; z-index: 1; }
        /* Stat cards gradient glow */
        .dark .stat-card-indigo { background: linear-gradient(135deg,rgba(79,70,229,0.12),rgba(79,70,229,0.04)) !important; border-color: rgba(79,70,229,0.2) !important; }
        .dark .stat-card-green  { background: linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.04)) !important; border-color: rgba(16,185,129,0.2) !important; }
        .dark .stat-card-amber  { background: linear-gradient(135deg,rgba(245,158,11,0.12),rgba(245,158,11,0.04)) !important; border-color: rgba(245,158,11,0.2) !important; }
        .dark .stat-card-blue   { background: linear-gradient(135deg,rgba(59,130,246,0.12),rgba(59,130,246,0.04)) !important; border-color: rgba(59,130,246,0.2) !important; }
      `}</style>
      
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:flex flex-col w-72 border-r border-slate-200/80 dark:border-white/[0.06] fixed h-full z-10 transition-colors duration-300 bg-white dark:bg-[#0b0e1a] shadow-sm dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)]">
        <div className="h-[80px] flex items-center px-8 border-b border-slate-100 dark:border-white/[0.06]">
          <img src="/logo.png" className="h-10 w-10 rounded-xl object-cover mr-3" alt="Pusat Nokos" />
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">PusatNokos.</span>
        </div>
        <div className="p-8 border-b border-slate-100 dark:border-white/[0.06]" style={{background:'rgba(99,102,241,0.03)'}}>
          <div className="text-[11px] text-slate-500 dark:text-slate-500 font-bold mb-2 tracking-widest uppercase">{t.totalBalance.toUpperCase()}</div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">Rp {balance.toLocaleString('id-ID')}</div>
        </div>
        <div className="flex-1 py-6 px-5 space-y-1.5 overflow-y-auto">
          {navItems.map(i => (
            <button key={i.id} onClick={() => setActiveTab(i.id)} className={"w-full flex items-center px-4 py-3.5 text-[14px] font-bold rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 " + (activeTab === i.id ? 'text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-white/[0.06] hover:text-indigo-600 dark:hover:text-indigo-300')}
              style={activeTab === i.id ? {background:'linear-gradient(135deg,#4f46e5,#7c3aed)',boxShadow:'0 4px 16px rgba(79,70,229,0.35)'} : {}}>
              <div className={"mr-4 " + (activeTab === i.id ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500')}>{i.icon}</div>{i.name}
            </button>
          ))}
        </div>
        {/* Bottom sidebar: Dokumen Legal */}
        <div className="p-5 border-t border-slate-100 dark:border-white/[0.07] relative">
          <button onClick={() => setShowLegalMenu(v => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-[#0f1320] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-400 font-bold rounded-2xl transition-all text-sm">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
              {t.legalDocs}
            </div>
            <ChevronDown className={"w-4 h-4 transition-transform " + (showLegalMenu ? 'rotate-180' : '')} />
          </button>
          {showLegalMenu && (
            <div className="mt-2 bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-lg overflow-hidden">
              {[
                { label: t.legalTerms,    icon: <ShieldCheck className="w-4 h-4 text-indigo-400" />,  action: () => { setShowSyaratDash(true);     setShowLegalMenu(false); } },
                { label: t.legalPrivacy,     icon: <ShieldAlert className="w-4 h-4 text-green-400" />,  action: () => { setShowPrivasiDash(true);    setShowLegalMenu(false); } },
                { label: t.legalRefund,      icon: <RotateCcw   className="w-4 h-4 text-blue-400" />,   action: () => { setShowRefundDash(true);     setShowLegalMenu(false); } },
                { label: t.legalDeposit,     icon: <CreditCard  className="w-4 h-4 text-amber-400" />,  action: () => { setShowDepositDash(true);    setShowLegalMenu(false); } },
                { label: t.legalAntiAbuse,   icon: <ShieldAlert className="w-4 h-4 text-red-400" />,    action: () => { setShowAntiAbuseDash(true);  setShowLegalMenu(false); } },
                { label: t.legalDisclaimer,            icon: <AlertCircle className="w-4 h-4 text-orange-400" />, action: () => { setShowDisclaimerDash(true); setShowLegalMenu(false); } },
              ].map(item => (
                <button key={item.label} onClick={item.action} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300 font-bold text-xs transition-colors border-b border-slate-100 dark:border-white/[0.09] last:border-0">
                  {item.icon}{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAIN WRAPPER */}
      <div className="flex-1 md:ml-72 flex flex-col" style={{minHeight:"100svh"}}>
        <header className="backdrop-blur-xl h-[64px] sm:h-[80px] border-b flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 transition-colors duration-300 bg-white/80 dark:bg-[#060810]/90 border-slate-200/80 dark:border-white/[0.05]" style={{boxShadow:'0 1px 20px rgba(0,0,0,0.04)'}}>
          <div className="md:hidden flex items-center font-black text-xl tracking-tight dark:text-white">
            <img src="/logo.png" className="h-8 w-8 rounded-xl object-cover mr-2" alt="Pusat Nokos" /> PusatNokos.
          </div>
          
          <div className="hidden md:flex items-center">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{navItems.find(i => i.id === activeTab)?.name}</h2>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-5">
            {/* Language Switcher */}
            <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-[#0f1320] rounded-xl p-1">
              {(['id','en','zh'] as Lang[]).map(l => (
                <button key={l} onClick={() => { setLang(l); safeLocalSet('lang', l); }}
                  className={"px-2.5 py-1 rounded-lg text-xs font-black transition-colors " + (lang === l ? 'bg-white dark:bg-[#161b28] text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}>
                  {l === 'id' ? '🇮🇩' : l === 'en' ? '🇺🇸' : '🇨🇳'}
                </button>
              ))}
            </div>
            <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle dark mode" className="hidden md:flex p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-full transition-colors">
              {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {/* Notifikasi Bell */}
            <div className="relative">
              <button onClick={() => { setShowNotif(v => !v); setNotifCount(0); }} aria-label="Buka notifikasi" className="relative p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.07] rounded-full transition-colors">
                <Bell className="w-5 h-5" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="fixed right-4 top-20 w-[calc(100vw-2rem)] max-w-xs sm:w-80 bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-2xl z-[200] overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.07] flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white text-sm">{t.notifications}</span>
                    <button onClick={() => { setNotifItems([]); setShowNotif(false); }} aria-label="Hapus semua notifikasi" className="text-xs text-slate-400 hover:text-red-500 font-bold">{t.clearAll}</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {notifItems.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm font-medium">
                        <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        {t.noNotif}
                      </div>
                    ) : notifItems.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.07]/50 transition-colors">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.msg}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{n.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <button onClick={() => setActiveTab('topup')} className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm">+ Topup</button>
            <button onClick={onLogout} className="hidden md:flex font-bold text-slate-500 dark:text-slate-400 text-sm hover:text-red-600 dark:hover:text-red-400 px-3 py-2 rounded-xl transition-colors"><LogOut className="w-5 h-5 mr-2"/> {t.logout}</button>
            <button onClick={() => setIsSidebarOpen(true)} aria-label="Buka menu" className="md:hidden p-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#0f1320] rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><Menu className="h-6 w-6" /></button>
          </div>
        </header>

        {/* MOBILE SIDEBAR OVERLAY */}
        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)}>
            <div className="bg-white dark:bg-[#0a0d16] w-[280px] h-full flex flex-col shadow-2xl animate-in slide-in-from-left-full duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.04] flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{t.yourBalance}</div>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">Rp {balance.toLocaleString('id-ID')}</div>
                </div>
                <div className="flex items-center gap-1">
                  {(['id','en','zh'] as Lang[]).map(l => (
                    <button key={l} onClick={() => { setLang(l); safeLocalSet('lang', l); }}
                      className={"px-2 py-1 rounded-lg text-xs font-black transition-colors " + (lang === l ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#161b28] text-slate-400')}>
                      {l === 'id' ? '🇮🇩' : l === 'en' ? '🇺🇸' : '🇨🇳'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsSidebarOpen(false)} aria-label="Tutup menu" className="bg-white dark:bg-[#0f1320] p-2 rounded-full shadow-sm border border-slate-100 dark:border-white/[0.09] text-slate-500 dark:text-slate-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 py-6 px-5 space-y-2 overflow-y-auto">
                {navItems.map(i => (
                  <button key={i.id} onClick={() => {setActiveTab(i.id); setIsSidebarOpen(false);}} className={"w-full flex items-center px-5 py-4 text-sm font-bold rounded-2xl transition-colors " + (activeTab === i.id ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-white/[0.07] hover:text-indigo-600 dark:hover:text-indigo-400')}>
                    <div className={"mr-4 " + (activeTab === i.id ? 'text-indigo-400 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500')}>{i.icon}</div> {i.name}
                  </button>
                ))}
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-white/[0.07] space-y-2">
                <button suppressHydrationWarning onClick={() => { setIsDarkMode(!isDarkMode); }} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-[#0f1320] text-slate-600 dark:text-slate-400 font-bold rounded-2xl transition-all text-sm">
                  {isDarkMode ? <Sun className="w-5 h-5 text-amber-400 shrink-0" /> : <Moon className="w-5 h-5 text-slate-400 shrink-0" />}
                  {isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
                </button>
                {/* ── Dokumen Legal (accordion) ── */}
                <div className="rounded-2xl overflow-hidden">
                  <button onClick={() => setShowLegalMenu(v => !v)} className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-[#0f1320] text-slate-600 dark:text-slate-400 font-bold transition-all text-sm">
                    <span className="flex items-center gap-3"><Globe className="w-4 h-4 text-slate-400 shrink-0" />{t.legalDocs}</span>
                    <ChevronDown className={"w-4 h-4 transition-transform shrink-0 " + (showLegalMenu ? 'rotate-180' : '')} />
                  </button>
                  {showLegalMenu && (
                    <div className="bg-slate-50 dark:bg-[#0f1320] border-t border-slate-100 dark:border-white/[0.09] grid grid-cols-2 gap-px">
                      {[
                        { label: t.legalTerms,      icon: <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />, action: () => { setShowSyaratDash(true);     setIsSidebarOpen(false); setShowLegalMenu(false); } },
                        { label: t.legalPrivacy,    icon: <ShieldAlert className="w-3.5 h-3.5 text-green-400" />,  action: () => { setShowPrivasiDash(true);    setIsSidebarOpen(false); setShowLegalMenu(false); } },
                        { label: t.legalRefund,     icon: <RotateCcw   className="w-3.5 h-3.5 text-blue-400" />,  action: () => { setShowRefundDash(true);     setIsSidebarOpen(false); setShowLegalMenu(false); } },
                        { label: t.legalDeposit,    icon: <CreditCard  className="w-3.5 h-3.5 text-amber-400" />, action: () => { setShowDepositDash(true);    setIsSidebarOpen(false); setShowLegalMenu(false); } },
                        { label: t.legalAntiAbuse,  icon: <ShieldAlert className="w-3.5 h-3.5 text-red-400" />,   action: () => { setShowAntiAbuseDash(true);  setIsSidebarOpen(false); setShowLegalMenu(false); } },
                        { label: t.legalDisclaimer, icon: <AlertCircle className="w-3.5 h-3.5 text-orange-400" />,action: () => { setShowDisclaimerDash(true); setIsSidebarOpen(false); setShowLegalMenu(false); } },
                      ].map(item => (
                        <button key={item.label} onClick={item.action} className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#0a0d16] hover:bg-indigo-50 dark:hover:bg-white/[0.07] text-slate-500 dark:text-slate-400 text-xs font-bold transition-colors">
                          {item.icon}<span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={onLogout} className="w-full font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 py-4 rounded-2xl flex justify-center items-center transition-colors"><LogOut className="w-5 h-5 mr-2"/> {t.logoutBtn}</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 md:!pb-8 dark:bg-[#060810]" style={{paddingBottom:"calc(6.5rem + env(safe-area-inset-bottom,0px))"}}>
          {activeTab === 'dashboard' && <UserDashboardView user={user} balance={balance} orders={orders} mutasi={mutasi} setActiveTab={setActiveTab} notices={notices} lang={lang} />}
          {activeTab === 'buy' && <BuyView balance={balance} setBalance={setBalance} orders={orders} setOrders={setOrders} showToast={showToast} onCancelOrder={handleCancelOrder} favorites={favorites} setFavorites={setFavorites} setMutasi={setMutasi} activeServices={activeServices} serviceError={serviceError} countries={countries} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} user={user} updateBalance={updateBalance} autoRetryQueue={autoRetryQueue} setAutoRetryQueue={setAutoRetryQueue} failedNumbers={failedNumbers} lang={lang} />}
          {activeTab === 'topup' && <TopupView balance={balance} setBalance={setBalance} showToast={showToast} setActiveTab={setActiveTab} setMutasi={setMutasi} updateBalance={updateBalance} user={user} lang={lang} />}
          {activeTab === 'history' && <HistoryView orders={orders} user={user} lang={lang} />}
          {activeTab === 'mutasi' && <MutasiView mutasi={mutasi} user={user} lang={lang} />}
          {activeTab === 'profile' && <ProfileView user={user} showToast={showToast} lang={lang} />}
        </main>
      </div>

      {/* ── Bottom Navigation Bar (mobile only) ──────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t border-slate-200/80 dark:border-white/[0.05] bg-white/95 dark:bg-[#060810]/95" style={{paddingBottom:"env(safe-area-inset-bottom, 12px)", boxShadow:'0 -4px 30px rgba(0,0,0,0.06)'}}>
        <div className="flex items-stretch h-16 sm:h-[60px]">
          {[
            { id: 'buy',      label: t.buy,        icon: <ShoppingCart className="w-5 h-5" /> },
            { id: 'topup',    label: t.topup,      icon: <CreditCard className="w-5 h-5" /> },
            { id: 'dashboard',label: 'Home',       icon: <BarChart2 className="w-5 h-5" /> },
            { id: 'history',  label: t.history,    icon: <History className="w-5 h-5" /> },
            { id: 'profile',  label: t.profile,    icon: <Settings className="w-5 h-5" /> },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={"flex-1 flex flex-col items-center justify-center gap-0.5 transition-all " +
                (activeTab === item.id
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}
            >
              <div className={"p-1.5 rounded-xl transition-all " +
                (activeTab === item.id ? "bg-indigo-50 dark:bg-indigo-900/30" : "")}>
                {item.icon}
              </div>
              <span className={"text-[10px] font-bold leading-none " +
                (activeTab === item.id ? "text-indigo-600 dark:text-indigo-400" : "")}>
                {item.label}
              </span>
              {activeTab === item.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </nav>
      {/* ── Pop-up Panduan Setiap Login ──────────────────────────────── */}
      {showGuide && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-200 dark:shadow-none shrink-0">
                  <img src="/logo.png" className="h-7 w-7 rounded-lg object-cover" alt="Pusat Nokos" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Selamat Datang, {user?.name?.split(' ')[0]}!</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Baca panduan ini sebelum mulai menggunakan layanan</p>
                </div>
              </div>
            </div>

            {/* Content scrollable */}
            <div className="overflow-y-auto p-6 space-y-3 flex-1">
              {[
                {
                  icon: <CreditCard className="w-5 h-5 text-indigo-500" />,
                  bg: 'bg-indigo-50 dark:bg-indigo-900/30',
                  step: '01',
                  title: 'Add Balance First',
                  desc: 'Before buying an OTP number, you need to top up your balance. Open the Deposit menu, select an available payment method, enter the amount, and complete the payment. Balance is credited automatically in seconds.',
                },
                {
                  icon: <ShoppingCart className="w-5 h-5 text-violet-500" />,
                  bg: 'bg-violet-50 dark:bg-violet-900/30',
                  step: '02',
                  title: 'Choose the Service to Verify',
                  desc: 'Open the Buy Number menu, search for the app you want to verify such as WhatsApp, Telegram, Instagram, and more. Make sure your balance is sufficient. You can also use Bundle Mode to buy multiple services at once with one number.',
                },
                {
                  icon: <Zap className="w-5 h-5 text-amber-500" />,
                  bg: 'bg-amber-50 dark:bg-amber-900/30',
                  step: '03',
                  title: 'Wait for the OTP Code',
                  desc: 'After purchasing a number, use it to register on your target app. The OTP code will appear automatically in Active Orders. Each number stays active for 20 minutes. If no OTP arrives, your balance is refunded 100% automatically (Auto Refund).',
                },
                {
                  icon: <RefreshCw className="w-5 h-5 text-green-500" />,
                  bg: 'bg-green-50 dark:bg-green-900/30',
                  step: '04',
                  title: 'Auto Refund & Auto Retry',
                  desc: 'If a number expires before the OTP arrives, the system automatically refunds your balance and tries to find a new number (Auto Retry). You never have to worry about losing balance. Transaction history is available in the History and Balance tabs.',
                },
                {
                  icon: <Star className="w-5 h-5 text-orange-500" />,
                  bg: 'bg-orange-50 dark:bg-orange-900/30',
                  step: '05',
                  title: 'Tips for a Successful OTP',
                  desc: 'Choose a service with sufficient stock (not Empty). Use the number immediately after purchase. If one number fails, the system automatically tries another. For popular services like WhatsApp and Telegram, stock is always available.',
                },
                {
                  icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
                  bg: 'bg-blue-50 dark:bg-blue-900/30',
                  step: '06',
                  title: 'Need Help? Contact Our CS',
                  desc: `Our Customer Service team is available 24/7. Reach us via WhatsApp at 087862306726 or Telegram ${CS_TELEGRAM}. Include your username, amount, and screenshot for any deposit issues. We'll respond as fast as possible.`,
                },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/[0.07]">
                  <div className={`${item.bg} p-2.5 rounded-xl shrink-0`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest">LANGKAH {item.step}</span>
                    </div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm mb-1">{item.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 dark:border-white/[0.07] shrink-0 flex gap-3">
              <a href={`https://wa.me/${CS_WA}?text=Halo%20CS%20Pusat%20Nokos%2C%20saya%20butuh%20bantuan.`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold px-5 py-3 rounded-2xl transition-colors text-sm shrink-0">
                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Chat CS
              </a>
              <button onClick={() => setShowGuide(false)} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-colors text-sm">
                Mengerti, Mulai Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Syarat & Ketentuan Dashboard ───────────────────────── */}
      {showSyaratDash && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSyaratDash(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-2xl"><ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Syarat & Ketentuan</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p>
                </div>
              </div>
              <button onClick={() => setShowSyaratDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. Acceptance of Terms', content: 'By accessing, registering for, or using Pusat Nokos services in any form, you are deemed to have read, understood, and agreed to all applicable terms and conditions. If you do not agree, you must immediately stop using our services.' },
                { title: '2. Service Description', content: 'Pusat Nokos is a virtual phone number provider platform for receiving OTP codes from various digital services. The service is on-demand and number availability depends on third-party providers.' },
                { title: '3. Terms of Use', content: 'Services may only be used for lawful and legal purposes. It is strictly forbidden to use the service for fraud, fake account registration, spam distribution, or any illegal activity. Violations result in permanent account suspension without balance compensation.' },
                { title: '4. Balance, Deposit & Refund', content: 'Deposited balance is non-refundable to bank accounts. A 100% automatic balance refund is issued when OTP is not received within the time limit, or when the user cancels an order before OTP is received. Refunds are processed directly to account balance in seconds.' },
                { title: '5. Limitation of Liability', content: 'Pusat Nokos is not responsible for losses due to user negligence, unauthorized account access, or third-party service failures. Pusat Nokos total liability will not exceed the user active balance value at the time of the incident.' },
                { title: '6. Account Suspension', content: 'Pusat Nokos reserves the right to unilaterally and finally suspend or terminate accounts that show indications of violating terms, committing fraud, or abusing the system.' },
                { title: '7. Changes to Terms', content: 'Pusat Nokos reserves the right to change these terms at any time. Changes take effect immediately upon publication. Continued use means you accept the updated terms.' },
                { title: '8. Contact Us', content: 'For questions regarding these terms, contact us via WhatsApp at 087862306726 or email cs@pusatnokos.com.' },
              ].map(s => (
                <section key={s.title}>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                  <p>{s.content}</p>
                </section>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowSyaratDash(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kebijakan Privasi Dashboard ────────────────────────── */}
      {showPrivasiDash && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrivasiDash(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/40 p-2.5 rounded-2xl"><ShieldAlert className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Kebijakan Privasi</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p>
                </div>
              </div>
              <button onClick={() => setShowPrivasiDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. Data We Collect', content: 'Pusat Nokos collects data you provide upon registration (name, email), as well as operational data such as transaction history, balance mutations, and technical information (IP address, device type) for security and fraud prevention purposes.' },
                { title: '2. How We Use Your Data', content: 'Data is used for: account management and authentication, transaction processing and refunds, service quality improvement, sending important notifications, and detecting and preventing fraud and abuse.' },
                { title: '3. Data Security', content: 'We apply TLS/HTTPS encryption for data transmission and encryption at rest. Passwords are stored in an encrypted hash format that cannot be read by anyone, including our internal team.' },
                { title: '4. Sharing Data with Third Parties', content: 'We do not sell or trade your personal data. Data is only shared with OTP number provider partners required to process transactions (under confidentiality agreements), or with legal authorities when required by law.' },
                { title: '5. Session & Local Storage', content: 'Login sessions are stored encrypted in your device sessionStorage and deleted automatically when the browser is closed. We do not use third-party cookies to track activity outside our platform.' },
                { title: '6. Data Retention', content: 'Account and transaction data is retained while the account is active. After account deletion, personal data will be anonymised or permanently deleted within a maximum of 30 business days, unless required by law to be retained longer.' },
                { title: '7. Your Rights', content: 'You have the right to: access your personal data, request correction of inaccurate data, request deletion of your account and all data, and object to certain data processing. Contact our CS team to exercise these rights.' },
                { title: '8. Policy Changes', content: 'This policy may be updated at any time. Significant changes will be communicated via platform notifications or registered email. Continued use constitutes acceptance of changes. Questions: cs@pusatnokos.com' },
              ].map(s => (
                <section key={s.title}>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                  <p>{s.content}</p>
                </section>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowPrivasiDash(false)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kebijakan Refund ─────────────────────────────────── */}
      {showRefundDash && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowRefundDash(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 dark:bg-blue-900/40 p-2.5 rounded-2xl"><RotateCcw className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
                <div><h2 className="text-lg font-black text-slate-900 dark:text-white">Kebijakan Refund & Pembatalan</h2><p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p></div>
              </div>
              <button onClick={() => setShowRefundDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. 100% Auto Refund Guarantee', content: 'Pusat Nokos guarantees 100% balance refund when an OTP code is not received within the time limit, or when the user cancels before OTP arrives. Refunds are processed automatically to account balance in seconds with no deductions.' },
                { title: '2. Approved Refund Conditions', content: 'Refunds are processed automatically when: (a) the order time limit expires without OTP arriving; (b) the user clicks "Cancel" before OTP is received; (c) the upstream provider cancels the number unilaterally.' },
                { title: '3. Rejected Refund Conditions', content: 'Refunds are not processed when: (a) an OTP code has already been successfully displayed even if unused; (b) the order status is "Completed"; (c) indications of system manipulation to obtain a refund illegitimately are detected.' },
                { title: '4. Balance Cannot Be Cashed Out', content: 'Refunded balance, like all other balance, is non-refundable to bank accounts or digital wallets. Balance can only be used to purchase services on the Pusat Nokos platform.' },
                { title: '5. OTP Waiting Period', content: 'Each order has a maximum time limit of 20 minutes. If no OTP arrives within that time, the system automatically cancels the order and refunds the balance with no action required from the user.' },
                { title: '6. Refund Disputes', content: 'If a refund does not process as expected, contact CS via WhatsApp 087862306726 or cs@pusatnokos.com including your order ID and screenshot as proof.' },
              ].map(s => (<section key={s.title}><h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3><p>{s.content}</p></section>))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowRefundDash(false)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kebijakan Deposit ───────────────────────────────────── */}
      {showDepositDash && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDepositDash(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-2xl"><CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                <div><h2 className="text-lg font-black text-slate-900 dark:text-white">Kebijakan Deposit</h2><p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p></div>
              </div>
              <button onClick={() => setShowDepositDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. Payment Methods', content: 'Pusat Nokos accepts deposits via various available payment methods. All payment methods are verified and safe to use.' },
                { title: '2. Deposit Process & Timing', content: 'Balance is credited automatically within seconds up to a maximum of 5 minutes after payment confirmation. If balance has not arrived after 5 minutes, contact our CS immediately.' },
                { title: '3. Minimum Deposit', content: 'Minimum deposit amount can be seen on the Deposit page in your dashboard and may change at any time.' },
                { title: '4. Transaction Fees', content: 'A service fee (admin fee) from the payment provider varies per method. Fees are displayed transparently before payment confirmation.' },
                { title: '5. Failed or Pending Deposits', content: 'Deposits pending for more than 30 minutes are automatically cancelled. If funds were deducted but balance did not arrive, contact CS with proof of payment.' },
                { title: '6. Balance Cannot Be Withdrawn', content: 'Deposited balance is final and cannot be withdrawn to a bank account. Please make sure you understand this before depositing.' },
                { title: '7. Transaction Security', content: 'All transactions are encrypted through certified payment gateways. Pusat Nokos does not store credit card data or user banking information.' },
              ].map(s => (<section key={s.title}><h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3><p>{s.content}</p></section>))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowDepositDash(false)} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Anti Penyalahgunaan ─────────────────────────────────── */}
      {showAntiAbuseDash && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowAntiAbuseDash(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 dark:bg-red-900/40 p-2.5 rounded-2xl"><ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" /></div>
                <div><h2 className="text-lg font-black text-slate-900 dark:text-white">Kebijakan Anti Penyalahgunaan</h2><p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p></div>
              </div>
              <button onClick={() => setShowAntiAbuseDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. Prohibited Use', content: 'It is strictly forbidden to use the service for: fraud or phishing, bot/fake account registration, spam or malware distribution, money laundering, or any other illegal activities.' },
                { title: '2. Automatic Detection System', content: 'We operate a real-time abuse detection system that monitors abnormal usage patterns, high cancellation frequency, VPN/proxy usage, and transaction patterns indicating bots.' },
                { title: '3. Consequences of Violations', content: 'Accounts proven or suspected of abuse will be: suspended for investigation, permanently blocked without notice, and balance may be seized without compensation.' },
                { title: '4. Multi-Account Prohibition', content: 'Each user may only have one active account. Duplicating accounts to avoid blocking or gain illegitimate benefits will result in all associated accounts being blocked.' },
                { title: '5. Reporting Abuse', content: 'Report suspicious activity to cs@pusatnokos.com. Reporter identity is kept confidential.' },
                { title: '6. Right to Investigate', content: 'Pusat Nokos reserves the right to investigate suspected accounts at any time. During investigation, accounts may be temporarily suspended without obligation to provide specific reasons.' },
              ].map(s => (<section key={s.title}><h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3><p>{s.content}</p></section>))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowAntiAbuseDash(false)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Disclaimer ──────────────────────────────────────────── */}
      {showDisclaimerDash && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowDisclaimerDash(false)}>
          <div className="bg-white dark:bg-[#0c0f1c] rounded-3xl shadow-2xl border border-slate-200/80 dark:border-white/[0.07] w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/[0.07] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-orange-100 dark:bg-orange-900/40 p-2.5 rounded-2xl"><AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" /></div>
                <div><h2 className="text-lg font-black text-slate-900 dark:text-white">Disclaimer / Penyangkalan</h2><p className="text-xs text-slate-400">Terakhir diperbarui: April 2026</p></div>
              </div>
              <button onClick={() => setShowDisclaimerDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. Nature of Service', content: 'Pusat Nokos is a technical intermediary OTP number provider and is not affiliated with any platform that uses OTP verification services.' },
                { title: '2. Usage Responsibility', content: 'Users are solely responsible for how they use OTP numbers. Pusat Nokos is not responsible for any consequences including account suspension on third-party platforms or financial losses.' },
                { title: '3. No Success Guarantee', content: 'Pusat Nokos does not guarantee that every number will successfully receive an OTP. Failure depends on many factors outside our control. Failures within the time limit receive a 100% Auto Refund.' },
                { title: '4. Third-Party Platform Changes', content: 'Pusat Nokos cannot control policy changes by third-party platforms that may affect the availability or effectiveness of our service.' },
                { title: '5. Information Limitations', content: 'Prices, stock, and success rates are real-time and subject to change. We strive to present accurate data but do not guarantee absolute accuracy at all times.' },
                { title: '6. Legal Jurisdiction', content: 'The service operates in accordance with applicable law. Users from various regions are responsible for ensuring their use of the service complies with the laws and regulations of their respective jurisdictions.' },
              ].map(s => (<section key={s.title}><h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3><p>{s.content}</p></section>))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-white/[0.07] shrink-0">
              <button onClick={() => setShowDisclaimerDash(false)} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BuyViewProps {
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  showToast: (msg: string) => void;
  onCancelOrder: (id: number) => void;
  favorites: number[];
  setFavorites: React.Dispatch<React.SetStateAction<number[]>>;
  setMutasi: React.Dispatch<React.SetStateAction<Mutasi[]>>;
  activeServices: Service[];
  serviceError?: boolean;
  countries: Country[];
  selectedCountry: string;
  setSelectedCountry: (val: string) => void;
  user: UserData | null;
  updateBalance: (amount: number, type: 'add' | 'subtract') => Promise<void>;
  autoRetryQueue: {serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[];
  setAutoRetryQueue: React.Dispatch<React.SetStateAction<{serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[]>>;
  failedNumbers: React.MutableRefObject<Set<string>>;
  lang?: Lang;
}

// ==========================================
// TAB: DASHBOARD RINGKASAN USER
// ==========================================
function UserDashboardView({ user, balance, orders, mutasi, setActiveTab, notices, lang }: {
  user: UserData | null;
  balance: number;
  orders: Order[];
  mutasi: Mutasi[];
  setActiveTab: (tab: string) => void;
  notices: { id: number; title: string; content: string; type: string }[];
  lang?: Lang;
}) {
  const t = T[lang ?? 'en'];
  const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  // Stats dari DB (akurat, semua order)
  const [dbStats, setDbStats] = useState<{ totalOrders: number; successOrders: number; successRate: number; totalSpend: number; totalDeposit: number } | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    fetch('/api/user/account-info', { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.totalOrders !== undefined) setDbStats(d); })
      .catch(() => {});
  }, [user?.email]);

  const totalOrder   = dbStats?.totalOrders  ?? orders.length;
  const successOrder = dbStats?.successOrders ?? orders.filter(o => o.status === 'success').length;
  const activeOrder  = orders.filter(o => o.status === 'waiting').length;
  const totalSpend   = dbStats?.totalSpend   ?? mutasi.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const totalTopup   = dbStats?.totalDeposit ?? mutasi.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const successRate  = dbStats?.successRate  ?? (totalOrder > 0 ? Math.round((successOrder / totalOrder) * 100) : 0);
  const recentMutasi = mutasi.slice(0, 5);

  const isLoadingStats = dbStats === null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {t.greeting}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Selamat datang di Pusat Nokos</p>
      </div>

      {/* Papan Info dari admin */}
      {notices.length > 0 && (
        <div className="space-y-2">
          {notices.map(n => {
            const TYPE_STYLE: Record<string, { emoji: string; cls: string }> = {
              info        : { emoji: 'ℹ️',  cls: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-300' },
              promo       : { emoji: '🎉',  cls: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-300' },
              warning     : { emoji: '⚠️',  cls: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-300' },
              maintenance : { emoji: '🔧',  cls: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-300' },
            };
            const s = TYPE_STYLE[n.type] ?? TYPE_STYLE.info;
            return (
              <div key={n.id} className={`rounded-2xl border px-4 py-3 flex items-start gap-3 ${s.cls}`}>
                <span className="text-lg shrink-0">{s.emoji}</span>
                <div>
                  <div className="font-black text-sm">{n.title}</div>
                  <div className="text-xs mt-0.5 opacity-80">{n.content}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Saldo card — horizontal di mobile, vertikal di desktop */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl md:rounded-[2rem] p-4 md:p-6 text-white">
        <div className="flex items-center justify-between md:block">
          <div>
            <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-70 mb-1 md:mb-2">{t.totalBalance.toUpperCase()}</div>
            {isLoadingStats ? (
              <div className="h-8 bg-white/20 rounded-xl w-32 animate-pulse mt-1" />
            ) : (
              <div className="text-2xl md:text-4xl font-black">{fmtIDR(balance)}</div>
            )}
          </div>
          <button onClick={() => setActiveTab('topup')} className="bg-white/20 hover:bg-white/30 text-white text-xs md:text-sm font-bold px-4 py-2 md:px-5 md:py-2.5 rounded-xl transition-colors border border-white/20 shrink-0 md:mt-4">
            + Deposit
          </button>
        </div>
      </div>

      {/* Stats grid — 2x2 compact di mobile, 4 kolom di desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
        {isLoadingStats ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#0a0d16] rounded-xl md:rounded-2xl border border-slate-200 dark:border-white/[0.07] p-3 md:p-4 animate-pulse">
              <div className="w-8 h-8 bg-slate-200 dark:bg-[#161b28] rounded-lg mb-3" />
              <div className="h-6 bg-slate-200 dark:bg-[#161b28] rounded w-12 mb-1.5" />
              <div className="h-3 bg-slate-100 dark:bg-[#0f1320] rounded w-16" />
            </div>
          ))
        ) : (
          [
            { label: t.totalOrder,   value: totalOrder,        icon: <Package className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />,   bg: 'bg-indigo-50 dark:bg-indigo-900/30', cls: 'stat-card-indigo' },
            { label: t.successOrder, value: successOrder,      icon: <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-600" />, bg: 'bg-green-50 dark:bg-green-900/30',  cls: 'stat-card-green'  },
            { label: t.activeOrder,  value: activeOrder,       icon: <Activity className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />,    bg: 'bg-amber-50 dark:bg-amber-900/30',  cls: 'stat-card-amber'  },
            { label: t.successRate,  value: successRate + '%', icon: <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />,   bg: 'bg-blue-50 dark:bg-blue-900/30',    cls: 'stat-card-blue'   },
          ].map(s => (
            <div key={s.label} className={`dash-card ${s.cls} bg-white rounded-xl md:rounded-2xl border border-slate-200 p-3 md:p-4`}>
              <div className={`${s.bg} p-2 md:p-2.5 rounded-lg md:rounded-xl w-fit mb-2 md:mb-3`}>{s.icon}</div>
              <div className="text-lg md:text-xl font-black text-slate-900 dark:text-white">{s.value}</div>
              <div className="text-[10px] md:text-xs font-bold text-slate-400 mt-0.5">{s.label}</div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total spend vs topup */}
        <div className="dash-card bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">{t.financeSummary}</h3>
          {isLoadingStats ? (
            <div className="space-y-3 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="flex justify-between"><div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded w-24"/><div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded w-20"/></div>)}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t.totalDeposit}</span>
                <span className="font-black text-green-600 dark:text-green-400">{fmtIDR(totalTopup)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">{t.totalSpend}</span>
                <span className="font-black text-red-500 dark:text-red-400">{fmtIDR(totalSpend)}</span>
              </div>
              <div className="border-t border-slate-100 dark:border-white/[0.07] pt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t.remainBalance}</span>
                <span className="font-black text-indigo-600 dark:text-indigo-400">{fmtIDR(balance)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Recent mutasi */}
        <div className="dash-card bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">{t.recentTx}</h3>
            <button onClick={() => setActiveTab('mutasi')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:opacity-70">Lihat semua →</button>
          </div>
          <div className="space-y-2">
            {recentMutasi.length === 0 ? (
              <div className="text-sm text-slate-400 text-center py-4">Belum ada transaksi</div>
            ) : recentMutasi.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[60%]">{m.desc}</div>
                <span className={"text-xs font-black " + (m.type === 'in' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
                  {m.type === 'in' ? '+' : '-'}{fmtIDR(m.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: t.buyTitle,       tab: 'buy',     icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-indigo-600 text-white' },
          { label: t.topup,  tab: 'topup',   icon: <Wallet className="w-5 h-5" />,       color: 'bg-green-600 text-white' },
          { label: t.history,            tab: 'history', icon: <History className="w-5 h-5" />,       color: 'bg-slate-800 dark:bg-[#161b28] text-white' },
        ].map(a => (
          <button key={a.tab} onClick={() => setActiveTab(a.tab)} className={`${a.color} rounded-2xl p-4 flex items-center gap-3 font-bold text-sm hover:opacity-90 transition-opacity active:scale-95`}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Flag & dial-code lookup ──────────────────────────────────────────
const COUNTRY_META: Record<string, { flag: string; dial: string }> = {
  id: { flag: '🇮🇩', dial: '+62'  }, us: { flag: '🇺🇸', dial: '+1'   },
  gb: { flag: '🇬🇧', dial: '+44'  }, uk: { flag: '🇬🇧', dial: '+44'  },
  my: { flag: '🇲🇾', dial: '+60'  }, th: { flag: '🇹🇭', dial: '+66'  },
  br: { flag: '🇧🇷', dial: '+55'  }, fr: { flag: '🇫🇷', dial: '+33'  },
  de: { flag: '🇩🇪', dial: '+49'  }, it: { flag: '🇮🇹', dial: '+39'  },
  ru: { flag: '🇷🇺', dial: '+7'   }, cn: { flag: '🇨🇳', dial: '+86'  },
  in: { flag: '🇮🇳', dial: '+91'  }, pk: { flag: '🇵🇰', dial: '+92'  },
  ph: { flag: '🇵🇭', dial: '+63'  }, vn: { flag: '🇻🇳', dial: '+84'  },
  sg: { flag: '🇸🇬', dial: '+65'  }, hk: { flag: '🇭🇰', dial: '+852' },
  tw: { flag: '🇹🇼', dial: '+886' }, jp: { flag: '🇯🇵', dial: '+81'  },
  kr: { flag: '🇰🇷', dial: '+82'  }, au: { flag: '🇦🇺', dial: '+61'  },
  ca: { flag: '🇨🇦', dial: '+1'   }, mx: { flag: '🇲🇽', dial: '+52'  },
  ar: { flag: '🇦🇷', dial: '+54'  }, co: { flag: '🇨🇴', dial: '+57'  },
  eg: { flag: '🇪🇬', dial: '+20'  }, ng: { flag: '🇳🇬', dial: '+234' },
  ke: { flag: '🇰🇪', dial: '+254' }, za: { flag: '🇿🇦', dial: '+27'  },
  tr: { flag: '🇹🇷', dial: '+90'  }, sa: { flag: '🇸🇦', dial: '+966' },
  ae: { flag: '🇦🇪', dial: '+971' }, il: { flag: '🇮🇱', dial: '+972' },
  pl: { flag: '🇵🇱', dial: '+48'  }, ua: { flag: '🇺🇦', dial: '+380' },
  ro: { flag: '🇷🇴', dial: '+40'  }, nl: { flag: '🇳🇱', dial: '+31'  },
  be: { flag: '🇧🇪', dial: '+32'  }, se: { flag: '🇸🇪', dial: '+46'  },
  es: { flag: '🇪🇸', dial: '+34'  }, pt: { flag: '🇵🇹', dial: '+351' },
  cz: { flag: '🇨🇿', dial: '+420' }, hu: { flag: '🇭🇺', dial: '+36'  },
  kz: { flag: '🇰🇿', dial: '+7'   }, uz: { flag: '🇺🇿', dial: '+998' },
  mm: { flag: '🇲🇲', dial: '+95'  }, kh: { flag: '🇰🇭', dial: '+855' },
  la: { flag: '🇱🇦', dial: '+856' }, mo: { flag: '🇲🇴', dial: '+853' },
  bd: { flag: '🇧🇩', dial: '+880' }, lk: { flag: '🇱🇰', dial: '+94'  },
  np: { flag: '🇳🇵', dial: '+977' }, ir: { flag: '🇮🇷', dial: '+98'  },
  iq: { flag: '🇮🇶', dial: '+964' }, et: { flag: '🇪🇹', dial: '+251' },
  gh: { flag: '🇬🇭', dial: '+233' }, tz: { flag: '🇹🇿', dial: '+255' },
  '6': { flag: '🇮🇩', dial: '+62' },
};
function getCountryMeta(id: string) {
  return COUNTRY_META[id.toLowerCase()] ?? { flag: '🌐', dial: '' };
}

// ── Country ID → ISO2 untuk flagcdn.com ─────────────────────────────
const COUNTRY_ID_TO_ISO2: Record<string, string> = {
  '0':'ru','1':'ua','2':'kz','3':'cn','4':'ph','5':'mm','6':'id','7':'my',
  '8':'ke','9':'tz','10':'vn','11':'kg','12':'us','13':'il','14':'hk','15':'pl',
  '16':'gb','17':'mg','18':'cd','19':'ng','20':'mo','21':'eg','22':'in','23':'ie',
  '24':'kh','25':'la','26':'ht','27':'ci','28':'gm','29':'rs','30':'ye','31':'za',
  '32':'ro','33':'co','34':'ee','35':'az','36':'ca','37':'ma','38':'gh','39':'ar',
  '40':'uz','41':'cm','42':'td','43':'de','44':'lt','45':'hr','46':'se','47':'iq',
  '48':'nl','49':'lv','50':'at','51':'by','52':'th','53':'sa','54':'mx','55':'tw',
  '56':'es','57':'ir','58':'dz','59':'si','60':'bd','61':'sn','62':'tr','63':'cz',
  '64':'lk','65':'pe','66':'pk','67':'nz','68':'gn','69':'ml','70':'ve','71':'et',
  '72':'mn','73':'br','74':'af','75':'ug','76':'ao','77':'cy','78':'fr','79':'pg',
  '80':'mz','81':'np','82':'be','83':'bg','84':'hu','85':'md','86':'it','87':'py',
  '88':'hn','89':'tn','90':'ni','91':'tl','92':'bo','93':'cr','94':'gt','95':'ae',
  '96':'zw','97':'pr','98':'sd','99':'tg','100':'kw','101':'sv','102':'ly',
  '103':'jm','104':'tt','105':'ec','106':'sz','107':'bh','108':'om','109':'bw',
  '110':'mu','111':'bj','112':'bi','113':'jo','114':'bf','115':'zm','116':'fi',
  '117':'so','118':'dk','119':'do','120':'sy','121':'qa','122':'pa','123':'cu',
  '124':'mw','125':'sl','126':'lr','127':'sk','128':'no','129':'ch','130':'pt',
  '131':'gr','132':'jp','133':'au','134':'kr','135':'sg','136':'tj','137':'am',
  '138':'cl','139':'lb','140':'rw','141':'al','142':'ge','143':'tm','144':'bn',
  '145':'ba','146':'mk',
};

// Pakai span + background-image agar tidak ada hydration mismatch
function FlagImg({ countryId, size = 20 }: { countryId: string; size?: number }) {
  const iso2 = COUNTRY_ID_TO_ISO2[countryId] ?? 'un';
  return (
    <span
      suppressHydrationWarning
      style={{
        display: 'inline-block',
        width: size,
        height: Math.round(size * 0.75),
        backgroundImage: `url(https://flagcdn.com/w${size * 2}/${iso2}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 2,
        flexShrink: 0,
      }}
      aria-label={iso2.toUpperCase()}
    />
  );
}

// ── Custom Country Dropdown ──────────────────────────────────────────
function CountryDropdown({ countries, value, onChange, t }: {
  countries: Country[];
  value: string;
  onChange: (val: string) => void;
  t: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = countries.find(c => c.id === value);
  const meta = getCountryMeta(value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative w-full sm:w-64">
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t.serverCountry}</label>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-sm"
      >
        <FlagImg countryId={value} size={20} />
        <span className="flex-1 text-left truncate">{selected?.name.replace(/^\p{Emoji_Presentation}+\s*/u, '') ?? t.selectCountry}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-full z-50 bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-white/[0.07]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t.searchCountry}
                className="w-full pl-8 pr-3 py-2 text-base bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium"
              />
            </div>
          </div>
          {/* List */}
          <div className="overflow-y-auto max-h-60">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-sm font-bold">Tidak ditemukan</div>
            ) : filtered.map(c => {
              const m = getCountryMeta(c.id);
              const isActive = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-left transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-200'}`}
                >
                  <FlagImg countryId={c.id} size={20} />
                  <span className="flex-1 truncate">{c.name.replace(/^\p{Emoji_Presentation}+\s*/u, '')}</span>
                  {m.dial && <span className="text-xs text-slate-400 font-medium shrink-0">{m.dial}</span>}
                  {isActive && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Custom Sort Dropdown ─────────────────────────────────────────────
const getSortOptions = (t: Record<string, string>) => [
  { value: 'default',    label: t.recommended,      icon: '⭐' },
  { value: 'price_asc',  label: t.sortPriceAsc,     icon: '↓' },
  { value: 'price_desc', label: t.sortPriceDesc,    icon: '↑' },
  { value: 'stock_desc', label: t.sortStockMost,    icon: '📦' },
];
function SortDropdown({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const SORT_OPTIONS = getSortOptions(t);
  const selected = SORT_OPTIONS.find(o => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">{t.sort}</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-sm min-w-40"
      >
        <span>{selected.icon}</span>
        <span className="flex-1 text-left">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 w-52 z-50 bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-left transition-colors ${opt.value === value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-200'}`}
            >
              <span className="w-5 text-center">{opt.icon}</span>
              <span className="flex-1">{opt.label}</span>
              {opt.value === value && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile Compact Chips ─────────────────────────────────────────────
function MobileCountryChip({ countries, value, onChange }: { countries: Country[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = countries.find(c => c.id === value);
  const meta = COUNTRY_META[value] ?? COUNTRY_META['6'];
  const filtered = countries.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <button type="button" onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 outline-none transition-all">
        <FlagImg countryId={value} size={18} />
        <span className="flex-1 text-left truncate text-xs">{selected?.name.replace(/^\p{Emoji_Presentation}+\s*/u, '') ?? 'Negara'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 z-50 bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-white/[0.07]">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search country..." className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-lg outline-none dark:text-white" />
          </div>
          <div className="overflow-y-auto max-h-52">
            {filtered.map(c => {
              const m = COUNTRY_META[c.id] ?? { flag: '🌐', dial: '' };
              return (
                <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-left transition-colors ${c.id === value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-200'}`}>
                  <FlagImg countryId={c.id} size={18} />
                  <span className="flex-1 truncate">{c.name.replace(/^\p{Emoji_Presentation}+\s*/u, '')}</span>
                  {m.dial && <span className="text-xs text-slate-400 shrink-0">{m.dial}</span>}
                  {c.id === value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MobileSortChip({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const SORT_OPTIONS = getSortOptions(t);
  const selected = SORT_OPTIONS.find(o => o.value === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex-1">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 outline-none transition-all">
        <span className="text-sm shrink-0">{selected.icon}</span>
        <span className="flex-1 text-left truncate text-xs">{selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 w-52 z-50 bg-white dark:bg-[#0a0d16] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-2xl overflow-hidden">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left transition-colors ${opt.value === value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-200'}`}>
              <span className="w-4 text-center">{opt.icon}</span>
              <span className="flex-1">{opt.label}</span>
              {opt.value === value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BuyView({ balance, setBalance, orders, setOrders, showToast, onCancelOrder, favorites, setFavorites, setMutasi, activeServices, serviceError, countries, selectedCountry, setSelectedCountry, user, updateBalance, autoRetryQueue, setAutoRetryQueue, failedNumbers, lang }: BuyViewProps) {
  const t = T[lang ?? 'en'];
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('default');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isRefreshingStok, setIsRefreshingStok] = useState<boolean>(false);
  const [activeOrderIndex, setActiveOrderIndex] = useState(0);
  const carouselTouchStart = useRef<number | null>(null);

  // Clamp carousel index saat order berkurang
  useEffect(() => {
    const activeLen = orders.filter(o => o.status === 'waiting' || o.status === 'success').length;
    if (activeOrderIndex >= activeLen && activeLen > 0) setActiveOrderIndex(activeLen - 1);
  }, [orders, activeOrderIndex]);

  // Hitung success rate per service dari riwayat order
  const serviceSuccessRates = useMemo(() => {
    const map: Record<string, { success: number; total: number }> = {};
    orders.forEach(o => {
      const key = o.serviceName;
      if (!map[key]) map[key] = { success: 0, total: 0 };
      map[key].total++;
      if (o.status === 'success') map[key].success++;
    });
    const rates: Record<string, number> = {};
    Object.entries(map).forEach(([k, v]) => {
      rates[k] = v.total > 0 ? Math.round((v.success / v.total) * 100) : 0;
    });
    return rates;
  }, [orders]);

  // Auto-retry ketika ada order expired
  useEffect(() => {
    if (autoRetryQueue.length === 0 || isProcessing) return;
    const retry = autoRetryQueue[0];
    setAutoRetryQueue(prev => prev.slice(1));
    // Cari service yang cocok berdasarkan nama
    const matchedService = activeServices.find(s => s.name === retry.serviceName);
    if (matchedService && balance >= matchedService.price) {
      setTimeout(() => handleBuy(matchedService), 1500);
    } else {
      showToast(`Cannot auto-retry ${retry.serviceName}: insufficient balance or service not found.`);
    }
  }, [autoRetryQueue, isProcessing]);
  const [isBundleMode, setIsBundleMode] = useState<boolean>(false);
  const [bundleSelected, setBundleSelected] = useState<Set<number>>(new Set());
  const [smsModal, setSmsModal] = useState<{ id: string; name: string } | null>(null);
  const [allSms, setAllSms] = useState<{ code: string; text: string }[]>([]);
  const [loadingSms, setLoadingSms] = useState(false);
  // Rate limiting — max 3 order per menit
  const orderTimestamps = useRef<number[]>([]);

  const openSmsModal = async (order: Order) => {
    setSmsModal({ id: order.activationId, name: order.serviceName });
    setLoadingSms(true);
    setAllSms([]);
    try {
      const res  = await fetch(`/api/sms?id=${order.activationId}`);
      const data = await res.json();
      if (Array.isArray(data)) setAllSms(data);
    } catch { /* biarkan kosong */ }
    finally { setLoadingSms(false); }
  };

  const toggleBundle = (id: number) => {
    setBundleSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBuyBundle = async () => {
    if (isProcessing) return;
    if (bundleServices.length < 2) { showToast('Pilih minimal 2 layanan untuk bundle.'); return; }
    if (balance < bundleTotalPrice) { showToast('Insufficient balance! Please deposit first.'); return; }

    setIsProcessing(true);
    try {
      const [primary, ...rest] = bundleServices;
      const res = await fetch('/api/order-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service     : primary.code,
          country     : selectedCountry,
          operator    : '0',
          multiService: rest.map(s => s.code),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Tampilkan pesan yang ramah, bukan raw JSON dari provider
        const rawErr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error ?? data);
        let friendlyMsg = 'Gagal memesan bundle. Coba lagi.';
        if (rawErr.includes('INVALID') || rawErr.includes('UNPROCESSABLE') || rawErr.includes('Validation')) {
          const badNames = bundleServices.map(s => s.name).join(', ');
          friendlyMsg = `Layanan berikut tidak mendukung Mode Bundle: ${badNames}. Pilih layanan lain (misal: WhatsApp, Telegram, Shopee).`;
        } else if (rawErr.includes('balance') || rawErr.includes('saldo')) {
          friendlyMsg = 'Insufficient balance for this bundle.';
        } else if (rawErr.includes('stock') || rawErr.includes('stok')) {
          friendlyMsg = 'Stok nomor habis untuk salah satu layanan yang dipilih.';
        }
        showToast(friendlyMsg);
        return;
      }

      // ✅ Update saldo di DB (bukan hanya local state)
      await updateBalance(bundleTotalPrice, 'subtract');
      const newOrder: Order = {
        id             : Date.now(),
        activationId   : data.activationId,
        date           : new Date().toLocaleString('id-ID'),
        serviceName    : bundleServices.map(s => s.name).join(' + '),
        price          : bundleTotalPrice,
        icon           : primary.icon,
        number         : data.phone,
        status         : 'waiting',
        timeLeft       : 600,
        otpCode        : null,
        isV2           : true,
        bundleServices : bundleServices.map(s => s.code),
        otpCodes       : [],
      };
      setOrders(prev => [newOrder, ...prev]);
      setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString(), type: 'out', amount: bundleTotalPrice, desc: 'Bundle: ' + newOrder.serviceName }, ...prev]);
      // Simpan order bundle ke Supabase
      if (user?.email) {
        fetch('/api/user/orders', {
          method: 'POST', headers: authHeaders({ 'X-User-Email': user.email }),
          body: JSON.stringify({ email: user.email, activationId: data.activationId, serviceCode: primary.code, serviceName: newOrder.serviceName, phone: data.phone, price: bundleTotalPrice, country: selectedCountry, isV2: true }),
        }).catch(() => {});
      }
      showToast(`Bundle dipesan! Nomor: ${data.phone}`);
      setBundleSelected(new Set());
      setIsBundleMode(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      showToast('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };


  const activeOrders = orders.filter(o => o.status === 'waiting' || o.status === 'success');
  // Gunakan activeServices dari props (sudah di-fetch di App, tidak perlu fetch ulang)
  const sourceServices = activeServices;

  const handleRefreshStok = () => {
    setIsRefreshingStok(true);
    setTimeout(() => {
      setIsRefreshingStok(false);
      showToast("Stok berhasil diperbarui.");
    }, 800);
  };

  const handleResend = async (order: Order) => {
    if (!order.activationId) return;
    try {
      const res = await fetch('/api/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.activationId, action: 'resend' }),
      });
      const data = await res.json();
      if (data.success) showToast("Permintaan kirim ulang OTP dikirim!");
      else showToast(data.error ?? "Failed to resend OTP.");
    } catch {
      showToast("Network error.saat kirim ulang.");
    }
  };

  useEffect(() => {
    setIsLoadingData(true);
    const timer = setTimeout(() => { setIsLoadingData(false); }, 600);
    return () => clearTimeout(timer);
  }, [activeCategory, selectedCountry, sortOrder]);

  let displayServices = sourceServices.filter(s => 
    (activeCategory === 'ALL' || s.category === activeCategory) && 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (sortOrder === 'price_asc') displayServices.sort((a,b) => a.price - b.price);
  if (sortOrder === 'price_desc') displayServices.sort((a,b) => b.price - a.price);
  if (sortOrder === 'stock_desc') displayServices.sort((a,b) => b.stock - a.stock);

  const favServices = displayServices.filter(s => favorites.includes(s.id));
  const regularServices = displayServices.filter(s => !favorites.includes(s.id));
  const finalServices = [...favServices, ...regularServices];

  // Harus di bawah finalServices agar tidak ReferenceError
  const bundleServices = finalServices.filter(s => bundleSelected.has(s.id));
  const bundleTotalPrice = bundleServices.reduce((sum, s) => sum + s.price, 0);

  const toggleFavorite = (id: number) => {
    if(favorites.includes(id)) {
      setFavorites(favorites.filter(favId => favId !== id));
      showToast("Dihapus dari favorit.");
    } else {
      setFavorites([...favorites, id]);
      showToast("Ditambahkan ke favorit!");
    }
  };

  const handleBuy = async (service: Service) => {
    if (isProcessing) return;
    if (balance < service.price) { 
      showToast('Insufficient balance! Please deposit first.'); 
      return; 
    }
    if (!service.code) {
      showToast('Kode layanan tidak ditemukan. Coba refresh halaman.');
      return;
    }

    // ── Rate limiting: max 3 order per 60 detik ──────────────────────
    const now = Date.now();
    orderTimestamps.current = orderTimestamps.current.filter(t => now - t < 60000);
    if (orderTimestamps.current.length >= 3) {
      const waitSec = Math.ceil((60000 - (now - orderTimestamps.current[0])) / 1000);
      showToast(`Terlalu banyak pesanan. Tunggu ${waitSec} detik.`);
      return;
    }
    orderTimestamps.current.push(now);
    // ─────────────────────────────────────────────────────────────────

    setIsProcessing(true);
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ service: service.code, country: selectedCountry, operator: '0' }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Gagal memesan nomor.');
        return;
      }

      // Cek apakah nomor ini pernah gagal sebelumnya
      if (failedNumbers.current.has(data.phone)) {
        showToast('Nomor pernah gagal, mencari nomor lain...');
        // Cancel dan retry
        await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: data.activationId, action: 'cancel' }) }).catch(() => {});
        setIsProcessing(false);
        handleBuy(service);
        return;
      }
      // Kurangi saldo di Supabase
      await updateBalance(service.price, 'subtract');
      const newOrder: Order = {
        id: Date.now(),
        activationId: data.activationId,
        date: new Date().toLocaleString('id-ID'),
        serviceName: service.name,
        price: service.price,
        icon: service.icon,
        number: data.phone,
        status: 'waiting',
        timeLeft: 1200,
        otpCode: null,
      };
      setOrders(prev => [newOrder, ...prev]);
      setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString(), type: 'out', amount: service.price, desc: 'Buy ' + service.name }, ...prev]);
      // Simpan order ke Supabase
      if (user?.email) {
        fetch('/api/user/orders', {
          method: 'POST', headers: authHeaders({ 'X-User-Email': user.email }),
          body: JSON.stringify({ email: user.email, activationId: data.activationId, serviceCode: service.code, serviceName: service.name, phone: data.phone, price: service.price, country: selectedCountry }),
        }).catch(() => {});
      }
      showToast("Successfully ordered " + service.name + " — " + data.phone);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      showToast('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={`space-y-8 max-w-7xl mx-auto pb-10 ${isBundleMode && bundleSelected.size > 0 ? 'pb-28' : 'pb-10'}`}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">{t.buyTitle}</h1>
          <button
            onClick={handleRefreshStok}
            disabled={isRefreshingStok}
            aria-label="Refresh daftar layanan"
            className="p-2 rounded-xl bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh stok"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingStok ? 'animate-spin' : ''}`} />
          </button>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">{t.buySubtitle}</p>
        </div>
        <button
          onClick={() => { setIsBundleMode(v => !v); setBundleSelected(new Set()); }}
          className={"px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all shrink-0 " + (isBundleMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-400 dark:hover:border-indigo-500')}
        >
          {isBundleMode ? t.cancelBundle : t.modeBundle}
        </button>
      </div>

      {/* Banner info Mode Bundle */}
      {isBundleMode && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl px-5 py-3.5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <span className="font-bold">Mode Bundle:</span> Pilih 2–4 layanan untuk 1 nomor. Tidak semua layanan mendukung bundle —{' '}
            <span className="font-bold">Chat & Social lebih banyak yang kompatibel</span>{' '}
            (WhatsApp, Telegram, Instagram, dll). Layanan E-Commerce seperti Tokopedia, Lazada, Amazon mungkin tidak didukung.
          </div>
        </div>
      )}

      {/* ── DESKTOP Filter ────────────────────────────────────────── */}
      <div className="hidden md:flex bg-white dark:bg-[#0a0d16] shadow-sm border border-slate-200 dark:border-white/[0.07] rounded-3xl p-5 md:p-6 xl:flex-row gap-5 justify-between items-end z-10 transition-colors">
        {/* Country Dropdown */}
        <div className="w-full xl:w-auto flex items-end space-x-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 shrink-0 mb-0.5">
            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CountryDropdown countries={countries} value={selectedCountry} onChange={setSelectedCountry} t={t} />
        </div>
        <div className="hidden xl:block w-px h-12 bg-slate-200 dark:bg-[#0f1320] mx-2 mb-0.5"></div>
        {/* Search */}
        <div className="flex-1 w-full relative">
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Pencarian</label>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input type="text" placeholder={t.searchPlaceholder} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl focus:bg-white dark:focus:bg-[#0a0d16] focus:ring-2 focus:ring-indigo-500/50 outline-none text-base font-bold transition-all shadow-sm dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        {/* Sort */}
        <SortDropdown value={sortOrder} onChange={setSortOrder} t={t} />
      </div>

      {/* ── MOBILE: Floating pill pesanan aktif ── */}
      {activeOrders.length > 0 && (
        <div className="md:hidden sticky top-[80px] z-30 -mx-4 px-4 pt-2">
          <button
            onClick={() => document.getElementById('active-orders-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="w-full flex items-center justify-between bg-indigo-600 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-indigo-600/30 text-sm font-bold"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-300" />
              {activeOrders.length} Pesanan Aktif
            </div>
            <span className="text-indigo-200 text-xs">Lihat ↑</span>
          </button>
        </div>
      )}

      {/* ── MOBILE: Filter + Kategori STICKY ────────────────────────── */}
      <div className="md:hidden sticky top-[80px] z-20 -mx-4 px-4 pt-2 pb-1 bg-[#fafafa] dark:bg-[#060810]">
        {/* Filter bar */}
        <div className="bg-white dark:bg-[#0a0d16] shadow-sm border border-slate-200 dark:border-white/[0.07] rounded-2xl p-3 space-y-2.5 mb-2">
          <div className="flex gap-2">
            <MobileCountryChip countries={countries} value={selectedCountry} onChange={setSelectedCountry} />
            <MobileSortChip value={sortOrder} onChange={setSortOrder} t={t} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input type="text" placeholder="Cari layanan..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-medium transition-all dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        {/* Kategori tabs */}
        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-[#fafafa] dark:from-[#020617] to-transparent z-10" />
          <div className="flex overflow-x-auto gap-2 pb-2" style={{scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch'}}>
            {[{key:'ALL', label: t.categoryAll}, ...CATEGORIES_BASE.map(c => ({key:c, label:c})), {key:'Lainnya', label: t.categoryOthers}].map(cat => (
              <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                className={"flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border-2 transition-all " + (activeCategory === cat.key ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09]')}>
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── DESKTOP Kategori tabs ─────────────────────────────────── */}
      <div className="hidden md:block relative">
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#fafafa] dark:from-[#020617] to-transparent z-10" />
        <div className="flex overflow-x-auto gap-3 pb-2 px-1" style={{scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch'}}>
          {[{key:'ALL', label: t.categoryAll}, ...CATEGORIES_BASE.map(c => ({key:c, label:c})), {key:'Lainnya', label: t.categoryOthers}].map(cat => (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={"flex-shrink-0 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap border-2 transition-all " + (activeCategory === cat.key ? 'bg-indigo-600 dark:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-[#0a0d16] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-300 dark:hover:border-indigo-500')}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex flex-col-reverse xl:grid xl:items-start ${activeOrders.length > 0 ? 'xl:grid-cols-3' : ''} gap-8`}>
        
        <div className={`dash-table bg-white dark:bg-[#0d1020] shadow-sm border border-slate-200 dark:border-white/[0.06] rounded-[2rem] overflow-hidden flex flex-col transition-colors ${activeOrders.length > 0 ? 'xl:col-span-2' : ''}`}>

          {/* ===== DESKTOP: Tabel ===== */}
          <div className="dash-table hidden md:block overflow-x-auto flex-1 min-h-[400px] max-h-[600px] overflow-y-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-slate-50/95 dark:bg-[#080b14]/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/[0.09] text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-5 sm:px-6 w-2/5">{t.serviceCol}</th>
                  <th className="p-5 sm:px-6 w-1/5">{t.stockCol}</th>
                  <th className="p-5 sm:px-6 w-1/5">{t.priceCol}</th>
                  <th className="p-5 sm:px-6 text-right w-1/5">{isBundleMode ? t.pickCol : t.actionCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {isLoadingData ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-5 sm:px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-5 h-5 bg-slate-200 dark:bg-[#161b28] rounded-full shrink-0"></div>
                          <div className="w-12 h-12 bg-slate-200 dark:bg-[#161b28] rounded-2xl shrink-0"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded-lg w-28"></div>
                            <div className="h-3 bg-slate-100 dark:bg-[#0f1320] rounded w-16"></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 sm:px-6"><div className="h-4 bg-slate-100 dark:bg-[#0f1320] rounded-lg w-20"></div></td>
                      <td className="p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-[#161b28] rounded-lg w-24"></div></td>
                      <td className="p-5 sm:px-6 text-right"><div className="h-10 bg-slate-200 dark:bg-[#161b28] rounded-xl w-32 ml-auto"></div></td>
                    </tr>
                  ))
                ) : finalServices.length > 0 ? (
                  finalServices.map(s => (
                    <tr key={s.id} className={"hover:bg-indigo-50/40 dark:hover:bg-white/[0.07]/50 transition-colors group " + (s.outOfStock ? 'opacity-60' : '')}>
                      <td className="p-5 sm:px-6">
                        <div className="flex items-center">
                          <button onClick={() => toggleFavorite(s.id)} className="mr-3 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/[0.1] transition-colors shrink-0">
                            <Star className={`w-4 h-4 transition-colors ${favorites.includes(s.id) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} />
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 group-hover:scale-110 transition-transform">{s.icon}</div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-[15px] truncate max-w-[180px] sm:max-w-none">{s.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 inline-block font-bold uppercase tracking-wider whitespace-nowrap shrink-0">{s.category}</div>
                                {s.outOfStock && <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800/50 font-bold uppercase tracking-wider">{t.outOfStock}</div>}
                                {serviceSuccessRates[s.name] !== undefined && (
                                  <div className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${serviceSuccessRates[s.name] >= 70 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : serviceSuccessRates[s.name] >= 40 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>✓ {serviceSuccessRates[s.name]}% sukses</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 sm:px-6">
                        <span className={"inline-flex items-center text-sm font-bold px-3 py-1.5 rounded-lg border " + (s.outOfStock ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.04] border-slate-100 dark:border-white/[0.09]')}>
                          <span className={"w-2 h-2 rounded-full mr-2 shrink-0 " + (s.outOfStock ? 'bg-red-500' : 'bg-green-500')}></span>
                          {s.outOfStock ? 'Empty' : s.stock.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-5 sm:px-6">
                        <div className="font-black text-slate-900 dark:text-white text-base">Rp {s.price.toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{t.perOTP}</div>
                      </td>
                      <td className="p-5 sm:px-6 text-right">
                        {isBundleMode ? (
                          <button onClick={() => !s.outOfStock && toggleBundle(s.id)} disabled={s.outOfStock} className={"w-7 h-7 rounded-lg border-2 flex items-center justify-center ml-auto transition-all " + (s.outOfStock ? 'border-slate-200 dark:border-white/[0.09] opacity-40 cursor-not-allowed' : bundleSelected.has(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-white/[0.12] hover:border-indigo-400')}>
                            {bundleSelected.has(s.id) && <Check className="w-4 h-4 text-white" />}
                          </button>
                        ) : (
                          <button onClick={() => !s.outOfStock && handleBuy(s)} disabled={isProcessing || s.outOfStock} className={"text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-md w-full max-w-36 ml-auto transition-all flex justify-center items-center " + (s.outOfStock ? 'bg-slate-300 dark:bg-[#161b28] cursor-not-allowed' : isProcessing ? 'bg-indigo-400 cursor-wait' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:shadow-lg active:scale-95')}>
                            {s.outOfStock ? t.outOfStock : isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/>  : t.buyBtn}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : serviceError ? (
                  <tr><td colSpan={4} className="py-24 text-center">
                    <div className="w-20 h-20 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="w-10 h-10 text-red-400 dark:text-red-500" /></div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Gagal memuat layanan</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 mb-5">Periksa koneksi internet kamu, lalu coba lagi.</p>
                    <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors active:scale-95"><RefreshCw className="w-4 h-4" /> Muat Ulang</button>
                  </td></tr>
                ) : (
                  <tr><td colSpan={4} className="py-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-[#0f1320] border border-slate-100 dark:border-white/[0.09] rounded-full flex items-center justify-center mx-auto mb-4"><Filter className="w-10 h-10 text-slate-300 dark:text-slate-500" /></div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Layanan tidak ditemukan</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Coba sesuaikan kata kunci pencarian Anda.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ===== MOBILE: Card layout ===== */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-white/[0.06]">
            {isLoadingData ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-[#161b28] rounded-2xl shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded w-32"></div>
                    <div className="h-3 bg-slate-100 dark:bg-[#0f1320] rounded w-20"></div>
                  </div>
                  <div className="h-9 w-20 bg-slate-200 dark:bg-[#161b28] rounded-xl shrink-0"></div>
                </div>
              ))
            ) : finalServices.length > 0 ? (
              finalServices.map(s => (
                <div key={s.id} className={"flex items-center gap-3 p-4 transition-colors " + (s.outOfStock ? 'opacity-60' : 'hover:bg-indigo-50/40 dark:hover:bg-white/[0.07]/50')}>
                  {/* Icon */}
                  <div className="shrink-0">{s.icon}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{s.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 font-bold uppercase tracking-wider">{s.category}</span>
                      <span className={"inline-flex items-center text-[10px] font-bold gap-1 " + (s.outOfStock ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400')}>
                        <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (s.outOfStock ? 'bg-red-500' : 'bg-green-500')}></span>
                        {s.outOfStock ? 'Empty' : s.stock.toLocaleString()}
                      </span>
                      {serviceSuccessRates[s.name] !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${serviceSuccessRates[s.name] >= 70 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : serviceSuccessRates[s.name] >= 40 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>✓ {serviceSuccessRates[s.name]}%</span>
                      )}
                    </div>
                  </div>

                  {/* Harga + Aksi */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="text-right">
                      <div className="font-black text-slate-900 dark:text-white text-sm">Rp {s.price.toLocaleString('id-ID')}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{t.perOTP}</div>
                    </div>
                    {isBundleMode ? (
                      <button onClick={() => !s.outOfStock && toggleBundle(s.id)} disabled={s.outOfStock} className={"w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all " + (s.outOfStock ? 'border-slate-200 dark:border-white/[0.09] opacity-40 cursor-not-allowed' : bundleSelected.has(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-white/[0.12]')}>
                        {bundleSelected.has(s.id) && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ) : (
                      <button onClick={() => !s.outOfStock && handleBuy(s)} disabled={isProcessing || s.outOfStock} className={"text-white text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 " + (s.outOfStock ? 'bg-slate-300 dark:bg-[#161b28] cursor-not-allowed' : isProcessing ? 'bg-indigo-400 cursor-wait' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500')}>
                        {s.outOfStock ? t.outOfStock : isProcessing ? <RefreshCw className="w-3 h-3 animate-spin"/> : t.buyBtn}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : serviceError ? (
              <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="w-8 h-8 text-red-400" /></div>
                <p className="font-extrabold text-slate-800 dark:text-slate-200">Gagal memuat layanan</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Periksa koneksi internet kamu.</p>
                <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold text-sm rounded-xl active:scale-95"><RefreshCw className="w-4 h-4" /> Muat Ulang</button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-[#0f1320] rounded-full flex items-center justify-center mb-4"><Filter className="w-8 h-8 text-slate-300 dark:text-slate-500" /></div>
                <p className="font-extrabold text-slate-800 dark:text-slate-200">Layanan tidak ditemukan</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian.</p>
              </div>
            )}
          </div>

        </div>

        {activeOrders.length > 0 && (
          <div id="active-orders-mobile" className="xl:col-span-1 xl:sticky xl:top-[104px] order-first xl:order-last">
            <div className="text-white rounded-[2rem] shadow-2xl overflow-hidden border border-indigo-500/30 animate-in fade-in slide-in-from-right-8 duration-300" style={{background:'linear-gradient(145deg,#3730a3 0%,#4f46e5 45%,#6d28d9 100%)',boxShadow:'0 20px 60px rgba(79,70,229,0.4),0 0 0 1px rgba(139,92,246,0.2)'}}>

              {/* Header */}
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between font-bold" style={{background:'rgba(0,0,0,0.15)'}}>
                <div className="flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-300" />
                  <span>{t.activeOrders}</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tombol kembali ke atas */}
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/30 text-xs font-bold transition-colors"
                    title={t.scrollTop}
                  >
                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                    <span>Atas</span>
                  </button>
                  {activeOrders.length > 1 && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveOrderIndex(i => Math.max(0, i - 1))} disabled={activeOrderIndex === 0}
                        className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 disabled:opacity-30 flex items-center justify-center transition-colors">
                        <ChevronDown className="w-4 h-4 rotate-90" />
                      </button>
                      <span className="text-xs text-indigo-200 min-w-[40px] text-center">{activeOrderIndex + 1} / {activeOrders.length}</span>
                      <button onClick={() => setActiveOrderIndex(i => Math.min(activeOrders.length - 1, i + 1))} disabled={activeOrderIndex === activeOrders.length - 1}
                        className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 disabled:opacity-30 flex items-center justify-center transition-colors">
                        <ChevronDown className="w-4 h-4 -rotate-90" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dot indicators */}
              {activeOrders.length > 1 && (
                <div className="flex justify-center gap-1.5 pt-2.5 px-4 flex-wrap">
                  {activeOrders.map((_, i) => (
                    <button key={i} onClick={() => setActiveOrderIndex(i)}
                      className={"rounded-full transition-all " + (i === activeOrderIndex ? 'bg-white w-5 h-1.5' : 'bg-white/30 w-1.5 h-1.5')} />
                  ))}
                </div>
              )}

              {/* Carousel — swipe support */}
              <div
                className="overflow-hidden"
                onTouchStart={e => { carouselTouchStart.current = e.touches[0].clientX; }}
                onTouchEnd={e => {
                  if (carouselTouchStart.current === null) return;
                  const diff = carouselTouchStart.current - e.changedTouches[0].clientX;
                  if (Math.abs(diff) > 40) {
                    if (diff > 0) setActiveOrderIndex(i => Math.min(activeOrders.length - 1, i + 1));
                    else setActiveOrderIndex(i => Math.max(0, i - 1));
                  }
                  carouselTouchStart.current = null;
                }}
              >
                <div className="flex transition-transform duration-300 ease-in-out" style={{ transform: `translateX(-${activeOrderIndex * 100}%)` }}>
                  {activeOrders.map(o => (
                    <div key={o.id} className="min-w-full p-4 sm:p-5">
                  <div key={o.id} className={"bg-white/10 backdrop-blur-md rounded-3xl p-5 border shadow-sm relative overflow-hidden transition-all " + (o.status === 'success' ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20')}>
                    {o.status === 'success' && <div className="absolute -right-6 -top-6 w-20 h-20 bg-green-500 rounded-full blur-2xl opacity-40 animate-pulse"></div>}
                    
                    <div className="flex justify-between items-center mb-4 relative z-10">
                      <div className="flex items-center font-bold text-sm">
                        <div className="mr-3 shrink-0">{getServiceIconByName(o.serviceName)}</div>
                        {o.serviceName}
                      </div>
                      <div className="flex items-center gap-2">
                        {o.status === 'waiting' && (
                          <span className="bg-indigo-900/50 text-indigo-100 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-indigo-400/30 flex items-center shadow-sm">
                            <Clock className="w-3.5 h-3.5 mr-1.5"/>{formatTimeStr(o.timeLeft)}
                          </span>
                        )}
                        {o.status === 'success' && (
                          <>
                            <span className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider shadow-sm">SELESAI</span>
                            <button
                              onClick={() => setOrders(cur => cur.map(x => x.id === o.id ? { ...x, status: 'completed' as Order['status'] } : x))}
                              className="bg-white/20 hover:bg-white/40 text-white w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                              title="Tutup"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons row */}
                    {o.status === 'waiting' && (
                      <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
                        <button 
                          onClick={() => handleResend(o)}
                          className="bg-blue-500/20 text-blue-200 hover:bg-blue-500 hover:text-white py-3 rounded-xl text-[11px] font-bold border border-blue-500/30 transition-colors active:scale-95"
                        >
                          RESEND
                        </button>
                        <button
                          onClick={() => openSmsModal(o)}
                          className="bg-white/10 text-white hover:bg-white/20 py-3 rounded-xl text-[11px] font-bold border border-white/20 transition-colors active:scale-95"
                        >
                          SMS
                        </button>
                        <button 
                          onClick={() => onCancelOrder(o.id)} 
                          disabled={o.timeLeft > 900}
                          className={"py-3 rounded-xl text-[11px] font-bold border transition-colors active:scale-95 " + (o.timeLeft > 900 ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed' : 'bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white border-red-500/30')}
                          title={o.timeLeft > 900 ? 'Wait 5 minutes before cancelling' : 'Cancel order'}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    )}

                    <div className="space-y-3 relative z-10">
                      <div>
                        <span className="text-[10px] uppercase text-indigo-200 font-bold tracking-wider mb-1.5 block">Nomor HP Diterima</span>
                        <div className="bg-white text-slate-900 px-4 py-3 rounded-xl font-mono text-lg font-black tracking-widest cursor-pointer shadow-inner text-center hover:bg-slate-50 transition-colors flex justify-center items-center group" onClick={() => copyToClipboard(o.number, showToast)} aria-label={`Salin nomor ${o.number}`}>
                          {o.number} <Copy className="w-4 h-4 ml-2.5 text-slate-300 group-hover:text-indigo-600 transition-colors"/>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-indigo-200 font-bold tracking-wider mb-1.5 block">Kode Verifikasi (OTP)</span>
                        {/* V2 Bundle: tampilkan multiple OTP */}
                        {o.isV2 ? (
                          o.otpCodes && o.otpCodes.length > 0 ? (
                            <div className="space-y-2">
                              {o.otpCodes.map((item, i) => (
                                <div key={i} className="bg-green-500 text-white px-4 py-2.5 rounded-xl font-black text-lg tracking-widest cursor-pointer shadow-lg text-center border border-green-400 hover:bg-green-400 transition-colors flex justify-between items-center group" onClick={() => copyToClipboard(item.code, showToast)}>
                                  <span className="text-xs font-bold opacity-70 uppercase">{item.service}</span>
                                  <span>{item.code}</span>
                                  <Copy className="w-4 h-4 opacity-70 group-hover:opacity-100" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs font-medium flex items-center justify-center text-indigo-200 py-4 border-2 border-dashed border-indigo-400/50 rounded-xl bg-indigo-900/20">
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> Menunggu OTP Bundle...
                            </div>
                          )
                        ) : (
                          /* V1 reguler */
                          o.otpCode ? (
                            <div className="bg-green-500 text-white px-4 py-3.5 rounded-xl cursor-pointer shadow-lg border border-green-400 hover:bg-green-400 transition-colors animate-in zoom-in group" onClick={() => copyToClipboard(o.otpCode ?? '', showToast)}>
                              <div className="font-black text-xl tracking-widest break-all leading-snug text-center">{o.otpCode}</div>
                              <div className="flex items-center justify-center mt-1.5 opacity-70 group-hover:opacity-100 text-xs font-bold gap-1"><Copy className="w-3.5 h-3.5"/> Salin</div>
                            </div>
                          ) : (
                            <div className="text-xs font-medium flex items-center justify-center text-indigo-200 py-4 border-2 border-dashed border-indigo-400/50 rounded-xl bg-indigo-900/20">
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin"/> Menunggu SMS Masuk...
                            </div>
                          )
                        )}
                      </div>

                      {/* Semua SMS masuk */}
                      {o.allSms && o.allSms.length > 0 && (
                        <div className="mt-3">
                          <span className="text-[10px] uppercase text-indigo-200 font-bold tracking-wider mb-2 block">{t.allSMS} ({o.allSms.length})</span>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {o.allSms.map((sms, i) => (
                              <div key={i} className="bg-white/10 rounded-xl px-3 py-2.5 text-xs text-indigo-100 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => copyToClipboard(sms.text, showToast)}>
                                <div className="font-bold text-white mb-1 font-mono tracking-widest">{sms.code || '—'}</div>
                                <div className="opacity-70 leading-relaxed">{sms.text}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tombol lihat semua SMS */}
                      {o.activationId && o.status === 'waiting' && !o.isV2 && (
                        <button
                          onClick={async () => {
                            try {
                              const res  = await fetch(`/api/sms?id=${o.activationId}`);
                              const data = await res.json();
                              if (Array.isArray(data) && data.length > 0) {
                                setOrders(cur => cur.map(x => x.id === o.id ? { ...x, allSms: data } : x));
                              } else {
                                showToast('No other SMS received yet.');
                              }
                            } catch { showToast('Gagal mengambil SMS.'); }
                          }}
                          className="mt-2 w-full text-[11px] font-bold text-indigo-300 hover:text-white py-2 border border-indigo-400/30 hover:border-indigo-300 rounded-xl transition-colors"
                        >
                          {t.viewAllSMS}
                        </button>
                      )}
                    </div>
                  </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      {/* ── Bundle Cart Bar — Fixed di bawah layar ───────────────────── */}
      {isBundleMode && bundleSelected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-72 z-50 p-3 sm:p-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900 dark:bg-indigo-700 text-white rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xl border border-white/10 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="bg-indigo-500/30 p-2 rounded-xl shrink-0">
                <Zap className="w-4 h-4 text-yellow-300" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold text-slate-400 dark:text-indigo-200 uppercase tracking-widest">
                  Bundle Dipilih ({bundleSelected.size} layanan)
                </div>
                <div className="font-bold text-sm truncate">{bundleServices.map(s => s.name).join(' + ')}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <div className="text-[10px] text-slate-400 dark:text-indigo-200 font-bold uppercase tracking-widest">Total</div>
                <div className="text-xl font-black">Rp {bundleTotalPrice.toLocaleString('id-ID')}</div>
              </div>
              <button
                onClick={handleBuyBundle}
                disabled={isProcessing || bundleSelected.size < 2}
                className="bg-indigo-500 hover:bg-indigo-400 dark:bg-white dark:text-indigo-700 dark:hover:bg-slate-100 text-white px-7 py-3.5 rounded-xl font-black text-sm transition-all disabled:opacity-50 active:scale-95 shadow-lg whitespace-nowrap"
              >
                {isProcessing
                  ? <RefreshCw className="w-4 h-4 animate-spin inline" />
                  : bundleSelected.size < 2
                    ? 'Min. 2 layanan'
                    : `⚡ Beli Bundle`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SMS Modal */}
      {smsModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSmsModal(null)}>
          <div className="bg-white dark:bg-[#0a0d16] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-white/[0.07] w-full sm:max-w-md p-5 sm:p-6 max-h-screen overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t.allSMS}</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{smsModal.name}</div>
              </div>
              <button onClick={() => setSmsModal(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingSms ? (
              <div className="py-10 flex items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" /> Mengambil data SMS...
              </div>
            ) : allSms.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <div className="font-bold text-sm">Belum ada SMS masuk</div>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {allSms.map((sms, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-4 border border-slate-100 dark:border-white/[0.09]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">SMS #{i + 1}</span>
                      <button onClick={() => copyToClipboard(sms.code, showToast)} className="text-indigo-600 dark:text-indigo-400 hover:opacity-70">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="font-black text-2xl text-slate-900 dark:text-white tracking-widest">{sms.code}</div>
                    {sms.text && sms.text !== sms.code && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{sms.text}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 
// ==========================================
interface TopupViewProps {
  balance: number;
  setBalance: React.Dispatch<React.SetStateAction<number>>;
  showToast: (msg: string) => void;
  setActiveTab: (tab: string) => void;
  setMutasi: React.Dispatch<React.SetStateAction<Mutasi[]>>;
  updateBalance: (amount: number, type: 'add' | 'subtract') => Promise<void>;
  user: UserData | null;
  lang?: Lang;
}

// Info rekening admin — sesuaikan dengan rekening kamu
const BANK_ACCOUNTS = [
  { id: 'seabank', name: 'SeaBank',   number: '901267885511', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'dana',    name: 'DANA',      number: '082115922647', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'jago',    name: 'Bank Jago', number: '503748353165', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'gopay',   name: 'GoPay',     number: '083878868994', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'qris',    name: 'QRIS',      number: 'NMID: ID1024342737094', holder: 'PUSAT NOKOS', qrisUrl: 'https://delynxoxxjzkptvrybst.supabase.co/storage/v1/object/public/deposit-proofs/6269328457800028135_121.jpg' },
];

function TopupView({ balance, setBalance, showToast, setActiveTab, setMutasi, updateBalance, user, lang }: TopupViewProps) {
  const t = T[lang ?? 'en'];
  const [depositMode, setDepositMode]   = useState<'select' | 'manual' | 'auto' | 'crypto' | 'history'>('select');
  const [amount,      setAmount]        = useState('');
  const [selectedBank,setSelectedBank]  = useState(BANK_ACCOUNTS[0]);
  const [step,        setStep]          = useState(1); // 1=isi nominal, 2=instruksi, 3=upload bukti
  const [proof,       setProof]         = useState<string | null>(null);
  const [proofName,   setProofName]     = useState('');
  const [note,        setNote]          = useState('');
  const [isLoading,   setIsLoading]     = useState(false);
  const [myRequests,  setMyRequests]    = useState<any[]>([]);
  const [waUrl,       setWaUrl]         = useState<string | null>(null);

  // Crypto deposit states
  const [cryptoAmount,   setCryptoAmount]   = useState('');
  const [cryptoLoading,  setCryptoLoading]  = useState(false);
  const [cryptoPayLink,  setCryptoPayLink]  = useState<string | null>(null);
  const [cryptoTrackId,  setCryptoTrackId]  = useState<string | null>(null);
  const [cryptoStatus,   setCryptoStatus]   = useState<'idle' | 'waiting' | 'paid' | 'expired'>('idle');
  const [cryptoAmountUSD,setCryptoAmountUSD]= useState<number | null>(null);
  const cryptoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle crypto invoice creation
  const handleCryptoDeposit = async () => {
    const amt = parseInt(cryptoAmount);
    if (!amt || amt < 50000) { showToast('Minimum deposit is Rp 50,000'); return; }
    if (!user?.email) return;

    setCryptoLoading(true);
    try {
      const res  = await fetch('/api/deposit/crypto', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders({ 'X-User-Email': user.email }) },
        body   : JSON.stringify({ email: user.email, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Failed to create payment.'); return; }

      setCryptoPayLink(data.payLink);
      setCryptoTrackId(data.trackId);
      setCryptoAmountUSD(data.amountUSD);
      setCryptoStatus('waiting');

      // Poll status every 10 seconds
      cryptoPollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/deposit/crypto?trackId=${data.trackId}`, { headers: authHeaders({ 'X-User-Email': user.email }) });
          const d = await r.json();
          if (d.status === 'Paid') {
            clearInterval(cryptoPollRef.current!);
            setCryptoStatus('paid');
            showToast(`✅ Payment confirmed! Balance has been credited.`);
            setTimeout(() => { setDepositMode('select'); setCryptoStatus('idle'); setCryptoPayLink(null); }, 3000);
          } else if (d.status === 'Expired') {
            clearInterval(cryptoPollRef.current!);
            setCryptoStatus('expired');
          }
        } catch { /* ignore poll error */ }
      }, 10000);

    } catch { showToast('Network error. Please try again.'); }
    finally { setCryptoLoading(false); }
  };

  // Cleanup poll on unmount
  useEffect(() => {
    return () => { if (cryptoPollRef.current) clearInterval(cryptoPollRef.current); };
  }, []);

  // Paymenku otomatis
  const [autoChannel,  setAutoChannel]  = useState('qris');
  const [autoLoading,  setAutoLoading]  = useState(false);
  const [autoAmount,   setAutoAmount]   = useState('');
  const [payUrl,       setPayUrl]       = useState<string | null>(null);

  const PAYMENKU_CHANNELS = [
    { code: 'qris',       name: 'QRIS',    fee: 'Rp 200 + 0.7%',  feeFlat: 200, feePct: 0.007, type: 'qr'      },
    { code: 'dana',       name: 'DANA',    fee: 'Rp 200 + 3%',    feeFlat: 200, feePct: 0.03,  type: 'ewallet' },
    { code: 'linkaja',    name: 'LinkAja', fee: 'Rp 200 + 3%',    feeFlat: 200, feePct: 0.03,  type: 'ewallet' },
  ];

  const QUICK_AUTO    = [5000, 10000, 25000, 50000, 100000, 200000];
  const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000];

  const handlePaymenku = async () => {
    if (!user?.email) return;
    const nominal = parseInt(autoAmount);
    if (!nominal || nominal < 5000) { showToast('Minimal deposit Rp 5.000'); return; }
    setAutoLoading(true);
    try {
      const res = await fetch('/api/deposit/paymenku/create', {
        method : 'POST',
        headers: authHeaders({ 'X-User-Email': user.email }),
        body   : JSON.stringify({ email: user.email, amount: nominal, channelCode: autoChannel }),
      });
      const data = await res.json();
      if (!res.ok || !data.payUrl) { showToast(data.error ?? 'Gagal membuat transaksi.'); return; }
      // Simpan payUrl ke state — tampilkan tombol agar user klik sendiri (iOS/mobile safe)
      setPayUrl(data.payUrl);
      fetchMyRequests();
    } catch { showToast('Terjadi kesalahan jaringan.'); }
    finally { setAutoLoading(false); }
  };

  // Fetch riwayat deposit user
  const fetchMyRequests = async () => {
    if (!user?.email) return;
    try {
      const r = await fetch('/api/user/deposit-history', { headers: authHeaders() });
      const data = await r.json();
      setMyRequests(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { if (depositMode === 'history') fetchMyRequests(); }, [depositMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('Ukuran file maksimal 5MB.'); return; }
    setProofName(file.name);
    const reader = new FileReader();
    reader.onload = () => setProof(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmitManual = async () => {
    if (!user?.email) return;
    if (!amount || parseInt(amount) < 10000) { showToast('Minimal deposit Rp 10.000'); return; }
    setIsLoading(true);
    try {
      const res = await fetch('/api/deposit/manual', {
        method : 'POST',
        headers: authHeaders({ 'X-User-Email': user.email }),
        body   : JSON.stringify({
          email     : user.email,
          amount    : parseInt(amount),
          bankName  : selectedBank.name,
          proofImage: proof,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error ?? 'Gagal submit request.'); return; }
      showToast('Request deposit berhasil dikirim!');

      // Siapkan URL WA untuk ditampilkan sebagai tombol (iOS tidak izinkan auto-redirect setelah async)
      const nominal = parseInt(amount).toLocaleString('id-ID');
      const userName = user.name ?? user.email;
      const metodePembayaran = selectedBank.id === 'qris' ? 'QRIS (INSTANT)' : selectedBank.name;
      const waMsg = `Hello Admin PusatNokos, I would like to confirm a Balance Top Up.\n*Top Up Details:*\n- Username: *${userName}*\n- Amount: *Rp ${nominal}*\n- Payment Method: *${metodePembayaran}*\nI have attached the transfer proof below.`;
      setWaUrl(`https://wa.me/${CS_WA}?text=${encodeURIComponent(waMsg)}`);
      setStep(4); // step sukses
      fetchMyRequests();
    } catch { showToast('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pending : { label: t.depositStatusPending,  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800/50' },
    approved: { label: t.depositStatusApproved, color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-800/50' },
    rejected: { label: t.depositStatusRejected, color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-200 dark:border-red-800/50' },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">{t.depositTitle}</h1>
        <div className="flex gap-2">
          {['select', 'history'].map(m => (
            <button key={m} onClick={() => setDepositMode(m as any)} className={"px-4 py-2 rounded-xl text-sm font-bold transition-colors " + (depositMode === m || (depositMode === 'manual' && m === 'select') || (depositMode === 'auto' && m === 'select') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.09] hover:border-indigo-300')}>
              {m === 'select' ? t.depositNew : t.depositHistory}
            </button>
          ))}
        </div>
      </div>

      {/* ── PILIH MODE ── */}
      {depositMode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div onClick={() => { setDepositMode('auto'); }} className="bg-white dark:bg-[#0a0d16] rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 p-6 cursor-pointer transition-all group relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{t.otomatis}</div>
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl w-fit mb-4 group-hover:bg-indigo-600 transition-colors">
              <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">{t.autoDeposit}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.depositAutoDesc}</p>
            <div className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">Instant · Secure · Auto →</div>
          </div>

          <div onClick={() => { setDepositMode('crypto'); setCryptoAmount(''); setCryptoStatus('idle'); setCryptoPayLink(null); }} className="bg-white dark:bg-[#0a0d16] rounded-2xl border-2 border-slate-200 dark:border-white/[0.09] hover:border-orange-400 dark:hover:border-orange-500 p-6 cursor-pointer transition-all group">
            <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-2xl w-fit mb-4 group-hover:bg-orange-500 transition-colors">
              <svg className="w-6 h-6 text-orange-500 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Crypto Payment</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Pay with any cryptocurrency. USDT, BTC, ETH, and 100+ coins supported.</p>
            <div className="mt-4 text-xs font-bold text-orange-500">USDT · BTC · ETH · +100 coins →</div>
          </div>
        </div>
      )}

      {/* ── DEPOSIT OTOMATIS (PAYMENKU) ── */}
      {depositMode === 'auto' && (
        <div className="space-y-5">
          <button onClick={() => setDepositMode('select')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            ← Back
          </button>

          {/* Pilih nominal */}
          <div className="dash-card bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-black text-slate-900 dark:text-white">{t.nominalDeposit}</h3>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AUTO.map(n => (
                <button key={n} onClick={() => setAutoAmount(String(n))}
                  className={"py-2.5 rounded-xl text-sm font-bold transition-colors " + (autoAmount === String(n) ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 border border-slate-200 dark:border-white/[0.09]')}>
                  Rp {(n/1000)}rb
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-sm font-bold text-slate-400">Rp</span>
              <input id="deposit-amount" name="amount" type="number" min="5000" aria-label="Nominal deposit" value={autoAmount} onChange={e => setAutoAmount(e.target.value)}
                placeholder="Atau ketik nominal lain..." className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-bold dark:text-white" />
            </div>
            {autoAmount && parseInt(autoAmount) >= 5000 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">= Rp {parseInt(autoAmount).toLocaleString('id-ID')}</p>
            )}
          </div>

          {/* Pilih metode */}
          <div className="dash-card bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white">{t.paymentMethod}</h3>
            <div className="space-y-2">
              {PAYMENKU_CHANNELS.map(ch => {
                const nominal = parseInt(autoAmount) || 0;
                const totalFee = nominal > 0 ? Math.round(ch.feeFlat + nominal * ch.feePct) : 0;
                const totalBayar = nominal + totalFee;
                return (
                  <button key={ch.code} onClick={() => setAutoChannel(ch.code)}
                    className={"w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left " + (autoChannel === ch.code ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-white/[0.09] hover:border-indigo-300')}>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">{ch.name}</div>
                      {nominal >= 5000 ? (
                        <div className="text-xs mt-0.5 space-x-2">
                          <span className="text-slate-400">Biaya: Rp {totalFee.toLocaleString('id-ID')}</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">Total: Rp {totalBayar.toLocaleString('id-ID')}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-0.5">{ch.fee}</div>
                      )}
                    </div>
                    <div className={"w-4 h-4 rounded-full border-2 shrink-0 " + (autoChannel === ch.code ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-white/[0.12]')}></div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Total ringkasan */}
          {autoAmount && parseInt(autoAmount) >= 5000 && (() => {
            const ch = PAYMENKU_CHANNELS.find(c => c.code === autoChannel)!;
            const nominal = parseInt(autoAmount);
            const fee = Math.round(ch.feeFlat + nominal * ch.feePct);
            return (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{t.balanceIn}</span>
                  <span className="font-bold">Rp {nominal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Biaya {ch.name}</span>
                  <span>Rp {fee.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-black text-base border-t border-indigo-200 dark:border-indigo-800 pt-2">
                  <span>{t.totalPay}</span>
                  <span>Rp {(nominal + fee).toLocaleString('id-ID')}</span>
                </div>
              </div>
            );
          })()}

          {payUrl ? (
            /* Setelah transaksi dibuat — tampilkan tombol link yang aman di iOS */
            <div className="space-y-4 text-center py-2">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white">Transaksi Dibuat!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Klik tombol di bawah untuk menyelesaikan pembayaran.</p>
              </div>
              <a href={payUrl} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-colors text-base">
                <Zap className="w-5 h-5" /> Lanjut ke Pembayaran
              </a>
              <button onClick={() => { setPayUrl(null); setAutoAmount(''); setDepositMode('history'); }}
                className="w-full py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm">
                View Deposit History
              </button>
            </div>
          ) : (
            <>
              <button onClick={handlePaymenku} disabled={autoLoading || !autoAmount || parseInt(autoAmount) < 5000}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base">
                {autoLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {autoLoading ? t.processing + '' : t.payNow}
              </button>
              <p className="text-xs text-slate-400 text-center">Saldo masuk otomatis setelah pembayaran berhasil. Tidak perlu konfirmasi manual.</p>
            </>
          )}
        </div>
      )}

      {/* ── DEPOSIT MANUAL ── */}
      {depositMode === 'manual' && (
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-colors " + (step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-[#161b28] text-slate-400')}>
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={"flex-1 h-1 rounded-full transition-colors " + (step > s ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-[#161b28]')} />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>Nominal</span><span>Instruksi</span><span>Upload Bukti</span>
          </div>

          {/* Step 1: Nominal */}
          {step === 1 && (
            <div className="dash-card rounded-[2rem] bg-white border border-slate-200 p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Nominal Deposit</label>
                <div className="relative">
                  <span className="absolute left-5 top-4 text-slate-400 font-black text-xl">Rp</span>
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,""))} min="10000" placeholder="10000" className="w-full px-14 py-4 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-black text-3xl outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white" />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {QUICK_AMOUNTS.map(q => (
                    <button key={q} onClick={() => setAmount(String(q))} className={"px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors " + (amount === String(q) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-indigo-300')}>
                      {(q / 1000).toFixed(0)}rb
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Tujuan Transfer</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BANK_ACCOUNTS.map(b => (
                    <div key={b.id} onClick={() => setSelectedBank(b)} className={"border-2 p-3 rounded-2xl cursor-pointer transition-all text-center " + (selectedBank.id === b.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-white/[0.09] hover:border-indigo-300')}>
                      <div className="font-black text-sm text-slate-900 dark:text-white">{b.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { if (!amount || parseInt(amount) < 5000) { showToast('Minimal deposit otomatis Rp 5.000'); return; } setStep(2); }} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors active:scale-95">
                Lanjut →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="dash-card rounded-[2rem] bg-white border border-slate-200 p-6 md:p-8 space-y-5">
              <div className="text-center">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Transfer ke {selectedBank.name}</div>

                {/* QRIS — tampilkan gambar QR */}
                {selectedBank.id === 'qris' ? (
                  <div className="space-y-4">
                    {selectedBank.qrisUrl && selectedBank.qrisUrl !== 'GANTI_DENGAN_URL_QRIS' ? (
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedBank.qrisUrl} alt="QRIS Pusat Nokos" width={256} height={256} className="w-64 h-64 object-contain rounded-2xl border-2 border-slate-200 dark:border-white/[0.09] p-2" />
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <div className="w-64 h-64 bg-slate-100 dark:bg-[#0f1320] rounded-2xl border-2 border-dashed border-slate-300 dark:border-white/[0.12] flex items-center justify-center">
                          <QrCode className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                        </div>
                      </div>
                    )}
                    <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-4 text-center space-y-1">
                      <div className="font-black text-slate-900 dark:text-white">{selectedBank.holder}</div>
                      <div className="text-xs text-slate-400 font-medium">{selectedBank.number}</div>
                      <div className="font-black text-indigo-600 dark:text-indigo-400 text-xl mt-2">Rp {parseInt(amount).toLocaleString('id-ID')}</div>
                    </div>
                    <p className="text-xs text-slate-400">Scan QR di atas menggunakan aplikasi e-wallet atau mobile banking manapun.</p>
                  </div>
                ) : (
                  /* Transfer biasa */
                  <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-5 space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nomor Rekening</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 dark:text-white text-lg">{selectedBank.number}</span>
                        <button onClick={() => copyToClipboard(selectedBank.number, showToast)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"><Copy className="w-4 h-4 text-slate-400" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Atas Nama</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedBank.holder}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-white/[0.09] pt-3 mt-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nominal Transfer</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-xl">Rp {parseInt(amount).toLocaleString('id-ID')}</span>
                        <button onClick={() => copyToClipboard(amount, showToast)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"><Copy className="w-4 h-4 text-slate-400" /></button>
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">Transfer sesuai nominal agar lebih mudah diverifikasi admin.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors">← Back</button>
                <button onClick={() => setStep(3)} className="flex-1 py-3.5 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors">Sudah Transfer →</button>
              </div>
            </div>
          )}

          {/* Step 3: Upload bukti */}
          {step === 3 && (
            <div className="dash-card rounded-[2rem] bg-white border border-slate-200 p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Upload Bukti Transfer</label>
                <label className={"flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors " + (proof ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-slate-300 dark:border-white/[0.12] hover:border-indigo-400 bg-slate-50 dark:bg-[#0f1320]')}>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  {proof ? (
                    <div className="text-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <div className="text-sm font-bold text-green-600 dark:text-green-400">{proofName}</div>
                      <div className="text-xs text-slate-400 mt-1">Klik untuk ganti</div>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <div className="text-sm font-bold">Klik untuk upload foto bukti</div>
                      <div className="text-xs mt-1">JPG, PNG, max 5MB</div>
                    </div>
                  )}
                </label>
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-800 dark:text-slate-200">Catatan (opsional)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Misal: transfer dari BCA atas nama Budi" className="w-full px-4 py-3 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-base font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white resize-none h-20" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3.5 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors">← Back</button>
                <button onClick={handleSubmitManual} disabled={isLoading} className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isLoading ? 'Sending...' : 'Kirim Request'}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Sukses — tombol WA */}
          {step === 4 && waUrl && (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Request Berhasil Dikirim!</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Sekarang konfirmasi ke admin via WhatsApp agar saldo segera diproses.</p>
              </div>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-3 py-4 bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold rounded-2xl transition-colors text-base"
              >
                <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Konfirmasi via WhatsApp
              </a>
              <button onClick={() => { setStep(1); setAmount(''); setProof(null); setProofName(''); setNote(''); setWaUrl(null); setDepositMode('history'); }}
                className="w-full py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm">
                View Deposit History
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── CRYPTO DEPOSIT (OXAPAY) ── */}
      {depositMode === 'crypto' && (
        <div className="space-y-5">
          <button onClick={() => { setDepositMode('select'); if (cryptoPollRef.current) clearInterval(cryptoPollRef.current); }} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            ← Back
          </button>

          {/* Idle — input nominal */}
          {cryptoStatus === 'idle' && (
            <div className="dash-card rounded-[2rem] bg-white border border-slate-200 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-orange-50 dark:bg-orange-900/20 p-2.5 rounded-2xl">
                  <svg className="w-6 h-6 text-orange-500" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white">Crypto Payment</h3>
                  <p className="text-xs text-slate-400">Powered by Oxapay · 100+ coins supported</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">Deposit Amount (IDR)</label>
                  <span className="text-xs font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-lg border border-orange-200 dark:border-orange-800/30">
                    Min. Rp 50,000
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-5 top-4 text-slate-400 font-black text-xl">Rp</span>
                  <input
                    type="text" inputMode="numeric" value={cryptoAmount}
                    onChange={e => setCryptoAmount(e.target.value.replace(/\D/g, ''))}
                    placeholder="50000"
                    className="w-full px-14 py-4 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl font-black text-3xl outline-none focus:ring-2 focus:ring-orange-500/50 dark:text-white"
                  />
                </div>
                {/* Live USD preview */}
                {cryptoAmount && parseInt(cryptoAmount) >= 50000 && (
                  <div className="mt-2 text-xs font-bold text-slate-400 text-right">
                    ≈ ${(parseInt(cryptoAmount) / 16000).toFixed(2)} USD
                  </div>
                )}
                {cryptoAmount && parseInt(cryptoAmount) > 0 && parseInt(cryptoAmount) < 50000 && (
                  <div className="mt-2 text-xs font-bold text-red-500">
                    ⚠ Minimum deposit is Rp 50,000
                  </div>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {[50000, 100000, 200000, 500000, 1000000].map(q => (
                    <button key={q} onClick={() => setCryptoAmount(String(q))}
                      className={"px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors " + (cryptoAmount === String(q) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/[0.09] hover:border-orange-300')}>
                      {(q/1000).toFixed(0)}rb
                    </button>
                  ))}
                </div>
              </div>

              {/* Info supported coins */}
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-800/30 rounded-2xl p-4">
                <div className="text-xs font-bold text-orange-700 dark:text-orange-400 mb-2">Supported Cryptocurrencies</div>
                <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                  {['USDT', 'BTC', 'ETH', 'BNB', 'SOL', 'LTC', 'DOGE', 'TRX', '+100 more'].map(c => (
                    <span key={c} className="bg-white dark:bg-[#0f1320] px-2 py-1 rounded-lg border border-slate-200 dark:border-white/[0.09]">{c}</span>
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div className="bg-slate-50 dark:bg-white/[0.04] rounded-2xl p-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2"><span>⏱</span> Invoice expires in <strong>30 minutes</strong></div>
                <div className="flex items-center gap-2"><span>⚡</span> Balance credited <strong>automatically</strong> after confirmation</div>
                <div className="flex items-center gap-2"><span>🔒</span> Secured by <strong>Oxapay</strong></div>
              </div>

              <button
                onClick={handleCryptoDeposit}
                disabled={cryptoLoading || !cryptoAmount || parseInt(cryptoAmount) < 50000}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-2xl transition-colors active:scale-95 flex items-center justify-center gap-2"
              >
                {cryptoLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
                {cryptoLoading ? 'Creating Invoice...' : 'Continue to Payment →'}
              </button>
            </div>
          )}

          {/* Waiting — show pay link */}
          {(cryptoStatus === 'waiting' || cryptoStatus === 'paid') && cryptoPayLink && (
            <div className="dash-card rounded-[2rem] bg-white border border-slate-200 p-6 md:p-8 space-y-5">
              {cryptoStatus === 'paid' ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-black text-green-600 dark:text-green-400">Payment Confirmed!</h3>
                  <p className="text-sm text-slate-400 mt-2">Your balance has been credited successfully.</p>
                </div>
              ) : (
                <>
                  <div className="text-center">
                    <div className="inline-flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-700 mb-4">
                      <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                      Waiting for payment · Expires in 30 min
                    </div>
                    <h3 className="font-black text-slate-900 dark:text-white text-lg">Complete Your Payment</h3>
                    {cryptoAmountUSD && (
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                        Amount: <span className="font-black text-slate-900 dark:text-white">Rp {parseInt(cryptoAmount).toLocaleString()}</span>
                        <span className="text-slate-400 mx-1">≈</span>
                        <span className="font-black text-orange-500">${cryptoAmountUSD} USD</span>
                      </p>
                    )}
                  </div>

                  <a href={cryptoPayLink} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors text-base">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z"/></svg>
                    Pay with Crypto
                  </a>

                  <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 rounded-2xl p-4 text-xs text-blue-700 dark:text-blue-400 font-medium">
                    <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
                    Checking payment status automatically every 10 seconds...
                  </div>

                  <button onClick={() => { setCryptoStatus('idle'); setCryptoPayLink(null); if (cryptoPollRef.current) clearInterval(cryptoPollRef.current); }}
                    className="w-full py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm">
                    Cancel Payment
                  </button>
                </>
              )}
            </div>
          )}

          {/* Expired */}
          {cryptoStatus === 'expired' && (
            <div className="dash-card rounded-[2rem] bg-white border border-slate-200 p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-red-500">Invoice Expired</h3>
              <p className="text-sm text-slate-400">The payment window has closed. Please create a new invoice.</p>
              <button onClick={() => { setCryptoStatus('idle'); setCryptoPayLink(null); setCryptoAmount(''); }}
                className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl transition-colors">
                Try Again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── RIWAYAT DEPOSIT (placeholder kept) ── */}
      {depositMode === 'history' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="bg-white dark:bg-[#0a0d16] rounded-2xl border border-slate-200 dark:border-white/[0.07] p-12 text-center text-slate-400">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div className="font-bold">Belum ada request deposit</div>
            </div>
          ) : myRequests.map((r: any) => {
            const cfg = STATUS_CFG[r.status] ?? STATUS_CFG['pending'];
            return (
              <div key={r.id} className="bg-white dark:bg-[#0a0d16] rounded-2xl border border-slate-200 dark:border-white/[0.07] p-5 flex items-center justify-between">
                <div>
                  <div className="font-black text-slate-900 dark:text-white text-lg">Rp {r.amount.toLocaleString('id-ID')}</div>
                  <div className="text-xs text-slate-400 mt-1">{r.bank_name} · {new Date(r.created_at).toLocaleString('id-ID')}</div>
                  {r.admin_note && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Catatan: {r.admin_note}</div>}
                </div>
                <span className={`px-3 py-1.5 rounded-xl text-xs font-black border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
          <button onClick={fetchMyRequests} className="w-full py-3 bg-slate-100 dark:bg-[#0f1320] text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh Status
          </button>
        </div>
      )}
    </div>
  );
}

// ==========================================
// TAB: HISTORY
// ==========================================
// ==========================================
// HISTORY FILTER DROPDOWN (custom — matches MutasiFilterDropdown style)
// ==========================================
function HistoryFilterDropdown({
  value, onChange, labels,
}: {
  value: string;
  onChange: (v: string) => void;
  labels: { all: string; success: string; waiting: string; cancelled: string; expired: string };
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const OPTS = [
    { value: '',          label: labels.all,       dot: 'bg-slate-400',   badge: '' },
    { value: 'success',   label: labels.success,   dot: 'bg-green-500',   badge: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' },
    { value: 'waiting',   label: labels.waiting,   dot: 'bg-amber-400',   badge: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50' },
    { value: 'cancelled', label: labels.cancelled, dot: 'bg-red-400',     badge: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' },
    { value: 'expired',   label: labels.expired,   dot: 'bg-violet-500',  badge: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800/50' },
  ];
  const selected = OPTS.find(o => o.value === value) ?? OPTS[0];

  return (
    <div className="relative w-full sm:w-48" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none dark:text-white hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors shadow-sm"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${selected.dot}`} />
        <span className="flex-1 text-left text-slate-700 dark:text-slate-200">{(s => s.replace(/^[^a-zA-Z\u00C0-\u024F]+/, ''))(selected.label)}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-xl z-30 overflow-hidden py-2">
          {OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold transition-colors text-left ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]'}`}
            >
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dot}`} />
              <span className="flex-1">{(s => s.replace(/^[^a-zA-Z\u00C0-\u024F]+/, ''))(opt.label)}</span>
              {opt.value !== '' && value === opt.value && opt.badge && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border uppercase tracking-wide ${opt.badge}`}>
                  {opt.value === 'success' ? 'OK' : opt.value === 'waiting' ? '…' : opt.value === 'cancelled' ? '✕' : '⏱'}
                </span>
              )}
              {value === opt.value && <Check className="w-3.5 h-3.5 ml-1 text-indigo-500 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
interface HistoryViewProps {
  orders: Order[];
  user  : UserData | null;
  lang  ?: Lang;
}

// Tipe data dari /api/history
interface ApiHistoryItem {
  activationId: string;
  phone       : string;
  service     : string;
  status      : string;
  statusLabel : string;
  otpCode     : string | null;
  priceIDR    : number | null;
  createdAt   : string | null;
}

function HistoryView({ orders, user, lang }: HistoryViewProps) {
  const t = T[lang ?? 'en'];
  const [isLoading, setIsLoading]       = useState<boolean>(true);
  const [apiHistory, setApiHistory]     = useState<ApiHistoryItem[]>([]);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [historyToast, setHistoryToast] = useState<string | null>(null);
  const [confirmData, setConfirmData] = useState<{ msg: string; onOk: () => void; onCancel: () => void } | null>(null);

  const showHistoryToast = (msg: string) => {
    setHistoryToast(msg);
    setTimeout(() => setHistoryToast(null), 3000);
  };

  // showConfirm: tampilkan modal konfirmasi, return true jika user konfirmasi
  const showConfirm = (msg: string): Promise<boolean> =>
    new Promise(resolve => {
      setConfirmData({ msg, onOk: () => resolve(true), onCancel: () => resolve(false) });
    });

  const handleReactivate = async (activationId: string) => {
    if (reactivating) return;
    setReactivating(activationId);
    try {
      // Cek harga dulu
      const costRes  = await fetch(`/api/reactivation?id=${activationId}`);
      const costData = await costRes.json();

      if (!costRes.ok) {
        // Activation ID sudah expired / tidak ditemukan di provider (404/500 upstream)
        const errStr = typeof costData.error === 'string' ? costData.error.toLowerCase() : '';
        const isExpired = !costRes.ok && (
          costRes.status === 404 ||
          errStr.includes('404') ||
          errStr.includes('not found') ||
          errStr.includes('expired') ||
          errStr.includes('invalid') ||
          errStr.includes('upstream') ||
          errStr.includes('server')
        );
        if (isExpired) {
          showHistoryToast('This number has expired at the provider and cannot be reactivated. Please buy a new number for the same service.');
        } else {
          showHistoryToast(costData.error ?? 'Failed to check price.reaktivasi.');
        }
        return;
      }

      const konfirmasi = await showConfirm(`Pakai nomor ini lagi? Biaya reaktivasi: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`);
      if (!konfirmasi) return;

      // Proses reaktivasi
      const res  = await fetch('/api/reactivation', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ id: activationId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showHistoryToast(`✅ Reaktivasi berhasil! Nomor: ${data.phone}`);
      } else {
        const errStr2 = typeof data.error === 'string' ? data.error.toLowerCase() : '';
        if (errStr2.includes('upstream') || errStr2.includes('server') || errStr2.includes('404')) {
          showHistoryToast('Reactivation failed — number has expired. Buy a new number for this service.');
        } else {
          showHistoryToast(data.error ?? 'Reactivation failed.');
        }
      }
    } catch {
      showHistoryToast('Network error. Periksa koneksi dan coba lagi.');
    } finally {
      setReactivating(null);
    }
  };

  const fetchHistory = async (p: number, status: string) => {
    if (!user?.email) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (status) params.set('status', status);
      const res  = await fetch(`/api/history?${params}`, {
        headers: authHeaders({ 'X-User-Email': user.email }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setApiHistory(prev => p === 1 ? data.items : [...prev, ...data.items]);
        setHasMore(data.items.length === 20);
      }
    } catch { /* tampilkan data lokal jika API gagal */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    setPage(1);
    fetchHistory(1, filterStatus);
  }, [filterStatus]);

  // Gabungkan: riwayat sesi ini (orders lokal) + data dari API
  // Tampilkan orders lokal di atas jika belum ada di API (berdasarkan activationId)
  const apiIds = new Set(apiHistory.map(a => a.activationId));
  const localOnly = orders.filter(o => !apiIds.has(o.activationId));

  // Parse tanggal format Indonesia "21/4/2026, 03.08.11" -> timestamp
  const parseIDDate = (s: string): number => {
    try {
      const [datePart, timePart] = s.split(', ');
      const [d, m, y] = datePart.split('/');
      const [h, mi, sec] = (timePart ?? '00.00.00').split('.');
      return new Date(+y, +m - 1, +d, +h || 0, +mi || 0, +sec || 0).getTime();
    } catch { return 0; }
  };
  const sortedLocal = [...localOnly].sort((a, b) => parseIDDate(b.date) - parseIDDate(a.date));
  const sortedApi = [...apiHistory].sort((a, b) => {
    const parse = (s: string | null) => !s ? 0 : isNaN(Date.parse(s)) ? parseIDDate(s) : Date.parse(s);
    return parse(b.createdAt) - parse(a.createdAt);
  });

  const STATUS_COLOR: Record<string, string> = {
    success   : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50',
    waiting   : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50',
    cancelled : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50',
    expired   : 'bg-slate-100 dark:bg-[#0f1320] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/[0.09]',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {historyToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-sm font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400 dark:text-yellow-600" /> {historyToast}
        </div>
      )}
      {confirmData && (
        <ConfirmModal
          message={confirmData.msg}
          onConfirm={() => { const fn = confirmData.onOk; setConfirmData(null); fn(); }}
          onCancel={() => { const fn = confirmData.onCancel; setConfirmData(null); fn?.(); }}
        />
      )}

      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">{t.historyTitle}</h1>
        <HistoryFilterDropdown
          value={filterStatus}
          onChange={v => setFilterStatus(v)}
          labels={{
            all: t.filterAll,
            success: t.filterSuccess,
            waiting: t.filterWaiting,
            cancelled: t.filterCancelled,
            expired: t.filterExpired,
          }}
        />
      </div>

      <div className="rounded-[2rem] bg-white dark:bg-[#0d1020] shadow-sm border border-slate-200 dark:border-white/[0.07] overflow-hidden transition-colors">

        {/* ===== DESKTOP: Tabel ===== */}
        <div className="dash-table hidden md:block overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 dark:bg-[#060810]/80 border-b border-slate-100 dark:border-white/[0.07]">
              <tr>
                <th className="p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.appDetailCol}</th>
                <th className="p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.phoneOtpCol}</th>
                <th className="p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.statusCol}</th>
                <th className="p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.actionCol}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {isLoading && apiHistory.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-[#161b28] rounded-lg w-32 mb-2"></div><div className="h-3 bg-slate-100 dark:bg-[#0f1320] rounded w-24"></div></td>
                    <td className="p-5 sm:px-6"><div className="h-8 bg-slate-100 dark:bg-[#0f1320] rounded-lg w-44"></div></td>
                    <td className="p-5 sm:px-6 text-right"><div className="h-6 bg-slate-200 dark:bg-[#161b28] rounded-lg w-20 ml-auto"></div></td>
                    <td className="p-5 sm:px-6 text-right"><div className="h-8 bg-slate-100 dark:bg-[#0f1320] rounded-lg w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : localOnly.length === 0 && apiHistory.length === 0 ? (
                <tr><td colSpan={4} className="py-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-[#0f1320] border border-slate-100 dark:border-white/[0.09] rounded-full flex items-center justify-center mx-auto mb-4"><History className="w-10 h-10 text-slate-300 dark:text-slate-500"/></div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Belum ada riwayat.</p>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Transaksi yang Anda lakukan akan muncul di sini.</p>
                </td></tr>
              ) : (
                <>
                  {sortedLocal.filter(o => !filterStatus || o.status === filterStatus).map(o => (
                    <tr key={'local-' + o.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.07]/50 transition-colors">
                      <td className="p-5 sm:px-6"><div className="font-bold text-base text-slate-900 dark:text-white">{o.serviceName}</div><div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{o.date}</div></td>
                      <td className="p-5 sm:px-6"><span className="font-mono font-bold text-sm bg-slate-100 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] px-3 py-1.5 rounded-lg dark:text-slate-300">{o.number}</span>{o.otpCode && <span className="text-sm font-black text-green-700 dark:text-green-400 ml-3 inline-flex items-start gap-1.5"><span className="shrink-0">OTP:</span><span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 tracking-widest break-all leading-snug">{o.otpCode}</span></span>}</td>
                      <td className="p-5 sm:px-6 text-right"><span className={"px-3.5 py-1.5 text-[11px] font-black rounded-lg border uppercase tracking-wider " + (STATUS_COLOR[o.status] ?? STATUS_COLOR['cancelled'])}>{o.status === 'cancelled' ? t.cancelBtn : o.status === 'waiting' ? t.waitingBtn : o.status === 'success' ? t.successBtn : t.expiredBtn}</span></td>
                      <td className="p-5 sm:px-6 text-right">—</td>
                    </tr>
                  ))}
                  {sortedApi.map(a => (
                    <tr key={'api-' + a.activationId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.07]/50 transition-colors">
                      <td className="p-5 sm:px-6"><div className="font-bold text-base text-slate-900 dark:text-white uppercase">{a.service}</div><div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{a.createdAt ?? '—'}</div></td>
                      <td className="p-5 sm:px-6"><span className="font-mono font-bold text-sm bg-slate-100 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] px-3 py-1.5 rounded-lg dark:text-slate-300">{a.phone}</span>{a.otpCode && <span className="text-sm font-black text-green-700 dark:text-green-400 ml-3 inline-flex items-start gap-1.5"><span className="shrink-0">OTP:</span><span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 tracking-widest break-all leading-snug">{a.otpCode}</span></span>}</td>
                      <td className="p-5 sm:px-6 text-right"><span className={"px-3.5 py-1.5 text-[11px] font-black rounded-lg border uppercase tracking-wider " + (STATUS_COLOR[a.status] ?? STATUS_COLOR['cancelled'])}>{a.statusLabel}</span></td>
                      <td className="p-5 sm:px-6 text-right">
                        {a.status === 'success' && a.activationId && (
                          <button disabled={reactivating === a.activationId}
                            onClick={async () => { setReactivating(a.activationId); try { const costRes = await fetch(`/api/reactivation?id=${a.activationId}`); const costData = await costRes.json(); if (!costRes.ok) { const e = typeof costData.error === 'string' ? costData.error.toLowerCase() : ''; showHistoryToast(e.includes('404')||e.includes('upstream')||e.includes('server')||e.includes('not found')||e.includes('invalid') ? 'Number has expired. Please buy a new one.' : (costData.error ?? 'Failed to check price.')); return; } const konfirm = await showConfirm(`Reuse number ${a.phone}? Cost: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`); if (!konfirm) return; const res = await fetch('/api/reactivation', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: a.activationId, service: a.service }) }); const data = await res.json(); if (!res.ok) { const e2 = typeof data.error === 'string' ? data.error.toLowerCase() : ''; showHistoryToast(e2.includes('upstream')||e2.includes('server') ? 'Reactivation failed — number expired.' : (data.error ?? 'Reactivation failed.')); return; } showHistoryToast(`Success! Number ${data.phone} is ready to use again.`); } catch { showHistoryToast('Network error.'); } finally { setReactivating(null); } }}
                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-[11px] font-black hover:bg-indigo-600 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1">
                            {reactivating === a.activationId ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}Pakai Lagi
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* ===== MOBILE: Card layout ===== */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06] min-h-[200px]">
          {isLoading && apiHistory.length === 0 ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse space-y-2">
                <div className="flex justify-between"><div className="h-4 bg-slate-200 dark:bg-[#161b28] rounded w-28"></div><div className="h-5 bg-slate-200 dark:bg-[#161b28] rounded w-20"></div></div>
                <div className="h-3 bg-slate-100 dark:bg-[#0f1320] rounded w-20"></div>
                <div className="h-7 bg-slate-100 dark:bg-[#0f1320] rounded-lg w-36"></div>
              </div>
            ))
          ) : localOnly.length === 0 && apiHistory.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-50 dark:bg-[#0f1320] border border-slate-100 dark:border-white/[0.09] rounded-full flex items-center justify-center mx-auto mb-3"><History className="w-8 h-8 text-slate-300 dark:text-slate-500"/></div>
              <p className="font-extrabold text-slate-800 dark:text-slate-200">Belum ada riwayat.</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Transaksi yang Anda lakukan akan muncul di sini.</p>
            </div>
          ) : (
            <>
              {sortedLocal.filter(o => !filterStatus || o.status === filterStatus).map(o => (
                <div key={'m-local-' + o.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-bold text-sm text-slate-900 dark:text-white">{o.serviceName}</div><div className="text-xs text-slate-400 mt-0.5">{o.date}</div></div>
                    <span className={"px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase shrink-0 " + (STATUS_COLOR[o.status] ?? STATUS_COLOR['cancelled'])}>{o.status === 'cancelled' ? t.cancelBtn : o.status === 'waiting' ? t.waitingBtn : o.status === 'success' ? t.successBtn : t.expiredBtn}</span>
                  </div>
                  <div className="font-mono text-xs bg-slate-100 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 inline-block">{o.number}</div>
                  {o.otpCode && <div className="flex items-start gap-1.5 text-xs font-black text-green-700 dark:text-green-400"><span className="shrink-0">OTP:</span><span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 tracking-widest break-all leading-snug">{o.otpCode}</span></div>}
                </div>
              ))}
              {sortedApi.map(a => (
                <div key={'m-api-' + a.activationId} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-bold text-sm text-slate-900 dark:text-white uppercase">{a.service}</div><div className="text-xs text-slate-400 mt-0.5">{a.createdAt ?? '—'}</div></div>
                    <span className={"px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase shrink-0 " + (STATUS_COLOR[a.status] ?? STATUS_COLOR['cancelled'])}>{a.statusLabel}</span>
                  </div>
                  <div className="font-mono text-xs bg-slate-100 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 inline-block">{a.phone}</div>
                  {a.otpCode && <div className="flex items-start gap-1.5 text-xs font-black text-green-700 dark:text-green-400"><span className="shrink-0">OTP:</span><span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 tracking-widest break-all leading-snug">{a.otpCode}</span></div>}
                  {a.status === 'success' && a.activationId && (
                    <button disabled={reactivating === a.activationId}
                      onClick={async () => { setReactivating(a.activationId); try { const costRes = await fetch(`/api/reactivation?id=${a.activationId}`); const costData = await costRes.json(); if (!costRes.ok) { const e = typeof costData.error === 'string' ? costData.error.toLowerCase() : ''; showHistoryToast(e.includes('404')||e.includes('upstream')||e.includes('server') ? 'Number has expired. Please buy a new one.' : (costData.error ?? 'Failed to check price.')); return; } const konfirm = await showConfirm(`Reuse number ${a.phone}? Cost: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`); if (!konfirm) return; const res = await fetch('/api/reactivation', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: a.activationId, service: a.service }) }); const data = await res.json(); if (!res.ok) { const e2 = typeof data.error === 'string' ? data.error.toLowerCase() : ''; showHistoryToast(e2.includes('upstream')||e2.includes('server') ? 'Reactivation failed — number expired.' : (data.error ?? 'Reactivation failed.')); return; } showHistoryToast(`Success! Number ${data.phone} is ready to use again.`); } catch { showHistoryToast('Network error.'); } finally { setReactivating(null); } }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs font-black active:scale-95 transition-all disabled:opacity-50">
                      {reactivating === a.activationId ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}Pakai Lagi
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Load more */}
        {hasMore && !isLoading && (
          <div className="p-5 border-t border-slate-100 dark:border-white/[0.07] text-center">
            <button onClick={() => { const next = page + 1; setPage(next); fetchHistory(next, filterStatus); }}
              className="px-8 py-3 bg-slate-100 dark:bg-[#0f1320] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-bold transition-colors border border-slate-200 dark:border-white/[0.09]">
              Muat Lebih Banyak
            </button>
          </div>
        )}
        {isLoading && apiHistory.length > 0 && (
          <div className="p-5 text-center text-slate-400 text-sm font-bold flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Memuat...
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// MUTASI FILTER DROPDOWN (custom — no native select)
// ==========================================
function MutasiFilterDropdown({
  value, onChange, labels,
}: {
  value: '' | 'in' | 'out';
  onChange: (v: '' | 'in' | 'out') => void;
  labels: { all: string; income: string; expense: string };
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const OPTS: { value: '' | 'in' | 'out'; label: string; dot: string; badge: string }[] = [
    { value: '',    label: labels.all,     dot: 'bg-slate-400',  badge: '' },
    { value: 'in',  label: labels.income,  dot: 'bg-green-500',  badge: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' },
    { value: 'out', label: labels.expense, dot: 'bg-red-400',    badge: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' },
  ];
  const selected = OPTS.find(o => o.value === value) ?? OPTS[0];

  return (
    <div className="relative w-full sm:w-44" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl text-sm font-bold outline-none dark:text-white hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors shadow-sm"
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${selected.dot}`} />
        <span className="flex-1 text-left text-slate-700 dark:text-slate-200">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-full bg-white dark:bg-[#0d1020] border border-slate-200 dark:border-white/[0.09] rounded-2xl shadow-xl z-30 overflow-hidden py-1.5">
          {OPTS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-bold transition-colors text-left ${value === opt.value ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05]'}`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />
              <span className="flex-1">{opt.label}</span>
              {opt.value !== '' && value === opt.value && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${opt.badge}`}>
                  {opt.value === 'in' ? '+' : '−'}
                </span>
              )}
              {value === opt.value && <Check className="w-3.5 h-3.5 ml-auto text-indigo-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ==========================================
// TAB: MUTASI SALDO (Buku Kas)
// ==========================================
interface MutasiViewProps {
  mutasi: Mutasi[];
  user: UserData | null;
  lang?: Lang;
}

function MutasiView({ mutasi, user, lang }: MutasiViewProps) {
  const t = T[lang ?? 'en'];
  const [isLoading, setIsLoading]         = useState<boolean>(true);
  const [dbMutasi, setDbMutasi]           = useState<Mutasi[]>([]);
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [filterType, setFilterType]       = useState<'' | 'in' | 'out'>('');

  const fetchMutasi = async (p: number, type: string) => {
    if (!user?.email) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      // Coba POST dulu (server baru), fallback ke GET jika 405/error
      const params = new URLSearchParams({ email: user.email, page: String(p), limit: '20' });
      if (type) params.set('type', type);

      let res = await fetch('/api/user/mutations', {
        method: 'POST',
        headers: authHeaders({ 'X-User-Email': user.email }),
        body: JSON.stringify({ page: p, limit: 20, type: type || undefined }),
      });

      // Fallback ke GET jika server belum support POST
      if (res.status === 405 || res.status === 404) {
        res = await fetch(`/api/user/mutations?${params}`, {
          headers: authHeaders({ 'X-User-Email': user.email }),
        });
      }

      const data = await res.json();
      if (Array.isArray(data.items)) {
        setDbMutasi(prev => p === 1 ? data.items : [...prev, ...data.items]);
        setHasMore(data.items.length === 20);
      }
    } catch { /* fallback ke local */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => {
    setPage(1);
    fetchMutasi(1, filterType);
  }, [filterType, user?.email]);

  // Gabung: sesi ini (lokal) + dari DB
  const dbIds  = new Set(dbMutasi.map(m => m.id));
  const localOnly = mutasi.filter(m => !dbIds.has(m.id));
  const allMutasi = [...localOnly, ...dbMutasi];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">{t.mutasiTitle}</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 hidden md:block">Catatan rinci pemasukan dan pengeluaran saldo Anda.</p>
        </div>
        <MutasiFilterDropdown
          value={filterType}
          onChange={v => setFilterType(v)}
          labels={{ all: t.mutasiAll, income: t.mutasiIn, expense: t.mutasiOut }}
        />
      </div>

      <div className="rounded-[2rem] bg-white dark:bg-[#0d1020] shadow-sm border border-slate-200 dark:border-white/[0.07] overflow-hidden transition-colors">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 dark:bg-[#060810]/80 border-b border-slate-100 dark:border-white/[0.07]">
              <tr>
                <th className="p-3 sm:p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.timeDesc}</th>
                <th className="p-3 sm:p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t.nominal}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {isLoading && dbMutasi.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3 sm:p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-[#161b28] rounded w-48 mb-2"></div><div className="h-3 bg-slate-100 dark:bg-[#0f1320] rounded w-24"></div></td>
                    <td className="p-3 sm:p-5 sm:px-6 text-right"><div className="h-6 bg-slate-200 dark:bg-[#161b28] rounded-full w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : allMutasi.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-[#0f1320] border border-slate-100 dark:border-white/[0.09] rounded-full flex items-center justify-center mx-auto mb-3"><Receipt className="w-8 h-8 text-slate-300 dark:text-slate-500"/></div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">Belum ada mutasi.</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Buku kas akan terisi saat Anda deposit atau membeli nomor.</p>
                  </td>
                </tr>
              ) : allMutasi.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.07]/50 transition-colors">
                  <td className="p-3 sm:p-5 sm:px-6">
                    <div className="font-bold text-sm sm:text-base text-slate-900 dark:text-white">{m.desc}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{m.date}</div>
                  </td>
                  <td className="p-3 sm:p-5 sm:px-6 text-right">
                    <span className={"px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-xs sm:text-sm font-black rounded-lg border whitespace-nowrap " + (m.type === 'in' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50')}>
                      {m.type === 'in' ? '+' : '-'} Rp {m.amount.toLocaleString('id-ID')}
                    </span>
                  </td>
                </tr>
              ))}
              {isLoading && dbMutasi.length > 0 && (
                <tr>
                  <td colSpan={2} className="p-5 text-center text-slate-400 text-sm font-bold">
                    <RefreshCw className="w-4 h-4 animate-spin inline mr-2" />Memuat...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {hasMore && !isLoading && (
          <div className="p-5 border-t border-slate-100 dark:border-white/[0.07] text-center">
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchMutasi(next, filterType); }}
              className="px-8 py-3 bg-slate-100 dark:bg-[#0f1320] hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-bold transition-colors border border-slate-200 dark:border-white/[0.09]"
            >
              Muat Lebih Banyak
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// TAB: PROFILE
// ==========================================
interface ProfileViewProps {
  user: UserData | null;
  showToast: (msg: string) => void;
  lang?: Lang;
}

function ProfileView({ user, showToast, lang }: ProfileViewProps) {
  const t = T[lang ?? 'en'];
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Info akun
  const [accountInfo, setAccountInfo] = useState<{ joinedAt: string; totalOrders: number; totalSpend: number } | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Ganti password
  const [oldPass,     setOldPass]     = useState('');
  const [newPass,     setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showOld,     setShowOld]     = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [passError,   setPassError]   = useState('');

  useEffect(() => {
    if (!user?.email) return;
    const fetchInfo = async () => {
      setLoadingInfo(true);
      try {
        const r = await fetch('/api/user/account-info', { headers: authHeaders() });
        const d = await r.json();
        setAccountInfo(d);
      } catch {}
      finally { setLoadingInfo(false); }
    };
    fetchInfo();
  }, [user?.email]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast("Pengaturan profil berhasil disimpan!");
    }, 1000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    if (newPass.length < 8) { setPassError('Password baru minimal 8 karakter.'); return; }
    if (newPass !== confirmPass) { setPassError('Passwords do not match.'); return; }
    setPassLoading(true);
    try {
      const r = await fetch('/api/user/change-password', {
        method : 'POST',
        headers: authHeaders({ 'X-User-Email': user?.email ?? '' }),
        // headers backup 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: user?.email, oldPassword: oldPass, newPassword: newPass }),
      });
      const d = await r.json();
      if (d.success) {
        showToast('Password berhasil diubah!');
        setOldPass(''); setNewPass(''); setConfirmPass('');
      } else {
        setPassError(d.message ?? 'Gagal mengubah password.');
      }
    } catch {
      setPassError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setPassLoading(false);
    }
  };

  const inputCls = "w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl outline-none font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 text-base transition-colors";

  return (
    <div className="max-w-3xl space-y-6 mx-auto pb-10">
      <div className="flex items-center gap-3 md:hidden mb-2">
        <button onClick={() => history.back()} className="p-2 rounded-xl bg-white dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] text-slate-500 dark:text-slate-400 shadow-sm">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Pengaturan Akun</h1>
      </div>
      <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Pengaturan Akun</h1>

      {/* ── Info Profil ── */}
      <div className="rounded-[2rem] bg-white dark:bg-[#0d1020] shadow-sm border border-slate-200 dark:border-white/[0.07] p-6 md:p-10 transition-colors">
        <div className="flex flex-col sm:flex-row items-center sm:space-x-8 mb-10 text-center sm:text-left">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center text-3xl font-black border-2 border-indigo-100 dark:border-indigo-800 shadow-sm mb-4 sm:mb-0">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">{user?.name}</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center sm:justify-start mt-1.5 text-sm">
              <Mail className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500"/> {user?.email}
            </p>
            <div className="flex gap-2 mt-3 justify-center sm:justify-start">
              <span className="inline-flex items-center bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                <CheckCircle className="w-3 h-3 mr-1"/> Verified
              </span>
            </div>
          </div>
        </div>
        <form className="space-y-6 pt-8 border-t border-slate-100 dark:border-white/[0.07]" onSubmit={handleSave}>
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Full Name</label>
            <input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-[#0f1320] border border-slate-200 dark:border-white/[0.09] rounded-2xl outline-none font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed text-base" defaultValue={user?.name} disabled />
          </div>
          <div className="pt-2">
            <button type="submit" disabled={isLoading} className="bg-slate-900 dark:bg-indigo-600 text-white font-bold text-sm px-8 py-4 rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all active:scale-95 shadow-lg w-full sm:w-auto flex justify-center items-center">
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : null}
              Perbarui Profil
            </button>
          </div>
        </form>
      </div>

      {/* ── Info Akun ── */}
      <div className="rounded-[2rem] bg-white dark:bg-[#0d1020] shadow-sm border border-slate-200 dark:border-white/[0.07] p-6 md:p-10 transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-xl">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">{t.accountInfo}</h3>
        </div>
        {loadingInfo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-5 animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-[#161b28] rounded w-20 mb-3" />
                <div className="h-6 bg-slate-200 dark:bg-[#161b28] rounded w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t.joinedAt}</div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {accountInfo?.joinedAt
                  ? accountInfo.joinedAt ? new Date(accountInfo.joinedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
                  : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t.totalOrders}</div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {accountInfo ? `${accountInfo.totalOrders ?? 0} order` : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-[#0f1320] rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">{t.totalPurchase}</div>
              <div className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {accountInfo ? `Rp ${(accountInfo.totalSpend ?? 0).toLocaleString('id-ID')}` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Ganti Password ── */}
      <div className="rounded-[2rem] bg-white dark:bg-[#0d1020] shadow-sm border border-slate-200 dark:border-white/[0.07] p-6 md:p-10 transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-50 dark:bg-amber-900/30 p-2.5 rounded-xl">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">{t.changePassword}</h3>
        </div>
        <form className="space-y-4" onSubmit={handleChangePassword}>
          {/* Password Lama */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{t.currentPass}</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPass}
                onChange={e => setOldPass(e.target.value)}
                placeholder="••••••••"
                required
                className={inputCls + ' pr-12'}
              />
              <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-4 top-4 text-slate-400 hover:text-indigo-600 transition-colors">
                {showOld ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          {/* Password Baru */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="Min. 8 karakter"
                required
                className={inputCls + ' pr-12'}
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-4 top-4 text-slate-400 hover:text-indigo-600 transition-colors">
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {/* Strength indicator */}
            {newPass.length > 0 && (
              <div className="mt-2 flex gap-1.5">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                    newPass.length >= i * 3
                      ? i <= 1 ? 'bg-red-400' : i <= 2 ? 'bg-amber-400' : i <= 3 ? 'bg-blue-400' : 'bg-green-500'
                      : 'bg-slate-200 dark:bg-[#161b28]'
                  }`} />
                ))}
                <span className="text-[10px] font-bold text-slate-400 ml-1 self-center">
                  {newPass.length < 4 ? t.passStrWeak : newPass.length < 7 ? t.passStrMed : newPass.length < 10 ? t.passStrStrong : t.passStrVeryStrong}
                </span>
              </div>
            )}
          </div>
          {/* Konfirmasi */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">{t.confirmPass}</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Repeat new password"
                required
                className={inputCls + ' pr-12' + (confirmPass && confirmPass !== newPass ? ' border-red-400 focus:ring-red-400/30' : '')}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-4 text-slate-400 hover:text-indigo-600 transition-colors">
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPass && confirmPass !== newPass && (
              <p className="text-xs text-red-500 font-bold mt-1.5">{t.passMismatch}</p>
            )}
          </div>
          {/* Error */}
          {passError && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-sm font-bold px-4 py-3 rounded-2xl">
              <AlertCircle className="w-4 h-4 shrink-0" /> {passError}
            </div>
          )}
          <div className="pt-2">
            <button
              type="submit"
              disabled={passLoading || !oldPass || !newPass || !confirmPass}
              className="bg-slate-900 dark:bg-indigo-600 text-white font-bold text-sm px-8 py-4 rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all active:scale-95 shadow-lg w-full sm:w-auto flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : <Lock className="w-4 h-4 mr-2"/>}
              {passLoading ? t.saving : t.changePassTitle}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// TAB: AFFILIATE (PROGRAM AFILIASI)
// ==========================================