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

Cada nova solicitação é avaliada em modo somente leitura antes de escolher o Dev Flow. Depois, o Host pergunta
se a origem será local ou remota, qual branch inicial usar e o nome do novo branch da tarefa. Para uma origem
local, também pergunta se deve copiar alterações preparadas, não preparadas e arquivos não rastreados que o Git
não ignora, preservando o diretório de origem e o estado do índice. A criação local não precisa de rede; somente
a remota executa fetch. Conflitos interrompem a criação do Task e preservam o destino para inspeção.

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
- **Conclusão e recuperação verificáveis.** O Core exige a conclusão de todos os itens do plano e vincula cada critério de aceitação a verificações válidas para o estado atual. Após uma interrupção, a WebUI recupera os envios salvos no Core. O Codex preserva as respostas completas de rejeição e segue as instruções do Core antes de continuar.

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

O Adapter do código-fonte atual requer DSH `>=0.1.2-rc.1`; cada operação do Dev Flow verifica a autorização inserida diretamente pelo usuário no turno atual.

### 2. Inicie uma tarefa

Envie esta mensagem de usuário no **Codex**:

```text
$dev-flow-codex:dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

O Codex mantém as escolhas e autorizações que continuam válidas, sem pausas extras para «confirmar e continuar». Quando há uma decisão pendente ou falta uma informação necessária, faz uma pergunta concreta.

Ou envie esta mensagem no **DeepSeek Harness**:

```text
/dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

Esses são seletores de conversa, não comandos de shell. Inclua um objetivo concreto, as condições de
aceite, o limite de arquivos e o teto de testes. A primeira resposta avalia o impacto e pergunta se você
prefere trabalhar diretamente ou usar o Dev Flow; nem um seletor explícito pula essa escolha. Ao escolher
o Dev Flow, confirme a origem, os branches e a cópia de alterações descritos acima. O Codex abre um worktree gerenciado quando o
Host oferece essa capacidade; o DeepSeek mostra como reiniciar no novo worktree porque o Workspace Root
da sessão é fixo.

Antes de iniciar uma nova sessão do Codex, a sessão de origem salva a discussão original pertinente e um documento estruturado, separando os requisitos confirmados das sugestões não aceitas e das perguntas em aberto. A criação de tarefas no aplicativo e a reinicialização pela CLI usam o mesmo material salvo; conteúdos longos são transmitidos em arquivos completos, sem cortes. Consulte a [arquitetura](docs/ARCHITECTURE_en.md#codex-requirements-handoff).

O documento preserva as instruções e autorizações específicas da sessão; o Codex carrega normalmente os arquivos `AGENTS.md` globais e do repositório aplicáveis, sem duplicar seu conteúdo na transferência. Os complementos necessários para regras que a sessão de destino não consiga detectar indicam a origem e o escopo de aplicação.

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

## Acesso às tarefas pelo desktop

O pacote npm `@imotong/dev-flow` inclui o mascote de desktop para macOS arm64 e Windows 10/11 x64, com nove ações e 312 quadros SVG padrão. Ele mostra o estado salvo da Task selecionada e abre sua WebUI; permite selecionar tarefas, importar aparências, controlar animações, ajustar o tamanho e iniciar ou parar separadamente. Um Adapter Codex ou DeepSeek configurado fornece o Core.

Após instalar o pacote npm, execute `dev-flow install` para configurar um Adapter. `install`, `upgrade`, `repair` e `reinstall` atualizam a cópia do aplicativo e preservam configurações e aparências. Consulte o [guia do mascote](docs/DESKTOP-PETS_en.md). O macOS usa assinatura ad-hoc; Developer ID, notarização e assinatura de distribuição do Windows ainda não foram verificados. As verificações locais não ampliam o [suporte estável](docs/SUPPORT-MATRIX_en.md).

```bash
dev-flow pet start
dev-flow pet stop
```

## Documentação

- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projeto:** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Licença

[Apache License 2.0](LICENSE)


## Referências de interação do Host

A [Skill do Codex](packages/codex/plugin/skills/dev-flow/SKILL.md) e a [Skill do DeepSeek](packages/deepseek/skills/dev-flow/SKILL.md) geram as regras e os exemplos do Core a partir de uma única fonte compartilhada. Cada pacote mantém suas interfaces reais de autorização, espaços de trabalho e ferramentas. Ambos abrangem as transições atuais, as respostas e a recuperação. Os documentos do processo são atualizados antes da verificação final; uma exibição truncada não torna incerta uma resposta preservada integralmente.
