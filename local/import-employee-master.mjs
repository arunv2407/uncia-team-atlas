import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {reconcileEmployeeMaster} from './employee-master.mjs';

const input=process.argv[2];if(!input)throw Error('Usage: node local/import-employee-master.mjs extracted-master.json [--apply]');
const source=JSON.parse(await fs.readFile(input,'utf8')),apply=process.argv.includes('--apply');
const db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:!apply});db.exec('PRAGMA busy_timeout=5000;');
try{
 if(apply)db.exec('BEGIN IMMEDIATE');
 const current=db.prepare('SELECT * FROM org_state WHERE id=1').get(),previous=JSON.parse(current.nodes);
 const marker='employee_master_'+source.sha256;
 if(apply&&db.prepare('SELECT value FROM app_meta WHERE key=?').get(marker))throw Error('This master was already applied. No chart changes were made.');
 const {nodes,report}=reconcileEmployeeMaster(previous,source);
 const outputDir=path.resolve('.local-data/imports');await fs.mkdir(outputDir,{recursive:true});
 const reportPath=path.join(outputDir,'employee-master-validation.json');
 const at=new Date().toISOString();
 if(apply){
  const backupDir=path.resolve('.local-data/backups');await fs.mkdir(backupDir,{recursive:true});
  const backup=path.join(backupDir,'before-employee-master-'+at.replaceAll(':','-')+'.json');
  await fs.writeFile(backup,JSON.stringify({format:'uncia-org-v1',exportedAt:at,nodes:previous,history:JSON.parse(current.history),version:current.version,catalogs:db.prepare('SELECT kind,name FROM catalog_items').all()},null,2));
  const insert=db.prepare('INSERT INTO catalog_items(kind,name) VALUES (?,?) ON CONFLICT(kind,name) DO UPDATE SET name=excluded.name');for(const n of nodes){if(n.title)insert.run('designation',n.title);if(n.product)insert.run('product',n.product);}
  for(const n of nodes)for(const [kind,name] of [['designation',n.title],['product',n.product]])if(name&&!db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE BINARY').get(kind,name))throw Error('Conflicting catalog casing in master: '+name);
  const history=JSON.parse(current.history);history.unshift({at,by:'Super-admin master import',action:`Imported ${report.includedRows} employee master rows; workbook reporting is authoritative; unresolved mappings and existing open positions retained`,previous});
  const result=db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1 AND version=?').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at,current.version);if(result.changes!==1)throw Error('Chart changed during import.');
  db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run(marker,at);
  db.prepare('INSERT INTO account_audit(at,actor,action) VALUES (?,?,?)').run(at,'Super-admin master import',`Applied ${source.source}: ${report.includedRows} rows; ${report.namedPlaceholders.length} anonymous entries named; ${report.unresolved.length} reporting exceptions; ${report.after.vacancies} open positions`);
  db.exec('COMMIT');report.backup=backup;
 }
 report.applied=apply;report.at=at;report.version=apply?current.version+1:current.version;
 await fs.writeFile(reportPath,JSON.stringify(report,null,2));
 console.log(JSON.stringify({applied:apply,version:report.version,includedRows:report.includedRows,excludedRows:report.excludedRows.length,added:report.added.length,namedPlaceholders:report.namedPlaceholders.length,vacanciesReused:report.vacanciesReused.length,before:report.before,after:report.after,unresolved:report.unresolved,missingDesignations:report.missingDesignations,retainedUnlisted:report.retainedUnlisted.length,reportPath,backup:report.backup},null,2));
}catch(error){if(apply)try{db.exec('ROLLBACK')}catch{}throw error;}finally{db.close()}
