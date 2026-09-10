<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Ícone do Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Preserve o escopo, os limites de verificação e o progresso de tarefas longas de programação com IA entre sessões.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## O que você pode fazer com o Dev Flow

O Dev Flow ajuda a gerenciar tarefas longas de programação com IA no Codex ou DeepSeek. Ele salva
localmente os requisitos acordados, o escopo de arquivos, o plano de verificação, o progresso e os
resultados para você continuar depois que a sessão terminar.

- **Definir o escopo:** registre os arquivos previstos e compare as alterações reais com o plano.
- **Planejar os testes:** escolha verificações pertinentes e limite o esforço de validação.
- **Retomar o trabalho:** continue a mesma tarefa e o trabalho restante no diretório original.
- **Consultar resultados:** acompanhe o progresso, as verificações e os problemas que precisam de atenção.

É útil para trabalhos em repositórios que atravessam sessões ou precisam de limites claros de
arquivos e testes. Para perguntas pontuais, explicações de código e pequenas alterações que não
precisam salvar o progresso, usar Codex ou DeepSeek diretamente costuma ser mais simples.

## Início rápido

> A versão estável do npm `@latest` está atualmente verificada no macOS arm64. Use Node.js `>=24`
> e instale primeiro uma versão compatível do Codex ou DeepSeek Harness. Consulte as versões dos
> ambientes hospedeiros e outros sistemas na [matriz de suporte](docs/SUPPORT-MATRIX_en.md).

### 1. Instale o Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Escolha Codex, DeepSeek ou ambos na configuração interativa e siga as instruções do instalador:

- **Codex:** abra `/hooks`, revise o hook do Dev Flow e marque-o como confiável para ativar as verificações suportadas antes da gravação.
- **DeepSeek Harness:** reinicie o Profile do DSH selecionado após a instalação.

### 2. Inicie uma tarefa

Envie esta mensagem no **Codex**:

```text
$dev-flow-codex:dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

Ou no **DeepSeek Harness**:

```text
/dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

Envie essas mensagens na conversa, não no terminal. Descreva o objetivo, os critérios de aceite,
o escopo de arquivos e o limite de testes.

A primeira resposta avalia o pedido e pergunta se você quer trabalhar diretamente ou usar o Dev Flow.
Ao escolher o Dev Flow, o padrão é criar um novo branch de tarefa a partir do HEAD atual no diretório
atual. Confirme o branch e se as alterações existentes ainda não commitadas fazem parte da tarefa.
As dependências, configurações locais, arquivos e estado do índice são preservados; a mesma sessão
continua quando consegue acessar todos os diretórios participantes.

Você também pode escolher explicitamente usar o branch atual ou criar um worktree Git dedicado. Para
um worktree, selecione também a origem local ou remota e o branch inicial. O Codex abre o novo diretório
quando o ambiente permite; o DeepSeek fornece o comando de reinício correspondente.

Cada diretório admite apenas uma Task ativa. Edições manuais ou de outras ferramentas também são
observadas, e mudar de branch durante a tarefa pausa o processo. Diretórios e branches locais são
preservados ao concluir; alterações não commitadas precisam ser consideradas ao iniciar a próxima tarefa.

Antes da implementação, revise e discuta os requisitos, o projeto, as tarefas, os arquivos previstos e o plano de verificação. O desenvolvimento começa após sua aprovação explícita do plano completo. Alterações no plano ou ampliação do conjunto de arquivos exigem nova aprovação. Escolher Dev Flow ou um worktree não substitui essa aprovação.

### 3. Retome e acompanhe o progresso

Depois de reiniciar a sessão, volte ao diretório original e peça para continuar a tarefa. O Dev Flow
retoma o progresso salvo. Se esse diretório sumiu ou foi substituído, a tarefa fica pausada até que
você o restaure ou abandone explicitamente a tarefa.

No DeepSeek Harness, inclua `/dev-flow` na mensagem que pede para retomar a tarefa.

```bash
# Consultar as integrações instaladas
dev-flow status --host all

# Abrir a visualização local das tarefas
dev-flow webui start
```

Para instalação não interativa, Profiles personalizados do DSH, atualizações, reparo e remoção,
consulte a [referência de comandos](docs/COMMANDS_en.md).

## Mascote de desktop

O mascote de desktop mostra o estado salvo de uma tarefa selecionada e abre sua WebUI. Você pode
escolher tarefas, personalizar a aparência, controlar animações, ajustar o tamanho e iniciar ou parar
o mascote de forma independente. Antes de usá-lo, conclua a instalação e a configuração do Codex ou
DeepSeek descritas acima.

```bash
dev-flow pet start
dev-flow pet stop
```

Os aplicativos de desktop são destinados ao macOS arm64 e Windows 10/11 x64. Consulte o
[guia do mascote](docs/DESKTOP-PETS_en.md) para instalação e controles, e a
[matriz de suporte](docs/SUPPORT-MATRIX_en.md) para a disponibilidade verificada.

## Limites de uso

Um worktree dedicado separa as alterações de código. Processos, acesso à rede, credenciais e serviços
externos continuam compartilhados com seu ambiente.

Concluir uma tarefa não cria commits, envia alterações nem exclui o worktree automaticamente. Essas
operações exigem sua autorização separada.

## Documentação

- **Uso:** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Comandos](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **Projeto:** [Definição do produto](docs/PRODUCT_en.md) · [Matriz de suporte](docs/SUPPORT-MATRIX_en.md) · [Segurança](SECURITY.md)
- **Desenvolvimento e contribuições:** [Índice de documentação](MANIFEST_en.md) · [Guia de contribuição](CONTRIBUTING.md)

## Licença

[Apache License 2.0](LICENSE)
