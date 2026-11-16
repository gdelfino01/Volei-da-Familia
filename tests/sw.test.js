import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));

function arquivos(dir){
  return readdirSync(dir).flatMap(n => {
    const c = join(dir, n);
    return statSync(c).isDirectory() ? arquivos(c) : [relative(raiz, c).split(sep).join('/')];
  });
}

test('o service worker guarda todos os arquivos do app para uso sem internet', () => {
  const sw = readFileSync(join(raiz, 'sw.js'), 'utf8');
  const lista = JSON.parse(sw.match(/const ARQUIVOS = (\[[\s\S]*?\]);/)[1]);
  const esperados = ['index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png']
    .concat(arquivos(join(raiz, 'css')), arquivos(join(raiz, 'js'))).sort();
  assert.deepEqual(lista.filter(a => a !== './').sort(), esperados);
});
