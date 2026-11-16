/* ===== Dados iniciais (usados só no modo demonstração) =====
   A planilha de verdade recebe os mesmos dados pelo backend/Setup.gs;
   o teste tests/seed.test.js confere que as duas listas são iguais. */

// [nome, sexo, nota_admin, tipo, idade_aprox]  (idade_aprox vem das faixas "50+", "30+"...; vazio quando não informada)
export const SEED = [
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

// Aba Config: [chave, valor]
export const CONFIG_PADRAO = [
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
