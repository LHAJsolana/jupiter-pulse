import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Jupiter Pulse ⚡",
  description:
    "Real-time market pulse for the Jupiter ecosystem. Live prices, charts, and momentum across Solana markets.",

  openGraph: {
    title: "Jupiter Pulse ⚡",
    description:
      "Real-time market pulse for the Jupiter ecosystem. Live prices, charts, and momentum across Solana markets.",
    url: "https://jupiter-pulse-abet.vercel.app",
    siteName: "Jupiter Pulse",
    images: [
      {
        url: "https://jupiter-pulse-abet.vercel.app/og.png",
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
      "Real-time market pulse for the Jupiter ecosystem. Live prices, charts, and momentum across Solana markets.",
    images: ["https://jupiter-pulse-abet.vercel.app/og.png"],
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
      <body className="min-h-screen bg-black text-white">{children}</body>
    </html>
  );
}
