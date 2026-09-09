<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow アイコン" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>長時間の AI コーディングでも、変更範囲・検証上限・現在の進捗をセッションをまたいで保持します。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Dev Flow でできること

Dev Flow は、Codex や DeepSeek で長時間の AI コーディング作業を管理するためのツールです。
合意した要件、ファイル範囲、検証計画、進捗、結果をローカルに保存し、セッションが終わっても作業を続けられます。

- **変更範囲を明確にする：** 変更予定のファイルを記録し、実際の変更を計画と照合します。
- **検証を計画する：** 作業に必要な確認を選び、検証量に上限を設けます。
- **作業を再開する：** 元の作業ツリーに戻り、同じタスクの残りの作業を続けます。
- **結果を確認する：** 進捗、検証結果、対応が必要な問題を確認できます。

複数のセッションにまたがる作業や、ファイル範囲とテスト量を明確にしたいリポジトリ作業に向いています。
一度きりの質問、コードの説明、進捗保存が不要な小さな変更は、Codex や DeepSeek を直接使う方が簡単です。

## クイックスタート

> npm の安定版 `@latest` は、現在 macOS arm64 で検証済みです。Node.js `>=24` と、対応する
> Codex または DeepSeek Harness を先にインストールしてください。宿主のバージョン要件と他の環境は
> [サポート一覧](docs/SUPPORT-MATRIX_en.md)を参照してください。

### 1. Dev Flow をインストールする

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

対話形式の設定で Codex、DeepSeek、または両方を選び、インストーラーの案内に従います。

- **Codex:** `/hooks` を開き、Dev Flow の hook を確認して信頼すると、対応する書き込み前チェックが有効になります。
- **DeepSeek Harness:** インストール後、選択した DSH Profile を再起動します。

### 2. 作業を開始する

**Codex** では、次のメッセージを送信します。

```text
$dev-flow-codex:dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

**DeepSeek Harness** では、次を送信します。

```text
/dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

これらはターミナルではなく会話に送信します。目標、受け入れ条件、ファイル範囲、テスト上限を具体的に記載してください。

最初の応答では依頼を評価し、直接作業するか Dev Flow を使うかを尋ねます。Dev Flow を選んだら、
ローカルまたはリモートのソース、開始ブランチ、新しいタスクブランチ、既存のローカル変更を引き継ぐかを確認します。

作業は、タスク専用の独立したディレクトリである Git 作業ツリーで進めます。Codex は宿主が対応していれば
その作業ツリーを開き、DeepSeek は新しいディレクトリから再起動するコマンドを案内します。

実装前に、要件、設計、作業項目、変更予定のファイル、検証計画を確認して話し合います。計画全体への明確な承認後に開発を開始します。計画の修正やファイル範囲の拡大には再承認が必要です。Dev Flow やワークツリーの選択は計画の承認とは別です。

### 3. 再開して進捗を確認する

セッションを再起動したら、タスクの元の作業ツリーに戻り、続行を明示的に依頼してください。Dev Flow は保存済みの
進捗から再開します。元の作業ツリーが消失または置換された場合、復元するかタスクの放棄を明示するまで停止します。

DeepSeek Harness では、再開を依頼するメッセージにも `/dev-flow` を含めてください。

```bash
# インストール済みの連携を確認
dev-flow status --host all

# ローカルのタスク画面を開く
dev-flow webui start
```

非対話形式のインストール、独自の DSH Profile、更新、修復、削除については
[コマンドリファレンス](docs/COMMANDS_en.md)を参照してください。

## デスクトップペット

デスクトップペットは、選択したタスクの保存済み状態を表示し、WebUI を開きます。タスクの選択、外観の変更、
アニメーションの制御、サイズ変更、個別の起動と停止に対応しています。利用前に、上記のインストールと
Codex または DeepSeek の設定を完了してください。

```bash
dev-flow pet start
dev-flow pet stop
```

デスクトップアプリの対象は macOS arm64 と Windows 10/11 x64 です。インストールと操作は
[ペットガイド](docs/DESKTOP-PETS_en.md)、検証済みの利用範囲は[サポート一覧](docs/SUPPORT-MATRIX_en.md)を参照してください。

## 利用上の制限

専用の作業ツリーはコードの変更を分離します。プロセス、ネットワーク、認証情報、外部サービスは現在の環境と共有されます。

タスクが完了しても、コードのコミット、プッシュ、作業ツリーの削除は自動では実行されません。これらには別途許可が必要です。

## ドキュメント

- **使い方：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [コマンド](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **プロジェクト：** [製品定義](docs/PRODUCT_en.md) · [サポート一覧](docs/SUPPORT-MATRIX_en.md) · [セキュリティ](SECURITY.md)
- **開発と貢献：** [ドキュメント一覧](MANIFEST_en.md) · [貢献ガイド](CONTRIBUTING.md)

## ライセンス

[Apache License 2.0](LICENSE)
