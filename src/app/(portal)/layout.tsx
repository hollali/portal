import type { Metadata } from "next";
import PortalShell from "@/components/PortalShell";

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
  // The sidebar, topbar, and toast queue all need client state, so the whole
  // chrome lives behind one boundary in PortalShell rather than being split
  // across several client components here.
  return <PortalShell>{children}</PortalShell>;
}
