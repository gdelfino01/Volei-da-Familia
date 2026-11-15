# Backend do app (Google Apps Script)

O app em `/app` conversa com uma planilha própria, **"Vôlei da Família – App"**, por meio de um App da Web do Apps Script.
É uma planilha nova: a planilha dos uniformes e a do caixa não são tocadas.

## Arquivos

- `Code.gs`: a API JSON (`doGet` para leitura pública, `doPost` para escrita), validação e segurança.
- `Setup.gs`: abas, colunas, dados iniciais (seed) e a função `configurarPlanilha()`.

Nenhum dos dois tem segredo: o PIN do organizador fica em **Propriedades do script**.

## Passo a passo (primeira vez)

1. **Crie a planilha.** No Google Drive: Novo > Planilhas Google. Dê o nome `Vôlei da Família – App`.
2. **Abra o Apps Script.** Na planilha: **Extensões > Apps Script**.
3. **Cole o código.**
   - Apague o conteúdo do `Código.gs` e cole o `backend/Code.gs`.
   - Clique em **+ > Script**, crie um arquivo `Setup` e cole o `backend/Setup.gs`.
   - Salve (ícone de disquete).
4. **Ajuste o fuso.** Engrenagem **Configurações do projeto** > Fuso horário: `(GMT-03:00) São Paulo`.
5. **Configure o PIN.** Ainda em **Configurações do projeto**, desça até **Propriedades do script** > **Adicionar propriedade**:
   - Propriedade: `ADMIN_PIN`
   - Valor: um PIN de **6 dígitos ou mais**, que só a organização sabe.
6. **Crie as abas e o seed.** Volte ao editor, escolha a função `configurarPlanilha` no menu ao lado de **Executar** e clique em **Executar**.
   O Google pede autorização na primeira vez (Revisar permissões > sua conta > Avançado > Acessar).
   Em **Registro de execução** aparece o que foi criado. As abas Jogadores, Domingos, Presencas, Times, Partidas, Lances, Notas e Config ficam prontas, com os 23 jogadores e os pesos na Config.
7. **Publique o App da Web.** **Implantar > Nova implantação** > engrenagem > **App da Web**:
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Clique em **Implantar** e copie a URL que termina em `/exec`.
8. **Ligue o site.** Cole a URL em `API_URL` no arquivo `app/js/config.js`, faça o commit e o push.
   O GitHub Pages publica em `https://gdelfino01.github.io/Volei-da-Familia/app/`.
9. **Teste.** Abra a URL `/exec?acao=publico` no navegador: deve aparecer um JSON com `"ok":true` e os jogadores.
   No app, toque em **Organizador** e digite o PIN.

## Quando o código mudar

1. Cole os arquivos novos por cima dos antigos no editor do Apps Script e salve.
2. Rode `configurarPlanilha` de novo. Ela só **acrescenta** abas, colunas e chaves da Config que faltam; nunca apaga dados.
3. **Implantar > Gerenciar implantações** > lápis > Versão: **Nova versão** > **Implantar**. A URL continua a mesma.

## Como a segurança funciona

- **Jogadores** só leem nome, camisa, sexo, posição e tipo. Nota, nascimento, altura, idade aproximada e apelidos nunca saem na leitura pública.
- **Cadastro do jogador:** ao criar o cadastro, ou ao tocar em "Sou eu" num cadastro do seed, o celular recebe um código guardado só nele.
  - A planilha guarda só o hash desse código (coluna `token_hash`). Só esse celular, ou o organizador, edita aquele cadastro.
  - "Sou eu" só funciona em cadastros que ainda não estão ligados a nenhum celular. Se alguém pegar o cadastro errado, abra o jogador no Perfil (modo organizador) e marque **Desligar do celular atual**.
- **Organizador:** salvar presença, montar times e editar tipo, nota e apelidos exigem o `ADMIN_PIN`.
  - Depois de 20 PINs errados em 15 minutos, as ações de organizador ficam bloqueadas por 15 minutos.
  - Para trocar o PIN, edite a propriedade. Os celulares com o PIN antigo saem do modo organizador sozinhos.
- **Escrita:** tudo que chega é validado (sexo, posição, datas, altura de 100 a 230 cm, número de 0 a 99, nota de 1 a 5). Textos que começam com `=`, `+`, `-` ou `@` não viram fórmula. Cadastros públicos têm limite de 30 por hora.

## API

`GET ?acao=publico&data=aaaa-mm-dd`: config, jogadores (campos públicos), domingo, presenças e times do dia.

`POST` (corpo JSON, `Content-Type: text/plain`), sempre com `acao`:

| acao | campos | quem |
|---|---|---|
| `admin_dados` | `pin`, `data` | organizador: tudo do dia, com notas, mais os times do domingo anterior |
| `salvar_jogador` | `jogador` (+ `pin` ou `token`) | cria (público ou organizador) ou edita (dono ou organizador) |
| `reivindicar` | `id` | liga um cadastro sem dono a este celular |
| `meu_perfil` | `id`, `token` | dados do próprio cadastro |
| `salvar_presencas` | `pin`, `data`, `jogador_ids` | organizador |
| `salvar_times` | `pin`, `data`, `times` (`[[id,…],…]`) | organizador |

Resposta: `{"ok":true, …}` ou `{"ok":false, "erro":"mensagem"}`.
