/* ===== Perfil: cadastro do jogador; para o organizador, a lista de todos ===== */
import { S, jogadores, jogador, ligarCelular, desligarCelular } from '../store.js';
import * as api from '../api.js';
import { cabecalho, aviso, executar, app } from '../ui.js';
import { esc, porNome, isoData } from '../core/util.js';
import { POSICOES } from '../config.js';

const fmtNota = v => (v === '' || v == null ? '—' : String(Math.round(Number(v) * 10) / 10).replace('.', ','));

let modo = null;              // jogador: 'novo' | null.  organizador: id em edição | 'novo' | null
let buscandoPerfil = false;

const radios = (nome, opcoes, valor, cls) => opcoes.map(([v, r]) =>
  `<label class="${cls}"><input type="radio" name="${nome}" value="${esc(v)}"${String(valor) === String(v) ? ' checked' : ''}><span>${esc(r)}</span></label>`).join('');

function formulario(j = {}, { admin = false, botao = 'Salvar cadastro' } = {}){
  return `<form id="fPerfil" class="pilha" novalidate>
    <section class="cartao">
      <label class="campo">Nome<input name="nome" maxlength="60" autocomplete="name" value="${esc(j.nome)}"></label>
      <div class="grade2">
        <label class="campo">Nome na camisa<input name="apelido_camisa" maxlength="20" value="${esc(j.apelido_camisa)}"></label>
        <label class="campo">Número<input name="numero" inputmode="numeric" maxlength="2" value="${esc(j.numero)}"></label>
      </div>
    </section>
    <section class="cartao">
      <fieldset class="grupo"><legend>Sexo</legend>
        <div class="seg2">${radios('sexo', [['M', 'Masculino'], ['F', 'Feminino']], j.sexo, 'opcao')}</div>
      </fieldset>
      <div class="grade2">
        <label class="campo">Nascimento<input type="date" name="nascimento" min="1920-01-01" max="${isoData(new Date())}" value="${esc(j.nascimento)}"></label>
        <label class="campo">Altura (cm)<input type="number" name="altura_cm" inputmode="numeric" min="100" max="230" placeholder="Ex.: 175" value="${esc(j.altura_cm)}"></label>
      </div>
      <fieldset class="grupo"><legend>Posição preferida</legend>
        <div class="chips">${radios('posicao', Object.entries(POSICOES), j.posicao || 'tanto_faz', 'opcao chip')}</div>
      </fieldset>
    </section>
    ${admin ? camposAdmin(j) : infoTipo(j)}
    <button class="btn pri bloco" type="submit">${botao}</button>
  </form>`;
}

function camposAdmin(j){
  return `<section class="cartao">
    <h2>Só a organização vê</h2>
    <fieldset class="grupo"><legend>Tipo</legend>
      <div class="seg2">${radios('tipo', [['mensalista', 'Mensalista'], ['avulso', 'Avulso']], j.tipo || 'avulso', 'opcao')}</div>
    </fieldset>
    ${j.nota_final !== '' && j.nota_final != null ? `<p class="nota-info">Nota usada nos times: <strong>${esc(fmtNota(j.nota_final))}</strong>, calculada pelos jogos ao encerrar cada domingo. A nota abaixo é a sua avaliação, que entra na mistura.</p>` : ''}
    <fieldset class="grupo"><legend>Sua nota (1 a 5)</legend>
      <div class="seg5">${radios('nota_admin', [1, 2, 3, 4, 5].map(n => [n, n]), Math.round(j.nota_admin || 3), 'opcao')}</div>
    </fieldset>
    <label class="campo">Apelidos no grupo<input name="apelidos" maxlength="200" placeholder="Separados por vírgula" value="${esc(j.apelidos)}"></label>
    <label class="campo">Idade aproximada<input type="number" name="idade_aprox" inputmode="numeric" min="5" max="99" placeholder="Usada se não houver nascimento" value="${esc(j.idade_aprox)}"></label>
    <label class="check"><input type="checkbox" name="ativo"${j.ativo === false ? '' : ' checked'}><span>Ativo</span></label>
    ${j.reivindicado ? '<label class="check"><input type="checkbox" name="resetar_token"><span>Desligar do celular atual (a pessoa poderá escolher "Sou eu" de novo)</span></label>' : ''}
  </section>`;
}

function infoTipo(j){
  const tipo = j.tipo ? `<section class="cartao linha-entre">
      <div><p class="rotulo">Tipo de jogador</p><p class="mut peq">Definido pela organização</p></div>
      <span class="tag ${j.tipo === 'mensalista' ? 'verde' : 'cinza'}">${j.tipo === 'mensalista' ? 'Mensalista' : 'Avulso'}</span>
    </section>` : '';
  return tipo + '<p class="nota-info">Seu nível de jogo (1 a 5) é avaliado pela organização e só ela vê.</p>';
}

function lerFormulario(form){
  const f = new FormData(form), o = {};
  for (const k of ['nome', 'apelido_camisa', 'numero', 'nascimento', 'altura_cm']) o[k] = String(f.get(k) || '').trim();
  o.sexo = f.get('sexo') || '';
  o.posicao = f.get('posicao') || 'tanto_faz';
  if (S.admin){
    o.tipo = f.get('tipo');
    o.nota_admin = Number(f.get('nota_admin'));
    o.apelidos = String(f.get('apelidos') || '').trim();
    o.idade_aprox = String(f.get('idade_aprox') || '').trim();
    o.ativo = form.elements.ativo.checked;
    if (form.elements.resetar_token?.checked) o.resetar_token = true;
  }
  if (o.nome.length < 2) throw new Error('Informe o nome.');
  if (!o.sexo) throw new Error('Escolha o sexo.');
  if (o.numero && !/^\d{1,2}$/.test(o.numero)) throw new Error('Número da camisa: de 0 a 99.');
  return o;
}

/* ---------- Telas ---------- */

function telaEscolher(){
  const livres = jogadores().filter(j => j.ativo && !j.reivindicado).sort(porNome);
  return cabecalho({ titulo: 'Seu cadastro', sub: 'Com esses dados o app monta times equilibrados.' }) + `
    <section class="cartao">
      <h2>Já está na lista da pelada?</h2>
      <label class="campo">Seu nome
        <select id="selEu"><option value="">Escolha…</option>${livres.map(j => `<option value="${esc(j.id)}">${esc(j.nome)}</option>`).join('')}</select>
      </label>
      <button type="button" class="btn pri" data-a="sou-eu">Sou eu</button>
      <p class="mut peq">O cadastro fica ligado a este celular. Se seu nome não aparece, ele já está ligado a outro aparelho: fale com a organização.</p>
    </section>
    <section class="cartao">
      <h2>Primeira vez?</h2>
      <button type="button" class="btn sec" data-a="novo">Fazer meu cadastro</button>
    </section>`;
}

function telaDono(){
  const cab = cabecalho({ titulo: 'Seu cadastro', sub: 'Com esses dados o app monta times equilibrados.' });
  if (!S.meuPerfil) return cab + '<section class="cartao"><p class="mut">Carregando seu cadastro…</p></section>';
  return cab + formulario(S.meuPerfil) +
    '<button type="button" class="btn texto" data-a="desligar">Desligar este celular do meu cadastro</button>';
}

function telaAdminLista(){
  const todos = jogadores().slice().sort(porNome);
  const grupo = (titulo, lista) => !lista.length ? '' : `<section class="cartao sem-pad">
    <h2 class="cartao-tit">${titulo} <span class="mut">(${lista.length})</span></h2>
    ${lista.map(j => `<button type="button" class="linha-j" data-a="editar" data-id="${esc(j.id)}">
      <span class="nome">${esc(j.nome)}<small>${esc(j.sexo === 'F' ? 'F' : 'M')} · ${esc(POSICOES[j.posicao] || 'Tanto faz')}${j.altura_cm ? ' · ' + esc(j.altura_cm) + ' cm' : ''}${j.reivindicado ? '' : ' · sem celular'}</small></span>
      <span class="nota" aria-label="Nota ${esc(fmtNota(j.nota))}">${esc(fmtNota(j.nota))}</span>
    </button>`).join('')}
  </section>`;
  return cabecalho({ titulo: 'Jogadores', sub: 'Toque em um nome para editar cadastro, tipo e nota.' }) +
    '<button type="button" class="btn pri bloco" data-a="novo">Novo jogador</button>' +
    grupo('Mensalistas', todos.filter(j => j.ativo && j.tipo === 'mensalista')) +
    grupo('Avulsos', todos.filter(j => j.ativo && j.tipo !== 'mensalista')) +
    grupo('Inativos', todos.filter(j => !j.ativo));
}

const voltar = '<button type="button" class="btn texto" data-a="voltar">Voltar</button>';

export function render(){
  if (S.admin){
    if (!modo) return telaAdminLista();
    const j = modo === 'novo' ? {} : jogador(modo);
    if (!j){ modo = null; return telaAdminLista(); }
    return cabecalho({ titulo: modo === 'novo' ? 'Novo jogador' : j.nome }) + voltar + formulario(j, { admin: true });
  }
  if (S.meu) return telaDono();
  if (modo === 'novo') return cabecalho({ titulo: 'Novo cadastro', sub: 'Leva um minuto.' }) + voltar + formulario({}, { botao: 'Criar cadastro' });
  return telaEscolher();
}

export function bind(root){
  if (!S.admin && S.meu && !S.meuPerfil && !buscandoPerfil){
    buscandoPerfil = true;
    api.post('meu_perfil', S.meu)
      .then(r => { S.meuPerfil = r.jogador; })
      .catch(e => { aviso(e.message, 'erro'); if (/não encontrado/.test(e.message)) desligarCelular(); })
      .finally(() => { buscandoPerfil = false; app.desenhar(); });
  }

  root.onclick = async e => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    if (a === 'novo' || a === 'voltar' || a === 'editar'){
      modo = a === 'novo' ? 'novo' : a === 'editar' ? b.dataset.id : null;
      app.desenhar(); window.scrollTo(0, 0);
    } else if (a === 'sou-eu'){
      const id = root.querySelector('#selEu').value;
      if (!id) return aviso('Escolha seu nome na lista.', 'erro');
      if (!confirm(`Confirmar que você é ${jogador(id).nome}?`)) return;
      await executar(b, async () => {
        const r = await api.post('reivindicar', { id });
        ligarCelular(id, r.token, r.jogador);
        aviso('Pronto! Seu cadastro está ligado a este celular.');
        await app.recarregar();
      });
    } else if (a === 'desligar'){
      if (!confirm('Desligar este celular do seu cadastro? Para voltar, a organização precisa liberar.')) return;
      desligarCelular(); app.desenhar();
    }
  };

  root.onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    let dados;
    try { dados = lerFormulario(form); } catch (err){ return aviso(err.message, 'erro'); }
    await executar(form.querySelector('[type=submit]'), async () => {
      if (S.admin){
        if (modo !== 'novo') dados.id = modo;
        await api.post('salvar_jogador', { pin: S.pin, jogador: dados });
        modo = null;
      } else if (S.meu){
        dados.id = S.meu.id;
        S.meuPerfil = (await api.post('salvar_jogador', { token: S.meu.token, jogador: dados })).jogador;
      } else {
        const r = await api.post('salvar_jogador', { jogador: dados });
        ligarCelular(r.jogador.id, r.token, r.jogador);
        modo = null;
      }
      aviso('Cadastro salvo.');
      await app.recarregar();
      window.scrollTo(0, 0);
    });
  };
}
