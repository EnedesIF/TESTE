# Auditoria de Persistência Integral — Metodologia TESTE

## Resultado executivo

O projeto não cria uma coluna SQL para cada pergunta. Em vez disso, mantém os dados estruturais da turma e da equipe em tabelas próprias e armazena todas as respostas pedagógicas no campo JSONB `public.equipes.dados`. Esse desenho é apropriado para uma atividade que pode evoluir, desde que o documento JSONB seja gravado e restaurado integralmente.

Foi executada uma auditoria de ida e volta usando a mesma RPC pública do site, `salvar_equipe`, seguida de `carregar_equipe`. O payload continha 80 chaves que representam todos os campos persistidos atualmente. O Supabase devolveu 80 chaves, sem campos ausentes e sem mudança de valores.

| Grupo de campos | Quantidade de chaves auditadas | Persistência |
|---|---:|---|
| Contexto do empreendimento | 13 | Confirmada |
| Persona detalhada | 5 | Confirmada |
| Perfil psicográfico e síntese gerada | 3 | Confirmada |
| Escolhas de perguntas com opções | 20 | Confirmada |
| Evidência, impacto e confiança de cada escolha | 20 | Confirmada |
| Perguntas abertas e seleções simples | 8 | Confirmada |
| Justificativas das cinco etapas | 5 | Confirmada |
| Estado, nota, eixos e conclusão | 6 | Confirmada |
| **Total** | **80** | **100% confirmado** |

## Fluxo comprovado

O teste gravou uma equipe temporária com contexto do produto, público, barreiras, soluções, hipótese, experimento, escala, evidências, escalas de impacto e confiança, justificativas, perfil psicográfico e resultado final. Em seguida, a RPC de carregamento retornou o mesmo documento. O painel docente também retornou a equipe com score e etapa registrados.

## Proteção adicional aplicada

Antes da revisão, campos de texto eram gravados no momento em que o usuário saía do campo ou no ciclo automático de 12 segundos. Foi acrescentado um salvamento com atraso curto de 650 ms para contexto, textos, justificativas, evidências e perfil psicográfico. Isso reduz a janela de perda se o aluno fechar a aba logo após digitar.

## Ponto de melhoria identificado

O código chama a RPC `listar_equipes_aluno` para avisar quando uma equipe já existe, mas essa função não aparece no `schema.sql` atual. O sistema captura esse erro e segue, portanto isso não impede criar, salvar ou recarregar uma equipe. Ainda assim, a função deve ser adicionada para recuperar a verificação de duplicidade de equipes antes da publicação final.
