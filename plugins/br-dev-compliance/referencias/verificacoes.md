# Verificações iniciais — gabarito jurídico ainda não revisado

As referências são rotas de investigação. Confirme o texto na fonte antes de
citá-lo como verificado. Esta lista não converte sinais em infrações automáticas.

| ID | Investigar | Contexto para enquadramento / referência inicial |
|---|---|---|
| LGPD-01 | Dados pessoais em logs | Necessidade, acesso, mascaramento, retenção; arts. 5º I e X, 6º III e VII, 37, 46 e 49. Registro de operações e log de depuração têm finalidades distintas |
| LGPD-02 | Identificadores enviados a terceiros | Finalidade, base legal, papéis; localização e transferência internacional antes de art. 33; arts. 7º/11 conforme dado. Na Res. 32/2026, conferir UE, Islândia, Liechtenstein, Noruega e entidades abrangidas. Verificar o destino e as condições efetivas |
| LGPD-03 | Dados sensíveis | Categorias do art. 5º II e hipóteses do art. 11, inclusive § 1º; CPF isolado não é automaticamente sensível |
| LGPD-04 | Crianças e adolescentes | O serviço é dirigido a menores ou de acesso provável por eles (Lei 15.211/2025, art. 1º)? Investigar público efetivo, melhor interesse, art. 14 e orientação atual da ANPD; aniversário isolado não prova infração |
| LGPD-05 | Rastreamento | Tipo/finalidade/base legal; consentimento só quando aplicável, não obrigação universal para todo cookie; arts. 7º, 8º, 9º e 10. Para cookie estritamente necessário, investigar legítimo interesse (art. 7º IX), necessidade e transparência. O guia da ANPD é orientativo |
| LGPD-06 | Direitos do titular | Canais e procedimentos também podem existir fora do código; arts. 18, §§ 3º a 5º, e 19 para confirmação e acesso |
| LGPD-07 | Retenção | Finalidade, término e hipóteses de conservação; arts. 15/16 e eventual guarda específica dos registros de acesso nas condições do art. 15 do Marco Civil; exclusão não é sempre obrigatória |
| LGPD-08 | Proteção dos dados | Medidas adequadas ao risco; arts. 6º VII, 46 a 47 e 49. A LGPD não exige a mesma criptografia para qualquer campo |
| LGPD-09 | Transparência incoerente | Confrontar política, finalidade e uso demonstrado da mesma versão; arts. 6º VI e 9º |
| LIC-01 | Ausência de licença do projeto | Conferir autorização de uso na Lei 9.610/1998, art. 29, e na Lei 9.609/1998, art. 2º. Permissões de reutilização pouco claras; não declarar a publicação ilegal |
| LIC-02 | Obrigações copyleft | Licença/versão, ligação, alterações, uso, distribuição e eventual serviço em rede; conferir GPLv3 §§ 0–2, 4–6 e 13, incluindo o que constitui convey; na AGPLv3, examinar separadamente a interação remota com versão modificada (§ 13) |
| LIC-03 | Metadados ausentes ou divergentes | Conferir LICENSE/NOTICE do artefato e versão resolvida; campo license não é a única evidência |
| LIC-04 | Avisos/atribuição | Examinar aviso e condições no artefato ou na descrição do plano. Na MIT, verificar cópia ou porção substancial; na Apache-2.0, conferir § 4(a–d), inclusive atribuições aplicáveis. A ausência no repositório deixa a distribuição em aberto |

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
| LIC-01 | Licença em outro arquivo, permissão específica e abrangência do exame | Use insuficiente quando o recorte só diz que não viu um aviso e deixa outros locais de permissão em aberto. Use indicio quando a evidência estabelece ausência de permissão no escopo pertinente. A falta do nome LICENSE isoladamente é sem_indicio quando a permissão foi identificada. |
| LIC-02 | Versão/exceções, modificação, combinação/ligação, distribuição e acesso remoto | GPL/AGPL/LGPL não são equivalentes. Não concluir incompatibilidade pelo nome nem que uso privado dispara automaticamente todas as obrigações de distribuição |
| LIC-03 | Identidade do artefato, versão resolvida, texto da licença e licença dupla | Use sem_indicio para a alegação baseada só em campo ausente se a evidência informa licença no mesmo artefato e versão. Em modo plano, aceite esse vínculo explícito como premissa e deixe sua confirmação no artefato em aberto. Use insuficiente se o vínculo entre as duas declarações for desconhecido. Use indicio para divergência concreta entre declarações do mesmo artefato e versão. |
| LIC-04 | Condições da licença efetiva e conteúdo do artefato distribuído | Remoção de aviso descrita no plano sustenta indicio. Remoção indefinida pede insuficiente. Para a alegação isolada de falta de arquivo NOTICE separado em Apache-2.0, use sem_indicio quando a premissa diz que a origem não traz NOTICE. Se a existência de NOTICE na origem estiver indefinida, use insuficiente. Confira os formatos aceitos e mantenha as demais condições fora dessa conclusão. |

Para cada verificação aplicada, registrar indicio, sem_indicio, insuficiente,
nao_aplicavel justificado ou nao_examinado. Regra não examinada não equivale a
regra aprovada. Fonte e data precisam ser obtidas na auditoria atual.
