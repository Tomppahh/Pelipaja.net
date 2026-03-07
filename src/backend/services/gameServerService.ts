import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const VPS_IP = process.env.VPS_IP!;
const BASE_PORT = parseInt(process.env.CS2_BASE_PORT || '27015');
const MAX_SERVERS = parseInt(process.env.CS2_MAX_SERVERS || '10');
const FRP_TOKEN = process.env.FRP_TOKEN!;
const FRP_SERVER_ADDR = process.env.FRP_SERVER_ADDR!;
const CS2_RCON_PASS = process.env.CS2_RCON_PASS!;

const BASE_NAME = 'pelipaja.net-cs';
const INSTANCES_DIR = path.resolve(process.cwd(), 'src/gameservers/instances');
const TEMPLATE_CFG_DIR = path.resolve(process.cwd(), 'src/gameservers/CS2/cfg');

interface ServerInfo {
  id: string;
  name: string;
  port: number;
  map: string;
  ip: string;
}

function getActiveServerNumbers(): number[] {
  if (!fs.existsSync(INSTANCES_DIR)) return [];
  return fs.readdirSync(INSTANCES_DIR)
    .filter(name => name.startsWith('cs'))
    .map(name => parseInt(name.replace('cs', '')))
    .filter(n => !isNaN(n))
    .sort();
}

function getNextSlot(): { number: number; port: number } {
  const active = getActiveServerNumbers();
  for (let i = 1; i <= MAX_SERVERS; i++) {
    if (!active.includes(i)) {
      return { number: i, port: BASE_PORT + i - 1 };
    }
  }
  throw new Error('Max server limit reached');
}

function generateFrpcToml(gameId: string, port: number): string {
  const serverNumber = gameId.replace('cs', '');
  return `serverAddr = "${FRP_SERVER_ADDR}"
    serverPort = 7000
    auth.token = "${FRP_TOKEN}"

    [[proxies]]
    name = "cs2-${gameId}"
    type = "udp"
    localIP = "${BASE_NAME}${serverNumber}"
    localPort = 27015
    remotePort = ${port}
    `;
}

function generateDockerCompose(gameId: string, map: string): string {
  const serverNumber = gameId.replace('cs', '');
  const containerName = `${BASE_NAME}${serverNumber}`;
  return `services:
  wireguard-init:
    image: alpine
    network_mode: host
    cap_add:
      - NET_ADMIN
    volumes:
      - /etc/wireguard:/etc/wireguard
    command: sh -c "apk add --no-cache wireguard-tools && wg-quick up wg0 || true"
    restart: "no"

  ${containerName}:
    image: juksuu/cs2:matchup
    container_name: ${containerName}
    depends_on:
      - wireguard-init
    environment:
      - HOST_NAME=Pelipaja.net
      - STARTING_MAP=${map}
      - GAME_MODE=competitive
      - RCON_PASS=${CS2_RCON_PASS}
    volumes:
      - cs2_cs2-gamefiles:/root/cs2-dedicated
      - ./cfg:/root/cs2-dedicated/game/csgo/cfg

  frpc-${gameId}:
    image: snowdreamtech/frpc
    volumes:
      - ./frpc.toml:/etc/frp/frpc.toml
    depends_on:
      - ${containerName}
    restart: unless-stopped

volumes:
  cs2_cs2-gamefiles:
    external: true
`;
}

export async function createServer(map: string = 'de_mirage'): Promise<ServerInfo> {
  fs.mkdirSync(INSTANCES_DIR, { recursive: true });

  const { number, port } = getNextSlot();
  const gameId = `cs${number}`;
  const serverDir = path.join(INSTANCES_DIR, gameId);

  fs.mkdirSync(serverDir, { recursive: true });
  fs.cpSync(TEMPLATE_CFG_DIR, path.join(serverDir, 'cfg'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'frpc.toml'), generateFrpcToml(gameId, port));
  fs.writeFileSync(path.join(serverDir, 'docker-compose.yml'), generateDockerCompose(gameId, map));

  execSync('docker compose up -d', { cwd: serverDir, stdio: 'inherit' });

  return {
    id: gameId,
    name: `${BASE_NAME}${number}`,
    port,
    map,
    ip: VPS_IP,
  };
}

export async function destroyServer(gameId: string): Promise<void> {
  const serverDir = path.join(INSTANCES_DIR, gameId);

  if (!fs.existsSync(serverDir)) {
    throw new Error(`Server ${gameId} not found`);
  }

  execSync('docker compose down', { cwd: serverDir, stdio: 'inherit' });
  fs.rmSync(serverDir, { recursive: true, force: true });
}

export function listServers(): ServerInfo[] {
  const active = getActiveServerNumbers();
  return active.map(n => {
    const gameId = `cs${n}`;
    const port = BASE_PORT + n - 1;
    const composePath = path.join(INSTANCES_DIR, gameId, 'docker-compose.yml');
    let map = 'unknown';
    if (fs.existsSync(composePath)) {
      const content = fs.readFileSync(composePath, 'utf-8');
      const match = content.match(/STARTING_MAP=(.+)/);
      if (match) map = match[1].trim();
    }
    return {
      id: gameId,
      name: `${BASE_NAME}${n}`,
      port,
      map,
      ip: VPS_IP,
    };
  });
}

export function getServerLogs(gameId: string, lines: number = 50): string {
  const containerName = `${BASE_NAME}${gameId.replace('cs', '')}`;
  try {
    return execSync(`docker logs ${containerName} --tail ${lines} 2>&1`).toString();
  } catch {
    return 'Container not found';
  }
}

export function isServerReady(gameId: string): boolean {
  const logs = getServerLogs(gameId);
  return logs.includes('Executing warmup cfg');
}