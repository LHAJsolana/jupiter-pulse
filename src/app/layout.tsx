import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Basic SEO only */}
        <title>Jupiter Pulse ⚡</title>
        <meta
          name="description"
          content="Real-time momentum across Solana markets."
        />

        {/* Explicitly disable Twitter cards */}
        <meta name="twitter:card" content="none" />
      </head>

      <body className="min-h-screen bg-white text-black">
        {children}
      </body>
    </html>
  );
}
