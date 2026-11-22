# Sidecamp: Architectural Roadmap

Questo documento delinea la visione a lungo termine per lo sviluppo del client desktop Sidecamp e della CLI.

## Visione & Obiettivi

Sidecamp è il compagno desktop per TuneCamp, dedicato all'acquisizione di contenuti P2P (Soulseek, torrent, YouTube/yt-dlp, Internet Archive), all'organizzazione della libreria locale e alla condivisione decentralizzata dei file tramite tunnel inverso WebSocket e WebRTC.

### Componenti Principali

1. **`apps/sidecamp`**: Applicazione Electron (Desktop Windows, macOS, Linux).
2. **`apps/sidecamp-cli`**: Client da riga di comando per server e ambienti headless (daemon di condivisione `sidecamp share`, download, upload).

### Aree di Sviluppo

- **P2P & Sharing**: Ottimizzazione del peering WebRTC DataChannels e gestione flessibile dei permessi per cartella.
- **Desktop UX**: Interfaccia compatta e minimale ottimizzata per flussi di lavoro desktop.

