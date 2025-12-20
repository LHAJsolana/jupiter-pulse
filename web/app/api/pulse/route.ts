import { NextResponse } from 'next/server';

function rand(min:number,max:number){return Math.floor(Math.random()*(max-min+1))+min}
const routes = ['Raydium','Orca','Meteora','Phoenix'];
const pairs = ['SOL?USDC','USDC?SOL','SOL?JUP','JUP?SOL'];

export async function GET(){
  return NextResponse.json({
    ts: Date.now(),
    route: routes[rand(0,routes.length-1)],
    pair: pairs[rand(0,pairs.length-1)],
    amount: rand(5_000,150_000),
    impact: (Math.random()*1.2).toFixed(2)
  });
}
