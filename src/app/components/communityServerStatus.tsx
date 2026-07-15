'use client';
import { useEffect, useState } from 'react';

interface Player {
  name: string;
  score: number;
  duration: number;
}

interface ServerData {
  online: boolean;
  name?: string;
  map?: string;
  players?: number;
  maxPlayers?: number;
  playerList?: Player[];
  ping?: number;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function CommunityServerStatus() {
  const [server, setServer] = useState<ServerData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/communityserver');
    es.onmessage = (e) => {
      try {
        setServer(JSON.parse(e.data));
      } catch {}
    };
    es.onerror = () => {
      es.close();
      setTimeout(() => {
        setServer({ online: false });
      }, 5000);
    };
    return () => es.close();
  }, []);

  if (!server) return null;

  return (
    <div className="w-full max-w-2xl px-4 mt-8">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${server.online ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-semibold text-[var(--foreground)]">
                {server.online ? '24/7 Community Server' : 'Community Server'}
              </span>
            </div>
            {server.online && server.name && !server.name.includes('{{') && (
              <p className="mt-1 text-sm text-[var(--muted)]">{server.name}</p>
            )}
          </div>
          {server.online && (
            <div className="text-right text-sm text-[var(--muted)]">
              <span className="font-medium text-[var(--foreground)]">{server.players}/{server.maxPlayers}</span> players
              {server.ping != null && <span className="ml-2">{server.ping}ms</span>}
            </div>
          )}
        </div>

        {!server.online && (
          <p className="mt-2 text-sm text-[var(--muted)]">Server is currently offline.</p>
        )}

        {server.online && (
          <>
            <div className="mt-2 flex items-center gap-3 text-sm text-[var(--muted)]">
              <span>Map: <span className="text-[var(--foreground)]">{server.map}</span></span>
            </div>

            {server.playerList && server.playerList.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition cursor-pointer"
                >
                  {expanded ? 'Hide players' : `Show players (${server.playerList.length})`}
                </button>

                {expanded && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                          <th className="px-3 py-1.5 font-medium">Name</th>
                          <th className="px-3 py-1.5 font-medium text-right">Score</th>
                          <th className="px-3 py-1.5 font-medium text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {server.playerList.map((p, i) => (
                          <tr key={i} className="border-b border-[var(--border)] last:border-0">
                            <td className="px-3 py-1.5 text-[var(--foreground)]">{p.name || 'Unknown'}</td>
                            <td className="px-3 py-1.5 text-right text-[var(--muted)]">{p.score}</td>
                            <td className="px-3 py-1.5 text-right text-[var(--muted)]">{formatDuration(p.duration)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {server.playerList && server.playerList.length === 0 && (
              <p className="mt-2 text-sm text-[var(--muted)]">Server is empty.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
