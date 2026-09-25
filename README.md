# Vôlei da Família

Site estático (GitHub Pages) com os uniformes 2026 e o formulário de pedido de kits.

## Estrutura

```
index.html        Introdução: escudo, modelos, preços e detalhes
pedido.html       Pedido em 6 etapas, com a quadra
css/
  base.css        Cores, tipografia, botões e cabeçalho (as duas páginas)
  intro.css       Estilos da introdução
  pedido.css      Estilos do pedido
js/
  config.js       URL da planilha, preços, peças, tamanhos e cores
  utils.js        Funções pequenas (moeda, escape de HTML)
  state.js        Estado do pedido e regras (preço, validação)
  figure.js       Desenho SVG do jogador com o uniforme
  court.js        Quadra com os jogadores
  views.js        HTML de cada etapa
  api.js          Montagem e envio do pedido ao Google Apps Script
  pix.js          Valor da 1ª parcela e Pix copia e cola
  pedido.js       Entrada da página de pedido: navegação e eventos
  intro.js        Entrada da introdução: abas dos modelos e preços
assets/img/       Escudo e imagens dos uniformes
assets/email/     Versões em JPG usadas no e-mail de confirmação
apps-script/      Código do Google Apps Script (planilha + e-mail). Fica só na máquina local (está no .gitignore); veja o LEIAME.md
```

Preços, dados do Pix e a URL da planilha ficam só em `js/config.js`; a introdução e o pedido leem de lá.

## Rodar localmente

Os scripts são módulos ES, então abrir o `index.html` direto no navegador (`file://`) não funciona. Use um servidor local:

```bash
python -m http.server 8080
```

e abra http://localhost:8080.
