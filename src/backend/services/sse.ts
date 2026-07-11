// Persists across requests in the Node.js process — one Map per running instance.
const subscribers = new Map<string, Set<(data: string) => void>>();

type Channel = "lobby" | "match";

function channelKey(channel: Channel, matchId: string) {
  return `${channel}:${matchId}`;
}

export function broadcastLobbyUpdate(matchId: string, data: object) {
  const subs = subscribers.get(channelKey("lobby", matchId));
  if (!subs || subs.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  subs.forEach((send) => send(payload));
}

export function broadcastMatchUpdate(matchId: string, data: object) {
  const subs = subscribers.get(channelKey("match", matchId));
  if (!subs || subs.size === 0) return;

  const payload = `data: ${JSON.stringify({ __type: "matchUpdate", ...data })}\n\n`;
  subs.forEach((send) => send(payload));
}

export function registerSubscriber(
  channel: Channel,
  matchId: string,
  send: (data: string) => void
) {
  const key = channelKey(channel, matchId);
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key)!.add(send);
}

export function unregisterSubscriber(
  channel: Channel,
  matchId: string,
  send: (data: string) => void
) {
  const key = channelKey(channel, matchId);
  const subs = subscribers.get(key);
  if (!subs) return;

  subs.delete(send);
  if (subs.size === 0) subscribers.delete(key);
}
