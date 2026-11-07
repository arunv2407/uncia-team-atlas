import assert from 'node:assert/strict';
import {employeeIdentity} from './satish-team-update.mjs';
import {validateNodes} from '../local-dist/model.mjs';
const normal=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const vacant=r=>/^(?:TBH|TBD)\b/i.test(r.Name);
const aliases=new Map([['tpmadhusudhanan','madhusudhanatp'],['aylwint','aylwintitus']]);
const role=r=>r['Current Designation']||r['Recommended Designation - Function']?.replace(/\s+-\s+(?:Care|CNG|PEG|PMG|GoLive|Leadership|QA|IT Infrastructure)$/i,'')||'';
const years=v=>v!==''&&Number.isFinite(Number(v))?String(Math.round(Number(v)*100)/100):v;
export function consolidate(previous,source){
 const nodes=structuredClone(previous),rows=source.rows,sourceIds=new Map(),sourceNames=new Map();
 for(const row of rows.filter(r=>!vacant(r))){const p=employeeIdentity(row.Name,row['Emp id']);if(p.employeeId){assert.ok(!sourceIds.has(p.employeeId),'Duplicate named employee ID');sourceIds.set(p.employeeId,row);}sourceNames.set(normal(p.name),row);}
 const sourceManager=row=>{const p=employeeIdentity(row['Reporting Manager']);return sourceIds.get(p.employeeId)||sourceNames.get(aliases.get(normal(p.name))||normal(p.name));};
 const rootRow=sourceIds.get('E2005');assert.ok(rootRow,'Sagar is missing');
 const inScope=(row,seen=new Set())=>{if(row===rootRow)return true;if(seen.has(row.row))throw Error('Source reporting cycle');seen.add(row.row);const parent=sourceManager(row);return !!parent&&inScope(parent,seen);};
 const selected=rows.filter(r=>inScope(r)),claimed=new Set(),mapped=new Map(),report={sourceRows:rows.length,selectedRows:selected.length,excluded:rows.filter(r=>!selected.includes(r)).map(r=>({name:r.Name,function:r.Function,manager:r['Reporting Manager']})),added:[],titleChanges:[],reportingChanges:[],retained:[],vacancies:0};
 for(const row of selected.filter(r=>!vacant(r))){const p=employeeIdentity(row.Name,row['Emp id']);let match=p.employeeId?nodes.filter(n=>n.employeeId===p.employeeId&&n.status!=='Vacant'):[];if(!match.length)match=nodes.filter(n=>normal(employeeIdentity(n.name).name)===normal(p.name)&&n.status!=='Vacant'&&!n.namePending);assert.ok(match.length<=1,'Ambiguous name '+row.Name);let n=match[0];
  if(!n){n={id:p.employeeId?'employee-'+p.employeeId.toLowerCase():'consolidated-person-'+normal(p.name),parentId:'sagar',name:p.name,title:role(row),team:row.Function,assignment:'',product:'',status:'Filled',employment:'Not specified',count:1,experience:'',tenure:'',notes:''};assert.ok(!nodes.some(x=>x.id===n.id),'ID collision');nodes.push(n);report.added.push({id:n.id,name:n.name,status:n.status});}
  assert.ok(!claimed.has(n.id),'Duplicate source match');claimed.add(n.id);mapped.set(row.row,n);n.name=n.id==='sagar'?'Sagar':p.name;n.employeeId=p.employeeId||n.employeeId||'';
 }
 // Specific Infra lead vacancy reuses the existing unnamed lead; distinct open roles stay separate.
 const vacancies=selected.filter(vacant).sort((a,b)=>(/lead infr/i.test(b.Name)?1:0)-(/lead infr/i.test(a.Name)?1:0)||a.row-b.row);
 for(const row of vacancies){const parent=mapped.get(sourceManager(row)?.row);assert.ok(parent,'Missing vacancy manager');let pool=nodes.filter(n=>n.status==='Vacant'&&!claimed.has(n.id)&&n.team===row.Function&&normal(n.employeeDetails?.Name)===normal(row.Name));pool.sort((a,b)=>(b.parentId===parent.id)-(a.parentId===parent.id)||(a.masterRow||0)-(b.masterRow||0));
  if(!pool.length&&row.Function==='IT Infrastructure'&&/lead infr/i.test(row.Name))pool=nodes.filter(n=>n.status==='Vacant'&&n.parentId===parent.id&&!claimed.has(n.id)&&n.title==='Lead');let n=pool[0];
  if(!n){n={id:'consolidated-vacancy-'+normal(row.Function+row.Name).slice(0,65)+'-'+row.row,parentId:parent.id,name:'',title:role(row),team:row.Function,assignment:'',product:'',status:'Vacant',employment:'Not specified',count:1,experience:'',tenure:'',notes:''};assert.ok(!nodes.some(x=>x.id===n.id),'Vacancy ID collision');nodes.push(n);report.added.push({id:n.id,name:row.Name,status:'Vacant'});}
  claimed.add(n.id);mapped.set(row.row,n);report.vacancies++;
 }
 const products=new Map(previous.filter(n=>n.product).map(n=>[n.product.toLowerCase(),n.product]));
 for(const row of selected){const n=mapped.get(row.row),old=previous.find(p=>p.id===n.id),prior=old?.employeeDetails||{},isVacancy=vacant(row),parent=row===rootRow?null:mapped.get(sourceManager(row)?.row)?.id;assert.ok(row===rootRow||parent,'Missing manager for '+row.Name);
  if(old&&n.parentId!==parent)report.reportingChanges.push({name:n.name||row.Name,from:n.parentId,to:parent});n.parentId=parent;n.team=row.Function;n.namePending=isVacancy;
  const sourceTitle=row['Current Designation'];if(!n.title||(sourceTitle&&sourceTitle!==prior['Current Designation'])){const title=sourceTitle||n.title||role(row);if(old&&title!==n.title)report.titleChanges.push({name:n.name||row.Name,from:n.title,to:title});n.title=title;}n.designationMissing=!n.title;
  if(isVacancy){n.name='';n.employeeId='';n.status='Vacant';}else if(row['Emp id'].toUpperCase()==='NJ')n.status='Yet to join';
  if(row.Position)n.employment=row.Position.toLowerCase()==='contract'?'Contract':'Employee';
  for(const [key,field] of [['Total Experience','experience'],['Uncia Exp','tenure']])if(row[key]!==prior[key])n[field]=years(row[key]||'');
  if(row.Module!==prior.Module)n.product=products.get((row.Module||'').toLowerCase())||row.Module||'';if(row['Client Name']!==prior['Client Name'])n.assignment=row['Client Name']||'';
  n.employeeDetails=Object.fromEntries(Object.entries(row).filter(([key,value])=>!['row','#'].includes(key)&&value!==''));n.employeeDetails.Name=isVacancy?row.Name:n.name;n.employeeDetails['Emp id']=n.employeeId||'';n.employeeDetails.Source=`${source.source} · ${source.sheet} · row ${row.row}`;if(!isVacancy&&!n.employeeId)n.employeeDetails['Employee ID status']='Pending — no unique employee ID supplied.';
  n.masterSourceHash=source.sha256;n.masterRow=row.row;n.needsMapping=false;n.mappingNote='';n.pending=false;n.pendingMove=/goes to care/i.test(row.Name);
 }
 for(const old of previous){const n=nodes.find(n=>n.id===old.id);assert.ok(n,'Existing record removed');if(!claimed.has(old.id)){if(old.status!=='Vacant'){n.needsMapping=true;n.mappingNote='Earlier chart entry is not named in the consolidated master. Retained for confirmation.';report.retained.push({id:n.id,name:n.name||'Name pending',title:n.title});}}if(old.status==='Vacant')assert.equal(n.status,'Vacant','Existing vacancy was consumed');}
 assert.equal(validateNodes(nodes),null);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);assert.equal(mapped.size,selected.length);
 report.positions=nodes.length;report.filled=nodes.filter(n=>n.status==='Filled').length;report.yetToJoin=nodes.filter(n=>n.status==='Yet to join').length;report.open=nodes.filter(n=>n.status==='Vacant').length;return {nodes,report};
}
