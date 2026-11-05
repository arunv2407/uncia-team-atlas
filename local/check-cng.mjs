import assert from 'node:assert/strict';
import {initialNodes} from '../local-dist/seed.mjs';
import {expandUnnamedResources} from '../local-dist/model.mjs';
import {reconcileCare} from './care-structure.mjs';
import {reconcileNamedCng,cngCounts,cngNamedRoles} from './cng-validation.mjs';
const before=expandUnnamedResources(reconcileCare(initialNodes).nodes);
const snapshot=structuredClone(before);
const {nodes,links}=reconcileNamedCng(before);
assert.deepEqual(before,snapshot);
assert.deepEqual(cngCounts(nodes),cngCounts(before));
assert.equal(cngCounts(nodes).CNG.total,86);
assert.equal(cngCounts(nodes).CARE.total,27);
assert.equal(nodes.length,before.length);
assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
for(const [id,,title] of cngNamedRoles)assert.equal(nodes.find(n=>n.id===id).title,title);
for(const [id,parent] of links)assert.equal(nodes.find(n=>n.id===id).parentId,parent);
for(const old of before){const updated=nodes.find(n=>n.id===old.id);for(const key of ['name','status','count','product','assignment','pendingMove','needsMapping','namePending'])assert.equal(updated[key],old[key]);if(!cngNamedRoles.some(([id])=>id===old.id))assert.equal(updated.title,old.title);}
assert.equal(nodes.filter(n=>n.needsMapping).length,before.filter(n=>n.needsMapping).length);
console.log('PASS: explicit CNG titles and reporting verified; no duplicates, count changes, inferred individual designations or lost CARE mapping flags.');
