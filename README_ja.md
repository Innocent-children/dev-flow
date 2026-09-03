<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow アイコン" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>長時間の AI コーディングでも、変更範囲・検証上限・現在の進捗をセッションをまたいで保持します。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 長い作業の脱線を防ぐ

コーディング作業は長引くほど、少しずつ形が変わりがちです。変更対象のファイルが増え、絞り込んだ
確認が際限のないテストになり、同じ失敗に対して似た試行を繰り返し、セッションの再起動後には
チャット履歴から進捗を組み立て直すことになります。

Dev Flow は、合意した依頼、予定パス、検証上限、現在の段階、結果を 1 つのローカル作業として
保存します。コードの変更は引き続き Codex または DeepSeek が行います。

- **範囲を明確に保ちます。** 予定パスを記録し、対応する構造化ツールが計画外ファイルへ書く前に
  確認し、テストとデリバリーの前に実際の変更をもう一度照合します。
- **検証量に上限を設けます。** 自動確認のコマンド数を制限し、フルスイートには事前許可を求め、
  3 回目の完全な繰り返しで作業を一時停止します。
- **再起動後も続行できます。** 新しいセッションで同じ作業、残りの確認、現在の判断を復元し、
  会話から作り直す必要をなくします。
- **現在も有効な結果だけを使います。** 依頼、計画、実装、リポジトリが変わると古い確認を無効にし、
  デリバリー前に開発者が実際の結果を確認します。

## クイックスタート

> npm の `@latest` で公開されている安定版は、現在 macOS arm64 で検証済みです。Node.js `>=24` と、対応する Codex
> または DeepSeek Harness をあらかじめインストールしてください。正確なバージョンとほかの環境は
> [Support Matrix](docs/SUPPORT-MATRIX_en.md) を参照してください。

### 1. Dev Flow をインストールする

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

対話形式の設定で Codex、DeepSeek、または両方を選択します。最初の作業を始める前に、
インストーラーが案内する仕上げの操作も行ってください。

- **Codex：** `/hooks` を開き、Dev Flow に含まれる hook を確認して信頼します。信頼するまで、
  対応する `apply_patch` の書き込み前確認は有効になりません。
- **DeepSeek Harness：** インストール後、選択した DSH Profile を再起動します。

### 2. 作業を開始する

**Codex** では、次の内容をユーザーメッセージとして送信します。

```text
$dev-flow-codex:dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

**DeepSeek Harness** では、次を送信します。

```text
/dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

これは shell コマンドではなく、会話用の selector です。目標、受け入れ条件、ファイル範囲、
テスト上限をできるだけ具体的に書いてください。

### 3. 再開して進捗を確認する

セッションの再起動後は、同じリポジトリの作業ディレクトリに戻り、同じ selector をもう一度使います。
Dev Flow は保存済みの作業を読み、現在の段階から続行します。

```bash
# インストール済みの連携を確認
dev-flow status --host all

# ローカルの作業画面を開く
dev-flow webui start
```

非対話形式のインストール、独自の DSH Profile、アップグレード、修復、削除については
[Command Reference](docs/COMMANDS_en.md) を参照してください。

## 適している作業

Dev Flow は、複数セッションにまたがる、ファイル範囲やテスト量を明確に制限したい、または
手戻りの際に古い結果を再利用したくないリポジトリ作業に向いています。

一度きりの質問、コード説明、状態確認、進捗保存を必要としない小さな機械的変更では、Codex や
DeepSeek を直接使う方が簡単です。

## ドキュメント

- **使い方：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **プロジェクト：** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## ライセンス

[Apache License 2.0](LICENSE)
