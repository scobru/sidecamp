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
  console.log('patched');
}
