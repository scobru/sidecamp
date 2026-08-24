import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
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
	Palette,
	Disc3,
	ChevronUp,
	ChevronDown,
	ArrowUpCircle,
	Tag,
	Plus,
	Headphones,
	User,
	Share2,
	Eye,
	EyeOff,
	MoreVertical,
	MessageCircle,
	Send,
	Lock,
	Key,
	Unlock,
	ShieldCheck,
	ShieldAlert,
	Users,
	Hash,
	LogOut,
	Sparkles,
	RefreshCw,
	Check,
	UserPlus,
	Ban,
} from "lucide-react";
import { Button } from "./components/Button";
import { ProgressBar } from "./components/ProgressBar";
import { UnlockRoomModal } from "./components/UnlockRoomModal";
import { CreateRoomModal } from "./components/CreateRoomModal";
import { useTuneCampChat, type RoomInfo } from "@tunecamp/chat";
import { guess } from "web-audio-beat-detector";
import "./index.css";
import logo from "./assets/logo.png";

import platformAPI, { currentPlatform } from "./services/platform";
import ConnectScreen from "./components/ConnectScreen";
import type { KeyPair } from "./services/e2eCrypto";
import pingSound from "./audio/ping-bing_E_major.wav";

const isCapacitor = currentPlatform.isCapacitor;

// Shared collator: options are parsed once, not on every comparison.
const collator = new Intl.Collator(undefined, { sensitivity: "base" });

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

// Big scrolling waveform (rekordbox-style): playhead fixed at center, wave
// scrolls under it via requestAnimationFrame reading audio.currentTime
// directly — no React state churn at 60fps. Click = seek.
const ScrollWave = memo(function ScrollWave({
	peaks,
	pps,
	audioRef,
}: {
	peaks: number[];
	pps: number;
	audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
	const cvRef = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let raf = 0;
		const draw = () => {
			raf = requestAnimationFrame(draw);
			const cv = cvRef.current,
				audio = audioRef.current;
			if (!cv || !audio) return;
			if (cv.width !== cv.clientWidth) cv.width = cv.clientWidth || 800;
			const ctx = cv.getContext("2d");
			if (!ctx) return;
			const W = cv.width,
				H = cv.height,
				center = W >> 1;
			ctx.clearRect(0, 0, W, H);
			const start = Math.round(audio.currentTime * pps) - center;
			for (let x = 0; x < W; x++) {
				const idx = start + x;
				if (idx < 0 || idx >= peaks.length) continue;
				const h = Math.max(1, (peaks[idx] / 100) * (H - 10));
				ctx.fillStyle =
					x < center ? "rgba(168,85,247,0.35)" : "rgba(168,85,247,0.85)";
				ctx.fillRect(x, (H - h) / 2, 1, h);
			}
			ctx.fillStyle = "#f8fafc";
			ctx.fillRect(center - 1, 0, 2, H);
		};
		raf = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(raf);
	}, [peaks, pps, audioRef]);
	const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const audio = audioRef.current,
			cv = cvRef.current;
		if (!audio || !cv) return;
		const rect = cv.getBoundingClientRect();
		const t =
			audio.currentTime + (e.clientX - rect.left - rect.width / 2) / pps;
		audio.currentTime = Math.max(0, Math.min(t, audio.duration || t));
	};
	return (
		<canvas
			ref={cvRef}
			height={80}
			className="scrollwave-canvas"
			onClick={seek}
			title="Click to seek"
		/>
	);
});

// Per-row waveform (rekordbox-style). Memoized: only the playing row repaints
// on the ~4Hz timeupdate ticks, the other N rows skip both render and draw.
const Waveform = memo(function Waveform({
	peaks,
	progress,
	active,
}: {
	peaks?: number[];
	progress: number;
	active: boolean;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const cv = ref.current;
		if (!cv) return;
		const ctx = cv.getContext("2d");
		if (!ctx) return;
		const W = cv.width,
			H = cv.height;
		ctx.clearRect(0, 0, W, H);
		if (!peaks || peaks.length === 0) return;
		const n = peaks.length;
		const bw = W / n;
		const played = active ? Math.floor((n * progress) / 100) : 0;
		for (let i = 0; i < n; i++) {
			const h = Math.max(1, (peaks[i] / 100) * H);
			ctx.fillStyle =
				i < played
					? "#a855f7"
					: active
						? "rgba(168,85,247,0.45)"
						: "rgba(148,163,184,0.45)";
			ctx.fillRect(i * bw, (H - h) / 2, Math.max(0.6, bw - 0.4), h);
		}
	}, [peaks, progress, active]);
	return <canvas ref={ref} width={140} height={22} className="wave-canvas" />;
});

// The account's Zen chat identity, opened from the vault at login. Persisted
// because the password isn't: without this the pair would be lost on restart
// and the daemon would fall back to a key peers no longer accept.
const CHAT_IDENTITY_KEY = "tc_chat_identity";

function loadChatIdentity(): KeyPair | null {
	try {
		const raw = localStorage.getItem(CHAT_IDENTITY_KEY);
		return raw ? (JSON.parse(raw) as KeyPair) : null;
	} catch {
		return null;
	}
}

const DEFAULT_COL_WIDTHS: Record<string, number> = {
	check: 32,
	num: 38,
	wave: 140,
	title: 220,
	artist: 160,
	album: 140,
	genre: 120,
	bpm: 58,
	key: 52,
	time: 58,
	year: 52,
	kbps: 52,
	size: 58,
	added: 88,
	actions: 170,
};

function cleanTrackMetadata(filename: string): { artist: string; title: string } {
	let base = (filename.split(/[/\\]/).pop() || filename).replace(/\.[^/.]+$/, "");
	base = base
		.replace(/^\d{1,3}[\s._-]+(?=\D)/, "")
		.replace(/[\[(](?:official|audio|video|hd|hq|4k|1080p|lyrics|remastered|explicit|clean|320kbps|free\s*download)[^\])]*[\])]/gi, "")
		.replace(/_/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	const m = base.match(/^(.+?)\s*[-–—|~]\s*(.+)$/);
	if (m) {
		return { artist: m[1].trim(), title: m[2].trim() };
	}
	return { artist: "", title: base };
}

function App() {
	const playNotification = useCallback(() => {
		const audio = new Audio(pingSound);
		audio.volume = 0.5;
		audio.play().catch((e) => console.log("Audio play blocked:", e));
	}, []);

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
	const [peerStatus, setPeerStatus] = useState("offline");
	const [logs, setLogs] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState(
		isCapacitor ? "library" : "download",
	);
	const [chatTo, setChatTo] = useState("");
	const [chatText, setChatText] = useState("");
	const [chatSending, setChatSending] = useState(false);
	const [activeRoomId, setActiveRoomId] = useState<number | undefined>();
	const [showUnlockRoomModal, setShowUnlockRoomModal] = useState(false);
	const [unlockModalRoom, setUnlockModalRoom] = useState<RoomInfo | null>(null);
	const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
	const [dlLogsExpanded, setDlLogsExpanded] = useState(false);
	const [mobileChatView, setMobileChatView] = useState<"feed" | "peers" | "rooms">("feed");
	const {
		messages: chatMessages,
		peers: rawChatPeers,
		unreadCounts: chatUnread,
		status: chatStatus,
		sendMessage: sendChatMessage,
		createRoom,
		deleteRoom,
		leaveRoom,
		sendRoomMessage,
		rooms: chatRooms,
		roomUnreadCounts,
		roomPassphrases,
		setRoomPassphrase,
		clearRoomPassphrase,
		keyChanges: chatKeyChanges,
		acceptKeyChange: acceptChatKeyChange,
		clearUnread,
		clearRoomUnread,
		formatUser,
		connect: connectChat,
		disconnect: disconnectChat,
		username: chatUsername,
		contactsData,
		blocklist,
		sendContactRequest,
		acceptContactRequest,
		rejectContactRequest,
		blockUser,
		unblockUser,
	} = useTuneCampChat(
		{
			serverUrl: server,
			token: token,
			autoConnect: false,
		},
		chatTo,
		activeRoomId,
	);
	
	const chatPeers = useMemo(() => {
		return rawChatPeers.filter(p => p.username !== chatUsername);
	}, [rawChatPeers, chatUsername]);

	const activeRoom = useMemo(() => {
		return chatRooms.find((r: RoomInfo) => r.id === activeRoomId);
	}, [chatRooms, activeRoomId]);

	const selectLobby = useCallback(() => {
		setChatTo("");
		setActiveRoomId(undefined);
		setMobileChatView("feed");
	}, []);

	const selectChatPeer = useCallback((username: string) => {
		setActiveRoomId(undefined);
		setChatTo(username);
		clearUnread(username);
		setMobileChatView("feed");
	}, [clearUnread]);

	const selectRoom = useCallback((room: RoomInfo) => {
		setChatTo("");
		setActiveRoomId(room.id);
		clearRoomUnread(room.id);
		setMobileChatView("feed");
	}, [clearRoomUnread]);

	const handleCreateRoom = useCallback(async (name: string, isPrivate: boolean, passphrase?: string) => {
		const room = await createRoom(name, undefined, isPrivate);
		if (room) {
			if (passphrase) {
				setRoomPassphrase(room.id, passphrase);
			}
			selectRoom(room);
			return true;
		}
		return false;
	}, [createRoom, setRoomPassphrase, selectRoom]);

	const handleLeaveRoom = useCallback(async (room: RoomInfo) => {
		await leaveRoom(room.id);
		if (activeRoomId === room.id) setActiveRoomId(undefined);
	}, [leaveRoom, activeRoomId]);

	const handleDeleteRoom = useCallback(async (room: RoomInfo) => {
		if (window.confirm(`Eliminare la stanza "${room.name}" e la sua cronologia per tutti?`)) {
			await deleteRoom(room.id);
			if (activeRoomId === room.id) setActiveRoomId(undefined);
		}
	}, [deleteRoom, activeRoomId]);

	const handleSendChat = useCallback(async () => {
		const body = chatText.trim();
		if (!body || chatSending) return;
		setChatSending(true);
		try {
			if (activeRoomId) {
				if (await sendRoomMessage(activeRoomId, body)) {
					setChatText("");
				}
			} else if (await sendChatMessage(chatTo, body)) {
				setChatText("");
			}
		} finally {
			setChatSending(false);
		}
	}, [chatText, chatSending, activeRoomId, sendRoomMessage, sendChatMessage, chatTo]);

	const pendingChatKeyChange = chatTo.trim() ? chatKeyChanges[chatTo.trim()] : undefined;
	const handleAcceptChatKeyChange = useCallback((peerId: string) => {
		const change = chatKeyChanges[peerId];
		if (!change) return;
		if (window.confirm(`Accept ${peerId}'s new encryption key?\n\nPinned: ${change.pinned}\nOffered: ${change.offered}`)) {
			acceptChatKeyChange(peerId);
		}
	}, [chatKeyChanges, acceptChatKeyChange]);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<any[]>([]);
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [theme, setTheme] = useState(
		() => localStorage.getItem("theme") || "dark",
	);
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
	const [showScrollBtn, setShowScrollBtn] = useState(false);
	const chatBottomRef = useRef<HTMLDivElement>(null);
	const chatScrollContainerRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		chatBottomRef.current?.scrollIntoView({ behavior });
	}, []);

	useEffect(() => {
		const el = chatScrollContainerRef.current;
		if (!el) return;
		const onScroll = () =>
			setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 150);
		el.addEventListener("scroll", onScroll);
		return () => el.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		if (chatMessages.length > 0 && activeTab === "chat") {
			scrollToBottom();
		}
	}, [chatMessages.length, activeTab, scrollToBottom]);

	const prevMsgCountRef = useRef(chatMessages.length);
	useEffect(() => {
		if (chatMessages.length > prevMsgCountRef.current) {
			const last = chatMessages[chatMessages.length - 1];
			if (last && !last.self) {
				playNotification();
			}
		}
		prevMsgCountRef.current = chatMessages.length;
	}, [chatMessages, playNotification]);

	// Per-list search filters
	const [librarySearch, setLibrarySearch] = useState("");
	const [browserSearch, setBrowserSearch] = useState("");
	// Library table (rekordbox-style): tag metadata per file path + sort state
	type TrackMeta = {
		title: string;
		artist: string;
		album: string;
		genre: string;
		bpm: number | null;
		key: string;
		duration: number;
		year: number | null;
		bitrate: number;
		peaks?: number[];
		beatOffset?: number | null;
	};
	const [trackMeta, setTrackMeta] = useState<Record<string, TrackMeta>>({});
	const [sortCol, setSortCol] = useState("added");
	const [sortDir, setSortDir] = useState<1 | -1>(-1);
	const toggleSort = (col: string) => {
		if (sortCol === col) setSortDir((d) => (d === 1 ? -1 : 1));
		else {
			setSortCol(col);
			setSortDir(col === "added" || col === "size" ? -1 : 1);
		}
	};

	const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
		try {
			const saved = localStorage.getItem("tc_library_col_widths");
			return saved ? { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) } : DEFAULT_COL_WIDTHS;
		} catch {
			return DEFAULT_COL_WIDTHS;
		}
	});

	const resizingRef = useRef<{ col: string; startX: number; startW: number } | null>(null);

	const handleColResizeStart = (col: string, e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const startX = e.clientX;
		const startW = colWidths[col] || DEFAULT_COL_WIDTHS[col] || 80;
		resizingRef.current = { col, startX, startW };

		const onMouseMove = (moveEvent: MouseEvent) => {
			if (!resizingRef.current) return;
			const delta = moveEvent.clientX - resizingRef.current.startX;
			const newW = Math.max(30, resizingRef.current.startW + delta);
			setColWidths((prev) => ({ ...prev, [col]: newW }));
		};

		const onMouseUp = () => {
			if (resizingRef.current) {
				setColWidths((latest) => {
					try {
						localStorage.setItem("tc_library_col_widths", JSON.stringify(latest));
					} catch {}
					return latest;
				});
				resizingRef.current = null;
			}
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", onMouseUp);
		};

		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", onMouseUp);
	};

	const handleColReset = (col: string, e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		const defaultW = DEFAULT_COL_WIDTHS[col] || 80;
		setColWidths((prev) => {
			const next = { ...prev, [col]: defaultW };
			try {
				localStorage.setItem("tc_library_col_widths", JSON.stringify(next));
			} catch {}
			return next;
		});
	};
	// BPM auto-analysis (Web Audio decode + beat detection), one file at a time
	const [analyzing, setAnalyzing] = useState<{
		done: number;
		total: number;
	} | null>(null);
	const analyzeCancelRef = useRef(false);
	// Collection pane filter (artist / genre / top-level folder) + shift-click anchor
	const [libFilter, setLibFilter] = useState<{
		type: "all" | "artist" | "genre" | "folder";
		value: string;
	}>({ type: "all", value: "" });
	const lastCheckRef = useRef<number | null>(null);
	// Inline tag edit: double-click a title/artist/album/genre cell (mp3 only for the actual write)
	const [cellEdit, setCellEdit] = useState<{
		path: string;
		field: "title" | "artist" | "album" | "genre";
		value: string;
	} | null>(null);
	const saveCellEdit = async () => {
		if (!cellEdit) return;
		const { path: p, field, value } = cellEdit;
		setCellEdit(null);
		try {
			await window.electronAPI.writeTags(p, { [field]: value });
			setTrackMeta((prev) =>
				prev[p] ? { ...prev, [p]: { ...prev[p], [field]: value } } : prev,
			);
			setDlLogs((prev) => [
				...prev,
				`[Library] Tag ${field} updated: ${value}`,
			]);
		} catch (e: any) {
			alert("Tag write failed: " + (e.message || e));
		}
	};
	// Playlists (DJ set builder), a Library sub-view. Persisted in localStorage.
	type Playlist = {
		id: string;
		name: string;
		tracks: { path: string; name: string }[];
	};
	// Library sub-panels are mutually exclusive — one workspace at a time, not stacked overlays.
	const [libraryPanel, setLibraryPanel] = useState<
		"none" | "playlists" | "organize"
	>("none");
	const showPlaylists = libraryPanel === "playlists";
	const togglePanel = (p: "playlists" | "organize") =>
		setLibraryPanel((v) => (v === p ? "none" : p));
	const [showLibraryTable, setShowLibraryTable] = useState(true);
	const [playlists, setPlaylists] = useState<Playlist[]>(() => {
		try {
			return JSON.parse(localStorage.getItem("playlists") || "[]");
		} catch {
			return [];
		}
	});
	const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
	const [newPlaylistName, setNewPlaylistName] = useState("");
	const [playlistPickerSearch, setPlaylistPickerSearch] = useState("");
	const [exportMsg, setExportMsg] = useState("");

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
	const [downloadedFiles, setDownloadedFiles] = useState<any[]>([]);
	const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
	const [albumSeedModalOpen, setAlbumSeedModalOpen] = useState(false);
	const [albumSeedName, setAlbumSeedName] = useState("My Custom Album");
	const [uploadingFilePath, setUploadingFilePath] = useState<string | null>(
		null,
	);
	const [openCardMenuPath, setOpenCardMenuPath] = useState<string | null>(null);

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
	// Playing from Library queues the filtered list; from Network, the peer's track list.
	const [queue, setQueue] = useState<
		{ name: string; src: string; path: string }[]
	>([]);
	const [queueIndex, setQueueIndex] = useState(-1);

	// Edit Tags Modal States
	const [editTagsFile, setEditTagsFile] = useState<{
		name: string;
		path: string;
	} | null>(null);
	const [editTagsData, setEditTagsData] = useState<{
		title: string;
		artist: string;
		album: string;
		genre: string;
		year: string | number;
		bpm: string | number;
		key: string;
		filename: string;
	}>({
		title: "",
		artist: "",
		album: "",
		genre: "",
		year: "",
		bpm: "",
		key: "",
		filename: "",
	});
	const [editTagsSearching, setEditTagsSearching] = useState<"beatport" | "musicbrainz" | null>(null);
	const [editTagsResults, setEditTagsResults] = useState<any[]>([]);
	const [editTagsSearchError, setEditTagsSearchError] = useState("");

	// Pre-Upload Metadata Editor States
	const [metadataModalFile, setMetadataModalFile] = useState<{
		name: string;
		path: string;
	} | null>(null);
	const [metadataTitle, setMetadataTitle] = useState("");
	const [metadataArtist, setMetadataArtist] = useState("Sidecamp");
	const [metadataAlbum, setMetadataAlbum] = useState("");

	// Library Organizer state
	const showOrganize = libraryPanel === "organize";
	const [organizeRoot, setOrganizeRoot] = useState("");
	const [organizeMode, setOrganizeMode] = useState<
		"artist" | "artist-album" | "genre" | "genre-artist"
	>("artist");
	const [organizePlan, setOrganizePlan] = useState<{
		actions: { type: string; from: string; to: string }[];
		stats: any;
	} | null>(null);
	const [organizeBusy, setOrganizeBusy] = useState(false);
	const [organizeError, setOrganizeError] = useState("");
	const [organizeResult, setOrganizeResult] = useState<{
		done: number;
		errors: string[];
	} | null>(null);
	const [genreProgress, setGenreProgress] = useState<{
		current: number;
		total: number;
		file: string;
		genre: string | null;
	} | null>(null);
	const [genreSummary, setGenreSummary] = useState<{
		missing: number;
		found: number;
		written: number;
		cancelled: boolean;
	} | null>(null);
	const [genreBusy, setGenreBusy] = useState(false);

	// Auto-Upload Watcher States
	const [autoUpload, _setAutoUpload] = useState(() => {
		return localStorage.getItem("auto_upload") === "true";
	});
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
			.then((cfg: any) => setTorrentPort(cfg.torrentPort || 0));
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
		if (activeTab === "download" || activeTab === "library") {
			loadDownloadedFiles();
		}
	}, [activeTab, folder]);

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
				setPeerTracks(res || []);
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
			loadDownloadedFiles();

			if (autoUpload && filePath) {
				handleUploadFileAuto(filePath);
			}
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

	const handleSeekChange = (time: number) => {
		setCurrentTime(time);
	};

	// Commit from the slider's own value (not state) so a fast drag can't land
	// on a stale position.
	const handleSeekCommit = (e: React.PointerEvent<HTMLInputElement>) => {
		if (!audioRef.current) return;
		const t = parseFloat(e.currentTarget.value);
		if (isFinite(t)) audioRef.current.currentTime = t;
		setIsSeeking(false);
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

	// Auto-Upload Trigger
	const handleUploadFileAuto = async (filePath: string) => {
		if (!server || !token) {
			setDlLogs((prev) => [
				...prev,
				`[Auto-Upload] Server/Token not configured, skipping auto-upload.`,
			]);
			return;
		}
		const filename = filePath.split(/[/\\]/).pop() || "";
		let artist = "Sidecamp";
		let title = filename.replace(/\.[^/.]+$/, "");
		if (filename.includes(" - ")) {
			const parts = filename.split(" - ");
			artist = parts[0].trim();
			title = parts[1].replace(/\.[^/.]+$/, "").trim();
		}

		setDlLogs((prev) => [
			...prev,
			`[Auto-Upload] Starting automatic upload of: ${filename}...`,
		]);
		try {
			await window.electronAPI.setUploadConfig(server, token);
			await window.electronAPI.uploadTrack(filePath, { artist, title });
			setDlLogs((prev) => [
				...prev,
				`[Auto-Upload] Auto-upload completed successfully!`,
			]);
		} catch (e: any) {
			setDlLogs((prev) => [
				...prev,
				`[Auto-Upload] Auto-upload failed: ${e.message || e}`,
			]);
		}
	};

	// Pre-Upload Metadata Editor Confirm
	const confirmUpload = async () => {
		if (!metadataModalFile) return;
		const filePath = metadataModalFile.path;

		if (!server || !token) {
			alert(
				"You must configure the Server URL and Token in the Configuration section to upload files!",
			);
			return;
		}

		setUploadingFilePath(filePath);
		setDlLogs((prev) => [
			...prev,
			`[Library] Starting upload of: ${metadataModalFile.name} with custom tags...`,
		]);
		setMetadataModalFile(null); // close modal

		try {
			await window.electronAPI.setUploadConfig(server, token);
			await window.electronAPI.uploadTrack(filePath, {
				artist: metadataArtist || "Sidecamp",
				title: metadataTitle || metadataModalFile.name,
				album: metadataAlbum || undefined,
			});
			setDlLogs((prev) => [
				...prev,
				`[Library] Upload completed successfully!`,
			]);
			alert("Track successfully uploaded to TuneCamp!");
		} catch (e: any) {
			setDlLogs((prev) => [
				...prev,
				`[Library] Error during upload: ${e.message || e}`,
			]);
			alert("Error uploading file: " + (e.message || e));
		} finally {
			setUploadingFilePath(null);
		}
	};

	const loadDownloadedFiles = async () => {
		try {
			const roots = folder
				.split(/[,;]/)
				.map((f) => f.trim())
				.filter(Boolean);
			const res = await window.electronAPI.listDownloads(roots);
			setDownloadedFiles(res);
			setSelectedFiles([]);
			loadTrackMeta(res); // fire-and-forget: table fills in as chunks resolve
		} catch (e) {
			console.error("Failed to load local downloads list:", e);
		}
	};

	// Bulk actions on the selection (checkbox column)
	const handleDeleteSelected = async () => {
		if (
			!confirm(
				`Delete ${selectedFiles.length} selected files? This cannot be undone.`,
			)
		)
			return;
		for (const p of selectedFiles) {
			try {
				await window.electronAPI.deleteDownload(p);
			} catch (e) {
				console.error("Delete failed:", p, e);
			}
		}
		setDlLogs((prev) => [
			...prev,
			`[Library] Deleted ${selectedFiles.length} selected files.`,
		]);
		setSelectedFiles([]);
		loadDownloadedFiles();
	};

	const handleUploadSelected = async () => {
		if (selectedFiles.length === 0) return;
		if (!server || !token) {
			alert(
				"You must configure the Server URL and Token in the Configuration section to upload files!",
			);
			return;
		}
		if (!confirm(`Upload ${selectedFiles.length} selected files to TuneCamp?`))
			return;
		await window.electronAPI.setUploadConfig(server, token);
		let ok = 0,
			fail = 0;
		for (const filePath of selectedFiles) {
			const filename = filePath.split(/[/\\]/).pop() || "";
			const m = trackMeta[filePath];
			let artist = m?.artist || "Sidecamp";
			let title = m?.title || filename.replace(/\.[^/.]+$/, "");
			if (!m?.artist && filename.includes(" - ")) {
				const parts = filename.split(" - ");
				artist = parts[0].trim();
				title = parts[1].replace(/\.[^/.]+$/, "").trim();
			}
			setUploadingFilePath(filePath);
			setDlLogs((prev) => [
				...prev,
				`[Library] Uploading ${ok + fail + 1}/${selectedFiles.length}: ${filename}...`,
			]);
			try {
				await window.electronAPI.uploadTrack(filePath, {
					artist,
					title,
					album: m?.album || undefined,
				});
				ok++;
			} catch (e: any) {
				fail++;
				setDlLogs((prev) => [
					...prev,
					`[Library] Upload failed for ${filename}: ${e.message || e}`,
				]);
			}
		}
		setUploadingFilePath(null);
		setDlLogs((prev) => [
			...prev,
			`[Library] Bulk upload done: ${ok} uploaded, ${fail} failed.`,
		]);
		setSelectedFiles([]);
	};

	// Drop target for rows dragged from the Library table
	const addTracksToPlaylist = (id: string, paths: string[]) => {
		const byPath = new Map(downloadedFiles.map((f: any) => [f.path, f]));
		updatePlaylist(id, (p) => {
			const existing = new Set(p.tracks.map((t) => t.path));
			const add = paths
				.filter((x) => byPath.has(x) && !existing.has(x))
				.map((x) => {
					const f = byPath.get(x)!;
					return {
						path: f.path,
						name: (f.name.split(/[/\\]/).pop() || f.name) as string,
					};
				});
			return add.length ? { ...p, tracks: [...p.tracks, ...add] } : p;
		});
	};

	const addSelectedToPlaylist = () => {
		if (!activePlaylist) {
			setLibraryPanel("playlists");
			alert("Select or create a playlist first (Playlists panel just opened).");
			return;
		}
		const byPath = new Map(downloadedFiles.map((f: any) => [f.path, f]));
		selectedFiles.forEach((p) => {
			const f = byPath.get(p);
			if (f) addTrackToActive(f);
		});
		setSelectedFiles([]);
	};

	// Analyze every library track missing BPM or waveform: one Web Audio decode
	// (Chromium built-in, all formats the player supports) feeds both — BPM from
	// a 60s middle window, waveform as 140 normalized peaks. Persisted via IPC
	// (TBPM tag for mp3 + meta cache).
	const computePeaks = (decoded: AudioBuffer, N = 140): number[] => {
		const ch = decoded.getChannelData(0);
		const bucket = Math.max(1, Math.floor(ch.length / N));
		const peaks: number[] = [];
		let top = 0;
		for (let i = 0; i < N; i++) {
			let max = 0;
			const start = i * bucket;
			const end = Math.min(start + bucket, ch.length);
			for (let j = start; j < end; j += 32) {
				// stride sampling: plenty for a 140px strip
				const v = Math.abs(ch[j]);
				if (v > max) max = v;
			}
			peaks.push(max);
			if (max > top) top = max;
		}
		return peaks.map((p) => (top > 0 ? Math.round((p / top) * 100) : 0)); // normalize like rekordbox
	};

	// Hi-res peaks (50/sec) for the big scrolling waveform, computed per played
	// track on demand — local files only, network streams have no local bytes.
	const SCROLL_PPS = 50;
	const [scrollWave, setScrollWave] = useState<{
		path: string;
		peaks: number[];
	} | null>(null);
	useEffect(() => {
		const p = currentPlayback?.path;
		setScrollWave(null);
		if (!p || !/[/\\]/.test(p)) return;
		let stale = false;
		(async () => {
			try {
				const u8: Uint8Array = await window.electronAPI.readAudioFile(p);
				if (stale) return;
				const raw = u8.buffer.slice(
					u8.byteOffset,
					u8.byteOffset + u8.byteLength,
				) as ArrayBuffer;
				const decoded = await new OfflineAudioContext(
					1,
					1,
					44100,
				).decodeAudioData(raw);
				if (stale) return;
				setScrollWave({
					path: p,
					peaks: computePeaks(
						decoded,
						Math.max(1, Math.ceil(decoded.duration * SCROLL_PPS)),
					),
				});
			} catch {
				/* not a local decodable file — no scroll wave */
			}
		})();
		return () => {
			stale = true;
		};
	}, [currentPlayback?.path]);

	const analyzeTracks = async () => {
		const targets = downloadedFiles.filter((f) => {
			const m = trackMeta[f.path];
			return m && (!m.bpm || !m.peaks?.length || m.beatOffset == null);
		});
		if (targets.length === 0) {
			alert(
				"Nothing to analyze — all tracks have BPM and waveform (or metadata is still loading).",
			);
			return;
		}
		analyzeCancelRef.current = false;
		setAnalyzing({ done: 0, total: targets.length });
		for (const f of targets) {
			if (analyzeCancelRef.current) break;
			try {
				const m = trackMeta[f.path];
				// bytes over IPC — fetch('media://…') is CORS-blocked for non-standard schemes
				const u8: Uint8Array = await window.electronAPI.readAudioFile(f.path);
				const raw = u8.buffer.slice(
					u8.byteOffset,
					u8.byteOffset + u8.byteLength,
				) as ArrayBuffer;
				const decoded = await new OfflineAudioContext(
					1,
					1,
					44100,
				).decodeAudioData(raw);
				const data: { bpm?: number; peaks?: number[]; beatOffset?: number } =
					{};
				if (!m.peaks?.length) data.peaks = computePeaks(decoded);
				if (!m.bpm || m.beatOffset == null) {
					const windowStart = Math.max(0, (decoded.duration - 60) / 2);
					try {
						const { bpm, offset } = await guess(
							decoded,
							windowStart,
							Math.min(60, decoded.duration),
						);
						// bpm and beatOffset must come from the same detection pass or the
						// beat grid is meaningless — store both, overwriting a tag BPM.
						data.bpm = bpm;
						data.beatOffset = (windowStart + offset) % (60 / bpm);
					} catch {
						/* no clear tempo — keep the waveform anyway */
					}
				}
				if (data.bpm || data.peaks) {
					await window.electronAPI.setTrackAnalysis(f.path, data);
					setTrackMeta((prev) => ({
						...prev,
						[f.path]: {
							...prev[f.path],
							...(data.bpm
								? { bpm: data.bpm, beatOffset: data.beatOffset }
								: {}),
							...(data.peaks ? { peaks: data.peaks } : {}),
						},
					}));
				}
			} catch (e) {
				console.warn("Analysis failed for", f.path, e); // undecodable — skip
			}
			setAnalyzing((s) => (s ? { done: s.done + 1, total: s.total } : s));
		}
		setAnalyzing(null);
	};

	// Tag metadata (BPM/key/duration…) resolved in chunks so first rows appear fast;
	// main process caches per file, so repeat loads are instant.
	const loadTrackMeta = async (files: { path: string }[]) => {
		if (!window.electronAPI.getTracksMeta) return;
		const CHUNK = 50;
		for (let i = 0; i < files.length; i += CHUNK) {
			try {
				const metas = await window.electronAPI.getTracksMeta(
					files.slice(i, i + CHUNK).map((f) => f.path),
				);
				setTrackMeta((prev) => ({ ...prev, ...metas }));
			} catch (e) {
				console.error("Failed to load track metadata:", e);
				return;
			}
		}
	};

	// --- Playlists ---
	useEffect(() => {
		localStorage.setItem("playlists", JSON.stringify(playlists));
	}, [playlists]);
	const activePlaylist =
		playlists.find((p) => p.id === activePlaylistId) || null;
	const updatePlaylist = (id: string, fn: (p: Playlist) => Playlist) =>
		setPlaylists((prev) => prev.map((p) => (p.id === id ? fn(p) : p)));
	const createPlaylist = () => {
		const name = newPlaylistName.trim();
		if (!name) return;
		const id = crypto.randomUUID();
		setPlaylists((prev) => [...prev, { id, name, tracks: [] }]);
		setActivePlaylistId(id);
		setNewPlaylistName("");
	};
	const deletePlaylist = (id: string) => {
		if (!window.confirm("Delete this playlist? (files are not touched)"))
			return;
		setPlaylists((prev) => prev.filter((p) => p.id !== id));
		if (activePlaylistId === id) setActivePlaylistId(null);
	};
	const addTrackToActive = (file: { path: string; name: string }) => {
		if (!activePlaylist) return;
		const basename = file.name.split(/[/\\]/).pop() || file.name;
		updatePlaylist(activePlaylist.id, (p) =>
			p.tracks.some((t) => t.path === file.path)
				? p
				: { ...p, tracks: [...p.tracks, { path: file.path, name: basename }] },
		);
	};
	const removeTrackAt = (idx: number) => {
		if (!activePlaylist) return;
		updatePlaylist(activePlaylist.id, (p) => ({
			...p,
			tracks: p.tracks.filter((_, i) => i !== idx),
		}));
	};
	const moveTrack = (idx: number, dir: -1 | 1) => {
		if (!activePlaylist) return;
		const j = idx + dir;
		if (j < 0 || j >= activePlaylist.tracks.length) return;
		updatePlaylist(activePlaylist.id, (p) => {
			const t = [...p.tracks];
			[t[idx], t[j]] = [t[j], t[idx]];
			return { ...p, tracks: t };
		});
	};
	const handleExportPlaylist = async () => {
		if (!activePlaylist || activePlaylist.tracks.length === 0) return;
		const dest = await window.electronAPI.pickFolder();
		if (!dest) return;
		const items = activePlaylist.tracks.map((t, i) => {
			const base = (t.name.split(/[/\\]/).pop() || t.name).replace(
				/[<>:"/\\|?*]/g,
				"",
			);
			return {
				path: t.path,
				exportName: `${String(i + 1).padStart(2, "0")} - ${base}`,
			};
		});
		setExportMsg("Exporting…");
		try {
			const res = await window.electronAPI.exportPlaylist(
				dest,
				activePlaylist.name,
				items,
			);
			if (res?.error) {
				setExportMsg(`Export failed: ${res.error}`);
				return;
			}
			setExportMsg(
				`Exported ${res.copied}/${res.total} → ${res.target}${res.errors.length ? ` (${res.errors.length} errors)` : ""}`,
			);
		} catch (e: any) {
			setExportMsg(`Export failed: ${e.message || e}`);
		}
	};
	const handleExportPlaylistJson = async () => {
		if (!activePlaylist) return;
		const content = JSON.stringify(activePlaylist, null, 2);
		const defaultFilename = `${activePlaylist.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_playlist.json`;
		try {
			const savedPath = await window.electronAPI.saveFile(
				defaultFilename,
				content,
			);
			if (savedPath) {
				setExportMsg(`Playlist metadata exported to: ${savedPath}`);
			}
		} catch (e: any) {
			setExportMsg(`Export failed: ${e.message || e}`);
		}
	};

	const handleImportPlaylistJson = async () => {
		try {
			const res = await window.electronAPI.openFile();
			if (!res) return;
			let data;
			try {
				data = JSON.parse(res.content);
			} catch {
				alert("Failed to parse file content as JSON.");
				return;
			}
			if (!data.name || !Array.isArray(data.tracks)) {
				alert("Invalid playlist format: missing name or tracks array.");
				return;
			}
			const newPlaylist: Playlist = {
				id: crypto.randomUUID(),
				name: data.name.endsWith("(Imported)")
					? data.name
					: `${data.name} (Imported)`,
				tracks: data.tracks,
			};
			setPlaylists((prev) => [...prev, newPlaylist]);
			setActivePlaylistId(newPlaylist.id);
			setExportMsg(
				`Playlist metadata imported successfully from: ${res.filePath}`,
			);
		} catch (e: any) {
			alert("Import failed: " + (e.message || e));
		}
	};

	const handleEditTags = async (file: any) => {
		const currentFilename = file.name.split(/[/\\]/).pop() || file.name;
		const parsed = cleanTrackMetadata(currentFilename);
		const existing = trackMeta[file.path];

		let initialTitle = existing?.title || parsed.title || "";
		let initialArtist = existing?.artist || parsed.artist || "";
		let initialAlbum = existing?.album || "";
		let initialGenre = existing?.genre || "";
		let initialYear: string | number = existing?.year ?? "";
		let initialBpm: string | number = existing?.bpm ?? "";
		let initialKey = existing?.key || "";

		try {
			const tags = await window.electronAPI.readTags(file.path);
			if (tags) {
				if (tags.title) initialTitle = tags.title;
				if (tags.artist) initialArtist = tags.artist;
				if (tags.album) initialAlbum = tags.album;
				if (tags.genre) initialGenre = tags.genre;
				if (tags.year !== undefined && tags.year !== null) initialYear = tags.year;
				if (tags.bpm !== undefined && tags.bpm !== null) initialBpm = tags.bpm;
				if (tags.initialKey || tags.key) initialKey = tags.initialKey || tags.key;
			}
		} catch {
			// fallback to initial values
		}

		setEditTagsData({
			title: initialTitle,
			artist: initialArtist,
			album: initialAlbum,
			genre: initialGenre,
			year: initialYear,
			bpm: initialBpm,
			key: initialKey,
			filename: currentFilename,
		});
		setEditTagsResults([]);
		setEditTagsSearching(null);
		setEditTagsSearchError("");
		setEditTagsFile({ name: file.name, path: file.path });
	};

	const handleSearchBeatport = async () => {
		if (!editTagsData.title && !editTagsData.artist) return;
		setEditTagsSearching("beatport");
		setEditTagsSearchError("");
		setEditTagsResults([]);
		try {
			const results = await window.electronAPI.searchBeatport(
				editTagsData.artist,
				editTagsData.title,
			);
			if (results && results.length > 0) {
				setEditTagsResults(results);
			} else {
				setEditTagsSearchError("No matching tracks found on Beatport.");
			}
		} catch (e: any) {
			setEditTagsSearchError("Beatport search failed: " + (e.message || e));
		} finally {
			setEditTagsSearching(null);
		}
	};

	const handleSearchMusicBrainz = async () => {
		if (!editTagsData.title && !editTagsData.artist) return;
		setEditTagsSearching("musicbrainz");
		setEditTagsSearchError("");
		setEditTagsResults([]);
		try {
			const results = await window.electronAPI.searchMusicBrainz(
				editTagsData.artist,
				editTagsData.title,
			);
			if (results && results.length > 0) {
				setEditTagsResults(results);
			} else {
				setEditTagsSearchError("No matching recordings found on MusicBrainz.");
			}
		} catch (e: any) {
			setEditTagsSearchError("MusicBrainz search failed: " + (e.message || e));
		} finally {
			setEditTagsSearching(null);
		}
	};

	const handleAutoCleanFilename = () => {
		if (!editTagsFile) return;
		const originalFilename = editTagsFile.name.split(/[/\\]/).pop() || editTagsFile.name;
		const parsed = cleanTrackMetadata(originalFilename);
		setEditTagsData((prev) => ({
			...prev,
			title: parsed.title || prev.title,
			artist: parsed.artist || prev.artist,
		}));
	};

	const applySearchResult = (res: any) => {
		setEditTagsData((prev) => ({
			...prev,
			title: res.title || prev.title,
			artist: res.artist || prev.artist,
			album: res.album || prev.album,
			genre: res.genre || prev.genre,
			bpm: res.bpm !== undefined && res.bpm !== null ? res.bpm : prev.bpm,
			key: res.key || prev.key,
			year: res.year !== undefined && res.year !== null ? res.year : prev.year,
		}));
		setEditTagsResults([]);
	};

	const confirmEditTags = async () => {
		if (!editTagsFile) return;
		try {
			const { filename, ...tags } = editTagsData;
			await window.electronAPI.writeTags(editTagsFile.path, tags);
			const originalFilename =
				editTagsFile.name.split(/[/\\]/).pop() || editTagsFile.name;
			let currentPath = editTagsFile.path;
			if (filename && filename !== originalFilename) {
				const renamed = await window.electronAPI.renameDownload(editTagsFile.path, filename);
				if (renamed && typeof renamed === "string") currentPath = renamed;
			}
			setTrackMeta((prev) => ({
				...prev,
				[currentPath]: {
					...(prev[editTagsFile.path] || { duration: 0, bitrate: 0 }),
					title: editTagsData.title,
					artist: editTagsData.artist,
					album: editTagsData.album,
					genre: editTagsData.genre,
					bpm: editTagsData.bpm ? parseFloat(String(editTagsData.bpm)) : null,
					key: editTagsData.key,
					year: editTagsData.year ? parseInt(String(editTagsData.year), 10) : null,
				},
			}));
			setDlLogs((prev) => [
				...prev,
				`[Library] Tags saved: ${editTagsData.title || editTagsFile.name}`,
			]);
			setEditTagsFile(null);
			loadDownloadedFiles();
		} catch (e: any) {
			alert("Error saving tags: " + (e.message || e));
		}
		setEditTagsFile(null);
	};

	const handleDeleteFile = async (filePath: string) => {
		if (confirm("Are you sure you want to delete this file?")) {
			try {
				await window.electronAPI.deleteDownload(filePath);
				setDlLogs((prev) => [
					...prev,
					`[Library] File deleted: ${filePath.split(/[/\\]/).pop()}`,
				]);
				loadDownloadedFiles();
			} catch (e: any) {
				alert("Error deleting file: " + e.message);
			}
		}
	};

	const handleUploadFile = async (filePath: string) => {
		const filename = filePath.split(/[/\\]/).pop() || "";
		const baseName = filename.replace(/\.[^/.]+$/, "");
		let defaultArtist = "Sidecamp";
		let defaultTitle = baseName;
		let defaultAlbum = "";

		try {
			const tags = await window.electronAPI.readTags(filePath);
			if (tags.title) defaultTitle = tags.title;
			if (tags.artist) defaultArtist = tags.artist;
			if (tags.album) defaultAlbum = tags.album;
		} catch {
			if (baseName.includes(" - ")) {
				const parts = baseName.split(" - ");
				defaultArtist = parts[0].trim();
				defaultTitle = parts[1].trim();
			}
		}

		setMetadataTitle(defaultTitle);
		setMetadataArtist(defaultArtist);
		setMetadataAlbum(defaultAlbum);
		setMetadataModalFile({ name: filename, path: filePath });
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
			// Encrypt DMs to the account's Zen identity when we have it. Without
			// it the daemon falls back to its own local pair, which peers that
			// already resolved the identity key will not accept.
			zenPair: loadChatIdentity(),
		});
		connectChat();
	};

	const handleStopPeer = async () => {
		await window.electronAPI.stopPeer();
		disconnectChat();
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
			loadDownloadedFiles(); // Refresh downloads list automatically!

			if (autoUpload && filePath) {
				handleUploadFileAuto(filePath);
			}
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
			loadDownloadedFiles(); // Refresh downloads list automatically!

			if (autoUpload && resultPaths.length > 0) {
				for (const p of resultPaths) {
					if (p) handleUploadFileAuto(p);
				}
			}
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

	const handleSeedFile = async (filePath: string) => {
		const filename = filePath.split(/[/\\]/).pop() || "";
		setDlLogs((prev) => [
			...prev,
			`[Library] Starting seed for: ${filename}...`,
		]);
		try {
			const magnetUri = await window.electronAPI.torrentSeed(filePath);
			setDlLogs((prev) => [
				...prev,
				`[Library] Torrent seeding! Magnet Link: ${magnetUri}`,
			]);
			alert(
				`Started seeding torrent!\n\nMagnet URI:\n${magnetUri}\n\nCopied to clipboard!`,
			);
			navigator.clipboard.writeText(magnetUri).catch(() => {});
			loadDownloadedFiles();
		} catch (e: any) {
			setDlLogs((prev) => [
				...prev,
				`[Library] Seeding failed: ${e.message || e}`,
			]);
			alert("Error seeding file: " + (e.message || e));
		}
	};

	const handleSeedSelectedClick = () => {
		if (selectedFiles.length === 0) return;
		setAlbumSeedName("My Custom Album");
		setAlbumSeedModalOpen(true);
	};

	const confirmSeedSelected = async () => {
		setAlbumSeedModalOpen(false);
		setDlLogs((prev) => [
			...prev,
			`[Library] Starting seed for album: "${albumSeedName}" with ${selectedFiles.length} files...`,
		]);
		try {
			const magnetUri = await window.electronAPI.torrentSeed(
				selectedFiles,
				albumSeedName,
			);
			setDlLogs((prev) => [
				...prev,
				`[Library] Album Torrent seeding! Magnet Link: ${magnetUri}`,
			]);
			alert(
				`Started seeding album torrent!\n\nMagnet URI:\n${magnetUri}\n\nCopied to clipboard!`,
			);
			navigator.clipboard.writeText(magnetUri).catch(() => {});
			setSelectedFiles([]);
			loadDownloadedFiles();
		} catch (e: any) {
			setDlLogs((prev) => [
				...prev,
				`[Library] Seeding failed: ${e.message || e}`,
			]);
			alert("Error seeding album: " + (e.message || e));
		}
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
			loadDownloadedFiles();
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
				loadDownloadedFiles();
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

	// Library table derivations, memoized: without this the whole block re-ran on
	// every App render — including the ~4Hz timeupdate ticks during playback.
	const lib = useMemo(() => {
		const q = librarySearch.toLowerCase().trim();
		const folderOf = (name: string) => {
			const parts = name.split(/[/\\]/);
			return parts.length > 1 ? parts[0] : "(root)";
		};
		const rows = downloadedFiles.map((f) => {
			const m = trackMeta[f.path];
			const basename = f.name.split(/[/\\]/).pop() || f.name;
			return {
				file: f,
				basename,
				title: m?.title || basename.replace(/\.[^/.]+$/, ""),
				artist: m?.artist || "",
				album: m?.album || "",
				genre: m?.genre || "",
				bpm: m?.bpm ?? null,
				key: m?.key || "",
				duration: m?.duration || 0,
				year: m?.year ?? null,
				kbps: m?.bitrate ? Math.round(m.bitrate / 1000) : 0,
				peaks: m?.peaks,
			};
		});
		// Collection pane data: counts over the whole library, not the filtered view
		const countBy = (get: (r: (typeof rows)[0]) => string) => {
			const map = new Map<string, number>();
			rows.forEach((r) => {
				const k = get(r) || "(unknown)";
				map.set(k, (map.get(k) || 0) + 1);
			});
			return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
		};
		const artists = countBy((r) => r.artist);
		const genres = countBy((r) => r.genre);
		const folders = countBy((r) => folderOf(r.file.name));
		const catFiltered = rows.filter((r) =>
			libFilter.type === "all"
				? true
				: libFilter.type === "artist"
					? (r.artist || "(unknown)") === libFilter.value
					: libFilter.type === "genre"
						? (r.genre || "(unknown)") === libFilter.value
						: folderOf(r.file.name) === libFilter.value,
		);
		const libraryFiltered = catFiltered
			.filter((r) =>
				`${r.title} ${r.artist} ${r.album} ${r.genre} ${r.file.name}`
					.toLowerCase()
					.includes(q),
			)
			.sort(
				(a, b) =>
					sortDir *
					(sortCol === "title"
						? collator.compare(a.title, b.title)
						: sortCol === "artist"
							? collator.compare(a.artist, b.artist)
							: sortCol === "album"
								? collator.compare(a.album, b.album)
								: sortCol === "genre"
									? collator.compare(a.genre, b.genre)
									: sortCol === "bpm"
										? (a.bpm || 0) - (b.bpm || 0)
										: sortCol === "key"
											? collator.compare(a.key, b.key)
											: sortCol === "time"
												? a.duration - b.duration
												: sortCol === "year"
													? (a.year || 0) - (b.year || 0)
													: sortCol === "kbps"
														? a.kbps - b.kbps
														: sortCol === "size"
															? a.file.size - b.file.size
															: a.file.ctime - b.file.ctime),
			);
		const libraryQueue = libraryFiltered.map((r) => libraryQueueItem(r.file));
		return { rows, artists, genres, folders, libraryFiltered, libraryQueue };
	}, [downloadedFiles, trackMeta, librarySearch, libFilter, sortCol, sortDir]);
	const selectedSet = useMemo(() => new Set(selectedFiles), [selectedFiles]);
	const browserRoots = [
		...(downloadsDir ? [{ label: "Downloads", path: downloadsDir }] : []),
		...validFolders.map((f) => ({
			label: f.split(/[/\\]/).pop() || f,
			path: f,
		})),
	];

	// Jump from a Library track to its folder in the Shared Files browser.
	const revealInSharedFiles = (filePath: string) => {
		const norm = (p: string) => p.replace(/[\\/]+/g, "/").toLowerCase();
		const root = browserRoots.find((r) =>
			norm(filePath).startsWith(norm(r.path) + "/"),
		);
		if (!root) return;
		const rel = filePath.slice(root.path.length).replace(/^[\\/]/, "");
		const dir = rel.split(/[\\/]/).slice(0, -1).join("/");
		setBrowserRoot(root.path);
		setBrowserPath(dir);
		loadBrowser(root.path, dir);
		setActiveTab("peer");
	};

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

	const handleOrganizePickFolder = async () => {
		const dir = await window.electronAPI.pickFolder();
		if (dir) {
			setOrganizeRoot(dir);
			setOrganizePlan(null);
			setOrganizeResult(null);
			setOrganizeError("");
		}
	};

	const handleOrganizeScan = async (mode = organizeMode) => {
		if (!organizeRoot) return;
		setOrganizeBusy(true);
		setOrganizeError("");
		setOrganizeResult(null);
		try {
			const res = await window.electronAPI.organizeScan(organizeRoot, mode);
			if (res?.error) {
				setOrganizeError(res.error);
				setOrganizePlan(null);
			} else setOrganizePlan(res);
		} catch (e: any) {
			setOrganizeError(e.message);
		} finally {
			setOrganizeBusy(false);
		}
	};

	const handleFillGenres = async () => {
		if (!organizeRoot || genreBusy) return;
		setGenreBusy(true);
		setGenreSummary(null);
		setGenreProgress(null);
		setOrganizeError("");
		window.electronAPI.onGenreProgress((data: any) => setGenreProgress(data));
		try {
			const res = await window.electronAPI.organizeFillGenres(organizeRoot);
			if (res?.error) setOrganizeError(res.error);
			else {
				setGenreSummary(res);
				if (organizePlan) await handleOrganizeScan(); // refresh plan with new genres
			}
		} catch (e: any) {
			setOrganizeError(e.message);
		} finally {
			setGenreBusy(false);
			setGenreProgress(null);
		}
	};

	const handleOrganizeApply = async () => {
		if (!organizeRoot || !organizePlan?.actions.length) return;
		setOrganizeBusy(true);
		setOrganizeError("");
		try {
			const res = await window.electronAPI.organizeApply(
				organizeRoot,
				organizePlan.actions,
			);
			if (res?.error) setOrganizeError(res.error);
			else {
				setOrganizeResult(res);
				setOrganizePlan(null);
			}
		} catch (e: any) {
			setOrganizeError(e.message);
		} finally {
			setOrganizeBusy(false);
		}
	};

	if (!hasConnected) {
		return (
			<ConnectScreen
				onConnected={(connectedServer, connectedToken, chatIdentity) => {
					setServer(connectedServer);
					setToken(connectedToken);
					localStorage.setItem("tc_server", connectedServer);
					localStorage.setItem("tc_token", connectedToken);
					// Kept alongside the token, same trust model: the password isn't
					// stored, so the vault can't be reopened after this without a
					// fresh login.
					if (chatIdentity) {
						localStorage.setItem(
							CHAT_IDENTITY_KEY,
							JSON.stringify(chatIdentity),
						);
					} else {
						localStorage.removeItem(CHAT_IDENTITY_KEY);
					}
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
						className={`nav-item ${activeTab === "library" ? "active" : ""}`}
						onClick={() => setActiveTab("library")}
						title="Library"
					>
						<span className="icon">
							<Music size={18} />
						</span>
						<span className="nav-label">Library</span>
					</button>
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
					<button
						className={`nav-item ${activeTab === "chat" ? "active" : ""}`}
						onClick={() => setActiveTab("chat")}
						title="Chat — peer messaging"
					>
						<span className="icon">
							<MessageCircle size={18} />
						</span>
						<span className="nav-label">Chat</span>
					</button>
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

				<label
					className="nav-item"
					title="Theme"
					style={{ marginTop: "auto", cursor: "pointer" }}
				>
					<span className="icon">
						<Palette size={16} />
					</span>
					{!sidebarCollapsed && (
						<select
							value={theme}
							onChange={(e) => setTheme(e.target.value)}
							style={{
								background: "transparent",
								color: "inherit",
								border: "none",
								font: "inherit",
								flex: 1,
							}}
						>
							<option value="dark">Dark</option>
							<option value="light">Light</option>
							<option value="grey">Grey</option>
							<option value="nordic">Nordic</option>
							<option value="nordic-dark">Nordic Dark</option>
						</select>
					)}
				</label>

				<div className="status-indicator" style={{ marginTop: "0.5rem" }}>
					<div className={`status-dot ${peerStatus}`}></div>
					{!sidebarCollapsed && <span>{peerStatus.toUpperCase()}</span>}
				</div>
			</div>

			<main className="main-content">
				<div className="content-area">
					{currentPlayback &&
						scrollWave &&
						scrollWave.path === currentPlayback.path && (
							<div className="scrollwave-wrap">
								<ScrollWave
									peaks={scrollWave.peaks}
									pps={SCROLL_PPS}
									audioRef={audioRef}
								/>
							</div>
						)}
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
									Shared Files{" "}
									<span
										style={{
											fontSize: "0.82rem",
											fontWeight: 400,
											color: "var(--text-muted)",
											marginLeft: "6px",
										}}
									>
										browse, move & organize
									</span>
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

					{activeTab === "library" &&
						showPlaylists &&
						(() => {
							const pickerFiltered = downloadedFiles.filter((f) =>
								f.name
									.toLowerCase()
									.includes(playlistPickerSearch.toLowerCase().trim()),
							);
							const playlistQueue = activePlaylist
								? activePlaylist.tracks.map(libraryQueueItem)
								: [];
							return (
								<div className="glass-card" style={{ marginBottom: "1.5rem" }}>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											marginBottom: "1.5rem",
										}}
									>
										<h3 style={{ margin: 0 }}>
											Playlists{" "}
											<span
												style={{
													fontSize: "0.85rem",
													fontWeight: 400,
													color: "var(--text-muted)",
													marginLeft: "8px",
												}}
											>
												build a DJ set & export to a CDJ-ready folder
											</span>
										</h3>
									</div>

									<div
										style={{
											display: "flex",
											gap: "1.5rem",
											alignItems: "flex-start",
											flexWrap: "wrap",
										}}
									>
										<div style={{ flex: "0 0 260px", minWidth: "220px" }}>
											<div
												style={{
													display: "flex",
													gap: "8px",
													marginBottom: "0.5rem",
												}}
											>
												<input
													type="text"
													value={newPlaylistName}
													onChange={(e) => setNewPlaylistName(e.target.value)}
													placeholder="New playlist name"
													className="glass-input"
													style={{ flex: 1 }}
													onKeyDown={(e) =>
														e.key === "Enter" && createPlaylist()
													}
												/>
												<Button
													variant="primary"
													onClick={createPlaylist}
													disabled={!newPlaylistName.trim()}
													title="Create playlist"
												>
													<FolderPlus size={16} />
												</Button>
											</div>
											<Button
												variant="secondary"
												onClick={handleImportPlaylistJson}
												title="Import playlist"
												style={{
													width: "100%",
													marginBottom: "1rem",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													gap: "6px",
													padding: "0.45rem 0.8rem",
													fontSize: "0.82rem",
												}}
											>
												<Share2 size={14} /> Import Playlist (JSON)
											</Button>
											<div
												style={{
													display: "flex",
													flexDirection: "column",
													gap: "6px",
												}}
											>
												{playlists.map((p) => (
													<div
														key={p.id}
														onClick={() => setActivePlaylistId(p.id)}
														onDragOver={(e) => {
															if (
																e.dataTransfer.types.includes(
																	"text/sidecamp-paths",
																)
															) {
																e.preventDefault();
																e.dataTransfer.dropEffect = "copy";
															}
														}}
														onDrop={(e) => {
															e.preventDefault();
															try {
																addTracksToPlaylist(
																	p.id,
																	JSON.parse(
																		e.dataTransfer.getData(
																			"text/sidecamp-paths",
																		),
																	),
																);
															} catch {
																/* not our payload */
															}
														}}
														style={{
															display: "flex",
															alignItems: "center",
															gap: "8px",
															padding: "0.6rem 0.8rem",
															borderRadius: "8px",
															cursor: "pointer",
															background:
																p.id === activePlaylistId
																	? "rgba(179,102,255,0.15)"
																	: "rgba(255,255,255,0.03)",
															border: `1px solid ${p.id === activePlaylistId ? "var(--primary)" : "var(--glass-border)"}`,
														}}
													>
														<Disc3 size={15} color="var(--text-muted)" />
														<span
															style={{
																flex: 1,
																minWidth: 0,
																fontSize: "0.88rem",
																color: "var(--text-main)",
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
															}}
														>
															{p.name}
														</span>
														<span
															style={{
																fontSize: "0.72rem",
																color: "var(--text-muted)",
															}}
														>
															{p.tracks.length}
														</span>
														<button
															onClick={(e) => {
																e.stopPropagation();
																deletePlaylist(p.id);
															}}
															title="Delete playlist"
															style={{
																background: "transparent",
																border: "none",
																color: "#e74c3c",
																cursor: "pointer",
																padding: "2px",
																display: "inline-flex",
															}}
														>
															<Trash2 size={14} />
														</button>
													</div>
												))}
												{playlists.length === 0 && (
													<div
														style={{
															color: "var(--text-muted)",
															fontStyle: "italic",
															fontSize: "0.85rem",
														}}
													>
														No playlists yet.
													</div>
												)}
											</div>
										</div>

										<div style={{ flex: 1, minWidth: "320px" }}>
											{!activePlaylist ? (
												<div
													style={{
														color: "var(--text-muted)",
														fontStyle: "italic",
														padding: "2rem 0",
													}}
												>
													Select or create a playlist to start.
												</div>
											) : (
												<>
													<div
														style={{
															display: "flex",
															justifyContent: "space-between",
															alignItems: "center",
															gap: "12px",
															marginBottom: "1rem",
															flexWrap: "wrap",
														}}
													>
														<h4 style={{ margin: 0 }}>
															{activePlaylist.name}{" "}
															<span
																style={{
																	fontSize: "0.8rem",
																	fontWeight: 400,
																	color: "var(--text-muted)",
																}}
															>
																({activePlaylist.tracks.length} tracks)
															</span>
														</h4>
														<div style={{ display: "flex", gap: "8px" }}>
															{activePlaylist.tracks.length > 0 && (
																<Button
																	variant="primary"
																	onClick={() => playAt(playlistQueue, 0)}
																	style={{
																		padding: "0.4rem 0.9rem",
																		fontSize: "0.85rem",
																	}}
																>
																	▶ Play
																</Button>
															)}
															<Button
																variant="accent"
																onClick={handleExportPlaylist}
																disabled={activePlaylist.tracks.length === 0}
																style={{
																	padding: "0.4rem 0.9rem",
																	fontSize: "0.85rem",
																}}
															>
																<Download size={14} /> Export (CDJ)
															</Button>
															<Button
																variant="secondary"
																onClick={handleExportPlaylistJson}
																style={{
																	padding: "0.4rem 0.9rem",
																	fontSize: "0.85rem",
																	display: "flex",
																	alignItems: "center",
																	gap: "6px",
																}}
															>
																<Share2 size={14} /> Export Playlist (JSON)
															</Button>
														</div>
													</div>
													{exportMsg && (
														<div
															style={{
																padding: "0.5rem 0.8rem",
																marginBottom: "1rem",
																background: "rgba(102,255,153,0.08)",
																border: "1px solid rgba(102,255,153,0.4)",
																borderRadius: "8px",
																fontSize: "0.82rem",
																wordBreak: "break-all",
															}}
														>
															{exportMsg}
														</div>
													)}

													<div
														style={{
															display: "flex",
															flexDirection: "column",
															gap: "4px",
															marginBottom: "1.5rem",
														}}
													>
														{activePlaylist.tracks.map((t, i) => (
															<div
																key={i}
																style={{
																	display: "flex",
																	alignItems: "center",
																	gap: "10px",
																	padding: "0.5rem 0.8rem",
																	background: "rgba(255,255,255,0.03)",
																	border: "1px solid var(--glass-border)",
																	borderRadius: "8px",
																}}
															>
																<span
																	style={{
																		width: "24px",
																		fontSize: "0.8rem",
																		color: "var(--text-muted)",
																		textAlign: "right",
																	}}
																>
																	{String(i + 1).padStart(2, "0")}
																</span>
																<span
																	style={{
																		flex: 1,
																		minWidth: 0,
																		fontSize: "0.88rem",
																		color: "var(--text-main)",
																		overflow: "hidden",
																		textOverflow: "ellipsis",
																		whiteSpace: "nowrap",
																	}}
																>
																	{t.name}
																</span>
																<button
																	onClick={() => playAt(playlistQueue, i)}
																	title="Play"
																	style={{
																		background: "transparent",
																		border: "none",
																		color: "var(--primary)",
																		cursor: "pointer",
																		padding: "3px",
																		display: "inline-flex",
																	}}
																>
																	<Play size={15} />
																</button>
																<button
																	onClick={() => moveTrack(i, -1)}
																	disabled={i === 0}
																	title="Move up"
																	style={{
																		background: "transparent",
																		border: "none",
																		color: "var(--text-muted)",
																		cursor: i === 0 ? "default" : "pointer",
																		opacity: i === 0 ? 0.3 : 1,
																		padding: "3px",
																		display: "inline-flex",
																	}}
																>
																	<ChevronUp size={16} />
																</button>
																<button
																	onClick={() => moveTrack(i, 1)}
																	disabled={
																		i === activePlaylist.tracks.length - 1
																	}
																	title="Move down"
																	style={{
																		background: "transparent",
																		border: "none",
																		color: "var(--text-muted)",
																		cursor:
																			i === activePlaylist.tracks.length - 1
																				? "default"
																				: "pointer",
																		opacity:
																			i === activePlaylist.tracks.length - 1
																				? 0.3
																				: 1,
																		padding: "3px",
																		display: "inline-flex",
																	}}
																>
																	<ChevronDown size={16} />
																</button>
																<button
																	onClick={() => removeTrackAt(i)}
																	title="Remove"
																	style={{
																		background: "transparent",
																		border: "none",
																		color: "#e74c3c",
																		cursor: "pointer",
																		padding: "3px",
																		display: "inline-flex",
																	}}
																>
																	<X size={15} />
																</button>
															</div>
														))}
														{activePlaylist.tracks.length === 0 && (
															<div
																style={{
																	color: "var(--text-muted)",
																	fontStyle: "italic",
																	fontSize: "0.85rem",
																}}
															>
																Empty — add tracks from your library below.
															</div>
														)}
													</div>

													<div
														style={{
															borderTop: "1px solid var(--glass-border)",
															paddingTop: "1rem",
														}}
													>
														<div
															style={{
																display: "flex",
																justifyContent: "space-between",
																alignItems: "center",
																gap: "12px",
																marginBottom: "0.75rem",
															}}
														>
															<strong style={{ fontSize: "0.9rem" }}>
																Add from Library
															</strong>
															<input
																type="text"
																value={playlistPickerSearch}
																onChange={(e) =>
																	setPlaylistPickerSearch(e.target.value)
																}
																placeholder="Search library…"
																className="glass-input"
																style={{
																	flex: 1,
																	maxWidth: "280px",
																	padding: "0.35rem 0.7rem",
																	fontSize: "0.82rem",
																}}
															/>
														</div>
														<div
															style={{
																display: "flex",
																flexDirection: "column",
																gap: "4px",
																maxHeight: "320px",
																overflowY: "auto",
																paddingRight: "4px",
															}}
														>
															{pickerFiltered.map((file, i) => {
																const basename =
																	file.name.split(/[/\\]/).pop() || file.name;
																const already = activePlaylist.tracks.some(
																	(t) => t.path === file.path,
																);
																return (
																	<div
																		key={i}
																		style={{
																			display: "flex",
																			alignItems: "center",
																			gap: "10px",
																			padding: "0.45rem 0.8rem",
																			background: "rgba(255,255,255,0.03)",
																			border: "1px solid var(--glass-border)",
																			borderRadius: "8px",
																		}}
																	>
																		<span
																			style={{
																				flex: 1,
																				minWidth: 0,
																				fontSize: "0.85rem",
																				color: "var(--text-main)",
																				overflow: "hidden",
																				textOverflow: "ellipsis",
																				whiteSpace: "nowrap",
																			}}
																		>
																			{basename}
																		</span>
																		<Button
																			variant="secondary"
																			onClick={() => addTrackToActive(file)}
																			disabled={already}
																			style={{
																				padding: "0.25rem 0.6rem",
																				fontSize: "0.78rem",
																			}}
																		>
																			{already ? "✓ Added" : "+ Add"}
																		</Button>
																	</div>
																);
															})}
															{pickerFiltered.length === 0 && (
																<div
																	style={{
																		color: "var(--text-muted)",
																		fontStyle: "italic",
																		fontSize: "0.85rem",
																	}}
																>
																	No library tracks. Add music first.
																</div>
															)}
														</div>
													</div>
												</>
											)}
										</div>
									</div>
								</div>
							);
						})()}

					{activeTab === "library" && showOrganize && (
						<div className="glass-card">
							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									marginBottom: "1rem",
								}}
							>
								<h3 style={{ margin: 0 }}>
									Organize{" "}
									<span
										style={{
											fontSize: "0.85rem",
											fontWeight: 400,
											color: "var(--text-muted)",
											marginLeft: "8px",
										}}
									>
										rename, sort & deduplicate a music folder
									</span>
								</h3>
							</div>

							<div
								style={{
									display: "flex",
									gap: "8px",
									alignItems: "center",
									flexWrap: "wrap",
									marginBottom: "1rem",
								}}
							>
								<Button
									variant="secondary"
									onClick={handleOrganizePickFolder}
									disabled={organizeBusy}
									style={{ display: "flex", alignItems: "center", gap: "6px" }}
								>
									<Folder size={16} />{" "}
									{organizeRoot ? "Change folder" : "Pick folder"}
								</Button>
								{organizeRoot && (
									<span
										style={{
											fontFamily: "monospace",
											fontSize: "0.85rem",
											color: "var(--text-muted)",
											wordBreak: "break-all",
										}}
									>
										{organizeRoot}
									</span>
								)}
							</div>

							{organizeRoot && (
								<div
									style={{
										display: "flex",
										gap: "8px",
										alignItems: "center",
										flexWrap: "wrap",
										marginBottom: "1rem",
									}}
								>
									<select
										className="glass-input"
										value={organizeMode}
										onChange={(e) => {
											const m = e.target.value as any;
											setOrganizeMode(m);
											if (organizePlan) handleOrganizeScan(m);
										}}
										disabled={organizeBusy}
										style={{ width: "auto", padding: "0.4rem 0.8rem" }}
									>
										<option value="artist">By Artist</option>
										<option value="artist-album">By Artist / Album</option>
										<option value="genre">By Genre</option>
										<option value="genre-artist">By Genre / Artist</option>
									</select>
									<Button
										variant="primary"
										onClick={() => handleOrganizeScan()}
										disabled={organizeBusy}
									>
										{organizeBusy ? "Working…" : "Scan"}
									</Button>
									{organizePlan && organizePlan.actions.length > 0 && (
										<Button
											variant="primary"
											onClick={handleOrganizeApply}
											disabled={organizeBusy}
										>
											Apply {organizePlan.actions.length} changes
										</Button>
									)}
									{!genreBusy && (
										<Button
											variant="secondary"
											onClick={handleFillGenres}
											disabled={organizeBusy}
											title="Look up missing genres — Beatport for electronic, MusicBrainz for the rest (~1.4s per track)"
										>
											Fill genres
										</Button>
									)}
									{genreBusy && (
										<Button
											variant="secondary"
											onClick={() =>
												window.electronAPI.organizeFillGenresCancel()
											}
										>
											Cancel genre lookup
										</Button>
									)}
								</div>
							)}

							{genreBusy && (
								<div
									style={{
										padding: "0.6rem 0.9rem",
										marginBottom: "1rem",
										background: "rgba(179,102,255,0.12)",
										border: "1px solid var(--primary)",
										borderRadius: "8px",
										fontSize: "0.85rem",
										fontFamily: "monospace",
									}}
								>
									{genreProgress ? (
										<>
											Genres {genreProgress.current}/{genreProgress.total} —{" "}
											{genreProgress.file} → {genreProgress.genre || "no match"}
										</>
									) : (
										"Scanning for tracks with missing genre…"
									)}
								</div>
							)}

							{genreSummary && (
								<div
									style={{
										padding: "0.6rem 0.9rem",
										marginBottom: "1rem",
										background: "rgba(102,255,153,0.08)",
										border: "1px solid rgba(102,255,153,0.4)",
										borderRadius: "8px",
										fontSize: "0.85rem",
									}}
								>
									Genres{genreSummary.cancelled ? " (cancelled)" : ""} —{" "}
									{genreSummary.missing} tracks missing genre,{" "}
									{genreSummary.found} found, {genreSummary.written} written to
									mp3 tags.
								</div>
							)}

							{organizeError && (
								<div
									style={{
										color: "#e74c3c",
										fontSize: "0.85rem",
										marginBottom: "0.75rem",
									}}
								>
									{organizeError}
								</div>
							)}

							{organizeResult && (
								<div
									style={{
										padding: "0.6rem 0.9rem",
										marginBottom: "1rem",
										background: "rgba(102,255,153,0.08)",
										border: "1px solid rgba(102,255,153,0.4)",
										borderRadius: "8px",
										fontSize: "0.85rem",
									}}
								>
									Done — {organizeResult.done} files moved.
									{organizeResult.errors.length > 0 && (
										<div style={{ color: "#e74c3c", marginTop: "4px" }}>
											{organizeResult.errors.length} errors:{" "}
											{organizeResult.errors.slice(0, 5).join("; ")}
											{organizeResult.errors.length > 5 ? "…" : ""}
										</div>
									)}
								</div>
							)}

							{organizePlan && (
								<>
									<div
										style={{
											display: "flex",
											gap: "14px",
											flexWrap: "wrap",
											fontSize: "0.85rem",
											color: "var(--text-muted)",
											marginBottom: "1rem",
										}}
									>
										<span>{organizePlan.stats.total} tracks</span>
										<span>{organizePlan.stats.toMove} to move/rename</span>
										<span>{organizePlan.stats.duplicates} duplicates</span>
										<span>{organizePlan.stats.alreadyOk} already in place</span>
									</div>
									{organizePlan.actions.length === 0 && (
										<div
											style={{
												color: "var(--text-muted)",
												fontStyle: "italic",
											}}
										>
											Everything already organized. Nothing to do.
										</div>
									)}
									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "4px",
											maxHeight: "50vh",
											overflowY: "auto",
										}}
									>
										{organizePlan.actions.map((a, i) => (
											<div
												key={i}
												style={{
													padding: "0.5rem 0.9rem",
													background: "rgba(255,255,255,0.03)",
													border: "1px solid var(--glass-border)",
													borderRadius: "8px",
													fontSize: "0.8rem",
													fontFamily: "monospace",
												}}
											>
												<span
													style={{
														color:
															a.type === "duplicate"
																? "#e7a63c"
																: "var(--text-muted)",
													}}
												>
													{a.type === "duplicate" ? "⧉ dup " : "→ "}
												</span>
												<span style={{ wordBreak: "break-all" }}>
													{a.from.slice(organizeRoot.length + 1)}
												</span>
												<span style={{ color: "var(--text-muted)" }}> → </span>
												<span
													style={{
														wordBreak: "break-all",
														color: "var(--text-main)",
													}}
												>
													{a.to.slice(organizeRoot.length + 1)}
												</span>
											</div>
										))}
									</div>
								</>
							)}

							{!organizeRoot && (
								<div
									style={{
										textAlign: "center",
										padding: "3rem",
										color: "var(--text-muted)",
										fontStyle: "italic",
									}}
								>
									Pick a music folder to scan. Nothing is moved until you review
									the plan and click Apply.
								</div>
							)}
						</div>
					)}

					{activeTab === "library" &&
						(() => {
							const {
								rows,
								artists,
								genres,
								folders,
								libraryFiltered,
								libraryQueue,
							} = lib;
							// Checkbox with shift-click range selection over the current sorted view
							const rowCheck = (i: number, shift: boolean) => {
								const p = libraryFiltered[i].file.path;
								const willCheck = !selectedFiles.includes(p);
								if (
									shift &&
									lastCheckRef.current !== null &&
									lastCheckRef.current < libraryFiltered.length
								) {
									const [a, b] = [
										Math.min(lastCheckRef.current, i),
										Math.max(lastCheckRef.current, i),
									];
									const range = libraryFiltered
										.slice(a, b + 1)
										.filter((r) => !r.file.magnetUri)
										.map((r) => r.file.path);
									setSelectedFiles((prev) =>
										willCheck
											? [...new Set([...prev, ...range])]
											: prev.filter((x) => !range.includes(x)),
									);
								} else {
									setSelectedFiles((prev) =>
										willCheck ? [...prev, p] : prev.filter((x) => x !== p),
									);
								}
								lastCheckRef.current = i;
							};
							const coll = (
								type: "artist" | "genre" | "folder",
								entries: [string, number][],
							) =>
								entries.map(([name, n]) => (
									<div
										key={name}
										className={`coll-item ${libFilter.type === type && libFilter.value === name ? "active" : ""}`}
										onClick={() =>
											setLibFilter((f) =>
												f.type === type && f.value === name
													? { type: "all", value: "" }
													: { type, value: name },
											)
										}
									>
										<span className="coll-name">{name}</span>
										<span className="coll-count">{n}</span>
									</div>
								));
							const th = (id: string, label: string, cls?: string) => (
								<th
									className={`th-resizable ${cls || ""}`}
									style={{
										width: colWidths[id] || DEFAULT_COL_WIDTHS[id],
										minWidth: colWidths[id] || DEFAULT_COL_WIDTHS[id],
									}}
									onClick={() => toggleSort(id)}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											width: "100%",
											overflow: "hidden",
											textOverflow: "ellipsis",
										}}
									>
										<span
											style={{
												overflow: "hidden",
												textOverflow: "ellipsis",
												flex: 1,
											}}
										>
											{label}
										</span>
										{sortCol === id ? (
											<span className="sort-arrow">
												{sortDir === 1 ? "▲" : "▼"}
											</span>
										) : null}
									</div>
									<div
										className="col-resizer"
										title="Drag to resize, double-click to reset"
										onMouseDown={(e) => handleColResizeStart(id, e)}
										onDoubleClick={(e) => handleColReset(id, e)}
										onClick={(e) => e.stopPropagation()}
									/>
								</th>
							);
							const editableCell = (
								r: (typeof rows)[0],
								field: "title" | "artist" | "album" | "genre",
								cls?: string,
							) =>
								cellEdit &&
								cellEdit.path === r.file.path &&
								cellEdit.field === field ? (
									<td
										className={cls}
										style={{
											width: colWidths[field],
											maxWidth: colWidths[field],
										}}
									>
										<input
											className="cell-edit-input"
											autoFocus
											draggable={false}
											value={cellEdit.value}
											onChange={(e) =>
												setCellEdit((c) =>
													c ? { ...c, value: e.target.value } : c,
												)
											}
											onKeyDown={(e) => {
												if (e.key === "Enter") saveCellEdit();
												if (e.key === "Escape") setCellEdit(null);
											}}
											onMouseDown={(e) => e.stopPropagation()}
											onBlur={saveCellEdit}
											onDoubleClick={(e) => e.stopPropagation()}
										/>
									</td>
								) : (
									<td
										className={cls}
										style={{
											width: colWidths[field],
											maxWidth: colWidths[field],
										}}
										title={`${r.file.name} — double-click to edit ${field}`}
										onDoubleClick={(e) => {
											e.stopPropagation();
											setCellEdit({
												path: r.file.path,
												field,
												value: r[field] || "",
											});
										}}
									>
										{r[field]}
									</td>
								);
							return (
								<div className="glass-card">
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											gap: "12px",
											marginBottom: "1.5rem",
											flexWrap: "wrap",
										}}
									>
										<h3 style={{ margin: 0, whiteSpace: "nowrap" }}>
											Library{" "}
											<span
												style={{
													fontSize: "0.85rem",
													fontWeight: 400,
													color: "var(--text-muted)",
													marginLeft: "8px",
												}}
											>
												{librarySearch.trim()
													? `${libraryFiltered.length} / ${downloadedFiles.length}`
													: downloadedFiles.length}{" "}
												tracks
											</span>
										</h3>
										<input
											type="text"
											value={librarySearch}
											onChange={(e) => setLibrarySearch(e.target.value)}
											placeholder="Search tracks…"
											className="glass-input"
											style={{
												flex: 1,
												minWidth: "160px",
												maxWidth: "360px",
												padding: "0.4rem 0.8rem",
												fontSize: "0.85rem",
											}}
										/>
										<div
											style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
										>
											{selectedFiles.length > 0 && (
												<>
													{!isCapacitor && (
														<Button
															variant="accent"
															onClick={handleSeedSelectedClick}
															style={{
																padding: "0.4rem 0.8rem",
																fontSize: "0.85rem",
															}}
														>
															<Magnet size={14} /> Seed ({selectedFiles.length})
														</Button>
													)}
													{!isCapacitor && (
														<Button
															variant="accent"
															onClick={handleUploadSelected}
															disabled={uploadingFilePath !== null}
															title="Upload selection to TuneCamp"
															style={{
																padding: "0.4rem 0.8rem",
																fontSize: "0.85rem",
															}}
														>
															<Cloud size={14} /> Upload ({selectedFiles.length}
															)
														</Button>
													)}
													<Button
														variant="secondary"
														onClick={addSelectedToPlaylist}
														title="Add selection to the active playlist"
														style={{
															padding: "0.4rem 0.8rem",
															fontSize: "0.85rem",
														}}
													>
														<Plus size={14} /> Playlist
													</Button>
													<Button
														variant="danger"
														onClick={handleDeleteSelected}
														style={{
															padding: "0.4rem 0.8rem",
															fontSize: "0.85rem",
														}}
													>
														<Trash2 size={14} /> Delete ({selectedFiles.length})
													</Button>
													<Button
														variant="secondary"
														onClick={() => setSelectedFiles([])}
														style={{
															padding: "0.4rem 0.8rem",
															fontSize: "0.85rem",
														}}
													>
														Clear
													</Button>
												</>
											)}
											{!isCapacitor &&
												(analyzing ? (
													<Button
														variant="secondary"
														onClick={() => {
															analyzeCancelRef.current = true;
														}}
														title="Stop analysis"
														style={{
															padding: "0.4rem 0.8rem",
															fontSize: "0.85rem",
														}}
													>
														⏹ {analyzing.done}/{analyzing.total}
													</Button>
												) : (
													<Button
														variant="secondary"
														onClick={analyzeTracks}
														title="Detect BPM + waveform for tracks missing them (writes mp3 TBPM tag)"
														style={{
															padding: "0.4rem 0.8rem",
															fontSize: "0.85rem",
														}}
													>
														<Headphones size={14} /> Analyze
													</Button>
												))}
											{libraryFiltered.length > 0 && (
												<Button
													variant="primary"
													onClick={() => playAt(libraryQueue, 0)}
													style={{
														padding: "0.4rem 0.8rem",
														fontSize: "0.85rem",
													}}
												>
													▶ Play All
												</Button>
											)}
											<Button
												variant={showPlaylists ? "accent" : "secondary"}
												onClick={() => togglePanel("playlists")}
												style={{
													padding: "0.4rem 0.8rem",
													fontSize: "0.85rem",
												}}
											>
												<Disc3 size={14} /> Playlists
											</Button>
											{!isCapacitor && (
												<Button
													variant={showOrganize ? "accent" : "secondary"}
													onClick={() => togglePanel("organize")}
													style={{
														padding: "0.4rem 0.8rem",
														fontSize: "0.85rem",
													}}
												>
													<Folder size={14} /> Organize
												</Button>
											)}
											<Button
												variant="secondary"
												onClick={loadDownloadedFiles}
												style={{
													padding: "0.4rem 0.8rem",
													fontSize: "0.85rem",
												}}
											>
												Refresh
											</Button>
											<Button
												variant={showLibraryTable ? "secondary" : "accent"}
												onClick={() => setShowLibraryTable((v) => !v)}
												title={
													showLibraryTable
														? "Hide library table"
														: "Show library table"
												}
												style={{
													padding: "0.4rem 0.8rem",
													fontSize: "0.85rem",
												}}
											>
												{showLibraryTable ? (
													<EyeOff size={14} />
												) : (
													<Eye size={14} />
												)}
											</Button>
										</div>
									</div>
									{showLibraryTable && (
										<div className="library-body">
											<div className="collection-pane">
												<div
													className={`coll-item coll-all ${libFilter.type === "all" ? "active" : ""}`}
													onClick={() =>
														setLibFilter({ type: "all", value: "" })
													}
												>
													<span className="coll-name">All Tracks</span>
													<span className="coll-count">{rows.length}</span>
												</div>
												<div className="coll-header">Artists</div>
												{coll("artist", artists)}
												<div className="coll-header">Genres</div>
												{coll("genre", genres)}
												<div className="coll-header">Folders</div>
												{coll("folder", folders)}
											</div>
											<div className="track-table-wrap">
												<table className="track-table">
													<thead>
														<tr>
															<th
																className="th-resizable col-check"
																style={{
																	width: colWidths.check || DEFAULT_COL_WIDTHS.check,
																	minWidth: colWidths.check || DEFAULT_COL_WIDTHS.check,
																}}
															>
																<div
																	className="col-resizer"
																	title="Drag to resize, double-click to reset"
																	onMouseDown={(e) => handleColResizeStart("check", e)}
																	onDoubleClick={(e) => handleColReset("check", e)}
																	onClick={(e) => e.stopPropagation()}
																/>
															</th>
															<th
																className="th-resizable col-num"
																style={{
																	width: colWidths.num || DEFAULT_COL_WIDTHS.num,
																	minWidth: colWidths.num || DEFAULT_COL_WIDTHS.num,
																}}
															>
																#
																<div
																	className="col-resizer"
																	title="Drag to resize, double-click to reset"
																	onMouseDown={(e) => handleColResizeStart("num", e)}
																	onDoubleClick={(e) => handleColReset("num", e)}
																	onClick={(e) => e.stopPropagation()}
																/>
															</th>
															<th
																className="th-resizable col-wave"
																style={{
																	width: colWidths.wave || DEFAULT_COL_WIDTHS.wave,
																	minWidth: colWidths.wave || DEFAULT_COL_WIDTHS.wave,
																}}
															>
																Wave
																<div
																	className="col-resizer"
																	title="Drag to resize, double-click to reset"
																	onMouseDown={(e) => handleColResizeStart("wave", e)}
																	onDoubleClick={(e) => handleColReset("wave", e)}
																	onClick={(e) => e.stopPropagation()}
																/>
															</th>
															{th("title", "Title", "col-title")}
															{th("artist", "Artist", "col-artist")}
															{th("album", "Album", "col-album")}
															{th("genre", "Genre", "col-genre")}
															{th("bpm", "BPM", "col-bpm col-right")}
															{th("key", "Key", "col-key")}
															{th("time", "Time", "col-time col-right")}
															{th("year", "Year", "col-year col-right")}
															{th("kbps", "kbps", "col-kbps col-right")}
															{th("size", "Size", "col-size col-right")}
															{th("added", "Added", "col-added")}
															<th
																className="th-resizable col-actions"
																style={{
																	width: colWidths.actions || DEFAULT_COL_WIDTHS.actions,
																	minWidth: colWidths.actions || DEFAULT_COL_WIDTHS.actions,
																}}
															>
																<div
																	className="col-resizer"
																	title="Drag to resize, double-click to reset"
																	onMouseDown={(e) => handleColResizeStart("actions", e)}
																	onDoubleClick={(e) => handleColReset("actions", e)}
																	onClick={(e) => e.stopPropagation()}
																/>
															</th>
														</tr>
													</thead>
													<tbody>
														{libraryFiltered.map((r, i) => {
															const file = r.file;
															const isSeeding = !!file.magnetUri;
															const isCurrent =
																currentPlayback?.path === file.path;
															return (
																<tr
																	key={file.path}
																	className={isCurrent ? "playing" : ""}
																	onDoubleClick={() => playAt(libraryQueue, i)}
																	draggable={cellEdit?.path !== file.path}
																	onDragStart={(e) => {
																		const paths = selectedSet.has(file.path)
																			? selectedFiles
																			: [file.path];
																		e.dataTransfer.setData(
																			"text/sidecamp-paths",
																			JSON.stringify(paths),
																		);
																		e.dataTransfer.effectAllowed = "copy";
																	}}
																>
																	<td
																		className="col-check"
																		style={{
																			width: colWidths.check,
																			maxWidth: colWidths.check,
																		}}
																	>
																		{isSeeding ? (
																			<span
																				className="seed-check"
																				title="Already seeding"
																			>
																				✓
																			</span>
																		) : (
																			<input
																				type="checkbox"
																				checked={selectedSet.has(file.path)}
																				onChange={() => {}}
																				onClick={(e) => {
																					e.stopPropagation();
																					rowCheck(i, e.shiftKey);
																				}}
																			/>
																		)}
																	</td>
																	<td
																		className="col-num"
																		style={{
																			width: colWidths.num,
																			maxWidth: colWidths.num,
																		}}
																	>
																		{isCurrent ? "▶" : i + 1}
																	</td>
																	<td
																		className="col-wave"
																		style={{
																			width: colWidths.wave,
																			maxWidth: colWidths.wave,
																		}}
																		title={
																			isCurrent
																				? "Click to seek"
																				: r.peaks?.length
																					? "Double-click row to play"
																					: "Run Analyze to render the waveform"
																		}
																		onClick={(e) => {
																			if (
																				!isCurrent ||
																				!audioRef.current ||
																				!duration
																			)
																				return;
																			e.stopPropagation();
																			const rect =
																				e.currentTarget.getBoundingClientRect();
																			audioRef.current.currentTime =
																				((e.clientX - rect.left) / rect.width) *
																				duration;
																		}}
																	>
																		<Waveform
																			peaks={r.peaks}
																			active={isCurrent}
																			progress={
																				isCurrent && duration > 0
																					? Math.round(
																							(currentTime / duration) * 100,
																						)
																					: 0
																			}
																		/>
																	</td>
																	{editableCell(r, "title", "col-title")}
																	{editableCell(
																		r,
																		"artist",
																		"cell-ellipsis col-artist",
																	)}
																	{editableCell(
																		r,
																		"album",
																		"cell-ellipsis cell-muted col-album",
																	)}
																	{editableCell(
																		r,
																		"genre",
																		"cell-ellipsis cell-muted col-genre",
																	)}
																	<td
																		className="col-right cell-mono"
																		style={{
																			width: colWidths.bpm,
																			maxWidth: colWidths.bpm,
																		}}
																	>
																		{r.bpm ?? ""}
																	</td>
																	<td
																		className="col-key cell-mono"
																		style={{
																			width: colWidths.key,
																			maxWidth: colWidths.key,
																		}}
																	>
																		{r.key}
																	</td>
																	<td
																		className="col-right cell-mono"
																		style={{
																			width: colWidths.time,
																			maxWidth: colWidths.time,
																		}}
																	>
																		{r.duration ? formatTime(r.duration) : ""}
																	</td>
																	<td
																		className="col-right cell-mono cell-muted"
																		style={{
																			width: colWidths.year,
																			maxWidth: colWidths.year,
																		}}
																	>
																		{r.year ?? ""}
																	</td>
																	<td
																		className="col-right cell-mono cell-muted"
																		style={{
																			width: colWidths.kbps,
																			maxWidth: colWidths.kbps,
																		}}
																	>
																		{r.kbps || ""}
																	</td>
																	<td
																		className="col-right cell-mono cell-muted"
																		style={{
																			width: colWidths.size,
																			maxWidth: colWidths.size,
																		}}
																	>
																		{(file.size / 1024 / 1024).toFixed(1)}M
																	</td>
																	<td
																		className="cell-mono cell-muted"
																		style={{
																			width: colWidths.added,
																			maxWidth: colWidths.added,
																		}}
																	>
																		{new Date(file.ctime).toLocaleDateString()}
																	</td>
																	<td
																		className="col-actions"
																		style={{
																			width: colWidths.actions,
																			maxWidth: colWidths.actions,
																		}}
																	>
																		<button
																			title="Play"
																			onClick={() => playAt(libraryQueue, i)}
																		>
																			<Play size={13} />
																		</button>
																		<button
																			title="Show in Shared Files"
																			onClick={() =>
																				revealInSharedFiles(file.path)
																			}
																		>
																			<Folder size={13} />
																		</button>
																		<button
																			title="Edit tags"
																			onClick={() => handleEditTags(file)}
																		>
																			<Tag size={13} />
																		</button>
																		<button
																			title={
																				uploadingFilePath === file.path
																					? "Uploading…"
																					: "Upload to TuneCamp"
																			}
																			disabled={uploadingFilePath !== null}
																			onClick={() =>
																				handleUploadFile(file.path)
																			}
																		>
																			<Cloud size={13} />
																		</button>
																		{file.magnetUri ? (
																			<button
																				title="Copy magnet link"
																				className="act-ok"
																				onClick={() => {
																					navigator.clipboard.writeText(
																						file.magnetUri,
																					);
																					alert(
																						"Magnet URI copied to clipboard!",
																					);
																				}}
																			>
																				<Magnet size={13} />
																			</button>
																		) : !isCapacitor ? (
																			<button
																				title="Seed as torrent"
																				onClick={() =>
																					handleSeedFile(file.path)
																				}
																			>
																				<Magnet size={13} />
																			</button>
																		) : null}
																		<button
																			title="Delete"
																			className="act-danger"
																			disabled={uploadingFilePath === file.path}
																			onClick={() =>
																				handleDeleteFile(file.path)
																			}
																		>
																			<Trash2 size={13} />
																		</button>
																	</td>
																</tr>
															);
														})}
													</tbody>
												</table>
												{libraryFiltered.length === 0 && (
													<div
														style={{
															textAlign: "center",
															padding: "3rem",
															color: "var(--text-muted)",
															fontStyle: "italic",
														}}
													>
														{librarySearch.trim() || libFilter.type !== "all"
															? "No tracks match your filter."
															: "No music files in library."}
													</div>
												)}
											</div>
											<div className="track-cards">
												{libraryFiltered.map((r, i) => {
													const file = r.file;
													const isSeeding = !!file.magnetUri;
													const isCurrent = currentPlayback?.path === file.path;
													return (
														<div
															key={file.path}
															className={`track-card ${isCurrent ? "playing" : ""}`}
															onDoubleClick={() => playAt(libraryQueue, i)}
														>
															<div className="track-card-check">
																{isSeeding ? (
																	<span
																		className="seed-check"
																		title="Already seeding"
																	>
																		✓
																	</span>
																) : (
																	<input
																		type="checkbox"
																		checked={selectedSet.has(file.path)}
																		onChange={() => {}}
																		onClick={(e) => {
																			e.stopPropagation();
																			rowCheck(i, e.shiftKey);
																		}}
																	/>
																)}
															</div>
															<div
																className="track-card-main"
																onClick={() => playAt(libraryQueue, i)}
															>
																<div className="track-card-title">
																	{r.title}
																</div>
																<div className="track-card-sub">
																	{r.artist}
																	{r.album ? ` — ${r.album}` : ""}
																</div>
																<div className="track-card-meta">
																	{r.bpm ? <span>{r.bpm} BPM</span> : null}
																	{r.duration ? (
																		<span>{formatTime(r.duration)}</span>
																	) : null}
																	<span>
																		{(file.size / 1024 / 1024).toFixed(1)}M
																	</span>
																</div>
															</div>
															<div className="track-card-actions">
																<button
																	title="More actions"
																	onClick={(e) => {
																		e.stopPropagation();
																		setOpenCardMenuPath((p) =>
																			p === file.path ? null : file.path,
																		);
																	}}
																>
																	<MoreVertical size={17} />
																</button>
																{openCardMenuPath === file.path && (
																	<>
																		<div
																			className="card-menu-backdrop"
																			onClick={() => setOpenCardMenuPath(null)}
																		/>
																		<div
																			className="card-menu"
																			onClick={(e) => e.stopPropagation()}
																		>
																			<button
																				onClick={() => {
																					setOpenCardMenuPath(null);
																					playAt(libraryQueue, i);
																				}}
																			>
																				<Play size={14} /> Play
																			</button>
																			<button
																				onClick={() => {
																					setOpenCardMenuPath(null);
																					handleEditTags(file);
																				}}
																			>
																				<Tag size={14} /> Edit tags
																			</button>
																			<button
																				onClick={() => {
																					setOpenCardMenuPath(null);
																					revealInSharedFiles(file.path);
																				}}
																			>
																				<Folder size={14} /> Show in Shared
																				Files
																			</button>
																			<button
																				disabled={uploadingFilePath !== null}
																				onClick={() => {
																					setOpenCardMenuPath(null);
																					handleUploadFile(file.path);
																				}}
																			>
																				<Cloud size={14} />{" "}
																				{uploadingFilePath === file.path
																					? "Uploading…"
																					: "Upload to TuneCamp"}
																			</button>
																			{file.magnetUri ? (
																				<button
																					className="act-ok"
																					onClick={() => {
																						setOpenCardMenuPath(null);
																						navigator.clipboard.writeText(
																							file.magnetUri,
																						);
																						alert(
																							"Magnet URI copied to clipboard!",
																						);
																					}}
																				>
																					<Magnet size={14} /> Copy magnet link
																				</button>
																			) : !isCapacitor ? (
																				<button
																					onClick={() => {
																						setOpenCardMenuPath(null);
																						handleSeedFile(file.path);
																					}}
																				>
																					<Magnet size={14} /> Seed as torrent
																				</button>
																			) : null}
																			<button
																				className="act-danger"
																				disabled={
																					uploadingFilePath === file.path
																				}
																				onClick={() => {
																					setOpenCardMenuPath(null);
																					handleDeleteFile(file.path);
																				}}
																			>
																				<Trash2 size={14} /> Delete
																			</button>
																		</div>
																	</>
																)}
															</div>
														</div>
													);
												})}
												{libraryFiltered.length === 0 && (
													<div
														style={{
															textAlign: "center",
															padding: "3rem",
															color: "var(--text-muted)",
															fontStyle: "italic",
														}}
													>
														{librarySearch.trim() || libFilter.type !== "all"
															? "No tracks match your filter."
															: "No music files in library."}
													</div>
												)}
											</div>
										</div>
									)}

									<div className="terminal-log" style={{ marginTop: "2rem" }}>
										<div className="terminal-header">Library Activity Logs</div>
										<div className="terminal-body" style={{ height: "180px" }}>
											{libraryLogs.map((log, i) => (
												<div key={i} className="log-line">
													{log}
												</div>
											))}
											{libraryLogs.length === 0 && (
												<div className="log-line dim">
													No library activity logs...
												</div>
											)}
										</div>
									</div>
								</div>
							);
						})()}
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

							<div className="btn-group" style={{ marginTop: "1rem" }}>
								<Button
									variant="secondary"
									onClick={() => {
										disconnectChat();
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
										, manage your local library, edit track metadata, and share
										your collection back to the network as a peer node — all
										from one place.
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
																	</div>
																</div>
																<div className="track-card-actions">
																	<button
																		type="button"
																		className="track-card-action-btn"
																		title={isDownloading ? "Downloading…" : "Download"}
																		disabled={isDownloading}
																		onClick={() => handleDownloadPeerTrack(t)}
																		style={{
																			color: isDownloading ? "var(--accent)" : "inherit",
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

							<div className="terminal-log">
								<div className="terminal-header">Terminal Logs</div>
								<div className="terminal-body">
									{logs.map((log, i) => (
										<div key={i} className="log-line">
											{log}
										</div>
									))}
									{logs.length === 0 && (
										<div className="log-line dim">No logs available...</div>
									)}
								</div>
							</div>
						</div>
					)}

					{activeTab === "chat" && (
						<div
							className="chat-page-container flex flex-col h-full space-y-4 animate-fade-in"
							style={{
								display: "flex",
								flexDirection: "column",
								height: "100%",
								gap: "0.75rem",
							}}
						>
							<div
								className="chat-header-bar flex items-center justify-between"
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
									flexShrink: 0,
								}}
							>
								<div>
									<h2
										style={{
											fontSize: "1.25rem",
											fontWeight: 700,
											margin: 0,
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
										}}
									>
										<MessageCircle
											size={20}
											style={{ color: "var(--primary)" }}
										/>{" "}
										Peer Chat
									</h2>
									<p
										style={{
											fontSize: "0.78rem",
											opacity: 0.6,
											margin: "0.2rem 0 0 0",
										}}
									>
										{activeRoom
											? `Room · #${activeRoom.name}`
											: chatTo
												? `Direct message to ${chatTo}`
												: "Talk to everyone in the lobby"}
									</p>
								</div>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
										fontSize: "0.75rem",
									}}
								>
									<span
										className={`status-badge ${chatStatus}`}
										style={{
											padding: "0.25rem 0.6rem",
											borderRadius: "12px",
											fontWeight: 600,
											textTransform: "capitalize",
											background:
												chatStatus === "online"
													? "rgba(34,197,94,0.15)"
													: "rgba(239,68,68,0.15)",
											color: chatStatus === "online" ? "#4ade80" : "#f87171",
										}}
									>
										{chatStatus}
									</span>
									<Button
										variant={chatStatus === "online" ? "secondary" : "primary"}
										size="sm"
										onClick={() => {
											if (chatStatus === "online") {
												disconnectChat();
											} else {
												connectChat();
											}
										}}
										style={{
											padding: "0.3rem 0.75rem",
											fontSize: "0.75rem",
											borderRadius: "8px",
										}}
									>
										{chatStatus === "online" ? "Disconnect" : "Connect"}
									</Button>
								</div>
							</div>

							{/* Mobile View Toggle */}
							<div className="chat-mobile-toggle">
								<button
									type="button"
									className={`chat-mobile-btn ${mobileChatView === "feed" ? "active" : ""}`}
									onClick={() => setMobileChatView("feed")}
								>
									<MessageCircle size={14} />
									<span>Messaggi {activeRoom ? `(#${activeRoom.name})` : chatTo ? `(${chatTo})` : "(Lobby)"}</span>
								</button>
								<button
									type="button"
									className={`chat-mobile-btn ${mobileChatView === "rooms" ? "active" : ""}`}
									onClick={() => setMobileChatView("rooms")}
								>
									<Hash size={14} />
									<span>Stanze ({chatRooms.length})</span>
								</button>
								<button
									type="button"
									className={`chat-mobile-btn ${mobileChatView === "peers" ? "active" : ""}`}
									onClick={() => setMobileChatView("peers")}
								>
									<Users size={14} />
									<span>Peers ({chatPeers.length})</span>
								</button>
							</div>

							<div
								className={`chat-main-grid ${mobileChatView === "feed" ? "show-feed" : mobileChatView === "rooms" ? "show-rooms" : "show-peers"}`}
								style={{
									display: "grid",
									gridTemplateColumns: "1fr 240px",
									gap: "1rem",
									flex: 1,
									minHeight: 0,
								}}
							>
								{/* Chat Feed */}
								<div className="glass-card chat-feed-card">
									{activeRoom && (
										<div
											style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												padding: "0.6rem 0.85rem",
												borderBottom: "1px solid var(--glass-border)",
												background: "rgba(255, 255, 255, 0.02)",
												fontSize: "0.8rem",
												flexShrink: 0,
											}}
										>
											<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
												<Hash size={16} style={{ color: "var(--primary)", flexShrink: 0 }} />
												<span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
													{activeRoom.name}
												</span>
												{roomPassphrases[activeRoom.id] ? (
													<span
														style={{
															fontSize: "0.68rem",
															padding: "0.15rem 0.4rem",
															borderRadius: "6px",
															background: "rgba(56, 189, 248, 0.15)",
															color: "#38bdf8",
															fontWeight: 600,
															display: "inline-flex",
															alignItems: "center",
															gap: "3px",
														}}
													>
														<ShieldCheck size={11} /> E2EE Attiva
													</span>
												) : activeRoom.is_private ? (
													<span
														style={{
															fontSize: "0.68rem",
															padding: "0.15rem 0.4rem",
															borderRadius: "6px",
															background: "rgba(255, 255, 255, 0.06)",
															color: "var(--text-muted)",
															display: "inline-flex",
															alignItems: "center",
															gap: "3px",
														}}
													>
														<Lock size={11} /> Privata
													</span>
												) : (
													<span
														style={{
															fontSize: "0.68rem",
															padding: "0.15rem 0.4rem",
															borderRadius: "6px",
															background: "rgba(255, 255, 255, 0.04)",
															color: "var(--text-muted)",
															display: "inline-flex",
															alignItems: "center",
															gap: "3px",
														}}
													>
														<Globe size={11} /> Pubblica
													</span>
												)}
											</div>
											<div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
												<Button
													variant={roomPassphrases[activeRoom.id] ? "secondary" : "primary"}
													size="sm"
													onClick={() => {
														setUnlockModalRoom(activeRoom || null);
														setShowUnlockRoomModal(true);
													}}
													leftIcon={
														roomPassphrases[activeRoom.id] ? (
															<ShieldCheck size={13} style={{ color: "#38bdf8" }} />
														) : (
															<Key size={13} />
														)
													}
													style={{ padding: "0.25rem 0.55rem", fontSize: "0.72rem" }}
												>
													{roomPassphrases[activeRoom.id] ? "E2EE" : "Sblocca E2EE"}
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleLeaveRoom(activeRoom)}
													leftIcon={<LogOut size={13} />}
													style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}
													title="Esci dalla stanza"
												>
													Esci
												</Button>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleDeleteRoom(activeRoom)}
													leftIcon={<Trash2 size={13} style={{ color: "var(--danger)" }} />}
													style={{ padding: "0.25rem 0.5rem", fontSize: "0.72rem" }}
													title="Elimina stanza"
												/>
											</div>
										</div>
									)}
									<div
										ref={chatScrollContainerRef}
										className="chat-scroll-feed"
										style={{
											flex: 1,
											overflowY: "auto",
											padding: "0.85rem",
											display: "flex",
											flexDirection: "column",
											gap: "0.75rem",
										}}
									>
										{(() => {
											const visible = activeRoomId
												? chatMessages.filter((m) => m.roomId === activeRoomId)
												: chatTo
													? chatMessages.filter(
															(m) =>
																!m.roomId &&
																!m.lobby &&
																(m.from === chatTo ||
																	(m.self && m.to === chatTo)),
														)
													: chatMessages.filter((m) => !m.roomId && m.lobby !== false);

											const hasLocked = Boolean(
												activeRoom &&
													!roomPassphrases[activeRoom.id] &&
													visible.some(
														(m) =>
															(m as any).isEncrypted ||
															(m.text && m.text.includes("[Messaggio cifrato")),
													),
											);

											return (
												<>
													{hasLocked && (
														<div
															style={{
																padding: "0.6rem 0.8rem",
																borderRadius: "10px",
																background: "rgba(251,191,36,0.12)",
																border: "1px solid rgba(251,191,36,0.3)",
																display: "flex",
																alignItems: "center",
																justifyContent: "space-between",
																gap: "0.5rem",
																fontSize: "0.78rem",
															}}
														>
															<div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#fbbf24" }}>
																<Key size={15} style={{ flexShrink: 0 }} />
																<span>Questa stanza contiene messaggi cifrati con Passphrase.</span>
															</div>
															<Button
																variant="primary"
																size="sm"
																onClick={() => {
																	setUnlockModalRoom(activeRoom || null);
																	setShowUnlockRoomModal(true);
																}}
																leftIcon={<Unlock size={12} />}
																style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}
															>
																Sblocca
															</Button>
														</div>
													)}

													{visible.length === 0 && (
														<div
															style={{
																margin: "auto",
																textAlign: "center",
																padding: "2rem 1rem",
																opacity: 0.5,
															}}
														>
															<MessageCircle
																size={36}
																style={{
																	margin: "0 auto 0.5rem auto",
																	opacity: 0.4,
																}}
															/>
															<p
																style={{
																	fontSize: "0.9rem",
																	fontWeight: 600,
																	margin: 0,
																}}
															>
																Nothing here yet.
															</p>
															<p
																style={{
																	fontSize: "0.75rem",
																	marginTop: "0.25rem",
																}}
															>
																{activeRoom
																	? `Be the first to say something in #${activeRoom.name}.`
																	: chatTo
																		? `Start an encrypted conversation with ${chatTo}.`
																		: "Say hello to the lobby, pick a room, or select a peer for a direct message."}
															</p>
														</div>
													)}

													{visible.map((m, i) => {
														const isSelf = m.self;
														const label = isSelf
															? "You"
															: formatUser(m.from, m.instance);
														const align = isSelf ? "flex-end" : "flex-start";
														const bubbleBg = isSelf
															? "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)"
															: "rgba(255,255,255,0.06)";
														const textColor = isSelf ? "#fff" : "var(--text-main)";

														return (
															<div
																key={`${m.ts}-${i}`}
																style={{
																	display: "flex",
																	flexDirection: "column",
																	alignItems: align,
																	maxWidth: "100%",
																}}
															>
																<div
																	style={{
																		display: "flex",
																		alignItems: "center",
																		gap: "0.4rem",
																		fontSize: "0.7rem",
																		opacity: 0.6,
																		marginBottom: "2px",
																		padding: "0 4px",
																	}}
																>
																	<span style={{ fontWeight: 600 }}>{label}</span>
																	<span>•</span>
																	<span>
																		{new Date(m.ts).toLocaleTimeString([], {
																			hour: "2-digit",
																			minute: "2-digit",
																		})}
																	</span>
																	{m.e2e ? (
																		<span title="End-to-end encrypted">
																			<Lock
																				size={10}
																				style={{ color: "#4ade80" }}
																			/>
																		</span>
																	) : (m as any).isEncrypted ? (
																		<span title="Cifrato con Passphrase">
																			<Key
																				size={10}
																				style={{ color: "#fbbf24" }}
																			/>
																		</span>
																	) : (
																		<span title="Broadcast">
																			<Globe size={10} style={{ opacity: 0.5 }} />
																		</span>
																	)}
																</div>
																<div
																	style={{
																		maxWidth: "85%",
																		padding: "0.6rem 0.9rem",
																		borderRadius: isSelf
																			? "16px 16px 4px 16px"
																			: "16px 16px 16px 4px",
																		background: bubbleBg,
																		color: textColor,
																		fontSize: "0.875rem",
																		wordBreak: "break-word",
																		boxShadow: isSelf
																			? "0 3px 12px rgba(168, 85, 247, 0.25)"
																			: "0 2px 6px rgba(0,0,0,0.15)",
																	}}
																>
																	{m.text}
																</div>
															</div>
														);
													})}
												</>
											);
										})()}
										<div ref={chatBottomRef} />
									</div>

									{showScrollBtn && (
										<div
											style={{
												padding: "0.25rem 1rem",
												display: "flex",
												justifyContent: "center",
												flexShrink: 0,
											}}
										>
											<button
												type="button"
												className="chat-scroll-latest-btn"
												onClick={() => scrollToBottom()}
											>
												<ChevronDown size={13} /> Latest
											</button>
										</div>
									)}

									{pendingChatKeyChange && (
										<div
											style={{
												borderTop: "1px solid var(--glass-border)",
												padding: "0.75rem",
												display: "flex",
												gap: "0.5rem",
												alignItems: "flex-start",
												flexShrink: 0,
												background: "rgba(251,191,36,0.08)",
												fontSize: "0.75rem",
											}}
										>
											<ShieldAlert
												size={14}
												style={{ color: "#fbbf24", flexShrink: 0, marginTop: "2px" }}
											/>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ fontWeight: 600 }}>
													{pendingChatKeyChange.peerId}'s encryption key changed.
												</div>
												<div style={{ opacity: 0.7, marginTop: "0.15rem" }}>
													Messages stay blocked until you accept it. Ask them for
													their fingerprint somewhere this server can't reach — a
													swapped key looks identical from here.
												</div>
												<div
													style={{
														fontFamily: "monospace",
														opacity: 0.8,
														marginTop: "0.3rem",
														wordBreak: "break-all",
													}}
												>
													pinned&nbsp;&nbsp;{pendingChatKeyChange.pinned}
													<br />
													offered&nbsp;{pendingChatKeyChange.offered}
												</div>
											</div>
											<Button
												variant="secondary"
												onClick={() =>
													handleAcceptChatKeyChange(pendingChatKeyChange.peerId)
												}
												style={{
													padding: "0.35rem 0.7rem",
													fontSize: "0.75rem",
													flexShrink: 0,
												}}
											>
												Accept new key
											</Button>
										</div>
									)}

									<div
										style={{
											borderTop: "1px solid var(--glass-border)",
											padding: "0.65rem 0.75rem",
											display: "flex",
											gap: "0.5rem",
											alignItems: "center",
											flexShrink: 0,
										}}
									>
										{activeRoom ? (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													gap: "0.3rem",
													padding: "0.45rem 0.65rem",
													borderRadius: "8px",
													background: "rgba(255, 255, 255, 0.05)",
													border: "1px solid var(--glass-border)",
													fontSize: "0.8rem",
													fontWeight: 600,
													color: "var(--primary)",
													maxWidth: "140px",
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
													flexShrink: 0,
												}}
											>
												<Hash size={13} style={{ flexShrink: 0 }} />
												<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
													{activeRoom.name}
												</span>
											</div>
										) : (
											<select
												value={chatTo}
												onChange={(e) => setChatTo(e.target.value)}
												className="glass-input"
												style={{
													width: "120px",
													maxWidth: "32%",
													flexShrink: 0,
													padding: "0.5rem 0.5rem",
													fontSize: "0.78rem",
													borderRadius: "10px",
												}}
												disabled={chatStatus !== "online"}
											>
												<option value="">Lobby (all)</option>
												{chatPeers.map((p) => (
													<option key={p.username} value={p.username}>
														{formatUser(p.username, p.instance)}
													</option>
												))}
											</select>
										)}
										<input
											type="text"
											value={chatText}
											onChange={(e) => setChatText(e.target.value)}
											placeholder={
												chatStatus === "online"
													? activeRoom
														? `Message #${activeRoom.name}...`
														: chatTo
															? "Encrypted message..."
															: "Message..."
													: "Connecting..."
											}
											className="glass-input"
											style={{
												flex: 1,
												minWidth: 0,
												padding: "0.5rem 0.75rem",
												fontSize: "0.85rem",
												borderRadius: "10px",
											}}
											disabled={chatStatus !== "online"}
											maxLength={2000}
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.shiftKey) {
													e.preventDefault();
													handleSendChat();
												}
											}}
										/>
										<button
											type="button"
											className="chat-send-btn"
											onClick={handleSendChat}
											disabled={
												chatStatus !== "online" || !chatText.trim() || chatSending
											}
											title="Send message"
										>
											<Send size={15} />
										</button>
									</div>
								</div>

								{/* Connected Peers and Rooms Sidebar */}
								<div className="glass-card chat-peers-sidebar">
									{/* Public Lobby Item */}
									<button
										type="button"
										className={`chat-peer-btn ${!chatTo && !activeRoomId ? "active" : ""}`}
										onClick={selectLobby}
										style={{ marginBottom: "0.5rem" }}
									>
										<Globe
											size={15}
											style={{
												color:
													!chatTo && !activeRoomId
														? "var(--primary)"
														: "var(--text-muted)",
												flexShrink: 0,
											}}
										/>
										<span
											style={{
												flex: 1,
												overflow: "hidden",
												textOverflow: "ellipsis",
												whiteSpace: "nowrap",
												fontWeight: !chatTo && !activeRoomId ? 700 : 500,
											}}
										>
											Public Lobby
										</span>
									</button>

									{/* Rooms Section */}
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: "0.4rem",
											fontSize: "0.75rem",
											fontWeight: 700,
											opacity: 0.75,
											margin: "0.5rem 0 0.35rem 0",
											padding: "0 0.25rem",
											flexShrink: 0,
											textTransform: "uppercase",
											letterSpacing: "0.04em",
										}}
									>
										<div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
											<Hash size={13} />
											<span>Stanze ({chatRooms.length})</span>
										</div>
										<button
											type="button"
											onClick={() => setShowCreateRoomModal(true)}
											style={{
												background: "transparent",
												border: "none",
												color: "var(--primary)",
												cursor: "pointer",
												padding: "2px",
												display: "flex",
												alignItems: "center",
											}}
											title="Crea nuova stanza"
										>
											<Plus size={14} />
										</button>
									</div>

									<div
										style={{
											display: "flex",
											flexDirection: "column",
											gap: "0.25rem",
											marginBottom: "0.75rem",
											maxHeight: "180px",
											overflowY: "auto",
										}}
									>
										{chatRooms.length === 0 && (
											<p
												style={{
													fontSize: "0.72rem",
													opacity: 0.4,
													margin: 0,
													padding: "0.3rem 0.25rem",
													fontStyle: "italic",
												}}
											>
												Nessuna stanza creata.
											</p>
										)}
										{chatRooms.map((room: RoomInfo) => {
											const isSelected = activeRoomId === room.id;
											const unread = roomUnreadCounts[room.id] || 0;
											const isUnlocked = Boolean(roomPassphrases[room.id]);

											return (
												<div
													key={room.id}
													style={{
														display: "flex",
														alignItems: "center",
														gap: "2px",
														width: "100%",
													}}
												>
													<button
														type="button"
														className={`chat-peer-btn ${isSelected ? "active" : ""}`}
														onClick={() => selectRoom(room)}
														style={{ flex: 1, minWidth: 0 }}
													>
														{isUnlocked ? (
															<ShieldCheck
																size={14}
																style={{ color: "#38bdf8", flexShrink: 0 }}
															/>
														) : room.is_private ? (
															<Lock
																size={13}
																style={{ opacity: 0.6, flexShrink: 0 }}
															/>
														) : (
															<Hash
																size={14}
																style={{
																	opacity: isSelected ? 1 : 0.6,
																	flexShrink: 0,
																}}
															/>
														)}
														<span
															style={{
																flex: 1,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
															}}
														>
															{room.name}
														</span>
														{isUnlocked && (
															<span
																style={{
																	fontSize: "0.62rem",
																	padding: "1px 4px",
																	borderRadius: "4px",
																	background: "rgba(56, 189, 248, 0.2)",
																	color: "#38bdf8",
																	fontWeight: 700,
																	flexShrink: 0,
																}}
															>
																E2EE
															</span>
														)}
														{unread > 0 && !isSelected && (
															<span className="chat-unread-badge">
																{unread}
															</span>
														)}
													</button>
													<button
														type="button"
														onClick={() => {
															setUnlockModalRoom(room);
															setShowUnlockRoomModal(true);
														}}
														style={{
															background: "transparent",
															border: "none",
															color: isUnlocked ? "#38bdf8" : "var(--text-muted)",
															cursor: "pointer",
															padding: "4px",
															display: "flex",
															alignItems: "center",
															opacity: 0.8,
														}}
														title={isUnlocked ? "Gestisci passphrase E2EE" : "Sblocca con passphrase"}
													>
														<Key size={12} />
													</button>
												</div>
											);
										})}
									</div>

									{contactsData.pendingIn.length > 0 && (
										<div style={{ marginBottom: "0.5rem" }}>
											<div
												style={{
													fontSize: "0.72rem",
													fontWeight: 700,
													opacity: 0.75,
													textTransform: "uppercase",
													letterSpacing: "0.04em",
													padding: "0 0.25rem",
													marginBottom: "0.25rem",
												}}
											>
												Contact requests ({contactsData.pendingIn.length})
											</div>
											{contactsData.pendingIn.map((from) => (
												<div
													key={from}
													style={{
														display: "flex",
														alignItems: "center",
														gap: "0.35rem",
														padding: "0.25rem",
														fontSize: "0.78rem",
													}}
												>
													<span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
														{formatUser(from)}
													</span>
													<button
														type="button"
														onClick={() => acceptContactRequest(from)}
														title="Accept"
														style={{ background: "transparent", border: "none", color: "#4ade80", cursor: "pointer", padding: "2px" }}
													>
														<Check size={14} />
													</button>
													<button
														type="button"
														onClick={() => rejectContactRequest(from)}
														title="Reject"
														style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
													>
														<X size={14} />
													</button>
												</div>
											))}
										</div>
									)}

									{/* Connected Peers Header */}
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.35rem",
											fontSize: "0.75rem",
											fontWeight: 700,
											opacity: 0.75,
											margin: "0.5rem 0 0.35rem 0",
											padding: "0 0.25rem",
											flexShrink: 0,
											textTransform: "uppercase",
											letterSpacing: "0.04em",
										}}
									>
										<Users size={13} />
										<span>Connected Peers ({chatPeers.length})</span>
									</div>

									<div
										style={{
											flex: 1,
											overflowY: "auto",
											display: "flex",
											flexDirection: "column",
											gap: "0.25rem",
										}}
									>
										{chatPeers.length === 0 && (
											<p
												style={{
													fontSize: "0.72rem",
													opacity: 0.4,
													margin: 0,
													padding: "0.3rem 0.25rem",
												}}
											>
												No other peers connected.
											</p>
										)}
										{chatPeers.map((peer) => {
											const isSelected = !activeRoomId && chatTo === peer.username;
											const unread = chatUnread[peer.username] || 0;
											const isContact = contactsData.contacts.includes(peer.username);
											const isPendingOut = contactsData.pendingOut.includes(peer.username);
											const isBlocked = blocklist.includes(peer.username);
											return (
												<div key={peer.username} style={{ display: "flex", alignItems: "center", gap: "2px", width: "100%" }}>
													<button
														type="button"
														className={`chat-peer-btn ${isSelected ? "active" : ""}`}
														onClick={() => selectChatPeer(peer.username)}
														style={{ flex: 1, minWidth: 0 }}
													>
														<span className="chat-peer-dot" />
														<span
															style={{
																flex: 1,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
															}}
														>
															{formatUser(peer.username, peer.instance)}
														</span>
														{chatKeyChanges[peer.username] ? (
															<span title="Key changed — messages blocked">
																<ShieldAlert
																	size={12}
																	style={{ color: "#fbbf24", flexShrink: 0 }}
																/>
															</span>
														) : (
															peer.pubkey && (
																<span title="E2E ready">
																	<Lock
																		size={12}
																		style={{ color: "#4ade80", flexShrink: 0 }}
																	/>
																</span>
															)
														)}
														{unread > 0 && !isSelected && (
															<span className="chat-unread-badge">
																{unread}
															</span>
														)}
													</button>
													{!isContact && !isPendingOut && (
														<button
															type="button"
															onClick={() => sendContactRequest(peer.username)}
															title="Add contact"
															style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
														>
															<UserPlus size={12} />
														</button>
													)}
													<button
														type="button"
														onClick={() => (isBlocked ? unblockUser(peer.username) : blockUser(peer.username))}
														title={isBlocked ? "Unblock" : "Block"}
														style={{ background: "transparent", border: "none", color: isBlocked ? "#f87171" : "var(--text-muted)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
													>
														<Ban size={12} />
													</button>
												</div>
											);
										})}
									</div>
								</div>
							</div>

							<p
								style={{
									fontSize: "0.72rem",
									opacity: 0.5,
									textAlign: "center",
									margin: "0.25rem 0 0 0",
									flexShrink: 0,
								}}
							>
								{activeRoom
									? activeRoom.is_private
										? "I messaggi di questa stanza restano su questa istanza."
										: "I messaggi di questa stanza vengono federati tra i peer di TuneCamp."
									: chatTo
										? "I messaggi diretti sono cifrati end-to-end e non transitano mai in chiaro."
										: "I messaggi della Lobby sono visibili a tutti gli utenti connessi."}
							</p>

							<UnlockRoomModal
								isOpen={showUnlockRoomModal}
								onClose={() => setShowUnlockRoomModal(false)}
								room={unlockModalRoom}
								currentPassphrase={unlockModalRoom ? roomPassphrases[unlockModalRoom.id] || "" : ""}
								onSavePassphrase={setRoomPassphrase}
								onClearPassphrase={clearRoomPassphrase}
							/>

							<CreateRoomModal
								isOpen={showCreateRoomModal}
								onClose={() => setShowCreateRoomModal(false)}
								onCreateRoom={handleCreateRoom}
							/>
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
									Search Platforms (Soulseek / Web)
								</button>
								<button
									className={`subtab-btn ${downloadSource === "direct" ? "active" : ""}`}
									onClick={() => setDownloadSource("direct")}
								>
									Direct Link (Torrent / Web URL)
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
												return (
													<div
														key={i}
														className="mobile-track-card"
														onDoubleClick={() => !busy && handleDownload(res)}
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
																	title="Download"
																	onClick={() => handleDownload(res)}
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

							{/* Logs di Download (visibili sia per Soulseek che per Link Diretto, collapsible) */}
							<div className="terminal-log" style={{ marginTop: "1.5rem" }}>
								<div
									className="terminal-header"
									onClick={() => setDlLogsExpanded((x) => !x)}
									title="Click to toggle download logs"
									style={{ cursor: "pointer" }}
								>
									<span>Download Logs ({dlLogs.length})</span>
									<span style={{ fontSize: "0.72rem", opacity: 0.8 }}>
										{dlLogsExpanded ? "Collapse ▲" : "Expand ▼"}
									</span>
								</div>
								{dlLogsExpanded && (
									<div className="terminal-body" style={{ height: "180px" }}>
										{dlLogs.map((log, i) => (
											<div key={i} className="log-line">
												{log}
											</div>
										))}
										{dlLogs.length === 0 && (
											<div className="log-line dim">
												No active download logs...
											</div>
										)}
									</div>
								)}
							</div>
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
						<div className="player-info">
							<span className="player-track-icon">
								<Music size={18} />
							</span>
							<div className="player-track-details">
								<span className="player-track-title">
									{currentPlayback.name}
								</span>
								<span className="player-track-path">
									{queue.length > 1
										? `${queueIndex + 1}/${queue.length} — `
										: ""}
									{currentPlayback.path}
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

							<div className="player-seeker">
								<span className="time-display">{formatTime(currentTime)}</span>
								<input
									type="range"
									min="0"
									max={duration || 100}
									value={duration ? Math.min(currentTime, duration) : 0}
									disabled={!duration}
									// Explicit pointer capture guarantees onPointerUp fires on this
									// element even if the drag ends outside the bar or the window
									// loses focus mid-drag. Without it, isSeeking could get stuck
									// true (no matching pointerup) and the bar would stop following
									// playback until the next reload — onPointerCancel/LostPointerCapture
									// are the fallback release for whatever interrupts the drag.
									onPointerDown={(e) => {
										try {
											e.currentTarget.setPointerCapture(e.pointerId);
										} catch {
											/* ignore */
										}
										setIsSeeking(true);
									}}
									onChange={(e) => handleSeekChange(parseFloat(e.target.value))}
									onPointerUp={handleSeekCommit}
									onPointerCancel={() => setIsSeeking(false)}
									onLostPointerCapture={() => setIsSeeking(false)}
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
					if (queueIndex + 1 < queue.length) playNext();
					else stopPlayback();
				}}
			/>

			{/* Metadata Editor Modal */}
			{metadataModalFile && (
				<div
					className="modal-overlay"
					onClick={() => setMetadataModalFile(null)}
				>
					<div
						className="modal-content glass-card"
						onClick={(e) => e.stopPropagation()}
					>
						<h3
							style={{
								fontFamily: "var(--font-headings)",
								marginBottom: "1.2rem",
								fontSize: "1.25rem",
							}}
						>
							Upload Track to TuneCamp
						</h3>
						<p
							style={{
								fontSize: "0.85rem",
								color: "var(--text-muted)",
								marginBottom: "1.5rem",
								wordBreak: "break-all",
							}}
						>
							File:{" "}
							<span
								style={{ fontFamily: "monospace", color: "var(--text-main)" }}
							>
								{metadataModalFile.name}
							</span>
						</p>
						<div className="form-group">
							<label>Track Title</label>
							<input
								type="text"
								value={metadataTitle}
								onChange={(e) => setMetadataTitle(e.target.value)}
								className="glass-input"
							/>
						</div>
						<div className="form-group">
							<label>Artist Name</label>
							<input
								type="text"
								value={metadataArtist}
								onChange={(e) => setMetadataArtist(e.target.value)}
								className="glass-input"
							/>
						</div>
						<div className="form-group">
							<label>Album (Optional)</label>
							<input
								type="text"
								value={metadataAlbum}
								onChange={(e) => setMetadataAlbum(e.target.value)}
								className="glass-input"
							/>
						</div>
						<div
							className="btn-group"
							style={{ marginTop: "2rem", justifyContent: "flex-end" }}
						>
							<Button
								variant="secondary"
								onClick={() => setMetadataModalFile(null)}
							>
								Cancel
							</Button>
							<Button variant="primary" onClick={confirmUpload}>
								Upload
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Album Seeding Modal */}
			{albumSeedModalOpen && (
				<div
					className="modal-overlay"
					onClick={() => setAlbumSeedModalOpen(false)}
				>
					<div
						className="modal-content glass-card"
						onClick={(e) => e.stopPropagation()}
					>
						<h3
							style={{
								fontFamily: "var(--font-headings)",
								marginBottom: "1.2rem",
								fontSize: "1.25rem",
							}}
						>
							Seed Selected Tracks as Album
						</h3>
						<p
							style={{
								fontSize: "0.85rem",
								color: "var(--text-muted)",
								marginBottom: "1.5rem",
							}}
						>
							You have selected{" "}
							<span style={{ fontWeight: 600, color: "var(--text-main)" }}>
								{selectedFiles.length}
							</span>{" "}
							tracks to seed together.
						</p>
						<div className="form-group">
							<label>Album / Torrent Name</label>
							<input
								type="text"
								value={albumSeedName}
								onChange={(e) => setAlbumSeedName(e.target.value)}
								className="glass-input"
								placeholder="Enter album or torrent name"
							/>
						</div>
						<div
							className="btn-group"
							style={{ marginTop: "2rem", justifyContent: "flex-end" }}
						>
							<Button
								variant="secondary"
								onClick={() => setAlbumSeedModalOpen(false)}
							>
								Cancel
							</Button>
							<Button variant="primary" onClick={confirmSeedSelected}>
								Start Seeding
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Edit Tags Modal */}
			{editTagsFile && (
				<div className="modal-overlay" onClick={() => setEditTagsFile(null)}>
					<div
						className="modal-content glass-card"
						style={{ maxWidth: "560px", width: "95%" }}
						onClick={(e) => e.stopPropagation()}
					>
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								marginBottom: "1rem",
							}}
						>
							<h3
								style={{
									fontFamily: "var(--font-headings)",
									margin: 0,
									fontSize: "1.25rem",
									display: "flex",
									alignItems: "center",
									gap: "8px",
								}}
							>
								<Tag size={18} style={{ color: "var(--primary)" }} /> Edit File Tags
							</h3>
							<button
								onClick={() => setEditTagsFile(null)}
								style={{
									background: "transparent",
									border: "none",
									color: "var(--text-muted)",
									cursor: "pointer",
									padding: "4px",
								}}
							>
								<X size={18} />
							</button>
						</div>

						<p
							style={{
								fontSize: "0.82rem",
								color: "var(--text-muted)",
								marginBottom: "1.2rem",
								wordBreak: "break-all",
								background: "rgba(0,0,0,0.2)",
								padding: "6px 10px",
								borderRadius: "6px",
							}}
						>
							<span style={{ fontFamily: "monospace", color: "var(--text-main)" }}>
								{editTagsFile.name.split(/[/\\]/).pop()}
							</span>
						</p>

						{/* Tag Online Search / Clean Bar */}
						<div
							style={{
								display: "flex",
								gap: "8px",
								flexWrap: "wrap",
								marginBottom: "1.2rem",
								background: "var(--elevated-bg, rgba(255,255,255,0.03))",
								border: "1px solid var(--glass-border)",
								borderRadius: "8px",
								padding: "8px",
							}}
						>
							<Button
								variant="secondary"
								disabled={editTagsSearching !== null}
								onClick={handleSearchBeatport}
								style={{
									fontSize: "0.8rem",
									padding: "0.4rem 0.75rem",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}
								title="Search track metadata on Beatport (BPM, Key, Genre, Album, Year)"
							>
								{editTagsSearching === "beatport" ? (
									<RefreshCw size={13} className="spin" />
								) : (
									<Globe size={13} />
								)}
								Search Beatport
							</Button>
							<Button
								variant="secondary"
								disabled={editTagsSearching !== null}
								onClick={handleSearchMusicBrainz}
								style={{
									fontSize: "0.8rem",
									padding: "0.4rem 0.75rem",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}
								title="Search recordings on MusicBrainz"
							>
								{editTagsSearching === "musicbrainz" ? (
									<RefreshCw size={13} className="spin" />
								) : (
									<Music size={13} />
								)}
								Search MusicBrainz
							</Button>
							<Button
								variant="secondary"
								onClick={handleAutoCleanFilename}
								style={{
									fontSize: "0.8rem",
									padding: "0.4rem 0.75rem",
									display: "flex",
									alignItems: "center",
									gap: "6px",
								}}
								title="Clean track name and artist by parsing filename"
							>
								<Sparkles size={13} /> Clean Filename
							</Button>
						</div>

						{/* Search Error Message */}
						{editTagsSearchError && (
							<div
								style={{
									fontSize: "0.82rem",
									color: "#f87171",
									background: "rgba(239, 68, 68, 0.1)",
									border: "1px solid rgba(239, 68, 68, 0.25)",
									borderRadius: "6px",
									padding: "8px 12px",
									marginBottom: "1.2rem",
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<span>{editTagsSearchError}</span>
								<button
									onClick={() => setEditTagsSearchError("")}
									style={{
										background: "transparent",
										border: "none",
										color: "#f87171",
										cursor: "pointer",
									}}
								>
									<X size={14} />
								</button>
							</div>
						)}

						{/* Online Search Candidates */}
						{editTagsResults.length > 0 && (
							<div
								style={{
									marginBottom: "1.5rem",
									background: "rgba(0,0,0,0.3)",
									border: "1px solid var(--primary)",
									borderRadius: "8px",
									padding: "10px",
									maxHeight: "220px",
									overflowY: "auto",
								}}
							>
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										marginBottom: "8px",
										paddingBottom: "6px",
										borderBottom: "1px solid var(--glass-border)",
									}}
								>
									<span
										style={{
											fontSize: "0.78rem",
											fontWeight: 600,
											color: "var(--primary)",
											textTransform: "uppercase",
										}}
									>
										Found {editTagsResults.length} Matched Tracks — Click to Apply
									</span>
									<button
										onClick={() => setEditTagsResults([])}
										style={{
											background: "transparent",
											border: "none",
											color: "var(--text-muted)",
											cursor: "pointer",
											fontSize: "0.75rem",
										}}
									>
										Close
									</button>
								</div>
								<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
									{editTagsResults.map((match, idx) => (
										<div
											key={idx}
											style={{
												display: "flex",
												justifyContent: "space-between",
												alignItems: "center",
												gap: "8px",
												padding: "6px 8px",
												borderRadius: "6px",
												background: "rgba(255,255,255,0.03)",
												border: "1px solid var(--glass-border)",
											}}
										>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div
													style={{
														fontSize: "0.85rem",
														fontWeight: 600,
														color: "var(--text-main)",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{match.title}
												</div>
												<div
													style={{
														fontSize: "0.78rem",
														color: "var(--text-muted)",
														overflow: "hidden",
														textOverflow: "ellipsis",
														whiteSpace: "nowrap",
													}}
												>
													{match.artist} {match.album ? `• ${match.album}` : ""}
												</div>
												<div
													style={{
														display: "flex",
														gap: "6px",
														marginTop: "3px",
														fontSize: "0.72rem",
														color: "var(--text-subtle)",
														flexWrap: "wrap",
													}}
												>
													{match.genre && (
														<span
															style={{
																background: "rgba(168, 85, 247, 0.2)",
																color: "var(--primary)",
																padding: "1px 5px",
																borderRadius: "4px",
															}}
														>
															{match.genre}
														</span>
													)}
													{match.bpm && (
														<span style={{ fontFamily: "monospace" }}>
															{match.bpm} BPM
														</span>
													)}
													{match.key && (
														<span style={{ fontFamily: "monospace" }}>
															Key: {match.key}
														</span>
													)}
													{match.year && <span>{match.year}</span>}
												</div>
											</div>
											<Button
												variant="accent"
												onClick={() => applySearchResult(match)}
												style={{
													fontSize: "0.75rem",
													padding: "0.3rem 0.65rem",
													whiteSpace: "nowrap",
												}}
											>
												<Check size={12} /> Apply
											</Button>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Form Inputs */}
						<div className="form-group">
							<label>Track Title</label>
							<input
								type="text"
								value={editTagsData.title}
								onChange={(e) =>
									setEditTagsData((prev) => ({
										...prev,
										title: e.target.value,
									}))
								}
								className="glass-input"
								placeholder="e.g. Rumble"
							/>
						</div>

						<div className="form-group">
							<label>Artist Name</label>
							<input
								type="text"
								value={editTagsData.artist}
								onChange={(e) =>
									setEditTagsData((prev) => ({
										...prev,
										artist: e.target.value,
									}))
								}
								className="glass-input"
								placeholder="e.g. Skrillex, Fred again.., Flowdan"
							/>
						</div>

						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
							<div className="form-group">
								<label>Album</label>
								<input
									type="text"
									value={editTagsData.album}
									onChange={(e) =>
										setEditTagsData((prev) => ({
											...prev,
											album: e.target.value,
										}))
									}
									className="glass-input"
									placeholder="e.g. Quest For Fire"
								/>
							</div>
							<div className="form-group">
								<label>Genre</label>
								<input
									type="text"
									value={editTagsData.genre}
									onChange={(e) =>
										setEditTagsData((prev) => ({
											...prev,
											genre: e.target.value,
										}))
									}
									className="glass-input"
									placeholder="e.g. Deep Dubstep / Bass"
								/>
							</div>
						</div>

						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr 1fr",
								gap: "12px",
							}}
						>
							<div className="form-group">
								<label>Year</label>
								<input
									type="number"
									value={editTagsData.year}
									onChange={(e) =>
										setEditTagsData((prev) => ({
											...prev,
											year: e.target.value,
										}))
									}
									className="glass-input"
									placeholder="2024"
								/>
							</div>
							<div className="form-group">
								<label>BPM</label>
								<input
									type="text"
									value={editTagsData.bpm}
									onChange={(e) =>
										setEditTagsData((prev) => ({
											...prev,
											bpm: e.target.value,
										}))
									}
									className="glass-input"
									placeholder="140"
								/>
							</div>
							<div className="form-group">
								<label>Key</label>
								<input
									type="text"
									value={editTagsData.key}
									onChange={(e) =>
										setEditTagsData((prev) => ({
											...prev,
											key: e.target.value,
										}))
									}
									className="glass-input"
									placeholder="4m / F min"
								/>
							</div>
						</div>

						<div className="form-group">
							<label>File Name</label>
							<input
								type="text"
								value={editTagsData.filename}
								onChange={(e) =>
									setEditTagsData((prev) => ({
										...prev,
										filename: e.target.value,
									}))
								}
								className="glass-input"
							/>
						</div>

						<div
							className="btn-group"
							style={{ marginTop: "1.5rem", justifyContent: "flex-end", gap: "8px" }}
						>
							<Button variant="secondary" onClick={() => setEditTagsFile(null)}>
								Cancel
							</Button>
							<Button variant="primary" onClick={confirmEditTags}>
								Save Tags
							</Button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default App;
