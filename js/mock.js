/* ===== Modo demonstração =====
   Imita a API do backend/Code.gs guardando tudo no localStorage deste navegador.
   Só é usado quando API_URL (config.js) está vazia. PIN de teste: 1234. */
import { SEED, CONFIG_PADRAO } from './seed.js';
import { normalizar, ehIso } from './core/util.js';
import { erroDeRede } from './api.js';

const CHAVE = 'vf-app-demo';
export const PIN_DEMO = '1234';

function novoBanco(){
  return {
    Jogadores: SEED.map(([nome, sexo, nota_admin, tipo, idade_aprox], i) => ({
      id: 'J' + String(i + 1).padStart(3, '0'), nome, apelido_camisa: '', numero: '', sexo, nascimento: '', altura_cm: '',
      tipo, nota_admin, ativo: true, idade_aprox, apelidos: '', token_hash: ''
    })),
    Domingos: [], Presencas: [], Times: [], Partidas: [], Lances: [], Notas: [], Escalacoes: [], Revezamentos: [],
    Config: CONFIG_PADRAO.map(([chave, valor]) => ({ chave, valor }))
  };
}

let banco = null;
function db(){
  if (!banco){
    try { banco = JSON.parse(localStorage.getItem(CHAVE)); } catch { banco = null; }
    if (!banco) banco = novoBanco();
    banco.Partidas ||= []; banco.Lances ||= []; banco.Notas ||= []; banco.Escalacoes ||= []; banco.Revezamentos ||= [];   // bancos de demonstração antigos
    for (const [chave, valor] of CONFIG_PADRAO) if (!banco.Config.some(c => c.chave === chave)) banco.Config.push({ chave, valor });
    const pontos = banco.Config.find(c => c.chave === 'pontos_partida');
    if (pontos && String(pontos.valor) === '15') pontos.valor = 11;   // nova regra (como o configurarPlanilha)
  }
  return banco;
}
function salvar(){ try { localStorage.setItem(CHAVE, JSON.stringify(banco)); } catch { /* sem armazenamento: fica só na memória */ } }
export function zerarDemo(){ banco = novoBanco(); salvar(); }

const config = () => Object.fromEntries(db().Config.map(c => [c.chave, c.valor]));
const publico = j => ({ id: j.id, nome: j.nome, apelido_camisa: j.apelido_camisa, numero: String(j.numero || ''), sexo: j.sexo, tipo: j.tipo, ativo: j.ativo !== false, reivindicado: !!j.token_hash });
const dono = j => ({ ...publico(j), nascimento: j.nascimento, altura_cm: j.altura_cm });
function admin(j, ultimas = {}){
  const nota_admin = Number(j.nota_admin) || 3, nota_final = ultimas[j.id] ?? '';
  return { ...dono(j), nota_admin, nota_final, nota: nota_final === '' ? nota_admin : nota_final, idade_aprox: j.idade_aprox, apelidos: j.apelidos };
}

/* O cálculo da nota e do ranking é o mesmo arquivo do Apps Script (backend/Nota.gs) */
let notaLib = null;
async function lib(){
  if (!notaLib){
    const resp = await fetch(new URL('../backend/Nota.gs', import.meta.url));
    if (!resp.ok) throw new Error('Não foi possível carregar o cálculo da nota (backend/Nota.gs).');
    const codigo = await resp.text();
    notaLib = new Function(`${codigo}
return { calcularNotas_, ultimasNotas_, periodosRanking_, rankingPeriodo_ };`)();
  }
  return notaLib;
}
const tabelasJogos = () => ({ jogadores: db().Jogadores, domingos: db().Domingos, times: db().Times, partidas: db().Partidas, lances: db().Lances, escalacoes: db().Escalacoes, config: config() });

function exigirAdmin(pin){ if (String(pin || '') !== PIN_DEMO) throw new Error('PIN incorreto.'); }
const domingo = data => db().Domingos.find(d => d.data === data) || null;
function garantirDomingo(data){
  if (!ehIso(data)) throw new Error('Data inválida.');
  let d = domingo(data);
  if (!d){ d = { id: 'D' + data.replace(/-/g, ''), data, status: 'aberto' }; db().Domingos.push(d); }
  return d;
}
const presencasDe = id => db().Presencas.filter(p => p.domingo_id === id).map(p => p.jogador_id);
function timesDe(id){
  const t = [];
  db().Times.filter(r => r.domingo_id === id && r.time_num >= 1).forEach(r => { (t[r.time_num - 1] ||= []).push(r.jogador_id); });
  return t.filter(Boolean);
}
const revezamentoDe = id => db().Times.filter(r => r.domingo_id === id && r.time_num === 0).map(r => r.jogador_id);

const partidasDe = id => db().Partidas.filter(p => p.domingo_id === id)
  .map(({ id, seq, time_a, time_b, pontos_a, pontos_b, vencedor, fim }) => ({ id, seq, time_a, time_b, pontos_a, pontos_b, vencedor, fim }))
  .sort((a, b) => a.seq - b.seq);

function validarPerfil(d, ehAdmin){
  const o = {}, tem = k => Object.hasOwn(d, k);
  if (tem('nome')){ o.nome = String(d.nome).trim().slice(0, 60); if (o.nome.length < 2) throw new Error('Nome muito curto.'); }
  if (tem('apelido_camisa')) o.apelido_camisa = String(d.apelido_camisa || '').trim().slice(0, 20);
  if (tem('numero')){ o.numero = String(d.numero ?? '').trim(); if (o.numero && !/^\d{1,2}$/.test(o.numero)) throw new Error('Número da camisa: de 0 a 99.'); }
  if (tem('sexo')){ if (!['M', 'F'].includes(d.sexo)) throw new Error('Sexo inválido.'); o.sexo = d.sexo; }
  if (tem('nascimento')){ o.nascimento = d.nascimento || ''; if (o.nascimento && !ehIso(o.nascimento)) throw new Error('Data de nascimento inválida.'); }
  if (tem('altura_cm')){ o.altura_cm = d.altura_cm === '' ? '' : Math.round(Number(d.altura_cm)); if (o.altura_cm !== '' && !(o.altura_cm >= 100 && o.altura_cm <= 230)) throw new Error('Altura: de 100 a 230 cm.'); }
  if (ehAdmin){
    if (tem('tipo')) o.tipo = d.tipo === 'mensalista' ? 'mensalista' : 'avulso';
    if (tem('nota_admin')){ const n = Number(d.nota_admin); if (!(n >= 1 && n <= 5)) throw new Error('Nota: de 1 a 5.'); o.nota_admin = n; }
    if (tem('ativo')) o.ativo = d.ativo === true;
    if (tem('apelidos')) o.apelidos = String(d.apelidos || '').slice(0, 200);
    if (tem('idade_aprox')) o.idade_aprox = d.idade_aprox === '' ? '' : Math.round(Number(d.idade_aprox));
  }
  return o;
}

const ACOES = {
  publico({ data }){
    const d = domingo(data);
    return { config: config(), jogadores: db().Jogadores.map(publico), domingo: d, presencas: d ? presencasDe(d.id) : [], times: d ? timesDe(d.id) : [], revezamento: d ? revezamentoDe(d.id) : [], partidas: d ? partidasDe(d.id) : [] };
  },
  async admin_dados({ pin, data }){
    exigirAdmin(pin);
    const ultimas = (await lib()).ultimasNotas_(db().Notas);
    const d = domingo(data);
    const anteriores = db().Domingos.filter(x => x.data < data).sort((a, b) => (a.data < b.data ? 1 : -1));
    let timesAnterior = [];
    for (const a of anteriores){ timesAnterior = timesDe(a.id); if (timesAnterior.length) break; }
    return { config: config(), jogadores: db().Jogadores.map(j => admin(j, ultimas)), domingo: d, presencas: d ? presencasDe(d.id) : [], times: d ? timesDe(d.id) : [], revezamento: d ? revezamentoDe(d.id) : [], partidas: d ? partidasDe(d.id) : [], timesAnterior };
  },
  meu_perfil({ id, token }){
    const j = db().Jogadores.find(x => x.id === id);
    if (!j || !j.token_hash || j.token_hash !== token) throw new Error('Cadastro não encontrado neste celular.');
    return { jogador: dono(j) };
  },
  salvar_jogador({ pin, token, jogador = {} }){
    const ehAdmin = !!pin;
    if (ehAdmin) exigirAdmin(pin);
    const limpo = validarPerfil(jogador, ehAdmin);
    const lista = db().Jogadores;
    const mesmoNome = id => limpo.nome && lista.find(j => j.id !== id && normalizar(j.nome) === normalizar(limpo.nome));
    if (!jogador.id){
      if (!limpo.nome) throw new Error('Informe o nome.');
      if (!limpo.sexo) throw new Error('Informe o sexo.');
      const igual = mesmoNome(null);
      if (igual) throw new Error('Já existe um cadastro com o nome ' + igual.nome + '.');
      const max = Math.max(0, ...lista.map(j => Number(j.id.replace(/\D/g, ''))));
      const novo = { apelido_camisa: '', numero: '', nascimento: '', altura_cm: '', tipo: 'avulso', nota_admin: 3, ativo: true, idade_aprox: '', apelidos: '', token_hash: '', ...limpo, id: 'J' + String(max + 1).padStart(3, '0') };
      let tk = '';
      if (!ehAdmin){ tk = crypto.randomUUID(); novo.token_hash = tk; }
      lista.push(novo); salvar();
      return { jogador: ehAdmin ? admin(novo) : dono(novo), token: tk };
    }
    const atual = lista.find(j => j.id === jogador.id);
    if (!atual) throw new Error('Cadastro não encontrado.');
    if (!ehAdmin && (!atual.token_hash || atual.token_hash !== token)) throw new Error('Sem permissão para editar este cadastro.');
    const outro = mesmoNome(atual.id);
    if (outro) throw new Error('Já existe um cadastro com o nome ' + outro.nome + '.');
    if (ehAdmin && jogador.resetar_token) limpo.token_hash = '';
    Object.assign(atual, limpo); salvar();
    return { jogador: ehAdmin ? admin(atual) : dono(atual) };
  },
  reivindicar({ id }){
    const j = db().Jogadores.find(x => x.id === id);
    if (!j || j.ativo === false) throw new Error('Cadastro não encontrado.');
    if (j.token_hash) throw new Error('Esse cadastro já está ligado a outro celular. Fale com a organização.');
    j.token_hash = crypto.randomUUID(); salvar();
    return { jogador: dono(j), token: j.token_hash };
  },
  salvar_presencas({ pin, data, jogador_ids = [] }){
    exigirAdmin(pin);
    const d = garantirDomingo(data);
    const ids = [...new Set(jogador_ids)].filter(id => db().Jogadores.some(j => j.id === id));
    db().Presencas = db().Presencas.filter(p => p.domingo_id !== d.id).concat(ids.map(id => ({ domingo_id: d.id, jogador_id: id })));
    salvar();
    return { domingo: d, presencas: ids };
  },
  sincronizar({ pin, data, partidas = [], excluir = [] }){
    exigirAdmin(pin);
    const d = garantirDomingo(data);
    const ids = new Set(partidas.map(p => p.id).concat(excluir));
    db().Partidas = db().Partidas.filter(p => !ids.has(p.id));
    db().Lances = db().Lances.filter(l => !ids.has(l.partida_id));
    db().Escalacoes = db().Escalacoes.filter(r => !ids.has(r.partida_id));
    db().Revezamentos = db().Revezamentos.filter(r => !ids.has(r.partida_id));
    for (const p of partidas){
      const pa = p.lances.filter(l => l.time === p.time_a).length, pb = p.lances.length - pa;
      db().Partidas.push({ id: p.id, domingo_id: d.id, seq: p.seq, time_a: p.time_a, time_b: p.time_b, pontos_a: pa, pontos_b: pb,
        vencedor: p.fim && pa !== pb ? (pa > pb ? p.time_a : p.time_b) : '', alvo: p.alvo, inicio: p.inicio, fim: p.fim,
        gatilho: p.gatilho, desempate: p.desempate });
      for (const lado of ['A', 'B']) for (const j of p.escalacao?.[lado] || []) db().Escalacoes.push({ partida_id: p.id, time: lado, jogador_id: j });
      for (const t of p.revezamentos || []) db().Revezamentos.push({ domingo_id: d.id, partida_id: p.id, sai_jogador_id: t.sai, entra_jogador_id: t.entra });
      p.lances.forEach((l, i) => db().Lances.push({ ...l, seq: i + 1, partida_id: p.id }));
    }
    if (d.status === 'aberto' && partidas.length) d.status = 'em_jogo';
    salvar();
    return { sincronizadas: partidas.map(p => p.id), excluidas: excluir };
  },
  async ranking({ data }){
    const { periodosRanking_, rankingPeriodo_ } = await lib();
    const base = tabelasJogos(), periodos = periodosRanking_(data, base.config);
    return { periodos, mes: rankingPeriodo_({ ...base, ...periodos.mes }), temporada: rankingPeriodo_({ ...base, ...periodos.temporada }) };
  },
  async encerrar_domingo({ pin, data }){
    exigirAdmin(pin);
    const d = domingo(data);
    if (!d || !db().Partidas.some(p => p.domingo_id === d.id && p.fim)) throw new Error('Nenhum jogo encerrado foi enviado para este domingo.');
    const notas = (await lib()).calcularNotas_({ ...tabelasJogos(), data: d.data, notas: db().Notas });
    db().Notas = db().Notas.filter(n => n.data !== d.data).concat(notas);
    d.status = 'encerrado';
    salvar();
    return { domingo: d, notas };
  },
  salvar_times({ pin, data, times = [], revezamento = [] }){
    exigirAdmin(pin);
    const d = garantirDomingo(data);
    const linhas = times.flatMap((t, i) => t.map(id => ({ domingo_id: d.id, time_num: i + 1, jogador_id: id })))
      .concat(revezamento.map(id => ({ domingo_id: d.id, time_num: 0, jogador_id: id })));
    db().Times = db().Times.filter(r => r.domingo_id !== d.id).concat(linhas);
    salvar();
    return { domingo: d, times: timesDe(d.id), revezamento: revezamentoDe(d.id) };
  }
};

export async function chamarDemo(acao, dados){
  await new Promise(r => setTimeout(r, 150));
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw erroDeRede();   // imita a falta de internet
  const fn = ACOES[acao];
  if (!fn) throw new Error('Ação desconhecida.');
  return { ok: true, ...structuredClone(await fn(dados || {})) };
}
