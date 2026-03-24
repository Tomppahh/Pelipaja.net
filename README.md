# Pelipaja.net

A community CS2 5v5 matchmaking platform developed as part of a bachelor's thesis:
**"Game platform development with focus on user experience - Design and implementation of a competitive gaming platform"**

## Overview

Pelipaja.net allows users to create and join competitive CS2 matches with automated server provisioning. The platform handles the full match lifecycle — from server creation to match completion — with no manual server management required.

## Architecture

- **Frontend/Backend**: Next.js 16 (App Router)
- **Database**: MongoDB
- **Authentication**: Steam OpenID via Auth.js
- **Game Servers**: CS2 dedicated servers running in Docker on a home server
- **Networking**: WireGuard VPN + FRP (Fast Reverse Proxy) for exposing game servers through a VPS
- **Plugin**: Custom CounterStrikeSharp plugin forked from [MatchUp](https://github.com/Juksuu/MatchUp)

## How It Works

1. User creates a match on the website selecting map and team size
2. A CS2 Docker container is automatically provisioned on the home server
3. The game server plugin communicates with the website via HTTP webhooks
4. Players connect, ready up, play knife round, and the match goes live
5. When the match ends the server is automatically destroyed

## Development Setup

### Prerequisites
- Node.js 20+
- Docker
- MongoDB

### Environment Variables
Create `.env` and fill in the required values.

### Running locally
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Running with Docker
```bash
# Build and run
docker compose up --build

# Run in background
docker compose up -d
```

## CS2 Plugin

The game server plugin is maintained in a separate repository:
[Pelipaja.net-Plugin](https://github.com/Tomppahh/Pelipaja.net-Plugin) — forked from [Juksuu/MatchUp](https://github.com/Juksuu/MatchUp)
