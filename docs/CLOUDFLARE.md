# 獨立 Cloudflare 私人版

原站 `https://wendao-living-world.dewytoast4.chatgpt.site/` 保留原登入與資料。此路徑在自己的 Cloudflare 帳號建立另一個網站及 D1，適合先繼續開發與遊玩。它不會讀取或搬走原站資料。

## 準備帳號

1. 建立 Cloudflare 帳號，於 Workers & Pages 啟用該帳號的 `workers.dev` 子網域。
2. 建立限定該帳號的 API Token，授予 Account / Workers Scripts / Edit、Account / D1 / Edit、Account / Account Settings / Read。
3. 在執行部署的環境安全設定 `CLOUDFLARE_API_TOKEN` 與 `CLOUDFLARE_ACCOUNT_ID`。不要寫進程式、命令列參數或 Git。Codex 雲端的連線需求已存於環境設定草稿；填值、儲存／發布後，需確認執行環境已收到設定。
4. 安裝專案鎖定的依賴，從專案目錄執行：

```sh
python scripts/deploy-cloudflare.py
```

預設 Worker 與資料庫名稱為 `wendao-living-world`，可用非秘密環境變數 `WENDAO_WORKER_NAME` 指定另一名稱。

部署程式先確認帳號與目標、執行測試／型別檢查／建置，再建立新 D1、套用全部遷移、發布 Worker 與初始登入秘密。登入秘密尚未建立時，私人 API 不接受身份。已存在且沒有本機部署紀錄的同名 Worker 或資料庫會停止處理，避免覆蓋其他站點。

## 私人登入與保留的狀態

初始網站使用單一私人擁有者，ID 為 `standalone-owner`，也是此站開發者。首次部署產生隨機登入密碼及獨立簽章秘密，透過 Cloudflare Worker secrets 保存。登入資訊另存於 `.sites-runtime/cloudflare/owner-login.txt`（權限 0600），不顯示在命令輸出、不提交 Git。請妥善保管該檔案；它是登入憑證，不是可公開分享的部署報告。

`.sites-runtime/cloudflare/deployment.json` 記錄 account、Worker 與 D1 的對應，後續部署沿用同一目標。`worker-secrets.json` 是初始秘密的私人備份。整個 `.sites-runtime/cloudflare/` 應安全保留，不包含在公開原始碼或網頁資產內。後續發布不會重新上傳已初始化的秘密；在 Cloudflare 更新過密碼後，本機初始登入檔可能已過期。部署紀錄遺失時，程式會停止，避免誤覆蓋同名目標。

Cookie 使用 Secure、HttpOnly、SameSite=Lax 與 HMAC 簽章，七日過期；更新 `GAME_LOGIN_PASSWORD` 或 `GAME_SESSION_SECRET` 會使舊簽章失效。密碼至少16字元，簽章秘密至少32字元，首次部署採高熵隨機值。登入有每IP及全站的十五分鐘嘗試次數限制，計數存於 D1；資料庫不可用時拒絕登入。獨立站會移除訪客傳入的 `oai-authenticated-user-*` 標頭，只向應用程式傳遞驗證成功的私人身份。

這不是多人帳號註冊系統。請勿分享私人世界密碼給不應讀取全部世界線的人。原 ChatGPT 站繼續使用平台登入；若要搬舊存檔，需另外取得正式 D1 匯出並處理原 owner 與新 owner 的對應，不能直接由公開網址匯入。

## 本機驗收

```sh
bash scripts/sites-env.sh -- npm run build
node scripts/prepare-cloudflare.mjs --local
```

在被忽略的 `dist/server/.dev.vars` 設定本機專用 `GAME_LOGIN_PASSWORD` 與 `GAME_SESSION_SECRET`，不要使用正式值。然後：

```sh
bash scripts/sites-env.sh -- node node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config dist/server/wrangler.standalone.json --persist-to .sites-runtime/standalone-state
bash scripts/sites-env.sh -- node node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.standalone.json --local --persist-to .sites-runtime/standalone-state --ip 127.0.0.1 --port 8788 --inspector-port 0
```

`--local` 產物使用本機佔位 D1，僅供測試；正式部署程式必須取得真實 account 與 D1 ID 才產生設定。建置會重建 `dist`，需重新準備本機設定。不要把本機測試秘密、SQLite 或會話檔案傳到正式網站。


## 此版本驗證

86 個 Node 測試、18 個 SQLite 測試、4 個部署流程測試、TypeScript、建置及 Wrangler 部署 dry-run 通過。完整本機 Worker 以 Chromium 驗證密碼登入、Secure/HttpOnly Cookie、拒絕偽造身份、建立世界、回合、存檔、重載、開發者存取、登出與手機登入頁；重新啟動 Worker 後，會話與存檔仍可讀取。

2026-10-09 已完成正式 Cloudflare 帳號連線、D1 建立、遠端遷移與私人 Worker 發布。

## 金鑰代理環境中的可操作預覽

此雲端環境的金鑰代理接受帳號 API Token，但拒絕 Workers Static Assets 上傳所用的臨時 JWT。因此另提供預覽發布方式：

```sh
WENDAO_ASSET_MODE=embedded-preview python scripts/deploy-cloudflare.py
```

這會將建置完成的 JavaScript、CSS 與 SVG 嵌入 Worker 模組，免用 Static Assets 上傳。人物及場景 PNG 由 Worker 讀取此公開儲存庫的固定 commit，依精確檔案清單提供並快取；建置時比對該 commit 圖片與本機輸出逐位元相同。訪客的 Cookie、認證標頭與查詢參數不會傳給 GitHub。此預覽依賴 GitHub 原始檔服務的可用性，適合先試玩；一般部署仍可使用原本 Static Assets 路徑。

私人登入、D1 存檔與後台均使用實際服務，沒有替換為示範 API。AI 對話仍需玩家在遊戲設定中連接模型。此新站不包含原 Sites 舊存檔。

登入資訊仍存於 `.sites-runtime/cloudflare/owner-login.txt`，不要提交到 Git。新增預覽資產測試驗證靜態路由、身份資料不轉送及失敗回應。
