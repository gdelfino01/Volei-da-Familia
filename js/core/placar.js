/* ===== Placar lance a lance, fila, revezamento e controle de sincronização =====
   Tudo aqui é puro (sem rede nem localStorage) e testado no Node.

   Estado de um domingo:
   { data, porTime,
     elencos: { time_num: [jogador_id, ...] },   // quem está em cada time AGORA (muda entre partidas)
     revezamento: [jogador_id, ...],              // quem está fora dos times
     contRevez: { jogador_id: vezes },            // quantas vezes cada um ficou no revezamento no dia
     trocas: [{ sai, entra }],                    // trocas feitas desde a última partida (vão junto com a próxima)
     sugestao: { time, trocas: [{ sai, entra }] } | null,   // revezamento sugerido para o time que perdeu
     seguidas: { time_num: vitórias seguidas },
     ficaEmQuadra: time_num|null,                 // quem ganhou o último jogo e continua para o próximo
     fila: [time_num, ...], atual: partida_id|null,
     partidas: [{ id, seq, time_a, time_b, alvo, gatilho, desempate, inicio, fim, vencedor, pontos_a, pontos_b,
                  escalacao: { A: [ids], B: [ids] }, revezamentos: [{ sai, entra }],
                  lances: [{ id, seq, time, jogador_id, tipo, criado_em }], versao, versaoSync, excluida? }] }

   Cada lance é um ponto para `time` (o número do time que pontuou).
   No tipo 'erro', jogador_id é quem errou (do outro time); em 'erro_adversario' não há jogador. */

export const TIPOS = { ataque: 'Ataque', bloqueio: 'Bloqueio', ace: 'Ace', erro: 'Erro', erro_adversario: 'Erro do adversário' };
export const TIPOS_PONTO = ['ataque', 'bloqueio', 'ace', 'erro_adversario'];

/* Regras da aba Config */
export function regras(cfg = {}){
  const n = (v, p) => (v === '' || v == null || isNaN(Number(v)) ? p : Number(v));
  return {
    alvo: n(cfg.pontos_partida, 11),
    gatilho: n(cfg.gatilho_desempate, 10),
    desempate: n(cfg.pontos_desempate, 3),
    porTime: n(cfg.jogadores_por_time, 4)
  };
}

export function novoEstado(data, { times = [], revezamento = [], porTime = 4 } = {}){
  const elencos = {};
  times.forEach((t, i) => { elencos[i + 1] = t.slice(); });
  const contRevez = {};
  revezamento.forEach(id => { contRevez[id] = 1; });
  return {
    data, porTime, elencos, revezamento: revezamento.slice(), contRevez, trocas: [], sugestao: null, seguidas: {}, ficaEmQuadra: null,
    fila: times.map((_, i) => i + 1), atual: null, partidas: []
  };
}

export const partidaAtual = e => e.partidas.find(p => p.id === e.atual) || null;
export const visiveis = e => e.partidas.filter(p => !p.excluida);
export const encerradas = e => visiveis(e).filter(p => p.fim);
export const ladoDe = (p, time) => (time === p.time_a ? 'A' : 'B');

/* Quem está em quadra por um time nesta partida (escalação salva no início dela) */
export function emQuadra(e, p, time){
  const lado = p.escalacao?.[ladoDe(p, time)];
  return lado && lado.length ? lado : (e.elencos?.[time] || []);
}

export function placar(p){
  let a = 0, b = 0;
  for (const l of p.lances){ if (l.time === p.time_a) a++; else if (l.time === p.time_b) b++; }
  return { a, b };
}

/* Desempate: os dois chegaram ao gatilho (ex.: 10 x 10) */
export function emDesempate(p){
  const g = Number(p.gatilho), d = Number(p.desempate);
  if (!(g > 0 && d > 0 && g < p.alvo)) return false;
  const { a, b } = placar(p);
  return a >= g && b >= g;
}

/* Pontos para vencer neste momento: o alvo, ou gatilho + desempate (ex.: 13) depois do empate em 10 x 10 */
export const alvoAtual = p => (emDesempate(p) ? Number(p.gatilho) + Number(p.desempate) : p.alvo);

export function vencedor(p){
  const { a, b } = placar(p);
  const alvo = alvoAtual(p);
  if (a >= alvo && a > b) return p.time_a;
  if (b >= alvo && b > a) return p.time_b;
  return null;
}

/* A regra das 3 vitórias seguidas só vale com 4 times completos e ninguém no revezamento */
export function regra3Ativa(e){
  const times = Object.values(e.elencos || {});
  return times.length === 4 && !(e.revezamento || []).length && times.every(t => t.length >= (e.porTime || 4));
}

/* Próximo jogo sugerido. Durante um jogo: [null (= vencedor), primeiro da fila].
   Entre jogos: quem ganhou fica e enfrenta o primeiro da fila; senão, os dois primeiros da fila. */
export function proximo(e){
  if (e.atual) return [null, e.fila[0] ?? null];
  if (e.ficaEmQuadra) return [e.ficaEmQuadra, e.fila.find(t => t !== e.ficaEmQuadra) ?? null];
  return [e.fila[0] ?? null, e.fila[1] ?? null];
}

export function iniciar(e, timeA, timeB, { alvo = 11, gatilho = 10, desempate = 3, id, agora = new Date() }){
  if (e.atual) throw new Error('Já há um jogo em andamento.');
  timeA = Number(timeA); timeB = Number(timeB);
  if (!timeA || !timeB || timeA === timeB) throw new Error('Escolha dois times diferentes.');
  const elA = e.elencos?.[timeA] || [], elB = e.elencos?.[timeB] || [];
  if (e.elencos && (!elA.length || !elB.length)) throw new Error('Os dois times precisam ter jogadores.');
  const seq = visiveis(e).reduce((m, p) => Math.max(m, p.seq), 0) + 1;
  const p = {
    id, seq, time_a: timeA, time_b: timeB, alvo: Number(alvo) || 11, gatilho: Number(gatilho) || 0, desempate: Number(desempate) || 0,
    inicio: agora.toISOString(), fim: '', vencedor: '', pontos_a: 0, pontos_b: 0,
    escalacao: { A: elA.slice(), B: elB.slice() }, revezamentos: (e.trocas || []).splice(0),
    lances: [], versao: 1, versaoSync: 0
  };
  e.fila = e.fila.filter(t => t !== timeA && t !== timeB);
  if (e.ficaEmQuadra && e.ficaEmQuadra !== timeA && e.ficaEmQuadra !== timeB) e.fila.unshift(e.ficaEmQuadra);   // o vencedor não jogou: volta para a frente da fila
  e.ficaEmQuadra = null;
  e.partidas.push(p);
  e.atual = p.id;
  return p;
}

function tocar(p){ const { a, b } = placar(p); p.pontos_a = a; p.pontos_b = b; p.versao++; }

export function registrar(e, { time, jogador_id = '', tipo }, { id, agora = new Date() }){
  const p = partidaAtual(e);
  if (!p) throw new Error('Nenhum jogo em andamento.');
  if (vencedor(p)) throw new Error('O jogo já terminou. Salve para começar o próximo.');
  if (!TIPOS[tipo]) throw new Error('Tipo de lance inválido.');
  if (time !== p.time_a && time !== p.time_b) throw new Error('Time fora deste jogo.');
  const ultimo = p.lances[p.lances.length - 1];
  const lance = { id, seq: ultimo ? ultimo.seq + 1 : 1, time, jogador_id: tipo === 'erro_adversario' ? '' : (jogador_id || ''), tipo, criado_em: agora.toISOString() };
  p.lances.push(lance);
  tocar(p);
  return lance;
}

export function desfazer(e){
  const p = partidaAtual(e);
  if (!p || !p.lances.length) return null;
  const l = p.lances.pop();
  tocar(p);
  return l;
}

/* Encerra o jogo atual e arruma a fila.
   - Quem ganha fica; quem perde vai para o fim da fila.
   - Regra das 3 vitórias (4 times completos): o time que vence a 3ª seguida sai junto com o perdedor,
     entram os dois da fila e a fila fica [time das 3 vitórias, perdedor].
   - Empate (jogo encerrado antes do fim): os dois vão para o fim da fila.
   Devolve { par: [time, time], perdedor, tresVitorias } */
export function encerrar(e, { agora = new Date() } = {}){
  const p = partidaAtual(e);
  if (!p) throw new Error('Nenhum jogo em andamento.');
  const { a, b } = placar(p);
  const v = a > b ? p.time_a : b > a ? p.time_b : null;
  p.fim = agora.toISOString();
  p.vencedor = v ?? '';
  tocar(p);
  e.atual = null;
  e.seguidas ||= {};
  e.ficaEmQuadra = null;
  if (!v){
    e.seguidas[p.time_a] = 0; e.seguidas[p.time_b] = 0;
    e.fila.push(p.time_a, p.time_b);
    return { par: [e.fila[0], e.fila[1]], perdedor: null, tresVitorias: false };
  }
  const perdedor = v === p.time_a ? p.time_b : p.time_a;
  e.seguidas[v] = (e.seguidas[v] || 0) + 1;
  e.seguidas[perdedor] = 0;
  if (regra3Ativa(e) && e.seguidas[v] >= 3){
    e.seguidas[v] = 0;
    e.fila.push(v, perdedor);
    return { par: [e.fila[0], e.fila[1]], perdedor, tresVitorias: true };
  }
  e.fila.push(perdedor);
  e.ficaEmQuadra = v;
  return { par: [v, e.fila[0]], perdedor, tresVitorias: false };
}

/* Cancela o jogo atual (lançado por engano): os times voltam para a frente da fila */
export function cancelarAtual(e){
  const p = partidaAtual(e);
  if (!p) return;
  e.atual = null;
  e.ficaEmQuadra = null;
  e.fila = [p.time_a, p.time_b].concat(e.fila.filter(t => t !== p.time_a && t !== p.time_b));
  e.trocas = (p.revezamentos || []).concat(e.trocas || []);   // as trocas valem para o próximo jogo
  remover(e, p);
}

/* Exclui um jogo já encerrado */
export function excluir(e, id){
  const p = e.partidas.find(x => x.id === id);
  if (p && p.id !== e.atual) remover(e, p);
}

function remover(e, p){
  if (!p.versaoSync) e.partidas = e.partidas.filter(x => x !== p);  // nunca foi enviado: some daqui mesmo
  else { p.excluida = true; p.versao++; }                            // já está na planilha: avisa para apagar lá
}

/* Passa um time para a frente da fila */
export function priorizar(e, time){
  if (!e.fila.includes(time)) return;
  e.fila = [time].concat(e.fila.filter(t => t !== time));
}

/* ---------- Escalação e revezamento ---------- */

function emJogo(e, time){
  const p = partidaAtual(e);
  return !!p && (p.time_a === time || p.time_b === time);
}

/* Troca no elenco de um time. `sai` vai para o revezamento; `entra` vem do revezamento.
   Um dos dois pode ser vazio (só tirar, ou só adicionar). */
export function trocar(e, time, sai, entra){
  time = Number(time);
  const elenco = e.elencos[time];
  if (!elenco) throw new Error('Time inexistente.');
  if (emJogo(e, time)) throw new Error(`O Time ${time} está em quadra. Mude a escalação entre as partidas.`);
  if (!sai && !entra) return;
  if (sai && !elenco.includes(sai)) throw new Error('Esse jogador não está no time.');
  if (entra && !e.revezamento.includes(entra)) throw new Error('Esse jogador não está no revezamento.');
  e.revezamento = e.revezamento.filter(id => id !== entra);
  if (sai){
    elenco.splice(elenco.indexOf(sai), 1, ...(entra ? [entra] : []));
    e.revezamento.push(sai);
    e.contRevez[sai] = (e.contRevez[sai] || 0) + 1;
  } else elenco.push(entra);
  (e.trocas ||= []).push({ sai: sai || '', entra: entra || '' });
  if (e.sugestao?.time === time) e.sugestao = null;
}

/* Quem sai do time que perdeu para dar lugar a quem está no revezamento.
   Preferência: (a) mesmo sexo de quem entra; (b) quem ficou menos vezes no revezamento no dia; desempate por sorteio. */
export function sugerirTrocas(elenco, revezamento, { sexoDe, contagem = {}, rng = Math.random }){
  const livres = elenco.slice();
  const trocas = [];
  for (const entra of revezamento){
    if (!livres.length) break;
    const sexo = sexoDe(entra);
    const nota = new Map(livres.map(id => [id, (sexoDe(id) === sexo ? 0 : 1000) + (contagem[id] || 0) * 10 + rng()]));
    livres.sort((x, y) => nota.get(x) - nota.get(y));
    trocas.push({ sai: livres.shift(), entra });
  }
  return trocas;
}

/* Prepara a sugestão de revezamento para o time que acabou de perder */
export function prepararRevezamento(e, time, opcoes){
  e.sugestao = time && e.revezamento.length
    ? { time, trocas: sugerirTrocas(e.elencos[time] || [], e.revezamento, { contagem: e.contRevez, ...opcoes }) }
    : null;
  return e.sugestao;
}

/* Troca quem sai em uma das trocas sugeridas */
export function mudarSugestao(e, i, novoSai){
  const s = e.sugestao;
  if (!s || !s.trocas[i]) return;
  const outra = s.trocas.findIndex((t, k) => k !== i && t.sai === novoSai);
  if (outra >= 0) s.trocas[outra].sai = s.trocas[i].sai;   // os dois trocam de lugar na sugestão
  s.trocas[i].sai = novoSai;
}

export function aplicarSugestao(e){
  const s = e.sugestao;
  if (!s) return [];
  e.sugestao = null;
  const feitas = [];
  for (const t of s.trocas){
    if (e.elencos[s.time]?.includes(t.sai) && e.revezamento.includes(t.entra)){
      trocar(e, s.time, t.sai, t.entra);
      feitas.push(t);
    }
  }
  return feitas;
}

/* ---------- Sincronização ---------- */

export const pendentes = e => e.partidas.filter(p => p.versao !== p.versaoSync);

/* Lote para o Apps Script; `versoes` guarda o que foi enviado, para não marcar como enviado
   um lance registrado enquanto o envio ainda estava a caminho. */
export function lote(e){
  const ps = pendentes(e);
  return {
    data: e.data,
    partidas: ps.filter(p => !p.excluida).map(p => ({
      id: p.id, seq: p.seq, time_a: p.time_a, time_b: p.time_b, alvo: p.alvo, gatilho: p.gatilho, desempate: p.desempate,
      inicio: p.inicio, fim: p.fim,
      escalacao: { A: (p.escalacao?.A || []).slice(), B: (p.escalacao?.B || []).slice() },
      revezamentos: (p.revezamentos || []).map(t => ({ ...t })),
      lances: p.lances.map(l => ({ ...l }))
    })),
    excluir: ps.filter(p => p.excluida).map(p => p.id),
    versoes: Object.fromEntries(ps.map(p => [p.id, p.versao]))
  };
}

export function confirmar(e, versoes){
  for (const p of e.partidas) if (versoes[p.id] != null) p.versaoSync = versoes[p.id];
  e.partidas = e.partidas.filter(p => !(p.excluida && p.versaoSync === p.versao));
}

/* Texto curto do lance para a lista de últimos lances */
export function descreverLance(l, nomeDe){
  const nome = l.jogador_id ? nomeDe(l.jogador_id) : '';
  if (l.tipo === 'erro') return nome ? `Erro de ${nome}` : 'Erro';
  if (l.tipo === 'erro_adversario') return 'Erro do adversário';
  return nome ? `${nome} · ${TIPOS[l.tipo]}` : TIPOS[l.tipo];
}
