'use client'
import { useEffect, useState } from 'react';

export function usePulse(interval=2000){
  const [data,setData]=useState<any>(null);
  useEffect(()=>{
    const t=setInterval(async()=>{
      const r=await fetch('/api/pulse');
      setData(await r.json());
    },interval);
    return ()=>clearInterval(t);
  },[interval]);
  return data;
}
