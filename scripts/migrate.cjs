const {DatabaseSync}=require('node:sqlite');
const path=require('node:path');
const [source,target='data/opengas.db']=process.argv.slice(2);
if(!source)throw Error('Uso: node scripts/migrate.cjs <banco-original> [banco-destino]. O destino deve estar ausente.');
const db=new DatabaseSync(path.resolve(source),{readOnly:true});
try{db.prepare('VACUUM INTO ?').run(path.resolve(target));console.log('Snapshot SQLite consistente criado.');}finally{db.close();}
