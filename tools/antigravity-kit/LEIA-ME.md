# BR Dev Compliance 1.0.0 — kit para a prova remota

Extraia o ZIP do kit em uma pasta nova de Downloads, fora da pasta do piloto
antigo e fora dos seus projetos reais. Abra como workspace a pasta que contém
este LEIA-ME, `verificar-kit.mjs`, `inventory.json` e `.agents`.

O plugin já está disposto em `.agents/plugins/br-dev-compliance/`, com os 14
arquivos do pacote original. Essa é a instalação local nativa documentada para
Antigravity App/IDE. A descoberta efetiva depende da versão do cliente e ainda
precisa ser conferida na interface/contexto do host.

Não é necessário instalar outro programa de auditoria nem copiar a skill para
`.agents/skills`. O ZIP original do plugin acompanha o kit para a prova futura
do terminal. Não precisa extraí-lo novamente para esta etapa.

## Verificação sem instalar nem auditar

O prompt em `PROMPT-DESCOBERTA.txt` pede apenas a conferência do kit e dos
componentes carregados. Prefira Node quando já instalado e permitido pelo host:

```text
node .\verificar-kit.mjs
```

O verificador Node usa somente módulos nativos de arquivos, caminhos e SHA-256.
Não executa PowerShell, subprocessos, rede ou auditorias. Os hashes do ZIP e do
inventário da candidata selecionada são fixados no código. Não instala dependências
nem altera políticas. Se Node não estiver disponível, registre a pendência.

O verificador PowerShell continua disponível somente onde a política permitir:

```text
powershell.exe -NoLogo -NoProfile -NonInteractive -File .\verificar-kit.ps1
```

Os verificadores leem os manifestos, comparam SHA-256 do ZIP/inventário e dos 14 arquivos,
recusam arquivos extras e links no plugin e preservam os arquivos. Apenas o
verificador PowerShell consulta se `agy` está no PATH e se existe no local padrão documentado em
`%LOCALAPPDATA%\agy\bin\agy.exe`. Não executa nem instala o CLI e não altera PATH.
Se uma opção for bloqueada pelo host, registre a mensagem e preserve a política.
Não repita uma tentativa PowerShell já bloqueada nem troque flags para liberá-la.
Quem já extraiu o primeiro kit pode receber somente `verificar-kit.mjs` na raiz
do workspace atual; o plugin e seus 14 arquivos permanecem inalterados.

`package_verified` confirma integridade local. Não comprova instalação reconhecida,
execução do auditor ou conformidade jurídica. Confira plugin, skill e agente na
área de personalizações e registre de onde veio essa evidência. Sem acesso à
interface/contexto nativo, a descoberta permanece pendente.

Os manifestos descrevem os três pacotes da candidata original; este kit transfere
somente o Antigravity. Ausência de `agy` mantém a prova do terminal pendente e
não impede conferir o plugin no Desktop/IDE. Não inicie auditoria nesta etapa.

Registre também a versão do aplicativo pelo menu Ajuda/Help > Sobre/About e o
modelo selecionado. Se a IA não puder ler essa informação, o usuário pode copiá-la.

[Plugins por superfície](https://antigravity.google/docs/plugins) ·
[Instalação e caminho padrão do CLI](https://antigravity.google/docs/getting-started)
