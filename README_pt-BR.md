<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>Retome tarefas longas de programação com IA a partir de um estado persistente, mantendo explícitos o escopo, o orçamento de verificação e as condições de entrega.</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> Esta página é um retrato estável da documentação. Para informações atuais e sincronizadas
> continuamente, consulte [English](README.md) ou [简体中文](README_zh-CN.md).

Dev Flow é uma camada local de controle e recuperação para tarefas longas de programação com IA. Ele
não apenas mantém o progresso fora do chat: também limita o escopo do Task e a expansão das
verificações, invalidando registros antigos que não correspondem mais à implementação atual. Após
compactação de contexto, divergência do repository ou um resultado incerto, Codex ou DeepSeek obtém
do mesmo Task o próximo passo, uma avaliação de Recovery ou um bloqueio explícito.

## O principal problema

Depois de uma interrupção, uma nova sessão costuma reconstruir o progresso a partir de um chat
incompleto e do repository atual. Isso pode repetir alterações, ignorar verificações restantes ou usar
resultados antigos como atuais. Dev Flow lê primeiro o Task local e continua da etapa e do próximo
passo salvos.

## Em 30 segundos

| Usando um Agent diretamente | O que Dev Flow acrescenta |
| --- | --- |
| Após uma interrupção, o progresso é adivinhado novamente | Retoma o mesmo Task local |
| Uma tarefa pequena amplia gradualmente o escopo | Mantém o objetivo inicial e limites explícitos |
| Testes direcionados continuam aumentando | Mantém o verification budget |
| Uma resposta perdida causa nova tentativa imediata | Lê primeiro o Task e o estado de Recovery |
| Resultados de testes se misturam com mudanças posteriores | Mantém a etapa atual e seus registros |

## Quando usar

Dev Flow é adequado para trabalho real em repository que continua entre sessões, dias ou reinícios do
Host, especialmente quando exige escopo claro, verificação direcionada, caminhos de retrabalho ou uma
revisão de compreensão antes da entrega.

Para perguntas pontuais, explicações de código, consultas de status ou pequenas mudanças mecânicas
sem progresso persistente, normalmente é mais simples usar Codex ou DeepSeek diretamente. Dev Flow
não é um orquestrador geral, uma plataforma de execução remota ou um sandbox de segurança.

## Relação com outras ferramentas

| Ferramenta | Responsabilidade |
| --- | --- |
| Codex / DeepSeek | Ler repositories, alterar código e executar comandos |
| OpenSpec / Spec Kit | Ajudar a organizar requisitos, design e tarefas |
| Dev Flow | Manter etapa, escopo, orçamento de verificação, Recovery e próximo passo válido do Task |

Atualmente não existe um artifact importer para OpenSpec / Spec Kit. Uma integração mais leve
continua sendo uma direção futura.

## Instalação e início

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Entrada explícita do Codex:

```text
$dev-flow-codex:dev-flow Corrija o limite de falhas de login e execute apenas testes direcionados.
```

Entrada explícita do DeepSeek Harness:

```text
/dev-flow Corrija o limite de falhas de login e execute apenas testes direcionados.
```

## Suporte estável e limites atuais

| Produto | Ambiente verificado |
| --- | --- |
| `dev-flow-codex` | macOS arm64, Node.js `>=24`, Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64, Node.js `>=24`, DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64, Node.js `>=20` |

- Core observa Git somente para leitura e não executa commit, push, merge, rebase, tag ou publish.
- Alterações de arquivos e execução de comandos continuam com Codex ou DeepSeek autorizado pelo usuário.
- Core não intercepta toda operação do Host e não é um sandbox de shell ou sistema de arquivos.
- WebUI é uma visualização local loopback e entrada de diagnóstico para um único usuário.
- O projeto ainda está no início e a adoção externa é limitada; o escopo estável está na Support Matrix.

## Documentação atual

- [English README](README.md)
- [Product Definition](docs/PRODUCT_en.md)
- [Demo de interrupção e retomada](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) e [Threat Model](docs/THREAT-MODEL_en.md)

## Licença

[Apache License 2.0](LICENSE)
