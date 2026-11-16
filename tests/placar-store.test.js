import { test } from 'node:test';
import assert from 'node:assert/strict';

/* Navegador mínimo para carregar o módulo no Node */
let falharGravacao = false;
const memoria = new Map();
globalThis.window = { addEventListener(){} };
globalThis.localStorage = {
  getItem: k => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => { if (falharGravacao) throw new Error('cheio'); memoria.set(k, String(v)); },
  removeItem: k => memoria.delete(k)
};

const PS = await import('../js/placar-store.js');

test('um ouvinte que se reinscreve durante o aviso não trava o app', () => {
  // A tela do placar faz isso: ao ser avisada, redesenha e se inscreve de novo.
  let chamadas = 0, cancelar;
  const ouvinte = () => { chamadas++; cancelar(); cancelar = PS.aoMudarEnvio(ouvinte); };
  cancelar = PS.aoMudarEnvio(ouvinte);
  falharGravacao = true;
  PS.guardar();            // falha ao gravar → avisa os ouvintes
  falharGravacao = false;
  assert.equal(chamadas, 1);
  assert.match(PS.envio.erro, /guardar no celular/);
  cancelar();
});

test('estado do domingo fica guardado e ids são únicos', () => {
  const e = PS.estadoDe('2026-11-22', 4);
  assert.deepEqual(e.fila, [1, 2, 3, 4]);
  assert.ok(memoria.get('vf-placar').includes('2026-11-22'));
  const ids = new Set(Array.from({ length: 200 }, () => PS.novoId('L')));
  assert.equal(ids.size, 200);
  assert.match(PS.novoId('P', '2026-11-22'), /^P20261122-[a-z0-9]{10}$/);
});
