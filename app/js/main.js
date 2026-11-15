/* ===== Entrada do app: rotas, carregamento e ações globais ===== */
import { S, carregar, entrarAdmin, sairAdmin } from './store.js';
import { app, aviso } from './ui.js';
import { demo } from './api.js';
import { PIN_DEMO, zerarDemo } from './mock.js';
import { deIso, esc } from './core/util.js';
import * as lista from './views/lista.js';
import * as times from './views/times.js';
import * as placar from './views/placar.js';
import * as ranking from './views/ranking.js';
import * as perfil from './views/perfil.js';

const TELAS = { lista, times, placar, ranking, perfil };
const tela = document.getElementById('tela');
const dlg = document.getElementById('dlgPin');

function rota(){
  const r = location.hash.slice(1);
  if (TELAS[r]) return r;
  if (S.admin) return 'lista';
  return S.meu ? 'times' : 'perfil';
}

function desenhar(){
  const r = rota();
  document.querySelectorAll('.barra a').forEach(a => {
    if (a.getAttribute('href') === '#' + r) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (!S.dados){
    tela.innerHTML = S.erro
      ? `<section class="cartao erro-carga"><h2>Não foi possível carregar</h2><p class="mut">${esc(S.erro)}</p>
         <button type="button" class="btn pri" data-global="tentar">Tentar de novo</button></section>`
      : '<p class="carregando">Carregando…</p>';
    return;
  }
  const v = TELAS[r];
  tela.onclick = tela.oninput = tela.onchange = tela.onsubmit = null;
  tela.innerHTML = v.render();
  v.bind?.(tela);
}

async function recarregar(){
  try { await carregar(); }
  catch (e){ S.erro = e.message; if (S.dados) aviso(e.message, 'erro'); }
  desenhar();
}

app.desenhar = desenhar;
app.recarregar = recarregar;

/* ---------- Ações globais ---------- */

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-global]');
  if (!b || b.tagName === 'INPUT') return;
  const g = b.dataset.global;
  if (g === 'admin'){
    if (S.admin){
      if (!confirm('Sair do modo organizador neste celular?')) return;
      sairAdmin();
      await recarregar();
    } else {
      dlg.querySelector('#pin').value = '';
      dlg.querySelector('.erro').textContent = '';
      dlg.showModal();
    }
  } else if (g === 'tentar'){
    S.erro = ''; desenhar(); await recarregar();
  } else if (g === 'zerar'){
    if (!confirm('Apagar os dados de demonstração deste navegador?')) return;
    zerarDemo(); await recarregar();
  }
});

document.addEventListener('change', async e => {
  if (e.target.dataset.global !== 'data' || !e.target.value) return;
  S.data = e.target.value;
  if (deIso(S.data).getDay() !== 0) aviso('Atenção: essa data não é um domingo.', 'erro');
  await recarregar();
});

dlg.querySelector('[data-fechar]').addEventListener('click', () => dlg.close());
dlg.querySelector('form').addEventListener('submit', async e => {
  e.preventDefault();
  const pin = dlg.querySelector('#pin').value.trim();
  const erro = dlg.querySelector('.erro');
  const botao = dlg.querySelector('[value=entrar]');
  if (!pin){ erro.textContent = 'Digite o PIN.'; return; }
  botao.disabled = true; erro.textContent = '';
  try {
    await entrarAdmin(pin);
    dlg.close();
    aviso('Modo organizador ativado neste celular.');
    desenhar();
  } catch (err){ erro.textContent = err.message; }
  finally { botao.disabled = false; }
});

window.addEventListener('hashchange', () => { desenhar(); window.scrollTo(0, 0); });

if (demo){
  const faixa = document.getElementById('demo');
  faixa.hidden = false;
  faixa.querySelector('span').textContent = `Modo demonstração: os dados ficam só neste navegador. PIN de teste: ${PIN_DEMO}.`;
}

desenhar();
recarregar();
