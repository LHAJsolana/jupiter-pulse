import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <title>Jupiter Pulse ⚡</title>
        <meta
          name="description"
          content="Real-time observability across the Jupiter ecosystem."
        />
        <meta name="twitter:card" content="none" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <body className="min-h-screen bg-black text-white">{children}</body>
    </html>
  );
}
