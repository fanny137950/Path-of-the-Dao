# 實驗場美術素材與可重用規格
工具：內建 imagegen，參考 public/art/characters-v3.png 中前兩名人物身份。
正式素材：public/art/walk-lab-v1.png、public/art/dialogue-lab-v1.png。

## 動畫圖集提示詞
Production animation spritesheet for original xianxia pixel RPG. Appearance identity of FIRST two reference figures: Luohe young female teal-white robes dark long hair teal flower; Shen Cangyue adult female blue-white robes silver flower. ONE transparent spritesheet, exactly 6 equally wide columns and 8 equally tall rows, no margins between cells, centered subjects, same feet baseline, never overlapping. First four rows Luohe: front, left, right, back; last four rows Shen same directions. Six consecutive different walk-cycle poses per row, swinging arms, legs, fluttering hem. Chunky crisp true pixel art, appearance of 48 by 64 pixel grid, chibi about 3 heads tall, no painterly gradients. No text, grid lines, shadows or props. Exactly 48 figures.

人工檢查結果：生成方向實際為 front/right/left/back，因此 data/character-visuals.json 明確使用 directionRows=[0,2,1,3] 修正。不是假設 AI 一定遵守提示。圖集是生成初稿，畫格尺寸與步態仍需要進一步校正；現有版本不能視為最終製作級動畫。
執行時將單一畫格畫入32×36低解析畫布，以最近鄰放大兩倍呈現，形成較大的像素格。原始高解析素材保留。人物仍使用共用腳底定位；不是 3D 模型或可任意生成姿勢的 rig。

## 對話立繪提示詞
Original xianxia detailed pixel RPG dialogue portraits matching reference FIRST TWO characters. Exactly two equal-width halves: LEFT Luohe, 15-year-old female dark brown long hair, teal flower ornament, teal-white robes, confident curious face; RIGHT Shen Cangyue adult female, dark hair silver flower, cool blue-white robes, calm stern protective gaze. Refined hand-pixeled art, fine pixel clusters, muted indigo teal ivory, three-quarter head-and-upper-torso, look slightly toward center, centered within each half, shoulders fully visible, same framing, no overlap, transparent background, no text/frame/objects. Preserve original hair accessories and outfit.

後續需完成：重要角色外貌正式定稿、八方向、待機獨立動畫、跑步/坐下/修行/物品使用、表情差分、腳底漂移量測、逐幀像素品質校正、組件換裝。角色生成不能直接把一張概念圖當成可用動畫。

## v2：清晰行走，立繪保留
新素材 public/art/luohe-walk-clean-v2.png。內建 imagegen 以使用者 image(3).png 為像素風格參考，以既有左側洛河立繪為身份參考。提示詞：透明背景，8欄4列共32個行走畫格，方向前/左/右/後，每方向8個連續步態。黑棕長髮、青色緞帶/簡化花飾、月白上衣/青綠裙帶、可見深色靴子。大面積平塗、清晰輪廓、約16色；禁止刺繡、細髮絲、碎亮點、抖色紋理、漸層與水彩陰影。人物頭約身高三分之一，腳底相同，畫格不能溢出。
執行時使用64×80畫格，16色固定調色盤，清除孤立透明邊緣碎點，統一腳底定位。立繪 public/art/dialogue-lab-v1.png 未修改。新版不再把原本細節圖集縮到32×36後放大。
步態相位由移動距離累積，不因回合提交或網路確認重新開始。圖集仍為需人工修整的生成素材。
