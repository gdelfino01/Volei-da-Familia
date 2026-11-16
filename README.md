# Vôlei da Família

App da pelada de domingo (9h30–11h30, 16 vagas, 4 times de 4): lista do WhatsApp, cadastro, times, placar e ranking.
Site estático no GitHub Pages (https://gdelfino01.github.io/Volei-da-Familia/), com uma planilha Google Sheets como banco, via Google Apps Script.

## Estrutura

```
index.html        Casca do app: telas, barra inferior, diálogo do PIN
manifest.webmanifest, icon*.png, icon.svg   Instalação no celular (PWA)
sw.js             Service worker: o app abre sem internet
css/app.css       Visual do app
js/
  config.js       URL do Apps Script (API_URL) e constantes
  main.js         Rotas (#lista, #times, #placar, #ranking, #perfil) e ações globais
  store.js        Estado: dados do domingo, PIN e cadastro ligados a este celular
  api.js          GET/POST para o Apps Script (POST text/plain, sem preflight de CORS)
  mock.js         Modo demonstração: imita a API no localStorage quando API_URL está vazia
  placar-store.js Placar guardado no celular e enviado em lote à planilha
  seed.js         Dados iniciais do modo demonstração (iguais aos do Setup.gs)
  ui.js           Cabeçalho, avisos, copiar
  core/           Lógica pura, testada no Node
    util.js       Normalização de nomes, datas, idade
    lista.js      Mensagem de quinta e reconhecimento da lista colada
    times.js      Equilibrar (serpente + trocas locais, 3 opções) e Sortear
    placar.js     Lances, vencedor, fila "quem ganha fica" e controle do que falta enviar
  views/          Uma tela por arquivo: perfil, lista, times, placar, ranking
app/              Só redireciona o endereço antigo (/app/) para a raiz
backend/          Apps Script (sem segredos). Passo a passo de deploy no backend/LEIAME.md
  Nota.gs         Cálculo da nota e do ranking (funções puras: rodam no Apps Script, no Node e no modo demonstração)
tests/            Testes (node --test), sem dependências
```

## Como funciona

- **Deploy do backend:** siga o [backend/LEIAME.md](backend/LEIAME.md). São estes passos: criar a planilha, colar `Code.gs`, `Setup.gs` e `Nota.gs`, definir o `ADMIN_PIN`, rodar `configurarPlanilha`, publicar o App da Web e colar a URL em `js/config.js`.
- **Modo demonstração:** com `API_URL` vazia, o app funciona sozinho no navegador. O PIN de teste é `1234`.
- **Quem faz o quê:**
  - Jogadores usam o **Perfil** (cadastro ligado ao celular) e veem os times, os resultados e o ranking.
  - O organizador entra com o PIN e passa a ver a Lista, as notas, a montagem dos times, o placar e a edição de todos os cadastros.
- **A nota nunca aparece para os jogadores.** A leitura pública da API não devolve nota, nascimento nem altura.
- **Placar na quadra (organizador):**
  - Tocar no time que pontuou, depois (opcional) em quem fez, depois em como foi. O toque em "como" já registra o lance.
  - "Erro de jogador" dá o ponto ao outro time. Também há "Desfazer último" e a lista dos últimos lances.
  - Ao atingir os pontos da partida aparece o vencedor e o botão "Salvar e próximo jogo". Quem ganha fica, e o perdedor vai para o fim da fila.
- **Ranking e nota:**
  - O Ranking mostra Mês e Temporada, com pontos (ataque, bloqueio e ace), aces e vitórias, e destaques para mais pontos, mais aces e mais vitórias. A coluna Nota só aparece para o organizador.
  - Depois do último jogo, o organizador toca em **Encerrar domingo e recalcular notas** (no Placar).
  - A regra completa está no topo do `backend/Nota.gs`. Os pesos ficam na aba Config.
  - O Equilibrar dos times usa essa nota final.
- **Sem internet:**
  - Cada lance é gravado no celular na hora.
  - O envio à planilha é em lote: ao salvar cada jogo, quando a internet volta e alguns segundos depois do último lance.
  - Reenviar não duplica nada, porque cada jogo é substituído inteiro pelo seu id.
  - O app abre sem internet (service worker) com os últimos dados guardados.
  - Ao mudar arquivos do app, aumente `VERSAO` em `sw.js`. O teste `tests/sw.test.js` avisa se a lista de arquivos ficou desatualizada.

## Rodar localmente

Os scripts são módulos ES, então abrir o `index.html` direto no navegador (`file://`) não funciona. Use um servidor local:

```bash
python -m http.server 8080
```

Depois abra http://localhost:8080.

## Testes

Precisa do Node 20 ou mais novo. Não há dependências para instalar.

```bash
npm test
```

Os testes cobrem:
- a mensagem de quinta e o reconhecimento da lista colada;
- o equilíbrio e o sorteio dos times;
- o placar (vencedor, desfazer, fila, envio em lote) e o armazenamento dele no celular;
- a nota (valor dos lances, percentil por sexo, mistura com a nota do organizador, limite de 0,5 por semana, janela de 8 domingos) e o ranking;
- a lista de arquivos do service worker;
- a igualdade entre o seed do app e o do `Setup.gs`.
