'use client'
import { usePulse } from './hooks/usePulse';

export default function Home(){
  const pulse = usePulse(2000);
  return (
    <main style={{padding:24}}>
      <h1>Jupiter Pulse</h1>
      {pulse && (
        <pre>{JSON.stringify(pulse,null,2)}</pre>
      )}
    </main>
  );
}
