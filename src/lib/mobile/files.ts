import {Capacitor,registerPlugin}from'@capacitor/core';
import {toBase64}from'./storage';
export async function saveFile(bytes:Uint8Array,name:string,mime:string){if(Capacitor.isNativePlatform()){const plugin=registerPlugin<{save:(options:{data:string;name:string;mime:string})=>Promise<void>}>('BackupFile');await plugin.save({data:toBase64(bytes),name,mime});return;}const url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
