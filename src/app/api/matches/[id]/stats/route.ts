import { NextRequest, NextResponse } from "next/server";
import Match from "@/src/models/Match";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const match = await Match.findById(id);

	if (!match) {
		return NextResponse.json({ error: "Match not found" }, { status: 404 });
	}

	return NextResponse.json({
		id: match._id,
		status: match.status,
		gameType: match.gameType,
		playersPerTeam: match.playersPerTeam,
		createdAt: match.createdAt,
		updatedAt: match.updatedAt,
	});
}
