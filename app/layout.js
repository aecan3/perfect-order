import { Baloo_2 } from "next/font/google";
import "./globals.css";
import SwRegister from "./sw-register";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata = {
  title: "PokéBinder",
  description: "Track your Pokemon TCG collection and trade with friends",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PokéBinder",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={baloo.variable}>
      <body className={baloo.className}>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}

