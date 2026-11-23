# BR Dev Compliance

O BR Dev Compliance ajuda desenvolvedores a investigar riscos à luz da legislação brasileira durante o planejamento e a revisão de software. Quando encontra um indício, o plugin mostra a evidência, as fontes consultadas e o que ainda precisa ser verificado. Você decide se quer continuar, corrigir ou parar.

Na versão 1.0, o catálogo tem **nove verificações de LGPD e quatro de licenciamento de software**. Uma mesma verificação pode envolver outras leis. Ao examinar uma rotina que apaga registros de acesso, por exemplo, o auditor pode consultar o Marco Civil da Internet para investigar uma possível obrigação de guarda. Ao revisar um produto de acesso provável por crianças e adolescentes, pode consultar o ECA Digital. O relatório indica o que foi examinado dentro desse recorte. A identificação de todas as leis aplicáveis a um projeto continua fora da cobertura da 1.0. [Verificações](plugins/br-dev-compliance/referencias/verificacoes.md) · [Fontes de consulta](plugins/br-dev-compliance/referencias/fontes.md)

**1.0.0 · em testes em projetos de produção · revisão jurídica especializada pendente.** As evidências de avaliação disponíveis usam casos sintéticos. O levantamento preparatório foi feito por IA. Profissionais habilitados em proteção de dados ou licenciamento podem [manifestar interesse em revisar](https://github.com/Dev-Wesley-13/br-dev-compliance/issues/new?template=revisao-juridica.md). [Escopo e entregas da revisão](docs/REVISAO-PROFISSIONAL.md).

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
