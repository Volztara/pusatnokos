// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title       : 'Pusat Nokos — Platform OTP Indonesia',
  description : 'Beli nomor OTP virtual untuk semua layanan dengan harga terjangkau. WhatsApp, Telegram, Instagram, dan 500+ layanan lainnya.',
  keywords    : ['OTP', 'nomor virtual', 'SMS verification', 'Indonesia', 'WhatsApp OTP'],
  authors     : [{ name: 'Pusat Nokos' }],
  manifest    : '/manifest.json',
  appleWebApp : {
    capable        : true,
    statusBarStyle : 'black-translucent',
    title          : 'Pusat Nokos',
  },
  openGraph: {
    title      : 'Pusat Nokos — Platform OTP Indonesia',
    description: 'Beli nomor OTP virtual untuk semua layanan dengan harga terjangkau.',
    type       : 'website',
    locale     : 'id_ID',
  },
  icons: {
    icon       : '/icons/icon-192x192.png',
    apple      : '/icons/icon-192x192.png',
    shortcut   : '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  themeColor           : '#4f46e5',
  width                : 'device-width',
  initialScale         : 1,
  maximumScale         : 5,        // izinkan zoom untuk aksesibilitas
  userScalable         : true,
  viewportFit          : 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning style={{ overflowX: 'hidden' }}>
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(reg => console.log('SW registered:', reg.scope))
                    .catch(err => console.log('SW error:', err));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}