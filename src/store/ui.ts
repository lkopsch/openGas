import {create} from 'zustand';
import {persist} from 'zustand/middleware';
export const useUI=create<{theme:string;setTheme:(theme:string)=>void;toast:string;notify:(text:string)=>void}>()(persist(set=>({theme:'system',setTheme:theme=>set({theme}),toast:'',notify:toast=>{set({toast});setTimeout(()=>set({toast:''}),3500);}}),{name:'opengas-ui',partialize:s=>({theme:s.theme})}));
