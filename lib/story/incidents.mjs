// Immutable causes and rules belong to truth. Only execution state changes.
export function archiveDossier(){return {
 version:1,title:'舊卷去向',cause:'舊卷紙頁脆化，經登記送往主峰修繕；沒有失竊。',
 participants:[{id:'gu',motive:'讓讀者找到可核對的書目與借閱狀態',goal:'核對修繕回執',resources:['庫房登記','書目副本']},{id:'shen',motive:'保護原本並維持授課',goal:'等待修繕完成',resources:['授課筆記']}],
 past:[{minute:0,fact:'舊卷已依程序送修，庫房留下登記。'}],
 evidence:[{id:'register',location:'library',content:'庫房登記與修繕收據相符：舊卷已送主峰修繕，並非失竊。',knowers:['gu','shen']}],
 falseLeads:[{claim:'書架上沒有舊卷，所以一定是被偷走。',correction:'空書位不能證明失竊；應核對登記。'}],
 naturalPlan:{due:43800,result:'修繕完成後公開歸還登記。'},
 interventions:[{id:'check',condition:'人在藏經樓，親自查閱登記',effect:'取得可追溯證據，不自動接受任務。'},{id:'expedite',condition:'已查閱登記，當面向顧長青請求提早校對，距原定歸還超過一天',effect:'安排優先校對，最早一天後歸還；不改寫送修原因。'}],
 closure:'舊卷歸還並公開登記即收束；玩家不介入也會完成。',consequences:['公開歸還公告','保留玩家查證與介入紀錄，不把猜測寫成真相']
};}
export function incidentView(s){const dossier=s.truth?.dossier;if(!dossier)return {legacy:true,truth:s.truth,naturalPlan:s.worldPlans.find(p=>p.id==='repair'),actual:[],interventions:[],next:null};const plan=s.worldPlans.find(p=>p.id==='repair');return {truth:dossier,naturalPlan:dossier.naturalPlan,actual:s.incident?.actual||[],interventions:s.incident?.interventions||[],next:plan?.done?null:plan?.due,status:plan?.done?'closed':'active'};}
export function incidentActions(s){if(!s.truth?.dossier)return [];const plan=s.worldPlans.find(p=>p.id==='repair');const a=[];if(s.player.location==='library'&&!s.incident?.checked)a.push({id:'check',label:'查閱舊卷登記'});if(s.incident?.checked&&!plan?.done&&!s.incident?.expedited&&plan.due>s.time+1440&&s.npcs.gu.location===s.player.location&&!s.npcs.gu.travel)a.push({id:'expedite',label:'請顧長青安排提早校對'});return a;}
export function intervene(s,operation,record){if(!incidentActions(s).some(a=>a.id===operation))throw Error('目前不符合此事件行動的條件');s.incident??={actual:[],interventions:[]};const plan=s.worldPlans.find(p=>p.id==='repair');let e;
 if(operation==='check'){e=record(s,'evidence',s.truth.dossier.evidence[0].content,['player'],{incident:s.truth.id,evidence:'register'},'親自查閱庫房登記');s.incident.checked=e.id;}
 else{const previous=plan.due;plan.due=Math.max(s.time+1440,plan.due-7*1440);e=record(s,'incident-intervention','洛河當面請顧長青安排提早校對，顧長青核對登記後排入工作。',['player','gu'],{incident:s.truth.id,previousDue:previous,due:plan.due},'當面確認');s.incident.expedited=e.id;}
 const entry={event:e.id,time:s.time,content:e.content};s.incident.actual.push(entry);s.incident.interventions.push({...entry,operation});return e.content;
}
