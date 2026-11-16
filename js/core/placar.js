/* ===== Placar lance a lance, fila "quem ganha fica" e controle de sincronização =====
   Tudo aqui é puro (sem rede nem localStorage) e testado no Node.

   Estado de um domingo:
   { data, fila: [time_num, ...], atual: partida_id|null,
     partidas: [{ id, seq, time_a, time_b, alvo, inicio, fim, vencedor, pontos_a, pontos_b,
                  lances: [{ id, seq, time, jogador_id, tipo, criado_em }],
                  versao, versaoSync, excluida? }] }

   Cada lance é um ponto para `time` (o número do time que pontuou).
   No tipo 'erro', jogador_id é quem errou (do outro time); em 'erro_adversario' não há jogador. */

export const TIPOS = { ataque: 'Ataque', bloqueio: 'Bloqueio', ace: 'Ace', erro: 'Erro', erro_adversario: 'Erro do adversário' };
export const TIPOS_PONTO = ['ataque', 'bloqueio', 'ace', 'erro_adversario'];

export function novoEstado(data, numTimes){
  return { data, fila: Array.from({ length: numTimes }, (_, i) => i + 1), atual: null, partidas: [] };
}

export const partidaAtual = e => e.partidas.find(p => p.id === e.atual) || null;
export const visiveis = e => e.partidas.filter(p => !p.excluida);
export const encerradas = e => visiveis(e).filter(p => p.fim);

export function placar(p){
  let a = 0, b = 0;
  for (const l of p.lances){ if (l.time === p.time_a) a++; else if (l.time === p.time_b) b++; }
  return { a, b };
}

/* Quem chegou primeiro aos pontos da partida */
export function vencedor(p){
  const { a, b } = placar(p);
  if (a >= p.alvo && a > b) return p.time_a;
  if (b >= p.alvo && b > a) return p.time_b;
  return null;
}

/* Próximo jogo sugerido. Durante um jogo: [null (= vencedor), primeiro da fila] */
export function proximo(e){
  if (e.atual) return [null, e.fila[0] ?? null];
  return [e.fila[0] ?? null, e.fila[1] ?? null];
}

export function iniciar(e, timeA, timeB, { alvo, id, agora = new Date() }){
  if (e.atual) throw new Error('Já há um jogo em andamento.');
  timeA = Number(timeA); timeB = Number(timeB);
  if (!timeA || !timeB || timeA === timeB) throw new Error('Escolha dois times diferentes.');
  const seq = visiveis(e).reduce((m, p) => Math.max(m, p.seq), 0) + 1;
  const p = { id, seq, time_a: timeA, time_b: timeB, alvo: Number(alvo) || 15, inicio: agora.toISOString(), fim: '', vencedor: '',
              pontos_a: 0, pontos_b: 0, lances: [], versao: 1, versaoSync: 0 };
  e.fila = e.fila.filter(t => t !== timeA && t !== timeB);
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

/* Encerra o jogo atual. Quem ganha fica; quem perde vai para o fim da fila.
   Empate (jogo encerrado antes do fim): os dois vão para o fim da fila.
   Devolve o par sugerido para o próximo jogo. */
export function encerrar(e, { agora = new Date() } = {}){
  const p = partidaAtual(e);
  if (!p) throw new Error('Nenhum jogo em andamento.');
  const { a, b } = placar(p);
  const v = a > b ? p.time_a : b > a ? p.time_b : null;
  p.fim = agora.toISOString();
  p.vencedor = v ?? '';
  tocar(p);
  e.atual = null;
  if (v){
    e.fila.push(v === p.time_a ? p.time_b : p.time_a);
    return [v, e.fila[0]];
  }
  e.fila.push(p.time_a, p.time_b);
  return [e.fila[0], e.fila[1]];
}

/* Cancela o jogo atual (lançado por engano): os times voltam para a frente da fila */
export function cancelarAtual(e){
  const p = partidaAtual(e);
  if (!p) return;
  e.atual = null;
  e.fila = [p.time_a, p.time_b].concat(e.fila.filter(t => t !== p.time_a && t !== p.time_b));
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

/* ---------- Sincronização ---------- */

export const pendentes = e => e.partidas.filter(p => p.versao !== p.versaoSync);

/* Lote para o Apps Script; `versoes` guarda o que foi enviado, para não marcar como enviado
   um lance registrado enquanto o envio ainda estava a caminho. */
export function lote(e){
  const ps = pendentes(e);
  return {
    data: e.data,
    partidas: ps.filter(p => !p.excluida).map(p => ({
      id: p.id, seq: p.seq, time_a: p.time_a, time_b: p.time_b, alvo: p.alvo, inicio: p.inicio, fim: p.fim,
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
