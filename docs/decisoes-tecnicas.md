# Resumo das decisões técnicas — ANA

**Autor:** Natanael Leite Silva  
**Finalidade:** base para o resumo técnico do desafio, limitado a duas páginas após diagramação.

## Objetivo e escopo

O ANA é um MVP funcional para coordenar demandas e tarefas em escritórios de advocacia. A prioridade foi demonstrar responsabilidades, prazos, revisão, aprovação e rastreabilidade com persistência real. Não se pretende substituir um sistema jurídico de produção. A implementação foi organizada em fases aprovadas pelo usuário, preservando funcionalidades já validadas e respeitando contas gratuitas e créditos limitados.

## Stack e organização

Foi mantida a base do Lovable: TanStack Start, React, TypeScript, TanStack Router e TanStack Query. Isso evitou migração de framework e reduziu retrabalho. O Supabase existente reúne Auth, PostgreSQL e RLS. Tailwind v4, componentes shadcn/ui e lucide-react sustentam a interface. O design oficial usa Sora/Inter, superfícies escuras e acentos ciano/roxo; tokens centralizados permitem ajustes consistentes, como o contraste do selo Pendente.

As rotas internas têm guarda no navegador porque a sessão é persistida no armazenamento do cliente. Essa guarda melhora a experiência, mas não é a barreira de segurança dos dados. Consultas, rótulos e traduções de erros ficam centralizados. O cache é invalidado após alterações para atualizar detalhe, lista e painel sem duplicar regras de negócio.

## Segurança e modelo relacional

Cada registro de negócio pertence a um escritório. `office_members` concentra associação ativa e papel, separado de `profiles`, evitando que alterações do perfil concedam privilégios. RLS restringe o acesso na Data API, inclusive em solicitações feitas fora da interface. Administradores e coordenadores acessam as demandas do seu escritório; advogados acessam demandas em que são responsáveis ou possuem tarefa.

As políticas usam helpers `SECURITY DEFINER` com caminho de pesquisa fixo para evitar recursão. RPCs validam autorização e transições antes de alterar estados e registrar histórico na mesma transação. Grants por coluna restringem atualizações diretas de campos sensíveis. Referências entre escritórios são validadas por triggers. O histórico não aceita escrita direta pelos usuários.

Rejeição exige comentário, cancelamento exige motivo, revisão da própria tarefa é proibida e demandas não podem ser concluídas com tarefas obrigatórias incompletas. A segurança depende da combinação de políticas, permissões, funções e constraints — não apenas de esconder botões ou habilitar RLS.

## Trade-offs

O navegador acessa o Supabase diretamente sob RLS, reduzindo uma camada intermediária e mantendo as regras críticas no banco. A única função administrativa no servidor cria contas, após validar o papel no escritório; a chave privilegiada não vai ao navegador. Esse desenho é econômico e suficiente para o desafio, mas exige cuidado adicional nas funções que executam com privilégios elevados.

As métricas são calculadas com dados consultados sob as mesmas permissões do usuário. É uma solução simples para dados de demonstração; sem paginação/agregações, o limite da Data API pode truncar totais em maior escala. Não foram adicionados serviços pagos nem assinaturas Realtime. O SQL consolidado documenta o banco, mas não substitui um histórico completo de migrações incrementais.

## Uso do Lovable e validação

O Lovable apoiou a geração e evolução das telas, integração, SQL e documentação. O trabalho foi dividido em fases para permitir revisão humana. O usuário aplicou o SQL no projeto existente e relatou sucesso nos testes dos três papéis, fluxo, isolamento entre escritórios e layout móvel. Os testes automatizados disponíveis cobrem roteamento básico e apresentação do selo; não equivalem a uma auditoria de segurança. A sessão do Supabase externo não está disponível para validação autenticada automática neste ambiente.

## Limitações e próximos passos

Ainda precisam ser confirmados a publicação, a sincronização GitHub, as configurações hospedadas de Auth e testes diretos reproduzíveis de RLS. O vídeo e o conjunto sintético repetível não foram produzidos; o roteiro está documentado. A interface não cobre toda edição/filtros do escopo inicial, recuperação de senha ou seleção de múltiplos escritórios. O fluxo administrativo cria contas com senha provisória e confirmação de e-mail; para produção, seria necessário revisar convite, troca de senha, acessibilidade completa, monitoramento, backups e recuperação de falhas. A verificação confirmou que `.env` continua rastreado, e a alteração do `.gitignore` foi bloqueada neste ambiente. A sincronização deve aguardar a inclusão das regras de exclusão e a remoção do rastreamento em uma cópia local autorizada, conforme o README; segredos privados já registrados exigem rotação e limpeza do histórico.
