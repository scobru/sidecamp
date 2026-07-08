let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electronAPI", {
	setUploadConfig: (server, token) => electron.ipcRenderer.invoke("upload:config", server, token),
	uploadTrack: (filePath, metadata) => electron.ipcRenderer.invoke("upload:track", filePath, metadata),
	slskConnect: (user, pass) => electron.ipcRenderer.invoke("slsk:connect", user, pass),
	slskSearch: (query) => electron.ipcRenderer.invoke("slsk:search", query),
	searchWeb: (query, source) => electron.ipcRenderer.invoke("search:web", query, source),
	slskDownload: (result) => electron.ipcRenderer.invoke("slsk:download", result),
	slskStatus: () => electron.ipcRenderer.invoke("slsk:status"),
	torrentDownload: (magnetUri) => electron.ipcRenderer.invoke("torrent:download", magnetUri),
	ytdlpDownload: (url) => electron.ipcRenderer.invoke("ytdlp:download", url),
	listDownloads: () => electron.ipcRenderer.invoke("downloads:list"),
	deleteDownload: (filePath) => electron.ipcRenderer.invoke("downloads:delete", filePath),
	startPeer: (config) => electron.ipcRenderer.invoke("peer:start", config),
	stopPeer: () => electron.ipcRenderer.invoke("peer:stop"),
	onPeerLog: (callback) => electron.ipcRenderer.on("peer:log", (_, msg) => callback(msg)),
	onPeerStatus: (callback) => electron.ipcRenderer.on("peer:status", (_, status) => callback(status)),
	onPeerProgress: (callback) => electron.ipcRenderer.on("peer:progress", (_, data) => callback(data)),
	onDownloadLog: (callback) => electron.ipcRenderer.on("download:log", (_, msg) => callback(msg)),
	onDownloadProgress: (callback) => electron.ipcRenderer.on("download:progress", (_, data) => callback(data)),
	openDownload: (filePath) => electron.ipcRenderer.invoke("downloads:open", filePath),
	removeTorrent: (infoHash) => electron.ipcRenderer.invoke("torrent:remove", infoHash),
	getNetworkPeers: (server, token) => electron.ipcRenderer.invoke("network:peers", server, token),
	getPeerTracks: (server, token, sessionId) => electron.ipcRenderer.invoke("network:tracks", server, token, sessionId),
	downloadPeerTrack: (server, token, sessionId, trackId, artist, title) => electron.ipcRenderer.invoke("network:download", server, token, sessionId, trackId, artist, title),
	getCatalogTracks: (server, token) => electron.ipcRenderer.invoke("network:catalog-tracks", server, token),
	downloadCatalogTrack: (server, token, trackId, artist, title) => electron.ipcRenderer.invoke("network:catalog-download", server, token, trackId, artist, title)
});
//#endregion
