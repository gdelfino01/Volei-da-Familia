/* ===== Peças de interface compartilhadas ===== */
import { esc } from './core/util.js';
import { S } from './store.js';

/* main.js preenche: redesenhar a tela atual / recarregar os dados e redesenhar */
export const app = { desenhar(){}, async recarregar(){} };

export function cabecalho({ kicker = 'Vôlei da Família', titulo, sub = '' }){
  return `<header class="cab">
    <div class="cab-linha">
      <p class="kicker">${esc(kicker)}</p>
      <button type="button" class="chip-admin${S.admin ? ' on' : ''}" data-global="admin">${S.admin ? 'Organizador · sair' : 'Organizador'}</button>
    </div>
    <h1>${esc(titulo)}</h1>
    ${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
  </header>`;
}

/* Cartão que pede o modo organizador */
export function soOrganizador(texto){
  return `<section class="cartao">
    <h2>Área do organizador</h2>
    <p class="mut">${esc(texto)}</p>
    <button type="button" class="btn pri" data-global="admin">Entrar com PIN</button>
  </section>`;
}

/* Escolha do domingo (Lista e Times); a troca é tratada no main.js */
export function seletorData(){
  if (!S.admin) return '';
  return `<section class="cartao linha-entre">
    <label class="campo cresce">Domingo<input type="date" data-global="data" value="${esc(S.data)}"></label>
  </section>`;
}

let timer;
export function aviso(msg, tipo = 'ok'){
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + tipo + ' on';
  clearTimeout(timer);
  timer = setTimeout(() => { el.className = 'toast'; }, tipo === 'erro' ? 5000 : 2600);
}

export async function copiar(texto){
  try { await navigator.clipboard.writeText(texto); }
  catch {
    const t = document.createElement('textarea');
    t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } finally { t.remove(); }
  }
  aviso('Copiado. Agora é só colar no grupo.');
}

/* Executa uma ação assíncrona com o botão travado e mostra erro, se houver */
export async function executar(botao, fn){
  const rotulo = botao?.textContent;
  if (botao){ botao.disabled = true; botao.textContent = 'Salvando…'; }
  try { return await fn(); }
  catch (e){ aviso(e.message, 'erro'); }
  finally { if (botao?.isConnected){ botao.disabled = false; botao.textContent = rotulo; } }
}
