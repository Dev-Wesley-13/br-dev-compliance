# BR Dev Compliance — Antigravity 1.0.0

**Versão 1.0.0 em testes em projetos de produção. A revisão jurídica independente por profissional habilitado está pendente.** As avaliações documentadas usam casos sintéticos. O plugin oferece triagem técnica de LGPD e licenças. A decisão sobre cada achado cabe ao usuário.

Para participar como revisor jurídico, abra uma issue **Revisão jurídica independente** no repositório do projeto.

![BR Dev Compliance](assets/icon.png)

Plugin nativo em preparação para o Antigravity Desktop e seu terminal `agy`, com
modelo Gemini selecionado pelo usuário. Contém uma skill de auditoria explícita
e um agente auditor de leitura. Usa o método e o contrato do BR Dev Compliance,
com cobertura inicial de LGPD e licenças. Revisão jurídica independente pendente.

Na pasta deste pacote, confira e instale pelo gerenciador do próprio Antigravity:

```text
agy plugin validate --strict .
agy plugin install .
agy plugin list
agy agents
```

Abra uma nova sessão no Desktop ou terminal e invoque
`/br-dev-compliance-auditar`. Informe plano/entrega, objetivo, raiz e arquivos
autorizados. A skill prepara o contexto, delega a um único auditor nativo e
aguarda seu retorno antes de validar e apresentar os achados. Uma configuração
do host pode escolher outro modelo para ferramentas; registre os modelos reais.

Esta integração começa em modo manual e apresenta o resultado no chat, sem
gravar histórico ou oferecer checkpoints automáticos. O usuário decide como
agir. A pesquisa depende das permissões e ferramentas do cliente; falhas ficam
como pendências. O plugin não instala servidor nem baixa uma base de leis.

O validador estrutural usa Node quando já disponível. Sem Node ou permissão de
execução, a validação permanece pendente e o resultado não é apresentado como
validado. Não é necessário instalar um programa de auditoria separado.

O mantenedor devolveu cinco casos funcionais deste plugin no Desktop e
verificações de integridade do kit. A captura da interface associa a skill ao
plugin. Os relatos não incluem exportação independente dos rastros nem
inventário de toda a raiz. O mantenedor confirmou em sessão remota a leitura de JSON com BOM no Desktop 2.34 e a execução do auditor e do validador no CLI 1.5.15 no kit R4. As evidências identificam os pacotes testados.
Gemini CLI independente é outro cliente, com adaptador experimental separado.

Licença [Apache-2.0](LICENSE), [avisos](NOTICE) e
[política de identidade](TRADEMARKS.md). Permite uso em projetos pessoais,
comerciais e privados, modificação e redistribuição mediante suas condições.
