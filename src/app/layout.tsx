import type { Metadata } from "next";
import { Inter, Inter_Tight, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

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
  title: "OSINT Portal",
  description: "OSINT Collection Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Sidebar />
        <main
          className="page-enter"
          style={{
            marginLeft: 'var(--sidebar-width)',
            maxWidth: '1280px',
            padding: '1.5rem 2rem',
            minHeight: '100vh',
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
