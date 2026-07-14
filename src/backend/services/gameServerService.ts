import Docker from 'dockerode';
import { log } from "@/src/backend/lib/logger"
import { connectDB } from "@/src/backend/lib/db";
import { readFileSync } from 'fs';
import { join } from 'path';

let _maxServersCache: number | null = null;

export function getMaxServers(): number {
  if (_maxServersCache !== null) return _maxServersCache;
  try {
    const settingsPath = join(process.cwd(), 'settings.ini');
    const content = readFileSync(settingsPath, 'utf-8');
    const match = content.match(/CS2_MAX_SERVERS\s*=\s*(\d+)/);
    _maxServersCache = match ? parseInt(match[1], 10) : 3;
  } catch {
    _maxServersCache = 3;
  }
  return _maxServersCache;
}

const docker = new Docker({ host: process.env.HOME_PC_WG_IP, port: 2375 });

const activeGameIds = new Set<string>();

function getContainerName(c: Docker.ContainerInfo): string | null {
  return c.Names?.[0]?.replace('/', '') ?? null;
}

async function restoreActiveSlots() {
  try {
    activeGameIds.clear();

    const allContainers = await docker.listContainers({ all: true });
    const runningGameIds = new Set<string>();

    for (const c of allContainers) {
      const name = getContainerName(c);
      if (!name) continue;

      if (name.startsWith('pelipaja-cs') && c.State === 'running') {
        const gameId = name.replace('pelipaja-', '');
        activeGameIds.add(gameId);
        runningGameIds.add(gameId);
      } else if ((name.startsWith('pelipaja-cs') || name.startsWith('frpc-cs')) && c.State !== 'running') {
        const container = docker.getContainer(c.Id);
        try { await container.remove({ force: true }); } catch (err) { console.warn(`Failed to remove dead container ${name}:`, err); }
      }
    }

    await connectDB();
    const Match = (await import('@/src/models/Match')).default;
    const activeMatches = await Match.find({ status: { $in: ['configuring', 'ready', 'live'] } });
    for (const match of activeMatches) {
      if (match.gameId && !runningGameIds.has(match.gameId)) {
        console.log(`Cancelling orphaned match ${match._id} (${match.gameId} not running)`);
        match.status = 'cancelled';
        await match.save();
      }
    }
  } catch (err: unknown) {
  
    if (err && typeof err === "object" && ("code" in err && (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH'))) {
      console.warn('Docker host unreachable on startup — skipping slot restore. Check WireGuard tunnel.');
    } else {
      console.error('Failed to restore active slots:', err);
    }
  }
}

restoreActiveSlots();

function getNextSlot(gameType: string) {
  let i = 1;
  while (activeGameIds.has(`${gameType}${i}`)) i++;

  return {
    number: i,
    gamePort: 27015 + i - 1,
    apiPort: 27090 + i - 1,
  };
}

async function syncActiveGameIdsFromDocker() {
  const containers = await docker.listContainers({ all: true });
  const networks = await docker.listNetworks();
  activeGameIds.clear();

  const runningGameIds = new Set<string>();
  const runningNetworkNames = new Set<string>();

  for (const c of containers) {
    const name = getContainerName(c);
    if (!name) continue; // ✅ guard

    if (name.startsWith('pelipaja-cs') && c.State === 'running') {
      const gameId = name.replace('pelipaja-', '');
      activeGameIds.add(gameId);
      runningGameIds.add(gameId);
      runningNetworkNames.add(`net-${gameId}`);
      continue;
    }

    if ((name.startsWith('pelipaja-cs') || name.startsWith('frpc-cs')) && c.State !== 'running') {
      const container = docker.getContainer(c.Id);
      try { await container.remove({ force: true }); } catch (err) { console.warn(`Failed to remove dead container ${name}:`, err); }
    }
  }

  for (const n of networks) {
    if (!n.Name.startsWith('net-cs')) continue;

    if (runningNetworkNames.has(n.Name)) {
      continue;
    }

    const network = docker.getNetwork(n.Id);
    try { await network.remove(); } catch (err) { console.warn(`Failed to remove orphaned network ${n.Name}:`, err); }
  }
}

async function removeContainer(name: string) {
  try {
    const c = docker.getContainer(name);
    await c.remove({ force: true });
  } catch (err) { console.warn(`Failed to remove container ${name}:`, err); }
}

async function removeNetwork(name: string) {
  try {
    const n = docker.getNetwork(name);
    await n.remove();
  } catch (err) { console.warn(`Failed to remove network ${name}:`, err); }
}

export async function createServer(gameType: string, map: string, matchId: string) {
  const VPS_IP = process.env.VPS_IP!;
  const FRP_TOKEN = process.env.FRP_TOKEN!;
  const FRP_SERVER_ADDR = process.env.FRP_SERVER_ADDR!;
  const CS2_RCON_PASS = process.env.CS2_RCON_PASS!;
  const MATCHUP_API_SECRET = process.env.MATCHUP_API_SECRET!;

  try {
    await syncActiveGameIdsFromDocker();
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH')) {
      throw new Error('Cannot reach Docker host. Check that the WireGuard tunnel to your home PC is up.');
    }
    throw err;
  }

  if (activeGameIds.size >= getMaxServers()) {
    throw new Error('Maximum number of servers reached');
  }

  // Clean all workshop maps before starting a new server
  await cleanupAllWorkshopMaps();

  await new Promise<void>((resolve, reject) => {
    docker.pull('ghcr.io/tomppahh/pelipaja-cs2:latest', (err: Error | null, stream: NodeJS.ReadableStream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  const { number, gamePort, apiPort } = getNextSlot(gameType);
  const gameId = `${gameType}${number}`;
  activeGameIds.add(gameId);

  const containerName = `pelipaja-${gameId}`;
  const frpcName = `frpc-${gameId}`;
  const networkName = `net-${gameId}`;

  await removeContainer(containerName);
  await removeContainer(frpcName);
  await removeNetwork(networkName);

  const network = await docker.createNetwork({ Name: networkName });

  try {
    const cs2 = await docker.createContainer({
      Image: 'ghcr.io/tomppahh/pelipaja-cs2:latest',
      name: containerName,
      ExposedPorts: {
        '27090/tcp': {},
      },
      Env: [
        'HOST_NAME=Pelipaja.net',
        `STARTING_MAP=${map}`,
        'GAME_MODE=competitive',
        `RCON_PASS=${CS2_RCON_PASS}`,
        `MATCHUP_API_PORT=${apiPort}`,
        `MATCHUP_API_SECRET=${MATCHUP_API_SECRET}`,
        `MATCHUP_MATCH_ID=${matchId}`,
        `MATCHUP_WEBHOOK_URL=http://10.0.0.1:3000`,
      ],
      HostConfig: {
        Binds: ['cs2_gamefiles:/root/cs2-dedicated'],
        NetworkMode: networkName,
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings: {
          [`${apiPort}/tcp`]: [{ HostPort: `${apiPort}` }],
        },
      },
    });
    await cs2.start();

    const frpc = await docker.createContainer({
      Image: 'ghcr.io/tomppahh/pelipaja-frpc:latest',
      name: frpcName,
      Env: [
        `FRP_SERVER_ADDR=${FRP_SERVER_ADDR}`,
        `FRP_TOKEN=${FRP_TOKEN}`,
        `GAME_ID=${gameId}`,
        `CONTAINER_NAME=${containerName}`,
        `GAME_PORT=${gamePort}`,
        `API_PORT=${apiPort}`,
      ],
      HostConfig: {
        NetworkMode: networkName,
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });
    await frpc.start();

  } catch (err) {
    console.error(`Failed to start server ${gameId}:`, err);
    await removeContainer(containerName);
    await removeContainer(frpcName);
    await network.remove();
    activeGameIds.delete(gameId);
    throw err;
  }

  return {
    gameId,
    connectionIp: VPS_IP,
    connectionPort: gamePort,
    apiPort,
    apiUrl: `http://${VPS_IP}:${apiPort}`,
  };
}

export async function getServerStatus() {
  try {
    await syncActiveGameIdsFromDocker();
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err.code === 'ECONNREFUSED' || err.code === 'EHOSTUNREACH')) {
      return { active: 0, max: getMaxServers(), error: 'Docker host unreachable' };
    }
    throw err;
  }
  return {
    active: activeGameIds.size,
    max: getMaxServers(),
  };
}

export async function destroyServer(gameId: string, workshopIds?: string[]) {
  await removeContainer(`pelipaja-${gameId}`);
  await removeContainer(`frpc-${gameId}`);
  await removeNetwork(`net-${gameId}`);
  activeGameIds.delete(gameId);

  if (workshopIds && workshopIds.length > 0) {
    await cleanupWorkshopMaps(workshopIds);
  }

  log(`Server ${gameId} destroyed`);
}

async function cleanupWorkshopMaps(workshopIds: string[]) {
  const rmPaths = workshopIds
    .filter(id => /^\d{5,20}$/.test(id))
    .map(id => `/data/steamapps/workshop/content/730/${id}`)
    .join(" ");

  if (!rmPaths) return;

  try {
    const cleanup = await docker.createContainer({
      Image: "alpine:latest",
      Cmd: ["sh", "-c", `rm -rf ${rmPaths}`],
      HostConfig: {
        Binds: ["cs2_gamefiles:/data"],
        AutoRemove: true,
      },
    });
    await cleanup.start();
    await cleanup.wait();
    log(`Cleaned up workshop maps: ${workshopIds.join(", ")}`);
  } catch (err) {
    console.error("[Pelipaja] Workshop cleanup failed:", err);
  }
}

async function cleanupAllWorkshopMaps() {
  try {
    const cleanup = await docker.createContainer({
      Image: "alpine:latest",
      Cmd: ["sh", "-c", "rm -rf /data/steamapps/workshop/content/730/*"],
      HostConfig: {
        Binds: ["cs2_gamefiles:/data"],
        AutoRemove: true,
      },
    });
    await cleanup.start();
    await cleanup.wait();
    log("Cleaned up all orphaned workshop maps");
  } catch (err) {
    console.error("[Pelipaja] Workshop cleanup failed:", err);
  }
}

export async function destroyAll() {
  const containers = await docker.listContainers({ all: true });
  for (const c of containers) {
    const name = getContainerName(c);
    if (!name) continue; // ✅ guard

    if (name.startsWith('pelipaja-') || name.startsWith('frpc-')) {
      const container = docker.getContainer(c.Id);
      try { await container.stop(); } catch (err) { console.warn(`Failed to stop container ${name}:`, err); }
      try { await container.remove({ force: true }); } catch (err) { console.warn(`Failed to remove container ${name}:`, err); }
    }
  }

  const networks = await docker.listNetworks();
  for (const n of networks) {
    if (n.Name.startsWith('net-')) {
      const network = docker.getNetwork(n.Id);
      try { await network.remove(); } catch (err) { console.warn(`Failed to remove network ${n.Name}:`, err); }
    }
  }

  activeGameIds.clear();
}