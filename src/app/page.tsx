"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  status: 'waiting' | 'success' | 'cancelled' | 'expired';
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
// MOCK DATA & CONSTANTS
// ==========================================
const ALL_SERVICES: Service[] = [
  { id: 1,  code: 'wa',  name: 'WhatsApp',  category: 'Chat',       price: 3500, basePrice: 2800, profit: 700,  stock: 1240, outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dcfce7'}}><img src="https://cdn.simpleicons.org/whatsapp/25D366" className="w-6 h-6" alt="WhatsApp"/></div> },
  { id: 2,  code: 'tg',  name: 'Telegram',  category: 'Chat',       price: 2500, basePrice: 2000, profit: 500,  stock: 850,  outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dbeafe'}}><img src="https://cdn.simpleicons.org/telegram/26A5E4" className="w-6 h-6" alt="Telegram"/></div> },
  { id: 3,  code: 'li',  name: 'Line',      category: 'Chat',       price: 1500, basePrice: 1200, profit: 300,  stock: 420,  outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dcfce7'}}><img src="https://cdn.simpleicons.org/line/00C300" className="w-6 h-6" alt="Line"/></div> },
  { id: 4,  code: 'gj',  name: 'Gojek',     category: 'Transport',  price: 1500, basePrice: 1200, profit: 300,  stock: 430,  outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dcfce7'}}><img src="https://cdn.simpleicons.org/gojek/00AA13" className="w-6 h-6" alt="Gojek"/></div> },
  { id: 5,  code: 'gr',  name: 'Grab',      category: 'Transport',  price: 1500, basePrice: 1200, profit: 300,  stock: 320,  outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dcfce7'}}><img src="https://cdn.simpleicons.org/grab/00B14F" className="w-6 h-6" alt="Grab"/></div> },
  { id: 6,  code: 'mx',  name: 'Maxim',     category: 'Transport',  price: 1200, basePrice: 900,  profit: 300,  stock: 890,  outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0" style={{background:'#fef9c3'}}>🚕</div> },
  { id: 7,  code: 'sp',  name: 'Shopee',    category: 'E-Commerce', price: 2000, basePrice: 1600, profit: 400,  stock: 2100, outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#fee2e2'}}><img src="https://cdn.simpleicons.org/shopee/EE4D2D" className="w-6 h-6" alt="Shopee"/></div> },
  { id: 8,  code: 'tpd', name: 'Tokopedia', category: 'E-Commerce', price: 2000, basePrice: 1600, profit: 400,  stock: 1100, outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dcfce7'}}><img src="https://cdn.simpleicons.org/tokopedia/42B549" className="w-6 h-6" alt="Tokopedia"/></div> },
  { id: 9,  code: 'lz',  name: 'Lazada',    category: 'E-Commerce', price: 1500, basePrice: 1200, profit: 300,  stock: 750,  outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dbeafe'}}><img src="https://cdn.simpleicons.org/lazada/0F136D" className="w-6 h-6" alt="Lazada"/></div> },
  { id: 10, code: 'ig',  name: 'Instagram', category: 'Social',     price: 1000, basePrice: 800,  profit: 200,  stock: 5000, outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#fce7f3'}}><img src="https://cdn.simpleicons.org/instagram/E1306C" className="w-6 h-6" alt="Instagram"/></div> },
  { id: 11, code: 'tk',  name: 'TikTok',    category: 'Social',     price: 1200, basePrice: 900,  profit: 300,  stock: 3400, outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#f1f5f9'}}><img src="https://cdn.simpleicons.org/tiktok/010101" className="w-6 h-6" alt="TikTok"/></div> },
  { id: 12, code: 'fb',  name: 'Facebook',  category: 'Social',     price: 1000, basePrice: 800,  profit: 200,  stock: 4200, outOfStock: false, icon: <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden shrink-0" style={{background:'#dbeafe'}}><img src="https://cdn.simpleicons.org/facebook/1877F2" className="w-6 h-6" alt="Facebook"/></div> },
];

const CATEGORIES: string[] = ['Semua', 'Chat', 'Social', 'E-Commerce', 'Transport', 'Finance', 'Gaming', 'Streaming', 'Dating', 'Travel', 'Tech', 'Lainnya'];

const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'qris', name: 'QRIS Otomatis', fee: 0, type: 'qr' },
  { id: 'va_bca', name: 'BCA Virtual Account', fee: 4000, type: 'va' },
  { id: 'dana', name: 'DANA E-Wallet', fee: 150, type: 'ewallet' },
  { id: 'ovo', name: 'OVO E-Wallet', fee: 150, type: 'ewallet' }
];

const COUNTRIES: Country[] = [
  { id: 'id', name: '🇮🇩 Indonesia (+62)' },
  { id: 'us', name: '🇺🇸 United States (+1)' },
  { id: 'uk', name: '🇬🇧 United Kingdom (+44)' },
  { id: 'my', name: '🇲🇾 Malaysia (+60)' },
  { id: 'th', name: '🇹🇭 Thailand (+66)' }
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
      fallbackCallback('Gagal menyalin');
    }
    document.body.removeChild(textArea);
  }
};

const formatTimeStr = (s: number): string => {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return m + ":" + sec;
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
export default function App() {
  const [currentView, setCurrentView] = useState<string>('landing');
  const [user, setUser] = useState<UserData | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
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

  // Baca preferensi saat pertama mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = saved === 'dark' || (!saved && prefersDark);
    setIsDarkMode(shouldBeDark);
    if (shouldBeDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    // ── Restore session dari localStorage ────────────────────────────
    try {
      const savedSession = localStorage.getItem('nokos_session');
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as UserData;
        if (parsed?.email) {
          setUser(parsed);
          setCurrentView('dashboard');
        }
      }
    } catch { /* session rusak, abaikan */ }
  }, []);

  // Apply/remove class 'dark' di <html> setiap kali isDarkMode berubah
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
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

  const getServiceIcon = (code: string, name: string): React.ReactNode => {
    const n = name.toLowerCase();

    // Map nama ke Simple Icons CDN (https://cdn.simpleicons.org/[slug]/[color])
    const logoMap: [string[], { slug: string; bg: string; color: string }][] = [
      [['whatsapp'],           { slug: 'whatsapp',      bg: '#dcfce7', color: '25D366' }],
      [['telegram'],           { slug: 'telegram',      bg: '#dbeafe', color: '26A5E4' }],
      [['instagram'],          { slug: 'instagram',     bg: '#fce7f3', color: 'E1306C' }],
      [['tiktok'],             { slug: 'tiktok',        bg: '#f1f5f9', color: '010101' }],
      [['facebook'],           { slug: 'facebook',      bg: '#dbeafe', color: '1877F2' }],
      [['google','gmail'],     { slug: 'google',        bg: '#fee2e2', color: 'EA4335' }],
      [['twitter','x.com'],    { slug: 'x',             bg: '#f1f5f9', color: '000000' }],
      [['shopee'],             { slug: 'shopee',        bg: '#fee2e2', color: 'EE4D2D' }],
      [['tokopedia'],          { slug: 'tokopedia',     bg: '#dcfce7', color: '42B549' }],
      [['lazada'],             { slug: 'lazada',        bg: '#dbeafe', color: '0F136D' }],
      [['gojek'],              { slug: 'gojek',         bg: '#dcfce7', color: '00AA13' }],
      [['grab'],               { slug: 'grab',          bg: '#dcfce7', color: '00B14F' }],
      [['netflix'],            { slug: 'netflix',       bg: '#fee2e2', color: 'E50914' }],
      [['spotify'],            { slug: 'spotify',       bg: '#dcfce7', color: '1DB954' }],
      [['discord'],            { slug: 'discord',       bg: '#ede9fe', color: '5865F2' }],
      [['amazon'],             { slug: 'amazon',        bg: '#fef3c7', color: 'FF9900' }],
      [['microsoft','outlook'],{ slug: 'microsoft',     bg: '#dbeafe', color: '00A4EF' }],
      [['apple','icloud'],     { slug: 'apple',         bg: '#f1f5f9', color: '000000' }],
      [['paypal'],             { slug: 'paypal',        bg: '#dbeafe', color: '003087' }],
      [['binance'],            { slug: 'binance',       bg: '#fef9c3', color: 'F3BA2F' }],
      [['tinder'],             { slug: 'tinder',        bg: '#fee2e2', color: 'FF6B6B' }],
      [['line'],               { slug: 'line',          bg: '#dcfce7', color: '00C300' }],
      [['signal'],             { slug: 'signal',        bg: '#dbeafe', color: '3A76F0' }],
      [['steam'],              { slug: 'steam',         bg: '#e2e8f0', color: '1B2838' }],
      [['roblox'],             { slug: 'roblox',        bg: '#fee2e2', color: 'E02525' }],
      [['linkedin'],           { slug: 'linkedin',      bg: '#dbeafe', color: '0A66C2' }],
      [['youtube'],            { slug: 'youtube',       bg: '#fee2e2', color: 'FF0000' }],
      [['snapchat'],           { slug: 'snapchat',      bg: '#fef9c3', color: 'FFFC00' }],
      [['pinterest'],          { slug: 'pinterest',     bg: '#fee2e2', color: 'E60023' }],
      [['dana'],               { slug: 'dana',          bg: '#dbeafe', color: '1F8EE1' }],
      [['ovo'],                { slug: 'ovo',           bg: '#ede9fe', color: '4C3494' }],
      [['gopay'],              { slug: 'gojek',         bg: '#dcfce7', color: '00AA13' }],
      [['airbnb'],             { slug: 'airbnb',        bg: '#fee2e2', color: 'FF5A5F' }],
      [['uber'],               { slug: 'uber',          bg: '#f1f5f9', color: '000000' }],
      [['reddit'],             { slug: 'reddit',        bg: '#fee2e2', color: 'FF4500' }],
      [['twitch'],             { slug: 'twitch',        bg: '#ede9fe', color: '9146FF' }],
      [['vk','vkontakte'],     { slug: 'vk',            bg: '#dbeafe', color: '4A76A8' }],
      [['wechat'],             { slug: 'wechat',        bg: '#dcfce7', color: '07C160' }],
      [['viber'],              { slug: 'viber',         bg: '#ede9fe', color: '7360F2' }],
      [['skype'],              { slug: 'skype',         bg: '#dbeafe', color: '00AFF0' }],
      [['bumble'],             { slug: 'bumble',        bg: '#fef9c3', color: 'F1AE14' }],
      [['booking'],            { slug: 'bookingdotcom', bg: '#dbeafe', color: '003580' }],
      [['traveloka'],          { slug: 'traveloka',     bg: '#dbeafe', color: '0064D3' }],
      [['coinbase'],           { slug: 'coinbase',      bg: '#dbeafe', color: '0052FF' }],
      [['bybit'],              { slug: 'bybit',         bg: '#fef9c3', color: 'F7A600' }],
      [['okx'],                { slug: 'okx',           bg: '#f1f5f9', color: '000000' }],
      [['ebay'],               { slug: 'ebay',          bg: '#fee2e2', color: 'E53238' }],
      [['blibli'],             { slug: 'blibli',        bg: '#dbeafe', color: '0060AF' }],
      [['bukalapak'],          { slug: 'bukalapak',     bg: '#fee2e2', color: 'E91E8C' }],
      [['yahoo'],              { slug: 'yahoo',         bg: '#ede9fe', color: '720E9E' }],
    ];

    for (const [keys, cfg] of logoMap) {
      if (keys.some(k => n.includes(k))) {
        return (
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: cfg.bg }}>
            <img
              src={`https://cdn.simpleicons.org/${cfg.slug}/${cfg.color}`}
              alt={name}
              className="w-6 h-6 object-contain"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = 'none';
                el.parentElement!.innerHTML = '📱';
              }}
            />
          </div>
        );
      }
    }

    // Default fallback
    return (
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0" style={{ background: '#eef2ff' }}>
        📱
      </div>
    );
  };

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

  const handleLogin = (userData: UserData) => { 
    setUser(userData);
    // Simpan session ke localStorage
    localStorage.setItem('nokos_session', JSON.stringify(userData));
    showToast("Berhasil login, selamat datang " + userData.name + "!"); 
    navigate('dashboard'); 
  };

  const handleLogout = () => { 
    setUser(null);
    localStorage.removeItem('nokos_session');
    showToast("Anda berhasil keluar dari sistem keamanan."); 
    navigate('landing'); 
  };

  // Cek blacklist setiap 30 detik — auto logout jika diblokir
  useEffect(() => {
    if (!user?.email) return;
    const checkBlacklist = async () => {
      try {
        const res = await fetch(`/api/auth/check-blacklist?email=${encodeURIComponent(user.email)}`);
        const data = await res.json();
        if (data.is_blacklisted) {
          setUser(null);
          localStorage.removeItem('nokos_session');
          navigate('login');
          showToast('Akun Anda telah diblokir oleh admin.');
        }
      } catch { /* abaikan error jaringan */ }
    };
    checkBlacklist();
    const interval = setInterval(checkBlacklist, 30000);
    return () => clearInterval(interval);
  }, [user?.email]);

  return (
    <div className="relative text-slate-800 dark:text-slate-200 font-sans selection:bg-indigo-200 selection:text-indigo-900 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300">
      
      {/* GLOBAL TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] bg-slate-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-slate-900 px-6 py-3.5 rounded-full shadow-2xl font-bold flex items-center transition-all animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 mr-2.5 text-green-400 dark:text-green-600" /> {toastMsg}
        </div>
      )}

      {currentView === 'login' || currentView === 'register' ? (
        <AuthView type={currentView} onNavigate={navigate} onAuth={handleLogin} showToast={showToast} isDarkMode={isDarkMode} />
      ) : currentView === 'dashboard' ? (
        <DashboardLayout user={user} onLogout={handleLogout} showToast={showToast} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeServices={activeServices} countries={countries} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} />
      ) : (
        <LandingPage onNavigate={navigate} showToast={showToast} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeServices={activeServices} />
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
}

function LandingPage({ onNavigate, showToast, isDarkMode, setIsDarkMode, activeServices }: LandingPageProps) {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  useEffect(() => {
    if (isMenuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; }
  }, [isMenuOpen]);

  const filteredServices = activeServices.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5);

  const faqs = [
    { q: "Apa itu Pusat Nokos?", a: "Layanan penyedia nomor virtual sekali pakai untuk menerima SMS OTP verifikasi akun secara aman." },
    { q: "Apakah akun saya aman?", a: "Sangat aman. Kami menggunakan sistem enkripsi dan perlindungan akun untuk menjamin saldo & transaksi Anda aman." },
    { q: "Bagaimana jika OTP tidak kunjung masuk?", a: "Jika OTP tidak masuk dalam batas waktu 10-15 menit atau pesanan dibatalkan, saldo Anda akan otomatis dikembalikan 100% ke akun (Auto Refund)." },
    { q: "Apakah layanan ini aktif 24 Jam?", a: "Tentu, sistem kami beroperasi penuh secara otomatis 24/7. Anda bisa mengakses layanan kapan saja." }
  ];

  const scrollToId = (e: React.MouseEvent<HTMLElement>, id: string) => {
    e.preventDefault(); 
    setIsMenuOpen(false);
    const el = document.getElementById(id); 
    if(el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#020617] transition-colors duration-300">
      <button onClick={() => showToast("Membuka Live Chat WhatsApp...")} aria-label="Hubungi Customer Service" className="fixed bottom-6 left-6 z-[90] bg-[#25D366] text-white p-4 rounded-full shadow-[0_8px_30px_rgb(37,211,102,0.3)] hover:bg-[#1ebd5a] transition-all transform hover:scale-110 flex items-center group">
        <MessageSquare className="w-6 h-6" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs group-hover:ml-3 transition-all duration-300 font-bold text-sm">Hubungi CS</span>
      </button>

      <nav className="fixed w-full z-50 top-0 transition-all bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center">
            <div className="flex items-center cursor-pointer" onClick={() => onNavigate('landing')}>
              <div className="bg-indigo-600 p-2 rounded-xl shadow-indigo-200 dark:shadow-none shadow-lg"><Smartphone className="h-6 w-6 text-white" /></div>
              <span className="ml-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Pusat Nokos<span className="text-indigo-600">.</span></span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#beranda" onClick={(e) => scrollToId(e, 'beranda')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Beranda</a>
              <a href="#demo" onClick={(e) => scrollToId(e, 'demo')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Harga & Demo</a>
              <a href="#fitur" onClick={(e) => scrollToId(e, 'fitur')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Fitur Keamanan</a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => onNavigate('login')} className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2.5 rounded-xl transition hover:bg-slate-100 dark:hover:bg-slate-800">Masuk</button>
              <button onClick={() => onNavigate('register')} className="text-sm font-bold bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform active:scale-95">Mulai Gratis</button>
            </div>
            <div className="md:hidden flex items-center space-x-2">
              <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-slate-500 dark:text-slate-400">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle Menu" className="p-2 text-slate-800 dark:text-slate-200">{isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}</button>
            </div>
          </div>
        </div>
        {isMenuOpen && (
          <div className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 absolute w-full shadow-2xl pb-6 px-4 animate-in slide-in-from-top-4">
            <div className="flex flex-col space-y-2 pt-4">
              <a href="#demo" onClick={(e) => scrollToId(e, 'demo')} className="font-bold text-slate-800 dark:text-slate-200 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition">Harga & Demo</a>
              <a href="#fitur" onClick={(e) => scrollToId(e, 'fitur')} className="font-bold text-slate-800 dark:text-slate-200 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition">Fitur Keamanan</a>
              <hr className="border-slate-100 dark:border-slate-800 my-2" />
              <button onClick={() => onNavigate('login')} className="w-full font-bold border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-3.5 rounded-xl">Masuk</button>
              <button onClick={() => onNavigate('register')} className="w-full font-bold bg-indigo-600 text-white px-4 py-3.5 rounded-xl shadow-md">Mulai Gratis</button>
            </div>
          </div>
        )}
      </nav>

      {/* HERO SECTION */}
      <div id="beranda" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/15 dark:bg-indigo-500/10 blur-[120px] rounded-full"></div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-sm font-bold mb-8 shadow-sm">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 mr-2.5 animate-pulse"></span> Dipercaya 50K+ Pengguna Aktif
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-tight">
            Verifikasi Akun <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">Aman & Terpercaya.</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Platform Nomor Kosong (Nokos) Enterprise-level dengan jaminan Auto Refund 100% dan server stabil 24 Jam.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => onNavigate('register')} className="flex items-center justify-center px-8 py-4 text-base font-bold rounded-2xl text-white bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 shadow-xl hover:shadow-indigo-500/30 transition-all hover:-translate-y-1">
              Buka Dashboard <ArrowRight className="ml-2 w-5 h-5"/>
            </button>
            <button onClick={(e) => scrollToId(e, 'fitur')} className="flex items-center justify-center px-8 py-4 border-2 border-slate-200 dark:border-slate-800 text-base font-bold rounded-2xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <ShieldCheck className="mr-2 w-5 h-5 text-indigo-600 dark:text-indigo-400"/> Pelajari Fitur
            </button>
          </div>
        </div>
      </div>

      {/* DEMO HARGA */}
      <div id="demo" className="py-24 bg-slate-900 dark:bg-[#090f1e] text-white relative border-t border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1">
            <div className="bg-slate-800 dark:bg-slate-800/50 rounded-[2rem] p-2 border border-slate-700 shadow-2xl">
              <div className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden text-slate-800 dark:text-slate-200 flex flex-col h-[500px]">
                <div className="bg-indigo-50/50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div><h3 className="font-bold text-lg dark:text-white">Cek Harga Layanan Real-time</h3><p className="text-xs text-slate-500 dark:text-slate-400">Cari aplikasi yang Anda butuhkan</p></div>
                </div>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="relative">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                    <input type="text" placeholder="Contoh: Shopee, Telegram..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium transition-shadow dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-3">
                  {filteredServices.length > 0 ? filteredServices.map((s) => (
                    <div key={s.id} className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex justify-between items-center mb-3 hover:border-indigo-200 dark:hover:border-indigo-500 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="bg-slate-50 dark:bg-slate-700 p-2.5 rounded-xl border border-slate-100 dark:border-slate-600">{s.icon}</div>
                        <div><div className="font-bold text-sm text-slate-900 dark:text-white">{s.name}</div><div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5">Stok: <span className="text-green-600 dark:text-green-400">{s.stock}</span></div></div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-indigo-600 dark:text-indigo-400 text-sm">Rp {s.price.toLocaleString('id-ID')}</div>
                        <button onClick={() => { showToast('Silakan login untuk mulai membeli!'); onNavigate('login'); }} className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3.5 py-1.5 rounded-lg mt-1.5 hover:bg-indigo-600 hover:text-white transition-colors">BELI NOMOR</button>
                      </div>
                    </div>
                  )) : <div className="text-center py-16 text-slate-400 text-sm font-medium"><Search className="w-10 h-10 mx-auto text-slate-300 mb-3"/>Aplikasi tidak ditemukan.</div>}
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2 text-center lg:text-left">
            <h2 className="text-indigo-400 font-bold tracking-wide uppercase mb-3 text-sm">Transparan & Real-time</h2>
            <h3 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">Harga Termurah,<br/>Stok Selalu Tersedia.</h3>
            <p className="text-lg text-slate-400 mb-8 leading-relaxed">
              Coba cari aplikasi di panel demo tanpa perlu mendaftar. Kami menjamin ketersediaan stok nomor <i>fresh</i> diperbarui secara real-time dari puluhan negara.
            </p>
            <ul className="space-y-4 text-left inline-block lg:block">
              <li className="flex items-center text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-indigo-400 mr-3 shrink-0"/> Harga layanan mulai dari Rp 1.000 / OTP.</li>
              <li className="flex items-center text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-indigo-400 mr-3 shrink-0"/> Transaksi dienkripsi penuh (End-to-End).</li>
              <li className="flex items-center text-slate-300 font-medium"><CheckCircle2 className="w-6 h-6 text-indigo-400 mr-3 shrink-0"/> Kualitas nomor premium, tingkat sukses 99%.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* BENTO GRID (FITUR KEAMANAN) */}
      <div id="fitur" className="py-24 bg-[#fafafa] dark:bg-[#020617]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-2 text-sm">Keamanan & Kepercayaan</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">Platform Enterprise-Level</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto auto-rows-[minmax(250px,auto)]">
            
            {/* Box 1: Auto Refund (Besar) */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
              <div className="relative z-10">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-5"><ShieldAlert className="w-7 h-7 text-indigo-600 dark:text-indigo-400"/></div>
                <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Auto Refund 100%</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md leading-relaxed">Sistem pintar kami melacak setiap OTP secara real-time. Jika dalam waktu tunggu kode tidak masuk, saldo Anda dikembalikan utuh otomatis tanpa potongan.</p>
              </div>
              <RefreshCw className="absolute -right-4 -bottom-12 w-64 h-64 text-indigo-600 opacity-5 group-hover:opacity-10 transition-transform duration-700 group-hover:rotate-180" />
            </div>
            
            {/* Box 2: Transaksi (Kecil Warna) */}
            <div className="bg-indigo-600 text-white rounded-3xl p-8 shadow-xl flex flex-col justify-center relative overflow-hidden group">
              <div className="relative z-10">
                <Wallet className="w-12 h-12 text-green-400 mb-5"/>
                <h4 className="text-xl font-bold mb-2">Transaksi Instan</h4>
                <p className="text-indigo-100 text-sm leading-relaxed">Deposit via QRIS & VA diproses hitungan detik. Riwayat tercatat transparan.</p>
              </div>
              <Zap className="w-40 h-40 text-white opacity-10 absolute -right-8 -bottom-8 group-hover:scale-110 transition-transform duration-500" />
            </div>

            {/* Box 3: Privasi (Kecil) */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
              <div className="relative z-10">
                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center mb-5"><EyeOff className="w-7 h-7 text-slate-700 dark:text-slate-300"/></div>
                <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Privasi Terjaga</h4>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Jauhkan nomor pribadi Anda dari ancaman spam, telemarketing, atau kebocoran data.</p>
              </div>
            </div>

            {/* Box 4: Server Stabil (Besar Gelap) */}
            <div className="md:col-span-2 bg-slate-900 dark:bg-slate-950 text-white rounded-3xl p-8 shadow-xl flex items-center justify-between relative overflow-hidden border border-slate-800 group">
              <div className="w-full sm:w-2/3 relative z-10">
                <Server className="w-12 h-12 text-blue-400 mb-5"/>
                <h4 className="text-xl font-bold mb-2">Infrastruktur Stabil 99.9%</h4>
                <p className="text-slate-400 text-sm leading-relaxed">Kami menggunakan teknologi server mutakhir untuk menjamin platform tetap responsif dan dapat diakses 24 jam penuh tanpa hambatan.</p>
              </div>
              <Globe className="hidden sm:block w-48 h-48 text-white opacity-5 absolute -right-6 top-1/2 -translate-y-1/2 transition-transform duration-[20s] group-hover:rotate-180" />
            </div>

          </div>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-[#fafafa] dark:bg-slate-950 py-24 border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12"><h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Pertanyaan yang Sering Diajukan</h2></div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <button 
                  onClick={() => setActiveFaq(activeFaq === i ? null : i)} 
                  className="w-full px-6 py-5 text-left flex justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none transition-colors"
                >
                  {faq.q} <ChevronDown className={"w-5 h-5 text-slate-400 transition-transform " + (activeFaq === i ? 'rotate-180' : '')} />
                </button>
                {activeFaq === i && <div className="px-6 pb-5 pt-1 text-slate-600 dark:text-slate-400 text-sm leading-relaxed animate-in slide-in-from-top-2">{faq.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="bg-white dark:bg-slate-900 pt-16 pb-8 border-t border-slate-200 dark:border-slate-800 text-center sm:text-left">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="md:pr-8">
            <div className="flex items-center justify-center sm:justify-start mb-6">
              <div className="bg-indigo-600 p-2 rounded-lg"><Smartphone className="h-6 w-6 text-white" /></div>
              <span className="ml-2 text-xl font-black text-slate-900 dark:text-white">Pusat Nokos.</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Platform penyedia Nomor Kosong (Nokos) otomatis nomor 1 di Indonesia untuk verifikasi OTP yang aman dan terpercaya.</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-5 uppercase text-sm tracking-wider">Layanan</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <li><a href="#demo" onClick={(e)=>scrollToId(e as any, 'demo')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Daftar Harga Realtime</a></li>
              <li><a href="#" onClick={() => {onNavigate('login'); showToast("Login untuk melakukan deposit");}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Deposit Saldo</a></li>

            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-5 uppercase text-sm tracking-wider">Perusahaan</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <li><a href="#" onClick={(e)=>{e.preventDefault(); showToast("Membuka Aturan Layanan...");}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Syarat & Ketentuan</a></li>
              <li><a href="#" onClick={(e)=>{e.preventDefault(); showToast("Membuka Privasi...");}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Kebijakan Privasi</a></li>
              <li><a href="#faq" onClick={(e)=>scrollToId(e as any, 'faq')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Bantuan FAQ</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-5 uppercase text-sm tracking-wider">Hubungi Kami</h4>
            <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400 font-medium">
              <li className="flex justify-center sm:justify-start items-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={()=>showToast("Membuka Telegram Admin..")}><Send className="w-4 h-4 mr-2 text-indigo-400" /> @cs_pusatnokos</li>
              <li className="flex justify-center sm:justify-start items-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" onClick={()=>showToast("Membuka Email..")}><Mail className="w-4 h-4 mr-2 text-indigo-400" /> cs@pusatnokos.com</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center">
           <div className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-4 md:mb-0">&copy; {new Date().getFullYear()} Pusat Nokos. Seluruh hak cipta dilindungi.</div>
           <div className="flex space-x-3">
              <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded text-xs font-bold text-slate-600 dark:text-slate-300">Terenskripsi E2E</span>
              <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded text-xs font-bold text-slate-600 dark:text-slate-300">QRIS / VA</span>
           </div>
        </div>
      </footer>
    </div>
  );
}

// ==========================================
// AUTH VIEW
// ==========================================
interface AuthViewProps {
  type: string;
  onNavigate: (view: string) => void;
  onAuth: (user: UserData) => void;
  showToast: (msg: string) => void;
  isDarkMode: boolean;
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

  const isLogin = type === 'login';

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── LOGIN ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email dan password wajib diisi.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Email atau password salah.'); return; }
      onAuth({ name: data.user.name, email: data.user.email });
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
    if (password !== confirmPass) { setError('Konfirmasi password tidak cocok.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
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
      onAuth({ name: data.user.name, email: data.user.email });
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
    if (password !== confirmPass) { setError('Konfirmasi password tidak cocok.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otpCode, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Gagal reset password.'); return; }
      showToast('Password berhasil diubah! Silakan login.');
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
      if (!res.ok) { setError(data.error ?? 'Gagal kirim ulang.'); return; }
      setCountdown(60); setOtpCode('');
      showToast('Kode baru telah dikirim!');
    } catch { setError('Gagal kirim ulang.'); }
    finally { setIsLoading(false); }
  };

  const inputCls = "w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 dark:text-white text-sm font-medium transition-all";
  const btnCls   = (loading: boolean) => "w-full flex justify-center items-center py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-70 " + (loading ? "bg-indigo-400" : "bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700");

  const ErrorBox = () => error ? (
    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 rounded-2xl">
      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
    </div>
  ) : null;

  const OtpInput = () => (
    <div>
      <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Kode Verifikasi (6 digit)</label>
      <input
        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required autoFocus
        value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
        className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:border-indigo-500 dark:text-white text-3xl font-black tracking-[0.5em] text-center transition-all"
        placeholder="000000"
      />
      <p className="text-xs text-slate-400 mt-2 text-center">Berlaku 10 menit</p>
    </div>
  );

  const ResendRow = ({ onBack }: { onBack: () => void }) => (
    <div className="flex items-center justify-between pt-2">
      <button type="button" onClick={onBack} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition">← Kembali</button>
      <button type="button" onClick={handleResendOTP} disabled={countdown > 0 || isLoading} className="text-sm font-bold text-indigo-600 dark:text-indigo-400 disabled:text-slate-400 disabled:cursor-not-allowed transition">
        {countdown > 0 ? `Kirim ulang (${countdown}s)` : "Kirim Ulang"}
      </button>
    </div>
  );

  const titles: Record<string, string> = {
    form:   isLogin ? "Selamat Datang Kembali" : "Buat Akun Nokos",
    verify : "Verifikasi Email",
    forgot : "Lupa Password",
    reset  : "Reset Password",
  };
  const subtitles: Record<string, React.ReactNode> = {
    form:   <>{isLogin ? "Belum punya akun? " : "Sudah punya akun? "}<button onClick={() => onNavigate(isLogin ? "register" : "login")} className="font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 transition">{isLogin ? "Daftar Sekarang" : "Masuk di sini"}</button></>,
    verify : <span>Kode dikirim ke <strong className="text-slate-800 dark:text-white">{email}</strong></span>,
    forgot : "Masukkan email untuk menerima kode reset",
    reset  : <span>Kode reset dikirim ke <strong className="text-slate-800 dark:text-white">{email}</strong></span>,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="mx-auto w-full max-w-md text-center mb-8 relative z-10">
        <div className="flex justify-center cursor-pointer mb-6 hover:scale-105 transition-transform" onClick={() => onNavigate("landing")}>
          <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700"><Smartphone className="h-10 w-10 text-indigo-600 dark:text-indigo-400" /></div>
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{titles[step]}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">{subtitles[step]}</p>
      </div>

      <div className="mx-auto w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl relative z-10">

        {/* ── LOGIN FORM ── */}
        {step === "form" && isLogin && (
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Alamat Email</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="email@contoh.com" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-bold text-slate-800 dark:text-slate-200">Password</label>
                <button type="button" onClick={() => { setStep("forgot"); setError(""); }} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800">Lupa password?</button>
              </div>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <ErrorBox />
            <button type="submit" disabled={isLoading} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : null}
              {isLoading ? "Memproses..." : "Masuk ke Dashboard"}
            </button>
          </form>
        )}

        {/* ── REGISTER FORM ── */}
        {step === "form" && !isLogin && (
          <form className="space-y-5" onSubmit={handleRegister}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Nama Lengkap</label>
              <div className="relative"><User className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type="text" required value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="Nama Anda" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Alamat Email</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="email@contoh.com" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Password</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="Min. 6 karakter" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Konfirmasi Password</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type={showConfirm ? "text" : "password"} required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className={inputCls + " pr-12"} placeholder="Ulangi password" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showConfirm ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <ErrorBox />
            <button type="submit" disabled={isLoading} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : null}
              {isLoading ? "Mengirim Kode..." : "Daftar Sekarang"}
            </button>
          </form>
        )}

        {/* ── VERIFY EMAIL (setelah register) ── */}
        {step === "verify" && (
          <form className="space-y-5" onSubmit={handleVerify}>
            <OtpInput />
            <ErrorBox />
            <button type="submit" disabled={isLoading || otpCode.length !== 6} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : <CheckCircle2 className="w-5 h-5 mr-2"/>}
              {isLoading ? "Memverifikasi..." : "Aktifkan Akun"}
            </button>
            <ResendRow onBack={() => { setStep("form"); setError(""); setOtpCode(""); }} />
          </form>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {step === "forgot" && (
          <form className="space-y-5" onSubmit={handleForgotSend}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Alamat Email</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="email@contoh.com" />
              </div>
            </div>
            <ErrorBox />
            <button type="submit" disabled={isLoading} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : <Mail className="w-5 h-5 mr-2"/>}
              {isLoading ? "Mengirim..." : "Kirim Kode Reset"}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => { setStep("form"); setError(""); }} className="text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 transition">← Kembali ke Login</button>
            </div>
          </form>
        )}

        {/* ── RESET PASSWORD ── */}
        {step === "reset" && (
          <form className="space-y-5" onSubmit={handleReset}>
            <OtpInput />
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Password Baru</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + " pr-12"} placeholder="Min. 6 karakter" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showPassword ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Konfirmasi Password Baru</label>
              <div className="relative"><Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type={showConfirm ? "text" : "password"} required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className={inputCls + " pr-12"} placeholder="Ulangi password baru" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-3.5 text-slate-400 hover:text-indigo-600 transition">{showConfirm ? <EyeOff className="w-5 h-5"/> : <Eye className="w-5 h-5"/>}</button>
              </div>
            </div>
            <ErrorBox />
            <button type="submit" disabled={isLoading || otpCode.length !== 6} className={btnCls(isLoading)}>
              {isLoading ? <RefreshCw className="w-5 h-5 animate-spin mr-2"/> : <CheckCircle2 className="w-5 h-5 mr-2"/>}
              {isLoading ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
            <ResendRow onBack={() => { setStep("forgot"); setError(""); setOtpCode(""); }} />
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
  countries: Country[];
  selectedCountry: string;
  setSelectedCountry: (val: string) => void;
}

function DashboardLayout({ user, onLogout, showToast, isDarkMode, setIsDarkMode, activeServices, countries, selectedCountry, setSelectedCountry }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<string>('buy');
  const [balance, setBalance] = useState<number>(user?.balance ?? 0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mutasi, setMutasi] = useState<Mutasi[]>([]);
  const [favorites, setFavorites] = useState<number[]>([1, 2]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [autoRetryQueue, setAutoRetryQueue] = useState<{serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[]>([]);
  // Blacklist nomor yang pernah gagal/expired (shared ke BuyView)
  const failedNumbers = useRef<Set<string>>(new Set());

  // ── Fetch saldo + order dari Supabase saat pertama load ────────────
  useEffect(() => {
    if (!user?.email) return;

    // Fetch saldo
    fetch(`/api/user/balance?email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => { if (typeof d.balance === 'number') setBalance(d.balance); })
      .catch(() => {});

    // Fetch orders aktif
    fetch(`/api/user/orders?email=${encodeURIComponent(user.email)}`)
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
          status       : o.status as Order['status'],
          timeLeft     : Math.max(0, 1200 - Math.floor((Date.now() - new Date(o.created_at).getTime()) / 1000)),
          otpCode      : o.otp_code ?? null,
          isV2         : o.is_v2 ?? false,
        }));
        setOrders(mapped);
      })
      .catch(() => {});
  }, [user?.email]);

  // ── Helper: update saldo di Supabase + state ───────────────────────
  const updateBalance = async (amount: number, type: 'add' | 'subtract') => {
    const newBal = type === 'add' ? balance + amount : Math.max(0, balance - amount);
    setBalance(newBal);
    if (!user?.email) return;
    try {
      await fetch('/api/user/balance', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: user.email, amount, type }),
      });
    } catch { /* update lokal sudah cukup jika gagal */ }
  };

  const handleCancelOrder = async (orderId: number) => {
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!orderToCancel || orderToCancel.status !== 'waiting') return;

    if (orderToCancel.activationId) {
      try {
        await fetch('/api/order', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: orderToCancel.activationId, action: 'cancel' }),
        });
      } catch { /* lanjutkan refund meski API gagal */ }
    }

    // Update saldo di Supabase
    await updateBalance(orderToCancel.price, 'add');
    // Update status order di Supabase
    fetch('/api/user/orders', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ activationId: orderToCancel.activationId, status: 'cancelled' }),
    }).catch(() => {});

    setOrders(current => current.map(order =>
      order.id === orderId ? { ...order, status: 'cancelled', timeLeft: 0 } : order
    ));
    setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString('id-ID'), type: 'in', amount: orderToCancel.price, desc: 'Refund Batal: ' + orderToCancel.serviceName }, ...prev]);
    showToast('Pesanan dibatalkan. Saldo Rp ' + orderToCancel.price.toLocaleString('id-ID') + ' dikembalikan.');
  };

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
              return { ...o, status: 'success', otpCodes };
            }
            return { ...o, status: 'success', otpCode: event.smsCode };
          }));
          showToast(`OTP masuk: ${event.smsCode}`);
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
                service: order.bundleServices?.[i] ?? `Layanan ${i + 1}`,
                code,
              }));
              setOrders(current => current.map(o =>
                o.id === order.id ? { ...o, status: 'success', otpCodes } : o
              ));
              fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'success', otpCode: data.otpCodes[0] }) }).catch(() => {});
              showToast(`OTP bundle ${order.serviceName} masuk!`);
            } else if (!order.isV2 && data.otpCode) {
              setOrders(current => current.map(o =>
                o.id === order.id ? { ...o, status: 'success', otpCode: data.otpCode } : o
              ));
              fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'success', otpCode: data.otpCode }) }).catch(() => {});
              showToast(`Berhasil! Kode OTP ${order.serviceName} masuk.`);
            }
          } else if (data.status === 'cancel') {
            setOrders(current => current.map(o =>
              o.id === order.id ? { ...o, status: 'cancelled', timeLeft: 0 } : o
            ));
            fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'cancelled' }) }).catch(() => {});
          }
        } catch { /* abaikan error jaringan sementara */ }
      }
    }, 5000);

    return () => {
      es?.close();
      clearInterval(pollInterval);
    };
  }, [showToast]); // showToast stable karena useCallback — interval dibuat SEKALI saja

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
              updateBalance(order.price, 'add');
              fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'expired' }) }).catch(() => {});
              setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString('id-ID'), type: 'in', amount: order.price, desc: "Refund Kadaluarsa: " + order.serviceName }, ...prev]);
              showToast(`⏱ Nomor ${order.serviceName} kadaluarsa. Mencari nomor baru otomatis...`);
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

  const [notifCount,  setNotifCount]  = useState(0);
  const [notifItems,  setNotifItems]  = useState<{ id: number; msg: string; time: string; read: boolean }[]>([]);
  const [showNotif,   setShowNotif]   = useState(false);

  // Tambah notifikasi baru
  const addNotif = (msg: string) => {
    const item = { id: Date.now(), msg, time: new Date().toLocaleTimeString('id-ID'), read: false };
    setNotifItems(prev => [item, ...prev].slice(0, 20));
    setNotifCount(c => c + 1);
  };

  const navItems: NavItem[] = [
    { id: 'dashboard', name: 'Dashboard', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'buy',     name: 'Beli Nomor',        icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'topup',   name: 'Deposit Saldo',      icon: <CreditCard className="w-5 h-5" /> },
    { id: 'history', name: 'Riwayat Transaksi',  icon: <History className="w-5 h-5" /> },
    { id: 'mutasi',  name: 'Mutasi Saldo',       icon: <Receipt className="w-5 h-5" /> },
    { id: 'profile', name: 'Pengaturan Akun',    icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#020617] flex flex-col md:flex-row font-sans relative transition-colors duration-300">
      
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed h-full z-10 shadow-sm transition-colors duration-300">
        <div className="h-[80px] flex items-center px-8 border-b border-slate-100 dark:border-slate-800">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-md shadow-indigo-200 dark:shadow-none mr-3"><Smartphone className="h-6 w-6 text-white" /></div>
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">PusatNokos.</span>
        </div>
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-2 tracking-widest uppercase">Total Saldo</div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">Rp {balance.toLocaleString('id-ID')}</div>
        </div>
        <div className="flex-1 py-6 px-5 space-y-2 overflow-y-auto">
          {navItems.map(i => (
            <button key={i.id} onClick={() => setActiveTab(i.id)} className={"w-full flex items-center px-4 py-4 text-[15px] font-bold rounded-2xl transition-all " + (activeTab === i.id ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg shadow-slate-900/20 dark:shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400')}>
              <div className={"mr-4 " + (activeTab === i.id ? 'text-indigo-400 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500')}>{i.icon}</div>{i.name}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN WRAPPER */}
      <div className="flex-1 md:ml-72 flex flex-col min-h-screen overflow-x-hidden">
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-[80px] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 shadow-sm transition-colors duration-300">
          <div className="md:hidden flex items-center font-black text-xl tracking-tight dark:text-white">
            <Smartphone className="h-7 w-7 text-indigo-600 dark:text-indigo-400 mr-2"/> PusatNokos.
          </div>
          
          <div className="hidden md:flex items-center">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{navItems.find(i => i.id === activeTab)?.name}</h2>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-5">
            <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {/* Notifikasi Bell */}
            <div className="relative">
              <button onClick={() => { setShowNotif(v => !v); setNotifCount(0); }} className="relative p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <Bell className="w-5 h-5" />
                {notifCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-12 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white text-sm">Notifikasi</span>
                    <button onClick={() => { setNotifItems([]); setShowNotif(false); }} className="text-xs text-slate-400 hover:text-red-500 font-bold">Hapus semua</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifItems.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-sm font-medium">
                        <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                        Belum ada notifikasi
                      </div>
                    ) : notifItems.map(n => (
                      <div key={n.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{n.msg}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{n.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <button onClick={() => setActiveTab('topup')} className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-5 py-2.5 rounded-xl text-sm hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm">+ Topup</button>
            <button onClick={onLogout} className="hidden md:flex font-bold text-slate-500 dark:text-slate-400 text-sm hover:text-red-600 dark:hover:text-red-400 px-3 py-2 rounded-xl transition-colors"><LogOut className="w-5 h-5 mr-2"/> Keluar</button>
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl"><Menu className="h-6 w-6" /></button>
          </div>
        </header>

        {/* MOBILE SIDEBAR OVERLAY */}
        {isSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsSidebarOpen(false)}>
            <div className="bg-white dark:bg-slate-900 w-[280px] h-full flex flex-col shadow-2xl animate-in slide-in-from-left-full duration-300" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-start">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Saldo Anda</div>
                  <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">Rp {balance.toLocaleString('id-ID')}</div>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 py-6 px-5 space-y-2 overflow-y-auto">
                {navItems.map(i => (
                  <button key={i.id} onClick={() => {setActiveTab(i.id); setIsSidebarOpen(false);}} className={"w-full flex items-center px-5 py-4 text-sm font-bold rounded-2xl transition-colors " + (activeTab === i.id ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400')}>
                    <div className={"mr-4 " + (activeTab === i.id ? 'text-indigo-400 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500')}>{i.icon}</div> {i.name}
                  </button>
                ))}
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800">
                <button onClick={onLogout} className="w-full font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 py-4 rounded-2xl flex justify-center items-center transition-colors"><LogOut className="w-5 h-5 mr-2"/> Keluar Akun</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 pb-32 md:pb-8">
          {activeTab === 'dashboard' && <UserDashboardView user={user} balance={balance} orders={orders} mutasi={mutasi} setActiveTab={setActiveTab} />}
          {activeTab === 'buy' && <BuyView balance={balance} setBalance={setBalance} orders={orders} setOrders={setOrders} showToast={showToast} onCancelOrder={handleCancelOrder} favorites={favorites} setFavorites={setFavorites} setMutasi={setMutasi} activeServices={activeServices} countries={countries} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} user={user} updateBalance={updateBalance} autoRetryQueue={autoRetryQueue} setAutoRetryQueue={setAutoRetryQueue} failedNumbers={failedNumbers} />}
          {activeTab === 'topup' && <TopupView balance={balance} setBalance={setBalance} showToast={showToast} setActiveTab={setActiveTab} setMutasi={setMutasi} updateBalance={updateBalance} user={user} />}
          {activeTab === 'history' && <HistoryView orders={orders} />}
          {activeTab === 'mutasi' && <MutasiView mutasi={mutasi} user={user} />}
          {activeTab === 'profile' && <ProfileView user={user} showToast={showToast} />}
        </main>
      </div>
    </div>
  );
}

// ==========================================
// TAB: 1. BUY NUMBERS
// ==========================================
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
  countries: Country[];
  selectedCountry: string;
  setSelectedCountry: (val: string) => void;
  user: UserData | null;
  updateBalance: (amount: number, type: 'add' | 'subtract') => Promise<void>;
  autoRetryQueue: {serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[];
  setAutoRetryQueue: React.Dispatch<React.SetStateAction<{serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[]>>;
  failedNumbers: React.MutableRefObject<Set<string>>;
}

// ==========================================
// TAB: DASHBOARD RINGKASAN USER
// ==========================================
function UserDashboardView({ user, balance, orders, mutasi, setActiveTab }: {
  user: UserData | null;
  balance: number;
  orders: Order[];
  mutasi: Mutasi[];
  setActiveTab: (tab: string) => void;
}) {
  const fmtIDR = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

  const totalOrder    = orders.length;
  const successOrder  = orders.filter(o => o.status === 'success').length;
  const activeOrder   = orders.filter(o => o.status === 'waiting').length;
  const totalSpend    = mutasi.filter(m => m.type === 'out').reduce((s, m) => s + m.amount, 0);
  const totalTopup    = mutasi.filter(m => m.type === 'in').reduce((s, m) => s + m.amount, 0);
  const successRate   = totalOrder > 0 ? Math.round((successOrder / totalOrder) * 100) : 0;
  const recentMutasi  = mutasi.slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Halo, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Selamat datang di Pusat Nokos</p>
      </div>

      {/* Saldo card */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-[2rem] p-6 text-white">
        <div className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Total Saldo</div>
        <div className="text-4xl font-black mb-4">{fmtIDR(balance)}</div>
        <button onClick={() => setActiveTab('topup')} className="bg-white/20 hover:bg-white/30 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors border border-white/20">
          + Deposit Saldo
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Order',     value: totalOrder,          icon: <Package className="w-5 h-5 text-indigo-600" />,  bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
          { label: 'Order Sukses',    value: successOrder,        icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, bg: 'bg-green-50 dark:bg-green-900/30' },
          { label: 'Sedang Aktif',    value: activeOrder,         icon: <Activity className="w-5 h-5 text-amber-600" />,  bg: 'bg-amber-50 dark:bg-amber-900/30' },
          { label: 'Sukses Rate',     value: successRate + '%',   icon: <TrendingUp className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50 dark:bg-blue-900/30' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
            <div className={`${s.bg} p-2.5 rounded-xl w-fit mb-3`}>{s.icon}</div>
            <div className="text-xl font-black text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-xs font-bold text-slate-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total spend vs topup */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <h3 className="text-sm font-black text-slate-900 dark:text-white mb-4">Ringkasan Keuangan</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total Deposit</span>
              <span className="font-black text-green-600 dark:text-green-400">{fmtIDR(totalTopup)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Total Belanja</span>
              <span className="font-black text-red-500 dark:text-red-400">{fmtIDR(totalSpend)}</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Sisa Saldo</span>
              <span className="font-black text-indigo-600 dark:text-indigo-400">{fmtIDR(balance)}</span>
            </div>
          </div>
        </div>

        {/* Recent mutasi */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-slate-900 dark:text-white">Transaksi Terakhir</h3>
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
          { label: 'Beli Nomor OTP', tab: 'buy',     icon: <ShoppingCart className="w-5 h-5" />, color: 'bg-indigo-600 text-white' },
          { label: 'Deposit Saldo',  tab: 'topup',   icon: <Wallet className="w-5 h-5" />,       color: 'bg-green-600 text-white' },
          { label: 'Riwayat',        tab: 'history', icon: <History className="w-5 h-5" />,       color: 'bg-slate-800 dark:bg-slate-700 text-white' },
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

// ── Custom Country Dropdown ──────────────────────────────────────────
function CountryDropdown({ countries, value, onChange }: {
  countries: Country[];
  value: string;
  onChange: (val: string) => void;
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
    <div ref={ref} className="relative w-full sm:w-[260px]">
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Negara Server</label>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-sm"
      >
        <span className="text-xl leading-none">{meta.flag}</span>
        <span className="flex-1 text-left truncate">{selected?.name ?? 'Pilih Negara'}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 w-full z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari negara..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none dark:text-white font-medium"
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
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-left transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
                >
                  <span className="text-xl leading-none w-7 shrink-0">{m.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
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
const SORT_OPTIONS = [
  { value: 'default',    label: 'Rekomendasi',  icon: '⭐' },
  { value: 'price_asc',  label: 'Harga Terendah', icon: '↓' },
  { value: 'price_desc', label: 'Harga Tertinggi', icon: '↑' },
  { value: 'stock_desc', label: 'Stok Terbanyak',  icon: '📦' },
];
function SortDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Urutkan</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-sm min-w-[160px]"
      >
        <span>{selected.icon}</span>
        <span className="flex-1 text-left">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 w-52 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-left transition-colors ${opt.value === value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
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

function BuyView({ balance, setBalance, orders, setOrders, showToast, onCancelOrder, favorites, setFavorites, setMutasi, activeServices, countries, selectedCountry, setSelectedCountry, user, updateBalance, autoRetryQueue, setAutoRetryQueue, failedNumbers }: BuyViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
  const [sortOrder, setSortOrder] = useState<string>('default');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [isRefreshingStok, setIsRefreshingStok] = useState<boolean>(false);

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
      showToast(`Tidak bisa auto-retry ${retry.serviceName}: saldo tidak cukup atau layanan tidak ditemukan.`);
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
    if (balance < bundleTotalPrice) { showToast('Saldo tidak cukup! Silakan Deposit terlebih dahulu.'); return; }

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
      if (!res.ok) { showToast(data.error ?? 'Gagal memesan bundle.'); return; }

      setBalance(prev => prev - bundleTotalPrice);
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
      setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString('id-ID'), type: 'out', amount: bundleTotalPrice, desc: 'Bundle: ' + newOrder.serviceName }, ...prev]);
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
      else showToast(data.error ?? "Gagal kirim ulang OTP.");
    } catch {
      showToast("Kesalahan jaringan saat kirim ulang.");
    }
  };

  useEffect(() => {
    setIsLoadingData(true);
    const timer = setTimeout(() => { setIsLoadingData(false); }, 600);
    return () => clearTimeout(timer);
  }, [activeCategory, selectedCountry, sortOrder]);

  let displayServices = sourceServices.filter(s => 
    (activeCategory === 'Semua' || s.category === activeCategory) && 
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
      showToast('Saldo tidak cukup! Silakan Deposit terlebih dahulu.'); 
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
        headers: { 'Content-Type': 'application/json' },
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
      setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString('id-ID'), type: 'out', amount: service.price, desc: "Beli " + service.name }, ...prev]);
      // Simpan order ke Supabase
      if (user?.email) {
        fetch('/api/user/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email, activationId: data.activationId, serviceCode: service.code, serviceName: service.name, phone: data.phone, price: service.price, country: selectedCountry }),
        }).catch(() => {});
      }
      showToast("Berhasil memesan " + service.name + " — " + data.phone);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      showToast('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Beli Nomor OTP</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Pilih layanan aplikasi. Harga & stok diperbarui secara real-time.</p>
        </div>
        <button
          onClick={() => { setIsBundleMode(v => !v); setBundleSelected(new Set()); }}
          className={"px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all shrink-0 " + (isBundleMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500')}
        >
          {isBundleMode ? '✕ Batal Bundle' : '⚡ Mode Bundle'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col xl:flex-row gap-5 justify-between items-end z-10 transition-colors">
        {/* Country Dropdown */}
        <div className="w-full xl:w-auto flex items-end space-x-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 shrink-0 mb-0.5">
            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CountryDropdown
            countries={countries}
            value={selectedCountry}
            onChange={setSelectedCountry}
          />
        </div>

        <div className="hidden xl:block w-px h-12 bg-slate-200 dark:bg-slate-800 mx-2 mb-0.5"></div>

        {/* Search */}
        <div className="flex-1 w-full relative">
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Pencarian</label>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Ketik WhatsApp, Telegram..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-bold transition-all shadow-sm dark:text-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Sort Dropdown */}
        <SortDropdown value={sortOrder} onChange={setSortOrder} />
      </div>

      <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar px-1">
        {CATEGORIES.map(cat => (
          <button 
            key={cat} 
            onClick={() => setActiveCategory(cat)} 
            className={"px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap border-2 transition-all " + (activeCategory === cat ? 'bg-indigo-600 dark:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500')}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className={`grid grid-cols-1 ${activeOrders.length > 0 ? 'xl:grid-cols-3' : ''} gap-8 items-start`}>
        
        <div className={"bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden flex flex-col transition-colors " + (activeOrders.length > 0 ? 'xl:col-span-2' : '')}>
          <div className="overflow-x-auto flex-1 min-h-[400px] max-h-[600px] overflow-y-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-5 sm:px-6 w-2/5">Layanan App</th>
                  <th className="p-5 sm:px-6 w-1/5">Stok Server</th>
                  <th className="p-5 sm:px-6 w-1/5">Harga / OTP</th>
                  <th className="p-5 sm:px-6 text-right w-1/5">{isBundleMode ? 'Pilih' : 'Aksi'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {isLoadingData ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-5 sm:px-6">
                        <div className="flex items-center gap-4">
                          <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0"></div>
                          <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl shrink-0"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-28"></div>
                            <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-16"></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 sm:px-6"><div className="h-4 bg-slate-100 dark:bg-slate-800 rounded-lg w-20"></div></td>
                      <td className="p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-24"></div></td>
                      <td className="p-5 sm:px-6 text-right"><div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-32 ml-auto"></div></td>
                    </tr>
                  ))
                ) : finalServices.length > 0 ? (
                  finalServices.map(s => (
                    <tr key={s.id} className={"hover:bg-indigo-50/40 dark:hover:bg-slate-800/50 transition-colors group " + (s.outOfStock ? 'opacity-60' : '')}>
                      <td className="p-5 sm:px-6">
                        <div className="flex items-center">
                          <button 
                            onClick={() => toggleFavorite(s.id)}
                            className="mr-3 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0"
                          >
                            <Star className={`w-4 h-4 transition-colors ${favorites.includes(s.id) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} />
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 group-hover:scale-110 transition-transform">
                              {s.icon}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-[15px]">{s.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 inline-block font-bold uppercase tracking-wider">{s.category}</div>
                                {s.outOfStock && <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800/50 font-bold uppercase tracking-wider">Stok Habis</div>}
                                {serviceSuccessRates[s.name] !== undefined && (
                                  <div className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${
                                    serviceSuccessRates[s.name] >= 70
                                      ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50'
                                      : serviceSuccessRates[s.name] >= 40
                                        ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
                                        : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
                                  }`}>✓ {serviceSuccessRates[s.name]}% sukses</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 sm:px-6">
                        <span className={"inline-flex items-center text-sm font-bold px-3 py-1.5 rounded-lg border " + (s.outOfStock ? 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50' : 'text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700')}>
                          <span className={"w-2 h-2 rounded-full mr-2 shrink-0 " + (s.outOfStock ? 'bg-red-500' : 'bg-green-500')}></span>
                          {s.outOfStock ? 'Kosong' : s.stock.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-5 sm:px-6">
                        <div className="font-black text-slate-900 dark:text-white text-base">Rp {s.price.toLocaleString('id-ID')}</div>
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">per OTP</div>
                      </td>
                      <td className="p-5 sm:px-6 text-right">
                        {isBundleMode ? (
                          <button
                            onClick={() => !s.outOfStock && toggleBundle(s.id)}
                            disabled={s.outOfStock}
                            className={"w-7 h-7 rounded-lg border-2 flex items-center justify-center ml-auto transition-all " + (s.outOfStock ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed' : bundleSelected.has(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400')}
                          >
                            {bundleSelected.has(s.id) && <Check className="w-4 h-4 text-white" />}
                          </button>
                        ) : (
                          <button 
                            onClick={() => !s.outOfStock && handleBuy(s)} 
                            disabled={isProcessing || s.outOfStock} 
                            className={"text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-md w-full max-w-[140px] ml-auto transition-all flex justify-center items-center " + (s.outOfStock ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : isProcessing ? 'bg-indigo-400 cursor-wait' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:shadow-lg active:scale-95')}
                          >
                            {s.outOfStock ? 'Habis' : isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : 'Beli Nomor'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-24 text-center">
                      <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><Filter className="w-10 h-10 text-slate-300 dark:text-slate-500" /></div>
                      <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Layanan tidak ditemukan</p>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Coba sesuaikan kata kunci pencarian Anda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bundle Cart Bar */}
        {isBundleMode && bundleSelected.size > 0 && (
          <div className="bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-in slide-in-from-bottom-4 duration-200">
            <div>
              <div className="text-xs font-bold text-slate-400 dark:text-indigo-200 uppercase tracking-widest mb-1">Bundle Dipilih ({bundleSelected.size} layanan)</div>
              <div className="font-bold text-sm">{bundleServices.map(s => s.name).join(' + ')}</div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <div className="text-xs text-slate-400 dark:text-indigo-200">Total</div>
                <div className="text-xl font-black">Rp {bundleTotalPrice.toLocaleString('id-ID')}</div>
              </div>
              <button
                onClick={handleBuyBundle}
                disabled={isProcessing || bundleSelected.size < 2}
                className="bg-indigo-600 dark:bg-white dark:text-indigo-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-indigo-500 dark:hover:bg-slate-100 transition-colors disabled:opacity-50 active:scale-95 shadow-lg"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : bundleSelected.size < 2 ? 'Min. 2 layanan' : 'Beli Bundle'}
              </button>
            </div>
          </div>
        )}

        {activeOrders.length > 0 && (
          <div className="xl:col-span-1 space-y-4 sticky top-[104px]">
            <div className="bg-indigo-600 text-white rounded-[2rem] shadow-xl overflow-hidden border border-indigo-500 animate-in fade-in slide-in-from-right-8 duration-300">
              <div className="px-6 py-4 border-b border-indigo-500/50 flex items-center bg-indigo-700/60 font-bold">
                <Zap className="w-5 h-5 mr-2 text-yellow-300" /> Pesanan Aktif ({activeOrders.length})
              </div>
              
              <div className="p-4 sm:p-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto bg-indigo-600/20">
                {activeOrders.map(o => (
                  <div key={o.id} className={"bg-white/10 backdrop-blur-md rounded-3xl p-5 border shadow-sm relative overflow-hidden transition-all " + (o.status === 'success' ? 'border-green-400 ring-2 ring-green-400/50' : 'border-white/20')}>
                    {o.status === 'success' && <div className="absolute -right-6 -top-6 w-20 h-20 bg-green-500 rounded-full blur-2xl opacity-40 animate-pulse"></div>}
                    
                    <div className="flex justify-between items-center mb-4 relative z-10">
                      <div className="flex items-center font-bold text-sm">
                        <div className="w-9 h-9 mr-3 flex items-center justify-center bg-white border border-slate-100 rounded-xl shadow-sm text-indigo-600">{o.icon}</div>
                        {o.serviceName}
                      </div>
                      {o.status === 'waiting' && (
                        <span className="bg-indigo-900/50 text-indigo-100 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-indigo-400/30 flex items-center shadow-sm">
                          <Clock className="w-3 h-3 mr-1.5"/>{formatTimeStr(o.timeLeft)}
                        </span>
                      )}
                      {o.status === 'success' && (
                        <span className="bg-green-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider shadow-sm">SELESAI</span>
                      )}
                    </div>

                    {/* Action buttons row */}
                    {o.status === 'waiting' && (
                      <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
                        <button 
                          onClick={() => handleResend(o)}
                          className="bg-blue-500/20 text-blue-200 hover:bg-blue-500 hover:text-white py-2 rounded-xl text-[11px] font-bold border border-blue-500/30 transition-colors active:scale-95"
                        >
                          RESEND
                        </button>
                        <button
                          onClick={() => openSmsModal(o)}
                          className="bg-white/10 text-white hover:bg-white/20 py-2 rounded-xl text-[11px] font-bold border border-white/20 transition-colors active:scale-95"
                        >
                          SMS
                        </button>
                        <button 
                          onClick={() => onCancelOrder(o.id)} 
                          disabled={o.timeLeft > 900}
                          className={"py-2 rounded-xl text-[11px] font-bold border transition-colors active:scale-95 " + (o.timeLeft > 900 ? 'bg-white/5 text-white/30 border-white/10 cursor-not-allowed' : 'bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white border-red-500/30')}
                          title={o.timeLeft > 900 ? 'Tunggu 5 menit sebelum bisa membatalkan' : 'Batalkan pesanan'}
                        >
                          BATAL
                        </button>
                      </div>
                    )}

                    <div className="space-y-3 relative z-10">
                      <div>
                        <span className="text-[10px] uppercase text-indigo-200 font-bold tracking-wider mb-1.5 block">Nomor HP Diterima</span>
                        <div className="bg-white text-slate-900 px-4 py-3 rounded-xl font-mono text-lg font-black tracking-widest cursor-pointer shadow-inner text-center hover:bg-slate-50 transition-colors flex justify-center items-center group" onClick={() => copyToClipboard(o.number, showToast)}>
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
                            <div className="bg-green-500 text-white px-4 py-3.5 rounded-xl font-black text-2xl tracking-widest cursor-pointer shadow-lg text-center border border-green-400 hover:bg-green-400 transition-colors animate-in zoom-in flex justify-center items-center group" onClick={() => copyToClipboard(o.otpCode ?? '', showToast)}>
                              {o.otpCode} <Copy className="w-5 h-5 ml-2.5 opacity-70 group-hover:opacity-100 transition-opacity"/>
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
                          <span className="text-[10px] uppercase text-indigo-200 font-bold tracking-wider mb-2 block">Semua SMS Masuk ({o.allSms.length})</span>
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
                                showToast('Belum ada SMS lain yang masuk.');
                              }
                            } catch { showToast('Gagal mengambil SMS.'); }
                          }}
                          className="mt-2 w-full text-[11px] font-bold text-indigo-300 hover:text-white py-2 border border-indigo-400/30 hover:border-indigo-300 rounded-xl transition-colors"
                        >
                          Lihat Semua SMS
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      {/* SMS Modal */}
      {smsModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setSmsModal(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Semua SMS Masuk</div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{smsModal.name}</div>
              </div>
              <button onClick={() => setSmsModal(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
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
                  <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
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
}

// Info rekening admin — sesuaikan dengan rekening kamu
const BANK_ACCOUNTS = [
  { id: 'seabank', name: 'SeaBank',   number: '901267885511', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'dana',    name: 'DANA',      number: '082115922647', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'jago',    name: 'Bank Jago', number: '503748353165', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'gopay',   name: 'GoPay',     number: '083878868994', holder: 'Pusat Nokos', qrisUrl: '' },
  { id: 'qris',    name: 'QRIS',      number: 'NMID: ID1024342737094', holder: 'PUSAT NOKOS', qrisUrl: 'https://ihqpgbtmvocasnqrspjr.supabase.co/storage/v1/object/public/deposit-proofs/6269328457800028135_121.jpg' },
];

function TopupView({ balance, setBalance, showToast, setActiveTab, setMutasi, updateBalance, user }: TopupViewProps) {
  const [depositMode, setDepositMode]   = useState<'select' | 'manual' | 'history'>('select');
  const [amount,      setAmount]        = useState('');
  const [selectedBank,setSelectedBank]  = useState(BANK_ACCOUNTS[0]);
  const [step,        setStep]          = useState(1); // 1=isi nominal, 2=instruksi, 3=upload bukti
  const [proof,       setProof]         = useState<string | null>(null);
  const [proofName,   setProofName]     = useState('');
  const [note,        setNote]          = useState('');
  const [isLoading,   setIsLoading]     = useState(false);
  const [myRequests,  setMyRequests]    = useState<any[]>([]);

  const QUICK_AMOUNTS = [10000, 25000, 50000, 100000, 200000, 500000];

  // Fetch riwayat deposit user
  const fetchMyRequests = async () => {
    if (!user?.email) return;
    try {
      const r = await fetch(`/api/deposit/manual?email=${encodeURIComponent(user.email)}`);
      setMyRequests(await r.json());
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
        headers: { 'Content-Type': 'application/json' },
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

      // Redirect ke WhatsApp admin dengan pesan otomatis
      const nominal = parseInt(amount).toLocaleString('id-ID');
      const wa = `https://wa.me/6287862306726?text=${encodeURIComponent(`Halo admin Pusat Nokos, saya sudah transfer deposit Rp ${nominal} via ${selectedBank.name}. Mohon konfirmasi. Terima kasih 🙏`)}`;
      window.open(wa, '_blank');

      setStep(1); setAmount(''); setProof(null); setProofName(''); setNote('');
      setDepositMode('history');
      fetchMyRequests();
    } catch { showToast('Terjadi kesalahan jaringan.'); }
    finally { setIsLoading(false); }
  };

  const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pending : { label: 'Menunggu',   color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20',  border: 'border-amber-200 dark:border-amber-800/50' },
    approved: { label: 'Disetujui',  color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20',  border: 'border-green-200 dark:border-green-800/50' },
    rejected: { label: 'Ditolak',    color: 'text-red-600 dark:text-red-400',      bg: 'bg-red-50 dark:bg-red-900/20',      border: 'border-red-200 dark:border-red-800/50' },
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Deposit Saldo</h1>
        <div className="flex gap-2">
          {['select', 'history'].map(m => (
            <button key={m} onClick={() => setDepositMode(m as any)} className={"px-4 py-2 rounded-xl text-sm font-bold transition-colors " + (depositMode === m || (depositMode === 'manual' && m === 'select') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
              {m === 'select' ? '+ Deposit Baru' : '📋 Riwayat'}
            </button>
          ))}
        </div>
      </div>

      {/* ── PILIH MODE ── */}
      {depositMode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div onClick={() => { setDepositMode('manual'); setStep(1); }} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 p-6 cursor-pointer transition-all group">
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl w-fit mb-4 group-hover:bg-indigo-600 transition-colors">
              <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Transfer Manual</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Transfer ke rekening/QRIS admin, upload bukti, admin approve dalam 1x24 jam.</p>
            <div className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">BCA · BRI · Mandiri · DANA · OVO · QRIS →</div>
          </div>

          <div className="bg-slate-100 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 opacity-60 cursor-not-allowed">
            <div className="bg-slate-200 dark:bg-slate-700 p-3 rounded-2xl w-fit mb-4">
              <Zap className="w-6 h-6 text-slate-500" />
            </div>
            <h3 className="font-black text-slate-500 dark:text-slate-400 text-lg mb-1">Otomatis</h3>
            <p className="text-sm text-slate-400">QRIS · VA · E-Wallet — Segera hadir</p>
            <div className="mt-4 text-xs font-bold text-slate-400">Coming soon</div>
          </div>
        </div>
      )}

      {/* ── DEPOSIT MANUAL ── */}
      {depositMode === 'manual' && (
        <div className="space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <React.Fragment key={s}>
                <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-colors " + (step >= s ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400')}>
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                {s < 3 && <div className={"flex-1 h-1 rounded-full transition-colors " + (step > s ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700')} />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-400">
            <span>Nominal</span><span>Instruksi</span><span>Upload Bukti</span>
          </div>

          {/* Step 1: Nominal */}
          {step === 1 && (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Nominal Deposit</label>
                <div className="relative">
                  <span className="absolute left-5 top-4 text-slate-400 font-black text-xl">Rp</span>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} min="10000" placeholder="10000" className="w-full px-14 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-3xl outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white" />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {QUICK_AMOUNTS.map(q => (
                    <button key={q} onClick={() => setAmount(String(q))} className={"px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors " + (amount === String(q) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
                      {(q / 1000).toFixed(0)}rb
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Tujuan Transfer</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BANK_ACCOUNTS.map(b => (
                    <div key={b.id} onClick={() => setSelectedBank(b)} className={"border-2 p-3 rounded-2xl cursor-pointer transition-all text-center " + (selectedBank.id === b.id ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
                      <div className="font-black text-sm text-slate-900 dark:text-white">{b.name}</div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => { if (!amount || parseInt(amount) < 10000) { showToast('Minimal Rp 10.000'); return; } setStep(2); }} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors active:scale-95">
                Lanjut →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-5">
              <div className="text-center">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Transfer ke {selectedBank.name}</div>

                {/* QRIS — tampilkan gambar QR */}
                {selectedBank.id === 'qris' ? (
                  <div className="space-y-4">
                    {selectedBank.qrisUrl && selectedBank.qrisUrl !== 'GANTI_DENGAN_URL_QRIS' ? (
                      <div className="flex justify-center">
                        <img src={selectedBank.qrisUrl} alt="QRIS Pusat Nokos" className="w-64 h-64 object-contain rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-2" />
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <div className="w-64 h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center">
                          <QrCode className="w-16 h-16 text-slate-300 dark:text-slate-600" />
                        </div>
                      </div>
                    )}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-center space-y-1">
                      <div className="font-black text-slate-900 dark:text-white">{selectedBank.holder}</div>
                      <div className="text-xs text-slate-400 font-medium">{selectedBank.number}</div>
                      <div className="font-black text-indigo-600 dark:text-indigo-400 text-xl mt-2">Rp {parseInt(amount).toLocaleString('id-ID')}</div>
                    </div>
                    <p className="text-xs text-slate-400">Scan QR di atas menggunakan aplikasi e-wallet atau mobile banking manapun.</p>
                  </div>
                ) : (
                  /* Transfer biasa */
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nomor Rekening</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 dark:text-white text-lg">{selectedBank.number}</span>
                        <button onClick={() => copyToClipboard(selectedBank.number, showToast)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Copy className="w-4 h-4 text-slate-400" /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Atas Nama</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedBank.holder}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nominal Transfer</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-xl">Rp {parseInt(amount).toLocaleString('id-ID')}</span>
                        <button onClick={() => copyToClipboard(amount, showToast)} className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Copy className="w-4 h-4 text-slate-400" /></button>
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">Transfer sesuai nominal agar lebih mudah diverifikasi admin.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">← Kembali</button>
                <button onClick={() => setStep(3)} className="flex-1 py-3.5 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors">Sudah Transfer →</button>
              </div>
            </div>
          )}

          {/* Step 3: Upload bukti */}
          {step === 3 && (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 md:p-8 space-y-5">
              <div>
                <label className="block text-sm font-bold mb-3 text-slate-800 dark:text-slate-200">Upload Bukti Transfer</label>
                <label className={"flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors " + (proof ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800')}>
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
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Misal: transfer dari BCA atas nama Budi" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white resize-none h-20" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">← Kembali</button>
                <button onClick={handleSubmitManual} disabled={isLoading} className="flex-1 py-3.5 bg-green-600 text-white font-bold rounded-2xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isLoading ? 'Mengirim...' : 'Kirim Request'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RIWAYAT DEPOSIT ── */}
      {depositMode === 'history' && (
        <div className="space-y-4">
          {myRequests.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <div className="font-bold">Belum ada request deposit</div>
            </div>
          ) : myRequests.map((r: any) => {
            const cfg = STATUS_CFG[r.status] ?? STATUS_CFG['pending'];
            return (
              <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex items-center justify-between">
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
          <button onClick={fetchMyRequests} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2">
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
interface HistoryViewProps {
  orders: Order[];
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

function HistoryView({ orders }: HistoryViewProps) {
  const [isLoading, setIsLoading]       = useState<boolean>(true);
  const [apiHistory, setApiHistory]     = useState<ApiHistoryItem[]>([]);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [historyToast, setHistoryToast] = useState<string | null>(null);

  const showHistoryToast = (msg: string) => {
    setHistoryToast(msg);
    setTimeout(() => setHistoryToast(null), 3000);
  };

  const handleReactivate = async (activationId: string) => {
    if (reactivating) return;
    setReactivating(activationId);
    try {
      // Cek harga dulu
      const costRes  = await fetch(`/api/reactivation?id=${activationId}`);
      const costData = await costRes.json();
      if (!costRes.ok) { showHistoryToast(costData.error ?? 'Gagal cek harga reaktivasi.'); return; }

      const konfirmasi = window.confirm(
        `Pakai nomor ini lagi?\nBiaya reaktivasi: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`
      );
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
        showHistoryToast(data.error ?? 'Gagal reaktivasi.');
      }
    } catch {
      showHistoryToast('Kesalahan jaringan saat reaktivasi.');
    } finally {
      setReactivating(null);
    }
  };

  const fetchHistory = async (p: number, status: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (status) params.set('status', status);
      const res  = await fetch(`/api/history?${params}`);
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

  const STATUS_COLOR: Record<string, string> = {
    success   : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50',
    waiting   : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50',
    cancelled : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50',
    expired   : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {historyToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-sm font-bold px-6 py-3 rounded-full shadow-2xl flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400 dark:text-yellow-600" /> {historyToast}
        </div>
      )}

      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Riwayat Transaksi</h1>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: '',          label: 'Semua Status', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
            { value: 'success',   label: '✅ Berhasil',   color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' },
            { value: 'waiting',   label: '⏳ Menunggu',   color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50' },
            { value: 'cancelled', label: '❌ Dibatalkan', color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50' },
            { value: 'expired',   label: '🕐 Kadaluarsa', color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`px-4 py-2 rounded-xl text-xs font-black border-2 transition-all whitespace-nowrap ${
                filterStatus === opt.value
                  ? opt.color + ' ring-2 ring-offset-1 ring-indigo-400'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Detail Aplikasi & Waktu</th>
                <th className="p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nomor HP & Kode OTP</th>
                <th className="p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Status</th>
                <th className="p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Skeleton loading */}
              {isLoading && apiHistory.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-5 sm:px-6">
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-32 mb-2"></div>
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div>
                    </td>
                    <td className="p-5 sm:px-6">
                      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-44"></div>
                    </td>
                    <td className="p-5 sm:px-6 text-right">
                      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-20 ml-auto"></div>
                    </td>
                    <td className="p-5 sm:px-6 text-right">
                      <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-24 ml-auto"></div>
                    </td>
                  </tr>
                ))
              ) : localOnly.length === 0 && apiHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <History className="w-10 h-10 text-slate-300 dark:text-slate-500"/>
                    </div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Belum ada riwayat.</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Transaksi yang Anda lakukan akan muncul di sini.</p>
                  </td>
                </tr>
              ) : (
                <>
                  {/* Baris sesi ini (lokal, belum ada di API) — dengan filter status */}
                  {localOnly
                    .filter(o => !filterStatus || o.status === filterStatus)
                    .map(o => (
                    <tr key={'local-' + o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-5 sm:px-6">
                        <div className="font-bold text-base text-slate-900 dark:text-white">{o.serviceName}</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{o.date}</div>
                      </td>
                      <td className="p-5 sm:px-6">
                        <span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg dark:text-slate-300">{o.number}</span>
                        {o.otpCode && (
                          <span className="text-sm font-black text-green-700 dark:text-green-400 ml-3 inline-flex items-center">
                            OTP: <span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 ml-1.5 tracking-widest">{o.otpCode}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-5 sm:px-6 text-right">
                        <span className={"px-3.5 py-1.5 text-[11px] font-black rounded-lg border uppercase tracking-wider " + (STATUS_COLOR[o.status] ?? STATUS_COLOR['cancelled'])}>
                          {o.status === 'cancelled' ? 'BATAL' : o.status === 'waiting' ? 'MENUNGGU' : o.status === 'success' ? 'BERHASIL' : 'KADALUARSA'}
                        </span>
                      </td>
                      <td className="p-5 sm:px-6 text-right">—</td>
                    </tr>
                  ))}

                  {/* Baris dari /api/history */}
                  {apiHistory.map(a => (
                    <tr key={'api-' + a.activationId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-5 sm:px-6">
                        <div className="font-bold text-base text-slate-900 dark:text-white uppercase">{a.service}</div>
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{a.createdAt ?? '—'}</div>
                      </td>
                      <td className="p-5 sm:px-6">
                        <span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg dark:text-slate-300">{a.phone}</span>
                        {a.otpCode && (
                          <span className="text-sm font-black text-green-700 dark:text-green-400 ml-3 inline-flex items-center">
                            OTP: <span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 ml-1.5 tracking-widest">{a.otpCode}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-5 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <span className={"px-3.5 py-1.5 text-[11px] font-black rounded-lg border uppercase tracking-wider " + (STATUS_COLOR[a.status] ?? STATUS_COLOR['cancelled'])}>
                            {a.statusLabel}
                          </span>
                        </div>
                      </td>
                      <td className="p-5 sm:px-6 text-right">
                        {a.status === 'success' && a.activationId && (
                          <button
                            disabled={reactivating === a.activationId}
                            onClick={async () => {
                              setReactivating(a.activationId);
                              try {
                                const costRes  = await fetch(`/api/reactivation?id=${a.activationId}`);
                                const costData = await costRes.json();
                                if (costData.error) { showHistoryToast(costData.error); return; }
                                const confirm = window.confirm(`Pakai nomor ${a.phone} lagi?\nBiaya: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`);
                                if (!confirm) return;
                                const res  = await fetch('/api/reactivation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.activationId, service: a.service }) });
                                const data = await res.json();
                                if (!res.ok) { showHistoryToast(data.error ?? 'Gagal reaktivasi.'); return; }
                                showHistoryToast(`Berhasil! Nomor ${data.phone} siap dipakai lagi.`);
                              } catch { showHistoryToast('Gagal melakukan reaktivasi.'); }
                              finally { setReactivating(null); }
                            }}
                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-lg text-[11px] font-black hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            {reactivating === a.activationId ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                            Pakai Lagi
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
        {/* Load more */}
        {hasMore && !isLoading && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchHistory(next, filterStatus); }}
              className="px-8 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-bold transition-colors border border-slate-200 dark:border-slate-700"
            >
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
// TAB: MUTASI SALDO (Buku Kas)
// ==========================================
interface MutasiViewProps {
  mutasi: Mutasi[];
  user: UserData | null;
}

function MutasiView({ mutasi, user }: MutasiViewProps) {
  const [isLoading, setIsLoading]         = useState<boolean>(true);
  const [dbMutasi, setDbMutasi]           = useState<Mutasi[]>([]);
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [filterType, setFilterType]       = useState<'' | 'in' | 'out'>('');

  const fetchMutasi = async (p: number, type: string) => {
    if (!user?.email) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ email: user.email, page: String(p), limit: '20' });
      if (type) params.set('type', type);
      const res  = await fetch(`/api/user/mutations?${params}`);
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
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Buku Mutasi Saldo</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 hidden md:block">Catatan rinci pemasukan dan pengeluaran saldo Anda.</p>
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as '' | 'in' | 'out')}
          className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm w-full sm:w-40"
        >
          <option value="">Semua</option>
          <option value="in">Masuk (+)</option>
          <option value="out">Keluar (-)</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Waktu & Deskripsi</th>
                <th className="p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nominal Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && dbMutasi.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="p-5 sm:px-6 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : allMutasi.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><Receipt className="w-10 h-10 text-slate-300 dark:text-slate-500"/></div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Belum ada mutasi.</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Buku kas akan terisi saat Anda deposit atau membeli nomor.</p>
                  </td>
                </tr>
              ) : allMutasi.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-5 sm:px-6">
                    <div className="font-bold text-base text-slate-900 dark:text-white">{m.desc}</div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{m.date}</div>
                  </td>
                  <td className="p-5 sm:px-6 text-right">
                    <span className={"px-3.5 py-1.5 text-sm font-black rounded-lg border " + (m.type === 'in' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50')}>
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
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={() => { const next = page + 1; setPage(next); fetchMutasi(next, filterType); }}
              className="px-8 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-bold transition-colors border border-slate-200 dark:border-slate-700"
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
}

function ProfileView({ user, showToast }: ProfileViewProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showToast("Pengaturan profil berhasil disimpan!");
    }, 1000);
  }

  return (
    <div className="max-w-3xl space-y-6 mx-auto pb-10">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Pengaturan Akun</h1>
      
      <div className="grid grid-cols-1 gap-8">
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 h-fit max-w-3xl transition-colors">
          <div className="flex flex-col sm:flex-row items-center sm:space-x-8 mb-10 text-center sm:text-left">
            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center text-3xl font-black border-2 border-indigo-100 dark:border-indigo-800 shadow-sm mb-4 sm:mb-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">{user?.name}</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold flex items-center justify-center sm:justify-start mt-1.5 text-sm"><Mail className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500"/> {user?.email}</p>
              <div className="flex gap-2 mt-3 justify-center sm:justify-start">
                <span className="inline-flex items-center bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md">
                  <CheckCircle className="w-3 h-3 mr-1"/> Verified
                </span>
              </div>
            </div>
          </div>
          <form className="space-y-6 pt-8 border-t border-slate-100 dark:border-slate-800" onSubmit={handleSave}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Nama Lengkap</label>
              <input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed text-sm" defaultValue={user?.name} disabled />
            </div>
            <div className="pt-2">
              <button type="submit" disabled={isLoading} className="bg-slate-900 dark:bg-indigo-600 text-white font-bold text-sm px-8 py-4 rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-all active:scale-95 shadow-lg w-full sm:w-auto flex justify-center items-center">
                {isLoading ? <RefreshCw className="w-4 h-4 animate-spin mr-2"/> : null}
                Perbarui Profil
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TAB: AFFILIATE (PROGRAM AFILIASI)
// ==========================================