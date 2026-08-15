import type { Metadata } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/manrope";
import "@fontsource/jetbrains-mono/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pevier — Autonomous Publishing Firewall",
  description: "Policy enforcement, circuit breaking, and tamper-evident audit evidence for autonomous social-media publishing.",
  verification: {
    google: "w-PNqkq4S69qUJQ6CwXvV4_uXAWCAU3BimBzBFm_pyQ",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body>{children}</body></html>;
}
