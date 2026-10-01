import ExcelJS from 'exceljs';
export const EXPORT_FORMAT='opengas.database';
export const EXPORT_VERSION=1;
export type Snapshot=Record<string,{columns:{name:string;type:string;notnull:number;pk:number;hidden:number}[];rows:Record<string,string|number|null>[]} >;
export async function exportSnapshot(snapshot:Snapshot){const workbook=new ExcelJS.Workbook();workbook.creator='openGas';workbook.created=new Date();
 const metadata=workbook.addWorksheet('metadata');metadata.addRow(['chave','valor']);
 const entries:Record<string,string|number>={format:EXPORT_FORMAT,version:EXPORT_VERSION,exported_at:new Date().toISOString(),scope:'all_profiles',date_encoding:'ISO 8601 text',null_encoding:'campos_nulos sheet; blank without entry is empty string',boolean_encoding:'tanque_cheio: integer 0 or 1',detalhes_encoding:'JSON text',generated_columns:'abastecimentos.valor_total: recompute on import',...Object.fromEntries(Object.entries(snapshot).map(([table,data])=>[`count_${table}`,data.rows.length]))};
 for(const entry of Object.entries(entries))metadata.addRow(entry);
 const nulls=workbook.addWorksheet('campos_nulos');nulls.addRow(['tabela','id','campo']);
 const schema=workbook.addWorksheet('schema');schema.addRow(['tabela','campo','tipo_sqlite','not_null','primary_key','generated']);
 for(const [table,data]of Object.entries(snapshot)){
  const sheet=workbook.addWorksheet(table);sheet.addRow(data.columns.map(c=>c.name));
  for(const column of data.columns)schema.addRow([table,column.name,column.type,column.notnull,column.pk,column.hidden===2||column.hidden===3?1:0]);
  for(const row of data.rows){
   sheet.addRow(data.columns.map(column=>{const value=row[column.name];if(typeof value==='string'&&value.length>32767)throw Error(`O campo ${table}.${column.name} excede o limite de texto do XLSX. Use o backup JSON para esse registro.`);if(value===null)nulls.addRow([table,row.id,column.name]);return value;}));
  }
 }
 for(const sheet of workbook.worksheets){sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:sheet.columnCount}};sheet.getRow(1).height=25;sheet.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:'FF24170C'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF58220'}};});sheet.columns.forEach(column=>{const name=String(sheet.getCell(1,column.number).value);column.width=['id','user_id','created_at','updated_at'].includes(name)?38:['descricao','observacoes','detalhes','valor'].includes(name)?48:22;});sheet.eachRow((row,index)=>{if(index>1)row.eachCell(cell=>{if(typeof cell.value==='number')cell.numFmt='0.##########';});});}
 return workbook.xlsx.writeBuffer();
}
