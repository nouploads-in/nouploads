import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { tmpdir } from 'node:os';

export async function localChrome(directory, { cleanUrls = false } = {}) {
  const base = resolve(directory);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const overrides = new Map();
  const setResponse = (path, body) => overrides.set(path, body);
  const server = createServer(async (request, response) => {
    let path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (cleanUrls && /.html$/.test(path)) { response.writeHead(308, { Location: path.replace(/(?:index)?.html$/, '') || '/' }).end(); return; }
    if (cleanUrls && !path.endsWith('/') && !extname(path)) path += '.html';
    if (path.endsWith('/')) path += 'index.html';
    const target = resolve(base, '.' + path);
    if (!target.startsWith(base + sep)) { response.writeHead(403).end(); return; }
    try {
      const bytes = overrides.get(path) ?? await readFile(target);
      const headers = { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'X-Frame-Options': 'DENY' };
      if (path === '/sw.js') headers['Content-Security-Policy'] = "default-src 'none'; script-src 'self'; connect-src 'self'";
      if (path.includes('/assets/')) headers['Content-Security-Policy'] = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'";
      response.writeHead(200, headers).end(bytes);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profile = await mkdtemp(resolve(tmpdir(), 'noupload-chrome-'));
  const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-gpu-sandbox', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-features=BackForwardCache', '--no-first-run', '--no-default-browser-check', '--metrics-recording-only', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { windowsHide: true, stdio: ['ignore','ignore','pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    chrome.stderr.on('data', chunk => {  output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) resolve(match[1]); });
    chrome.on('error', reject);
    chrome.on('exit', code => reject(new Error('Chrome exited: ' + code)));
    setTimeout(() => reject(new Error('Chrome startup timeout')), 20000).unref();
  });
  const debug = new URL(endpoint);
  const targets = await fetch('http://' + debug.host + '/json/list').then(response => response.json());
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once:true }); socket.addEventListener('error', reject, { once:true }); });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
    } else for (const listener of listeners.get(message.method) || []) listener(message.params);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, {resolve, reject}); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise:true, returnByValue:true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const wait = async expression => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('Timed out: ' + expression);
  };
  const navigate = async path => { await send('Page.navigate', { url: origin + path }); await wait('document.readyState === "complete" && location.pathname === ' + JSON.stringify(path)); };
  const on = (method, listener) => listeners.set(method, [...(listeners.get(method) || []), listener]);
  let serverStopped = false;
  const stopServer = async () => { if (!serverStopped) { serverStopped = true; await new Promise(resolve => server.close(resolve)); } };
  const close = async () => { socket.close(); chrome.kill(); await stopServer(); await new Promise(resolve => setTimeout(resolve, 300)); await rm(profile, {recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(() => {}); };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  return { origin, send, evaluate, wait, navigate, on, close, stopServer, setResponse };
}
