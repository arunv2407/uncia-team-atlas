import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createApp} from './server.mjs';
await fs.mkdir('.sites-runtime',{recursive:true});
const dir=await fs.mkdtemp(path.resolve('.sites-runtime/auth-test-'));
const adminPassword='Disposable-Admin-Test-47!';const editorPassword='Disposable-Editor-Test-83!';
const app=await createApp({dataDir:dir,importPreview:false,bootstrap:[{username:'test.admin',name:'Test Admin',password:adminPassword,role:'admin'},{username:'test.heads',name:'Test Heads',password:editorPassword,role:'editor'}]});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
class Client{cookie='';csrf='';async request(route,body,method=body?'POST':'GET',extra={}){const headers={'Content-Type':'application/json',Origin:base,'X-CSRF-Token':this.csrf,...extra};if(this.cookie)headers.Cookie=this.cookie;const response=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});const raw=response.headers.get('set-cookie');if(raw)this.cookie=raw.split(';')[0];const content=response.headers.get('content-type')?.includes('json')?await response.json():await response.text();return {status:response.status,data:content,headers:response.headers}}async login(username,password){const r=await this.request('/auth/login',{username,password});if(r.status===200){const me=await this.request('/auth/me');this.csrf=me.data.csrf}return r}}
try{
 const anon=new Client(),admin=new Client(),editor=new Client();
 assert.equal((await anon.request('/api/chart')).status,401);assert.equal((await anon.request('/')).status,303);assert.equal((await anon.request('/assets/app.js')).status,303);
 assert.equal((await anon.login('test.admin','wrong')).status,401);
 const login=await admin.login('test.admin',adminPassword);assert.equal(login.status,200);assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));assert.ok(login.headers.get('set-cookie').includes('SameSite=Strict'));
 assert.equal((await editor.login('test.heads',editorPassword)).status,200);
 assert.equal((await editor.request('/auth/users')).status,403);
 assert.equal((await editor.request('/auth/users',{name:'Bad',username:'bad.user',password:editorPassword,role:'admin'})).status,403);
 let chart=(await editor.request('/api/chart')).data;assert.equal(chart.user.role,'viewer');
 assert.ok(chart.catalogs.products.includes('LK Prime'));assert.ok(chart.catalogs.products.includes('Chola · LOS'));
 assert.equal(chart.nodes.find(n=>n.id==='pankaj').product,'LK Prime');
 assert.equal((await editor.request('/api/chart',{...chart,action:'No CSRF'},'PUT',{'X-CSRF-Token':''})).status,403);
 assert.equal((await editor.request('/api/chart',{...chart,action:'Cross origin'},'PUT',{Origin:'https://other.example'})).status,403);
 for(const payload of [{nodes:chart.nodes,version:chart.version,action:'Viewer edit'},{nodes:chart.nodes.slice(1),version:chart.version,action:'Viewer remove'},{nodes:chart.nodes,version:chart.version,undo:true}])assert.equal((await editor.request('/api/chart',payload,'PUT')).status,403);
 assert.equal((await editor.request('/api/catalogs')).status,200);
 for(const kind of ['designation','product'])assert.equal((await editor.request('/api/catalogs',{kind,name:'Unauthorised item'})).status,403);
 assert.equal((await admin.request('/api/chart',{nodes:chart.nodes,version:chart.version,action:'Local auth test'},'PUT')).status,200);
 assert.equal((await admin.request('/api/chart',{nodes:chart.nodes,version:chart.version,action:'Stale edit'},'PUT')).status,409);
 chart=(await admin.request('/api/chart')).data;
 const designation='Principal QA Engineer',product='UNCIA Test Product';
 assert.equal((await admin.request('/api/catalogs',{kind:'designation',name:designation})).status,201);
 assert.equal((await admin.request('/api/catalogs',{kind:'designation',name:designation.toLowerCase()})).status,409);
 assert.equal((await admin.request('/api/catalogs',{kind:'product',name:product})).status,201);
 assert.equal((await admin.request('/api/catalogs',{kind:'product',name:'   '})).status,400);
 for(const kind of ['designation','product']){
  const name='Disposable deletion '+kind;assert.equal((await admin.request('/api/catalogs',{kind,name})).status,201);
  assert.equal((await editor.request('/api/catalogs',{kind,name},'DELETE')).status,403);
  assert.equal((await admin.request('/api/catalogs',{kind,name},'DELETE')).status,200);
  assert.equal((await admin.request('/api/catalogs',{kind,name},'DELETE')).status,404);
  assert.ok(!(await admin.request('/api/catalogs')).data[kind==='designation'?'designations':'products'].includes(name));
 }
 const preserved=(await admin.request('/api/chart')).data;
 for(const [kind,name] of [['designation','QA Engineer'],['product','LK Prime']])assert.equal((await admin.request('/api/catalogs',{kind,name},'DELETE')).status,409);
 assert.deepEqual((await admin.request('/api/chart')).data.nodes,preserved.nodes);
 const temp={...chart.nodes.find(n=>n.id==='pankaj'),id:'catalog-test-person',name:'Test new person',title:designation,parentId:'satish',product:'',employeeDetails:{Skills:'Manual testing, SQL',Billing:'T&M','Expected availability':'2027-01-01'}};
 const submit=async(person,version)=>admin.request('/api/chart',{nodes:[...chart.nodes,person],version,action:'Catalog validation test'},'PUT');
 assert.equal((await submit({...temp,title:''},chart.version)).status,400);
 assert.equal((await submit({...temp,title:'Unregistered designation'},chart.version)).status,400);
 assert.equal((await submit({...temp,product:'Unregistered product'},chart.version)).status,400);
 let saved=await submit(temp,chart.version);assert.equal(saved.status,200);assert.equal(saved.data.nodes.find(n=>n.id===temp.id).product,'');assert.deepEqual(saved.data.nodes.find(n=>n.id===temp.id).employeeDetails,temp.employeeDetails);assert.deepEqual((await editor.request('/api/chart')).data.nodes.find(n=>n.id===temp.id).employeeDetails,temp.employeeDetails);
 let modified=saved.data.nodes.map(n=>n.id===temp.id?{...n,product}:n);
 saved=await admin.request('/api/chart',{nodes:modified,version:saved.data.version,action:'Set registered product'},'PUT');assert.equal(saved.status,200);
 assert.equal(saved.data.nodes.find(n=>n.id===temp.id).product,product);
 let restored=await admin.request('/api/chart',{nodes:[],version:saved.data.version,undo:true},'PUT');assert.equal(restored.status,200);
 assert.equal(restored.data.nodes.find(n=>n.id===temp.id).product,'');
 const reopened=await createApp({dataDir:dir,importPreview:false});
 assert.ok(reopened.db.prepare("SELECT name FROM catalog_items WHERE kind='designation' AND name=?").get(designation));
 assert.ok(reopened.db.prepare("SELECT name FROM catalog_items WHERE kind='product' AND name=?").get(product));reopened.db.close();
 assert.equal((await admin.request('/api/chart')).data.nodes.find(n=>n.id===temp.id).product,'');
 {
  const current=(await admin.request('/api/chart')).data;const pending={...temp,id:'three-unnamed',name:'',namePending:true,count:3};
  const split=await admin.request('/api/chart',{nodes:[...current.nodes,pending],version:current.version,action:'Add three unnamed resources'},'PUT');assert.equal(split.status,200);
  const entries=split.data.nodes.filter(n=>n.id==='three-unnamed'||n.id.startsWith('three-unnamed-slot-'));assert.equal(entries.length,3);assert.ok(entries.every(n=>n.count===1&&n.namePending&&n.name===''));
  const named=await admin.request('/api/chart',{nodes:split.data.nodes.map(n=>n.id===entries[1].id?{...n,name:'Confirmed Person',namePending:false}:n),version:split.data.version,action:'Name one resource'},'PUT');assert.equal(named.status,200);assert.equal(named.data.nodes.filter(n=>n.id.startsWith('three-unnamed')&&n.namePending).length,2);assert.equal(named.data.nodes.filter(n=>n.name==='Confirmed Person').length,1);
  const removed=await admin.request('/api/chart',{nodes:named.data.nodes.filter(n=>!n.id.startsWith('three-unnamed')),version:named.data.version,action:'Remove test entries'},'PUT');assert.equal(removed.status,200);
 }
 for(const [kind,from,to] of [['designation','Associate Technical Engineer','Associate Technical Engineer Updated'],['product','Chola · LOS','Chola · LOS Updated'],['designation','Chief Transformation officer','Chief Transformation Officer']]){
  const before=(await admin.request('/api/chart')).data;const field=kind==='designation'?'title':'product';const linked=before.nodes.filter(n=>n[field]===from);const expected=linked.reduce((a,n)=>a+n.count,0);
  assert.equal((await editor.request('/api/catalogs',{kind,from,to},'PATCH')).status,403);
  const renamed=await admin.request('/api/catalogs',{kind,from,to},'PATCH');assert.equal(renamed.status,200);assert.equal(renamed.data.updatedPeople,expected);
  const after=(await admin.request('/api/chart')).data;for(const n of linked){const updated=after.nodes.find(p=>p.id===n.id);assert.equal(updated[field],to);if(kind==='product'&&n.assignment===from)assert.equal(updated.assignment,to)}
  for(const n of before.nodes.filter(n=>n[field]!==from))assert.deepEqual(after.nodes.find(p=>p.id===n.id),n);
  assert.equal((await admin.request('/api/chart',{nodes:before.nodes,version:before.version},'PUT')).status,409);
  const duplicate=kind==='designation'?'QA Engineer':'LK Prime';const collision=await admin.request('/api/catalogs',{kind,from:to,to:duplicate},'PATCH');assert.equal(collision.status,409);assert.equal((await admin.request('/api/chart')).data.version,after.version);
  const undo=await admin.request('/api/chart',{version:after.version,undo:true},'PUT');assert.equal(undo.status,200);assert.deepEqual(undo.data.nodes,before.nodes);assert.ok((kind==='designation'?undo.data.catalogs.designations:undo.data.catalogs.products).includes(from));
  const redo=await admin.request('/api/chart',{version:undo.data.version,undo:true},'PUT');assert.equal(redo.status,200);assert.deepEqual(redo.data.nodes,after.nodes);
  const reset=await admin.request('/api/chart',{version:redo.data.version,undo:true},'PUT');assert.equal(reset.status,200);assert.deepEqual(reset.data.nodes,before.nodes);
 }
 let users=(await admin.request('/auth/users')).data.users;const adminId=users.find(u=>u.username==='test.admin').id,editorId=users.find(u=>u.username==='test.heads').id;
 assert.equal((await admin.request('/auth/users/'+adminId,{disabled:true},'PATCH')).status,400);
 const added=await admin.request('/auth/users',{name:'New Head',username:'new.head',password:editorPassword,role:'editor',mustChange:true});assert.equal(added.status,201);
 const newcomer=new Client();assert.equal((await newcomer.login('new.head',editorPassword)).status,200);assert.equal((await newcomer.request('/api/chart')).status,403);
 assert.equal((await newcomer.request('/auth/password',{currentPassword:editorPassword,password:'Disposable-New-Password-59!'})).status,200);newcomer.csrf=(await newcomer.request('/auth/me')).data.csrf;assert.equal((await newcomer.request('/api/chart')).status,200);
 assert.equal((await admin.request('/auth/users/'+editorId+'/password',{password:'Disposable-Reset-Password-91!',mustChange:false})).status,200);
 assert.equal((await editor.request('/api/chart')).status,401);
 assert.equal((await editor.login('test.heads',editorPassword)).status,401);assert.equal((await editor.login('test.heads','Disposable-Reset-Password-91!')).status,200);
 assert.equal((await admin.request('/auth/users/'+editorId,{disabled:true},'PATCH')).status,200);assert.equal((await editor.request('/api/chart')).status,401);
 assert.equal((await admin.request('/auth/users/'+editorId,{disabled:false},'PATCH')).status,200);
 for(let i=0;i<8;i++)await anon.login('test.heads','wrong');assert.equal((await anon.login('test.heads','Disposable-Reset-Password-91!')).status,429);
 users=(await admin.request('/auth/users')).data.users;assert.ok(users.every(u=>!('hash'in u)&&!('password'in u)));
 const hashed=app.db.prepare('SELECT hash FROM users WHERE username=?').get('test.admin').hash;assert.ok(hashed.startsWith('scrypt$65536$8$2$'));assert.ok(!hashed.includes(adminPassword));
 assert.equal((await admin.request('/auth/logout',{})).status,200);assert.equal((await admin.request('/auth/me')).status,401);
 console.log('PASS: viewer read-only API guards, super-admin edits/undo, required designation/optional product, catalog creation/persistence, bulk designation and product renames, atomic duplicate rejection, rename undo/redo, login security, CSRF/origin, accounts and session revocation.');
}finally{await new Promise(r=>app.server.close(r));app.db.close()}
