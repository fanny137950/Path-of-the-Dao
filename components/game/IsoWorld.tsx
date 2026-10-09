'use client';
import {useEffect,useRef,useState} from 'react';
import {VIEW,project,unproject} from '../../lib/game/isometric.mjs';
import VISUALS from '../../data/character-visuals.json';
import {findPath,advancePose,facing,animationCell,heldStep,clearSegment,MotionPresentation} from '../../lib/game/navigation.mjs';
import {rasterizeFrame} from '../../lib/game/sprites.mjs';
import {distance} from '../../lib/game/spatial.mjs';
type Props={state:any,busy:boolean,paused?:boolean,onAction:(a:any)=>Promise<boolean>|void,onTalk:(id:string)=>void};
export default function IsoWorld(props:Props){
 const ref=useRef<HTMLCanvasElement>(null),current=useRef(props),command=useRef<(dx:number,dz:number)=>void>(()=>{});
 const [near,setNear]=useState<any>(null),[live,setLive]=useState(false),[error,setError]=useState('');current.current=props;
 useEffect(()=>{if(!live)return;const timer=setInterval(()=>{if(!current.current.busy&&!current.current.paused)current.current.onAction({type:'wait',minutes:1,ambient:true});},20000);return()=>clearInterval(timer);},[live]);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx){setError('無法啟用畫布。仍可使用地圖與文字行動。');return;}
  const background=new Image(),sprites=new Image(),walkAtlas=new Image();
  background.src='/art/courtyard-v3.png';sprites.src='/art/characters-v3.png';walkAtlas.src=(VISUALS.profiles.player as any).atlas?.path||VISUALS.atlas.path;
  const frames:Record<string,HTMLCanvasElement>={},poses:Record<string,any>={},keys=new Set<string>();
  const motion=new MotionPresentation(current.current.state.player.position||{x:0,z:10});
  let path:any[]=[],talkAfter:string|null=null,last=performance.now(),raf=0,active=true,nearest='',seenRevision=current.current.state.revision;
  async function submit(point:any){
   const {state,busy,paused}=current.current;if(busy||paused||motion.pending)return;
   if(!clearSegment(state.player.position,point)){keys.clear();path=[];return;}
   motion.propose(point); // presentation prediction only; server owns all actual state
   try{const accepted=await current.current.onAction({type:'walk',position:point});if(!active)return;
    if(accepted===false){motion.reject(current.current.state.player.position);keys.clear();path=[];talkAfter=null;}
    else motion.confirm(point);
   }catch{if(active){motion.reject(current.current.state.player.position);keys.clear();path=[];setError('移動未確認，已回到正式保存位置。');}}
  }
  function step(dx:number,dz:number){const p=current.current.state.player.position;submit({x:p.x+dx,z:p.z+dz});}
  command.current=step;
  function frame(){
   raf=requestAnimationFrame(frame);const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;
   const {state,busy,paused}=current.current;
   if(paused){keys.clear();path=[];talkAfter=null;}
   if(state.revision!==seenRevision){seenRevision=state.revision;if(!motion.pending)motion.confirm(state.player.position);}
   if(!busy&&!paused&&!motion.pending&&distance(motion.pose,motion.target)<1){
    if(path.length){if(clearSegment(motion.pose,path[0])||distance(motion.pose,motion.target)<.1)submit(path.shift());}
    else if(talkAfter&&distance(motion.pose,motion.target)<.1){const id=talkAfter;talkAfter=null;current.current.onTalk(id);}
    else{const delta=heldStep(keys);if(delta)step(delta.x,delta.z);}
   }
   poses.player=motion.tick(dt);
   const ids=new Set(['player',...state.npcs.map((n:any)=>n.id)]);for(const id of Object.keys(poses))if(!ids.has(id))delete poses[id];
   let close:any=null,min=12;
   for(const n of state.npcs){const old=poses[n.id]||{...n.position,direction:0,phase:0};const next=advancePose(old,n.position,dt,12);poses[n.id]={...next,direction:facing(next.x-old.x,next.z-old.z,old.direction),phase:old.phase+distance(old,next)*1.4};const d=distance(state.player.position,n.position);if(d<min){min=d;close=n;}}
   if((close?.id||'')!==nearest){nearest=close?.id||'';setNear(close);}
   const rect=canvas!.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
   if(canvas!.width!==Math.round(rect.width*ratio)||canvas!.height!==Math.round(rect.height*ratio)){canvas!.width=Math.round(rect.width*ratio);canvas!.height=Math.round(rect.height*ratio);}
   const scale=Math.max(rect.width/VIEW.width,rect.height/VIEW.height),ox=(rect.width-VIEW.width*scale)/2,oy=(rect.height-VIEW.height*scale)/2;
   ctx!.setTransform(ratio*scale,0,0,ratio*scale,ratio*ox,ratio*oy);ctx!.imageSmoothingEnabled=true;
   ctx!.fillStyle='#243d42';ctx!.fillRect(0,0,960,540);if(background.complete&&background.naturalWidth)ctx!.drawImage(background,0,0,960,540);
   const actors=[{id:'player',name:'洛河'},...state.npcs].sort((a,b)=>(poses[a.id].x+poses[a.id].z)-(poses[b.id].x+poses[b.id].z));
   for(const actor of actors){
    const pose=poses[actor.id],q=project(pose),profile=(VISUALS.profiles as any)[actor.id];
    ctx!.fillStyle='#10212c66';ctx!.beginPath();ctx!.ellipse(q.x,q.y+2,13,5,0,0,Math.PI*2);ctx!.fill();
    if(state.experiment&&actor.id==='player'&&walkAtlas.complete&&walkAtlas.naturalWidth){
     const atlas=profile.atlas||VISUALS.atlas,cell=animationCell({...atlas,rowOffset:0},pose.direction,pose.walk,pose.phase/atlas.walkFps);
     const sw=walkAtlas.naturalWidth/atlas.columns,sh=walkAtlas.naturalHeight/atlas.rows,key=`${cell.row}:${cell.column}`;
     if(!frames[key]){const f=document.createElement('canvas');f.width=atlas.nativeWidth;f.height=atlas.nativeHeight;const fc=f.getContext('2d')!;rasterizeFrame(fc,walkAtlas,atlas,cell);frames[key]=f;}
     ctx!.imageSmoothingEnabled=false;ctx!.drawImage(frames[key],Math.round(q.x-atlas.drawWidth*.5),Math.round(q.y-atlas.drawHeight*.9),atlas.drawWidth,atlas.drawHeight);
    }else if(sprites.complete&&sprites.naturalWidth){const sw=sprites.naturalWidth/5,index=Math.max(0,['player','shen','yan','jiang','gu'].indexOf(actor.id));ctx!.imageSmoothingEnabled=true;ctx!.drawImage(sprites,index*sw,0,sw,sprites.naturalHeight,q.x-24,q.y-68,48,72);}
    ctx!.font='10px sans-serif';ctx!.textAlign='center';ctx!.fillStyle='#132437bb';ctx!.fillRect(q.x-25,q.y-92,50,15);ctx!.fillStyle=actor.id==='player'?'#f7e8b5':'#eef1df';ctx!.fillText(actor.name,q.x,q.y-81);
   }
   if(state.time%1440>=1080||state.time%1440<360){ctx!.fillStyle='#17294766';ctx!.fillRect(0,0,960,540);}
  }
  function key(e:KeyboardEvent){if(current.current.paused||(e.target as HTMLElement).closest('input,textarea,select'))return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['w','a','s','d','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(k)){e.preventDefault();keys.add(k);path=[];talkAfter=null;}}
  function keyup(e:KeyboardEvent){keys.delete(e.key.length===1?e.key.toLowerCase():e.key);}
  function blur(){keys.clear();path=[];talkAfter=null;}
  function click(e:PointerEvent){
   if(current.current.paused)return;
   const rect=canvas!.getBoundingClientRect(),scale=Math.max(rect.width/VIEW.width,rect.height/VIEW.height),pnt={x:(e.clientX-rect.left-(rect.width-VIEW.width*scale)/2)/scale,y:(e.clientY-rect.top-(rect.height-VIEW.height*scale)/2)/scale};
   const hit=current.current.state.npcs.find((n:any)=>{const q=project(n.position);return Math.abs(pnt.x-q.x)<23&&pnt.y>q.y-78&&pnt.y<q.y+8;});
   if(hit&&distance(current.current.state.player.position,hit.position)<=12&&!motion.pending){current.current.onTalk(hit.id);return;}
   keys.clear();const from=motion.pending?motion.target:current.current.state.player.position;path=findPath(from,hit?hit.position:unproject(pnt));talkAfter=hit?hit.id:null;
   if(!path.length){talkAfter=null;setError('這條路線不可通行，請點选庭院石路。');}else setError('');
  }
  canvas.addEventListener('pointerup',click);window.addEventListener('keydown',key);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);frame();
  return()=>{active=false;cancelAnimationFrame(raf);command.current=()=>{};canvas.removeEventListener('pointerup',click);window.removeEventListener('keydown',key);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);};
 },[]);
 return <div className="iso-world"><canvas ref={ref} width={VIEW.width} height={VIEW.height} aria-label="棲風峰場景；按住方向鍵連續行走"/>{error&&<div className="three-error">{error}</div>}{near&&<button className="interaction-prompt" disabled={props.busy||props.paused} onClick={()=>props.onTalk(near.id)}>與 {near.name} 交談 ↗</button>}<div className="dpad pixel-dpad"><button disabled={props.busy||props.paused} onClick={()=>command.current(-4.9,-4.9)}>↑</button><div><button disabled={props.busy||props.paused} onClick={()=>command.current(-4.9,4.9)}>←</button><button disabled={props.busy||props.paused} onClick={()=>command.current(4.9,4.9)}>↓</button><button disabled={props.busy||props.paused} onClick={()=>command.current(4.9,-4.9)}>→</button></div></div><label className="iso-live"><input type="checkbox" checked={live} onChange={e=>setLive(e.target.checked)}/>{props.state.experiment?'NPC 固定 · 可選時間推進':'世界自行運轉'}<small>每 20 秒推進 1 分鐘</small></label></div>;
}
