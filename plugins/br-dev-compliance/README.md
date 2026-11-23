# BR Dev Compliance — Claude Code 1.0.0

**Versão 1.0.0 em testes em projetos de produção. A revisão jurídica independente por profissional habilitado está pendente.** As avaliações documentadas usam casos sintéticos. O plugin oferece triagem técnica de LGPD e licenças. A decisão sobre cada achado cabe ao usuário.

Para participar como revisor jurídico, abra uma issue **Revisão jurídica independente** no repositório do projeto.

![BR Dev Compliance](assets/icon.png)

Revisão técnica assistida de LGPD e licenças para desenvolvedores brasileiros.
Este pacote contém um agente auditor de leitura, quatro skills públicas,
uma skill interna de delegação síncrona e checkpoints
experimentais para Windows com PowerShell e Git. As fontes são consultadas sob
demanda pelo cliente de IA. Sem acesso às fontes, o resultado fica parcial.

A partir da raiz do marketplace local deste pacote, instale pelo Claude Code:

```text
/plugin install br-dev-compliance --marketplace ./ --config modo=manual
```

Abra uma nova sessão após instalar. Use `/br-dev-compliance:auditar-plano`, `/br-dev-compliance:auditar-entrega`,
`/br-dev-compliance:auditar` ou `/br-dev-compliance:cobertura`. A configuração
permite modo automático, manual ou desligado. O modo precisa estar configurado
no gerenciador nativo antes de auditar. Histórico local fica na pasta
`.br-dev-compliance/` do repositório analisado; revise antes de versionar.

No Desktop Windows, a candidata 1.0.0 confirmou auditoria delimitada, delegação,
validação do retorno, histórico e retomada em sessão nova. Um caso de planejamento
implícito e um de entrega via Stop passaram; o acionamento é melhor esforço.
No CLI 2.1.325, a 1.0.0 confirmou auditoria explícita, histórico e retomada em
sessão nova, planejamento implícito e entrega via Stop. O transporte de histórico
foi conferido com arquivos de dados autorizados; a tentativa inicial por
here-document foi recusada pelo filtro do host e preservada como bloqueio.
O CLI confirmou o lembrete na saída formal do modo Plano na rodada V05.
As provas de fonte oficial e suas versões estão registradas no relatório da release.
Revisão jurídica independente pendente. O usuário decide continuar, corrigir ou parar.
O plugin não bloqueia ferramentas nem certifica conformidade jurídica.

Licença [Apache-2.0](LICENSE), com [avisos](NOTICE) e
[política de identidade](TRADEMARKS.md). Permite uso em projetos pessoais,
comerciais e privados, modificação e redistribuição mediante suas condições.
