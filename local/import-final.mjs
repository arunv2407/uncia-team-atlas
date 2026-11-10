import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {reconcileFinal} from './final-master.mjs';
import {choiceFields,choiceValue} from '../local-dist/choices.mjs';
const source=JSON.parse(await fs.readFile(process.argv[2],'utf8')),apply=process.argv.includes('--apply');
const db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:!apply});db.exec('PRAGMA busy_timeout=5000');
try{
 if(apply)db.exec('BEGIN IMMEDIATE');
 const state=db.prepare('SELECT * FROM org_state WHERE id=1').get(),previous=JSON.parse(state.nodes),{nodes,report}=reconcileFinal(previous,source,{sravan:'pmo-exception',unmatched:'archive'});
 const at=new Date().toISOString(),stamp=at.replaceAll(':','-'),marker='final_master_'+source.sha256;
 if(apply){
  if(db.prepare('SELECT value FROM app_meta WHERE key=?').get(marker))throw Error('This final revision has already been applied.');
  await fs.mkdir('.local-data/backups',{recursive:true});report.backup='.local-data/backups/before-final-'+stamp+'.json';
  await fs.writeFile(report.backup,JSON.stringify({format:'uncia-org-v1',nodes:previous,version:state.version,exportedAt:at},null,2));
  await fs.writeFile('.local-data/backups/archived-final-'+stamp+'.json',JSON.stringify({source:source.source,archivedAt:at,nodes:previous.filter(n=>report.archived.some(a=>a.id===n.id))},null,2));
  const insert=db.prepare('INSERT OR IGNORE INTO catalog_items(kind,name) VALUES (?,?)');
  for(const n of nodes)for(const [kind,field] of [['designation','title'],['product','product']])if(n[field]){insert.run(kind,n[field]);n[field]=db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE NOCASE').get(kind,n[field]).name;}
  const addChoice=db.prepare('INSERT OR IGNORE INTO field_choices(field,name) VALUES (?,?)');for(const n of nodes)for(const field of choiceFields){const value=choiceValue(n,field);if(value)addChoice.run(field,value)}
  for(const old of ['Engineering','Customer Success','Transformation'])if(!nodes.some(n=>n.team===old))db.prepare("DELETE FROM field_choices WHERE field='Function' AND name=?").run(old);
  const history=JSON.parse(state.history);history.unshift({at,by:'Final master import',action:'Reconciled final master, YTJ/TBH, functional heads and confirmed PMO reporting exception; archived unmatched positions',previous});
  db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1 AND version=?').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at,state.version);
  db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run(marker,at);db.prepare('INSERT INTO account_audit(at,actor,action) VALUES (?,?,?)').run(at,'Final master import','Reconciled '+nodes.length+' positions and archived '+report.archived.length+' unmatched entries.');
  db.exec('COMMIT');
 }
 await fs.writeFile('.local-data/imports/final-review.json',JSON.stringify({applied:apply,at,...report},null,2));
 console.log(JSON.stringify({applied:apply,totals:report.totals,functions:report.functions,branches:report.branches,archived:report.archived.length,added:report.added.length,unresolved:report.unresolved,missingDesignations:report.missingDesignations},null,2));
}catch(e){if(apply)try{db.exec('ROLLBACK')}catch{}throw e}finally{db.close()}
