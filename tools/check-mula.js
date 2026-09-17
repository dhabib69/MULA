const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const rel = (...parts) => path.join(root, ...parts);
const errors = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(rel(file), 'utf8');
}

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function ok(msg) {
  console.log(`ok - ${msg}`);
}

function parseJson(file) {
  try {
    JSON.parse(read(file));
    ok(`${file} parses`);
  } catch (err) {
    fail(`${file} does not parse: ${err.message}`);
  }
}

function nodeCheck(file) {
  try {
    new vm.Script(read(file), { filename: file });
    ok(`${file} syntax`);
  } catch (err) {
    fail(`${file} syntax failed: ${err.message}`);
  }
}

function unique(values) {
  return [...new Set(values)];
}

parseJson('package.json');
parseJson('firebase.json');
parseJson('database.rules.json');

const jsFiles = [
  'assets/js/01-platform.js',
  'assets/js/02-menu-data.js',
  'assets/js/03-app-state.js',
  'assets/js/04-dashboard.js',
  'assets/js/05-printing.js',
  'assets/js/06-checkout.js',
  'assets/js/07-guest-view.js',
  'assets/js/08-ai-analysis.js',
  'assets/js/mula-sw-register.js',
];
jsFiles.forEach(nodeCheck);

const index = read('index.html');
const localAssetRefs = [...index.matchAll(/(?:src|href)="\/([^"]+)"/g)]
  .map((m) => m[1].split('?')[0])
  .filter(Boolean);
for (const asset of localAssetRefs) {
  if (!fs.existsSync(rel(asset))) {
    fail(`index.html references missing local asset: /${asset}`);
  }
}
ok('index.html local asset references checked');

const queryVersions = unique([...index.matchAll(/[?&]v=(\d+)/g)].map((m) => m[1]));
if (queryVersions.length !== 1) {
  fail(`index.html must use one asset query version, found: ${queryVersions.join(', ') || 'none'}`);
} else {
  ok(`index.html asset version v${queryVersions[0]}`);
}

const sw = read('assets/js/mula-sw-register.js');
const swMatch = sw.match(/CACHE\s*=\s*['"]mula-v(\d+)['"]/);
if (!swMatch) {
  fail('service worker cache key mula-vNN not found');
} else {
  ok(`service worker cache mula-v${swMatch[1]}`);
}

const android = read('android-cashier/app/src/main/java/com/mula/cashier/MainActivity.kt');
const appVersionMatch = android.match(/APP_WEB_VERSION\s*=\s*(\d+)/);
if (!appVersionMatch) {
  fail('Android APP_WEB_VERSION not found');
} else {
  ok(`Android APP_WEB_VERSION ${appVersionMatch[1]}`);
}

if (queryVersions.length === 1 && swMatch && queryVersions[0] !== swMatch[1]) {
  fail(`index.html v${queryVersions[0]} does not match service worker mula-v${swMatch[1]}`);
}
if (queryVersions.length === 1 && appVersionMatch && queryVersions[0] !== appVersionMatch[1]) {
  fail(`index.html v${queryVersions[0]} does not match Android APP_WEB_VERSION ${appVersionMatch[1]}`);
}

const firebase = JSON.parse(read('firebase.json'));
if (firebase.functions) {
  fail('firebase.json defines functions; current MULA deploy boundary is Hosting + Database only');
}
if (firebase.hosting?.public !== '.') {
  warn(`firebase.json hosting.public is ${JSON.stringify(firebase.hosting?.public)}; routing memory expects "."`);
}
ok('Firebase deploy boundary checked');

const pkg = JSON.parse(read('package.json'));
if (!String(pkg.scripts?.deploy || '').includes('--only hosting,database')) {
  fail('package.json deploy script must stay Blaze-free: firebase deploy --only hosting,database');
}
if (!pkg.scripts?.check) {
  fail('package.json is missing npm run check');
}

if (!fs.existsSync(rel('assets/js/config.js'))) {
  fail('assets/js/config.js is missing locally; a Hosting deploy would leave the login screen unable to connect');
} else {
  ok('assets/js/config.js exists locally');
}

const platform = read('assets/js/01-platform.js');
const appState = read('assets/js/03-app-state.js');
const guestView = read('assets/js/07-guest-view.js');
if (!/var\s+firebaseBootError\s*=\s*null/.test(platform) || !/typeof\s+firebaseConfig/.test(platform)) {
  fail('01-platform.js must guard Firebase startup/config failures');
}
if (!/window\.mulaCoreEventsBound/.test(appState) || !/DOMContentLoaded',registerCoreEventListeners/.test(appState)) {
  fail('03-app-state.js must bind role controls once after DOMContentLoaded');
}
if (/^\s*registerCoreEventListeners\(\);/m.test(guestView)) {
  fail('07-guest-view.js must not bind core role controls independently');
}
ok('login startup regression guards checked');

if (!/subKitchenHistory/.test(read('assets/js/03-app-state.js'))) {
  fail('subKitchenHistory missing; Keuangan duration/history can break');
}
if (!/txId\s*={3}\s*['"]receipts['"]|txId\s*===\s*['"]receipts['"]/.test(read('assets/js/04-dashboard.js'))) {
  fail('04-dashboard.js should guard orders/{date}/receipts from transaction loops');
}
ok('known regression guards checked');

for (const msg of warnings) {
  console.warn(`warn - ${msg}`);
}

if (errors.length) {
  console.error('\nMULA check failed:');
  for (const msg of errors) console.error(`- ${msg}`);
  process.exit(1);
}

console.log('\nMULA check passed.');
