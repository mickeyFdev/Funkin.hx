const fs = require('fs');
const treePath = process.argv[2] || '/tmp/kade-tree-latest.json';
const tree = JSON.parse(fs.readFileSync(treePath, 'utf8')).tree || [];
const CDN = 'https://cdn.jsdelivr.net/gh/KadeArchive/Kade-Engine@stable/';
const libraries = ['songs', 'shared', 'week1', 'week2', 'week3', 'week4', 'week5', 'week6', 'tutorial', 'sm'];
const typeFor = path => {
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(path)) return 'IMAGE';
  if (/\.(mp3|ogg|wav|flac|m4a)$/i.test(path)) return /\/music\//i.test(path) ? 'MUSIC' : 'SOUND';
  if (/\.(ttf|otf|woff2?)$/i.test(path)) return 'FONT';
  if (/\.(txt|json|xml|hx|lua|hscript|md)$/i.test(path)) return 'TEXT';
  return 'BINARY';
};
fs.mkdirSync('manifest', {recursive: true});
for (const library of libraries) {
  const prefix = `assets/${library}/`;
  const assets = tree.filter(x => x.type === 'blob' && x.path.startsWith(prefix) && !(/\.ogg$/i.test(x.path)))
    .map(x => ({
      id: x.path,
      path: CDN + x.path,
      type: typeFor(x.path),
      preload: false,
      size: 1
    }));
  const manifest = {version: 2, libraryType: null, libraryArgs: [], name: library, assets, rootPath: null};
  fs.writeFileSync(`manifest/${library}.json`, JSON.stringify(manifest));
  console.log(`${library}: ${assets.length}`);
}
