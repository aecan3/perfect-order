import { Baloo_2 } from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata = {
  title: "Perfect Order",
  description: "Pokémon TCG collection tracker",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={baloo.variable}>
      <body className={baloo.className}>{children}</body>
    </html>
  );
}
