const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'node_modules/andrade-soulseek-downloader/dist/core/soulseek-downloader.js');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');

  // Disable expensive string matching
  content = content.replace(
    /return this\.matchesArtistAndTitle\(filenameWithoutExt,\s*options\.artist,\s*options\.title,\s*strictMatching\);/g,
    "return true; // Skip string matching filter entirely to avoid freezing"
  );

  content = content.replace(
    /result\.discoseekMatchingScore\s*=\s*\(0,\s*string_similarity_js_1\.stringSimilarity\)\(query\.toLowerCase\(\),\s*filenameWithoutExt\.toLowerCase\(\)\);/g,
    "result.discoseekMatchingScore = 0;"
  );

  fs.writeFileSync(file, content);
  console.log('patched matcher');
}

// A broad search floods thousands of small protocol messages in one socket
// burst. The bundled Messages.read() recurses once per message, overflowing
// the stack and crashing the Electron main process (exit 3489660927). Make it
// iterative.
const msgFile = path.join(process.cwd(), 'node_modules/andrade-soulseek-downloader/dist/slsk-client/messages.js');
if (fs.existsSync(msgFile)) {
  let content = fs.readFileSync(msgFile, 'utf8');
  content = content.replace(
    /read\(data\) \{[\s\S]*?\n    \}/,
    `read(data) {
        while (data.length >= 4) {
            const size = data.readUInt32LE(0);
            if (size + 4 > data.length)
                break;
            this.emit('message', new message_1.Message(data.slice(0, size + 4)));
            data = data.slice(size + 4);
        }
        this.rest = data.length > 0 ? data : undefined;
    }`
  );
  fs.writeFileSync(msgFile, content);
  console.log('patched message parser');
}

// A broad search (e.g. "Beethoven") makes hundreds/thousands of peers with
// matches send ConnectToPeer, and the client opens one TCP socket per peer with
// no limit -> the Electron main event loop starves and the app freezes. Cap the
// number of concurrent result-peer sockets. Downloads use the type 'F' path,
// which bypasses the peers map, so they are unaffected.
// ponytail: fixed cap of 75; if broad searches still return too few results, raise it.
const clientFile = path.join(process.cwd(), 'node_modules/andrade-soulseek-downloader/dist/slsk-client/slsk-client.js');
if (fs.existsSync(clientFile)) {
  let content = fs.readFileSync(clientFile, 'utf8');
  content = content.replace(
    /(default: \{\s*)(peers\[peer\.user\] = new default_peer_1\.DefaultPeer\(net\.createConnection\(\{)/,
    "$1if (Object.keys(peers).length >= 75) return; // cap result-peer sockets to avoid event-loop starvation on broad searches\n                $2"
  );

  // Don't join the distributed search network. As a downloader we don't need to
  // relay other users' searches; each DistributedPeer forwards the WHOLE
  // network's queries to us (code 3), which accumulate unbounded in
  // stack.peerSearchRequests with a linear indexOf dedup (O(n^2) over time) and
  // run shared.search per query -> the app freezes after sitting idle a while.
  content = content.replace(
    /(case 'D': \{)([\s\S]*?)(peers\[peer\.user\] = new distributed_peer_1\.DistributedPeer)/,
    "$1 return; // ponytail: skip distributed-search membership; it firehoses us with the network's queries and freezes the app when idle$2$3"
  );

  fs.writeFileSync(clientFile, content);
  console.log('patched peer cap + distributed skip');
}
