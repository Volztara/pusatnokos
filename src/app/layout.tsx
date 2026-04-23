// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title       : 'Pusat Nokos — Virtual OTP Number Platform',
  description : 'Buy virtual OTP numbers for all services at the best price. WhatsApp, Telegram, Instagram, and 500+ more. 100% Auto Refund guaranteed.',
  keywords    : ['OTP', 'virtual number', 'SMS verification', 'OTP platform', 'WhatsApp OTP', 'virtual phone number'],
  authors     : [{ name: 'Pusat Nokos' }],
  manifest    : '/manifest.json',
  appleWebApp : {
    capable        : true,
    statusBarStyle : 'black-translucent',
    title          : 'Pusat Nokos',
  },
  openGraph: {
    title      : 'Pusat Nokos — Virtual OTP Number Platform',
    description: 'Buy virtual OTP numbers for all services at the best price. 100% Auto Refund guaranteed.',
    type       : 'website',
    locale     : 'en_US',
    url        : 'https://pusatnokos.com',
    siteName   : 'Pusat Nokos',
  },
  twitter: {
    card       : 'summary',
    title      : 'Pusat Nokos — Virtual OTP Number Platform',
    description: 'Buy virtual OTP numbers instantly. 100% Auto Refund. 500+ services supported.',
  },
  icons: {
    icon       : '/icons/icon-192x192.png',
    apple      : '/icons/icon-192x192.png',
    shortcut   : '/icons/icon-192x192.png',
  },
  robots: {
    index  : true,
    follow : true,
  },
};

export const viewport: Viewport = {
  themeColor           : '#4f46e5',
  width                : 'device-width',
  initialScale         : 1,
  maximumScale         : 5,
  userScalable         : true,
  viewportFit          : 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning style={{ overflowX: 'hidden' }}>
      <head>
        <meta charSet="utf-8" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pusat Nokos" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={inter.className}
        suppressHydrationWarning
        style={{ overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}
      >
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}