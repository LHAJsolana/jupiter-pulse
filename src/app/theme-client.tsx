"use client";

import { useEffect, useState } from "react";

export default function ThemeClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<"solana" | "jupiter">("solana");

  useEffect(() => {
    const saved =
      (localStorage.getItem("theme") as "solana" | "jupiter") || "solana";
    setTheme(saved);
    document.body.classList.add(`${saved}-theme`);
  }, []);

  return <>{children}</>;
}
