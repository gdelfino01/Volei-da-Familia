/* ===== Lista do WhatsApp: gerar a mensagem de quinta e reconhecer a lista colada ===== */
import { normalizar, ddmm, porNome } from './util.js';

/* Mensagem de quinta: mensalistas em ordem alfabética, vagas restantes em branco e suplentes */
export function gerarMensagem({ data, mensalistas, vagas = 16, suplentes = 3, inicio = '9:30', fim = '11:30' }){
  const nomes = mensalistas.slice().sort(porNome).map(j => j.nome);
  const linhas = ['*Vôlei da Família*', `*Domingo, ${ddmm(data)}*`, `De ${inicio} às ${fim}`, '*Lista Jogadores*'];
  const total = Math.max(vagas, nomes.length);
  for (let i = 0; i < total; i++) linhas.push(nomes[i] ? `${i + 1}. ${nomes[i]} (confirmar)` : `${i + 1}.`);
  linhas.push('*Suplentes*');
  for (let i = 0; i < suplentes; i++) linhas.push(`${i + 1}.`);
  return linhas.join('\n');
}

export const linkWhatsApp = texto => 'https://wa.me/?text=' + encodeURIComponent(texto);

const RE_NUMERO = /^\s*(\d{1,2})\s*[.)\-–:]\s*(.*)$/;
const EXTRAS = new Set(['ok', 'confirmado', 'confirmada', 'confirmo', 'vou', 'sim', 'presente']);
const RE_EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;

/* Tira observações entre parênteses, emojis e marcações do WhatsApp */
export function limparNome(bruto){
  return String(bruto).replace(/\([^)]*\)/g, ' ').replace(RE_EMOJI, ' ').replace(/[*_~]/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Índice de busca: nome completo, nome da camisa e apelidos (forte); primeiro nome (fraco) */
export function indiceJogadores(jogadores){
  const forte = new Map(), fraco = new Map();
  const add = (m, k, j) => { if (!k) return; const l = m.get(k) || []; if (!l.includes(j)) l.push(j); m.set(k, l); };
  for (const j of jogadores){
    add(forte, normalizar(j.nome), j);
    add(forte, normalizar(j.apelido_camisa), j);
    String(j.apelidos || '').split(/[,;]/).forEach(a => add(forte, normalizar(a), j));
    add(fraco, normalizar(j.nome).split(' ')[0], j);
  }
  return { forte, fraco };
}

/* Procura um jogador pelo nome digitado; só aceita quando há um único candidato */
export function encontrar(nome, indice){
  const palavras = normalizar(nome).split(' ').filter(p => p && !EXTRAS.has(p));
  if (!palavras.length) return null;
  for (let n = palavras.length; n >= 1; n--){
    const c = indice.forte.get(palavras.slice(0, n).join(' '));
    if (c && c.length === 1) return c[0];
  }
  const c = indice.fraco.get(palavras[0]);
  return c && c.length === 1 ? c[0] : null;
}

/* Lê a lista colada do grupo.
   Cada item: { num, texto, secao: 'lista'|'suplentes', status: 'confirmado'|'pendente'|'fora'|'repetido', jogador|null } */
export function reconhecerLista(texto, jogadores){
  const indice = indiceJogadores(jogadores);
  const vistos = new Set();
  const itens = [];
  let secao = 'lista';
  for (const linha of String(texto || '').split(/\r?\n/)){
    const norm = normalizar(linha);
    if (norm.includes('suplente')) { secao = 'suplentes'; continue; }
    if (/^lista\b/.test(norm)) { secao = 'lista'; continue; }
    const m = linha.match(RE_NUMERO);
    if (!m) continue;
    const resto = m[2];
    const nome = limparNome(resto);
    if (!normalizar(nome)) continue;
    let status = 'confirmado';
    if (/\(\s*confirmar\s*\)/i.test(resto)) status = 'pendente';
    if (/[❌✖\u{1F6AB}]/u.test(resto) || /\b(nao vou|nao posso|fora)\b/.test(normalizar(resto))) status = 'fora';
    const jogador = encontrar(nome, indice);
    if (jogador){
      if (vistos.has(jogador.id)) status = 'repetido';
      vistos.add(jogador.id);
    }
    itens.push({ num: Number(m[1]), texto: nome, secao, status, jogador });
  }
  return itens;
}

/* Quem entra na presença por padrão: confirmados da lista principal */
export const entraPorPadrao = it => !!it.jogador && it.secao === 'lista' && it.status === 'confirmado';
