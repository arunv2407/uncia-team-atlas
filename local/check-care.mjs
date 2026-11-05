import assert from 'node:assert/strict';
import {initialNodes} from '../local-dist/seed.mjs';
import {descendants} from '../local-dist/model.mjs';
import {reconcileCare} from './care-structure.mjs';
const {nodes,headId,unmatched}=reconcileCare(initialNodes);const branch=[nodes.find(n=>n.id===headId),...descendants(nodes,headId)];
const count=status=>branch.filter(n=>n.status===status).reduce((a,n)=>a+n.count,0);
assert.equal(count('Filled'),16);assert.equal(count('Yet to join'),2);assert.equal(count('Vacant'),9);assert.equal(branch.reduce((a,n)=>a+n.count,0),27);assert.equal(branch.filter(n=>n.pendingMove).length,4);assert.equal(count('Filled')-4,12);
assert.equal(nodes.length,initialNodes.length+1);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);
for(const name of ['Praveen AB','Sanjay Kumar K','Sakthivel K','Nikhil Vasan J','Balajivasan M','Prakash K','Munichandrudu','Palanivel Rajan'])assert.equal(nodes.filter(n=>n.name===name).length,1);
for(const name of unmatched){const old=initialNodes.find(n=>n.name===name),n=nodes.find(n=>n.id===old.id);for(const key of ['name','parentId','title','product','assignment','count','status'])assert.equal(n[key],old[key]);assert.equal(n.needsMapping,true)}
for(const n of initialNodes.filter(n=>!branch.some(b=>b.id===n.id)))assert.deepEqual(nodes.find(x=>x.id===n.id),n);
console.log('PASS: CARE 27 positions = 16 filled (4 pending move; 12 already in Care), 2 yet to join, 9 existing vacancies reused; eight named people reused, six unmatched people retained, only one unnamed remainder group added.');
