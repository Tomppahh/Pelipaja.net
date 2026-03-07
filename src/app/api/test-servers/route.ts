import { createServer, isServerReady, getServerLogs } from '@/backend/services/gameServerService';
import { NextResponse } from 'next/server';

export async function POST() {
  const s1 = await createServer('de_nuke');
  const s2 = await createServer('de_mirage');
  const s3 = await createServer('de_inferno');

  console.log('\nServers starting...');
  console.log(`cs1 → connect ${s1.ip}:${s1.port} (de_nuke)`);
  console.log(`cs2 → connect ${s2.ip}:${s2.port} (de_mirage)`);
  console.log(`cs3 → connect ${s3.ip}:${s3.port} (de_inferno)`);

  // Poll until all servers ready
  const servers = [s1, s2, s3];
  const ready = new Set<string>();

  while (ready.size < servers.length) {
    for (const server of servers) {
      if (!ready.has(server.id) && isServerReady(server.id)) {
        ready.add(server.id);
        console.log(`✅ ${server.id} READY → connect ${server.ip}:${server.port}`);
      }
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  return NextResponse.json({ servers });
}