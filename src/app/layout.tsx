import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Jupiter Pulse ⚡ – Real-Time Solana Market Pulse",
  description:
    "Real-time observability dashboard for Solana tokens. Live prices, charts, and market momentum built for the Jupiter ecosystem.",

  metadataBase: new URL("https://jupiter-pulse-abet.vercel.app"),

  openGraph: {
    title: "Jupiter Pulse ⚡",
    description:
      "Real-time market pulse for the Jupiter ecosystem on Solana.",
    url: "https://jupiter-pulse-abet.vercel.app",
    siteName: "Jupiter Pulse",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Jupiter Pulse – Real-Time Market Pulse",
      },
    ],
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Jupiter Pulse ⚡",
    description:
      "Track Solana markets in real time. Live prices, charts & momentum for the Jupiter ecosystem.",
    images: ["/og.png"],
    creator: "@lhajsol",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        {/* GLOBAL HEADER */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
            <Link href="/" className="flex flex-col">
              <span className="text-xl font-bold tracking-tight">
                ⚡ Jupiter Pulse
              </span>
              <span className="text-xs text-gray-400">
                Real-time Solana market pulse
              </span>
            </Link>
          </div>
        </header>

        <main>{children}</main>
      </body>
    </html>
  );
}
