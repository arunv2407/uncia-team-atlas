import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {validateNodes} from '../local-dist/model.mjs';
import {reportsToSatish,functionReportingOverride} from './employee-master.mjs';
const source=JSON.parse(await fs.readFile(process.argv[2],'utf8'));
const db=new DatabaseSync('.local-data/atlas.sqlite');db.exec('PRAGMA busy_timeout=5000;');
try{
 db.exec('BEGIN IMMEDIATE');const current=db.prepare('SELECT * FROM org_state WHERE id=1').get(),previous=JSON.parse(current.nodes),nodes=structuredClone(previous);
 const rows=source.rows.filter(r=>reportsToSatish(r.Function)),touched=new Set(),changes=[];
 for(const row of rows){const matches=nodes.filter(n=>row['Emp id']?n.employeeId===row['Emp id']:n.masterSourceHash===source.sha256&&n.masterRow===row.row);assert.equal(matches.length,1,'Expected exactly one existing employee for master row '+row.row);const n=matches[0];touched.add(n.id);const parentId=functionReportingOverride(row,n);if(n.parentId!==parentId)changes.push({name:n.name,from:n.parentId,to:parentId});n.parentId=parentId;
  if(!['sagar','satish'].includes(n.id)){n.needsMapping=false;n.mappingNote='';n.employeeDetails={...n.employeeDetails,'Reporting override':'GoLive / GoLive & QA reports directly to Satish, as instructed by the user on 4 November 2026. The original workbook manager is retained for reference.'};}
 }
 assert.equal(validateNodes(nodes),null);assert.equal(nodes.length,previous.length);
 for(const n of previous){const updated=nodes.find(p=>p.id===n.id);if(!touched.has(n.id))assert.deepEqual(updated,n);for(const field of ['name','title','status','count','product','assignment','experience','tenure','employeeId'])assert.deepEqual(updated[field],n[field]);}
 const at=new Date().toISOString(),backup='.local-data/backups/before-golive-reporting-'+at.replaceAll(':','-')+'.json';await fs.writeFile(backup,JSON.stringify({format:'uncia-org-v1',nodes:previous,version:current.version,exportedAt:at},null,2));
 const history=JSON.parse(current.history);history.unshift({at,by:'Super-admin correction',action:'Mapped all GoLive and GoLive & QA resources directly to Satish; Sagar remains root and Satish reports to Sagar',previous});
 db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1 AND version=?').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at,current.version);
 db.prepare('INSERT INTO account_audit(at,actor,action) VALUES (?,?,?)').run(at,'Super-admin correction',`Validated ${rows.length} master rows; ${changes.length} reporting lines corrected; no employees, designations or vacancies changed`);db.exec('COMMIT');
 const report={sourceRows:rows.length,goLiveDirectReports:rows.filter(r=>{const n=nodes.find(n=>n.masterRow===r.row&&n.masterSourceHash===source.sha256);return n.parentId==='satish';}).length,changes,backup,version:current.version+1};await fs.writeFile('.local-data/imports/golive-reporting-correction.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){try{db.exec('ROLLBACK')}catch{}throw e}finally{db.close()}
