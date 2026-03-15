import { createServer, destroyAll } from '@/src/backend/services/gameServerService';
import { NextResponse } from 'next/server';

export async function POST() {
  console.log("Starting test servers...");

  try {
    const s1 = await createServer('cs2', 'de_nuke', 'test-1');
    console.log(`cs1 started → ${s1.connectionIp}:${s1.connectionPort}`);

    const s2 = await createServer('cs2', 'de_dust2', 'test-2');
    console.log(`cs2 started → ${s2.connectionIp}:${s2.connectionPort}`);

    const s3 = await createServer('cs2', 'de_inferno', 'test-3');
    console.log(`cs3 started → ${s3.connectionIp}:${s3.connectionPort}`);



    return NextResponse.json({ servers: [s1, s2, s3] });

  } catch (err) {
    console.error("Test failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE() {
  console.log("Destroying all servers...");

  try {
    await destroyAll();
    return NextResponse.json({ message: 'All servers destroyed' });
  } catch (err) {
    console.error("Destroy failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}