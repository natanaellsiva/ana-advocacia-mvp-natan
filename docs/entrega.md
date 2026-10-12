# Checklist de entrega e demonstração

## Antes da sincronização/publicação

- [ ] Revisar `.env` versionado: permitir apenas configuração pública; nunca publicar segredos ou credenciais de teste.
- [ ] Confirmar integração com o Supabase existente e variáveis exclusivas do servidor.
- [ ] Confirmar configurações hospedadas do Auth, incluindo cadastro e URLs de redirecionamento.
- [ ] Executar `npm run test` e conferir compilação no diálogo de publicação.
- [ ] Conectar GitHub e verificar que README, SQL e documentos aparecem no repositório.
- [ ] Publicar pelo Lovable e testar a URL pública. Esta preparação não publica automaticamente.

## Roteiro de vídeo — duração alvo: 6min30s

Usar apenas dados fictícios. Preparar três contas do escritório A (admin, coordenador, advogado) e uma conta do escritório B. Compartilhar as credenciais por canal privado; não gravar senhas nem chaves. O roteiro não é um seed automatizado: repetir com uma nova demanda nomeada por rodada.

| Tempo | Demonstração |
|---|---|
| 0:00–0:40 | Apresentar objetivo, painel e papéis |
| 0:40–1:30 | Sócio cria demanda de contrato para cliente fictício e escolhe responsável |
| 1:30–2:20 | Coordenador abre demanda e cria duas tarefas obrigatórias para o advogado, com prazos |
| 2:20–3:10 | Advogado inicia tarefas e envia as duas para revisão |
| 3:10–3:50 | Coordenador rejeita uma tarefa com comentário; outra permanece aguardando revisão |
| 3:50–4:30 | Advogado corrige e reenvia a tarefa rejeitada |
| 4:30–5:10 | Coordenador aprova ambas e conclui demanda |
| 5:10–5:50 | Mostrar histórico, painel atualizado e persistência após recarregar |
| 5:50–6:30 | Explicar RLS, bloqueios de autorização e limitações |

A demanda recebe responsável na criação; o roteiro não deve sugerir uma tela de reatribuição que não existe.

## Evidências de teste a registrar

| Caso | Resultado esperado | Estado desta entrega |
|---|---|---|
| Abrir `/painel` sem sessão | Redirecionar a `/auth` | Verificação pública possível; não valida login bem-sucedido |
| Advogado A consulta demanda B diretamente | Nenhuma linha visível | Relatado pelo usuário; nova evidência direta pendente |
| Advogado chama `review_task` | Operação negada | Nova evidência direta pendente |
| Concluir com tarefa obrigatória pendente | Operação negada | Nova evidência direta pendente |
| Rejeitar, corrigir, reenviar, aprovar | Estados e histórico coerentes | Fluxo relatado pelo usuário; gravação pendente |
| Recarregar/reabrir | Dados persistidos | Registrar na demonstração |
| Escrever/apagar histórico diretamente | Operação negada | Nova evidência direta pendente |
| Painel versus dados persistidos | Contagens iguais no escopo visível | Registrar antes/depois da demonstração |

Para testes diretos, usar o JWT de cada conta e a chave pública em cliente local seguro; nunca usar `service_role` para simular usuários porque ela ignora RLS. Tokens e senhas não devem constar de prints, logs ou do repositório. Registrar cenário, papel, data, resultado e evidência sanitizada; não apenas “segurança perfeita”.

## Entregáveis ainda externos

- URL efetivamente publicada e repositório GitHub confirmado.
- Vídeo gravado com até sete minutos.
- Exportação/diagramação final do resumo técnico em até duas páginas.
- Dados sintéticos repetíveis e credenciais entregues em canal privado.
- Evidências reproduzíveis das políticas e funções do banco; SQL em sequência de migrações ainda não disponível.
