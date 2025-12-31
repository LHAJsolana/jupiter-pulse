export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center text-center mt-32 gap-6">
      <h1 className="text-4xl font-bold text-[#10A2FF] tracking-wide">
        🚀 Welcome to Jupiter Pulse
      </h1>

      <p className="max-w-xl text-[#9AA0A6] text-lg">
        Real-time market pulse for the Jupiter ecosystem — live prices, charts,
        trends & analytics for Solana tokens.
      </p>

      <a
        href="/pulse"
        className="px-6 py-3 rounded-md bg-[#10A2FF] hover:bg-[#0F8CDD] transition text-black font-semibold mt-4"
      >
        Enter Dashboard →
      </a>
    </div>
  );
}
