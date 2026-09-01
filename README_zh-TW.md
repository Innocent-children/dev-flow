<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>讓長時間 AI 程式開發工作從持久狀態繼續，並在執行中守住任務範圍、驗證預算與交付條件。</strong></p>

<p align="center">
  <a href="README.md">简体中文</a> · <a href="README_en.md">English</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

> 此頁是穩定文件快照。最新且持續同步的產品說明請參閱
> [简体中文](README.md) 或 [English](README_en.md)。

Dev Flow 是長時間 AI 程式開發工作的本機流程控制與恢復層。它不只在聊天記錄之外保存進度，還會
限制 Task 範圍與驗證擴張，讓不再適用的舊記錄失效；在內容壓縮、repository 漂移或操作結果不確定
時，Codex 或 DeepSeek 可以從同一個 Task 取得下一步、Recovery 判斷或明確阻塞。

## 它解決的主要問題

長時間任務中斷後，新會話常只能根據殘缺聊天與目前 repository 猜測進度，因而重複修改、跳過剩餘
驗證，或把舊測試結果當成目前結果。Dev Flow 先讀取本機 Task，再從保存的階段與下一步繼續。

## 30 秒理解

| 直接使用 Agent | Dev Flow 增加的能力 |
| --- | --- |
| 會話中斷後重新猜測進度 | 恢復同一個本機 Task |
| 局部任務逐漸擴大範圍 | 保存最初目標與明確邊界 |
| 定向測試不斷擴大 | 保存 verification budget |
| 操作回應遺失後直接重試 | 先讀取目前 Task 與 Recovery 狀態 |
| 測試結果與後續程式變更混在一起 | 保存目前階段及相應記錄 |

## 適合與不適合

Dev Flow 適合跨會話、跨天或 Host 重啟後繼續的真實 repository 工作，尤其是需要明確範圍、定向
驗證、返工路徑或交付前理解確認的任務。

一次性問答、程式解釋、狀態查詢或不需保存進度的機械性小修改，直接使用 Codex 或 DeepSeek 通常
更簡單。Dev Flow 不是通用任務編排器、遠端執行平台或安全 sandbox。

## 與其他工具的關係

| 工具 | 職責 |
| --- | --- |
| Codex / DeepSeek | 讀取 repository、修改程式並執行命令 |
| OpenSpec / Spec Kit | 協助整理需求、設計與任務 |
| Dev Flow | 保存 Task 階段、範圍、驗證預算、恢復狀態與合法下一步 |

目前沒有 OpenSpec / Spec Kit artifact importer；更薄的整合仍是未來方向。

## 安裝與啟動

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

Codex 明確入口：

```text
$dev-flow-codex:dev-flow 修正登入失敗次數限制，只執行定向測試。
```

DeepSeek Harness 明確入口：

```text
/dev-flow 修正登入失敗次數限制，只執行定向測試。
```

## 目前穩定支援與邊界

| 產品 | 已驗證環境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

- Core 僅以唯讀方式觀察 Git，不執行 commit、push、merge、rebase、tag 或 publish。
- 檔案修改與命令執行仍由使用者授權的 Codex 或 DeepSeek 完成。
- Core 不攔截 Host 的每一次檔案操作，也不是 shell 或檔案系統 sandbox。
- WebUI 僅是本機 loopback 的單使用者檢視與診斷入口。
- 專案仍處於早期，外部採用有限；穩定範圍以 Support Matrix 為準。

## 目前文件

- [English README](README_en.md)
- [產品定義](docs/PRODUCT_en.md)
- [中斷後繼續的 Demo](docs/DEMO_en.md)
- [Project Status](docs/PROJECT-STATUS_en.md)
- [Support Matrix](docs/SUPPORT-MATRIX_en.md)
- [Command Reference](docs/COMMANDS_en.md)
- [Architecture](docs/ARCHITECTURE_en.md)
- [Security](SECURITY.md) 與 [Threat Model](docs/THREAT-MODEL_en.md)

## License

[Apache License 2.0](LICENSE)
