# BR Dev Compliance — protótipo

Revisão técnica assistida de LGPD e licenças para desenvolvedores brasileiros.
Este pacote contém um agente auditor de leitura, quatro skills públicas,
uma skill interna de delegação síncrona e checkpoints
experimentais para Windows com PowerShell e Git. As fontes são consultadas sob
demanda pelo cliente de IA. Sem acesso às fontes, o resultado fica parcial.

Use `/br-dev-compliance:auditar-plano`, `/br-dev-compliance:auditar-entrega`,
`/br-dev-compliance:auditar` ou `/br-dev-compliance:cobertura`. A configuração
permite modo automático, manual ou desligado. O modo precisa estar configurado
no gerenciador nativo antes de auditar. Histórico local fica na pasta
`.br-dev-compliance/` do repositório analisado; revise antes de versionar.

Não é aconselhamento jurídico ou certificação. O protótipo passou nos testes
locais de scripts; delegação e acionamento com modelo ainda estão em avaliação.
O usuário decide continuar, corrigir ou parar. O plugin não bloqueia ferramentas.
