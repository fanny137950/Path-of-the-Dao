import {Fragment} from 'react';

/** Small text-only renderer: scene headings, lists and emphasis, never raw HTML. */
const inline=(text:string)=>text.split(/(「[^」]*」|\*\*[^*\n]+\*\*)/g).map((part,i)=>
 part.startsWith('「')?<span className="v3-spoken" key={i}>{part}</span>:
 part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:
 <Fragment key={i}>{part}</Fragment>);
export default function StoryText({text}:{text:string}){
 const blocks=text.replace(/\r\n/g,'\n').replace(/^(#{1,6}\s+.+)$/gm,'\n\n$1\n\n').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
 return <>{blocks.map((block,index)=>{
  if(/^#{1,6}\s+/.test(block))return <h3 className="v3-scene-heading" key={index}>{inline(block.replace(/^#{1,6}\s+/,''))}</h3>;
  const lines=block.split('\n');
  if(lines.every(line=>/^\s*[-*]\s+/.test(line)))return <ul key={index}>{lines.map((line,i)=><li key={i}>{inline(line.replace(/^\s*[-*]\s+/,''))}</li>)}</ul>;
  return <p key={index}>{inline(block)}</p>;
 })}</>;
}
