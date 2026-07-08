# Sidecamp

> The standalone desktop companion app for [TuneCamp](https://github.com/scobru/tunecamp).

Sidecamp is an **Electron desktop application** that handles all P2P content acquisition and peer file-sharing for TuneCamp instances — keeping the core server clean and fully compliant.

## Why Sidecamp?

TuneCamp's core server is a legitimate streaming platform. Features like Soulseek search, BitTorrent, and yt-dlp audio ripping carry legal grey-area risks that shouldn't live on a hosted server. Sidecamp moves all of that to your local desktop, where _you_ control what runs.

- The **server stays clean**: no P2P libraries, no download binaries, no legal exposure.
- **You keep full control**: downloads happen on your PC, then sync to your TuneCamp library.
- **Zero config networking**: Sidecamp connects _outward_ to your server via WebSocket — no port forwarding needed.

## Features

- 🔎 **Soulseek Search & Download** — Search the Soulseek network and download tracks directly to your machine.
- 🧲 **BitTorrent / WebTorrent** — Add magnet links or torrent files; download and seed from your desktop.
- 🎬 **yt-dlp Audio Ripping** — Rip audio from YouTube, SoundCloud, Bandcamp, and other platforms.
- 📁 **Peer File Sharing** — Share local music folders with any TuneCamp instance via a secure reverse WebSocket tunnel. Listeners can stream or download files relayed through the server.
- 🔒 **Granular Permissions** — Allow or restrict downloads per-folder. Toggle permissions in real-time.
- 📤 **Auto-Upload to TuneCamp** — Downloaded files are automatically uploaded and indexed into your TuneCamp library.
- 🖥️ **Desktop GUI** — A modern, responsive React-based interface running inside Electron.

## Prerequisites

- **Node.js** 18+ and **npm** 9+
- **yt-dlp** installed and available on `PATH` (for audio ripping)
- A running **TuneCamp** instance to connect to

## Quick Start

```bash
# Clone the repository
git clone https://github.com/scobru/sidecamp.git
cd sidecamp

# Install dependencies
npm install

# Run in development mode (Vite + Electron)
npm run dev
```

### Build for production

```bash
npm run build
```

This compiles TypeScript, bundles the Vite frontend, and packages the Electron app via `electron-builder`.

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
