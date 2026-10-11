# V3 聊天介面與連線整合

以 `codex/ensemble-story-deployment` 的 `103486f`（PR #29）為基礎，選擇性移入聊天 UI、OpenRouter 連線測試、世界找回與請求重試。不是將舊版分支完整合併回來。

## 保留的最新 V3 能力

原有 GM 契約、連續對話記憶、結構化 NPC／任務紀錄、行動結果檢查、任務日曆、場景跳轉及模型轉接器均保留。

- 任務手札只讀取既有 playerWorld.journal；開發者人物／任務管理仍用原元件與權限。
- 時間推進仍用原 advance-time API，15／60／360／1440 分鐘。回合重試包含操作種類、等待長度及原始 revision。
- 建議仍由原 suggestedActions 提供；點擊帶入可改寫文字，送出才會執行。
- 沒有重新引入 V1/V2、另一套 GM 提示詞、NPC 模擬、耗時規則或境界攔截。

## 通用改進

桌面／手機聊天版面、段落與台詞閱讀、字級設定、設定視窗、人物與任務管理視窗、較早對話分段顯示、往上閱讀時保留位置、中文輸入法與手機換行。

從登入帳號列出 V3 世界；同分頁保留待確認請求 ID；斷線後可讀取提交收據，重試不重複更新世界。發送新回合需帶 revision，部署後已開啟的舊網頁應重新整理。已有存檔及舊回合收據仍相容。

OpenRouter 連線測試是真實的一句模型生成請求，不修改世界；Key 只留在頁面記憶體。沒有更改免費模型價格上限。測試仍會使用供應商額度。

## 驗證

- `node --test v3/tests/*.test.mjs tests/*.test.mjs`：139 項通過。
- `pnpm exec tsc --noEmit`、`npm run build`：通過。
- Chromium + 本機 D1：自由對話、建議不自動送出、15 分鐘推進、任務手札、人物後台、任務後台、斷線後確認等待收據、清除世界指標後找回、手機寬度驗證。
- 測試用本機 developer allowlist 已移除，不隨程式提交。
- 未驗證真實 OpenRouter 敘事品質，未部署 Cloudflare，未聲稱完成百回合實際模型驗收。

## 合併與部署

1. 比較 `codex/v3-ui-integration` 到 `codex/ensemble-story-deployment`，確認只包含此次 UI／API 更新，再合併。
2. GitHub Actions → Deploy V3 to Cloudflare → Run workflow。
3. 在 **Use workflow from** 明確選擇 `codex/ensemble-story-deployment`，確認已包含此次整合提交。
4. confirmation 輸入 `wendao-living-world`，執行。
5. 最新分支的 workflow 使用 `actions/checkout@v4` 且沒有固定 ref，因此實際部署的是執行時選擇的分支。不要沿用舊版「不論選哪個分支都抓固定來源」的說法。
6. 部署完成後重新整理遊戲，檢查登入、原世界讀取、任務手札、後台權限、OpenRouter 測試及一個實際對話回合。

此次不新增 D1 遷移、不變更部署 secrets，也不會由 git push 自動部署。
