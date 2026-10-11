/**
 * Defensive display-only validation for model output. Classification/debug messages
 * are not in-world narration and must never become official NPC memories.
 */
// Models sometimes omit the closing --> or produce invalid JSON. Metadata must never render.
const metadata=/(?:\r?\n)?<!--GM_STATE:[\s\S]*$/;
const singleLabel=/^(?:user\s+safety|safety|content\s+safety|moderation|risk\s+level|policy\s+check|classification)\s*:\s*(?:safe|unsafe|allow|allowed|pass|passed|blocked|low|medium|high|none|true|false|[0-9]+)\s*$/i;
const statusOnly=/^(?:user\s+safety\s*:\s*[^\r\n]+|safety\s*:\s*[^\r\n]+|(?:result|status)\s*:\s*(?:safe|unsafe|pass|passed))$/i;
export function visibleNarrative(raw){
 if(typeof raw!=='string')return '';
 return raw.replace(metadata,'').trim();
}
export function isNonNarrative(raw){
 const value=visibleNarrative(raw);
 if(!value)return true;
 // Reject one-line status/classification outputs, not words occurring inside dialogue.
 if(singleLabel.test(value)||statusOnly.test(value))return true;
 const lines=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length>0&&lines.length<=5&&lines.every(x=>singleLabel.test(x)))return true;
 // JSON status responses aren't story text.
 if(/^\{\s*"(?:user_safety|safety|classification|status|risk)"\s*:\s*(?:"[^"]*"|true|false|null)\s*\}$/i.test(value))return true;
 return false;
}
export function requireNarrative(raw){
 if(isNonNarrative(raw)){
  const failure=new Error('AI 沒有產生可用劇情，本回合未存檔。請重試或切換免費模型。');
  failure.status=502;
  throw failure;
 }
 return raw;
}
