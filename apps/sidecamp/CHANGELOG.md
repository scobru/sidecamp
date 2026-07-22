# Changelog

All notable changes to this project will be documented in this file.

## [0.20.1] - 2026-07-22

### Fixed
- **Sequential per-file scans blocked the main process.** `organizer.ts` (`scanDir`) and `electron/peer/daemon.ts` (`scanFolders`) awaited `fs.stat`/`parseFile` one file at a time; both now batch with `CONCURRENCY=8` chunked `Promise.all`, mirroring `track-meta.ts`.
- **`torrent:seed`/`torrent:remove` triggered a full library rescan** (`rescanAndSendManifest`) just to update one file's magnet URI. Added `PeerDaemon.refreshAndSendManifest()`, which refreshes `magnetUri` on the already-cached `fileIndex` and resends the manifest without re-walking the filesystem or re-parsing metadata.
