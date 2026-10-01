import sharp from 'sharp';
import {createWorker,PSM} from 'tesseract.js';
import portuguese from '@tesseract.js-data/por';
import {flattenLines,readFuelRow,readTaxRegion,type OCRLine} from './receipt-image';
import {parseExpenseReceipt,parseFuelReceipt} from '../src/lib/receipt-parser';
export {parseExpenseReceipt,parseFuelReceipt} from '../src/lib/receipt-parser';
function cleanTranscript(lines:OCRLine[]){
 const keyword=/AUTO\s*POSTO|POSTO|CNPJ|CPF|MAL\.|RUA\s|AV\.|Fone|Documento Auxiliar|EMITIDA|Pendente|C[ÓO]DIGO|GAS[O0]L[I1]NA|ETANOL|DIESEL|GNV|Qtde|Valor Total|Valor\s+a\s+Pagar|Descontos|Acr[eé]scimos|FORMA DE PAGAMENTO|VALOR PAGO|Cart[aã]o|Dinheiro|PIX|https?:|CONSUMIDOR|NFC|NEC|S[eé]rie|\d{2}\/\d{2}\/20\d{2}|Via Consumidor|Tributos|TRIB\.|\(MUN\)|PLACA|ICMS|conforme Convenio|Vlr/i;
 return lines.map(line=>{const text=line.text.trim();const match=text.match(keyword);if(match)return text.slice(match.index).replace(/\s{2,}/g,' ');const useful=line.words.filter(w=>w.confidence>=65);return useful.length>=2?useful.map(w=>w.text).join(' '):'';}).filter(Boolean).join('\n');
}
export async function readFuelReceipt(image:string){
 const match=image?.match(/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match)throw Error('Envie JPG, PNG ou WebP.');
 const raw=Buffer.from(match[1],'base64');if(raw.length>5*1024*1024)throw Error('A imagem deve ter até 5 MB.');
 const source=await sharp(raw,{limitInputPixels:25e6}).rotate().flatten({background:'#fff'}).resize({width:1800,height:4000,fit:'inside'}).png().toBuffer();
 const normalized=await sharp(source).greyscale().normalize().sharpen().png().toBuffer();
 const worker=await createWorker('por',1,{langPath:portuguese.langPath,gzip:true,cacheMethod:'none'});
 const timer=setTimeout(()=>worker.terminate(),90000);
 try{
  await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1',user_defined_dpi:'300'});
  const first=await worker.recognize(normalized,{}, {blocks:true});
  await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
  const second=await worker.recognize(source,{}, {blocks:true});
  const score=(text:string)=>{const d=parseFuelReceipt(text);return Number(!!d.fields.local)*2+Number(!!d.fields.data)*2+Number(d.total!=null)*2+Number(d.fields.imposto_federal!=='')+Number(d.fields.imposto_estadual!=='');};
  const primary=score(second.data.text)>=score(first.data.text)?second:first;
  if(primary.data.text.trim().length<30)throw Error('Não foi possível ler a nota. Tente uma foto mais nítida.');
  const primaryLines=flattenLines(primary.data.blocks??[]),sourceLines=flattenLines(second.data.blocks??[]);
  const taxes=await readTaxRegion(worker,source,sourceLines);
  let text=cleanTranscript(primaryLines);if(taxes.trim()){text=text.split('\n').filter(l=>!/Tributos.*Incidentes|TRIB.*APROX|\(MUN\)/i.test(l)).join('\n');text+='\n'+taxes.trim();}
  let draft=parseFuelReceipt(text);
  const row=await readFuelRow(worker,source,sourceLines);
  if(row){draft.fields.litros=row.litros;draft.fields.preco_litro=row.preco_litro;
   if(draft.total==null)draft.total=row.total;
   draft.warnings=draft.warnings.filter(w=>w!=='Confira litros e preço por litro.');
   const fuelLine=text.split('\n').findIndex(l=>/GAS[O0]L[I1]NA|ETANOL|DIESEL|GNV/i.test(l));
   const list=text.split('\n');if(fuelLine>=0)list.splice(fuelLine+1,0,`${row.litros.toLocaleString('pt-BR',{minimumFractionDigits:3})} L · R$/L ${row.preco_litro.toLocaleString('pt-BR',{minimumFractionDigits:2})} · Total R$ ${row.total.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);text=list.join('\n');
  }
  if(draft.fields.litros!==''&&draft.fields.preco_litro!==''&&draft.total!=null&&Math.abs(Number(draft.fields.litros)*Number(draft.fields.preco_litro)-draft.total)>.05){draft.fields.litros='';draft.fields.preco_litro='';draft.warnings.push('Litros e preço não conferem com o total. Preencha esses campos manualmente.');}
  const items=draft.fields.litros!==''&&draft.fields.preco_litro!==''?[{descricao:text.split('\n').find(l=>/GAS[O0]L[I1]NA|ETANOL|DIESEL|GNV/i.test(l))??'Combustível',quantidade:draft.fields.litros,preco_unitario:draft.fields.preco_litro,total:draft.total}]:[];
  return {...draft,text,items,confidence:primary.data.confidence};
 }finally{clearTimeout(timer);await worker.terminate().catch(()=>{});}
}
