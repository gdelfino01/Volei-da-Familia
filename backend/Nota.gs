/**
 * Vôlei da Família – App: cálculo da nota (1 a 5) e do ranking.
 *
 * Funções puras: recebem as linhas das abas (como objetos) e devolvem resultados.
 * Não usam nada do Apps Script, então rodam também no Node (tests/nota.test.js)
 * e no modo demonstração do site (app/js/mock.js carrega este arquivo).
 *
 * Regra da nota (pesos na aba Config):
 * - Valor de cada lance para quem fez: ataque +1, bloqueio +1, ace +1,5, erro −0,5, erro do adversário 0.
 * - Vitória: +2 para cada jogador do time vencedor.
 * - Desempenho = soma ÷ partidas jogadas, nos últimos 8 domingos com jogos.
 * - Nota calculada por percentil, separado por sexo: 10% melhores = 5, 25% = 4, 30% = 3, 25% = 2, 10% finais = 1.
 * - Nota final = mistura com a nota_admin: menos de 6 partidas, só a nota_admin; de 6 a 20, metade de cada;
 *   mais de 20, 30% nota_admin e 70% calculada.
 * - A nota final muda no máximo 0,5 por semana.
 */

function pesosNota_(cfg) {
  cfg = cfg || {};
  const num = function (k, padrao) {
    const v = cfg[k];
    return v === '' || v == null || isNaN(Number(v)) ? padrao : Number(v);
  };
  const perc = String(cfg.nota_percentis || '').split(',').map(Number);
  return {
    valor: {
      ataque: num('peso_ataque', 1), bloqueio: num('peso_bloqueio', 1), ace: num('peso_ace', 1.5),
      erro: num('peso_erro', -0.5), erro_adversario: num('peso_erro_adversario', 0)
    },
    vitoria: num('bonus_vitoria', 2),
    janela: num('domingos_janela', 8),
    percentis: perc.length === 5 && perc.every(function (x) { return x >= 0; }) ? perc : [10, 25, 30, 25, 10],
    min: num('nota_partidas_min', 6),
    max: num('nota_partidas_max', 20),
    calcMeio: num('nota_peso_calc_meio', 0.5),
    calcAlto: num('nota_peso_calc_alto', 0.7),
    variacao: num('nota_variacao_max', 0.5)
  };
}

/* Soma os jogos encerrados dos domingos em `domingosValidos` ({domingo_id: true}).
   Devolve { jogador_id: { partidas, vitorias, pontos, aces, ataques, bloqueios, erros, soma } } */
function somarJogos_(dados, domingosValidos, pesos) {
  const timesDe = {};
  dados.times.forEach(function (r) {
    const d = timesDe[r.domingo_id] = timesDe[r.domingo_id] || {};
    const t = Number(r.time_num);
    (d[t] = d[t] || []).push(String(r.jogador_id));
  });
  const est = {};
  const de = function (id) {
    return est[id] = est[id] || { partidas: 0, vitorias: 0, pontos: 0, aces: 0, ataques: 0, bloqueios: 0, erros: 0, soma: 0 };
  };
  const contadas = {};
  dados.partidas.forEach(function (p) {
    if (!domingosValidos[p.domingo_id] || !p.fim) return;
    contadas[p.id] = true;
    const tm = timesDe[p.domingo_id] || {};
    [Number(p.time_a), Number(p.time_b)].forEach(function (t) {
      (tm[t] || []).forEach(function (id) {
        const e = de(id);
        e.partidas++;
        if (p.vencedor !== '' && p.vencedor != null && Number(p.vencedor) === t) { e.vitorias++; e.soma += pesos.vitoria; }
      });
    });
  });
  dados.lances.forEach(function (l) {
    if (!contadas[l.partida_id] || !l.jogador_id) return;
    const v = pesos.valor[l.tipo];
    if (v == null) return;
    const e = de(String(l.jogador_id));
    e.soma += v;
    if (l.tipo === 'ataque' || l.tipo === 'bloqueio' || l.tipo === 'ace') e.pontos++;
    if (l.tipo === 'ace') e.aces++;
    if (l.tipo === 'ataque') e.ataques++;
    if (l.tipo === 'bloqueio') e.bloqueios++;
    if (l.tipo === 'erro') e.erros++;
  });
  return est;
}

/* Percentil → nota. lista: [{ id, valor }]. Empates recebem a mesma nota. */
function notaPorPercentil_(lista, percentis) {
  const ord = lista.slice().sort(function (a, b) { return b.valor - a.valor; });
  const n = ord.length, total = percentis.reduce(function (s, x) { return s + x; }, 0) || 100;
  const cortes = [];
  percentis.reduce(function (s, x) { cortes.push((s + x) / total); return s + x; }, 0);
  const notas = {};
  for (let i = 0; i < n;) {
    let j = i;
    while (j + 1 < n && Math.abs(ord[j + 1].valor - ord[i].valor) < 1e-9) j++;
    const meio = ((i + j) / 2 + 0.5) / n;   // posição do grupo, de 0 (melhor) a 1 (pior)
    let k = 0;
    while (k < cortes.length - 1 && meio > cortes[k] + 1e-9) k++;
    for (let x = i; x <= j; x++) notas[ord[x].id] = 5 - k;
    i = j + 1;
  }
  return notas;
}

/* Última nota final de cada jogador: { jogador_id: nota_final } */
function ultimasNotas_(notas) {
  const ult = {};
  notas.slice().sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; })
    .forEach(function (r) { if (r.nota_final !== '' && r.nota_final != null) ult[String(r.jogador_id)] = Number(r.nota_final); });
  return ult;
}

/* Notas de todos os jogadores ativos ao encerrar o domingo `p.data`.
   p: { data, jogadores, domingos, times, partidas, lances, notas, config }
   Devolve as linhas da aba Notas: { data, jogador_id, partidas, desempenho, nota_calculada, nota_final } */
function calcularNotas_(p) {
  const pesos = pesosNota_(p.config);
  const comJogos = {};
  p.partidas.forEach(function (x) { if (x.fim) comJogos[x.domingo_id] = true; });
  const janela = {};
  p.domingos.filter(function (d) { return comJogos[d.id] && d.data <= p.data; })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; })
    .slice(0, pesos.janela)
    .forEach(function (d) { janela[d.id] = true; });
  const est = somarJogos_(p, janela, pesos);
  const anteriores = ultimasNotas_(p.notas.filter(function (r) { return r.data < p.data; }));
  const ativos = p.jogadores.filter(function (j) { return j.ativo !== false && j.ativo !== 'FALSE'; });

  const porSexo = { M: [], F: [] };
  ativos.forEach(function (j) {
    const e = est[j.id];
    if (e && e.partidas > 0) porSexo[j.sexo === 'F' ? 'F' : 'M'].push({ id: j.id, valor: e.soma / e.partidas });
  });
  const calc = Object.assign({}, notaPorPercentil_(porSexo.M, pesos.percentis), notaPorPercentil_(porSexo.F, pesos.percentis));
  const limitar = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const arred = function (v, casas) { const f = Math.pow(10, casas); return Math.round(v * f) / f; };

  return ativos.map(function (j) {
    const e = est[j.id] || { partidas: 0, soma: 0 };
    const admin = limitar(Number(j.nota_admin) || 3, 1, 5);
    const c = calc[j.id];
    let alvo = admin;
    if (c != null && e.partidas >= pesos.min) {
      const peso = e.partidas > pesos.max ? pesos.calcAlto : pesos.calcMeio;
      alvo = (1 - peso) * admin + peso * c;
    }
    const antes = anteriores[j.id] != null ? anteriores[j.id] : admin;
    const final = arred(limitar(limitar(alvo, antes - pesos.variacao, antes + pesos.variacao), 1, 5), 1);
    return {
      data: p.data, jogador_id: j.id, partidas: e.partidas,
      desempenho: e.partidas ? arred(e.soma / e.partidas, 2) : '',
      nota_calculada: c != null ? c : '',
      nota_final: final
    };
  });
}

/* Períodos do ranking: o mês da data e a temporada (do início configurado, ou de 1º de janeiro, até o fim do ano) */
function periodosRanking_(data, cfg) {
  const ano = data.slice(0, 4), mes = data.slice(0, 7);
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(String((cfg || {}).temporada_inicio || '')) && cfg.temporada_inicio <= data ? cfg.temporada_inicio : ano + '-01-01';
  return { mes: { desde: mes + '-01', ate: mes + '-31' }, temporada: { desde: inicio, ate: ano + '-12-31' } };
}

/* Ranking de um período. p: { jogadores, domingos, times, partidas, lances, config, desde, ate } */
function rankingPeriodo_(p) {
  const validos = {};
  p.domingos.forEach(function (d) { if (d.data >= p.desde && d.data <= p.ate) validos[d.id] = true; });
  const est = somarJogos_(p, validos, pesosNota_(p.config));
  const nomes = {};
  p.jogadores.forEach(function (j) { nomes[j.id] = j.nome; });
  return Object.keys(est)
    .filter(function (id) { return est[id].partidas > 0 && nomes[id]; })
    .map(function (id) {
      const e = est[id];
      return { jogador_id: id, nome: nomes[id], partidas: e.partidas, pontos: e.pontos, aces: e.aces, vitorias: e.vitorias };
    })
    .sort(function (a, b) {
      return b.pontos - a.pontos || b.vitorias - a.vitorias || b.aces - a.aces || String(a.nome).localeCompare(String(b.nome));
    });
}
