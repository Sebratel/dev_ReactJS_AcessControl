# Melhorias futuras

Ideias combinadas com o time para as próximas versões, anotadas em 11/11/2026. Elas ainda não foram
começadas. Cada item tem o que já existe hoje e o que falta para começar.

## 1. Sincronizar direto com HUB BI, HUB APPS e DataHub (nos dois sentidos)

**Andamento (11/11/2026):** a **leitura** do HUB BI (Firestore) e do HUB APPS (MySQL) está pronta. Ela
sincroniza sozinha, tem o botão "Sincronizar agora" e o status na tela (ver README, "Conexão direta"). Falta
receber as credenciais de leitura. Ainda faltam: a **escrita** (valer lá o que se registra aqui) e o **DataHub**.

**O que se quer:**
- Ler os registros direto de cada aplicação, sem importar export nem cadastrar à mão.
- O que for cadastrado ou alterado aqui passa a valer na aplicação de origem: liberar, remover e ajustar o cadastro.
- **AppSheet e UpValue** continuam só manuais.

**O que já existe:**
- O campo `external_ref` dos recursos casa os itens de cada fonte sem duplicar.
- As importações (HUB BI, HUB APPS, UpValue) já fazem a parte de "ler e casar", só que a partir de arquivos.
- Cada concessão já vai para o log, com autor e protocolo.

**O que falta:**
- **Credenciais com escrita**, guardadas no `.env` e nunca no código:
  - HUB BI: conta de serviço do Firebase do projeto `sebratel-tecnologia`, com acesso ao Firestore.
  - HUB APPS: usuário MySQL do `DB_Hub_Apps` com escrita nas tabelas `users` e `apps`.
  - DataHub: a forma de acesso ainda não foi definida.
- **Um conector por plataforma** com duas operações: ler o estado atual e aplicar uma mudança.
- **A regra de conflito** quando alguém muda direto na aplicação (quem ganha?).
- **Fila de reenvio** para quando a aplicação estiver fora do ar.

## 2. Abrir protocolo na Voalle quando a mudança não tiver protocolo

**O que se quer:** ao registrar uma exclusão ou um ajuste de cadastro sem protocolo vinculado, o sistema abre um
protocolo novo na Voalle e já o vincula à mudança.

**O que já existe:**
- A leitura da fila (`db_elleven`, somente leitura).
- O campo de protocolo em toda concessão e remoção.

**O que falta:**
- Um meio de **escrita** na Voalle: a API dela ou um usuário com permissão. Hoje o acesso é só leitura.
- Definir categoria, equipe, solicitante e texto padrão do protocolo gerado.

## 3. IA para interpretar os pedidos da fila

**O que se quer:** entender melhor o texto livre dos protocolos e sugerir com mais acerto a plataforma, os
dashboards/aplicações pedidos e o e-mail de quem recebe.

**O que já existe:**
- Uma leitura por regras: limpa o HTML, extrai os e-mails e casa os itens pedidos por nome com a árvore, gerando as "Sugestões".

**O que falta:**
- Escolher o modelo e onde ele roda.
- Mandar só o necessário: o texto do pedido e a lista de itens da plataforma, sem dados pessoais além do e-mail.
- Guardar a sugestão para conferência humana. Nada é liberado sem alguém confirmar.

## 4. Pré-visualização das dashboards e aplicações

**O que se quer:** anexar imagens, prints ou fotos a cada dashboard/aplicação e abrir uma prévia num popup, para
reconhecer qual é qual sem precisar abrir o item.

**O que falta:**
- **Guardar as imagens:**
  - Onde: na pasta de dados (`/app/data`), junto com o banco.
  - Validações: tipo (png/jpg/webp), tamanho máximo e limpeza de metadados.
- **Telas:**
  - Upload na edição do item.
  - Miniatura na árvore e popup com as imagens.

## 5. Aba de indicadores

**O que se quer:** uma tela de números sobre os acessos e os protocolos.

**Sugestões de indicadores**, a combinar com o time:
- Acessos ativos por plataforma e por dashboard.
- Protocolos por mês e tempo até o atendimento.
- Concessões e remoções por período.
- Pessoas inativas que ainda têm acesso.
- Itens sem ninguém com acesso.

**O que já existe:** o log de alterações e a fila de protocolos já têm os dados. Falta a consulta agregada e a tela.

## 6. Métricas de uso das plataformas

**Depende do item 1.** Só dá para fazer quando as plataformas estiverem ligadas a esta aplicação.

**O que se quer:** saber como as plataformas são usadas de fato, e não só quem tem acesso. Por exemplo:
- quem está online agora;
- quais dashboards e aplicações são mais clicados;
- último clique em cada dashboard;
- último acesso de cada usuário.

**Para que serve:** junto com os acessos, mostra quem tem acesso e não usa (candidato a remover) e o que ninguém
abre há tempo.

**O que já existe:**
- Esta aplicação já marca "online" e "último acesso" de quem usa ela própria (tela de Administração). Dá para seguir o mesmo modelo.
- O HUB APPS tem uma tabela `audit_logs`, que pode já trazer parte desses eventos.

**O que falta:**
- Cada plataforma enviar ou expor os eventos de uso: login, abertura de dashboard e clique.
- Guardar esses eventos com retenção definida, porque crescem rápido.
- Combinar com o time o que pode ser registrado sobre cada pessoa (LGPD), e se o detalhe será por pessoa ou agregado.
- As telas: pode virar parte da aba de indicadores (item 5) e do painel da pessoa.
