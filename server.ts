import express from 'express';
import {exportDatabase} from './server/export';
import {readFuelReceipt,parseExpenseReceipt} from './server/receipt';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
const db=new DatabaseSync(path.resolve('data/opengas.db'));
db.exec(readFileSync('data/schema.sql','utf8'));db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
const app=express();app.use(express.json({limit:'8mb'}));
app.get('/api/usuarios',(_,res)=>res.json(db.prepare('select * from usuarios order by nome').all()));
app.post('/api/usuarios',(req,res)=>{const nome=String(req.body.nome??'').trim();if(!nome||nome.length>100){res.status(400).json({error:'Informe um nome de até 100 caracteres.'});return;}const id=randomUUID();db.prepare('insert into usuarios(id,nome) values(?,?)').run(id,nome);res.json({id,nome});});
app.use('/api',(req,res,next)=>{const id=String(req.headers['x-user-id']??'');if(!db.prepare('select id from usuarios where id=?').get(id)){res.status(401).json({error:'Selecione um perfil.'});return;}res.locals.user=id;next();});
app.get('/api/export/xlsx',async(_,res)=>{try{const buffer=await exportDatabase(db);const stamp=new Date().toISOString().replace(/[:.]/g,'-');res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="opengas-database-${stamp}.xlsx"`);res.setHeader('Cache-Control','no-store');res.send(Buffer.from(buffer));}catch(e){res.status(500).json({error:(e as Error).message});}});
let ocrBusy=false;
app.post('/api/nota/ocr',async(req,res)=>{if(ocrBusy){res.status(429).json({error:'Uma nota está em leitura. Aguarde.'});return;}ocrBusy=true;try{const result=await readFuelReceipt(req.body.image);res.json(req.body.kind==='despesas'?{...parseExpenseReceipt(result.text),confidence:result.confidence}:result);}catch(e){res.status(400).json({error:(e as Error).message});}finally{ocrBusy=false;}});
app.get('/api/dados',(_,res)=>res.json({abastecimentos:db.prepare('select * from abastecimentos where user_id=? order by data desc,created_at desc').all(res.locals.user),despesas:db.prepare('select * from despesas where user_id=? order by data desc,created_at desc').all(res.locals.user)}));
const fuel=['data','local','combustivel','preco_litro','litros','km','tanque_cheio','imposto_federal','imposto_estadual','imposto_municipal','observacoes'];
const expense=['tipo','data','valor','descricao','local','km','detalhes'];
app.all('/api/:table{/:id}',(req,res)=>{const table=req.params.table;if(!['abastecimentos','despesas'].includes(table)){res.status(404).end();return;}const id=req.params.id;const user=res.locals.user;
try{
if(req.method==='DELETE'){const result=db.prepare(`delete from ${table} where id=? and user_id=?`).run(id!,user);if(!result.changes){res.status(404).json({error:'Registro não encontrado.'});return;}res.json({ok:true});return;}
if(!['POST','PUT'].includes(req.method)){res.status(405).end();return;}
const b=req.body;const date=String(b.data??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw Error('Informe uma data válida.');
const num=(key:string,required=false)=>{if(b[key]===''||b[key]==null){if(required)throw Error('Preencha os campos numéricos obrigatórios.');return null;}const n=Number(String(b[key]).replace(',','.'));if(!Number.isFinite(n)||n<0||(required&&key!=='km'&&n===0))throw Error('Informe valores numéricos válidos.');return n;};
let record:Record<string,any>={data:date,local:String(b.local??'').trim()||null,km:num('km',table==='abastecimentos')};
if(table==='abastecimentos'){if(!['gasolina_comum','gasolina_aditivada','etanol','diesel','diesel_s10','gnv'].includes(b.combustivel))throw Error('Combustível inválido.');record={...record,combustivel:b.combustivel,preco_litro:num('preco_litro',true),litros:num('litros',true),tanque_cheio:b.tanque_cheio?1:0,imposto_federal:num('imposto_federal'),imposto_estadual:num('imposto_estadual'),imposto_municipal:num('imposto_municipal'),observacoes:String(b.observacoes??'').trim()||null};}
else{if(!['manutencao','imposto','multa','seguro','outro'].includes(b.tipo)||!String(b.descricao??'').trim())throw Error('Informe a categoria e a descrição.');record={...record,tipo:b.tipo,valor:num('valor',true),descricao:String(b.descricao).trim(),detalhes:JSON.stringify(b.detalhes&&typeof b.detalhes==='object'&&!Array.isArray(b.detalhes)?b.detalhes:{})};}
const cols=table==='abastecimentos'?fuel:expense;const values=cols.map(c=>record[c]);
if(req.method==='PUT'){const result=db.prepare(`update ${table} set ${cols.map(c=>`${c}=?`).join(',')} where id=? and user_id=?`).run(...values,id!,user);if(!result.changes){res.status(404).json({error:'Registro não encontrado.'});return;}}
else db.prepare(`insert into ${table}(id,user_id,${cols.join(',')}) values(${cols.map(()=>'?').join(',')},?,?)`).run(randomUUID(),user,...values);
res.json({ok:true});
}catch(e){res.status(400).json({error:(e as Error).message});}});
if(process.argv.includes('--dev')){const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{app.use(express.static(path.resolve('dist')));app.use((_,res)=>res.sendFile(path.resolve('dist/index.html')));}
app.listen(3014,'127.0.0.1',()=>console.log('openGas disponível em http://localhost:3014'));
