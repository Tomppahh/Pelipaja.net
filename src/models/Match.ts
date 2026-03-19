import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { GameType } from "@/src/lib/types/games";

export type MatchStatus =
  | "pending"
  | "configuring"
  | "live"
  | "finished"
  | "cancelled";

export interface IMatch extends Document {
  gameType: GameType;
  gameId?: string;
  apiPort?: number;
  gameConfig: Record<string, unknown>;
  playersPerTeam: number;
  status: MatchStatus;
  winner?: Types.ObjectId;
  server?: Types.ObjectId;
  connectionIp?: string;
  connectionPort?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    gameType: {
      type: String,
      enum: ["cs2", "dota2"],
      required: true,
    },
    gameId: { 
      type: String,
    },
    apiPort: {
      type: Number
    },
    gameConfig: {
      type: Schema.Types.Mixed,
      required: true,
    },
    playersPerTeam: {
      type: Number,
      default: 5,
    },
    status: {
      type: String,
      enum: ["pending", "configuring", "live", "finished", "cancelled"],
      default: "pending",
    },
    winner: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      default: null,
    },
    server: {
      type: Schema.Types.ObjectId,
      ref: "GameServer",
      default: null,
    },
    connectionIp: { type: String },
    connectionPort: { type: Number },
  },
  { timestamps: true }
);

const Match: Model<IMatch> =
  mongoose.models.Match ?? mongoose.model<IMatch>("Match", MatchSchema);

export default Match;