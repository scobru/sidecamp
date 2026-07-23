# Changelog

All notable changes to this project will be documented in this file.

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
