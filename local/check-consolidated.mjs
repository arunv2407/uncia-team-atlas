import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {consolidate} from './consolidated-master.mjs';
import {employeeIdentity} from './satish-team-update.mjs';
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:true}),previous=JSON.parse(db.prepare('SELECT nodes FROM org_state WHERE id=1').get().nodes);db.close();
const before=structuredClone(previous),{nodes,report}=consolidate(previous,source);assert.deepEqual(previous,before);
const key=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');const byId=new Map(nodes.filter(n=>n.employeeId).map(n=>[n.employeeId,n]));
for(const row of source.rows){const n=nodes.find(n=>n.masterSourceHash===source.sha256&&n.masterRow===row.row);if(!n)continue;assert.equal(n.team,row.Function);for(const field of ['Skills','Skills / Specialisation','Recommended Designation - Function','Framework Review Remarks'])if(row[field])assert.equal(n.employeeDetails[field],row[field]);if(n.id==='sagar')continue;
 const manager=employeeIdentity(row['Reporting Manager']);const alias=key(manager.name)==='tpmadhusudhanan'?'madhusudhanatp':key(manager.name)==='aylwint'?'aylwintitus':key(manager.name);const parent=byId.get(manager.employeeId)||nodes.find(n=>key(n.name)===alias);assert.equal(n.parentId,parent?.id,'Wrong manager for '+row.Name);
 if(/^(TBH|TBD)\b/i.test(row.Name)){assert.equal(n.status,'Vacant');assert.equal(n.employeeId,'');}if(row['Emp id']==='NJ')assert.equal(n.status,'Yet to join');
}
assert.equal(nodes.filter(n=>n.masterSourceHash===source.sha256).length,report.selectedRows);
for(const n of previous.filter(n=>n.status==='Vacant'))assert.equal(nodes.find(p=>p.id===n.id)?.status,'Vacant');
for(const name of ['Bezil M','Parthiban Rajendiran','Nivedha S']){const old=previous.find(n=>n.name===name);assert.equal(nodes.find(n=>n.id===old.id).title,old.title);}
const amutha=nodes.find(n=>n.employeeId==='E1880');assert.ok(amutha.title.startsWith('Principal Information Security'));
const infra=nodes.find(n=>n.id==='infra');assert.equal(nodes.filter(n=>n.parentId===infra.id&&n.status==='Vacant').length,4);
assert.ok(nodes.find(n=>n.employeeId==='C1371'));const again=consolidate(nodes,source).nodes;assert.equal(again.length,nodes.length);for(const n of nodes)assert.deepEqual(again.find(p=>p.id===n.id),n,'Repeat import changed '+n.id);
console.log(JSON.stringify({pass:true,selected:report.selectedRows,excluded:report.excluded.length,added:report.added.length,positions:report.positions,filled:report.filled,open:report.open,yetToJoin:report.yetToJoin,checks:'Identity uniqueness, source managers, vacancy retention, four Infra openings, manual QA titles, NJ statuses, source details and repeat-import stability.'}));
