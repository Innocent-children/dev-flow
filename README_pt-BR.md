<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Mantenha tarefas longas de programação com IA dentro dos limites de mudança e teste definidos, e confirme se o estado atual é confiável antes de continuar.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Quando uma tarefa começa a sair do controle

Imagine pedir a um Agent:

```text
Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

A tarefa demora mais. O Agent quer alterar uma configuração vizinha, o mesmo teste continua falhando e
a sessão reinicia antes do fim. Só o chat já não responde com segurança se o arquivo extra pertence ao
trabalho, quantos testes ainda cabem, se outra tentativa trará informação ou se um resultado antigo vale
para o código atual.

Dev Flow mantém essas decisões junto da tarefa. O Agent continua lendo e alterando código e executando
comandos; ampliar o escopo, testar mais, repetir e concluir passam a ser escolhas visíveis.

## O que muda com Dev Flow

| Agent direto | Com Dev Flow |
| --- | --- |
| Limites de arquivo ficam apenas no prompt | Arquivos previstos são registrados e uma gravação compatível fora do plano espera sua decisão |
| “Só testes direcionados” pode crescer sem fim | Verificações automáticas têm limite; a suíte completa exige permissão prévia |
| A mesma falha provoca outra correção parecida | A terceira repetição exata para e exige outro caminho ou aprovação |
| Após reiniciar, o progresso é reconstruído do chat | A mesma tarefa, seus limites e verificações pendentes continuam |
| Um resultado verde sobrevive a mudanças posteriores | Resultados que não correspondem mais são descartados antes da entrega |

## As diferenças principais

### A tarefa não cresce em silêncio

Cada trabalho guarda arquivos previstos e verificações necessárias. Ferramentas compatíveis param antes
de escrever fora do plano; você permite uma vez, altera o plano ou recusa. Antes dos testes e da conclusão,
os caminhos realmente modificados são comparados novamente.

### Repetir precisa trazer informação

Dev Flow compara as três últimas tentativas e só pausa quando a mesma falha, resultado ou padrão de caminhos
e falha se repete exatamente. Se pedido, plano ou implementação mudar, testes e confirmações antigos deixam de valer.

### Continuar sem adivinhar nem repetir às cegas

Pedido, plano, avanço, verificações e motivos de parada ficam salvos localmente. Outra sessão continua a
mesma tarefa. Se uma operação ficar incerta, o estado salvo e o repository atual são lidos antes de decidir nova tentativa.

### O desenvolvedor decide o fim

Passar nos testes não basta. Antes da entrega, o desenvolvedor revisa mudanças, complexidade desnecessária e
riscos de manutenção, e confirma que consegue explicar e manter o resultado.

### Ver toda a tarefa localmente

O código atual inclui um Control Center local para tarefas Codex e DeepSeek, progresso, caminhos previstos e
reais, histórico de testes, pausas e próximas decisões. Não é um painel em nuvem.

## Início rápido

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
/dev-flow Adicione limite de frequência para falhas de login. Altere apenas arquivos de autenticação e execute no máximo 4 verificações direcionadas.
```

## Quando usar

Dev Flow serve para trabalho real de repository entre sessões, com limites de arquivos ou testes, possível
retrabalho ou entrega clara. Para perguntas, explicações, estado e pequenas mudanças mecânicas, o Agent sozinho é mais simples.

## Escopo realmente disponível

### npm `@latest` estável

| Produto | Ambiente verificado |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

Registros estáveis cobrem instalação, prontidão, remoção, desinstalação e repository alvo inalterado.
A Journey estável DeepSeek também cobre ativação, reinício, conclusão e reabertura.

### Fonte atual e registros públicos

- A fonte inclui WebUI local, decisões de escopo, freio automático e `darwin-arm64`/`win32-x64`.
- Windows ainda é capacidade de fonte: há registros nativos Windows 11, sem Journey estável.
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) documenta Journey Codex real com reinício, refatoração, novos testes, revisão, entrega e conclusão.

### Ainda não demonstrado ou estável

- Menor custo de testes, defeitos ou manutenção não foi demonstrado; adoção prolongada é limitada.
- Linux, Windows Server, Windows 32-bit/ARM64, Intel Mac, Rosetta e remote MCP não têm suporte estável.
- Visão de equipe, sincronização cloud, exportação de Task e passagem explícita entre Hosts são futuros.

## Limites e documentação

- Core observa Git somente para leitura e não executa commit, push, merge, rebase, tag ou publish.
- A verificação prévia cobre apenas ferramentas estruturadas indicadas; não é sandbox de shell ou arquivos.
- WebUI é local, loopback e de um usuário.
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## Licença

[Apache License 2.0](LICENSE)
