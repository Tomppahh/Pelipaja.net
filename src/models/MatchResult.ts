import mongoose, { Schema, Document, Model } from "mongoose";
import type { PlayerMatchStats } from "@/src/lib/types/match";

export interface IMatchResult extends Document {
  matchId: mongoose.Types.ObjectId;
  map: string;
  isPublic: boolean;
  score: { ct: number; t: number };
  duration: number;
  team1: {
    name: string;
    score: number;
    players: PlayerMatchStats[];
  };
  team2: {
    name: string;
    score: number;
    players: PlayerMatchStats[];
  };
  createdAt: Date;
}

const PlayerStatsSchema = new Schema<PlayerMatchStats>(
  {
    steamId: { type: String, required: true },
    name: { type: String, required: true },
    team: { type: String, enum: ["CT", "T", "other"], required: true },
    kills: { type: Number, default: 0 },
    deaths: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    mvs: { type: Number, default: 0 },
    ping: { type: Number, default: 0 },
    headshotKills: { type: Number, default: 0 },
    utilityDamage: { type: Number, default: 0 },
    flashAssists: { type: Number, default: 0 },
    shotsFired: { type: Number, default: 0 },
    shotsOnTarget: { type: Number, default: 0 },
    totalDamage: { type: Number, default: 0 },
    entryKills: { type: Number, default: 0 },
    oneVoneCount: { type: Number, default: 0 },
    oneVoneWins: { type: Number, default: 0 },
  },
  { _id: false }
);

const MatchResultSchema = new Schema<IMatchResult>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true, index: true },
    map: { type: String, required: true },
    isPublic: { type: Boolean, default: false },
    score: {
      ct: { type: Number, default: 0 },
      t: { type: Number, default: 0 },
    },
    duration: { type: Number, default: 0 },
    team1: {
      name: { type: String, default: "Team 1" },
      score: { type: Number, default: 0 },
      players: { type: [PlayerStatsSchema], default: [] },
    },
    team2: {
      name: { type: String, default: "Team 2" },
      score: { type: Number, default: 0 },
      players: { type: [PlayerStatsSchema], default: [] },
    },
  },
  { timestamps: true }
);

MatchResultSchema.index({ createdAt: -1 });

const MatchResult: Model<IMatchResult> =
  mongoose.models.MatchResult ?? mongoose.model<IMatchResult>("MatchResult", MatchResultSchema);

export default MatchResult;
