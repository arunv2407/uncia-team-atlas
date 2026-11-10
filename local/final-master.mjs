import assert from 'node:assert/strict';
import {validateNodes,descendants} from '../local-dist/model.mjs';
import {employeeIdentity} from './satish-team-update.mjs';

export const functionHeads={'CNG':'guna','CNG - Care':'guna','GoLive':'satish','GoLive & QA':'satish','Quality Assurance':'satish','PEG':'engineering','PMG':'product','IT Infrastructure':'infra','PMO':'pmo','HR':'hr'};
const key=s=>(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function canonicalFunction(value){return new Map([['cng','CNG'],['cngcare','CNG - Care'],['golive','GoLive'],['goliveqa','GoLive & QA'],['qualityassurance','Quality Assurance'],['peg','PEG'],['pmg','PMG'],['infra','IT Infrastructure'],['itinfrastructure','IT Infrastructure'],['pmo','PMO'],['hr','HR']]).get(key(value))||value.trim();}
export function finalIdentity(name,id=''){return employeeIdentity(name.replace(/\s*[-–]?\s*\b(?:YTJ|NJ)\b\s*$/i,''),id);}
const vacancy=r=>/^(TBH|TBD)\b/i.test(r.Name)||/^(TBH|TBD)$/i.test(r['Emp id']);
const years=value=>value!==''&&Number.isFinite(Number(value))?String(Math.round(Number(value)*100)/100):value||'';
const recommended=r=>(r['Recommended Designation - Function']||'').replace(/\s+-\s+(Care|CNG|GoLive|QA|Leadership|PEG|PMG|HR|IT Infrastructure|PMO)$/i,'').trim();
const sum=nodes=>({total:nodes.reduce((a,n)=>a+n.count,0),filled:nodes.filter(n=>n.status==='Filled').reduce((a,n)=>a+n.count,0),vacant:nodes.filter(n=>n.status==='Vacant').reduce((a,n)=>a+n.count,0),yetToJoin:nodes.filter(n=>n.status==='Yet to join').reduce((a,n)=>a+n.count,0)});
export function reconcileFinal(previous,source,{sravan,unmatched}){
 assert.ok(['pmo-exception','exclude'].includes(sravan),'Choose how to handle Sravan');assert.ok(['archive','retain'].includes(unmatched),'Choose how to handle unmatched entries');
 const prior=structuredClone(previous),claimed=new Set(),mapped=new Map(),functionByRow=new Map();
 const report={source:source.source,sha256:source.sha256,sourceRows:source.rows.length,added:[],archived:[],retained:[],reportingOverrides:[],unresolved:[],missingDesignations:[],designationFallbacks:[],excluded:[],functions:{},branches:{}};
 const rows=source.rows.filter(row=>{const identity=finalIdentity(row.Name,row['Emp id']);let f=canonicalFunction(row.Function);if(identity.employeeId==='E2005')f='Leadership';const included=f==='Leadership'||(functionHeads[f]&&(f!=='PMO'||identity.employeeId==='E2017'||(identity.employeeId==='C1371'&&sravan==='pmo-exception')||key(identity.name)==='arunvenkatraman'));
  if(!included)report.excluded.push({row:row.row,name:identity.name,function:row.Function,manager:row['Reporting Manager']});else functionByRow.set(row.row,f);return included;});
 const make=(row,identity,isVacancy)=>({id:isVacancy?'final-vacancy-'+row.row:identity.employeeId?'employee-'+identity.employeeId.toLowerCase():'final-person-'+key(identity.name).slice(0,60),parentId:'sagar',name:isVacancy?'':identity.name,title:'',team:functionByRow.get(row.row),assignment:'',product:'',status:isVacancy?'Vacant':'Filled',employment:'Not specified',count:1,experience:'',tenure:'',notes:''});
 const fixedHeadIds={E2005:'sagar',E1675:'guna',E1272:'engineering',E1838:'product',E1870:'hr',E2017:'pmo'};
 for(const row of rows.filter(r=>!vacancy(r))){const identity=finalIdentity(row.Name,row['Emp id']);let matches=identity.employeeId?prior.filter(n=>n.employeeId?.toUpperCase()===identity.employeeId):[];
  if(!matches.length)matches=prior.filter(n=>n.name&&!n.namePending&&key(finalIdentity(n.name).name)===key(identity.name));
  const fixed=fixedHeadIds[identity.employeeId]||(key(identity.name)==='satishj'?'satish':['madhusudhanatp','tpmadhusudhanan'].includes(key(identity.name))?'infra':null);if(!matches.length&&fixed)matches=prior.filter(n=>n.id===fixed);
  assert.ok(matches.length<=1,'Ambiguous person '+identity.name);const n=matches[0]||make(row,identity,false);assert.ok(!claimed.has(n.id),'Duplicate employee row '+identity.name);claimed.add(n.id);mapped.set(row.row,n);if(!matches.length)report.added.push({id:n.id,name:identity.name,row:row.row});
 }
 const get=id=>[...mapped.values()].find(n=>n.id===id);
 for(const id of ['sagar',...new Set(Object.values(functionHeads))])assert.ok(get(id),'Missing functional head '+id);
 const byEmp=new Map(),byName=new Map();for(const row of rows.filter(r=>!vacancy(r))){const n=mapped.get(row.row),identity=finalIdentity(row.Name,row['Emp id']);if(identity.employeeId){assert.ok(!byEmp.has(identity.employeeId),'Duplicate employee ID');byEmp.set(identity.employeeId,n)}const nameKey=key(identity.name);assert.ok(!byName.has(nameKey),'Duplicate employee name');byName.set(nameKey,n);}
 const managerFor=row=>{const identity=finalIdentity(row['Reporting Manager']||'');return byEmp.get(identity.employeeId)||byName.get(key(identity.name))||(key(identity.name)==='aylwint'?byName.get('aylwintitus'):null)||(identity.employeeId==='E1805'?get('satish'):null)||(key(identity.name)==='tpmadhusudhanan'?get('infra'):null);};
 for(const row of rows.filter(vacancy)){const f=functionByRow.get(row.row),manager=managerFor(row),title=row['Current Designation']||recommended(row);const pool=prior.filter(n=>n.status==='Vacant'&&!claimed.has(n.id)&&canonicalFunction(n.team)===f);
  const score=n=>(key(n.employeeDetails?.Name)===key(row.Name)?30:0)+(n.parentId===manager?.id?20:0)+(key(n.title)===key(title)?10:0)+(key(n.product)===key(row.Module)?8:0);
  pool.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));const n=pool[0]||make(row,{name:'',employeeId:''},true);assert.ok(!claimed.has(n.id));claimed.add(n.id);mapped.set(row.row,n);if(!pool.length)report.added.push({id:n.id,name:row.Name,row:row.row});
 }
 for(const row of rows){const n=mapped.get(row.row),old=previous.find(p=>p.id===n.id),identity=finalIdentity(row.Name,row['Emp id']),f=functionByRow.get(row.row),isVacancy=vacancy(row);
  n.name=n.id==='sagar'?'Sagar':isVacancy?'':identity.name;n.employeeId=isVacancy?'':identity.employeeId||old?.employeeId||'';n.team=f;n.count=1;
  n.title=row['Current Designation']||old?.title||recommended(row)||'';n.designationMissing=!n.title;if(!row['Current Designation'])report.designationFallbacks.push({row:row.row,name:n.name||row.Name,title:n.title});if(!n.title)report.missingDesignations.push({row:row.row,name:n.name||row.Name});
  n.status=isVacancy?'Vacant':/\bYTJ\b/i.test(row.Name)||/^(NJ|YTJ)$/i.test(row['Emp id'])?'Yet to join':identity.employeeId?'Filled':old?.status==='Yet to join'?'Yet to join':'Filled';n.namePending=isVacancy;
  n.employment=/contract/i.test(row.Position)?'Contract':row.Position?'Employee':old?.employment||'Not specified';n.experience=years(row['Total Experience']);n.tenure=years(row['Uncia Exp']);n.assignment=row['Client Name']||'';n.product=row.Module||'';
  n.employeeDetails=Object.fromEntries(Object.entries(row).filter(([k,v])=>!['row','#'].includes(k)&&v!==''));n.employeeDetails.Source=source.source+' · '+source.sheet+' · row '+row.row;
  n.masterSourceHash=source.sha256;n.masterRow=row.row;n.pending=false;n.pendingMove=false;n.needsMapping=false;n.mappingNote='';delete n.reportingException;
 }
 for(const row of rows){const n=mapped.get(row.row);if(n.id==='sagar'){n.parentId=null;continue}const head=functionHeads[n.team];if(n.employeeId==='C1371'){const hari=byEmp.get('C1365');assert.ok(hari,'Hari KV missing for confirmed PMO reporting exception');n.parentId=hari.id;n.reportingException='PMO function; reports to Hari KV in GoLive (confirmed exception).';n.employeeDetails['Reporting exception']=n.reportingException;continue}if(n.id===head){n.parentId='sagar';continue}
  const manager=managerFor(row);const managerOwner=manager&&functionHeads[manager.team];
  if(manager&&manager.id!==n.id&&managerOwner===head)n.parentId=manager.id;
  else {n.parentId=head;const reason=manager?'Functional ownership confirmed by user overrides the workbook reporting line.':'Workbook reporting manager is not resolvable within this organisation.';report.reportingOverrides.push({row:row.row,name:n.name||row.Name,sourceManager:row['Reporting Manager'],manager:get(head).name,reason});if(!manager){n.needsMapping=true;n.mappingNote=reason;report.unresolved.push({row:row.row,name:n.name||row.Name,manager:row['Reporting Manager']})}}
 }
 const nodes=rows.map(r=>mapped.get(r.row));
 for(const old of previous.filter(n=>!claimed.has(n.id))){if(unmatched==='archive'){report.archived.push({id:old.id,name:old.name||'Name pending',title:old.title,status:old.status,team:old.team});continue}const n=structuredClone(old);let ancestor=old;while(ancestor&&!functionHeads[canonicalFunction(ancestor.team)])ancestor=previous.find(p=>p.id===ancestor.parentId);n.team=ancestor?canonicalFunction(ancestor.team):'GoLive';const head=functionHeads[n.team]||'satish';if(!nodes.some(p=>p.id===n.parentId))n.parentId=head;n.needsMapping=true;n.mappingNote='Not present in final master; retained for confirmation.';nodes.push(n);report.retained.push({id:n.id,name:n.name||'Name pending'});}
 assert.equal(validateNodes(nodes),null);assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length);assert.equal(nodes.filter(n=>n.masterSourceHash===source.sha256).length,rows.length);
 for(const f of [...new Set(nodes.map(n=>n.team))])report.functions[f]=sum(nodes.filter(n=>n.team===f));
 for(const head of [...new Set(Object.values(functionHeads))]){const branch=[nodes.find(n=>n.id===head),...descendants(nodes,head)];const owned=nodes.filter(n=>n.employeeId==='C1371'?head==='satish':functionHeads[n.team]===head);assert.deepEqual(new Set(branch.map(n=>n.id)),new Set(owned.map(n=>n.id)),'Function/branch mismatch at '+head);report.branches[head]=sum(branch);}
 report.totals=sum(nodes);report.includedRows=rows.length;return {nodes,report};
}
