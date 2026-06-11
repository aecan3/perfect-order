import './globals.css';
import SwRegister from './sw-register';
import { TouchActiveShim } from '@/components/TouchActiveShim';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { RefreshPricesProvider } from './RefreshPricesProvider';

export const metadata = {
  metadataBase: new URL('https://mastersettertcg.com'),
  title: {
    template: '%s · Master Setter',
    default: 'Master Setter',
  },
  description: 'Track your Pokémon TCG collection and trade with friends.',
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
  openGraph: {
    siteName: 'Master Setter',
    images: ['/brand/master-setter-stacked-email.png'],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/brand/master-setter-stacked-email.png'],
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
        <TouchActiveShim />
        <RefreshPricesProvider>
          {children}
        </RefreshPricesProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
