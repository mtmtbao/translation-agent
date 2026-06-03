const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const PORT = Number(process.env.PORT || 8787);
const ROOT = path.join(__dirname, 'src');
const ENV_PATH = path.join(__dirname, '.env');

if (fs.existsSync(ENV_PATH)) {
  fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/).forEach(line => {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2_000_000) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function callOpenAI(apiKey, prompt) {
  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${apiKey}`,
      },
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function handleChat(req, res) {
  try {
    const { apiKey, prompt } = await readJson(req);
    const key = (process.env.OPENAI_API_KEY || apiKey || '').trim();
    if (!key) {
      send(res, 401, JSON.stringify({ error: { message: 'Missing OpenAI API key. Add it in Settings or set OPENAI_API_KEY.' } }));
      return;
    }
    if (!prompt) {
      send(res, 400, JSON.stringify({ error: { message: 'Missing translation prompt.' } }));
      return;
    }

    const upstream = await callOpenAI(key, prompt);
    send(res, upstream.status || 502, upstream.body);
  } catch (err) {
    send(res, 500, JSON.stringify({ error: { message: err.message || 'Proxy error' } }));
  }
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  if (pathname.startsWith('/src/')) pathname = pathname.slice(4);
  const filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, 'Not found', 'text/plain; charset=utf-8');
      return;
    }
    send(res, 200, data, TYPES[path.extname(filePath)] || 'application/octet-stream');
  });
}

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, JSON.stringify({ ok: true }));
    return;
  }
  if (req.method === 'GET' && req.url === '/api/status') {
    send(res, 200, JSON.stringify({ hasServerKey: Boolean((process.env.OPENAI_API_KEY || '').trim()) }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/chat') {
    handleChat(req, res);
    return;
  }
  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }
  send(res, 405, 'Method not allowed', 'text/plain; charset=utf-8');
}).listen(PORT, () => {
  console.log(`TranslateAI running at http://localhost:${PORT}`);
});
