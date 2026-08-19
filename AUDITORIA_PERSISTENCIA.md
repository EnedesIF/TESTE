# Evidência de persistência — projeto Teste

No Table Editor do projeto Supabase `TESTE`, a tabela `public.equipes` exibiu quatro registros. O primeiro registro pertence à turma temporária `AUDIT125532`, equipe `equipe_auditoria`, com nome `Equipe Auditoria Persistência`, etapa `4`, campo `completo` igual a `TRUE`, score `87` e documento JSONB com os dados de auditoria.

O registro foi criado pela interface RPC usada pelo projeto e relido pela RPC `carregar_equipe`. Esta é evidência visual de que os dados da equipe são persistidos no Supabase. A turma temporária permanece disponível para demonstração controlada até que seja removida.

## Validação visual da versão publicada

O deployment `6adc783` foi concluído no Vercel. A equipe de auditoria retornou ao dossiê pela interface publicada; o painel de contexto abre primeiro e o dashboard visual aparece na segunda página, antes das cinco etapas da metodologia.

A navegação até o painel exige nome do empreendimento e conceito central preenchidos. Na equipe de auditoria, esses dados fictícios foram inseridos para validar o fluxo visual sem usar informações reais.
