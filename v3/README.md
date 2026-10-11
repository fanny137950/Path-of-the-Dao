# 問道九州 V3 — Living World

目標是以自由對話與行動推進的持久修仙世界：NPC 有記憶、關係與自主生活，重要決定由玩家做。世界規則決定客觀結果，模型負責理解與演出。現階段仍是原型，尚未達成完整世界模擬。

## 目前主流程

- `/` 與 `/v3` 使用聊天介面，正式回合走 `/api/v3/world`。
- V3 沿用 D1 `worlds` 表，以 `state.mode = 'v3'` 與舊世界隔離，整體 JSON 加 revision 比對提交。
- 登入者可列出及切換自己的 V3 世界；瀏覽器沒有世界 ID 時優先開啟既有世界。
- OpenRouter 預設 `openrouter/free`，只允許免費路線，價格上限為零；OpenAI 為另選的付費服務。
- API Key 只留在當次頁面記憶體，由遊戲伺服器轉發；不寫進 localStorage、sessionStorage、D1 或日誌。模式與模型偏好可保留。
- 「測試 AI 連線」經 `/api/v3/connection` 實際要求免費模型回覆一句問候，不讀取或修改世界。只有成功取得文字才顯示連線成功；仍消耗供應商免費額度。
- 每回合保存 requestId、輸入及原始 revision。頁面重試與重載沿用同一待確認請求，已提交者重播；改變同 ID 的內容或使用過期版本會拒絕。

## OpenRouter 設定

1. 登入遊戲，開啟「AI 設定」，選 OpenRouter。
2. 在 https://openrouter.ai/settings/keys 建立自己的 Key，填入遊戲的密碼欄位；不要貼進聊天或原始碼。
3. 模型先用 `openrouter/free`，點「測試 AI 連線」。成功後直接在下方輸入。
4. 401/403 檢查 Key；429 表示免費額度或限流；連續無效輸出可選另一個 `:free` 模型。系統不自動改用付費模型。
5. 重新整理頁面後需重新輸入 Key。未確認回合的文字與請求 ID 暫存在該分頁 sessionStorage，確認成功後移除。

雲端開發機連線另外需要允許 `openrouter.ai`；環境設定草稿與正式 Cloudflare Worker 的設定是不同事物。沒有實際金鑰及可用網路時，mock 測試不能當成真實 AI 連線成功。

## 本機驗證

使用現有 checkout 與鎖檔，Node >=22.13、pnpm 11.25.0。`npm run dev -- --host 127.0.0.1`，portable profile 可使用 repository 支援的本機模擬登入。依環境設定的本機 D1 設定套用 drizzle migrations。

```sh
node --test tests/*.test.mjs v3/tests/*.test.mjs
python3 tests/database_test.py
python3 tests/story_database_test.py
pnpm exec tsc --noEmit
npm run build
```

正式部署來源目前由 `.github/workflows/deploy-v3-cloudflare.yml` 指定為 `codex/ensemble-story-deployment`。其他分支的變更不會自動上線。發布前須確認來源 commit、既有資料庫遷移、登入與世界讀取；不要用本機資料覆蓋正式 D1。

## 限制與下一階段

- 有保守的否定／提問耗時判斷與明確境界矛盾攔截，但不是完整語意驗證。物品、戰鬥、修煉及多步行動仍需統一的結構化提案／結算協定。
- 共用 GM 上下文仍可包含私密資訊；尚未完成逐角色可見上下文隔離。
- 背景事件主要是預定節點及少量離場位置更新，不是完整 NPC 目標規劃。
- 世界不按離線現實時間運轉；這是暫定開發方式，非所有時間語意都已確認。
- 目前仍有 1000 回合上限、整體 JSON 存檔；世界匯出、還原及獨立事件／記憶儲存尚待實作。
- 沒有跨請求生成租約，同時送出同一回合可能呼叫模型兩次，但 CAS 與 requestId 防止重複提交世界。需另加生成租約、頻率限制及用量追蹤。
- 下一階段驗收：真實模型下玩滿 100 回合，檢查規則一致、秘密隔離、人物記憶、自主事件與故障恢復；通過單元測試不等於此項驗收完成。
