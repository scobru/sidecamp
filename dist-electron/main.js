import { BrowserWindow, app, ipcMain, net, protocol, shell } from "electron";
import path, { join } from "path";
import { pathToFileURL } from "url";
import fs from "fs";
import crypto from "crypto";
import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { SoulseekDownloader } from "andrade-soulseek-downloader/dist/index.js";
import fs$1 from "fs-extra";
import { exec } from "child_process";
import axios from "axios";
import FormData from "form-data";
//#region electron/peer/daemon.ts
var PeerDaemon = class extends EventEmitter {
	config;
	ws = null;
	fileIndex = /* @__PURE__ */ new Map();
	activeStreams = /* @__PURE__ */ new Map();
	isRunning = false;
	reconnectTimer = null;
	constructor(config) {
		super();
		this.config = config;
	}
	setConfig(config) {
		this.config = config;
	}
	async scanFolders() {
		this.emit("log", "Avvio scansione cartelle locali...");
		this.fileIndex.clear();
		const validExtensions = /* @__PURE__ */ new Set([
			".mp3",
			".flac",
			".ogg",
			".m4a",
			".wav"
		]);
		let files = [];
		for (const folder of this.config.folders) if (fs.existsSync(folder)) this.walkDir(folder, files);
		files = files.filter((f) => validExtensions.has(path.extname(f).toLowerCase()));
		this.emit("log", `Trovati ${files.length} file audio. Estrazione metadati...`);
		const indexData = [];
		let processed = 0;
		const musicMetadata = await import("music-metadata");
		for (const file of files) try {
			const metadata = await musicMetadata.parseFile(file);
			const stat = fs.statSync(file);
			const trackData = {
				id: crypto.createHash("md5").update(file).digest("hex"),
				path: file,
				title: metadata.common.title || path.basename(file, path.extname(file)),
				artist: metadata.common.artist || "Unknown Artist",
				album: metadata.common.album || "Unknown Album",
				duration: metadata.format.duration || 0,
				sizeBytes: stat.size,
				fileSizeBytes: stat.size,
				format: path.extname(file).substring(1).toLowerCase(),
				mimeType: metadata.format.container || path.extname(file).substring(1).toLowerCase(),
				bitrate: metadata.format.bitrate || 0,
				allowDownload: this.config.allowDownloads
			};
			this.fileIndex.set(trackData.id, trackData);
			indexData.push({
				...trackData,
				path: void 0
			});
			processed++;
			if (processed % 100 === 0) this.emit("progress", processed, files.length);
		} catch (err) {
			this.emit("log", `Errore lettura metadati per ${file}: ${err.message}`);
		}
		this.emit("progress", processed, files.length);
		this.emit("log", `Scansione completata. ${indexData.length} tracce indicizzate.`);
		return indexData;
	}
	walkDir(dir, files = []) {
		const list = fs.readdirSync(dir);
		for (const item of list) {
			const itemPath = path.join(dir, item);
			try {
				if (fs.statSync(itemPath).isDirectory()) this.walkDir(itemPath, files);
				else files.push(itemPath);
			} catch (e) {}
		}
	}
	async start() {
		if (this.isRunning) return;
		this.isRunning = true;
		await this.connect();
	}
	stop() {
		this.isRunning = false;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.cleanupStreams();
		this.emit("status", "offline");
	}
	async connect() {
		if (!this.isRunning) return;
		try {
			const indexData = await this.scanFolders();
			const wsUrl = new URL(this.config.server);
			wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
			wsUrl.pathname = "/ws/peer";
			wsUrl.searchParams.set("token", this.config.token);
			wsUrl.searchParams.set("allowDownloads", String(this.config.allowDownloads));
			this.emit("status", "connecting");
			this.ws = new WebSocket(wsUrl.toString());
			this.ws.on("open", () => {
				this.emit("log", "WebSocket connesso. In attesa di autorizzazione...");
			});
			this.ws.on("message", (data) => {
				try {
					const msg = JSON.parse(data.toString());
					if (msg.type === "auth_ok") {
						this.emit("status", "online");
						this.emit("log", `Connesso a TuneCamp (Sessione: ${msg.sessionId}). Invio indice libreria...`);
						this.ws?.send(JSON.stringify({
							type: "manifest",
							tracks: indexData
						}));
					} else if (msg.type === "ping") this.ws?.send(JSON.stringify({ type: "pong" }));
					else if (msg.type === "stream_request" || msg.type === "download_request") this.handleRequest(msg.requestId, msg.trackId);
					else if (msg.type === "cancel_request") this.handleCancel(msg.requestId);
				} catch (err) {
					console.error("Parse error", err);
				}
			});
			this.ws.on("close", () => {
				this.emit("status", "disconnected");
				this.cleanupStreams();
				if (this.isRunning) {
					this.emit("log", "Connessione persa. Riconnessione tra 5s...");
					this.reconnectTimer = setTimeout(() => this.connect(), 5e3);
				}
			});
			this.ws.on("error", (err) => {
				this.emit("log", `Errore WebSocket: ${err.message}`);
				this.ws?.close();
			});
		} catch (err) {
			this.emit("log", `Errore di avvio: ${err.message}`);
			if (this.isRunning) this.reconnectTimer = setTimeout(() => this.connect(), 5e3);
		}
	}
	handleRequest(requestId, trackId) {
		const track = this.fileIndex.get(trackId);
		if (!track || !fs.existsSync(track.path)) {
			this.ws?.send(JSON.stringify({
				type: "chunk_error",
				requestId,
				message: "File non trovato"
			}));
			return;
		}
		this.emit("log", `Streaming/Download richiesto: ${track.title} [Req: ${requestId}]`);
		const stream = fs.createReadStream(track.path, { highWaterMark: 64 * 1024 });
		this.activeStreams.set(requestId, stream);
		let seq = 0;
		stream.on("data", (chunk) => {
			if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({
				type: "chunk",
				requestId,
				seq: seq++,
				data: chunk.toString("base64")
			}));
			else stream.destroy();
		});
		stream.on("end", () => {
			this.ws?.send(JSON.stringify({
				type: "chunk_end",
				requestId
			}));
			this.activeStreams.delete(requestId);
			this.emit("log", `Streaming/Download completato: ${track.title} [Req: ${requestId}]`);
		});
		stream.on("error", (err) => {
			this.ws?.send(JSON.stringify({
				type: "chunk_error",
				requestId,
				message: err.message
			}));
			this.activeStreams.delete(requestId);
		});
	}
	handleCancel(requestId) {
		const stream = this.activeStreams.get(requestId);
		if (stream) {
			stream.destroy();
			this.activeStreams.delete(requestId);
			this.emit("log", `Streaming/Download cancellato [Req: ${requestId}]`);
		}
	}
	cleanupStreams() {
		for (const [id, stream] of this.activeStreams.entries()) stream.destroy();
		this.activeStreams.clear();
	}
};
//#endregion
//#region electron/providers/soulseek.ts
var SoulseekService = class {
	downloader;
	musicDir;
	downloadDir;
	currentUsername = null;
	searchCache = /* @__PURE__ */ new Map();
	connectingPromise = null;
	constructor(musicDir, downloadDir) {
		this.musicDir = musicDir;
		this.downloadDir = downloadDir;
		setInterval(() => {
			if (this.searchCache.size > 1e3) this.searchCache.clear();
		}, 600 * 1e3);
	}
	async connect(user, pass) {
		const username = user || process.env.SLSK_USER;
		const password = pass || process.env.SLSK_PASS;
		if (!username || !password) {
			console.warn("⚠️ Soulseek credentials missing. Service will be inactive.");
			return false;
		}
		if (this.currentUsername === username && this.downloader) return true;
		if (this.connectingPromise) return this.connectingPromise;
		this.connectingPromise = (async () => {
			try {
				fs$1.mkdirSync(path.resolve("/tmp"), { recursive: true });
				process.env.SOULSEEK_USER = username;
				process.env.SOULSEEK_PASSWORD = password;
				process.env.SOULSEEK_SHARED_MUSIC_DIR = this.musicDir;
				process.env.SOULSEEK_DOWNLOAD_DIR = this.downloadDir;
				const config = {
					maxAttempts: 10,
					downloadTimeout: 12e4,
					searchTimeout: 1e4,
					preferSlotsAvailable: true,
					minSpeed: 1e5,
					searchDelay: 3e3,
					downloadDelay: 2e3
				};
				if (this.downloader) {
					try {
						await this.downloader.disconnect();
					} catch (e) {}
					this.downloader = void 0;
				}
				const downloader = new SoulseekDownloader(config);
				await downloader.connect();
				this.downloader = downloader;
				console.log("✅ Soulseek Connected as", username);
				this.currentUsername = username;
				this.searchCache.clear();
				return true;
			} catch (err) {
				console.error("❌ Soulseek Connection Error:", err);
				this.currentUsername = null;
				this.downloader = void 0;
				return false;
			} finally {
				this.connectingPromise = null;
			}
		})();
		return this.connectingPromise;
	}
	async search(query) {
		const downloader = this.downloader;
		if (!downloader) return [];
		try {
			const [artist, title] = query.split(" - ").map((s) => s.trim());
			const options = {
				artist: artist || query,
				title: title || "",
				minBitrate: 128,
				timeout: 1e4,
				maxResults: 50,
				strictMatching: false
			};
			return (await downloader.search(options)).map((r) => {
				const id = crypto.randomUUID();
				this.searchCache.set(id, r);
				return {
					id,
					user: r.user,
					file: r.file,
					size: r.size,
					slots: r.slots,
					bitrate: r.bitrate,
					speed: r.speed
				};
			});
		} catch (error) {
			console.error("❌ Soulseek Search Error:", error);
			return [];
		}
	}
	async download(result) {
		const downloader = this.downloader;
		if (!downloader) throw new Error("Soulseek client not connected");
		const originalResult = this.searchCache.get(result.id);
		const artist = result.file.split(/[/\\]/).slice(-2, -1)[0] || "Unknown Artist";
		const title = result.file.split(/[/\\]/).pop()?.replace(/\.[^/.]+$/, "") || "Unknown Title";
		try {
			if (originalResult) {
				const dl = await downloader.download(originalResult, artist, title);
				if (dl.path) return dl.path;
				if (dl.timeout) throw new Error("Download timed out");
			}
			console.log(`⚠️ Manual selection failed or context missing, triggering robust searchAndDownload for ${artist} - ${title}`);
			const robustPath = await downloader.searchAndDownload(artist, title);
			if (robustPath) return robustPath;
			throw new Error("Download failed after all attempts and fallbacks");
		} catch (error) {
			console.error("❌ Soulseek Download Error:", error);
			throw error;
		}
	}
	disconnect() {
		if (this.downloader) {
			this.downloader = void 0;
			this.currentUsername = null;
			this.searchCache.clear();
			console.log("[Soulseek] Disconnected");
		}
	}
	async checkStatus() {
		return {
			connected: !!this.downloader && !!this.currentUsername,
			username: this.currentUsername
		};
	}
};
//#endregion
//#region electron/providers/torrent.ts
var TorrentService = class extends EventEmitter {
	client = null;
	downloadDir;
	constructor(downloadDir) {
		super();
		this.downloadDir = downloadDir;
	}
	async download(magnetUri) {
		return new Promise(async (resolve, reject) => {
			if (!this.client) try {
				const WebTorrentClass = (await import("webtorrent")).default;
				this.client = new WebTorrentClass({ utp: false });
				this.client.on("error", (err) => {
					console.error("WebTorrent error:", err);
					this.emit("error", err);
				});
			} catch (err) {
				return reject(err);
			}
			this.emit("log", `Inizio download magnet...`);
			this.client.add(magnetUri, { path: this.downloadDir }, (torrent) => {
				this.emit("log", `Metadati ricevuti: ${torrent.name}`);
				torrent.on("download", (bytes) => {
					this.emit("progress", {
						id: torrent.infoHash,
						name: torrent.name,
						progress: torrent.progress,
						speed: torrent.downloadSpeed,
						uploadSpeed: torrent.uploadSpeed,
						downloaded: torrent.downloaded,
						total: torrent.length,
						seeding: torrent.done
					});
				});
				torrent.on("upload", (bytes) => {
					this.emit("progress", {
						id: torrent.infoHash,
						name: torrent.name,
						progress: torrent.progress,
						speed: torrent.downloadSpeed,
						uploadSpeed: torrent.uploadSpeed,
						downloaded: torrent.downloaded,
						total: torrent.length,
						seeding: torrent.done
					});
				});
				torrent.on("done", () => {
					this.emit("log", `Download completato e in seeding: ${torrent.name}`);
					resolve(torrent.files.map((f) => path.join(this.downloadDir, f.path)));
				});
				torrent.on("error", (err) => {
					reject(err);
				});
			});
		});
	}
	remove(infoHash) {
		if (this.client) {
			const torrent = this.client.get(infoHash);
			if (torrent) {
				this.emit("log", `Rimozione torrent e stop seeding per: ${torrent.name}`);
				torrent.destroy();
			}
		}
	}
	stop() {
		if (this.client) {
			this.client.destroy();
			this.client = null;
		}
	}
};
//#endregion
//#region electron/providers/ytdlp.ts
var YtdlpService = class extends EventEmitter {
	downloadDir;
	constructor(downloadDir) {
		super();
		this.downloadDir = downloadDir;
	}
	async download(url) {
		return new Promise((resolve, reject) => {
			this.emit("log", `Inizio download yt-dlp per ${url}`);
			const child = exec(`yt-dlp -x --audio-format mp3 -o "${path.join(this.downloadDir, "%(title)s.%(ext)s")}" "${url}"`, (error, stdout, stderr) => {
				if (error) return reject(error);
				const lines = stdout.split("\n");
				let downloadedFile = "";
				for (const line of lines) if (line.includes("Destination:") && line.includes(".mp3")) downloadedFile = line.split("Destination:")[1].trim();
				this.emit("log", `Download completato: ${downloadedFile}`);
				resolve(downloadedFile);
			});
			child.stdout?.on("data", (data) => this.emit("log", data.toString().trim()));
			child.stderr?.on("data", (data) => this.emit("log", data.toString().trim()));
		});
	}
};
//#endregion
//#region electron/providers/network.ts
var NetworkService = class {
	downloadDir;
	constructor(downloadDir) {
		this.downloadDir = downloadDir;
	}
	async getPeers(server, token) {
		const cleanServer = server.replace(/\/$/, "");
		return (await axios.get(`${cleanServer}/api/peers`, { headers: { "Authorization": `Bearer ${token}` } })).data;
	}
	async getPeerTracks(server, token, sessionId) {
		const cleanServer = server.replace(/\/$/, "");
		return (await axios.get(`${cleanServer}/api/peers/${sessionId}/tracks`, { headers: { "Authorization": `Bearer ${token}` } })).data;
	}
	async downloadPeerTrack(server, token, sessionId, trackId, artist, title) {
		const url = `${server.replace(/\/$/, "")}/api/peers/${sessionId}/tracks/${trackId}/download?token=${token}`;
		if (!fs.existsSync(this.downloadDir)) fs.mkdirSync(this.downloadDir, { recursive: true });
		const response = await axios({
			method: "get",
			url,
			responseType: "stream",
			headers: { "Authorization": `Bearer ${token}` }
		});
		const contentDisposition = response.headers["content-disposition"];
		let filename = `${artist || "Unknown Artist"} - ${title || "Track"}.mp3`;
		if (contentDisposition) {
			const match = contentDisposition.match(/filename="(.+?)"/);
			if (match) filename = match[1];
		}
		filename = filename.replace(/[<>:"/\\|?*]/g, "_");
		const destPath = path.join(this.downloadDir, filename);
		const writer = fs.createWriteStream(destPath);
		response.data.pipe(writer);
		return new Promise((resolve, reject) => {
			writer.on("finish", () => resolve(destPath));
			writer.on("error", (err) => reject(err));
		});
	}
	async getCatalogTracks(server, token) {
		const cleanServer = server.replace(/\/$/, "");
		return (await axios.get(`${cleanServer}/api/tracks`, { headers: { "Authorization": `Bearer ${token}` } })).data;
	}
	async downloadCatalogTrack(server, token, trackId, artist, title) {
		const url = `${server.replace(/\/$/, "")}/api/tracks/${trackId}/download`;
		if (!fs.existsSync(this.downloadDir)) fs.mkdirSync(this.downloadDir, { recursive: true });
		const response = await axios({
			method: "get",
			url,
			responseType: "stream",
			headers: { "Authorization": `Bearer ${token}` }
		});
		const contentDisposition = response.headers["content-disposition"];
		let filename = `${artist || "Unknown Artist"} - ${title || "Track"}.mp3`;
		if (contentDisposition) {
			const match = contentDisposition.match(/filename="(.+?)"/);
			if (match) filename = match[1];
		}
		filename = filename.replace(/[<>:"/\\|?*]/g, "_");
		const destPath = path.join(this.downloadDir, filename);
		const writer = fs.createWriteStream(destPath);
		response.data.pipe(writer);
		return new Promise((resolve, reject) => {
			writer.on("finish", () => resolve(destPath));
			writer.on("error", (err) => reject(err));
		});
	}
};
//#endregion
//#region electron/uploader/index.ts
var TuneCampUploader = class {
	config;
	constructor(config) {
		this.config = config;
	}
	setConfig(config) {
		this.config = config;
	}
	/**
	* Uploads a local file to TuneCamp via the /api/admin/upload/tracks endpoint
	*/
	async uploadTrack(filePath, metadata) {
		if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
		const formData = new FormData();
		const fileStream = fs.createReadStream(filePath);
		formData.append("files", fileStream, path.basename(filePath));
		if (metadata?.releaseSlug) formData.append("releaseSlug", metadata.releaseSlug);
		if (metadata?.artist) formData.append("artist", metadata.artist);
		if (metadata?.album) formData.append("album", metadata.album);
		if (metadata?.artistId) formData.append("artistId", metadata.artistId.toString());
		const uploadUrl = `${this.config.server.replace(/\/$/, "")}/api/admin/upload/tracks`;
		try {
			return (await axios.post(uploadUrl, formData, {
				headers: {
					...formData.getHeaders(),
					"Authorization": `Bearer ${this.config.token}`
				},
				maxContentLength: Infinity,
				maxBodyLength: Infinity
			})).data;
		} catch (error) {
			if (error.response) throw new Error(`Upload failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
			throw new Error(`Upload failed: ${error.message}`);
		}
	}
};
//#endregion
//#region electron/providers/search.ts
var USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var SOUNDCLOUD_URL = "https://soundcloud.com";
var SOUNDCLOUD_API_V2 = "https://api-v2.soundcloud.com";
var CLIENT_ID_REGEX = /[{,]client_id:"(\w+)"/;
var SNDCDN_SCRIPT_URL_REGEX = /https?:\/\/[^\s"]*sndcdn\.com[^\s"]*\.js/g;
var cachedClientId = null;
async function getSoundCloudClientId() {
	if (cachedClientId) return cachedClientId;
	try {
		const homeRes = await fetch(SOUNDCLOUD_URL, { headers: { "User-Agent": USER_AGENT } });
		if (!homeRes.ok) throw new Error(`SC home fetch failed: ${homeRes.status}`);
		const scriptUrls = (await homeRes.text()).match(SNDCDN_SCRIPT_URL_REGEX) || [];
		for (const url of [...scriptUrls].reverse()) try {
			const scriptRes = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
			if (!scriptRes.ok) continue;
			const match = (await scriptRes.text()).match(CLIENT_ID_REGEX);
			if (match?.[1]) {
				cachedClientId = match[1];
				return match[1];
			}
		} catch {}
		throw new Error("Could not find client_id in script assets");
	} catch (err) {
		console.warn("SoundCloud Client ID scrape failed, using fallback:", err);
		return "iY8tV4wgf1Ls4m9T2n18w5I85aZ2zE6V";
	}
}
async function searchSoundCloud(query) {
	try {
		const clientId = await getSoundCloudClientId();
		const url = `${SOUNDCLOUD_API_V2}/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=10`;
		const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
		if (!res.ok) {
			console.error(`SoundCloud API returned error: ${res.status}`);
			return [];
		}
		return ((await res.json()).collection || []).map((track) => ({
			id: "sc_" + track.id,
			title: track.title,
			artist: track.user?.username || "Unknown Artist",
			album: "",
			url: track.permalink_url,
			source: "soundcloud",
			size: 0,
			bitrate: 0,
			user: "SoundCloud"
		}));
	} catch (e) {
		console.error("SoundCloud search error:", e);
		return [];
	}
}
async function searchBandcamp(query) {
	try {
		const response = await fetch("https://bandcamp.com/api/bcsearch_public_api/1/autocomplete_elastic", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"User-Agent": USER_AGENT
			},
			body: JSON.stringify({
				search_text: query,
				search_filter: "t",
				full_page: false,
				fan_id: null
			})
		});
		if (!response.ok) {
			console.error(`Bandcamp Search API returned error: ${response.status}`);
			return [];
		}
		return ((await response.json()).auto?.results || []).map((r) => ({
			id: "bc_" + r.id,
			title: r.name,
			artist: r.band_name || "Unknown Artist",
			album: r.album_name || "",
			url: r.item_url_path || r.item_url_root,
			source: "bandcamp",
			size: 0,
			bitrate: 0,
			user: "Bandcamp"
		}));
	} catch (e) {
		console.error("Bandcamp search error:", e);
		return [];
	}
}
async function searchTorrents(query) {
	try {
		const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}`;
		const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
		if (!res.ok) {
			console.error(`Torrent API returned error: ${res.status}`);
			return [];
		}
		const data = await res.json();
		if (!Array.isArray(data) || data.length === 0 || data[0].name === "No results returned") return [];
		return data.slice(0, 10).map((item) => {
			const magnet = `magnet:?xt=urn:btih:${item.info_hash}&dn=${encodeURIComponent(item.name)}`;
			return {
				id: "torrent_" + item.id,
				title: item.name,
				artist: "Torrent",
				album: `Seeds: ${item.seeders} / Peers: ${item.leechers}`,
				url: magnet,
				source: "torrent_search",
				size: parseInt(item.size) || 0,
				bitrate: 0,
				user: "Torrent (PirateBay)"
			};
		});
	} catch (e) {
		console.error("Torrent search error:", e);
		return [];
	}
}
//#endregion
//#region electron/main.ts
protocol.registerSchemesAsPrivileged([{
	scheme: "media",
	privileges: {
		bypassCSP: true,
		stream: true,
		supportFetchAPI: true
	}
}]);
process.env.DIST = join(import.meta.dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, "../public");
var win;
function createWindow() {
	win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			preload: join(import.meta.dirname, "preload.mjs"),
			nodeIntegration: false,
			contextIsolation: true
		}
	});
	win.webContents.on("did-finish-load", () => {
		win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
	});
	if (process.env.VITE_DEV_SERVER_URL) {
		win.loadURL(process.env.VITE_DEV_SERVER_URL);
		win.webContents.openDevTools();
	} else win.loadFile(join(process.env.DIST, "index.html"));
}
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
		win = null;
	}
});
var daemon = null;
var musicDir = path.join(app.getPath("music"), "Sidecamp");
var downloadDir = path.join(app.getPath("downloads"), "Sidecamp");
var slsk = new SoulseekService(musicDir, downloadDir);
var torrent = new TorrentService(downloadDir);
var ytdlp = new YtdlpService(downloadDir);
var network = new NetworkService(downloadDir);
var uploader = new TuneCampUploader({
	server: "",
	token: ""
});
torrent.on("log", (msg) => win?.webContents.send("download:log", `[Torrent] ${msg}`));
torrent.on("progress", (data) => win?.webContents.send("download:progress", data));
ytdlp.on("log", (msg) => win?.webContents.send("download:log", `[YT-DLP] ${msg}`));
ipcMain.handle("upload:config", (event, server, token) => {
	uploader.setConfig({
		server,
		token
	});
	return true;
});
ipcMain.handle("upload:track", async (event, filePath, metadata) => {
	return await uploader.uploadTrack(filePath, metadata);
});
ipcMain.handle("slsk:connect", async (event, user, pass) => {
	return await slsk.connect(user, pass);
});
ipcMain.handle("slsk:search", async (event, query) => {
	return await slsk.search(query);
});
ipcMain.handle("search:web", async (event, query, source) => {
	if (source === "soundcloud") return await searchSoundCloud(query);
	else if (source === "bandcamp") return await searchBandcamp(query);
	else if (source === "torrent") return await searchTorrents(query);
	return [];
});
ipcMain.handle("slsk:download", async (event, result) => {
	return await slsk.download(result);
});
ipcMain.handle("slsk:status", async () => {
	return await slsk.checkStatus();
});
ipcMain.handle("downloads:list", async () => {
	try {
		if (!fs.existsSync(downloadDir)) return [];
		const files = fs.readdirSync(downloadDir, { withFileTypes: true });
		const result = [];
		for (const f of files) if (f.isFile()) {
			const filePath = path.join(downloadDir, f.name);
			const ext = path.extname(f.name).toLowerCase();
			if ([
				".mp3",
				".flac",
				".wav",
				".ogg",
				".m4a",
				".mp4"
			].includes(ext)) {
				const stat = fs.statSync(filePath);
				result.push({
					name: f.name,
					path: filePath,
					size: stat.size,
					ctime: stat.ctimeMs
				});
			}
		} else if (f.isDirectory()) {
			const subDirPath = path.join(downloadDir, f.name);
			const subFiles = fs.readdirSync(subDirPath, { withFileTypes: true });
			for (const sf of subFiles) if (sf.isFile()) {
				const filePath = path.join(subDirPath, sf.name);
				const ext = path.extname(sf.name).toLowerCase();
				if ([
					".mp3",
					".flac",
					".wav",
					".ogg",
					".m4a",
					".mp4"
				].includes(ext)) {
					const stat = fs.statSync(filePath);
					result.push({
						name: `${f.name}/${sf.name}`,
						path: filePath,
						size: stat.size,
						ctime: stat.ctimeMs
					});
				}
			}
		}
		return result.sort((a, b) => b.ctime - a.ctime);
	} catch (e) {
		console.error("Error reading downloads directory:", e);
		return [];
	}
});
ipcMain.handle("downloads:delete", async (event, filePath) => {
	try {
		if (fs.existsSync(filePath)) {
			fs.unlinkSync(filePath);
			const dir = path.dirname(filePath);
			if (dir !== downloadDir && fs.existsSync(dir)) {
				if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
			}
			return true;
		}
		return false;
	} catch (e) {
		console.error("Error deleting file:", e);
		throw e;
	}
});
ipcMain.handle("downloads:open", async (event, filePath) => {
	try {
		await shell.openPath(filePath);
		return true;
	} catch (e) {
		console.error("Error opening file:", e);
		throw e;
	}
});
ipcMain.handle("torrent:download", async (event, magnetUri) => {
	return await torrent.download(magnetUri);
});
ipcMain.handle("torrent:remove", async (event, infoHash) => {
	torrent.remove(infoHash);
	return true;
});
ipcMain.handle("ytdlp:download", async (event, url) => {
	return await ytdlp.download(url);
});
ipcMain.handle("peer:start", async (event, config) => {
	if (daemon) daemon.stop();
	daemon = new PeerDaemon(config);
	daemon.on("log", (msg) => win?.webContents.send("peer:log", msg));
	daemon.on("status", (status) => win?.webContents.send("peer:status", status));
	daemon.on("progress", (current, total) => win?.webContents.send("peer:progress", {
		current,
		total
	}));
	await daemon.start();
	return true;
});
ipcMain.handle("peer:stop", () => {
	if (daemon) {
		daemon.stop();
		daemon = null;
	}
	return true;
});
ipcMain.handle("network:peers", async (event, server, token) => {
	return await network.getPeers(server, token);
});
ipcMain.handle("network:tracks", async (event, server, token, sessionId) => {
	return await network.getPeerTracks(server, token, sessionId);
});
ipcMain.handle("network:download", async (event, server, token, sessionId, trackId, artist, title) => {
	return await network.downloadPeerTrack(server, token, sessionId, trackId, artist, title);
});
ipcMain.handle("network:catalog-tracks", async (event, server, token) => {
	return await network.getCatalogTracks(server, token);
});
ipcMain.handle("network:catalog-download", async (event, server, token, trackId, artist, title) => {
	return await network.downloadCatalogTrack(server, token, trackId, artist, title);
});
app.whenReady().then(() => {
	protocol.handle("media", (request) => {
		const filePath = decodeURIComponent(request.url.slice(8));
		return net.fetch(pathToFileURL(filePath).toString());
	});
	createWindow();
});
//#endregion
export {};
