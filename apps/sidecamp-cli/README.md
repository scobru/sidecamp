# Sidecamp CLI

Headless command-line client for **TuneCamp** — search, download, upload, manage your instance library, inspect connected peers, and interact with federated TuneCamp servers directly from your terminal.

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js 20+
- `npm`

### Global Installation
Inside the `apps/sidecamp-cli` directory, run:

```bash
npm install -g .
```

Verify installation:

```bash
sidecamp --help
```

---

## 🔐 Authentication

Save your server URL and JWT token locally:

```bash
sidecamp login <server> <username> <password>
```

**Example:**
```bash
sidecamp login https://sudorecords.scobrudot.dev admin mypassword
```

---

## 🎵 Instance Library (Catalog)

View, search, and download tracks stored directly on your TuneCamp server.

### List or Search Instance Library
```bash
sidecamp library [query]
# Alias: sidecamp catalog
```

**Examples:**
```bash
sidecamp library
sidecamp library "Verdena"
```

### Download Track by ID
```bash
sidecamp download-track <trackId> [--artist <artist>] [--title <title>]
```

**Example:**
```bash
sidecamp download-track 142
```

---

## 🔍 Multi-Source Search & Downloading

Search across multiple providers or download the top result automatically.

### Supported Sources
- `youtube` *(default)*
- `soundcloud`
- `bandcamp`
- `archive`
- `torrent`
- `soulseek`
- `library` *(your TuneCamp instance catalog)*

### Search
```bash
sidecamp search [options] <query>
```
*Options:* `-s, --source <source>` (default: `youtube`)

**Examples:**
```bash
sidecamp search "Daft Punk One More Time"
sidecamp search -s soundcloud "Aphex Twin"
sidecamp search -s library "Elefante"
```

### Quick Download Top Result (`get`)
```bash
sidecamp get [options] <query>
```

**Examples:**
```bash
sidecamp get "Radiohead Karma Police"
sidecamp get -s library "Elefante"
sidecamp get -s bandcamp "Kavinsky Nightcall"
```

---

## 📤 Upload Tracks

Upload local audio files directly to your TuneCamp instance:

```bash
sidecamp upload <filePath> [--artist <artist>] [--album <album>] [--release <releaseSlug>]
```

**Example:**
```bash
sidecamp upload ./my-track.mp3 --artist "My Artist" --album "My Album"
```

---

## 🤝 P2P Sharing Daemon (`share`)

Start the headless P2P sharing daemon in your terminal to index your local audio folders and share them via WebSocket with your TuneCamp network:

```bash
sidecamp share [options]
# Aliases: sidecamp daemon, sidecamp start-peer
```

### Options:
- `-f, --folder <folders...>`: Specific local folder(s) to share (defaults to your sidecamp download folder).
- `--no-downloads`: Allow streaming only while disabling direct file downloads for peers.

**Examples:**
```bash
# Share default download directory
sidecamp share

# Share custom music folders
sidecamp share -f "D:\Music" "E:\DJ-Sets"

# Stream-only mode (downloads disabled)
sidecamp daemon --no-downloads
```

When started, the daemon:
1. Scans your shared folders for `.mp3`, `.flac`, `.wav`, `.ogg`, `.m4a`.
2. Extracts metadata (artist, title, duration, bitrate, container).
3. Connects securely via WebSocket (`/ws/peer`) to your TuneCamp instance.
4. Publishes your library manifest to the network and serves incoming stream and download requests from authorized peers.

---

## 🌐 Peers & Federation

Interact with P2P peers and federated TuneCamp community instances.

### Connected Peers
```bash
sidecamp peers
```

### Peer Tracks
```bash
sidecamp peer-tracks <sessionId> [--origin <origin>]
```

### Download Peer Track
```bash
sidecamp download-peer-track <sessionId> <trackId> [--origin <origin>] [--artist <artist>] [--title <title>]
```

### Community Instances
List federated community sites connected to your server:
```bash
sidecamp community
```

### Federated Catalog
Inspect the public catalog of a remote federated TuneCamp instance:
```bash
sidecamp federated-catalog <origin>
```

**Example:**
```bash
sidecamp federated-catalog https://sudorecords.scobrudot.dev
```

### Download Federated Track
```bash
sidecamp download-federated-track <origin> <trackId> [--artist <artist>] [--title <title>]
```

---

## 📂 Local Downloads

List files downloaded to your local Sidecamp downloads folder:

```bash
sidecamp downloads
```

---

## ⚙️ Configuration

`sidecamp-cli` stores configuration (server URL, JWT token, download directory) in:
- `~/.config/sidecamp-cli/config.json` (Linux/macOS)
- `%APPDATA%/sidecamp-cli/config.json` (Windows)

Default download folder: `~/sidecamp-downloads`
