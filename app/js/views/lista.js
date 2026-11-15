/* ===== Lista: mensagem de quinta e reconhecimento da lista confirmada ===== */
import { S, cfg, jogadores, jogador, presencas, gravar } from '../store.js';
import * as api from '../api.js';
import { cabecalho, soOrganizador, seletorData, aviso, copiar, executar, app } from '../ui.js';
import { esc, ddmm, porNome } from '../core/util.js';
import { gerarMensagem, linkWhatsApp, reconhecerLista, entraPorPadrao } from '../core/lista.js';

let colado = (() => { try { return JSON.parse(localStorage.getItem('vf-colado')) || ''; } catch { return ''; } })();
let escolhas = {};   // id → true/false quando o organizador marca ou desmarca alguém
let itens = [];

function mensagem(){
  const c = cfg();
  return gerarMensagem({
    data: S.data, mensalistas: jogadores().filter(j => j.ativo && j.tipo === 'mensalista'),
    vagas: c.vagas ?? 16, suplentes: c.suplentes ?? 3, inicio: c.hora_inicio || '9:30', fim: c.hora_fim || '11:30'
  });
}

const marcado = it => escolhas[it.jogador.id] ?? entraPorPadrao(it);

function rotulo(it){
  if (it.status === 'pendente') return ['Não confirmou', 'laranja'];
  if (it.status === 'fora') return ['Fora', 'cinza'];
  if (it.secao === 'suplentes') return ['Suplente', 'azul'];
  if (it.jogador.tipo !== 'mensalista') return ['Avulso', 'cinza'];
  return null;
}

function resultado(){
  itens = reconhecerLista(colado, jogadores().filter(j => j.ativo));
  const salvos = presencas().length;
  const infoSalva = salvos ? `<p class="ok-info">Presença salva para ${ddmm(S.data)}: ${salvos} jogadores. <a href="#times">Montar times</a></p>` : '';
  if (!colado.trim()) return infoSalva;
  const conhecidos = itens.filter(i => i.jogador && i.status !== 'repetido');
  const sem = itens.map((it, i) => ({ it, i })).filter(x => !x.it.jogador);
  const n = conhecidos.filter(marcado).length;
  const opcoesJog = jogadores().filter(j => j.ativo).sort(porNome).map(j => `<option value="${esc(j.id)}">${esc(j.nome)}</option>`).join('');
  return `
    <div class="tags">
      <span class="tag verde">${n} na presença</span>
      ${sem.length ? `<span class="tag laranja">${sem.length} sem cadastro</span>` : ''}
    </div>
    ${conhecidos.length ? `<div class="checks">${conhecidos.map(it => {
      const r = rotulo(it);
      return `<label class="linha-check"><input type="checkbox" data-id="${esc(it.jogador.id)}"${marcado(it) ? ' checked' : ''}>
        <span class="nome">${esc(it.jogador.nome)}</span>${r ? `<span class="tag ${r[1]}">${r[0]}</span>` : ''}</label>`;
    }).join('')}</div>` : ''}
    ${sem.length ? `<h3 class="sub-tit">Sem cadastro</h3>${sem.map(({ it, i }) => `
      <div class="sem-cad">
        <p class="nome">${esc(it.texto)}</p>
        <div class="linha-acao">
          <div class="seg2 mini" role="radiogroup" aria-label="Sexo de ${esc(it.texto)}">
            <label class="opcao"><input type="radio" name="sx-${i}" value="M"><span>M</span></label>
            <label class="opcao"><input type="radio" name="sx-${i}" value="F"><span>F</span></label>
          </div>
          <button type="button" class="btn pri peq" data-a="cadastrar" data-i="${i}">Cadastrar avulso</button>
        </div>
        <div class="linha-acao">
          <select data-vinc="${i}" aria-label="Cadastro existente para ${esc(it.texto)}"><option value="">Já tem cadastro? Escolha…</option>${opcoesJog}</select>
          <button type="button" class="btn sec peq" data-a="vincular" data-i="${i}">Vincular</button>
        </div>
      </div>`).join('')}` : ''}
    <button type="button" class="btn pri bloco" data-a="salvar"${n ? '' : ' disabled'}>Salvar presença (${n})</button>
    ${infoSalva}`;
}

export function render(){
  const msg = mensagem();
  return cabecalho({ kicker: `Domingo, ${ddmm(S.data)}`, titulo: 'Lista', sub: 'A confirmação continua no grupo do WhatsApp.' }) +
    seletorData() + `
    <section class="cartao">
      <h2>Mensagem de quinta</h2>
      <pre class="msg">${esc(msg)}</pre>
      <p class="mut peq">Mensalistas cadastrados, em ordem alfabética.</p>
      <div class="grade2">
        <button type="button" class="btn sec" data-a="copiar">Copiar</button>
        <a class="btn pri" href="${esc(linkWhatsApp(msg))}" target="_blank" rel="noopener">Abrir no WhatsApp</a>
      </div>
    </section>` +
    (S.admin ? `
    <section class="cartao">
      <label for="colado" class="h2">Cole a lista confirmada</label>
      <p class="mut">No sábado, copie a lista do grupo e cole aqui. Os nomes são reconhecidos sem diferenciar acentos e maiúsculas.</p>
      <textarea id="colado" rows="7" placeholder="1. Adriana&#10;2. Alaine&#10;…">${esc(colado)}</textarea>
      <div id="resultado" class="pilha">${resultado()}</div>
    </section>` : soOrganizador('Colar a lista confirmada e salvar a presença é com a organização.'));
}

export function bind(root){
  const atualizar = () => { const r = root.querySelector('#resultado'); if (r) r.innerHTML = resultado(); };

  root.oninput = e => {
    if (e.target.id !== 'colado') return;
    colado = e.target.value; escolhas = {};
    gravar('vf-colado', colado);
    atualizar();
  };
  root.onchange = e => {
    if (e.target.dataset.id){ escolhas[e.target.dataset.id] = e.target.checked; atualizar(); }
  };
  root.onclick = async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a, it = itens[Number(b.dataset.i)];
    if (a === 'copiar') return copiar(mensagem());
    if (a === 'cadastrar'){
      const sexo = root.querySelector(`input[name="sx-${b.dataset.i}"]:checked`)?.value;
      if (!sexo) return aviso('Escolha M ou F antes de cadastrar.', 'erro');
      await executar(b, async () => {
        await api.post('salvar_jogador', { pin: S.pin, jogador: { nome: it.texto, sexo, tipo: 'avulso', nota_admin: 3 } });
        aviso(`${it.texto} cadastrado(a) como avulso. Ajuste a nota no Perfil.`);
        await app.recarregar();
      });
    } else if (a === 'vincular'){
      const id = root.querySelector(`select[data-vinc="${b.dataset.i}"]`).value;
      if (!id) return aviso('Escolha o cadastro.', 'erro');
      const j = jogador(id);
      const apelidos = [j.apelidos, it.texto].filter(Boolean).join(', ');
      await executar(b, async () => {
        await api.post('salvar_jogador', { pin: S.pin, jogador: { id, apelidos } });
        aviso(`"${it.texto}" agora é reconhecido como ${j.nome}.`);
        await app.recarregar();
      });
    } else if (a === 'salvar'){
      const ids = itens.filter(i => i.jogador && i.status !== 'repetido' && marcado(i)).map(i => i.jogador.id);
      await executar(b, async () => {
        await api.post('salvar_presencas', { pin: S.pin, data: S.data, jogador_ids: ids });
        aviso(`Presença salva: ${ids.length} jogadores.`);
        await app.recarregar();
      });
    }
  };
}
