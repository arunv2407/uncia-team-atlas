import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {employeeIdentity} from './satish-team-update.mjs';
import {validateNodes} from '../local-dist/model.mjs';
const source=JSON.parse(await fs.readFile(process.argv[2],'utf8')),apply=process.argv.includes('--apply');
const db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:!apply});db.exec('PRAGMA busy_timeout=5000;');
try{
 if(apply)db.exec('BEGIN IMMEDIATE');const current=db.prepare('SELECT * FROM org_state WHERE id=1').get(),previous=JSON.parse(current.nodes),nodes=structuredClone(previous);
 const rows=source.rows.filter(r=>['CNG','CNG - Care'].includes(r.Function)),claimed=new Set(),report={rows:rows.length,reportingChanges:[],vacancies:0,detailsRefreshed:0};assert.ok(rows.length);
 const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 for(const row of rows){const vacancy=/^TBH\b/i.test(row.Name),identity=employeeIdentity(row.Name,vacancy?'':row['Emp id']);let matches;
  if(vacancy){matches=nodes.filter(n=>n.status==='Vacant'&&n.masterRow===row.row&&n.employeeDetails?.Name===row.Name);report.vacancies++;}
  else{matches=identity.employeeId?nodes.filter(n=>n.employeeId===identity.employeeId):nodes.filter(n=>normal(n.name)===normal(identity.name));}
  assert.equal(matches.length,1,'Source identity needs confirmation: '+row.Name);const n=matches[0];assert.ok(!claimed.has(n.id),'Duplicate source identity');claimed.add(n.id);
  const manager=employeeIdentity(row['Reporting Manager']);let managers=manager.employeeId?nodes.filter(n=>n.employeeId===manager.employeeId):[];if(!managers.length)managers=nodes.filter(n=>normal(n.name)===normal(manager.name));assert.equal(managers.length,1,'Manager needs confirmation: '+row['Reporting Manager']);
  if(n.parentId!==managers[0].id){report.reportingChanges.push({name:n.name||row.Name,from:n.parentId,to:managers[0].id});n.parentId=managers[0].id;}
  // Keep current titles, names, assignments, statuses and counts; source alternatives remain clearly labelled.
  n.employeeDetails=Object.fromEntries(Object.entries(row).filter(([k,v])=>!['row','#'].includes(k)&&v!==''));n.employeeDetails.Name=vacancy?row.Name:n.name;n.employeeDetails['Emp id']=vacancy?'':n.employeeId||'';n.employeeDetails.Source=`${source.source} · ${source.sheet} · row ${row.row}`;
  n.masterSourceHash=source.sha256;n.masterRow=row.row;report.detailsRefreshed++;
 }
 assert.equal(validateNodes(nodes),null);assert.equal(nodes.length,previous.length);
 for(const old of previous){const n=nodes.find(n=>n.id===old.id);if(!claimed.has(old.id))assert.deepEqual(n,old);for(const key of ['id','employeeId','name','title','team','product','assignment','status','employment','count','experience','tenure','notes','pending','pendingMove','needsMapping','namePending','mappingNote','designationMissing'])assert.deepEqual(n[key],old[key],key+' changed unexpectedly for '+old.id);}
 assert.equal(nodes.filter(n=>n.status==='Vacant').length,previous.filter(n=>n.status==='Vacant').length);
 const at=new Date().toISOString();if(apply){const marker='cng_team_'+source.sha256;assert.ok(!db.prepare('SELECT value FROM app_meta WHERE key=?').get(marker),'This CNG revision is already applied.');report.backup='.local-data/backups/before-cng-team-'+at.replaceAll(':','-')+'.json';await fs.writeFile(report.backup,JSON.stringify({format:'uncia-org-v1',nodes:previous,version:current.version,exportedAt:at},null,2));
  const history=JSON.parse(current.history);history.unshift({at,by:'Super-admin CNG master validation',action:`Validated ${rows.length} CNG/CARE master rows; refreshed employee details; ${report.reportingChanges.length} reporting changes; preserved vacancies and other departments`,previous});
  db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1 AND version=?').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at,current.version);db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run(marker,at);db.prepare('INSERT INTO account_audit(at,actor,action) VALUES (?,?,?)').run(at,'Super-admin CNG validation',`Validated ${rows.length} rows; ${report.vacancies} existing open positions; refreshed source details without duplicates`);db.exec('COMMIT');}
 await fs.writeFile('.local-data/imports/cng-team-validation.json',JSON.stringify({applied:apply,at,source:source.source,sha256:source.sha256,...report},null,2));console.log(JSON.stringify({applied:apply,...report}));
}catch(e){if(apply)try{db.exec('ROLLBACK')}catch{}throw e}finally{db.close()}
