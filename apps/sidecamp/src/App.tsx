import { useState, useEffect, useMemo, useRef, memo } from 'react';
import {
  Radio, Globe, Download, FolderSync, Settings,
  Play, Pause, X, Volume2, Music, Magnet, Cloud, SkipBack, SkipForward,
  Folder, FolderPlus, ChevronRight, PanelLeft, Trash2, Sun, Moon,
  Disc3, ChevronUp, ChevronDown, ArrowUpCircle, Tag, Plus, Headphones, User, Share2,
  Eye, EyeOff
} from 'lucide-react';
import { Button } from 'tunecamp-design-system';
import { guess } from 'web-audio-beat-detector';
import './index.css';
import logo from './assets/logo.png';

// Shared collator: options are parsed once, not on every comparison.
const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

// Declare global for TypeScript
declare global {
  interface Window {
    electronAPI: any;
  }
}

// Big scrolling waveform (rekordbox-style): playhead fixed at center, wave
// scrolls under it via requestAnimationFrame reading audio.currentTime
// directly — no React state churn at 60fps. Click = seek.
const ScrollWave = memo(function ScrollWave({ peaks, pps, audioRef }: { peaks: number[]; pps: number; audioRef: React.RefObject<HTMLAudioElement | null> }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const cv = cvRef.current, audio = audioRef.current;
      if (!cv || !audio) return;
      if (cv.width !== cv.clientWidth) cv.width = cv.clientWidth || 800;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const W = cv.width, H = cv.height, center = W >> 1;
      ctx.clearRect(0, 0, W, H);
      const start = Math.round(audio.currentTime * pps) - center;
      for (let x = 0; x < W; x++) {
        const idx = start + x;
        if (idx < 0 || idx >= peaks.length) continue;
        const h = Math.max(1, (peaks[idx] / 100) * (H - 10));
        ctx.fillStyle = x < center ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.85)';
        ctx.fillRect(x, (H - h) / 2, 1, h);
      }
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(center - 1, 0, 2, H);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [peaks, pps, audioRef]);
  const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current, cv = cvRef.current;
    if (!audio || !cv) return;
    const rect = cv.getBoundingClientRect();
    const t = audio.currentTime + ((e.clientX - rect.left) - rect.width / 2) / pps;
    audio.currentTime = Math.max(0, Math.min(t, audio.duration || t));
  };
  return <canvas ref={cvRef} height={80} className="scrollwave-canvas" onClick={seek} title="Click to seek" />;
});

// Per-row waveform (rekordbox-style). Memoized: only the playing row repaints
// on the ~4Hz timeupdate ticks, the other N rows skip both render and draw.
const Waveform = memo(function Waveform({ peaks, progress, active }: { peaks?: number[]; progress: number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    if (!peaks || peaks.length === 0) return;
    const n = peaks.length;
    const bw = W / n;
    const played = active ? Math.floor((n * progress) / 100) : 0;
    for (let i = 0; i < n; i++) {
      const h = Math.max(1, (peaks[i] / 100) * H);
      ctx.fillStyle = i < played ? '#a855f7' : active ? 'rgba(168,85,247,0.45)' : 'rgba(148,163,184,0.45)';
      ctx.fillRect(i * bw, (H - h) / 2, Math.max(0.6, bw - 0.4), h);
    }
  }, [peaks, progress, active]);
  return <canvas ref={ref} width={140} height={22} className="wave-canvas" />;
});

function App() {
  const [server, setServer] = useState('');
  const [token, setToken] = useState('');
  const [folder, setFolder] = useState('');
  const [peerStatus, setPeerStatus] = useState('offline');
  const [logs, setLogs] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string; ts: number; self?: boolean }[]>([]);
  const [chatTo, setChatTo] = useState('');
  const [chatText, setChatText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('download');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  // File browser (shared folders)
  const [browserRoot, setBrowserRoot] = useState('');
  const [browserPath, setBrowserPath] = useState('');
  const [browserEntries, setBrowserEntries] = useState<{ name: string; isDir: boolean }[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [browserError, setBrowserError] = useState('');
  const [downloadsDir, setDownloadsDir] = useState('');
  const [movingItem, setMovingItem] = useState<{ root: string; path: string; name: string; isDir: boolean } | null>(null);
  // Per-list search filters
  const [librarySearch, setLibrarySearch] = useState('');
  const [browserSearch, setBrowserSearch] = useState('');
  // Library table (rekordbox-style): tag metadata per file path + sort state
  type TrackMeta = { title: string; artist: string; album: string; genre: string; bpm: number | null; key: string; duration: number; year: number | null; bitrate: number; peaks?: number[]; beatOffset?: number | null };
  const [trackMeta, setTrackMeta] = useState<Record<string, TrackMeta>>({});
  const [sortCol, setSortCol] = useState('added');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(col === 'added' || col === 'size' ? -1 : 1); }
  };
  // BPM auto-analysis (Web Audio decode + beat detection), one file at a time
  const [analyzing, setAnalyzing] = useState<{ done: number; total: number } | null>(null);
  const analyzeCancelRef = useRef(false);
  // Collection pane filter (artist / genre / top-level folder) + shift-click anchor
  const [libFilter, setLibFilter] = useState<{ type: 'all' | 'artist' | 'genre' | 'folder'; value: string }>({ type: 'all', value: '' });
  const lastCheckRef = useRef<number | null>(null);
  // Inline tag edit: double-click a title/artist/album/genre cell (mp3 only for the actual write)
  const [cellEdit, setCellEdit] = useState<{ path: string; field: 'title' | 'artist' | 'album' | 'genre'; value: string } | null>(null);
  const saveCellEdit = async () => {
    if (!cellEdit) return;
    const { path: p, field, value } = cellEdit;
    setCellEdit(null);
    try {
      await window.electronAPI.writeTags(p, { [field]: value });
      setTrackMeta(prev => prev[p] ? { ...prev, [p]: { ...prev[p], [field]: value } } : prev);
      setDlLogs(prev => [...prev, `[Library] Tag ${field} updated: ${value}`]);
    } catch (e: any) {
      alert('Tag write failed: ' + (e.message || e));
    }
  };
  // Playlists (DJ set builder), a Library sub-view. Persisted in localStorage.
  type Playlist = { id: string; name: string; tracks: { path: string; name: string }[] };
  // Library sub-panels are mutually exclusive — one workspace at a time, not stacked overlays.
  const [libraryPanel, setLibraryPanel] = useState<'none' | 'playlists' | 'organize'>('none');
  const showPlaylists = libraryPanel === 'playlists';
  const togglePanel = (p: 'playlists' | 'organize') => setLibraryPanel(v => v === p ? 'none' : p);
  const [showLibraryTable, setShowLibraryTable] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try { return JSON.parse(localStorage.getItem('playlists') || '[]'); } catch { return []; }
  });
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistPickerSearch, setPlaylistPickerSearch] = useState('');
  const [exportMsg, setExportMsg] = useState('');

  // Direct Download & Torrent States
  const [downloadSource, setDownloadSource] = useState('soulseek'); // 'soulseek' | 'direct'
  const [directUrl, setDirectUrl] = useState('');
  const [dlLogs, setDlLogs] = useState<string[]>([]);
  const [dlProgress, setDlProgress] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [slskUser, setSlskUser] = useState('');
  const [slskPass, setSlskPass] = useState('');
  const [activeDownloads, setActiveDownloads] = useState<any[]>([]);
  const [searchSource, setSearchSource] = useState('soulseek'); // 'soulseek' | 'soundcloud' | 'bandcamp' | 'torrent'
  const [downloadedFiles, setDownloadedFiles] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [albumSeedModalOpen, setAlbumSeedModalOpen] = useState(false);
  const [albumSeedName, setAlbumSeedName] = useState('My Custom Album');
  const [uploadingFilePath, setUploadingFilePath] = useState<string | null>(null);

  // Network Explorer States
  const [networkPeers, setNetworkPeers] = useState<any[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<any | null>(null);
  const [peerTracks, setPeerTracks] = useState<any[]>([]);
  const [networkQuery, setNetworkQuery] = useState('');
  const [isLoadingPeers, setIsLoadingPeers] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

  // Built-in Audio Player States
  const [currentPlayback, setCurrentPlayback] = useState<{ name: string, path: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // One retry per track for transient network blips on remote/federated streams.
  const streamRetryRef = useRef<{ src: string; count: number }>({ src: '', count: 0 });
  // Play queue: resolved tracks (src ready to feed <audio>) + current index.
  // Playing from Library queues the filtered list; from Network, the peer's track list.
  const [queue, setQueue] = useState<{ name: string; src: string; path: string }[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);

  // Edit Tags Modal States
  const [editTagsFile, setEditTagsFile] = useState<{ name: string, path: string } | null>(null);
  const [editTagsData, setEditTagsData] = useState({ title: '', artist: '', album: '', filename: '' });

  // Pre-Upload Metadata Editor States
  const [metadataModalFile, setMetadataModalFile] = useState<{ name: string, path: string } | null>(null);
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataArtist, setMetadataArtist] = useState('Sidecamp');
  const [metadataAlbum, setMetadataAlbum] = useState('');
  
  // Library Organizer state
  const showOrganize = libraryPanel === 'organize';
  const [organizeRoot, setOrganizeRoot] = useState('');
  const [organizeMode, setOrganizeMode] = useState<'artist' | 'artist-album' | 'genre'>('artist');
  const [organizePlan, setOrganizePlan] = useState<{ actions: { type: string; from: string; to: string }[]; stats: any } | null>(null);
  const [organizeBusy, setOrganizeBusy] = useState(false);
  const [organizeError, setOrganizeError] = useState('');
  const [organizeResult, setOrganizeResult] = useState<{ done: number; errors: string[] } | null>(null);
  const [genreProgress, setGenreProgress] = useState<{ current: number; total: number; file: string; genre: string | null } | null>(null);
  const [genreSummary, setGenreSummary] = useState<{ missing: number; found: number; written: number; cancelled: boolean } | null>(null);
  const [genreBusy, setGenreBusy] = useState(false);

  // Auto-Upload Watcher States
  const [autoUpload, _setAutoUpload] = useState(() => {
    return localStorage.getItem('auto_upload') === 'true';
  });
  const [update, setUpdate] = useState<{ currentVersion: string; latestVersion: string | null; updateAvailable: boolean } | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);

  useEffect(() => {
    // Listen to Peer Daemon logs
    window.electronAPI.onPeerLog((msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
    });

    window.electronAPI.onPeerStatus((status: string) => {
      setPeerStatus(status);
    });

    // Native menu "Go" items / Ctrl+1..9 accelerators
    window.electronAPI.onNavGoto?.((tab: string) => setActiveTab(tab));

    window.electronAPI.onPeerChat((data: { from: string; text: string; ts: number }) => {
      setChatMessages(prev => [...prev, data].slice(-100));
    });

    window.electronAPI.getDownloadsDir().then((dir: string) => setDownloadsDir(dir || ''));

    // One check per launch — result is cached in the main process.
    window.electronAPI.checkForUpdate?.().then(setUpdate).catch(() => {});

    // Listen to download logs and progress
    window.electronAPI.onDownloadLog((msg: string) => {
      setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
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

      setActiveDownloads(prev => {
        const index = prev.findIndex(d => d.id === data.id);
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
            status: data.seeding ? 'seeding' : (data.progress >= 1 ? 'completed' : 'downloading')
          };
          return updated;
        } else {
          return [
            ...prev,
            {
              id: data.id,
              infoHash: data.infoHash,
              name: data.name || `Torrent (${data.id.substring(0, 8)})`,
              source: 'torrent',
              status: data.seeding ? 'seeding' : 'downloading',
              progress: data.progress,
              speed: data.speed,
              uploadSpeed: data.uploadSpeed,
              downloaded: data.downloaded,
              total: data.total
            }
          ];
        }
      });
    });

    // Try to load saved config from local storage
    const savedServer = localStorage.getItem('tc_server') || '';
    const savedToken = localStorage.getItem('tc_token') || '';
    setServer(savedServer);
    setToken(savedToken);

    const savedFolders = localStorage.getItem('shared_folders') || '';
    setFolder(savedFolders);

    const savedSlskUser = localStorage.getItem('slsk_user') || '';
    setSlskUser(savedSlskUser);
    // password is stored encrypted (OS keychain via safeStorage); decrypt returns
    // legacy plaintext values unchanged
    const storedPass = localStorage.getItem('slsk_pass') || '';
    (async () => {
      const savedSlskPass = storedPass ? await window.electronAPI.decryptString(storedPass) : '';
      setSlskPass(savedSlskPass);

      if (savedSlskUser && savedSlskPass) {
        await window.electronAPI.slskConnect(savedSlskUser, savedSlskPass)
        .then((connected: boolean) => {
          if (connected) {
            setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Auto-connected to Soulseek.`]);
          } else {
            setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Soulseek auto-connection failed.`]);
          }
        });
      }
    })();
  }, []);

  useEffect(() => {
    if (activeTab === 'download' || activeTab === 'library') {
      loadDownloadedFiles();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'network') {
      loadNetworkPeers();
    }
  }, [activeTab]);

  const loadNetworkPeers = async () => {
    if (!server || !token) {
      alert("Please configure the Server URL and Token in the Configuration tab first.");
      setActiveTab('settings');
      return;
    }
    setIsLoadingPeers(true);
    setNetworkPeers([]);
    setSelectedPeer(null);
    setPeerTracks([]);
    try {
      const res = await window.electronAPI.getNetworkPeers(server, token);
      const serverPeer = {
        id: 'server',
        username: 'TuneCamp Server (Catalog)',
        trackCount: 0
      };
      const allPeers = [serverPeer, ...(res || [])];
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
    setNetworkQuery('');
    try {
      if (peer.id === 'server') {
        const res = await window.electronAPI.getCatalogTracks(server, token);
        const mappedTracks = (res || []).map((t: any) => ({
          id: String(t.id),
          title: t.title,
          artist: t.artistName || 'Unknown Artist',
          album: t.albumName || 'Unknown Album',
          format: t.format || 'mp3'
        }));
        setPeerTracks(mappedTracks);
        setNetworkPeers(prev => prev.map(p => p.id === 'server' ? { ...p, trackCount: mappedTracks.length } : p));
      } else {
        const res = await window.electronAPI.getPeerTracks(server, token, peer.id, peer.origin);
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
    setActiveDownloads(prev => [
      ...prev,
      {
        id: downloadId,
        name: filename,
        source: selectedPeer.id === 'server' ? 'server' : 'network',
        status: 'downloading'
      }
    ]);
    const logPrefix = selectedPeer.id === 'server' ? '[Catalog]' : '[Network]';
    setDlLogs(prev => [...prev, `${logPrefix} Starting download of: ${filename}...`]);

    try {
      let filePath = '';
      if (selectedPeer.id === 'server') {
        filePath = await window.electronAPI.downloadCatalogTrack(
          server,
          token,
          track.id,
          track.artist,
          track.title
        );
      } else {
        filePath = await window.electronAPI.downloadPeerTrack(
          server,
          token,
          selectedPeer.id,
          track.id,
          track.artist,
          track.title,
          selectedPeer.origin
        );
      }
      setDlLogs(prev => [...prev, `${logPrefix} Download completed! Saved to: ${filePath}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'completed' } : d));
      loadDownloadedFiles();
      
      if (autoUpload && filePath) {
        handleUploadFileAuto(filePath);
      }
    } catch (e: any) {
      setDlLogs(prev => [...prev, `${logPrefix} Error during download: ${e.message || e}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'failed' } : d));
    } finally {
      setDownloadingTrackId(null);
      // Removed setTimeout to keep items in queue for the Transfers tab
    }
  };

  // Audio Player Controls
  const startPlayback = (name: string, src: string, displayPath: string) => {
    setCurrentPlayback({ name, path: displayPath });
    setIsPlaying(true);
    // Reset so the previous track's time/duration doesn't linger on the new one.
    setCurrentTime(0);
    setDuration(0);
    setIsSeeking(false);
    if (audioRef.current) {
      audioRef.current.src = src;
      // AbortError fires whenever a newer load pre-empts this one (fast skip) — expected, not a real failure.
      audioRef.current.play().catch(e => { if (e.name !== 'AbortError') console.error("Playback failed:", e); });
    }
  };

  const playAt = (tracks: { name: string; src: string; path: string }[], index: number) => {
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
    path: file.path
  });

  const networkQueueItem = (peer: any, track: any) => {
    const cleanServer = server.replace(/\/$/, '');
    const streamUrl = peer.id === 'server'
      ? `${cleanServer}/api/tracks/${track.id}/stream`
      : `${cleanServer}/api/peers/${peer.id}/tracks/${track.id}/stream`;
    return {
      name: `${track.artist} - ${track.title}`,
      src: `stream://audio?url=${encodeURIComponent(streamUrl)}&token=${encodeURIComponent(token)}`,
      path: `${peer.username} (Network)`
    };
  };

  const playNetworkTrack = (peer: any, track: any) => {
    const idx = peerTracks.indexOf(track);
    const list = idx >= 0 ? peerTracks : [track];
    playAt(list.map(t => networkQueueItem(peer, t)), Math.max(idx, 0));
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      // AbortError fires whenever a newer load pre-empts this one (fast skip) — expected, not a real failure.
      audioRef.current.play().catch(e => { if (e.name !== 'AbortError') console.error("Playback failed:", e); });
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
      audioRef.current.src = '';
    }
    setCurrentPlayback(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQueue([]);
    setQueueIndex(-1);
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Auto-Upload Trigger
  const handleUploadFileAuto = async (filePath: string) => {
    if (!server || !token) {
      setDlLogs(prev => [...prev, `[Auto-Upload] Server/Token not configured, skipping auto-upload.`]);
      return;
    }
    const filename = filePath.split(/[/\\]/).pop() || '';
    let artist = 'Sidecamp';
    let title = filename.replace(/\.[^/.]+$/, "");
    if (filename.includes(' - ')) {
      const parts = filename.split(' - ');
      artist = parts[0].trim();
      title = parts[1].replace(/\.[^/.]+$/, "").trim();
    }
    
    setDlLogs(prev => [...prev, `[Auto-Upload] Starting automatic upload of: ${filename}...`]);
    try {
      await window.electronAPI.setUploadConfig(server, token);
      await window.electronAPI.uploadTrack(filePath, { artist, title });
      setDlLogs(prev => [...prev, `[Auto-Upload] Auto-upload completed successfully!`]);
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Auto-Upload] Auto-upload failed: ${e.message || e}`]);
    }
  };

  // Pre-Upload Metadata Editor Confirm
  const confirmUpload = async () => {
    if (!metadataModalFile) return;
    const filePath = metadataModalFile.path;
    
    if (!server || !token) {
      alert("You must configure the Server URL and Token in the Configuration section to upload files!");
      return;
    }
    
    setUploadingFilePath(filePath);
    setDlLogs(prev => [...prev, `[Library] Starting upload of: ${metadataModalFile.name} with custom tags...`]);
    setMetadataModalFile(null); // close modal
    
    try {
      await window.electronAPI.setUploadConfig(server, token);
      await window.electronAPI.uploadTrack(filePath, { 
        artist: metadataArtist || 'Sidecamp', 
        title: metadataTitle || metadataModalFile.name, 
        album: metadataAlbum || undefined 
      });
      setDlLogs(prev => [...prev, `[Library] Upload completed successfully!`]);
      alert("Track successfully uploaded to TuneCamp!");
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Library] Error during upload: ${e.message || e}`]);
      alert("Error uploading file: " + (e.message || e));
    } finally {
      setUploadingFilePath(null);
    }
  };

  const loadDownloadedFiles = async () => {
    try {
      const roots = folder.split(/[,;]/).map(f => f.trim()).filter(Boolean);
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
    if (!confirm(`Delete ${selectedFiles.length} selected files? This cannot be undone.`)) return;
    for (const p of selectedFiles) {
      try { await window.electronAPI.deleteDownload(p); } catch (e) { console.error('Delete failed:', p, e); }
    }
    setDlLogs(prev => [...prev, `[Library] Deleted ${selectedFiles.length} selected files.`]);
    setSelectedFiles([]);
    loadDownloadedFiles();
  };

  const handleUploadSelected = async () => {
    if (selectedFiles.length === 0) return;
    if (!server || !token) {
      alert("You must configure the Server URL and Token in the Configuration section to upload files!");
      return;
    }
    if (!confirm(`Upload ${selectedFiles.length} selected files to TuneCamp?`)) return;
    await window.electronAPI.setUploadConfig(server, token);
    let ok = 0, fail = 0;
    for (const filePath of selectedFiles) {
      const filename = filePath.split(/[/\\]/).pop() || '';
      const m = trackMeta[filePath];
      let artist = m?.artist || 'Sidecamp';
      let title = m?.title || filename.replace(/\.[^/.]+$/, '');
      if (!m?.artist && filename.includes(' - ')) {
        const parts = filename.split(' - ');
        artist = parts[0].trim();
        title = parts[1].replace(/\.[^/.]+$/, '').trim();
      }
      setUploadingFilePath(filePath);
      setDlLogs(prev => [...prev, `[Library] Uploading ${ok + fail + 1}/${selectedFiles.length}: ${filename}...`]);
      try {
        await window.electronAPI.uploadTrack(filePath, { artist, title, album: m?.album || undefined });
        ok++;
      } catch (e: any) {
        fail++;
        setDlLogs(prev => [...prev, `[Library] Upload failed for ${filename}: ${e.message || e}`]);
      }
    }
    setUploadingFilePath(null);
    setDlLogs(prev => [...prev, `[Library] Bulk upload done: ${ok} uploaded, ${fail} failed.`]);
    setSelectedFiles([]);
  };

  // Drop target for rows dragged from the Library table
  const addTracksToPlaylist = (id: string, paths: string[]) => {
    const byPath = new Map(downloadedFiles.map((f: any) => [f.path, f]));
    updatePlaylist(id, p => {
      const existing = new Set(p.tracks.map(t => t.path));
      const add = paths
        .filter(x => byPath.has(x) && !existing.has(x))
        .map(x => { const f = byPath.get(x)!; return { path: f.path, name: (f.name.split(/[/\\]/).pop() || f.name) as string }; });
      return add.length ? { ...p, tracks: [...p.tracks, ...add] } : p;
    });
  };

  const addSelectedToPlaylist = () => {
    if (!activePlaylist) {
      setLibraryPanel('playlists');
      alert('Select or create a playlist first (Playlists panel just opened).');
      return;
    }
    const byPath = new Map(downloadedFiles.map((f: any) => [f.path, f]));
    selectedFiles.forEach(p => { const f = byPath.get(p); if (f) addTrackToActive(f); });
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
      for (let j = start; j < end; j += 32) { // stride sampling: plenty for a 140px strip
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
      peaks.push(max);
      if (max > top) top = max;
    }
    return peaks.map(p => (top > 0 ? Math.round((p / top) * 100) : 0)); // normalize like rekordbox
  };

  // Hi-res peaks (50/sec) for the big scrolling waveform, computed per played
  // track on demand — local files only, network streams have no local bytes.
  const SCROLL_PPS = 50;
  const [scrollWave, setScrollWave] = useState<{ path: string; peaks: number[] } | null>(null);
  useEffect(() => {
    const p = currentPlayback?.path;
    setScrollWave(null);
    if (!p || !/[/\\]/.test(p)) return;
    let stale = false;
    (async () => {
      try {
        const u8: Uint8Array = await window.electronAPI.readAudioFile(p);
        if (stale) return;
        const raw = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
        const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw);
        if (stale) return;
        setScrollWave({ path: p, peaks: computePeaks(decoded, Math.max(1, Math.ceil(decoded.duration * SCROLL_PPS))) });
      } catch { /* not a local decodable file — no scroll wave */ }
    })();
    return () => { stale = true; };
  }, [currentPlayback?.path]);

  const analyzeTracks = async () => {
    const targets = downloadedFiles.filter(f => {
      const m = trackMeta[f.path];
      return m && (!m.bpm || !m.peaks?.length || m.beatOffset == null);
    });
    if (targets.length === 0) {
      alert('Nothing to analyze — all tracks have BPM and waveform (or metadata is still loading).');
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
        const raw = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
        const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(raw);
        const data: { bpm?: number; peaks?: number[]; beatOffset?: number } = {};
        if (!m.peaks?.length) data.peaks = computePeaks(decoded);
        if (!m.bpm || m.beatOffset == null) {
          const windowStart = Math.max(0, (decoded.duration - 60) / 2);
          try {
            const { bpm, offset } = await guess(decoded, windowStart, Math.min(60, decoded.duration));
            // bpm and beatOffset must come from the same detection pass or the
            // beat grid is meaningless — store both, overwriting a tag BPM.
            data.bpm = bpm;
            data.beatOffset = (windowStart + offset) % (60 / bpm);
          } catch { /* no clear tempo — keep the waveform anyway */ }
        }
        if (data.bpm || data.peaks) {
          await window.electronAPI.setTrackAnalysis(f.path, data);
          setTrackMeta(prev => ({ ...prev, [f.path]: { ...prev[f.path], ...(data.bpm ? { bpm: data.bpm, beatOffset: data.beatOffset } : {}), ...(data.peaks ? { peaks: data.peaks } : {}) } }));
        }
      } catch (e) {
        console.warn('Analysis failed for', f.path, e); // undecodable — skip
      }
      setAnalyzing(s => (s ? { done: s.done + 1, total: s.total } : s));
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
        const metas = await window.electronAPI.getTracksMeta(files.slice(i, i + CHUNK).map(f => f.path));
        setTrackMeta(prev => ({ ...prev, ...metas }));
      } catch (e) {
        console.error('Failed to load track metadata:', e);
        return;
      }
    }
  };

  // --- Playlists ---
  useEffect(() => { localStorage.setItem('playlists', JSON.stringify(playlists)); }, [playlists]);
  const activePlaylist = playlists.find(p => p.id === activePlaylistId) || null;
  const updatePlaylist = (id: string, fn: (p: Playlist) => Playlist) =>
    setPlaylists(prev => prev.map(p => (p.id === id ? fn(p) : p)));
  const createPlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    const id = crypto.randomUUID();
    setPlaylists(prev => [...prev, { id, name, tracks: [] }]);
    setActivePlaylistId(id);
    setNewPlaylistName('');
  };
  const deletePlaylist = (id: string) => {
    if (!window.confirm('Delete this playlist? (files are not touched)')) return;
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (activePlaylistId === id) setActivePlaylistId(null);
  };
  const addTrackToActive = (file: { path: string; name: string }) => {
    if (!activePlaylist) return;
    const basename = file.name.split(/[/\\]/).pop() || file.name;
    updatePlaylist(activePlaylist.id, p =>
      p.tracks.some(t => t.path === file.path) ? p : { ...p, tracks: [...p.tracks, { path: file.path, name: basename }] });
  };
  const removeTrackAt = (idx: number) => {
    if (!activePlaylist) return;
    updatePlaylist(activePlaylist.id, p => ({ ...p, tracks: p.tracks.filter((_, i) => i !== idx) }));
  };
  const moveTrack = (idx: number, dir: -1 | 1) => {
    if (!activePlaylist) return;
    const j = idx + dir;
    if (j < 0 || j >= activePlaylist.tracks.length) return;
    updatePlaylist(activePlaylist.id, p => {
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
      const base = (t.name.split(/[/\\]/).pop() || t.name).replace(/[<>:"/\\|?*]/g, '');
      return { path: t.path, exportName: `${String(i + 1).padStart(2, '0')} - ${base}` };
    });
    setExportMsg('Exporting…');
    try {
      const res = await window.electronAPI.exportPlaylist(dest, activePlaylist.name, items);
      if (res?.error) { setExportMsg(`Export failed: ${res.error}`); return; }
      setExportMsg(`Exported ${res.copied}/${res.total} → ${res.target}${res.errors.length ? ` (${res.errors.length} errors)` : ''}`);
    } catch (e: any) {
      setExportMsg(`Export failed: ${e.message || e}`);
    }
  };
  const handleExportPlaylistJson = async () => {
    if (!activePlaylist) return;
    const content = JSON.stringify(activePlaylist, null, 2);
    const defaultFilename = `${activePlaylist.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_playlist.json`;
    try {
      const savedPath = await window.electronAPI.saveFile(defaultFilename, content);
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
        alert('Failed to parse file content as JSON.');
        return;
      }
      if (!data.name || !Array.isArray(data.tracks)) {
        alert('Invalid playlist format: missing name or tracks array.');
        return;
      }
      const newPlaylist: Playlist = {
        id: crypto.randomUUID(),
        name: data.name.endsWith('(Imported)') ? data.name : `${data.name} (Imported)`,
        tracks: data.tracks,
      };
      setPlaylists(prev => [...prev, newPlaylist]);
      setActivePlaylistId(newPlaylist.id);
      setExportMsg(`Playlist metadata imported successfully from: ${res.filePath}`);
    } catch (e: any) {
      alert('Import failed: ' + (e.message || e));
    }
  };

  const handleEditTags = async (file: any) => {
    setEditTagsFile({ name: file.name, path: file.path });
    try {
      const tags = await window.electronAPI.readTags(file.path);
      const baseName = (file.name.split(/[/\\]/).pop() || file.name).replace(/\.[^/.]+$/, '');
      const currentFilename = file.name.split(/[/\\]/).pop() || file.name;
      setEditTagsData({
        title: tags.title || baseName,
        artist: tags.artist || '',
        album: tags.album || '',
        filename: currentFilename,
      });
    } catch {
      const baseName = (file.name.split(/[/\\]/).pop() || file.name).replace(/\.[^/.]+$/, '');
      const currentFilename = file.name.split(/[/\\]/).pop() || file.name;
      setEditTagsData({ title: baseName, artist: '', album: '', filename: currentFilename });
    }
  };

  const confirmEditTags = async () => {
    if (!editTagsFile) return;
    try {
      const { filename, ...tags } = editTagsData;
      await window.electronAPI.writeTags(editTagsFile.path, tags);
      const originalFilename = editTagsFile.name.split(/[/\\]/).pop() || editTagsFile.name;
      if (filename && filename !== originalFilename) {
        await window.electronAPI.renameDownload(editTagsFile.path, filename);
      }
      setDlLogs(prev => [...prev, `[Library] Tags saved: ${editTagsFile.name}`]);
      setEditTagsFile(null);
      loadDownloadedFiles();
    } catch (e: any) {
      alert('Error: ' + (e.message || e));
    }
    setEditTagsFile(null);
  };

  const handleDeleteFile = async (filePath: string) => {
    if (confirm("Are you sure you want to delete this file?")) {
      try {
        await window.electronAPI.deleteDownload(filePath);
        setDlLogs(prev => [...prev, `[Library] File deleted: ${filePath.split(/[/\\]/).pop()}`]);
        loadDownloadedFiles();
      } catch (e: any) {
        alert("Error deleting file: " + e.message);
      }
    }
  };

  const handleUploadFile = async (filePath: string) => {
    const filename = filePath.split(/[/\\]/).pop() || '';
    const baseName = filename.replace(/\.[^/.]+$/, '');
    let defaultArtist = 'Sidecamp';
    let defaultTitle = baseName;
    let defaultAlbum = '';

    try {
      const tags = await window.electronAPI.readTags(filePath);
      if (tags.title) defaultTitle = tags.title;
      if (tags.artist) defaultArtist = tags.artist;
      if (tags.album) defaultAlbum = tags.album;
    } catch {
      if (baseName.includes(' - ')) {
        const parts = baseName.split(' - ');
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
      folders: folder.split(/[,;]/).map(f => f.trim()).filter(Boolean),
      allowDownloads: true
    });
  };

  const handleStopPeer = async () => {
    await window.electronAPI.stopPeer();
  };

  const handleSendChat = async () => {
    const to = chatTo.trim();
    const text = chatText.trim();
    if (!to || !text) return;
    await window.electronAPI.sendPeerChat(to, text);
    setChatMessages(prev => [...prev, { from: `→ ${to}`, text, ts: Date.now(), self: true }].slice(-100));
    setChatText('');
  };

  const loadBrowser = async (root: string, subpath: string) => {
    setBrowserError('');
    setBrowserSearch('');
    const res = await window.electronAPI.listSharedDir(root, subpath);
    if (res.error) { setBrowserError(res.error); setBrowserEntries([]); return; }
    setBrowserEntries(res.entries || []);
  };

  const selectBrowserRoot = (root: string) => {
    setBrowserRoot(root);
    setBrowserPath('');
    loadBrowser(root, '');
  };

  const openBrowserFolder = (name: string) => {
    const next = browserPath ? `${browserPath}/${name}` : name;
    setBrowserPath(next);
    loadBrowser(browserRoot, next);
  };

  const browserGoUp = () => {
    if (!browserPath) return;
    const parts = browserPath.split('/').filter(Boolean);
    parts.pop();
    const next = parts.join('/');
    setBrowserPath(next);
    loadBrowser(browserRoot, next);
  };

  const handleCreateFolder = async () => {
    if (!browserRoot || !newFolderName.trim()) return;
    const res = await window.electronAPI.mkdirShared(browserRoot, browserPath, newFolderName);
    if (res.error) { setBrowserError(res.error); return; }
    setNewFolderName('');
    loadBrowser(browserRoot, browserPath);
  };

  const handleDeleteEntry = async (name: string, isDir: boolean) => {
    if (!window.confirm(`Delete ${isDir ? 'folder' : 'file'} "${name}"${isDir ? ' and all its contents' : ''}? This cannot be undone.`)) return;
    const res = await window.electronAPI.deleteShared(browserRoot, browserPath, name, isDir);
    if (res.error) { setBrowserError(res.error); return; }
    loadBrowser(browserRoot, browserPath);
  };

  const handleMoveHere = async () => {
    if (!movingItem) return;
    const res = await window.electronAPI.moveShared(movingItem.root, movingItem.path, movingItem.name, browserRoot, browserPath);
    if (res.error) { setBrowserError(res.error); return; }
    setMovingItem(null);
    loadBrowser(browserRoot, browserPath);
  };

  const handleSearch = async () => {
    setDlLogs(prev => [...prev, `[Search] Starting search for "${searchQuery}" on ${searchSource.toUpperCase()}...`]);
    try {
      let res: any[] = [];
      if (searchSource === 'all') {
        const promises = [
          window.electronAPI.slskSearch(searchQuery)
            .then((res: any[]) => res.map((r: any) => ({ ...r, source: 'soulseek' })))
            .catch((e: any) => { console.error("Soulseek search failed:", e); return []; }),
          window.electronAPI.searchWeb(searchQuery, 'soundcloud')
            .then((res: any[]) => res.map((r: any) => ({ ...r, source: 'soundcloud' })))
            .catch((e: any) => { console.error("SoundCloud search failed:", e); return []; }),
          window.electronAPI.searchWeb(searchQuery, 'bandcamp')
            .then((res: any[]) => res.map((r: any) => ({ ...r, source: 'bandcamp' })))
            .catch((e: any) => { console.error("Bandcamp search failed:", e); return []; }),
          window.electronAPI.searchWeb(searchQuery, 'torrent', server, token)
            .then((res: any[]) => res.map((r: any) => ({ ...r, source: 'torrent_search' })))
            .catch((e: any) => { console.error("Torrent search failed:", e); return []; }),
          window.electronAPI.searchWeb(searchQuery, 'network', server, token)
            .catch((e: any) => { console.error("Network search failed:", e); return []; }),
          window.electronAPI.searchWeb(searchQuery, 'archive')
            .then((res: any[]) => res.map((r: any) => ({ ...r, source: 'archive' })))
            .catch((e: any) => { console.error("Archive.org search failed:", e); return []; }),
          window.electronAPI.searchWeb(searchQuery, 'youtube')
            .then((res: any[]) => res.map((r: any) => ({ ...r, source: 'youtube' })))
            .catch((e: any) => { console.error("YouTube search failed:", e); return []; })
        ];
        
        const settled = await Promise.allSettled(promises);
        const aggregated: any[] = [];
        settled.forEach(s => {
          if (s.status === 'fulfilled') {
            aggregated.push(...s.value);
          }
        });
        res = aggregated;
      } else if (searchSource === 'soulseek') {
        res = await window.electronAPI.slskSearch(searchQuery);
        res = res.map(r => ({ ...r, source: 'soulseek' }));
      } else {
        res = await window.electronAPI.searchWeb(searchQuery, searchSource, server, token);
      }
      setSearchResults(res);
      setDlLogs(prev => [...prev, `[Search] Search completed! Found ${res.length} results.`]);
    } catch (err: any) {
      setDlLogs(prev => [...prev, `[Search] Error during search: ${err.message || err}`]);
    }
  };

  const handleDownload = async (result: any) => {
    const downloadId = result.id;
    const source = result.source || 'soulseek';
    const filename = result.title || (result.file && result.file.split(/[/\\]/).pop()) || 'Track';

    setActiveDownloads(prev => [
      ...prev,
      {
        id: downloadId,
        name: filename,
        source: source,
        status: 'downloading'
      }
    ]);

    setDlLogs(prev => [...prev, `[${source.toUpperCase()}] Starting download of: ${filename}...`]);
    try {
      let filePath = '';
      if (source === 'soundcloud' || source === 'bandcamp' || source === 'archive' || source === 'youtube') {
        filePath = await window.electronAPI.ytdlpDownload(result.url);
      } else if (source === 'torrent_search') {
        const paths = await window.electronAPI.torrentDownload(result.url, downloadId);
        filePath = paths.length > 0 ? paths[0] : '';
      } else if (source === 'peer') {
        filePath = await window.electronAPI.downloadPeerTrack(server, token, result.sessionId, result.trackId, result.artist, result.title, result.origin);
      } else {
        filePath = await window.electronAPI.slskDownload(result);
      }
      setDlLogs(prev => [...prev, `[${source.toUpperCase()}] Download completed! Saved to: ${filePath}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'completed' } : d));
      loadDownloadedFiles(); // Refresh downloads list automatically!
      
      if (autoUpload && filePath) {
        handleUploadFileAuto(filePath);
      }
    } catch (err: any) {
      setDlLogs(prev => [...prev, `[${source.toUpperCase()}] Error during download: ${err.message || err}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'failed' } : d));
    } finally {
      // Removed setTimeout to keep items in queue for the Transfers tab
    }
  };

  const handleDirectDownload = async () => {
    if (!directUrl) return;
    setIsDownloading(true);
    setDlProgress(null);
    setDlLogs([]);
    
    const tempId = 'direct_' + Date.now();
    const isTorrent = directUrl.startsWith('magnet:?') || directUrl.endsWith('.torrent');
    
    setActiveDownloads(prev => [
      ...prev,
      {
        id: tempId,
        name: isTorrent ? 'Analyzing Torrent...' : directUrl,
        source: isTorrent ? 'torrent' : 'web',
        status: 'downloading'
      }
    ]);

    setDlLogs(prev => [...prev, `Starting direct download for: ${directUrl}`]);
    try {
      let resultPaths: string[] = [];
      if (isTorrent) {
        setDlLogs(prev => [...prev, `Magnet Torrent link detected. Starting download...`]);
        resultPaths = await window.electronAPI.torrentDownload(directUrl, tempId);
        setDlLogs(prev => [...prev, `Torrent download completed! Downloaded ${resultPaths.length} files.`]);
      } else {
        setDlLogs(prev => [...prev, `Web URL detected (SoundCloud/Bandcamp/YouTube/etc.). Starting extraction with YT-DLP...`]);
        const singlePath = await window.electronAPI.ytdlpDownload(directUrl);
        resultPaths = [singlePath];
        setDlLogs(prev => [...prev, `Download completed! File: ${singlePath}`]);
      }
      
      setActiveDownloads(prev => prev.map(d => d.id === tempId || (d.source === 'torrent' && d.status === 'downloading') ? { ...d, status: 'completed', name: d.name.startsWith('Analyzing') && resultPaths.length > 0 ? resultPaths[0].split(/[/\\]/).pop() : d.name } : d));
      loadDownloadedFiles(); // Refresh downloads list automatically!
      
      if (autoUpload && resultPaths.length > 0) {
        for (const p of resultPaths) {
          if (p) handleUploadFileAuto(p);
        }
      }
    } catch (err: any) {
      setDlLogs(prev => [...prev, `Error during process: ${err.message || err}`]);
      setActiveDownloads(prev => prev.map(d => d.id === tempId ? { ...d, status: 'failed' } : d));
    } finally {
      setIsDownloading(false);
      setDlProgress(null);
      setDirectUrl('');
      // Removed setTimeout to keep items in queue for the Transfers tab
    }
  };

  const purgeFailedDownloads = () => {
    setActiveDownloads(prev => prev.filter(d => d.status !== 'failed'));
  };

  const clearDownloadItem = (id: string) => {
    setActiveDownloads(prev => prev.filter(d => d.id !== id));
  };

  const handleSeedFile = async (filePath: string) => {
    const filename = filePath.split(/[/\\]/).pop() || '';
    setDlLogs(prev => [...prev, `[Library] Starting seed for: ${filename}...`]);
    try {
      const magnetUri = await window.electronAPI.torrentSeed(filePath);
      setDlLogs(prev => [...prev, `[Library] Torrent seeding! Magnet Link: ${magnetUri}`]);
      alert(`Started seeding torrent!\n\nMagnet URI:\n${magnetUri}\n\nCopied to clipboard!`);
      navigator.clipboard.writeText(magnetUri).catch(() => {});
      loadDownloadedFiles();
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Library] Seeding failed: ${e.message || e}`]);
      alert("Error seeding file: " + (e.message || e));
    }
  };

  const handleSeedSelectedClick = () => {
    if (selectedFiles.length === 0) return;
    setAlbumSeedName('My Custom Album');
    setAlbumSeedModalOpen(true);
  };

  const confirmSeedSelected = async () => {
    setAlbumSeedModalOpen(false);
    setDlLogs(prev => [...prev, `[Library] Starting seed for album: "${albumSeedName}" with ${selectedFiles.length} files...`]);
    try {
      const magnetUri = await window.electronAPI.torrentSeed(selectedFiles, albumSeedName);
      setDlLogs(prev => [...prev, `[Library] Album Torrent seeding! Magnet Link: ${magnetUri}`]);
      alert(`Started seeding album torrent!\n\nMagnet URI:\n${magnetUri}\n\nCopied to clipboard!`);
      navigator.clipboard.writeText(magnetUri).catch(() => {});
      setSelectedFiles([]);
      loadDownloadedFiles();
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Library] Seeding failed: ${e.message || e}`]);
      alert("Error seeding album: " + (e.message || e));
    }
  };

  const handleStopTorrent = async (infoHash: string) => {
    try {
      await window.electronAPI.removeTorrent(infoHash);
      setActiveDownloads(prev => prev.filter(d => d.id !== infoHash));
      setDlLogs(prev => [...prev, `[Library] Torrent removed: ${infoHash.substring(0, 8)}...`]);
      loadDownloadedFiles();
    } catch (e: any) {
      console.error("Error removing torrent:", e);
    }
  };

  const handleSaveSettings = async () => {
    localStorage.setItem('tc_server', server);
    localStorage.setItem('tc_token', token);
    localStorage.setItem('slsk_user', slskUser);
    localStorage.setItem('slsk_pass', slskPass ? await window.electronAPI.encryptString(slskPass) : '');
    localStorage.setItem('shared_folders', folder);

    setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Connecting to Soulseek...`]);
    const connected = await window.electronAPI.slskConnect(slskUser, slskPass);
    if (connected) {
      setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Successfully connected to Soulseek.`]);
    } else {
      setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Soulseek connection failed (check credentials).`]);
    }

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const validFolders = folder.split(/[,;]/).map(f => f.trim()).filter(Boolean);
  const libraryLogs = dlLogs.filter(log => log.includes('[Library]'));

  // Library table derivations, memoized: without this the whole block re-ran on
  // every App render — including the ~4Hz timeupdate ticks during playback.
  const lib = useMemo(() => {
    const q = librarySearch.toLowerCase().trim();
    const folderOf = (name: string) => { const parts = name.split(/[/\\]/); return parts.length > 1 ? parts[0] : '(root)'; };
    const rows = downloadedFiles.map(f => {
      const m = trackMeta[f.path];
      const basename = f.name.split(/[/\\]/).pop() || f.name;
      return {
        file: f,
        basename,
        title: m?.title || basename.replace(/\.[^/.]+$/, ''),
        artist: m?.artist || '',
        album: m?.album || '',
        genre: m?.genre || '',
        bpm: m?.bpm ?? null,
        key: m?.key || '',
        duration: m?.duration || 0,
        year: m?.year ?? null,
        kbps: m?.bitrate ? Math.round(m.bitrate / 1000) : 0,
        peaks: m?.peaks,
      };
    });
    // Collection pane data: counts over the whole library, not the filtered view
    const countBy = (get: (r: typeof rows[0]) => string) => {
      const map = new Map<string, number>();
      rows.forEach(r => { const k = get(r) || '(unknown)'; map.set(k, (map.get(k) || 0) + 1); });
      return [...map.entries()].sort((a, b) => collator.compare(a[0], b[0]));
    };
    const artists = countBy(r => r.artist);
    const genres = countBy(r => r.genre);
    const folders = countBy(r => folderOf(r.file.name));
    const catFiltered = rows.filter(r =>
      libFilter.type === 'all' ? true :
      libFilter.type === 'artist' ? (r.artist || '(unknown)') === libFilter.value :
      libFilter.type === 'genre' ? (r.genre || '(unknown)') === libFilter.value :
      folderOf(r.file.name) === libFilter.value);
    const libraryFiltered = catFiltered
      .filter(r => `${r.title} ${r.artist} ${r.album} ${r.genre} ${r.file.name}`.toLowerCase().includes(q))
      .sort((a, b) => sortDir * (
        sortCol === 'title' ? collator.compare(a.title, b.title) :
        sortCol === 'artist' ? collator.compare(a.artist, b.artist) :
        sortCol === 'album' ? collator.compare(a.album, b.album) :
        sortCol === 'genre' ? collator.compare(a.genre, b.genre) :
        sortCol === 'bpm' ? (a.bpm || 0) - (b.bpm || 0) :
        sortCol === 'key' ? collator.compare(a.key, b.key) :
        sortCol === 'time' ? a.duration - b.duration :
        sortCol === 'year' ? (a.year || 0) - (b.year || 0) :
        sortCol === 'kbps' ? a.kbps - b.kbps :
        sortCol === 'size' ? a.file.size - b.file.size :
        a.file.ctime - b.file.ctime
      ));
    const libraryQueue = libraryFiltered.map(r => libraryQueueItem(r.file));
    return { rows, artists, genres, folders, libraryFiltered, libraryQueue };
  }, [downloadedFiles, trackMeta, librarySearch, libFilter, sortCol, sortDir]);
  const selectedSet = useMemo(() => new Set(selectedFiles), [selectedFiles]);
  const browserRoots = [
    ...(downloadsDir ? [{ label: 'Downloads', path: downloadsDir }] : []),
    ...validFolders.map(f => ({ label: f.split(/[/\\]/).pop() || f, path: f })),
  ];

  // Jump from a Library track to its folder in the Shared Files browser.
  const revealInSharedFiles = (filePath: string) => {
    const norm = (p: string) => p.replace(/[\\/]+/g, '/').toLowerCase();
    const root = browserRoots.find(r => norm(filePath).startsWith(norm(r.path) + '/'));
    if (!root) return;
    const rel = filePath.slice(root.path.length).replace(/^[\\/]/, '');
    const dir = rel.split(/[\\/]/).slice(0, -1).join('/');
    setBrowserRoot(root.path);
    setBrowserPath(dir);
    loadBrowser(root.path, dir);
    setActiveTab('peer');
  };

  useEffect(() => {
    if (activeTab === 'peer' && browserRoots.length > 0 && !browserRoot) {
      selectBrowserRoot(browserRoots[0].path);
    }
  }, [activeTab, downloadsDir]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleOrganizePickFolder = async () => {
    const dir = await window.electronAPI.pickFolder();
    if (dir) {
      setOrganizeRoot(dir);
      setOrganizePlan(null);
      setOrganizeResult(null);
      setOrganizeError('');
    }
  };

  const handleOrganizeScan = async (mode = organizeMode) => {
    if (!organizeRoot) return;
    setOrganizeBusy(true);
    setOrganizeError('');
    setOrganizeResult(null);
    try {
      const res = await window.electronAPI.organizeScan(organizeRoot, mode);
      if (res?.error) { setOrganizeError(res.error); setOrganizePlan(null); }
      else setOrganizePlan(res);
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
    setOrganizeError('');
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
    setOrganizeError('');
    try {
      const res = await window.electronAPI.organizeApply(organizeRoot, organizePlan.actions);
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

  return (
    <div className="app-container">
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo-container">
          <img src={logo} className="logo-img" alt="Sidecamp Logo" />
          {!sidebarCollapsed && <h1>Sidecamp</h1>}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(c => !c)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            <PanelLeft size={18} />
          </button>
        </div>

        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'download' ? 'active' : ''}`} onClick={() => setActiveTab('download')} title="Search & Download">
            <span className="icon"><Download size={16} /></span> {!sidebarCollapsed && 'Search'}
          </button>
          <button className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')} title="Library">
            <span className="icon"><Music size={16} /></span> {!sidebarCollapsed && 'Library'}
          </button>
          <button className={`nav-item ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')} title="Network">
            <span className="icon"><Globe size={16} /></span> {!sidebarCollapsed && 'Network'}
          </button>
          <button className={`nav-item ${activeTab === 'peer' ? 'active' : ''}`} onClick={() => setActiveTab('peer')} title="Sharing — peer node & shared files">
            <span className="icon"><Radio size={16} /></span> {!sidebarCollapsed && 'Sharing'}
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} title="Settings">
            <span className="icon"><Settings size={16} /></span> {!sidebarCollapsed && 'Settings'}
          </button>
        </nav>

        <button
          className="nav-item"
          onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          style={{ marginTop: 'auto' }}
        >
          <span className="icon">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span>
          {!sidebarCollapsed && (theme === 'dark' ? 'Light mode' : 'Dark mode')}
        </button>

        <div className="status-indicator" style={{ marginTop: '0.5rem' }}>
          <div className={`status-dot ${peerStatus}`}></div>
          {!sidebarCollapsed && <span>{peerStatus.toUpperCase()}</span>}
        </div>
      </div>

      <main className="main-content">
          {currentPlayback && scrollWave && scrollWave.path === currentPlayback.path && (
            <div className="scrollwave-wrap">
              <ScrollWave peaks={scrollWave.peaks} pps={SCROLL_PPS} audioRef={audioRef} />
            </div>
          )}
          {update?.updateAvailable && !updateDismissed && (
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.6rem 1rem', marginBottom: '1rem' }}>
              <ArrowUpCircle size={18} style={{ color: 'var(--accent, #4ade80)', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.9rem' }}>
                Sidecamp <strong>{update.latestVersion}</strong> is available (you have {update.currentVersion}).
              </span>
              <Button variant="primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }} onClick={() => window.electronAPI.openReleasesPage()}>
                Download
              </Button>
              <Button variant="secondary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setUpdateDismissed(true)} title="Dismiss">
                <X size={14} />
              </Button>
            </div>
          )}
          {activeTab === 'peer' && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Shared Files <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>browse, move & organize your files</span></h3>
              </div>
              {browserRoots.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No folders yet. Add shared folders in the "Configuration" tab.</div>
              )}
              {browserRoots.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {browserRoots.map((r, i) => (
                      <Button key={i} variant={browserRoot === r.path ? 'primary' : 'secondary'} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => selectBrowserRoot(r.path)}>
                        <Folder size={13} /> {r.label}
                      </Button>
                    ))}
                  </div>
                  {browserRoot && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <Button variant="secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={browserGoUp} disabled={!browserPath}><ChevronUp size={13} /> Up</Button>
                        <span>{(browserRoot.split(/[/\\]/).pop() || browserRoot)}{browserPath ? ' / ' + browserPath.replace(/\//g, ' / ') : ''}</span>
                      </div>
                      {movingItem && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '0.6rem 0.9rem', marginBottom: '1rem', background: 'rgba(179,102,255,0.12)', border: '1px solid var(--primary)', borderRadius: '8px', fontSize: '0.85rem' }}>
                          <span>Moving <strong>{movingItem.name}</strong> — navigate to a folder, then:</span>
                          <Button variant="primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={handleMoveHere}>Move here</Button>
                          <Button variant="secondary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setMovingItem(null)}>Cancel</Button>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                        <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="New subfolder name" className="glass-input" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
                        <Button variant="primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FolderPlus size={16} /> Create
                        </Button>
                      </div>
                      {browserError && <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{browserError}</div>}
                      {browserEntries.length > 0 && (
                        <input type="text" value={browserSearch} onChange={e => setBrowserSearch(e.target.value)} placeholder="Search in this folder…" className="glass-input" style={{ width: '100%', marginBottom: '0.75rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} />
                      )}
                      {/* Capped height so a big folder doesn't push the sharing controls below off-screen. */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '50vh', overflowY: 'auto', paddingRight: '4px' }}>
                        {(() => {
                          const visible = browserEntries.filter(en => en.name.toLowerCase().includes(browserSearch.toLowerCase().trim()));
                          const isAudio = (n: string) => /\.(mp3|flac|wav|ogg|m4a|mp4|webm)$/i.test(n);
                          const audio = visible.filter(en => !en.isDir && isAudio(en.name));
                          // Queue = the audio files of the folder view, so next/prev walk the folder.
                          const browserQueue = audio.map(en => libraryQueueItem({ name: en.name, path: `${browserRoot}${browserPath ? '/' + browserPath : ''}/${en.name}` }));
                          return visible.map((en, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.6rem 0.9rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                            <div onClick={() => en.isDir ? openBrowserFolder(en.name) : isAudio(en.name) && playAt(browserQueue, audio.indexOf(en))} title={en.isDir ? 'Open folder' : isAudio(en.name) ? 'Play' : undefined} style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: en.isDir || isAudio(en.name) ? 'pointer' : 'default' }}>
                              <span style={{ display: 'inline-flex' }}>{en.isDir ? <Folder size={15} /> : <Music size={15} />}</span>
                              <span style={{ flex: 1, color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-all' }}>{en.name}</span>
                              {en.isDir && <ChevronRight size={16} color="var(--text-muted)" />}
                            </div>
                            <button
                              onClick={() => setMovingItem({ root: browserRoot, path: browserPath, name: en.name, isDir: en.isDir })}
                              title={`Move ${en.isDir ? 'folder' : 'file'}`}
                              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'inline-flex', borderRadius: '6px' }}
                            >
                              <FolderSync size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(en.name, en.isDir)}
                              title={`Delete ${en.isDir ? 'folder' : 'file'}`}
                              style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '4px', display: 'inline-flex', borderRadius: '6px' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          ));
                        })()}
                        {browserEntries.length === 0 && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Empty folder.</div>}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'library' && showPlaylists && (() => {
            const pickerFiltered = downloadedFiles.filter(f => f.name.toLowerCase().includes(playlistPickerSearch.toLowerCase().trim()));
            const playlistQueue = activePlaylist ? activePlaylist.tracks.map(libraryQueueItem) : [];
            return (
            <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Playlists <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>build a DJ set & export to a CDJ-ready folder</span></h3>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 260px', minWidth: '220px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '0.5rem' }}>
                    <input type="text" value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder="New playlist name" className="glass-input" style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && createPlaylist()} />
                    <Button variant="primary" onClick={createPlaylist} disabled={!newPlaylistName.trim()} title="Create playlist"><FolderPlus size={16} /></Button>
                  </div>
                  <Button variant="secondary" onClick={handleImportPlaylistJson} title="Import playlist" style={{ width: '100%', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '0.45rem 0.8rem', fontSize: '0.82rem' }}>
                    <Share2 size={14} /> Import Playlist (JSON)
                  </Button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {playlists.map(p => (
                      <div
                        key={p.id}
                        onClick={() => setActivePlaylistId(p.id)}
                        onDragOver={e => { if (e.dataTransfer.types.includes('text/sidecamp-paths')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
                        onDrop={e => {
                          e.preventDefault();
                          try { addTracksToPlaylist(p.id, JSON.parse(e.dataTransfer.getData('text/sidecamp-paths'))); } catch { /* not our payload */ }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.6rem 0.8rem', borderRadius: '8px', cursor: 'pointer', background: p.id === activePlaylistId ? 'rgba(179,102,255,0.15)' : 'rgba(255,255,255,0.03)', border: `1px solid ${p.id === activePlaylistId ? 'var(--primary)' : 'var(--glass-border)'}` }}
                      >
                        <Disc3 size={15} color="var(--text-muted)" />
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.tracks.length}</span>
                        <button onClick={e => { e.stopPropagation(); deletePlaylist(p.id); }} title="Delete playlist" style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '2px', display: 'inline-flex' }}><Trash2 size={14} /></button>
                      </div>
                    ))}
                    {playlists.length === 0 && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>No playlists yet.</div>}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: '320px' }}>
                  {!activePlaylist ? (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '2rem 0' }}>Select or create a playlist to start.</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0 }}>{activePlaylist.name} <span style={{ fontSize: '0.8rem', fontWeight: 400, color: 'var(--text-muted)' }}>({activePlaylist.tracks.length} tracks)</span></h4>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {activePlaylist.tracks.length > 0 && <Button variant="primary" onClick={() => playAt(playlistQueue, 0)} style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>▶ Play</Button>}
                          <Button variant="accent" onClick={handleExportPlaylist} disabled={activePlaylist.tracks.length === 0} style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}><Download size={14} /> Export (CDJ)</Button>
                          <Button variant="secondary" onClick={handleExportPlaylistJson} style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}><Share2 size={14} /> Export Playlist (JSON)</Button>
                        </div>
                      </div>
                      {exportMsg && <div style={{ padding: '0.5rem 0.8rem', marginBottom: '1rem', background: 'rgba(102,255,153,0.08)', border: '1px solid rgba(102,255,153,0.4)', borderRadius: '8px', fontSize: '0.82rem', wordBreak: 'break-all' }}>{exportMsg}</div>}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1.5rem' }}>
                        {activePlaylist.tracks.map((t, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.5rem 0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                            <span style={{ width: '24px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'right' }}>{String(i + 1).padStart(2, '0')}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: '0.88rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                            <button onClick={() => playAt(playlistQueue, i)} title="Play" style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '3px', display: 'inline-flex' }}><Play size={15} /></button>
                            <button onClick={() => moveTrack(i, -1)} disabled={i === 0} title="Move up" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, padding: '3px', display: 'inline-flex' }}><ChevronUp size={16} /></button>
                            <button onClick={() => moveTrack(i, 1)} disabled={i === activePlaylist.tracks.length - 1} title="Move down" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: i === activePlaylist.tracks.length - 1 ? 'default' : 'pointer', opacity: i === activePlaylist.tracks.length - 1 ? 0.3 : 1, padding: '3px', display: 'inline-flex' }}><ChevronDown size={16} /></button>
                            <button onClick={() => removeTrackAt(i)} title="Remove" style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', padding: '3px', display: 'inline-flex' }}><X size={15} /></button>
                          </div>
                        ))}
                        {activePlaylist.tracks.length === 0 && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Empty — add tracks from your library below.</div>}
                      </div>

                      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '0.75rem' }}>
                          <strong style={{ fontSize: '0.9rem' }}>Add from Library</strong>
                          <input type="text" value={playlistPickerSearch} onChange={e => setPlaylistPickerSearch(e.target.value)} placeholder="Search library…" className="glass-input" style={{ flex: 1, maxWidth: '280px', padding: '0.35rem 0.7rem', fontSize: '0.82rem' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                          {pickerFiltered.map((file, i) => {
                            const basename = file.name.split(/[/\\]/).pop() || file.name;
                            const already = activePlaylist.tracks.some(t => t.path === file.path);
                            return (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.45rem 0.8rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                                <span style={{ flex: 1, minWidth: 0, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{basename}</span>
                                <Button variant="secondary" onClick={() => addTrackToActive(file)} disabled={already} style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}>{already ? '✓ Added' : '+ Add'}</Button>
                              </div>
                            );
                          })}
                          {pickerFiltered.length === 0 && <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>No library tracks. Add music first.</div>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {activeTab === 'library' && showOrganize && (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Organize <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>rename, sort & deduplicate a music folder</span></h3>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <Button variant="secondary" onClick={handleOrganizePickFolder} disabled={organizeBusy} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Folder size={16} /> {organizeRoot ? 'Change folder' : 'Pick folder'}
                </Button>
                {organizeRoot && <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{organizeRoot}</span>}
              </div>

              {organizeRoot && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <select
                    className="glass-input"
                    value={organizeMode}
                    onChange={e => { const m = e.target.value as any; setOrganizeMode(m); if (organizePlan) handleOrganizeScan(m); }}
                    disabled={organizeBusy}
                    style={{ width: 'auto', padding: '0.4rem 0.8rem' }}
                  >
                    <option value="artist">By Artist</option>
                    <option value="artist-album">By Artist / Album</option>
                    <option value="genre">By Genre</option>
                  </select>
                  <Button variant="primary" onClick={() => handleOrganizeScan()} disabled={organizeBusy}>
                    {organizeBusy ? 'Working…' : 'Scan'}
                  </Button>
                  {organizePlan && organizePlan.actions.length > 0 && (
                    <Button variant="primary" onClick={handleOrganizeApply} disabled={organizeBusy}>
                      Apply {organizePlan.actions.length} changes
                    </Button>
                  )}
                  {!genreBusy && (
                    <Button variant="secondary" onClick={handleFillGenres} disabled={organizeBusy} title="Look up missing genres — Beatport for electronic, MusicBrainz for the rest (~1.4s per track)">
                      Fill genres
                    </Button>
                  )}
                  {genreBusy && (
                    <Button variant="secondary" onClick={() => window.electronAPI.organizeFillGenresCancel()}>
                      Cancel genre lookup
                    </Button>
                  )}
                </div>
              )}

              {genreBusy && (
                <div style={{ padding: '0.6rem 0.9rem', marginBottom: '1rem', background: 'rgba(179,102,255,0.12)', border: '1px solid var(--primary)', borderRadius: '8px', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                  {genreProgress
                    ? <>Genres {genreProgress.current}/{genreProgress.total} — {genreProgress.file} → {genreProgress.genre || 'no match'}</>
                    : 'Scanning for tracks with missing genre…'}
                </div>
              )}

              {genreSummary && (
                <div style={{ padding: '0.6rem 0.9rem', marginBottom: '1rem', background: 'rgba(102,255,153,0.08)', border: '1px solid rgba(102,255,153,0.4)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  Genres{genreSummary.cancelled ? ' (cancelled)' : ''} — {genreSummary.missing} tracks missing genre, {genreSummary.found} found, {genreSummary.written} written to mp3 tags.
                </div>
              )}

              {organizeError && <div style={{ color: '#e74c3c', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{organizeError}</div>}

              {organizeResult && (
                <div style={{ padding: '0.6rem 0.9rem', marginBottom: '1rem', background: 'rgba(102,255,153,0.08)', border: '1px solid rgba(102,255,153,0.4)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  Done — {organizeResult.done} files moved.
                  {organizeResult.errors.length > 0 && (
                    <div style={{ color: '#e74c3c', marginTop: '4px' }}>
                      {organizeResult.errors.length} errors: {organizeResult.errors.slice(0, 5).join('; ')}{organizeResult.errors.length > 5 ? '…' : ''}
                    </div>
                  )}
                </div>
              )}

              {organizePlan && (
                <>
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <span>{organizePlan.stats.total} tracks</span>
                    <span>{organizePlan.stats.toMove} to move/rename</span>
                    <span>{organizePlan.stats.duplicates} duplicates</span>
                    <span>{organizePlan.stats.alreadyOk} already in place</span>
                  </div>
                  {organizePlan.actions.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Everything already organized. Nothing to do.</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '50vh', overflowY: 'auto' }}>
                    {organizePlan.actions.map((a, i) => (
                      <div key={i} style={{ padding: '0.5rem 0.9rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                        <span style={{ color: a.type === 'duplicate' ? '#e7a63c' : 'var(--text-muted)' }}>
                          {a.type === 'duplicate' ? '⧉ dup ' : '→ '}
                        </span>
                        <span style={{ wordBreak: 'break-all' }}>{a.from.slice(organizeRoot.length + 1)}</span>
                        <span style={{ color: 'var(--text-muted)' }}> → </span>
                        <span style={{ wordBreak: 'break-all', color: 'var(--text-main)' }}>{a.to.slice(organizeRoot.length + 1)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {!organizeRoot && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Pick a music folder to scan. Nothing is moved until you review the plan and click Apply.
                </div>
              )}
            </div>
          )}

          {activeTab === 'library' && (() => {
            const { rows, artists, genres, folders, libraryFiltered, libraryQueue } = lib;
            // Checkbox with shift-click range selection over the current sorted view
            const rowCheck = (i: number, shift: boolean) => {
              const p = libraryFiltered[i].file.path;
              const willCheck = !selectedFiles.includes(p);
              if (shift && lastCheckRef.current !== null && lastCheckRef.current < libraryFiltered.length) {
                const [a, b] = [Math.min(lastCheckRef.current, i), Math.max(lastCheckRef.current, i)];
                const range = libraryFiltered.slice(a, b + 1).filter(r => !r.file.magnetUri).map(r => r.file.path);
                setSelectedFiles(prev => willCheck ? [...new Set([...prev, ...range])] : prev.filter(x => !range.includes(x)));
              } else {
                setSelectedFiles(prev => willCheck ? [...prev, p] : prev.filter(x => x !== p));
              }
              lastCheckRef.current = i;
            };
            const coll = (type: 'artist' | 'genre' | 'folder', entries: [string, number][]) => entries.map(([name, n]) => (
              <div
                key={name}
                className={`coll-item ${libFilter.type === type && libFilter.value === name ? 'active' : ''}`}
                onClick={() => setLibFilter(f => f.type === type && f.value === name ? { type: 'all', value: '' } : { type, value: name })}
              >
                <span className="coll-name">{name}</span><span className="coll-count">{n}</span>
              </div>
            ));
            const th = (id: string, label: string, cls?: string) => (
              <th className={cls} onClick={() => toggleSort(id)}>
                {label}{sortCol === id ? <span className="sort-arrow">{sortDir === 1 ? '▲' : '▼'}</span> : null}
              </th>
            );
            const editableCell = (r: typeof rows[0], field: 'title' | 'artist' | 'album' | 'genre', cls?: string) => (
              cellEdit && cellEdit.path === r.file.path && cellEdit.field === field ? (
                <td className={cls}>
                  <input
                    className="cell-edit-input"
                    autoFocus
                    value={cellEdit.value}
                    onChange={e => setCellEdit(c => (c ? { ...c, value: e.target.value } : c))}
                    onKeyDown={e => { if (e.key === 'Enter') saveCellEdit(); if (e.key === 'Escape') setCellEdit(null); }}
                    onBlur={() => setCellEdit(null)}
                    onDoubleClick={e => e.stopPropagation()}
                  />
                </td>
              ) : (
                <td
                  className={cls}
                  title={`${r.file.name} — double-click to edit ${field}`}
                  onDoubleClick={e => { e.stopPropagation(); setCellEdit({ path: r.file.path, field, value: r[field] || '' }); }}
                >{r[field]}</td>
              )
            );
            return (
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, whiteSpace: 'nowrap' }}>Library <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>{librarySearch.trim() ? `${libraryFiltered.length} / ${downloadedFiles.length}` : downloadedFiles.length} tracks</span></h3>
                <input type="text" value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} placeholder="Search tracks…" className="glass-input" style={{ flex: 1, minWidth: '160px', maxWidth: '360px', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  {selectedFiles.length > 0 && (
                    <>
                      <Button variant="accent" onClick={handleSeedSelectedClick} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Magnet size={14} /> Seed ({selectedFiles.length})</Button>
                      <Button variant="accent" onClick={handleUploadSelected} disabled={uploadingFilePath !== null} title="Upload selection to TuneCamp" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Cloud size={14} /> Upload ({selectedFiles.length})</Button>
                      <Button variant="secondary" onClick={addSelectedToPlaylist} title="Add selection to the active playlist" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Plus size={14} /> Playlist</Button>
                      <Button variant="danger" onClick={handleDeleteSelected} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Trash2 size={14} /> Delete ({selectedFiles.length})</Button>
                      <Button variant="secondary" onClick={() => setSelectedFiles([])} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Clear</Button>
                    </>
                  )}
                  {analyzing ? (
                    <Button variant="secondary" onClick={() => { analyzeCancelRef.current = true; }} title="Stop analysis" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>⏹ {analyzing.done}/{analyzing.total}</Button>
                  ) : (
                    <Button variant="secondary" onClick={analyzeTracks} title="Detect BPM + waveform for tracks missing them (writes mp3 TBPM tag)" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Headphones size={14} /> Analyze</Button>
                  )}
                  {libraryFiltered.length > 0 && (
                    <Button variant="primary" onClick={() => playAt(libraryQueue, 0)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>▶ Play All</Button>
                  )}
                  <Button variant={showPlaylists ? 'accent' : 'secondary'} onClick={() => togglePanel('playlists')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Disc3 size={14} /> Playlists</Button>
                  <Button variant={showOrganize ? 'accent' : 'secondary'} onClick={() => togglePanel('organize')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}><Folder size={14} /> Organize</Button>
                  <Button variant="secondary" onClick={loadDownloadedFiles} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Refresh</Button>
                  <Button variant={showLibraryTable ? 'secondary' : 'accent'} onClick={() => setShowLibraryTable(v => !v)}
                    title={showLibraryTable ? 'Hide library table' : 'Show library table'} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {showLibraryTable ? <EyeOff size={14} /> : <Eye size={14} />}
                  </Button>
                </div>
              </div>
              {showLibraryTable && <div className="library-body">
                <div className="collection-pane">
                  <div className={`coll-item coll-all ${libFilter.type === 'all' ? 'active' : ''}`} onClick={() => setLibFilter({ type: 'all', value: '' })}>
                    <span className="coll-name">All Tracks</span><span className="coll-count">{rows.length}</span>
                  </div>
                  <div className="coll-header">Artists</div>
                  {coll('artist', artists)}
                  <div className="coll-header">Genres</div>
                  {coll('genre', genres)}
                  <div className="coll-header">Folders</div>
                  {coll('folder', folders)}
                </div>
              <div className="track-table-wrap">
                <table className="track-table">
                  <thead>
                    <tr>
                      <th className="col-check"></th>
                      <th className="col-num">#</th>
                      <th className="col-wave">Wave</th>
                      {th('title', 'Title', 'col-title')}
                      {th('artist', 'Artist')}
                      {th('album', 'Album')}
                      {th('genre', 'Genre')}
                      {th('bpm', 'BPM', 'col-bpm col-right')}
                      {th('key', 'Key', 'col-key')}
                      {th('time', 'Time', 'col-time col-right')}
                      {th('year', 'Year', 'col-year col-right')}
                      {th('kbps', 'kbps', 'col-kbps col-right')}
                      {th('size', 'Size', 'col-size col-right')}
                      {th('added', 'Added', 'col-added')}
                      <th className="col-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {libraryFiltered.map((r, i) => {
                      const file = r.file;
                      const isSeeding = !!file.magnetUri;
                      const isCurrent = currentPlayback?.path === file.path;
                      return (
                        <tr
                          key={file.path}
                          className={isCurrent ? 'playing' : ''}
                          onDoubleClick={() => playAt(libraryQueue, i)}
                          draggable
                          onDragStart={e => {
                            const paths = selectedSet.has(file.path) ? selectedFiles : [file.path];
                            e.dataTransfer.setData('text/sidecamp-paths', JSON.stringify(paths));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                        >
                          <td className="col-check">
                            {isSeeding ? (
                              <span className="seed-check" title="Already seeding">✓</span>
                            ) : (
                              <input type="checkbox" checked={selectedSet.has(file.path)} onChange={() => {}} onClick={e => { e.stopPropagation(); rowCheck(i, e.shiftKey); }} />
                            )}
                          </td>
                          <td className="col-num">{isCurrent ? '▶' : i + 1}</td>
                          <td
                            className="col-wave"
                            title={isCurrent ? 'Click to seek' : r.peaks?.length ? 'Double-click row to play' : 'Run Analyze to render the waveform'}
                            onClick={e => {
                              if (!isCurrent || !audioRef.current || !duration) return;
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
                            }}
                          >
                            <Waveform peaks={r.peaks} active={isCurrent} progress={isCurrent && duration > 0 ? Math.round((currentTime / duration) * 100) : 0} />
                          </td>
                          {editableCell(r, 'title', 'col-title')}
                          {editableCell(r, 'artist', 'cell-ellipsis')}
                          {editableCell(r, 'album', 'cell-ellipsis cell-muted')}
                          {editableCell(r, 'genre', 'cell-ellipsis cell-muted')}
                          <td className="col-right cell-mono">{r.bpm ?? ''}</td>
                          <td className="cell-mono">{r.key}</td>
                          <td className="col-right cell-mono">{r.duration ? formatTime(r.duration) : ''}</td>
                          <td className="col-right cell-mono cell-muted">{r.year ?? ''}</td>
                          <td className="col-right cell-mono cell-muted">{r.kbps || ''}</td>
                          <td className="col-right cell-mono cell-muted">{(file.size / 1024 / 1024).toFixed(1)}M</td>
                          <td className="cell-mono cell-muted">{new Date(file.ctime).toLocaleDateString()}</td>
                          <td className="col-actions">
                            <button title="Play" onClick={() => playAt(libraryQueue, i)}><Play size={13} /></button>
                            <button title="Show in Shared Files" onClick={() => revealInSharedFiles(file.path)}><Folder size={13} /></button>
                            <button title="Edit tags" onClick={() => handleEditTags(file)}><Tag size={13} /></button>
                            <button title={uploadingFilePath === file.path ? 'Uploading…' : 'Upload to TuneCamp'} disabled={uploadingFilePath !== null} onClick={() => handleUploadFile(file.path)}><Cloud size={13} /></button>
                            {file.magnetUri ? (
                              <button title="Copy magnet link" className="act-ok" onClick={() => { navigator.clipboard.writeText(file.magnetUri); alert('Magnet URI copied to clipboard!'); }}><Magnet size={13} /></button>
                            ) : (
                              <button title="Seed as torrent" onClick={() => handleSeedFile(file.path)}><Magnet size={13} /></button>
                            )}
                            <button title="Delete" className="act-danger" disabled={uploadingFilePath === file.path} onClick={() => handleDeleteFile(file.path)}><Trash2 size={13} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {libraryFiltered.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{librarySearch.trim() || libFilter.type !== 'all' ? 'No tracks match your filter.' : 'No music files in library.'}</div>
                )}
              </div>
              </div>}

              <div className="terminal-log" style={{ marginTop: '2rem' }}>
                <div className="terminal-header">Library Activity Logs</div>
                <div className="terminal-body" style={{ height: '180px' }}>
                  {libraryLogs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                  {libraryLogs.length === 0 && <div className="log-line dim">No library activity logs...</div>}
                </div>
              </div>
            </div>
            );
          })()}
          {activeTab === 'settings' && (
            <>
              <div className="settings-section" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Connection to TuneCamp</h3>
                <div className="form-group">
                  <label>Server URL</label>
                  <input 
                    type="text" 
                    value={server} 
                    onChange={e => setServer(e.target.value)} 
                    placeholder="https://my-tunecamp.com" 
                    className="glass-input"
                  />
                </div>
                <div className="form-group">
                  <label>API Token / JWT</label>
                  <input 
                    type="password" 
                    value={token} 
                    onChange={e => setToken(e.target.value)} 
                    placeholder="Enter JWT token" 
                    className="glass-input"
                  />
                </div>
              </div>

              <div className="settings-section" style={{ marginBottom: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Soulseek Credentials</h3>
                <div className="form-group">
                  <label>Soulseek Username</label>
                  <input 
                    type="text" 
                    value={slskUser} 
                    onChange={e => setSlskUser(e.target.value)} 
                    placeholder="Your Soulseek username" 
                    className="glass-input"
                  />
                </div>
                <div className="form-group">
                  <label>Soulseek Password</label>
                  <input 
                    type="password" 
                    value={slskPass} 
                    onChange={e => setSlskPass(e.target.value)} 
                    placeholder="Your Soulseek password" 
                    className="glass-input"
                  />
                </div>
              </div>

              <div className="settings-section" style={{ marginBottom: '2rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Local Shared Folders (Peer Node)</h3>
                <div className="form-group">
                  <label>Music Folders to Share (comma-separated)</label>
                  <input 
                    type="text" 
                    value={folder} 
                    onChange={e => setFolder(e.target.value)} 
                    placeholder="Example: D:\Music, C:\Downloads" 
                    className="glass-input"
                  />
                </div>
              </div>

              <div className="btn-group" style={{ alignItems: 'center' }}>
                <Button variant="primary" onClick={handleSaveSettings}>
                  Save Configuration
                </Button>
                {settingsSaved && <span style={{ color: 'var(--accent)', marginLeft: '1rem', fontWeight: 600 }}>✓ Configuration saved!</span>}
              </div>

              {/* About */}
              <div style={{ maxWidth: '720px', marginTop: '2.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem' }}>
                <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <img src={logo} alt="Sidecamp" style={{ width: '64px', height: '64px', borderRadius: '12px' }} />
                    <div>
                      <h2 style={{ margin: 0, fontFamily: 'var(--font-headings)', fontSize: '1.8rem' }}>Sidecamp</h2>
                      <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Powered by <span style={{ color: 'var(--primary)', fontWeight: 600 }}>TuneCamp</span></p>
                    </div>
                  </div>
                  <p style={{ lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    <strong style={{ color: 'var(--text-main)' }}>Sidecamp</strong> is a desktop companion app for <strong style={{ color: 'var(--primary)' }}>TuneCamp</strong> — an independent music platform built for artists and listeners who believe in open, decentralized music distribution.
                  </p>
                  <p style={{ lineHeight: 1.7, color: 'var(--text-muted)', marginBottom: 0 }}>
                    With Sidecamp you can discover and download music from the TuneCamp network and from peer-to-peer sources (Soulseek, BitTorrent, YouTube), manage your local library, edit track metadata, and share your collection back to the network as a peer node — all from one place.
                  </p>
                </div>

                <div className="glass-card">
                  <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1rem' }}>Tech stack</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {['Electron', 'React 19', 'TypeScript', 'Vite', 'Soulseek', 'WebTorrent', 'yt-dlp', 'node-id3', 'TuneCamp API'].map(t => (
                      <span key={t} style={{ padding: '4px 10px', background: 'rgba(179,102,255,0.12)', border: '1px solid rgba(179,102,255,0.25)', borderRadius: '20px', fontSize: '0.8rem', color: 'var(--primary)' }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'network' && (
            <div className="glass-card network-card" style={{ display: 'flex', gap: '2.5rem', minHeight: '450px' }}>
              {/* Left pane: Peers list */}
              <div className="network-peers-pane" style={{ flex: '1', borderRight: '1px solid var(--glass-border)', paddingRight: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-headings)' }}>Connected Peers</h3>
                  <Button variant="secondary" onClick={loadNetworkPeers} disabled={isLoadingPeers} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {isLoadingPeers ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </div>
                {isLoadingPeers ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <span className="spinner" style={{ display: 'inline-block', width: '20px', height: '20px', border: '3px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '10px' }}></span>
                    <div style={{ fontSize: '0.9rem' }}>Loading peers...</div>
                  </div>
                ) : networkPeers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No peers online.</div>
                ) : (
                  <div className="peers-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {networkPeers.map((p) => (
                      <div 
                        key={p.id} 
                        className={`peer-row ${selectedPeer?.id === p.id ? 'active' : ''}`}
                        onClick={() => selectPeer(p)}
                        style={{
                          padding: '0.9rem 1.2rem',
                          background: selectedPeer?.id === p.id ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.15)',
                          border: selectedPeer?.id === p.id ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span style={{ fontWeight: 600, color: selectedPeer?.id === p.id ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.95rem' }}>
                          {p.id === 'server' ? <Cloud size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} /> : <User size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />}
                          {p.username || 'Unknown'}
                          {p.origin && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: 'var(--primary)', background: 'rgba(var(--primary-rgb), 0.15)', padding: '2px 6px', borderRadius: '4px', verticalAlign: 'middle', border: '1px solid rgba(var(--primary-rgb), 0.3)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '100px', display: 'inline-block' }}>{new URL(p.origin).hostname}</span>}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 8px', borderRadius: '12px' }}>{p.trackCount || 0} tracks</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right pane: Selected peer tracks */}
              <div className="network-tracks-pane" style={{ flex: '2' }}>
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.15rem', fontFamily: 'var(--font-headings)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  {selectedPeer ? `Tracks shared by ${selectedPeer.username}` : 'Browse Peer Tracks'}
                </h3>
                {isLoadingTracks ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                    <span className="spinner" style={{ display: 'inline-block', width: '20px', height: '20px', border: '3px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '10px' }}></span>
                    <div style={{ fontSize: '0.9rem' }}>Loading tracks...</div>
                  </div>
                ) : !selectedPeer ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>Select a peer from the list on the left to browse their tracks.</div>
                ) : peerTracks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No tracks shared by this peer.</div>
                ) : (() => {
                  const q = networkQuery.trim().toLowerCase();
                  const filtered = q
                    ? peerTracks.filter(t => `${t.title || ''} ${t.artist || ''} ${t.album || ''}`.toLowerCase().includes(q))
                    : peerTracks;
                  return (
                  <>
                    <input
                      type="text"
                      value={networkQuery}
                      onChange={e => setNetworkQuery(e.target.value)}
                      placeholder={`Filter ${peerTracks.length} tracks by title, artist, album...`}
                      className="glass-input"
                      style={{ marginBottom: '1rem' }}
                    />
                  <div className="track-table-wrap" style={{ maxHeight: '420px' }}>
                    <table className="track-table">
                      <thead>
                        <tr>
                          <th className="col-num">#</th>
                          <th>Title</th>
                          <th>Artist</th>
                          <th>Album</th>
                          <th className="col-key">Fmt</th>
                          <th className="col-actions" style={{ width: '64px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((t, i) => {
                          const isCurrent = currentPlayback?.name === `${t.artist} - ${t.title}`;
                          return (
                            <tr key={t.id} className={isCurrent ? 'playing' : ''} onDoubleClick={() => playNetworkTrack(selectedPeer, t)}>
                              <td className="col-num">{isCurrent ? '▶' : i + 1}</td>
                              <td className="cell-ellipsis" style={{ fontWeight: 500 }} title={t.title}>{t.title || 'Unknown Title'}</td>
                              <td className="cell-ellipsis">{t.artist || 'Unknown Artist'}</td>
                              <td className="cell-ellipsis cell-muted">{t.album || ''}</td>
                              <td className="cell-mono cell-muted">{t.format}</td>
                              <td className="col-actions">
                                <button title="Play" onClick={() => playNetworkTrack(selectedPeer, t)}><Play size={13} /></button>
                                <button title={downloadingTrackId === t.id ? 'Downloading…' : 'Download'} disabled={downloadingTrackId === t.id} onClick={() => handleDownloadPeerTrack(t)}><Download size={13} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filtered.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No tracks match "{networkQuery}".</div>
                    )}
                  </div>
                  </>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === 'peer' && (
            <div className="glass-card peer-card">
              <div className="peer-controls">
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Currently shared folders:</label>
                  <div style={{ padding: '0.8rem 1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginTop: '0.5rem' }}>
                    {validFolders.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                        <span style={{ display: 'inline-flex' }}><Folder size={15} /></span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-main)' }}>{f}</span>
                      </div>
                    ))}
                    {validFolders.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        No folders configured. Configure them in the "Configuration" tab.
                      </div>
                    )}
                  </div>
                </div>
                <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                  <Button variant="primary" onClick={handleStartPeer} disabled={peerStatus === 'online' || validFolders.length === 0}>
                    Start Sharing
                  </Button>
                  <Button variant="danger" onClick={handleStopPeer} disabled={peerStatus === 'offline'}>
                    Stop
                  </Button>
                </div>
              </div>
              
              <div className="terminal-log">
                <div className="terminal-header">Terminal Logs</div>
                <div className="terminal-body">
                  {logs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                  {logs.length === 0 && <div className="log-line dim">No logs available...</div>}
                </div>
              </div>

              <div className="terminal-log" style={{ marginTop: '1rem' }}>
                <div className="terminal-header">Peer Chat</div>
                <div className="terminal-body" style={{ minHeight: '120px', maxHeight: '260px', overflowY: 'auto' }}>
                  {chatMessages.map((m, i) => (
                    <div key={i} className="log-line" style={{ color: m.self ? 'var(--accent, #6ee7ff)' : 'var(--text-main)' }}>
                      <span style={{ opacity: 0.6 }}>[{new Date(m.ts).toLocaleTimeString()}]</span>{' '}
                      <strong>{m.from}:</strong> {m.text}
                    </div>
                  ))}
                  {chatMessages.length === 0 && <div className="log-line dim">No messages. Send one to a peer by username.</div>}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '0.6rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={chatTo}
                    onChange={e => setChatTo(e.target.value)}
                    placeholder="Peer username"
                    className="glass-input"
                    style={{ flex: '0 0 160px' }}
                    disabled={peerStatus !== 'online'}
                  />
                  <input
                    type="text"
                    value={chatText}
                    onChange={e => setChatText(e.target.value)}
                    placeholder={peerStatus === 'online' ? 'Message...' : 'Start Sharing to enable chat'}
                    className="glass-input"
                    style={{ flex: 1, minWidth: '160px' }}
                    disabled={peerStatus !== 'online'}
                    onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  />
                  <Button variant="primary" onClick={handleSendChat} disabled={peerStatus !== 'online' || !chatTo.trim() || !chatText.trim()}>
                    Send
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="glass-card download-card">
              {/* Downloader Sub-tabs */}
              <div className="downloader-subtabs">
                <button 
                  className={`subtab-btn ${downloadSource === 'soulseek' ? 'active' : ''}`} 
                  onClick={() => setDownloadSource('soulseek')}
                >
                  Search Platforms (Soulseek / Web)
                </button>
                <button 
                  className={`subtab-btn ${downloadSource === 'direct' ? 'active' : ''}`} 
                  onClick={() => setDownloadSource('direct')}
                >
                  Direct Link (Torrent / Web URL)
                </button>
              </div>

              {downloadSource === 'soulseek' && (
                <>
                  <div className="platform-selector" style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', padding: '0.2rem 0.5rem', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input 
                        type="radio" 
                        name="searchSource" 
                        value="all" 
                        checked={searchSource === 'all'} 
                        onChange={() => { setSearchSource('all'); setSearchResults([]); }} 
                      />
                      All Platforms
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input 
                        type="radio" 
                        name="searchSource" 
                        value="soulseek" 
                        checked={searchSource === 'soulseek'} 
                        onChange={() => { setSearchSource('soulseek'); setSearchResults([]); }} 
                      />
                      Soulseek
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input 
                        type="radio" 
                        name="searchSource" 
                        value="soundcloud" 
                        checked={searchSource === 'soundcloud'} 
                        onChange={() => { setSearchSource('soundcloud'); setSearchResults([]); }} 
                      />
                      SoundCloud
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input 
                        type="radio" 
                        name="searchSource" 
                        value="bandcamp" 
                        checked={searchSource === 'bandcamp'} 
                        onChange={() => { setSearchSource('bandcamp'); setSearchResults([]); }} 
                      />
                      Bandcamp
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input 
                        type="radio" 
                        name="searchSource" 
                        value="torrent" 
                        checked={searchSource === 'torrent'} 
                        onChange={() => { setSearchSource('torrent'); setSearchResults([]); }} 
                      />
                      Torrent
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input
                        type="radio"
                        name="searchSource"
                        value="network"
                        checked={searchSource === 'network'}
                        onChange={() => { setSearchSource('network'); setSearchResults([]); }}
                      />
                      Network
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input
                        type="radio"
                        name="searchSource"
                        value="archive"
                        checked={searchSource === 'archive'}
                        onChange={() => { setSearchSource('archive'); setSearchResults([]); }}
                      />
                      Archive.org
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      <input
                        type="radio"
                        name="searchSource"
                        value="youtube"
                        checked={searchSource === 'youtube'}
                        onChange={() => { setSearchSource('youtube'); setSearchResults([]); }}
                      />
                      YouTube
                    </label>
                  </div>

                  <div className="search-bar">
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      placeholder={`Search on ${searchSource === 'soulseek' ? 'Soulseek' : searchSource === 'soundcloud' ? 'SoundCloud' : searchSource === 'bandcamp' ? 'Bandcamp' : searchSource === 'network' ? 'TuneCamp Network' : searchSource === 'archive' ? 'Archive.org' : searchSource === 'youtube' ? 'YouTube' : 'Torrent (PirateBay)'}...`}
                      className="glass-input search-input"
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <Button variant="primary" onClick={handleSearch}>Search</Button>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="no-results">No results.</div>
                  ) : (
                    <div className="track-table-wrap" style={{ maxHeight: '55vh' }}>
                      <table className="track-table">
                        <thead>
                          <tr>
                            <th className="col-num">#</th>
                            <th>Title</th>
                            <th className="col-size col-right">Size</th>
                            <th className="col-kbps col-right">kbps</th>
                            <th style={{ width: '220px' }}>Source / User</th>
                            <th className="col-actions" style={{ width: '40px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map((res, i) => {
                            const busy = activeDownloads.some(d => d.id === res.id && d.status === 'downloading');
                            const name = res.title || (res.file && res.file.split(/[/\\]/).pop()) || 'Unknown Track';
                            return (
                              <tr key={i} onDoubleClick={() => !busy && handleDownload(res)}>
                                <td className="col-num">{i + 1}</td>
                                <td className="cell-ellipsis" style={{ fontWeight: 500 }} title={res.file || name}>{name}</td>
                                <td className="col-right cell-mono cell-muted">{res.size ? (res.size / 1024 / 1024).toFixed(1) + 'M' : ''}</td>
                                <td className="col-right cell-mono cell-muted">{res.bitrate || ''}</td>
                                <td className="cell-ellipsis cell-muted">{res.source === 'soulseek' || res.source === 'peer' ? `${res.source} • ${res.user}` : (res.user || res.source)}</td>
                                <td className="col-actions">
                                  <button title={busy ? 'Downloading…' : 'Download'} disabled={busy} onClick={() => handleDownload(res)}><Download size={13} /></button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {downloadSource === 'direct' && (
                <div className="direct-download-container">
                  <div className="form-group">
                    <label>Paste a Magnet Link (Torrent) or Web URL (SoundCloud, Bandcamp, YouTube, etc.)</label>
                    <div className="search-bar">
                      <input 
                        type="text" 
                        value={directUrl} 
                        onChange={e => setDirectUrl(e.target.value)} 
                        placeholder="magnet:?xt=urn:btih:...  or  https://soundcloud.com/..." 
                        className="glass-input search-input"
                        disabled={isDownloading}
                      />
                      <Button 
                        variant="primary" 
                        onClick={handleDirectDownload}
                        disabled={isDownloading || !directUrl}
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </Button>
                    </div>
                  </div>

                  {/* Progress Display */}
                  {dlProgress && (
                    <div className="progress-container">
                      <div className="progress-info">
                        <span>Downloading: {dlProgress.id ? `Torrent (${dlProgress.id.substring(0, 8)})` : 'In progress'}</span>
                        <span className="progress-speed">
                          {dlProgress.speed ? `${(dlProgress.speed / 1024 / 1024).toFixed(2)} MB/s` : ''}
                        </span>
                      </div>
                      <div className="progress-bar-bg">
                        <div 
                          className="progress-bar-fill" 
                          style={{ width: `${((dlProgress.progress || 0) * 100).toFixed(1)}%` }}
                        ></div>
                      </div>
                      <div className="progress-info">
                        <span>{((dlProgress.progress || 0) * 100).toFixed(1)}%</span>
                        <span>
                          {dlProgress.downloaded ? `${(dlProgress.downloaded / 1024 / 1024).toFixed(2)} MB` : ''} 
                          {dlProgress.total ? ` / ${(dlProgress.total / 1024 / 1024).toFixed(2)} MB` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {/* Logs di Download (visibili sia per Soulseek che per Link Diretto) */}
              <div className="terminal-log" style={{ marginTop: '2rem' }}>
                <div className="terminal-header">Download Logs</div>
                <div className="terminal-body" style={{ height: '220px' }}>
                  {dlLogs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                  {dlLogs.length === 0 && <div className="log-line dim">No active download logs...</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'download' && (
            <div className="glass-card files-card">
              
              {/* Transfer Queue Section */}
              <div className="files-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Active & Failed Transfers</h3>
                <Button variant="secondary" onClick={purgeFailedDownloads}>Purge Failed</Button>
              </div>

              <div className="files-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '5px', marginBottom: '2rem' }}>
                {activeDownloads.map((dl) => (
                  <div key={dl.id} className="result-item" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div className="result-info" style={{ flex: 1 }}>
                      <div className="result-filename" style={{ fontWeight: 600, color: dl.status === 'failed' ? '#e74c3c' : 'var(--text-main)', fontSize: '0.95rem', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {dl.source === 'soulseek' ? <Music size={16} /> : dl.source === 'torrent' ? <Magnet size={16} /> : dl.source === 'server' ? <Cloud size={16} /> : <Globe size={16} />}
                        {dl.name}
                        {dl.status === 'failed' && <span style={{ fontSize: '0.75rem', background: 'rgba(231, 76, 60, 0.2)', color: '#e74c3c', padding: '2px 6px', borderRadius: '4px' }}>FAILED</span>}
                        {dl.status === 'completed' && <span style={{ fontSize: '0.75rem', background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71', padding: '2px 6px', borderRadius: '4px' }}>COMPLETED</span>}
                      </div>
                      <div className="result-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>Status: {dl.status === 'seeding' ? 'Seeding' : dl.status === 'completed' ? 'Completed' : dl.status === 'failed' ? 'Failed' : 'Downloading'}</span>
                        {dl.speed && <span>• {(dl.speed / 1024 / 1024).toFixed(1)} MB/s</span>}
                        {dl.progress !== undefined && <span>• {(dl.progress * 100).toFixed(1)}%</span>}
                      </div>
                      {dl.progress !== undefined && dl.status === 'downloading' && (
                        <div className="progress-bar-bg" style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden', marginTop: '8px' }}>
                          <div className="progress-bar-fill" style={{ width: `${(dl.progress * 100).toFixed(0)}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px' }}></div>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {dl.status === 'seeding' && (
                        <Button variant="secondary" onClick={() => handleStopTorrent(dl.infoHash || dl.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Stop Seeding</Button>
                      )}
                      {(dl.status === 'failed' || dl.status === 'completed') && (
                        <Button variant="secondary" onClick={() => clearDownloadItem(dl.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Clear</Button>
                      )}
                    </div>
                  </div>
                ))}

                {activeDownloads.length === 0 && (
                  <div className="no-results" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No active or failed transfers.
                  </div>
                )}
              </div>

            </div>
          )}

        {/* Audio Player Bar — integrated footer of main-content, not a floating overlay */}
        {currentPlayback && (
          <div className="audio-player-bar">
            <div className="player-info">
              <span className="player-track-icon"><Music size={18} /></span>
              <div className="player-track-details">
                <span className="player-track-title">{currentPlayback.name}</span>
                <span className="player-track-path">{queue.length > 1 ? `${queueIndex + 1}/${queue.length} — ` : ''}{currentPlayback.path}</span>
              </div>
            </div>

            <div className="player-controls-center">
              <div className="player-buttons">
                {queue.length > 1 && (
                  <button className="player-btn" onClick={playPrev} disabled={queueIndex <= 0} title="Previous" style={{ opacity: queueIndex <= 0 ? 0.4 : 1 }}>
                    <SkipBack size={14} />
                  </button>
                )}
                <button className="player-btn toggle-play" onClick={togglePlay}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
                </button>
                {queue.length > 1 && (
                  <button className="player-btn" onClick={playNext} disabled={queueIndex + 1 >= queue.length} title="Next" style={{ opacity: queueIndex + 1 >= queue.length ? 0.4 : 1 }}>
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
                  onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ } setIsSeeking(true); }}
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
              <span className="volume-icon"><Volume2 size={14} /></span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="volume-slider"
              />
              <button className="player-btn stop-play" onClick={stopPlayback} title="Close Player">
                <X size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onError={() => {
          const el = audioRef.current;
          if (!el || !el.src) return;
          // Remote/network streams occasionally fail to load (transient blip) — retry
          // once per track before giving up. Local media:// files don't hit this.
          const retry = streamRetryRef.current;
          if (retry.src !== el.src) { retry.src = el.src; retry.count = 0; }
          if (retry.count >= 1) { console.error('Playback failed after retry:', el.error); return; }
          retry.count++;
          el.load();
          el.play().catch(e => { if (e.name !== 'AbortError') console.error('Playback failed:', e); });
        }}
        onTimeUpdate={() => {
          if (!audioRef.current || isSeeking) return;
          const t = audioRef.current.currentTime;
          // whole-second granularity: skips ~3 of 4 timeupdate re-renders of the whole
          // app; every readout is second- or percent-based so nothing visible changes
          // (the big scrolling wave reads currentTime directly via rAF, not this state)
          setCurrentTime(prev => (Math.floor(prev) === Math.floor(t) ? prev : t));
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
        <div className="modal-overlay" onClick={() => setMetadataModalFile(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1.2rem', fontSize: '1.25rem' }}>Upload Track to TuneCamp</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
              File: <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{metadataModalFile.name}</span>
            </p>
            <div className="form-group">
              <label>Track Title</label>
              <input type="text" value={metadataTitle} onChange={e => setMetadataTitle(e.target.value)} className="glass-input" />
            </div>
            <div className="form-group">
              <label>Artist Name</label>
              <input type="text" value={metadataArtist} onChange={e => setMetadataArtist(e.target.value)} className="glass-input" />
            </div>
            <div className="form-group">
              <label>Album (Optional)</label>
              <input type="text" value={metadataAlbum} onChange={e => setMetadataAlbum(e.target.value)} className="glass-input" />
            </div>
            <div className="btn-group" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setMetadataModalFile(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmUpload}>Upload</Button>
            </div>
          </div>
        </div>
      )}

      {/* Album Seeding Modal */}
      {albumSeedModalOpen && (
        <div className="modal-overlay" onClick={() => setAlbumSeedModalOpen(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1.2rem', fontSize: '1.25rem' }}>Seed Selected Tracks as Album</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              You have selected <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedFiles.length}</span> tracks to seed together.
            </p>
            <div className="form-group">
              <label>Album / Torrent Name</label>
              <input type="text" value={albumSeedName} onChange={e => setAlbumSeedName(e.target.value)} className="glass-input" placeholder="Enter album or torrent name" />
            </div>
            <div className="btn-group" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setAlbumSeedModalOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={confirmSeedSelected}>Start Seeding</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tags Modal */}
      {editTagsFile && (
        <div className="modal-overlay" onClick={() => setEditTagsFile(null)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1.2rem', fontSize: '1.25rem' }}>Edit File Tags</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', wordBreak: 'break-all' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{editTagsFile.name.split(/[/\\]/).pop()}</span>
            </p>
            <div className="form-group">
              <label>Track Title</label>
              <input type="text" value={editTagsData.title} onChange={e => setEditTagsData(prev => ({ ...prev, title: e.target.value }))} className="glass-input" />
            </div>
            <div className="form-group">
              <label>Artist Name</label>
              <input type="text" value={editTagsData.artist} onChange={e => setEditTagsData(prev => ({ ...prev, artist: e.target.value }))} className="glass-input" />
            </div>
            <div className="form-group">
              <label>Album</label>
              <input type="text" value={editTagsData.album} onChange={e => setEditTagsData(prev => ({ ...prev, album: e.target.value }))} className="glass-input" />
            </div>
            <div className="form-group">
              <label>File Name</label>
              <input type="text" value={editTagsData.filename} onChange={e => setEditTagsData(prev => ({ ...prev, filename: e.target.value }))} className="glass-input" />
            </div>
            <div className="btn-group" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setEditTagsFile(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmEditTags}>Save Tags</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
