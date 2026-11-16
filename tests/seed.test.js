import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SEED, CONFIG_PADRAO } from '../js/seed.js';

/* Carrega o Setup.gs no Node (as constantes do topo não dependem do Apps Script) */
const codigo = readFileSync(new URL('../backend/Setup.gs', import.meta.url), 'utf8');
const gs = vm.runInNewContext(codigo + '\n;({ SEED, CONFIG_PADRAO, ABAS })', {});

test('seed do modo demonstração é igual ao da planilha', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(gs.SEED)), SEED);
  assert.deepEqual(JSON.parse(JSON.stringify(gs.CONFIG_PADRAO)), CONFIG_PADRAO);
});

test('seed: 16 mensalistas (7 homens, 9 mulheres), notas de 1 a 5', () => {
  const mens = SEED.filter(s => s[3] === 'mensalista');
  assert.equal(mens.length, 16);
  assert.equal(mens.filter(s => s[1] === 'F').length, 9);
  assert.ok(SEED.every(s => s[2] >= 1 && s[2] <= 5));
});

test('abas da planilha seguem o modelo de dados', () => {
  assert.deepEqual([...Object.keys(gs.ABAS)], ['Jogadores', 'Domingos', 'Presencas', 'Times', 'Partidas', 'Lances', 'Notas', 'Config']);
  assert.deepEqual([...gs.ABAS.Lances], ['id', 'partida_id', 'seq', 'time', 'jogador_id', 'tipo', 'criado_em']);
});
