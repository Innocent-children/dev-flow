<h1 align="center">Dev Flow</h1>

<p align="center"><strong>讓長時間 AI 程式開發任務守住你設定的修改範圍與測試上限，並在繼續前確認目前結果是否可信。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 當程式任務開始失控

假設你對 Agent 說：

```text
加入登入失敗限流。只修改登入驗證相關檔案，最多執行 4 項定向檢查。
```

任務比預期更久。Agent 想順手改一份相鄰設定，定向測試反覆失敗，會話又在剩餘檢查完成前重啟。
這時只看聊天記錄，很難判斷額外檔案是否真的屬於需求、還能跑多少測試、再試一次是否有意義，以及
舊的通過結果是否仍適用。

Dev Flow 把這些決定和任務放在一起。Agent 照常讀程式、改檔案、跑命令；擴大範圍、增加測試、
重複嘗試和完成交付都變成看得見、需要明確決定的事情。

## 使用後有什麼不同

| 直接使用 Agent | 使用 Dev Flow |
| --- | --- |
| 檔案限制只存在提示詞 | 計畫記住預計檔案；受支援的計畫外寫入先暫停 |
| 「只跑定向測試」可能越跑越多 | 自動檢查有固定上限，完整測試需要事先允許 |
| 同一失敗容易觸發下一輪相似修改 | 第三次完全重複時暫停，要求換方法或明確同意 |
| 會話重啟後靠殘缺聊天重建進度 | 新會話繼續同一任務、限制與剩餘檢查 |
| 程式改變後仍沿用舊的通過結果 | 不再符合目前程式的結果會在交付前失效 |

## 最值得注意的地方

### 任務不會悄悄變大

每項工作會記下預計修改的檔案與需要完成的檢查。受支援的工具要寫計畫外檔案時先暫停；你可以只
允許這一次、修改計畫或拒絕。測試與完成前還會再次核對實際修改路徑。

### 重試必須帶來新資訊

Dev Flow 比較最近三次測試嘗試。只有同一失敗檢查、完整結果，或「修改同一批檔案後仍得到同一
失敗」連續完全重複時才暫停。需求、計畫或實作改變後，舊測試和人工確認也會失效。

### 中斷後繼續，不靠猜也不盲目重試

請求、計畫、目前進度、檢查記錄與阻塞原因保存在本機。新會話可以繼續同一任務；操作結果不明時，
整合會先讀取已保存的操作與目前 repository，再判斷是否能安全重試。

### 交付由開發者決定

測試通過還不夠。交付前，開發者要檢視實際修改、不必要的複雜度與維護風險，並明確確認自己能夠
解釋和維護結果。之後程式再變，就要重新測試。

### 在本機看清整個任務

目前原始碼包含本機 Control Center，可查看 Codex 與 DeepSeek 共用的任務、目前進度、計畫與實際
路徑、檢查歷史、重複嘗試暫停和下一個決定。它讀取同一份本機資料，不是雲端看板。

## 快速開始

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

```text
$dev-flow-codex:dev-flow 加入登入失敗限流。只修改登入驗證相關檔案，最多執行 4 項定向檢查。
/dev-flow 加入登入失敗限流。只修改登入驗證相關檔案，最多執行 4 項定向檢查。
```

## 適合與不適合

Dev Flow 適合跨會話、需要明確檔案範圍、必須限制測試投入、可能返工，或需要清楚交接的真實 repository
任務。一次性問答、程式解釋、狀態查詢和不需保存進度的小修改，直接使用 Agent 通常更簡單。

## 目前真正可用的範圍

### 穩定 npm `@latest`

| 產品 | 已驗證環境 |
| --- | --- |
| `dev-flow-codex` | macOS arm64、Node.js `>=24`、Codex `>=0.147.0` |
| `dev-flow-deepseek` | macOS arm64、Node.js `>=24`、DSH `>=0.1.0-rc.6` |
| `@imotong/dev-flow` | macOS arm64、Node.js `>=20` |

穩定記錄涵蓋安裝、就緒、移除、卸載與目標 repository 不變。DeepSeek 的穩定 Journey 還涵蓋明確
觸發、重啟、完成與重新開啟保留資料。

### 目前原始碼與公開記錄

- 原始碼包含本機 WebUI、檔案範圍決定、自動重複刹車，以及 `darwin-arm64`、`win32-x64` runtime。
- Windows 目前僅是原始碼能力；已有 Windows 11 本機記錄，但沒有穩定 `@latest` Host Journey。
- [PR #8](https://github.com/Innocent-children/dev-flow/pull/8) 記錄真實 Codex Journey，涵蓋重啟、重構、重新測試、理解確認、交付與完成。

### 尚未證明或尚未穩定

- 外部資料尚未證明能降低測試成本、缺陷率或維護成本；長期採用記錄仍有限。
- Linux、Windows Server、Windows 32 位與 ARM64、Intel Mac、Rosetta、remote MCP 沒有穩定支援聲明。
- 團隊檢視、雲端同步、Task 匯出與明確的跨 Host 交接仍是未來工作。

## 邊界與文件

- Core 僅以唯讀方式觀察 Git，不執行 commit、push、merge、rebase、tag 或 publish。
- 寫入前檢查只涵蓋列出的結構化工具；Dev Flow 不是 shell 或檔案系統 sandbox。
- WebUI 僅在本機 loopback 執行，面向單一使用者。
- [Product](docs/PRODUCT_en.md) · [Demo](docs/DEMO_en.md) · [Project Status](docs/PROJECT-STATUS_en.md) · [Architecture](docs/ARCHITECTURE_en.md) · [Commands](docs/COMMANDS_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md)

## License

[Apache License 2.0](LICENSE)
