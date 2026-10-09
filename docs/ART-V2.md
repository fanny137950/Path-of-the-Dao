# 《問道九州》對話場景美術 v2

2026-10-09。這批資產使用內建 imagegen 工具生成；不是外部遊戲素材，沒有使用 Witchbrook 的圖像。美術方向為原創中式仙俠、精細像素插畫、霧青與靛藍、月白與暖金、柔和自然光。所有新圖均獨立保存，未覆蓋舊素材。資料對應表為 `data/art-v2.json`，人物與背景分開，介面不得烘焙進圖像。

## 素材與身份

| ID | 專案路徑 | 身份／畫面識別 |
|---|---|---|
| player | public/art/luohe-dialogue-v3.png | 洛河，15歲少女；青白衣、青色髮帶、淡花髮飾、年輕面容 |
| shen | public/art/shen-dialogue-v2.png | 沈滄月既有立繪沿用；其他角色的畫風參照 |
| yan | public/art/yan-dialogue-v3.png | 晏清辭；高馬尾、青藍劍修衣、護腕、沉穩目光 |
| jiang | public/art/jiang-dialogue-v3.png | 江離；青年男性、淺藍白衣、溫和微笑、收攏折扇 |
| gu | public/art/gu-dialogue-v3.png | 顧長青；青年男性、深青灰衣、竹紋、安靜神態 |
| home | public/art/courtyard-v3.png | 棲風峰庭院既有場景沿用；櫻花、石坪、水池與廊屋 |
| room | public/art/scene-room-v2.png | 木質居所、床、書案、窗景、練習木劍 |
| court | public/art/scene-court-v2.png | 開闊演武石坪、劍架、練習靶、松樹 |
| library | public/art/scene-library-v2.png | 木質藏經樓、書架、卷宗、閱覽案、上層樓梯 |
| square | public/art/scene-square-v2.png | 主峰大殿、公共廣場、銅鐘亭與公告欄 |
| gate | public/art/scene-gate-v2.png | 山門、長階、門前平台、松林與雲海 |

四张新立繪皆為 1024×1536 RGBA；生成器保留透明 alpha 與柔和邊緣光。五張新場景皆為 1672×941 RGB，約 16:9。背景沒有固定人物，適合由程式獨立疊加人物與 UI。角色頭像應由同一立繪用 CSS 裁切顯示，不另外生成不同長相。

## 參考素材

- `shen-dialogue-v2.png`：立繪風格、光影、人物構圖參照；不得把沈的臉複製到每位角色。
- `dialogue-lab-v1.png`：左側洛河身份參照；右側沈滄月不作洛河身份。
- `characters-v3.png`：第三位晏清辭、第四位江離、第五位顧長青的服裝、髮型與配色參照。新的對話立繪改用正常對話肖像比例，不沿用小人比例。
- `courtyard-v3.png`：場景材質、精細像素風格、建築語彙與配色參照；新場景採各自空間配置。

## 可重用 prompt 規格

每張採單獨 imagegen 請求，並傳入上述本地參考圖片。立繪 `transparent_background=true`；場景 `false`。本次沒有用程式繪圖、裁切、去背或重新壓縮來改造生成圖；僅驗證尺寸、色彩模式與 alpha 後原檔複製到專案。

### 人物共用 prompt

> Use case: stylized-concept. One original xianxia game dialogue portrait. Reference1 STYLE ONLY: exquisite fine pixel-art anime rendering, tiny crisp pixel texture, soft warm highlights, normal portrait proportions, not chibi or 3D. Reference2 IDENTITY ONLY: preserve this character's distinctive hair, costume, color palette and age. Single centered person, head to mid-thigh, entire hair ornament visible, modest clothes, relaxed attentive posture. True transparent alpha background, no scene, no UI, no text, no watermark. Do not copy the master's face onto other characters.

各角色補充：

- 洛河：15-year-old Chinese girl, long dark brown hair half-up bun, teal ribbon and small pale flower, youthful round face, brown eyes, moon-white and pale teal embroidered hanfu, gentle attentive neutral expression, hands loosely together. Reference2 LEFT girl identity.
- 晏清辭：adult Chinese female eldest sword disciple, dark high ponytail and narrow teal ribbons, blue/teal fitted sword-disciple robe, pale crossed collar, leather wrist guards, practical silver belt clasps, sharper attentive eyes, reserved expression. Reference2 THIRD figure identity. No floral crown or voluminous mistress sleeves.
- 江離：young adult Chinese man, dark high ponytail and pale blue ribbon, warm brown eyes and friendly slight smile, blue-gray/moon-white robe, cloud embroidery, practical belt and bracers, male face and shoulders, one hand at waist and a closed folding fan held downward. Reference2 FOURTH figure identity.
- 顧長青：young adult Chinese man, high tied dark hair and simple jade ribbon, angular masculine face and straight brows, dark forest-teal/charcoal robe, subdued silver bamboo/cloud embroidery, pale inner collar, dark sash and jade clasp, composed unsmiling but kind attentive expression. Reference2 FIFTH figure identity.

### 場景共用 prompt

> Use case: stylized-concept. Production 16:9 full-bleed original Chinese cultivation life RPG location background. Reference STYLE ONLY: exquisite finely textured pixel-art, elevated three-quarter or 45-degree view, muted indigo, mist teal, moonwhite, warm wood and gold, soft natural light. Coherent Chinese fantasy architecture and clearly readable furnishings, clear foreground for separately overlaid portrait. No people, human silhouettes, UI, readable text, logos or modern technology. New location layout, not a copy of the courtyard.

各地點補充：

- 居所：small disciple bedroom, wood floor, simple wooden bed with pale teal quilt at right, desk beneath lattice window at left, inkstone and scrolls, chest, practice wooden sword on wall rack, bamboo and misty mountains through window, warm afternoon light.
- 演武場：broad weathered stone training square with circular practice marking, wooden sword/staff racks, straw training targets, low balustrades, bent pines, modest blue-roof shelter, cloud sea, calm daylight, utilitarian spacious arena rather than residential courtyard.
- 藏經樓：two-story wooden bookcases filled with stitched books and tied scrolls, mezzanine and lattice railing, timber staircase back-right, reading tables and lamps, narrow lattice windows, quiet scholarly atmosphere, no floating magical books.
- 主峰廣場：formal assembly hall above broad central steps, freestanding bell pavilion left with large bronze bell, noticeboard under canopy right with paper shapes but no readable text, incense vessel, pines, spacious ceremonial plaza.
- 山門：graceful triple-arch entrance with indigo swept roof on narrow ridge, stone stairway from foreground through gate toward buildings higher in mist, carved stone posts, bronze lamps, guardian stone beasts, pines, bamboo and vast cloud sea.

## 檢視結果與限制

- 已逐張視覺檢視生成結果：四位角色有區別的服裝、配色與神情；五個新地點具各自核心物件，無固定人物與介面。
- 已讀取實際檔案確認尺寸與模式。PNG 立繪具 alpha；未宣稱每個半透明光暈像素都已人工修邊。
- 這批是精細像素風格插畫，不是逐格手工限定色盤、固定低解析度的行走 sprite。此版本用於沉浸式對話立繪，不提供動作骨架。
- 本次沒有生成表情差分、夜景、雨景或動態水面；不得把靜態場景描述成已完成這些功能。
- 基礎圖有固定日光與燈光；程式的時間文字應是真實狀態，未完成夜景前勿宣稱圖像精確反映每個時辰。
- 視覺神態不是主角性格資料。洛河的生成表情不可用來推斷其遊玩人格。
- 衣物配件為視覺設計，不應自動計入可交易背包或賦予戰鬥數值。未來需依正式世界資料決定可互動物件。
- 生成提示可重用，但生成模型具有隨機性；要求精確維持外貌時必須再次使用已保存立繪作身份參考。
