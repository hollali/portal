import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Inter_Tight, Geist_Mono } from "next/font/google";
import "./globals.css";
import MotionInit from "@/components/MotionInit";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alban Bagbin Portal",
  description: "Public profile, media library and news archive for Rt. Hon. Alban S. K. Bagbin",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <Script
          id="motion-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if('IntersectionObserver' in window){var r=document.documentElement;r.dataset.motion='js';setTimeout(function(){if(!r.dataset.motionReady){r.removeAttribute('data-motion')}},2000)}}catch(e){}})();",
          }}
        />
        <MotionInit />
        {children}
      </body>
    </html>
  );
}
