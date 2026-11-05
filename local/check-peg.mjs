import assert from 'node:assert/strict';
import {pegRows,buildPegNodes} from './peg-structure.mjs';
import {initialNodes} from '../local-dist/seed.mjs';
import {validateNodes,descendants} from '../local-dist/model.mjs';
const imported=buildPegNodes('engineering');const nodes=[...initialNodes,...imported];
assert.equal(validateNodes(nodes),null);
const sum=(list,status)=>list.filter(n=>n.status===status).reduce((a,n)=>a+n.count,0);
for(const row of pegRows){const list=imported.filter(n=>n.id==='peg-'+row.id||n.parentId==='peg-'+row.id);assert.equal(sum(list,'Filled'),row.filled);assert.equal(sum(list,'Vacant'),row.vacant);}
const branch=[nodes.find(n=>n.id==='engineering'),...descendants(nodes,'engineering')];assert.equal(sum(branch,'Filled'),28);assert.equal(sum(branch,'Vacant'),2);
for(const [product,count] of [['UNCIA LEAP (LMS)',18],['UNCIA FLOW (SCF)',8],['UNCIA PRIME (LOS)',3]])assert.equal(imported.filter(n=>n.product===product).reduce((a,n)=>a+n.count,0),count);
for(const [title,count] of [['Technical Lead',6],['Principal Software Engineer',1],['Senior Software Engineer',4],['Software Engineer',10],['Associate Software Engineer',6]])assert.equal(imported.filter(n=>n.title===title&&n.status==='Filled').reduce((a,n)=>a+n.count,0),count);
assert.equal(imported.filter(n=>n.status==='Vacant'&&n.title==='Software Engineer').length,2);
assert.ok(imported.every(n=>n.employment==='Not specified'));
console.log('PASS: Engineering 30 positions = 28 filled + 2 vacancies; LEAP 18, FLOW 8, PRIME 3, Head 1; all leader and designation totals match the screenshot.');
