import type { Metadata } from "next";
import { Space_Grotesk, Share_Tech_Mono } from "next/font/google";

import { ClientShell } from "@/components/system/ClientShell";
import { LoadingShellController } from "@/components/system/LoadingShellController";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-share-tech-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PulmoVision",
  description: "PulmoVision pulmonary intelligence research prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${spaceGrotesk.variable} ${shareTechMono.variable}`}>
      <head>
        <link
          rel="preload"
          href="/fonts/FragmentMono-400.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/PlusJakartaSans-500.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <div id="loading-shell" className="loading-shell" aria-hidden="true">
          <div className="loading-arc" />
        </div>

        <LoadingShellController />
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
