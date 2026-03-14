import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "user" | "beta" | "leader" | "admin" 

export interface IUser extends Document {
    steamId?: string;
    displayName?: string;
    avatarUrl?: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}


const UserSchema = new Schema <IUser>(
    {
        steamId: { type: String, sparse: true, unique: true},
        displayName: { type: String },
        avatarUrl: { type: String},
        role: { type: String, enum: ["user", "beta", "leader", "admin"], default: "user" },
    },
    { timestamps: true}
);

UserSchema.index({ steamId: 1});

const User: Model<IUser> =  
    mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);

export default User;