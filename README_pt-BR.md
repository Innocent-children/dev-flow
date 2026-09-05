<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Ícone do Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Preserve o escopo, os limites de verificação e o progresso de tarefas longas de programação com IA entre sessões.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Evite que tarefas longas saiam do rumo

Quanto mais uma tarefa de programação demora, maior a chance de ela mudar aos poucos: mais arquivos entram
na alteração, uma verificação direcionada vira uma execução de testes sem limite, a mesma falha provoca
outra tentativa parecida ou uma sessão reiniciada precisa reconstruir o progresso a partir do chat.

Dev Flow guarda em uma única tarefa local o pedido acordado, os caminhos previstos, o plano de
verificação criado após a análise, a etapa atual e os resultados. Codex ou DeepSeek continua responsável por alterar o código.

Cada pedido novo é avaliado em modo somente leitura antes da escolha do Dev Flow. Se você o escolher,
confirma o remote, o branch base e um novo branch da tarefa; o Host cria a partir dessa base remota um
worktree limpo e dedicado antes de o Core criar a Task. As mudanças do checkout de origem não são copiadas.

- **O escopo permanece claro.** Os caminhos previstos são registrados, as ferramentas estruturadas
  compatíveis pedem confirmação antes de gravar fora do plano e as mudanças reais são conferidas novamente
  antes dos testes e da entrega.
- **Cada worktree tem um único responsável pelas mudanças.** O Core calcula no Git as alterações atuais da
  Task; commits lineares normais continuam, enquanto uma reescrita de branch ou a substituição do worktree
  interrompe a tarefa.
- **A verificação acompanha a tarefa.** TASKS registra verificações, motivos, esforço inicial e expectativas
  de suíte completa/código de teste. Só impacto, risco, falha ou lacuna concreta aumenta o orçamento.
- **A revisão para na mudança atual.** Depois da alteração, cobre apenas o diff, o impacto causal e a
  aceitação; uma correção repete só verificações relacionadas e um code review explícito permanece somente leitura.
- **O trabalho continua depois de uma reinicialização.** Uma nova sessão recupera a mesma tarefa, as
  verificações restantes e a decisão atual sem reconstruí-las a partir da conversa.
- **Somente resultados atuais são reutilizados.** Mudanças no pedido, no plano, na implementação ou no
  repositório invalidam verificações antigas; o desenvolvedor revisa o resultado antes da entrega.

## Início rápido

> A versão estável publicada no npm sob `@latest` está atualmente verificada no macOS arm64. Instale
> primeiro Node.js `>=24` e uma versão compatível do Codex ou do DeepSeek Harness. Consulte as versões
> exatas e outros ambientes na [Support Matrix](docs/SUPPORT-MATRIX_en.md).

### 1. Instale o Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Escolha Codex, DeepSeek ou ambos na configuração interativa. Antes de iniciar a primeira tarefa,
conclua também a última etapa indicada pelo instalador:

- **Codex:** abra `/hooks`, revise o hook incluído com o Dev Flow e marque-o como confiável. A verificação
  compatível antes de uma gravação por `apply_patch` só funciona depois disso.
- **DeepSeek Harness:** reinicie o Profile do DSH escolhido após a instalação.

### 2. Inicie uma tarefa

Envie esta mensagem de usuário no **Codex**:

```text
$dev-flow-codex:dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

Ou envie esta mensagem no **DeepSeek Harness**:

```text
/dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

Esses são seletores de conversa, não comandos de shell. Inclua um objetivo concreto, as condições de
aceite, o limite de arquivos e o teto de testes. A primeira resposta avalia o impacto e pergunta se você
prefere trabalhar diretamente ou usar o Dev Flow; nem um seletor explícito pula essa escolha. Ao escolher
o Dev Flow, confirme o remote, a base e o branch de destino. O Codex abre um worktree gerenciado quando o
Host oferece essa capacidade; o DeepSeek mostra como reiniciar no novo worktree porque o Workspace Root
da sessão é fixo.

### 3. Retome e acompanhe o progresso

Depois de reiniciar a sessão, peça explicitamente para continuar a Task no worktree original ao qual
ela está vinculada. O sistema verifica esse worktree e continua a partir do estado salvo, sem
reavaliar o pedido nem solicitar uma nova escolha de usar o Dev Flow. Se o worktree original sumiu
ou foi substituído, a Task fica pausada até você restaurá-lo ou abandonar explicitamente a tarefa
(abandon). O sistema não muda para outro worktree.

```bash
# Consultar as integrações instaladas
dev-flow status --host all

# Abrir a visualização local das tarefas
dev-flow webui start
```

Para instalação não interativa, Profiles personalizados do DSH, atualizações, reparo e remoção,
consulte a [Command Reference](docs/COMMANDS_en.md).

## Quando usar

Dev Flow é útil em trabalhos de repositório que atravessam sessões, precisam de um limite real de
arquivos, restringem o esforço de testes ou podem exigir retrabalho sem reutilizar resultados antigos.

Para perguntas pontuais, explicações de código, consultas de status e pequenas mudanças mecânicas que
não precisam guardar o progresso, usar Codex ou DeepSeek diretamente costuma ser mais simples.

## Documentação

- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projeto:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Licença

[Apache License 2.0](LICENSE)
