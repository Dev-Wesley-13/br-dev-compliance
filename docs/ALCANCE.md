# O que posso auditar com a versão 1.0?

Você pode apresentar uma ideia antes de escrever código, pedir revisão de uma entrega ou delimitar uma auditoria de um repositório existente. A unidade de cobertura é uma **pergunta sobre o projeto**. Por exemplo, “ao excluir uma conta, quais registros esta rotina elimina?” é uma pergunta que a versão 1.0 investiga. O resultado identifica os arquivos ou premissas examinados, a evidência, as fontes efetivamente consultadas e as lacunas.

## Catálogo disponível

| Verificação | Pergunta que o desenvolvedor pode fazer | Referência a investigar |
| --- | --- | --- |
| LGPD-01 · Logs | Preciso gravar CPF e e-mail para contar erros? | LGPD, arts. 5º, 6º, 37, 46 e 49 |
| LGPD-02 · Terceiros | Quais identificadores saem pelo SDK e para qual destinatário ou país? | LGPD, arts. 7º, 11 e 33. Conforme o destino, Resoluções ANPD 19/2024 e 32/2026 |
| LGPD-03 · Dados sensíveis | O campo de saúde está ligado a uma pessoa? Qual hipótese de tratamento foi considerada? | LGPD, arts. 5º, II, e 11 |
| LGPD-04 · Menores | Quem usa este produto, inclusive quando ele é de acesso provável por menores? | LGPD, art. 14, Enunciado ANPD 1/2023 e ECA Digital, art. 1º, para investigar o público |
| LGPD-05 · Rastreamento | O analytics dispara antes da escolha do usuário? Qual a finalidade de cada cookie? | LGPD, arts. 7º a 10, e guia orientativo da ANPD sobre cookies |
| LGPD-06 · Direitos | Como um titular solicita acesso ou correção, inclusive por um canal fora do aplicativo? | LGPD, arts. 18 e 19 |
| LGPD-07 · Retenção | Uma rotina de exclusão considera a categoria do registro e eventual guarda obrigatória? | LGPD, arts. 15 e 16, e Marco Civil da Internet, art. 15, para os registros abrangidos |
| LGPD-08 · Segurança | Quem consegue ler as senhas ou outros dados expostos por esta configuração? | LGPD, arts. 6º, VII, 46, 47 e 49 |
| LGPD-09 · Transparência | A política publicada descreve o compartilhamento que ocorre nesta versão do código? | LGPD, arts. 6º, VI, e 9º |
| LIC-01 · Permissão | Que documento autoriza reutilizar este código? | Lei do Software, art. 2º, Lei de Direitos Autorais, art. 29, e permissão aplicável |
| LIC-02 · Copyleft | Modificar, distribuir ou oferecer este componente em rede aciona qual condição? | Texto e versão da licença, como GPL, AGPL ou LGPL, e modo de uso |
| LIC-03 · Identificação | O manifesto e o arquivo de licença descrevem o mesmo artefato e versão? | Metadados, identificador SPDX e texto efetivo do componente |
| LIC-04 · Avisos | O pacote que será distribuído conserva as atribuições exigidas? | Licença de origem, condições MIT ou Apache-2.0, incluindo NOTICE quando aplicável |

Os quatro itens LIC examinam permissões e condições das licenças de software. A tabela lista referências candidatas. Cada auditoria informa se conseguiu consultá-las e se sustentam a conclusão no caso concreto. O ECA Digital e o Marco Civil entram nas perguntas indicadas. A revisão profissional dos gabaritos está pendente. [Catálogo técnico](../plugins/br-dev-compliance/referencias/verificacoes.md) · [Fontes](../plugins/br-dev-compliance/referencias/fontes.md) · [Revisão profissional](REVISAO-PROFISSIONAL.md)

**Cobertura territorial da 1.0.** Há verificações com fundamentos federais e verificação de licenças de software. O catálogo atual tem zero módulos próprios de legislação estadual, distrital ou municipal. Trânsito, comércio eletrônico em geral e comercialização de tabaco estão fora dos 13 IDs implementados. O resultado “sem indício” em uma auditoria de LGPD de uma loja vale apenas para os pontos examinados. A viabilidade da atividade comercial continua em aberto.

**Continuidade disponível.** Claude Code e Codex podem, com autorização, registrar um achado e a escolha de continuar, corrigir ou parar e consultar esse histórico em outra sessão. No Antigravity 1.0 a auditoria é explícita e o resultado fica na conversa. A retomada automática de **requisitos de produto** aceitos, como uma configuração municipal de rodízio, é uma entrega futura. [Histórico da 1.0](../plugins/br-dev-compliance/referencias/historico.md)

## Dois casos de uso para a evolução

Os cenários a seguir especificam resultados esperados para módulos futuros. As fontes foram consultadas na preparação dos exemplos em 23/11/2026. Uma auditoria deverá voltar à fonte e conferir a regra aplicável na data da operação.

### Quero criar uma loja que vende cigarros pela internet

**Hoje.** A 1.0 pode examinar dados do comprador, analytics, retenção e licenças das dependências. A conclusão sobre vender o produto por esse canal exige outro módulo.

**No planejamento proposto.** Antes de especificar o checkout, o plugin pergunta qual é o produto, quem o vende, por qual canal e para qual mercado. Para cigarros derivados de tabaco vendidos pela internet no Brasil, o art. 9º, II, da RDC Anvisa 840/2023 proíbe essa comercialização em território nacional. O alerta deve reproduzir a premissa do plano, apontar a fonte e recomendar retirar a venda desse produto do canal online. Acrescentar verificação de idade deixa a restrição de canal sem solução. Para os demais produtos abrangidos pelo projeto, o módulo investigaria separadamente as obrigações de consumo e contratação eletrônica. [RDC 840/2023](https://saude.es.gov.br/Media/Legisla%C3%A7%C3%A3o/Outros/Resolu%C3%A7%C3%A3o%20da%20Diretoria%20Colegiada%20-%20RDC%20n%C2%BA%20840%2C%20de%2015_12_2023-1.pdf) · [Decreto federal 7.962/2013](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm)

**Em uma loja já implementada.** O módulo procuraria evidência de que o produto pode ser comprado, por exemplo, um item sintético de tabaco aceito tanto no catálogo público quanto no pedido via API. Uma menção a “cigarro” em um artigo informativo não basta para concluir que há venda. Categoria desconhecida ou ausência de acesso ao fluxo de pedidos gera uma pergunta. O usuário recebe uma recomendação e decide como tratar o achado.

### Quero agendar aulas com veículos em Belo Horizonte e em São Paulo

**Hoje.** A 1.0 pode investigar a exposição de dados do aluno, do instrutor ou do proprietário do veículo. A apuração de licenciamento, regras de circulação e integração com o Detran exige um módulo de trânsito.

**No planejamento proposto.** O plugin pergunta se a tarefa é só cadastrar o veículo ou também decidir se uma aula pode ocorrer em determinado horário e trajeto. Para um veículo registrado em Minas Gerais, a consulta estadual de licenciamento considera IPVA, taxa, multas e impedimentos aplicáveis. Marcar “IPVA pago” é informação insuficiente para afirmar regularidade. Na cidade de São Paulo, o rodízio municipal depende, entre outros fatores, da área de circulação, dia, horário, final da placa e exceções. Vale investigar a categoria e a situação do veículo de aprendizagem antes de avaliar a aula. Um veículo registrado em outra UF também pode circular na área alcançada. Uma integração de produção com órgão de trânsito depende de serviço oficial disponível e de autorização de acesso. [Serviço de licenciamento de MG](https://www.mg.gov.br/servico/obter-licenciamento-anual-do-veiculo) · [Decreto municipal de São Paulo 58.584/2018](https://legislacao.prefeitura.sp.gov.br/decreto-58584-de-20-de-dezembro-de-2018/consolidado)

**Recomendação que o usuário veria.** “A agenda usa a situação do licenciamento para liberar qualquer horário. Para aulas na capital paulista, você aceita incluir uma regra de circulação por município, área e horário, com exceções e vigência? Quando faltar o trajeto ou a fonte estiver indisponível, a agenda mostrará ‘verificação pendente’.” É uma proposta de implementação justificada pela função da agenda. Em um cadastro que só inventaria veículos, a falta desse recurso, isoladamente, não demonstra infração.

**Na entrega e na tarefa seguinte.** Se o usuário aceitar, a proposta é vincular a decisão à tarefa, registrar o critério de aceite na documentação autorizada e recuperá-lo antes de novas mudanças na agenda. Um teste de entrega deverá distinguir uma aula dentro e outra fora da área ou horário restrito, além do caso de informação desconhecida. Se o usuário recusar, o registro conserva a recusa e o risco observado. A decisão pode ser revista se mudar a tarefa, a jurisdição ou a norma. [Etapas e critérios de aceite](../ROADMAP.md)
