# Verificações iniciais — gabarito jurídico ainda não revisado

As referências são rotas de investigação. Confirme o texto na fonte antes de
citá-lo como verificado. Esta lista não converte sinais em infrações automáticas.

| ID | Investigar | Contexto para enquadramento / referência inicial |
|---|---|---|
| LGPD-01 | Dados pessoais em logs | Necessidade, acesso, mascaramento, retenção; arts. 6º III e 46 |
| LGPD-02 | Identificadores enviados a terceiros | Finalidade, base legal, papéis; localização e transferência internacional antes de art. 33; arts. 7º/11 conforme dado |
| LGPD-03 | Dados sensíveis | Categorias do art. 5º II e hipóteses do art. 11; CPF isolado não é automaticamente sensível |
| LGPD-04 | Crianças e adolescentes | Público efetivo, melhor interesse, art. 14 e orientação atual da ANPD; aniversário isolado não prova infração |
| LGPD-05 | Rastreamento | Tipo/finalidade/base legal; consentimento só quando aplicável, não obrigação universal para todo cookie; arts. 7º/8º |
| LGPD-06 | Direitos do titular | Canais e procedimentos também podem existir fora do código; art. 18 e condições/exceções |
| LGPD-07 | Retenção | Finalidade, término e hipóteses de conservação; arts. 15/16; exclusão não é sempre obrigatória |
| LGPD-08 | Proteção dos dados | Medidas adequadas ao risco; art. 46 não exige a mesma criptografia para qualquer campo |
| LGPD-09 | Transparência incoerente | Confrontar política, finalidade e uso demonstrado; art. 9º |
| LIC-01 | Ausência de licença do projeto | Permissões de reutilização pouco claras; não declarar a publicação ilegal |
| LIC-02 | Obrigações copyleft | Licença/versão, ligação, alterações, uso, distribuição e eventual serviço em rede; sem conclusão por nome apenas |
| LIC-03 | Metadados ausentes ou divergentes | Conferir LICENSE/NOTICE do artefato e versão resolvida; campo license não é a única evidência |
| LIC-04 | Avisos/atribuição | Conferir o artefato distribuído e condições concretas; ausência no repositório não prova ausência na distribuição |

Sem dependências instaladas, use lockfile, SBOM ou artefato verificado quando
disponível e suficiente. Não instale nem execute dependências só para descobrir
licenças. Registre cobertura insuficiente quando não houver evidência adequada.

## Regras de decisão

IDs fixos: use somente LGPD-01 a LGPD-09 e LIC-01 a LIC-04. Um achado tem ID
local F-001 etc.; nunca crie um ID de verificação como LGPD-LOG-01. A lista é um
recorte do produto, não um catálogo completo das obrigações brasileiras.

Antes de aplicar LGPD, investigar incidência e exceções, inclusive arts. 3º/4º.
Origem brasileira do desenvolvedor, nome de variável e tema de negócio não bastam.
Os dispositivos são candidatos a consultar, não citações já conferidas.
Classificação técnica no escopo e verificação jurídica são separadas, conforme
metodo.md. Por exemplo, agregado sem vínculo individual demonstrado não ganha
um indício de dado pessoal só porque destino e retenção não foram informados.
Essas lacunas podem manter a revisão jurídica parcial sem mudar a contraprova.

| ID | Contraprovas e contexto que mudam a análise | Resultado cauteloso |
|---|---|---|
| LGPD-01 | Agregação real, mascaramento efetivo, filtro do logger, destino, acesso e prazo | Log do objeto inteiro sustenta o sinal técnico; não prova infração nem necessidade de consentimento |
| LGPD-02 | Dados enviados, finalidade, papéis, país/destino e operação efetiva | O SDK pode processar localmente. Receber um identificador no SDK deixa a cobertura insuficiente quando o envio a terceiro estiver indefinido. Use indício com evidência de envio a terceiro. Separe base legal e mecanismo de transferência. Confira Res.19/2024 e decisões de adequação, como Res.32/2026, antes de exigir cláusulas-padrão |
| LGPD-03 | Categoria efetiva e vínculo com pessoa identificada/identificável | CPF pode ser pessoal sem ser sensível por si. Campo de saúde exige investigar art.11; não transportar automaticamente qualquer base do art.7º |
| LGPD-04 | Público real, categoria de dados, finalidade, melhor interesse e medidas | Conferir Enunciado1/2023 e art.14; base não se reduz universalmente a consentimento. O recorte não cobre toda legislação infantil |
| LGPD-05 | Cookie necessário, conteúdo coletado, finalidade e base adotada | Ausência de banner não é infração automática. Consentimento válido importa quando for a base aplicável; recomendações do guia devem ser identificadas como orientação |
| LGPD-06 | Canal fora da interface, processo manual, identidade do solicitante e exceções | Falta de botão não demonstra falta de atendimento. Perguntar pelo processo; não afirmar que todos os dados devem ser apagados imediatamente |
| LGPD-07 | Finalidade encerrada, obrigação de conservar, anonimização e condições do art.16 | Prazo desconhecido é insuficiência; não criar prazo universal ou recomendar eliminação contra obrigação aplicável |
| LGPD-08 | Hash de senha, controles de acesso, gestão de segredos e risco do contexto | Recomendar proteção adequada; não dizer que a lei exige bcrypt ou criptografia específica para qualquer campo |
| LGPD-09 | Política analisada, versão, produto a que se refere e terceiros efetivos | Confrontar contradição concreta. Documento fora do repositório é contexto faltante, não inexistência comprovada |
| LIC-01 | Licença em outro arquivo/aviso, permissão específica, titularidade e material reutilizado | Ausência de LICENSE deixa permissões pouco claras; não classificar publicação como ilegal nem negar toda hipótese legal de uso |
| LIC-02 | Versão/exceções, modificação, combinação/ligação, distribuição e acesso remoto | GPL/AGPL/LGPL não são equivalentes. Não concluir incompatibilidade pelo nome nem que uso privado dispara automaticamente todas as obrigações de distribuição |
| LIC-03 | LICENSE/NOTICE do pacote e versão resolvida, SBOM, licença dupla e expressões SPDX | Campo ausente não significa pacote sem licença. Divergência pede conferir a fonte autorizada; não instalar dependências para preencher a lacuna |
| LIC-04 | Condições da licença efetiva e conteúdo do artefato distribuído | MIT/BSD exigem preservar avisos conforme seus textos. Apache-2.0 trata alterações e NOTICE quando aplicável; não exigir um arquivo NOTICE em toda distribuição sem verificar suas condições |

Para cada verificação aplicada, registrar indicio, sem_indicio, insuficiente,
nao_aplicavel justificado ou nao_examinado. Regra não examinada não equivale a
regra aprovada. Fonte e data precisam ser obtidas na auditoria atual.
