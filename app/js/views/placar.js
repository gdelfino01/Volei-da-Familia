/* ===== Placar lance a lance (uso na quadra) =====
   Tocar no time que pontuou → (opcional) quem fez → como foi: o toque no "como" já registra.
   Tudo fica no celular na hora e vai para a planilha em lote (placar-store.js). */
import { S, cfg, jogador, timesSalvos, partidasSalvas } from '../store.js';
import { cabecalho, soOrganizador, aviso, app } from '../ui.js';
import { esc, ddmm } from '../core/util.js';
import {
  TIPOS, TIPOS_PONTO, partidaAtual, encerradas, placar, vencedor, iniciar, registrar, desfazer, encerrar,
  cancelarAtual, excluir, priorizar, pendentes, descreverLance
} from '../core/placar.js';
import { estadoDe, guardar, novoId, sincronizar, agendar, envio, totalPendente, aoMudarEnvio } from '../placar-store.js';
import { CORES_TIMES } from '../config.js';

let painel = null;          // { tipo: 'ponto', time, jogador } | { tipo: 'erro' }
let pararDeOuvir = null, travaTela = null;

const cor = t => CORES_TIMES[(t - 1) % CORES_TIMES.length];
const nomeDe = id => jogador(id)?.nome || 'Jogador';
const jogadoresDo = t => (timesSalvos()[t - 1] || []).map(id => ({ id, nome: nomeDe(id) }));
const bolinha = t => `<span class="bolinha" style="background:${cor(t)}" aria-hidden="true"></span>`;

function estado(){
  const n = timesSalvos().length;
  const e = estadoDe(S.data, n);
  // times refeitos antes do primeiro jogo: a fila acompanha
  if (!e.partidas.length && !e.atual && e.fila.length !== n){ e.fila = Array.from({ length: n }, (_, i) => i + 1); guardar(); }
  return e;
}

/* ---------- Pedaços da tela ---------- */

function statusEnvio(){
  const pend = totalPendente();
  let cls = 'ok', txt = 'Tudo enviado para a planilha.', botao = false;
  if (envio.andamento){ cls = 'neutro'; txt = 'Enviando para a planilha…'; }
  else if (envio.erro){ cls = 'alerta'; txt = envio.erro + (pend ? ` ${pend} jogo(s) aguardando envio.` : ''); botao = pend > 0; }
  else if (pend){ cls = 'neutro'; txt = `${pend} jogo(s) guardado(s) neste celular, aguardando envio.`; botao = true; }
  else if (!envio.ultimo) return '<div id="envio"></div>';
  return `<div id="envio" class="envio ${cls}" role="status"><span>${esc(txt)}</span>${botao ? '<button type="button" class="btn texto peq" data-a="enviar">Enviar agora</button>' : ''}</div>`;
}

function cartaoTime(t, pts, fim){
  const sel = painel?.tipo === 'ponto' && painel.time === t;
  return `<button type="button" class="time-placar${sel ? ' sel' : ''}" style="--cor:${cor(t)}" data-a="ponto" data-t="${t}" aria-pressed="${sel}"${fim ? ' disabled' : ''}>
    <span class="nome">Time ${t}</span>
    <span class="pts">${pts}</span>
    <span class="mais">${fim ? '&nbsp;' : '+ ponto'}</span>
  </button>`;
}

function painelPonto(){
  const t = painel.time;
  return `<section class="cartao painel" aria-label="Registrar ponto do Time ${t}">
    <h2>Ponto do Time ${t}: quem fez?</h2>
    <p class="mut peq">Opcional. Depois toque em como foi.</p>
    <div class="grade2">${jogadoresDo(t).map(j => {
      const sel = painel.jogador === j.id;
      return `<button type="button" class="btn-j${sel ? ' sel' : ''}" style="--cor:${cor(t)}" data-a="quem" data-id="${esc(j.id)}" aria-pressed="${sel}">${esc(j.nome)}</button>`;
    }).join('')}</div>
    <h3 class="sub-tit">Como?</h3>
    <div class="grade2">${TIPOS_PONTO.map(tp => `<button type="button" class="btn pri" data-a="como" data-tipo="${tp}">${TIPOS[tp]}</button>`).join('')}</div>
    <button type="button" class="btn texto" data-a="fechar">Cancelar</button>
  </section>`;
}

function painelErro(p){
  return `<section class="cartao painel" aria-label="Registrar erro de jogador">
    <h2>Quem errou?</h2>
    <p class="mut peq">Saque ou ataque fora. O ponto vai para o outro time.</p>
    ${[p.time_a, p.time_b].map(t => `<h3 class="sub-tit">${bolinha(t)} Time ${t}</h3>
      <div class="grade2">${jogadoresDo(t).map(j =>
        `<button type="button" class="btn-j" style="--cor:${cor(t)}" data-a="errou" data-id="${esc(j.id)}" data-t="${t}">${esc(j.nome)}</button>`).join('')}</div>`).join('')}
    <button type="button" class="btn texto" data-a="fechar">Cancelar</button>
  </section>`;
}

function ultimosLances(p){
  if (!p.lances.length) return '';
  let a = 0, b = 0;
  const linhas = p.lances.map(l => {
    if (l.time === p.time_a) a++; else b++;
    return `<li>${bolinha(l.time)}<span class="txt">${esc(descreverLance(l, nomeDe))}</span><span class="pl">${a}–${b}</span></li>`;
  });
  return `<section class="cartao lances"><h2>Últimos lances</h2><ol>${linhas.reverse().slice(0, 8).join('')}</ol></section>`;
}

function filaHTML(e, comBotoes){
  if (!e.fila.length) return '';
  return `<section class="cartao"><h2>Fila</h2><ol class="fila">${e.fila.map((t, i) => `<li>${bolinha(t)}<span>Time ${t}</span>
    ${comBotoes && i > 0 ? `<button type="button" class="btn texto peq" data-a="priorizar" data-t="${t}">Passar para a frente</button>` : ''}</li>`).join('')}</ol></section>`;
}

function telaJogo(e, p){
  const { a, b } = placar(p);
  const v = vencedor(p);
  let meio = '';
  if (v){
    meio = `<section class="cartao vitoria" role="status">
      <p class="vitoria-tit">${bolinha(v)} Time ${v} venceu ${Math.max(a, b)} a ${Math.min(a, b)}</p>
      <button type="button" class="btn ok bloco" data-a="salvar-proximo">Salvar e próximo jogo</button>
    </section>`;
  } else if (painel?.tipo === 'ponto') meio = painelPonto();
  else if (painel?.tipo === 'erro') meio = painelErro(p);
  return `<div class="grade2 placar">${cartaoTime(p.time_a, a, !!v)}${cartaoTime(p.time_b, b, !!v)}</div>
    ${meio}
    <div class="grade2">
      <button type="button" class="btn sec" data-a="erro"${v ? ' disabled' : ''}>Erro de jogador</button>
      <button type="button" class="btn sec" data-a="desfazer"${p.lances.length ? '' : ' disabled'}>Desfazer último</button>
    </div>
    ${ultimosLances(p)}
    ${e.fila.length ? `<p class="mut peq">Próximo: vencedor x Time ${e.fila[0]}.</p>` : ''}
    ${filaHTML(e, false)}
    <div class="linha-entre">
      <button type="button" class="btn texto" data-a="encerrar">Encerrar agora</button>
      <button type="button" class="btn texto perigo" data-a="cancelar">Cancelar este jogo</button>
    </div>`;
}

function telaInicio(e){
  const n = timesSalvos().length;
  const [pa, pb] = [e.fila[0] ?? 1, e.fila[1] ?? 2];
  const opcoes = sel => Array.from({ length: n }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>Time ${i + 1}</option>`).join('');
  return `<section class="cartao">
      <h2>${encerradas(e).length ? 'Próximo jogo' : 'Primeiro jogo'}</h2>
      <div class="grade2">
        <label class="campo">Time A<select id="tA">${opcoes(pa)}</select></label>
        <label class="campo">Time B<select id="tB">${opcoes(pb)}</select></label>
      </div>
      <label class="campo">Pontos para vencer<input id="alvo" type="number" inputmode="numeric" min="5" max="30" value="${esc(cfg().pontos_partida || 15)}"></label>
      <button type="button" class="btn pri bloco" data-a="comecar">Começar jogo</button>
    </section>
    ${filaHTML(e, true)}`;
}

function listaJogos(jogos, { e = null } = {}){
  if (!jogos.length) return '';
  return `<section class="cartao sem-pad"><h2 class="cartao-tit">Jogos de hoje</h2>
    ${jogos.map(p => {
      const ganhouA = p.vencedor === p.time_a, ganhouB = p.vencedor === p.time_b;
      const pend = e && p.versao !== p.versaoSync;
      return `<div class="jogo">
        <span class="seq">${p.seq}</span>
        <span class="lado${ganhouA ? ' ganhou' : ''}">${bolinha(p.time_a)}Time ${p.time_a}</span>
        <span class="res">${p.pontos_a} x ${p.pontos_b}</span>
        <span class="lado dir${ganhouB ? ' ganhou' : ''}">Time ${p.time_b}${bolinha(p.time_b)}</span>
        ${e ? `<button type="button" class="btn texto peq perigo" data-a="excluir" data-id="${esc(p.id)}" aria-label="Excluir jogo ${p.seq}">Excluir</button>` : ''}
        ${pend ? '<span class="tag laranja">Não enviado</span>' : ''}
      </div>`;
    }).join('')}
  </section>`;
}

/* ---------- Tela ---------- */

export function render(){
  if (!S.admin){
    return cabecalho({ kicker: `Domingo, ${ddmm(S.data)}`, titulo: 'Placar' }) +
      (listaJogos(partidasSalvas()) || '<section class="cartao"><p class="mut">Os resultados aparecem aqui durante o domingo.</p></section>') +
      soOrganizador('Registrar o placar é com a organização.');
  }
  if (timesSalvos().length < 2){
    return cabecalho({ kicker: `Domingo, ${ddmm(S.data)}`, titulo: 'Placar' }) +
      '<section class="cartao"><p>Salve os times do domingo na aba Times primeiro.</p><a class="btn pri" href="#times">Ir para Times</a></section>';
  }
  const e = estado();
  const p = partidaAtual(e);
  return cabecalho({ kicker: p ? `Jogo ${p.seq} · até ${p.alvo}` : `Domingo, ${ddmm(S.data)}`, titulo: 'Placar' }) +
    statusEnvio() +
    (p ? telaJogo(e, p) : telaInicio(e)) +
    listaJogos(encerradas(e), { e });
}

function depoisDeMudar(){
  guardar();
  agendar();
  app.desenhar();
}

export function bind(root){
  pararDeOuvir?.();
  pararDeOuvir = aoMudarEnvio(() => {
    // envio terminou: redesenha tudo (etiquetas "Não enviado"), exceto se alguém estiver mexendo num campo
    const campo = document.activeElement?.matches?.('input, select, textarea');
    if (!envio.andamento && !campo) return app.desenhar();
    const el = document.getElementById('envio');
    if (el) el.outerHTML = statusEnvio();
  });
  if (!S.admin || timesSalvos().length < 2) return;
  const e = estado();
  if (partidaAtual(e) && !travaTela && navigator.wakeLock){
    navigator.wakeLock.request('screen').then(t => { travaTela = t; t.addEventListener('release', () => { travaTela = null; }); }).catch(() => {});
  }
  if (pendentes(e).length && navigator.onLine !== false) agendar(3000);

  root.onclick = async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    const p = partidaAtual(e);
    try {
      if (a === 'ponto'){
        const t = Number(b.dataset.t);
        painel = painel?.tipo === 'ponto' && painel.time === t ? null : { tipo: 'ponto', time: t, jogador: '' };
        app.desenhar();
      } else if (a === 'quem'){
        painel.jogador = painel.jogador === b.dataset.id ? '' : b.dataset.id;
        app.desenhar();
      } else if (a === 'como'){
        registrar(e, { time: painel.time, jogador_id: painel.jogador, tipo: b.dataset.tipo }, { id: novoId('L') });
        painel = null;
        navigator.vibrate?.(20);
        depoisDeMudar();
      } else if (a === 'erro'){
        painel = painel?.tipo === 'erro' ? null : { tipo: 'erro' };
        app.desenhar();
      } else if (a === 'errou'){
        const t = Number(b.dataset.t);
        registrar(e, { time: t === p.time_a ? p.time_b : p.time_a, jogador_id: b.dataset.id, tipo: 'erro' }, { id: novoId('L') });
        painel = null;
        navigator.vibrate?.(20);
        depoisDeMudar();
      } else if (a === 'fechar'){
        painel = null; app.desenhar();
      } else if (a === 'desfazer'){
        const l = desfazer(e);
        painel = null;
        if (l) aviso('Desfeito: ' + descreverLance(l, nomeDe));
        depoisDeMudar();
      } else if (a === 'salvar-proximo' || a === 'encerrar'){
        if (a === 'encerrar' && !confirm('Encerrar este jogo agora, com o placar atual?')) return;
        const alvo = p.alvo;
        const [x, y] = encerrar(e);
        painel = null;
        if (x && y) iniciar(e, x, y, { alvo, id: novoId('P', S.data) });
        guardar();
        aviso(x && y ? `Jogo salvo. Agora: Time ${x} x Time ${y}.` : 'Jogo salvo.');
        sincronizar();
        app.desenhar(); window.scrollTo(0, 0);
      } else if (a === 'cancelar'){
        if (!confirm('Cancelar este jogo? Os pontos dele serão apagados.')) return;
        cancelarAtual(e); painel = null;
        depoisDeMudar();
      } else if (a === 'comecar'){
        const alvo = Number(root.querySelector('#alvo').value) || 15;
        iniciar(e, root.querySelector('#tA').value, root.querySelector('#tB').value, { alvo, id: novoId('P', S.data) });
        depoisDeMudar();
      } else if (a === 'priorizar'){
        priorizar(e, Number(b.dataset.t)); guardar(); app.desenhar();
      } else if (a === 'excluir'){
        if (!confirm('Excluir este jogo e todos os lances dele?')) return;
        excluir(e, b.dataset.id);
        depoisDeMudar();
      } else if (a === 'enviar'){
        sincronizar();
      }
    } catch (err){ aviso(err.message, 'erro'); }
  };
}

export function sair(){
  pararDeOuvir?.(); pararDeOuvir = null;
  travaTela?.release().catch(() => {}); travaTela = null;
  painel = null;
}
