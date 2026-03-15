import Docker from 'dockerode';

const docker = new Docker({ host: process.env.HOME_PC_WG_IP, port: 2375 });

const VPS_IP = process.env.VPS_IP!;
const FRP_TOKEN = process.env.FRP_TOKEN!;
const FRP_SERVER_ADDR = process.env.FRP_SERVER_ADDR!;
const CS2_RCON_PASS = process.env.CS2_RCON_PASS!;
const MATCHUP_API_SECRET = process.env.MATCHUP_API_SECRET!;

// In-memory slot tracking — persisted in MongoDB via GameServer model
const activeSlots = new Set<number>();

function getNextSlot() {
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
  const { number, gamePort, apiPort } = getNextSlot();
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
      Image: 'juksuu/cs2:matchup',
      name: containerName,
      Env: [
        'HOST_NAME=Pelipaja.net',
        `STARTING_MAP=${map}`,
        'GAME_MODE=competitive',
        `RCON_PASS=${CS2_RCON_PASS}`,
        'MATCHUP_API_PORT=27090',
        `MATCHUP_API_SECRET=${MATCHUP_API_SECRET}`,
        `MATCHUP_MATCH_ID=${matchId}`,
        `MATCHUP_WEBHOOK_URL=${process.env.AUTH_URL}`,
      ],
      HostConfig: {
        Binds: [
          'cs2_gamefiles:/root/cs2-dedicated',
          '/home/tommi/titeopinnot/KANDITYÖ/pelipaja.net/src/gameservers/CS2/cfg:/root/cs2-dedicated/game/csgo/cfg',
        ],
        NetworkMode: networkName,
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
    apiUrl: `http://${VPS_IP}:${apiPort}`,
  };
}

export async function destroyServer(gameType: string, gameId: string) {
  const number = parseInt(gameId.replace(/[^0-9]/g, ''));

  await removeContainer(`pelipaja-${gameId}`);
  await removeContainer(`frpc-${gameId}`);
  await removeNetwork(`net-${gameId}`);

  activeSlots.delete(number);
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