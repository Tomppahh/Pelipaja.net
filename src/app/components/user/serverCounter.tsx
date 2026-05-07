'use client';
import { useEffect, useState } from 'react';

export function ServerCounter() {
  const [status, setStatus] = useState<{ active: number; max: number } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/server-status');
        if (!response.ok) {
          setError(true);
          return;
        }
        const data = await response.json();
        setStatus(data);
        setError(false);
      } catch (err) {
        console.error('Failed to fetch server status:', err);
        setError(true);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <span className="text-red-500">Status unavailable</span>;
  if (!status) return null;
  status.active = 3;
  return (
    <span>{status.active}/{status.max} games</span>
  );
}