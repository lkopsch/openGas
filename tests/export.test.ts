import {test}from'node:test';import assert from'node:assert/strict';import {DatabaseSync}from'node:sqlite';import {readFileSync}from'node:fs';import ExcelJS from'exceljs';import {databaseSnapshot,exportDatabase,EXPORT_FORMAT}from'../server/export';
test('XLSX preserva todos os perfis, relações, valores, datas, JSON, null e texto vazio',async()=>{
 const db=new DatabaseSync(':memory:');db.exec(readFileSync('data/schema.sql','utf8'));
 db.prepare('insert into usuarios(id,nome) values(?,?)').run('u1','José');db.prepare('insert into usuarios(id,nome) values(?,?)').run('u2','Maria');
 db.prepare('insert into abastecimentos(id,user_id,data,combustivel,preco_litro,litros,km,tanque_cheio,local,observacoes,imposto_federal) values(?,?,?,?,?,?,?,?,?,?,?)').run('a1','u1','2026-09-25','gasolina_comum',6.29,15.899,12345,0,'',null,0);
 db.prepare('insert into despesas(id,user_id,data,tipo,valor,descricao,detalhes) values(?,?,?,?,?,?,?)').run('d1','u2','2026-09-26','multa',100.5,'=1+1',JSON.stringify({orgao:'Órgão',pontos:'4'}));
 const before=databaseSnapshot(db);const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await exportDatabase(db));
 assert.equal(workbook.getWorksheet('metadata')!.getCell('B2').value,EXPORT_FORMAT);
 const nulls=new Set<string>();workbook.getWorksheet('campos_nulos')!.eachRow((row,i)=>{if(i>1)nulls.add(`${row.getCell(1).value}:${row.getCell(2).value}:${row.getCell(3).value}`);});
 for(const [table,data]of Object.entries(before)){const sheet=workbook.getWorksheet(table)!;assert.equal(sheet.rowCount,data.rows.length+1);data.rows.forEach((expected,i)=>{const restored=Object.fromEntries(data.columns.map((c,j)=>{const value=sheet.getRow(i+2).getCell(j+1).value;return[c.name,nulls.has(`${table}:${expected.id}:${c.name}`)?null:value??''];}));assert.deepEqual(restored,{...expected});});}
 assert.deepEqual(databaseSnapshot(db),before);db.close();
});
test('Banco vazio exporta cabeçalhos e versão para futura importação',async()=>{const db=new DatabaseSync(':memory:');db.exec(readFileSync('data/schema.sql','utf8'));const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await exportDatabase(db));assert.equal(workbook.getWorksheet('usuarios')!.rowCount,1);assert.equal(workbook.getWorksheet('metadata')!.getCell('B3').value,1);db.close();});
