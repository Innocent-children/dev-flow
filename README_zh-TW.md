<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 圖示" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>讓長時間 AI 程式開發任務的修改範圍、驗證上限與目前進度，不因會話中斷而遺失。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## 讓長任務不再悄悄偏離

程式開發任務進行得越久，越容易逐漸變形：更多檔案進入修改範圍，定向檢查變成沒有上限的測試，
同一個失敗又引發一輪相似嘗試，或會話重啟後只能從聊天記錄重新拼湊進度。

Dev Flow 把已同意的請求、預期路徑、驗證上限、目前階段與結果保存在同一個本機任務中，程式修改
仍由 Codex 或 DeepSeek 完成。

每個新請求都先做唯讀評估。使用者選擇 Dev Flow 後，必須確認 remote、base branch 與新的任務
分支；Host 從該遠端基線建立乾淨的專屬 worktree，Core 之後才建立 Task。來源 checkout 的現有修改
不會複製進去。

- **範圍保持明確。** 記錄預期路徑；支援的結構化工具在寫入計畫外檔案前先詢問；測試與交付前
  再次核對實際修改。
- **工作樹只有一個修改歸屬。** Core 從專屬 worktree 的 Git 狀態計算目前 Task 修改面；正常線性
  commit 會保留修改面，branch rewrite 或 worktree 實例遭替換時會停止任務。
- **驗證投入有上限。** 自動檢查限制命令數量，完整測試需要事先允許，第三次完全重複時暫停任務。
- **會話中斷後可以繼續。** 新會話恢復同一任務、剩餘檢查與目前決定，不需從聊天記錄重建。
- **只沿用仍有效的結果。** 請求、計畫、實作或程式碼儲存庫改變後，舊檢查會失效；交付前由開發者
  檢視實際結果。

## 快速開始

> 穩定 npm `@latest` 目前已在 macOS arm64 驗證。請使用 Node.js `>=24`，並先安裝受支援的 Codex
> 或 DeepSeek Harness。準確的 Codex、DSH 版本與其他環境狀態請見 [Support Matrix](docs/SUPPORT-MATRIX_en.md)。

### 1. 安裝 Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

在互動式設定中選擇 Codex、DeepSeek 或兩者。第一次啟動任務前，還要完成安裝程式提示的操作：

- **Codex：** 開啟 `/hooks`，檢查並信任 Dev Flow 隨套件提供的 hook。信任前，支援的
  `apply_patch` 寫入前檢查不會生效。
- **DeepSeek Harness：** 安裝後重新啟動所選 DSH Profile。

### 2. 啟動任務

在 **Codex** 中傳送這則使用者訊息：

```text
$dev-flow-codex:dev-flow 加入登入失敗限流。只修改驗證相關檔案，最多執行 4 項定向檢查。
```

或在 **DeepSeek Harness** 中傳送：

```text
/dev-flow 加入登入失敗限流。只修改驗證相關檔案，最多執行 4 項定向檢查。
```

這兩項是對話 selector，不是 shell 命令。請盡量清楚說明目標、驗收條件、檔案邊界與測試上限。
第一次回覆只評估影響並詢問直接開發或使用 Dev Flow；明確 selector 也不會跳過選擇。選擇 Dev Flow
後還要確認建議的 remote、base 與 target branch。Codex 在 Host 支援時開啟 managed worktree；
DeepSeek 因目前會話的 Workspace Root 固定，會提供從新 worktree 重新啟動的命令。

### 3. 恢復並查看進度

會話重啟後，回到 Task 綁定的原 worktree，並明確要求恢復。恢復不會重做准入，也不會選擇替代
worktree；原實例遺失或被替換時，Task 會停止，等待恢復原實例或明確 abandon。

```bash
# 查看已安裝的整合
dev-flow status --host all

# 開啟本機任務介面
dev-flow webui start
```

非互動安裝、自訂 DSH Profile、升級、修復與移除方式請見
[Command Reference](docs/COMMANDS_en.md)。

## 適合哪些任務

Dev Flow 適合跨會話、需要明確檔案範圍、必須限制測試投入，或可能返工且不能沿用舊結果的真實
程式碼儲存庫任務。

一次性問答、程式說明、狀態查詢與不需保存進度的小型機械式修改，直接使用 Codex 或 DeepSeek
通常更簡單。

## 文件

- **使用說明：** [Codex](docs/CODEX_en.md) · [DeepSeek](docs/DEEPSEEK_en.md) · [Commands](docs/COMMANDS_en.md) · [Control Center](docs/WEBUI_en.md)
- **專案資料：** [Product](docs/PRODUCT_en.md) · [Support Matrix](docs/SUPPORT-MATRIX_en.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## 授權條款

[Apache License 2.0](LICENSE)
