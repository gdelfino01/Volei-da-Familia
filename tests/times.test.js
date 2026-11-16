import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equilibrar, sortear, tamanhos, estatisticas, custo, paresDe, montarTimes, separarRevezamento, PESOS_PADRAO } from '../js/core/times.js';
import { SEED } from '../js/seed.js';

/* Gerador aleatório com semente, para os testes serem repetíveis */
function rngFixo(semente = 42){
  let a = semente >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const jogadores = (filtro = () => true) => SEED.filter(filtro).map(([nome, sexo, nota, tipo, idade], i) => ({
  id: 'J' + String(i + 1).padStart(3, '0'), nome, sexo, nota, tipo, idade: idade || null, altura: 160 + (i * 7) % 30
}));
const mensalistas = () => jogadores(r => r[3] === 'mensalista');

function conferirDistribuicao(times, todos){
  const ids = times.flat().map(j => j.id).sort();
  assert.deepEqual(ids, todos.map(j => j.id).sort(), 'cada jogador aparece uma vez');
  const st = times.map(estatisticas);
  const dif = k => Math.max(...st.map(s => s[k])) - Math.min(...st.map(s => s[k]));
  assert.ok(dif('n') <= 1, 'tamanhos com diferença máxima de 1');
  assert.ok(dif('mulheres') <= 1, 'mulheres com diferença máxima de 1');
  assert.ok(dif('homens') <= 1, 'homens com diferença máxima de 1');
}

test('tamanhos dos times', () => {
  assert.deepEqual(tamanhos(16, 4), [4, 4, 4, 4]);
  assert.deepEqual(tamanhos(18, 4), [5, 5, 4, 4]);
});

test('equilibrar: 16 mensalistas, sexo dividido e notas próximas', () => {
  const todos = mensalistas();
  const opcoes = equilibrar(todos, 4, { rng: rngFixo() });
  assert.equal(opcoes.length, 3, 'gera 3 opções');
  const chaves = new Set(opcoes.map(o => o.times.map(t => t.map(j => j.id).sort().join()).sort().join('/')));
  assert.equal(chaves.size, 3, 'as 3 opções são diferentes');
  for (const o of opcoes){
    conferirDistribuicao(o.times, todos);
    const somas = o.times.map(t => estatisticas(t).nota);
    assert.ok(Math.max(...somas) - Math.min(...somas) <= 1, 'soma das notas com diferença de no máximo 1: ' + somas);
  }
  assert.ok(opcoes[0].custo <= opcoes[1].custo && opcoes[1].custo <= opcoes[2].custo, 'ordenadas pelo custo');
});

test('equilibrar: número de jogadores e de mulheres que não dividem por 4', () => {
  for (const [nh, nm] of [[10, 7], [12, 5], [9, 9], [13, 3]]){
    const todos = jogadores(r => r[1] === 'M').slice(0, nh).concat(jogadores(r => r[1] === 'F').slice(0, nm));
    const [melhor] = equilibrar(todos, 4, { rng: rngFixo(nh * 100 + nm) });
    conferirDistribuicao(melhor.times, todos);
  }
});

test('equilibrar evita repetir as duplas do domingo anterior', () => {
  const todos = mensalistas();
  const semPenalidade = equilibrar(todos, 4, { rng: rngFixo(7), pesos: { ...PESOS_PADRAO, repetida: 0 } })[0];
  const pares = paresDe(semPenalidade.times.map(t => t.map(j => j.id)));
  const comPenalidade = equilibrar(todos, 4, { rng: rngFixo(7), pares })[0];
  const repetidas = custo(comPenalidade.times, { nota: 0, altura: 0, idade: 0, repetida: 1 }, pares);
  assert.ok(repetidas < 24, 'menos duplas repetidas que os mesmos times (24 duplas): ' + repetidas);
});

test('sortear: pelo menos 1 mulher por time e todos sorteados', () => {
  const todos = jogadores(r => r[1] === 'M').slice(0, 12).concat(jogadores(r => r[1] === 'F').slice(0, 4));
  for (let s = 1; s <= 20; s++){
    const { times, aviso } = sortear(todos, 4, { rng: rngFixo(s) });
    assert.equal(aviso, '');
    assert.deepEqual(times.flat().map(j => j.id).sort(), todos.map(j => j.id).sort());
    for (const t of times){
      assert.equal(t.length, 4);
      assert.ok(t.some(j => j.sexo === 'F'), 'time sem mulher');
    }
  }
});

test('sortear avisa quando há menos mulheres que times', () => {
  const todos = jogadores(r => r[1] === 'M').slice(0, 13).concat(jogadores(r => r[1] === 'F').slice(0, 3));
  assert.notEqual(sortear(todos, 4, { rng: rngFixo() }).aviso, '');
});

test('lista incompleta: máximo de times completos de 4 e o resto no revezamento', () => {
  const homens = jogadores().filter(j => j.sexo === 'M'), mulheres = jogadores().filter(j => j.sexo === 'F');
  const casos = [[7, 6, 3, 1], [7, 7, 3, 2], [8, 8, 4, 0], [10, 7, 4, 1], [5, 4, 2, 1]];
  for (const [nh, nm, times, fora] of casos){
    const todos = homens.slice(0, nh).concat(mulheres.slice(0, nm));
    for (const modo of ['equilibrar', 'sortear']){
      const opcoes = montarTimes(todos, { modo, rng: rngFixo(nh * 10 + nm) });
      assert.ok(opcoes.length >= 1);
      for (const o of opcoes){
        assert.equal(o.times.length, times, `${nh}H ${nm}M: ${times} times`);
        assert.equal(o.revezamento.length, fora, `${nh}H ${nm}M: ${fora} no revezamento`);
        assert.ok(o.times.every(t => t.length === 4), 'todos os times completos');
        const ids = o.times.flat().concat(o.revezamento).map(j => j.id).sort();
        assert.deepEqual(ids, todos.map(j => j.id).sort(), 'ninguém some nem repete');
        const st = o.times.map(estatisticas);
        if (modo === 'equilibrar') assert.ok(Math.max(...st.map(s => s.mulheres)) - Math.min(...st.map(s => s.mulheres)) <= 1);
        else assert.ok(st.every(s => s.mulheres >= 1));
      }
    }
  }
});

test('revezamento escolhido para dividir homens e mulheres igualmente', () => {
  // 7 homens e 6 mulheres em 3 times: tirando 1 homem, fica 2H + 2M em cada time
  const todos = jogadores().filter(j => j.sexo === 'M').slice(0, 7).concat(jogadores().filter(j => j.sexo === 'F').slice(0, 6));
  for (let s = 1; s <= 10; s++){
    const { revezamento, numTimes } = separarRevezamento(todos, 4, rngFixo(s));
    assert.equal(numTimes, 3);
    assert.equal(revezamento.length, 1);
    assert.equal(revezamento[0].sexo, 'M');
  }
});

test('menos de 8 jogadores não forma 2 times', () => {
  assert.throws(() => montarTimes(jogadores().slice(0, 7)), /pelo menos 8/);
});
