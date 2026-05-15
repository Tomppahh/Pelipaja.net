// Re-export model types so the rest of the lobby system imports from one place
export type {
  ILobby,
  LobbyPlayer,
  LobbySettings,
  LobbyPhase,
  LobbyMode,
  Team,
  VetoAction,
  VetoEntry,
  MapVetoState,
  CaptainPickState,
} from "@/src/models/lobby";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionUser {
  steamId: string;
  displayName?: string;
  avatarUrl?: string;
  role?: string;
}

// ─── Action handler context ───────────────────────────────────────────────────

export interface ActionContext {
  lobby: import("@/src/models/lobby").ILobby;
  user: SessionUser;
  body: Record<string, unknown>;
  matchId: string;
}

// ─── Game server ──────────────────────────────────────────────────────────────

export interface CreateServerResult {
  gameId: string;
  connectionIp: string;
  connectionPort: number;
  apiPort: number;
  apiUrl: string;
}