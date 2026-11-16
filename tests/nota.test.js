import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

/* Carrega o backend/Nota.gs (o mesmo arquivo que roda no Apps Script) */
const codigo = readFileSync(new URL('../backend/Nota.gs', import.meta.url), 'utf8');
const N = vm.runInNewContext(codigo + '\n;({ pesosNota_, somarJogos_, notaPorPercentil_, ultimasNotas_, calcularNotas_, periodosRanking_, rankingPeriodo_ })', {});
const limpo = v => JSON.parse(JSON.stringify(v));

/* Monta as tabelas a partir de uma descrição curta.
   domingos: [{ data, times: {1: [ids], 2: [ids]}, jogos: [{ a, b, venc, fim?, lances: [[time, jogador, tipo]] }] }] */
function tabelas(domingos){
  const t = { domingos: [], times: [], partidas: [], lances: [] };
  let np = 0, nl = 0;
  for (const d of domingos){
    const id = 'D' + d.data.replace(/-/g, '');
    t.domingos.push({ id, data: d.data });
    for (const [num, ids] of Object.entries(d.times)) for (const j of ids) t.times.push({ domingo_id: id, time_num: Number(num), jogador_id: j });
    for (const g of d.jogos || []){
      const pid = 'P' + (++np);
      t.partidas.push({ id: pid, domingo_id: id, time_a: g.a, time_b: g.b, vencedor: g.venc ?? '', fim: g.fim === false ? '' : '2026-01-01T12:00:00Z' });
      for (const [time, jog, tipo] of g.lances || []) t.lances.push({ id: 'L' + (++nl), partida_id: pid, time, jogador_id: jog, tipo });
    }
  }
  return t;
}
const tudo = t => Object.fromEntries(t.domingos.map(d => [d.id, true]));
const jogos = (n, venc = 1) => Array.from({ length: n }, () => ({ a: 1, b: 2, venc }));

test('valor de cada lance e bônus de vitória', () => {
  const t = tabelas([{ data: '2026-11-15', times: { 1: ['A1', 'A2'], 2: ['B1', 'B2'] }, jogos: [
    { a: 1, b: 2, venc: 1, lances: [[1, 'A1', 'ataque'], [1, 'A1', 'ace'], [2, 'A2', 'erro'], [2, 'B1', 'bloqueio'], [1, '', 'erro_adversario']] },
    { a: 1, b: 2, venc: '', fim: false, lances: [[1, 'A1', 'ataque']] }   // jogo não encerrado: não conta
  ] }]);
  const est = limpo(N.somarJogos_(t, tudo(t), N.pesosNota_({})));
  assert.equal(est.A1.soma, 4.5);   // 1 + 1,5 + vitória 2
  assert.equal(est.A2.soma, 1.5);   // −0,5 + 2
  assert.equal(est.B1.soma, 1);
  assert.equal(est.B2.soma, 0);
  assert.deepEqual([est.A1.partidas, est.A1.pontos, est.A1.aces, est.A1.vitorias], [1, 2, 1, 1]);
  assert.equal(est.A2.erros, 1);
});

test('percentil: 10% = 5, 25% = 4, 30% = 3, 25% = 2, 10% = 1; empates com a mesma nota', () => {
  const lista = Array.from({ length: 10 }, (_, i) => ({ id: 'J' + i, valor: 10 - i }));
  const notas = limpo(N.notaPorPercentil_(lista, [10, 25, 30, 25, 10]));
  assert.deepEqual(lista.map(j => notas[j.id]), [5, 4, 4, 4, 3, 3, 3, 2, 2, 1]);
  const iguais = limpo(N.notaPorPercentil_([{ id: 'a', valor: 1 }, { id: 'b', valor: 1 }, { id: 'c', valor: 1 }], [10, 25, 30, 25, 10]));
  assert.deepEqual(iguais, { a: 3, b: 3, c: 3 });
});

function notasCom(nPartidas, { config = {}, notas = [], adminM1 = 3 } = {}){
  const t = tabelas([{ data: '2026-11-15', times: { 1: ['M1', 'F1'], 2: ['M2', 'F2'] }, jogos: jogos(nPartidas, 1) }]);
  const jogadores = [
    { id: 'M1', sexo: 'M', nota_admin: adminM1 }, { id: 'M2', sexo: 'M', nota_admin: 3 },
    { id: 'F1', sexo: 'F', nota_admin: 3 }, { id: 'F2', sexo: 'F', nota_admin: 3 }
  ];
  const linhas = limpo(N.calcularNotas_({ data: '2026-11-15', jogadores, ...t, notas, config }));
  return Object.fromEntries(linhas.map(l => [l.jogador_id, l]));
}

test('nota calculada separada por sexo', () => {
  const r = notasCom(21, { config: { nota_variacao_max: 10 } });
  assert.equal(r.M1.nota_calculada, 4);   // 2 homens: o melhor fica com 4, o pior com 2
  assert.equal(r.M2.nota_calculada, 2);
  assert.equal(r.F1.nota_calculada, 4);   // as mulheres são comparadas só entre si
  assert.equal(r.F2.nota_calculada, 2);
  assert.equal(r.M1.desempenho, 2);
});

test('mistura com a nota_admin conforme o número de partidas', () => {
  const sem = { config: { nota_variacao_max: 10 } };
  assert.equal(notasCom(5, sem).M1.nota_final, 3);     // menos de 6: só a nota_admin
  assert.equal(notasCom(6, sem).M1.nota_final, 3.5);   // 6 a 20: 50% + 50%
  assert.equal(notasCom(20, sem).M1.nota_final, 3.5);
  assert.equal(notasCom(21, sem).M1.nota_final, 3.7);  // mais de 20: 30% admin + 70% calculada
  assert.equal(notasCom(21, sem).M2.nota_final, 2.3);
});

test('a nota final muda no máximo 0,5 por semana', () => {
  assert.equal(notasCom(21).M1.nota_final, 3.5);                         // sem nota anterior: parte da nota_admin (3)
  const anterior = [{ data: '2026-11-08', jogador_id: 'M1', nota_final: 4.4 }, { data: '2026-11-01', jogador_id: 'M1', nota_final: 2 }];
  assert.equal(notasCom(21, { notas: anterior }).M1.nota_final, 3.9);    // alvo 3,7, mas a última foi 4,4
  const mesmoDia = [{ data: '2026-11-15', jogador_id: 'M1', nota_final: 1 }];
  assert.equal(notasCom(21, { notas: mesmoDia }).M1.nota_final, 3.5);    // recalcular o mesmo domingo ignora a linha dele
});

test('considera só os últimos 8 domingos com jogos', () => {
  const datas = ['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];
  const t = tabelas([
    ...datas.map(data => ({ data, times: { 1: ['M1'], 2: ['M2'] }, jogos: jogos(1) })),
    { data: '2026-11-15', times: { 1: ['M1'], 2: ['M2'] } },                          // domingo sem jogos não ocupa a janela
    { data: '2026-11-22', times: { 1: ['M1'], 2: ['M2'] }, jogos: jogos(3) }          // depois da data: não conta
  ]);
  const linhas = limpo(N.calcularNotas_({ data: '2026-11-15', jogadores: [{ id: 'M1', sexo: 'M', nota_admin: 3 }], ...t, notas: [], config: {} }));
  assert.equal(linhas[0].partidas, 8);
});

test('jogador inativo fica fora; quem não jogou mantém a nota anterior', () => {
  const t = tabelas([{ data: '2026-11-15', times: { 1: ['M1'], 2: ['M2'] }, jogos: jogos(2) }]);
  const linhas = limpo(N.calcularNotas_({
    data: '2026-11-15', ...t, config: {},
    jogadores: [{ id: 'M1', sexo: 'M', nota_admin: 4 }, { id: 'X', sexo: 'M', nota_admin: 2, ativo: false }, { id: 'Y', sexo: 'F', nota_admin: 5 }],
    notas: [{ data: '2026-11-08', jogador_id: 'Y', nota_final: 4.2 }]
  }));
  assert.deepEqual(linhas.map(l => l.jogador_id), ['M1', 'Y']);
  const y = linhas.find(l => l.jogador_id === 'Y');
  assert.deepEqual([y.partidas, y.nota_calculada, y.nota_final], [0, '', 4.7]);   // alvo = nota_admin 5, limitado a 4,2 + 0,5
});

test('ranking do mês e da temporada', () => {
  const t = tabelas([
    { data: '2026-10-25', times: { 1: ['A'], 2: ['B'] }, jogos: [{ a: 1, b: 2, venc: 2, lances: [[2, 'B', 'ace'], [2, 'B', 'ataque'], [2, 'B', 'ataque']] }] },
    { data: '2026-11-15', times: { 1: ['A'], 2: ['B'] }, jogos: [{ a: 1, b: 2, venc: 1, lances: [[1, 'A', 'ace'], [1, 'A', 'bloqueio'], [1, 'A', 'erro_adversario'], [2, 'A', 'erro']] }] }
  ]);
  const jogadores = [{ id: 'A', nome: 'Ana' }, { id: 'B', nome: 'Bia' }];
  const per = limpo(N.periodosRanking_('2026-11-15', {}));
  assert.deepEqual(per, { mes: { desde: '2026-11-01', ate: '2026-11-31' }, temporada: { desde: '2026-01-01', ate: '2026-12-31' } });
  const mes = limpo(N.rankingPeriodo_({ jogadores, ...t, config: {}, ...per.mes }));
  assert.deepEqual(mes.map(r => [r.nome, r.pontos, r.aces, r.vitorias, r.partidas]), [['Ana', 2, 1, 1, 1], ['Bia', 0, 0, 0, 1]]);
  const temp = limpo(N.rankingPeriodo_({ jogadores, ...t, config: {}, ...per.temporada }));
  assert.deepEqual(temp.map(r => [r.nome, r.pontos, r.vitorias]), [['Bia', 3, 1], ['Ana', 2, 1]]);
  assert.equal(limpo(N.periodosRanking_('2026-11-15', { temporada_inicio: '2026-03-01' })).temporada.desde, '2026-03-01');
});

test('última nota de cada jogador', () => {
  assert.deepEqual(limpo(N.ultimasNotas_([
    { data: '2026-11-08', jogador_id: 'A', nota_final: 3.5 }, { data: '2026-11-15', jogador_id: 'A', nota_final: 3.8 }, { data: '2026-11-01', jogador_id: 'B', nota_final: 2 }
  ])), { A: 3.8, B: 2 });
});

test('partidas e vitórias contam pela escalação de cada partida (revezamento fica de fora)', () => {
  // Times do domingo: 1 = [A1, A2], 2 = [B1, B2]; R no revezamento.
  const t = tabelas([{ data: '2026-11-15', times: { 1: ['A1', 'A2'], 2: ['B1', 'B2'] }, jogos: [
    { a: 1, b: 2, venc: 1, lances: [[1, 'A2', 'ataque']] },
    { a: 1, b: 2, venc: 2, lances: [[1, 'R', 'ace']] }
  ] }]);
  // 1º jogo: escalação igual aos times. 2º jogo: R entrou no lugar de A2 no time 1.
  t.escalacoes = [
    { partida_id: 'P1', time: 'A', jogador_id: 'A1' }, { partida_id: 'P1', time: 'A', jogador_id: 'A2' },
    { partida_id: 'P1', time: 'B', jogador_id: 'B1' }, { partida_id: 'P1', time: 'B', jogador_id: 'B2' },
    { partida_id: 'P2', time: 'A', jogador_id: 'A1' }, { partida_id: 'P2', time: 'A', jogador_id: 'R' },
    { partida_id: 'P2', time: 'B', jogador_id: 'B1' }, { partida_id: 'P2', time: 'B', jogador_id: 'B2' }
  ];
  const est = limpo(N.somarJogos_(t, tudo(t), N.pesosNota_({})));
  assert.deepEqual([est.A1.partidas, est.A1.vitorias], [2, 1]);
  assert.deepEqual([est.A2.partidas, est.A2.vitorias], [1, 1], 'A2 ficou fora do 2º jogo');
  assert.deepEqual([est.R.partidas, est.R.vitorias, est.R.aces], [1, 0, 1], 'R jogou só o 2º, pelo time 1');
  assert.deepEqual([est.B1.partidas, est.B1.vitorias], [2, 1]);
});
