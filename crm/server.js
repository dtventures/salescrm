const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loadConfig } = require('./lib/config');
const store = require('./lib/store');
const { syncSent } = require('./lib/sync');

const config = loadConfig();
const INDEX = path.join(__dirname, 'public', 'index.html');
let syncing = null;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

// Only one sync runs at a time; a second request waits on the one in flight.
function runSync() {
  if (syncing) return syncing;
  syncing = (async () => {
    const data = store.load(config.dataFile);
    try {
      const added = await syncSent(data, config, log);
      data.sync = { ...data.sync, lastSyncAt: new Date().toISOString(), lastError: '' };
      if (added) log(`Recorded ${added} new sent emails`);
    } catch (err) {
      data.sync = { ...data.sync, lastError: err.message };
      log(`Sync failed: ${err.message}`);
    }
    store.save(config.dataFile, data);
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}

function sendJson(res, body) {
  res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function currentView() {
  return { ...store.view(store.load(config.dataFile)), syncing: Boolean(syncing), logos: config.companyLogos };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return fs.createReadStream(INDEX).pipe(res);
  }
  if (req.method === 'GET' && url.pathname === '/api/data') return sendJson(res, currentView());
  if (req.method === 'POST' && url.pathname === '/api/sync') {
    if (!process.env.NO_SYNC) await runSync();
    return sendJson(res, currentView());
  }
  res.writeHead(404).end('Not found');
});

// Bound to localhost only: the CRM holds your contacts and has no login.
server.listen(config.port, '127.0.0.1', () => {
  log(`CRM running at http://localhost:${config.port}`);
  if (process.env.NO_SYNC) return log('Auto-sync off (NO_SYNC is set)');
  log(`Syncing ${config.imap.user || '(no account set)'} every ${config.syncIntervalMinutes} min`);
  runSync();
  setInterval(runSync, config.syncIntervalMinutes * 60000);
});
