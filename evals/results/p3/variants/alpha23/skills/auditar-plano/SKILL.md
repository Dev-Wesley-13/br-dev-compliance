---
name: auditar-plano
description: Revise o plano de uma tarefa antes de executar quando envolver dados pessoais, terceiros ou dependências. Aceita planos no chat e no modo plano.
argument-hint: "<resumo do plano e escopo>"
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
Resuma o plano visível no chat se os argumentos estiverem vazios. Inclua
objetivo, dados tratados, terceiros, dependências e decisões já conhecidas.
Peça apenas o contexto que mudar a análise; não exija um arquivo de plano.
Para persistência, o escopo da baseline inclui `plano` e seu texto, além de
fontes locais autorizadas quando examinadas. Passe modo plano na invocação Skill
`br-dev-compliance:executar-auditoria`. Ela usa o auditor nativo com context fork
e background false. Aguarde o retorno e apresente antes das ações dependentes.
Acionamento implícito é melhor esforço, não garantia. Consulta, validação,
resumo e fechamento seguem preparacao.md, inclusive as restrições do usuário.
