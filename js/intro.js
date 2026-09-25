import { PRICES } from './config.js';
import { brl, $ } from './utils.js';

/* ===== Abas dos modelos ===== */
const tabs = [...document.querySelectorAll('[role="tab"][data-model]')];
function selectModel(key){
  tabs.forEach(t => {
    const on = t.dataset.model === key;
    t.setAttribute('aria-selected', on);
    t.tabIndex = on ? 0 : -1;
    $('model-' + t.dataset.model).hidden = !on;
  });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectModel(t.dataset.model));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length];
    selectModel(n.dataset.model); n.focus();
  });
});

/* ===== Preços (vêm da mesma configuração do pedido) ===== */
$('precos').innerHTML = Object.values(PRICES).map(L => `
  <div class="price">
    <div class="price-h"><span class="sw" style="background:${L.cor}"></span>Linha ${L.nome}</div>
    <dl>
      <div><dt>Kit completo</dt><dd class="big">${brl(L.kit)}</dd></div>
      <div><dt>Só a parte de cima</dt><dd>${brl(L.top)}</dd></div>
    </dl>
  </div>`).join('');

/* ===== Botão fixo no celular: aparece quando o botão principal sai da tela ===== */
const bar = $('stickycta');
if ('IntersectionObserver' in window){
  const vis = new Map();
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => vis.set(e.target.id, e.isIntersecting));
    bar.classList.toggle('show', !vis.get('hero-cta') && !vis.get('final-cta'));
  });
  io.observe($('hero-cta'));
  io.observe($('final-cta'));
}
