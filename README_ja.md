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

Dev Flow は、合意した依頼、予定パス、分析後に作成した検証計画、現在の段階、結果を 1 つのローカル作業として
保存します。コードの変更は引き続き Codex または DeepSeek が行います。

新しい依頼はすべて、Dev Flow を選ぶ前に読み取り専用で評価されます。選択後は remote、base
branch、新しい task branch を確認し、Host がそのリモート基準からクリーンな専用 worktree を作成して
から Core が Task を作ります。元の checkout の変更はコピーされません。

リポジトリの調査とコードインデックスの利用は、現在のユーザー指示と適用される `AGENTS.md` に従います。
これらの指示でプロジェクトインデックスの確認が求められる場合、Host はユーザー確認前に候補リポジトリを
読み取り専用で調査し、確認された範囲を Task に固定します。これらの指示はプラグインのコードインデックス設定より優先されます。

- **範囲を明確に保ちます。** 予定パスを記録し、対応する構造化ツールが計画外ファイルへ書く前に
  確認し、テストとデリバリーの前に実際の変更をもう一度照合します。
- **worktree ごとに変更の所有者を固定します。** Core は専用 worktree の Git 状態からTask の実際の変更を
  計算します。通常の線形 commit は継続でき、branch rewrite や worktree の置き換えは停止します。
- **検証量を作業に合わせます。** TASKS で確認項目、理由、初期投入量、フルスイートとテストコードの
  予定を保存します。具体的な新しい影響、リスク、失敗、不足がある場合だけ予算を増やせます。
- **レビューを現在の変更に限定します。** 変更後は diff、因果関係のある影響、受け入れ条件だけを確認し、
  修正後は関連箇所だけを再確認します。明示的な code review は読み取り専用です。
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
テスト上限をできるだけ具体的に書いてください。最初の応答では影響を評価し、直接作業するか
Dev Flow を使うかを尋ねます。明示 selector でもこの選択は省略されません。Dev Flow を選んだら
remote、base、target branch を確認します。Codex は Host が対応していれば managed worktree を開き、
DeepSeek は現在の Workspace Root が固定されるため、新しい worktree からの再起動方法を示します。

### 3. 再開して進捗を確認する

セッションの再起動後は、Task に結び付いた元の worktree で、そのタスクの続行を明示的に依頼します。
システムは元の worktree を確認し、保存済みのタスク状態から処理を続けます。依頼内容を再評価したり、
Dev Flow を使うかどうかを再び選んだりする必要はありません。元の worktree が消失または置換されている
場合は、復元するかタスクの放棄（abandon）を明示するまで停止します。別の worktree には切り替えません。

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

## ローカルビルドのデスクトップペット

macOS arm64 のローカル開発パッケージにはデスクトップペットが含まれます。設定済みの Codex または DeepSeek Adapter が少なくとも一つあれば、選択した一つのタスクの保存済み段階と停止理由を表示し、クリックで対応する WebUI を開けます。メニューでタスク選択、アニメーション、表示と非表示を操作できます。表示するのは Core に保存された状態であり、Host の現在の実行状況や完了率は示しません。終了してもタスクと WebUI は保持されます。[ローカルビルド手順](docs/COMMANDS_en.md#desktop-pet-local-development-package)を参照してください。公開サポート範囲は引き続きサポート表に従います。

ペットのメニューから単一の PNG、Dev Flow アニメーションパック、Codex スプライト形式 1/2 のパックを読み込めます。選択と読み込んだ素材は更新後も保持されます。[外観パックの説明](docs/DESKTOP-PETS_en.md)を参照してください。

```bash
dev-flow pet start
dev-flow pet stop
```

## ドキュメント

- **使い方：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **プロジェクト：** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## ライセンス

[Apache License 2.0](LICENSE)
