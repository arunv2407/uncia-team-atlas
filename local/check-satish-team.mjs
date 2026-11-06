import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {employeeIdentity,reconcileSatishTeam} from './satish-team-update.mjs';
import {validateNodes} from '../local-dist/model.mjs';
assert.deepEqual(employeeIdentity('Jane Tester E1234'),{name:'Jane Tester',employeeId:'E1234'});
assert.deepEqual(employeeIdentity('Jane Tester (E1234)'),{name:'Jane Tester',employeeId:'E1234'});
assert.deepEqual(employeeIdentity('Kishan Kumar E','E1944'),{name:'Kishan Kumar E',employeeId:'E1944'});
assert.throws(()=>employeeIdentity('Jane E1234','E9999'),/Conflicting/);
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:true});const previous=JSON.parse(db.prepare('SELECT nodes FROM org_state WHERE id=1').get().nodes);db.close();
const snapshot=structuredClone(previous),{nodes,report}=reconcileSatishTeam(previous,source);assert.deepEqual(previous,snapshot);assert.equal(validateNodes(nodes),null);
const byName=name=>nodes.find(n=>n.name===name);const targetRows=source.rows.filter(r=>['GoLive','Quality Assurance','GoLive & QA'].includes(r.Function));
assert.equal(report.rows,targetRows.length);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
for(const row of targetRows){const n=nodes.find(n=>n.masterSourceHash===source.sha256&&n.masterRow===row.row);assert.ok(n);assert.equal(n.name,n.id==='sagar'?'Sagar':employeeIdentity(row.Name,row['Emp id']).name);if(n.id!=='sagar'){const raw=row['Reporting Manager'].replace(/\s+(?:E|C|TR)\d+$/i,'');const managerName=raw==='Aylwin T'?'Aylwin Titus':raw==='Sagar Ramesh Mahajan'?'Sagar':raw;assert.equal(n.parentId,byName(managerName)?.id,'Wrong manager for '+n.name);}
 for(const key of ['Skills','Skills / Specialisation','Framework Review Remarks','Recommended Designation - Function'])if(row[key])assert.equal(n.employeeDetails[key],row[key]);
 assert.ok(!/\sE\d+$/i.test(n.name));assert.ok(!n.employeeDetails['Reporting override']);
}
for(const name of ['Hari KV','Raghuram Krishnan','Leslie'])assert.equal(byName(name).parentId,'sagar');
const aylwinRow=targetRows.find(r=>employeeIdentity(r.Name,r['Emp id']).name==='Aylwin Titus');assert.equal(byName('Aylwin Titus').parentId,byName(employeeIdentity(aylwinRow['Reporting Manager']).name).id);
for(const name of ['Om Prakash','Nikhil','Leslie','Sunny']){assert.equal(byName(name).employeeId,'');assert.equal(byName(name).status,'Yet to join');}
for(const old of previous){const updated=nodes.find(n=>n.id===old.id);assert.ok(updated);const isNJ=targetRows.some(r=>r.row===updated.masterRow&&r['Emp id']==='NJ');assert.equal(updated.status,isNJ?'Yet to join':old.status);assert.equal(updated.count,old.count);if(old.title)assert.equal(updated.title,old.title);if(!targetRows.some(r=>r.row===updated.masterRow&&updated.masterSourceHash===source.sha256))assert.deepEqual(updated,old);}
const repeated=reconcileSatishTeam(nodes,source).nodes;assert.deepEqual(repeated,nodes);
const suffixSource=structuredClone(source);const suffixRow=suffixSource.rows.find(r=>r['Emp id']==='E1643');suffixRow.Name='Muthumanikandan M E1643';suffixRow['Emp id']='';const suffixNodes=reconcileSatishTeam(previous,suffixSource).nodes;assert.equal(suffixNodes.filter(n=>n.employeeId==='E1643').length,1);assert.equal(suffixNodes.find(n=>n.employeeId==='E1643').name,'Muthumanikandan M');
const missingManager=structuredClone(source);missingManager.rows.find(r=>r['Emp id']==='E1643')['Reporting Manager']='Unknown manager';assert.throws(()=>reconcileSatishTeam(previous,missingManager),/Unresolved/);
console.log(JSON.stringify({pass:true,rows:report.rows,positions:report.positions,vacancies:report.openPositions,newPeople:report.added.length,reportingChanges:report.reportingChanges.length,pendingEmployeeIds:report.pendingEmployeeIds.length,checks:'All listed reporting managers, explicit Sagar exceptions, names and IDs, vacancy retention, unrelated record preservation, designation edits, new columns, repeat import, suffix extraction, conflicting IDs and unknown manager rejection.'}));
