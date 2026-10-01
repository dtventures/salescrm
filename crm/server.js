const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./lib/config');
const store = require('./lib/store');
const flows = require('./lib/flows');
const { syncMail } = require('./lib/sync');

const config = loadConfig();
const INDEX = path.join(__dirname, 'public', 'index.html');

// One copy of the data lives in memory and is written to disk after every change,
// so a sync in progress and an approval made meanwhile never overwrite each other.
const data = store.load(config.dataFile);
let syncing = null;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function persist() {
  store.save(config.dataFile, data);
}

function evaluateFlows() {
  const added = flows.evaluate(data, store.view(data).people);
  if (added.length) log(`${added.length} leads waiting for your approval`);
}

// Only one sync runs at a time; a second request waits on the one in flight.
function runSync() {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!process.env.NO_SYNC) {
      try {
        const { added, replies } = await syncMail(data, config, log);
        data.sync = { ...data.sync, lastSyncAt: new Date().toISOString(), lastError: '' };
        if (added || replies) log(`Recorded ${added} sent emails and ${replies} replies`);
      } catch (err) {
        data.sync = { ...data.sync, lastError: err.message };
        log(`Sync failed: ${err.message}`);
      }
    }
    evaluateFlows();
    persist();
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

function currentView() {
  const base = store.view(data);
  return { ...base, ...flows.pipelineView(data, base), syncing: Boolean(syncing), logos: config.companyLogos };
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1e6) throw new Error('Body too large');
  }
  return raw ? JSON.parse(raw) : {};
}

const NOT_FOUND = Symbol('not found');

// Changes are made through these routes. Each returns the full, updated view.
const actions = [
  ['POST', /^\/api\/sync$/, () => runSync()],
  ['POST', /^\/api\/flows$/, (m, body) => { flows.createFlow(data, body); evaluateFlows(); }],
  ['PUT', /^\/api\/flows\/(\w+)$/, ([, id], body) => {
    if (!flows.updateFlow(data, id, body)) return NOT_FOUND;
    evaluateFlows();
  }],
  ['DELETE', /^\/api\/flows\/(\w+)$/, ([, id]) => { flows.deleteFlow(data, id); }],
  ['POST', /^\/api\/enrollments\/(\w+)\/(approve|dismiss)$/, ([, id, verb]) => {
    if (!flows.decide(data, id, verb === 'approve')) return NOT_FOUND;
  }],
  ['POST', /^\/api\/enrollments\/(approve|dismiss)-all$/, ([, verb], body) => {
    for (const id of body.ids || []) flows.decide(data, id, verb === 'approve');
  }],
  ['PATCH', /^\/api\/deals\/([^/]+)$/, ([, key], body) => {
    if (!flows.updateDeal(data, decodeURIComponent(key), body)) return NOT_FOUND;
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return fs.createReadStream(INDEX).pipe(res);
  }
  if (req.method === 'GET' && url.pathname === '/api/data') return send(res, 200, currentView());

  const route = actions.find(([method, re]) => method === req.method && re.test(url.pathname));
  if (!route) return send(res, 404, { error: 'Not found' });

  // Another website open in your browser must not be able to change your data:
  // require JSON (browsers won't send that cross-site without permission) and a local origin.
  const origin = req.headers.origin;
  if (!String(req.headers['content-type']).startsWith('application/json') || (origin && new URL(origin).host !== req.headers.host)) {
    return send(res, 403, { error: 'Forbidden' });
  }
  try {
    const result = await route[2](url.pathname.match(route[1]), await readJson(req));
    if (result === NOT_FOUND) return send(res, 404, { error: 'Not found' });
    persist();
    return send(res, 200, currentView());
  } catch (err) {
    return send(res, 400, { error: err.message });
  }
});

// Bound to localhost only: the CRM holds your contacts and has no login.
server.listen(config.port, '127.0.0.1', () => {
  log(`CRM running at http://localhost:${config.port}`);
  if (process.env.NO_SYNC) log('Mail sync off (NO_SYNC is set)');
  else log(`Syncing ${config.imap.user || '(no account set)'} every ${config.syncIntervalMinutes} min`);
  runSync();
  // Flows are re-checked on every pass too, since "gone quiet" depends on the clock.
  setInterval(runSync, config.syncIntervalMinutes * 60000);
});
