import { useState, useEffect, useRef } from 'react';
import { 
  Radio, Globe, Download, FolderSync, Settings, 
  Play, Pause, X, Volume2, Music, Magnet, Cloud 
} from 'lucide-react';
import './index.css';
import logo from './assets/logo.png';

// Declare global for TypeScript
declare global {
  interface Window {
    electronAPI: any;
  }
}

function App() {
  const [server, setServer] = useState('');
  const [token, setToken] = useState('');
  const [folder, setFolder] = useState('');
  const [peerStatus, setPeerStatus] = useState('offline');
  const [logs, setLogs] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('peer');

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

  // Edit Tags Modal States
  const [editTagsFile, setEditTagsFile] = useState<{ name: string, path: string } | null>(null);
  const [editTagsData, setEditTagsData] = useState({ title: '', artist: '', album: '' });

  // Pre-Upload Metadata Editor States
  const [metadataModalFile, setMetadataModalFile] = useState<{ name: string, path: string } | null>(null);
  const [metadataTitle, setMetadataTitle] = useState('');
  const [metadataArtist, setMetadataArtist] = useState('Sidecamp');
  const [metadataAlbum, setMetadataAlbum] = useState('');
  
  // Auto-Upload Watcher States
  const [autoUpload, _setAutoUpload] = useState(() => {
    return localStorage.getItem('auto_upload') === 'true';
  });

  useEffect(() => {
    // Listen to Peer Daemon logs
    window.electronAPI.onPeerLog((msg: string) => {
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
    });

    window.electronAPI.onPeerStatus((status: string) => {
      setPeerStatus(status);
    });

    // Listen to download logs and progress
    window.electronAPI.onDownloadLog((msg: string) => {
      setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-50));
    });

    window.electronAPI.onDownloadProgress((data: any) => {
      setDlProgress(data);
      
      setActiveDownloads(prev => {
        const index = prev.findIndex(d => d.id === data.id);
        if (index > -1) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
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
    const savedSlskPass = localStorage.getItem('slsk_pass') || '';
    setSlskUser(savedSlskUser);
    setSlskPass(savedSlskPass);

    if (savedSlskUser && savedSlskPass) {
      window.electronAPI.slskConnect(savedSlskUser, savedSlskPass)
        .then((connected: boolean) => {
          if (connected) {
            setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Auto-connected to Soulseek.`]);
          } else {
            setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ Soulseek auto-connection failed.`]);
          }
        });
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'files' || activeTab === 'library') {
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
        const res = await window.electronAPI.getPeerTracks(server, token, peer.id);
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
          track.title
        );
      }
      setDlLogs(prev => [...prev, `${logPrefix} ✅ Download completed! Saved to: ${filePath}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'completed' } : d));
      loadDownloadedFiles();
      
      if (autoUpload && filePath) {
        handleUploadFileAuto(filePath);
      }
    } catch (e: any) {
      setDlLogs(prev => [...prev, `${logPrefix} ❌ Error during download: ${e.message || e}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'failed' } : d));
    } finally {
      setDownloadingTrackId(null);
      // Removed setTimeout to keep items in queue for the Transfers tab
    }
  };

  // Audio Player Controls
  const playTrack = (name: string, path: string) => {
    setCurrentPlayback({ name, path });
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = `media://${encodeURIComponent(path)}`;
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
      setIsPlaying(true);
    }
  };

  const handleSeekChange = (time: number) => {
    setCurrentTime(time);
  };

  const handleSeekCommit = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = currentTime;
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
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Auto-Upload Trigger
  const handleUploadFileAuto = async (filePath: string) => {
    if (!server || !token) {
      setDlLogs(prev => [...prev, `[Auto-Upload] ⚠️ Server/Token not configured, skipping auto-upload.`]);
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
      setDlLogs(prev => [...prev, `[Auto-Upload] ✅ Auto-upload completed successfully!`]);
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Auto-Upload] ❌ Auto-upload failed: ${e.message || e}`]);
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
      setDlLogs(prev => [...prev, `[Library] ✅ Upload completed successfully!`]);
      alert("Track successfully uploaded to TuneCamp!");
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Library] ❌ Error during upload: ${e.message || e}`]);
      alert("Error uploading file: " + (e.message || e));
    } finally {
      setUploadingFilePath(null);
    }
  };

  const loadDownloadedFiles = async () => {
    try {
      const res = await window.electronAPI.listDownloads();
      setDownloadedFiles(res);
      setSelectedFiles([]);
    } catch (e) {
      console.error("Failed to load local downloads list:", e);
    }
  };

  const handleEditTags = (file: any) => {
    const baseName = (file.name.split(/[/\\]/).pop() || file.name).replace(/\.[^/.]+$/, '');
    setEditTagsData({ title: baseName, artist: '', album: '' });
    setEditTagsFile({ name: file.name, path: file.path });
  };

  const confirmEditTags = async () => {
    if (!editTagsFile) return;
    try {
      await window.electronAPI.writeTags(editTagsFile.path, editTagsData);
      setDlLogs(prev => [...prev, `[Library] Tags saved: ${editTagsFile.name}`]);
    } catch (e: any) {
      alert('Error writing tags: ' + (e.message || e));
    }
    setEditTagsFile(null);
  };

  const handleMoveFile = async (filePath: string) => {
    const destFolder = await window.electronAPI.pickFolder();
    if (!destFolder) return;
    try {
      const newPath = await window.electronAPI.moveDownload(filePath, destFolder);
      setDlLogs(prev => [...prev, `[Library] Moved to: ${newPath}`]);
      loadDownloadedFiles();
    } catch (e: any) {
      alert('Error moving file: ' + (e.message || e));
    }
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
    let defaultArtist = 'Sidecamp';
    let defaultTitle = filename.replace(/\.[^/.]+$/, "");
    let defaultAlbum = '';
    
    if (filename.includes(' - ')) {
      const parts = filename.split(' - ');
      defaultArtist = parts[0].trim();
      defaultTitle = parts[1].replace(/\.[^/.]+$/, "").trim();
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
      folders: folder.split(',').map(f => f.trim()).filter(Boolean),
      allowDownloads: true
    });
  };

  const handleStopPeer = async () => {
    await window.electronAPI.stopPeer();
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
            .catch((e: any) => { console.error("Torrent search failed:", e); return []; })
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
      setDlLogs(prev => [...prev, `[Search] ❌ Error during search: ${err.message || err}`]);
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
      if (source === 'soundcloud' || source === 'bandcamp') {
        filePath = await window.electronAPI.ytdlpDownload(result.url);
      } else if (source === 'torrent_search') {
        const paths = await window.electronAPI.torrentDownload(result.url);
        filePath = paths.length > 0 ? paths[0] : '';
      } else {
        filePath = await window.electronAPI.slskDownload(result);
      }
      setDlLogs(prev => [...prev, `[${source.toUpperCase()}] ✅ Download completed! Saved to: ${filePath}`]);
      setActiveDownloads(prev => prev.map(d => d.id === downloadId ? { ...d, status: 'completed' } : d));
      loadDownloadedFiles(); // Refresh downloads list automatically!
      
      if (autoUpload && filePath) {
        handleUploadFileAuto(filePath);
      }
    } catch (err: any) {
      setDlLogs(prev => [...prev, `[${source.toUpperCase()}] ❌ Error during download: ${err.message || err}`]);
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
        resultPaths = await window.electronAPI.torrentDownload(directUrl);
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
      setDlLogs(prev => [...prev, `❌ Error during process: ${err.message || err}`]);
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
      setDlLogs(prev => [...prev, `[Library] ✅ Torrent seeding! Magnet Link: ${magnetUri}`]);
      alert(`Started seeding torrent!\n\nMagnet URI:\n${magnetUri}\n\nCopied to clipboard!`);
      navigator.clipboard.writeText(magnetUri).catch(() => {});
      loadDownloadedFiles();
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Library] ❌ Seeding failed: ${e.message || e}`]);
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
      setDlLogs(prev => [...prev, `[Library] ✅ Album Torrent seeding! Magnet Link: ${magnetUri}`]);
      alert(`Started seeding album torrent!\n\nMagnet URI:\n${magnetUri}\n\nCopied to clipboard!`);
      navigator.clipboard.writeText(magnetUri).catch(() => {});
      setSelectedFiles([]);
      loadDownloadedFiles();
    } catch (e: any) {
      setDlLogs(prev => [...prev, `[Library] ❌ Seeding failed: ${e.message || e}`]);
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
    localStorage.setItem('slsk_pass', slskPass);
    localStorage.setItem('shared_folders', folder);

    setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Connecting to Soulseek...`]);
    const connected = await window.electronAPI.slskConnect(slskUser, slskPass);
    if (connected) {
      setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Successfully connected to Soulseek.`]);
    } else {
      setDlLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Soulseek connection failed (check credentials).`]);
    }

    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="logo-container">
          <img src={logo} className="logo-img" alt="Sidecamp Logo" />
          <h1>Sidecamp</h1>
        </div>
        
        <nav className="nav-menu">
          <button className={`nav-item ${activeTab === 'peer' ? 'active' : ''}`} onClick={() => setActiveTab('peer')}>
            <span className="icon"><Radio size={18} /></span> Peer Node
          </button>
          <button className={`nav-item ${activeTab === 'network' ? 'active' : ''}`} onClick={() => setActiveTab('network')}>
            <span className="icon"><Globe size={18} /></span> Network
          </button>
          <button className={`nav-item ${activeTab === 'download' ? 'active' : ''}`} onClick={() => setActiveTab('download')}>
            <span className="icon"><Download size={18} /></span> Downloader
          </button>
          <button className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
            <span className="icon"><Music size={18} /></span> Library
          </button>
          <button className={`nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>
            <span className="icon"><FolderSync size={18} /></span> Transfers
          </button>
          <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <span className="icon"><Settings size={18} /></span> Configuration
          </button>
        </nav>

        {activeDownloads.length > 0 && (
          <div className="sidebar-downloads">
            <h4>
              <span className="spinner-mini" style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              Active Downloads ({activeDownloads.filter(d => d.status === 'downloading' || d.status === 'seeding').length})
            </h4>
            <div className="sidebar-dl-list">
              {activeDownloads.filter(d => d.status === 'downloading' || d.status === 'seeding').map((dl) => (
                <div key={dl.id} className="sidebar-dl-item">
                  <div className="sidebar-dl-info">
                    <span className="sidebar-dl-name" title={dl.name}>
                      {dl.source === 'soulseek' ? '🎵 ' : dl.source === 'torrent' ? '🧲 ' : dl.source === 'server' ? '☁️ ' : '🌐 '}
                      {dl.name}
                    </span>
                    <span className={`sidebar-dl-status ${dl.status}`}>
                      {dl.status === 'seeding' ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Seed ({dl.uploadSpeed ? `${(dl.uploadSpeed / 1024 / 1024).toFixed(1)}M/s` : '0M/s'})
                          <button 
                            onClick={() => handleStopTorrent(dl.id)} 
                            style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.85rem', padding: 0, marginLeft: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Stop Seeding"
                          >
                            ❌
                          </button>
                        </span>
                      ) : dl.status === 'completed' ? (
                        'Completed'
                      ) : dl.status === 'failed' ? (
                        'Failed'
                      ) : dl.speed ? (
                        `${(dl.speed / 1024 / 1024).toFixed(1)} MB/s`
                      ) : (
                        'Downloading'
                      )}
                    </span>
                  </div>
                  {dl.progress !== undefined && dl.status !== 'seeding' && (
                    <div className="progress-bar-bg" style={{ height: '4px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div className="progress-bar-fill" style={{ width: `${(dl.progress * 100).toFixed(0)}%`, height: '100%', background: 'var(--accent)', borderRadius: '2px' }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="status-indicator">
          <div className={`status-dot ${peerStatus}`}></div>
          <span>{peerStatus.toUpperCase()}</span>
        </div>
      </div>

      <main className="main-content">
          {activeTab === 'library' && (
            <div className="glass-card library-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Library</h3>
                <button className="btn btn-secondary" onClick={loadDownloadedFiles} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Refresh</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {downloadedFiles.map((file, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button className="btn btn-primary" onClick={() => playTrack(file.name, file.path)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Play</button>
                      <button className="btn btn-secondary" onClick={() => handleEditTags(file)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Edit Tags</button>
                      <button className="btn btn-secondary" onClick={() => handleMoveFile(file.path)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Move</button>
                      <button className="btn btn-danger" onClick={() => handleDeleteFile(file.path)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Delete</button>
                    </div>
                  </div>
                ))}
                {downloadedFiles.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No music files in library.</div>
                )}
              </div>
            </div>
          )}
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
                <button className="btn btn-primary" onClick={handleSaveSettings}>
                  Save Configuration
                </button>
                {settingsSaved && <span style={{ color: 'var(--accent)', marginLeft: '1rem', fontWeight: 600 }}>✓ Configuration saved!</span>}
              </div>
            </>
          )}

          {activeTab === 'network' && (
            <div className="glass-card network-card" style={{ display: 'flex', gap: '2.5rem', minHeight: '450px' }}>
              {/* Left pane: Peers list */}
              <div className="network-peers-pane" style={{ flex: '1', borderRight: '1px solid var(--glass-border)', paddingRight: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-headings)' }}>Connected Peers</h3>
                  <button className="btn btn-secondary" onClick={loadNetworkPeers} disabled={isLoadingPeers} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {isLoadingPeers ? 'Refreshing...' : 'Refresh'}
                  </button>
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
                          {p.id === 'server' ? '☁️ ' : '👤 '}
                          {p.username || 'Unknown'}
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
                ) : (
                  <div className="peer-tracks-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '5px' }}>
                    {peerTracks.map((t) => (
                      <div 
                        key={t.id} 
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '1rem 1.2rem',
                          background: 'rgba(0,0,0,0.15)',
                          border: '1px solid var(--glass-border)',
                          borderRadius: '8px',
                          transition: 'background 0.2s ease'
                        }}
                        className="peer-track-item"
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem' }}>{t.title || 'Unknown Title'}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.artist || 'Unknown Artist'} • {t.album || 'Unknown Album'} ({t.format})</span>
                        </div>
                        <button 
                          className="btn btn-accent" 
                          onClick={() => handleDownloadPeerTrack(t)}
                          disabled={downloadingTrackId === t.id}
                          style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                        >
                          {downloadingTrackId === t.id ? 'Downloading...' : 'Download'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'peer' && (
            <div className="glass-card peer-card">
              <div className="peer-controls">
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.95rem' }}>Currently shared folders:</label>
                  <div style={{ padding: '0.8rem 1rem', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginTop: '0.5rem' }}>
                    {folder.split(',').map(f => f.trim()).filter(Boolean).map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
                        <span style={{ fontSize: '1.1rem' }}>📁</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--text-main)' }}>{f}</span>
                      </div>
                    ))}
                    {folder.split(',').map(f => f.trim()).filter(Boolean).length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                        No folders configured. Configure them in the "Configuration" tab.
                      </div>
                    )}
                  </div>
                </div>
                <div className="btn-group" style={{ marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={handleStartPeer} disabled={peerStatus === 'online' || folder.split(',').map(f => f.trim()).filter(Boolean).length === 0}>
                    Start Sharing
                  </button>
                  <button className="btn btn-danger" onClick={handleStopPeer} disabled={peerStatus === 'offline'}>
                    Stop
                  </button>
                </div>
              </div>
              
              <div className="terminal-log">
                <div className="terminal-header">Terminal Logs</div>
                <div className="terminal-body">
                  {logs.map((log, i) => <div key={i} className="log-line">{log}</div>)}
                  {logs.length === 0 && <div className="log-line dim">No logs available...</div>}
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
                  🔍 Search Platforms (Soulseek / Web)
                </button>
                <button 
                  className={`subtab-btn ${downloadSource === 'direct' ? 'active' : ''}`} 
                  onClick={() => setDownloadSource('direct')}
                >
                  🔗 Direct Link (Torrent / Web URL)
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
                      🌐 All Platforms
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
                  </div>

                  <div className="search-bar">
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      placeholder={`Search on ${searchSource === 'soulseek' ? 'Soulseek' : searchSource === 'soundcloud' ? 'SoundCloud' : searchSource === 'bandcamp' ? 'Bandcamp' : 'Torrent (PirateBay)'}...`} 
                      className="glass-input search-input"
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                    <button className="btn btn-primary" onClick={handleSearch}>Search</button>
                  </div>

                  <div className="results-list">
                    {searchResults.map((res, i) => (
                      <div key={i} className="result-item">
                        <div className="result-info">
                          <div className="result-filename">
                            {res.title || (res.file && res.file.split(/[/\\]/).pop()) || 'Unknown Track'}
                          </div>
                          <div className="result-meta">
                            {res.source === 'soulseek' && `${(res.size / 1024 / 1024).toFixed(2)} MB • ${res.bitrate || '?'} kbps • User: ${res.user}`}
                            {res.source !== 'soulseek' && `Platform: ${res.user || res.source}`}
                          </div>
                        </div>
                        <button 
                          className="btn btn-accent" 
                          onClick={() => handleDownload(res)}
                          disabled={activeDownloads.some(d => d.id === res.id && d.status === 'downloading')}
                        >
                          {activeDownloads.some(d => d.id === res.id && d.status === 'downloading') ? 'Downloading...' : 'Download'}
                        </button>
                      </div>
                    ))}
                    {searchResults.length === 0 && <div className="no-results">No results.</div>}
                  </div>
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
                      <button 
                        className="btn btn-primary" 
                        onClick={handleDirectDownload}
                        disabled={isDownloading || !directUrl}
                      >
                        {isDownloading ? 'Downloading...' : 'Download'}
                      </button>
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

          {activeTab === 'files' && (
            <div className="glass-card files-card">
              
              {/* Transfer Queue Section */}
              <div className="files-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Active & Failed Transfers</h3>
                <button className="btn btn-secondary" onClick={purgeFailedDownloads}>Purge Failed</button>
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
                        <button className="btn btn-secondary" onClick={() => handleStopTorrent(dl.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Stop Seeding</button>
                      )}
                      {(dl.status === 'failed' || dl.status === 'completed') && (
                        <button className="btn btn-secondary" onClick={() => clearDownloadItem(dl.id)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Clear</button>
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

              {/* Local Downloads Library Section */}
              <div className="files-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
                <h3 style={{ margin: 0 }}>Local Downloads Library</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {selectedFiles.length > 0 && (
                    <>
                      <button className="btn btn-accent" onClick={handleSeedSelectedClick}>
                        🧲 Seed Selected ({selectedFiles.length})
                      </button>
                      <button className="btn btn-secondary" onClick={() => setSelectedFiles([])}>
                        Clear Selection
                      </button>
                    </>
                  )}
                  <button className="btn btn-secondary" onClick={loadDownloadedFiles}>Refresh</button>
                </div>
              </div>

              <div className="files-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto', paddingRight: '5px' }}>
                {downloadedFiles.map((file, i) => {
                  const isSeeding = !!file.magnetUri;
                  return (
                    <div key={i} className="result-item" style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {!isSeeding && (
                        <input 
                          type="checkbox" 
                          checked={selectedFiles.includes(file.path)} 
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFiles(prev => [...prev, file.path]);
                            } else {
                              setSelectedFiles(prev => prev.filter(p => p !== file.path));
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      )}
                      {isSeeding && (
                        <div style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2ecc71', fontSize: '0.9rem' }} title="Already seeding">
                          ✓
                        </div>
                      )}
                      
                      <div className="result-info" style={{ flex: 1 }}>
                        <div className="result-filename" style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', wordBreak: 'break-all' }}>
                          {file.name}
                        </div>
                        <div className="result-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.ctime).toLocaleString()}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          className="btn btn-primary" 
                          onClick={() => playTrack(file.name, file.path)}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                          Play
                        </button>
                        <button 
                          className="btn btn-accent" 
                          onClick={() => handleUploadFile(file.path)}
                          disabled={uploadingFilePath !== null}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                          {uploadingFilePath === file.path ? 'Uploading...' : 'Upload to TC'}
                        </button>
                        {file.magnetUri ? (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => {
                              navigator.clipboard.writeText(file.magnetUri);
                              alert("Magnet URI copied to clipboard!");
                            }}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: '#2ecc71', borderColor: '#2ecc71' }}
                          >
                            🟢 Seeding (Copy Link)
                          </button>
                        ) : (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => handleSeedFile(file.path)}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                          >
                            🧲 Seed Torrent
                          </button>
                        )}
                        <button 
                          className="btn btn-danger" 
                          onClick={() => handleDeleteFile(file.path)}
                          disabled={uploadingFilePath === file.path}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}

                {downloadedFiles.length === 0 && (
                  <div className="no-results" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No music files found in Sidecamp's downloads folder.
                  </div>
                )}
              </div>

              {/* Logs di Libreria */}
              <div className="terminal-log" style={{ marginTop: '2rem' }}>
                <div className="terminal-header">Library Activity Logs</div>
                <div className="terminal-body" style={{ height: '180px' }}>
                  {dlLogs.filter(log => log.includes('[Library]')).map((log, i) => <div key={i} className="log-line">{log}</div>)}
                  {dlLogs.filter(log => log.includes('[Library]')).length === 0 && <div className="log-line dim">No library activity logs...</div>}
                </div>
              </div>
            </div>
          )}
      </main>

      <audio
        ref={audioRef}
        style={{ display: 'none' }}
        onTimeUpdate={() => {
          if (audioRef.current && !isSeeking) setCurrentTime(audioRef.current.currentTime);
        }}
        onDurationChange={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          stopPlayback();
        }}
      />

      {/* Audio Player Bar */}
      {currentPlayback && (
        <div className="audio-player-bar">
          <div className="player-info">
            <span className="player-track-icon"><Music size={32} /></span>
            <div className="player-track-details">
              <span className="player-track-title">{currentPlayback.name}</span>
              <span className="player-track-path">{currentPlayback.path}</span>
            </div>
          </div>
          
          <div className="player-controls-center">
            <button className="player-btn toggle-play" onClick={togglePlay}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '4px' }} />}
            </button>
            
            <div className="player-seeker">
              <span className="time-display">{formatTime(currentTime)}</span>
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime} 
                onMouseDown={() => setIsSeeking(true)}
                onChange={(e) => handleSeekChange(parseFloat(e.target.value))} 
                onMouseUp={handleSeekCommit}
                onTouchStart={() => setIsSeeking(true)}
                onTouchEnd={handleSeekCommit}
                className="seeker-slider"
              />
              <span className="time-display">{formatTime(duration)}</span>
            </div>
          </div>
          
          <div className="player-controls-right">
            <span className="volume-icon"><Volume2 size={18} /></span>
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
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Metadata Editor Modal */}
      {metadataModalFile && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1.2rem', fontSize: '1.25rem' }}>Upload Track to TuneCamp</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
              File: <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{metadataModalFile.name}</span>
            </p>
            
            <div className="form-group">
              <label>Track Title</label>
              <input 
                type="text" 
                value={metadataTitle} 
                onChange={e => setMetadataTitle(e.target.value)} 
                className="glass-input"
              />
            </div>
            
            <div className="form-group">
              <label>Artist Name</label>
              <input 
                type="text" 
                value={metadataArtist} 
                onChange={e => setMetadataArtist(e.target.value)} 
                className="glass-input"
              />
            </div>
            
            <div className="form-group">
              <label>Album (Optional)</label>
              <input 
                type="text" 
                value={metadataAlbum} 
                onChange={e => setMetadataAlbum(e.target.value)} 
                className="glass-input"
              />
            </div>
            
            <div className="btn-group" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setMetadataModalFile(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmUpload}>Upload</button>
            </div>
          </div>
        </div>
      )}

      {/* Album Seeding Modal */}
      {albumSeedModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1.2rem', fontSize: '1.25rem' }}>Seed Selected Tracks as Album</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              You have selected <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{selectedFiles.length}</span> tracks to seed together.
            </p>
            
            <div className="form-group">
              <label>Album / Torrent Name</label>
              <input 
                type="text" 
                value={albumSeedName} 
                onChange={e => setAlbumSeedName(e.target.value)} 
                className="glass-input"
                placeholder="Enter album or torrent name"
              />
            </div>
            
            <div className="btn-group" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setAlbumSeedModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmSeedSelected}>Start Seeding</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Tags Modal */}
      {editTagsFile && (
        <div className="modal-overlay">
          <div className="modal-content glass-card" style={{ maxWidth: '500px', width: '90%' }}>
            <h3 style={{ fontFamily: 'var(--font-headings)', marginBottom: '1.2rem', fontSize: '1.25rem' }}>Edit File Tags</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem', wordBreak: 'break-all' }}>
              File: <span style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>{editTagsFile.name}</span>
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
            <div className="btn-group" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditTagsFile(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmEditTags}>Save Tags</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
