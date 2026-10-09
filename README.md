# 問道九州 · AI Living World

讓玩家生活在一個不以自己為中心、卻會記住自己存在的世界。

目前主版本是**場景式 AI 對話實驗場 V2**：全畫面場景、多人短段落互動、玩家主導重要決定、持久化原文與事件、NPC 日程、六處地圖、尋人輔助、世界線分支及開發者人格檢視。舊行走實驗保留在 `/legacy`，不是主版本。

## 技術與資料

- React / Vinext 客戶端，Cloudflare Workers API，D1 SQLite 持久化資料庫。
- `components/story-game.tsx`：主介面；`components/developer-panel.tsx`：開發者面板。
- `lib/story/scene.mjs`：場景回應；`world.mjs`：世界結算；`personality.mjs`：可追溯個性。
- `app/api/story/route.ts`：帳號與世界線隔離、回合租約、原子提交。
- `data/`：世界、NPC 原生人格、場景物件與美術映射。
- `public/art/`：重用人物與場景圖片；`docs/ART-V2.md`：生成來源與用途。
- `db/schema.ts`、`drizzle/`：實際部署的資料表及遷移。
- PostgreSQL / Godot 是未來架構方向；本版本沒有假裝使用它們。`docs/target-schema.sql` 是設計稿，不是正式遷移。

## 開發與驗證

需要 Node.js 22.13+、Python 3，以及套件鎖檔所指定的依賴。依專案 `scripts/install-pnpm.sh` 安裝；`npm run build` 建置。Sites 開發環境應優先使用其安裝及建置 helper。

```sh
node --test tests/*.test.mjs
python tests/database_test.py
python tests/story_database_test.py
```

正式運作需要 D1 `DB` binding 及可信登入身份。AI Provider 可選 OpenAI、Anthropic、Gemini；玩家在設定輸入模型 ID 與工作階段金鑰。金鑰不寫進存檔、瀏覽器儲存或事件。開發者權限由伺服器 `GAME_DEVELOPER_USER_IDS` 設定，不是前端開關。

離開 Sites 部署時，必須替換 `app/chatgpt-auth.ts` 中的可信身份整合、配置資料庫並執行遷移；不可直接把帳號識別 HTTP header 當成任意訪客可填的欄位。此儲存庫不是一鍵可用的 GitHub Pages 靜態站。

## 文件

- [目前行為、資料流與限制](docs/STORY-V2.md)
- [GitHub 原始碼交付](docs/GITHUB.md)
- [前版持久化設計](docs/STORY-V1.md)
- [長期架構方向](docs/architecture.md)

尚未完成完整戰鬥、經濟、动态AI新人物與新地圖、原生跨平台客戶端、向量檢索。世界以遊戲行為耗時結算，不在關閉網站時按現實時間運轉。
