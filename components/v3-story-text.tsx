import {Fragment} from 'react';

/** Render only text/limited emphasis; model output is never trusted HTML. */
export default function StoryText({text}:{text:string}){
 return <>{text.split(/\n\s*\n/).filter(Boolean).map((paragraph,index)=><p key={index}>
  {paragraph.split(/(「[^」]*」|\*\*[^*\n]+\*\*)/g).map((part,i)=>
   part.startsWith('「')?<span className="v3-spoken" key={i}>{part}</span>:
   part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:
   <Fragment key={i}>{part}</Fragment>)}
 </p>)}</>;
}
