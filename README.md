# Sidecamp

> The standalone desktop companion app for [TuneCamp](https://github.com/scobru/tunecamp).

Sidecamp is an **Electron desktop application** that handles all P2P content acquisition and peer file-sharing for TuneCamp instances — keeping the core server clean and fully compliant.

This repository is an **npm-workspaces monorepo** hosting Sidecamp and its companion CLI:

```
apps/sidecamp        # the TuneCamp companion app (this README's main subject)
apps/sidecamp-cli    # headless CLI client for Sidecamp (no Electron): search/download/upload/peer daemon
```

## Why Sidecamp?

TuneCamp's core server is a legitimate streaming platform. Features like Soulseek search, BitTorrent, and yt-dlp audio ripping carry legal grey-area risks that shouldn't live on a hosted server. Sidecamp moves all of that to your local desktop, where _you_ control what runs.

- The **server stays clean**: no P2P libraries, no download binaries, no legal exposure.
- **You keep full control**: downloads happen on your PC, then sync to your TuneCamp library.
- **Zero config networking**: Sidecamp connects _outward_ to your server via WebSocket — no port forwarding needed.

## Features

- 🔎 **Unified Search** — Search Soulseek, SoundCloud, Bandcamp, torrents, the Internet Archive (archive.org), and the TuneCamp peer network from one bar — all sources at once ("All Platforms") or one at a time.
- 🏛️ **Internet Archive** — Search and download free/public-domain audio from archive.org (ingestion moved here from the TuneCamp server).
- 🧲 **BitTorrent / WebTorrent** — Add magnet links or torrent files; download and seed from your desktop with live progress.
- 🎬 **yt-dlp Audio Ripping** — Rip audio from YouTube, SoundCloud, Bandcamp, and other platforms.
- 🌐 **Network Explorer** — Browse and download tracks shared by TuneCamp peers and the server catalog. Peer tracks also surface in the unified search and download through the server tunnel.
- 🎵 **Local Library** — Browse your downloaded files with an in-app audio player; edit ID3 tags (title/artist/album) and rename files.
- 📂 **Shared Files Browser** — Navigate your Downloads and shared folders, create subfolders, and move or delete files/folders — the single place to organize what you keep and share.
- 💬 **Peer Chat** — Send direct messages to other peers by username over the peer WebSocket, Soulseek-style, powered by the shared `@tunecamp/chat` package ([scobru/tunecamp-chat](https://github.com/scobru/tunecamp-chat)). Direct messages are end-to-end encrypted (Curve25519/XSalsa20-Poly1305 via `tweetnacl`) — the relay server never sees plaintext. Nicknames automatically display instance domain badges (e.g. `admin (sudorecords)`).
- 📁 **Peer File Sharing** — Share local music folders with any TuneCamp instance via a secure reverse WebSocket tunnel. Listeners can stream or download files relayed through the server.
- 🔒 **Granular Permissions** — Allow or restrict downloads per-folder. Toggle permissions in real-time.
- 📤 **Upload to TuneCamp** — Push tracks from your local library to your TuneCamp account with custom metadata.
- 🖥️ **Desktop GUI** — A modern, responsive React-based interface running inside Electron, with 5 themes (dark/light/grey/nordic/nordic-dark) and a collapsible sidebar.

## Prerequisites

- **Node.js** 18+ and **npm**
- **yt-dlp** — auto-downloaded on first rip (no manual install needed)
- A running **TuneCamp** instance to connect to

## Quick Start

```bash
# Clone the repository
git clone https://github.com/scobru/sidecamp.git
cd sidecamp

# Install all workspaces
npm install

# Run Sidecamp in development mode (Vite + Electron)
npm run dev --workspace apps/sidecamp
```

### Running Tests

We use **Vitest** and **React Testing Library** for unit and hook testing:

```bash
# From the repo root: every workspace that has tests, single run
npm test

# Or a single workspace
npm test --workspace apps/sidecamp
npm run test:watch --workspace apps/sidecamp   # watch mode
```

### Build for production

```bash
# From the repo root: builds Sidecamp for the current host OS
npm run build --workspace apps/sidecamp
```

This compiles TypeScript, bundles the Vite frontend, and packages the Electron app via `electron-builder` into `apps/sidecamp/release/`.

`npm run build` only produces installers for **the OS you run it on** (electron-builder + native modules build for the host). Per-platform scripts (Sidecamp):

```bash
cd apps/sidecamp
npm run build:win     # NSIS installer (.exe)
npm run build:mac     # DMG (.dmg) + ZIP (.zip)  — macOS host only
npm run build:linux   # AppImage (.AppImage) + Debian (.deb)
```

> **You can't build the macOS installer on Windows or Linux** — it requires Apple tooling. To produce all three at once, use CI.

### Cross-platform releases (CI)

`.github/workflows/release.yml` builds Sidecamp on Windows, macOS, and Linux runners in parallel. Push a version tag to publish a GitHub Release with every installer attached:

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
┌─────────────┐         WebSocket Signaling         ┌──────────────────┐
│  Sidecamp   │ ◄─────── offer/answer/ICE ────────► │  TuneCamp Server │
│  (Desktop)  │                                     │  (Signaling Hub) │
└──────┬──────┘                                     └─────────┬────────┘
       │                                                      │
       │              Direct P2P DataChannel (WebRTC)         │ WebSocket
       │ ◄────────────────────────────────────────────────────┘ Signaling
       │
       ▼
 ┌───────────┐
 │ Listeners │
 └───────────┘
```

- **Providers** (`apps/sidecamp/electron/providers/`): Soulseek, Torrent, yt-dlp, Internet Archive, and network modules.
- **Uploader** (`apps/sidecamp/electron/uploader/`): Handles auto-uploading downloaded files to TuneCamp.
- **Peer** (`apps/sidecamp/electron/peer/`): Reverse tunnel & WebRTC DataChannel engine for zero-config P2P file sharing.
- **Frontend** (`apps/sidecamp/src/`): React + Vite UI rendered inside the Electron window and mobile Capacitor runtime.

## Ecosystem

Sidecamp is part of the [TuneCamp ecosystem](https://github.com/scobru/tunecamp#tunecamp-ecosystem):

- [**tunecamp**](https://github.com/scobru/tunecamp) — The core self-hosted music streaming server.
- [**tunecamp-website**](https://github.com/scobru/tunecamp-website) — Landing page, community directory, and web-based community audio player.
- [**tunecamp-4-track-recorder**](https://github.com/scobru/tunecamp-4-track-recorder) — Browser-based 4-track cassette recorder with overdub and mixer.
- [**tunecamp-audiofabric**](https://github.com/scobru/tunecamp-audiofabric) — Real-time 3D WebGL music visualizer.
- **Design System** — UI/design-token package has been deprecated; tokens are now inlined in app styles.
- [**sidecamp-cli**](https://github.com/scobru/sidecamp/tree/main/apps/sidecamp-cli) — Headless CLI client for Sidecamp functionality without Electron.

## License

MIT License — see [LICENSE](LICENSE) for details.
