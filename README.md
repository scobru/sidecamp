# Sidecamp

> The standalone desktop companion app for [TuneCamp](https://github.com/scobru/tunecamp).

Sidecamp is an **Electron desktop application** that handles all P2P content acquisition and peer file-sharing for TuneCamp instances — keeping the core server clean and fully compliant.

## Why Sidecamp?

TuneCamp's core server is a legitimate streaming platform. Features like Soulseek search, BitTorrent, and yt-dlp audio ripping carry legal grey-area risks that shouldn't live on a hosted server. Sidecamp moves all of that to your local desktop, where _you_ control what runs.

- The **server stays clean**: no P2P libraries, no download binaries, no legal exposure.
- **You keep full control**: downloads happen on your PC, then sync to your TuneCamp library.
- **Zero config networking**: Sidecamp connects _outward_ to your server via WebSocket — no port forwarding needed.

## Features

- 🔎 **Unified Search** — Search Soulseek, SoundCloud, Bandcamp, torrents, and the TuneCamp peer network from one bar — all sources at once ("All Platforms") or one at a time.
- 🧲 **BitTorrent / WebTorrent** — Add magnet links or torrent files; download and seed from your desktop with live progress.
- 🎬 **yt-dlp Audio Ripping** — Rip audio from YouTube, SoundCloud, Bandcamp, and other platforms.
- 🌐 **Network Explorer** — Browse and download tracks shared by TuneCamp peers and the server catalog. Peer tracks also surface in the unified search and download through the server tunnel.
- 🎵 **Local Library** — Browse your downloaded files with an in-app audio player; edit ID3 tags (title/artist/album) and rename files.
- 📂 **Shared Files Browser** — Navigate your Downloads and shared folders, create subfolders, and move or delete files/folders — the single place to organize what you keep and share.
- 💬 **Peer Chat** — Send direct messages to other peers by username over the peer WebSocket, Soulseek-style.
- 📁 **Peer File Sharing** — Share local music folders with any TuneCamp instance via a secure reverse WebSocket tunnel. Listeners can stream or download files relayed through the server.
- 🔒 **Granular Permissions** — Allow or restrict downloads per-folder. Toggle permissions in real-time.
- 📤 **Upload to TuneCamp** — Push tracks from your local library to your TuneCamp account with custom metadata.
- 🖥️ **Desktop GUI** — A modern, responsive React-based interface running inside Electron, with light/dark themes and a collapsible sidebar.

## Prerequisites

- **Node.js** 18+ and **Yarn** or **npm**
- **yt-dlp** installed and available on `PATH` (for audio ripping)
- A running **TuneCamp** instance to connect to

## Quick Start

```bash
# Clone the repository
git clone https://github.com/scobru/sidecamp.git
cd sidecamp

# Install dependencies
yarn install  # or: npm install

# Run in development mode (Vite + Electron)
yarn dev      # or: npm run dev
```

### Running Tests

We use **Vitest** and **React Testing Library** for unit and hook testing:

```bash
# Run tests in watch mode
yarn test          # or: npm run test

# Run tests once (single run)
yarn test:run      # or: npm run test:run
```

### Build for production

```bash
# Build for the current host OS
yarn build         # or: npm run build
```

This compiles TypeScript, bundles the Vite frontend, and packages the Electron app via `electron-builder`.

`yarn build` only produces an installer for **the OS you run it on** (electron-builder + native modules build for the host). Per-platform scripts:

```bash
yarn build:win     # NSIS installer (.exe)
yarn build:mac     # DMG (.dmg) + ZIP (.zip)  — macOS host only
yarn build:linux   # AppImage (.AppImage) + Debian (.deb)
```

> **You can't build the macOS installer on Windows or Linux** — it requires Apple tooling. To produce all three at once, use CI.

### Cross-platform releases (CI)

`.github/workflows/release.yml` builds on Windows, macOS, and Linux runners in parallel. Push a version tag to publish a GitHub Release with every installer attached:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

Or trigger the workflow manually (`workflow_dispatch`) to just build and upload the artifacts. CI builds are unsigned (no signing certificates configured).

## Connecting to TuneCamp

1. Open Sidecamp and go to **Settings**.
2. Enter your TuneCamp instance URL (e.g. `https://your-server.com`).
3. Paste your JWT authentication token (obtainable from TuneCamp's admin panel or API).
4. Select the local directories you want to share.
5. Click **Connect** — Sidecamp establishes a reverse WebSocket tunnel to the server.

## Architecture

```
┌─────────────┐         WebSocket          ┌──────────────────┐
│  Sidecamp   │ ──── outbound tunnel ────▶ │  TuneCamp Server │
│  (Desktop)  │                            │  (Cloud/VPS)     │
│             │  ◀── stream/download ────  │                  │
│  Soulseek   │       requests relayed     │  Listeners       │
│  Torrent    │                            │                  │
│  yt-dlp     │                            │                  │
│  File Share │                            │                  │
└─────────────┘                            └──────────────────┘
```

- **Providers** (`electron/providers/`): Soulseek, Torrent, yt-dlp, and network modules.
- **Uploader** (`electron/uploader/`): Handles auto-uploading downloaded files to TuneCamp.
- **Peer** (`electron/peer/`): WebSocket-based reverse tunnel for peer file sharing.
- **Frontend** (`src/`): React + Vite UI rendered inside the Electron window.

## Ecosystem

Sidecamp is part of the [TuneCamp ecosystem](https://github.com/scobru/tunecamp#tunecamp-ecosystem):

- [**tunecamp**](https://github.com/scobru/tunecamp) — The core self-hosted music streaming server.
- [**tunecamp-website**](https://github.com/scobru/tunecamp-website) — Landing page and community directory.
- [**tunecamp-peer**](https://github.com/scobru/tunecamp-peer) — Lightweight CLI-only peer daemon (headless alternative to Sidecamp's peer feature).

## License

MIT License — see [LICENSE](LICENSE) for details.
