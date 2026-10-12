# V3 伺服器 AI 設定（Cloudflare Worker）

《問道九州》V3 的玩家不再需要自行輸入 API Key，模型請求由 Cloudflare Worker 轉送。**只有列入 V3_AI_USER_IDS 的登入帳號可以消耗網站的 AI 額度**；未設定使用者白名單時，預設任何帳號都不能使用網站 AI。

## 1. 設定 Cloudflare Worker Secret

於 Cloudflare Dashboard → Workers & Pages → 目前的《問道九州》Worker → Settings → Variables and Secrets，設定：

- `OPENAI_API_KEY`：Secret，OpenAI API 金鑰（如選 OpenAI）。
- `OPENROUTER_API_KEY`：Secret，OpenRouter API 金鑰（如選 OpenRouter）。
- `V3_AI_USER_IDS`：允許使用網站 AI 的帳號 userId，逗號分隔。初期僅填開發者本人的登入 userId，不要使用公開信箱或在 GitHub 寫金鑰。
- `V3_OPENAI_MODELS`：允許選用的 OpenAI **實際 API 模型 ID**，逗號分隔，例如 `gpt-4.1-mini,gpt-4.1`。省略則僅允許 `gpt-4.1-mini`。
- `V3_OPENROUTER_MODELS`：允許的 OpenRouter 免費模型，逗號分隔，例如 `openrouter/free`。省略則僅允許 `openrouter/free`；只接受 `:free` 路由，不支援付費 OpenRouter 模型。

Secret 在 Cloudflare Worker 的執行環境讀取，絕不放在 Next.js `NEXT_PUBLIC_*` 或 GitHub 程式碼。修改 Secrets 後確認 Cloudflare Worker 使用最新設定。

**設定前網站不會憑空有金鑰。** API Key 是獨立的 OpenAI / OpenRouter 平台服務，不等同 ChatGPT Plus 訂閱。

## 2. 自行測試

登入網站 → AI 設定。畫面顯示目前帳號是否有使用權限，以及伺服器已設定的模型。選擇 OpenAI 或 OpenRouter、從允許清單選擇模型，點選「測試目前模型」確認能產生問候。進入故事後不必輸入 Key，上一回合「實際使用模型」可在進階資訊查看。OpenRouter 的 `openrouter/free` 可能動態挑選提供者。

若回傳「尚未授權」：檢查 `V3_AI_USER_IDS` 是否正確；若回傳「尚未在伺服器設定金鑰」：檢查對應 Worker Secret；若回傳「不在允許清單」：將正確的模型 ID 設入對應模型清單。

## 3. 安全性與費用

本版不向瀏覽器傳送金鑰，也拒絕從瀏覽器自帶的 `apiKey`；只有登入且通過白名單的帳號可以用網站金鑰。每份 V3 世界原有 1,000 回合限制仍保留；這**不是完整的全帳號／每日費用上限**。如果要對外開放多人，必須再建全帳號限額、節流、費用告警或額度管理，不要把開發者白名單直接改成對所有人開放。

程式合併與部署不會產生 Key，也不會刪除任何既有 D1 存檔。
