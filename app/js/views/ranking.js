/* ===== Ranking: mês e temporada. A coluna Nota só aparece no modo organizador ===== */
import { S, jogador } from '../store.js';
import * as api from '../api.js';
import { cabecalho, app } from '../ui.js';
import { esc } from '../core/util.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
let periodo = 'mes';
let dados = null, dadosDe = null, carregando = false, erro = '', buscadoEm = 0;

/* Depois de enviar jogos ou encerrar o domingo, o ranking precisa ser buscado de novo */
export function invalidar(){ dados = null; dadosDe = null; }

const fmtNota = v => (v === '' || v == null ? '—' : String(Math.round(Number(v) * 10) / 10).replace('.', ','));

function destaque(titulo, linhas, campo, unidade){
  const melhor = linhas.slice().sort((a, b) => b[campo] - a[campo])[0];
  const tem = melhor && melhor[campo] > 0;
  return `<div class="destaque">
    <span class="rotulo-d">${titulo}</span>
    <strong>${tem ? esc(melhor.nome) : '—'}</strong>
    <span class="valor-d">${tem ? `${melhor[campo]} ${unidade}` : '&nbsp;'}</span>
  </div>`;
}

function tabela(linhas){
  if (!linhas.length) return '<section class="cartao"><p class="mut">Nenhum jogo registrado neste período ainda.</p></section>';
  const comNota = S.admin;
  return `<section class="cartao sem-pad">
    <table class="ranking">
      <caption class="sr">Ranking por pontos</caption>
      <thead><tr><th scope="col">#</th><th scope="col" class="nome">Jogador</th><th scope="col" title="Pontos (ataque, bloqueio e ace)">Pts</th><th scope="col">Aces</th><th scope="col" title="Vitórias">V</th>${comNota ? '<th scope="col">Nota</th>' : ''}</tr></thead>
      <tbody>${linhas.map((l, i) => `<tr>
        <td><span class="pos pos-${i < 3 ? i + 1 : 'n'}">${i + 1}</span></td>
        <th scope="row" class="nome">${esc(l.nome)}<small>${l.partidas} jogo${l.partidas === 1 ? '' : 's'}</small></th>
        <td>${l.pontos}</td><td>${l.aces}</td><td>${l.vitorias}</td>
        ${comNota ? `<td class="nota-c">${esc(fmtNota(jogador(l.jogador_id)?.nota))}</td>` : ''}
      </tr>`).join('')}</tbody>
    </table>
  </section>`;
}

export function render(){
  const ano = S.data.slice(0, 4), mes = MESES[Number(S.data.slice(5, 7)) - 1];
  const kicker = periodo === 'mes' ? `${mes} de ${ano}` : `Temporada ${ano}`;
  let corpo;
  if (dadosDe !== S.data) corpo = erro ? `<section class="cartao"><p class="mut">${esc(erro)}</p><button type="button" class="btn sec" data-a="tentar">Tentar de novo</button></section>` : '<p class="carregando">Carregando o ranking…</p>';
  else {
    const linhas = dados[periodo] || [];
    corpo = `<section class="cartao">
        <h2>Destaques</h2>
        <div class="destaques">${destaque('Mais pontos', linhas, 'pontos', 'pts')}${destaque('Mais aces', linhas, 'aces', 'aces')}${destaque('Mais vitórias', linhas, 'vitorias', 'vit.')}</div>
      </section>
      ${tabela(linhas)}
      <p class="mut peq">Pontos = ataques, bloqueios e aces de cada jogador.${S.admin ? ' A nota (1 a 5) é recalculada ao encerrar cada domingo e só aparece para a organização.' : ''}</p>`;
  }
  return cabecalho({ kicker, titulo: 'Ranking' }) + `
    <div class="seg" role="group" aria-label="Período">
      <button type="button" data-a="periodo" data-p="mes" aria-pressed="${periodo === 'mes'}">Mês</button>
      <button type="button" data-a="periodo" data-p="temporada" aria-pressed="${periodo === 'temporada'}">Temporada</button>
    </div>` + corpo;
}

async function buscar(){
  carregando = true; erro = '';
  const data = S.data;
  try { dados = await api.get('ranking', { data }); dadosDe = data; buscadoEm = Date.now(); }
  catch (e){ erro = e.rede ? 'Sem conexão: o ranking precisa de internet.' : e.message; }
  finally { carregando = false; app.desenhar(); }
}

export function bind(root){
  // mostra o que já tem e atualiza em segundo plano (jogos novos podem ter chegado)
  if (!carregando && !erro && (dadosDe !== S.data || Date.now() - buscadoEm > 30000)) buscar();
  root.onclick = e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    if (b.dataset.a === 'periodo'){ periodo = b.dataset.p; app.desenhar(); }
    else if (b.dataset.a === 'tentar'){ erro = ''; buscar(); app.desenhar(); }
  };
}

export function sair(){ if (erro) erro = ''; }
