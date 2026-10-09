import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'問道九州 · AI Living World',description:'一個保存記憶、遵循因果的修仙世界。第一階段可玩引擎原型。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-Hant"><body>{children}</body></html>}
