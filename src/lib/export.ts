import {useData} from '../store/domain';
export async function downloadDatabase(){
 if(import.meta.env.VITE_MOBILE==='1'){const{snapshot}=await import('./mobile/api');const{exportSnapshot}=await import('./workbook');const{saveFile}=await import('./mobile/files');await saveFile(new Uint8Array(await exportSnapshot(await snapshot())),`opengas-database-${new Date().toISOString().replace(/[:.]/g,'-')}.xlsx`,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');return;}
 const response=await fetch('/api/export/xlsx',{headers:{'x-user-id':useData.getState().user}});
 if(!response.ok){const body=await response.json();throw Error(body.error||'Não foi possível exportar o banco.');}
 const blob=await response.blob(),url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]??'opengas-database.xlsx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function downloadProfile(blob:Blob,name:string){const{saveFile}=await import('./mobile/files');await saveFile(new Uint8Array(await blob.arrayBuffer()),name,'application/json');}
