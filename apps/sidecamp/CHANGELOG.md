# Changelog

All notable changes to this project will be documented in this file.

## [0.22.0] - 2026-07-23

### Added
- **In-app onboarding**: new `ConnectScreen` shown on first launch (and after Disconnect) lets a user enter a TuneCamp instance URL and register/log in directly from Sidecamp, instead of requiring a JWT copy-pasted from the server's admin panel. Manual JWT paste is kept as an "Advanced" fallback. Goes through the existing `electronAPI`/`CapacitorHttp` platform abstraction (new `authConnect` method), not a plain `fetch()`, so it works on Android without hitting webview CORS restrictions.
- **Disconnect / Switch Instance** button in Settings clears the stored server/token and returns to the connect screen.

## [0.20.1] - 2026-07-22

### Fixed
- **Sequential per-file scans blocked the main process.** `organizer.ts` (`scanDir`) and `electron/peer/daemon.ts` (`scanFolders`) awaited `fs.stat`/`parseFile` one file at a time; both now batch with `CONCURRENCY=8` chunked `Promise.all`, mirroring `track-meta.ts`.
- **`torrent:seed`/`torrent:remove` triggered a full library rescan** (`rescanAndSendManifest`) just to update one file's magnet URI. Added `PeerDaemon.refreshAndSendManifest()`, which refreshes `magnetUri` on the already-cached `fileIndex` and resends the manifest without re-walking the filesystem or re-parsing metadata.
