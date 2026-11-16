import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  novoEstado, regras, iniciar, registrar, desfazer, encerrar, placar, vencedor, emDesempate, alvoAtual, proximo,
  cancelarAtual, excluir, priorizar, regra3Ativa, trocar, sugerirTrocas, prepararRevezamento, mudarSugestao, aplicarSugestao,
  emQuadra, pendentes, lote, confirmar, descreverLance, partidaAtual
} from '../js/core/placar.js';

let n = 0;
const id = () => 'X' + String(++n).padStart(6, '0');
const R = { alvo: 11, gatilho: 10, desempate: 3 };
const ponto = (e, time, tipo = 'ataque', jogador_id = '') => registrar(e, { time, tipo, jogador_id }, { id: id() });
const pontos = (e, time, qtd) => { for (let i = 0; i < qtd; i++) ponto(e, time); };
const jogo = (e, a, b, regrasJogo = R) => iniciar(e, a, b, { ...regrasJogo, id: id() });
const vencer = (e, time) => { const p = partidaAtual(e); while (!vencedor(p)) ponto(e, time); return encerrar(e); };

/* 4 times completos: t1 = [1a,1b,1c,1d] ... */
const quatroTimes = (rev = []) => novoEstado('2026-11-22', { times: [1, 2, 3, 4].map(t => ['a', 'b', 'c', 'd'].map(x => t + x)), revezamento: rev });

test('regras padrão: 11 pontos, desempate em 10 x 10 até 13', () => {
  assert.deepEqual(regras({}), { alvo: 11, gatilho: 10, desempate: 3, porTime: 4 });
  assert.deepEqual(regras({ pontos_partida: '15', gatilho_desempate: 14, pontos_desempate: '2' }), { alvo: 15, gatilho: 14, desempate: 2, porTime: 4 });
});

test('vitória normal a 11', () => {
  const e = quatroTimes();
  const p = jogo(e, 1, 2);
  pontos(e, 1, 10); pontos(e, 2, 9);
  assert.equal(vencedor(p), null);
  ponto(e, 1);
  assert.deepEqual(placar(p), { a: 11, b: 9 });
  assert.equal(vencedor(p), 1);
});

test('desempate: em 10 x 10 vence quem fizer 3 pontos primeiro (13 x 10, 13 x 11 ou 13 x 12)', () => {
  const e = quatroTimes();
  const p = jogo(e, 1, 2);
  pontos(e, 1, 10); pontos(e, 2, 10);
  assert.equal(emDesempate(p), true);
  assert.equal(alvoAtual(p), 13);
  ponto(e, 1); ponto(e, 2); ponto(e, 2);            // 11 x 12: ainda não acabou
  assert.equal(vencedor(p), null);
  ponto(e, 1); ponto(e, 1);                          // 13 x 12
  assert.deepEqual(placar(p), { a: 13, b: 12 });
  assert.equal(vencedor(p), 1);
  assert.throws(() => ponto(e, 2), /já terminou/);
  desfazer(e);                                       // desfazer volta para 12 x 12
  assert.equal(vencedor(p), null);
});

test('quem ganha fica: perdedor vai para o fim da fila e entra o primeiro da fila', () => {
  const e = novoEstado('d', { times: [['a'], ['b'], ['c']] });   // 3 times: a regra das 3 vitórias não vale
  assert.deepEqual(proximo(e), [1, 2]);
  jogo(e, 1, 2);
  assert.deepEqual(e.fila, [3]);
  for (let i = 0; i < 4; i++){
    const { par, tresVitorias } = vencer(e, 1);
    assert.equal(tresVitorias, false);
    jogo(e, ...par);
  }
  assert.deepEqual([partidaAtual(e).time_a, partidaAtual(e).time_b], [1, 2], 'o Time 1 segue em quadra depois de 4 vitórias, alternando com 3 e 2');
});

test('regra das 3 vitórias com 4 times completos', () => {
  const e = quatroTimes();
  assert.equal(regra3Ativa(e), true);
  jogo(e, 1, 2);
  let r = vencer(e, 1);                       // 1 vence 2 → fila [3, 4, 2]
  assert.deepEqual(r.par, [1, 3]);
  jogo(e, ...r.par);
  r = vencer(e, 1);                           // 1 vence 3 → fila [4, 2, 3]
  assert.deepEqual(r.par, [1, 4]);
  jogo(e, ...r.par);
  r = vencer(e, 1);                           // 3ª vitória: sai o 1 junto com o 4
  assert.equal(r.tresVitorias, true);
  assert.deepEqual(r.par, [2, 3], 'entram os dois da fila');
  jogo(e, ...r.par);
  assert.deepEqual(e.fila, [1, 4], 'fila: time das 3 vitórias, depois o perdedor');
  assert.equal(e.seguidas[1], 0, 'o contador zera ao sair');
});

test('com revezamento (ou time incompleto), vale só o quem ganha fica', () => {
  const e = quatroTimes(['r1']);
  assert.equal(regra3Ativa(e), false);
  jogo(e, 1, 2);
  for (let i = 0; i < 3; i++){ const r = vencer(e, 1); assert.equal(r.tresVitorias, false); jogo(e, ...r.par); }
  const f = quatroTimes();
  trocar(f, 4, '4a', '');                     // Time 4 fica com 3 jogadores e 4a vai para o revezamento
  assert.equal(regra3Ativa(f), false);
});

test('o próximo jogo sugerido fica guardado no estado (sobrevive a recarregar a página)', () => {
  const e = quatroTimes();
  jogo(e, 1, 2);
  const { par } = vencer(e, 1);
  const recarregado = JSON.parse(JSON.stringify(e));
  assert.deepEqual(proximo(recarregado), par);
  assert.deepEqual(proximo(recarregado), [1, 3]);
  priorizar(recarregado, 4);
  assert.deepEqual(proximo(recarregado), [1, 4], 'o vencedor continua; muda só quem entra');
  jogo(recarregado, 3, 4);                    // o organizador escolheu outro jogo: o vencedor volta para a frente da fila
  assert.deepEqual(recarregado.fila, [1, 2]);
});

test('empate encerrado antes do fim: os dois vão para o fim da fila', () => {
  const e = quatroTimes();
  jogo(e, 1, 2);
  pontos(e, 1, 2); pontos(e, 2, 2);
  assert.deepEqual(encerrar(e).par, [3, 4]);
  assert.deepEqual(e.fila, [3, 4, 1, 2]);
  assert.equal(e.partidas[0].vencedor, '');
});

test('a escalação é salva por partida e só muda entre partidas', () => {
  const e = quatroTimes(['r1']);
  const p1 = jogo(e, 1, 2);
  assert.deepEqual(p1.escalacao, { A: ['1a', '1b', '1c', '1d'], B: ['2a', '2b', '2c', '2d'] });
  assert.throws(() => trocar(e, 1, '1a', 'r1'), /em quadra/);
  trocar(e, 3, '3b', 'r1');                   // Time 3 está fora: pode mudar
  assert.deepEqual(e.elencos[3], ['3a', 'r1', '3c', '3d']);
  assert.deepEqual(e.revezamento, ['3b']);
  assert.equal(e.contRevez['3b'], 1);
  const { par } = vencer(e, 1);
  const p2 = jogo(e, ...par);
  assert.deepEqual(p2.escalacao.B, ['3a', 'r1', '3c', '3d']);
  assert.deepEqual(p2.revezamentos, [{ sai: '3b', entra: 'r1' }], 'a troca vai junto com a partida seguinte');
  assert.deepEqual(p1.escalacao.A, ['1a', '1b', '1c', '1d'], 'a partida anterior não muda');
  assert.deepEqual(emQuadra(e, p2, 3), ['3a', 'r1', '3c', '3d']);
});

test('adicionar e tirar jogador sem troca', () => {
  const e = quatroTimes(['r1', 'r2']);
  trocar(e, 4, '', 'r2');
  assert.deepEqual(e.elencos[4], ['4a', '4b', '4c', '4d', 'r2']);
  trocar(e, 4, '4a', '');
  assert.deepEqual(e.revezamento, ['r1', '4a']);
  assert.deepEqual(e.trocas, [{ sai: '', entra: 'r2' }, { sai: '4a', entra: '' }]);
});

const sexos = { '2a': 'M', '2b': 'F', '2c': 'M', '2d': 'F', r1: 'F', r2: 'M' };
const sexoDe = idj => sexos[idj];

test('sugestão de revezamento: mesmo sexo de quem entra e quem ficou menos vezes fora', () => {
  let s = 1;
  const rng = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 20; i++){
    const [t] = sugerirTrocas(['2a', '2b', '2c', '2d'], ['r1'], { sexoDe, rng });
    assert.ok(['2b', '2d'].includes(t.sai), 'sai uma mulher, porque entra uma mulher');
    assert.equal(t.entra, 'r1');
  }
  const [t] = sugerirTrocas(['2a', '2b', '2c', '2d'], ['r1'], { sexoDe, contagem: { '2b': 2 }, rng });
  assert.equal(t.sai, '2d', '2b já ficou fora 2 vezes hoje');
  const duas = sugerirTrocas(['2a', '2b', '2c', '2d'], ['r1', 'r2'], { sexoDe, rng });
  assert.equal(duas.length, 2);
  assert.notEqual(duas[0].sai, duas[1].sai);
  assert.equal(sexoDe(duas[1].sai), 'M');
});

test('fluxo do revezamento: o time que perdeu troca com quem estava fora', () => {
  const e = novoEstado('d', { times: [['1a', '1b', '1c', '1d'], ['2a', '2b', '2c', '2d'], ['3a', '3b', '3c', '3d']], revezamento: ['r1'] });
  jogo(e, 1, 2);
  const { par, perdedor } = vencer(e, 1);
  assert.deepEqual([par, perdedor], [[1, 3], 2]);
  prepararRevezamento(e, perdedor, { sexoDe, rng: () => 0.5 });
  assert.equal(e.sugestao.time, 2);
  mudarSugestao(e, 0, '2d');                  // o organizador escolhe outra pessoa
  assert.deepEqual(aplicarSugestao(e), [{ sai: '2d', entra: 'r1' }]);
  assert.deepEqual(e.elencos[2], ['2a', '2b', '2c', 'r1']);
  assert.deepEqual(e.revezamento, ['2d'], 'quem saiu vira o novo revezamento');
  assert.equal(e.contRevez.r1, 1);
  assert.equal(e.contRevez['2d'], 1);
});

test('cancelar o jogo atual devolve os times e as trocas', () => {
  const e = quatroTimes(['r1']);
  trocar(e, 3, '3a', 'r1');
  jogo(e, 3, 1);
  ponto(e, 3);
  cancelarAtual(e);
  assert.deepEqual(e.fila, [3, 1, 2, 4]);
  assert.equal(e.partidas.length, 0, 'jogo nunca enviado some da lista');
  assert.deepEqual(e.trocas, [{ sai: '3a', entra: 'r1' }]);
  priorizar(e, 4);
  assert.deepEqual(e.fila, [4, 3, 1, 2]);
});

test('erro do adversário não guarda jogador; descrição dos lances', () => {
  const e = quatroTimes();
  jogo(e, 1, 2);
  const l = registrar(e, { time: 1, tipo: 'erro_adversario', jogador_id: 'J009' }, { id: id() });
  assert.equal(l.jogador_id, '');
  const nome = () => 'Daniel';
  assert.equal(descreverLance(l, nome), 'Erro do adversário');
  assert.equal(descreverLance({ tipo: 'ataque', jogador_id: 'J1' }, nome), 'Daniel · Ataque');
  assert.equal(descreverLance({ tipo: 'erro', jogador_id: 'J1' }, nome), 'Erro de Daniel');
  assert.equal(descreverLance({ tipo: 'bloqueio', jogador_id: '' }, nome), 'Bloqueio');
});

test('sincronização: lote com escalação e revezamentos; lance registrado durante o envio', () => {
  const e = quatroTimes(['r1']);
  trocar(e, 1, '1a', 'r1');
  const p = jogo(e, 1, 2);
  pontos(e, 1, 3);
  const envio = lote(e);
  assert.equal(envio.partidas.length, 1);
  assert.equal(envio.partidas[0].lances.length, 3);
  assert.deepEqual(envio.partidas[0].escalacao.A, ['r1', '1b', '1c', '1d']);
  assert.deepEqual(envio.partidas[0].revezamentos, [{ sai: '1a', entra: 'r1' }]);
  assert.deepEqual([envio.partidas[0].alvo, envio.partidas[0].gatilho, envio.partidas[0].desempate], [11, 10, 3]);
  ponto(e, 2);
  confirmar(e, envio.versoes);
  assert.equal(pendentes(e).length, 1, 'o jogo continua pendente por causa do lance novo');
  confirmar(e, lote(e).versoes);
  assert.equal(pendentes(e).length, 0);
  assert.equal(p.versaoSync, p.versao);
});

test('excluir jogo já enviado: vai no lote como exclusão e some depois de confirmado', () => {
  const e = quatroTimes();
  const p = jogo(e, 1, 2, { alvo: 1, gatilho: 0, desempate: 0 });
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
