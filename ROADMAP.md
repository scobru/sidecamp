# Sidecamp & Graph: Architectural Roadmap

Questo documento delinea la visione a lungo termine per lo sviluppo del motore di mixaggio visivo "Graph" e la sua evoluzione rispetto al client Sidecamp.

> **Stato (v0.16.0):** Fase 1 e Fase 2 completate — il repo è un monorepo npm workspaces, `graphofone` esiste come app standalone ed è integrata con `tunecamp-design-system`. Fase 3 in avanzamento.

## La Sfida Architetturale

Fino alla v0.11.0, il Grafo (ispirato al workflow di layering di Richie Hawtin) e il motore Web Audio a bassa latenza vivevano all'interno di Sidecamp.

### Pro dell'approccio "Monolito" (Stato Attuale)
* **Frictionless Workflow:** Una traccia scaricata è immediatamente utilizzabile nel Grafo, senza necessità di export o import manuale.
* **Metadati Condivisi:** Sidecamp calcola già BPM, Camelot Key e genere. Il Grafo attinge direttamente a questi dati.
* **Velocità di iterazione:** Un solo repository, una sola build, nessuna comunicazione IPC complessa tra app diverse.

### Contro
* **Risorse e Glitch Audio:** Il Web Audio API richiede un thread ininterrotto. Se il client P2P satura il disco, la rete o il main thread, l'audio rischia drop-out (inaccettabile in un live set).
* **UX/UI Sovraccaricata:** Interfacce per il download e interfacce per la performance dal vivo hanno esigenze cognitive opposte.
* **Target Differenti:** Il target P2P e il target "Pro DJ" spesso non coincide.

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
  * `packages/tunecamp-design-system`: Design tokens e componenti UI condivisi.
  * `apps/sidecamp`: App principale, importa i pacchetti.
  * `apps/graphofone`: App live standalone.

### Fase 3: Stand-alone App per Live Performance 🚧 (in corso - v0.16.0)
* **Obiettivo:** Rilasciare uno strumento professionale "club-ready" focalizzato sul live.
* **Gia Implementato (v0.12.0 - v0.16.0):** ✅
  * App `Graphofone` standalone: libreria locale, grafo, transizioni, recording — zero P2P/rete.
  * Tema dark/light coerente, onboarding quick tour e integrazione tokens/componenti `tunecamp-design-system`.
  * Layout mixer verticale in stile Ableton con selezioni strip/nodi sincronizzate.
  * Routing audio con pre-ascolto cuffie (Cue Out vs Master Out con cue volume dedicato).
  * Presets EQ per singolo nodo e strip mixer.
  * Loop clip quantizzati, punti Cue-In/Out su ogni nodo e zoom forma d'onda al cursore.
  * Animazioni audio-reattive dei nodi e playhead circolari/di crossfade.
* **Feature previste da completare in Fase 3:** 🚧
  * Analisi e importazione nativa da database esterni (Rekordbox, Traktor).
  * Supporto completo controller fisici tramite Web MIDI API (MIDI learn & mapping).

### Fase 4: Generazione & Synth Nodes (VST / WAM + Piano Roll) 🔮 (Pianificato)
* **Obiettivo:** Trasformare il Grafo in un ambiente ibrido DJing/Live-Produzione, combinando tracce audio con sintesi in tempo reale.
* **Nodi VST / Web Audio Modules (WAM):**
  * Supporto per nodi strumentali/effetto con caricamento di plugin (standard WAM v2 / WASM / VST hosted).
  * Gestione parametri e automazioni per nodo strumento.
* **MIDI Clip Editor & Piano Roll:**
  * Possibilità di creare e modificare MIDI clip direttamente nei nodi VST/Synth.
  * Piano Roll integrato per la stesura di melodie, linee di basso e pattern ritmici quantizzati.
  * Sincronizzazione al clock del Grafo/BPM master con supporto per trigger e loop di clip MIDI.
