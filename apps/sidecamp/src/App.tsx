import { useState, useEffect, useRef, useMemo } from "react";
import {
	Radio,
	Globe,
	Download,
	FolderSync,
	Settings,
	Play,
	Pause,
	X,
	Volume2,
	Music,
	Magnet,
	Cloud,
	SkipBack,
	SkipForward,
	Folder,
	FolderPlus,
	ChevronRight,
	PanelLeft,
	Trash2,
	Upload,
	Palette,
	ChevronUp,
	ArrowUpCircle,
	User,
} from "lucide-react";
import { Button } from "./components/Button";
import { ProgressBar } from "./components/ProgressBar";
import { UnifiedLogsViewer, type LogCategory } from "./components/UnifiedLogsViewer";
import {
	downloadBadgeLabel,
	downloadRefusalHint,
	resolveDownloadability,
	type DownloadRefusal,
} from "./downloadPolicy";
import "./index.css";
import logo from "./assets/logo.png";

import platformAPI, { currentPlatform } from "./services/platform";
import ConnectScreen from "./components/ConnectScreen";

const isCapacitor = currentPlatform.isCapacitor;

// Shared collator: options are parsed once, not on every comparison.

// Declare global for TypeScript
declare global {
	interface Window {
		electronAPI: any;
	}
}

// Fallback window.electronAPI to platformAPI for Capacitor / Web environments
if (typeof window !== "undefined" && !window.electronAPI) {
	window.electronAPI = platformAPI;
}

function cleanTrackMetadata(filename: string): { artist: string; title: string } {
	let base = (filename.split(/[/\\]/).pop() || filename).replace(/\.[^/.]+$/, "");
	base = base
		.replace(/^\d{1,3}[\s._-]+(?=\D)/, "")
		.replace(/_/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	const m = base.match(/^(.+?)\s*[-–—|~]\s*(.+)$/);
	return m
		? { artist: m[1].trim(), title: m[2].trim() }
		: { artist: "", title: base };
}

function App() {
	const [server, setServer] = useState(
		() => localStorage.getItem("tc_server") || "",
	);
	const [token, setToken] = useState(
		() => localStorage.getItem("tc_token") || "",
	);
	// Gates ConnectScreen vs. the app shell. Deliberately separate from `token` above:
	// that field is also live-edited in the Settings tab, and briefly going empty
	// while editing (e.g. select-all before paste) must not bounce the user out.
	const [hasConnected, setHasConnected] = useState(
		() => !!localStorage.getItem("tc_token"),
	);
	const [folder, setFolder] = useState("");
	// Upload tab: queue of local files with editable metadata
	type UploadItem = {
		id: string;
		name: string;
		path: string;
		title: string;
		artist: string;
		album: string;
		status: "ready" | "uploading" | "done" | "error";
		error?: string;
	};
	const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
	const [uploadBusy, setUploadBusy] = useState(false);
	const uploadInputRef = useRef<HTMLInputElement>(null);
	const patchUpload = (id: string, patch: Partial<UploadItem>) =>
		setUploadQueue((q) => q.map((u) => (u.id === id ? { ...u, ...patch } : u)));
	const addUploadFiles = (files: FileList | File[]) => {
		const items: UploadItem[] = [];
		for (const f of Array.from(files)) {
			const filePath = window.electronAPI.getFilePath?.(f) || "";
			if (!filePath) continue;
			const { artist, title } = cleanTrackMetadata(f.name);
			items.push({
				id: crypto.randomUUID(),
				name: f.name,
				path: filePath,
				title,
				artist: artist || "Sidecamp",
				album: "",
				status: "ready",
			});
		}
		setUploadQueue((q) => [
			...q,
			...items.filter((i) => !q.some((x) => x.path === i.path)),
		]);
	};
	const runUpload = async (u: UploadItem) => {
		patchUpload(u.id, { status: "uploading", error: undefined });
		try {
			await uploadFile(
				u.path,
				{ artist: u.artist, title: u.title || u.name, album: u.album || undefined },
				"Upload",
			);
			patchUpload(u.id, { status: "done" });
		} catch (e: any) {
			patchUpload(u.id, { status: "error", error: e.message || String(e) });
		}
	};
	const uploadAll = async () => {
		if (!server || !token) {
			alert(
				"You must configure the Server URL and Token in the Configuration section to upload files!",
			);
			return;
		}
		setUploadBusy(true);
		for (const u of uploadQueue.filter((x) => x.status !== "done")) {
			await runUpload(u);
		}
		setUploadBusy(false);
	};
	// Auto-upload every finished download (no UI toggle; set localStorage "auto_upload" = "true")
	const autoUpload = localStorage.getItem("auto_upload") === "true";
	const [peerStatus, setPeerStatus] = useState("offline");
	const [logs, setLogs] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState(
		isCapacitor ? "network" : "download",
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<any[]>([]);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [theme, setTheme] = useState(
		() => localStorage.getItem("theme") || "dark",
	);
	const THEMES = ["dark", "nordic", "nordic-dark", "light", "grey"] as const;
	const cycleTheme = () => {
		const idx = THEMES.indexOf(theme as any);
		const next = THEMES[(idx + 1) % THEMES.length];
		setTheme(next);
	};
	// File browser (shared folders)
	const [browserRoot, setBrowserRoot] = useState("");
	const [browserPath, setBrowserPath] = useState("");
	const [browserEntries, setBrowserEntries] = useState<
		{ name: string; isDir: boolean }[]
	>([]);
	const [newFolderName, setNewFolderName] = useState("");
	const [browserError, setBrowserError] = useState("");
	const [downloadsDir, setDownloadsDir] = useState("");
	const [movingItem, setMovingItem] = useState<{
		root: string;
		path: string;
		name: string;
		isDir: boolean;
	} | null>(null);
	// Per-list search filters
	const [browserSearch, setBrowserSearch] = useState("");

	// Direct Download & Torrent States
	const [downloadSource, setDownloadSource] = useState("soulseek"); // 'soulseek' | 'direct'
	const [directUrl, setDirectUrl] = useState("");
	const [dlLogs, _setDlLogs] = useState<string[]>([]);
	// ~45 call sites append to this; capping here instead of at each one is the
	// only way the array can't grow unbounded over a long session.
	const DL_LOG_CAP = 200;
	const setDlLogs: typeof _setDlLogs = (action) =>
		_setDlLogs((prev) => {
			const next =
				typeof action === "function"
					? (action as (p: string[]) => string[])(prev)
					: action;
			return next.length > DL_LOG_CAP ? next.slice(-DL_LOG_CAP) : next;
		});
	const [dlProgress, setDlProgress] = useState<any>(null);
	const [isDownloading, setIsDownloading] = useState(false);
	const [settingsSaved, setSettingsSaved] = useState(false);
	const [slskUser, setSlskUser] = useState("");
	const [slskPass, setSlskPass] = useState("");
	const [torrentPort, setTorrentPort] = useState<number>(0);
	const [libraryDir, setLibraryDir] = useState<string>("");
	const [activeDownloads, setActiveDownloads] = useState<any[]>(() => {
		try {
			const saved = localStorage.getItem("sidecamp_active_downloads");
			return saved ? JSON.parse(saved) : [];
		} catch {
			return [];
		}
	});

	// Torrent progress rewrites this at ~4Hz per active download and
	// localStorage.setItem is synchronous — persist on a trailing debounce so
	// seeding doesn't block the renderer on every tick. Only the entries matter
	// across restarts (auto-resume), not the last second of progress.
	useEffect(() => {
		const t = setTimeout(() => {
			try {
				localStorage.setItem(
					"sidecamp_active_downloads",
					JSON.stringify(activeDownloads),
				);
			} catch (e) {
				console.error("Failed to save active_downloads:", e);
			}
		}, 1000);
		return () => clearTimeout(t);
	}, [activeDownloads]);
	const [searchSource, setSearchSource] = useState("soulseek"); // 'soulseek' | 'soundcloud' | 'bandcamp' | 'torrent'

	// Network Explorer States
	const [networkPeers, setNetworkPeers] = useState<any[]>([]);
	const [selectedPeer, setSelectedPeer] = useState<any | null>(null);
	const [peerTracks, setPeerTracks] = useState<any[]>([]);
	const [networkQuery, setNetworkQuery] = useState("");
	const [isLoadingPeers, setIsLoadingPeers] = useState(false);
	const [isLoadingTracks, setIsLoadingTracks] = useState(false);
	const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(
		null,
	);

	// Built-in Audio Player States
	const [currentPlayback, setCurrentPlayback] = useState<{
		name: string;
		path: string;
	} | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [isSeeking, setIsSeeking] = useState(false);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(0.8);
	const audioRef = useRef<HTMLAudioElement | null>(null);
	// One retry per track for transient network blips on remote/federated streams.
	const streamRetryRef = useRef<{ src: string; count: number }>({
		src: "",
		count: 0,
	});
	// Play queue: resolved tracks (src ready to feed <audio>) + current index.
	// Playing from Network queues the peer's track list.
	const [queue, setQueue] = useState<
		{ name: string; src: string; path: string }[]
	>([]);
	const [queueIndex, setQueueIndex] = useState(-1);

	const [update, setUpdate] = useState<{
		currentVersion: string;
		latestVersion: string | null;
		updateAvailable: boolean;
	} | null>(null);
	const [updateDismissed, setUpdateDismissed] = useState(false);

	// Load torrent port from main-process config on startup.
	useEffect(() => {
		window.electronAPI
			.configGet()
			.then((cfg: any) => {
				setTorrentPort(cfg.torrentPort || 0);
				setLibraryDir(cfg.libraryDir || "");
			});
	}, []);

	useEffect(() => {
		// Listen to Peer Daemon logs
		window.electronAPI.onPeerLog((msg: string) => {
			setLogs((prev) =>
				[...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50),
			);
		});

		window.electronAPI.onPeerStatus((status: string) => {
			setPeerStatus(status);
		});

		// Native menu "Go" items / Ctrl+1..9 accelerators
		window.electronAPI.onNavGoto?.((tab: string) => setActiveTab(tab));

		window.electronAPI
			.getDownloadsDir()
			.then((dir: string) => setDownloadsDir(dir || ""));

		// One check per launch — result is cached in the main process.
		window.electronAPI
			.checkForUpdate?.()
			.then(setUpdate)
			.catch(() => {});

		// Listen to download logs and progress
		window.electronAPI.onDownloadLog((msg: string) => {
			setDlLogs((prev) => [
				...prev,
				`[${new Date().toLocaleTimeString()}] ${msg}`,
			]);
		});

		// Torrent progress can fire many times per second and each event re-renders the
		// whole app — cap UI updates at ~4Hz per download. Final events (completed /
		// seeding) always pass so the terminal state lands.
		const lastProgressAt: Record<string, number> = {};
		window.electronAPI.onDownloadProgress((data: any) => {
			const now = Date.now();
			const isFinal = data.seeding || data.progress >= 1;
			if (!isFinal && now - (lastProgressAt[data.id] || 0) < 250) return;
			lastProgressAt[data.id] = now;
			setDlProgress(data);

			setActiveDownloads((prev) => {
				const index = prev.findIndex((d) => d.id === data.id);
				if (index > -1) {
					const updated = [...prev];
					updated[index] = {
						...updated[index],
						infoHash: data.infoHash,
						progress: data.progress,
						speed: data.speed,
						uploadSpeed: data.uploadSpeed,
						downloaded: data.downloaded,
						total: data.total,
						status: data.seeding
							? "seeding"
							: data.progress >= 1
								? "completed"
								: "downloading",
					};
					return updated;
				} else {
					return [
						...prev,
						{
							id: data.id,
							infoHash: data.infoHash,
							name: data.name || `Torrent (${data.id.substring(0, 8)})`,
							source: "torrent",
							status: data.seeding ? "seeding" : "downloading",
							progress: data.progress,
							speed: data.speed,
							uploadSpeed: data.uploadSpeed,
							downloaded: data.downloaded,
							total: data.total,
						},
					];
				}
			});
		});

		const savedFolders = localStorage.getItem("shared_folders") || "";
		setFolder(savedFolders);

		const savedSlskUser = localStorage.getItem("slsk_user") || "";
		setSlskUser(savedSlskUser);
		// password is stored encrypted (OS keychain via safeStorage); decrypt returns
		// legacy plaintext values unchanged
		const storedPass = localStorage.getItem("slsk_pass") || "";
		(async () => {
			const savedSlskPass = storedPass
				? await window.electronAPI.decryptString(storedPass)
				: "";
			setSlskPass(savedSlskPass);

			if (!isCapacitor && savedSlskUser && savedSlskPass) {
				await window.electronAPI
					.slskConnect(savedSlskUser, savedSlskPass)
					.then((connected: boolean) => {
						if (connected) {
							setDlLogs((prev) => [
								...prev,
								`[${new Date().toLocaleTimeString()}] Auto-connected to Soulseek.`,
							]);
						} else {
							setDlLogs((prev) => [
								...prev,
								`[${new Date().toLocaleTimeString()}] Soulseek auto-connection failed.`,
							]);
						}
					});
			}
		})();

		// Auto-resume pending or active torrents on startup
		const pendingTorrents = activeDownloads.filter(
			(dl) =>
				(dl.source === "torrent" || dl.source === "torrent_search") &&
				dl.magnetUri &&
				(dl.status === "downloading" || dl.status === "seeding"),
		);

		if (pendingTorrents.length > 0) {
			setDlLogs((prev) => [
				...prev,
				`[Torrent] Auto-resuming ${pendingTorrents.length} active torrent download(s)...`,
			]);
			pendingTorrents.forEach((dl) => {
				window.electronAPI
					.torrentDownload(dl.magnetUri, dl.id)
					.then((paths: string[]) => {
						if (paths.length > 0) {
							setActiveDownloads((prev) =>
								prev.map((item) =>
									item.id === dl.id
										? {
												...item,
												status: "completed",
												name: item.name.startsWith("Analyzing")
													? paths[0].split(/[/\\]/).pop() || item.name
													: item.name,
											}
										: item,
								),
							);
						}
					})
					.catch((e: any) => {
						console.error(`Failed to resume torrent ${dl.name}:`, e);
					});
			});
		}
	}, []);

	useEffect(() => {
		if (activeTab === "network") {
			loadNetworkPeers();
		}
	}, [activeTab]);

	const loadNetworkPeers = async () => {
		if (!server || !token) {
			alert(
				"Please configure the Server URL and Token in the Configuration tab first.",
			);
			setActiveTab("settings");
			return;
		}
		setIsLoadingPeers(true);
		setNetworkPeers([]);
		setSelectedPeer(null);
		setPeerTracks([]);
		try {
			const res = await window.electronAPI.getNetworkPeers(server, token);
			const serverPeer = {
				id: "server",
				username: "TuneCamp Server (Catalog)",
				trackCount: 0,
			};
			// Federated instances' public catalogs (/api/catalog/full) — separate from
			// peer-daemon sessions above, and not gated by any admin opt-in.
			let federatedPeers: any[] = [];
			try {
				const sites = await window.electronAPI.getCommunitySites(server);
				federatedPeers = (sites || [])
					.filter((s: any) => s.federation !== "local")
					.map((s: any) => ({
						id: `fed_${s.url}`,
						username: s.name || s.url,
						origin: s.url,
						isCatalog: true,
						trackCount: 0,
					}));
			} catch (e: any) {
				console.error("Failed to load community sites:", e);
			}
			const allPeers = [serverPeer, ...federatedPeers, ...(res || [])];
			setNetworkPeers(allPeers);
			selectPeer(serverPeer);
		} catch (e: any) {
			console.error(e);
			alert("Failed to load network peers: " + (e.message || e));
		} finally {
			setIsLoadingPeers(false);
		}
	};

	const selectPeer = async (peer: any) => {
		setSelectedPeer(peer);
		setIsLoadingTracks(true);
		setPeerTracks([]);
		setNetworkQuery("");
		try {
			if (peer.id === "server") {
				const res = await window.electronAPI.getCatalogTracks(server, token);
				const mappedTracks = (res || []).map((t: any) => ({
					id: String(t.id),
					title: t.title,
					artist: t.artistName || "Unknown Artist",
					album: t.albumName || "Unknown Album",
					format: t.format || "mp3",
					// A release the artist is selling (or publishes as streaming-only)
					// still streams here, but its file is not ours to take.
					...resolveDownloadability({
						downloadable: t.downloadable,
						releaseDownload: t.album_download,
						releasePrice: t.album_price,
						releasePriceUsdc: t.album_price_usdc,
						releasePriceUsdt: t.album_price_usdt,
						trackPrice: t.price,
						trackPriceUsdc: t.price_usdc,
						trackPriceUsdt: t.price_usdt,
					}),
				}));
				setPeerTracks(mappedTracks);
				setNetworkPeers((prev) =>
					prev.map((p) =>
						p.id === "server" ? { ...p, trackCount: mappedTracks.length } : p,
					),
				);
			} else if (peer.isCatalog) {
				const catalog = await window.electronAPI.getFederatedCatalog(
					peer.origin,
				);
				const mappedTracks: any[] = [];
				for (const r of catalog?.releases || []) {
					for (const t of r.tracks || []) {
						mappedTracks.push({
							id: String(t.id),
							title: t.title,
							artist: t.artist_name || r.artist_name || "Unknown Artist",
							album: r.title || "Unknown Album",
							format: t.format || "mp3",
							...resolveDownloadability({
								downloadable: t.downloadable ?? r.downloadable,
								releaseDownload: r.download,
								releasePrice: r.price,
								releasePriceUsdc: r.price_usdc,
								releasePriceUsdt: r.price_usdt,
								trackPrice: t.price,
								trackPriceUsdc: t.price_usdc,
								trackPriceUsdt: t.price_usdt,
							}),
						});
					}
				}
				setPeerTracks(mappedTracks);
				setNetworkPeers((prev) =>
					prev.map((p) =>
						p.id === peer.id ? { ...p, trackCount: mappedTracks.length } : p,
					),
				);
			} else {
				const res = await window.electronAPI.getPeerTracks(
					server,
					token,
					peer.id,
					peer.origin,
				);
				// The daemon sharing these folders can switch downloads off per
				// track; the server refuses those anyway, so don't offer them.
				setPeerTracks(
					(res || []).map((t: any) => ({
						...t,
						...resolveDownloadability({ allowDownload: t.allow_download }),
					})),
				);
			}
		} catch (e: any) {
			console.error(e);
			alert("Failed to load tracks: " + (e.message || e));
		} finally {
			setIsLoadingTracks(false);
		}
	};

	const handleDownloadPeerTrack = async (track: any) => {
		if (!selectedPeer) return;
		// Belt and braces: the row's button is disabled for these, and the server
		// answers 402/403 regardless — this keeps a stray call from ever leaving.
		if (track.downloadable === false) {
			setDlLogs((prev) => [
				...prev,
				`[Network] ${track.artist} - ${track.title}: ${downloadRefusalHint(track.reason)}`,
			]);
			return;
		}
		const downloadId = track.id;
		const filename = `${track.artist} - ${track.title}`;

		setDownloadingTrackId(downloadId);
		setActiveDownloads((prev) => [
			...prev,
			{
				id: downloadId,
				name: filename,
				source: selectedPeer.id === "server" ? "server" : "network",
				status: "downloading",
			},
		]);
		const logPrefix =
			selectedPeer.id === "server"
				? "[Catalog]"
				: selectedPeer.isCatalog
					? "[Federated]"
					: "[Network]";
		setDlLogs((prev) => [
			...prev,
			`${logPrefix} Starting download of: ${filename}...`,
		]);

		try {
			let filePath = "";
			if (selectedPeer.id === "server") {
				filePath = await window.electronAPI.downloadCatalogTrack(
					server,
					token,
					track.id,
					track.artist,
					track.title,
					downloadId,
				);
			} else if (selectedPeer.isCatalog) {
				filePath = await window.electronAPI.downloadFederatedCatalogTrack(
					selectedPeer.origin,
					track.id,
					track.artist,
					track.title,
					downloadId,
				);
			} else {
				filePath = await window.electronAPI.downloadPeerTrack(
					server,
					token,
					selectedPeer.id,
					track.id,
					track.artist,
					track.title,
					selectedPeer.origin,
					downloadId,
				);
			}
			setDlLogs((prev) => [
				...prev,
				`${logPrefix} Download completed! Saved to: ${filePath}`,
			]);
			setActiveDownloads((prev) =>
				prev.map((d) =>
					d.id === downloadId ? { ...d, status: "completed" } : d,
				),
			);
			if (autoUpload && filePath) handleUploadFileAuto(filePath);
		} catch (e: any) {
			setDlLogs((prev) => [
				...prev,
				`${logPrefix} Error during download: ${e.message || e}`,
			]);
			setActiveDownloads((prev) =>
				prev.map((d) => (d.id === downloadId ? { ...d, status: "failed" } : d)),
			);
		} finally {
			setDownloadingTrackId(null);
			// Removed setTimeout to keep items in queue for the Transfers tab
		}
	};

	// Audio Player Controls
	const startPlayback = async (
		name: string,
		src: string,
		displayPath: string,
	) => {
		setCurrentPlayback({ name, path: displayPath });
		setIsPlaying(true);
		// Reset so the previous track's time/duration doesn't linger on the new one.
		setCurrentTime(0);
		setDuration(0);
		setIsSeeking(false);
		if (!audioRef.current) return;
		// media:// and stream:// are custom Electron protocol schemes the mobile
		// WebView can't resolve — the Capacitor adapter turns them into a real
		// playable URL (native file src / blob URL); no-op on Electron.
		const resolvedSrc = isCapacitor
			? await window.electronAPI.resolvePlaybackSrc(src)
			: src;
		audioRef.current.src = resolvedSrc;
		// AbortError fires whenever a newer load pre-empts this one (fast skip) — expected, not a real failure.
		audioRef.current.play().catch((e) => {
			if (e.name !== "AbortError") console.error("Playback failed:", e);
		});
	};

	const playAt = (
		tracks: { name: string; src: string; path: string }[],
		index: number,
	) => {
		const t = tracks[index];
		if (!t) return;
		setQueue(tracks);
		setQueueIndex(index);
		startPlayback(t.name, t.src, t.path);
	};

	const playNext = () => {
		if (queueIndex + 1 < queue.length) playAt(queue, queueIndex + 1);
	};

	const playPrev = () => {
		if (queueIndex > 0) playAt(queue, queueIndex - 1);
	};

	const libraryQueueItem = (file: { name: string; path: string }) => ({
		name: file.name.split(/[/\\]/).pop() || file.name,
		src: `media://${encodeURIComponent(file.path)}`,
		path: file.path,
	});

	const networkQueueItem = (peer: any, track: any) => {
		// Federated-catalog tracks stream directly from the remote instance's public
		// endpoint — no local server tunnel, no local token involved.
		if (peer.isCatalog) {
			const streamUrl = `${peer.origin.replace(/\/$/, "")}/api/tracks/${track.id}/stream`;
			return {
				name: `${track.artist} - ${track.title}`,
				src: `stream://audio?url=${encodeURIComponent(streamUrl)}&token=`,
				path: `${peer.username} (Federated)`,
			};
		}
		const cleanServer = server.replace(/\/$/, "");
		const streamUrl =
			peer.id === "server"
				? `${cleanServer}/api/tracks/${track.id}/stream`
				: `${cleanServer}/api/peers/${peer.id}/tracks/${track.id}/stream`;
		return {
			name: `${track.artist} - ${track.title}`,
			src: `stream://audio?url=${encodeURIComponent(streamUrl)}&token=${encodeURIComponent(token)}`,
			path: `${peer.username} (Network)`,
		};
	};

	const playNetworkTrack = (peer: any, track: any) => {
		const idx = peerTracks.indexOf(track);
		const list = idx >= 0 ? peerTracks : [track];
		playAt(
			list.map((t) => networkQueueItem(peer, t)),
			Math.max(idx, 0),
		);
	};

	// Only exempt the renderer from Chromium's background throttling while a track
	// is actually playing, so uninterrupted audio in the background doesn't leave
	// the window pegged (and Windows flagging it "Not Responding") while idle.
	useEffect(() => {
		window.electronAPI?.setBackgroundThrottling?.(!isPlaying);
	}, [isPlaying]);

	const togglePlay = () => {
		if (!audioRef.current) return;
		if (isPlaying) {
			audioRef.current.pause();
			setIsPlaying(false);
		} else {
			// AbortError fires whenever a newer load pre-empts this one (fast skip) — expected, not a real failure.
			audioRef.current.play().catch((e) => {
				if (e.name !== "AbortError") console.error("Playback failed:", e);
			});
			setIsPlaying(true);
		}
	};

	const handleClearCategoryLogs = (cat: LogCategory) => {
		if (cat === "all") {
			setDlLogs([]);
			setLogs([]);
		} else if (cat === "library") {
			setDlLogs((prev) => prev.filter((l) => !l.includes("[Library]")));
		} else if (cat === "downloads") {
			setDlLogs((prev) => prev.filter((l) => l.includes("[Library]")));
		} else if (cat === "peer") {
			setLogs([]);
		}
	};

	const commitSeek = (targetTime: number) => {
		if (!audioRef.current || !isFinite(targetTime)) {
			setIsSeeking(false);
			return;
		}
		// Clamp safely within valid duration bounds.
		// Leave a small buffer before duration so seeking to the very end
		// doesn't trigger an instantaneous premature onEnded cut-off.
		const maxSafe = duration > 1 ? duration - 0.2 : Math.max(0, duration);
		const clamped = Math.max(0, Math.min(targetTime, maxSafe));
		try {
			audioRef.current.currentTime = clamped;
		} catch (err) {
			console.warn("Failed setting audio currentTime:", err);
		}
		setCurrentTime(clamped);
		setIsSeeking(false);

		if (isPlaying && audioRef.current.paused) {
			audioRef.current.play().catch((e) => {
				if (e.name !== "AbortError") console.error("Playback resume failed:", e);
			});
		}
	};

	const handleSeekChange = (time: number) => {
		setCurrentTime(time);
	};

	// Commit from the slider's own value (not state) so a fast drag can't land
	// on a stale position.
	const handleSeekCommit = (e: React.SyntheticEvent<HTMLInputElement>) => {
		const val = parseFloat((e.target as HTMLInputElement).value);
		commitSeek(val);
	};

	const handlePlayerWheel = (e: React.WheelEvent) => {
		if (!audioRef.current || !duration) return;
		e.preventDefault();
		e.stopPropagation();
		const delta = e.deltaY !== 0 ? -Math.sign(e.deltaY) : Math.sign(e.deltaX);
		const step = 5;
		const current = audioRef.current.currentTime || currentTime;
		commitSeek(current + delta * step);
	};

	const handleVolumeChange = (vol: number) => {
		if (!audioRef.current) return;
		audioRef.current.volume = vol;
		setVolume(vol);
	};

	const stopPlayback = () => {
		if (audioRef.current) {
			audioRef.current.pause();
			audioRef.current.src = "";
		}
		setCurrentPlayback(null);
		setIsPlaying(false);
		setCurrentTime(0);
		setDuration(0);
		setQueue([]);
		setQueueIndex(-1);
	};

	const formatTime = (secs: number) => {
		if (!isFinite(secs) || isNaN(secs)) return "0:00";
		const m = Math.floor(secs / 60);
		const s = Math.floor(secs % 60);
		return `${m}:${s < 10 ? "0" : ""}${s}`;
	};

	const handleStartPeer = async () => {
		await window.electronAPI.startPeer({
			server,
			token,
			folders: folder
				.split(/[,;]/)
				.map((f) => f.trim())
				.filter(Boolean),
			allowDownloads: true,
		});
	};

	const handleStopPeer = async () => {
		await window.electronAPI.stopPeer();
	};

	const loadBrowser = async (root: string, subpath: string) => {
		setBrowserError("");
		setBrowserSearch("");
		const res = await window.electronAPI.listSharedDir(root, subpath);
		if (res.error) {
			setBrowserError(res.error);
			setBrowserEntries([]);
			return;
		}
		setBrowserEntries(res.entries || []);
	};

	const selectBrowserRoot = (root: string) => {
		setBrowserRoot(root);
		setBrowserPath("");
		loadBrowser(root, "");
	};

	const openBrowserFolder = (name: string) => {
		const next = browserPath ? `${browserPath}/${name}` : name;
		setBrowserPath(next);
		loadBrowser(browserRoot, next);
	};

	const browserGoUp = () => {
		if (!browserPath) return;
		const parts = browserPath.split("/").filter(Boolean);
		parts.pop();
		const next = parts.join("/");
		setBrowserPath(next);
		loadBrowser(browserRoot, next);
	};

	const handleCreateFolder = async () => {
		if (!browserRoot || !newFolderName.trim()) return;
		const res = await window.electronAPI.mkdirShared(
			browserRoot,
			browserPath,
			newFolderName,
		);
		if (res.error) {
			setBrowserError(res.error);
			return;
		}
		setNewFolderName("");
		loadBrowser(browserRoot, browserPath);
	};

	const handleDeleteEntry = async (name: string, isDir: boolean) => {
		if (
			!window.confirm(
				`Delete ${isDir ? "folder" : "file"} "${name}"${isDir ? " and all its contents" : ""}? This cannot be undone.`,
			)
		)
			return;
		const res = await window.electronAPI.deleteShared(
			browserRoot,
			browserPath,
			name,
			isDir,
		);
		if (res.error) {
			setBrowserError(res.error);
			return;
		}
		loadBrowser(browserRoot, browserPath);
	};

	const uploadFile = async (
		filePath: string,
		meta: { artist: string; title: string; album?: string },
		tag: string,
	) => {
		if (!server || !token) {
			setDlLogs((prev) => [
				...prev,
				`[${tag}] Server/Token not configured, skipping upload.`,
			]);
			return false;
		}
		setDlLogs((prev) => [...prev, `[${tag}] Uploading ${meta.title}...`]);
		try {
			await window.electronAPI.setUploadConfig(server, token);
			await window.electronAPI.uploadTrack(filePath, meta);
			setDlLogs((prev) => [...prev, `[${tag}] Upload completed successfully!`]);
			return true;
		} catch (e: any) {
			setDlLogs((prev) => [
				...prev,
				`[${tag}] Upload failed: ${e.message || e}`,
			]);
			throw e;
		}
	};

	const handleUploadFileAuto = (filePath: string) => {
		const filename = filePath.split(/[/\\]/).pop() || "";
		const { artist, title } = cleanTrackMetadata(filename);
		uploadFile(filePath, { artist: artist || "Sidecamp", title }, "Auto-Upload").catch(
			() => {},
		);
	};

	const handleMoveHere = async () => {
		if (!movingItem) return;
		const res = await window.electronAPI.moveShared(
			movingItem.root,
			movingItem.path,
			movingItem.name,
			browserRoot,
			browserPath,
		);
		if (res.error) {
			setBrowserError(res.error);
			return;
		}
		setMovingItem(null);
		loadBrowser(browserRoot, browserPath);
	};

	const handleSearch = async () => {
		setDlLogs((prev) => [
			...prev,
			`[Search] Starting search for "${searchQuery}" on ${searchSource.toUpperCase()}...`,
		]);
		try {
			let res: any[] = [];
			if (searchSource === "all") {
				const promises = [
					...(isCapacitor
						? []
						: [
								window.electronAPI
									.slskSearch(searchQuery)
									.then((res: any[]) =>
										res.map((r: any) => ({ ...r, source: "soulseek" })),
									)
									.catch((e: any) => {
										console.error("Soulseek search failed:", e);
										return [];
									}),
							]),
					window.electronAPI
						.searchWeb(searchQuery, "soundcloud")
						.then((res: any[]) =>
							res.map((r: any) => ({ ...r, source: "soundcloud" })),
						)
						.catch((e: any) => {
							console.error("SoundCloud search failed:", e);
							return [];
						}),
					window.electronAPI
						.searchWeb(searchQuery, "bandcamp")
						.then((res: any[]) =>
							res.map((r: any) => ({ ...r, source: "bandcamp" })),
						)
						.catch((e: any) => {
							console.error("Bandcamp search failed:", e);
							return [];
						}),
					window.electronAPI
						.searchWeb(searchQuery, "torrent", server, token)
						.then((res: any[]) =>
							res.map((r: any) => ({ ...r, source: "torrent_search" })),
						)
						.catch((e: any) => {
							console.error("Torrent search failed:", e);
							return [];
						}),
					window.electronAPI
						.searchWeb(searchQuery, "network", server, token)
						.catch((e: any) => {
							console.error("Network search failed:", e);
							return [];
						}),
					window.electronAPI
						.searchWeb(searchQuery, "archive")
						.then((res: any[]) =>
							res.map((r: any) => ({ ...r, source: "archive" })),
						)
						.catch((e: any) => {
							console.error("Archive.org search failed:", e);
							return [];
						}),
					window.electronAPI
						.searchWeb(searchQuery, "youtube")
						.then((res: any[]) =>
							res.map((r: any) => ({ ...r, source: "youtube" })),
						)
						.catch((e: any) => {
							console.error("YouTube search failed:", e);
							return [];
						}),
				];

				const settled = await Promise.allSettled(promises);
				const aggregated: any[] = [];
				settled.forEach((s) => {
					if (s.status === "fulfilled") {
						aggregated.push(...s.value);
					}
				});
				res = aggregated;
			} else if (searchSource === "soulseek") {
				res = await window.electronAPI.slskSearch(searchQuery);
				res = res.map((r) => ({ ...r, source: "soulseek" }));
			} else {
				res = await window.electronAPI.searchWeb(
					searchQuery,
					searchSource,
					server,
					token,
				);
			}
			setSearchResults(res);
			setDlLogs((prev) => [
				...prev,
				`[Search] Search completed! Found ${res.length} results.`,
			]);
		} catch (err: any) {
			setDlLogs((prev) => [
				...prev,
				`[Search] Error during search: ${err.message || err}`,
			]);
		}
	};

	const handleDownload = async (result: any) => {
		// Mirrors the Network tab's guard: a TuneCamp result whose release is on
		// sale, streaming-only or sold elsewhere is not ours to fetch. The server
		// refuses it too (402/403) — this keeps the attempt from being made.
		if (
			result.source === "catalog" ||
			result.source === "instance" ||
			result.source === "peer"
		) {
			const verdict = resolveDownloadability(result);
			if (!verdict.downloadable) {
				setDlLogs((prev) => [
					...prev,
					`[${String(result.source).toUpperCase()}] ${result.artist} - ${result.title}: ${downloadRefusalHint(verdict.reason)}`,
				]);
				return;
			}
		}

		const downloadId = result.id;
		const source = result.source || "soulseek";
		const filename =
			result.title ||
			(result.file && result.file.split(/[/\\]/).pop()) ||
			"Track";

		setActiveDownloads((prev) => [
			...prev,
			{
				id: downloadId,
				name: filename,
				source: source,
				status: "downloading",
				magnetUri: result.url || result.magnetUri,
			},
		]);

		setDlLogs((prev) => [
			...prev,
			`[${source.toUpperCase()}] Starting download of: ${filename}...`,
		]);
		try {
			let filePath = "";
			if (
				source === "soundcloud" ||
				source === "bandcamp" ||
				source === "archive" ||
				source === "youtube"
			) {
				filePath = await window.electronAPI.ytdlpDownload(
					result.url,
					downloadId,
				);
			} else if (source === "torrent_search") {
				const paths = await window.electronAPI.torrentDownload(
					result.url,
					downloadId,
				);
				filePath = paths.length > 0 ? paths[0] : "";
			} else if (source === "peer") {
				filePath = await window.electronAPI.downloadPeerTrack(
					server,
					token,
					result.sessionId,
					result.trackId,
					result.artist,
					result.title,
					result.origin,
					downloadId,
				);
			} else if (source === "catalog") {
				filePath = await window.electronAPI.downloadCatalogTrack(
					server,
					token,
					result.trackId,
					result.artist,
					result.title,
					downloadId,
				);
			} else if (source === "instance") {
				filePath = await window.electronAPI.downloadFederatedCatalogTrack(
					result.origin,
					result.trackId,
					result.artist,
					result.title,
					downloadId,
				);
			} else {
				filePath = await window.electronAPI.slskDownload(result);
			}
			setDlLogs((prev) => [
				...prev,
				`[${source.toUpperCase()}] Download completed! Saved to: ${filePath}`,
			]);
			setActiveDownloads((prev) =>
				prev.map((d) =>
					d.id === downloadId ? { ...d, status: "completed" } : d,
				),
			);
			if (autoUpload && filePath) handleUploadFileAuto(filePath);
		} catch (err: any) {
			// The user cancelled; handleCancelTorrent already dropped the row.
			if (isCancelledTorrent(err)) return;
			setDlLogs((prev) => [
				...prev,
				`[${source.toUpperCase()}] Error during download: ${err.message || err}`,
			]);
			setActiveDownloads((prev) =>
				prev.map((d) => (d.id === downloadId ? { ...d, status: "failed" } : d)),
			);
		} finally {
			// Removed setTimeout to keep items in queue for the Transfers tab
		}
	};

	const handleDirectDownload = async () => {
		if (!directUrl) return;
		setIsDownloading(true);
		setDlProgress(null);
		setDlLogs([]);

		const tempId = "direct_" + Date.now();
		const isTorrent =
			directUrl.startsWith("magnet:?") || directUrl.endsWith(".torrent");

		setActiveDownloads((prev) => [
			...prev,
			{
				id: tempId,
				name: isTorrent ? "Analyzing Torrent..." : directUrl,
				source: isTorrent ? "torrent" : "web",
				status: "downloading",
				magnetUri: isTorrent ? directUrl : undefined,
			},
		]);

		setDlLogs((prev) => [
			...prev,
			`Starting direct download for: ${directUrl}`,
		]);
		try {
			let resultPaths: string[] = [];
			if (isTorrent) {
				setDlLogs((prev) => [
					...prev,
					`Magnet Torrent link detected. Starting download...`,
				]);
				resultPaths = await window.electronAPI.torrentDownload(
					directUrl,
					tempId,
				);
				setDlLogs((prev) => [
					...prev,
					`Torrent download completed! Downloaded ${resultPaths.length} files.`,
				]);
			} else {
				setDlLogs((prev) => [
					...prev,
					`Web URL detected (SoundCloud/Bandcamp/YouTube/etc.). Starting extraction with YT-DLP...`,
				]);
				const singlePath = await window.electronAPI.ytdlpDownload(
					directUrl,
					tempId,
				);
				resultPaths = [singlePath];
				setDlLogs((prev) => [
					...prev,
					`Download completed! File: ${singlePath}`,
				]);
			}

			setActiveDownloads((prev) =>
				prev.map((d) =>
					d.id === tempId ||
					(d.source === "torrent" && d.status === "downloading")
						? {
								...d,
								status: "completed",
								name:
									d.name.startsWith("Analyzing") && resultPaths.length > 0
										? resultPaths[0].split(/[/\\]/).pop()
										: d.name,
							}
						: d,
				),
			);
			if (autoUpload) resultPaths.forEach((p) => p && handleUploadFileAuto(p));
		} catch (err: any) {
			// The user cancelled; handleCancelTorrent already dropped the row.
			if (isCancelledTorrent(err)) return;
			setDlLogs((prev) => [
				...prev,
				`Error during process: ${err.message || err}`,
			]);
			setActiveDownloads((prev) =>
				prev.map((d) => (d.id === tempId ? { ...d, status: "failed" } : d)),
			);
		} finally {
			setIsDownloading(false);
			setDlProgress(null);
			setDirectUrl("");
			// Removed setTimeout to keep items in queue for the Transfers tab
		}
	};

	const purgeFailedDownloads = () => {
		setActiveDownloads((prev) => prev.filter((d) => d.status !== "failed"));
	};

	const clearDownloadItem = (id: string) => {
		setActiveDownloads((prev) => prev.filter((d) => d.id !== id));
	};

	const handleStopTorrent = async (infoHash: string) => {
		try {
			await window.electronAPI.removeTorrent(infoHash);
			setActiveDownloads((prev) =>
				prev.map((d) =>
					d.infoHash === infoHash || d.id === infoHash
						? { ...d, status: "failed" }
						: d,
				),
			);
			setDlLogs((prev) => [
				...prev,
				`[Library] Torrent stopped: ${infoHash.substring(0, 8)}...`,
			]);
		} catch (e: any) {
			console.error("Error removing torrent:", e);
		}
	};

	/**
	 * A cancelled download rejects its pending `torrentDownload` call. Electron
	 * wraps the reason in its own message, so match on the substring rather
	 * than comparing. Callers use this to stay quiet instead of reporting a
	 * transfer the user stopped on purpose as a failure.
	 */
	const isCancelledTorrent = (e: any) =>
		String(e?.message || e).includes("TORRENT_CANCELLED");

	/**
	 * Cancel a transfer that is still downloading. Unlike "Stop Seeding" this
	 * drops the row outright — a half-finished torrent the user cancelled is
	 * not a failure to retry, and leaving it listed as one invites a Resume
	 * that restarts exactly what was just stopped.
	 *
	 * Targets `id` before `infoHash`: a torrent cancelled before its metadata
	 * arrived has no infoHash yet, and the main process indexes in-flight
	 * downloads under both.
	 *
	 * Passes `deleteFiles` — the partial data is an unplayable fragment, and
	 * leaving it behind means the next Resume of the same magnet inherits it
	 * silently. "Stop Seeding" deliberately does not pass it: there the files
	 * are a finished download.
	 */
	const handleCancelTorrent = async (dl: any) => {
		const label = dl.name || dl.id;
		if (
			!confirm(
				`Cancel the download of "${label}"?\n\nThe partially downloaded data will be deleted.`,
			)
		)
			return;
		try {
			await window.electronAPI.removeTorrent(dl.id || dl.infoHash, true);
			setDlLogs((prev) => [
				...prev,
				`[Torrent] Download cancelled and partial data deleted: ${label}`,
			]);
		} catch (e: any) {
			console.error("Error cancelling torrent:", e);
			setDlLogs((prev) => [
				...prev,
				`[Torrent] Cancel failed for ${label}: ${e.message || e}`,
			]);
		}
		// Off the list either way: if remove() failed the torrent is in a state
		// the row can no longer act on.
		setActiveDownloads((prev) => prev.filter((d) => d.id !== dl.id));
	};

	const handleResumeTorrent = async (dl: any) => {
		if (!dl.magnetUri) {
			alert("No magnet link available to resume this transfer.");
			return;
		}
		setDlLogs((prev) => [...prev, `[Torrent] Resuming torrent: ${dl.name}...`]);
		setActiveDownloads((prev) =>
			prev.map((d) => (d.id === dl.id ? { ...d, status: "downloading" } : d)),
		);
		try {
			const paths = await window.electronAPI.torrentDownload(
				dl.magnetUri,
				dl.id,
			);
			if (paths.length > 0) {
				setActiveDownloads((prev) =>
					prev.map((d) =>
						d.id === dl.id
							? {
									...d,
									status: "completed",
									name: d.name.startsWith("Analyzing")
										? paths[0].split(/[/\\]/).pop() || d.name
										: d.name,
								}
							: d,
					),
				);
			}
		} catch (e: any) {
			// Cancelling is handled by handleCancelTorrent, which already
			// dropped the row; marking it failed here would resurrect it.
			if (isCancelledTorrent(e)) return;
			setActiveDownloads((prev) =>
				prev.map((d) => (d.id === dl.id ? { ...d, status: "failed" } : d)),
			);
			setDlLogs((prev) => [
				...prev,
				`[Torrent] Resume failed for ${dl.name}: ${e.message || e}`,
			]);
		}
	};

	const handleSaveSettings = async () => {
		localStorage.setItem("tc_server", server);
		localStorage.setItem("tc_token", token);
		localStorage.setItem("slsk_user", slskUser);
		localStorage.setItem(
			"slsk_pass",
			slskPass ? await window.electronAPI.encryptString(slskPass) : "",
		);
		localStorage.setItem("shared_folders", folder);
		await window.electronAPI.configSet("torrentPort", torrentPort);
		await window.electronAPI.configSet("libraryDir", libraryDir);

		setDlLogs((prev) => [
			...prev,
			`[${new Date().toLocaleTimeString()}] Connecting to Soulseek...`,
		]);
		const connected = await window.electronAPI.slskConnect(slskUser, slskPass);
		if (connected) {
			setDlLogs((prev) => [
				...prev,
				`[${new Date().toLocaleTimeString()}] Successfully connected to Soulseek.`,
			]);
		} else {
			setDlLogs((prev) => [
				...prev,
				`[${new Date().toLocaleTimeString()}] Soulseek connection failed (check credentials).`,
			]);
		}

		setSettingsSaved(true);
		setTimeout(() => setSettingsSaved(false), 3000);
	};

	const validFolders = folder
		.split(/[,;]/)
		.map((f) => f.trim())
		.filter(Boolean);
	const libraryLogs = useMemo(
		() => dlLogs.filter((log) => log.includes("[Library]")),
		[dlLogs],
	);

	const browserRoots = [
		...(downloadsDir ? [{ label: "Downloads", path: downloadsDir }] : []),
		...validFolders.map((f) => ({
			label: f.split(/[/\\]/).pop() || f,
			path: f,
		})),
	];

	useEffect(() => {
		if (activeTab === "peer" && browserRoots.length > 0 && !browserRoot) {
			selectBrowserRoot(browserRoots[0].path);
		}
	}, [activeTab, downloadsDir]);

	useEffect(() => {
		document.documentElement.dataset.theme = theme;
		document.documentElement.style.colorScheme = ["light", "nordic"].includes(
			theme,
		)
			? "light"
			: "dark";
		localStorage.setItem("theme", theme);
	}, [theme]);

	const handleBrowseFolder = async () => {
		const dir = await window.electronAPI.pickFolder();
		if (dir) {
			setFolder((prev) => (prev ? `${prev}, ${dir}` : dir));
		}
	};

	const handleBrowseLibraryDir = async () => {
		const dir = await window.electronAPI.pickFolder();
		if (dir) setLibraryDir(dir);
	};

	if (!hasConnected) {
		return (
			<ConnectScreen
				onConnected={(connectedServer, connectedToken) => {
					setServer(connectedServer);
					setToken(connectedToken);
					localStorage.setItem("tc_server", connectedServer);
					localStorage.setItem("tc_token", connectedToken);
					setHasConnected(true);
				}}
			/>
		);
	}

	return (
		<div className="app-container">
			<div className={`sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
				<div className="logo-container">
					<img src={logo} className="logo-img" alt="Sidecamp Logo" />
					{!sidebarCollapsed && <h1>Sidecamp</h1>}
					<button
						className="sidebar-toggle"
						onClick={() => setSidebarCollapsed((c) => !c)}
						title={sidebarCollapsed ? "Expand" : "Collapse"}
					>
						<PanelLeft size={18} />
					</button>
				</div>

				<nav className="nav-menu">
					{!isCapacitor && (
						<button
							className={`nav-item ${activeTab === "download" ? "active" : ""}`}
							onClick={() => setActiveTab("download")}
							title="Search & Download"
						>
							<span className="icon">
								<Download size={18} />
							</span>
							<span className="nav-label">Search</span>
						</button>
					)}
					<button
						className={`nav-item ${activeTab === "network" ? "active" : ""}`}
						onClick={() => setActiveTab("network")}
						title="Network"
					>
						<span className="icon">
							<Globe size={18} />
						</span>
						<span className="nav-label">Network</span>
					</button>
					<button
						className={`nav-item ${activeTab === "peer" ? "active" : ""}`}
						onClick={() => setActiveTab("peer")}
						title="Sharing — peer node & shared files"
					>
						<span className="icon">
							<Radio size={18} />
						</span>
						<span className="nav-label">Sharing</span>
					</button>
					{!isCapacitor && (
						<button
							className={`nav-item ${activeTab === "upload" ? "active" : ""}`}
							onClick={() => setActiveTab("upload")}
							title="Upload to TuneCamp"
						>
							<span className="icon">
								<Upload size={18} />
							</span>
							<span className="nav-label">Upload</span>
						</button>
					)}
					<button
						className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
						onClick={() => setActiveTab("settings")}
						title="Settings"
					>
						<span className="icon">
							<Settings size={18} />
						</span>
						<span className="nav-label">Settings</span>
					</button>
				</nav>

				<button
					type="button"
					className="theme-selector-btn"
					onClick={cycleTheme}
					title={`Theme: ${theme.toUpperCase()} (Click to cycle)`}
				>
					<Palette size={16} style={{ flexShrink: 0 }} />
					{!sidebarCollapsed && (
						<span className="theme-label" style={{ textTransform: "capitalize" }}>
							{theme.replace("-", " ")}
						</span>
					)}
				</button>

				<div className="status-indicator">
					<div className={`status-dot ${peerStatus}`}></div>
					{!sidebarCollapsed && <span>{peerStatus.toUpperCase()}</span>}
				</div>
			</div>

			<main className="main-content">
				<header className="app-header">
					<div className="app-header-left">
						<h2 className="app-header-title">
							{activeTab === "download" && (
								<>
									<Download size={20} style={{ color: "var(--primary)" }} />
									<span>Search & Download</span>
								</>
							)}
							{activeTab === "network" && (
								<>
									<Globe size={20} style={{ color: "var(--accent)" }} />
									<span>P2P Network</span>
								</>
							)}
							{activeTab === "peer" && (
								<>
									<Radio size={20} style={{ color: "var(--primary)" }} />
									<span>Shared Files</span>
								</>
							)}
							{activeTab === "upload" && (
								<>
									<Upload size={20} style={{ color: "var(--primary)" }} />
									<span>Upload to TuneCamp</span>
								</>
							)}
							{activeTab === "settings" && (
								<>
									<Settings size={20} style={{ color: "var(--text-muted)" }} />
									<span>Settings</span>
								</>
							)}
						</h2>
					</div>
					<div className="app-header-right">
						<button
							type="button"
							className="header-action-btn"
							onClick={cycleTheme}
							title="Switch color theme"
						>
							<Palette size={15} />
							<span style={{ textTransform: "capitalize" }}>{theme.replace("-", " ")}</span>
						</button>
						<div
							className="status-indicator"
							style={{ padding: "0.35rem 0.75rem", fontSize: "0.74rem" }}
						>
							<div className={`status-dot ${peerStatus}`} />
							<span>{peerStatus.toUpperCase()}</span>
						</div>
					</div>
				</header>

				<div className="content-area">
					{update?.updateAvailable && !updateDismissed && (
						<div
							className="glass-card"
							style={{
								display: "flex",
								alignItems: "center",
								gap: "10px",
								padding: "0.6rem 1rem",
								marginBottom: "1rem",
							}}
						>
							<ArrowUpCircle
								size={18}
								style={{ color: "var(--accent, #4ade80)", flexShrink: 0 }}
							/>
							<span style={{ flex: 1, fontSize: "0.9rem" }}>
								Sidecamp <strong>{update.latestVersion}</strong> is available
								(you have {update.currentVersion}).
							</span>
							<Button
								variant="primary"
								style={{ padding: "0.35rem 0.8rem", fontSize: "0.8rem" }}
								onClick={() => window.electronAPI.openReleasesPage()}
							>
								Download
							</Button>
							<Button
								variant="secondary"
								style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }}
								onClick={() => setUpdateDismissed(true)}
								title="Dismiss"
							>
								<X size={14} />
							</Button>
						</div>
					)}
					{activeTab === "peer" && (
						<div className="glass-card">
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "1rem",
								}}
							>
								<h3 style={{ margin: 0, fontSize: "1.15rem", fontFamily: "var(--font-headings)" }}>
									Shared Files
								</h3>
							</div>
							{browserRoots.length === 0 && (
								<div
									style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "1rem 0" }}
								>
									No folders yet. Add shared folders in the "Configuration" tab.
								</div>
							)}
							{browserRoots.length > 0 && (
								<>
									<div
										style={{
											display: "flex",
											gap: "8px",
											flexWrap: "wrap",
											marginBottom: "1rem",
										}}
									>
										{browserRoots.map((r, i) => {
											const isRootActive = browserRoot === r.path;
											return (
												<button
													key={i}
													type="button"
													className={`platform-chip ${isRootActive ? "active" : ""}`}
													style={{ padding: "6px 14px", fontSize: "0.82rem" }}
													onClick={() => selectBrowserRoot(r.path)}
												>
													<Folder size={14} /> {r.label}
												</button>
											);
										})}
									</div>
									{browserRoot && (
										<>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "8px",
													marginBottom: "0.85rem",
													background: "rgba(255, 255, 255, 0.03)",
													padding: "6px 10px",
													borderRadius: "10px",
													border: "1px solid var(--glass-border)",
													fontSize: "0.82rem",
													color: "var(--text-muted)",
												}}
											>
												<Button
													variant="secondary"
													style={{
														padding: "0.3rem 0.65rem",
														fontSize: "0.78rem",
														borderRadius: "8px",
													}}
													onClick={browserGoUp}
													disabled={!browserPath}
												>
													<ChevronUp size={13} /> Up
												</Button>
												<span style={{ fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
													{browserRoot.split(/[/\\]/).pop() || browserRoot}
													{browserPath
														? " / " + browserPath.replace(/\//g, " / ")
														: ""}
												</span>
											</div>
											{movingItem && (
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "10px",
														flexWrap: "wrap",
														padding: "0.65rem 0.9rem",
														marginBottom: "1rem",
														background: "rgba(217, 70, 239, 0.12)",
														border: "1px solid var(--primary)",
														borderRadius: "10px",
														fontSize: "0.85rem",
													}}
												>
													<span>
														Moving <strong>{movingItem.name}</strong> — navigate
														to destination:
													</span>
													<Button
														variant="primary"
														style={{
															padding: "0.3rem 0.75rem",
															fontSize: "0.8rem",
														}}
														onClick={handleMoveHere}
													>
														Move here
													</Button>
													<Button
														variant="secondary"
														style={{
															padding: "0.3rem 0.75rem",
															fontSize: "0.8rem",
														}}
														onClick={() => setMovingItem(null)}
													>
														Cancel
													</Button>
												</div>
											)}
											<div
												style={{
													display: "flex",
													gap: "8px",
													marginBottom: "0.85rem",
												}}
											>
												<input
													type="text"
													value={newFolderName}
													onChange={(e) => setNewFolderName(e.target.value)}
													placeholder="New subfolder name..."
													className="glass-input"
													style={{ flex: 1, padding: "0.55rem 0.85rem", fontSize: "0.85rem", borderRadius: "10px" }}
													onKeyDown={(e) =>
														e.key === "Enter" && handleCreateFolder()
													}
												/>
												<Button
													variant="primary"
													onClick={handleCreateFolder}
													disabled={!newFolderName.trim()}
													style={{
														display: "flex",
														alignItems: "center",
														gap: "6px",
														padding: "0.55rem 0.9rem",
														fontSize: "0.85rem",
														borderRadius: "10px",
														flexShrink: 0,
													}}
												>
													<FolderPlus size={15} /> Create
												</Button>
											</div>
											{browserError && (
												<div
													style={{
														color: "#e74c3c",
														fontSize: "0.85rem",
														marginBottom: "0.75rem",
													}}
												>
													{browserError}
												</div>
											)}
											{browserEntries.length > 0 && (
												<input
													type="text"
													value={browserSearch}
													onChange={(e) => setBrowserSearch(e.target.value)}
													placeholder="Filter in this folder…"
													className="glass-input"
													style={{
														width: "100%",
														marginBottom: "0.75rem",
														padding: "0.5rem 0.85rem",
														fontSize: "0.85rem",
														borderRadius: "10px",
													}}
												/>
											)}
											{/* Scrollable folder list */}
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													gap: "6px",
													maxHeight: "50vh",
													overflowY: "auto",
													paddingRight: "4px",
												}}
											>
												{(() => {
													const visible = browserEntries.filter((en) =>
														en.name
															.toLowerCase()
															.includes(browserSearch.toLowerCase().trim()),
													);
													const isAudio = (n: string) =>
														/\.(mp3|flac|wav|ogg|m4a|mp4|webm)$/i.test(n);
													const audio = visible.filter(
														(en) => !en.isDir && isAudio(en.name),
													);
													const browserQueue = audio.map((en) =>
														libraryQueueItem({
															name: en.name,
															path: `${browserRoot}${browserPath ? "/" + browserPath : ""}/${en.name}`,
														}),
													);
													return visible.map((en, i) => (
														<div
															key={i}
															style={{
																display: "flex",
																alignItems: "center",
																justifyContent: "space-between",
																gap: "8px",
																padding: "0.6rem 0.85rem",
																background: "rgba(255, 255, 255, 0.03)",
																border: "1px solid var(--glass-border)",
																borderRadius: "10px",
																transition: "all 0.15s ease",
															}}
														>
															<div
																onClick={() =>
																	en.isDir
																		? openBrowserFolder(en.name)
																		: isAudio(en.name) &&
																			playAt(browserQueue, audio.indexOf(en))
																}
																title={
																	en.isDir
																		? "Open folder"
																		: isAudio(en.name)
																			? "Play"
																			: undefined
																}
																style={{
																	display: "flex",
																	alignItems: "center",
																	gap: "10px",
																	flex: 1,
																	minWidth: 0,
																	minHeight: "36px",
																	cursor:
																		en.isDir || isAudio(en.name)
																			? "pointer"
																			: "default",
																}}
															>
																<span
																	style={{
																		display: "inline-flex",
																		alignItems: "center",
																		justifyContent: "center",
																		width: "28px",
																		height: "28px",
																		borderRadius: "6px",
																		background: en.isDir ? "rgba(217, 70, 239, 0.12)" : "rgba(6, 182, 212, 0.12)",
																		color: en.isDir ? "var(--primary)" : "var(--accent)",
																		flexShrink: 0,
																	}}
																>
																	{en.isDir ? (
																		<Folder size={15} />
																	) : (
																		<Music size={15} />
																	)}
																</span>
																<span
																	style={{
																		flex: 1,
																		color: "var(--text-main)",
																		fontSize: "0.88rem",
																		fontWeight: en.isDir ? 600 : 400,
																		wordBreak: "break-all",
																	}}
																>
																	{en.name}
																</span>
																{en.isDir && (
																	<ChevronRight
																		size={16}
																		color="var(--text-muted)"
																		style={{ flexShrink: 0 }}
																	/>
																)}
															</div>
															<div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
																<button
																	type="button"
																	onClick={() =>
																		setMovingItem({
																			root: browserRoot,
																			path: browserPath,
																			name: en.name,
																			isDir: en.isDir,
																		})
																	}
																	title={`Move ${en.isDir ? "folder" : "file"}`}
																	className="track-card-action-btn"
																	style={{ width: "34px", height: "34px" }}
																>
																	<FolderSync size={15} />
																</button>
																<button
																	type="button"
																	onClick={() =>
																		handleDeleteEntry(en.name, en.isDir)
																	}
																	title={`Delete ${en.isDir ? "folder" : "file"}`}
																	className="track-card-action-btn"
																	style={{ width: "34px", height: "34px", color: "var(--danger)" }}
																>
																	<Trash2 size={15} />
																</button>
															</div>
														</div>
													));
												})()}
												{browserEntries.length === 0 && (
													<div
														style={{
															color: "var(--text-muted)",
															fontStyle: "italic",
															fontSize: "0.9rem",
															padding: "1rem",
															textAlign: "center",
														}}
													>
														Empty folder.
													</div>
												)}
											</div>
										</>
									)}
								</>
							)}
						</div>
					)}

					{activeTab === "upload" && (
						<div className="glass-card">
							<div
								onDragOver={(e) => e.preventDefault()}
								onDrop={(e) => {
									e.preventDefault();
									addUploadFiles(e.dataTransfer.files);
								}}
								style={{
									border: "2px dashed var(--glass-border)",
									borderRadius: "var(--tc-radius-md)",
									padding: "2rem",
									textAlign: "center",
									marginBottom: "1.5rem",
								}}
							>
								<p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
									Drop audio files here or choose them from disk.
								</p>
								<Button
									variant="secondary"
									onClick={() => uploadInputRef.current?.click()}
								>
									Choose files
								</Button>
								<input
									ref={uploadInputRef}
									type="file"
									multiple
									accept="audio/*"
									style={{ display: "none" }}
									onChange={(e) => {
										if (e.target.files) addUploadFiles(e.target.files);
										e.target.value = "";
									}}
								/>
							</div>
							{uploadQueue.map((u) => (
								<div
									key={u.id}
									className="glass-card"
									style={{ marginBottom: "0.75rem", padding: "0.75rem 1rem" }}
								>
									<div
										style={{
											fontFamily: "monospace",
											fontSize: "0.8rem",
											color: "var(--text-muted)",
											wordBreak: "break-all",
											marginBottom: "0.5rem",
										}}
									>
										{u.name}
									</div>
									<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
										{(["title", "artist", "album"] as const).map((k) => (
											<input
												key={k}
												type="text"
												placeholder={k}
												value={u[k]}
												disabled={u.status === "uploading" || u.status === "done"}
												onChange={(e) => patchUpload(u.id, { [k]: e.target.value })}
												className="glass-input"
												style={{ flex: "1 1 160px" }}
											/>
										))}
										<Button
											variant="primary"
											disabled={u.status === "uploading" || u.status === "done"}
											onClick={() => runUpload(u)}
										>
											{u.status === "uploading"
												? "Uploading…"
												: u.status === "done"
													? "Done"
													: u.status === "error"
														? "Retry"
														: "Upload"}
										</Button>
										<Button
											variant="secondary"
											disabled={u.status === "uploading"}
											onClick={() =>
												setUploadQueue((q) => q.filter((x) => x.id !== u.id))
											}
											title="Remove"
										>
											<X size={14} />
										</Button>
									</div>
									{u.error && (
										<div style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
											{u.error}
										</div>
									)}
								</div>
							))}
							{uploadQueue.length > 0 && (
								<div className="btn-group" style={{ justifyContent: "flex-end" }}>
									<Button
										variant="secondary"
										disabled={uploadBusy}
										onClick={() => setUploadQueue((q) => q.filter((x) => x.status !== "done"))}
									>
										Clear done
									</Button>
									<Button variant="primary" disabled={uploadBusy} onClick={uploadAll}>
										Upload all
									</Button>
								</div>
							)}
						</div>
					)}

					{activeTab === "settings" && (
						<>
							<div
								className="settings-section"
								style={{ marginBottom: "2rem" }}
							>
								<h3 style={{ marginBottom: "1rem" }}>Connection to TuneCamp</h3>
								<div className="form-group">
									<label>Server URL</label>
									<input
										type="text"
										value={server}
										onChange={(e) => setServer(e.target.value)}
										placeholder="https://my-tunecamp.com"
										className="glass-input"
									/>
								</div>
								<div className="form-group">
									<label>API Token / JWT</label>
									<input
										type="password"
										value={token}
										onChange={(e) => setToken(e.target.value)}
										placeholder="Enter JWT token"
										className="glass-input"
									/>
								</div>
							</div>

							{!isCapacitor && (
								<div
									className="settings-section"
									style={{
										marginBottom: "2rem",
										borderTop: "1px solid var(--glass-border)",
										paddingTop: "1.5rem",
									}}
								>
									<h3 style={{ marginBottom: "1rem" }}>Soulseek Credentials</h3>
									<div className="form-group">
										<label>Soulseek Username</label>
										<input
											type="text"
											value={slskUser}
											onChange={(e) => setSlskUser(e.target.value)}
											placeholder="Your Soulseek username"
											className="glass-input"
										/>
									</div>
									<div className="form-group">
										<label>Soulseek Password</label>
										<input
											type="password"
											value={slskPass}
											onChange={(e) => setSlskPass(e.target.value)}
											placeholder="Your Soulseek password"
											className="glass-input"
										/>
									</div>
								</div>
							)}

							<div
								className="settings-section"
								style={{
									marginBottom: "2rem",
									borderTop: "1px solid var(--glass-border)",
									paddingTop: "1.5rem",
								}}
							>
								<h3 style={{ marginBottom: "1rem" }}>Torrent Settings</h3>
								<div className="form-group">
									<label>
										Custom Port (0 = random, useful with VPNs like ProtonVPN
										that pin a specific port)
									</label>
									<input
										type="number"
										value={torrentPort || ""}
										onChange={(e) =>
											setTorrentPort(
												e.target.value ? parseInt(e.target.value) : 0,
											)
										}
										placeholder="0"
										className="glass-input"
										style={{ width: "120px" }}
									/>
								</div>
							</div>

							<div
								className="settings-section"
								style={{
									marginBottom: "2rem",
									borderTop: "1px solid var(--glass-border)",
									paddingTop: "1.5rem",
								}}
							>
								<h3 style={{ marginBottom: "1rem" }}>Sidecamp Library Folder</h3>
								<div className="form-group">
									<label>
										Where downloaded music is stored. Leave empty to use the
										default Music folder. Takes effect after restarting
										Sidecamp.
									</label>
									<div style={{ display: "flex", gap: "8px" }}>
										<input
											type="text"
											value={libraryDir}
											onChange={(e) => setLibraryDir(e.target.value)}
											placeholder="Default: Music folder"
											className="glass-input"
											style={{ flex: 1 }}
										/>
										<Button
											variant="secondary"
											onClick={handleBrowseLibraryDir}
											style={{
												display: "flex",
												alignItems: "center",
												gap: "6px",
												whiteSpace: "nowrap",
											}}
										>
											<Folder size={16} /> Browse
										</Button>
										{libraryDir && (
											<Button
												variant="secondary"
												onClick={() => setLibraryDir("")}
											>
												Reset
											</Button>
										)}
									</div>
								</div>
							</div>

							<div
								className="settings-section"
								style={{
									marginBottom: "2rem",
									borderTop: "1px solid var(--glass-border)",
									paddingTop: "1.5rem",
								}}
							>
								<h3 style={{ marginBottom: "1rem" }}>
									Local Shared Folders (Peer Node)
								</h3>
								<div className="form-group">
									<label>Music Folders to Share (comma-separated)</label>
									<div style={{ display: "flex", gap: "8px" }}>
										<input
											type="text"
											value={folder}
											onChange={(e) => setFolder(e.target.value)}
											placeholder="Example: D:\Music, C:\Downloads"
											className="glass-input"
											style={{ flex: 1 }}
										/>
										<Button
											variant="secondary"
											onClick={handleBrowseFolder}
											style={{
												display: "flex",
												alignItems: "center",
												gap: "6px",
												whiteSpace: "nowrap",
											}}
										>
											<Folder size={16} /> Browse
										</Button>
									</div>
								</div>
							</div>

							<div className="btn-group" style={{ alignItems: "center" }}>
								<Button variant="primary" onClick={handleSaveSettings}>
									Save Configuration
								</Button>
								{settingsSaved && (
									<span
										style={{
											color: "var(--accent)",
											marginLeft: "1rem",
											fontWeight: 600,
										}}
									>
										✓ Configuration saved!
									</span>
								)}
							</div>

							<div
								className="settings-section"
								style={{
									marginBottom: "2rem",
									borderTop: "1px solid var(--glass-border)",
									paddingTop: "1.5rem",
								}}
							>
								<UnifiedLogsViewer
									libraryLogs={libraryLogs}
									dlLogs={dlLogs}
									peerLogs={logs}
									onClearCategory={handleClearCategoryLogs}
								/>
							</div>

							<div className="btn-group" style={{ marginTop: "1rem" }}>
								<Button
									variant="secondary"
									onClick={() => {
										localStorage.removeItem("tc_server");
										localStorage.removeItem("tc_token");
										setServer("");
										setToken("");
										setHasConnected(false);
									}}
								>
									Disconnect / Switch Instance
								</Button>
							</div>

							{/* About */}
							<div
								style={{
									maxWidth: "720px",
									marginTop: "2.5rem",
									borderTop: "1px solid var(--glass-border)",
									paddingTop: "2rem",
								}}
							>
								<div className="glass-card" style={{ marginBottom: "1.5rem" }}>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "1.5rem",
											marginBottom: "1.5rem",
										}}
									>
										<img
											src={logo}
											alt="Sidecamp"
											style={{
												width: "64px",
												height: "64px",
												borderRadius: "12px",
											}}
										/>
										<div>
											<h2
												style={{
													margin: 0,
													fontFamily: "var(--font-headings)",
													fontSize: "1.8rem",
												}}
											>
												Sidecamp
											</h2>
											<p
												style={{
													margin: "4px 0 0",
													color: "var(--text-muted)",
													fontSize: "0.9rem",
												}}
											>
												Powered by{" "}
												<span
													style={{ color: "var(--primary)", fontWeight: 600 }}
												>
													TuneCamp
												</span>
											</p>
											<p
												style={{
													margin: "4px 0 0",
													color: "var(--text-muted)",
													fontSize: "0.85rem",
												}}
											>
												Version {update?.currentVersion ?? "…"}
											</p>
										</div>
									</div>
									<p
										style={{
											lineHeight: 1.7,
											color: "var(--text-muted)",
											marginBottom: "1rem",
										}}
									>
										<strong style={{ color: "var(--text-main)" }}>
											Sidecamp
										</strong>{" "}
										is a desktop companion app for{" "}
										<strong style={{ color: "var(--primary)" }}>
											TuneCamp
										</strong>{" "}
										— an independent music platform built for artists and
										listeners who believe in open, decentralized music
										distribution.
									</p>
									<p
										style={{
											lineHeight: 1.7,
											color: "var(--text-muted)",
											marginBottom: "1.2rem",
										}}
									>
										With Sidecamp you can discover and download music from the
										TuneCamp network
										{!isCapacitor &&
											" and from peer-to-peer sources (Soulseek, BitTorrent, YouTube)"}
										 and share your collection back to the network as a peer
										node — all from one place.
									</p>
									{update?.updateAvailable ? (
										<Button
											variant="primary"
											size="sm"
											onClick={() => window.electronAPI.openReleasesPage()}
										>
											Update to {update.latestVersion}
										</Button>
									) : (
										<Button
											variant="secondary"
											size="sm"
											onClick={() =>
												window.electronAPI.checkForUpdate().then(setUpdate)
											}
										>
											Check for updates
										</Button>
									)}
								</div>

								<div className="glass-card">
									<h3
										style={{
											fontFamily: "var(--font-headings)",
											marginBottom: "1rem",
										}}
									>
										Tech stack
									</h3>
									<div
										style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}
									>
										{(isCapacitor
											? [
													"React 19",
													"TypeScript",
													"Vite",
													"Capacitor",
													"TuneCamp API",
												]
											: [
													"Electron",
													"React 19",
													"TypeScript",
													"Vite",
													"Soulseek",
													"WebTorrent",
													"yt-dlp",
													"node-id3",
													"TuneCamp API",
												]
										).map((t) => (
											<span
												key={t}
												style={{
													padding: "4px 10px",
													background: "rgba(179,102,255,0.12)",
													border: "1px solid rgba(179,102,255,0.25)",
													borderRadius: "20px",
													fontSize: "0.8rem",
													color: "var(--primary)",
												}}
											>
												{t}
											</span>
										))}
									</div>
								</div>
							</div>
						</>
					)}

					{activeTab === "network" && (
						<div
							className="glass-card network-card"
							style={{ display: "flex", gap: "2rem", minHeight: "450px" }}
						>
							{/* Left pane: Peers list */}
							<div
								className="network-peers-pane"
								style={{
									flex: "1",
									borderRight: "1px solid var(--glass-border)",
									paddingRight: "1.5rem",
								}}
							>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										marginBottom: "1.25rem",
									}}
								>
									<h3
										style={{
											margin: 0,
											fontSize: "1.15rem",
											fontFamily: "var(--font-headings)",
										}}
									>
										Connected Peers
									</h3>
									<Button
										variant="secondary"
										onClick={loadNetworkPeers}
										disabled={isLoadingPeers}
										style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem" }}
									>
										{isLoadingPeers ? "Refreshing..." : "Refresh"}
									</Button>
								</div>
								{isLoadingPeers ? (
									<div
										style={{
											textAlign: "center",
											padding: "3rem 1rem",
											color: "var(--text-muted)",
										}}
									>
										<span
											className="spinner"
											style={{
												display: "inline-block",
												width: "20px",
												height: "20px",
												border: "3px solid var(--accent)",
												borderTopColor: "transparent",
												borderRadius: "50%",
												animation: "spin 1s linear infinite",
												marginBottom: "10px",
											}}
										></span>
										<div style={{ fontSize: "0.9rem" }}>Loading peers...</div>
									</div>
								) : networkPeers.length === 0 ? (
									<div
										style={{
											textAlign: "center",
											padding: "3rem 1rem",
											color: "var(--text-muted)",
											fontStyle: "italic",
											fontSize: "0.9rem",
										}}
									>
										No peers online.
									</div>
								) : (
									<div
										className="peers-list"
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "8px",
										}}
									>
										{networkPeers.map((p) => {
											const isSelected = selectedPeer?.id === p.id;
											return (
												<div
													key={p.id}
													className={`peer-row ${isSelected ? "active" : ""}`}
													onClick={() => selectPeer(p)}
													style={{
														padding: "0.8rem 1rem",
														background: isSelected
															? "linear-gradient(135deg, rgba(217, 70, 239, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)"
															: "rgba(255, 255, 255, 0.03)",
														border: isSelected
															? "1px solid var(--primary)"
															: "1px solid var(--glass-border)",
														borderRadius: "12px",
														cursor: "pointer",
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														transition: "all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
														boxShadow: isSelected
															? "0 4px 16px rgba(217, 70, 239, 0.18)"
															: "none",
													}}
												>
													<div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
														<div
															style={{
																width: "32px",
																height: "32px",
																borderRadius: "8px",
																background: isSelected ? "var(--primary)" : "rgba(255,255,255,0.06)",
																color: isSelected ? "#fff" : "var(--text-muted)",
																display: "flex",
																alignItems: "center",
																justifyContent: "center",
																flexShrink: 0,
															}}
														>
															{p.id === "server" ? <Cloud size={16} /> : <User size={16} />}
														</div>
														<div style={{ minWidth: 0, flex: 1 }}>
															<div
																style={{
																	fontWeight: 600,
																	color: isSelected ? "var(--primary)" : "var(--text-main)",
																	fontSize: "0.9rem",
																	whiteSpace: "nowrap",
																	overflow: "hidden",
																	textOverflow: "ellipsis",
																}}
															>
																{p.username || "Unknown"}
															</div>
															{p.origin && (
																<div
																	style={{
																		fontSize: "0.72rem",
																		color: "var(--text-muted)",
																		whiteSpace: "nowrap",
																		overflow: "hidden",
																		textOverflow: "ellipsis",
																	}}
																>
																	{new URL(p.origin).hostname}
																</div>
															)}
														</div>
													</div>
													<span
														style={{
															fontSize: "0.74rem",
															color: "var(--text-muted)",
															background: "rgba(255, 255, 255, 0.06)",
															padding: "2px 8px",
															borderRadius: "9999px",
															border: "1px solid rgba(255, 255, 255, 0.08)",
															marginLeft: "8px",
															flexShrink: 0,
														}}
													>
														{p.trackCount || 0} tracks
													</span>
												</div>
											);
										})}
									</div>
								)}
							</div>

							{/* Right pane: Selected peer tracks */}
							<div className="network-tracks-pane" style={{ flex: "2" }}>
								<h3
									style={{
										marginBottom: "1.25rem",
										fontSize: "1.15rem",
										fontFamily: "var(--font-headings)",
										borderBottom: "1px solid var(--glass-border)",
										paddingBottom: "0.5rem",
									}}
								>
									{selectedPeer
										? `Tracks shared by ${selectedPeer.username || "Unknown"}`
										: "Browse Peer Tracks"}
								</h3>
								{isLoadingTracks ? (
									<div
										style={{
											textAlign: "center",
											padding: "4rem 1rem",
											color: "var(--text-muted)",
										}}
									>
										<span
											className="spinner"
											style={{
												display: "inline-block",
												width: "20px",
												height: "20px",
												border: "3px solid var(--primary)",
												borderTopColor: "transparent",
												borderRadius: "50%",
												animation: "spin 1s linear infinite",
												marginBottom: "10px",
											}}
										></span>
										<div style={{ fontSize: "0.9rem" }}>Loading tracks...</div>
									</div>
								) : !selectedPeer ? (
									<div
										style={{
											textAlign: "center",
											padding: "4rem 1rem",
											color: "var(--text-muted)",
											fontStyle: "italic",
											fontSize: "0.9rem",
										}}
									>
										Select a peer from the list on the left to browse their
										tracks.
									</div>
								) : peerTracks.length === 0 ? (
									<div
										style={{
											textAlign: "center",
											padding: "4rem 1rem",
											color: "var(--text-muted)",
											fontStyle: "italic",
											fontSize: "0.9rem",
										}}
									>
										No tracks shared by this peer.
									</div>
								) : (
									(() => {
										const q = networkQuery.trim().toLowerCase();
										const filtered = q
											? peerTracks.filter((t) =>
													`${t.title || ""} ${t.artist || ""} ${t.album || ""}`
														.toLowerCase()
														.includes(q),
												)
											: peerTracks;
										return (
											<>
												<input
													type="text"
													value={networkQuery}
													onChange={(e) => setNetworkQuery(e.target.value)}
													placeholder={`Filter ${peerTracks.length} tracks by title, artist, album...`}
													className="glass-input"
													style={{ marginBottom: "1rem" }}
												/>
												<div
													className="mobile-track-list peer-tracks-wrap"
													style={{ maxHeight: "420px", overflowY: "auto", paddingRight: "4px" }}
												>
													{filtered.map((t, i) => {
														const isCurrent =
															currentPlayback?.name ===
															`${t.artist} - ${t.title}`;
														const isDownloading = downloadingTrackId === t.id;
														// Streaming stays available either way; only the
														// file transfer is withheld (see downloadPolicy.ts).
														const blocked = (t as any).downloadable === false;
														const refusal = (t as any).reason as DownloadRefusal | undefined;
														return (
															<div
																key={t.id || i}
																className={`mobile-track-card ${isCurrent ? "playing" : ""}`}
																onDoubleClick={() => playNetworkTrack(selectedPeer, t)}
															>
																<button
																	type="button"
																	className="track-card-play-btn"
																	title="Play"
																	onClick={() => playNetworkTrack(selectedPeer, t)}
																>
																	<Play size={14} style={{ marginLeft: "2px" }} />
																</button>
																<div className="track-card-main">
																	<div className="track-card-title" title={t.title}>
																		{t.title || "Unknown Title"}
																	</div>
																	<div className="track-card-subtitle">
																		<span>{t.artist || "Unknown Artist"}</span>
																		{t.album && <span style={{ opacity: 0.7 }}>• {t.album}</span>}
																		{t.format && <span className="track-card-badge">{t.format}</span>}
																		{blocked && (
																			<span
																				className="track-card-badge track-card-badge-locked"
																				title={downloadRefusalHint(refusal)}
																			>
																				{downloadBadgeLabel(refusal)}
																			</span>
																		)}
																	</div>
																</div>
																<div className="track-card-actions">
																	<button
																		type="button"
																		className="track-card-action-btn"
																		title={
																			blocked
																				? downloadRefusalHint(refusal)
																				: isDownloading
																					? "Downloading…"
																					: "Download"
																		}
																		disabled={isDownloading || blocked}
																		onClick={() => handleDownloadPeerTrack(t)}
																		style={{
																			color: isDownloading ? "var(--accent)" : "inherit",
																			opacity: blocked ? 0.35 : undefined,
																			cursor: blocked ? "not-allowed" : undefined,
																		}}
																	>
																		<Download size={16} />
																	</button>
																</div>
															</div>
														);
													})}
													{filtered.length === 0 && (
														<div
															style={{
																textAlign: "center",
																padding: "2rem 1rem",
																color: "var(--text-muted)",
																fontStyle: "italic",
																fontSize: "0.9rem",
															}}
														>
															No tracks match "{networkQuery}".
														</div>
													)}
												</div>
											</>
										);
									})()
								)}
							</div>
						</div>
					)}

					{activeTab === "peer" && (
						<div className="glass-card peer-card">
							<div className="peer-controls">
								<div className="form-group">
									<label style={{ fontWeight: 600, fontSize: "0.95rem" }}>
										Currently shared folders:
									</label>
									<div
										style={{
											padding: "0.8rem 1rem",
											background: "rgba(0, 0, 0, 0.2)",
											border: "1px solid var(--glass-border)",
											borderRadius: "8px",
											marginTop: "0.5rem",
										}}
									>
										{validFolders.map((f, idx) => (
											<div
												key={idx}
												style={{
													display: "flex",
													alignItems: "center",
													gap: "8px",
													margin: "4px 0",
												}}
											>
												<span style={{ display: "inline-flex" }}>
													<Folder size={15} />
												</span>
												<span
													style={{
														fontFamily: "monospace",
														fontSize: "0.9rem",
														color: "var(--text-main)",
													}}
												>
													{f}
												</span>
											</div>
										))}
										{validFolders.length === 0 && (
											<div
												style={{
													color: "var(--text-muted)",
													fontSize: "0.9rem",
													fontStyle: "italic",
												}}
											>
												No folders configured. Configure them in the
												"Configuration" tab.
											</div>
										)}
									</div>
								</div>
								<div className="btn-group" style={{ marginTop: "1.5rem" }}>
									<Button
										variant="primary"
										onClick={handleStartPeer}
										disabled={
											peerStatus === "online" || validFolders.length === 0
										}
									>
										Start Sharing
									</Button>
									<Button
										variant="danger"
										onClick={handleStopPeer}
										disabled={peerStatus === "offline"}
									>
										Stop
									</Button>
								</div>
							</div>
						</div>
					)}

					{activeTab === "download" && (
						<div className="glass-card download-card">
							{/* Downloader Sub-tabs */}
							<div className="downloader-subtabs">
								<button
									className={`subtab-btn ${downloadSource === "soulseek" ? "active" : ""}`}
									onClick={() => setDownloadSource("soulseek")}
								>
									Platforms
								</button>
								<button
									className={`subtab-btn ${downloadSource === "direct" ? "active" : ""}`}
									onClick={() => setDownloadSource("direct")}
								>
									Direct Link / Torrent
								</button>
							</div>

							{downloadSource === "soulseek" && (
								<>
									<div className="platform-selector">
										{[
											{ id: "all", label: "All Platforms" },
											...(!isCapacitor
												? [{ id: "soulseek", label: "Soulseek" }]
												: []),
											{ id: "soundcloud", label: "SoundCloud" },
											{ id: "bandcamp", label: "Bandcamp" },
											{ id: "torrent", label: "Torrent" },
											{ id: "network", label: "Network" },
											{ id: "archive", label: "Archive.org" },
											{ id: "youtube", label: "YouTube" },
										].map((p) => (
											<button
												key={p.id}
												type="button"
												className={`platform-chip ${searchSource === p.id ? "active" : ""}`}
												onClick={() => {
													setSearchSource(p.id);
													setSearchResults([]);
												}}
											>
												<span className="platform-chip-dot" />
												{p.label}
											</button>
										))}
									</div>

									<div className="search-bar">
										<input
											type="text"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											placeholder={`Search on ${searchSource === "soulseek" ? "Soulseek" : searchSource === "soundcloud" ? "SoundCloud" : searchSource === "bandcamp" ? "Bandcamp" : searchSource === "network" ? "TuneCamp Network" : searchSource === "archive" ? "Archive.org" : searchSource === "youtube" ? "YouTube" : "Torrent"}...`}
											className="glass-input search-input"
											onKeyDown={(e) => e.key === "Enter" && handleSearch()}
										/>
										<Button variant="primary" onClick={handleSearch}>
											Search
										</Button>
									</div>

									{searchResults.length === 0 ? (
										<div className="no-results">No results.</div>
									) : (
										<div className="mobile-track-list" style={{ maxHeight: "55vh", overflowY: "auto", paddingRight: "4px" }}>
											{searchResults.map((res, i) => {
												const dl = activeDownloads.find(
													(d) => d.id === res.id,
												);
												const busy = dl && dl.status === "downloading";
												const name =
													res.title ||
													(res.file && res.file.split(/[/\\]/).pop()) ||
													"Unknown Track";
												// TuneCamp-sourced results (this instance's catalog, a
												// federated one, a peer share) carry their release's
												// distribution mode; everything else is unrestricted.
												const verdict =
													res.source === "catalog" ||
													res.source === "instance" ||
													res.source === "peer"
														? resolveDownloadability(res)
														: { downloadable: true };
												const blocked = verdict.downloadable === false;
												const refusal = (verdict as any).reason as DownloadRefusal | undefined;
												return (
													<div
														key={i}
														className="mobile-track-card"
														onDoubleClick={() => !busy && !blocked && handleDownload(res)}
													>
														<div className="track-card-main">
															<div className="track-card-title" title={res.file || name}>
																{name}
															</div>
															<div className="track-card-subtitle">
																{res.source && (
																	<span className="track-card-badge">
																		{res.source}
																	</span>
																)}
																{blocked && (
																	<span
																		className="track-card-badge track-card-badge-locked"
																		title={downloadRefusalHint(refusal)}
																	>
																		{downloadBadgeLabel(refusal)}
																	</span>
																)}
																{res.bitrate && (
																	<span className="track-card-badge">
																		{res.bitrate}
																	</span>
																)}
																{res.size && (
																	<span style={{ fontSize: "0.72rem" }}>
																		{(res.size / 1024 / 1024).toFixed(1)} MB
																	</span>
																)}
																{res.user && (
																	<span style={{ fontSize: "0.72rem", opacity: 0.8 }}>
																		• {res.user}
																	</span>
																)}
															</div>
														</div>
														<div className="track-card-actions">
															{busy && dl ? (
																<div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
																	<span style={{ fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600 }}>
																		{(dl.progress * 100).toFixed(0)}%
																	</span>
																</div>
															) : (
																<button
																	type="button"
																	className="track-card-action-btn"
																	title={blocked ? downloadRefusalHint(refusal) : "Download"}
																	disabled={blocked}
																	onClick={() => handleDownload(res)}
																	style={{
																		opacity: blocked ? 0.35 : undefined,
																		cursor: blocked ? "not-allowed" : undefined,
																	}}
																>
																	<Download size={16} />
																</button>
															)}
														</div>
													</div>
												);
											})}
										</div>
									)}
								</>
							)}

							{downloadSource === "direct" && (
								<div className="direct-download-container">
									<div className="form-group">
										<label>
											Paste a Magnet Link (Torrent) or Web URL (SoundCloud,
											Bandcamp, YouTube, etc.)
										</label>
										<div className="search-bar">
											<input
												type="text"
												value={directUrl}
												onChange={(e) => setDirectUrl(e.target.value)}
												placeholder="magnet:?xt=urn:btih:...  or  https://soundcloud.com/..."
												className="glass-input search-input"
												disabled={isDownloading}
											/>
											<Button
												variant="primary"
												onClick={handleDirectDownload}
												disabled={isDownloading || !directUrl}
											>
												{isDownloading ? "Downloading..." : "Download"}
											</Button>
										</div>
									</div>

									{/* Progress Display */}
									{dlProgress && (
										<div className="progress-container">
											<div className="progress-info">
												<span>
													Downloading:{" "}
													{dlProgress.id
														? `Torrent (${dlProgress.id.substring(0, 8)})`
														: "In progress"}
												</span>
												<span className="progress-speed">
													{dlProgress.speed
														? `${(dlProgress.speed / 1024 / 1024).toFixed(2)} MB/s`
														: ""}
												</span>
											</div>
											<div className="progress-bar-bg">
												<div
													className="progress-bar-fill"
													style={{
														width: `${((dlProgress.progress || 0) * 100).toFixed(1)}%`,
													}}
												></div>
											</div>
											<div className="progress-info">
												<span>
													{((dlProgress.progress || 0) * 100).toFixed(1)}%
												</span>
												<span>
													{dlProgress.downloaded
														? `${(dlProgress.downloaded / 1024 / 1024).toFixed(2)} MB`
														: ""}
													{dlProgress.total
														? ` / ${(dlProgress.total / 1024 / 1024).toFixed(2)} MB`
														: ""}
												</span>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					)}

					{activeTab === "download" && (
						<div className="glass-card files-card">
							{/* Transfer Queue Section */}
							<div
								className="files-header"
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "1.5rem",
								}}
							>
								<h3 style={{ margin: 0 }}>Active & Failed Transfers</h3>
								<Button variant="secondary" onClick={purgeFailedDownloads}>
									Purge Failed
								</Button>
							</div>

							<div
								className="files-list"
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "10px",
									maxHeight: "250px",
									overflowY: "auto",
									paddingRight: "5px",
									marginBottom: "2rem",
								}}
							>
								{activeDownloads.map((dl) => {
									const isDownloading = dl.status === "downloading";
									const isSeeding = dl.status === "seeding";
									const isCompleted = dl.status === "completed";
									const isFailed = dl.status === "failed";
									const progressVal =
										dl.progress ?? (isCompleted || isSeeding ? 1 : 0);
									const speedText =
										isSeeding && dl.uploadSpeed
											? `UL: ${(dl.uploadSpeed / 1024 / 1024).toFixed(1)} MB/s`
											: dl.speed
												? `DL: ${(dl.speed / 1024 / 1024).toFixed(1)} MB/s`
												: undefined;

									return (
										<div
											key={dl.id}
											className="result-item"
											style={{
												background: "rgba(255, 255, 255, 0.05)",
												padding: "0.8rem 1rem",
												borderRadius: "8px",
												border: "1px solid rgba(255, 255, 255, 0.1)",
												display: "flex",
												flexDirection: "column",
												gap: "6px",
												alignItems: "stretch",
											}}
										>
											<div
												style={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
													gap: "10px",
												}}
											>
												<div
													className="result-filename"
													style={{
														fontWeight: 600,
														color: isFailed ? "#e74c3c" : "var(--text-main)",
														fontSize: "0.95rem",
														wordBreak: "break-all",
														display: "flex",
														alignItems: "center",
														gap: "8px",
													}}
												>
													{dl.source === "soulseek" ? (
														<Music size={16} />
													) : dl.source === "torrent" ||
														dl.source === "torrent_search" ? (
														<Magnet size={16} />
													) : dl.source === "server" ? (
														<Cloud size={16} />
													) : (
														<Globe size={16} />
													)}
													{dl.name}
													{isFailed && (
														<span
															style={{
																fontSize: "0.75rem",
																background: "rgba(231, 76, 60, 0.2)",
																color: "#e74c3c",
																padding: "2px 6px",
																borderRadius: "4px",
																fontWeight: 600,
															}}
														>
															FAILED
														</span>
													)}
													{isDownloading && (
														<span
															style={{
																fontSize: "0.75rem",
																background: "rgba(0, 194, 255, 0.2)",
																color: "#00c2ff",
																padding: "2px 6px",
																borderRadius: "4px",
																fontWeight: 600,
															}}
														>
															DOWNLOADING
														</span>
													)}
													{isSeeding && (
														<span
															style={{
																fontSize: "0.75rem",
																background: "rgba(155, 89, 182, 0.2)",
																color: "#9b59b6",
																padding: "2px 6px",
																borderRadius: "4px",
																fontWeight: 600,
															}}
														>
															SEEDING
														</span>
													)}
													{isCompleted && (
														<span
															style={{
																fontSize: "0.75rem",
																background: "rgba(46, 204, 113, 0.2)",
																color: "#2ecc71",
																padding: "2px 6px",
																borderRadius: "4px",
																fontWeight: 600,
															}}
														>
															COMPLETED
														</span>
													)}
												</div>
												<div
													style={{
														display: "flex",
														gap: "8px",
														alignItems: "center",
													}}
												>
													{isSeeding && (
														<Button
															variant="secondary"
															onClick={() =>
																handleStopTorrent(dl.infoHash || dl.id)
															}
															style={{
																padding: "0.3rem 0.7rem",
																fontSize: "0.8rem",
															}}
														>
															Stop Seeding
														</Button>
													)}
													{isDownloading && (
														<Button
															variant="secondary"
															onClick={() => handleCancelTorrent(dl)}
															style={{
																padding: "0.3rem 0.7rem",
																fontSize: "0.8rem",
															}}
														>
															Cancel
														</Button>
													)}
													{(isFailed || isDownloading) && dl.magnetUri && (
														<Button
															variant="primary"
															onClick={() => handleResumeTorrent(dl)}
															style={{
																padding: "0.3rem 0.7rem",
																fontSize: "0.8rem",
															}}
														>
															Resume
														</Button>
													)}
													{(isFailed || isCompleted) && (
														<Button
															variant="secondary"
															onClick={() => clearDownloadItem(dl.id)}
															style={{
																padding: "0.3rem 0.7rem",
																fontSize: "0.8rem",
															}}
														>
															Clear
														</Button>
													)}
												</div>
											</div>

											{/* Torrent & Transfer Progress Bar */}
											{(isDownloading ||
												isSeeding ||
												dl.progress !== undefined) && (
												<ProgressBar
													progress={progressVal}
													indeterminate={
														isDownloading && dl.progress === undefined
													}
													speed={speedText}
													downloaded={dl.downloaded}
													total={dl.total}
													animated={isDownloading}
													showPercent={true}
												/>
											)}
										</div>
									);
								})}

								{activeDownloads.length === 0 && (
									<div
										className="no-results"
										style={{
											textAlign: "center",
											padding: "2rem",
											color: "var(--text-muted)",
											fontStyle: "italic",
										}}
									>
										No active or failed transfers.
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Audio Player Bar — flex-pinned footer of main-content, outside the
            scrolling .content-area so it can never scroll away with content
            and never needs sticky/fixed (both are unreliable inside a
            scrolling flex column on Android WebView). */}
				{currentPlayback && (
					<div className="audio-player-bar">
						<div className="player-top-progress">
							<div
								className="player-top-progress-fill"
								style={{
									width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%`,
								}}
							/>
						</div>
						<div className="player-info">
							<span className="player-track-icon">
								<Music size={18} />
							</span>
							<div className="player-track-details">
								<span className="player-track-title" title={currentPlayback.name}>
									{currentPlayback.name}
								</span>
								<span className="player-track-path">
									{queue.length > 1
										? `Track ${queueIndex + 1} of ${queue.length}`
										: "Local Media"}
								</span>
							</div>
						</div>

						<div className="player-controls-center">
							<div className="player-buttons">
								{queue.length > 1 && (
									<button
										className="player-btn"
										onClick={playPrev}
										disabled={queueIndex <= 0}
										title="Previous"
										style={{ opacity: queueIndex <= 0 ? 0.4 : 1 }}
									>
										<SkipBack size={14} />
									</button>
								)}
								<button className="player-btn toggle-play" onClick={togglePlay}>
									{isPlaying ? (
										<Pause size={16} />
									) : (
										<Play size={16} style={{ marginLeft: "2px" }} />
									)}
								</button>
								{queue.length > 1 && (
									<button
										className="player-btn"
										onClick={playNext}
										disabled={queueIndex + 1 >= queue.length}
										title="Next"
										style={{
											opacity: queueIndex + 1 >= queue.length ? 0.4 : 1,
										}}
									>
										<SkipForward size={14} />
									</button>
								)}
							</div>

							<div className="player-seeker" onWheel={handlePlayerWheel}>
								<span className="time-display">{formatTime(currentTime)}</span>
								<input
									type="range"
									min="0"
									max={duration || 100}
									value={duration ? Math.min(currentTime, duration) : 0}
									disabled={!duration}
									onPointerDown={() => {
										setIsSeeking(true);
									}}
									onChange={(e) => {
										handleSeekChange(parseFloat(e.target.value));
									}}
									onPointerUp={handleSeekCommit}
									onPointerCancel={handleSeekCommit}
									onLostPointerCapture={handleSeekCommit}
									className="seeker-slider"
								/>
								<span className="time-display">{formatTime(duration)}</span>
							</div>
						</div>

						<div className="player-controls-right">
							<span className="volume-icon">
								<Volume2 size={14} />
							</span>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={volume}
								onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
								className="volume-slider"
							/>
							<button
								className="player-btn stop-play"
								onClick={stopPlayback}
								title="Close Player"
							>
								<X size={16} />
							</button>
						</div>
					</div>
				)}
			</main>

			<audio
				ref={audioRef}
				style={{ display: "none" }}
				onError={() => {
					const el = audioRef.current;
					if (!el || !el.src) return;
					// MEDIA_ERR_ABORTED (1) fires when seeking supersedes an in-flight fetch.
					// This is normal browser behavior and must NOT reset or abort playback.
					if (el.error && el.error.code === 1) {
						return;
					}
					// Remote/network streams occasionally fail to load (transient blip) — retry
					// once per track before giving up. Local media:// files don't hit this.
					const retry = streamRetryRef.current;
					if (retry.src !== el.src) {
						retry.src = el.src;
						retry.count = 0;
					}
					if (retry.count >= 1) {
						console.error("Playback failed after retry:", el.error);
						return;
					}
					retry.count++;
					el.load();
					el.play().catch((e) => {
						if (e.name !== "AbortError") console.error("Playback failed:", e);
					});
				}}
				onTimeUpdate={() => {
					if (!audioRef.current || isSeeking) return;
					const t = audioRef.current.currentTime;
					// whole-second granularity: skips ~3 of 4 timeupdate re-renders of the whole
					// app; every readout is second- or percent-based so nothing visible changes
					// (the big scrolling wave reads currentTime directly via rAF, not this state)
					setCurrentTime((prev) =>
						Math.floor(prev) === Math.floor(t) ? prev : t,
					);
				}}
				onDurationChange={() => {
					// Network/live streams report Infinity or NaN — treat those as "unknown" (0)
					// instead of poisoning the seeker (max/value) and the time readout.
					if (audioRef.current) {
						const d = audioRef.current.duration;
						setDuration(isFinite(d) ? d : 0);
					}
				}}
				onEnded={() => {
					if (audioRef.current && duration > 0) {
						const remaining = duration - audioRef.current.currentTime;
						if (remaining > 2) {
							// Premature end triggered (e.g. slight mismatch between file container and stream duration)
							return;
						}
					}
					if (queueIndex + 1 < queue.length) playNext();
					else stopPlayback();
				}}
			/>

		</div>
	);
}

export default App;
