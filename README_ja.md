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
- **完了結果と復旧を確認できます。** Core は計画した全作業の完了と、各受け入れ条件に対応する現在有効な検証を確認します。WebUI が中断しても、Core に保存された送信内容から復旧できます。

## ファイルの提出準備

Codex は提出前に `dev-flow-codex artifacts collect` と `dev-flow-codex artifacts prepare` を実行します。Core が現在の Action の変更をすべて列挙し、Codex が各ファイルを分類すると、コマンドが artifact 配列を生成します。申告漏れには正確なパスと範囲を限定した修正手順を返します。作業ツリー、履歴、ノードの権限チェックは維持されます。[ファイルの収集と提出](docs/ARTIFACTS_en.md)を参照してください。

## クイックスタート

> npm の `@latest` で公開されている安定版は、現在 macOS arm64 で検証済みです。Node.js `>=24` と、対応する Codex
> または DeepSeek Harness をあらかじめインストールしてください。正確なバージョンとほかの環境は
> [Support Matrix](docs/SUPPORT-MATRIX_en.md) を参照してください。

### 1. Dev Flow をインストールする

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

ライフサイクルメニューには Adapter のインストール状態が表示され、戻る・終了・入力エラーの再試行と Control Center の起動ができます。確認前にバージョンの変更とリソースのパスを表示します。`install`、`repair`、`reinstall` は既定でインストール済みのバージョンを維持し、`upgrade` は `latest` を選択します。正常な環境での再インストール要求や修復、対象バージョンへの更新済み状態、削除済み状態では変更しません。`reinstall` はパッケージを再度置き換えます。`doctor` は失敗したチェックと対処コマンドを表示します。引数は `dev-flow repair --help` を参照してください。JSON モードでは質問しません。これらは Adapter を管理するコマンドで、共通ランチャーの更新には `npm install -g @imotong/dev-flow@latest` を使用します。

対話形式の設定で Codex、DeepSeek、または両方を選択します。最初の作業を始める前に、
インストーラーが案内する仕上げの操作も行ってください。

- **Codex：** `/hooks` を開き、Dev Flow に含まれる hook を確認して信頼します。信頼するまで、
  対応する `apply_patch` の書き込み前確認は有効になりません。
- **DeepSeek Harness：** インストール後、選択した DSH Profile を再起動します。

現在のソース版 Adapter には DSH `>=0.1.2-rc.1` が必要です。各 Dev Flow 操作では、現在のユーザーの直接入力による許可を確認します。

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

新しい Codex セッションを開始する前に、元のセッションは今回の要件に関する議論の原文と構造化した引き継ぎ資料を保存し、確定した要件、未採用の提案、未解決の質問を区別します。デスクトップの新規タスクと CLI の再起動は同じ保存済み資料を使用し、長い内容は切り詰めずに完全なファイルで渡します。[アーキテクチャ](docs/ARCHITECTURE_en.md#codex-requirements-handoff)を参照してください。

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

## デスクトップペット（macOS arm64）

ローカルのペットパッケージには標準の外見が含まれます。鯨娘などのカスタム外見は別の素材パックとして読み込みます。読み込んだ素材はアプリの更新後も保持されます。

デスクトップペットは、`DevFlowPet.app` を含む macOS arm64 向けローカル開発パッケージで利用できます。通常の npm ファイル一覧と正式リリースの準備処理にはネイティブアプリが含まれません。ビルド済みパッケージの実行に Swift/Xcode は不要で、設定済みの Codex または DeepSeek Adapter が Core を提供します。ペットは一つの Task の保存済み状態と対応する WebUI を表示し、Host のリアルタイム活動や完了率を推測しません。終了しても Task と WebUI は保持されます。

静的 PNG/SVG、PNG/SVG ネイティブアニメーションパック、Codex 形式 1/2 のアトラスを読み込めます。ネイティブパックは5種類のタスク動作が必須で、4種類の動作を追加できます。Codex アトラスからは9種類、57フレームを抽出します。Dev Flow 独自の高解像度拡張を Codex でも使うには、標準サイズのアトラスを別途用意してください。利用可能な素材に応じて待機中に歩く、手を振る、考える動作を行います。待機アクティビティには独立した切替があり、タスク通知を優先します。アプリの更新と素材の再読み込みは別の操作です。

メニューバーには Dev Flow の曲線的なロゴを単色で表示し、システムの外観に合わせて色が変わります。ペットの大きさは50%～200%の6段階で変更でき、吹き出しの文字サイズは維持されます。標準の姿は9種類の動作、312枚の SVG フレームを含む独立した素材パックとして同梱されます。

タスクが未選択の間、ペットは新しいタスクを継続的に探し、最終更新が最も新しいブロック中のタスクを優先し、なければ最終更新が最も新しい進行中のタスクを選択します。選択後は、手動で変更するまで同じタスクを表示します。

アプリの入手、インストール、更新、動作条件、制限、トラブルシューティングは[デスクトップペットガイド](docs/DESKTOP-PETS_en.md)を参照してください。公開サポート範囲はサポート表に従います。

```bash
dev-flow pet start
dev-flow pet stop
```

## ドキュメント

- **使い方：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **プロジェクト：** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## ライセンス

[Apache License 2.0](LICENSE)

## Windows デスクトップ対応

Windows 10/11 x64 は、Intel または AMD の 64 ビットプロセッサを搭載した一般的なデスクトップ PC を対象とします。Host のパス、権限、コマンド、削除処理は `platform/windows/` と `platform/macos/` に分離し、Core はプラットフォームに依存しないタスクの意味規則を共有します。Windows のコマンド起動処理は UTF-8 を使用し、Core の Git 観測ではコンソールウィンドウを表示しません。Windows 実機検証の結果と制限は[対応レポート](docs/WINDOWS-ADAPTATION_en.md)を参照してください。安定版パッケージのサポート範囲は拡大しません。

Windows でもデスクトップペットを利用できます。タスク選択と状態表示、トレイメニュー、PNG/SVG の外観、ネイティブアニメーション、Codex PNG/WebP アトラス、9 種類の動作、ドラッグ、6 段階のサイズ、非表示と復帰、個別の起動と停止に対応します。`node scripts/build-desktop-pet-windows.mjs --output "C:\pet-build"` で Windows ローカルパッケージをビルドできます。依存関係の準備とインストールは[デスクトップペットガイド](docs/DESKTOP-PETS_en.md)を参照してください。Windows と macOS のデスクトップ実装は独立しています。
Windows では、サイズを変更すると実行中の待機動作を終了し、通常のスケジュールに戻ります。

Windows では、パッケージ化されたデスクトップホストのディレクトリエイリアスを含め、既存の AppData ディレクトリを実際のパスに解決します。シンボリックリンクは引き続き拒否します。

現在の Windows 開発パッケージには、両 Adapter とデスクトップアプリが含まれます。ランチャーをインストールした後、`dev-flow install --host all --yes` と `dev-flow pet start` を使用します。修復と再インストールも同じ入口で行い、同梱パッケージのハッシュを確認してアプリを更新し、Task データ、設定、外観を保持します。

`dev-flow-codex host-launch <operation>` は stdin ストリームから最大 1 MiB の UTF-8 JSON オブジェクトを読み取り、分割入力とチャンクをまたぐマルチバイト文字に対応します。読み取り失敗、不正な UTF-8、重複メンバー、不正な JSON、配列、null は操作の実行前に拒否されます。エラーは stderr、成功時の JSON 結果は stdout に出力されます。

## コマンドヘルプとタスクの再開

Codex のコマンドヘルプでは、作業ツリー操作の引数、戻り値のフィールド、次の手順を確認できます。すべてのリポジトリの準備が完了すると、Host が保存済みの作業ツリー情報をまとめます。MCP の結果 Schema は Task と Action の参照位置を示し、セッション再開時には未完了の送信を先に処理します。

```bash
dev-flow-codex --help
dev-flow-codex host-launch prepare --help
```

引数と復旧手順は[コマンドリファレンス](docs/COMMANDS_en.md)を参照してください。
