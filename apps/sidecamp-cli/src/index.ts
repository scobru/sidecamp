#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { loadConfig, saveConfig, requireServerAuth, downloadDir } from './config.js';
import { NetworkService } from '../../sidecamp/electron/providers/network.js';
import { YtdlpService } from '../../sidecamp/electron/providers/ytdlp.js';
import { TorrentService } from '../../sidecamp/electron/providers/torrent.js';
import { SoulseekService } from '../../sidecamp/electron/providers/soulseek.js';
import {
    searchSoundCloud,
    searchBandcamp,
    searchArchiveOrg,
    searchTorrents,
} from '../../sidecamp/electron/providers/search.js';
import { TuneCampUploader } from '../../sidecamp/electron/uploader/index.js';
import { PeerDaemon } from '../../sidecamp/electron/peer/daemon.js';

function extractString(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number') return String(val);
    if (typeof val === 'object') {
        if (val.name) return String(val.name);
        if (val.title) return String(val.title);
    }
    return String(val);
}

const program = new Command();
program.name('sidecamp').description('Headless TuneCamp client — search, download, upload, library, peer daemon sharing & federation.');

program
    .command('login <server> <username> <password>')
    .description('Authenticate against a TuneCamp instance and save the JWT locally')
    .action(async (server, username, password) => {
        const network = new NetworkService(downloadDir(loadConfig()));
        const result = await network.authConnect(server, 'login', username, password);
        const config = loadConfig();
        config.server = server;
        config.token = result.token;
        saveConfig(config);
        console.log(`Logged in as ${username} on ${server}`);
    });

program
    .command('share')
    .alias('daemon')
    .alias('start-peer')
    .description('Start the P2P sharing daemon to index and share local folders with your TuneCamp network')
    .option('-f, --folder <folders...>', 'local folder(s) to share (defaults to sidecamp download folder)')
    .option('--no-downloads', 'allow streaming only, disable file downloads')
    .action(async (opts) => {
        const config = loadConfig();
        const { server, token } = requireServerAuth(config);
        const folders = opts.folder && opts.folder.length > 0 ? opts.folder : [downloadDir(config)];

        const peer = new PeerDaemon({
            server,
            token,
            folders,
            allowDownloads: opts.downloads !== false
        });

        peer.on('log', (msg: string) => console.log(`[PeerDaemon] ${msg}`));
        peer.on('status', (status: string) => console.log(`[Status] ${status}`));
        peer.on('progress', (cur: number, total: number) => {
            if (cur % 50 === 0 || cur === total) {
                console.log(`[Scan] ${cur}/${total} tracks indexed`);
            }
        });

        console.log(`Starting Peer Daemon on ${server}...`);
        console.log(`Shared folders: ${folders.join(', ')}`);
        console.log(`Allow downloads: ${opts.downloads !== false}`);
        console.log('Daemon running. Press Ctrl+C to stop sharing.\n');

        await peer.start();

        process.on('SIGINT', () => {
            console.log('\nStopping Peer Daemon...');
            peer.stop();
            process.exit(0);
        });

        await new Promise(() => {});
    });

program
    .command('search <query>')
    .description('Search a source: youtube (default), soundcloud, bandcamp, archive, torrent, library')
    .option('-s, --source <source>', 'source to search', 'youtube')
    .action(async (query, opts) => {
        const results = await runSearch(opts.source, query);
        console.table(results.map(r => ({
            title: extractString(r.title),
            artist: extractString(r.artist),
            source: r.source,
            url: r.url || r.id
        })));
    });

program
    .command('library [query]')
    .alias('catalog')
    .description('View or search tracks in your TuneCamp instance library')
    .action(async (query?: string) => {
        const { server, token } = requireServerAuth(loadConfig());
        const network = new NetworkService(downloadDir(loadConfig()));
        let tracks = await network.getCatalogTracks(server, token);
        if (query) {
            const q = query.toLowerCase();
            tracks = tracks.filter((t: any) => {
                const title = extractString(t.title || t.filename).toLowerCase();
                const artist = extractString(t.artist || t.artistName).toLowerCase();
                const album = extractString(t.album || t.albumTitle).toLowerCase();
                return title.includes(q) || artist.includes(q) || album.includes(q);
            });
        }
        if (!tracks || !tracks.length) {
            console.log('No tracks found matching query in instance library.');
            return;
        }
        console.table(tracks.map((t: any) => ({
            id: t.id,
            title: extractString(t.title || t.filename || 'Untitled'),
            artist: extractString(t.artist || t.artistName || 'Unknown Artist'),
            album: extractString(t.album || t.albumTitle || '-'),
            duration: t.duration ? `${Math.floor(t.duration / 60)}:${Math.floor(t.duration % 60).toString().padStart(2, '0')}` : '-'
        })));
    });

program
    .command('download-track <trackId>')
    .description('Download a track by ID from your TuneCamp instance library')
    .option('--artist <artist>', 'override artist name')
    .option('--title <title>', 'override track title')
    .action(async (trackId: string, opts) => {
        const { server, token } = requireServerAuth(loadConfig());
        const network = new NetworkService(downloadDir(loadConfig()));
        let artist = opts.artist || '';
        let title = opts.title || '';

        if (!artist || !title) {
            try {
                const tracks = await network.getCatalogTracks(server, token);
                const match = tracks.find((t: any) => String(t.id) === String(trackId));
                if (match) {
                    artist = artist || extractString(match.artist || match.artistName || 'Unknown Artist');
                    title = title || extractString(match.title || match.filename || `Track_${trackId}`);
                }
            } catch (e) {
                // fall back if catalog fetch fails
            }
        }

        artist = artist || 'Unknown Artist';
        title = title || `Track_${trackId}`;

        console.log(`Downloading track ${trackId} (${artist} - ${title})...`);
        const filePath = await network.downloadCatalogTrack(server, token, trackId, artist, title);
        console.log(`Downloaded to: ${filePath}`);
    });

program
    .command('get <query>')
    .description('Search and download the top result')
    .option('-s, --source <source>', 'source: youtube, soundcloud, bandcamp, archive, torrent, soulseek, library', 'youtube')
    .action(async (query, opts) => {
        const config = loadConfig();
        const dir = downloadDir(config);
        fs.ensureDirSync(dir);

        if (opts.source === 'library') {
            const { server, token } = requireServerAuth(config);
            const network = new NetworkService(dir);
            const tracks = await network.getCatalogTracks(server, token);
            const q = query.toLowerCase();
            const hit = tracks.find((t: any) => {
                const title = extractString(t.title || t.filename).toLowerCase();
                const artist = extractString(t.artist || t.artistName).toLowerCase();
                const album = extractString(t.album || t.albumTitle).toLowerCase();
                return title.includes(q) || artist.includes(q) || album.includes(q);
            });
            if (!hit) throw new Error(`No instance library results matching '${query}'`);
            const artist = extractString(hit.artist || hit.artistName || 'Unknown Artist');
            const title = extractString(hit.title || hit.filename || `Track_${hit.id}`);
            const filePath = await network.downloadCatalogTrack(server, token, String(hit.id), artist, title);
            console.log(`Downloaded: ${filePath}`);
            return;
        }

        if (opts.source === 'soulseek') {
            const soulseek = new SoulseekService(dir, dir);
            const connected = await soulseek.connect();
            if (!connected) throw new Error('Soulseek connect failed — set SLSK_USER/SLSK_PASS env vars');
            const results = await soulseek.search(query);
            if (!results.length) throw new Error('No Soulseek results');
            const filePath = await soulseek.download(results[0]);
            console.log(`Downloaded: ${filePath}`);
            return;
        }

        if (opts.source === 'torrent') {
            const [hit] = await searchTorrents(query);
            if (!hit) throw new Error('No torrent results');
            const torrent = new TorrentService(dir);
            torrent.on('log', (msg: string) => console.log(msg));
            const files = await torrent.download(hit.url);
            console.log(`Downloaded:\n${files.join('\n')}`);
            return;
        }

        // youtube, soundcloud, bandcamp, archive all resolve to a URL that yt-dlp can rip
        const [hit] = await runSearch(opts.source, query);
        if (!hit) throw new Error(`No ${opts.source} results`);
        const ytdlp = new YtdlpService(dir, path.join(dir, 'bin'));
        ytdlp.on('log', (msg: string) => console.log(msg));
        const filePath = await ytdlp.download(hit.url);
        console.log(`Downloaded: ${filePath}`);
    });

program
    .command('upload <filePath>')
    .description('Upload a local file to your TuneCamp account')
    .option('--artist <artist>')
    .option('--album <album>')
    .option('--release <releaseSlug>')
    .action(async (filePath, opts) => {
        const { server, token } = requireServerAuth(loadConfig());
        const uploader = new TuneCampUploader({ server, token });
        const result = await uploader.uploadTrack(filePath, {
            artist: opts.artist,
            album: opts.album,
            releaseSlug: opts.release,
        });
        console.log(result);
    });

program
    .command('peers')
    .description('List peers connected to your TuneCamp instance')
    .action(async () => {
        const { server, token } = requireServerAuth(loadConfig());
        const network = new NetworkService(downloadDir(loadConfig()));
        const peers = await network.getPeers(server, token);
        if (!peers || !peers.length) {
            console.log('No connected peers found.');
            return;
        }
        console.table(peers);
    });

program
    .command('peer-tracks <sessionId>')
    .description('List tracks shared by a connected peer')
    .option('--origin <origin>', 'peer origin URL if applicable')
    .action(async (sessionId: string, opts) => {
        const { server, token } = requireServerAuth(loadConfig());
        const network = new NetworkService(downloadDir(loadConfig()));
        const tracks = await network.getPeerTracks(server, token, sessionId, opts.origin);
        if (!tracks || !tracks.length) {
            console.log(`No tracks found for peer ${sessionId}`);
            return;
        }
        console.table(tracks.map((t: any) => ({
            id: t.id,
            title: extractString(t.title || t.filename || 'Untitled'),
            artist: extractString(t.artist || t.artistName || 'Unknown'),
            album: extractString(t.album || '-')
        })));
    });

program
    .command('download-peer-track <sessionId> <trackId>')
    .description('Download a track from a connected peer')
    .option('--origin <origin>', 'peer origin URL')
    .option('--artist <artist>', 'artist name', 'Peer Artist')
    .option('--title <title>', 'track title', 'Peer Track')
    .action(async (sessionId: string, trackId: string, opts) => {
        const { server, token } = requireServerAuth(loadConfig());
        const network = new NetworkService(downloadDir(loadConfig()));
        console.log(`Downloading track ${trackId} from peer ${sessionId}...`);
        const filePath = await network.downloadPeerTrack(
            server,
            token,
            sessionId,
            trackId,
            opts.artist,
            opts.title,
            opts.origin
        );
        console.log(`Downloaded to: ${filePath}`);
    });

program
    .command('community')
    .description('List community / federated sites connected to your TuneCamp server')
    .action(async () => {
        const config = loadConfig();
        const server = config.server || 'https://sudorecords.scobrudot.dev';
        const network = new NetworkService(downloadDir(config));
        const sites = await network.getCommunitySites(server);
        if (!sites || !sites.length) {
            console.log('No community sites found.');
            return;
        }
        console.table(sites);
    });

program
    .command('federated-catalog <origin>')
    .description('View public catalog of a remote federated TuneCamp instance')
    .action(async (origin: string) => {
        const network = new NetworkService(downloadDir(loadConfig()));
        const catalog = await network.getFederatedCatalog(origin);
        console.log(JSON.stringify(catalog, null, 2));
    });

program
    .command('download-federated-track <origin> <trackId>')
    .description('Download a public track from a federated instance')
    .option('--artist <artist>', 'artist name', 'Federated Artist')
    .option('--title <title>', 'track title', 'Federated Track')
    .action(async (origin: string, trackId: string, opts) => {
        const network = new NetworkService(downloadDir(loadConfig()));
        console.log(`Downloading federated track ${trackId} from ${origin}...`);
        const filePath = await network.downloadFederatedCatalogTrack(
            origin,
            trackId,
            opts.artist,
            opts.title
        );
        console.log(`Downloaded to: ${filePath}`);
    });

program
    .command('downloads')
    .description('List local files in your sidecamp download directory')
    .action(async () => {
        const config = loadConfig();
        const dir = downloadDir(config);
        if (!fs.existsSync(dir)) {
            console.log(`Download directory ${dir} does not exist.`);
            return;
        }
        const files = await fs.readdir(dir);
        const fileList = [];
        for (const file of files) {
            const full = path.join(dir, file);
            const stat = await fs.stat(full);
            if (stat.isFile()) {
                fileList.push({
                    name: file,
                    sizeMB: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
                    modified: stat.mtime.toLocaleString()
                });
            }
        }
        if (!fileList.length) {
            console.log('No downloaded files found.');
            return;
        }
        console.table(fileList);
    });

async function runSearch(source: string, query: string): Promise<any[]> {
    switch (source) {
        case 'youtube': {
            const ytdlp = new YtdlpService('', '');
            return ytdlp.search(query);
        }
        case 'soundcloud':
            return searchSoundCloud(query);
        case 'bandcamp':
            return searchBandcamp(query);
        case 'archive':
            return searchArchiveOrg(query);
        case 'torrent':
            return searchTorrents(query);
        case 'library': {
            const { server, token } = requireServerAuth(loadConfig());
            const network = new NetworkService(downloadDir(loadConfig()));
            const tracks = await network.getCatalogTracks(server, token);
            const q = query.toLowerCase();
            return (tracks || [])
                .filter((t: any) => {
                    const title = extractString(t.title || t.filename).toLowerCase();
                    const artist = extractString(t.artist || t.artistName).toLowerCase();
                    const album = extractString(t.album || t.albumTitle).toLowerCase();
                    return title.includes(q) || artist.includes(q) || album.includes(q);
                })
                .map((t: any) => ({
                    id: t.id,
                    title: extractString(t.title || t.filename),
                    artist: extractString(t.artist || t.artistName || 'Unknown'),
                    album: extractString(t.album || '-'),
                    source: 'library',
                    url: `track:${t.id}`
                }));
        }
        default:
            throw new Error(`Unknown source: ${source}`);
    }
}

if (process.argv.length <= 2) {
    program.outputHelp();
} else {
    program.parseAsync(process.argv).catch(err => {
        console.error(`Error: ${err.message}`);
        process.exit(1);
    });
}
