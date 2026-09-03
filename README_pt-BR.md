<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Ícone do Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Mantenha tarefas longas de programação com IA dentro dos limites de mudança e teste que você definiu.</strong></p>

<p align="center">Limites locais, progresso persistente e recuperação segura para Codex e DeepSeek.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="Plataforma estável: macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#início-rápido">Início rápido</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#documentação">Documentação</a>
</p>

## Mantenha a tarefa que você aprovou

Tarefas longas de programação raramente falham de uma vez. Elas saem do rumo aos poucos: um arquivo fora
do plano vira três, uma verificação direcionada se transforma em uma execução de testes sem limite, a
mesma falha leva a outra correção parecida ou uma sessão reiniciada reconstrói o progresso a partir de
um histórico de chat incompleto.

Dev Flow guarda em uma Task local o pedido acordado, os caminhos previstos, o orçamento de verificação,
a etapa atual e os resultados. Codex ou DeepSeek continua lendo e alterando código e executando comandos;
Dev Flow transforma mudanças de escopo, repetições, recuperação e entrega em decisões explícitas.

## O que fica sob controle

| Tema | O que o Dev Flow faz |
| --- | --- |
| **Escopo das mudanças** | Registra os caminhos previstos, pausa gravações compatíveis fora do plano e confere novamente os caminhos alterados acumulados antes dos testes e da conclusão. |
| **Esforço de verificação** | Mantém um orçamento de comandos, exige permissão prévia para a suíte completa e para na terceira repetição exata da mesma falha ou de um resultado sem mudanças. |
| **Progresso persistente** | Salva a Task fora do chat para que outra sessão retome a mesma etapa, limites, registros e Blockers. |
| **Resultados atuais** | Invalida testes e confirmações de entendimento quando o pedido, o plano, a implementação ou o repository muda. |
| **Aprovação do desenvolvedor** | Antes da entrega, exige revisão das mudanças reais, da complexidade desnecessária e dos riscos de manutenção. |

## Início rápido

> O npm `@latest` estável está atualmente verificado no macOS arm64. Os Host Adapter exigem
> Node.js `>=24`. Consulte a [Support Matrix](docs/SUPPORT-MATRIX_en.md) antes de instalar em outro ambiente.

### 1. Instale e conecte um Host

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

A configuração interativa permite instalar o Dev Flow para Codex, DeepSeek ou ambos. Depois, o mesmo
ponto de entrada oferece status, diagnóstico, atualização, reparo e remoção.

### 2. Inicie uma Task com limites

No **Codex**, envie esta mensagem de usuário:

```text
$dev-flow-codex:dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

No **DeepSeek Harness**, envie:

```text
/dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

Esses são seletores de conversa, não comandos de shell. Descreva da forma mais concreta possível o
objetivo, as condições de aceite, o limite de arquivos e o teto de testes.

### 3. Retome ou inspecione

Depois de reiniciar, volte ao repository que participa da Task e use novamente o mesmo seletor do Host.
Dev Flow lê a Task salva e retoma a etapa atual sem reconstruir o progresso a partir da conversa.

```bash
# Status dos Adapter somente para leitura
dev-flow status --host all

# Abrir o Control Center local
dev-flow webui start
```

Control Center mostra a etapa atual, os caminhos previstos e alterados, o histórico de verificações,
os Blockers, as orientações de recuperação e a próxima decisão. Ele lê os mesmos dados locais da Task
que as duas integrações de Host.

Para configuração não interativa, comandos nativos do Host, Profiles personalizados do DeepSeek,
atualizações e remoção, consulte a [Command Reference](docs/COMMANDS_en.md).

## Como funciona durante uma Task

1. **Defina o limite.** A Task salva o pedido, os repositories participantes, os caminhos previstos, os itens de trabalho e o orçamento de verificação.
2. **Trabalhe pelo Host.** Codex ou DeepSeek altera o código; as ferramentas estruturadas de arquivo compatíveis perguntam antes de gravar fora do plano.
3. **Confira as mudanças reais.** Antes dos testes e da conclusão, Core reconcilia todos os caminhos alterados pela Task, inclusive mudanças que não passaram por uma verificação prévia.
4. **Interrompa ciclos improdutivos.** A terceira repetição exata pausa a Task e exige outro caminho ou permissão explícita para continuar.
5. **Entregue resultados atuais.** Mudanças posteriores no código invalidam verificações antigas; os testes e o entendimento do desenvolvedor precisam corresponder à implementação entregue.

Se uma operação terminar sem uma resposta clara, a integração lê a Action salva e o repository atual
antes de decidir se é seguro tentar novamente.

## Quando usar

| Use o Dev Flow quando… | Use o Host diretamente quando… |
| --- | --- |
| O trabalho pode atravessar sessões, reinicializações ou dias | Você precisa de uma resposta pontual ou explicação de código |
| Arquivos alterados e esforço de teste precisam de limites claros | A mudança é pequena, mecânica e não precisa de progresso salvo |
| O retrabalho não pode reutilizar resultados obsoletos | Você quer apenas consultar o status ou discutir o design |
| A entrega precisa de uma revisão clara do desenvolvedor | Você não precisa de uma Task persistente nem de estado de recuperação |

## Suporte

| Produto npm `@latest` estável | Ambiente verificado |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

O código-fonte atual também contém a WebUI local e o runtime exato `win32-x64`, mas o Windows ainda
não tem uma Host Journey estável de `@latest`. A [Support Matrix](docs/SUPPORT-MATRIX_en.md) define as
plataformas estáveis; [Project Status](docs/PROJECT-STATUS_en.md) separa versões estáveis, recursos
presentes apenas no código-fonte, Journeys públicas e lacunas atuais.

## Limites

- Dev Flow é uma camada de controle, não um Agent de programação. Codex ou DeepSeek, autorizado pelo usuário, altera arquivos e executa comandos.
- Go Core observa o Git somente para leitura. Ele não executa commit, push, merge, rebase, tag ou publish.
- As verificações antes da gravação cobrem apenas as ferramentas estruturadas do Host indicadas. Bash e ferramentas externas podem gravar primeiro; portanto, Dev Flow não é um sandbox de shell ou do sistema de arquivos.
- Control Center escuta apenas no loopback local para um usuário; não oferece acesso remoto, sincronização em nuvem nem permissões de equipe.

## Documentação

- **Comece aqui:** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **Como usar:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Entenda o sistema:** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **Segurança e contribuição:** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## Licença

[Apache License 2.0](LICENSE)
