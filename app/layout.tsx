import type { Metadata } from "next";
import { Inter, Bebas_Neue, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SystemStatusBanner } from "@/components/SystemStatusBanner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

const bebas = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-bebas",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "UniHub Workshop",
  description: "Nền tảng đăng ký workshop cho sinh viên",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${bebas.variable} ${mono.variable}`}
    >
      <body className="font-sans bg-white text-ink antialiased">
        <SystemStatusBanner />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
