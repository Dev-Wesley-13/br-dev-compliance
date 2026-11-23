---
name: auditar
description: Solicita auditoria ampla e explícita do repositório atual, mesmo se já houver avisos ou histórico.
argument-hint: "<diretório ou tema opcional>"
disable-model-invocation: true
---

Pedido: $ARGUMENTS
Modo configurado: ${user_config.modo}

Se o valor acima não for exatamente automatico, manual ou desligado, encerre com
“configuração não resolvida; auditoria não executada” e oriente configurar o modo
no gerenciador nativo. Não interprete uma variável literal como modo automático.

Se o modo for desligado, informe que a auditoria está desativada e encerre.
Antes de ler referências, verifique se o usuário restringiu todas as leituras a
arquivos específicos. Nesse caso, esclareça a permissão para as referências
adicionais. Com leitura autorizada, leia `${CLAUDE_PLUGIN_ROOT}/referencias/preparacao.md`
e execute o fluxo da skill
`${CLAUDE_PLUGIN_ROOT}/skills/auditar-entrega/SKILL.md` com o escopo explícito do
pedido, em vez de apenas as mudanças. Audite um repositório nesta versão.
Não deixe avisos anteriores suprimirem este pedido. Até 20 arquivos pertinentes
ou 64 KiB de evidência, o que ocorrer primeiro; declare o restante pendente.
Use a lista de verificações para escolher arquivos e informe como os selecionou.
Se o pedido abranger outros repositórios ou temas, registre-os como fora desta
versão; não expanda permissões nem apresente cobertura inexistente.
