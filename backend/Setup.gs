/**
 * Vôlei da Família – App: estrutura da planilha e dados iniciais.
 *
 * Rode configurarPlanilha() uma vez (e de novo sempre que atualizar o código):
 * cria as abas que faltam, acrescenta colunas novas no fim, coloca os dados
 * iniciais em Jogadores (só se a aba estiver vazia) e as chaves que faltam em Config.
 * Nunca apaga nem reescreve dados que já existem.
 */

// Abas e colunas. Colunas novas sempre no fim, para não deslocar as existentes.
const ABAS = {
  Jogadores: ['id', 'nome', 'apelido_camisa', 'numero', 'sexo', 'nascimento', 'altura_cm', 'posicao', 'tipo', 'nota_admin', 'ativo',
              'idade_aprox', 'apelidos', 'token_hash', 'criado_em', 'atualizado_em'],
  Domingos:  ['id', 'data', 'status'],
  Presencas: ['domingo_id', 'jogador_id'],
  Times:     ['domingo_id', 'time_num', 'jogador_id'],
  Partidas:  ['id', 'domingo_id', 'seq', 'time_a', 'time_b', 'pontos_a', 'pontos_b', 'vencedor', 'alvo', 'inicio', 'fim'],
  Lances:    ['id', 'partida_id', 'seq', 'time', 'jogador_id', 'tipo', 'criado_em'],
  Notas:     ['data', 'jogador_id', 'partidas', 'desempenho', 'nota_calculada', 'nota_final'],
  Config:    ['chave', 'valor']
};

// Colunas guardadas como texto puro (evita a planilha converter datas, horas e números com zero à esquerda)
const COLUNAS_TEXTO = {
  Jogadores: ['id', 'nome', 'apelido_camisa', 'numero', 'sexo', 'nascimento', 'posicao', 'tipo', 'apelidos', 'token_hash'],
  Domingos:  ['id', 'data', 'status'],
  Presencas: ['domingo_id', 'jogador_id'],
  Times:     ['domingo_id', 'jogador_id'],
  Partidas:  ['id', 'domingo_id', 'vencedor', 'inicio', 'fim'],
  Lances:    ['id', 'partida_id', 'jogador_id', 'tipo', 'criado_em'],
  Notas:     ['data', 'jogador_id'],
  Config:    ['chave', 'valor']
};

// [nome, sexo, nota_admin, tipo, idade_aprox]. Igual a app/js/seed.js (o teste tests/seed.test.js confere).
const SEED = [
  ['Adriana', 'F', 4, 'mensalista', 55],
  ['Alaine', 'F', 4, 'mensalista', 55],
  ['Daniel', 'M', 4, 'mensalista', 35],
  ['Elizet', 'F', 3, 'mensalista', ''],
  ['Emmerson', 'M', 3, 'mensalista', 55],
  ['Gabriela', 'F', 1, 'mensalista', 35],
  ['Gustavo', 'M', 5, 'mensalista', 25],
  ['Jean', 'M', 3, 'mensalista', 55],
  ['Larissa', 'F', 1, 'mensalista', ''],
  ['Luiz Aurélio', 'M', 4, 'mensalista', 55],
  ['Luiza', 'F', 4, 'mensalista', 25],
  ['Margery', 'F', 4, 'mensalista', 35],
  ['Matheus', 'M', 4, 'mensalista', 25],
  ['Roberto', 'M', 4, 'mensalista', ''],
  ['Sara', 'F', 3, 'mensalista', 25],
  ['Thamires', 'F', 1, 'mensalista', ''],
  ['Ygor', 'M', 4, 'avulso', 30],
  ['John', 'M', 2, 'avulso', 15],
  ['Renato', 'M', 3, 'avulso', 35],
  ['Thierry', 'M', 3, 'avulso', ''],
  ['Thais', 'F', 3, 'avulso', ''],
  ['Raissa', 'F', 1, 'avulso', ''],
  ['Davi', 'M', 2, 'avulso', 15]
];

// Aba Config. Os pesos da nota e do equilíbrio dos times podem ser ajustados direto na planilha.
// temporada_inicio (aaaa-mm-dd): início da temporada no ranking; vazio = 1º de janeiro.
const CONFIG_PADRAO = [
  ['pontos_partida', 15],
  ['times', 4],
  ['jogadores_por_time', 4],
  ['vagas', 16],
  ['suplentes', 3],
  ['hora_inicio', '9:30'],
  ['hora_fim', '11:30'],
  ['peso_ataque', 1],
  ['peso_bloqueio', 1],
  ['peso_ace', 1.5],
  ['peso_erro', -0.5],
  ['peso_erro_adversario', 0],
  ['bonus_vitoria', 2],
  ['domingos_janela', 8],
  ['nota_percentis', '10,25,30,25,10'],
  ['nota_partidas_min', 6],
  ['nota_partidas_max', 20],
  ['nota_peso_calc_meio', 0.5],
  ['nota_peso_calc_alto', 0.7],
  ['nota_variacao_max', 0.5],
  ['times_peso_nota', 3],
  ['times_peso_altura', 1],
  ['times_peso_idade', 0.5],
  ['times_peso_dupla_repetida', 1],
  ['temporada_inicio', '']
];

function configurarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];
  Object.keys(ABAS).forEach(function (nome) {
    let sh = ss.getSheetByName(nome);
    if (!sh) { sh = ss.insertSheet(nome); log.push('Aba criada: ' + nome); }
    const colunas = ABAS[nome];
    const atuais = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(String) : [];
    const faltam = colunas.filter(function (c) { return atuais.indexOf(c) < 0; });
    if (faltam.length) {
      sh.getRange(1, atuais.length + 1, 1, faltam.length).setValues([faltam]);
      log.push(nome + ': colunas ' + faltam.join(', '));
    }
    const cab = atuais.concat(faltam);
    sh.getRange(1, 1, 1, cab.length).setFontWeight('bold');
    sh.setFrozenRows(1);
    (COLUNAS_TEXTO[nome] || []).forEach(function (c) {
      sh.getRange(1, cab.indexOf(c) + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });

  // Abas padrão vazias de planilha nova
  ['Página1', 'Sheet1', 'Planilha1'].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  if (ler_('Jogadores').length === 0) {
    const agora = new Date();
    anexar_('Jogadores', SEED.map(function (s, i) {
      return { id: 'J' + ('00' + (i + 1)).slice(-3), nome: s[0], sexo: s[1], nota_admin: s[2], tipo: s[3], idade_aprox: s[4],
               posicao: 'tanto_faz', ativo: true, criado_em: agora, atualizado_em: agora };
    }));
    log.push('Jogadores: ' + SEED.length + ' cadastros iniciais');
  }

  const chaves = ler_('Config').map(function (c) { return c.chave; });
  const novas = CONFIG_PADRAO.filter(function (c) { return chaves.indexOf(c[0]) < 0; });
  if (novas.length) {
    anexar_('Config', novas.map(function (c) { return { chave: c[0], valor: String(c[1]) }; }));
    log.push('Config: ' + novas.map(function (c) { return c[0]; }).join(', '));
  }

  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_PIN')) {
    log.push('ATENÇÃO: falta o PIN. Configurações do projeto > Propriedades do script > ADMIN_PIN.');
  }
  Logger.log(log.length ? log.join('\n') : 'Tudo já estava configurado.');
}
