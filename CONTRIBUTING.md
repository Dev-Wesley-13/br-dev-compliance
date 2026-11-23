# Como contribuir

O BR Dev Compliance revisa planos e código para LGPD e licenças dentro
do escopo que o desenvolvedor autorizar. Use exemplos sintéticos para
relatar problemas e testar mudanças.

1. Informe a versão do cliente, do pacote e do sistema. Descreva os passos,
   o comportamento observado e o esperado. Para um achado ou uma fonte
   incorreta, inclua o ID da verificação e o recorte mínimo que reproduz o caso.
2. Remova credenciais, dados pessoais, código privado e caminhos que
   identifiquem pessoas. Ao relatar um problema que possa expor dados ou
   permitir execução indevida, use o canal privado do repositório quando
   estiver disponível.
3. Faça a mudança no recurso canônico. Alterações de schema ou do contrato
   precisam considerar a leitura de resultados anteriores.
   [Contrato](plugins/br-dev-compliance/referencias/resultado.schema.json) · [Método](plugins/br-dev-compliance/referencias/metodo.md).
4. Rode os testes relevantes e indique versão, comando e resultado.
   Em testes com IA, use um caso por vez e confira cada resultado antes
   de iniciar o seguinte. Registre fontes, tempo, tokens observáveis e
   tentativas interrompidas.

Na raiz do projeto, a regressão local para Windows usa Node.js, Git e
PowerShell. Ela não usa cotas de modelo.

```text
node --test tests/*.test.mjs
node tools/build-release-candidate.mjs
```

Para ampliar a cobertura jurídica, proponha a verificação, as fontes e
os casos positivos, limpos e ambíguos que sustentam a mudança. Indique
quais rótulos receberam revisão jurídica independente.
O código atual é distribuído sob [Apache-2.0](LICENSE). Ao enviar uma contribuição
intencional para inclusão, confirme que tem os direitos necessários e indique
materiais e avisos de terceiros. Aplicam-se os termos da seção 5 da licença,
salvo acordo explícito diferente. A [política de identidade](TRADEMARKS.md)
explica como apresentar versões modificadas.

Envie alterações em uma branch do seu fork e abra um pull request para main. O mantenedor revisa as mudanças antes da integração. Atualize os testes e descreva qualquer mudança de fonte, permissão ou dado persistido. Profissionais habilitados podem abrir uma issue **Revisão jurídica independente** para combinar o escopo e o canal de devolutiva. Evite anexar dados de clientes ou documentos pessoais.
