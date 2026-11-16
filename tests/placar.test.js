import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  novoEstado, iniciar, registrar, desfazer, encerrar, placar, vencedor, proximo, cancelarAtual, excluir, priorizar,
  pendentes, lote, confirmar, descreverLance, partidaAtual
} from '../js/core/placar.js';

let n = 0;
const id = () => 'X' + String(++n).padStart(6, '0');
const ponto = (e, time, tipo = 'ataque', jogador_id = '') => registrar(e, { time, tipo, jogador_id }, { id: id() });
const pontos = (e, time, qtd) => { for (let i = 0; i < qtd; i++) ponto(e, time); };

test('fila inicial e primeiro jogo', () => {
  const e = novoEstado('2026-11-22', 4);
  assert.deepEqual(proximo(e), [1, 2]);
  iniciar(e, 1, 2, { alvo: 15, id: id() });
  assert.deepEqual(e.fila, [3, 4]);
  assert.deepEqual(proximo(e), [null, 3]);
});

test('lances somam pontos e o vencedor sai ao atingir o alvo', () => {
  const e = novoEstado('d', 4);
  const p = iniciar(e, 1, 2, { alvo: 5, id: id() });
  pontos(e, 1, 4); pontos(e, 2, 3);
  ponto(e, 2, 'erro', 'J001');           // erro de um jogador do time 1 vira ponto do time 2
  assert.deepEqual(placar(p), { a: 4, b: 4 });
  assert.equal(vencedor(p), null);
  ponto(e, 1, 'ace', 'J002');
  assert.equal(vencedor(p), 1);
  assert.throws(() => ponto(e, 2), /já terminou/);
});

test('desfazer remove o último lance e reabre o jogo', () => {
  const e = novoEstado('d', 4);
  const p = iniciar(e, 1, 2, { alvo: 2, id: id() });
  pontos(e, 1, 2);
  assert.equal(vencedor(p), 1);
  desfazer(e);
  assert.equal(vencedor(p), null);
  assert.deepEqual(placar(p), { a: 1, b: 0 });
  ponto(e, 2);
  assert.equal(p.lances.at(-1).seq, 2, 'sequência continua depois do desfazer');
});

test('quem ganha fica: perdedor vai para o fim da fila', () => {
  const e = novoEstado('d', 4);
  iniciar(e, 1, 2, { alvo: 3, id: id() });
  pontos(e, 2, 3);
  assert.deepEqual(encerrar(e), [2, 3]);
  assert.deepEqual(e.fila, [3, 4, 1]);
  iniciar(e, 2, 3, { alvo: 3, id: id() });
  pontos(e, 3, 3);
  assert.deepEqual(encerrar(e), [3, 4]);
  assert.deepEqual(e.fila, [4, 1, 2]);
  assert.equal(partidaAtual(e), null);
  assert.deepEqual(e.partidas.map(p => [p.seq, p.vencedor, p.pontos_a, p.pontos_b]), [[1, 2, 0, 3], [2, 3, 0, 3]]);
});

test('jogo encerrado empatado: os dois vão para o fim da fila', () => {
  const e = novoEstado('d', 4);
  iniciar(e, 1, 2, { alvo: 15, id: id() });
  pontos(e, 1, 2); pontos(e, 2, 2);
  assert.deepEqual(encerrar(e), [3, 4]);
  assert.deepEqual(e.fila, [3, 4, 1, 2]);
  assert.equal(e.partidas[0].vencedor, '');
});

test('erro do adversário não guarda jogador; descrição dos lances', () => {
  const e = novoEstado('d', 2);
  iniciar(e, 1, 2, { alvo: 15, id: id() });
  const l = registrar(e, { time: 1, tipo: 'erro_adversario', jogador_id: 'J009' }, { id: id() });
  assert.equal(l.jogador_id, '');
  const nome = () => 'Daniel';
  assert.equal(descreverLance(l, nome), 'Erro do adversário');
  assert.equal(descreverLance({ tipo: 'ataque', jogador_id: 'J1' }, nome), 'Daniel · Ataque');
  assert.equal(descreverLance({ tipo: 'erro', jogador_id: 'J1' }, nome), 'Erro de Daniel');
  assert.equal(descreverLance({ tipo: 'bloqueio', jogador_id: '' }, nome), 'Bloqueio');
});

test('cancelar o jogo atual devolve os times para a frente da fila', () => {
  const e = novoEstado('d', 4);
  iniciar(e, 3, 1, { alvo: 15, id: id() });
  ponto(e, 3);
  cancelarAtual(e);
  assert.deepEqual(e.fila, [3, 1, 2, 4]);
  assert.equal(e.partidas.length, 0, 'jogo nunca enviado some da lista');
  priorizar(e, 4);
  assert.deepEqual(e.fila, [4, 3, 1, 2]);
});

test('sincronização: lote, confirmação e lance registrado durante o envio', () => {
  const e = novoEstado('2026-11-22', 4);
  const p = iniciar(e, 1, 2, { alvo: 15, id: id() });
  pontos(e, 1, 3);
  const envio = lote(e);
  assert.equal(envio.partidas.length, 1);
  assert.equal(envio.partidas[0].lances.length, 3);
  ponto(e, 2);                             // chegou um lance antes da resposta
  confirmar(e, envio.versoes);
  assert.equal(pendentes(e).length, 1, 'o jogo continua pendente por causa do lance novo');
  confirmar(e, lote(e).versoes);
  assert.equal(pendentes(e).length, 0);
  assert.equal(p.versaoSync, p.versao);
});

test('excluir jogo já enviado: vai no lote como exclusão e some depois de confirmado', () => {
  const e = novoEstado('d', 4);
  const p = iniciar(e, 1, 2, { alvo: 1, id: id() });
  ponto(e, 1);
  encerrar(e);
  confirmar(e, lote(e).versoes);
  excluir(e, p.id);
  const envio = lote(e);
  assert.deepEqual(envio.excluir, [p.id]);
  assert.equal(envio.partidas.length, 0);
  confirmar(e, envio.versoes);
  assert.equal(e.partidas.length, 0);
});
