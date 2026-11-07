import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {hashPassword,verifyPassword,passwordError,token,digest,safeEqual} from './security.mjs';
import {loginPage,accountPage,adminPage} from './pages.mjs';
import {initialNodes} from '../local-dist/seed.mjs';
import {validateNodes,expandUnnamedResources} from '../local-dist/model.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const idle=30*60*1000,absolute=8*60*60*1000;
const cookieName='uncia_session';
const usernamePattern=/^[a-z0-9._-]{3,64}$/;
export async function createApp({dataDir=path.join(root,'.local-data'),importPreview=true,bootstrap}={}){
 await fs.mkdir(dataDir,{recursive:true});
 const db=new DatabaseSync(path.join(dataDir,'atlas.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','editor')),disabled INTEGER NOT NULL DEFAULT 0,must_change INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,last_login TEXT);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,created INTEGER NOT NULL,last_seen INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS account_audit(id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS org_state(id INTEGER PRIMARY KEY,nodes TEXT NOT NULL,history TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL);`);
 if(!db.prepare('SELECT id FROM org_state WHERE id=1').get()){
  let state={nodes:JSON.stringify(initialNodes),history:'[]',version:0,updated_at:new Date().toISOString()};
  if(importPreview){const folder=path.join(root,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject');for(const f of await fs.readdir(folder).catch(()=>[])){if(!f.endsWith('.sqlite')||f==='metadata.sqlite')continue;let old;try{old=new DatabaseSync(path.join(folder,f),{readOnly:true});const s=old.prepare('SELECT nodes,history,version,updated_at FROM org_state WHERE id=1').get();if(s&&!validateNodes(JSON.parse(s.nodes)))state=s;}catch{}finally{old?.close()}}}
  db.prepare('INSERT INTO org_state VALUES (1,?,?,?,?)').run(state.nodes,state.history,state.version,state.updated_at);
 }
 db.exec("CREATE TABLE IF NOT EXISTS catalog_items(kind TEXT NOT NULL CHECK(kind IN ('designation','product')),name TEXT COLLATE NOCASE NOT NULL,PRIMARY KEY(kind,name));");
 const insertItem=db.prepare('INSERT OR IGNORE INTO catalog_items(kind,name) VALUES (?,?)');
 for(const n of JSON.parse(db.prepare('SELECT nodes FROM org_state WHERE id=1').get().nodes)){if(n.title.trim())insertItem.run('designation',n.title.trim());if(n.product?.trim())insertItem.run('product',n.product.trim());}
 for(const name of ['UNCIA PRIME (LOS)','UNCIA LEAP (LMS)','UNCIA FLOW (SCF)'])insertItem.run('product',name);
 db.exec('CREATE TABLE IF NOT EXISTS app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);');
 if(!db.prepare("SELECT value FROM app_meta WHERE key='assignment_products_v1'").get()){
  db.exec('BEGIN IMMEDIATE');
  try{const current=db.prepare('SELECT * FROM org_state WHERE id=1').get();let changed=false;
   const migrated=JSON.parse(current.nodes).map(n=>{const source=(n.product||n.assignment||'').trim();if(!source)return n;insertItem.run('product',source);const product=db.prepare("SELECT name FROM catalog_items WHERE kind='product' AND name=? COLLATE NOCASE").get(source).name;if(n.product===product)return n;changed=true;return {...n,product}});
   if(changed){const at=new Date().toISOString();const history=JSON.parse(current.history);history.unshift({at,by:'System migration',action:'Imported products from existing assignments',previous:JSON.parse(current.nodes)});db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1').run(JSON.stringify(migrated),JSON.stringify(history.slice(0,20)),at)}
   db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run('assignment_products_v1',new Date().toISOString());db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 const catalogs=()=>({designations:db.prepare("SELECT name FROM catalog_items WHERE kind='designation' ORDER BY name COLLATE NOCASE").all().map(x=>x.name),products:db.prepare("SELECT name FROM catalog_items WHERE kind='product' ORDER BY name COLLATE NOCASE").all().map(x=>x.name)});
 const publicRole=role=>role==='admin'?'admin':'viewer';
 const audit=(actor,action)=>db.prepare('INSERT INTO account_audit(at,actor,action) VALUES (?,?,?)').run(new Date().toISOString(),actor,action);
 if(bootstrap&&db.prepare('SELECT count(*) n FROM users').get().n===0){for(const user of bootstrap){if(!usernamePattern.test(user.username)||passwordError(user.password)||!['admin','editor'].includes(user.role))throw Error('Invalid bootstrap account.');db.prepare('INSERT INTO users(username,name,hash,role,created_at) VALUES (?,?,?,?,?)').run(user.username,user.name,await hashPassword(user.password),user.role,new Date().toISOString());}if(!db.prepare("SELECT id FROM users WHERE role='admin'").get())throw Error('A super-admin account is required.');audit('Setup','Initial super-admin and editor accounts created');}
 const attempts=new Map();let cryptoBusy=0;
 const dummy=await hashPassword(token());
 function headers(res,nonce=''){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',`default-src 'self'; script-src 'self' ${nonce?"'nonce-"+nonce+"'":''}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`)}
 function json(res,value,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
 function redirect(res,to){res.writeHead(303,{Location:to});res.end()}
 function page(res,html){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)}
 function session(req){let key;try{key=decodeURIComponent((req.headers.cookie||'').split(';').find(c=>c.trim().startsWith(cookieName+'='))?.trim().slice(cookieName.length+1)||'')}catch{return null}if(!/^[A-Za-z0-9_-]{43}$/.test(key))return null;const hash=digest(key);const s=db.prepare('SELECT sessions.*,users.username,users.name,users.role,users.disabled,users.must_change FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.hash=?').get(hash);if(!s)return null;const now=Date.now();if(s.disabled||now-s.created>absolute||now-s.last_seen>idle){db.prepare('DELETE FROM sessions WHERE hash=?').run(hash);return null}db.prepare('UPDATE sessions SET last_seen=? WHERE hash=?').run(now,hash);return {...s,id:s.user_id};}
 function issue(res,id){const raw=token(),now=Date.now();db.prepare('DELETE FROM sessions WHERE created<? OR last_seen<?').run(now-absolute,now-idle);db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?)').run(digest(raw),id,token(),now,now);res.setHeader('Set-Cookie',`${cookieName}=${raw}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${absolute/1000}`)}
 const viewUser=s=>({id:s.id,name:s.name,username:s.username,role:publicRole(s.role),mustChange:!!s.must_change,csrf:s.csrf});
 async function body(req,limit=16384){let size=0;const chunks=[];for await(const c of req){size+=c.length;if(size>limit)throw Object.assign(Error('Request is too large.'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}catch{throw Object.assign(Error('Invalid JSON request.'),{status:400})}}
 function state(){return db.prepare('SELECT * FROM org_state WHERE id=1').get()}
 function view(s){return {nodes:JSON.parse(s.nodes),catalogs:catalogs(),history:JSON.parse(s.history).map(({previous,...a})=>a),version:s.version,updatedAt:s.updated_at}}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(e){db.exec('ROLLBACK');throw e}}
 const fail=(message,status=400)=>Object.assign(Error(message),{status});
 const server=http.createServer(async(req,res)=>{const nonce=token();headers(res,nonce);try{
  const allowedHosts=new Set([`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`]);if(!allowedHosts.has(req.headers.host))return json(res,{error:'Invalid local host.'},400);
  const url=new URL(req.url,'http://'+req.headers.host);const route=url.pathname;const method=req.method||'GET';
  if(route==='/health'&&method==='GET')return json(res,{service:'uncia-local-atlas',ready:!!db.prepare('SELECT id FROM users LIMIT 1').get()});
  if(!['GET','HEAD'].includes(method)){if(req.headers.origin!==url.origin||!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,{error:'Invalid request origin or content type.'},403)}
  const s=session(req);
  if(route==='/auth/login'&&method==='POST'){
   const input=await body(req);const username=String(input.username||'').trim().toLowerCase();const password=typeof input.password==='string'?input.password:'';
   const address=req.socket.remoteAddress||'local';const now=Date.now();let record=attempts.get(address);if(!record||now-record.since>15*60*1000)record={since:now,count:0};if(record.count>=30)return json(res,{error:'Too many attempts. Try again in 15 minutes.'},429);record.count++;attempts.set(address,record);
   const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
   if(user&&user.locked_until>now)return json(res,{error:'Login is temporarily locked. Try again in 15 minutes or ask your admin to reset it.'},429);
   if(cryptoBusy>=2)return json(res,{error:'Please wait a moment and try again.'},429);
   cryptoBusy++;let valid=false;try{valid=await verifyPassword(password.length<=128?password:'',user?.hash||dummy)}finally{cryptoBusy--}
   const current=user?db.prepare('SELECT * FROM users WHERE id=?').get(user.id):null;
   if(!valid||!current||current.disabled||current.hash!==user.hash){if(current){const failed=current.failed+1;db.prepare('UPDATE users SET failed=?,locked_until=? WHERE id=?').run(failed,failed>=8?now+15*60*1000:0,current.id)}audit(username||'Unknown','Failed sign-in');return json(res,{error:'The login ID or password is incorrect.'},401)}
   db.prepare('UPDATE users SET failed=0,locked_until=0,last_login=? WHERE id=?').run(new Date().toISOString(),current.id);issue(res,current.id);audit(current.username,'Signed in');return json(res,{ok:true,mustChange:!!current.must_change});
  }
  if(route==='/login'&&method==='GET'){if(s)return redirect(res,s.must_change?'/account':'/');return page(res,loginPage(nonce))}
  // Public reads do not grant a session or write access. Authenticated writes are guarded below.
  if(route==='/auth/me'&&method==='GET')return json(res,s?viewUser(s):{name:'Guest',role:'viewer',mustChange:false,csrf:''});
  if(route==='/api/chart'&&method==='GET'){const chart=view(state());return json(res,{...chart,history:s?.role==='admin'&&!s.must_change?chart.history:[],user:{name:s?.name||'Guest',email:'',role:s&&!s.must_change?publicRole(s.role):'viewer',localAuth:true}})}
  if(route==='/api/catalogs'&&method==='GET')return json(res,catalogs());
  if(route==='/assets/app.js'||route==='/assets/app.css'){const content=await fs.readFile(path.join(root,'local-dist',route.endsWith('.css')?'app.css':'app.js'));res.writeHead(200,{'Content-Type':route.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});return res.end(content)}
  if(route==='/'&&method==='GET')return page(res,await fs.readFile(path.join(root,'local-dist/index.html'),'utf8'));
  if(!s){if(route.startsWith('/api/')||route.startsWith('/auth/'))return json(res,{error:'Please sign in.'},401);return redirect(res,'/login')}
  if(!['GET','HEAD'].includes(method)&&!safeEqual(req.headers['x-csrf-token'],s.csrf))return json(res,{error:'Your session changed. Reload and try again.'},403);
  if(route==='/auth/me'&&method==='GET')return json(res,viewUser(s));
  if(route==='/auth/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE hash=?').run(s.hash);res.setHeader('Set-Cookie',`${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);return json(res,{ok:true})}
  if(route==='/account'&&method==='GET')return page(res,accountPage(nonce));
  if(route==='/auth/password'&&method==='POST'){
   const input=await body(req);const invalid=passwordError(input.password);if(invalid)throw fail(invalid);const user=db.prepare('SELECT * FROM users WHERE id=?').get(s.id);
   if(!(await verifyPassword(String(input.currentPassword||'').slice(0,129),user.hash)))throw fail('Current password is incorrect.',401);
   if(safeEqual(input.currentPassword,input.password))throw fail('Choose a different password.');
   const hash=await hashPassword(input.password);transaction(()=>{if(!db.prepare('UPDATE users SET hash=?,must_change=0,failed=0,locked_until=0 WHERE id=? AND hash=?').run(hash,s.id,user.hash).changes)throw fail('Your password was changed by an admin. Please sign in again.',409);db.prepare('DELETE FROM sessions WHERE user_id=?').run(s.id);audit(s.username,'Changed own password')});issue(res,s.id);return json(res,{ok:true});
  }
  if(s.must_change){if(route.startsWith('/api/')||route.startsWith('/auth/'))return json(res,{error:'Change your password before using the app.'},403);return redirect(res,'/account')}
  if(route==='/accounts'&&method==='GET'){if(s.role!=='admin')return redirect(res,'/');return page(res,adminPage(nonce))}
  if(route.startsWith('/auth/users')){
   if(s.role!=='admin')return json(res,{error:'Super-admin access is required.'},403);
   if(route==='/auth/users'&&method==='GET')return json(res,{users:db.prepare('SELECT id,username,name,role,disabled,must_change AS mustChange,created_at AS createdAt,last_login AS lastLogin FROM users ORDER BY id').all().map(u=>({...u,role:publicRole(u.role)})),audit:db.prepare('SELECT at,actor,action FROM account_audit ORDER BY id DESC LIMIT 40').all()});
   if(route==='/auth/users'&&method==='POST'){const input=await body(req);const username=String(input.username||'').trim().toLowerCase(),name=String(input.name||'').trim();if(!usernamePattern.test(username)||!name||name.length>100||!['admin','editor','viewer'].includes(input.role))throw fail('Check the login ID, display name and role.');const invalid=passwordError(input.password);if(invalid)throw fail(invalid);if(db.prepare('SELECT id FROM users WHERE username=?').get(username))throw fail('That login ID already exists.',409);const hash=await hashPassword(input.password);db.prepare('INSERT INTO users(username,name,hash,role,must_change,created_at) VALUES (?,?,?,?,?,?)').run(username,name,hash,input.role==='admin'?'admin':'editor',input.mustChange?1:0,new Date().toISOString());audit(s.username,'Created '+publicRole(input.role)+' account '+username);return json(res,{ok:true,username},201)}
   const match=route.match(/^\/auth\/users\/(\d+)(?:\/(password|sessions))?$/);if(match){const id=Number(match[1]),action=match[2],user=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!user)throw fail('Account not found.',404);
    if(action==='password'&&method==='POST'){const input=await body(req);const invalid=passwordError(input.password);if(invalid)throw fail(invalid);const hash=await hashPassword(input.password);transaction(()=>{db.prepare('UPDATE users SET hash=?,must_change=?,failed=0,locked_until=0 WHERE id=?').run(hash,input.mustChange?1:0,id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);audit(s.username,'Reset password for '+user.username)});return json(res,{ok:true})}
    if(action==='sessions'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);audit(s.username,'Revoked sessions for '+user.username);return json(res,{ok:true})}
    if(!action&&method==='PATCH'){const input=await body(req);if(typeof input.disabled!=='boolean')throw fail('Specify whether the account is disabled.');transaction(()=>{if(input.disabled&&user.role==='admin'&&!user.disabled&&db.prepare("SELECT count(*) n FROM users WHERE role='admin' AND disabled=0").get().n<=1)throw fail('The last active super-admin cannot be disabled.');db.prepare('UPDATE users SET disabled=?,failed=0,locked_until=0 WHERE id=?').run(input.disabled?1:0,id);if(input.disabled)db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);audit(s.username,(input.disabled?'Disabled ':'Enabled ')+user.username)});return json(res,{ok:true})}
   }
   return json(res,{error:'Account operation not found.'},404);
  }
  if(route==='/api/catalogs'){
   if(method==='GET')return json(res,catalogs());
   if(s.role!=='admin')return json(res,{error:'Only a super admin can manage designations or products/assignments.'},403);
   if(method==='POST'){const input=await body(req);const name=typeof input.name==='string'?input.name.trim().replace(/\s+/g,' '):'';if(!['designation','product'].includes(input.kind)||!name||name.length>100)throw fail('Enter a designation or product name of 1–100 characters.');if(db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE NOCASE').get(input.kind,name))throw fail('This '+input.kind+' already exists.',409);insertItem.run(input.kind,name);audit(s.username,'Added '+input.kind+': '+name);return json(res,catalogs(),201)}
   if(method==='PATCH'){
    const input=await body(req),kind=input.kind;const from=typeof input.from==='string'?input.from:'',to=typeof input.to==='string'?input.to.trim().replace(/\s+/g,' '):'';
    if(!['designation','product'].includes(kind)||!from||!to||to.length>100)throw fail('Enter an existing item and a new name of 1–100 characters.');
    const label=kind==='designation'?'designation':'product/assignment';
    const updatedPeople=transaction(()=>{
     if(!db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE BINARY').get(kind,from))throw fail('Item not found. Refresh the list.',404);
     const conflict=db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE NOCASE').get(kind,to);
     if(conflict&&conflict.name!==from)throw fail('That '+label+' already exists. Choose a different name.',409);if(from===to)return 0;
     const current=state(),previous=JSON.parse(current.nodes);let count=0;const field=kind==='designation'?'title':'product';
     const nodes=previous.map(n=>{if(n[field]!==from)return n;count+=n.count;return {...n,[field]:to,...(kind==='product'&&n.assignment===from?{assignment:to}:{})}});
     const invalid=validateNodes(nodes);if(invalid)throw fail(invalid);const at=new Date().toISOString();const history=JSON.parse(current.history);
     history.unshift({at,by:s.name,action:'Renamed '+label+': '+from+' → '+to,previous,catalogRename:{kind,from,to}});
     db.prepare('UPDATE catalog_items SET name=? WHERE kind=? AND name=? COLLATE BINARY').run(to,kind,from);
     db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at);
     audit(s.username,'Renamed '+label+' '+from+' to '+to+' ('+count+' positions)');return count;
    });return json(res,{...catalogs(),updatedPeople});
   }
   if(method==='DELETE'){
    const input=await body(req),kind=input.kind,name=typeof input.name==='string'?input.name:'';
    if(!['designation','product'].includes(kind)||!name)throw fail('Select an existing list entry.');
    transaction(()=>{if(!db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE BINARY').get(kind,name))throw fail('Item not found. Refresh the list.',404);
     const field=kind==='designation'?'title':'product';const count=JSON.parse(state().nodes).filter(n=>n[field]===name).reduce((sum,n)=>sum+n.count,0);
     if(count)throw fail(`This entry is used by ${count} position${count===1?'':'s'}. Change their ${kind==='designation'?'designation':'product/assignment'} before deleting it.`,409);
     db.prepare('DELETE FROM catalog_items WHERE kind=? AND name=? COLLATE BINARY').run(kind,name);audit(s.username,'Deleted unused '+kind+': '+name);
    });return json(res,catalogs());
   }
   return json(res,{error:'Method not allowed.'},405);
  }
  if(route==='/api/chart'){
   if(method==='GET')return json(res,{...view(state()),user:{name:s.name,email:s.username,role:publicRole(s.role),localAuth:true}});
   if(s.role!=='admin')return json(res,{error:'Only a super admin can change the organisation chart.'},403);
   if(method==='PUT'){const input=await body(req,5000000);const output=transaction(()=>{const current=state();if(input.version!==current.version)throw fail('Someone else updated the chart. Reload the latest version before saving.',409);const history=JSON.parse(current.history);let nodes=input.nodes,action=String(input.action||'Updated chart').slice(0,200),catalogRename;if(input.undo){if(!history[0]?.previous)throw fail('There is no change to undo.');nodes=history[0].previous;action='Undid: '+history[0].action;const rename=history[0].catalogRename;if(rename){const exists=db.prepare('SELECT name FROM catalog_items WHERE kind=? AND name=? COLLATE NOCASE').get(rename.kind,rename.from);if(exists&&exists.name!==rename.to)throw fail('Cannot undo this rename because its previous name is now in use.',409);if(!db.prepare('UPDATE catalog_items SET name=? WHERE kind=? AND name=? COLLATE BINARY').run(rename.from,rename.kind,rename.to).changes)throw fail('The renamed item has changed. Refresh and try again.',409);catalogRename={kind:rename.kind,from:rename.to,to:rename.from}}}const invalid=validateNodes(nodes);if(invalid)throw fail(invalid);try{nodes=expandUnnamedResources(nodes)}catch(e){throw fail(e.message)}const splitError=validateNodes(nodes);if(splitError)throw fail(splitError);for(const n of nodes){if(n.title&&!db.prepare("SELECT name FROM catalog_items WHERE kind='designation' AND name=? COLLATE BINARY").get(n.title))throw fail('Select a designation from the dropdown. Add new designations through Manage lists.');if(n.product&&!db.prepare("SELECT name FROM catalog_items WHERE kind='product' AND name=? COLLATE BINARY").get(n.product))throw fail('Select a product/assignment from the dropdown, or leave it blank.');}const at=new Date().toISOString();history.unshift({at,by:s.name,action,previous:JSON.parse(current.nodes),...(catalogRename?{catalogRename}:{})});db.prepare('UPDATE org_state SET nodes=?,history=?,version=version+1,updated_at=? WHERE id=1').run(JSON.stringify(nodes),JSON.stringify(history.slice(0,20)),at);return view(state())});return json(res,output)}
   return json(res,{error:'Method not allowed.'},405);
  }
  if(route==='/assets/app.js'||route==='/assets/app.css'){const content=await fs.readFile(path.join(root,'local-dist',route.endsWith('.css')?'app.css':'app.js'));res.writeHead(200,{'Content-Type':route.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'});return res.end(content)}
  if(route==='/'&&method==='GET')return page(res,await fs.readFile(path.join(root,'local-dist/index.html'),'utf8'));
  return json(res,{error:'Not found.'},404);
 }catch(e){const code=e.status||500;if(code===500)console.error('Local request failed:',e.message);if(!res.headersSent)json(res,{error:code===500?'The request could not be completed. Please try again.':e.message},code);else res.end();}});
 server.headersTimeout=10000;server.requestTimeout=30000;
 return {server,db,close:()=>{server.close();db.close()}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=await createApp();if(!app.db.prepare('SELECT id FROM users LIMIT 1').get()){console.error('No accounts configured. Run local/setup.mjs first.');process.exit(1)}
 app.server.listen(5174,'127.0.0.1',()=>console.log('UNCIA Team Atlas is ready at http://127.0.0.1:5174/'));
 const shutdown=()=>app.server.close(()=>{app.db.close();process.exit(0)});process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
