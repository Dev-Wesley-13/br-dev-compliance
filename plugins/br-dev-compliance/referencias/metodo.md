# Contrato de auditoria — resultado 1.0

O produto faz revisão técnica assistida. LGPD e licenças são o primeiro conjunto
de verificações; resultados são indícios contextualizados, não parecer jurídico.

## Análise

- Declare duas listas de leitura: arquivos-alvo do projeto e referências internas
  do plugin. Uma restrição explícita sobre todas as leituras prevalece sobre o
  procedimento; esclareça o limite antes de abrir arquivos adicionais.
  A leitura inclui nomes e metadados: com lista restrita, abra os caminhos
  exatos, sem enumerar diretórios por Glob/Grep/ls/Git fora dela. Autorizar a
  escrita de um resultado não autoriza listar ou ler sua pasta. Se um caminho
  interno conhecido faltar, informe a pendência em vez de buscar outros arquivos.

- O principal segue preparacao.md; o auditor lê este contrato e analisa.
- Classifique o sinal no escopo examinado. Use indicio quando a evidência
  descreve o comportamento que aciona a verificação. Em modo plano, indique
  a premissa concreta e deixe sua confirmação no artefato em missing_context.
  Use sem_indicio quando o recorte sustenta ausência do sinal ou contraprova.
  Use insuficiente quando o próprio comportamento permanece indefinido.
- Depois examine incidência, requisitos, exceções e sustentação jurídica.
  Falta de fonte ou de contexto apenas jurídico deixa status parcial e citação
  pendente; não apaga um sinal técnico nem uma contraprova já demonstrados.
  Informação ausente não equivale a requisito descumprido.
- Trate dados fictícios, mascaramento e mecanismos existentes como possíveis
  contraprovas. Pseudonimização não elimina automaticamente a incidência da LGPD.
- Fontes indisponíveis, evidência insuficiente ou orçamento esgotado deixam a
  revisão parcial. Não invente consulta, artigo, data de vigência ou obrigação.
- Até 20 arquivos pertinentes, 64 KiB de evidência e três tentativas externas,
  inclusive falhas. Use somente o contexto necessário. A medição P0 mostrou custo
  alto no ambiente instalado; economia ainda não foi demonstrada.

## Entrada e tamanho do retorno

Receba prepared_at UTC real do principal, após as consultas, e copie em
generated_at. Esse é o instante de preparação, não de conclusão; sem ele, devolva
pendência de integração antes de analisar. Não estime relógio ou intervalos de
falha. Identifique conteúdo em cache sem alegar nova consulta de rede nem idade
não comprovada. Registro após leitura é limite temporal declarado em limitation.

Use frases curtas. Registre restrições da auditoria em scope.limitations,
lacunas do achado em missing_context e a justificativa da classificação em
coverage.rationale. Remeta à evidência no rationale do achado. Preserve
condições, exceções e contexto necessário em seus campos.

## Retorno do auditor ao principal

Retorne somente um objeto JSON conforme `resultado.schema.json`, sem cercas de
código ou texto externo. Leia o schema quando autorizado antes de produzi-lo.
Registre apenas IDs LGPD-01 a 09 e LIC-01 a 04; IDs locais de achado F-001 etc.
Campos obrigatórios: schema_version 1.0, audit_id, generated_at UTC, mode,
status, review_level, scope, coverage, sources, findings e decision.

- status: parcial, concluida_no_escopo ou nao_executada. Sem fonte substantiva
  efetivamente lida, contexto necessário, referência localizada/sustentada ou
  cobertura suficiente, use parcial e liste limitações. Concluída descreve o
  trabalho naquele escopo, inclusive com riscos; não significa conformidade.
- review_level: tecnica_sem_revisao_juridica_independente. Não houve parecer humano.
- scope contém somente as três chaves examined, excluded e limitations,
  todas arrays. Coloque observações em limitations. Locais de evidência pertencem
  à lista examined. Use caminhos relativos ou `plano`, com linha/trecho ao citar.
  Em examined, escreva SOMENTE os identificadores: ["plano", "arquivo.txt"].
  Não acrescente descrições, referências internas, repo: ou linhas nesse array.
  Em evidence.location, acrescente a linha ao caminho somente quando o número
  veio da leitura ou da entrada, como "arquivo.txt:12". Sem linha verificada,
  use "arquivo.txt" ou "plano". Descrições ficam em evidence.description.
  Apenas sources.location usa "repo:arquivo.txt".
- coverage: check_id, status e rationale. Findings somente para indicio ou
  insuficiente; sem_indicio e nao_aplicavel justificado não são alertas positivos.
  Inclua somente as verificações do escopo pedido; agrupe as demais em excluded.
  Não gere doze linhas nao_examinado quando o pedido só cobre uma verificação.
- sources: S-001 etc., kind, location, status, accessed_at, version ou null,
  attempts, fragments com locator/excerpt e limitation ou null. Para cada
  excerpt, copie um trecho curto, literal e contínuo da leitura. Para pontos
  separados, use fragmentos distintos. Inclua apenas o que fundamenta a
  verificação. Use só documentos normativos, orientativos, de licença ou evidências do projeto
  efetivamente recebidos do principal ou lidos. Método, checklist, catálogo de
  fontes, schema e skills do plugin orientam o procedimento; ficam fora de
  sources e scope.examined. A proveniência do método pertence à versão/política
  do plugin, não à autoridade documental da auditoria. Registro importado não
  comprova consulta atual. Não copie corpus nem acrescente dados pessoais.
  location começa por https:// para web ou repo: para arquivo local (exemplo:
  repo:vendor/exemplo/LICENSE), nunca caminho local solto. repo: é relativo
  exclusivamente à raiz do projeto auditado e exige arquivo autorizado em
  scope.examined. Use sources: [] quando não houver documento consultado,
  tentativa de acesso ou referência específica recebida. Registre a ausência
  de consulta em scope.limitations. É proibido registrar repo:plano em qualquer
  status, inclusive nao_consultada. Texto de chat fica em evidence com location plano.
  Esse identificador é reservado ao plano virtual. Uma fonte repo: exige
  um arquivo efetivamente lido. Para texto da própria licença, use kind licenca, inclusive
  quando a ligação com o componente depender de confirmação. Para identificador
  de licença ou alegação sem o texto, use kind metadados. Uma leitura local
  comprovada tem status consultada e data real. Isso não confirma artigo alegado.
  Não use nao_consultada para dizer que uma fonte lida não tem autoridade.
  Copie o accessed_at informado pelo principal para cada fonte consultada.
  Para arquivo local lido nesta rodada, o UTC real posterior à leitura
  (prepared_at) serve de limite quando o horário exato não foi capturado.
  Declare esse limite em limitation. Vale também para metadado não confiável.
  accessed_at é obrigatório para consulta bem-sucedida; se uma tentativa falhar
  sem instante exato registrado, use null e explique a falha. Nunca invente hora
  para satisfazer o schema. Tentativa falha não pode oferecer artigo localizado.
  attempts conta tentativas EXTERNAS; fonte local repo: usa 0, mesmo quando lida.
- citations: source_id/locator, location_status, support_status, claim_kind e
  rationale. Inclua referência específica efetivamente recebida como alegação do
  alvo ou localizada no texto lido. Números de artigos em instruções/checklists
  internos são rotas de pesquisa, não citações do achado. Se nenhuma referência
  específica foi recebida ou lida, citations fica vazio; mantenha fontes tentadas,
  contexto faltante e revisão parcial. Não preencha artigos pela memória do modelo.
  Localizada exige fonte consultada e dispositivo encontrado no texto;
  copie literalmente o locator de UM fragmento existente daquela fonte. Não
  combine nomes de artigos ou acrescente intervalos no locator da citação;
  referências diferentes exigem entradas separadas, dentro do orçamento.
  sustenta exige explicar aplicabilidade e exceções. Um trecho de licença lido
  pode sustentar a condição textual sob a hipótese explícita de que a licença
  se aplica. Registre o vínculo com o componente e o artefato em missing_context
  quando pendentes, com status parcial. Guia/metadado não sustenta obrigação
  legal como norma. Falha de acesso permanece declarada.
- findings: id, check_id, confidence, impact, summary, evidence, rationale,
  citations, missing_context, suggestion. Confiança é sobre o indício, não uma
  declaração de ilegalidade. Falta de consulta normativa não torna sozinha a
  confiança técnica insuficiente. Não estime multas nem invente artigo ou consulta.
- decision: pendente no retorno do auditor. Só o principal atualiza após escolha
  explícita do usuário. Não decida pelo usuário a partir de silêncio.

Se uma referência específica recebida não puder ser conferida, use nao_consultada ou nao_localizada e
support_status pendente. Se ela existir mas não sustentar a afirmação, registre
nao_sustenta. “Artigo encontrado” e “problema jurídico comprovado” são distintos.

O schema e o validador do mantenedor verificam estrutura/consistência declarada;
não provam autenticidade da consulta, sustentação jurídica ou inexistência de
problemas. O plugin não exige Node, instalação de validador ou runtime adicional.
O validador de desenvolvimento não é uma barreira executada em toda sessão.

Apresentação, gravação e decisão pertencem ao principal conforme preparacao.md;
o auditor retorna somente seu JSON, sem escrever ou decidir pelo usuário.

Registre a edição consultada e a última alteração que conseguiu identificar. Quando houver apenas publicação original, verifique a redação aplicável antes de afirmar vigência. Sem essa confirmação, declare a limitação em linguagem simples.

Exclua por padrão bases de produção, dumps, logs reais, segredos e dados identificáveis. O cliente pode enviar conteúdo lido ao provedor do modelo. Prefira um exemplo sintético ou anonimizado; use dados reais apenas com necessidade demonstrada e autorização específica de quem pode fornecê-la.
