"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface MatchData {
  status: string;
  connectionIp?: string;
  connectionPort?: number;
  gameConfig?: {
    map: string;
    mode: string;
  };
}

export default function MatchPage() {
  const { id } = useParams();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
  
    const fetchMatch = async () => {
      try {
        const res = await fetch(`/api/matches/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Match not found");
          return;
        }

        setMatch(data);
        return data.status;
      } catch {
        
      }
    };

    // Fetch immediately on load
    fetchMatch();

    // Poll every 3 seconds until match is live or ended
    const interval = setInterval(async () => {
      const status = await fetchMatch();
      if (status === "live" || status === "cancelled" || status === "finished") {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!match) return <p>Loading...</p>;

  if (match.status === "cancelled") {
    return <p>Match was cancelled.</p>;
  }

  if (match.status === "pending") {
    return (
      <div>
        <h1>Creating Server...</h1>
        <p>Please wait while your server is being set up.</p>
        <p>Map: {match.gameConfig?.map}</p>
        <p>Mode: {match.gameConfig?.mode}</p>
      </div>
    );
  }
if (match.status === "pending" || match.status === "configuring") {
  return (
    <div>
      <h1>Creating Server...</h1>
      <p>Please wait while your server is being set up. This usually takes about a minute.</p>
      <p>Map: {match.gameConfig?.map}</p>
    </div>
  );
}
if (match.status === "ready" || match.status === "live") {
  const connectString = `connect ${match.connectionIp}:${match.connectionPort}`;
  const steamUrl = `steam://connect/${connectString}`;
  return (
    <div>
      <h1>{"Server ready!"}</h1>
      <p>Map: {match.gameConfig?.map}</p>
      <code>{connectString}</code>
      <button onClick={() => navigator.clipboard.writeText(connectString)}>Copy</button>
      <a href={steamUrl}><button>Connect via Steam</button></a>
    </div>
  );
}

  return null;
}