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

  const taken = fs.readdirSync(gameDir)
    .map(name => parseInt(name.replace(/[^0-9]/g, '')))
    .filter(n => !isNaN(n));

  let i = 1;
  while (taken.includes(i)) i++;

  return {
    number: i,
    gamePort: 27015 + i - 1,
    apiPort: 27090 + i - 1,
  };
}

function frpcConfig(gameId: string, containerName: string, gamePort: number, apiPort: number) {
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

export async function createServer(gameType: string, map: string, matchId: string) {
  const { number, gamePort, apiPort } = getNextSlot(gameType);
  const gameId = `${gameType}${number}`;
  const containerName = `pelipaja-${gameId}`;
  const serverDir = path.join(INSTANCES_DIR, gameType, gameId);

  fs.mkdirSync(serverDir, { recursive: true });
  fs.cpSync(TEMPLATE_CFG_DIR, path.join(serverDir, 'cfg'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'frpc.toml'), frpcConfig(gameId, containerName, gamePort, apiPort));

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
    },
  });
  await cs2.start();

  const frpc = await docker.createContainer({
    Image: 'snowdreamtech/frpc',
    name: `frpc-${gameId}`,
    HostConfig: {
      Binds: [`${serverDir}/frpc.toml:/etc/frp/frpc.toml`],
    },
  });
  await frpc.start();

  return {
    gameId,
    connectionIp: VPS_IP,
    connectionPort: gamePort,
    apiUrl: `http://${VPS_IP}:${apiPort}`,
  };
}

export async function destroyServer(gameType: string, gameId: string) {
  const serverDir = path.join(INSTANCES_DIR, gameType, gameId);

  for (const name of [`pelipaja-${gameId}`, `frpc-${gameId}`]) {
    try {
      const container = docker.getContainer(name);
      await container.stop();
      await container.remove();
    } catch {
      // already stopped or doesn't exist, ignore
    }
  }

  if (fs.existsSync(serverDir)) {
    fs.rmSync(serverDir, { recursive: true, force: true });
  }
}