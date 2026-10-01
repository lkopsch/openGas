import sharp from 'sharp';
import {PSM,type Worker} from 'tesseract.js';
type Box={x0:number;y0:number;x1:number;y1:number};
export type OCRLine={text:string;bbox:Box;words:{text:string;bbox:Box;confidence:number}[]};
export function flattenLines(blocks:any[]):OCRLine[]{return blocks.flatMap(b=>(b.paragraphs??[]).flatMap((p:any)=>p.lines??[]));}

// Remove uneven illumination locally, rather than turning the whole photo dark.
export async function adaptiveImage(image:Buffer){
 const source=await sharp(image).greyscale().raw().toBuffer({resolveWithObject:true});
 const background=await sharp(image).greyscale().blur(12).raw().toBuffer();
 const mask=source.data.map((v,i)=>v/Math.max(1,background[i])*255<190?0:255);
 return sharp(mask,{raw:{width:source.info.width,height:source.info.height,channels:1}}).png().toBuffer();
}
export async function readFuelRow(worker:Worker,image:Buffer,lines:OCRLine[]){
 const anchor=lines.find(l=>/GAS[O0]L[I1]NA|ETANOL|DIESEL|GNV/i.test(l.text));
 const word=anchor?.words.find(w=>/GAS[O0]L[I1]NA|ETANOL|DIESEL|GNV/i.test(w.text));
 if(!anchor||!word)return null;
 const meta=await sharp(image).metadata();const width=meta.width!,height=meta.height!;
 const fontHeight=word.bbox.y1-word.bbox.y0;
 if(fontHeight<8)return null;
 const top=Math.round(anchor.bbox.y1+fontHeight*.12),rowHeight=Math.round(fontHeight*1.45);
 const left=Math.max(0,Math.floor(anchor.words.find(w=>/^\d{5,}$/.test(w.text))?.bbox.x0??width*.1));
 const rowWidth=Math.floor(width*.975)-left;
 if(top+rowHeight>=height||rowWidth<=0)return null;
 const source=await sharp(image).extract({left,top,width:rowWidth,height:rowHeight}).greyscale().raw().toBuffer({resolveWithObject:true});
 const background=await sharp(source.data,{raw:{width:rowWidth,height:rowHeight,channels:1}}).blur(12).raw().toBuffer();
 const mask=source.data.map((v,i)=>v/Math.max(1,background[i])*255<190?0:255);
 const groups:{start:number;end:number}[]=[];let start=-1,last=-1;
 // Ignore the bottom of the band for locating columns: dotted rules sit there.
 for(let x=0;x<rowWidth;x++){let count=0;for(let y=0;y<rowHeight-Math.round(fontHeight*.24);y++)if(mask[y*rowWidth+x]===0)count++;
  if(count>=Math.max(3,Math.round(fontHeight*.12))){if(start<0)start=x;last=x;}
  else if(start>=0&&x-last>fontHeight*.7){groups.push({start,end:last});start=-1;}
 }
 if(start>=0)groups.push({start,end:last});
 const values:{value:number;score:number;variants:number}[]=[];
 for(const group of groups.slice(0,8)){
  if(group.end-group.start<fontHeight*.5)continue;
  const cropLeft=Math.max(0,left+group.start-10),cropWidth=Math.min(width-cropLeft,group.end-group.start+22);
  const crop=await sharp(image).extract({left:cropLeft,top,width:cropWidth,height:rowHeight}).greyscale().resize({width:cropWidth*2}).extend({top:20,bottom:20,left:20,right:20,background:'#fff'}).png().toBuffer();
  const variants=[{image:crop,weight:.4},{image:await sharp(crop).threshold(145).png().toBuffer(),weight:1.2},{image:await adaptiveImage(crop),weight:1}];
  const votes=new Map<number,{score:number;variants:number}>();
  for(const [index,variant]of variants.entries())for(const mode of [PSM.SINGLE_LINE,PSM.SINGLE_WORD]){
   await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:'0123456789.,',user_defined_dpi:'300'});
   const result=await worker.recognize(variant.image);
   const match=result.data.text.trim().match(/^[.,\s]*(\d+[.,]\d{2,3})[.,\s]*$/);
   if(!match||result.data.confidence<35)continue;
   const value=Number(match[1].replace(',','.'));if(value<=0)continue;
   const vote=votes.get(value)??{score:0,variants:0};vote.score+=Math.max(35,result.data.confidence)*variant.weight;vote.variants|=1<<index;votes.set(value,vote);
  }
  const sorted=[...votes.entries()].sort((a,b)=>b[1].score-a[1].score);
  if(sorted.length){const [value,vote]=sorted[0];values.push({value,...vote});}
 }
 await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:PSM.SINGLE_BLOCK});
 if(values.length<3||values[0].value>250||values[1].value>30)return null;
 const [liters,price,total]=values;
 // Cross-check independent readings; never derive a missing digit from the total.
 if(Math.abs(liters.value*price.value-total.value)>.05)return null;
 if(values.slice(0,3).some(v=>(v.variants&(v.variants-1))===0))return null;
 return {litros:liters.value,preco_litro:price.value,total:total.value};
}

export async function readTaxRegion(worker:Worker,image:Buffer,lines:OCRLine[]){
 const anchor=lines.find(l=>/TRIB.*APROX/i.test(l.text));const word=anchor?.words.find(w=>/TRIB/i.test(w.text));if(!anchor||!word)return '';
 const preceding=lines[lines.indexOf(anchor)-1];const previous=preceding&&/Tributos.*Incidentes/i.test(preceding.text)?preceding:null;
 const meta=await sharp(image).metadata();const padding=12,left=Math.max(0,word.bbox.x0-padding),top=Math.max(0,(previous?.bbox.y0??anchor.bbox.y0)-padding);
 const height=Math.min(meta.height!-top,Math.round(anchor.bbox.y1+(anchor.bbox.y1-anchor.bbox.y0)*1.6-top));
 const region=await sharp(image).extract({left,top,width:Math.min(meta.width!-left,anchor.bbox.x1-left+padding),height}).png().toBuffer();
 await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:''});return (await worker.recognize(region)).data.text;
}
