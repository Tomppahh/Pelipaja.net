"use client";

import { useEffect, useState } from "react";

interface Match {
  _id: string;
  status: string;
  gameConfig: { map: string; mode: string };
  connectionIp: string;
  connectionPort: number;
  createdAt: string;
}

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchMatches() {
    const res = await fetch("/api/admin/servers");
    const data = await res.json();
    setMatches(data);
    setLoading(false);
  }

  async function stopServer(matchId: string) {
    await fetch(`/api/admin/servers/${matchId}`, { method: "DELETE" });
    fetchMatches();
  }

  useEffect(() => { fetchMatches(); }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Admin Panel</h1>
      <h2>Active Servers</h2>
      {matches.length === 0 && <p>No active servers</p>}
      {matches.map(match => (
        <div key={match._id}>
          <p>{match.gameConfig.map} — {match.connectionIp}:{match.connectionPort} — {match.status}</p>
          <button onClick={() => stopServer(match._id)}>Stop</button>
        </div>
      ))}
      <button onClick={fetchMatches}>Refresh</button>
    </div>
  );
}