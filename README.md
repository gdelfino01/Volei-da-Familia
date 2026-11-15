# Vôlei da Família

Site estático (GitHub Pages) com duas partes independentes:

- **Uniformes** (raiz): os uniformes 2026 e o formulário de pedido de kits.
- **App da pelada** (`/app`): lista do WhatsApp, cadastro, times, placar e ranking. Usa uma planilha própria, via Google Apps Script.

## Estrutura

```
index.html        Uniformes: introdução (escudo, modelos, preços e detalhes)
pedido.html       Uniformes: pedido em 6 etapas, com a quadra
css/, js/         Uniformes: estilos e módulos (config.js tem preços, Pix e a URL da planilha de pedidos)
assets/           Escudo e imagens dos uniformes
apps-script/      Apps Script dos uniformes. Fica só na máquina local (.gitignore), porque tem a chave Pix

app/              App da pelada (PWA, mobile-first)
  index.html      Casca do app: telas, barra inferior, diálogo do PIN
  manifest.webmanifest, icon*.png, icon.svg   Instalação no celular
  sw.js           Service worker: o app abre sem internet (escopo só /app)
  css/app.css     Visual do app
  js/
    config.js     URL do Apps Script do app (API_URL) e constantes
    main.js       Rotas (#lista, #times, #placar, #ranking, #perfil) e ações globais
    store.js      Estado: dados do domingo, PIN e cadastro ligados a este celular
    api.js        GET/POST para o Apps Script (POST text/plain, sem preflight de CORS)
    mock.js       Modo demonstração: imita a API no localStorage quando API_URL está vazia
    placar-store.js  Placar guardado no celular e enviado em lote à planilha
    seed.js       Dados iniciais do modo demonstração (iguais aos do Setup.gs)
    ui.js         Cabeçalho, avisos, copiar
    core/         Lógica pura, testada no Node
      util.js     Normalização de nomes, datas, idade
      lista.js    Mensagem de quinta e reconhecimento da lista colada
      times.js    Equilibrar (serpente + trocas locais, 3 opções) e Sortear
      placar.js   Lances, vencedor, fila "quem ganha fica" e controle do que falta enviar
    views/        Uma tela por arquivo: perfil, lista, times, placar, ranking
backend/          Apps Script do app (sem segredos). Passo a passo de deploy no backend/LEIAME.md
tests/            Testes (node --test), sem dependências
```

## App da pelada

- **Deploy do backend:** siga o [backend/LEIAME.md](backend/LEIAME.md). São estes passos: criar a planilha, colar `Code.gs` e `Setup.gs`, definir o `ADMIN_PIN`, rodar `configurarPlanilha`, publicar o App da Web e colar a URL em `app/js/config.js`.
- **Modo demonstração:** com `API_URL` vazia, o app funciona sozinho no navegador. O PIN de teste é `1234`.
- **Quem faz o quê:**
  - Jogadores usam o **Perfil** (cadastro ligado ao celular) e veem os times do domingo.
  - O organizador entra com o PIN e passa a ver a Lista, as notas, a montagem dos times e a edição de todos os cadastros.
- **A nota nunca aparece para os jogadores.** A leitura pública da API não devolve nota, nascimento nem altura.
- **Placar na quadra (organizador):**
  - Tocar no time que pontuou, depois (opcional) em quem fez, depois em como foi. O toque em "como" já registra o lance.
  - "Erro de jogador" dá o ponto ao outro time. Também há "Desfazer último" e a lista dos últimos lances.
  - Ao atingir os pontos da partida aparece o vencedor e o botão "Salvar e próximo jogo". Quem ganha fica, e o perdedor vai para o fim da fila.
- **Sem internet:**
  - Cada lance é gravado no celular na hora.
  - O envio à planilha é em lote: ao salvar cada jogo, quando a internet volta e alguns segundos depois do último lance.
  - Reenviar não duplica nada, porque cada jogo é substituído inteiro pelo seu id.
  - O app abre sem internet (service worker) com os últimos dados guardados.
  - Ao mudar arquivos do app, aumente `VERSAO` em `app/sw.js`. O teste `tests/sw.test.js` avisa se a lista de arquivos ficou desatualizada.

## Rodar localmente

Os scripts são módulos ES, então abrir o `index.html` direto no navegador (`file://`) não funciona. Use um servidor local:

```bash
python -m http.server 8080
```

Depois abra http://localhost:8080 para ver os uniformes e http://localhost:8080/app/ para o app.

## Testes

Precisa do Node 20 ou mais novo. Não há dependências para instalar.

```bash
npm test
```

Os testes cobrem:
- a mensagem de quinta e o reconhecimento da lista colada;
- o equilíbrio e o sorteio dos times;
- o placar (vencedor, desfazer, fila, envio em lote);
- a lista de arquivos do service worker;
- a igualdade entre o seed do app e o do `Setup.gs`.
