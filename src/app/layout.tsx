import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jupiter Pulse ⚡",
  description:
    "Real-time market pulse for the Jupiter & Solana ecosystem. Live prices, charts, and on-chain momentum.",

  openGraph: {
    title: "Jupiter Pulse ⚡",
    description:
      "Real-time market pulse for the Jupiter & Solana ecosystem.",
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
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Jupiter Pulse ⚡",
    description:
      "Live Solana market data, charts & momentum built for Jupiter.",
    images: ["/og.png"],
    creator: "@lhajsol",
  },

  metadataBase: new URL("https://jupiter-pulse-abet.vercel.app"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
