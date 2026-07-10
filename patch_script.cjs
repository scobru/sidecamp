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
