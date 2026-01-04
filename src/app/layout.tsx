"use client";

import { useEffect, useState } from "react";
import "./globals.css";
import Link from "next/link";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"solana" | "jupiter">("solana");

  // Load saved theme (future-ready, no UI toggle here)
  useEffect(() => {
    const saved =
      (localStorage.getItem("theme") as "solana" | "jupiter") || "solana";
    setTheme(saved);
    document.body.classList.add(`${saved}-theme`);
  }, []);

  return (
    <html lang="en">
      <body className={`${theme}-theme min-h-screen`}>

        {/* ================= GLOBAL HEADER ================= */}
        <header className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/5">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">

            {/* BRAND ONLY */}
            <Link href="/" className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white">
                ⚡ Jupiter Pulse
              </span>
              <span className="text-xs text-gray-400">
                Real-time Solana market pulse
              </span>
            </Link>

          </div>
        </header>

        {/* ================= PAGE CONTENT ================= */}
        <main>{children}</main>

      </body>
    </html>
  );
}
