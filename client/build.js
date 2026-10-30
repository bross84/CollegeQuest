// Bundles the client into public/: app.js (engine), pack-<id>.js (one per subject pack), styles.css, index.html.
// No dependencies. Run with `npm run build`.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = __dirname;
const out = path.join(root, '..', 'public');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8').replace(/\r\n/g, '\n');

const ENGINE = ['util', 'game', 'ui', 'overlay', 'reference', 'mine', 'materials', 'ask', 'ai-client', 'store', 'classes', 'dashboard', 'docs', 'study', 'videos', 'chapters', 'find', 'bank', 'sets', 'learn', 'settings', 'boot'];

const metas = fs.readdirSync(path.join(root, 'packs'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => JSON.parse(read('packs', d.name, 'meta.json')))
  .sort((a, b) => a.order - b.order);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const write = (name, s) => { fs.writeFileSync(path.join(out, name), s); return `${name}?v=${hash(s)}`; };

// Each pack is wrapped in its own function so two packs can use the same helper names.
const util = read('engine', 'util.js');
const packUrls = {};
metas.forEach((m) => {
  const body = [util, ...m.files.map((f) => read('packs', m.id, f))].join('\n');
  packUrls[m.id] = write(`pack-${m.id}.js`, `CQ.registerPack(${JSON.stringify(m.id)}, (function () {\n${body}\n})());\n`);
});

const publicMeta = metas.map(({ id, name, blurb, preset }) => ({ id, name, blurb, preset, url: packUrls[id] }));
const app = `var CQ = { packs: {}, meta: ${JSON.stringify(publicMeta)}, registerPack: function (id, p) { CQ.packs[id] = p; } };\n`
  + ENGINE.map((f) => read('engine', `${f}.js`)).join('\n');
const appUrl = write('app.js', app);
const cssUrl = write('styles.css', read('styles.css'));

fs.writeFileSync(path.join(out, 'index.html'), read('index.template.html').replace('{{CSS}}', cssUrl).replace('{{JS}}', appUrl));
console.log(`built ${metas.length} packs, app.js ${(app.length / 1024).toFixed(0)} KB`);
