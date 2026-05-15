// Persists across requests in the Node.js process — one Map per running instance.
const subscribers = new Map<string, Set<(data: string) => void>>();

export function broadcastLobbyUpdate(matchId: string, data: object) {
  const subs = subscribers.get(matchId);
  if (!subs || subs.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  subs.forEach(send => send(payload));
}

export function registerSubscriber(matchId: string, send: (data: string) => void) {
  if (!subscribers.has(matchId)) subscribers.set(matchId, new Set());
  subscribers.get(matchId)!.add(send);
}

export function unregisterSubscriber(matchId: string, send: (data: string) => void) {
  const subs = subscribers.get(matchId);
  if (!subs) return;

  subs.delete(send);
  if (subs.size === 0) subscribers.delete(matchId);
}