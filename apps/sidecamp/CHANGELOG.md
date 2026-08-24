# Changelog

All notable changes to this project will be documented in this file.

## [0.28.1] - 2026-08-24

### Changed

- Docs catch up with 0.28.0: the README no longer advertises Peer Chat, and the roadmap no longer promises deeper `@tunecamp/chat` integration. No code changes — 0.28.0 already shipped without chat.

## [0.28.0] - 2026-08-24

### Removed

- **Chat.** TuneCamp is dropping its chat protocol to stay a music, federation and publishing platform, and messaging moves to [linda-pear](https://github.com/scobru/linda-pear). Gone from Sidecamp: the Chat tab and its rooms, the peer roster and DM UI, the room passphrase and create-room modals, the Zen identity vault opened at login, and the `@tunecamp/chat` dependency. Sharing, the library, downloads and the network browser are untouched — they never went through the chat socket.

## [0.27.5] - 2026-08-24

### Fixed

- **Chat now encrypts under the account's Zen identity, not a per-connection throwaway key.** The vault was already opened at login and stored, but it was only handed to the peer daemon — the in-app chat hook never received it, so it fell back to the library's random pair. That key changed on every connect, which every peer who had pinned the account's real key had to clear as a key-change warning. Bumped `@tunecamp/chat` to v3.3.0, which stops minting those keys altogether and refuses a DM rather than sending it under one; connecting with a bare token (no password, so no vault) therefore leaves DMs unavailable instead of silently unreadable.

## [0.27.4] - 2026-08-24

### Fixed

- **Lockfile pin**: `package-lock.json` was still resolving `@tunecamp/chat` at an old commit despite the package.json bump in 0.27.3, so CI builds kept installing a version predating `contactsData`/`blocklist` and failing to compile.

### Removed

- **Graphofone**: dropped from the repo (was never actually committed to this project) and from the release workflow's build matrix.

## [0.27.3] - 2026-08-24

### Added

- **Contacts and block/unblock UI**: peer sidebar now surfaces pending contact requests (accept/reject) and per-peer block/unblock — previously implemented in `@tunecamp/chat` but never wired into the app.

### Changed

- **Updated `@tunecamp/chat` to `v3.2.3`**.

## [0.27.2] - 2026-08-23

### Fixed

- **Room slash commands and moderation**: Properly await room message delivery and execute room-scoped slash commands (`/kick`, `/ban`, `/unban`, etc.) on desktop and mobile.

## [0.27.1] - 2026-08-22

### Changed

- **Updated `@tunecamp/chat` to `v3.2.0`**: Adds room-scoped moderation (`/kick`, `/ban`, `/unban`), `room_kicked` event handling, and Zen admin global moderation commands (`/zkick`, `/zban`, `/zunban`, `/zmute`, `/zunmute`).

## [0.27.0] - 2026-08-22

## [0.26.10] - 2026-08-22

### Changed

- Update `@tunecamp/chat` to `v3.1.0`.

## [0.26.9] - 2026-08-10

### Fixed

- **The peer daemon no longer offers permessage-deflate.** `ws` enables the extension by default for clients, while the TuneCamp instance never enables it server-side, so nothing between the two agrees on who compresses. A user hit `Invalid WebSocket frame: RSV1 must clear` immediately after "WebSocket connesso" — which is what an intermediary accepting the offer on the instance's behalf looks like, since compressed frames cannot originate from the instance itself. Not offering the extension leaves nothing to mis-negotiate. This affects the desktop daemon only; the Capacitor adapter uses the browser's `WebSocket`, which takes no options.

## [0.26.5] - 2026-08-07

### Added

- **Accept a peer's changed encryption key from the chat panel.** `@tunecamp/chat` pins a peer's key on first sight and blocks DMs when a different one is later offered, since the server chooses which key it serves and a silent substitution looks exactly like a wiretap. The panel reported the block but offered no way out, leaving DMs to that peer blocked permanently. The composer now shows the pinned and offered fingerprints with an explicit "Accept new key" confirmation, and the peer list flags the peer instead of marking it E2E-ready.

### Fixed

- **A refused message no longer wipes the draft.** `sendMessage` is async and refuses a DM it cannot encrypt; `handleSendChat` ignored the result and cleared the input regardless, so the user lost what they had written to a refusal they couldn't retry. The draft is now cleared only after the message goes out, and Send is disabled while it is in flight.

## [0.26.4] - 2026-08-06

### Changed
- **Cancelling a download now discards its partial data.** 0.26.3 stopped the transfer but left the fragment on disk, where the next Resume of the same magnet would inherit it silently. `TorrentService.remove()` gained a `deleteFiles` argument (WebTorrent's `destroyStore`) that defaults to false and is passed only by Cancel — the same method backs `Stop Seeding`, where the files are a completed download the user asked to keep, so deleting there would destroy real data. The confirmation dialog states that the partial data will be deleted.

## [0.26.3] - 2026-08-06

### Added
- **Cancel a torrent that is still downloading.** The transfer row only offered `Stop Seeding` (once finished) and `Clear` (once failed or completed), so an in-flight download could be resumed but never stopped — the only way out was to let it fail or restart the app. Downloading rows now carry a `Cancel` button, which confirms, removes the torrent, and drops the row rather than marking it failed: a transfer the user stopped on purpose is not something to retry, and listing it as failed invited a `Resume` that restarted exactly what was just stopped.

### Fixed
- **A removed torrent left its `torrent:download` IPC call pending forever.** WebTorrent's `remove()` fires neither `done` nor `error`, so the promise `TorrentService.download()` returns never settled and the renderer's `await` never returned. In-flight downloads are now tracked under both their downloadId and their infoHash — the latter only exists once metadata arrives, so cancelling early can only be addressed by id — and `remove()` settles the pending promise after the torrent is gone. `stop()` settles anything still in flight for the same reason.

## [0.26.2] - 2026-08-06

### Fixed
- **DMs would have become unreadable again once the instance re-sealed the account vault.** The lockfile still pinned `@tunecamp/chat` at `1289624`, whose `decryptPairVault` only understands the old blob format. Instance 5.0.0 re-seals every vault at login as `tcv1:<iterations>:<salt>:<blob>` (PBKDF2 at 600 000 iterations instead of a single SHA-256), and the old reader returns `null` on that — which `openIdentityVault` treats as "no vault" and silently falls back to a locally generated pair, exactly the failure 0.26.0 fixed. Bumped to 2.0.0.
- Comes with the rest of 2.0.0: peer keys are pinned trust-on-first-use and a key that changes fingerprint is refused rather than adopted silently, and a DM whose recipient key cannot be resolved is refused instead of being sent in the clear.

## [0.26.1] - 2026-08-05

### Fixed
- **Soulseek search returned 0 results after the first search.** 0.25.7 made the postinstall patches actually apply, which switched on the 75-socket result-peer cap for the first time. The cap rejected new peers instead of evicting old ones, and `peers` in slsk-client is module-level, never cleared on reconnect, and holds sockets open with no idle timeout — so once the first search filled it, every later search had nowhere to put its result peers. The cap now drops the oldest entries (skipping peers with an in-flight download, which `download()` looks up by user).

## [0.26.0] - 2026-08-05

### Fixed
- **DMs from the TuneCamp webapp could not be read.** As of instance 4.7.0 chat encrypts to the account's Zen identity (`admin.zen_pub`) rather than to whatever key a socket announces, and the webapp refuses to downgrade to a socket-announced key once it has resolved the identity one. Sidecamp was still using its own locally generated pair, so anything addressed to the account was undecryptable here. Login now opens the account's vault with the password (`openIdentityVault`, `@tunecamp/chat`'s `decryptPairVault`) and both the Electron daemon and the Capacitor adapter encrypt with that pair.
- The opened pair is kept in `localStorage` next to the token, because the password is not stored and the vault cannot be reopened without a fresh login. Accounts with no vault, and connections made with a bare JWT instead of a login, keep the previous locally generated pair.

## [0.25.7] - 2026-08-05

### Fixed
- **App stopped responding after sitting idle for a few minutes, with no user action.** `patch_script.cjs` (postinstall) located `andrade-soulseek-downloader` via `path.join(process.cwd(), 'node_modules/…')`, but in this npm-workspaces monorepo the package is hoisted to the root `node_modules` while npm runs the script with cwd `apps/sidecamp`. Every `fs.existsSync` guard failed, so all four patches were skipped without a word. The decisive one is the distributed-search skip: without it, login sends `haveNoParents(1)`, the server keeps pushing `NetInfo`, and each resulting `DistributedPeer` relays the whole Soulseek network's search queries to us. Every query is appended to an unbounded `stack.peerSearchRequests` array deduped with a linear `indexOf`, so cost grows quadratically on the Electron main thread until the window's message pump starves. The app auto-connects to Soulseek at startup when credentials are saved, so this needed no user action to trigger. Resolution now goes through `require.resolve`, and a patch whose regex stops matching logs `NO MATCH … patch not applied` instead of failing silently.
- **Peer daemon could stack parallel reconnect chains.** `connect()` assigned `reconnectTimer` without clearing the pending one, and its `close`/`error` handlers acted on the `this.ws` field rather than the socket they were bound to — a late event from a superseded socket closed the live one and started a second connect loop, doubling sockets each cycle. Handlers now bind to their own socket, stale ones bail out, and `scheduleReconnect()` keeps at most one timer pending.
- **Renderer stutter while seeding.** `activeDownloads` was written to `localStorage` on every change and torrent progress lands at ~4Hz per download, making `setItem` (synchronous) run that often. Persisted on a 1s trailing debounce instead.
- **`dlLogs` grew unbounded**: only 2 of ~45 append sites capped the array. The cap now lives in the setter (200 lines), so no call site can bypass it.

### Removed
- `apps/graphofone/patch_script.cjs` — dead code. graphofone has no `postinstall` hook and no `andrade-soulseek-downloader` dependency, so it never ran.

## [0.25.6] - 2026-08-04

### Fixed
- **P2P sharing could hang the app ("Not Responding") and balloon main-process memory with slow peers.** `handleRequest` (WS) and `streamTrackOverDataChannel` (WebRTC) piped `fs.createReadStream` straight into `ws.send`/`channel.send` with no backpressure — a peer downloading slower than local disk read speed let chunks queue up unbounded in the socket send buffer. Added `applyBackpressure`: pauses the read stream once buffered data exceeds 4MB, resumes once drained.
- **`tsconfig.app.json` build failure**: `ignoreDeprecations: "6.0"` isn't a value TypeScript 6.0.3 recognizes yet; reverted to `"5.0"`.
- **Transfer progress bars rendered narrow and centered instead of full-width.** The `.result-item` CSS class sets `align-items: center` with no `flex-direction`; the row's inline style overrode `flex-direction` to `column` but not `align-items`, so children (including the progress bar) shrank to content width in the column's cross axis instead of stretching. Added `alignItems: "stretch"` to the inline style.

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
