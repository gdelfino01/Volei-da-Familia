import { C } from './config.js';
import { uid, esc } from './utils.js';

/* ===== Desenho do jogador (SVG em camadas, coordenadas 0–100 × 0–200) ===== */
const K = {
  skinDark:'#C58E68', ghostDark:'#B7C3CF', navyDeep:'#081F38', lips:'#9A5344', blush:'#E98A7A'
};

export const TOP_PATH = {
  camiseta:'M40 46 Q50 51 60 46 L70 49 Q76 52 79 60 L81 70 L71 73 L68 66 L67 121 Q50 123.5 33 121 L32 66 L29 73 L19 70 L21 60 Q24 52 30 49 Z',
  regataF:'M42 46 Q50 53 58 46 L62 47 Q60 60 65 70 Q63 84 65 100 L66 121 Q50 123 34 121 L35 100 Q37 84 35 70 Q40 60 38 47 Z',
  regataM:'M41 46 Q50 53 59 46 L64 47 Q62 60 68 70 L67 121 Q50 123.5 33 121 L32 70 Q38 60 36 47 Z',
  cropped:'M42 47 Q50 55 58 47 L62 48 Q60 60 65 70 L65 88 Q50 90 35 88 L35 70 Q40 60 38 48 Z',
  croppedBack:'M41 46 Q50 50 59 46 L56 58 Q61 63 65 70 L65 88 Q50 90 35 88 L35 70 Q39 63 44 58 Z'
};
export const SH_PATH = {
  masc:'M33 114 L67 114 L70 154 Q61 156.5 52.5 155 L50 133 L47.5 155 Q39 156.5 30 154 Z',
  fem:'M34 114 L66 114 L68.5 136 Q60 139 52.5 138 L50 128 L47.5 138 Q40 139 31.5 136 Z'
};

/* Desenha o conteúdo e a cópia espelhada no eixo x = 50 */
const mir = s => `${s}<g transform="matrix(-1 0 0 1 100 0)">${s}</g>`;
const line = (d, w, c) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/* Membro com contorno: traço escuro por baixo e pele por cima */
const limb = (d, w, skin, dark) => line(d, w + 1.4, dark) + line(d, w, skin);

/* Recortes do uniforme: chamas turquesa, azul-claro e marinho subindo pelas laterais */
const SWOOSH = mir(
  `<path d="M24 124 L47 124 C39 112 37 96 40 76 C35 90 30 98 24 100 Z" fill="${C.turq}"/>` +
  `<path d="M24 124 L37 124 C33 112 32 100 35 86 C31 96 28 102 24 106 Z" fill="${C.navy}"/>` +
  `<path d="M38 124 L45 124 C41 114 40 104 41 92 C39 104 38 114 38 124 Z" fill="${C.light}"/>` +
  `<path d="M26 56 C32 60 36 67 37 77 C33 72 30 70 26 72 Z" fill="${C.turq}"/>` +
  `<path d="M26 64 C30 66 32.5 70 33.5 75 C31 73 28.5 73 26 75 Z" fill="${C.navy}"/>` +
  `<path d="M22 40 L33 40 L35 126 L22 126 Z" fill="${C.navy}" opacity=".05"/>`
);
const SLEEVES = mir(
  `<path d="M8 40 L31 44 C31 56 32 64 33 78 L8 78 Z" fill="${C.navy}"/>` +
  `<path d="M18 69 C23 63 27 56 30 49 L32 52 C29 60 25 66 21 72 Z" fill="${C.turq}"/>`
);

/* Escudo do time (versão simplificada) */
function badge(cx, cy, r){
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${C.gold}" stroke-width="${(r * .24).toFixed(2)}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${(r * .66).toFixed(2)}" fill="${C.navy}"/>` +
    `<circle cx="${cx}" cy="${cy - r * .18}" r="${(r * .24).toFixed(2)}" fill="#fff"/>` +
    `<rect x="${cx - r * .95}" y="${cy + r * .12}" width="${r * 1.9}" height="${r * .46}" rx="${r * .08}" fill="#fff" stroke="${C.navy}" stroke-width="${(r * .08).toFixed(2)}"/>`;
}

const TXT = `font-family="'Barlow Condensed',sans-serif" font-weight="700" text-anchor="middle" fill="${C.navy}"`;

function topPath(p, view){
  const back = view === 'back';
  if (p.top === 'camiseta') return back ? TOP_PATH.camiseta.replace('Q50 51', 'Q50 48.5') : TOP_PATH.camiseta;
  if (p.top === 'cropped') return back ? TOP_PATH.croppedBack : TOP_PATH.cropped;
  const d = p.g === 'F' ? TOP_PATH.regataF : TOP_PATH.regataM;
  return back ? d.replace('Q50 53', 'Q50 49') : d;
}

export function topSVG(p, view, noText){
  if (!p.top) return `<path d="${TOP_PATH.camiseta}" fill="${C.ghost}"/>`;
  const tee = p.top === 'camiseta', crop = p.top === 'cropped', back = view === 'back';
  const d = topPath(p, view), id = uid();
  // No cropped, os recortes são comprimidos para caber na peça curta
  const pattern = crop ? `<g transform="translate(50 88) scale(1 .62) translate(-50 -124)">${SWOOSH}</g>` : SWOOSH;
  let out = `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="#fff"/>`;
  out += `<g clip-path="url(#${id})">${pattern}${tee ? SLEEVES : ''}</g>`;
  out += `<path d="${d}" fill="none" stroke="${C.navy}" stroke-width="${tee ? 1 : 2}" stroke-linejoin="round"/>`;
  if (tee){
    const neck = back ? 'M40.5 46.5 Q50 49.5 59.5 46.5' : 'M40.5 46.5 Q50 53 59.5 46.5';
    out += line(neck, 3, C.navy);
    if (!back) out += line('M42 48.6 Q50 54.2 58 48.6', .8, C.turq);
  }
  if (noText) return out;
  const hasNum = p.num !== '', num = hasNum ? p.num.padStart(2, '0') : '00';
  if (!back){
    out += crop ? badge(50, 61, 4.4) : badge(50, 62, 6);
    out += `<text x="50" y="${crop ? 83 : 96}" font-size="${crop ? 12 : 18}" ${TXT} opacity="${hasNum ? 1 : .25}">${num}</text>`;
  } else {
    // Largura útil nas costas: a regata é mais estreita que a camiseta
    const name = p.name || 'NOME', w = crop ? 21 : tee ? 28 : 22, max = crop ? 7 : 9;
    const fs = Math.min(max, w / (Math.max(name.length, 3) * 0.56));
    out += `<text x="50" y="66" font-size="${fs.toFixed(2)}" ${TXT} opacity="${p.name ? 1 : .25}">${esc(name)}</text>`;
    out += `<text x="50" y="${crop ? 85 : 101}" font-size="${crop ? 17 : 28}" ${TXT} opacity="${hasNum ? 1 : .25}">${num}</text>`;
  }
  return out;
}

export function shortSVG(p, view){
  if (!p.short || p.short === 'none') return `<path d="${SH_PATH.masc}" fill="${C.ghost}"/>`;
  const d = SH_PATH[p.short], id = uid(), fem = p.short === 'fem';
  let out = `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${C.navy}"/>`;
  out += `<g clip-path="url(#${id})">` +
    mir(`<path d="M28 160 L38 160 C35.5 146 34.5 130 34.5 112 L31 112 C31 130 29.5 146 28 160 Z" fill="${C.turq}"/>` +
        `<path d="M36.5 160 L39 160 C36.8 146 36 130 36 112 L35 112 C35 130 35.5 146 36.5 160 Z" fill="#fff"/>`) +
    `<rect x="28" y="112" width="44" height="5.5" fill="${K.navyDeep}"/>` +
    (view === 'front' ? line('M50 118 V132', .6, K.navyDeep) : line('M50 119 V130', .6, K.navyDeep)) +
    `</g>`;
  if (view === 'front'){
    out += line('M48.6 116.6 C47.4 119.5 46 121.8 44.6 124.2 M51.4 116.6 C52.6 119.5 54 121.8 55.4 124.2', 1, '#fff');
    out += line('M50 116.4 C47.2 114.6 45.8 117.6 48.6 117.1 M50 116.4 C52.8 114.6 54.2 117.6 51.4 117.1', .8, '#fff');
    out += badge(fem ? 59.5 : 60.5, fem ? 130.5 : 145, 3.1);
  }
  return out;
}

function head(F, N, back, skin, dark){
  let s = '';
  // Rabo de cavalo atrás da cabeça (vista de frente)
  if (F && !back) s += `<path d="M58 14 C69 12 73 22 70.5 34 C69 42 65.5 47 62 49.5 C64 41 64.5 32 61.5 24 Z" fill="${C.hair}"/><circle cx="60.5" cy="16.5" r="1.7" fill="${C.turq}"/>`;
  s += `<ellipse cx="37.8" cy="28" rx="2" ry="3" fill="${skin}" stroke="${dark}" stroke-width=".6"/><ellipse cx="62.2" cy="28" rx="2" ry="3" fill="${skin}" stroke="${dark}" stroke-width=".6"/>`;
  s += `<ellipse cx="50" cy="26" rx="12.3" ry="13.2" fill="${skin}" stroke="${dark}" stroke-width=".7"/>`;
  if (N) return s;
  if (back){
    s += F
      ? `<path d="M37.6 27 C37 14 43 12.4 50 12.4 C57 12.4 63 14 62.4 27 C62 33 59.5 37 56.5 38.6 L43.5 38.6 C40.5 37 38 33 37.6 27 Z" fill="${C.hair}"/>` +
        `<path d="M46.5 20 C43 32 45 46 50 54 C55 46 57 32 53.5 20 Z" fill="${C.hair}"/><circle cx="50" cy="21" r="1.9" fill="${C.turq}"/>`
      : `<path d="M37.6 26 C37 14 43 12.6 50 12.6 C57 12.6 63 14 62.4 26 C62 31 60 35 57 36.4 L43 36.4 C40 35 38 31 37.6 26 Z" fill="${C.hair}"/>`;
    return s;
  }
  // Cabelo (frente)
  s += F
    ? `<path d="M37 28 C36 13 44 10 50 10 C57 10 64.5 13 63 28 C61.5 20 57.5 16.4 50.5 16.8 C44.5 17.2 40 21 37 28 Z" fill="${C.hair}"/>`
    : `<path d="M37.6 25 C37 14 43 10.5 50.5 10.5 C58 10.5 63.5 15 62.5 25 C61 20 58 17.5 54 17.2 C49 19 43 19 39.6 20.6 C38.6 22 38 23.5 37.6 25 Z" fill="${C.hair}"/>`;
  // Rosto
  s += mir(line('M43 22.6 Q45.5 21.2 48 22.3', .9, C.hair) +
           `<ellipse cx="45.6" cy="26.8" rx="1.15" ry="1.45" fill="${C.navy}"/><circle cx="46" cy="26.3" r=".4" fill="#fff"/>` +
           `<circle cx="43" cy="31.4" r="1.8" fill="${K.blush}" opacity=".35"/>`);
  s += line('M50 28.4 Q49 30.8 50.6 31.2', .7, dark);
  s += line('M46.6 33.2 Q50 35.8 53.4 33.2', 1, K.lips);
  return s;
}

export function figSVG(p, view){
  const F = p.g === 'F', N = !p.g, back = view === 'back';
  const skin = N ? C.ghostSkin : C.skin, dark = N ? K.ghostDark : K.skinDark;
  let s = '';
  // Pernas e pés
  s += mir(limb('M43.5 122 Q43.8 158 42.8 184', F ? 9.5 : 10.5, skin, dark) +
           `<path d="M38.2 186 Q37.6 183.4 41.6 183.2 Q46.6 183.2 47.2 186.8 Q47.6 191.6 42.8 191.8 L37.6 191.8 Q34.2 191.6 34.6 189.4 Q35 187.4 38.2 186 Z" fill="${skin}" stroke="${dark}" stroke-width=".7" stroke-linejoin="round"/>` +
           (N ? '' : line('M41.4 165.5 Q43 167 44.6 165.5', .6, dark)));
  // Tronco
  s += `<path d="${F ? 'M36 49 Q50 46 64 49 Q66 68 63 86 Q61 100 65 118 L35 118 Q39 100 37 86 Q34 68 36 49 Z' : 'M33 49 Q50 45 67 49 Q69 70 66 92 L65 124 L35 124 L34 92 Q31 70 33 49 Z'}" fill="${skin}" stroke="${dark}" stroke-width=".7"/>`;
  if (F && !back && !N) s += line('M49.4 103.5 Q50 104.6 50.6 103.5', .6, dark);
  // Pescoço
  s += `<path d="M44.8 33 L55.2 33 L55.6 46.5 Q50 49.5 44.4 46.5 Z" fill="${skin}"/><path d="M44.8 36 Q50 40.5 55.2 36 L55.2 34 L44.8 34 Z" fill="${dark}" opacity=".35"/>`;
  s += shortSVG(p, view);
  // Braços e mãos
  s += mir(F
    ? limb('M36.5 55 Q32 69 31 83 Q29.5 95 29 105', 7.2, skin, dark) + `<ellipse cx="28.8" cy="108.6" rx="3.1" ry="3.9" fill="${skin}" stroke="${dark}" stroke-width=".7"/>`
    : limb('M33 55 Q28 70 27 84 Q25.5 97 25 107', 8.5, skin, dark) + `<ellipse cx="24.8" cy="111" rx="3.4" ry="4.2" fill="${skin}" stroke="${dark}" stroke-width=".7"/>`);
  s += topSVG(p, view);
  s += head(F, N, back, skin, dark);
  return `<g>${s}</g>`;
}

export const pvSVG = (p, view) => `<svg viewBox="8 4 84 196" aria-hidden="true">${figSVG(p, view)}</svg>`;
