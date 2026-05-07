import { getServerStatus } from '@/src/backend/services/gameServerService';
import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

function getMaxServersFromFile(): number {
  try {
    const settingsPath = join(process.cwd(), 'settings.ini');
    const content = readFileSync(settingsPath, 'utf-8');
    const match = content.match(/CS2_MAX_SERVERS\s*=\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 3;
  } catch {
    return 3;
  }
}

export async function GET() {
  try {
    const status = await getServerStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to get server status:', error);
    const maxServers = getMaxServersFromFile();
    return NextResponse.json({ active: 0, max: maxServers }, { status: 200 });
  }
}