export interface DirectoryCharacter {
 id:string;
 name:string;
 peak?:string;
 role:string;
 realm:string;
 roots?:string;
 where?:string;
 mood?:string;
 aptitude?:{grade?:string};
 personality?:string;
 traits?:string[];
 methods?:string[];
}
export interface DirectoryRank<T extends DirectoryCharacter> {
 id:string;
 name:string;
 people:T[];
}
export interface DirectorySection<T extends DirectoryCharacter> {
 id:string;
 name:string;
 count:number;
 ranks:DirectoryRank<T>[];
}
export interface DirectoryGroup<T extends DirectoryCharacter> {
 id:string;
 name:string;
 count:number;
 sections:DirectorySection<T>[];
}
export declare function organizeCharacters<T extends DirectoryCharacter>(
 characters:Record<string,T>,
 opts?:{peaks?:Array<string|{name:string}>;query?:string}
):DirectoryGroup<T>[];
export declare function countCharacters(groups:DirectoryGroup<DirectoryCharacter>[]):number;
