import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarMensagem, reconhecerLista, entraPorPadrao, linkWhatsApp } from '../app/js/core/lista.js';
import { normalizar, proximoDomingo, isoData, idade } from '../app/js/core/util.js';

const J = (id, nome, extra = {}) => ({ id, nome, tipo: 'mensalista', ...extra });

test('normalizar ignora acentos, maiúsculas e pontuação', () => {
  assert.equal(normalizar('  Luiz   AURÉLIO! '), 'luiz aurelio');
  assert.equal(normalizar('Raíssa ✅'), 'raissa');
});

test('próximo domingo', () => {
  assert.equal(isoData(proximoDomingo(new Date(2026, 10, 19))), '2026-11-22'); // quinta
  assert.equal(isoData(proximoDomingo(new Date(2026, 10, 22))), '2026-11-22'); // o próprio domingo
});

test('idade pelo nascimento ou pela idade aproximada', () => {
  const hoje = new Date(2026, 10, 15);
  assert.equal(idade({ nascimento: '1990-11-16' }, hoje), 35);
  assert.equal(idade({ nascimento: '1990-11-15' }, hoje), 36);
  assert.equal(idade({ nascimento: '', idade_aprox: 55 }, hoje), 55);
  assert.equal(idade({}, hoje), null);
});

test('mensagem de quinta no formato do grupo', () => {
  const msg = gerarMensagem({
    data: '2026-11-22', vagas: 4, suplentes: 3,
    mensalistas: [J('1', 'Sara'), J('2', 'Ádria'), J('3', 'Bruno')]
  });
  assert.equal(msg, [
    '*Vôlei da Família*',
    '*Domingo, 22/11*',
    'De 9:30 às 11:30',
    '*Lista Jogadores*',
    '1. Ádria (confirmar)',
    '2. Bruno (confirmar)',
    '3. Sara (confirmar)',
    '4.',
    '*Suplentes*',
    '1.',
    '2.',
    '3.'
  ].join('\n'));
  assert.ok(linkWhatsApp(msg).startsWith('https://wa.me/?text=*V%C3%B4lei%20da%20Fam%C3%ADlia*%0A'));
});

test('reconhece a lista colada do grupo', () => {
  const jogadores = [
    J('J1', 'Luiz Aurélio'), J('J2', 'Luiza'), J('J3', 'Gabriela', { apelidos: 'Gabi, Gabizinha' }),
    J('J4', 'Gustavo', { apelido_camisa: 'Gustana' }), J('J5', 'Raissa', { tipo: 'avulso' }), J('J6', 'Thais'), J('J7', 'Thamires')
  ];
  const texto = [
    '*Vôlei da Família*',
    '*Domingo, 22/11*',
    'De 9:30 às 11:30',
    '*Lista Jogadores*',
    '1. Luiz aurelio ✅',
    '2. LUIZA',
    '3. Gabi 👍🏽',
    '4. Gustana',
    '5. Thamires (confirmar)',
    '6. Thais ❌',
    '7. Fulano de Tal',
    '8. Luiza',
    '9.',
    '*Suplentes*',
    '1) Raíssa',
    '2.'
  ].join('\n');
  const itens = reconhecerLista(texto, jogadores);
  const por = t => itens.find(i => i.texto === t);
  assert.equal(itens.length, 9);
  assert.equal(por('Luiz aurelio').jogador.id, 'J1');
  assert.equal(por('LUIZA').jogador.id, 'J2');
  assert.equal(por('Gabi').jogador.id, 'J3');
  assert.equal(por('Gustana').jogador.id, 'J4');
  assert.equal(por('Thamires').status, 'pendente');
  assert.equal(por('Thais').status, 'fora');
  assert.equal(por('Fulano de Tal').jogador, null);
  assert.equal(itens[7].status, 'repetido');
  assert.equal(por('Raíssa').secao, 'suplentes');
  assert.equal(por('Raíssa').jogador.id, 'J5');
  const entram = itens.filter(entraPorPadrao).map(i => i.jogador.id);
  assert.deepEqual(entram, ['J1', 'J2', 'J3', 'J4']);
});

test('primeiro nome só vale quando não é ambíguo', () => {
  const jogadores = [J('1', 'Ana Paula'), J('2', 'Ana Clara'), J('3', 'Roberto Silva')];
  const itens = reconhecerLista('1. Ana\n2. Roberto\n3. Ana Clara', jogadores);
  assert.equal(itens[0].jogador, null);
  assert.equal(itens[1].jogador.id, '3');
  assert.equal(itens[2].jogador.id, '2');
});
