export function parseExpenseReceipt(text:string){
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
 const date=text.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
 const totalIndex=lines.findIndex(l=>/valor\s+a\s+pagar|total\s+a\s+pagar|valor\s+total|total\s*R\$/i.test(l));
 const amount=totalIndex>=0?lines.slice(totalIndex,totalIndex+2).join(' ').match(/\d+(?:\.\d{3})*,\d{2}/)?.[0]:undefined;
 const total=amount?Number(amount.replace(/\./g,'').replace(',','.')):null;
 const local=lines.find(l=>/[a-zÀ-ÿ]{3}/i.test(l)&&!/CNPJ|CPF|DOCUMENTO|DANFE|NOTA FISCAL/i.test(l))??'';
 const tipo=/IPVA|LICENCIAMENTO|DPVAT/i.test(text)?'imposto':/AP[ÓO]LICE|SEGURO/i.test(text)?'seguro':/MULTA|INFRA[CÇ][AÃ]O/i.test(text)?'multa':/OFICINA|PNEU|REVIS[AÃ]O|[ÓO]LEO|MANUTEN[CÇ][AÃ]O/i.test(text)?'manutencao':'outro';
 return {fields:{local,data:date?`${date[3]}-${date[2]}-${date[1]}`:'',valor:total??'',tipo,descricao:local?`Nota fiscal · ${local}`:'Despesa da nota fiscal',detalhes:{nota_texto:text}},total,text,warnings:['Confira a categoria, descrição e valor antes de salvar.',...(total==null?['Valor total não identificado.']:[])]};
}
export function parseFuelReceipt(text:string){
 const clean=text.replace(/[|]/g,'I');const lines=clean.split('\n').map(l=>l.trim()).filter(Boolean);
 const decimal=(v:string)=>Number(v.replace(/\./g,'').replace(',','.'));
 const numbers=(v:string)=>[...v.matchAll(/\d+[,.]\d{2,3}/g)].map(x=>decimal(x[0].replace('.',',')));
 const merchant=(lines.find(l=>/POSTO|AUTO\s*POSTO/i.test(l))??'').replace(/^.*?(?=AUTO\s*POSTO|POSTO)/i,'').replace(/\s{2,}.*/,'');
 const date=clean.match(/(\d{2})\/(\d{2})\/(20\d{2})/);
 const fuelIndex=lines.findIndex(l=>/GAS[O0]L[I1]NA|ETANOL|DIESEL|GNV/i.test(l));
 const item=fuelIndex>=0?lines.slice(fuelIndex,fuelIndex+3).filter(l=>!/Qtde|Valor Total|Descontos/i.test(l)).join(' '):'';
 const vals=numbers(item);const liters=vals.length>=2?vals[0]:undefined;const price=vals.length>=2&&vals[1]>0&&vals[1]<20?vals[1]:undefined;
 const totalLine=lines.findIndex(l=>/Valor\s+a\s+Pagar|Valor\s+Total\s*R/i.test(l));
 const total=totalLine>=0?numbers(lines.slice(totalLine,totalLine+2).join(' '))[0]:undefined;
 const tax=(tag:string)=>{const matches=[...clean.matchAll(new RegExp('(?:R\\$\\s*)?(\\d+[,.]\\d{2})[^\\d()]{0,24}\\('+tag+'\\)','gi'))];const m=matches.at(-1);return m?decimal(m[1].replace('.',',')):'';};
 const cnpj=clean.match(/\d{2}\.\s*\d{3}\.\s*\d{3}\/\d{4}-\d{2}/)?.[0].replace(/\s/g,'')??'';
 const nf=clean.match(/NFC-?e\s*(?:n[ºo°]?\s*)?([\d.]+)/i)?.[1]??'';
 const payment=lines.find(l=>/Cart[aã]o|Dinheiro|PIX/i.test(l))??'';
 const combustivel=/ETANOL/i.test(item)?'etanol':/S10/i.test(item)?'diesel_s10':/DIESEL/i.test(item)?'diesel':/GNV/i.test(item)?'gnv':/ADITIV/i.test(item)?'gasolina_aditivada':'gasolina_comum';
 return {fields:{local:merchant,data:date?`${date[3]}-${date[2]}-${date[1]}`:'',combustivel,litros:liters??'',preco_litro:price??'',imposto_federal:tax('FED'),imposto_estadual:tax('EST'),imposto_municipal:tax('MUN'),observacoes:[cnpj&&`CNPJ: ${cnpj}`,nf&&`NFC-e: ${nf}`,payment&&`Pagamento: ${payment}`].filter(Boolean).join('\n')},total:total??null,text,warnings:[...(fuelIndex<0?['Combustível não identificado.']:[]),...(!liters||!price?['Confira litros e preço por litro.']:[]),'Informe o odômetro e confirme se o tanque ficou cheio antes de salvar.']};
}
