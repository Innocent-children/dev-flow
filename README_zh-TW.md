<p align="center">
  <img src="packages/webui/src/assets/dev-flow-app-icon-light.svg" width="112" height="112" alt="Dev Flow 圖示" />
</p>

<h1 align="center">Dev Flow</h1>

<p align="center"><strong>讓長時間 AI 程式開發任務的修改範圍、驗證上限與目前進度，不因會話中斷而遺失。</strong></p>

<p align="center">
  <a href="README.md">English</a> · <a href="README_zh-CN.md">简体中文</a> · <a href="README_zh-TW.md">繁體中文</a> · <a href="README_ja.md">日本語</a> · <a href="README_ko.md">한국어</a> · <a href="README_es.md">Español</a> · <a href="README_fr.md">Français</a> · <a href="README_de.md">Deutsch</a> · <a href="README_pt-BR.md">Português (Brasil)</a>
</p>

## Dev Flow 能幫你做什麼

Dev Flow 幫助你在 Codex 或 DeepSeek 中管理長時間執行的 AI 程式開發任務。它在本機保存已確定的
需求、檔案範圍、驗證計畫、進度與結果，方便會話中斷後繼續工作。

- **明確修改範圍：** 記錄預計修改的檔案，並依計畫檢查實際修改。
- **安排驗證投入：** 選擇與任務相關的檢查，設定驗證投入上限。
- **恢復任務：** 回到原工作目錄，繼續同一任務中尚未完成的工作。
- **查看結果：** 查看目前進度、檢查結果，以及任務需要處理的問題。

適合跨會話、需要明確檔案範圍和測試投入的儲存庫任務。一次性問答、程式說明與不需保存進度的
小型修改，直接使用 Codex 或 DeepSeek 通常更簡單。

## 快速開始

> 穩定 npm `@latest` 目前已在 macOS arm64 驗證。請使用 Node.js `>=24`，並先安裝受支援的
> Codex 或 DeepSeek Harness。宿主版本要求和其他環境狀態見[支援矩陣](docs/SUPPORT-MATRIX.md)。

### 1. 安裝 Dev Flow

```bash
npm install -g @imotong/dev-flow@latest
dev-flow
```

在互動介面中選擇 Codex、DeepSeek 或兩者，並完成安裝程式提示的操作：

- **Codex:** 開啟 `/hooks`，檢查並信任 Dev Flow hook，啟用受支援的寫入前檢查。
- **DeepSeek Harness:** 安裝後重新啟動所選 DSH Profile。

### 2. 啟動任務

在 **Codex** 中傳送：

```text
$dev-flow-codex:dev-flow 加入登入失敗限流。只修改驗證相關檔案，最多執行 4 項定向檢查。
```

或在 **DeepSeek Harness** 中傳送：

```text
/dev-flow 加入登入失敗限流。只修改驗證相關檔案，最多執行 4 項定向檢查。
```

這兩則訊息傳送到對話中，不在終端機執行。請盡量寫清楚目標、驗收條件、檔案範圍與測試上限。

首次回覆會評估請求，並詢問直接開發還是使用 Dev Flow。選擇 Dev Flow 後，預設從目前 HEAD
在目前目錄建立新的任務分支。確認新分支及是否將既有未提交修改納入任務；現有相依套件、本機設定、
檔案和暫存狀態都會保留。目前會話能存取所有參與目錄時，直接在原會話繼續。

你也可以明確選擇使用目前分支，或建立獨立 Git 工作樹。獨立工作樹還需選擇本機或遠端來源及起始
分支；Codex 在宿主支援時開啟新目錄，DeepSeek 提供對應的重新啟動命令。

同一目錄只能有一個進行中的 Task。手動或其他工具的本機編輯也會被觀察，任務中切換分支會暫停流程。
本機目錄和分支在任務結束後保留；開始下一個任務時仍需明確未提交修改的歸屬。

實作前，先查看並討論需求、方案、任務、預計檔案和驗證安排。完整計畫得到你的明確認可後才開始開發；方案修訂或檔案範圍擴大後需要再次確認。選擇 Dev Flow 或工作樹參數不能取代方案確認。

### 3. 恢復並查看進度

會話重新啟動後，回到任務的原工作目錄，明確要求繼續該任務。Dev Flow 會從已儲存的進度繼續。
原工作目錄遺失或被替換時，任務會暫停，直到你恢復它或明確放棄任務。

在 DeepSeek Harness 中，繼續任務的訊息也要帶上 `/dev-flow`。

```bash
# 查看已安裝的整合
dev-flow status --host all

# 開啟本機任務介面
dev-flow webui start
```

非互動安裝、自訂 DSH Profile、升級、修復與移除方式見[命令參考](docs/COMMANDS.md)。

## 桌面寵物

桌面寵物透過堆疊氣泡顯示多個任務，並可分別開啟對應 WebUI。它優先顯示受阻任務，目前任務完成後會自動關注其他未完成任務，也支援固定關注。你可以自訂外觀、控制動畫、調整大小，以及獨立啟動或停止寵物。使用前先完成上面的安裝與 Codex 或 DeepSeek 設定。

```bash
dev-flow pet start
dev-flow pet stop
```

桌面應用程式面向 macOS arm64 和 Windows 10/11 x64。安裝與操作見[桌面寵物指南](docs/DESKTOP-PETS.md)，
已驗證的可用範圍見[支援矩陣](docs/SUPPORT-MATRIX.md)。

## 使用限制

專屬工作樹用於分開程式碼修改。程序、網路、憑證和外部服務仍與目前環境共用。

完成任務不會自動提交程式碼、推送或刪除工作樹；這些操作需要你另外授權。

## 文件

- **使用說明：** [Codex](packages/codex/README.md) · [DeepSeek](packages/deepseek/README.md) · [命令參考](docs/COMMANDS.md) · [Control Center](docs/WEBUI.md)
- **專案資料：** [產品定義](docs/PRODUCT.md) · [支援矩陣](docs/SUPPORT-MATRIX.md) · [安全政策](SECURITY.md)
- **開發與貢獻：** [文件目錄](MANIFEST.md) · [貢獻指南](CONTRIBUTING_zh-CN.md)

## 授權條款

[Apache License 2.0](LICENSE)
