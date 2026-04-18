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

// Fallback kosong — data live dari API, tidak pakai harga hardcoded
const ALL_SERVICES: Service[] = [];

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
// ANIMATION UTILS
// ==========================================
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [threshold]);
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
  const { ref, inView } = useInView(0.12);
  return (
    <div ref={ref} className={className} style={{
      opacity: inView ? 1 : 0,
      transform: inView ? 'translateY(0)' : 'translateY(26px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
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

// Cache icon yang gagal agar tidak terus-terusan retry → cegah QuotaExceededError
const failedIconCache = new Set<string>();

function getServiceIconByName(name: string): React.ReactNode {
  const n = name.toLowerCase();
  for (const [keys, cfg] of SERVICE_LOGO_MAP) {
    if (keys.some(k => n.includes(k))) {
      // Simpleicons: hapus warna dari URL → pakai brand default color, tidak 404
      const src = cfg.type === 'si'
        ? `https://cdn.simpleicons.org/${cfg.slug}`
        : `https://t0.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${cfg.domain}&size=64`;
      const imgSize = cfg.type === 'si' ? 'w-6 h-6' : 'w-7 h-7';

      // Kalau sudah pernah gagal, langsung tampilkan huruf
      if (failedIconCache.has(src)) {
        return (
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-base font-black" style={{ background: cfg.bg, color: '#4f46e5' }}>
            {name.charAt(0).toUpperCase()}
          </div>
        );
      }

      return (
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: cfg.bg }}>
          <img
            src={src}
            alt={name}
            className={`${imgSize} object-contain`}
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              failedIconCache.add(src);
              // Langsung fallback ke huruf — tidak retry ke CDN lain (cegah QuotaExceededError)
              el.style.display = 'none';
              const parent = el.parentElement;
              if (parent) {
                parent.style.fontSize = '16px';
                parent.style.fontWeight = '900';
                parent.style.color = '#4f46e5';
                parent.textContent = name.charAt(0).toUpperCase();
              }
            }}
          />
        </div>
      );
    }
  }
  return (
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0" style={{ background: '#eef2ff', color: '#4f46e5' }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

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
        const parsed = JSON.parse(savedSession) as UserData & { _savedAt?: number };
        // Cek expiry — session expired setelah 7 hari
        if (parsed?.email && parsed._savedAt && Date.now() - parsed._savedAt < SESSION_TTL) {
          setUser(parsed);
          setCurrentView('dashboard');
        } else {
          // Expired atau tidak ada timestamp — hapus
          localStorage.removeItem('nokos_session');
        }
      }
    } catch { localStorage.removeItem('nokos_session'); }
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

  const handleLogin = (userData: UserData) => { 
    setUser(userData);
    // Simpan session ke localStorage dengan timestamp expiry
    localStorage.setItem('nokos_session', JSON.stringify({ ...userData, _savedAt: Date.now() }));
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
    <div className="relative text-slate-800 dark:text-slate-200 font-sans selection:bg-indigo-200 selection:text-indigo-900 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors duration-300" style={{WebkitTapHighlightColor:"transparent"}}>
      
      {/* GLOBAL TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed top-20 md:top-6 left-1/2 transform -translate-x-1/2 z-[200] bg-slate-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2 transition-all animate-in fade-in slide-in-from-top-4 duration-300 max-w-[calc(100vw-2rem)] text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-400 dark:text-green-600" /><span className="truncate">{toastMsg}</span>
        </div>
      )}

      {currentView === 'login' || currentView === 'register' ? (
        <AuthView type={currentView} onNavigate={navigate} onAuth={handleLogin} showToast={showToast} isDarkMode={isDarkMode} />
      ) : currentView === 'dashboard' ? (
        <DashboardLayout user={user} onLogout={handleLogout} showToast={showToast} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} activeServices={activeServices} serviceError={serviceError} countries={countries} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} />
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
  const { ref: statsRef, inView: statsOn } = useInView(0.3);
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
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#020617] transition-colors duration-300 overflow-x-hidden" style={{minHeight:"100svh"}}>
      <style>{`
        @keyframes _heroIn { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        ._h1{animation:_heroIn .55s ease .05s both}
        ._h2{animation:_heroIn .55s ease .20s both}
        ._h3{animation:_heroIn .55s ease .35s both}
        ._h4{animation:_heroIn .55s ease .50s both}
        ._h5{animation:_heroIn .55s ease .65s both}
      `}</style>
      <a href={`https://wa.me/${CS_WA}?text=Halo%20CS%20Pusat%20Nokos%2C%20saya%20butuh%20bantuan.`} target="_blank" rel="noopener noreferrer" aria-label="Hubungi Customer Service via WhatsApp" className="fixed bottom-24 left-4 z-[90] md:bottom-6 md:left-6 bg-[#25D366] text-white px-4 py-3 rounded-full shadow-[0_8px_30px_rgba(37,211,102,0.4)] hover:bg-[#1ebd5a] hover:shadow-[0_8px_40px_rgba(37,211,102,0.6)] transition-all transform hover:scale-105 flex items-center gap-3 group">
        <svg viewBox="0 0 24 24" fill="white" className="w-6 h-6 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <div className="text-left">
          <div className="text-[10px] font-bold opacity-80 leading-none mb-0.5">Chat Kami</div>
          <div className="text-sm font-black leading-none">WhatsApp CS</div>
        </div>
      </a>

      <nav className="fixed w-full z-50 top-0 transition-all bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20 items-center">
            <div className="flex items-center cursor-pointer" onClick={() => onNavigate('landing')}>
              <img src="/logo.png" className="h-10 w-10 rounded-xl object-cover" alt="Pusat Nokos" />
              <span className="ml-3 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Pusat Nokos<span className="text-indigo-600">.</span></span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a href="#beranda" onClick={(e) => scrollToId(e, 'beranda')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Beranda</a>
              <a href="#cara" onClick={(e) => scrollToId(e, 'cara')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Cara Kerja</a>
              <a href="#demo" onClick={(e) => scrollToId(e, 'demo')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Harga & Demo</a>
              <a href="#fitur" onClick={(e) => scrollToId(e, 'fitur')} className="text-sm font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition">Fitur Keamanan</a>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle dark mode" className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition">
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button onClick={() => onNavigate('login')} className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-4 py-2.5 rounded-xl transition hover:bg-slate-100 dark:hover:bg-slate-800">Masuk</button>
              <button onClick={() => onNavigate('register')} className="text-sm font-bold bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all transform active:scale-95">Mulai Gratis</button>
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
      <div id="beranda" className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[600px] bg-indigo-500/15 dark:bg-indigo-500/10 blur-[120px] rounded-full"></div>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-400 text-sm font-bold mb-8 shadow-sm _h1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-600 mr-2.5 animate-pulse"></span> Dipercaya 50K+ Pengguna Aktif
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-6 leading-tight _h2">
            Verifikasi Akun <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500">Aman & Terpercaya.</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-slate-500 dark:text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed _h3">
            Platform Nomor Kosong (Nokos) Enterprise-level dengan jaminan Auto Refund 100% dan server stabil 24 Jam.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center _h4">
            <button onClick={() => onNavigate('register')} className="flex items-center justify-center px-8 py-4 text-base font-bold rounded-2xl text-white bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 shadow-xl hover:shadow-indigo-500/30 transition-all hover:-translate-y-1">
              Buka Dashboard <ArrowRight className="ml-2 w-5 h-5"/>
            </button>
            <button onClick={(e) => scrollToId(e, 'fitur')} className="flex items-center justify-center px-8 py-4 border-2 border-slate-200 dark:border-slate-800 text-base font-bold rounded-2xl text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
              <ShieldCheck className="mr-2 w-5 h-5 text-indigo-600 dark:text-indigo-400"/> Pelajari Fitur
            </button>
          </div>

          {/* Floating app chips — pakai Google Favicon agar semua logo tampil */}
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
              <div
                key={app.name}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow-sm text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                style={{ transition: 'transform .2s ease, box-shadow .2s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-3px)'; d.style.boxShadow = '0 6px 16px rgba(0,0,0,0.10)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${app.domain}&sz=32`}
                  width={14} height={14}
                  className="w-3.5 h-3.5 object-contain"
                  alt={app.name}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {app.name}
              </div>
            ))}
            <div
              className="bg-indigo-50 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-500 dark:text-indigo-400"
              style={{ transition: 'transform .2s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
            >+500 lainnya</div>
          </div>

          {/* Stats strip — animated count-up */}
          <div ref={statsRef} className="mt-14 max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 dark:divide-slate-800">
                {[
                  { val: statsOn ? `${cnt500}+` : '0+',  label: 'Layanan Tersedia', icon: <Package className="w-5 h-5 text-indigo-600 dark:text-indigo-400"/>,  bg: 'bg-indigo-50 dark:bg-indigo-900/20', color: 'text-indigo-600 dark:text-indigo-400', i: 0 },
                  { val: statsOn ? `${cnt50}K+` : '0K+', label: 'Pengguna Aktif',   icon: <Users className="w-5 h-5 text-violet-600 dark:text-violet-400"/>,    bg: 'bg-violet-50 dark:bg-violet-900/20',  color: 'text-violet-600 dark:text-violet-400', i: 1 },
                  { val: statsOn ? `${cnt99}%`  : '0%',  label: 'Tingkat Sukses',   icon: <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400"/>, bg: 'bg-green-50 dark:bg-green-900/20',    color: 'text-green-600 dark:text-green-400',   i: 2 },
                  { val: '24/7',                          label: 'Server Online',    icon: <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400"/>,     bg: 'bg-blue-50 dark:bg-blue-900/20',      color: 'text-blue-600 dark:text-blue-400',     i: 3 },
                ].map(s => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center justify-center py-7 px-4 text-center gap-2"
                    style={{
                      opacity: statsOn ? 1 : 0,
                      transform: statsOn ? 'translateY(0)' : 'translateY(14px)',
                      transition: `opacity .5s ease ${s.i * 110}ms, transform .5s ease ${s.i * 110}ms`,
                    }}
                    onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = statsOn ? 'translateY(0)' : 'translateY(14px)'; }}
                  >
                    <div
                      className={`w-10 h-10 ${s.bg} rounded-2xl flex items-center justify-center`}
                      style={{ transition: 'transform .3s ease' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.18) rotate(8deg)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                    >{s.icon}</div>
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
      <div id="cara" className="py-24 bg-slate-50 dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <FadeInSection>
            <div className="text-center mb-16">
              <div className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-sm mb-3">Cara Kerja</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">Hanya 3 Langkah Mudah</h2>
            </div>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-10 left-[18%] right-[18%] h-0.5 bg-gradient-to-r from-indigo-200 via-violet-200 to-indigo-200 dark:from-indigo-800 dark:via-violet-800 dark:to-indigo-800"/>
            {[
              { step: '01', icon: <Wallet className="w-7 h-7 text-indigo-600 dark:text-indigo-400"/>, title: 'Deposit Saldo', desc: 'Top up saldo via QRIS atau Virtual Account bank manapun. Diproses otomatis dalam hitungan detik.' },
              { step: '02', icon: <ShoppingCart className="w-7 h-7 text-violet-600 dark:text-violet-400"/>, title: 'Pilih & Beli Nomor', desc: 'Cari layanan yang kamu butuhkan, pilih negara, dan klik Beli Nomor. Nomor langsung aktif.' },
              { step: '03', icon: <CheckCircle className="w-7 h-7 text-green-600 dark:text-green-400"/>, title: 'Terima Kode OTP', desc: 'Kode OTP masuk otomatis ke dashboard kamu dalam hitungan detik. Salin & gunakan!' },
            ].map((s, i) => (
              <FadeInSection key={i} delay={i * 130}>
                <div
                  className="relative bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm text-center hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  style={{ transition: 'transform .25s ease, box-shadow .25s ease, border-color .2s ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; d.style.boxShadow = '0 12px 30px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
                >
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white dark:border-slate-900 shadow-md relative z-10">{s.icon}</div>
                  <div className="absolute top-6 right-6 text-6xl font-black text-slate-100 dark:text-slate-800 select-none">{s.step}</div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-3">{s.title}</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </FadeInSection>
            ))}
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
                    <input type="text" placeholder="Contoh: Shopee, Telegram..." className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 text-base font-medium transition-shadow dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50 p-3">
                  {loadingServices ? (
                    // Loading skeleton
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center mb-3 animate-pulse">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0"></div>
                          <div className="space-y-2">
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-16"></div>
                          </div>
                        </div>
                        <div className="space-y-2 items-end flex flex-col">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                          <div className="h-6 bg-slate-100 dark:bg-slate-700 rounded w-16"></div>
                        </div>
                      </div>
                    ))
                  ) : filteredServices.length > 0 ? filteredServices.map((s) => (
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
          <FadeInSection>
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider mb-2 text-sm">Keamanan & Kepercayaan</h2>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">Platform Enterprise-Level</h3>
            </div>
          </FadeInSection>
          <FadeInSection delay={100}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto auto-rows-[minmax(250px,auto)]">
              {/* Box 1: Auto Refund (Besar) */}
              <div
                className="md:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
                style={{ transition: 'transform .25s ease, box-shadow .25s ease, border-color .2s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; d.style.boxShadow = '0 14px 32px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-5"><ShieldAlert className="w-7 h-7 text-indigo-600 dark:text-indigo-400"/></div>
                  <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Auto Refund 100%</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md leading-relaxed">Sistem pintar kami melacak setiap OTP secara real-time. Jika dalam waktu tunggu kode tidak masuk, saldo Anda dikembalikan utuh otomatis tanpa potongan.</p>
                </div>
                <RefreshCw className="absolute -right-4 -bottom-12 w-64 h-64 text-indigo-600 opacity-5 group-hover:opacity-10 transition-transform duration-700 group-hover:rotate-180" />
              </div>
              {/* Box 2: Transaksi (Kecil Warna) */}
              <div
                className="bg-indigo-600 text-white rounded-3xl p-8 shadow-xl flex flex-col justify-center relative overflow-hidden group"
                style={{ transition: 'transform .25s ease, box-shadow .25s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; d.style.boxShadow = '0 14px 32px rgba(79,70,229,0.35)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
              >
                <div className="relative z-10">
                  <Wallet className="w-12 h-12 text-green-400 mb-5"/>
                  <h4 className="text-xl font-bold mb-2">Transaksi Instan</h4>
                  <p className="text-indigo-100 text-sm leading-relaxed">Deposit via QRIS & VA diproses hitungan detik. Riwayat tercatat transparan.</p>
                </div>
                <Zap className="w-40 h-40 text-white opacity-10 absolute -right-8 -bottom-8 group-hover:scale-110 transition-transform duration-500" />
              </div>
              {/* Box 3: Privasi (Kecil) */}
              <div
                className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center relative overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors"
                style={{ transition: 'transform .25s ease, box-shadow .25s ease, border-color .2s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; d.style.boxShadow = '0 14px 32px rgba(0,0,0,0.07)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
              >
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-center mb-5"><EyeOff className="w-7 h-7 text-slate-700 dark:text-slate-300"/></div>
                  <h4 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">Privasi Terjaga</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">Jauhkan nomor pribadi Anda dari ancaman spam, telemarketing, atau kebocoran data.</p>
                </div>
              </div>
              {/* Box 4: Server Stabil (Besar Gelap) */}
              <div
                className="md:col-span-2 bg-slate-900 dark:bg-slate-950 text-white rounded-3xl p-8 shadow-xl flex items-center justify-between relative overflow-hidden border border-slate-800 group"
                style={{ transition: 'transform .25s ease, box-shadow .25s ease' }}
                onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-5px)'; d.style.boxShadow = '0 14px 32px rgba(0,0,0,0.25)'; }}
                onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
              >
                <div className="w-full sm:w-2/3 relative z-10">
                  <Server className="w-12 h-12 text-blue-400 mb-5"/>
                  <h4 className="text-xl font-bold mb-2">Infrastruktur Stabil 99.9%</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">Kami menggunakan teknologi server mutakhir untuk menjamin platform tetap responsif dan dapat diakses 24 jam penuh tanpa hambatan.</p>
                </div>
                <Globe className="hidden sm:block w-48 h-48 text-white opacity-5 absolute -right-6 top-1/2 -translate-y-1/2 transition-transform duration-[20s] group-hover:rotate-180" />
              </div>
            </div>
          </FadeInSection>
        </div>
      </div>

      {/* TESTIMONIAL */}
      <div className="py-20 bg-white dark:bg-[#020617] border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeInSection>
            <div className="text-center mb-12">
              <div className="text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-sm mb-3">Testimoni</div>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Dipercaya Ribuan Pengguna</h2>
            </div>
          </FadeInSection>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { name: 'Andi R.', role: 'Reseller Online', text: 'Langsung berhasil buat akun marketplace baru. OTP masuk cepat banget, gak sampai 30 detik. Recommended!', rating: 5 },
              { name: 'Siti N.', role: 'Freelancer', text: 'Auto refund beneran jalan pas nomor saya gagal terima OTP. Saldo balik dalam hitungan detik. Jujur dan amanah!', rating: 5 },
              { name: 'Budi S.', role: 'Developer', text: 'Stok nomornya banyak dan variatif. Bisa pilih dari berbagai negara. Harga juga bersaing, paling murah yang pernah saya coba.', rating: 5 },
            ].map((t, i) => (
              <FadeInSection key={i} delay={i * 120}>
                <div
                  className="bg-white dark:bg-slate-900 rounded-3xl p-7 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors"
                  style={{ transition: 'transform .25s ease, box-shadow .25s ease, border-color .2s ease' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = 'translateY(-4px)'; d.style.boxShadow = '0 12px 28px rgba(0,0,0,0.08)'; }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.transform = ''; d.style.boxShadow = ''; }}
                >
                  <div className="flex gap-1 mb-4">
                    {[...Array(t.rating)].map((_, j) => <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400"/>)}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">"{t.text}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400">{t.name[0]}</div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white text-sm">{t.name}</div>
                      <div className="text-xs text-slate-400 font-medium">{t.role}</div>
                    </div>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div id="faq" className="bg-[#fafafa] dark:bg-slate-950 py-24 border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <FadeInSection>
            <div className="text-center mb-12"><h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Pertanyaan yang Sering Diajukan</h2></div>
          </FadeInSection>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <FadeInSection key={i} delay={i * 80}>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)} 
                    className="w-full px-6 py-5 text-left flex justify-between font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 transition-colors"
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
      <div className="py-24 bg-indigo-600 dark:bg-indigo-700 relative">
        <div className="absolute inset-0 -z-0 pointer-events-none">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-violet-600/30 blur-[80px] rounded-full"/>
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-600/30 blur-[80px] rounded-full"/>
        </div>
        <FadeInSection>
          <div className="max-w-3xl mx-auto px-4 text-center relative z-10">
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 leading-tight">Siap Mulai Verifikasi<br/>Tanpa Ribet?</h2>
            <p className="text-indigo-100 text-lg mb-10">Daftar gratis sekarang. Tidak perlu kartu kredit. Langsung bisa beli nomor OTP pertama kamu.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => onNavigate('register')} className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-indigo-600 font-black text-base rounded-2xl hover:bg-indigo-50 shadow-xl transition-all hover:-translate-y-0.5 active:scale-95">
                Daftar Gratis Sekarang <ArrowRight className="w-5 h-5"/>
              </button>
              <button onClick={() => onNavigate('login')} className="flex items-center justify-center gap-2 px-8 py-4 border-2 border-white/30 text-white font-bold text-base rounded-2xl hover:bg-white/10 transition-all">
                Sudah punya akun? Masuk
              </button>
            </div>
          </div>
        </FadeInSection>
      </div>

      <footer className="bg-white dark:bg-slate-900 pt-10 pb-5 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="col-span-2 md:col-span-1 md:pr-6">
              <div className="flex items-center mb-3">
                <img src="/logo.png" className="h-8 w-8 rounded-xl object-cover" alt="Pusat Nokos" />
                <span className="ml-2 text-base font-black text-slate-900 dark:text-white">Pusat Nokos.</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">Platform Nomor Kosong (Nokos) otomatis nomor 1 di Indonesia untuk verifikasi OTP yang aman dan terpercaya.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 uppercase text-xs tracking-wider">Layanan</h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <li><a href="#demo" onClick={(e)=>scrollToId(e as any, 'demo')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Daftar Harga Realtime</a></li>
                <li><a href="#" onClick={() => {onNavigate('login'); showToast("Login untuk melakukan deposit");}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Deposit Saldo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 uppercase text-xs tracking-wider">Perusahaan</h4>
              <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                <li><a href="#" onClick={(e)=>{e.preventDefault(); setShowSyarat(true);}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Syarat & Ketentuan</a></li>
                <li><a href="#" onClick={(e)=>{e.preventDefault(); setShowPrivasi(true);}} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Kebijakan Privasi</a></li>
                <li><a href="#faq" onClick={(e)=>scrollToId(e as any, 'faq')} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Bantuan FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-3 uppercase text-xs tracking-wider">Hubungi Kami</h4>
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
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-row justify-between items-center gap-2">
            <div className="text-slate-400 dark:text-slate-500 text-xs">&copy; {new Date().getFullYear()} Pusat Nokos. Hak cipta dilindungi.</div>
            <div className="flex gap-2 shrink-0">
              <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400">E2E</span>
              <span className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-500 dark:text-slate-400">QRIS / VA</span>
            </div>
          </div>
        </div>
      </footer>
      {/* ── Modal Syarat & Ketentuan ─────────────────────────────── */}
      {showSyarat && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSyarat(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-2xl"><ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Syarat & Ketentuan</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: Januari 2025</p>
                </div>
              </div>
              <button onClick={() => setShowSyarat(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">1. Penerimaan Syarat</h3>
                <p>Dengan menggunakan layanan Pusat Nokos, Anda menyetujui seluruh syarat dan ketentuan yang berlaku. Jika Anda tidak menyetujui, harap hentikan penggunaan layanan ini.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">2. Penggunaan Layanan</h3>
                <p>Layanan Pusat Nokos hanya boleh digunakan untuk keperluan yang sah dan legal. Dilarang keras menggunakan layanan ini untuk penipuan, spam, atau aktivitas ilegal lainnya. Akun yang terindikasi penyalahgunaan akan diblokir tanpa pemberitahuan.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">3. Saldo & Transaksi</h3>
                <p>Saldo yang telah di-deposit tidak dapat ditarik kembali dalam bentuk uang tunai. Setiap transaksi pembelian nomor OTP bersifat final. Refund otomatis hanya berlaku jika OTP tidak berhasil diterima dalam batas waktu yang ditentukan.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">4. Ketersediaan Layanan</h3>
                <p>Kami tidak menjamin ketersediaan layanan 100% tanpa gangguan. Stok nomor dapat berubah sewaktu-waktu tergantung ketersediaan dari penyedia. Kami berhak melakukan pemeliharaan sistem kapan saja.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">5. Tanggung Jawab Pengguna</h3>
                <p>Pengguna bertanggung jawab penuh atas keamanan akun dan kata sandi masing-masing. Jangan berbagi informasi akun kepada pihak lain. Segala kerugian akibat kelalaian pengguna adalah tanggung jawab pengguna sendiri.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">6. Perubahan Ketentuan</h3>
                <p>Pusat Nokos berhak mengubah syarat dan ketentuan ini kapan saja. Perubahan akan diberitahukan melalui platform kami. Penggunaan berkelanjutan setelah perubahan berarti Anda menyetujui ketentuan baru.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">7. Kontak</h3>
                <p>Untuk pertanyaan terkait syarat dan ketentuan, hubungi kami melalui WhatsApp CS atau email cs@pusatnokos.com.</p>
              </section>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button onClick={() => setShowSyarat(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Kebijakan Privasi ───────────────────────────────── */}
      {showPrivasi && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrivasi(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/40 p-2.5 rounded-2xl"><ShieldAlert className="w-5 h-5 text-green-600 dark:text-green-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Kebijakan Privasi</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: Januari 2025</p>
                </div>
              </div>
              <button onClick={() => setShowPrivasi(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">1. Data yang Kami Kumpulkan</h3>
                <p>Kami mengumpulkan data yang Anda berikan saat registrasi seperti nama dan alamat email. Kami juga mencatat data transaksi, riwayat penggunaan layanan, dan informasi teknis seperti alamat IP untuk keperluan keamanan.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">2. Penggunaan Data</h3>
                <p>Data Anda digunakan untuk: mengelola akun dan transaksi, meningkatkan kualitas layanan, mengirim notifikasi penting terkait akun Anda, serta mencegah penipuan dan penyalahgunaan layanan.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">3. Keamanan Data</h3>
                <p>Kami menerapkan enkripsi dan langkah keamanan standar industri untuk melindungi data Anda. Kata sandi disimpan dalam format terenkripsi dan tidak dapat diakses oleh siapapun, termasuk tim kami.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">4. Berbagi Data</h3>
                <p>Kami tidak menjual atau menyewakan data pribadi Anda kepada pihak ketiga. Data hanya dibagikan kepada mitra penyedia layanan yang diperlukan untuk operasional (seperti penyedia nomor OTP) dengan standar keamanan yang ketat.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">5. Cookie & Penyimpanan Lokal</h3>
                <p>Kami menggunakan localStorage untuk menyimpan sesi login Anda agar tidak perlu login ulang setiap kali. Anda dapat menghapus data ini kapan saja melalui pengaturan browser.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">6. Hak Pengguna</h3>
                <p>Anda berhak meminta penghapusan akun dan seluruh data pribadi Anda kapan saja dengan menghubungi CS kami. Proses penghapusan akan diselesaikan dalam maksimal 7 hari kerja.</p>
              </section>
              <section>
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">7. Perubahan Kebijakan</h3>
                <p>Kebijakan privasi ini dapat diperbarui sewaktu-waktu. Kami akan memberitahu perubahan signifikan melalui platform kami. Pertanyaan hubungi: cs@pusatnokos.com</p>
              </section>
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
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

  // ── LOGIN ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email dan password wajib diisi.'); return; }
    if (!turnstileToken) { setError('Harap selesaikan verifikasi CAPTCHA.'); return; }
    setIsLoading(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
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

  const inputCls = "w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 dark:text-white text-base font-medium transition-all";
  const btnCls   = (loading: boolean) => "w-full flex justify-center items-center py-4 rounded-2xl text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-70 " + (loading ? "bg-indigo-400" : "bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-700");

  const ErrorBox = () => error ? (
    <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm font-bold bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 rounded-2xl">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span className="break-words min-w-0">{error}</span>
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300" style={{minHeight:"100svh"}}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[min(800px,100vh)] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="mx-auto w-full max-w-md text-center mb-8 relative z-10">
        <div className="flex justify-center cursor-pointer mb-6 hover:scale-105 transition-transform" onClick={() => onNavigate("landing")}>
          <img src="/logo.png" className="h-16 w-16 rounded-2xl object-cover shadow-md" alt="Pusat Nokos" />
        </div>
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{titles[step]}</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">{subtitles[step]}</p>
      </div>

      <div className="mx-auto w-full max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl relative z-10" style={{paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom,0px))"}}>

        {/* ── LOGIN FORM ── */}
        {step === "form" && isLogin && (
          <form className="space-y-5" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">Alamat Email</label>
              <div className="relative"><Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-400"/>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="Email kamu" />
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
            {/* Cloudflare Turnstile */}
            <div ref={turnstileLoginRef} className="flex justify-center" />
            <button type="submit" disabled={isLoading || !turnstileToken} className={btnCls(isLoading)}>
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
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="Email kamu" />
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
            {/* Cloudflare Turnstile */}
            <div ref={turnstileRegisterRef} className="flex justify-center" />
            <button type="submit" disabled={isLoading || !turnstileToken} className={btnCls(isLoading)}>
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
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className={inputCls} placeholder="Email kamu" />
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
  serviceError?: boolean;
  countries: Country[];
  selectedCountry: string;
  setSelectedCountry: (val: string) => void;
}

function DashboardLayout({ user, onLogout, showToast, isDarkMode, setIsDarkMode, activeServices, serviceError, countries, selectedCountry, setSelectedCountry }: DashboardLayoutProps) {
  const [activeTab, setActiveTab] = useState<string>('buy');
  const [balance, setBalance] = useState<number>(user?.balance ?? 0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [mutasi, setMutasi] = useState<Mutasi[]>([]);
  const [favorites, setFavorites] = useState<number[]>([1, 2]);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [autoRetryQueue, setAutoRetryQueue] = useState<{serviceName: string; serviceCode: string; price: number; icon: React.ReactNode}[]>([]);

  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [showSyaratDash, setShowSyaratDash] = useState<boolean>(false);
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
          // 'success' dari DB → 'completed' agar tidak muncul di panel aktif saat reload
          // 'waiting' yang sudah lewat 20 menit → 'expired'
          status       : o.status === 'success'
            ? 'completed' as Order['status']
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
      const res = await fetch(`/api/user/balance?email=${encodeURIComponent(user.email)}`);
      const d = await res.json();
      if (typeof d.balance === 'number') setBalance(d.balance);
    } catch {}
  };

  const updateBalance = async (amount: number, type: 'add' | 'subtract', activationId?: string) => {
    const newBal = type === 'add' ? balance + amount : Math.max(0, balance - amount);
    setBalance(newBal);
    if (!user?.email) return;
    try {
      const res = await fetch('/api/user/balance', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email: user.email, amount, type, activationId }),
      });
      // Jika 409 = sudah pernah di-refund, rollback balance lokal
      if (res.status === 409) {
        setBalance(balance);
      }
    } catch { /* update lokal sudah cukup jika gagal */ }
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
    // Update status order di Supabase
    fetch('/api/user/orders', {
      method : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ activationId: orderToCancel.activationId, status: 'cancelled' }),
    }).catch(() => {});

    setOrders(current => current.map(order =>
      order.id === orderId ? { ...order, status: 'cancelled', timeLeft: 0 } : order
    ));
    showToast('Pesanan dibatalkan. Saldo Rp ' + orderToCancel.price.toLocaleString('id-ID') + ' dikembalikan.');
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
              return { ...o, status: 'success', otpCodes, autoDismissAt: Date.now() + 60000 };
            }
            return { ...o, status: 'success', otpCode: event.smsCode, autoDismissAt: Date.now() + 60000 };
          }));
          // Auto-dismiss dari panel aktif setelah 60 detik
          setTimeout(() => {
            setOrders(cur => cur.map(o =>
              o.activationId === event.activationId && o.status === 'success'
                ? { ...o, status: 'completed' as Order['status'] }
                : o
            ));
          }, 60000);
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
                service: order.bundleServices?.[i] ?? `Layanan ${i + 1}`,
                code,
              }));
              setOrders(current => current.map(o =>
                o.id === order.id ? { ...o, status: 'success', otpCodes, autoDismissAt: Date.now() + 60000 } : o
              ));
              fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'success', otpCode: data.otpCodes[0] }) }).catch(() => {});
              showToast(`OTP bundle ${order.serviceName} masuk!`);
              addNotif(`🔑 OTP Bundle ${order.serviceName} masuk!`);
              setTimeout(() => {
                setOrders(cur => cur.map(o =>
                  o.id === order.id && o.status === 'success' ? { ...o, status: 'completed' as Order['status'] } : o
                ));
              }, 60000);
            } else if (!order.isV2 && data.otpCode) {
              setOrders(current => current.map(o =>
                o.id === order.id ? { ...o, status: 'success', otpCode: data.otpCode, autoDismissAt: Date.now() + 60000 } : o
              ));
              fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'success', otpCode: data.otpCode }) }).catch(() => {});
              showToast(`Berhasil! Kode OTP ${order.serviceName} masuk.`);
              addNotif(`🔑 OTP ${order.serviceName}: ${data.otpCode}`);
              setTimeout(() => {
                setOrders(cur => cur.map(o =>
                  o.id === order.id && o.status === 'success' ? { ...o, status: 'completed' as Order['status'] } : o
                ));
              }, 60000);
            }
          } else if (data.status === 'cancel') {
            // ✅ Update ref dulu — cegah polling berikutnya refund lagi
            ordersRef.current = ordersRef.current.map(o =>
              o.id === order.id ? { ...o, status: 'cancelled' as Order['status'], timeLeft: 0 } : o
            );
            setOrders(current => current.map(o =>
              o.id === order.id ? { ...o, status: 'cancelled', timeLeft: 0 } : o
            ));
            fetch('/api/user/orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activationId: order.activationId, status: 'cancelled' }) }).catch(() => {});
            // ✅ Kirim activationId → backend cegah double refund via idempotency check
            updateBalance(order.price, 'add', order.activationId);
            showToast(`Nomor ${order.serviceName} dibatalkan provider. Saldo Rp ${order.price.toLocaleString('id-ID')} dikembalikan.`);
            addNotif(`↩ Refund Rp ${order.price.toLocaleString('id-ID')} untuk ${order.serviceName} berhasil dikembalikan.`);
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
              showToast(`⏱ Nomor ${order.serviceName} kadaluarsa. Saldo akan dikembalikan otomatis.`);
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
    { id: 'dashboard', name: 'Dashboard', icon: <BarChart2 className="w-5 h-5" /> },
    { id: 'buy',     name: 'Beli Nomor',        icon: <ShoppingCart className="w-5 h-5" /> },
    { id: 'topup',   name: 'Deposit Saldo',      icon: <CreditCard className="w-5 h-5" /> },
    { id: 'history', name: 'Riwayat Transaksi',  icon: <History className="w-5 h-5" /> },
    { id: 'mutasi',  name: 'Mutasi Saldo',       icon: <Receipt className="w-5 h-5" /> },
    { id: 'profile', name: 'Pengaturan Akun',    icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div suppressHydrationWarning className="min-h-screen bg-[#fafafa] dark:bg-[#020617] flex flex-col md:flex-row font-sans relative transition-colors duration-300 overflow-x-hidden" style={{minHeight:"100svh"}}>
      
      {/* SIDEBAR DESKTOP */}
      <div className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 fixed h-full z-10 shadow-sm transition-colors duration-300">
        <div className="h-[80px] flex items-center px-8 border-b border-slate-100 dark:border-slate-800">
          <img src="/logo.png" className="h-10 w-10 rounded-xl object-cover mr-3" alt="Pusat Nokos" />
          <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">PusatNokos.</span>
        </div>
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-2 tracking-widest uppercase">Total Saldo</div>
          <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">Rp {balance.toLocaleString('id-ID')}</div>
        </div>
        <div className="flex-1 py-6 px-5 space-y-2 overflow-y-auto">
          {navItems.map(i => (
            <button key={i.id} onClick={() => setActiveTab(i.id)} className={"w-full flex items-center px-4 py-4 text-[15px] font-bold rounded-2xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 " + (activeTab === i.id ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg shadow-slate-900/20 dark:shadow-none' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400')}>
              <div className={"mr-4 " + (activeTab === i.id ? 'text-indigo-400 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500')}>{i.icon}</div>{i.name}
            </button>
          ))}
        </div>
        {/* Bottom sidebar: Syarat */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800">
          <button onClick={() => setShowSyaratDash(true)} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold rounded-2xl transition-all text-sm">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
            Syarat & Ketentuan
          </button>
        </div>
      </div>

      {/* MAIN WRAPPER */}
      <div className="flex-1 md:ml-72 flex flex-col" style={{minHeight:"100svh"}}>
        <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl h-[64px] sm:h-[80px] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 shadow-sm transition-colors duration-300">
          <div className="md:hidden flex items-center font-black text-xl tracking-tight dark:text-white">
            <img src="/logo.png" className="h-8 w-8 rounded-xl object-cover mr-2" alt="Pusat Nokos" /> PusatNokos.
          </div>
          
          <div className="hidden md:flex items-center">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{navItems.find(i => i.id === activeTab)?.name}</h2>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-5">
            <button suppressHydrationWarning onClick={() => setIsDarkMode(!isDarkMode)} aria-label="Toggle dark mode" className="hidden md:flex p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
              {isDarkMode ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
            </button>

            {/* Notifikasi Bell */}
            <div className="relative">
              <button onClick={() => { setShowNotif(v => !v); setNotifCount(0); }} aria-label="Buka notifikasi" className="relative p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
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
                    <button onClick={() => { setNotifItems([]); setShowNotif(false); }} aria-label="Hapus semua notifikasi" className="text-xs text-slate-400 hover:text-red-500 font-bold">Hapus semua</button>
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
            
            <button onClick={() => setActiveTab('topup')} className="font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-xs md:text-sm hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 transition-colors shadow-sm">+ Topup</button>
            <button onClick={onLogout} className="hidden md:flex font-bold text-slate-500 dark:text-slate-400 text-sm hover:text-red-600 dark:hover:text-red-400 px-3 py-2 rounded-xl transition-colors"><LogOut className="w-5 h-5 mr-2"/> Keluar</button>
            <button onClick={() => setIsSidebarOpen(true)} aria-label="Buka menu" className="md:hidden p-2.5 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl min-w-[44px] min-h-[44px] flex items-center justify-center"><Menu className="h-6 w-6" /></button>
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
                <button onClick={() => setIsSidebarOpen(false)} aria-label="Tutup menu" className="bg-white dark:bg-slate-800 p-2 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400"><X className="w-5 h-5"/></button>
              </div>
              <div className="flex-1 py-6 px-5 space-y-2 overflow-y-auto">
                {navItems.map(i => (
                  <button key={i.id} onClick={() => {setActiveTab(i.id); setIsSidebarOpen(false);}} className={"w-full flex items-center px-5 py-4 text-sm font-bold rounded-2xl transition-colors " + (activeTab === i.id ? 'bg-slate-900 dark:bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400')}>
                    <div className={"mr-4 " + (activeTab === i.id ? 'text-indigo-400 dark:text-indigo-200' : 'text-slate-400 dark:text-slate-500')}>{i.icon}</div> {i.name}
                  </button>
                ))}
              </div>
              <div className="p-5 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <button suppressHydrationWarning onClick={() => { setIsDarkMode(!isDarkMode); }} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl transition-all text-sm">
                  {isDarkMode ? <Sun className="w-5 h-5 text-amber-400 shrink-0" /> : <Moon className="w-5 h-5 text-slate-400 shrink-0" />}
                  {isDarkMode ? 'Mode Terang' : 'Mode Gelap'}
                </button>
                <button onClick={() => { setShowSyaratDash(true); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-2xl transition-all text-sm">
                  <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                  Syarat & Ketentuan
                </button>
                <button onClick={onLogout} className="w-full font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 py-4 rounded-2xl flex justify-center items-center transition-colors"><LogOut className="w-5 h-5 mr-2"/> Keluar Akun</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-8 md:!pb-8" style={{paddingBottom:"calc(6.5rem + env(safe-area-inset-bottom,0px))"}}>
          {activeTab === 'dashboard' && <UserDashboardView user={user} balance={balance} orders={orders} mutasi={mutasi} setActiveTab={setActiveTab} notices={notices} />}
          {activeTab === 'buy' && <BuyView balance={balance} setBalance={setBalance} orders={orders} setOrders={setOrders} showToast={showToast} onCancelOrder={handleCancelOrder} favorites={favorites} setFavorites={setFavorites} setMutasi={setMutasi} activeServices={activeServices} serviceError={serviceError} countries={countries} selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} user={user} updateBalance={updateBalance} autoRetryQueue={autoRetryQueue} setAutoRetryQueue={setAutoRetryQueue} failedNumbers={failedNumbers} />}
          {activeTab === 'topup' && <TopupView balance={balance} setBalance={setBalance} showToast={showToast} setActiveTab={setActiveTab} setMutasi={setMutasi} updateBalance={updateBalance} user={user} />}
          {activeTab === 'history' && <HistoryView orders={orders} />}
          {activeTab === 'mutasi' && <MutasiView mutasi={mutasi} user={user} />}
          {activeTab === 'profile' && <ProfileView user={user} showToast={showToast} />}
        </main>
      </div>

      {/* ── Bottom Navigation Bar (mobile only) ──────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]" style={{paddingBottom:"env(safe-area-inset-bottom, 12px)"}}>
        <div className="flex items-stretch h-16 sm:h-[60px]">
          {[
            { id: 'buy',      label: 'Beli',      icon: <ShoppingCart className="w-5 h-5" /> },
            { id: 'topup',    label: 'Deposit',   icon: <CreditCard className="w-5 h-5" /> },
            { id: 'dashboard',label: 'Home',      icon: <BarChart2 className="w-5 h-5" /> },
            { id: 'history',  label: 'Riwayat',   icon: <History className="w-5 h-5" /> },
            { id: 'profile',  label: 'Akun',      icon: <Settings className="w-5 h-5" /> },
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
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
                  title: 'Deposit Saldo Terlebih Dahulu',
                  desc: 'Sebelum membeli nomor OTP, kamu harus mengisi saldo terlebih dahulu. Buka menu Deposit Saldo, pilih metode pembayaran (QRIS, DANA, GoPay, SeaBank, atau Bank Jago), masukkan nominal, lalu upload bukti transfer. Tim CS akan memverifikasi dalam waktu singkat.',
                },
                {
                  icon: <ShoppingCart className="w-5 h-5 text-violet-500" />,
                  bg: 'bg-violet-50 dark:bg-violet-900/30',
                  step: '02',
                  title: 'Pilih Layanan yang Ingin Diverifikasi',
                  desc: 'Buka menu Beli Nomor, cari aplikasi yang ingin kamu verifikasi seperti WhatsApp, Telegram, Instagram, Shopee, dan lainnya. Pastikan saldo mencukupi sebelum membeli. Kamu juga bisa gunakan Mode Bundle untuk membeli beberapa layanan sekaligus dengan 1 nomor.',
                },
                {
                  icon: <Zap className="w-5 h-5 text-amber-500" />,
                  bg: 'bg-amber-50 dark:bg-amber-900/30',
                  step: '03',
                  title: 'Tunggu Kode OTP Masuk',
                  desc: 'Setelah membeli nomor, gunakan nomor tersebut untuk mendaftar di aplikasi yang dituju. Kode OTP akan masuk otomatis dalam tampilan Pesanan Aktif. Setiap nomor aktif selama 20 menit. Jika OTP tidak masuk, saldo akan dikembalikan 100% secara otomatis (Auto Refund).',
                },
                {
                  icon: <RefreshCw className="w-5 h-5 text-green-500" />,
                  bg: 'bg-green-50 dark:bg-green-900/30',
                  step: '04',
                  title: 'Auto Refund & Auto Retry',
                  desc: 'Jika nomor kadaluarsa sebelum OTP masuk, sistem akan otomatis mengembalikan saldo dan mencoba mencari nomor baru (Auto Retry). Kamu tidak perlu khawatir kehilangan saldo. Riwayat transaksi bisa dilihat di menu Riwayat Transaksi dan Mutasi Saldo.',
                },
                {
                  icon: <Star className="w-5 h-5 text-orange-500" />,
                  bg: 'bg-orange-50 dark:bg-orange-900/30',
                  step: '05',
                  title: 'Tips Agar OTP Berhasil',
                  desc: 'Pilih layanan dengan stok yang cukup (tidak Kosong). Gunakan nomor segera setelah dibeli. Jika satu nomor gagal, sistem otomatis mencoba nomor lain. Untuk layanan populer seperti WhatsApp dan Telegram, stok selalu tersedia.',
                },
                {
                  icon: <MessageSquare className="w-5 h-5 text-blue-500" />,
                  bg: 'bg-blue-50 dark:bg-blue-900/30',
                  step: '06',
                  title: 'Butuh Bantuan? Hubungi CS Kami',
                  desc: `Tim Customer Service kami siap membantu 24/7. Hubungi via WhatsApp ke 087862306726 atau Telegram ${CS_TELEGRAM}. Sertakan username, nominal, dan screenshot jika ada kendala deposit. Kami akan merespons secepat mungkin.`,
                },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
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
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 shrink-0 flex gap-3">
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 dark:bg-indigo-900/40 p-2.5 rounded-2xl"><ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white">Syarat & Ketentuan</h2>
                  <p className="text-xs text-slate-400">Terakhir diperbarui: Januari 2025</p>
                </div>
              </div>
              <button onClick={() => setShowSyaratDash(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-6 space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {[
                { title: '1. Penerimaan Syarat', content: 'Dengan menggunakan layanan Pusat Nokos, Anda menyetujui seluruh syarat dan ketentuan yang berlaku.' },
                { title: '2. Penggunaan Layanan', content: 'Layanan hanya boleh digunakan untuk keperluan sah dan legal. Dilarang keras untuk penipuan, spam, atau aktivitas ilegal. Akun yang terindikasi penyalahgunaan akan diblokir.' },
                { title: '3. Saldo & Transaksi', content: 'Saldo yang telah di-deposit tidak dapat ditarik dalam bentuk uang tunai. Refund otomatis hanya berlaku jika OTP tidak berhasil diterima dalam batas waktu yang ditentukan.' },
                { title: '4. Ketersediaan Layanan', content: 'Kami tidak menjamin ketersediaan layanan 100% tanpa gangguan. Stok nomor dapat berubah sewaktu-waktu.' },
                { title: '5. Tanggung Jawab Pengguna', content: 'Pengguna bertanggung jawab penuh atas keamanan akun dan kata sandi masing-masing. Jangan berbagi informasi akun kepada pihak lain.' },
                { title: '6. Perubahan Ketentuan', content: 'Pusat Nokos berhak mengubah syarat dan ketentuan ini kapan saja. Penggunaan berkelanjutan berarti Anda menyetujui ketentuan baru.' },
              ].map(s => (
                <section key={s.title}>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                  <p>{s.content}</p>
                </section>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button onClick={() => setShowSyaratDash(false)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl transition-colors">Saya Mengerti</button>
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
}

// ==========================================
// TAB: DASHBOARD RINGKASAN USER
// ==========================================
function UserDashboardView({ user, balance, orders, mutasi, setActiveTab, notices }: {
  user: UserData | null;
  balance: number;
  orders: Order[];
  mutasi: Mutasi[];
  setActiveTab: (tab: string) => void;
  notices: { id: number; title: string; content: string; type: string }[];
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
            <div className="text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-70 mb-1 md:mb-2">Total Saldo</div>
            <div className="text-2xl md:text-4xl font-black">{fmtIDR(balance)}</div>
          </div>
          <button onClick={() => setActiveTab('topup')} className="bg-white/20 hover:bg-white/30 text-white text-xs md:text-sm font-bold px-4 py-2 md:px-5 md:py-2.5 rounded-xl transition-colors border border-white/20 shrink-0 md:mt-4">
            + Deposit
          </button>
        </div>
      </div>

      {/* Stats grid — 2x2 compact di mobile, 4 kolom di desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-4">
        {[
          { label: 'Total Order',  value: totalOrder,        icon: <Package className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />,   bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
          { label: 'Order Sukses', value: successOrder,      icon: <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-green-600" />, bg: 'bg-green-50 dark:bg-green-900/30' },
          { label: 'Sedang Aktif', value: activeOrder,       icon: <Activity className="w-4 h-4 md:w-5 md:h-5 text-amber-600" />,    bg: 'bg-amber-50 dark:bg-amber-900/30' },
          { label: 'Sukses Rate',  value: successRate + '%', icon: <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />,   bg: 'bg-blue-50 dark:bg-blue-900/30' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 rounded-xl md:rounded-2xl border border-slate-200 dark:border-slate-800 p-3 md:p-4">
            <div className={`${s.bg} p-2 md:p-2.5 rounded-lg md:rounded-xl w-fit mb-2 md:mb-3`}>{s.icon}</div>
            <div className="text-lg md:text-xl font-black text-slate-900 dark:text-white">{s.value}</div>
            <div className="text-[10px] md:text-xs font-bold text-slate-400 mt-0.5">{s.label}</div>
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
    <div ref={ref} className="relative w-full sm:w-64">
      <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Negara Server</label>
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setSearch(''); }}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-sm"
      >
        <FlagImg countryId={value} size={20} />
        <span className="flex-1 text-left truncate">{selected?.name.replace(/^\p{Emoji_Presentation}+\s*/u, '') ?? 'Pilih Negara'}</span>
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
                className="w-full pl-8 pr-3 py-2 text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white font-medium"
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
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all shadow-sm min-w-40"
      >
        <span>{selected.icon}</span>
        <span className="flex-1 text-left">{selected.label}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 w-52 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[60vh] overflow-y-auto">
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
        className="w-full flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 outline-none transition-all">
        <FlagImg countryId={value} size={18} />
        <span className="flex-1 text-left truncate text-xs">{selected?.name.replace(/^\p{Emoji_Presentation}+\s*/u, '') ?? 'Negara'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-64 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari negara..." className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-white" />
          </div>
          <div className="overflow-y-auto max-h-52">
            {filtered.map(c => {
              const m = COUNTRY_META[c.id] ?? { flag: '🌐', dial: '' };
              return (
                <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm font-bold text-left transition-colors ${c.id === value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
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

function MobileSortChip({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
    <div ref={ref} className="relative flex-1">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-indigo-400 outline-none transition-all">
        <span className="text-sm shrink-0">{selected.icon}</span>
        <span className="flex-1 text-left truncate text-xs">{selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 w-52 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
          {SORT_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-left transition-colors ${opt.value === value ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
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

function BuyView({ balance, setBalance, orders, setOrders, showToast, onCancelOrder, favorites, setFavorites, setMutasi, activeServices, serviceError, countries, selectedCountry, setSelectedCountry, user, updateBalance, autoRetryQueue, setAutoRetryQueue, failedNumbers }: BuyViewProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Semua');
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
      if (!res.ok) {
        // Tampilkan pesan yang ramah, bukan raw JSON dari provider
        const rawErr = typeof data.error === 'string' ? data.error : JSON.stringify(data.error ?? data);
        let friendlyMsg = 'Gagal memesan bundle. Coba lagi.';
        if (rawErr.includes('INVALID') || rawErr.includes('UNPROCESSABLE') || rawErr.includes('Validation')) {
          const badNames = bundleServices.map(s => s.name).join(', ');
          friendlyMsg = `Layanan berikut tidak mendukung Mode Bundle: ${badNames}. Pilih layanan lain (misal: WhatsApp, Telegram, Shopee).`;
        } else if (rawErr.includes('balance') || rawErr.includes('saldo')) {
          friendlyMsg = 'Saldo tidak cukup untuk bundle ini.';
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
      setMutasi(prev => [{ id: Date.now(), date: new Date().toLocaleString('id-ID'), type: 'out', amount: bundleTotalPrice, desc: 'Bundle: ' + newOrder.serviceName }, ...prev]);
      // Simpan order bundle ke Supabase
      if (user?.email) {
        fetch('/api/user/orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    <div className={`space-y-8 max-w-7xl mx-auto pb-10 ${isBundleMode && bundleSelected.size > 0 ? 'pb-28' : 'pb-10'}`}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">Beli Nomor OTP</h1>
          <button
            onClick={handleRefreshStok}
            disabled={isRefreshingStok}
            aria-label="Refresh daftar layanan"
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh stok"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingStok ? 'animate-spin' : ''}`} />
          </button>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Pilih layanan aplikasi. Harga & stok diperbarui secara real-time.</p>
        </div>
        <button
          onClick={() => { setIsBundleMode(v => !v); setBundleSelected(new Set()); }}
          className={"px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all shrink-0 " + (isBundleMode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500')}
        >
          {isBundleMode ? '✕ Batal Bundle' : '⚡ Mode Bundle'}
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
      <div className="hidden md:flex bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl p-5 md:p-6 xl:flex-row gap-5 justify-between items-end z-10 transition-colors">
        {/* Country Dropdown */}
        <div className="w-full xl:w-auto flex items-end space-x-3">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 shrink-0 mb-0.5">
            <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <CountryDropdown countries={countries} value={selectedCountry} onChange={setSelectedCountry} />
        </div>
        <div className="hidden xl:block w-px h-12 bg-slate-200 dark:bg-slate-800 mx-2 mb-0.5"></div>
        {/* Search */}
        <div className="flex-1 w-full relative">
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Pencarian</label>
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input type="text" placeholder="Cari layanan..." className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500/50 outline-none text-base font-bold transition-all shadow-sm dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        {/* Sort */}
        <SortDropdown value={sortOrder} onChange={setSortOrder} />
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
      <div className="md:hidden sticky top-[80px] z-20 -mx-4 px-4 pt-2 pb-1 bg-[#fafafa] dark:bg-[#020617]">
        {/* Filter bar */}
        <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-3 space-y-2.5 mb-2">
          <div className="flex gap-2">
            <MobileCountryChip countries={countries} value={selectedCountry} onChange={setSelectedCountry} />
            <MobileSortChip value={sortOrder} onChange={setSortOrder} />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
            <input type="text" placeholder="Cari layanan..." className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none text-sm font-medium transition-all dark:text-white" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
        {/* Kategori tabs */}
        <div className="relative">
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-[#fafafa] dark:from-[#020617] to-transparent z-10" />
          <div className="flex overflow-x-auto gap-2 pb-2" style={{scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch'}}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                className={"flex-shrink-0 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border-2 transition-all " + (activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700')}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── DESKTOP Kategori tabs ─────────────────────────────────── */}
      <div className="hidden md:block relative">
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-[#fafafa] dark:from-[#020617] to-transparent z-10" />
        <div className="flex overflow-x-auto gap-3 pb-2 px-1" style={{scrollbarWidth:'none', msOverflowStyle:'none', WebkitOverflowScrolling:'touch'}}>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={"flex-shrink-0 px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap border-2 transition-all " + (activeCategory === cat ? 'bg-indigo-600 dark:bg-indigo-600 text-white border-indigo-600 dark:border-indigo-600 shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500')}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className={`flex flex-col-reverse xl:grid xl:items-start ${activeOrders.length > 0 ? 'xl:grid-cols-3' : ''} gap-8`}>
        
        <div className={"bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 rounded-[2rem] overflow-hidden flex flex-col transition-colors " + (activeOrders.length > 0 ? 'xl:col-span-2' : '')}>

          {/* ===== DESKTOP: Tabel ===== */}
          <div className="hidden md:block overflow-x-auto flex-1 min-h-[400px] max-h-[600px] overflow-y-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 font-bold sticky top-0 z-10 shadow-sm">
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
                          <button onClick={() => toggleFavorite(s.id)} className="mr-3 p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shrink-0">
                            <Star className={`w-4 h-4 transition-colors ${favorites.includes(s.id) ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} />
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0 group-hover:scale-110 transition-transform">{s.icon}</div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white text-[15px] truncate max-w-[180px] sm:max-w-none">{s.name}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 inline-block font-bold uppercase tracking-wider whitespace-nowrap shrink-0">{s.category}</div>
                                {s.outOfStock && <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800/50 font-bold uppercase tracking-wider">Stok Habis</div>}
                                {serviceSuccessRates[s.name] !== undefined && (
                                  <div className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${serviceSuccessRates[s.name] >= 70 ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/50' : serviceSuccessRates[s.name] >= 40 ? 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50' : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'}`}>✓ {serviceSuccessRates[s.name]}% sukses</div>
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
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">per OTP</div>
                      </td>
                      <td className="p-5 sm:px-6 text-right">
                        {isBundleMode ? (
                          <button onClick={() => !s.outOfStock && toggleBundle(s.id)} disabled={s.outOfStock} className={"w-7 h-7 rounded-lg border-2 flex items-center justify-center ml-auto transition-all " + (s.outOfStock ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed' : bundleSelected.has(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400')}>
                            {bundleSelected.has(s.id) && <Check className="w-4 h-4 text-white" />}
                          </button>
                        ) : (
                          <button onClick={() => !s.outOfStock && handleBuy(s)} disabled={isProcessing || s.outOfStock} className={"text-white px-6 py-3.5 rounded-xl text-sm font-bold shadow-md w-full max-w-36 ml-auto transition-all flex justify-center items-center " + (s.outOfStock ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : isProcessing ? 'bg-indigo-400 cursor-wait' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 hover:shadow-lg active:scale-95')}>
                            {s.outOfStock ? 'Habis' : isProcessing ? <RefreshCw className="w-4 h-4 animate-spin"/> : 'Beli Nomor'}
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
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><Filter className="w-10 h-10 text-slate-300 dark:text-slate-500" /></div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Layanan tidak ditemukan</p>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Coba sesuaikan kata kunci pencarian Anda.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ===== MOBILE: Card layout ===== */}
          <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
            {isLoadingData ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-2xl shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20"></div>
                  </div>
                  <div className="h-9 w-20 bg-slate-200 dark:bg-slate-700 rounded-xl shrink-0"></div>
                </div>
              ))
            ) : finalServices.length > 0 ? (
              finalServices.map(s => (
                <div key={s.id} className={"flex items-center gap-3 p-4 transition-colors " + (s.outOfStock ? 'opacity-60' : 'hover:bg-indigo-50/40 dark:hover:bg-slate-800/50')}>
                  {/* Icon */}
                  <div className="shrink-0">{s.icon}</div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white text-sm truncate">{s.name}</div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800/50 font-bold uppercase tracking-wider">{s.category}</span>
                      <span className={"inline-flex items-center text-[10px] font-bold gap-1 " + (s.outOfStock ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400')}>
                        <span className={"w-1.5 h-1.5 rounded-full shrink-0 " + (s.outOfStock ? 'bg-red-500' : 'bg-green-500')}></span>
                        {s.outOfStock ? 'Kosong' : s.stock.toLocaleString()}
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
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">per OTP</div>
                    </div>
                    {isBundleMode ? (
                      <button onClick={() => !s.outOfStock && toggleBundle(s.id)} disabled={s.outOfStock} className={"w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all " + (s.outOfStock ? 'border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed' : bundleSelected.has(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600')}>
                        {bundleSelected.has(s.id) && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ) : (
                      <button onClick={() => !s.outOfStock && handleBuy(s)} disabled={isProcessing || s.outOfStock} className={"text-white text-xs font-bold px-3 py-2 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1 " + (s.outOfStock ? 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed' : isProcessing ? 'bg-indigo-400 cursor-wait' : 'bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500')}>
                        {s.outOfStock ? 'Habis' : isProcessing ? <RefreshCw className="w-3 h-3 animate-spin"/> : 'Beli'}
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
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4"><Filter className="w-8 h-8 text-slate-300 dark:text-slate-500" /></div>
                <p className="font-extrabold text-slate-800 dark:text-slate-200">Layanan tidak ditemukan</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian.</p>
              </div>
            )}
          </div>

        </div>

        {activeOrders.length > 0 && (
          <div id="active-orders-mobile" className="xl:col-span-1 xl:sticky xl:top-[104px] order-first xl:order-last">
            <div className="bg-indigo-600 text-white rounded-[2rem] shadow-xl overflow-hidden border border-indigo-400/60 animate-in fade-in slide-in-from-right-8 duration-300">

              {/* Header */}
              <div className="px-4 py-3 border-b border-indigo-500/50 flex items-center justify-between bg-indigo-700/60 font-bold">
                <div className="flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-yellow-300" />
                  <span>Pesanan Aktif</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Tombol kembali ke atas */}
                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/30 text-xs font-bold transition-colors"
                    title="Kembali ke atas"
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
                          title={o.timeLeft > 900 ? 'Tunggu 5 menit sebelum bisa membatalkan' : 'Batalkan pesanan'}
                        >
                          BATAL
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
                            <div className="bg-green-500 text-white px-4 py-3.5 rounded-xl font-black text-2xl tracking-widest cursor-pointer shadow-lg text-center border border-green-400 hover:bg-green-400 transition-colors animate-in zoom-in flex justify-center items-center group" onClick={() => copyToClipboard(o.otpCode ?? '', showToast)} aria-label={`Salin kode OTP ${o.otpCode}`}>
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
          <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 w-full sm:max-w-md p-5 sm:p-6 max-h-screen overflow-y-auto" onClick={e => e.stopPropagation()}>
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
  { id: 'qris',    name: 'QRIS',      number: 'NMID: ID1024342737094', holder: 'PUSAT NOKOS', qrisUrl: 'https://delynxoxxjzkptvrybst.supabase.co/storage/v1/object/public/deposit-proofs/6269328457800028135_121.jpg' },
];

function TopupView({ balance, setBalance, showToast, setActiveTab, setMutasi, updateBalance, user }: TopupViewProps) {
  const [depositMode, setDepositMode]   = useState<'select' | 'manual' | 'auto' | 'history'>('select');
  const [amount,      setAmount]        = useState('');
  const [selectedBank,setSelectedBank]  = useState(BANK_ACCOUNTS[0]);
  const [step,        setStep]          = useState(1); // 1=isi nominal, 2=instruksi, 3=upload bukti
  const [proof,       setProof]         = useState<string | null>(null);
  const [proofName,   setProofName]     = useState('');
  const [note,        setNote]          = useState('');
  const [isLoading,   setIsLoading]     = useState(false);
  const [myRequests,  setMyRequests]    = useState<any[]>([]);
  const [waUrl,       setWaUrl]         = useState<string | null>(null);

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
        headers: { 'Content-Type': 'application/json' },
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

      // Siapkan URL WA untuk ditampilkan sebagai tombol (iOS tidak izinkan auto-redirect setelah async)
      const nominal = parseInt(amount).toLocaleString('id-ID');
      const userName = user.name ?? user.email;
      const metodePembayaran = selectedBank.id === 'qris' ? 'QRIS (INSTANT)' : selectedBank.name;
      const waMsg = `Halo Admin PusatNokos, saya ingin melakukan konfirmasi Top Up Saldo.\n*Detail Top Up:*\n- Username: *${userName}*\n- Nominal: *Rp ${nominal}*\n- Metode Pembayaran: *${metodePembayaran}*\nBerikut saya lampirkan bukti transfernya.`;
      setWaUrl(`https://wa.me/${CS_WA}?text=${encodeURIComponent(waMsg)}`);
      setStep(4); // step sukses
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
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Deposit Saldo</h1>
        <div className="flex gap-2">
          {['select', 'history'].map(m => (
            <button key={m} onClick={() => setDepositMode(m as any)} className={"px-4 py-2 rounded-xl text-sm font-bold transition-colors " + (depositMode === m || (depositMode === 'manual' && m === 'select') || (depositMode === 'auto' && m === 'select') ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
              {m === 'select' ? '+ Deposit Baru' : '📋 Riwayat'}
            </button>
          ))}
        </div>
      </div>

      {/* ── PILIH MODE ── */}
      {depositMode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div onClick={() => { setDepositMode('auto'); }} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-200 dark:border-indigo-700 hover:border-indigo-500 dark:hover:border-indigo-400 p-6 cursor-pointer transition-all group relative overflow-hidden">
            <div className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">OTOMATIS</div>
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-2xl w-fit mb-4 group-hover:bg-indigo-600 transition-colors">
              <Zap className="w-6 h-6 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Deposit Otomatis</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">QRIS, Virtual Account, atau E-Wallet. Saldo masuk otomatis setelah bayar.</p>
            <div className="mt-4 text-xs font-bold text-indigo-600 dark:text-indigo-400">QRIS · BRI · BNI · Mandiri · DANA →</div>
          </div>

          <div onClick={() => { setDepositMode('manual'); setStep(1); }} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 p-6 cursor-pointer transition-all group">
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl w-fit mb-4 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
              <CreditCard className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <h3 className="font-black text-slate-900 dark:text-white text-lg mb-1">Transfer Manual</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Transfer ke rekening/QRIS admin, upload bukti, admin approve dalam 1x24 jam.</p>
            <div className="mt-4 text-xs font-bold text-slate-400">SeaBank · DANA · GoPay · Bank Jago · QRIS →</div>
          </div>
        </div>
      )}

      {/* ── DEPOSIT OTOMATIS (PAYMENKU) ── */}
      {depositMode === 'auto' && (
        <div className="space-y-5">
          <button onClick={() => setDepositMode('select')} className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            ← Kembali
          </button>

          {/* Pilih nominal */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="font-black text-slate-900 dark:text-white">Nominal Deposit</h3>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AUTO.map(n => (
                <button key={n} onClick={() => setAutoAmount(String(n))}
                  className={"py-2.5 rounded-xl text-sm font-bold transition-colors " + (autoAmount === String(n) ? 'bg-indigo-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 border border-slate-200 dark:border-slate-700')}>
                  Rp {(n/1000)}rb
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-sm font-bold text-slate-400">Rp</span>
              <input type="number" min="5000" value={autoAmount} onChange={e => setAutoAmount(e.target.value)}
                placeholder="Atau ketik nominal lain..." className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-bold dark:text-white" />
            </div>
            {autoAmount && parseInt(autoAmount) >= 5000 && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">= Rp {parseInt(autoAmount).toLocaleString('id-ID')}</p>
            )}
          </div>

          {/* Pilih metode */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="font-black text-slate-900 dark:text-white">Metode Pembayaran</h3>
            <div className="space-y-2">
              {PAYMENKU_CHANNELS.map(ch => {
                const nominal = parseInt(autoAmount) || 0;
                const totalFee = nominal > 0 ? Math.round(ch.feeFlat + nominal * ch.feePct) : 0;
                const totalBayar = nominal + totalFee;
                return (
                  <button key={ch.code} onClick={() => setAutoChannel(ch.code)}
                    className={"w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left " + (autoChannel === ch.code ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300')}>
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
                    <div className={"w-4 h-4 rounded-full border-2 shrink-0 " + (autoChannel === ch.code ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 dark:border-slate-600')}></div>
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
                  <span>Saldo masuk</span>
                  <span className="font-bold">Rp {nominal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Biaya {ch.name}</span>
                  <span>Rp {fee.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-indigo-700 dark:text-indigo-300 font-black text-base border-t border-indigo-200 dark:border-indigo-800 pt-2">
                  <span>Total Bayar</span>
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
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm">
                Lihat Riwayat Deposit
              </button>
            </div>
          ) : (
            <>
              <button onClick={handlePaymenku} disabled={autoLoading || !autoAmount || parseInt(autoAmount) < 5000}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base">
                {autoLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {autoLoading ? 'Memproses...' : 'Bayar Sekarang'}
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
                  <input type="text" inputMode="numeric" pattern="[0-9]*" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g,""))} min="10000" placeholder="10000" className="w-full px-14 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-black text-3xl outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white" />
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
              <button onClick={() => { if (!amount || parseInt(amount) < 5000) { showToast('Minimal deposit otomatis Rp 5.000'); return; } setStep(2); }} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-600 dark:hover:bg-indigo-700 transition-colors active:scale-95">
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedBank.qrisUrl} alt="QRIS Pusat Nokos" width={256} height={256} className="w-64 h-64 object-contain rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-2" />
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
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Misal: transfer dari BCA atas nama Budi" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-base font-medium outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white resize-none h-20" />
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
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-sm">
                Lihat Riwayat Deposit
              </button>
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
          showHistoryToast('Nomor ini sudah kadaluarsa di provider dan tidak bisa diaktifkan ulang. Silakan beli nomor baru untuk layanan yang sama.');
        } else {
          showHistoryToast(costData.error ?? 'Gagal cek harga reaktivasi.');
        }
        return;
      }

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
        const errStr2 = typeof data.error === 'string' ? data.error.toLowerCase() : '';
        if (errStr2.includes('upstream') || errStr2.includes('server') || errStr2.includes('404')) {
          showHistoryToast('Reaktivasi gagal — nomor sudah kadaluarsa. Beli nomor baru untuk layanan ini.');
        } else {
          showHistoryToast(data.error ?? 'Gagal reaktivasi.');
        }
      }
    } catch {
      showHistoryToast('Kesalahan jaringan. Periksa koneksi dan coba lagi.');
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
        <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Riwayat Transaksi</h1>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:'none', msOverflowStyle:'none'}}>
          {[
            { value: '',          label: 'Semua',       color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700' },
            { value: 'success',   label: '✅ Berhasil',  color: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' },
            { value: 'waiting',   label: '⏳ Menunggu',  color: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/50' },
            { value: 'cancelled', label: '❌ Batal',     color: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50' },
            { value: 'expired',   label: '🕐 Kadaluarsa',color: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterStatus(opt.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-black border-2 transition-all whitespace-nowrap ${
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

        {/* ===== DESKTOP: Tabel ===== */}
        <div className="hidden md:block overflow-x-auto min-h-[300px]">
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
              {isLoading && apiHistory.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-32 mb-2"></div><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="p-5 sm:px-6"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-44"></div></td>
                    <td className="p-5 sm:px-6 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-20 ml-auto"></div></td>
                    <td className="p-5 sm:px-6 text-right"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded-lg w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : localOnly.length === 0 && apiHistory.length === 0 ? (
                <tr><td colSpan={4} className="py-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><History className="w-10 h-10 text-slate-300 dark:text-slate-500"/></div>
                  <p className="font-extrabold text-slate-800 dark:text-slate-200 text-lg">Belum ada riwayat.</p>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">Transaksi yang Anda lakukan akan muncul di sini.</p>
                </td></tr>
              ) : (
                <>
                  {localOnly.filter(o => !filterStatus || o.status === filterStatus).map(o => (
                    <tr key={'local-' + o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-5 sm:px-6"><div className="font-bold text-base text-slate-900 dark:text-white">{o.serviceName}</div><div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{o.date}</div></td>
                      <td className="p-5 sm:px-6"><span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg dark:text-slate-300">{o.number}</span>{o.otpCode && <span className="text-sm font-black text-green-700 dark:text-green-400 ml-3 inline-flex items-center">OTP: <span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 ml-1.5 tracking-widest">{o.otpCode}</span></span>}</td>
                      <td className="p-5 sm:px-6 text-right"><span className={"px-3.5 py-1.5 text-[11px] font-black rounded-lg border uppercase tracking-wider " + (STATUS_COLOR[o.status] ?? STATUS_COLOR['cancelled'])}>{o.status === 'cancelled' ? 'BATAL' : o.status === 'waiting' ? 'MENUNGGU' : o.status === 'success' ? 'BERHASIL' : 'KADALUARSA'}</span></td>
                      <td className="p-5 sm:px-6 text-right">—</td>
                    </tr>
                  ))}
                  {apiHistory.map(a => (
                    <tr key={'api-' + a.activationId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-5 sm:px-6"><div className="font-bold text-base text-slate-900 dark:text-white uppercase">{a.service}</div><div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">{a.createdAt ?? '—'}</div></td>
                      <td className="p-5 sm:px-6"><span className="font-mono font-bold text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg dark:text-slate-300">{a.phone}</span>{a.otpCode && <span className="text-sm font-black text-green-700 dark:text-green-400 ml-3 inline-flex items-center">OTP: <span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 ml-1.5 tracking-widest">{a.otpCode}</span></span>}</td>
                      <td className="p-5 sm:px-6 text-right"><span className={"px-3.5 py-1.5 text-[11px] font-black rounded-lg border uppercase tracking-wider " + (STATUS_COLOR[a.status] ?? STATUS_COLOR['cancelled'])}>{a.statusLabel}</span></td>
                      <td className="p-5 sm:px-6 text-right">
                        {a.status === 'success' && a.activationId && (
                          <button disabled={reactivating === a.activationId}
                            onClick={async () => { setReactivating(a.activationId); try { const costRes = await fetch(`/api/reactivation?id=${a.activationId}`); const costData = await costRes.json(); if (!costRes.ok) { const e = typeof costData.error === 'string' ? costData.error.toLowerCase() : ''; showHistoryToast(e.includes('404')||e.includes('upstream')||e.includes('server')||e.includes('not found')||e.includes('invalid') ? 'Nomor sudah kadaluarsa. Beli nomor baru.' : (costData.error ?? 'Gagal cek harga.')); return; } const confirm = window.confirm(`Pakai nomor ${a.phone} lagi?\nBiaya: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`); if (!confirm) return; const res = await fetch('/api/reactivation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.activationId, service: a.service }) }); const data = await res.json(); if (!res.ok) { const e2 = typeof data.error === 'string' ? data.error.toLowerCase() : ''; showHistoryToast(e2.includes('upstream')||e2.includes('server') ? 'Reaktivasi gagal — nomor kadaluarsa.' : (data.error ?? 'Gagal reaktivasi.')); return; } showHistoryToast(`Berhasil! Nomor ${data.phone} siap dipakai lagi.`); } catch { showHistoryToast('Kesalahan jaringan.'); } finally { setReactivating(null); } }}
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
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800 min-h-[200px]">
          {isLoading && apiHistory.length === 0 ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse space-y-2">
                <div className="flex justify-between"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28"></div><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div></div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-20"></div>
                <div className="h-7 bg-slate-100 dark:bg-slate-800 rounded-lg w-36"></div>
              </div>
            ))
          ) : localOnly.length === 0 && apiHistory.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-3"><History className="w-8 h-8 text-slate-300 dark:text-slate-500"/></div>
              <p className="font-extrabold text-slate-800 dark:text-slate-200">Belum ada riwayat.</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Transaksi yang Anda lakukan akan muncul di sini.</p>
            </div>
          ) : (
            <>
              {localOnly.filter(o => !filterStatus || o.status === filterStatus).map(o => (
                <div key={'m-local-' + o.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-bold text-sm text-slate-900 dark:text-white">{o.serviceName}</div><div className="text-xs text-slate-400 mt-0.5">{o.date}</div></div>
                    <span className={"px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase shrink-0 " + (STATUS_COLOR[o.status] ?? STATUS_COLOR['cancelled'])}>{o.status === 'cancelled' ? 'BATAL' : o.status === 'waiting' ? 'MENUNGGU' : o.status === 'success' ? 'BERHASIL' : 'KADALUARSA'}</span>
                  </div>
                  <div className="font-mono text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 inline-block">{o.number}</div>
                  {o.otpCode && <div className="flex items-center gap-1.5 text-xs font-black text-green-700 dark:text-green-400">OTP: <span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 tracking-widest">{o.otpCode}</span></div>}
                </div>
              ))}
              {apiHistory.map(a => (
                <div key={'m-api-' + a.activationId} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div><div className="font-bold text-sm text-slate-900 dark:text-white uppercase">{a.service}</div><div className="text-xs text-slate-400 mt-0.5">{a.createdAt ?? '—'}</div></div>
                    <span className={"px-2.5 py-1 text-[10px] font-black rounded-lg border uppercase shrink-0 " + (STATUS_COLOR[a.status] ?? STATUS_COLOR['cancelled'])}>{a.statusLabel}</span>
                  </div>
                  <div className="font-mono text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-300 inline-block">{a.phone}</div>
                  {a.otpCode && <div className="flex items-center gap-1.5 text-xs font-black text-green-700 dark:text-green-400">OTP: <span className="bg-green-100 dark:bg-green-900/30 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-800/50 tracking-widest">{a.otpCode}</span></div>}
                  {a.status === 'success' && a.activationId && (
                    <button disabled={reactivating === a.activationId}
                      onClick={async () => { setReactivating(a.activationId); try { const costRes = await fetch(`/api/reactivation?id=${a.activationId}`); const costData = await costRes.json(); if (!costRes.ok) { const e = typeof costData.error === 'string' ? costData.error.toLowerCase() : ''; showHistoryToast(e.includes('404')||e.includes('upstream')||e.includes('server') ? 'Nomor sudah kadaluarsa. Beli nomor baru.' : (costData.error ?? 'Gagal cek harga.')); return; } const confirm = window.confirm(`Pakai nomor ${a.phone} lagi?\nBiaya: Rp ${(costData.priceIDR ?? 0).toLocaleString('id-ID')}`); if (!confirm) return; const res = await fetch('/api/reactivation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: a.activationId, service: a.service }) }); const data = await res.json(); if (!res.ok) { const e2 = typeof data.error === 'string' ? data.error.toLowerCase() : ''; showHistoryToast(e2.includes('upstream')||e2.includes('server') ? 'Reaktivasi gagal — nomor kadaluarsa.' : (data.error ?? 'Gagal reaktivasi.')); return; } showHistoryToast(`Berhasil! Nomor ${data.phone} siap dipakai lagi.`); } catch { showHistoryToast('Kesalahan jaringan.'); } finally { setReactivating(null); } }}
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
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <button onClick={() => { const next = page + 1; setPage(next); fetchHistory(next, filterStatus); }}
              className="px-8 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl text-sm font-bold transition-colors border border-slate-200 dark:border-slate-700">
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
          <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Buku Mutasi Saldo</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 hidden md:block">Catatan rinci pemasukan dan pengeluaran saldo Anda.</p>
        </div>
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value as '' | 'in' | 'out')}
          className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 shadow-sm w-full sm:w-40"
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
                <th className="p-3 sm:p-5 sm:px-6 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Waktu & Deskripsi</th>
                <th className="p-3 sm:p-5 sm:px-6 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading && dbMutasi.length === 0 ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-3 sm:p-5 sm:px-6"><div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div><div className="h-3 bg-slate-100 dark:bg-slate-800 rounded w-24"></div></td>
                    <td className="p-3 sm:p-5 sm:px-6 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : allMutasi.length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full flex items-center justify-center mx-auto mb-3"><Receipt className="w-8 h-8 text-slate-300 dark:text-slate-500"/></div>
                    <p className="font-extrabold text-slate-800 dark:text-slate-200">Belum ada mutasi.</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Buku kas akan terisi saat Anda deposit atau membeli nomor.</p>
                  </td>
                </tr>
              ) : allMutasi.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
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
        const r = await fetch(`/api/user/account-info?email=${encodeURIComponent(user.email)}`);
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
    if (newPass !== confirmPass) { setPassError('Konfirmasi password tidak cocok.'); return; }
    setPassLoading(true);
    try {
      const r = await fetch('/api/user/change-password', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const inputCls = "w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500/50 text-base transition-colors";

  return (
    <div className="max-w-3xl space-y-6 mx-auto pb-10">
      <div className="flex items-center gap-3 md:hidden mb-2">
        <button onClick={() => history.back()} className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shadow-sm">
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">Pengaturan Akun</h1>
      </div>
      <h1 className="text-xl md:text-3xl font-extrabold text-slate-900 dark:text-white hidden md:block">Pengaturan Akun</h1>

      {/* ── Info Profil ── */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 transition-colors">
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
        <form className="space-y-6 pt-8 border-t border-slate-100 dark:border-slate-800" onSubmit={handleSave}>
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Nama Lengkap</label>
            <input type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed text-base" defaultValue={user?.name} disabled />
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
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2.5 rounded-xl">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Informasi Akun</h3>
        </div>
        {loadingInfo ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5 animate-pulse">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3" />
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-28" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Bergabung Sejak</div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {accountInfo?.joinedAt
                  ? new Date(accountInfo.joinedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total Order</div>
              <div className="text-base font-black text-slate-900 dark:text-white">
                {accountInfo ? `${accountInfo.totalOrders} order` : '—'}
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Total Pembelian</div>
              <div className="text-base font-black text-indigo-600 dark:text-indigo-400">
                {accountInfo ? `Rp ${accountInfo.totalSpend.toLocaleString('id-ID')}` : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Ganti Password ── */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-10 transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-amber-50 dark:bg-amber-900/30 p-2.5 rounded-xl">
            <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white">Ganti Password</h3>
        </div>
        <form className="space-y-4" onSubmit={handleChangePassword}>
          {/* Password Lama */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Password Saat Ini</label>
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
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Password Baru</label>
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
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`} />
                ))}
                <span className="text-[10px] font-bold text-slate-400 ml-1 self-center">
                  {newPass.length < 4 ? 'Lemah' : newPass.length < 7 ? 'Sedang' : newPass.length < 10 ? 'Kuat' : 'Sangat Kuat'}
                </span>
              </div>
            )}
          </div>
          {/* Konfirmasi */}
          <div>
            <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">Konfirmasi Password Baru</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
                placeholder="Ulangi password baru"
                required
                className={inputCls + ' pr-12' + (confirmPass && confirmPass !== newPass ? ' border-red-400 focus:ring-red-400/30' : '')}
              />
              <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-4 top-4 text-slate-400 hover:text-indigo-600 transition-colors">
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {confirmPass && confirmPass !== newPass && (
              <p className="text-xs text-red-500 font-bold mt-1.5">Password tidak cocok.</p>
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
              {passLoading ? 'Menyimpan...' : 'Ubah Password'}
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