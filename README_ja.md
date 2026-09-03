<h1 align="center">Dev Flow</h1>

<p align="center"><strong>長時間の AI コーディング作業を、決めた変更範囲とテスト上限の内側に保ち、再開前に結果を信頼できるか確認します。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## コーディング作業が脱線し始めるとき

Agent に次のように依頼したとします。

```text
ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

作業が長引き、隣の設定ファイルも変更したくなり、同じテストが失敗し続け、残りの確認を終える前に
セッションが再起動しました。チャットだけでは、追加ファイルが本当に必要か、あと何件テストできるか、
次の再試行に意味があるか、以前の合格結果が今のコードにも使えるかを判断しにくくなります。

Dev Flow はこうした判断をタスクと一緒に保持します。Agent は通常どおりコードを読み、変更し、
コマンドを実行しますが、範囲拡大、追加テスト、繰り返し、完了は見える判断になります。

## Dev Flow があると何が変わるか

| Agent を直接使う | Dev Flow を使う |
| --- | --- |
| ファイル制限はプロンプトだけ | 予定ファイルを記録し、対応する計画外書き込みは判断を待つ |
| 「対象テストだけ」が際限なく増える | 自動確認に上限があり、フルスイートは事前許可が必要 |
| 同じ失敗で似た修正を繰り返す | 3 回目の完全一致で止まり、別案か明示的な続行を求める |
| 再起動後に不完全な会話から進捗を復元 | 同じ作業、制限、残りの確認を続ける |
| コード変更後も古い合格結果を使う | 現在のコードに合わない結果はデリバリー前に無効になる |

## 主な違い

### 作業が勝手に広がらない

各作業には予定ファイルと必要な確認があります。対応するツールが計画外ファイルへ書く前に停止し、
その 1 回だけ許可、計画変更、拒否を選べます。テスト前と完了前にも実際の変更パスを照合します。

### 再試行には新しい情報が必要

直近 3 回のテストを比較し、同じ失敗、同じ結果、または同じファイル変更と失敗が完全に繰り返された
ときだけ停止します。要件、計画、実装が変われば、古いテストと開発者確認は使えなくなります。

### 推測や盲目的な再実行なしで続ける

依頼、計画、進捗、確認記録、停止理由はローカルに保存されます。別セッションでも同じ作業を続けられ、
操作結果が不明なら保存内容と現在の repository を読んでから再試行を判断します。

### 完了は開発者が決める

テスト合格だけでは終わりません。開発者が変更、不要な複雑さ、保守リスクを確認し、説明して保守できる
ことを明示的に承認します。その後コードが変われば再テストします。

### ローカルで全体を確認する

現在のソースにはローカル Control Center があり、Codex と DeepSeek の作業、進捗、予定と実際のパス、
テスト履歴、繰り返し停止、次の判断を表示します。クラウドサービスではありません。

## クイックスタート

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
/dev-flow ログイン失敗のレート制限を追加してください。認証関連のファイルだけを変更し、対象を絞った確認を最大 4 件実行してください。
```

## 向いている作業

複数セッションにまたがる、ファイル範囲やテスト量を制限したい、手戻りや明確な引き継ぎがある実際の
repository 作業に向きます。一度きりの質問、説明、状態確認、小さな機械的変更は Agent 単体の方が簡単です。

## 現在利用できる範囲

### 安定版 npm `@latest`

| 製品 | 検証済み環境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

安定記録はインストール、準備完了、削除、アンインストール、対象 repository の不変性を対象にします。
DeepSeek の安定 Journey は明示的な起動、再起動、完了、保存データの再表示も対象です。

### 現在のソースと公開記録

- ソースにはローカル WebUI、ファイル範囲判断、自動繰り返し停止、`darwin-arm64` と `win32-x64` があります。
- Windows は現時点ではソース機能です。Windows 11 の実機記録はありますが、安定版 Host Journey はありません。
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) は再起動、リファクタリング、再テスト、理解確認、デリバリー、完了を含む実際の Codex Journey です。

### 未検証または未安定

- テスト費用、欠陥率、保守費用の低下は外部利用で証明されておらず、長期採用記録も限られます。
- Linux、Windows Server、32 ビット/ARM64 Windows、Intel Mac、Rosetta、remote MCP に安定サポートはありません。
- チーム表示、クラウド同期、Task エクスポート、明示的な Host 間引き継ぎは将来の機能です。

## 境界とドキュメント

- Core は Git を読み取り専用で観察し、commit、push、merge、rebase、tag、publish を行いません。
- 書き込み前確認は列挙された構造化ツールだけが対象で、shell やファイルシステムの sandbox ではありません。
- WebUI はローカル loopback の単一ユーザー向けです。
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## License

[Apache License 2.0](LICENSE)
