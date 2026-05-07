import { NextRequest, NextResponse } from "next/server";
import Match from "@/src/models/Match";
import { destroyServer } from "@/src/backend/services/gameServerService";
import { connectDB } from "@/src/backend/lib/db";
const VALID_STATUSES = ["pending", "configuring", "ready", "live", "finished", "cancelled"];

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
    ){
    await connectDB();
    const { id } = await params;
    const { status } = await req.json();

    const auth = req.headers.get('Authorization') ?? '';
    const secret = auth.replace('Bearer ', '');
    if (secret !== process.env.MATCHUP_API_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    const match = await Match.findByIdAndUpdate(id, { status }, { new: true });

    if (!match) {
        return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
try {
    if (status === 'configuring') {
        await fetch(`http://${process.env.HOME_PC_WG_IP}:${match.apiPort}/config`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.MATCHUP_API_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: 'pelipaja',
                matchId: match._id.toString(),
                ownerSteamID: (match.gameConfig as any).ownerSteamID,
                map: (match.gameConfig as any).map,
                teamSize: match.playersPerTeam,
                team1: { name: 'Team 1', players: [] }, // Tomppahh steamid for testing: '76561197970226616'
                team2: { name: 'Team 2', players: [] }
            })
        });
    }

    if (status === 'finished' || status === 'cancelled') {
        if (match.gameId) {
            await destroyServer(match.gameId);
        }
    }
    } catch (err) {
        console.error(`Failed to handle status ${status} for match ${id}:`, err);
    }   
    

    return NextResponse.json({ ok: true });
}