# 問道九州 · AI Living World (V3)

《問道九州》是自由輸入的 AI 修仙文字 RPG：玩家只控制洛河，AI GM 自然主持 NPC、世界事件、行動判定與因果；人物和任務資料負責**記錄**既成事實，不用固定選項或規則模擬器主導對話。

## 目前架構

- **主遊戲入口**：`/`（指向 `/v3`）；V1、V2 的舊遊戲入口、API、模擬器和舊素材已從開發分支清理。
- **玩家介面**：`app/v3/page.tsx`、`app/v3/v3.css`。
- **主要 API**：`app/api/v3/world/route.ts`；透過 `app/chatgpt-auth.ts` 的原有 Sites 登入及 Cloudflare D1 世界存檔。
- **AI 連接**：`v3/server/openai.mjs`、`v3/server/openrouter.mjs`。
- **GM 主持規則**：`v3/server/gm-prompt.mjs`，以《通用 AI 角色扮演引擎｜統一模板 v1.0》為基礎；最近完整對話優先。
- **世界狀態及紀錄**：`v3/server/world.mjs`、`v3/server/conversation-memory.mjs`、`v3/server/event-calendar.mjs`、`v3/server/npc-registration.mjs`。AI 產生敘事及可選的 `GM_STATE` 人物／任務變化欄位，後端驗證後才提交。
- **開發者後台**：`components/v3-developer-panel.tsx` 與 `components/v3-task-developer-panel.tsx`。

## 開發與測試

建議 Node.js 22.13 以上；依專案 pnpm 鎖檔安裝。

```sh
node --test v3/tests/*.test.mjs
npm run build
```

既有玩家 D1 存檔、登入、NPC 原生設定及任務日曆仍保留。GitHub 開發分支的程式清理**不會直接刪除雲端資料庫中的舊世界紀錄**。正式站也不隨程式合併而自動更新。

其他部署設定請參閱 [部署說明](docs/DEPLOYMENT.md)、[V3 狀態](docs/V3-STATUS.md)。
