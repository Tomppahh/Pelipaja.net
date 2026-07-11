# Pelipaja.net

A community CS2 5v5 matchmaking platform developed as part of a bachelor's thesis:
**"Game platform development with focus on user experience - Design and implementation of a competitive gaming platform"**

## Features

- **Match Creation** — Create 5v5 matches with custom settings (map, team size, knife round)
- **Lobby System** — Real-time lobbies with team assignment, captain pick, and map veto
- **Workshop Maps** — Steam Workshop map support with automatic download and cleanup
- **Automated Servers** — CS2 Docker containers provisioned and destroyed automatically
- **Live Match Stats** — Real-time score, player stats, and round tracking via SSE
- **Match History** — Public match results with detailed player statistics
- **Private Lobbies** — Password-protected lobbies with public/private visibility
- **Admin Panel** — Server management, live match monitoring, and test server creation
- **Steam Authentication** — Login via Steam OpenID
- (UPCOMING FEATURE) **Demo Upload** — Automatic GOTV demo recording and upload to Azure Blob Storage

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Next.js   │────▶│   MongoDB    │     │  CS2 Game Server    │
│   (VPS)     │     │   (VPS)      │     │  (Home PC/Docker)   │
│             │◀────│              │     │                     │
│  Frontend   │     └──────────────┘     │  CounterStrikeSharp │
│  API Routes │                          │  Plugin (HTTP)      │
│  SSE Events │◀───── WireGuard VPN ─────│                     │
└─────────────┘                          └─────────────────────┘
```

- **Frontend/Backend**: Next.js 16 (App Router) with React 19
- **Database**: MongoDB with Mongoose
- **Authentication**: Steam OpenID via Auth.js
- **Real-time**: Server-Sent Events (SSE) for lobby and match updates
- **Game Servers**: CS2 dedicated servers in Docker containers
- **Networking**: WireGuard VPN + FRP (Fast Reverse Proxy) exposing game servers through VPS
- **Plugin**: CounterStrikeSharp plugin ([Pelipaja.net-Plugin](https://github.com/Tomppahh/Pelipaja.net-Plugin)) forked from [MatchUp](https://github.com/Juksuu/MatchUp)

## How It Works

1. User creates a lobby on the website, selecting map (including workshop maps) and team size
2. Other players join the lobby, teams are assigned (manual, captain pick, or map veto)
3. When all players are ready, a CS2 Docker container is automatically provisioned on the game server
4. The plugin receives match config via HTTP, loads the map, and players connect
5. Players ready up in-game, play knife round (if enabled), then the match goes live
6. Real-time stats are streamed to the website via SSE
7. When the match ends, stats are saved, the server is destroyed, and workshop maps are cleaned up

## Development Setup

### Prerequisites
- Node.js 20+
- npm
- MongoDB (local or Atlas)
- Docker (for game server testing, optional)

### 1. Clone and install
```bash
git clone https://github.com/Tomppahh/Pelipaja.net.git
cd Pelipaja.net
npm install
```

### 2. Set up environment variables
Create a `.env` file in the project root:
```env
# MongoDB connection string
MONGODB_URI=mongodb://localhost:27017/pelipaja

# Steam API key (for OpenID auth)
STEAM_API_KEY=your_steam_api_key

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Game server connection (for local Docker testing)
HOME_PC_WG_IP=10.0.0.2

# Plugin auth secret (must match game server config)
MATCHUP_API_SECRET=your_api_secret
```

### 3. Run the dev server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Game server (optional)
The game server runs on a separate machine via Docker. For local testing:
```bash
# Build the plugin Docker image
cd ../Pelipaja.net-Plugin
dotnet build MatchUp.csproj -c Release
docker build -t ghcr.io/tomppahh/pelipaja-cs2:latest .
```

The site pulls `ghcr.io/tomppahh/pelipaja-cs2:latest` when creating match servers.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/                # API routes
│   │   ├── admin/          # Admin panel endpoints
│   │   ├── auth/           # Steam OpenID auth
│   │   ├── matches/        # Match CRUD, lobby, stats, SSE
│   │   └── user/           # User profile
│   ├── components/         # React UI components
│   ├── match/              # Match lobby pages
│   ├── matches/            # Match history and detail pages
│   └── lobbies/            # Public lobby browser
├── backend/
│   ├── lobby/              # Lobby state machine (actions, phases)
│   ├── services/           # Game server management, SSE, Steam
│   └── lib/                # Database, session, utils
├── models/                 # MongoDB schemas (Match, Lobby, MatchResult)
└── lib/                    # Shared types, config
```

## CS2 Plugin

The game server plugin is maintained in a separate repository:
[Pelipaja.net-Plugin](https://github.com/Tomppahh/Pelipaja.net-Plugin) — forked from [Juksuu/MatchUp](https://github.com/Juksuu/MatchUp)

### Plugin features
- Match state machine (Loading → ReadyUp → Knife → Live → Finished)
- HTTP server for receiving config from the website
- Webhook status updates back to the website
- Workshop map loading via `host_workshop_map`
- GOTV demo recording and upload
- Bot management commands

### Building the plugin
```bash
cd ../Pelipaja.net-Plugin
dotnet build MatchUp.csproj -c Release
```

The built DLL is at `bin/Release/net10.0/MatchUp.dll`.
