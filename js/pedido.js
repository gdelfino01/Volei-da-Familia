import { STEPS } from './config.js';
import { S, seen, flash, setN, setFem, sanitize, femCount, total, done2, done3, validResp, validEmail } from './state.js';
import { renderCourt } from './court.js';
import { STEP_VIEWS, doneView } from './views.js';
import { pvSVG } from './figure.js';
import { buildPayload, submitOrder } from './api.js';
import { pagamento } from './pix.js';
import { esc, brl, $ } from './utils.js';

/* ===== Renderização ===== */
function renderPanel(){
  const body = S.done ? doneView() : STEP_VIEWS[S.step]();
  const t = total();
  const nav = S.done ? '' : `<div class="navbar"><div class="err" role="alert">${esc(S.err)}</div><div class="nav">
    ${S.step > 0 ? '<button class="btn ghost" data-act="back">Voltar</button>' : '<span></span>'}
    ${t > 0 ? `<div class="navtot"><small>Total</small><b>${brl(t)}</b></div>` : ''}
    <button class="btn pri" data-act="next" ${S.sending ? 'disabled' : ''}>${S.step === 5 ? (S.sending ? 'Enviando…' : 'Enviar pedido') : 'Continuar'}</button></div></div>`;
  $('panel').innerHTML = `<div class="pane ${S.anim ? (S.dir < 0 ? 'l' : 'r') : ''}">${body}${nav}</div>`;
  S.anim = false;
}

function renderProg(){
  $('prog').innerHTML = STEPS.map((t, i) => {
    const cls = S.done || i < S.step ? 'done' : i === S.step ? 'cur' : '';
    return `<div class="seg ${cls}"><div class="bar"><i></i></div><span>${i + 1}. ${t}</span></div>`;
  }).join('');
}

function render(){ renderProg(); renderCourt(); renderPanel(); }

/* Atualiza só a prévia e a linha ativa enquanto a pessoa digita (sem perder o foco) */
function updateLive(){
  const p = S.players[S.sel], pv = $('pv');
  if (pv){ pv.querySelector('svg').outerHTML = pvSVG(p, 'back'); $('pvname').textContent = S.players.length === 1 ? 'Seu kit' : 'Jogador ' + (S.sel + 1); }
  document.querySelectorAll('.namerow').forEach(r => r.classList.toggle('on', +r.dataset.row === S.sel));
}

/* ===== Navegação ===== */
function validate(step){
  const P = S.players;
  if (step === 1){
    const i = P.findIndex(p => !p.g);
    if (i >= 0) return { i, msg:'Escolha o modelo feminino ou masculino.' };
  }
  if (step === 2){
    const i = P.findIndex(p => !done2(p));
    if (i >= 0){ const p = P[i], w = P.length > 1 ? ` do jogador ${i + 1}` : '';
      return { i, msg:`Falta escolher ${!p.line ? 'a linha' : !p.top ? 'a parte de cima' : 'o short'}${w}.` }; }
  }
  if (step === 3){
    const i = P.findIndex(p => !done3(p));
    if (i >= 0) return { i, msg:`Falta o tamanho ${!P[i].topSize ? 'da parte de cima' : 'do short'}${P.length > 1 ? ` do jogador ${i + 1}` : ''}.` };
  }
  if (step === 5 && !validResp(S.resp)) return { resp:true, msg:'Falta o nome completo do responsável para enviar o pedido.' };
  if (step === 5 && !validEmail(S.email)) return { email:true, msg:'O e-mail parece incompleto. Corrija ou deixe em branco.' };
  return null;
}

function scrollTop(){
  if (window.scrollY > 0) window.scrollTo({ top:0, behavior:'smooth' });
}

function go(s){
  S.dir = s > S.step ? 1 : -1; S.step = s; S.anim = true; S.err = '';
  // Com vários kits, todos começam masculinos; com um kit só, a pessoa escolhe
  if (s === 1 && S.players.length > 1) S.players.forEach(p => { if (!p.g){ p.g = 'M'; flash.add(p.id); } });
  if (s === 2){ const j = S.players.findIndex(p => !done2(p)); S.sel = j >= 0 ? j : 0; }
  if (s === 3){ const j = S.players.findIndex(p => !done3(p)); S.sel = j >= 0 ? j : 0; }
  render();
  scrollTop();
}

function next(){
  const e = validate(S.step);
  if (e){
    if (e.i != null) S.sel = e.i;
    S.respBad = !!e.resp; S.emailBad = !!e.email; render(); S.err = e.msg; renderPanel();
    const bad = e.resp ? $('resp') : e.email ? $('email') : null;
    if (bad){ bad.focus(); if (bad.scrollIntoView) bad.scrollIntoView({ block:'center', behavior:'smooth' }); }
    return;
  }
  if (S.step === 5) send(); else go(S.step + 1);
}

/* Depois de completar um jogador, pula para o próximo que ainda falta */
function autoNext(fn){
  const cur = S.sel;
  const j = S.players.findIndex((q, i) => i !== cur && !fn(q));
  if (j >= 0) setTimeout(() => { if (S.sel === cur){ S.sel = j; render(); } }, 550);
}

function applyAll(){
  const src = S.players[S.sel];
  S.players.forEach(q => {
    if (q === src) return;
    q.line = src.line;
    if (!(q.g === 'M' && src.top === 'cropped')) q.top = src.top;
    if (!(q.g === 'M' && src.short === 'fem')) q.short = src.short;
    flash.add(q.id);
  });
}

function reset(){
  S.players = []; seen.clear(); S.step = 0; S.sel = 0; S.resp = ''; S.respBad = false; S.email = ''; S.emailBad = false; S.done = null; S.err = ''; S.dir = 1; S.anim = true;
  setN(1); render(); scrollTop();
}

async function send(){
  if (!validResp(S.resp) || !validEmail(S.email)) return;
  S.sending = true; renderPanel();
  const payload = buildPayload(S.players, S.resp, S.email);
  try{
    const { demo } = await submitOrder(payload);
    S.done = { id:payload.pedidoId, total:payload.total, pagamento:pagamento(payload.total, payload.pedidoId), demo };
    S.anim = true; S.dir = 1;
    S.players.forEach(p => flash.add(p.id));
  } catch (err){
    S.err = 'Não foi possível enviar o pedido. Confira a conexão e toque em Enviar pedido de novo.';
  }
  S.sending = false; render();
  if (S.done) scrollTop();
}

/* Copia o Pix copia e cola; se a área de transferência não estiver disponível, seleciona o texto */
async function copyPix(btn){
  const code = $('pixcode');
  try{ await navigator.clipboard.writeText(code.textContent); btn.textContent = 'Copiado'; }
  catch { const r = document.createRange(); r.selectNodeContents(code); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); btn.textContent = 'Selecionado'; }
  setTimeout(() => { btn.textContent = 'Copiar'; }, 2000);
}

/* ===== Eventos ===== */
function onFig(i){
  if (S.done) return;
  if (S.step === 1){
    const p = S.players[i]; p.g = p.g === 'F' ? 'M' : 'F'; sanitize(p); flash.add(p.id); S.err = ''; render(); return;
  }
  if (S.step >= 2){
    S.sel = i;
    if (S.step === 4){ renderCourt(); updateLive(); const inp = document.querySelector(`[data-name="${i}"]`); if (inp) inp.focus(); return; }
    render();
  }
}

document.addEventListener('click', e => {
  const f = e.target.closest('[data-fig]');
  if (f){ onFig(+f.dataset.fig); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act, v = b.dataset.v, p = S.players[S.sel];
  S.err = '';
  switch (a){
    case 'n': setN(S.players.length + +v); break;
    case 'fem': setFem(Math.max(0, Math.min(S.players.length, femCount() + +v))); break;
    case 'g1': p.g = v; sanitize(p); flash.add(p.id); break;
    case 'sel': S.sel = +v; break;
    case 'line': case 'top': case 'short': {
      const was = done2(p); p[a] = v; flash.add(p.id);
      if (!was && done2(p)) autoNext(done2);
      break;
    }
    case 'tsize': case 'ssize': {
      const was = done3(p); if (a === 'tsize') p.topSize = v; else p.shortSize = v; flash.add(p.id);
      if (!was && done3(p)) autoNext(done3);
      break;
    }
    case 'all': applyAll(); break;
    case 'goto': go(+v); return;
    case 'next': next(); return;
    case 'back': go(S.step - 1); return;
    case 'new': reset(); return;
    case 'copy': copyPix(b); return;
  }
  render();
});

document.addEventListener('keydown', e => {
  const f = e.target.closest && e.target.closest('[data-fig]');
  if (f && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); onFig(+f.dataset.fig); }
  if ((e.target.id === 'resp' || e.target.id === 'email') && e.key === 'Enter') next();
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.name != null){
    const i = +t.dataset.name, v = t.value.toUpperCase().replace(/[^A-ZÀ-ÖØ-Ý0-9 .'-]/g, '').slice(0, 12);
    if (t.value !== v) t.value = v;
    S.players[i].name = v; S.sel = i; renderCourt(); updateLive();
  } else if (t.dataset.num != null){
    const i = +t.dataset.num, v = t.value.replace(/\D/g, '').slice(0, 2);
    if (t.value !== v) t.value = v;
    S.players[i].num = v; S.sel = i; renderCourt(); updateLive();
  } else if (t.id === 'email'){
    S.email = t.value;
    if (S.emailBad && validEmail(S.email)){ S.emailBad = false; t.classList.remove('bad'); t.setAttribute('aria-invalid', 'false'); $('emailerr').textContent = ''; }
  } else if (t.id === 'resp'){
    S.resp = t.value;
    if (S.respBad && validResp(S.resp)){ S.respBad = false; t.classList.remove('bad'); t.setAttribute('aria-invalid', 'false'); $('resperr').textContent = ''; }
  }
});

document.addEventListener('focusin', e => {
  const t = e.target, i = t.dataset && (t.dataset.name ?? t.dataset.num);
  if (i != null && S.step === 4 && +i !== S.sel){ S.sel = +i; renderCourt(); updateLive(); }
});

/* ===== Início ===== */
setN(1);
render();
