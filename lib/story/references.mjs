// Only call with the already audience-filtered scene context. No private or
// cross-world lookup is performed when resolving model-provided references.
export function sceneReferenceIndex(context) {
 const eventIds=new Set(context.sharedMemories.map(e=>e.id));
 const messageToEvent={};
 for(const m of context.sharedTranscript||[])if(typeof m.id==='string'&&typeof m.event==='string'&&m.event){
  eventIds.add(m.event);Object.defineProperty(messageToEvent,m.id,{value:m.event,enumerable:true});
 }
 return {eventIds:[...eventIds],messageToEvent};
}
export function resolveSceneReferences(refs,index) {
 const allowed=new Set(index.eventIds);
 if(!Array.isArray(refs))throw referenceError();
 return [...new Set(refs.map(ref=>{
  if(typeof ref!=='string')throw referenceError();
  if(allowed.has(ref))return ref;
  if(Object.hasOwn(index.messageToEvent,ref))return index.messageToEvent[ref];
  throw referenceError();
 }))];
}
function referenceError(){const e=Error('場景引用了未提供的記憶來源，正式回合未提交');e.code='SCENE_MEMORY_REFERENCE';return e;}
