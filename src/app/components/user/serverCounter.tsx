'use client';
import { useEffect, useState } from 'react';

export function ServerCounter() {
  const [status, setStatus] = useState<{ active: number; max: number } | null>(null);

  useEffect(() => {
    const fetchStatus = () =>
      fetch('/api/server-status').then(r => r.json()).then(setStatus);
    fetchStatus();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  return (
    <span>{status.active}/{status.max} games</span>
  );
}