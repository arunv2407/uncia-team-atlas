import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {validateNodes} from '../local-dist/model.mjs';
import {reconcileEmployeeMaster,scopeHeads,cleanName} from './employee-master.mjs';
const input=process.argv[2];if(!input)throw Error('Pass the extracted master JSON path.');
const source=JSON.parse(fs.readFileSync(input,'utf8'));
const db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:true});const before=JSON.parse(db.prepare('SELECT nodes FROM org_state WHERE id=1').get().nodes);for(const n of before)for(const [kind,name] of [['designation',n.title],['product',n.product]])if(name)assert.ok(db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE BINARY').get(kind,name),'Live catalog must allow saving '+name);db.close();
const snapshot=structuredClone(before),{nodes,report}=reconcileEmployeeMaster(before,source);
assert.deepEqual(before,snapshot);assert.equal(validateNodes(nodes),null);
const byRow=new Map(nodes.filter(n=>n.masterSourceHash===source.sha256).map(n=>[n.masterRow,n]));
const selected=source.rows.filter(r=>Object.hasOwn(scopeHeads,r.Function));assert.equal(byRow.size,selected.length);
const byEmployee=new Map(nodes.filter(n=>n.employeeId&&n.status!=='Vacant').map(n=>[n.employeeId,n]));
for(const row of selected){const n=byRow.get(row.row);assert.ok(n);assert.equal(n.count,1);assert.equal(n.team,row.Function);assert.equal(n.employeeDetails.Source,`${source.source} · ${source.sheet} · row ${row.row}`);
 for(const [key,value] of Object.entries(row).filter(([k,v])=>!['row','#'].includes(k)&&v!==''))assert.equal(n.employeeDetails[key],value);
 if(row['Current Designation'])assert.equal(n.title,row['Current Designation']);
 if(/^TBH\b/i.test(row.Name)){assert.equal(n.status,'Vacant');assert.equal(n.employeeId,'');assert.equal(n.name,'');}
 else{assert.equal(n.name,n.id==='sagar'?'Sagar':cleanName(row.Name));if(n.id==='satish')assert.equal(n.parentId,'sagar');else if(n.id!=='sagar'){if(['golive','golive & qa'].includes(row.Function.trim().toLowerCase()))assert.equal(n.parentId,'satish');else{const managerId=row['Reporting Manager'].match(/\b(?:E\d+|C\d+|TR\d+)\b/i)?.[0];const manager=byEmployee.get(managerId)||(managerId==='E1805'?nodes.find(p=>p.id==='satish'):null);if(manager)assert.equal(n.parentId,manager.id);else assert.ok(report.unresolved.some(x=>x.id===n.id));}}}
}
for(const old of before.filter(n=>n.status==='Vacant'))assert.ok(nodes.some(n=>n.id===old.id&&n.status==='Vacant'));
for(const old of before.filter(n=>n.name&&!n.namePending&&n.status!=='Vacant'))assert.ok(nodes.some(n=>n.id===old.id));
assert.equal(nodes.find(n=>n.id==='sagar').parentId,null);
assert.equal(nodes.find(n=>n.id==='pankaj').parentId,'rachappa');assert.equal(nodes.find(n=>n.id==='elavasanthan').parentId,'rachappa');
assert.equal(nodes.find(n=>n.id==='care-v-8').employeeDetails.Name,'TBH - Mumbai Support Manager');
assert.equal(nodes.find(n=>n.id==='care-v-4').employeeDetails.Name,'TBH - Lead Prime & LOS');
const repeated=reconcileEmployeeMaster(nodes,source).nodes;assert.equal(repeated.length,nodes.length);for(const n of nodes)assert.deepEqual(repeated.find(p=>p.id===n.id),n,'Re-import changed '+n.id);
const bad=structuredClone(nodes);bad.find(n=>n.employeeId).employeeDetails={Skills:42};assert.ok(validateNodes(bad));
const duplicate=structuredClone(nodes);const identified=duplicate.filter(n=>n.employeeId);identified[1].employeeId=identified[0].employeeId;assert.equal(validateNodes(duplicate),'Employee IDs must be unique.');
assert.ok(validateNodes(nodes.map(n=>n.id==='satish'?{...n,title:'',designationMissing:false}:n)));
assert.equal(nodes.filter(n=>n.status==='Vacant').length,report.after.vacancies);
console.log(JSON.stringify({pass:true,rows:selected.length,positions:report.after.positions,vacancies:report.after.vacancies,missingDesignations:report.missingDesignations.length,reportingExceptions:report.unresolved.length,retainedForConfirmation:report.retainedUnlisted.length,checks:'Every included source cell and available manager verified; all vacancies and named records retained; repeat import identical; invalid detail types and duplicate employee IDs rejected.'}));
