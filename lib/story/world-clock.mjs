import {clone,advanceStory,observe,present,message} from './world.mjs';
// 1 real minute = 1 game minute. Offline work is settled on next access, in
// bounded batches; unprocessed elapsed time remains owed instead of discarded.
export function settleClock(previous,now=Date.now()){
 const s=clone(previous);s.events=[];s.messages=[];
 if(!s.clock){s.clock={version:1,anchor:now,rate:1};s.revision++;return{state:s,changed:true,elapsed:0};}
 if(!Number.isFinite(s.clock.anchor)||now<=s.clock.anchor)return{state:previous,changed:false,elapsed:0};
 const elapsed=Math.min(1440,Math.floor((now-s.clock.anchor)/60000));
 if(elapsed<1)return{state:previous,changed:false,elapsed:0};
 const result=advanceStory(s,elapsed,{stopAtDeadline:false});s.clock.anchor+=result.elapsed*60000;s.revision++;
 observe(s);if(s.scene.target&&!present(s).includes(s.scene.target)){s.scene.target=null;s.scene.openQuestion=null;s.scene.questionSpeaker=null;}
 message(s,'narrator',`你未採取行動的這段時間，世界又過了 ${Math.round(result.elapsed)} 分鐘。`,'world-clock',['player']);
 for(const e of s.events.filter(e=>e.knowers.includes('player')&&['notice','news','event-hook','growth-observed','promise-missed','autonomous-action'].includes(e.type)))message(s,'narrator',e.content,'world-clock',['player'],e.id);
 return{state:s,changed:true,elapsed:result.elapsed};
}
