# Changelog

All notable changes to this project will be documented in this file.

## [0.25.5] - 2026-08-03

### Fixed
- **"Start Sharing" crash**: `peer:start` threw `Cannot read properties of undefined (reading 'pair')` on click. Root cause was two-fold: the `zen` npm package was being bundled into the Electron main process by Vite/Rollup, breaking its static-method reflection, and the installed `@tunecamp/chat` dependency was pinned to a stale commit still calling the removed `Zen.SEA.pair()` API. Fixed by externalizing `zen` in `vite.config.ts` and updating `@tunecamp/chat` to the current commit (`Zen.pair()` directly).
- **Chat history/peers not loading**: Fixed by a corresponding CORS fix on the `tunecamp-instance` server (`GET /api/chat/history`, `/peers`, `/pubkey` now allow cross-origin requests) — see `tunecamp-instance` v4.4.3.

## [0.24.1] - 2026-08-01

### Fixed
- **Synchronized Chat & P2P Sharing Lifecycle**: Stopping the P2P sharing daemon (`handleStopPeer`) or disconnecting from an instance now automatically disconnects the WebSocket Chat connection, eliminating background chat connection drift when sharing is stopped.
- **Manual Chat Connection Controls**: Added explicit "Connect Chat" / "Disconnect Chat" toggle controls in the Chat header bar for direct status management.

## [0.23.7] - 2026-07-31

### Added
- **Modern 2-Column Chat UI**: Redesigned Sidecamp's Chat tab to match TuneCamp instance style with message bubbles, connection status badge, E2E lock indicators 🔒, lobby indicators 🌐, smooth auto-scroll with a "Latest" floating button, and an interactive connected peers roster sidebar.
- **Admin & Peer Identity Disambiguation**: Integrated backend identity disambiguation support so that multiple user or admin sessions connecting with identical usernames receive distinct session tags (e.g., `admin #a1b2`) in chat messages and roster views.

## [0.23.6] - 2026-07-31

### Fixed
- **Webapp users were missing from the chat contact list.** The Chat tab's recipient dropdown was built from `networkPeers` (`GET /api/peers`), which only lists peer-daemon sessions on `/ws/peer`. Users chatting from the TuneCamp webapp connect to `/ws/chat` and never appear there, so they were invisible from Sidecamp while Sidecamp users were visible to them. The dropdown now reads `GET /api/chat/peers` — the registry both transports write to — via a new `getChatPeers` on the Electron network provider and the Capacitor adapter, polled every 5s while the Chat tab is open.

## [0.23.5] - 2026-07-29

### Fixed
- **Android grey/black screen right after login.** `capacitorAdapter.ts` had no `configGet`/`configSet`, so the post-login shell's `window.electronAPI.configGet()` call threw an uncaught `TypeError` and silently unmounted the app. Added a `Preferences`-backed implementation mirroring the Electron main-process `config:get`/`config:set` IPC contract.
- Added a top-level `ErrorBoundary` so future uncaught render/mount errors show a crash screen instead of a blank one.

## [0.23.3] - 2026-07-27

### Fixed
- **Electron window throttled in background.** `backgroundThrottling: false` added to the main window's `webPreferences` so playback/timers keep running at full rate when the app window is unfocused or minimized.
- **`tweetnacl-util` import broke under CJS interop**, switched to default-import + destructure.

## [0.23.1] - 2026-07-24

### Fixed
- **Audio player floating loose instead of pinned above the bottom nav on Android.** `.audio-player-bar` used `position: sticky` inside a scrolling flex column (`.main-content`), a combination known to be unreliable on Android WebView (sticky silently degrades to static). Restructured so tab content lives in `.content-area` (the sole scroll container) and the player bar is a plain flex sibling of it — pinned by layout alone, no sticky/fixed needed.

## [0.23.0] - 2026-07-23

### Added
- **Network tab now shows federated instances' public catalogs.** Alongside the local server catalog and connected peer-daemon sessions, each instance the server is federated with (via `/api/community/sites`) now appears as a browsable, streamable, downloadable pseudo-peer backed by its public `/api/catalog/full` endpoint. No admin opt-in required — this catalog is already publicly served by every instance (same mechanism the TuneCamp webapp's own Network page uses), Sidecamp just wasn't consuming it. Streaming and downloads go directly to the remote instance, bypassing the local server tunnel/token.

## [0.22.1] - 2026-07-23

### Fixed
- **Mobile player unreachable after scroll**: on Android, starting playback from a track far down a scrolled list (e.g. Network tab) left the player bar effectively lost — `position: fixed` nested inside the `.main-content` scroll container is unreliable on some Android WebViews and could scroll away with the content. Switched to `position: sticky`, which is spec-guaranteed to stay pinned within the scroll container's visible viewport.

## [0.22.0] - 2026-07-23

### Added
- **In-app onboarding**: new `ConnectScreen` shown on first launch (and after Disconnect) lets a user enter a TuneCamp instance URL and register/log in directly from Sidecamp, instead of requiring a JWT copy-pasted from the server's admin panel. Manual JWT paste is kept as an "Advanced" fallback. Goes through the existing `electronAPI`/`CapacitorHttp` platform abstraction (new `authConnect` method), not a plain `fetch()`, so it works on Android without hitting webview CORS restrictions.
- **Disconnect / Switch Instance** button in Settings clears the stored server/token and returns to the connect screen.

## [0.20.1] - 2026-07-22

### Fixed
- **Sequential per-file scans blocked the main process.** `organizer.ts` (`scanDir`) and `electron/peer/daemon.ts` (`scanFolders`) awaited `fs.stat`/`parseFile` one file at a time; both now batch with `CONCURRENCY=8` chunked `Promise.all`, mirroring `track-meta.ts`.
- **`torrent:seed`/`torrent:remove` triggered a full library rescan** (`rescanAndSendManifest`) just to update one file's magnet URI. Added `PeerDaemon.refreshAndSendManifest()`, which refreshes `magnetUri` on the already-cached `fileIndex` and resends the manifest without re-walking the filesystem or re-parsing metadata.
