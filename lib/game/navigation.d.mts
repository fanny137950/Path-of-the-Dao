export function findPath(start:any,goal:any):any[];
export function clearSegment(a:any,b:any):boolean;
export function advancePose(current:any,target:any,dt:number,speed?:number):any;
export function facing(dx:number,dz:number,previous?:number):number;
export function animationCell(profile:any,direction:number,walk:boolean,seconds:number):any;
export function heldStep(keys:Set<string>,length?:number):any;
export class MotionPresentation{constructor(position:any);pose:any;target:any;pending:boolean;propose(target:any):void;confirm(position:any):void;reject(position:any):void;tick(dt:number):any;}
