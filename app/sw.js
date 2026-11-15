/* ===== Service worker do app (escopo: só a pasta /app; o site dos uniformes não é afetado) =====
   Arquivos do app: rede primeiro (com limite de 3 s) e cópia guardada quando a internet falha.
   Fontes do Google: cópia guardada primeiro.
   Chamadas ao Apps Script nunca passam por aqui: os dados do placar ficam no localStorage.
   Ao mudar a lista de arquivos, aumente a versão. O teste tests/sw.test.js confere a lista. */

const VERSAO = 'vf-app-v2';
const ARQUIVOS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "css/app.css",
  "js/api.js",
  "js/config.js",
  "js/main.js",
  "js/mock.js",
  "js/placar-store.js",
  "js/seed.js",
  "js/store.js",
  "js/ui.js",
  "js/core/lista.js",
  "js/core/placar.js",
  "js/core/times.js",
  "js/core/util.js",
  "js/views/lista.js",
  "js/views/perfil.js",
  "js/views/placar.js",
  "js/views/ranking.js",
  "js/views/times.js"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(chaves => Promise.all(chaves.filter(k => k.startsWith('vf-app-') && k !== VERSAO).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function comLimite(promessa, ms){
  return Promise.race([promessa, new Promise((_, falha) => setTimeout(() => falha(new Error('lento')), ms))]);
}

async function redePrimeiro(req){
  const cache = await caches.open(VERSAO);
  try {
    const resp = await comLimite(fetch(req), 3000);
    if (resp.ok) cache.put(req, resp.clone());
    return resp;
  } catch (err){
    const guardada = await cache.match(req, { ignoreSearch: true });
    if (guardada) return guardada;
    if (req.mode === 'navigate') return cache.match('index.html');
    throw err;
  }
}

async function guardadoPrimeiro(req){
  const cache = await caches.open(VERSAO);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  const resp = await fetch(req);
  if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone());
  return resp;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin && u.pathname.startsWith(new URL(self.registration.scope).pathname)) {
    e.respondWith(redePrimeiro(req));
  } else if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(guardadoPrimeiro(req));
  }
});
