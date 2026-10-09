export const VERSION:number;
export const NPCS:Record<string,any>;
export const PLACES:Record<string,any>;
export const EDGES:any[];
export function route(a:string,b:string,s?:any):any;
export function initial(id:string):any;
export function retrieve(s:any,actor:string,query?:string):any[];
export function parse(text:string):any;
export function advance(s:any,minutes:number,training?:boolean):boolean;
export function turn(s:any,request:any):any;
export function visible(s:any):any;
export function branch(s:any,id:string):any;

export function laboratory(id:string):any;
export function positionOf(s:any,id:string):any;
