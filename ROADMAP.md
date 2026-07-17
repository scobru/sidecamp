# Sidecamp & Graph: Architectural Roadmap

Questo documento delinea la visione a lungo termine per lo sviluppo del motore di mixaggio visivo "Graph" e la sua evoluzione rispetto al client Sidecamp.

> **Stato (v0.12.0):** Fase 1 e Fase 2 completate — il repo è un monorepo npm workspaces e Graphofone esiste come app standalone. Fase 3 in corso.

## La Sfida Architetturale

Fino alla v0.11.0, il Grafo (ispirato al workflow di layering di Richie Hawtin) e il motore Web Audio a bassa latenza vivevano all'interno di Sidecamp.

### Pro dell'approccio "Monolito" (Stato Attuale)
* **Frictionless Workflow:** Una traccia scaricata è immediatamente utilizzabile nel Grafo, senza necessità di export o import manuale.
* **Metadati Condivisi:** Sidecamp calcola già BPM, Camelot Key e genere. Il Grafo attinge direttamente a questi dati.
* **Velocità di iterazione:** Un solo repository, una sola build, nessuna comunicazione IPC complessa tra app diverse.

### Contro
* **Risorse e Glitch Audio:** Il Web Audio API richiede un thread ininterrotto. Se il client P2P satura il disco, la rete o il main thread, l'audio rischia drop-out (inaccettabile in un live set).
* **UX/UI Sovraccaricata:** Interfacce per il download e interfacce per la performance dal vivo hanno esigenze cognitive opposte.
* **Target Differenti:** Il target P2P e il target "Pro DJ" spesso non coincidono.

---

## La Strategia: Da "Monolith First" a Ecosistema Modulare

La roadmap segue il principio ingegneristico di massimizzare la velocità di scoperta iniziale, per poi stabilizzare e isolare i componenti critici.

### Fase 1: Prototipazione nel Monolito ✅ (completata in v0.11.0)
* **Obiettivo:** Convalidare l'idea, trovare il "fun factor" e consolidare le meccaniche del Grafo.
* **Azione:** Mantenere tutto dentro Sidecamp.
* **Regola Architetturale:** Scrivere il codice di `GraphView` e dell'Audio Engine in modo "ignorante". Devono ricevere solo dati audio (URL/Blob) ed essere totalmente disaccoppiati dalla logica di rete o dal concetto di P2P.

### Fase 2: Transizione a Monorepo ✅ (completata in v0.12.0)
* **Obiettivo:** Disaccoppiamento strutturale.
* **Struttura realizzata (npm workspaces):**
  * `packages/audio-engine`: Logica DSP pura (playback, warp, crossfade, worklets).
  * `packages/graph-ui`: Componenti React visivi (GraphView, TransitionWave).
  * `apps/sidecamp`: App principale, importa i pacchetti.
  * `apps/graphofone`: App live standalone (vedi Fase 3).

### Fase 3: Stand-alone App per Live Performance 🚧 (in corso)
* **Obiettivo:** Rilasciare uno strumento professionale "club-ready" focalizzato sul live.
* **Fatto in v0.12.0:**
  * App `Graphofone` standalone: libreria locale, grafo, transizioni, recording — zero P2P/rete.
  * Tema dark/light coerente e quick tour onboarding al primo avvio.
* **Feature previste:**
  * Analisi e importazione nativa da database esterni (Rekordbox, Traktor).
  * Supporto controller fisici tramite Web MIDI API.
  * Routing audio avanzato (Master Out vs Cue Out per pre-ascolto).
