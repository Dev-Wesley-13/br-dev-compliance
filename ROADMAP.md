# Plano de evolução do BR Dev Compliance

Queremos que um desenvolvedor consiga perguntar **“quais normas brasileiras podem se aplicar a esta mudança, por quê e o que ainda preciso verificar?”**. A direção de longo prazo é ampliar essa investigação a qualquer área do direito brasileiro que afete software. O recorte depende da atividade, do público, do território, da data e do que é possível observar no projeto.

A versão 1.0 oferece nove verificações de LGPD e quatro de licenciamento. Ela consulta fontes sob demanda e pode recorrer a leis relacionadas, como o Marco Civil da Internet e o ECA Digital. A suíte atual reúne 54 casos sintéticos com gabaritos provisórios. A revisão jurídica profissional e a execução integral dessa suíte com modelos seguem pendentes. [Versão publicada](https://github.com/Dev-Wesley-13/br-dev-compliance/releases/tag/v1.0.0) · [Plano de revisão profissional](docs/REVISAO-PROFISSIONAL.md)

## Marcos propostos

| Marco | O que muda para quem usa | Como acompanhar a entrega |
| --- | --- | --- |
| 1. Revisar a base atual | O relatório passa a indicar quais verificações e casos receberam revisão profissional, em qual versão e com quais ressalvas. | Publicar escopo e conclusão autorizados pelo profissional, correções por ID e resultados dos retestes. Identificar os itens ainda sem revisão. |
| 2. Descobrir temas além do catálogo | Ao revisar um checkout com renovação automática, por exemplo, a IA poderá sugerir investigar relações de consumo, explicar qual fato levou à sugestão e pedir o contexto que falta. | Entregar uma lista de normas candidatas separada dos achados validados. Cada candidata deve ter fonte oficial ou pendência de consulta, jurisdição, motivo da seleção e pergunta de aplicabilidade. Só atribuir cobertura a verificações efetivamente executadas. |
| 3. Publicar o primeiro módulo adicional | Propomos começar por consumo e comércio eletrônico. Checkout, assinatura, cancelamento e comunicação ao consumidor dão exemplos concretos para testar em planos e entregas. | Publicar verificações com IDs estáveis, fontes, condições, exceções e casos positivos, negativos e inconclusivos. Informar o estado da revisão profissional por regra. Acessibilidade digital é o próximo tema proposto. |
| 4. Expandir por setor e território | Um projeto poderá declarar setor e local de operação para investigar normas federais, estaduais e municipais pertinentes. Uma regra local só será sugerida para a jurisdição correspondente ou quando faltar esclarecer o território. | Manter matriz pública por tema, jurisdição, versão e data de conferência. Priorizar novos módulos por demanda documentada, disponibilidade de fonte oficial e capacidade de revisão. |

## Como evitar que a expansão encareça cada auditoria

O plano prevê selecionar módulos pela mudança solicitada e fazer perguntas curtas quando faltar contexto. Um ajuste de contraste em uma tela e uma alteração no prazo de retenção de logs exigem consultas diferentes. As fontes oficiais serão consultadas sob demanda. A atualização de uma norma deverá identificar quais verificações e registros precisam de revalidação.

Em cada módulo, queremos divulgar quantas sugestões foram pertinentes, quantos casos conhecidos passaram despercebidos, quantas citações sustentaram a afirmação e quantos tokens a análise consumiu. Os testes usarão exemplos sintéticos com os mesmos casos para comparação entre versões. O progresso será medido pelas verificações testadas, pelas jurisdições cobertas e pelo estado de revisão de cada regra.

## Financiamento contínuo

A proposta é manter uma campanha no Vakinha, sem teto de arrecadação definido pelo projeto. As contribuições apoiarão a manutenção dos três plugins, os testes de compatibilidade quando os clientes mudarem, o desenvolvimento de novos módulos e a contratação de revisão jurídica independente. O primeiro marco jurídico é obter um orçamento para revisar as 13 verificações e os 54 casos da versão 1.0. Se a revisão ocorrer por etapas, cada entrega identificará os casos efetivamente examinados.

A proposta de prestação de contas é publicar, a cada marco financiado, o total bruto, as taxas, o valor líquido, os gastos por categoria, o saldo disponível para o próximo marco e os links das entregas. O apoio é voluntário e o plugin continua disponível sob Apache-2.0.

Quem quiser colaborar com casos sintéticos, indicar um tema ou participar da revisão pode usar as [issues do projeto](https://github.com/Dev-Wesley-13/br-dev-compliance/issues). Para sugerir uma nova verificação, descreva uma decisão real de desenvolvimento, a jurisdição, uma fonte oficial e um exemplo em que a regra deixaria de se aplicar.
