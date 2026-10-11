/**
 * 問道九州 · 太虛宗／洛河線世界聖經 v1
 *
 * source='established' : inherited from previous 太虛宗 story play.
 * source='expanded'    : new additive worldbuilding for this game.
 *
 * This IS NOT the old 姬玄音／洛雲／太玄仙門 timeline.
 * Wind marks, 大虞風裔, 監天瞳, 古城 and other prior optional story arcs are NOT
 * pre-activated in a freshly created game.
 *
 * Facts describe the world's laws, not scenes the player has already lived.
 */
export const WORLD_BIBLE_VERSION=1;
export const REALM_ORDER=Object.freeze(['凡人','鍛體','聚氣','築基','金丹','元嬰','化神','洞虛','合道','渡劫']);
export const REALM_STAGES=Object.freeze(['初期','中期','後期','圓滿']);
export const APTITUDE_GRADES=Object.freeze(['未知','普通','良','上','卓越','罕見','天驕']);
export const WORLD_BIBLE=Object.freeze({
 id:'taixu-luohe',title:'問道九州｜太虛宗',version:WORLD_BIBLE_VERSION,
 continuity:{
  source:'established',
  line:'太虛宗洛河／青石鎮線',
  exclusions:[
   '不混入舊世界線太玄仙門／聽風閣／姬玄音／洛雲',
   '新測試世界不預設洛河已入棲風峰、已拜沈滄月為師或已突破',
   '不預設風痕、風裔、監天瞳、千年古城或銀髮古人已登場；如未來要開啟須另作獨立事件設計',
   '以前遊玩過的事只是參考的人物原型，不是新存檔已經發生的事件',
  ],
 },
 protagonist:{
  source:'established',name:'洛河',gender:'女',age:15,home:'青石鎮',
  family:['洛成安：父親，木匠','柳氏：母親','洛小川：弟弟，十一歲'],
  characterReference:['機靈好奇','嘴硬','有天才般的自信','大膽愛切磋','對師門和朋友有感情'],
  playerControl:'以上只作原型參考，玩家能自由塑造她；GM 不得代她說話、決策或下內心結論。',
  beginning:'新測試世界線：尚未正式入宗，尚未測定靈根，未建立師徒、恩怨或風痕經歷。',
  aptitude:'初始未知；未完成測試前不能僅因以前玩過純風天才就自行寫成已公布的測試結果。',
 },
 foundations:{
  source:'established',era:'大周曆，太虛宗收徒大典時期',
  geography:'九州廣闊，人族大周仙朝諸郡、北荒妖庭、妖獸山脈與宗門屬地交錯。傳訊、傳送與長途旅行需付代價；世界不會因主角在場而停止。',
  peoples:[
   {name:'人族',source:'established',cultivation:'主要藉靈根、心法、法器、陣法修行，境界不等於品性'},
   {name:'妖族',source:'established',cultivation:'重血脈、妖丹、化形與族群盟約，並非天生敵人'},
   {name:'魔族',source:'established',cultivation:'修煉路線與血脈傳承另成系統；與人族互相提防亦有交易，不等於必然邪惡'},
  ],
  faith:'修道之人善惡由行為、立場與因果決定，不以種族或靈根武斷定性。',
 },
 cultivation:{
  source:'established',realmOrder:REALM_ORDER,subStages:REALM_STAGES,
  hardRules:[
   '同境也有實力差：功法、根基、法器、悟性、環境、身體狀態、情報與準備都影響勝負',
   '低境界不能靠一句宣言躍升高境界；突破必須修煉、具備條件並承擔風險',
   '靈根不等於修為，修為不等於劍術，修為也不等於人格或勢力地位',
   '傳訊、丹藥、法寶、術法、符籙、陣盤、靈獸各有成本、條件與限制',
   '傷勢與靈力消耗持續存在，除非有合理休養或治療，不會下一幕自動痊癒',
   '不允許玩家直接宣告 NPC 已死、法寶已得、突破已成功而略過結果判定',
  ],
  stages:[
   {realm:'鍛體',source:'expanded',principle:'鍛筋骨、蓄血氣，讓肉身承受靈氣。'},
   {realm:'聚氣',source:'expanded',principle:'引氣入體、疏理氣脈，尚不能長期御物或肆意飛行。'},
   {realm:'築基',source:'expanded',principle:'穩固靈台、築道基，根基好壞影響後續。'},
   {realm:'金丹',source:'expanded',principle:'真元凝丹，法術與神識大幅精進。'},
   {realm:'元嬰',source:'expanded',principle:'元嬰初成，神識與自身道途漸獨立。'},
   {realm:'化神',source:'expanded',principle:'神魂映照大道，足以影響一方宗門局勢。'},
   {realm:'洞虛',source:'expanded',principle:'洞察虛實與天地間隙，極其稀少。'},
   {realm:'合道',source:'expanded',principle:'人與自身所修之道相融，不可憑修為推斷必善。'},
   {realm:'渡劫',source:'expanded',principle:'面對大道劫數，生死未定，傳說級強者。'},
  ],
  roots:{
   source:'established',
   kinds:['金','木','水','火','土','風','雷','冰','複合靈根'],
   purity:'靈根數量與純度影響引氣效率，但後天修練、悟性、資源與功法也很重要。',
   qualityGrades:['下品','中品','上品','極品','未知／特殊'],
   aptitudeGrades:APTITUDE_GRADES,
   note:'純風、風金等是屬性；「天驕／上」是綜合資質潛力，不是境界或戰鬥力。未被公開測定的資質應保密。',
  },
  methods:['心法','劍訣','身法','術法','煉丹','鑄器','符籙','陣法','馭獸','神識'],
 },
 sect:{
  name:'太虛宗',source:'established',alignment:'大宗門，行事有門規但有內部權力、利益與不同立場',
  leader:'裴玄真',seat:'太虛宗主峰',
  disciples:['雜役','外門','內門','親傳'],
  governance:[
   '宗主掌宗門大局，長老、各峰峰主與戒律峰分掌其事；峰主不是所有事都可越過宗規',
   '弟子等級與師承是兩條不同軸線：測靈根不等於入內門，更不等於自動拜某位峰主',
   '長老有意收徒也必須有合理見面、考量與當事人意願；洛河的新世界開始時尚未拜師',
   '公開挑戰、私鬥、擅離宗門、毀損法器、偷取資源可依門規受罰，不能由 GM 任意當場赦免',
   '同門不是自動友好；峰與峰之間有合作、競爭、資源配給與個人恩怨',
  ],
  recruitment:{
   source:'expanded',place:'太虛宗山門',steps:[
    '報名與身份核對：執事確認基本資料，不會每一輪反覆詢問姓名年齡',
    '靈根測定：本人以手掌接觸固定測靈石，記錄屬性與品相',
    '資質與心性初評：有機會考察悟性、氣脈、意志、品行，但不全憑單一次靈根測試',
    '錄取與入門安排：依測試、名額、宗門標準確定暫時身份，發給證明與住處',
    '後續師承：各峰觀察、接觸或選徒，可能數日到數年後才拜師，亦可能不拜師',
   ],
   boundaries:[
    '測靈根完成後必須給出明確客觀測試結果，不得「靈氣微動」後無限等待',
    '有特殊靈根不代表直接分配棲風峰；峰主有行程、有意願與自己的判斷',
    '可以跳過閒談、拒絕測試或改走別的路線，但應有合理社會與制度後果',
   ],
  },
  bells:[
   {count:1,meaning:'迎新客或新弟子'},
   {count:2,meaning:'召集'},
   {count:3,meaning:'宗務公告'},
   {count:6,meaning:'警戒'},
   {count:9,meaning:'戰時'},
  ],
  peaks:[
   {id:'main',name:'主峰',source:'established',domain:'宗主議事、調配資源、宗門外交',leader:'裴玄真',mood:'權衡大局；不全然公開'},
   {id:'wind',name:'棲風峰',source:'established',domain:'風道、身法、感知、御風劍術',leader:'沈滄月',mood:'人少、要求嚴、重基本功'},
   {id:'flame',name:'赤霄峰',source:'established',domain:'火法、攻伐與前線任務',leader:'秦昭',mood:'直來直往、重實戰'},
   {id:'sword',name:'天劍峰',source:'established',domain:'劍修、演武、劍陣',leader:'未公開',mood:'好勝、重劍道榮譽'},
   {id:'alchemy',name:'丹霞峰',source:'established',domain:'煉丹、靈藥、療傷',leader:'未公開',mood:'重配伍與安全；偶有炸爐'},
   {id:'array',name:'玄機峰',source:'established',domain:'陣法、推演、機關與破禁',leader:'陸玄機',mood:'重計算、規矩與證據'},
   {id:'beast',name:'靈獸峰',source:'established',domain:'靈獸養育、馭獸與妖獸生態',leader:'未公開',mood:'好野性與耐心'},
   {id:'forge',name:'鑄天峰',source:'established',domain:'鑄器、材料鑑識與法器保養',leader:'韓鐵山',mood:'重實作；火爐與帳簿全年不停'},
   {id:'law',name:'戒律峰',source:'established',domain:'門規執行、糾紛裁決、調查與戒備',leader:'未公開',mood:'證據先於情面'},
   {id:'cloud',name:'青雲峰',source:'established',domain:'綜合術法、日常宗門任務與接引',leader:'未公開',mood:'人多；弟子交際頻繁'},
   {id:'moon',name:'望月峰',source:'expanded',domain:'天象、曆法、觀測與跨郡傳訊',leader:'未公開',mood:'值夜者多；消息未必可靠'},
   {id:'lamp',name:'長明峰',source:'expanded',domain:'典藏、符籙、防護結界與文書',leader:'未公開',mood:'保存檔案勝於爭名'},
  ],
  places:[
   {name:'太虛宗山門',source:'established',description:'收徒報名與入山門禁陣，凡人來往最頻繁'},
   {name:'太虛宗主峰',source:'established',description:'宗主議事與大殿'},
   {name:'棲風峰',source:'established',description:'御風場、靜室與內門弟子住處'},
   {name:'赤霄峰',source:'established',description:'烈火臺與攻伐演武場'},
   {name:'天劍峰',source:'established',description:'劍坪和劍陣'},
   {name:'丹霞峰',source:'established',description:'丹房、藥圃與療養室'},
   {name:'玄機峰',source:'established',description:'陣樓與機關工坊'},
   {name:'靈獸峰',source:'established',description:'靈獸園及試騎場'},
   {name:'鑄天峰',source:'established',description:'鍛爐與材料庫'},
   {name:'戒律峰',source:'established',description:'問詢堂及門規殿'},
   {name:'青雲峰',source:'established',description:'眾多弟子與接待事務'},
   {name:'望月峰',source:'expanded',description:'星台與傳訊房'},
   {name:'長明峰',source:'expanded',description:'典籍房與符籙庫'},
   {name:'演武場',source:'established',description:'正式約戰或公開切磋處，須有監督與裁定'},
   {name:'藏經樓',source:'established',description:'借閱功法、古籍、門規與記錄，有分層權限'},
   {name:'內門居所',source:'established',description:'內門弟子生活之所'},
   {name:'外門報到處',source:'expanded',description:'新弟子領住處、日課與憑證'},
   {name:'外門居所',source:'expanded',description:'新生暫住與晨課集合'},
   {name:'太虛宗執事處',source:'expanded',description:'名冊、任務與人手調派'},
   {name:'青石鎮',source:'established',description:'洛河出生的木匠小鎮；遠離宗門權力中心'},
  ],
 },
 factions:[
  {name:'大周仙朝',source:'established',region:'中州及數郡',goal:'維持秩序、稅賦與邊境盟約',stance:'與宗門互需但對天才與強者有所戒心'},
  {name:'天劍山',source:'established',region:'人族山域',goal:'劍道傳承與聲望',stance:'與太虛宗合作與競爭並存'},
  {name:'萬獸谷',source:'established',region:'南部靈獸山脈',goal:'掌握馭獸與獸群資源',stance:'獸契與獸性觀念異於太虛宗'},
  {name:'北荒妖庭',source:'established',region:'北荒',goal:'維護妖族疆域與血脈盟約',stance:'不是單一惡勢力，內部亦有派系'},
  {name:'太虛宗',source:'established',region:'九州人族宗門界',goal:'宗門延續、傳承與人才',stance:'各峰可能對外務有不同主張'},
  {name:'歸元商會',source:'expanded',region:'多郡商道',goal:'靈材與低階丹藥流通',stance:'供貨與情報交易，與宗門既合作又互相防備'},
 ],
 economy:{
  source:'expanded',currency:['下品靈石','中品靈石','上品靈石'],
  notes:['不是所有交易都以靈石完成；凡俗市鎮也用銅錢及銀錢','宗門功勳、丹藥與法器均不可憑口述無中生有',
   '日課、閉關、靈草採買與練功需要時間和物資'],
 },
 principles:[
  '主角洛河由玩家控制；GM 不得替她編造內心、重要抉擇或未輸入的台詞',
  'GM 管世界、NPC 與暗線，NPC 有獨立動機，可能誤會、拒絕、說謊、犯錯',
  '秘密分為世界真相、人物自身知道的事與流言，不可無端讓旁觀者知道',
  '世界按遊戲時間而非現實時間運行；玩家不干涉的事情亦會發生，但不得憑空把幕後事件當作玩家親歷',
  '修仙生活不是一連串危機：課業、友情、競爭、打鬧、休息、委託與日常都很重要',
  '即興對話優先，不設固定選項式劇情；重要事件先規劃真相，再讓行動改變進程',
 ],
});
export const CANON_LOCATIONS=Object.freeze(WORLD_BIBLE.sect.places.map(p=>p.name));
export const CANON_PEAKS=Object.freeze(WORLD_BIBLE.sect.peaks.map(p=>p.name));
