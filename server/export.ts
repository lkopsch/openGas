import {exportSnapshot} from '../src/lib/workbook';
import type {DatabaseSync} from 'node:sqlite';
export const EXPORT_FORMAT='opengas.database';
export const EXPORT_VERSION=1;
type Row=Record<string,string|number|null>;
export function databaseSnapshot(db:DatabaseSync){
 db.exec('BEGIN');
 try{const result=Object.fromEntries(['usuarios','abastecimentos','despesas'].map(table=>[table,{columns:db.prepare(`PRAGMA table_xinfo(${table})`).all() as {name:string;type:string;notnull:number;pk:number;hidden:number}[],rows:db.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Row[]}]));db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
}
export async function exportDatabase(db:DatabaseSync){return exportSnapshot(databaseSnapshot(db));}
