/* ===== Placar lance a lance (uso na quadra) =====
   Antes de cada jogo: os dois times em quadra, com a escalação editável (trocar, tirar, adicionar do revezamento)
   e a sugestão de revezamento para o time que acabou de perder.
   Durante o jogo: tocar no time que pontuou → (opcional) quem fez → como foi: o toque no "como" já registra.
   Tudo fica no celular na hora e vai para a planilha em lote (placar-store.js). */
import { S, cfg, jogador, timesSalvos, revezamentoSalvo, partidasSalvas } from '../store.js';
import { cabecalho, soOrganizador, aviso, executar, app } from '../ui.js';
import * as api from '../api.js';
import { invalidar as invalidarRanking } from './ranking.js';
import { esc, ddmm } from '../core/util.js';
import {
  TIPOS, TIPOS_PONTO, regras, novoEstado, partidaAtual, encerradas, placar, vencedor, emDesempate, alvoAtual, proximo,
  iniciar, registrar, desfazer, encerrar, cancelarAtual, excluir, priorizar, pendentes, descreverLance, emQuadra,
  regra3Ativa, trocar, prepararRevezamento, mudarSugestao, aplicarSugestao
} from '../core/placar.js';
import { estadoDe, substituirEstado, guardar, novoId, sincronizar, agendar, envio, totalPendente, aoMudarEnvio } from '../placar-store.js';
import { CORES_TIMES } from '../config.js';

let painel = null;          // durante o jogo: { tipo: 'ponto', time, jogador } | { tipo: 'erro' }
let editor = null;          // antes do jogo: { time, sai } (sai vazio = adicionar)
let par = null;             // times escolhidos para o próximo jogo
let pararDeOuvir = null, travaTela = null;

const cor = t => CORES_TIMES[(t - 1) % CORES_TIMES.length];
const nomeDe = id => jogador(id)?.nome || 'Jogador';
const sexoDe = id => jogador(id)?.sexo || 'M';
const hm = id => (sexoDe(id) === 'F' ? 'M' : 'H');
const bolinha = t => `<span class="bolinha" style="background:${cor(t)}" aria-hidden="true"></span>`;

function estado(){
  const times = timesSalvos(), revezamento = revezamentoSalvo();
  const assinatura = JSON.stringify([times, revezamento]);
  const criar = () => ({ ...novoEstado(S.data, { times, revezamento, porTime: regras(cfg()).porTime }), assinatura });
  const e = estadoDe(S.data, criar);
  if (!e.elencos){
    // placar guardado por uma versão anterior do app: mantém os jogos e ganha elencos e revezamento
    return substituirEstado(S.data, { ...criar(), partidas: e.partidas, atual: e.atual, fila: e.fila });
  }
  // times refeitos (na aba Times) antes do primeiro jogo: começa de novo com eles
  if (!e.partidas.length && !e.atual && e.assinatura !== assinatura) return substituirEstado(S.data, criar());
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

function textoRegras(){
  const r = regras(cfg());
  return r.gatilho > 0 && r.desempate > 0 && r.gatilho < r.alvo
    ? `Até ${r.alvo}. Empatou em ${r.gatilho} x ${r.gatilho}: vence quem fizer ${r.desempate} pontos primeiro (até ${r.gatilho + r.desempate}).`
    : `Até ${r.alvo}.`;
}

function cartaoTime(t, pts, fim){
  const sel = painel?.tipo === 'ponto' && painel.time === t;
  return `<button type="button" class="time-placar${sel ? ' sel' : ''}" style="--cor:${cor(t)}" data-a="ponto" data-t="${t}" aria-pressed="${sel}"${fim ? ' disabled' : ''}>
    <span class="nome">Time ${t}</span>
    <span class="pts">${pts}</span>
    <span class="mais">${fim ? '&nbsp;' : '+ ponto'}</span>
  </button>`;
}

function painelPonto(e, p){
  const t = painel.time;
  return `<section class="cartao painel" aria-label="Registrar ponto do Time ${t}">
    <h2>Ponto do Time ${t}: quem fez?</h2>
    <p class="mut peq">Opcional. Depois toque em como foi.</p>
    <div class="grade2">${emQuadra(e, p, t).map(id => {
      const sel = painel.jogador === id;
      return `<button type="button" class="btn-j${sel ? ' sel' : ''}" style="--cor:${cor(t)}" data-a="quem" data-id="${esc(id)}" aria-pressed="${sel}">${esc(nomeDe(id))}</button>`;
    }).join('')}</div>
    <h3 class="sub-tit">Como?</h3>
    <div class="grade2">${TIPOS_PONTO.map(tp => `<button type="button" class="btn pri" data-a="como" data-tipo="${tp}">${TIPOS[tp]}</button>`).join('')}</div>
    <button type="button" class="btn texto" data-a="fechar">Cancelar</button>
  </section>`;
}

function painelErro(e, p){
  return `<section class="cartao painel" aria-label="Registrar erro de jogador">
    <h2>Quem errou?</h2>
    <p class="mut peq">Saque ou ataque fora. O ponto vai para o outro time.</p>
    ${[p.time_a, p.time_b].map(t => `<h3 class="sub-tit">${bolinha(t)} Time ${t}</h3>
      <div class="grade2">${emQuadra(e, p, t).map(id =>
        `<button type="button" class="btn-j" style="--cor:${cor(t)}" data-a="errou" data-id="${esc(id)}" data-t="${t}">${esc(nomeDe(id))}</button>`).join('')}</div>`).join('')}
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
  const regra = regra3Ativa(e) ? 'Quem ganha fica. Com 3 vitórias seguidas, o time sai junto com o perdedor.' : 'Quem ganha fica.';
  return `<section class="cartao"><h2>Fila</h2><p class="mut peq">${regra}</p><ol class="fila">${e.fila.map((t, i) => `<li>${bolinha(t)}<span>Time ${t}</span>
    ${comBotoes && i > 0 ? `<button type="button" class="btn texto peq" data-a="priorizar" data-t="${t}">Passar para a frente</button>` : ''}</li>`).join('')}</ol></section>`;
}

/* Revezamento: quem está fora e quantas vezes ficou fora hoje */
function revezamentoHTML(e){
  if (!e.revezamento.length) return '';
  return `<section class="cartao revez"><h2>Revezamento</h2>
    <div class="tags">${e.revezamento.map(id => `<span class="tag laranja">${esc(nomeDe(id))} (${hm(id)})${e.contRevez[id] > 1 ? ` · ${e.contRevez[id]}x fora` : ''}</span>`).join('')}</div>
  </section>`;
}

/* Sugestão de revezamento para o time que perdeu */
function sugestaoHTML(e){
  const s = e.sugestao;
  if (!s || !s.trocas.length) return '';
  const elenco = e.elencos[s.time] || [];
  return `<section class="cartao sugestao" aria-label="Revezamento do Time ${s.time}">
    <h2>${bolinha(s.time)} Revezamento do Time ${s.time}</h2>
    <p class="mut peq">Sugestão por sorteio: mesmo sexo de quem entra e quem ficou menos vezes fora hoje. Toque em outro nome para trocar.</p>
    ${s.trocas.map((t, i) => `<div class="troca">
      <p><strong>Entra ${esc(nomeDe(t.entra))}</strong> (${hm(t.entra)}). Sai:</p>
      <div class="chips">${elenco.map(id => `<button type="button" class="chip-j${id === t.sai ? ' sel' : ''}" data-a="sug-sai" data-i="${i}" data-id="${esc(id)}" aria-pressed="${id === t.sai}">${esc(nomeDe(id))} (${hm(id)})</button>`).join('')}</div>
    </div>`).join('')}
    <button type="button" class="btn ok bloco" data-a="sug-confirmar">Confirmar troca</button>
    <p class="mut peq">Se não mexer, a troca sugerida é feita ao começar o próximo jogo.</p>
  </section>`;
}

/* Escalação de um time antes do jogo, com troca rápida */
function escalacaoHTML(e, t){
  const elenco = e.elencos[t] || [];
  const h = elenco.filter(id => sexoDe(id) !== 'F').length;
  const aberto = editor && editor.time === t;
  let painelEd = '';
  if (aberto){
    const sexo = editor.sai ? sexoDe(editor.sai) : null;
    const candidatos = e.revezamento.slice().sort((x, y) =>
      ((sexo && sexoDe(x) !== sexo) - (sexo && sexoDe(y) !== sexo)) || ((e.contRevez[y] || 0) - (e.contRevez[x] || 0)));
    painelEd = `<div class="editor">
      <p class="rotulo">${editor.sai ? `Trocar ${esc(nomeDe(editor.sai))} por:` : 'Adicionar ao time:'}</p>
      ${candidatos.length ? `<div class="chips">${candidatos.map(id => `<button type="button" class="chip-j" data-a="trocar-com" data-id="${esc(id)}">${esc(nomeDe(id))} (${hm(id)})${sexo && sexoDe(id) === sexo ? ' · sugerido' : ''}</button>`).join('')}</div>` : '<p class="mut peq">Ninguém no revezamento.</p>'}
      <div class="linha-entre">
        ${editor.sai ? `<button type="button" class="btn texto peq perigo" data-a="tirar">Só tirar (vai para o revezamento)</button>` : '<span></span>'}
        <button type="button" class="btn texto peq" data-a="fechar-editor">Fechar</button>
      </div>
    </div>`;
  }
  return `<section class="cartao escalacao" style="--cor:${cor(t)}">
    <h2>${bolinha(t)} Time ${t} <span class="mut peq">${elenco.length} jogadores · ${h}H ${elenco.length - h}M</span></h2>
    <div class="chips">${elenco.map(id => `<button type="button" class="chip-j${aberto && editor.sai === id ? ' sel' : ''}" data-a="editar" data-t="${t}" data-id="${esc(id)}">${esc(nomeDe(id))} (${hm(id)})</button>`).join('')}
      ${e.revezamento.length ? `<button type="button" class="chip-j mais" data-a="adicionar" data-t="${t}">+ Adicionar</button>` : ''}</div>
    ${painelEd}
  </section>`;
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
  } else if (painel?.tipo === 'ponto') meio = painelPonto(e, p);
  else if (painel?.tipo === 'erro') meio = painelErro(e, p);
  return `<div class="grade2 placar">${cartaoTime(p.time_a, a, !!v)}${cartaoTime(p.time_b, b, !!v)}</div>
    ${emDesempate(p) && !v ? `<p class="desempate" role="status">Desempate: vence quem chegar a ${alvoAtual(p)}.</p>` : ''}
    ${meio}
    <div class="grade2">
      <button type="button" class="btn sec" data-a="erro"${v ? ' disabled' : ''}>Erro de jogador</button>
      <button type="button" class="btn sec" data-a="desfazer"${p.lances.length ? '' : ' disabled'}>Desfazer último</button>
    </div>
    ${ultimosLances(p)}
    ${e.fila.length ? `<p class="mut peq">Próximo: vencedor x Time ${e.fila[0]}.</p>` : ''}
    ${sugestaoHTML(e)}
    ${filaHTML(e, false)}
    ${revezamentoHTML(e)}
    <div class="linha-entre">
      <button type="button" class="btn texto" data-a="encerrar">Encerrar agora</button>
      <button type="button" class="btn texto perigo" data-a="cancelar">Cancelar este jogo</button>
    </div>`;
}

function telaInicio(e){
  const n = Object.keys(e.elencos).length;
  const sugerido = proximo(e);
  if (!par || par[0] === par[1] || !e.elencos[par[0]] || !e.elencos[par[1]]) par = [sugerido[0] ?? 1, sugerido[1] ?? 2];
  const opcoes = sel => Array.from({ length: n }, (_, i) => `<option value="${i + 1}"${i + 1 === sel ? ' selected' : ''}>Time ${i + 1}</option>`).join('');
  return `<section class="cartao">
      <h2>${encerradas(e).length ? 'Próximo jogo' : 'Primeiro jogo'}</h2>
      <div class="grade2">
        <label class="campo">Time A<select id="tA" data-a="par">${opcoes(par[0])}</select></label>
        <label class="campo">Time B<select id="tB" data-a="par">${opcoes(par[1])}</select></label>
      </div>
      <p class="mut peq">${esc(textoRegras())}</p>
    </section>
    ${sugestaoHTML(e)}
    ${escalacaoHTML(e, par[0])}
    ${escalacaoHTML(e, par[1])}
    ${revezamentoHTML(e)}
    <button type="button" class="btn pri bloco" data-a="comecar">Começar jogo</button>
    ${filaHTML(e, true)}
    ${encerradas(e).length ? fimDoDomingo() : ''}`;
}

function fimDoDomingo(){
  const encerrado = S.dados?.domingo?.status === 'encerrado';
  return `<section class="cartao">
    <h2>Fim do domingo</h2>
    <p class="mut peq">${encerrado ? 'Domingo encerrado e notas recalculadas. Se algum jogo mudar, recalcule de novo.' : 'Depois do último jogo: envia o que faltar e recalcula a nota de cada jogador com os jogos dos últimos 8 domingos.'}</p>
    <button type="button" class="btn sec bloco" data-a="encerrar-domingo">${encerrado ? 'Recalcular as notas' : 'Encerrar domingo e recalcular notas'}</button>
  </section>`;
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
  const kicker = p ? `Jogo ${p.seq} · ${emDesempate(p) ? 'desempate até ' + alvoAtual(p) : 'até ' + p.alvo}` : `Domingo, ${ddmm(S.data)}`;
  return cabecalho({ kicker, titulo: 'Placar' }) +
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

  root.onchange = ev => {
    if (ev.target.dataset.a !== 'par') return;
    par = [Number(root.querySelector('#tA').value), Number(root.querySelector('#tB').value)];
    editor = null;
    app.desenhar();
  };

  root.onclick = async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || b.tagName === 'SELECT') return;
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
        const v = vencedor(p);
        const r = encerrar(e);
        if (r.perdedor && e.revezamento.length) prepararRevezamento(e, r.perdedor, { sexoDe });
        par = r.par; painel = null; editor = null;
        guardar();
        aviso(r.tresVitorias
          ? `3 vitórias seguidas: o Time ${v} sai junto com o Time ${r.perdedor}. Agora: Time ${r.par[0]} x Time ${r.par[1]}.`
          : `Jogo salvo. Próximo: Time ${r.par[0]} x Time ${r.par[1]}.`);
        sincronizar();
        app.desenhar(); window.scrollTo(0, 0);
      } else if (a === 'cancelar'){
        if (!confirm('Cancelar este jogo? Os pontos dele serão apagados.')) return;
        par = [p.time_a, p.time_b];
        cancelarAtual(e); painel = null;
        depoisDeMudar();
      } else if (a === 'comecar'){
        const [x, y] = [Number(root.querySelector('#tA').value), Number(root.querySelector('#tB').value)];
        const feitas = aplicarSugestao(e);
        const r = regras(cfg());
        iniciar(e, x, y, { alvo: r.alvo, gatilho: r.gatilho, desempate: r.desempate, id: novoId('P', S.data) });
        if (feitas.length) aviso('Revezamento: ' + feitas.map(t => `entra ${nomeDe(t.entra)}, sai ${nomeDe(t.sai)}`).join('; ') + '.');
        par = null; editor = null;
        depoisDeMudar();
      } else if (a === 'priorizar'){
        priorizar(e, Number(b.dataset.t)); par = null; guardar(); app.desenhar();
      } else if (a === 'sug-sai'){
        mudarSugestao(e, Number(b.dataset.i), b.dataset.id); guardar(); app.desenhar();
      } else if (a === 'sug-confirmar'){
        const feitas = aplicarSugestao(e);
        if (feitas.length) aviso('Feito: ' + feitas.map(t => `entra ${nomeDe(t.entra)}, sai ${nomeDe(t.sai)}`).join('; ') + '.');
        guardar(); app.desenhar();
      } else if (a === 'editar' || a === 'adicionar'){
        const t = Number(b.dataset.t), sai = a === 'editar' ? b.dataset.id : '';
        editor = editor && editor.time === t && editor.sai === sai ? null : { time: t, sai };
        app.desenhar();
      } else if (a === 'trocar-com'){
        trocar(e, editor.time, editor.sai, b.dataset.id);
        editor = null; guardar(); app.desenhar();
      } else if (a === 'tirar'){
        trocar(e, editor.time, editor.sai, '');
        editor = null; guardar(); app.desenhar();
      } else if (a === 'fechar-editor'){
        editor = null; app.desenhar();
      } else if (a === 'excluir'){
        if (!confirm('Excluir este jogo e todos os lances dele?')) return;
        excluir(e, b.dataset.id);
        depoisDeMudar();
      } else if (a === 'enviar'){
        sincronizar();
      } else if (a === 'encerrar-domingo'){
        if (!confirm('Encerrar o domingo e recalcular as notas?')) return;
        await executar(b, async () => {
          await sincronizar();
          if (pendentes(e).length) throw new Error('Ainda há jogos não enviados. Confira a internet e tente de novo.');
          const r = await api.post('encerrar_domingo', { pin: S.pin, data: S.data });
          invalidarRanking();
          aviso(`Notas recalculadas para ${r.notas.length} jogadores.`);
          await app.recarregar();
          location.hash = '#ranking';
        });
      }
    } catch (err){ aviso(err.message, 'erro'); }
  };
}

export function sair(){
  pararDeOuvir?.(); pararDeOuvir = null;
  travaTela?.release().catch(() => {}); travaTela = null;
  painel = null; editor = null;
}
