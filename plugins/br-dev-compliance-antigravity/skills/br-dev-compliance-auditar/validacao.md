# Validação no cliente

Quando Node estiver disponível e a execução for permitida, execute o caminho
absoluto de `scripts/validate-result.mjs` dentro desta skill com argumento `-`.
Envie o JSON compacto por stdin com transporte literal: here-string de aspas
simples em PowerShell ou heredoc com delimitador entre aspas em Bash. Preserve
as permissões do host e confira a saída real `valid: true`.

Em PowerShell, configure `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)`
no escopo da chamada para enviar UTF-8 sem BOM e preservar os acentos. Restaure
a codificação anterior ao terminar. O leitor aceita um único BOM inicial;
o JSON do auditor e as regras de validação permanecem inalterados.

Sem Node, permissão de execução ou transporte seguro, registre validação
estrutural pendente; não instale dependências automaticamente, não invente a
saída do validador e não apresente o resultado como aprovado. Não crie arquivos
temporários no projeto auditado. Um JSON válido não comprova consulta à fonte,
autenticidade, vigência ou acerto jurídico.
