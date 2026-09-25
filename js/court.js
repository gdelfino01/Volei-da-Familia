import { C } from './config.js';
import { S, seen, flash, total, femCount, single } from './state.js';
import { figSVG } from './figure.js';
import { esc, brl, $ } from './utils.js';

let lastView = 'front';

/* Posições de k jogadores numa fileira entre x0 e x1; s = escala da figura */
function row(k, base, x0, x1, maxS){
  const sp = (x1 - x0) / k;
  return Array.from({ length:k }, (_, j) => ({ cx: x0 + sp * (j + .5), base, s: Math.min(maxS, sp / 66) }));
}

/* Todos ficam do lado de perto da rede: até 4 numa fileira, depois duas fileiras (fundo e frente) */
function layout(n){
  if (n === 1) return { front: row(1, 392, 60, 580, 1.3), back: [] }; // kit único: jogador maior
  if (n <= 4) return { front: row(n, 380, 60, 580, 1), back: [] };
  const back = Math.floor(n / 2), front = n - back;
  return { front: row(front, 384, 50, 590, .78), back: row(back, 294, 110, 530, .6) };
}

function subtitle(){
  const P = S.players, n = P.length;
  if (S.step < 1) return '';
  if (n === 1) return P[0].g ? (P[0].g === 'F' ? 'Feminino' : 'Masculino') : '';
  const f = femCount(), m = n - f;
  return `${f} feminino${f !== 1 ? 's' : ''}, ${m} masculino${m !== 1 ? 's' : ''}`;
}

export function renderCourt(){
  const P = S.players, n = P.length;
  const view = (S.step === 4 && !S.done) ? 'back' : 'front';
  const flip = view !== lastView;
  const showSel = !S.done && n > 1 && S.step >= 2 && S.step <= 4;
  const L = layout(n), nf = L.front.length;

  const one = (p, i, o) => {
    const cls = !seen.has(p.id) ? 'enter' : flip ? 'flip' : flash.has(p.id) ? 'pop' : '';
    const sel = showSel && i === S.sel;
    const label = p.name || (single() ? '' : String(i + 1));
    return `<g class="fig" data-fig="${i}" tabindex="0" role="button" aria-label="Jogador ${i + 1}">
      <ellipse cx="${o.cx}" cy="${o.base}" rx="${30 * o.s}" ry="${6 * o.s}" fill="rgba(11,45,80,.10)"/>
      ${sel ? `<ellipse class="ring" cx="${o.cx}" cy="${o.base}" rx="${40 * o.s}" ry="${10 * o.s}" fill="none" stroke="${C.turq}" stroke-width="3"/>` : ''}
      <g transform="translate(${o.cx - 50 * o.s} ${o.base - 196 * o.s}) scale(${o.s})"><g class="in ${cls}">${figSVG(p, view)}</g></g>
      ${label ? `<text x="${o.cx}" y="${o.base + 12 * o.s + 10}" text-anchor="middle" class="lbl" font-size="${Math.round(14 * o.s + 5)}">${esc(label)}</text>` : ''}</g>`;
  };

  // A fileira do fundo é desenhada primeiro, para ficar atrás da fileira da frente
  let backRow = '', frontRow = '';
  P.forEach((p, i) => {
    if (i < nf) frontRow += one(p, i, L.front[i]);
    else backRow += one(p, i, L.back[i - nf]);
  });

  let mesh = '';
  for (let x = 113; x < 530; x += 12) mesh += `M${x} 130 V172 `;
  for (let y = 138; y < 172; y += 8) mesh += `M107 ${y} H533 `;
  const t = total(), sub = subtitle();

  $('court').innerHTML = `<svg viewBox="0 0 640 422" role="img" aria-label="Quadra de vôlei de areia com ${n} ${n > 1 ? 'jogadores' : 'jogador'}">
    <path d="M190 80 L450 80 L623 414 L17 414 Z" fill="#F8EFDB" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
    <line x1="125" y1="205" x2="515" y2="205" stroke="#fff" stroke-width="3"/>
    <rect x="104" y="116" width="6" height="94" rx="3" fill="${C.navy}"/><rect x="530" y="116" width="6" height="94" rx="3" fill="${C.navy}"/>
    <path d="${mesh}" stroke="${C.navy}" stroke-opacity=".22" stroke-width=".8"/>
    <rect x="107" y="122" width="426" height="8" fill="#fff" stroke="${C.navy}" stroke-width="1.5"/>
    <rect x="107" y="172" width="426" height="4" fill="#fff" stroke="${C.navy}" stroke-width="1"/>
    ${backRow}${frontRow}
    <text x="24" y="40" class="ct">${n} ${n > 1 ? 'kits' : 'kit'}</text>
    ${sub ? `<text x="24" y="60" class="cs">${sub}</text>` : ''}
    ${t > 0 ? `<text x="616" y="40" text-anchor="end" class="ct">${brl(t)}</text><text x="616" y="60" text-anchor="end" class="cs">total parcial</text>` : ''}
  </svg>`;
  P.forEach(p => seen.add(p.id));
  flash.clear();
  lastView = view;
}
