# Validação do resultado

Use `node`, disponível no ambiente do Gemini CLI, para executar o caminho
absoluto de `scripts/validate-result.mjs` dentro da skill, com argumento `-`.
Envie o JSON por stdin e confira `valid: true`. Use JSON compacto em uma linha,
com transporte literal que não interprete o conteúdo. Em PowerShell 7,
use um here-string de aspas simples. Em Bash, use um heredoc com delimitador
entre aspas. Preserve as permissões do host e a política de execução.

Se a sessão não puder executar o validador ou transportar o JSON com segurança,
informe que a validação ficou pendente. Em caso de JSON inválido, faça no máximo
uma correção e valide novamente. Validade estrutural não comprova consulta à
fonte nem acerto jurídico. Não grave arquivos temporários no projeto auditado.
