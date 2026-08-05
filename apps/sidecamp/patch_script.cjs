const fs = require('fs');
const path = require('path');

// npm runs this postinstall with cwd = apps/sidecamp, but in the workspaces
// monorepo andrade-soulseek-downloader is hoisted to the root node_modules —
// a cwd-relative path silently matches nothing and every patch below is skipped.
// Resolve the package instead of guessing where it landed.
let pkgRoot;
try {
  pkgRoot = path.dirname(require.resolve('andrade-soulseek-downloader/package.json', { paths: [__dirname] }));
} catch {
  console.warn('patch_script: andrade-soulseek-downloader not installed, nothing to patch');
  process.exit(0);
}

// Every patch here fixes a main-process freeze or crash. A regex that stops
// matching (upstream refactor) must be loud, not silent — a silently skipped
// patch is indistinguishable from a working one until the app hangs.
function patch(relPath, label, edits) {
  const file = path.join(pkgRoot, relPath);
  if (!fs.existsSync(file)) {
    console.warn(`patch_script: MISSING ${relPath} — "${label}" not applied`);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  for (const [find, replace] of edits) {
    const next = content.replace(find, replace);
    if (next === content) {
      console.warn(`patch_script: NO MATCH in ${relPath} for "${label}" — patch not applied`);
    }
    content = next;
  }
  fs.writeFileSync(file, content);
  console.log(`patched ${label}`);
}

patch('dist/core/soulseek-downloader.js', 'matcher', [
  // Disable expensive string matching
  [
    /return this\.matchesArtistAndTitle\(filenameWithoutExt,\s*options\.artist,\s*options\.title,\s*strictMatching\);/g,
    'return true; // Skip string matching filter entirely to avoid freezing'
  ],
  [
    /result\.discoseekMatchingScore\s*=\s*\(0,\s*string_similarity_js_1\.stringSimilarity\)\(query\.toLowerCase\(\),\s*filenameWithoutExt\.toLowerCase\(\)\);/g,
    'result.discoseekMatchingScore = 0;'
  ],
]);

// A broad search floods thousands of small protocol messages in one socket
// burst. The bundled Messages.read() recurses once per message, overflowing
// the stack and crashing the Electron main process (exit 3489660927). Make it
// iterative.
patch('dist/slsk-client/messages.js', 'message parser', [
  [
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
  ],
]);

patch('dist/slsk-client/slsk-client.js', 'peer cap + distributed skip', [
  // A broad search (e.g. "Beethoven") makes hundreds/thousands of peers with
  // matches send ConnectToPeer, and the client opens one TCP socket per peer with
  // no limit -> the Electron main event loop starves and the app freezes. Cap the
  // number of concurrent result-peer sockets. Downloads use the type 'F' path,
  // which bypasses the peers map, so they are unaffected.
  // ponytail: fixed cap of 75; if broad searches still return too few results, raise it.
  [
    /(default: \{\s*)(peers\[peer\.user\] = new default_peer_1\.DefaultPeer\(net\.createConnection\(\{)/,
    '$1if (Object.keys(peers).length >= 75) return; // cap result-peer sockets to avoid event-loop starvation on broad searches\n                $2'
  ],
  // Don't join the distributed search network. As a downloader we don't need to
  // relay other users' searches; each DistributedPeer forwards the WHOLE
  // network's queries to us (code 3), which accumulate unbounded in
  // stack.peerSearchRequests with a linear indexOf dedup (O(n^2) over time) and
  // run shared.search per query -> the app freezes after sitting idle a while.
  [
    /(case 'D': \{)([\s\S]*?)(peers\[peer\.user\] = new distributed_peer_1\.DistributedPeer)/,
    "$1 return; // ponytail: skip distributed-search membership; it firehoses us with the network's queries and freezes the app when idle$2$3"
  ],
]);
