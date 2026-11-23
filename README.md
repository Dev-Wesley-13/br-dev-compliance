# BR Dev Compliance

O BR Dev Compliance ajuda desenvolvedores a investigar riscos à luz da legislação brasileira durante o planejamento e a revisão de software. Quando encontra um indício, o plugin mostra a evidência, as fontes consultadas e o que ainda precisa ser verificado. Você decide se quer continuar, corrigir ou parar.

**O que consigo verificar hoje?** Antes de escrever código, peça uma revisão do plano. Em um sistema existente, indique a entrega ou os arquivos que deseja examinar. A versão 1.0 oferece **nove verificações de proteção de dados e quatro de licenças de software**. Por exemplo, ela investiga se um checkout expõe o CPF nos logs, se o analytics envia identificadores a terceiros e se o pacote distribuído preserva os avisos de licença. Conforme a questão, pode consultar também o Marco Civil da Internet, o ECA Digital, a Lei do Software e a Lei de Direitos Autorais. [Ver as 13 perguntas, os fundamentos e os limites por território](docs/ALCANCE.md)

| Se o seu projeto é… | A versão 1.0 investiga… | O plano de evolução acrescenta… |
| --- | --- | --- |
| Uma loja que pretende vender cigarros pela internet | Os dados dos compradores, o rastreamento e as licenças dos componentes | Identificação da restrição sanitária à venda online ainda no planejamento e verificação do catálogo e do fluxo de pedidos na entrega |
| Uma autoescola que agenda aulas em BH e na capital paulista | O tratamento de dados de alunos, instrutores e proprietários | Regras distintas para licenciamento estadual e circulação municipal, recomendação de produto e retomada da decisão aceita na próxima tarefa |

**Estados e municípios.** A 1.0 ainda não tem módulos próprios estaduais, distritais ou municipais. A meta é investigar normas de qualquer esfera relevantes para cada projeto e mostrar quais foram examinadas, em que território e em qual edição. [Exemplos completos e fontes oficiais](docs/ALCANCE.md#dois-casos-de-uso-para-a-evolução) · [Roadmap](ROADMAP.md)

**1.0.0 · em testes em projetos de produção · revisão jurídica especializada pendente.** As evidências de avaliação disponíveis usam casos sintéticos. O levantamento preparatório foi feito por IA. Profissionais habilitados em proteção de dados ou licenciamento podem [manifestar interesse em revisar](https://github.com/Dev-Wesley-13/br-dev-compliance/issues/new?template=revisao-juridica.md). [Escopo e entregas da revisão](docs/REVISAO-PROFISSIONAL.md).

O [plano de evolução](ROADMAP.md) apresenta os próximos módulos, os critérios para ampliar a cobertura e a proposta de financiamento contínuo.

## Instalar

Baixe o ZIP do seu cliente nos [arquivos da versão 1.0.0](https://github.com/Dev-Wesley-13/br-dev-compliance/releases/tag/v1.0.0). Compare o SHA-256 com SHA256SUMS.txt e extraia o ZIP numa pasta própria. Os três pacotes usam o gerenciador do cliente.

| Cliente | Instalação e primeiro uso |
| --- | --- |
| Claude Code Desktop ou CLI | Adicione o marketplace com `/plugin marketplace add Dev-Wesley-13/br-dev-compliance` ou indique a pasta extraída. Instale `/plugin install br-dev-compliance@br-dev-compliance-dev`, escolha o modo e abra uma sessão. Use `/br-dev-compliance:auditar-plano`. |
| Codex Desktop ou CLI | Adicione a pasta extraída do ZIP **Codex** como marketplace. No terminal, use `codex plugin marketplace add "<pasta>"` e `codex plugin add br-dev-compliance@br-dev-compliance-local`. Em nova sessão, peça a skill **auditar**. |
| Antigravity Desktop ou CLI com Gemini | Na raiz extraída do ZIP **Antigravity**, use `agy plugin validate --strict .` e `agy plugin install .`. Abra uma nova sessão e invoque `/br-dev-compliance-auditar`. |

No Claude, escolha manual, automático ou desligado na configuração do plugin. No Codex, confiar nos hooks ativa checkpoints automáticos; o Stop pode pedir revisão ou justificativa antes de encerrar o turno. Para uso manual, deixe os dois hooks sem confiança. No Antigravity, o acionamento é explícito e o resultado fica no chat. As provas de integração cobrem versões específicas no Windows. Os checkpoints exigem Git e PowerShell, com PowerShell 7 no Codex. O validador do Antigravity usa Node quando disponível.

## Exemplo

> Audite somente este plano para LGPD-01. Queremos contar os erros de validação guardando o CPF em cada falha. Mantenha o resultado no chat.

O auditor investiga por que o contador precisa desse identificador e pode sugerir uma métrica agregada. Se a fonte oficial estiver indisponível, a limitação aparece no resultado. A triagem técnica não certifica conformidade.

## Dados e histórico

O cliente de IA pode enviar ao seu provedor o que lê. Confira a política aplicável à sua conta antes de autorizar os arquivos. Dumps, logs reais, segredos e bases de clientes ficam fora do escopo por padrão. Prefira exemplos sintéticos. O plugin não opera serviço próprio de telemetria.

Claude e Codex podem registrar histórico autorizado em `.br-dev-compliance/`. Ele inclui evidências, caminhos relativos, hash determinístico da raiz e uma impressão de política específica à máquina e ao projeto. Quem conhece caminhos prováveis pode testar hipóteses. Decisões novas guardam apenas continuar, corrigir ou parar. Para dispensar o registro, peça o resultado só no chat. No modo automático, os hooks ainda podem escrever estado operacional. [Contrato do histórico](plugins/br-dev-compliance/referencias/historico.md).

## Contribuir

Envie um PR pelo seu fork. A integração em main requer revisão de Wesley Fonseca. Para problemas sensíveis, consulte a [política de segurança](SECURITY.md). Para testar localmente no Windows, use Node 24, Git, Windows PowerShell e PowerShell 7 e execute:

```text
node --test --test-concurrency=1 tests/*.test.mjs
node tools/build-release-candidate.mjs
```

Projeto independente, sem afiliação com Anthropic, OpenAI ou Google. A Apache-2.0 permite uso comercial e privado, modificação e redistribuição nas condições da licença. [Contribuições](CONTRIBUTING.md) · [Licença](LICENSE) · [Avisos](NOTICE) · [Identidade](TRADEMARKS.md) · [Mudanças](CHANGELOG.md).
