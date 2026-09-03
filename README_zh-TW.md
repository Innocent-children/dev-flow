<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 圖示" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>讓長時間 AI 程式開發任務守住你設定的修改範圍與測試上限。</strong></p>

<p align="center">為 Codex 與 DeepSeek 提供本機限制、持久進度與安全復原。</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@imotong/dev-flow"><img alt="npm @latest" src="https://img.shields.io/badge/npm-%40latest-CB3837?style=flat-square&logo=npm&logoColor=white" /></a>
  <a href="docs/SUPPORT-MATRIX_en.md"><img alt="穩定平台：macOS arm64" src="https://img.shields.io/badge/platform-macOS%20arm64-111827?style=flat-square&logo=apple&logoColor=white" /></a>
  <a href="LICENSE"><img alt="Apache License 2.0" src="https://img.shields.io/badge/license-Apache--2.0-3867F5?style=flat-square" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

<p align="center">
  <a href="#快速開始">快速開始</a> · <a href="docs/CODEX_en.md">Codex</a> · <a href="docs/DEEPSEEK_en.md">DeepSeek</a> · <a href="docs/WEBUI_en.md">Control Center</a> · <a href="#文件">文件</a>
</p>

## 讓任務留在你同意的範圍內

長時間程式開發任務很少突然失敗，更多時候是逐漸偏離：一個計畫外檔案變成三個，定向檢查變成
沒有上限的測試，同一個失敗又觸發一輪相似修改，或會話重啟後只能從不完整的聊天記錄重建進度。

Dev Flow 把已同意的請求、預期路徑、驗證預算、目前階段與結果保存在本機 Task 中。Codex 或
DeepSeek 仍負責讀取程式、修改檔案與執行命令；Dev Flow 讓範圍變更、重複嘗試、復原與交付都
成為清楚可見、需要明確決定的事項。

## 它會控制什麼

| 關注點 | Dev Flow 的處理方式 |
| --- | --- |
| **修改範圍** | 記錄預期路徑；支援的計畫外寫入先暫停；測試與完成前再次核對累計修改路徑。 |
| **驗證投入** | 保存命令預算；完整測試需要事先允許；同一失敗或無變化結果第三次完全重複時暫停。 |
| **持久進度** | Task 不只存在聊天中，新會話可繼續同一階段、限制、記錄與阻塞原因。 |
| **結果是否仍有效** | 請求、計畫、實作或 repository 變更後，使不再適用的測試與理解確認失效。 |
| **開發者確認** | 交付前檢視實際修改、不必要的複雜度與維護風險，再由開發者確認結果。 |

## 快速開始

> 穩定 npm `@latest` 目前已在 macOS arm64 驗證；Host Adapter 需要 Node.js `>=24`。
> 在其他環境安裝前，請先查看 [Support Matrix](docs/SUPPORT-MATRIX_en.md)。

### 1. 安裝並連接 Host

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

互動式設定可為 Codex、DeepSeek 或兩者安裝 Dev Flow。之後也能從同一入口查看狀態、診斷、
升級、修復或移除。

### 2. 啟動有邊界的 Task

在 **Codex** 中傳送這則使用者訊息：

```text
$dev-flow-codex:dev-flow 加入登入失敗限流。只修改驗證相關檔案，最多執行 4 項定向檢查。
```

在 **DeepSeek Harness** 中傳送：

```text
/dev-flow 加入登入失敗限流。只修改驗證相關檔案，最多執行 4 項定向檢查。
```

這兩項是對話 selector，不是 shell 命令。請盡量具體說明目標、驗收條件、檔案邊界與測試上限。

### 3. 復原或查看進度

會話重啟後，回到參與 Task 的 repository，再次使用同一個 Host selector。Dev Flow 會讀取已保存的
Task，從目前階段繼續，不需要從對話重新推測進度。

```bash
# 唯讀查看 Adapter 狀態
dev-flow status --host all

# 開啟本機 Control Center
dev-flow webui start
```

Control Center 會顯示目前階段、計畫與實際路徑、檢查歷史、阻塞、復原建議與下一個決定。
Codex、DeepSeek 與頁面讀取的是同一份本機 Task 資料。

非互動安裝、Host 原生命令、自訂 DeepSeek Profile、升級與移除方式請見
[Command Reference](docs/COMMANDS_en.md)。

## Task 執行時會發生什麼

1. **先設定邊界。** Task 保存請求、參與的 repository、預期路徑、工作項目與驗證預算。
2. **由 Host 執行。** Codex 或 DeepSeek 修改程式；支援的結構化檔案工具在寫入計畫外路徑前詢問。
3. **核對真實修改。** 測試與完成前，Core 再核對本 Task 的累計修改路徑，包括未經寫入前檢查的變更。
4. **停止無效循環。** 第三次完全重複時暫停，要求採用不同做法或明確允許繼續。
5. **只交付目前結果。** 程式後續變更會使舊檢查失效；測試與開發者理解確認必須對應最終實作。

如果操作沒有回傳明確結果，整合會先讀取已保存的 Action 與目前 repository，再判斷能否安全重試。

## 何時適合使用

| 適合使用 Dev Flow | 直接使用 Host 較簡單 |
| --- | --- |
| 任務可能跨會話、重啟或多天 | 一次性問答或程式說明 |
| 需要明確限制修改檔案與測試投入 | 小型機械式修改，不需保存進度 |
| 返工時不能沿用已過期的結果 | 只需查詢狀態或討論方案 |
| 交付前需要開發者清楚檢視 | 不需要持久 Task 或復原狀態 |

## 支援範圍

| 穩定 npm `@latest` 產品 | 已驗證環境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

目前原始碼也包含本機 WebUI 與精確的 `win32-x64` runtime，但 Windows 尚未完成穩定 `@latest`
Host Journey。穩定平台聲明以 [Support Matrix](docs/SUPPORT-MATRIX_en.md) 為準；
[Project Status](docs/PROJECT-STATUS_en.md) 集中說明穩定發行、僅原始碼能力、公開 Journey 與目前缺口。

## 邊界

- Dev Flow 是控制層，不是程式開發 Agent；檔案修改與命令執行仍由使用者授權的 Codex 或 DeepSeek 完成。
- Go Core 僅以唯讀方式觀察 Git，不執行 commit、push、merge、rebase、tag 或 publish。
- 寫入前檢查只涵蓋列出的 Host 結構化工具。Bash 與外部工具可能先寫入，因此 Dev Flow 不是 shell
  或檔案系統 sandbox。
- Control Center 只監聽本機 loopback，面向單一使用者，不提供遠端存取、雲端同步或團隊權限。

## 文件

- **先了解產品：** [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md)
- **開始使用：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **了解實作：** [Architecture](docs/ARCHITECTURE_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Roadmap](docs/ROADMAP_en.md)
- **安全與貢獻：** [Security](SECURITY.md) · [Threat Model](docs/THREAT-MODEL_en.md) · [Contributing](CONTRIBUTING_en.md)

## 授權條款

[Apache License 2.0](LICENSE)
