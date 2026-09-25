import { C } from './config.js';
import { uid, esc } from './utils.js';

/* ===== Desenho do jogador (SVG em camadas) ===== */
export const TOP_PATH = {
  camiseta:'M31 49 Q50 45 69 49 L80 58 L74 74 L67 70 L66 121 L34 121 L33 70 L26 74 L20 58 Z',
  regataF:'M38 49 Q50 57 62 49 L66 50 Q63 62 67 72 L66 121 L34 121 L33 72 Q37 62 34 50 Z',
  regataM:'M39 49 Q50 58 61 49 L67 50 Q64 63 68 72 L67 121 L33 121 L32 72 Q36 63 33 50 Z',
  cropped:'M38 49 Q50 58 62 49 L66 50 Q63 62 66 72 L65 88 L35 88 L34 72 Q37 62 34 50 Z'
};
export const SH_PATH = {
  masc:'M33 114 L67 114 L71 155 L53 157 L50 133 L47 157 L29 155 Z',
  fem:'M34 114 L66 114 L69 139 L53 140 L50 128 L47 140 L31 139 Z'
};

/* Polígono espelhado no eixo central (listras dos dois lados) */
function sym(pts, fill){
  const a = 'M' + pts.map(p => p.join(' ')).join(' L') + 'Z';
  const b = 'M' + pts.map(([x, y]) => (100 - x) + ' ' + y).join(' L') + 'Z';
  return `<path d="${a}" fill="${fill}"/><path d="${b}" fill="${fill}"/>`;
}
const TXT = `font-family="'Barlow Condensed',sans-serif" font-weight="700" text-anchor="middle" fill="${C.navy}"`;

export function topSVG(p, view, noText){
  if (!p.top) return `<path d="${TOP_PATH.camiseta}" fill="${C.ghost}"/>`;
  const tee = p.top === 'camiseta', crop = p.top === 'cropped';
  const d = tee ? TOP_PATH.camiseta : crop ? TOP_PATH.cropped : (p.g === 'F' ? TOP_PATH.regataF : TOP_PATH.regataM);
  const id = uid();
  let st = '';
  if (tee) st += sym([[12,48],[35,48],[35,64],[33,74],[24,82],[12,64]], C.navy) + sym([[21,76],[33,60],[34,64],[24,79]], C.turq);
  st += sym([[28,124],[46,124],[37,94],[31,66],[28,60]], C.turq)
      + sym([[40,124],[46,124],[39,104]], C.light)
      + sym([[28,124],[37,124],[32,98],[28,86]], C.navy)
      + sym([[29,56],[42,66],[36,80],[29,70]], C.turq);
  let out = `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#fff"/><g clip-path="url(#${id})">${st}</g>`;
  out += `<path d="${d}" fill="none" stroke="${C.navy}" stroke-width="${tee ? 1 : 1.8}" stroke-linejoin="round"/>`;
  if (tee) out += `<path d="${view === 'back' ? 'M42 47.5 Q50 50.5 58 47.5' : 'M41 47.5 Q50 55 59 47.5'}" fill="none" stroke="${C.navy}" stroke-width="3" stroke-linecap="round"/>`;
  if (noText) return out;
  const hasNum = p.num !== '', num = hasNum ? p.num.padStart(2, '0') : '00';
  if (view === 'front'){
    const ly = crop ? 62 : 64, lr = crop ? 4.2 : 5.5;
    out += `<circle cx="50" cy="${ly}" r="${lr}" fill="${C.gold}" stroke="${C.navy}" stroke-width="1"/><path d="M${50 - lr * .6} ${ly} H${50 + lr * .6}" stroke="${C.navy}" stroke-width=".8"/>`;
    out += `<text x="50" y="${crop ? 83 : 98}" font-size="${crop ? 12 : 18}" ${TXT} opacity="${hasNum ? 1 : .25}">${num}</text>`;
  } else {
    const name = p.name || 'NOME', w = crop ? 24 : 30, max = crop ? 7 : 9;
    const fs = Math.min(max, w / (Math.max(name.length, 3) * 0.5));
    out += `<text x="50" y="${crop ? 62 : 66}" font-size="${fs.toFixed(2)}" ${TXT} opacity="${p.name ? 1 : .25}">${esc(name)}</text>`;
    out += `<text x="50" y="${crop ? 84 : 101}" font-size="${crop ? 18 : 28}" ${TXT} opacity="${hasNum ? 1 : .25}">${num}</text>`;
  }
  return out;
}

export function shortSVG(p, view){
  if (!p.short || p.short === 'none') return `<path d="${SH_PATH.masc}" fill="${C.ghost}"/>`;
  const d = SH_PATH[p.short], id = uid(), fem = p.short === 'fem';
  let out = `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${C.navy}"/>`;
  out += `<g clip-path="url(#${id})">${sym([[26,112],[33,112],[31,160],[26,160]], C.turq)}${sym([[33,112],[35.5,112],[33.5,160],[31,160]], '#fff')}<path d="M30 118 L70 118" stroke="#1C4A7A" stroke-width="2"/></g>`;
  if (view === 'front'){
    out += `<path d="M49 116 L47 125 M51 116 L53 125" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`;
    out += `<circle cx="${fem ? 59 : 60}" cy="${fem ? 132 : 146}" r="3" fill="${C.gold}" stroke="#fff" stroke-width=".7"/>`;
  }
  return out;
}

export function figSVG(p, view){
  const F = p.g === 'F', N = !p.g, back = view === 'back';
  const skin = N ? C.ghostSkin : C.skin;
  const lw = F ? 10 : 11;
  let s = `<g stroke="${skin}" stroke-linecap="round" stroke-width="${lw}"><line x1="43.5" y1="122" x2="42" y2="191"/><line x1="56.5" y1="122" x2="58" y2="191"/></g>`;
  s += `<path d="${F ? 'M35 50 Q50 46 65 50 L64 86 Q61 100 64 118 L36 118 Q39 100 36 86 Z' : 'M32 50 Q50 46 68 50 L66 88 L63 118 L37 118 L34 88 Z'}" fill="${skin}"/>`;
  s += `<rect x="45" y="35" width="10" height="16" rx="3" fill="${skin}"/>`;
  s += shortSVG(p, view);
  s += `<g stroke="${skin}" stroke-linecap="round" stroke-width="${F ? 7.5 : 9}"><line x1="${F ? 36 : 33}" y1="55" x2="${F ? 26 : 22}" y2="112"/><line x1="${F ? 64 : 67}" y1="55" x2="${F ? 74 : 78}" y2="112"/></g>`;
  s += topSVG(p, view);
  if (F && !back) s += `<path d="M58 16 Q76 20 69 46 Q67 32 56 22Z" fill="${C.hair}"/>`;
  s += `<circle cx="50" cy="26" r="13" fill="${skin}"/>`;
  if (!N){
    if (back){
      s += `<circle cx="50" cy="25.5" r="13.3" fill="${C.hair}"/>`;
      if (F) s += `<path d="M46 26 Q43 46 50 54 Q57 46 54 26Z" fill="${C.hair}"/>`;
    } else {
      s += F ? `<path d="M36.5 25 Q37 11 50 11 Q64 11 63.5 25 Q60 16 50 17 Q41 17 36.5 25Z" fill="${C.hair}"/>`
             : `<path d="M37 23 Q38 12 50 12 Q62 12 63 23 Q58 17 50 17.5 Q42 17 37 23Z" fill="${C.hair}"/>`;
      s += `<circle cx="45.5" cy="27" r="1.2" fill="${C.navy}"/><circle cx="54.5" cy="27" r="1.2" fill="${C.navy}"/><path d="M47 32 Q50 34.2 53 32" fill="none" stroke="${C.navy}" stroke-width=".9" stroke-linecap="round"/>`;
    }
  }
  return `<g>${s}</g>`;
}

export const pvSVG = (p, view) => `<svg viewBox="8 4 84 196" aria-hidden="true">${figSVG(p, view)}</svg>`;
