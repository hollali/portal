import type { Metadata } from "next";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: {
    default: "OSINT Portal",
    template: "%s · OSINT Portal",
  },
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
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
    </>
  );
}