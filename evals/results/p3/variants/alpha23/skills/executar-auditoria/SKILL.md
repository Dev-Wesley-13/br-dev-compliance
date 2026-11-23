---
name: executar-auditoria
description: Execute a análise interna somente após receber do principal modo, resumo, duas listas de leitura, fontes e limites. Não é um checkpoint independente.
user-invocable: false
context: fork
agent: br-dev-compliance:auditor
background: false
---

Entrada explícita do principal: $ARGUMENTS
Modo configurado: ${user_config.modo}

Se o modo não for automatico ou manual, retorne auditoria não executada.
Execute diretamente a análise solicitada como auditor nativo. Não delegue.
Confira objetivo, modo plano/entrega, arquivos-alvo e referências internas
autorizadas, fontes e prepared_at UTC real fornecido pelo principal. Sem
prepared_at, devolva pendência de integração; não estime o relógio.
Se faltar contexto ou existir restrição incompatível com as leituras
necessárias, devolva a pendência antes de abrir outro arquivo.
Siga o contrato do agente e de metodo.md quando sua leitura estiver autorizada.
Fontes não fornecidas ou não consultadas ficam não verificadas. Não execute
comandos, não escreva histórico nem corrija o projeto. Retorne achados, escopo e
pendências ao principal como JSON estrito do contrato 1.0. Se a leitura de
resultado.schema.json estiver autorizada, leia-o para conferir os campos.
O principal apresenta o resumo e trata a decisão; não coloque prosa fora do JSON.
