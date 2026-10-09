import type { Metadata } from "next";
import { Inter, Inter_Tight, Geist_Mono, Fraunces } from "next/font/google";
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

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
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
    <html lang="en" data-scroll-behavior="smooth" className={`${inter.variable} ${interTight.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{document.documentElement.dataset.motion='js'}catch(e){}})();",
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':!window.matchMedia('(prefers-color-scheme: light)').matches;var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light')}catch(e){}})();",
          }}
        />
        <MotionInit />
        {children}
      </body>
    </html>
  );
}
