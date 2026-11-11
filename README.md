# Controle de Acessos · Sebratel

Aplicação interna do time de Inteligência de Dados para controlar **quem tem acesso a quê**
nas ferramentas que o time administra (HUB BI, DataHub, HUB APPS, AppSheet e UpValue).

Os pedidos continuam chegando por **protocolo no Voalle** (categoria 1 "Gestão de Acessos").
A aplicação lê essa fila em tempo real, ajuda a atender o protocolo e guarda o registro
do que foi liberado ou removido, com log.

## Telas

| Tela | O que faz |
|---|---|
| **Capa** | Boas-vindas e um cartão por tela, cada um com o número do momento (protocolos abertos, pessoas e acessos por plataforma, última alteração). |
| **Protocolos** | Fila do Voalle relida a cada 3 min: solicitante, e-mail de quem recebe, o que foi pedido, prazo/atraso e se já tem registro aqui. Protocolo novo vira aviso na tela (e notificação do sistema, se permitido). Ao abrir um protocolo: dados do Voalle, plataforma (corrigível), anotação, "marcar como tratado" e o formulário para registrar a inclusão — na árvore dele, o que a pessoa já tem (em qualquer plataforma) vem marcado e travado. Na exclusão, a lista dos acessos atuais para escolher o que remover. |
| **HUB BI · DataHub · HUB APPS · AppSheet · UpValue** | Uma tela por plataforma: indicadores, **árvore de acessos** (acesso à ferramenta › dashboard/aplicação › aba/funcionalidade/papel), quem tem acesso a cada nó, "quem tem acesso a quê", os protocolos e o log da plataforma. Dashboards/aplicações são cadastrados à mão (nome, link, dono, se tem controle de acesso próprio). Para conceder acesso a um item: escolhe as pessoas numa lista pesquisável (várias de uma vez; quem já tem aparece travado), o protocolo do Voalle (obrigatório) e uma observação opcional. |
| **Pessoas** | Visão pela pessoa: todos os acessos por plataforma, histórico e "remover todos" (desligamento/troca de área). |
| **Log de alterações** | Toda adição e remoção (quem fez, quando, para quem, qual protocolo) e as mudanças no cadastro. Não editável. |
| **Administração** (engrenagem no topo, só admin) | Quem já entrou, quem está online, último login/acesso e a permissão de cada um: Padrão, Edição ou Admin. |

### Regras da árvore

- Conceder um item registra também os **níveis acima** que têm controle próprio (aba › dashboard › hub) — desmarcável.
- Remover um item pode remover junto os **níveis abaixo** da mesma pessoa.
- Item sem "controle de acesso próprio" herda do nível acima e não recebe concessão.
- Remover um item da árvore com acessos ativos exige confirmar a remoção desses acessos (vão para o log).

## Como o protocolo é lido

A consulta é a do time (`server/src/modules/protocols/voalle-protocols.repository.ts`), enxuta:
sem o JOIN em `reports` (o `DISTINCT ON` por protocolo faz o desempate) e com os protocolos
vinculados agregados. Da descrição (HTML do Voalle) sai só texto: o modelo
"Nome da dashboard ou aplicativo:" / "E-mail do solicitante do acesso:" é interpretado; quando o
e-mail informado está fora do domínio (ex.: `@sebratel.com.bnr`), sugere o do cadastro do solicitante.
Categoria 2 → plataforma (`Hub BI`, `UpValue`, `AppSheet /Aplicativos`); categoria 3 → Inclusão/Exclusão.
Dias corridos e atraso seguem a mesma regra da consulta original (contra o "prazo de entrega").

## Stack

- **web/** — Vite + React 18 + TypeScript + Tailwind v4, TanStack Query, react-hook-form + zod, lucide. Tema claro/escuro com a paleta das dashboards Sebratel (vinho `#880F17` + dourado).
- **server/** — Node 22.13+ / Express + TypeScript, zod. Banco próprio em **SQLite** (`node:sqlite`, embutido no Node — sem servidor de banco para manter) no `DATA_PATH`. Voalle via `pg`, sempre em `BEGIN READ ONLY`.
- Layout, capa, login e Administração no mesmo desenho da **logisticDashboard** (topo com o título da tela, abas por grupo com "Mais telas", capa vinho, cartões com cabeçalho vinho). O CSS portado está em `web/src/styles/shell.css` e `login.css`.
- Login com Google igual ao da logisticDashboard: qualquer conta do domínio entra e fica cadastrada como **Padrão** (só consulta); um admin promove para **Edição** ou **Admin** na Administração. `ADMIN_EMAILS` só vale enquanto não existir nenhum admin.

## Rodando em desenvolvimento

```bash
npm run install:all
npm run dev:server   # API em http://localhost:8095
npm run dev:web      # Web em http://localhost:5173 (proxy /api -> 8095)
```

O site usa a porta **5173** de propósito: é a origem já liberada no cliente OAuth das dashboards. Se ela estiver ocupada (outra dashboard rodando), o Vite para com erro em vez de pular para outra porta, porque nela o Google recusaria o login (`origin_mismatch`). Para usar outra porta, libere `http://localhost:<porta>` em *Origens JavaScript autorizadas* do cliente OAuth e rode `npm --prefix web run dev -- --port <porta>`.

O servidor lê os `.env` das pastas acima do projeto (o `.env` compartilhado de `C:\Scripts\github`).
Coloque lá as variáveis `DB_ELLEVEN_*` (ou `DB_VOALLE_*`). Para rodar sem login local: `AUTH_ENABLED=false`.

```bash
npm test         # server (node:test) + web (vitest)
npm run typecheck
```

## Deploy (Portainer)

Stack por repositório com `docker-compose.yml` (imagem única: a API serve a SPA). Preencher na stack:
`DB_VOALLE_*`, `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` (primeiro admin), e opcionalmente `HOST_PORT` (padrão 8086).
O volume `access-control-data` guarda o banco — **não remova**. Adicione a URL pública em
*Authorized JavaScript origins* do cliente OAuth.

## Importação de exports (HUB BI, HUB APPS e UpValue)

Botão **Importar export** na tela da plataforma (papel Edição ou Admin). O arquivo (`.csv`, `.xlsx` ou
`.xlsm` — só os valores são lidos, nenhuma macro roda) é lido no navegador; o servidor mostra uma
**prévia** e só grava quando você confirma. Importar o mesmo arquivo de novo não muda nada.

### HUB BI

Export "permissões ativas" (`.xlsx` com `id_dashboard`, `dashboard`, `email` e, se houver, `usuario`, `nivel_usuario`, `ativa`,
`criado_em`, `id_permissao`). A planilha é lida no navegador; o servidor mostra uma **prévia** (nada
gravado) e só grava quando você confirma.

- cada dashboard vira um item da árvore, ligado pelo `id_dashboard` (renomeações no HUB acompanham);
  se já houver um dashboard cadastrado à mão com o mesmo nome, ele é ligado em vez de duplicado;
- `nivel_usuario` (Admin/User) vira o acesso à raiz "Acesso ao HUB BI"; quem não tem nível não tem
  cadastro no HUB (nunca entrou) e fica só com os dashboards;
- cada linha vira um acesso com origem "Importado" e a data original do HUB;
- linhas repetidas (mesmo dashboard e e-mail) e inativas são ignoradas e listadas;
- acessos registrados aqui que **não** constam no export são apontados — e só são removidos se você marcar.
  Abas cadastradas aqui e o acesso ao hub nunca são removidos pela importação.

Importar o mesmo arquivo de novo não muda nada: dá para repetir sempre que houver um export novo.

### UpValue

Planilha "Controle UpValue", aba **Export**, colunas `Usuário`, `email`, `Relatório` — agrupada: o nome e o
e-mail aparecem só na primeira linha de cada pessoa e os relatórios dela seguem nas linhas de baixo.

- cada relatório vira um item da árvore da UpValue (sem o prefixo "[Up]"), casado pelo nome;
- quem aparece no export ganha o acesso à ferramenta ("Acesso ao UpValue");
- como o export lista todos os usuários, quem sumiu dele (relatório ou a ferramenta inteira) aparece em
  "não consta no export" — e só é removido se você marcar.

### HUB APPS

Os CSVs do HUB APPS, **escolhidos juntos** no mesmo diálogo — cada arquivo é reconhecido pelas colunas:

| Arquivo | Colunas usadas | Obrigatório |
|---|---|---|
| acessos por usuário | `email`, `app` (e `usuario`, `motivo_acesso`: perfil, equipe, usuario_direto…) | sim |
| usuários | `email`, `name`, `perfil`, `equipe`, `is_admin`, `ativo`, `cadastrado_em` | não |
| apps | `id`, `name`, `url`, `ativo` | não |
| usuários por app | — (só nomes; é reconhecido e deixado de fora) | não |

- cada app vira um item da árvore do HUB APPS (ligado pelo `id` do HUB; com link quando é http/https);
- com o arquivo de usuários, todo usuário **ativo** ganha o "Acesso ao HUB APPS" com o nível Admin ou o
  perfil (Técnica, Comercial, Usuários) e a data de cadastro; a equipe vai para o departamento da pessoa;
- usuários inativos no HUB ficam de fora, inclusive os acessos deles a apps;
- o motivo vira a observação do acesso ("via perfil", "via equipe", "via usuário direto");
- com o arquivo de usuários, quem sumiu do HUB aparece em "não consta no export" — e só sai se você marcar.

## Conexão direta com HUB BI e HUB APPS

Com as credenciais configuradas (seção "Conexão direta" do `.env.example`), a aplicação lê os hubs direto da
origem, **somente leitura**, e mantém as telas em dia sozinha. Ela sincroniza 10 s depois de subir e depois a
cada `HUB_SYNC_INTERVAL_MS` (padrão 15 min). Na tela da plataforma, quem tem papel Edição ou Admin também tem
o botão **Sincronizar agora**.

| Hub | Origem | O que é lido |
|---|---|---|
| HUB BI | Firestore `sebratel-tecnologia` (conta de serviço) | `DHO_dashboards`, `DHO_dashboard_access_email` (só ativas), `DHO_users` |
| HUB APPS | MySQL `DB_Hub_Apps` (usuário só com SELECT) | `users`, `teams`, `apps` |

**HUB APPS:** a regra de acesso é a do próprio hub. A pessoa ativa vê a aplicação se está na lista de
usuários dela, se a equipe está na lista de equipes ou se o perfil está na lista de perfis. O motivo vira a
observação do acesso ("via perfil", "via equipe + perfil"…).
- Aplicação sem nenhuma das três listas é aberta a todos do hub: aparece como item **sem controle próprio**
  (herda do hub) e não gera um acesso por pessoa.
- Admin do hub entra com o nível "Admin"; os outros, com o perfil.

**HUB BI:** cada dashboard é casado pelo id do Firestore. O nível do `DHO_users` (Admin/User) vira o acesso à
raiz; cada permissão ativa vira o acesso ao dashboard.

**Como a sincronização trata as diferenças:**
- **O que é novo no hub** entra aqui (itens, pessoas, acessos), com a mesma regra da importação: casa pelo
  id, nunca duplica e só grava o que mudou. O log só ganha registro quando algo muda.
- **O que veio do hub e saiu de lá** é removido daqui também. Aqui é o espelho do hub.
- **O que foi registrado aqui** (por protocolo ou à mão) e não existe no hub **fica**, e aparece como
  "N só aqui" ao lado do status. É uma divergência: libere no hub ou remova aqui.

**Status na tela:** "Ao vivo · 10:32", "Falha na sincronização" (com o motivo, sem dados da conexão) ou "Sem
conexão direta". Na última, a importação de export continua funcionando como antes.

**Credenciais:**
- Peça credenciais **só de leitura**. A integração só faz SELECT (MySQL, numa sessão `READ ONLY`) e leituras
  no Firestore.
- O arquivo JSON da conta de serviço nunca vai para o repositório. No Portainer, use as variáveis
  `HUB_BI_FIREBASE_CLIENT_EMAIL`/`HUB_BI_FIREBASE_PRIVATE_KEY` ou monte o arquivo como secret.
- No Firestore, cada documento lido é cobrado. Uma sincronização do HUB BI lê ~1 mil documentos, o que dá
  ~96 mil por dia no intervalo de 15 min.

Escrever nos hubs (liberar ou remover aqui e valer lá) ainda não está feito. Está no [ROADMAP.md](ROADMAP.md).

## Dados dos HUBs

Os repositórios trazem a estrutura, não os dados:

- **HUB BI** (Firebase `sebratel-tecnologia`, Firestore): `DHO_dashboards {title, url, description}`,
  `DHO_dashboard_access_email {dashboardID, email, isActive}` (um documento por dashboard × e-mail),
  `DHO_users {name, email, accessLevel}`. Não existe controle por aba no HUB BI hoje — as abas internas ficam
  registradas só aqui. Leitura externa exige conta de serviço do Firebase (Admin SDK) ou token de um admin do HUB.
- **HUB APPS** (MySQL `DB_Hub_Apps`): `apps` (`allowed_users`/`allowed_teams`/`allowed_profiles` em JSON),
  `users` (`is_active`, `is_admin`), `access_requests` e `audit_logs`. Leitura por credencial MySQL somente leitura.

O campo `external_ref` dos recursos existe para casar o que vier dessas fontes sem duplicar.

## Melhorias futuras

Ver [ROADMAP.md](ROADMAP.md):
- sincronizar direto com HUB BI, HUB APPS e DataHub, nos dois sentidos;
- abrir protocolo na Voalle quando a mudança não tiver protocolo;
- IA para interpretar os pedidos da fila;
- pré-visualização com imagens das dashboards e aplicações;
- aba de indicadores;
- métricas de uso das plataformas (quem está online, dashboards mais abertos, último acesso), depois da integração.
