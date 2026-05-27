import './globals.css';
import SwRegister from './sw-register';
import { Analytics } from '@vercel/analytics/react';
import { RefreshPricesProvider } from './RefreshPricesProvider';

export const metadata = {
  title: 'Master Setter',
  description: 'Track your Pokemon TCG collection and trade with friends',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Master Setter',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#050507',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SwRegister />
        <RefreshPricesProvider>
          {children}
        </RefreshPricesProvider>
        <Analytics />
      </body>
    </html>
  );
}
