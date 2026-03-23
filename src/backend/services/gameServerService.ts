import Docker from 'dockerode';
import { log } from "@/src/backend/lib/logger"
import { connectDB } from "@/src/backend/lib/db";
const docker = new Docker({ host: process.env.HOME_PC_WG_IP, port: 2375 });

const VPS_IP = process.env.VPS_IP!;
const FRP_TOKEN = process.env.FRP_TOKEN!;
const FRP_SERVER_ADDR = process.env.FRP_SERVER_ADDR!;
const CS2_RCON_PASS = process.env.CS2_RCON_PASS!;
const MATCHUP_API_SECRET = process.env.MATCHUP_API_SECRET!;

const activeSlots = new Set<number>();

async function restoreActiveSlots() {
  try {
    const allContainers = await docker.listContainers({ all: true });
    for (const c of allContainers) {
      const name = c.Names[0].replace('/', '');
      if ((name.startsWith('pelipaja-cs') || name.startsWith('frpc-cs')) && c.State !== 'running') {
        const container = docker.getContainer(c.Id);
        try { await container.remove({ force: true }); } catch {}
      }
    }

    const containers = await docker.listContainers({ all: false });
    const runningGameIds = new Set<string>();
    for (const c of containers) {
      const name = c.Names[0].replace('/', '');
      if (name.startsWith('pelipaja-cs')) {
        const number = parseInt(name.replace(/[^0-9]/g, ''));
        if (!isNaN(number)) {
          activeSlots.add(number);
          runningGameIds.add(name.replace('pelipaja-', ''));
          console.log(`Restored active slot: ${number}`);
        }
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
  } catch (err) {
    console.error('Failed to restore active slots:', err);
  }
}

restoreActiveSlots();

function getNextSlot(gameType: string) {
  let i = 1;
  while (activeSlots.has(i)) i++;
  return {
    number: i,
    gamePort: 27015 + i - 1,
    apiPort: 27090 + i - 1,
  };
}

async function removeContainer(name: string) {
  try {
    const c = docker.getContainer(name);
    await c.remove({ force: true });
  } catch {}
}

async function removeNetwork(name: string) {
  try {
    const n = docker.getNetwork(name);
    await n.remove();
  } catch {}
}

export async function createServer(gameType: string, map: string, matchId: string) {
  await new Promise<void>((resolve, reject) => {
    docker.pull('ghcr.io/tomppahh/pelipaja-cs2:latest', (err: any, stream: any) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (err: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
  });

  const { number, gamePort, apiPort } = getNextSlot(gameType);
  activeSlots.add(number);

  const gameId = `${gameType}${number}`;
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
    activeSlots.delete(number);
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

export async function destroyServer(gameId: string) {
  const number = parseInt(gameId.replace(/[^0-9]/g, ''));
  await removeContainer(`pelipaja-${gameId}`);
  await removeContainer(`frpc-${gameId}`);
  await removeNetwork(`net-${gameId}`);
  activeSlots.delete(number);
  log(`Server ${gameId} destroyed`);
}

export async function destroyAll() {
  const containers = await docker.listContainers({ all: true });
  for (const c of containers) {
    const name = c.Names[0].replace('/', '');
    if (name.startsWith('pelipaja-') || name.startsWith('frpc-')) {
      const container = docker.getContainer(c.Id);
      try { await container.stop(); } catch {}
      try { await container.remove({ force: true }); } catch {}
    }
  }

  const networks = await docker.listNetworks();
  for (const n of networks) {
    if (n.Name.startsWith('net-')) {
      const network = docker.getNetwork(n.Id);
      try { await network.remove(); } catch {}
    }
  }

  activeSlots.clear();
}