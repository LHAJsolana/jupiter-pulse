"use client";
import { useEffect, useState } from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"solana" | "jupiter">("solana");

  // Load saved theme on first render
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "solana" | "jupiter") || "solana";
    setTheme(saved);
    document.body.classList.add(saved + "-theme");
  }, []);

  // Switch theme
  const setThemeMode = (mode: "solana" | "jupiter") => {
    document.body.classList.remove(theme + "-theme");
    document.body.classList.add(mode + "-theme");
    setTheme(mode);
    localStorage.setItem("theme", mode);
  };

  return (
    <html lang="en">
      <body className={theme + "-theme"}>
        {/* ================= NAVBAR ================= */}
        <nav className="flex justify-between items-center px-6 py-4 border-b border-neutral-800">
          <h1 className="font-bold text-2xl">
            Jupiter Pulse ⚡
          </h1>

          {/* Theme Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => setThemeMode("solana")}
              className={`px-4 py-2 rounded-full font-semibold transition ${
                theme === "solana"
                  ? "bg-[#00FFA3] text-black shadow-lg"
                  : "bg-transparent text-gray-300 border border-[#00FFA3] hover:bg-[#00ffa33a]"
              }`}
            >
              Solana Mode
            </button>

            <button
              onClick={() => setThemeMode("jupiter")}
              className={`px-4 py-2 rounded-full font-semibold transition ${
                theme === "jupiter"
                  ? "bg-[#ff7a00] text-black shadow-lg"
                  : "bg-transparent text-gray-300 border border-[#ff7a00] hover:bg-[#ff7a003a]"
              }`}
            >
              Jupiter Mode
            </button>
          </div>
        </nav>

        {/* Main Content */}
        {children}
      </body>
    </html>
  );
}
