/* ===== Montagem dos times =====
   Jogador de entrada: { id, nome, sexo: 'M'|'F', nota, altura (cm|null), idade (anos|null) }
   Time = lista de jogadores. Opção = { times, custo }. */

export const PESOS_PADRAO = { nota: 3, altura: 1, idade: 0.5, repetida: 1 };

/* Tamanhos dos times, com diferença máxima de 1 */
export function tamanhos(n, t){
  const base = Math.floor(n / t), extra = n % t;
  return Array.from({ length: t }, (_, i) => base + (i < extra ? 1 : 0));
}

const media = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
function amplitude(vs){
  const v = vs.filter(x => x != null);
  return v.length < 2 ? 0 : Math.max(...v) - Math.min(...v);
}

export function estatisticas(time){
  const alturas = time.map(j => j.altura).filter(x => x > 0);
  const idades = time.map(j => j.idade).filter(x => x > 0);
  return {
    n: time.length,
    nota: Math.round(time.reduce((s, j) => s + (Number(j.nota) || 0), 0) * 10) / 10,
    homens: time.filter(j => j.sexo !== 'F').length,
    mulheres: time.filter(j => j.sexo === 'F').length,
    altura: media(alturas),
    idade: media(idades)
  };
}

/* Duplas: chave estável para um par de ids */
export const chavePar = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

/* Pares de quem jogou junto, a partir de times de ids ([[id, id, ...], ...]) */
export function paresDe(timesDeIds){
  const s = new Set();
  for (const t of timesDeIds) for (let i = 0; i < t.length; i++) for (let k = i + 1; k < t.length; k++) s.add(chavePar(t[i], t[k]));
  return s;
}

function repetidas(time, pares){
  let n = 0;
  for (let i = 0; i < time.length; i++) for (let k = i + 1; k < time.length; k++) if (pares.has(chavePar(time[i].id, time[k].id))) n++;
  return n;
}

/* Quanto menor, mais equilibrado */
export function custo(times, pesos = PESOS_PADRAO, pares = new Set()){
  const st = times.map(estatisticas);
  let rep = 0;
  if (pares.size) for (const t of times) rep += repetidas(t, pares);
  return pesos.nota * amplitude(st.map(s => s.nota))
    + pesos.altura * amplitude(st.map(s => s.altura))
    + pesos.idade * amplitude(st.map(s => s.idade))
    + pesos.repetida * rep;
}

/* Serpente: 0,1,2,3,3,2,1,0,0,1... pulando times que já estão cheios */
function distribuir(jogadores, capacidades, times, inverter){
  const t = capacidades.length, usados = capacidades.map(() => 0);
  const ida = [...Array(t).keys()];
  if (inverter) ida.reverse();
  const ciclo = ida.concat(ida.slice().reverse());
  let p = 0;
  for (const j of jogadores){
    for (let tentativa = 0; tentativa < ciclo.length; tentativa++, p++){
      const k = ciclo[p % ciclo.length];
      if (usados[k] < capacidades[k]) { times[k].push(j); usados[k]++; p++; break; }
    }
  }
}

/* Passo 1 e 2: mulheres e homens divididos igualmente, em serpente pela nota */
function montagemInicial(mulheres, homens, t){
  const times = Array.from({ length: t }, () => []);
  const capF = tamanhos(mulheres.length, t);
  distribuir(mulheres, capF, times, false);
  // As vagas extras (quando n não divide por t) vão para os times com mais mulheres,
  // assim os homens também ficam com diferença máxima de 1
  const tam = tamanhos(mulheres.length + homens.length, t);
  const ordem = [...Array(t).keys()].sort((a, b) => times[b].length - times[a].length);
  const capH = Array(t).fill(0);
  ordem.forEach((k, i) => { capH[k] = tam[i] - times[k].length; });
  distribuir(homens, capH, times, true);
  return times;
}

/* Passo 3: trocas entre jogadores do mesmo sexo enquanto o custo cair */
function melhorar(times, pesos, pares){
  let atual = custo(times, pesos, pares), melhorou = true, voltas = 0;
  while (melhorou && voltas++ < 200){
    melhorou = false;
    for (let a = 0; a < times.length; a++) for (let b = a + 1; b < times.length; b++){
      for (let i = 0; i < times[a].length; i++) for (let k = 0; k < times[b].length; k++){
        const x = times[a][i], y = times[b][k];
        if (x.sexo !== y.sexo) continue;
        times[a][i] = y; times[b][k] = x;
        const c = custo(times, pesos, pares);
        if (c < atual - 1e-9) { atual = c; melhorou = true; }
        else { times[a][i] = x; times[b][k] = y; }
      }
    }
  }
  return atual;
}

const chaveTimes = times => times.map(t => t.map(j => j.id).sort().join(',')).sort().join('/');

/* Equilibrar: várias tentativas com pequenas variações; devolve as melhores opções diferentes */
export function equilibrar(jogadores, numTimes, { pesos = PESOS_PADRAO, pares = new Set(), rng = Math.random, opcoes = 3, tentativas = 60 } = {}){
  if (numTimes < 2 || jogadores.length < numTimes) throw new Error('Jogadores insuficientes para ' + numTimes + ' times.');
  const unicas = new Map();
  for (let k = 0; k < tentativas; k++){
    const ruido = k === 0 ? 0 : 0.8;
    const ordenar = lista => lista.map(j => ({ j, v: (Number(j.nota) || 0) + (rng() - 0.5) * ruido }))
      .sort((a, b) => b.v - a.v).map(x => x.j);
    const times = montagemInicial(ordenar(jogadores.filter(j => j.sexo === 'F')), ordenar(jogadores.filter(j => j.sexo !== 'F')), numTimes);
    const c = melhorar(times, pesos, pares);
    const chave = chaveTimes(times);
    if (!unicas.has(chave)) unicas.set(chave, { times, custo: c });
  }
  return [...unicas.values()].sort((a, b) => a.custo - b.custo).slice(0, opcoes);
}

export function embaralhar(lista, rng = Math.random){
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--){ const k = Math.floor(rng() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
}

/* Sortear: aleatório, só garantindo pelo menos 1 mulher por time (quando houver mulheres suficientes) */
export function sortear(jogadores, numTimes, { rng = Math.random, pesos = PESOS_PADRAO, pares = new Set() } = {}){
  if (numTimes < 2 || jogadores.length < numTimes) throw new Error('Jogadores insuficientes para ' + numTimes + ' times.');
  const times = Array.from({ length: numTimes }, () => []);
  const mulheres = embaralhar(jogadores.filter(j => j.sexo === 'F'), rng);
  const outros = jogadores.filter(j => j.sexo !== 'F');
  const faltamMulheres = mulheres.length < numTimes;
  if (!faltamMulheres) for (const t of times) t.push(mulheres.pop());
  const resto = embaralhar(mulheres.concat(outros), rng);
  const vagas = [];
  tamanhos(jogadores.length, numTimes).forEach((tam, k) => { for (let i = times[k].length; i < tam; i++) vagas.push(k); });
  embaralhar(vagas, rng).forEach((k, i) => times[k].push(resto[i]));
  return { times, custo: custo(times, pesos, pares), aviso: faltamMulheres ? 'Há menos mulheres do que times.' : '' };
}

/* ---------- Lista incompleta: times completos + revezamento ---------- */

/* Quantos times completos cabem e quem fica no revezamento.
   Escolhe os sexos de quem fica fora para que homens e mulheres se dividam o mais igual possível
   entre os times; dentro de cada sexo, a escolha é por sorteio. */
export function separarRevezamento(jogadores, porTime = 4, rng = Math.random){
  const numTimes = Math.floor(jogadores.length / porTime);
  const k = jogadores.length - numTimes * porTime;
  const F = jogadores.filter(j => j.sexo === 'F'), M = jogadores.filter(j => j.sexo !== 'F');
  let melhores = [], menor = Infinity;
  for (let kf = Math.max(0, k - M.length); kf <= Math.min(k, F.length); kf++){
    const rf = F.length - kf, rm = M.length - (k - kf);
    const c = numTimes ? (rf % numTimes ? 1 : 0) + (rm % numTimes ? 1 : 0) : 0;
    if (c < menor){ menor = c; melhores = [kf]; } else if (c === menor) melhores.push(kf);
  }
  const kf = melhores.length ? melhores[Math.floor(rng() * melhores.length)] : 0;
  const revezamento = embaralhar(F, rng).slice(0, kf).concat(embaralhar(M, rng).slice(0, k - kf));
  const fora = new Set(revezamento.map(j => j.id));
  return { numTimes, emQuadra: jogadores.filter(j => !fora.has(j.id)), revezamento };
}

/* Monta os times do domingo: o máximo de times completos de `porTime`, e o resto no revezamento.
   modo 'equilibrar' devolve até 3 opções (cada uma com seu revezamento); 'sortear' devolve uma. */
export function montarTimes(jogadores, { porTime = 4, modo = 'equilibrar', pesos = PESOS_PADRAO, pares = new Set(), rng = Math.random } = {}){
  if (jogadores.length < porTime * 2) throw new Error(`São precisos pelo menos ${porTime * 2} jogadores para 2 times de ${porTime}.`);
  const sobra = jogadores.length % porTime;
  if (modo === 'sortear'){
    const sep = separarRevezamento(jogadores, porTime, rng);
    return [{ ...sortear(sep.emQuadra, sep.numTimes, { rng, pesos, pares }), revezamento: sep.revezamento }];
  }
  const unicas = new Map();
  const rodadas = sobra ? 8 : 1;
  for (let r = 0; r < rodadas; r++){
    const sep = separarRevezamento(jogadores, porTime, rng);
    for (const op of equilibrar(sep.emQuadra, sep.numTimes, { pesos, pares, rng, opcoes: 3, tentativas: sobra ? 20 : 60 })){
      const chave = chaveTimes(op.times) + '#' + sep.revezamento.map(j => j.id).sort().join(',');
      if (!unicas.has(chave)) unicas.set(chave, { ...op, revezamento: sep.revezamento });
    }
  }
  return [...unicas.values()].sort((a, b) => a.custo - b.custo).slice(0, 3);
}
