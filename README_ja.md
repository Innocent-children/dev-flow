<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>長時間の AI コーディング作業を永続状態から再開し、実行中のタスク範囲、検証予算、デリバリー条件を明確に保ちます。</strong></p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> このページは安定版ドキュメントのスナップショットです。継続的に更新される最新情報は
> [简体中文](README.md) または [English](README_en.md) を参照してください。

Dev Flow は、長時間の AI コーディング作業向けのローカルなプロセス制御・復旧レイヤーです。
進捗をチャット履歴とは別に保存するだけでなく、Task の範囲と検証の拡大を制限し、現在の実装に
合わない古い記録を無効にします。コンテキスト圧縮、repository のずれ、結果が不明な操作の後は、
同じ Task から次の手順、Recovery 判断、または明示的な Blocker を取得できます。

## 最初に解決する問題

長時間の作業が中断されると、新しいセッションは不完全なチャットと現在の repository から進捗を
推測しがちです。その結果、変更の重複、残りの検証の見落とし、古いテスト結果の再利用が起きます。
Dev Flow はローカル Task を先に読み、保存済みの段階と次の作業から再開します。

## 30 秒で理解する

| Agent を直接使う場合 | Dev Flow が追加するもの |
| --- | --- |
| 中断後に進捗を推測し直す | 同じローカル Task を再開する |
| 小さな作業が徐々に範囲を広げる | 最初の目標と明確な境界を保存する |
| 対象を絞ったテストが拡大し続ける | verification budget を保存する |
| 応答が失われるとすぐ再実行する | 現在の Task と Recovery 状態を先に読む |
| テスト結果が後のコード変更と混ざる | 現在の段階と対応する記録を保存する |

## 向いている作業・向いていない作業

Dev Flow は、複数セッション、複数日、または Host 再起動をまたぐ実際の repository 作業に向いて
います。特に、範囲、対象を絞った検証、手戻り経路、配布前の理解確認が必要な変更に適しています。

一度きりの質問、コード説明、状態確認、進捗保存が不要な機械的な小変更は、Codex または DeepSeek
を直接使う方が簡単です。Dev Flow は汎用オーケストレーター、リモート実行基盤、セキュリティ
sandbox ではありません。

## 他のツールとの関係

| ツール | 役割 |
| --- | --- |
| Codex / DeepSeek | repository の読み取り、コード変更、コマンド実行 |
| OpenSpec / Spec Kit | 要件、設計、タスクの整理 |
| Dev Flow | Task の段階、範囲、検証予算、復旧状態、正当な次の手順を保存 |

現在、OpenSpec / Spec Kit artifact importer はありません。薄い連携は将来の方向です。

## インストールと開始

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Codex の明示的な入口：

```text
$dev-flow-codex:dev-flow ログイン失敗回数の制限を修正し、対象テストだけを実行してください。
```

DeepSeek Harness の明示的な入口：

```text
/dev-flow ログイン失敗回数の制限を修正し、対象テストだけを実行してください。
```

## 現在の安定サポートと境界

| 製品 | 検証済み環境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

- Core は Git を読み取り専用で観察し、commit、push、merge、rebase、tag、publish を行いません。
- ファイル変更とコマンド実行は、ユーザーが許可した Codex または DeepSeek が担当します。
- Core は Host のすべてのファイル操作を遮断せず、shell やファイルシステムの sandbox ではありません。
- WebUI はローカル loopback の単一ユーザー向け表示・診断入口です。
- プロジェクトはまだ初期段階で、外部利用は限定的です。安定範囲は Support Matrix に従います。

## 最新ドキュメント

- [English README](README_en.md)
- [Product Definition](docs/PRODUCT_en.md)
- [中断と再開の Demo](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) / [Threat Model](docs/THREAT-MODEL_en.md)

## License

[Apache License 2.0](LICENSE)
