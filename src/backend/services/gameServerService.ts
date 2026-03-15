import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';

const docker = new Docker({ host: process.env.HOME_PC_WG_IP, port: 2375 });

const VPS_IP = process.env.VPS_IP!;
const FRP_TOKEN = process.env.FRP_TOKEN!;
const FRP_SERVER_ADDR = process.env.FRP_SERVER_ADDR!;
const CS2_RCON_PASS = process.env.CS2_RCON_PASS!;
const MATCHUP_API_SECRET = process.env.MATCHUP_API_SECRET!;

const INSTANCES_DIR = path.resolve(process.cwd(), 'src/gameservers/instances');
const TEMPLATE_CFG_DIR = path.resolve(process.cwd(), 'src/gameservers/CS2/cfg');

function getNextSlot(gameType: string) {
  const gameDir = path.join(INSTANCES_DIR, gameType);
  fs.mkdirSync(gameDir, { recursive: true });

  const slotPattern = new RegExp(`^${gameType}(\\d+)$`);
  const taken = fs.readdirSync(gameDir)
    .map(name => {
      const match = name.match(slotPattern);
      return match ? parseInt(match[1], 10) : NaN;
    })
    .filter(n => !isNaN(n));

  let i = 1;
  while (taken.includes(i)) i++;

  // Reserve slot immediately so concurrent calls don't get the same slot
  const slotDir = path.join(gameDir, `${gameType}${i}`);
  fs.mkdirSync(slotDir, { recursive: true });

  return {
    number: i,
    gamePort: 27015 + i - 1,
    apiPort: 27090 + i - 1,
  };
}

function buildFrpcConfig(gameId: string, containerName: string, gamePort: number, apiPort: number) {
  return `
serverAddr = "${FRP_SERVER_ADDR}"
serverPort = 7000
auth.token = "${FRP_TOKEN}"

[[proxies]]
name = "${gameId}-game"
type = "udp"
localIP = "${containerName}"
localPort = 27015
remotePort = ${gamePort}

[[proxies]]
name = "${gameId}-api"
type = "tcp"
localIP = "${containerName}"
localPort = 27090
remotePort = ${apiPort}
  `;
}

async function removeContainer(name: string) {
  try {
    const c = docker.getContainer(name);
    await c.remove({ force: true });
  } catch {
    // container doesn't exist, that's fine
  }
}

async function removeNetwork(name: string) {
  try {
    const n = docker.getNetwork(name);
    await n.remove();
  } catch {
    // network doesn't exist, that's fine
  }
}

export async function createServer(gameType: string, map: string, matchId: string) {
  const { number, gamePort, apiPort } = getNextSlot(gameType);
  const gameId = `${gameType}${number}`;
  const containerName = `pelipaja-${gameId}`;
  const frpcName = `frpc-${gameId}`;
  const networkName = `net-${gameId}`;
  const serverDir = path.join(INSTANCES_DIR, gameType, gameId);

  // Copy cfg files and write frpc config into the slot folder
  fs.cpSync(TEMPLATE_CFG_DIR, path.join(serverDir, 'cfg'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'frpc.toml'), buildFrpcConfig(gameId, containerName, gamePort, apiPort));

  // Clean up any leftover containers from previous runs
  await removeContainer(containerName);
  await removeContainer(frpcName);
  await removeNetwork(networkName);

  // Create shared network so frpc can resolve CS2 container by name
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
          `${serverDir}/cfg:/root/cs2-dedicated/game/csgo/cfg`,
        ],
        NetworkMode: networkName,
      },
    });
    await cs2.start();

    const frpc = await docker.createContainer({
      Image: 'snowdreamtech/frpc',
      name: frpcName,
      HostConfig: {
        Binds: [`${serverDir}/frpc.toml:/etc/frp/frpc.toml`],
        NetworkMode: networkName,
      },
    });
    await frpc.start();

  } catch (err) {
    console.error(`Failed to start server ${gameId}:`, err);
    await removeContainer(containerName);
    await removeContainer(frpcName);
    await network.remove();
    fs.rmSync(serverDir, { recursive: true, force: true });
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
  const serverDir = path.join(INSTANCES_DIR, gameType, gameId);

  await removeContainer(`pelipaja-${gameId}`);
  await removeContainer(`frpc-${gameId}`);
  await removeNetwork(`net-${gameId}`);

  if (fs.existsSync(serverDir)) {
    fs.rmSync(serverDir, { recursive: true, force: true });
  }
}

export async function destroyAll() {
  // Stop and remove all pelipaja game server containers
  const containers = await docker.listContainers({ all: true });
  for (const c of containers) {
    const name = c.Names[0].replace('/', '');
    if (name.startsWith('pelipaja-') || name.startsWith('frpc-')) {
      console.log(`Removing container: ${name}`);
      const container = docker.getContainer(c.Id);
      try { await container.stop(); } catch {}
      try { await container.remove({ force: true }); } catch {}
    }
  }

  // Remove all net-* networks created for game servers
  const networks = await docker.listNetworks();
  for (const n of networks) {
    if (n.Name.startsWith('net-')) {
      console.log(`Removing network: ${n.Name}`);
      const network = docker.getNetwork(n.Id);
      try { await network.remove(); } catch {}
    }
  }

  // Clean up all instance folders
  if (fs.existsSync(INSTANCES_DIR)) {
    fs.rmSync(INSTANCES_DIR, { recursive: true, force: true });
  }
}