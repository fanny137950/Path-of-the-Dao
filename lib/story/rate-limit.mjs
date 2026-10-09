function duration(value) {
 if(typeof value!=='string'||value.length>80)return null;
 const text=value.trim().toLowerCase();
 if(!/^(?:\d+(?:\.\d+)?(?:ms|s|m|h|d))+$/.test(text))return null;
 let seconds=0;for(const [,n,unit] of text.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g))seconds+=Number(n)*({ms:.001,s:1,m:60,h:3600,d:86400}[unit]);
 return seconds>0&&seconds<=604800?Math.ceil(seconds):null;
}
export function rateLimitMessage(data,headers,now=Date.now()) {
 // Upstream errors may contain keys, account IDs and user content. Only fixed
 // labels and strictly parsed numbers are returned, never arbitrary text.
 const message=typeof data?.error?.message==='string'?data.error.message.slice(0,16000):'';
 const daily=/tokens? per day|requests? per day|\b[TR]PD\b/i.test(message);
 const tokens=/tokens? per (?:min(?:ute)?|day)|\bTP[MD]\b/i.test(message)||data?.error?.type==='tokens';
 const requests=/requests? per (?:min(?:ute)?|day)|\bRP[MD]\b/i.test(message)||data?.error?.type==='requests';
 const metric=tokens?'Token 用量':requests?'請求次數':null;
 const number=label=>{const value=message.match(new RegExp('\\b'+label+'[: ]+([0-9]+(?:,[0-9]{3})*(?:\\.[0-9]+)?)','i'))?.[1];const n=value===undefined?NaN:Number(value.replaceAll(',',''));return Number.isFinite(n)&&n>=0&&n<=1e12?n:null;};
 const limit=number('limit'),used=number('used'),requested=number('requested');
 const counts=[limit!==null?`上限 ${limit}`:null,used!==null?`已用 ${used}`:null,requested!==null?`本次需要 ${requested}`:null].filter(Boolean);
 const detail=metric&&counts.length?`（${counts.join('，')}）`:'';
 if(tokens&&limit!==null&&requested!==null&&requested>limit)return `本次請求需要的 Token 超過模型${daily?'每日':'每分鐘'}上限${detail}（HTTP 429）。單純等待無法讓同樣大小的請求通過；需減少每回合資料或改用上限較高的模型。正式回合未提交。`;
 let wait=null;const retry=headers.get('retry-after');
 if(retry&&/^\d+(?:\.\d+)?$/.test(retry.trim()))wait=Math.ceil(Number(retry));
 else if(retry&&Number.isFinite(Date.parse(retry)))wait=Math.ceil((Date.parse(retry)-now)/1000);
 if(!(wait>0&&wait<=604800))wait=null;
 if(wait===null&&metric)wait=duration(headers.get(tokens?'x-ratelimit-reset-tokens':'x-ratelimit-reset-requests'));
 if(wait===null)wait=duration(message.match(/try again in\s+((?:\d+(?:\.\d+)?(?:ms|s|m|h|d))+)/i)?.[1]);
 const hint=wait!==null?`至少等待 ${wait} 秒後，再以原回合重試。`:daily?'請等待每日額度重置，或查看模型的每日用量限制。':'供應商未提供等待時間，請稍候再以原回合重試，避免連續點擊。';
 return `${metric?`AI ${daily?'每日':'每分鐘'}${metric}達到限制${detail}`:'AI 暫時限流'}（HTTP 429）。${hint}正式回合未提交。`;
}
