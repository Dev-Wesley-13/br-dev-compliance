---
name: auditar-entrega
description: Revise mudanças de uma tarefa antes de concluir a entrega, inclusive após um lembrete do checkpoint. Registre evidências, pendências e fontes.
argument-hint: "<mudanças e escopo da tarefa>"
---

Entrada explícita: $ARGUMENTS
Modo configurado: ${user_config.modo}

Se o valor acima não for exatamente automatico, manual ou desligado, encerre com
“configuração não resolvida; auditoria não executada” e oriente configurar o modo
no gerenciador nativo. Não interprete uma variável literal como modo automático.

Se o modo for desligado, informe que a auditoria está desativada e encerre.
Antes de ler referências, verifique se o usuário restringiu todas as leituras a
arquivos específicos. Nesse caso, esclareça a permissão para as referências
adicionais. Com leitura autorizada, abra
`${CLAUDE_PLUGIN_ROOT}/referencias/preparacao.md`. Na mesma rodada, abra a
fonte local já identificada e autorizada, se houver, ou leia
`${CLAUDE_PLUGIN_ROOT}/referencias/fontes.md` quando for pesquisar na web.
Execute seu fluxo como principal. O contrato metodo.md é lido pelo auditor.
Delimite os arquivos alterados pela tarefa, inclusive novos, excluídos e mudanças
não commitadas. Use o contexto da tarefa e as ferramentas de leitura existentes.
Se precisar de Git, use somente comandos de consulta, desative external diff e
textconv, e mantenha as permissões normais do cliente. Não rode scripts do alvo.

O hash do hook é aviso de mudança, não diff nem prova de auditoria. Para histórico,
capture a baseline dos arquivos da tarefa antes das consultas, conforme
historico.md e as autorizações aplicáveis. Resumo legado não comprova cobertura.
Passe modo entrega na invocação Skill `br-dev-compliance:executar-auditoria`.
Ela usa auditor nativo com context fork e background false; aguarde o retorno.
Consulta, validação, resumo e decisão seguem preparacao.md. Uma correção
autorizada exige nova análise do trecho corrigido antes de encerrar.
