import mongoose, { Schema, Document, Model } from "mongoose";
import { CS2_MAPS } from "@/src/backend/games/cs2/config/maps";
export type LobbySettings = {
  teamSize: number;
  mode: "use_current_teams" | "captain_pick" | "captain_map_veto" | "pick_map";
  mapPool?: string[];
};

export type LobbyPlayer = {
  steamId: string;
  displayName: string;
  avatarUrl?: string;
  team: "team1" | "team2" | "none";
  isCaptain: boolean;
  isReady: boolean;
};

export interface ILobby extends Document {
  matchId: mongoose.Types.ObjectId;
  leaderId: string;
  players: LobbyPlayer[];
  settings: LobbySettings;
  phase: "waiting" | "ready_check" | "captain_pick" | "map_veto" | "starting";
  coinFlipWinner?: "team1" | "team2"; 
  mapVetoState?: {
    remainingMaps: string[];
    vetoHistory: { team: "team1" | "team2"; map: string; action: "ban" | "pick" }[];
    currentTurn: "team1" | "team2";
  };
  captainPickState?: {
    currentTurn: "team1" | "team2";
    unpickedPlayers: string[]; // steamIds
  };
  createdAt: Date;
}

const LobbySchema = new Schema<ILobby>({
  matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
  leaderId: { type: String, required: true },
  players: [{
    steamId: String,
    displayName: String,
    avatarUrl: String,
    team: { type: String, enum: ["team1", "team2", "none"], default: "none" },
    isCaptain: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },
  }],
    settings: {
    teamSize: { type: Number, default: 5 },
    mode: { type: String, default: "use_current_teams" },
    mapPool: { type: [String], default: CS2_MAPS },
    },
  phase: { type: String, default: "waiting" },
  coinFlipWinner: String,
  mapVetoState: Schema.Types.Mixed,
  captainPickState: Schema.Types.Mixed,
}, { timestamps: true });

const Lobby: Model<ILobby> = mongoose.models.Lobby ?? mongoose.model<ILobby>("Lobby", LobbySchema);
export default Lobby;