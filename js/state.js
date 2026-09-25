import { MAXN, PRICES } from './config.js';
import { uid } from './utils.js';

/* ===== Estado do pedido ===== */
export const S = { step:0, players:[], sel:0, resp:'', err:'', anim:true, dir:1, done:null, sending:false, respBad:false };
export const seen = new Set();   // jogadores que já apareceram na quadra
export const flash = new Set();  // jogadores que mudaram e devem pular na próxima renderização

export function mk(){ return { id:uid(), g:null, line:null, top:null, short:null, topSize:null, shortSize:null, name:'', num:'' }; }

export function setN(n){
  n = Math.max(1, Math.min(MAXN, n));
  while (S.players.length < n){ const p = mk(); if (S.step >= 1) p.g = 'M'; S.players.push(p); }
  S.players.length = n;
  if (S.sel >= n) S.sel = n - 1;
}

export const single = () => S.players.length === 1;
export const femCount = () => S.players.filter(p => p.g === 'F').length;

/* Remove peças que não existem para o gênero escolhido */
export function sanitize(p){
  if (p.g === 'M'){
    if (p.top === 'cropped'){ p.top = null; p.topSize = null; }
    if (p.short === 'fem'){ p.short = null; p.shortSize = null; }
  }
}
export function setFem(k){
  S.players.forEach((p, i) => { const g = i < k ? 'F' : 'M'; if (p.g !== g){ p.g = g; sanitize(p); flash.add(p.id); } });
}

export function price(p){
  if (!p.top || !p.line) return 0;
  const L = PRICES[p.line];
  return (p.short && p.short !== 'none') ? L.kit : L.top;
}
export const total = () => S.players.reduce((a, p) => a + price(p), 0);
export const done2 = p => !!(p.line && p.top && p.short);
export const done3 = p => !!(p.topSize && (p.short === 'none' || p.shortSize));
export const validResp = v => { const t = v.trim(), parts = t.split(/\s+/).filter(Boolean);
  return t.length >= 5 && parts.length >= 2 && parts.every(w => /^\p{L}[\p{L}'.-]*$/u.test(w)); };
export const tipo = p => p.short === 'none' ? 'Só parte de cima' : 'Kit completo';
