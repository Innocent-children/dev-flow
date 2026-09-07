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

A busca de repositórios e o uso do índice de código seguem as instruções atuais do usuário e o
`AGENTS.md` aplicável. Se essas instruções exigirem um índice de projetos, o Host examina os repositórios
candidatos em modo somente leitura antes da confirmação e fixa o escopo confirmado na Task.
Essas instruções têm prioridade sobre a preferência do plugin para o índice de código.

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

## Mascote de desktop (macOS arm64)

O pacote local mantém a aparência padrão. A Garota Baleia e outras aparências personalizadas são importadas como pacotes de recursos separados; as atualizações do aplicativo preservam os recursos importados.

O mascote está disponível no macOS arm64 por meio de um pacote local de desenvolvimento com `DevFlowPet.app`; as listas comuns de arquivos npm e a preparação de versões oficiais não incluem o aplicativo nativo. Executar um pacote já compilado não exige Swift/Xcode e usa o Core de um Adapter Codex ou DeepSeek configurado. O mascote mostra o estado salvo de uma Task e abre sua WebUI, sem inferir atividade ao vivo do Host ou porcentagens de progresso. Ao sair, as Tasks e a WebUI são preservadas.

É possível importar um PNG ou SVG estático, um pacote de animação nativo PNG/SVG ou um atlas no formato Codex 1/2. Pacotes nativos exigem cinco animações de tarefa e podem adicionar quatro; atlas Codex geram nove animações e 57 quadros. A extensão de alta resolução do Dev Flow precisa de um atlas separado com dimensões padrão para uso no Codex. As imagens disponíveis determinam caminhadas, acenos e gestos de pensamento em repouso, com um controle independente e prioridade para avisos de tarefas. Atualizar o programa e importar novamente as imagens são operações separadas.

A barra de menus exibe o logotipo curvo do Dev Flow em uma única cor, que se adapta à aparência do sistema. O tamanho do mascote oferece seis ajustes de 50% a 200%, mantendo o tamanho do texto do balão. A aparência padrão acompanha o aplicativo como um pacote separado com nove animações e 312 quadros SVG.

Consulte o [guia do mascote](docs/DESKTOP-PETS_en.md) para obter o aplicativo, instalar, atualizar, conhecer as regras e os limites e resolver problemas. A matriz de suporte define o suporte público.

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentação

- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projeto:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Licença

[Apache License 2.0](LICENSE)

## Adaptação para Windows desktop

Windows 10/11 x64 destina-se a PCs desktop comuns com processadores Intel ou AMD de 64 bits. As regras de caminhos, permissões, comandos e limpeza do Host ficam separadas em `platform/windows/` e `platform/macos/`; o Core compartilha a semântica de tarefas independente da plataforma. Os inicializadores de comandos do Windows usam UTF-8 e a observação Git do Core oculta janelas de console. Consulte o [relatório de adaptação](docs/WINDOWS-ADAPTATION_en.md) para a verificação nativa no Windows e seus limites; esses resultados não ampliam o suporte dos pacotes estáveis.

O Windows também oferece o mascote de desktop: seleção de tarefas e estado, menu da bandeja, aparências PNG/SVG, animações nativas, atlas Codex PNG/WebP, nove ações, arrastar, seis tamanhos, ocultar/restaurar e iniciar/parar de forma independente. Crie o pacote local do Windows com `node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"`; consulte os pré-requisitos e a instalação no [guia do mascote](docs/DESKTOP-PETS_en.md). As implementações de Windows e macOS permanecem separadas.

No Windows, diretórios AppData existentes são resolvidos para seus caminhos reais, incluindo aliases de hosts de desktop empacotados; links simbólicos continuam sendo rejeitados.

A distribuição de desenvolvimento para Windows inclui os dois pacotes Adapter e o aplicativo desktop. Após instalar o inicializador, use `dev-flow install --host all --yes` e `dev-flow pet start`. O reparo e a reinstalação usam a mesma entrada, verificam os hashes, atualizam o aplicativo e preservam dados de Task, configurações e aparências.
