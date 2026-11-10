import assert from 'node:assert/strict';import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {reconcileFinal,canonicalFunction,finalIdentity,functionHeads} from './final-master.mjs';
import {positionCounts,hierarchyCounts} from '../local-dist/counts.mjs';
import {directoryColumns,filterDirectory} from '../local-dist/directory-model.mjs';
const source=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),db=new DatabaseSync('.local-data/atlas.sqlite',{readOnly:true}),previous=JSON.parse(db.prepare('SELECT nodes FROM org_state WHERE id=1').get().nodes);db.close();
const before=JSON.stringify(previous),{nodes,report}=reconcileFinal(previous,source,{sravan:'pmo-exception',unmatched:'archive'});assert.equal(JSON.stringify(previous),before);
const repeated=reconcileFinal(nodes,source,{sravan:'pmo-exception',unmatched:'archive'});assert.deepEqual(repeated.nodes,nodes,'Repeat import is not stable');
assert.equal(nodes.filter(n=>n.parentId==='sagar').length,7);for(const head of new Set(Object.values(functionHeads)))assert.equal(nodes.find(n=>n.id===head).parentId,'sagar');
const getEmp=id=>nodes.find(n=>n.employeeId===id);const sravan=getEmp('C1371');assert.equal(sravan.team,'PMO');assert.equal(sravan.parentId,getEmp('C1365').id);assert.ok(sravan.reportingException);assert.equal(nodes.filter(n=>n.team==='PMO').length,2);assert.equal(nodes.filter(n=>n.parentId==='pmo').length,0);
for(const row of source.rows){const n=nodes.find(n=>n.masterRow===row.row&&n.masterSourceHash===source.sha256);if(!n)continue;const identity=finalIdentity(row.Name,row['Emp id']);assert.equal(n.team,n.id==='sagar'?'Leadership':canonicalFunction(row.Function));assert.equal(n.count,1);assert.ok(!/\bYTJ\b/.test(n.name));
 if(/^TBH|^TBD/i.test(row.Name)){assert.equal(n.status,'Vacant');assert.equal(n.name,'');assert.equal(n.employeeId,'');}else if(/\bYTJ\b/.test(row.Name)||['NJ','YTJ'].includes(row['Emp id']))assert.equal(n.status,'Yet to join');else if(identity.employeeId)assert.equal(n.status,'Filled');
 if(row['Current Designation'])assert.equal(n.title.toLowerCase(),row['Current Designation'].toLowerCase());for(const field of ['Skills','Recommended Designation - Function','Reporting Manager'])if(row[field])assert.equal(n.employeeDetails[field],row[field]);
}
const columns=directoryColumns(nodes);
for(const f of new Set(nodes.map(n=>n.team))){const filtered=filterDirectory(nodes,columns,{function:[f]}),ids=new Set(filtered.map(n=>n.id));assert.equal(positionCounts(filtered).total,report.functions[f].total);assert.deepEqual(hierarchyCounts(nodes,'sagar',ids),positionCounts(filtered));
 for(const n of nodes){const own=ids.has(n.id)?positionCounts([n]):positionCounts([]),childTotals=nodes.filter(c=>c.parentId===n.id).map(c=>hierarchyCounts(nodes,c.id,ids));for(const k of ['total','filled','open','joining'])assert.equal(hierarchyCounts(nodes,n.id,ids)[k],own[k]+childTotals.reduce((a,c)=>a+c[k],0),'Filtered hierarchy does not roll up at '+n.id);}
}
assert.deepEqual(report.totals,{total:181,filled:145,vacant:24,yetToJoin:12});assert.equal(report.unresolved.length,0);assert.equal(report.functions.PEG.yetToJoin,6);assert.equal(report.branches.guna.total,84);assert.equal(report.branches.satish.total,47);
console.log(JSON.stringify({pass:true,totals:report.totals,branches:report.branches,checks:'Exact source identities/statuses, source details, seven heads, PMO exception, no duplicates, repeat stability, every function filter and every hierarchy level rollup.'}));
