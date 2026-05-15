import mongoose, { Schema, Document, Model } from "mongoose";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";

// ─── Sub-document types ───────────────────────────────────────────────────────

export type Team = "team1" | "team2";
export type LobbyPhase = "waiting" | "ready_check" | "captain_pick" | "map_veto" | "starting";
export type LobbyMode = "use_current_teams" | "captain_pick" | "captain_map_veto" | "pick_map";
export type VetoAction = "ban" | "pick";

export type LobbyPlayer = {
  steamId: string;
  displayName: string;
  avatarUrl?: string;
  team: Team | "none";
  isCaptain: boolean;
  isReady: boolean;
};

export type LobbySettings = {
  teamSize: number;
  mode: LobbyMode;
  mapPool?: string[];
};

export type VetoEntry = {
  team: Team;
  map: string;
  action: VetoAction;
};

export type MapVetoState = {
  remainingMaps: string[];
  vetoHistory: VetoEntry[];
  currentTurn: Team;
};

export type CaptainPickState = {
  currentTurn: Team;
  unpickedPlayers: string[];
};

// ─── Document interface ───────────────────────────────────────────────────────

export interface ILobby extends Document {
  matchId: mongoose.Types.ObjectId;
  leaderId: string;
  phase: LobbyPhase;
  players: LobbyPlayer[];
  settings: LobbySettings;
  coinFlipWinner?: Team;
  mapVetoState?: MapVetoState;
  captainPickState?: CaptainPickState;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const VetoEntrySchema = new Schema<VetoEntry>(
  {
    team: { type: String, enum: ["team1", "team2"], required: true },
    map: { type: String, required: true },
    action: { type: String, enum: ["ban", "pick"], required: true },
  },
  { _id: false }
);

const MapVetoStateSchema = new Schema<MapVetoState>(
  {
    remainingMaps: { type: [String], default: [] },
    vetoHistory: { type: [VetoEntrySchema], default: [] },
    currentTurn: { type: String, enum: ["team1", "team2"], required: true },
  },
  { _id: false }
);

const CaptainPickStateSchema = new Schema<CaptainPickState>(
  {
    currentTurn: { type: String, enum: ["team1", "team2"], required: true },
    unpickedPlayers: { type: [String], default: [] },
  },
  { _id: false }
);

const PlayerSchema = new Schema<LobbyPlayer>(
  {
    steamId: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: String,
    team: { type: String, enum: ["team1", "team2", "none"], default: "none" },
    isCaptain: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const LobbySchema = new Schema<ILobby>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    leaderId: { type: String, required: true },
    phase: { type: String, enum: ["waiting", "ready_check", "captain_pick", "map_veto", "starting"], default: "waiting" },
    players: { type: [PlayerSchema], default: [] },
    settings: {
      teamSize: { type: Number, default: 5 },
      mode: { type: String, default: "use_current_teams" },
      mapPool: { type: [String], default: CS2_MAPS },
    },
    coinFlipWinner: { type: String, enum: ["team1", "team2"] },
    mapVetoState: { type: MapVetoStateSchema },
    captainPickState: { type: CaptainPickStateSchema },
  },
  { timestamps: true }
);

const Lobby: Model<ILobby> =
  mongoose.models.Lobby ?? mongoose.model<ILobby>("Lobby", LobbySchema);

export default Lobby;