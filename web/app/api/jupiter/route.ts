import { NextResponse } from 'next/server'
import axios from 'axios'

export async function GET() {
  const { data } = await axios.get(
    'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
  )

  return NextResponse.json({
    pair: 'SOL/USDC',
    price: data.solana.usd
  })
}
