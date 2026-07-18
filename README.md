# Sidecamp

> The standalone desktop companion app for [TuneCamp](https://github.com/scobru/tunecamp).

Sidecamp is an **Electron desktop application** that handles all P2P content acquisition and peer file-sharing for TuneCamp instances — keeping the core server clean and fully compliant.

This repository is an **npm-workspaces monorepo** hosting two apps and their shared packages:

```
apps/sidecamp        # the TuneCamp companion app (this README's main subject)
apps/graphofone      # standalone live-performance app built on the same graph engine
packages/audio-engine # pure Web Audio DSP: crossfade player, time-warp, worklets
packages/graph-ui     # React graph view: track graph, transitions, waveforms, recording
```

## Graphofone

**Graphofone** is a focused live-performance tool: import a music folder, arrange tracks as a graph, link them with beat-matched crossfade transitions, and perform — no P2P, no server, no network features. It ships with a first-run quick tour (reopen it anytime from the `?` button in the header). Both apps consume the same `graph-ui` and `audio-engine` packages, so every mixing feature lands in both.

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
- 💬 **Peer Chat** — Send direct messages to other peers by username over the peer WebSocket, Soulseek-style.
- 📁 **Peer File Sharing** — Share local music folders with any TuneCamp instance via a secure reverse WebSocket tunnel. Listeners can stream or download files relayed through the server.
- 🔒 **Granular Permissions** — Allow or restrict downloads per-folder. Toggle permissions in real-time.
- 📤 **Upload to TuneCamp** — Push tracks from your local library to your TuneCamp account with custom metadata.
- 🖥️ **Desktop GUI** — A modern, responsive React-based interface running inside Electron, with light/dark themes and a collapsible sidebar.
- 🕸️ **Graph Playlist View** — Visualize your library as a track graph; edges are auto-suggested by BPM/key/genre compatibility, with beat-synced crossfade transitions and one-click A→B preview.
- 🎚️ **DJ Mixing Tools** — Zoomable waveform preview, in/out cue points, and EQ-based transition presets (bass-swap, echo-out) for smooth track blending.
- 🔴 **Set Recording** — Record your live mix session to a file as you play through the graph.

## Prerequisites

- **Node.js** 18+ and **npm**
- **yt-dlp** — auto-downloaded on first rip (no manual install needed)
- A running **TuneCamp** instance to connect to (Sidecamp only; Graphofone is fully offline)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/scobru/sidecamp.git
cd sidecamp

# Install all workspaces
npm install

# Run an app in development mode (Vite + Electron)
npm run dev --workspace apps/sidecamp
npm run dev --workspace apps/graphofone
```

### Running Tests

We use **Vitest** and **React Testing Library** for unit and hook testing:

```bash
cd apps/sidecamp
npm run test       # watch mode
npm run test:run   # single run
```

### Build for production

```bash
# From the repo root: builds every app for the current host OS
npm run build

# Or a single app
npm run build --workspace apps/graphofone
```

This compiles TypeScript, bundles the Vite frontend, and packages each Electron app via `electron-builder` into `apps/*/release/`.

`npm run build` only produces installers for **the OS you run it on** (electron-builder + native modules build for the host). Per-platform scripts (Sidecamp):

```bash
cd apps/sidecamp
npm run build:win     # NSIS installer (.exe)
npm run build:mac     # DMG (.dmg) + ZIP (.zip)  — macOS host only
npm run build:linux   # AppImage (.AppImage) + Debian (.deb)
```

> **You can't build the macOS installer on Windows or Linux** — it requires Apple tooling. To produce all three at once, use CI.

### Cross-platform releases (CI)

`.github/workflows/release.yml` builds **both apps** on Windows, macOS, and Linux runners in parallel. Push a version tag to publish a GitHub Release with every installer attached:

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

- **Providers** (`apps/sidecamp/electron/providers/`): Soulseek, Torrent, yt-dlp, Internet Archive, and network modules.
- **Uploader** (`apps/sidecamp/electron/uploader/`): Handles auto-uploading downloaded files to TuneCamp.
- **Peer** (`apps/sidecamp/electron/peer/`): WebSocket-based reverse tunnel for peer file sharing.
- **Frontends** (`apps/*/src/`): React + Vite UIs rendered inside each Electron window.
- **Graph View** (`packages/graph-ui/`): Track graph, BPM/key/genre-based transition suggestions, waveform/cue UI, and set recording — shared by both apps.
- **Audio Engine** (`packages/audio-engine/`): Crossfade playback engine, time-warp source, and audio worklets — pure Web Audio, no app logic.

## Ecosystem

Sidecamp is part of the [TuneCamp ecosystem](https://github.com/scobru/tunecamp#tunecamp-ecosystem):

- [**tunecamp**](https://github.com/scobru/tunecamp) — The core self-hosted music streaming server.
- [**tunecamp-website**](https://github.com/scobru/tunecamp-website) — Landing page and community directory.

## License

MIT License — see [LICENSE](LICENSE) for details.
