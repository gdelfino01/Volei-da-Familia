import { PRICES, TOPS, SHORTS, SIZES, STEPS } from './config.js';
import { S, femCount, price, total, done2, done3, tipo, single } from './state.js';
import { topSVG, shortSVG, pvSVG, SH_PATH } from './figure.js';
import { esc, brl } from './utils.js';

/* ===== Pedaços comuns ===== */
const head = (t, l) => `<div class="kicker">Etapa ${S.step + 1} de ${STEPS.length}</div><h1>${t}</h1><p class="lead">${l}</p>`;
const who = i => single() ? 'Seu kit' : 'Jogador ' + (i + 1);

/* Abas com os jogadores (só aparecem quando há mais de um kit) */
function chips(fn){
  if (single()) return '';
  return `<div class="chips" role="tablist">${S.players.map((p, i) =>
    `<button class="chip ${p.g} ${i === S.sel ? 'on' : ''} ${fn(p) ? 'ok' : ''}" data-act="sel" data-v="${i}" role="tab" aria-selected="${i === S.sel}"><span class="g">${p.g}</span>${p.name ? esc(p.name) : 'Jogador ' + (i + 1)}</button>`).join('')}</div>`;
}

function pinfo(p, i, view){
  const pr = price(p);
  return `<div class="phead">${pvSVG(p, view)}<div><div class="pname">${who(i)}</div><div class="mut">${p.g === 'F' ? 'Feminino' : 'Masculino'}${p.line ? ', linha ' + PRICES[p.line].nome : ''}</div>
    <div class="pprice">${pr ? brl(pr) : '—'}</div><div class="mut">${p.top && p.short ? tipo(p) : 'Escolha as peças'}</div></div></div>`;
}

/* ===== Etapas ===== */
function step0(){
  return head('Quantos kits?', 'Cada kit aparece como um jogador na quadra. Se o kit é só para você, deixe 1. Dá para pedir até 12 de uma vez.') +
    `<div class="stepper"><button data-act="n" data-v="-1" aria-label="Menos um kit">−</button><div class="val" aria-live="polite">${S.players.length}</div><button data-act="n" data-v="1" aria-label="Mais um kit">+</button></div>`;
}

function step1(){
  if (single()){
    const p = S.players[0];
    const opt = (g, t) => `<button class="opt gopt ${p.g === g ? 'on' : ''}" data-act="g1" data-v="${g}" aria-pressed="${p.g === g}">${pvSVG({ ...p, g }, 'front')}<b>${t}</b></button>`;
    return head('Qual modelo?', 'O feminino tem opção de top cropped e short feminino.') +
      `<div class="opts two">${opt('F', 'Feminino')}${opt('M', 'Masculino')}</div>`;
  }
  const f = femCount(), m = S.players.length - f;
  return head('Quantos são femininos?', 'O restante fica masculino. Na quadra, toque em um jogador para trocar.') +
    `<div class="stepper"><button data-act="fem" data-v="-1" aria-label="Menos um feminino">−</button><div class="val" aria-live="polite">${f}</div><button data-act="fem" data-v="1" aria-label="Mais um feminino">+</button></div>
    <div class="split"><div><b>${f}</b>feminino${f !== 1 ? 's' : ''}</div><div><b>${m}</b>masculino${m !== 1 ? 's' : ''}</div></div>`;
}

function step2(){
  const i = S.sel, p = S.players[i];
  const tops = p.g === 'F' ? ['cropped','camiseta','regata'] : ['camiseta','regata'];
  const shorts = p.g === 'F' ? ['fem','masc','none'] : ['masc','none'];
  const lineOpts = Object.entries(PRICES).map(([k, L]) =>
    `<button class="opt ${p.line === k ? 'on' : ''}" data-act="line" data-v="${k}"><b><span class="sw" style="background:${L.cor}"></span>Linha ${L.nome}</b>
     <small>Parte de cima ${brl(L.top)}<br>Short ${brl(L.short)}<br>Kit ${brl(L.kit)}</small></button>`).join('');
  const topOpts = tops.map(k =>
    `<button class="opt ${p.top === k ? 'on' : ''}" data-act="top" data-v="${k}"><svg viewBox="12 40 76 86" aria-hidden="true">${topSVG({ g:p.g, top:k, name:'', num:'' }, 'front', true)}</svg><b>${TOPS[k]}</b></button>`).join('');
  const shortOpts = shorts.map(k =>
    `<button class="opt ${p.short === k ? 'on' : ''}" data-act="short" data-v="${k}"><svg viewBox="22 108 56 54" aria-hidden="true">${k === 'none'
      ? `<path d="${SH_PATH.masc}" fill="none" stroke="#C3CCD6" stroke-width="1.5" stroke-dasharray="3 3"/>`
      : shortSVG({ short:k }, 'front')}</svg><b>${SHORTS[k]}</b></button>`).join('');
  const all = S.players.length > 1 && done2(p)
    ? `<div class="group"><button class="linkbtn" data-act="all">Usar estas peças em todos os jogadores</button><div class="hint">Top cropped e short feminino não são aplicados aos masculinos.</div></div>` : '';
  return head('Escolha as peças', 'Selecione a linha e as peças. Dá para pedir só a parte de cima.') + chips(done2) + pinfo(p, i, 'front') +
    `<div class="group"><p class="label">Linha</p><div class="opts two">${lineOpts}</div></div>
     <div class="group"><p class="label">Parte de cima</p><div class="opts">${topOpts}</div></div>
     <div class="group"><p class="label">Short</p><div class="opts">${shortOpts}</div></div>${all}`;
}

function step3(){
  const i = S.sel, p = S.players[i], L = PRICES[p.line];
  const sz = (act, cur) => `<div class="sizes">${SIZES.map(z => `<button class="size ${cur === z ? 'on' : ''}" data-act="${act}" data-v="${z}">${z}</button>`).join('')}</div>`;
  return head('Tamanhos', 'Escolha o tamanho de cada peça, de PP a XG.') + chips(done3) + pinfo(p, i, 'front') +
    `<div class="group"><p class="label">${TOPS[p.top]}, linha ${L.nome}</p>${sz('tsize', p.topSize)}</div>` +
    (p.short !== 'none' ? `<div class="group"><p class="label">${SHORTS[p.short]}, linha ${L.nome}</p>${sz('ssize', p.shortSize)}</div>` : '');
}

function step4(){
  const i = S.sel, p = S.players[i];
  const rows = S.players.map((q, j) =>
    `<div class="namerow ${j === S.sel ? 'on' : ''} ${single() ? 'solo' : ''}" data-row="${j}">${single() ? '' : `<span class="g">${j + 1}</span>`}
     <input class="name" data-name="${j}" maxlength="12" placeholder="Nome" value="${esc(q.name)}" autocomplete="off" aria-label="Nome ${single() ? 'na camisa' : 'do jogador ' + (j + 1)}">
     <input class="num" data-num="${j}" inputmode="numeric" maxlength="2" placeholder="Nº" value="${esc(q.num)}" autocomplete="off" aria-label="Número ${single() ? 'na camisa' : 'do jogador ' + (j + 1)}"></div>`).join('');
  return head('Nome e número', 'Aparecem nas costas da parte de cima. Até 12 letras e número de 0 a 99. Pode deixar em branco.') +
    `<div class="phead" id="pv">${pvSVG(p, 'back')}<div><div class="pname" id="pvname">${who(i)}</div><div class="mut">Vista de costas</div></div></div>
     <div class="namerows">${rows}</div>`;
}

function step5(){
  const P = S.players;
  const items = P.map((p, i) => `<li class="item">
      <div class="item-h"><div><b>${who(i)}</b> <span class="mut">${p.g === 'F' ? 'Feminino' : 'Masculino'}, linha ${PRICES[p.line].nome}</span></div><b class="v">${brl(price(p))}</b></div>
      <ul>
        <li><span>${TOPS[p.top]}</span><b>${p.topSize}</b></li>
        ${p.short === 'none' ? '<li><span class="mut">Sem short</span></li>' : `<li><span>${SHORTS[p.short]}</span><b>${p.shortSize}</b></li>`}
        <li><span>Nas costas</span><b>${p.name || p.num ? `${p.name ? esc(p.name) : ''} ${p.num ? p.num.padStart(2, '0') : ''}` : '<span class="mut">em branco</span>'}</b></li>
      </ul></li>`).join('');

  let agg = '';
  if (P.length > 1){
    const m = new Map();
    const add = k => m.set(k, (m.get(k) || 0) + 1);
    P.forEach(p => { const L = PRICES[p.line].nome; add(`${TOPS[p.top]}|${L}|${p.topSize}`); if (p.short !== 'none') add(`${SHORTS[p.short]}|${L}|${p.shortSize}`); });
    const rows = [...m.entries()].sort().map(([k, q]) => { const [a, b, c] = k.split('|'); return `<tr><td>${a}</td><td>${b}</td><td>${c}</td><td class="v">${q}</td></tr>`; }).join('');
    agg = `<p class="label">Quantidade por peça</p>
      <div class="tbl"><table><thead><tr><th>Peça</th><th>Linha</th><th>Tam.</th><th class="v">Qtd.</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  return head('Confira o pedido', 'Revise os itens e escreva seu nome para enviar.') +
    `<div class="group"><label class="label" for="resp" style="display:block">Nome completo do responsável <span class="req">*</span></label>
     <input id="resp" class="${S.respBad ? 'bad' : ''}" value="${esc(S.resp)}" placeholder="Nome e sobrenome" autocomplete="name" required aria-required="true" aria-invalid="${S.respBad}" aria-describedby="resperr">
     <div class="ferr" id="resperr">${S.respBad ? 'Escreva nome e sobrenome, só com letras.' : ''}</div></div>
     <div class="edits"><button class="linkbtn" data-act="goto" data-v="2">Alterar peças</button><button class="linkbtn" data-act="goto" data-v="3">Alterar tamanhos</button><button class="linkbtn" data-act="goto" data-v="4">Alterar nome e número</button></div>
     ${P.length > 1 ? '<p class="label">Por jogador</p>' : ''}
     <ul class="items">${items}</ul>
     ${agg}
     <div class="total"><span class="mut">Total do pedido</span><b>${brl(total())}</b></div>`;
}

export function doneView(){
  const d = S.done, first = S.resp.trim().split(/\s+/)[0] || '', n = S.players.length;
  return `<div class="kicker">Pedido enviado</div><h1>Obrigado${first ? ', ' + esc(first) : ''}!</h1>
    <p class="lead">O pedido <b>${d.id}</b> com ${n} ${n > 1 ? 'kits' : 'kit'} foi registrado. Total de ${brl(d.total)}.</p>
    ${d.demo ? '<p class="note">Modo de teste: o pedido não foi salvo porque o endereço da planilha ainda não foi configurado no site.</p>' : ''}
    <div class="nav"><a class="btn ghost" href="./">Ver os uniformes</a><button class="btn pri" data-act="new">Fazer outro pedido</button></div>`;
}

export const STEP_VIEWS = [step0, step1, step2, step3, step4, step5];
