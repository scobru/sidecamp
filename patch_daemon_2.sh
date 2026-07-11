<<<<<<< SEARCH
    private handleRequest(requestId: string, trackId: string) {
        const track = this.fileIndex.get(trackId);
        if (!track || !fs.existsSync(track.path)) {
            this.ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: 'File non trovato' }));
            return;
        }

        this.emit("log", `Streaming/Download richiesto: ${track.title} [Req: ${requestId}]`);
=======
    private async handleRequest(requestId: string, trackId: string) {
        const track = this.fileIndex.get(trackId);
        if (!track) {
            this.ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: 'File non trovato' }));
            return;
        }
        try {
            await fs.promises.access(track.path);
        } catch {
            this.ws?.send(JSON.stringify({ type: 'chunk_error', requestId, message: 'File non trovato' }));
            return;
        }

        this.emit("log", `Streaming/Download richiesto: ${track.title} [Req: ${requestId}]`);
>>>>>>> REPLACE
