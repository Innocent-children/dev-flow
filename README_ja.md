<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow アイコン" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>長時間の AI コーディング作業を、決めた変更範囲とテスト上限の内側に保ちます。</strong></p>

<p align="center">Codex と DeepSeek のための、ローカルなガードレール、永続的な進捗、安全な復旧。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="安定版プラットフォーム: macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#クイックスタート">クイックスタート</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#ドキュメント">ドキュメント</a>
</p>

## 承認した範囲にタスクを保つ

長時間のコーディング作業は、一度に失敗するよりも少しずつ脱線します。計画外のファイルが 1 つから
3 つに増え、対象を絞った確認が際限のないテストになり、同じ失敗から似た修正が繰り返され、再起動後は
不完全なチャット履歴から進捗を復元することになります。

Dev Flow は、合意した依頼、予定パス、検証予算、現在の段階、結果をローカルの Task に保存します。
コードの読み取り、ファイル変更、コマンド実行は引き続き Codex または DeepSeek が担当し、範囲変更、
繰り返し、復旧、デリバリーは Dev Flow が明示的な判断として扱います。

## 制御するもの

| 項目 | Dev Flow の動作 |
| --- | --- |
| **変更範囲** | 予定パスを記録し、対応する計画外書き込みを一時停止し、テスト前と完了前に累積変更パスを再確認します。 |
| **検証コスト** | コマンド予算を保持し、フルスイートには事前許可を求め、同じ失敗または変化のない結果の 3 回目の完全一致で停止します。 |
| **永続的な進捗** | Task をチャットの外に保存し、新しいセッションでも同じ段階、制限、記録、Blocker を再開できます。 |
| **現在も有効な結果** | 依頼、計画、実装、repository が変わると、適用できなくなったテストと理解確認を無効にします。 |
| **開発者の確認** | デリバリー前に、実際の変更、不要な複雑さ、保守リスクを開発者が確認します。 |

## クイックスタート

> 安定版 npm `@latest` は現在 macOS arm64 で検証済みです。Host Adapter には Node.js `>=24` が
> 必要です。ほかの環境へインストールする前に [Support Matrix](docs/SUPPORT-MATRIX_en.md) を確認してください。

### 1. インストールして Host に接続する

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

対話形式のセットアップで、Codex、DeepSeek、または両方に Dev Flow をインストールできます。
後から同じ入口で状態確認、診断、アップグレード、修復、削除も行えます。

### 2. 境界を決めた Task を開始する

**Codex** では、次の内容をユーザーメッセージとして送信します。

```text
$dev-flow-codex:dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

**DeepSeek Harness** では、次を送信します。

```text
/dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

これは shell コマンドではなく、会話用の selector です。目標、受け入れ条件、ファイル境界、
テスト上限をできるだけ具体的に書いてください。

### 3. 再開または確認する

セッションの再起動後は、Task に参加している repository に戻り、同じ Host selector をもう一度
使います。Dev Flow は保存済み Task を読み、会話から進捗を再構築せず現在の段階から再開します。

```bash
# Adapter の状態を読み取り専用で確認
dev-flow status --host all

# ローカル Control Center を開く
dev-flow webui start
```

Control Center では、現在の段階、予定パスと実際のパス、確認履歴、Blocker、復旧案、次の判断を
確認できます。Codex、DeepSeek、画面はすべて同じローカル Task データを読みます。

非対話セットアップ、Host 固有コマンド、DeepSeek のカスタム Profile、アップグレード、削除は
[Command Reference](docs/COMMANDS_en.md) を参照してください。

## Task 中の動作

1. **境界を決める。** Task に依頼、参加 repository、予定パス、作業項目、検証予算を保存します。
2. **Host で作業する。** Codex または DeepSeek がコードを変更し、対応する構造化ファイルツールは計画外パスへ書く前に確認します。
3. **実際の変更を照合する。** テスト前と完了前に、書き込み前確認を通らなかった変更も含め、Task の累積変更パスを Core が再確認します。
4. **無益なループを止める。** 3 回目の完全一致で Task を一時停止し、別の方法か明示的な続行許可を求めます。
5. **現在の結果だけを届ける。** 後のコード変更で古い確認は無効になります。テストと開発者の理解確認は最終実装と一致する必要があります。

操作が明確な応答なしで終了した場合、再試行が安全か判断する前に、保存済み Action と現在の
repository を読み取ります。

## 使いどころ

| Dev Flow が向いている場合 | Host を直接使う方が簡単な場合 |
| --- | --- |
| 作業が複数セッション、再起動、数日にまたがる | 一度きりの質問やコード説明 |
| 変更ファイルとテスト量に明確な上限が必要 | 進捗保存が不要な小さな機械的変更 |
| 手戻りで古い結果を再利用してはいけない | 状態確認や設計相談だけが必要 |
| デリバリー前に開発者の明確なレビューが必要 | 永続 Task や復旧状態が不要 |

## サポート

| 安定版 npm `@latest` 製品 | 検証済み環境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

現在のソースにはローカル WebUI と正確な `win32-x64` runtime も含まれますが、Windows にはまだ
安定版 `@latest` Host Journey がありません。安定プラットフォームの範囲は
[Support Matrix](docs/SUPPORT-MATRIX_en.md) に従い、安定リリース、ソースのみの機能、公開 Journey、
現在の課題は [Project Status](docs/PROJECT-STATUS_en.md) にまとめています。

## 境界

- Dev Flow は制御レイヤーであり、コーディング Agent ではありません。ユーザーが許可した Codex または DeepSeek がファイル変更とコマンドを実行します。
- Go Core は Git を読み取り専用で観察し、commit、push、merge、rebase、tag、publish を行いません。
- 書き込み前確認は列挙された Host の構造化ツールだけが対象です。Bash と外部ツールは先に書き込む場合があるため、shell やファイルシステムの sandbox ではありません。
- Control Center はローカル loopback の単一ユーザー向けで、リモートアクセス、クラウド同期、チーム権限はありません。

## ドキュメント

- **概要：** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **使い方：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **仕組み：** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **安全性と貢献：** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## ライセンス

[Apache License 2.0](LICENSE)
