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
  const isFull = status.active === status.max;
  return (
    <div>
      <span>{status.active}/{status.max} games</span>
      {isFull && (
        <div className="mt-4 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-600">All active server slots are currently in use, please wait!</p>
        </div>
      )}
    </div>
  );
}

export function CreateMatchButton() {
  const [status, setStatus] = useState<{ active: number; max: number } | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/server-status');
        if (response.ok) {
          const data = await response.json();
          setStatus(data);
        }
      } catch {
        // Silent fail
      }
    };
    
    fetchStatus();
  }, []);

  const isFull = status ? status.active === status.max : false;

  return (
    <a
      href={isFull ? '#' : '/match/new/cs2'}
      onClick={isFull ? (e) => e.preventDefault() : undefined}
      className={`inline-flex rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
        isFull
          ? 'cursor-not-allowed bg-[var(--muted)] text-[var(--foreground)] opacity-50'
          : 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:brightness-110'
      }`}
    >
      Counter-Strike 2
    </a>
  );
}