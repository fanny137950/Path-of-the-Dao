export const VIEW:{width:number,height:number,cx:number,cy:number,sx:number,sy:number};
export function project(p:{x:number,z:number}):{x:number,y:number};
export function unproject(p:{x:number,y:number}):{x:number,z:number};
export function paintWorld(ctx:any,state:any,poses?:any,seconds?:number):void;
