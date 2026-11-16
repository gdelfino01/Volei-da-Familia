/**
 * Vôlei da Família – App: API JSON publicada como App da Web.
 *
 * GET  ?acao=publico&data=aaaa-mm-dd     leitura pública (sem nota, nascimento ou altura)
 * GET  ?acao=ranking&data=aaaa-mm-dd     ranking do mês e da temporada (pontos, aces, vitórias; sem nota)
 * POST {acao, ...} com Content-Type text/plain (sem preflight de CORS):
 *   admin_dados       {pin, data}                 tudo do domingo, com notas (organizador)
 *   salvar_jogador    {pin | token, jogador}      cria ou edita um cadastro
 *   reivindicar       {id}                        "sou eu": liga um cadastro sem dono a este celular
 *   meu_perfil        {id, token}                 dados do próprio cadastro
 *   salvar_presencas  {pin, data, jogador_ids}    presença do domingo
 *   salvar_times      {pin, data, times}          times do domingo ([[id, ...], ...])
 *   sincronizar       {pin, data, partidas, excluir}  jogos e lances do placar, em lote (idempotente)
 *   encerrar_domingo  {pin, data}                 recalcula as notas (Nota.gs) e marca o domingo como encerrado
 *
 * Toda resposta é {ok:true, ...} ou {ok:false, erro:'mensagem'}.
 * O PIN do organizador fica em Propriedades do script (ADMIN_PIN), nunca no site.
 */

const POSICOES = ['levantador', 'ponteiro', 'central', 'libero', 'tanto_faz'];
const TIPOS_LANCE = ['ataque', 'bloqueio', 'ace', 'erro', 'erro_adversario'];
const MAX_CADASTROS_POR_HORA = 30;
const MAX_ERROS_PIN = 20;          // em 15 minutos; depois disso, as ações de organizador ficam bloqueadas por 15 minutos

function doGet(e) {
  return responder_(function () {
    const p = (e && e.parameter) || {};
    if (p.acao === 'publico') return publico_(p.data);
    if (p.acao === 'ranking') return ranking_(p.data);
    if (!p.acao) return { app: 'Vôlei da Família' };
    throw new Error('Ação desconhecida.');
  });
}

function doPost(e) {
  return responder_(function () {
    if (!e || !e.postData || e.postData.contents.length > 50000) throw new Error('Requisição inválida.');
    const c = JSON.parse(e.postData.contents);
    const acoes = {
      admin_dados: adminDados_, salvar_jogador: salvarJogador_, reivindicar: reivindicar_, meu_perfil: meuPerfil_,
      salvar_presencas: salvarPresencas_, salvar_times: salvarTimes_, sincronizar: sincronizar_,
      encerrar_domingo: encerrarDomingo_
    };
    const fn = acoes[c.acao];
    if (!fn) throw new Error('Ação desconhecida.');
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try { return fn(c); } finally { lock.releaseLock(); }
  });
}

/* ---------- Leituras ---------- */

function publico_(data) {
  const d = domingoPorData_(data);
  return {
    config: config_(),
    jogadores: ler_('Jogadores').map(paraPublico_),
    domingo: d,
    presencas: d ? presencasDe_(d.id) : [],
    times: d ? timesDe_(d.id) : [],
    partidas: d ? partidasDe_(d.id) : []
  };
}

function adminDados_(c) {
  exigirAdmin_(c.pin);
  const d = domingoPorData_(c.data);
  const anteriores = ler_('Domingos').filter(function (x) { return !c.data || x.data < c.data; })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  let timesAnterior = [];
  for (let i = 0; i < anteriores.length && !timesAnterior.length; i++) timesAnterior = timesDe_(anteriores[i].id);
  const ultimas = ultimasNotas_(ler_('Notas'));
  return {
    config: config_(),
    jogadores: ler_('Jogadores').map(function (j) { return paraAdmin_(j, ultimas); }),
    domingo: d,
    presencas: d ? presencasDe_(d.id) : [],
    times: d ? timesDe_(d.id) : [],
    partidas: d ? partidasDe_(d.id) : [],
    timesAnterior: timesAnterior
  };
}

function meuPerfil_(c) {
  const j = ler_('Jogadores').filter(function (x) { return x.id === c.id; })[0];
  if (!j || !j.token_hash || hash_(c.token) !== j.token_hash) throw new Error('Cadastro não encontrado neste celular.');
  return { jogador: paraDono_(j) };
}

/* ---------- Cadastro ---------- */

function salvarJogador_(c) {
  const admin = !!c.pin;
  if (admin) exigirAdmin_(c.pin);
  const dados = c.jogador || {};
  const lista = ler_('Jogadores');
  const limpo = limparPerfil_(dados);
  if (admin) Object.assign(limpo, limparAdmin_(dados));
  const agora = new Date();

  if (!dados.id) {
    if (!limpo.nome) throw new Error('Informe o nome.');
    if (!limpo.sexo) throw new Error('Informe o sexo.');
    const igual = lista.filter(function (j) { return normalizar_(j.nome) === normalizar_(limpo.nome); })[0];
    if (igual) throw new Error('Já existe um cadastro com o nome ' + igual.nome + '.');
    if (!admin) limitarCadastros_();
    const novo = Object.assign({ tipo: 'avulso', nota_admin: 3, ativo: true, posicao: 'tanto_faz' }, limpo,
      { id: novoId_(lista), criado_em: agora, atualizado_em: agora });
    let token = '';
    if (!admin) { token = Utilities.getUuid(); novo.token_hash = hash_(token); }
    anexar_('Jogadores', [novo]);
    return { jogador: admin ? paraAdmin_(novo) : paraDono_(novo), token: token };
  }

  const atual = lista.filter(function (j) { return j.id === dados.id; })[0];
  if (!atual) throw new Error('Cadastro não encontrado.');
  if (!admin && (!atual.token_hash || hash_(c.token) !== atual.token_hash)) throw new Error('Sem permissão para editar este cadastro.');
  if (limpo.nome) {
    const outro = lista.filter(function (j) { return j.id !== atual.id && normalizar_(j.nome) === normalizar_(limpo.nome); })[0];
    if (outro) throw new Error('Já existe um cadastro com o nome ' + outro.nome + '.');
  }
  if (admin && dados.resetar_token) limpo.token_hash = '';
  Object.assign(atual, limpo, { atualizado_em: agora });
  atualizarLinha_('Jogadores', atual);
  return { jogador: admin ? paraAdmin_(atual) : paraDono_(atual) };
}

function reivindicar_(c) {
  const lista = ler_('Jogadores');
  const j = lista.filter(function (x) { return x.id === c.id; })[0];
  if (!j || j.ativo === false) throw new Error('Cadastro não encontrado.');
  if (j.token_hash) throw new Error('Esse cadastro já está ligado a outro celular. Fale com a organização.');
  limitarCadastros_();
  const token = Utilities.getUuid();
  j.token_hash = hash_(token);
  j.atualizado_em = new Date();
  atualizarLinha_('Jogadores', j);
  return { jogador: paraDono_(j), token: token };
}

/* ---------- Domingo: presença e times ---------- */

function salvarPresencas_(c) {
  exigirAdmin_(c.pin);
  const d = garantirDomingo_(c.data);
  const ids = idsValidos_(c.jogador_ids);
  substituir_('Presencas', function (r) { return r.domingo_id !== d.id; },
    ids.map(function (id) { return { domingo_id: d.id, jogador_id: id }; }));
  return { domingo: d, presencas: ids };
}

function salvarTimes_(c) {
  exigirAdmin_(c.pin);
  const d = garantirDomingo_(c.data);
  const times = Array.isArray(c.times) ? c.times : [];
  if (times.length < 2 || times.length > 8) throw new Error('Times inválidos.');
  const todos = idsValidos_([].concat.apply([], times));
  if (todos.length !== [].concat.apply([], times).length) throw new Error('Jogador repetido ou desconhecido nos times.');
  const linhas = [];
  times.forEach(function (t, i) { t.forEach(function (id) { linhas.push({ domingo_id: d.id, time_num: i + 1, jogador_id: String(id) }); }); });
  substituir_('Times', function (r) { return r.domingo_id !== d.id; }, linhas);
  return { domingo: d, times: timesDe_(d.id) };
}

/* ---------- Placar ---------- */

/* Recebe jogos inteiros (com todos os lances) e substitui o que houver com o mesmo id.
   Reenviar o mesmo lote não duplica nada; lances desfeitos somem. */
function sincronizar_(c) {
  exigirAdmin_(c.pin);
  const d = garantirDomingo_(c.data);
  const partidas = Array.isArray(c.partidas) ? c.partidas.slice(0, 40) : [];
  const excluir = (Array.isArray(c.excluir) ? c.excluir : []).map(String).filter(idOk_);
  const existe = {};
  ler_('Jogadores').forEach(function (j) { existe[j.id] = true; });
  const linhasP = [], linhasL = [];

  partidas.forEach(function (p) {
    if (!idOk_(p.id)) throw new Error('Jogo com identificador inválido.');
    const ta = Number(p.time_a), tb = Number(p.time_b);
    if (!(ta >= 1 && ta <= 8 && tb >= 1 && tb <= 8 && ta !== tb)) throw new Error('Times inválidos no jogo ' + p.seq + '.');
    let pa = 0, pb = 0;
    (Array.isArray(p.lances) ? p.lances.slice(0, 300) : []).forEach(function (l, i) {
      const t = Number(l.time);
      const jid = l.jogador_id ? String(l.jogador_id) : '';
      if (!idOk_(l.id) || (t !== ta && t !== tb) || TIPOS_LANCE.indexOf(l.tipo) < 0 || (jid && !existe[jid])) {
        throw new Error('Lance inválido no jogo ' + p.seq + '.');
      }
      if (t === ta) pa++; else pb++;
      linhasL.push({ id: String(l.id), partida_id: String(p.id), seq: i + 1, time: t, jogador_id: jid, tipo: l.tipo, criado_em: isoOuVazio_(l.criado_em) });
    });
    const fim = isoOuVazio_(p.fim);
    linhasP.push({
      id: String(p.id), domingo_id: d.id, seq: Number(p.seq) || 0, time_a: ta, time_b: tb, pontos_a: pa, pontos_b: pb,
      vencedor: fim && pa !== pb ? String(pa > pb ? ta : tb) : '', alvo: Number(p.alvo) || '', inicio: isoOuVazio_(p.inicio), fim: fim
    });
  });

  const ids = linhasP.map(function (p) { return p.id; }).concat(excluir);
  if (ids.length) {
    substituirPorChave_('Partidas', 'id', ids, linhasP);
    substituirPorChave_('Lances', 'partida_id', ids, linhasL);
  }
  if (d.status === 'aberto' && linhasP.length) { d.status = 'em_jogo'; atualizarLinha_('Domingos', d); }
  invalidarRanking_();
  return { sincronizadas: linhasP.map(function (p) { return p.id; }), excluidas: excluir };
}

/* ---------- Ranking e nota (cálculo em Nota.gs) ---------- */

function tabelasJogos_() {
  return { jogadores: ler_('Jogadores'), domingos: ler_('Domingos'), times: ler_('Times'), partidas: ler_('Partidas'), lances: ler_('Lances'), config: config_() };
}

/* Ranking público, guardado em cache por 10 minutos (o envio do placar e o encerramento limpam o cache) */
function ranking_(data) {
  if (!ehIso_(data)) throw new Error('Data inválida.');
  const cache = CacheService.getScriptCache();
  const chave = 'ranking:' + (cache.get('ranking_v') || '0') + ':' + data;
  const guardado = cache.get(chave);
  if (guardado) return JSON.parse(guardado);
  const base = tabelasJogos_();
  const per = periodosRanking_(data, base.config);
  const res = {
    periodos: per,
    mes: rankingPeriodo_(Object.assign({}, base, per.mes)),
    temporada: rankingPeriodo_(Object.assign({}, base, per.temporada))
  };
  try { cache.put(chave, JSON.stringify(res), 600); } catch (e) { /* resultado grande demais para o cache: segue sem */ }
  return res;
}

function invalidarRanking_() {
  CacheService.getScriptCache().put('ranking_v', String(Date.now()), 21600);
}

function encerrarDomingo_(c) {
  exigirAdmin_(c.pin);
  const d = domingoPorData_(c.data);
  const base = tabelasJogos_();
  if (!d || !base.partidas.some(function (p) { return p.domingo_id === d.id && p.fim; })) {
    throw new Error('Nenhum jogo encerrado foi enviado para este domingo.');
  }
  const linhas = calcularNotas_(Object.assign(base, { data: d.data, notas: ler_('Notas') }));
  substituirPorChave_('Notas', 'data', [d.data], linhas);
  d.status = 'encerrado';
  atualizarLinha_('Domingos', d);
  invalidarRanking_();
  return { domingo: d, notas: linhas };
}

function partidasDe_(domingoId) {
  return ler_('Partidas').filter(function (p) { return p.domingo_id === domingoId; })
    .map(function (p) {
      return { id: p.id, seq: Number(p.seq), time_a: Number(p.time_a), time_b: Number(p.time_b), pontos_a: Number(p.pontos_a) || 0,
               pontos_b: Number(p.pontos_b) || 0, vencedor: p.vencedor === '' ? '' : Number(p.vencedor), fim: p.fim };
    })
    .sort(function (a, b) { return a.seq - b.seq; });
}

function idOk_(s) { return /^[A-Za-z0-9_-]{4,60}$/.test(String(s || '')); }
function isoOuVazio_(v) { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(String(v || '')) ? String(v) : ''; }

function domingoPorData_(data) {
  if (!ehIso_(data)) return null;
  return ler_('Domingos').filter(function (x) { return x.data === data; })[0] || null;
}

function garantirDomingo_(data) {
  if (!ehIso_(data)) throw new Error('Data inválida.');
  const existente = domingoPorData_(data);
  if (existente) return existente;
  const d = { id: 'D' + data.replace(/-/g, ''), data: data, status: 'aberto' };
  anexar_('Domingos', [d]);
  return d;
}

function presencasDe_(domingoId) {
  return ler_('Presencas').filter(function (r) { return r.domingo_id === domingoId; }).map(function (r) { return String(r.jogador_id); });
}

function timesDe_(domingoId) {
  const times = [];
  ler_('Times').filter(function (r) { return r.domingo_id === domingoId; }).forEach(function (r) {
    const k = Number(r.time_num) - 1;
    (times[k] = times[k] || []).push(String(r.jogador_id));
  });
  return times.filter(Boolean);
}

function idsValidos_(ids) {
  const existentes = {};
  ler_('Jogadores').forEach(function (j) { existentes[j.id] = true; });
  const vistos = {};
  return (Array.isArray(ids) ? ids : []).map(String).filter(function (id) {
    if (!existentes[id] || vistos[id]) return false;
    vistos[id] = true;
    return true;
  });
}

/* ---------- Quem vê o quê ---------- */

function paraPublico_(j) {
  return { id: j.id, nome: j.nome, apelido_camisa: j.apelido_camisa, numero: String(j.numero || ''), sexo: j.sexo, posicao: j.posicao,
           tipo: j.tipo, ativo: j.ativo !== false, reivindicado: !!j.token_hash };
}

function paraDono_(j) {
  return Object.assign(paraPublico_(j), { nascimento: j.nascimento, altura_cm: j.altura_cm });
}

/* nota = a usada nos times: a última nota final calculada, ou a nota_admin se ainda não houver */
function paraAdmin_(j, ultimas) {
  const admin = Number(j.nota_admin) || 3;
  const final = ultimas && ultimas[j.id] != null ? ultimas[j.id] : '';
  return Object.assign(paraDono_(j), { nota_admin: admin, nota_final: final, nota: final === '' ? admin : final, idade_aprox: j.idade_aprox, apelidos: j.apelidos });
}

/* ---------- Validação ---------- */

function texto_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // impede fórmula na planilha
  return s;
}

function limparPerfil_(d) {
  const o = {};
  const tem = function (k) { return Object.prototype.hasOwnProperty.call(d, k); };
  if (tem('nome')) { o.nome = texto_(d.nome, 60); if (o.nome.length < 2) throw new Error('Nome muito curto.'); }
  if (tem('apelido_camisa')) o.apelido_camisa = texto_(d.apelido_camisa, 20);
  if (tem('numero')) {
    o.numero = String(d.numero == null ? '' : d.numero).trim();
    if (o.numero && !/^\d{1,2}$/.test(o.numero)) throw new Error('Número da camisa: de 0 a 99.');
  }
  if (tem('sexo')) { if (['M', 'F'].indexOf(d.sexo) < 0) throw new Error('Sexo inválido.'); o.sexo = d.sexo; }
  if (tem('nascimento')) {
    o.nascimento = String(d.nascimento || '');
    const ano = Number(o.nascimento.slice(0, 4));
    if (o.nascimento && (!ehIso_(o.nascimento) || ano < 1920 || ano > new Date().getFullYear())) throw new Error('Data de nascimento inválida.');
  }
  if (tem('altura_cm')) {
    o.altura_cm = d.altura_cm === '' || d.altura_cm == null ? '' : Math.round(Number(d.altura_cm));
    if (o.altura_cm !== '' && !(o.altura_cm >= 100 && o.altura_cm <= 230)) throw new Error('Altura: de 100 a 230 cm.');
  }
  if (tem('posicao')) o.posicao = POSICOES.indexOf(d.posicao) >= 0 ? d.posicao : 'tanto_faz';
  return o;
}

function limparAdmin_(d) {
  const o = {};
  const tem = function (k) { return Object.prototype.hasOwnProperty.call(d, k); };
  if (tem('tipo')) o.tipo = d.tipo === 'mensalista' ? 'mensalista' : 'avulso';
  if (tem('nota_admin')) {
    const n = Number(d.nota_admin);
    if (!(n >= 1 && n <= 5)) throw new Error('Nota: de 1 a 5.');
    o.nota_admin = Math.round(n * 10) / 10;
  }
  if (tem('ativo')) o.ativo = d.ativo === true || d.ativo === 'true';
  if (tem('apelidos')) o.apelidos = texto_(d.apelidos, 200);
  if (tem('idade_aprox')) {
    o.idade_aprox = d.idade_aprox === '' || d.idade_aprox == null ? '' : Math.round(Number(d.idade_aprox));
    if (o.idade_aprox !== '' && !(o.idade_aprox >= 5 && o.idade_aprox <= 99)) throw new Error('Idade aproximada: de 5 a 99.');
  }
  return o;
}

/* ---------- Segurança ---------- */

function exigirAdmin_(pin) {
  const certo = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!certo) throw new Error('O PIN do organizador ainda não foi configurado no Apps Script.');
  const cache = CacheService.getScriptCache();
  const erros = Number(cache.get('pin_erros') || 0);
  if (erros >= MAX_ERROS_PIN) throw new Error('Muitas tentativas de PIN. Espere 15 minutos.');
  if (String(pin || '') !== String(certo)) {
    cache.put('pin_erros', String(erros + 1), 900);
    Utilities.sleep(800);
    throw new Error('PIN incorreto.');
  }
}

function limitarCadastros_() {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('cadastros') || 0);
  if (n >= MAX_CADASTROS_POR_HORA) throw new Error('Muitos cadastros em pouco tempo. Tente mais tarde.');
  cache.put('cadastros', String(n + 1), 3600);
}

function hash_(token) {
  if (!token) return '';
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token), Utilities.Charset.UTF_8));
}

/* ---------- Planilha ---------- */

function aba_(nome) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!sh) throw new Error('Aba ' + nome + ' não existe. Rode configurarPlanilha() no Apps Script.');
  return sh;
}

function cabecalho_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
}

function valor_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  return v;
}

function ler_(nome) {
  const sh = aba_(nome);
  if (sh.getLastRow() < 2) return [];
  const cab = cabecalho_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).getValues()
    .filter(function (r) { return r.some(function (c) { return c !== ''; }); })
    .map(function (r) { const o = {}; cab.forEach(function (k, i) { if (k) o[k] = valor_(r[i]); }); return o; });
}

function linha_(cab, o) {
  return cab.map(function (k) { return o[k] == null ? '' : o[k]; });
}

function anexar_(nome, objs) {
  if (!objs.length) return;
  const sh = aba_(nome), cab = cabecalho_(sh);
  sh.getRange(sh.getLastRow() + 1, 1, objs.length, cab.length).setValues(objs.map(function (o) { return linha_(cab, o); }));
}

/* Reescreve a aba com as linhas mantidas + as novas */
function substituir_(nome, manter, novos) {
  const sh = aba_(nome), cab = cabecalho_(sh);
  const linhas = ler_(nome).filter(manter).concat(novos);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, cab.length).clearContent();
  if (linhas.length) sh.getRange(2, 1, linhas.length, cab.length).setValues(linhas.map(function (o) { return linha_(cab, o); }));
}

/* Troca as linhas cuja `coluna` está em `chaves` pelas `novos`.
   Só reescreve a partir da primeira linha afetada (normalmente o fim da aba). */
function substituirPorChave_(nome, coluna, chaves, novos) {
  const sh = aba_(nome), cab = cabecalho_(sh), col = cab.indexOf(coluna);
  const alvo = {};
  chaves.forEach(function (k) { alvo[String(k)] = true; });
  const n = sh.getLastRow() - 1;
  let inicio = -1;
  if (n > 0) {
    const vals = sh.getRange(2, col + 1, n, 1).getValues();
    for (let i = 0; i < n; i++) if (alvo[String(vals[i][0])]) { inicio = i; break; }
  }
  if (inicio < 0) { anexar_(nome, novos); return; }
  const faixa = sh.getRange(2 + inicio, 1, n - inicio, cab.length);
  const manter = faixa.getValues().filter(function (r) { return !alvo[String(r[col])] && r.some(function (c) { return c !== ''; }); });
  faixa.clearContent();
  const linhas = manter.concat(novos.map(function (o) { return linha_(cab, o); }));
  if (linhas.length) sh.getRange(2 + inicio, 1, linhas.length, cab.length).setValues(linhas);
}

function atualizarLinha_(nome, obj) {
  const sh = aba_(nome), cab = cabecalho_(sh);
  const ids = sh.getRange(2, cab.indexOf('id') + 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(function (r) { return String(r[0]); });
  const i = ids.indexOf(obj.id);
  if (i < 0) throw new Error('Linha não encontrada.');
  sh.getRange(i + 2, 1, 1, cab.length).setValues([linha_(cab, obj)]);
}

function novoId_(lista) {
  const max = lista.reduce(function (m, j) { const n = Number(String(j.id).replace(/\D/g, '')); return n > m ? n : m; }, 0);
  return 'J' + ('00' + (max + 1)).slice(-3);
}

function config_() {
  const o = {};
  ler_('Config').forEach(function (c) {
    const v = String(c.valor).trim();
    o[c.chave] = v !== '' && !isNaN(Number(v)) ? Number(v) : v;
  });
  return o;
}

/* ---------- Utilidades ---------- */

function normalizar_(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function ehIso_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function responder_(fn) {
  let saida;
  try { saida = Object.assign({ ok: true }, fn()); }
  catch (err) { saida = { ok: false, erro: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(saida)).setMimeType(ContentService.MimeType.JSON);
}
