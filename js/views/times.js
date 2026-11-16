/* ===== Times: o máximo de times completos e o resto no revezamento.
   Equilibrar (3 opções) ou sortear; salvar e copiar para o WhatsApp ===== */
import { S, cfg, jogador, presencas, timesSalvos, revezamentoSalvo } from '../store.js';
import * as api from '../api.js';
import { cabecalho, seletorData, aviso, copiar, executar, app } from '../ui.js';
import { esc, ddmm, idade } from '../core/util.js';
import { montarTimes, estatisticas, custo, paresDe } from '../core/times.js';
import { regras } from '../core/placar.js';
import { CORES_TIMES } from '../config.js';

let opcoes = [], escolhida = 0, modo = null, dataOpcoes = null;

const paraAlgoritmo = j => ({ id: j.id, nome: j.nome, sexo: j.sexo, nota: Number(j.nota ?? j.nota_admin) || 3, altura: Number(j.altura_cm) || null, idade: idade(j) });
const presentes = () => presencas().map(jogador).filter(Boolean).map(paraAlgoritmo);
const porTime = () => regras(cfg()).porTime;
const pares = () => paresDe(S.dados?.timesAnterior || []);
const hm = j => (j.sexo === 'F' ? 'M' : 'H');

function pesos(){
  const c = cfg(), n = (v, p) => (v === '' || v == null || isNaN(Number(v)) ? p : Number(v));
  return { nota: n(c.times_peso_nota, 3), altura: n(c.times_peso_altura, 1), idade: n(c.times_peso_idade, 0.5), repetida: n(c.times_peso_dupla_repetida, 1) };
}

function gerar(m){
  try {
    opcoes = montarTimes(presentes(), { porTime: porTime(), modo: m, pesos: pesos(), pares: pares() });
    if (opcoes[0]?.aviso) aviso(opcoes[0].aviso, 'erro');
    escolhida = 0; modo = m; dataOpcoes = S.data;
  } catch (e){ aviso(e.message, 'erro'); }
}

const altura = cm => (cm ? (cm / 100).toFixed(2).replace('.', ',') + ' m' : '—');
const num = v => String(Math.round(v * 10) / 10).replace('.', ',');

function cartaoTime(time, i, comNotas){
  const st = estatisticas(time);
  return `<article class="time">
    <div class="faixa" style="background:${CORES_TIMES[i % CORES_TIMES.length]}"></div>
    <div class="time-corpo">
      <h2>Time ${i + 1}</h2>
      <ul>${time.map(j => `<li>${esc(j.nome)}</li>`).join('')}</ul>
      ${comNotas ? `<div class="tags">
        <span class="tag azul">Nota ${num(st.nota)}</span>
        <span class="tag cinza">${st.homens}H · ${st.mulheres}M</span>
        ${st.altura ? `<span class="tag cinza">Alt. ${altura(st.altura)}</span>` : ''}
      </div>` : ''}
    </div>
  </article>`;
}

function cartaoRevezamento(lista){
  if (!lista.length) return '';
  return `<section class="cartao revez">
    <h2>Revezamento</h2>
    <p class="mut peq">Entram no lugar de alguém do time que perder, a cada jogo.</p>
    <div class="tags">${lista.map(j => `<span class="tag laranja">${esc(j.nome)} (${hm(j)})</span>`).join('')}</div>
  </section>`;
}

function textoWhatsApp(times, revezamento){
  const linhas = [`*Times – Domingo, ${ddmm(S.data)}*`]
    .concat(...times.map((t, i) => ['', `*Time ${i + 1}*`].concat(t.map(j => j.nome))));
  if (revezamento.length) linhas.push('', '*Revezamento*', ...revezamento.map(j => `${j.nome} (${hm(j)})`));
  return linhas.join('\n');
}

const comoJogadores = ids => ids.map(jogador).filter(Boolean).map(j => (S.admin ? paraAlgoritmo(j) : { id: j.id, nome: j.nome, sexo: j.sexo }));
const salvos = () => ({ times: timesSalvos().map(comoJogadores), revezamento: comoJogadores(revezamentoSalvo()) });

function telaAdmin(){
  if (dataOpcoes !== S.data){ opcoes = []; modo = null; }
  const pres = presentes(), t = porTime();
  let html = cabecalho({ kicker: `Domingo, ${ddmm(S.data)}`, titulo: 'Times' }) + seletorData();
  if (pres.length < t * 2){
    return html + `<section class="cartao"><p>Salve a presença do domingo na aba Lista primeiro (${pres.length} presentes; são precisos ${t * 2}).</p>
      <a class="btn pri" href="#lista">Ir para a Lista</a></section>`;
  }
  const mulheres = pres.filter(j => j.sexo === 'F').length;
  const nTimes = Math.floor(pres.length / t), sobra = pres.length - nTimes * t;
  html += `<section class="cartao">
    <p class="rotulo">${pres.length} presentes · ${pres.length - mulheres} H · ${mulheres} M</p>
    <p class="mut peq">${nTimes} times de ${t}${sobra ? ` e ${sobra} no revezamento` : ''}.</p>
    <div class="grade2">
      <button type="button" class="btn pri" data-a="equilibrar">Equilibrar</button>
      <button type="button" class="btn sec" data-a="sortear">Sortear</button>
    </div>
    <p class="mut peq">Equilibrar usa a nota (a calculada pelos jogos, quando já houver), sexo, altura e idade e evita repetir as duplas do domingo anterior. Sortear é livre, com pelo menos 1 mulher por time.</p>
  </section>`;

  if (opcoes.length){
    const op = opcoes[escolhida];
    const st = op.times.map(estatisticas);
    const difNota = Math.max(...st.map(s => s.nota)) - Math.min(...st.map(s => s.nota));
    const repetidas = custo(op.times, { nota: 0, altura: 0, idade: 0, repetida: 1 }, pares());
    if (opcoes.length > 1){
      html += `<div class="seg" role="group" aria-label="Opções de times">${opcoes.map((_, i) =>
        `<button type="button" data-a="opcao" data-i="${i}" aria-pressed="${i === escolhida}">Opção ${i + 1}</button>`).join('')}</div>`;
    }
    html += `<p class="mut resumo">${modo === 'sortear' ? 'Sorteio livre. ' : ''}Diferença de nota entre os times: <strong>${num(difNota)}</strong>${pares().size ? ` · duplas repetidas: <strong>${repetidas}</strong>` : ''}</p>
      <div class="grade-times">${op.times.map((tm, i) => cartaoTime(tm, i, true)).join('')}</div>
      ${cartaoRevezamento(op.revezamento)}
      <div class="grade2">
        <button type="button" class="btn sec" data-a="refazer">Refazer</button>
        <button type="button" class="btn sec" data-a="copiar-opcao">Copiar para o WhatsApp</button>
      </div>
      <button type="button" class="btn pri bloco" data-a="salvar">Salvar estes times</button>
      ${timesSalvos().length ? '<p class="mut peq centro">Já há times salvos para este domingo; salvar substitui.</p>' : ''}`;
  } else if (timesSalvos().length){
    html += telaSalvos(true);
  }
  return html;
}

function telaSalvos(comNotas){
  const { times, revezamento } = salvos();
  return `<h2 class="secao">Times do domingo</h2>
    <div class="grade-times">${times.map((t, i) => cartaoTime(t, i, comNotas)).join('')}</div>
    ${cartaoRevezamento(revezamento)}
    <p class="mut peq">A escalação pode mudar entre as partidas, no Placar.</p>
    <button type="button" class="btn sec bloco" data-a="copiar-salvos">Copiar para o WhatsApp</button>`;
}

export function render(){
  if (S.admin) return telaAdmin();
  const cab = cabecalho({ kicker: `Domingo, ${ddmm(S.data)}`, titulo: 'Times' });
  if (timesSalvos().length) return cab + telaSalvos(false);
  return cab + '<section class="cartao"><p class="mut">Os times do domingo aparecem aqui quando a organização montar.</p></section>';
}

export function bind(root){
  root.onclick = async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'equilibrar' || a === 'sortear'){ gerar(a); app.desenhar(); }
    else if (a === 'refazer'){ gerar(modo || 'equilibrar'); app.desenhar(); }
    else if (a === 'opcao'){ escolhida = Number(b.dataset.i); app.desenhar(); }
    else if (a === 'copiar-opcao') copiar(textoWhatsApp(opcoes[escolhida].times, opcoes[escolhida].revezamento));
    else if (a === 'copiar-salvos'){ const s = salvos(); copiar(textoWhatsApp(s.times, s.revezamento)); }
    else if (a === 'salvar'){
      const op = opcoes[escolhida];
      await executar(b, async () => {
        await api.post('salvar_times', { pin: S.pin, data: S.data, times: op.times.map(t => t.map(j => j.id)), revezamento: op.revezamento.map(j => j.id) });
        opcoes = []; modo = null;
        aviso('Times salvos.');
        await app.recarregar();
      });
    }
  };
}
