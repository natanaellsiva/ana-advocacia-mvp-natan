# ANA — A Nova Advocacia

MVP de gestão de demandas jurídicas, desenvolvido por **Natanael Leite Silva** com apoio do Lovable para um desafio técnico. Interface em português brasileiro, autenticação e persistência no Supabase existente **ana-advocacia-mvp** (`hrjcnzxgutkvaxdyalge`). Não é uma plataforma jurídica pronta para produção.

## Funcionalidades implementadas

- Login, sessão persistida, saída e proteção das páginas internas.
- Cadastro e consulta de clientes; gestão de membros, papéis e times.
- Demandas em quadro Kanban ou lista, criação e detalhe com tarefas e histórico.
- Tarefas com responsável, prazo e envio para revisão; correção, reenvio e aprovação.
- Conclusão condicionada às tarefas obrigatórias aprovadas; cancelamento com motivo.
- Painel com demandas abertas/concluídas, tarefas atrasadas e distribuição por status, calculado sobre dados consultados sob RLS.
- Identidade visual oficial ANA, navegação móvel e estados de carregamento/erro.

A interface atual não oferece todos os recursos de edição previstos no escopo inicial nem filtros por cliente, responsável e prioridade. O filtro disponível na lista de demandas é por status.

## Executar localmente

Pré-requisitos: Node.js 22.12+ e npm, acesso ao projeto Supabase existente e um usuário vinculado a um escritório ativo.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Preencha `.env.local` conforme abaixo; abra o endereço exibido pelo Vite. Também é possível usar Bun (`bun install` e `bun run dev`).

| Variável | Onde usar | Finalidade |
|---|---|---|
| `VITE_SUPABASE_URL` | Navegador | URL pública do projeto |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Navegador | Chave pública publishable/anon |
| `VITE_SUPABASE_PROJECT_ID` | Configuração | Referência do projeto |
| `SUPABASE_URL` | Servidor | URL do mesmo Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Servidor | Chave pública para validar a sessão e consultar sob RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor | Criar contas pelo fluxo administrativo |

Nunca use a chave `service_role` em variáveis `VITE_*`, código do navegador, README ou credenciais de demonstração públicas. No Lovable, mantenha a integração existente; não crie outro Supabase. Para publicação, o ambiente do servidor precisa receber suas variáveis em tempo de execução, não apenas durante a compilação.

**Bloqueio antes do GitHub:** a verificação confirmou que `.env` continua rastreado. O `.gitignore` é protegido contra alterações neste ambiente; a tentativa de acrescentar regras foi bloqueada. Nenhum conteúdo de `.env` foi lido ou reproduzido. Não sincronize nem torne o repositório público antes de resolver isso em uma cópia local autorizada.

Acrescente ao `.gitignore`:

```gitignore
# Configurações reais ficam fora do repositório
.env
.env.*
!.env.example
```

Depois, na sua cópia local, execute:

```bash
git rm --cached -- .env
git add .gitignore
git commit -m "Protege arquivos de ambiente"
git ls-files -- .env
git check-ignore --no-index .env .env.local
```

O primeiro comando preserva o arquivo local e remove seu rastreamento no próximo commit. A consulta `git ls-files -- .env` deve retornar vazia; a última consulta deve listar os arquivos ignorados. `.env.example` deve continuar versionado e conter apenas campos sem credenciais reais. Isso não apaga versões antigas do histórico: se uma chave privada já foi registrada, rotacione-a no Supabase e remova-a do histórico antes de compartilhar o repositório. URL, referência e chave publishable/anon são públicas; chaves `service_role`, secret e senhas não são.

## Comandos

```bash
npm run test      # testes automatizados disponíveis
npm run build     # gerar a aplicação para publicação fora do editor
npm run preview   # inspecionar a compilação localmente
npm run lint      # análise estática; não certificada nesta entrega
```

A publicação pelo Lovable executa sua própria compilação. O projeto é full-stack: servir apenas arquivos estáticos não atende à função administrativa de criação de contas.

## Arquitetura

- **TanStack Start + React 19 + TypeScript:** aplicação e função administrativa no servidor.
- **TanStack Router:** rotas baseadas em arquivos. `/` redireciona; `/auth` permite login; páginas internas ficam sob `_authenticated` com guarda executada no navegador.
- **TanStack Query:** cache, consultas e invalidação após alterações; a autorização não depende do cache.
- **Supabase Auth/PostgreSQL:** autenticação, dados relacionais, RLS, triggers e RPCs.
- **Tailwind CSS v4, shadcn/ui e lucide-react:** estilos, componentes e ícones. Tokens oficiais em `src/styles.css`.
- Leituras e escritas comuns usam o cliente público do Supabase no navegador. A criação de contas usa `addOfficeMember`, protegida por autenticação e checagem de administrador do escritório antes de importar o cliente privilegiado.

```text
Navegador → Supabase Auth → sessão
Navegador → Data API → GRANTs + RLS → PostgreSQL
Navegador → RPC → autorização + transição + histórico (transação)
Admin → função de servidor → valida papel sob RLS → cria conta no Auth
```

## Modelo de dados e SQL

Script documentado: [`supabase/phase2_schema.sql`](supabase/phase2_schema.sql). O usuário informou que já o aplicou com sucesso no projeto conectado. **Não execute novamente no banco existente**: o script cria objetos e não é uma atualização idempotente. Para restaurar outro ambiente autorizado, revise o SQL e faça backup antes de aplicá-lo em um banco vazio. Não existe atualmente uma sequência em `supabase/migrations/`; esta é uma limitação explícita do entregável.

| Tabela | Responsabilidade |
|---|---|
| `offices` | Escritórios (tenants) |
| `profiles` | Perfil vinculado ao usuário do Auth, sem papel de autorização |
| `office_members` | Vínculo ativo usuário/escritório e papel |
| `teams` / `team_members` | Times e participantes |
| `clients` | Clientes de um escritório |
| `demands` | Cliente, responsável, prioridade, estado e prazo da demanda |
| `tasks` | Tarefas, responsáveis, prazos e revisão |
| `demand_history` | Registro de eventos, ator, detalhes e data |

## Segurança e RLS

RLS é explícita e acompanhada de `GRANT`s por tabela/coluna. Ativar RLS automaticamente não concede acesso nem garante políticas corretas.

- Isolamento por escritório e associação ativa em `office_members`; papéis nunca são extraídos de metadados editáveis do usuário.
- Helpers `SECURITY DEFINER` com `search_path` fixo evitam recursão nas políticas. RPCs precisam validar usuário, papel e transição, pois podem contornar RLS internamente.
- Advogados veem demandas em que são responsáveis ou possuem tarefa atribuída, incluindo tarefas irmãs dessas demandas.
- Campos sensíveis de estado, revisão e atribuição não ficam disponíveis para atualização direta: o fluxo usa RPCs.
- Triggers validam referências do mesmo escritório e escrevem eventos. Usuários não recebem permissões de escrita no histórico.
- A chave privilegiada só é carregada no servidor após verificar a autorização do solicitante.

| Ação (no escritório autorizado) | Admin/sócio | Coordenador | Advogado |
|---|---|---|---|
| Consultar clientes, membros e times | Sim | Sim | Sim |
| Criar clientes/demandas/tarefas | Sim | Sim | Não |
| Gerenciar membros e times | Sim | Não | Não |
| Consultar demandas/tarefas | Todas | Todas | Somente autorizadas |
| Iniciar/enviar tarefa própria | Sim | Sim | Sim |
| Revisar/aprovar tarefa de outro | Sim | Sim | Não |
| Concluir/cancelar demanda | Sim | Sim | Não |
| Alterar histórico diretamente | Não | Não | Não |

RPCs documentadas: `assign_task`, `start_task`, `submit_task`, `review_task`, `set_demand_status`, `cancel_demand`. A revisão da própria tarefa é proibida; rejeição exige comentário; cancelamento exige motivo; tarefas obrigatórias devem estar concluídas para encerrar a demanda.

O login não oferece cadastro público. Isso **não confirma** que o cadastro está desabilitado nas configurações hospedadas do Supabase: esse ajuste deve ser verificado no serviço.

## Testes e evidências

- Testes automatizados disponíveis: correspondência de rota e classes/semântica do selo Pendente. Execute `npm run test`.
- O usuário relatou testes aprovados dos três papéis, fluxo operacional, isolamento entre escritórios e layout móvel.
- Esses relatos não substituem uma auditoria independente de RLS nem testes SQL reproduzíveis; não houve nova certificação de segurança nesta entrega.
- Com Supabase externo, a sessão do usuário não está disponível para verificação autenticada automática neste ambiente. Configurações hospedadas de login/cadastro permanecem sem verificação independente.
- Checklist de publicação e roteiro de vídeo: [`docs/entrega.md`](docs/entrega.md).

## Publicação e GitHub

1. Revise os arquivos de configuração públicos e privados antes da sincronização.
2. Conecte o repositório pelo menu GitHub do Lovable; a conexão não foi executada nesta entrega.
3. Confira a integração Supabase, variáveis do servidor e políticas do projeto existente.
4. No Lovable, abra **Publish** para publicar. Alterações posteriores na aplicação exigem **Update**; alterações aplicadas ao banco têm efeito imediato.
5. Ajuste a URL do site e URLs de redirecionamento no Supabase Auth para o endereço publicado, conforme os fluxos utilizados.
6. Teste login dos três papéis, criação de membro, persistência após recarregar e navegação direta para uma demanda no endereço publicado.

Ainda não há aplicação publicada. Hospedagem própria exige ambiente compatível com o alvo Cloudflare/Workers e configuração full-stack; consulte o [guia de self-hosting](https://docs.lovable.dev/tips-tricks/self-hosting).

## Entregáveis e limites

- Código, README, SQL consolidado, resumo técnico e checklist de demonstração estão no projeto.
- Resumo técnico: [`docs/decisoes-tecnicas.md`](docs/decisoes-tecnicas.md), base para editar/exportar um documento de até duas páginas.
- Pendentes: publicação real, confirmação da sincronização GitHub, vídeo gravado de até sete minutos, pacote de dados sintéticos repetível e evidências de testes diretos do banco.
- Contas de teste existentes foram criadas pelo usuário; compartilhar credenciais separadamente e de forma privada.
- Métricas são calculadas no navegador a partir das linhas retornadas. Sem paginação/agregação no banco, volumes acima do limite da Data API (normalmente 1.000 linhas) podem resultar em totais incompletos.
- Sem atualização em tempo real, recuperação de senha na interface ou seleção explícita entre vários escritórios; sem hardening/auditoria de produção.
