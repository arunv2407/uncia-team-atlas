import assert from 'node:assert/strict';
import {initialNodes} from '../local-dist/seed.mjs';
import {buildPegNodes} from './peg-structure.mjs';
import {reconcileCare} from './care-structure.mjs';
import {expandUnnamedResources,validateNodes} from '../local-dist/model.mjs';
const before=reconcileCare([...initialNodes,...buildPegNodes('engineering')]).nodes;
const after=expandUnnamedResources(before);
assert.equal(validateNodes(after),null);assert.equal(new Set(after.map(n=>n.id)).size,after.length);
for(const status of ['Filled','Vacant','Yet to join'])assert.equal(after.filter(n=>n.status===status).reduce((a,n)=>a+n.count,0),before.filter(n=>n.status===status).reduce((a,n)=>a+n.count,0));
for(const title of new Set(before.map(n=>n.title)))assert.equal(after.filter(n=>n.title===title).reduce((a,n)=>a+n.count,0),before.filter(n=>n.title===title).reduce((a,n)=>a+n.count,0));
for(const n of before.filter(n=>n.count>1)){const split=after.filter(p=>p.id===n.id||p.id.startsWith(n.id+'-slot-'));assert.equal(split.length,n.count);for(const p of split){assert.equal(p.count,1);assert.equal(p.parentId,n.parentId);assert.equal(p.title,n.title);assert.equal(p.product,n.product);assert.equal(p.status,n.status);assert.equal(p.namePending,true)}}
for(const n of before.filter(n=>n.name&&!/ group$/i.test(n.name)&&n.id!=='care-unallocated-filled'&&n.status!=='Vacant'))assert.deepEqual(after.find(p=>p.id===n.id),n);
assert.deepEqual(expandUnnamedResources(after),after);
const target=after.find(n=>n.id==='peg-amsaveni-group-2-slot-2');assert.ok(target);const edited=after.map(n=>n.id===target.id?{...n,name:'Actual Person',namePending:false}:n);assert.equal(validateNodes(edited),null);assert.equal(edited.filter(n=>n.name==='Actual Person').length,1);
assert.ok(validateNodes(after.map(n=>n.id===target.id?{...n,namePending:false}:n)));
console.log('PASS: groups split into independently editable entries; named people, reporting, products, statuses and totals preserved; blank-name placeholders valid; repeated conversion is safe.');
