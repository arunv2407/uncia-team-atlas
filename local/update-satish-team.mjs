import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {reconcileSatishTeam} from './satish-team-update.mjs';
const source=JSON.parse(await fs.readFile(process.argv[2],'utf8')),apply=process.argv.includes('--apply'),refresh=process.argv.includes('--refresh');
const db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:!apply});db.exec('PRAGMA busy_timeout=5000;');
try{if(apply)db.exec('BEGIN IMMEDIATE');const current=db.prepare('SELECT * FROM org_state WHERE id=1').get(),previous=JSON.parse(current.nodes);const {nodes,report}=reconcileSatishTeam(previous,source);const at=new Date().toISOString();
 // Dropdown entries have case-insensitive uniqueness; retain their canonical spelling.
 for(const n of nodes.filter(n=>n.masterSourceHash===source.sha256))if(n.product){const existing=db.prepare("SELECT name FROM catalog_items WHERE kind='product' AND name=? COLLATE NOCASE").get(n.product);if(existing)n.product=existing.name;}
 if(apply){const marker='satish_team_'+source.sha256;if(!refresh&&db.prepare('SELECT value FROM app_meta WHERE key=?').get(marker))throw Error('This team update was already applied.');
  const backup='.local-data/backups/before-satish-team-'+at.replaceAll(':','-')+'.json';await fs.writeFile(backup,JSON.stringify({format:'uncia-org-v1',nodes:previous,version:current.version,history:JSON.parse(current.history),catalogs:db.prepare('SELECT kind,name FROM catalog_items').all(),exportedAt:at},null,2));report.backup=backup;
  const insert=db.prepare('INSERT OR IGNORE INTO catalog_items(kind,name) VALUES (?,?)');for(const n of nodes){if(n.title)insert.run('designation',n.title);if(n.product)insert.run('product',n.product);}
  for(const n of nodes)for(const [kind,name] of [['designation',n.title],['product',n.product]])if(name&&!db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE BINARY').get(kind,name))throw Error('Catalog casing mismatch: '+name);
  const history=JSON.parse(current.history);history.unshift({at,by:'Super-admin updated master import',action:'Updated GoLive and QA reporting from the latest master; preserved current designation edits, vacancies and other departments',previous});
  db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1 AND version=?').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at,current.version);
  db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(marker,at);db.prepare('INSERT INTO account_audit(at,actor,action) VALUES (?,?,?)').run(at,'Super-admin updated master import',`Updated ${report.rows} team rows; ${report.added.length} new people; ${report.reportingChanges.length} reporting changes; employee IDs separated from names; NJ means Yet to join`);db.exec('COMMIT');
 }
 await fs.writeFile('.local-data/imports/updated-satish-team-report.json',JSON.stringify({applied:apply,at,...report},null,2));console.log(JSON.stringify({applied:apply,...report},null,2));
}catch(e){if(apply)try{db.exec('ROLLBACK')}catch{}throw e}finally{db.close()}
