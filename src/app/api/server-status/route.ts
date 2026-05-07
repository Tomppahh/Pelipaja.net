import { getServerStatus } from '@/src/backend/services/gameServerService';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const status = await getServerStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get server status:', error);
    const maxServers = process.env.CS2_MAX_SERVERS ? parseInt(process.env.CS2_MAX_SERVERS, 10) : 10;
    return NextResponse.json({ active: 0, max: maxServers }, { status: 200 });
  }
}