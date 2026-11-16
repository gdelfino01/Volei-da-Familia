/* O app saiu de /app/ e foi para a raiz do site.
   Celulares que abriram a versão antiga têm um service worker registrado em /app/.
   Quando ele procura atualização, recebe este arquivo: apaga as cópias guardadas e se desliga. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter(k => k.startsWith('vf-app-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const abertas = await self.clients.matchAll({ type: 'window' });
    abertas.forEach(c => c.navigate('../'));
  })());
});
