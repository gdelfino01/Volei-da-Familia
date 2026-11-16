import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const pastaApp = fileURLToPath(new URL('../app/', import.meta.url));

function arquivos(dir){
  return readdirSync(dir).flatMap(n => {
    const c = join(dir, n);
    return statSync(c).isDirectory() ? arquivos(c) : [relative(pastaApp, c).split(sep).join('/')];
  });
}

test('o service worker guarda todos os arquivos do app para uso sem internet', () => {
  const sw = readFileSync(join(pastaApp, 'sw.js'), 'utf8');
  const lista = JSON.parse(sw.match(/const ARQUIVOS = (\[[\s\S]*?\]);/)[1]);
  const esperados = arquivos(pastaApp).filter(a => a !== 'sw.js').sort();
  assert.deepEqual(lista.filter(a => a !== './').sort(), esperados);
});
