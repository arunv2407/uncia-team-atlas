import {validateNodes,descendants} from '../local-dist/model.mjs';

export const scopeHeads={'GoLive':'satish','GoLive & QA':'satish','Quality Assurance':'satish','CNG':'guna','CNG - Care':'karthik','PEG':'engineering','HR':'hr','PMG':'product','IT Infrastructure':'infra'};
const aliases=new Map([
 ['Sagar Ramesh Mahajan','sagar'],['Madhusudhana T P','infra'],['Subramonia Sarma K R','product'],
 ['Uma Shankari I','17856be3-f76a-43cf-b5a3-a796926c413b'],['Priyadharshni Anand Vishal','peg-priyadharshini-anand-vishal'],
]);
export function cleanName(value){return value.replace(/\s*[-–]?\s*(?:goes to|moves to).*$/i,'').replace(/\s*[-–]\s*LMS Lead Care.*$/i,'').replace(/\s*\([^)]*\)\s*$/,'').trim().replace(/\s+/g,' ');}
const key=value=>cleanName(value).toLowerCase().replace(/[^a-z0-9]/g,'');
const isVacancy=row=>/^TBH\b/i.test(row.Name);
const recommended=row=>(row['Recommended Designation - Function']||'').replace(/\s+-\s+(?:Administration|CNG|Care|GoLive|Leadership|HR|IT Infrastructure|Marketing|PEG|PMG|QA|Sales|UNCIA AI Labs|Nurture & Growth)$/i,'').trim();
const years=value=>value!==''&&Number.isFinite(Number(value))?String(Math.round(Number(value)*100)/100):value;
const total=nodes=>nodes.reduce((s,n)=>s+n.count,0);
export const reportsToSatish=functionName=>['golive','golive & qa'].includes(functionName.trim().toLowerCase());
export function functionReportingOverride(row,node){if(node.id==='sagar')return null;if(node.id==='satish')return 'sagar';return reportsToSatish(row.Function)?'satish':undefined;}

export function reconcileEmployeeMaster(previous,source){
 const nodes=structuredClone(previous),selected=source.rows.filter(r=>Object.hasOwn(scopeHeads,r.Function));
 const report={source:source.source,sha256:source.sha256,sourceRows:source.rows.length,includedRows:selected.length,excludedRows:source.rows.filter(r=>!Object.hasOwn(scopeHeads,r.Function)).map(r=>({row:r.row,name:r.Name,function:r.Function})),added:[],updated:[],namedPlaceholders:[],vacanciesReused:[],missingDesignations:[],designationFallbacks:[],unresolved:[],reportingChanges:[]};
 const original=new Map(previous.map(n=>[n.id,n])),byName=new Map();for(const n of nodes.filter(n=>n.name&&!n.namePending)){const k=key(n.name);if(byName.has(k))throw Error('Ambiguous existing name '+n.name);byName.set(k,n);}
 const knownIds=new Map(nodes.filter(n=>n.employeeId&&n.status!=='Vacant').map(n=>[n.employeeId,n]));
 const aliasIds=new Map([...aliases].map(([name,id])=>[key(name),id]));
 const get=id=>nodes.find(n=>n.id===id);
 const claim=new Set(),rowNodes=new Map(),sourceIds=new Map();
 const branchIds=head=>new Set([head,...descendants(previous,head).map(n=>n.id)]);
 const branches=new Map(Object.values(scopeHeads).map(h=>[h,branchIds(h)]));
 const make=(row,vacant)=>({id:vacant?`master-vacancy-${source.sheet.replace(/\W/g,'').toLowerCase()}-${row.row}`:row['Emp id']?`employee-${row['Emp id'].toLowerCase()}`:`master-person-${row.row}`,parentId:scopeHeads[row.Function],name:vacant?'':cleanName(row.Name),title:'',team:row.Function,assignment:'',product:'',status:vacant?'Vacant':'Filled',employment:'Not specified',count:1,experience:'',tenure:'',notes:''});
 // Resolve named employees first so every manager can be joined by employee ID, regardless of row order.
 for(const row of selected.filter(r=>!isVacancy(r))){
  const alias=aliasIds.get(key(row.Name));let n=knownIds.get(row['Emp id'])||byName.get(key(row.Name))||(alias&&get(alias));
  if(!n){n=make(row,false);if(get(n.id))throw Error('Employee ID collision: '+n.id);nodes.push(n);report.added.push({row:row.row,id:n.id,name:n.name});}
  if(claim.has(n.id))throw Error('Two master rows match '+n.name);claim.add(n.id);rowNodes.set(row.row,n);
  if(row['Emp id']){if(sourceIds.has(row['Emp id']))throw Error('Duplicate named employee ID '+row['Emp id']);sourceIds.set(row['Emp id'],n);}
 }
 const managerNode=row=>{const ref=row['Reporting Manager']||'',id=ref.match(/\b(?:E\d+|C\d+|TR\d+)\b/i)?.[0]?.toUpperCase();return sourceIds.get(id)||knownIds.get(id)||(id==='E1805'?get('satish'):null)||byName.get(key(ref.replace(/\s+(?:E\d+|C\d+|TR\d+)\s*$/i,'')));};
 const parentFor=(row,n)=>{const override=functionReportingOverride(row,n);if(override!==undefined)return override;const manager=managerNode(row);if(manager&&manager.id!==n.id)return manager.id;const head=scopeHeads[row.Function];const fallback=n.id===head?'sagar':head;const headRow=selected.find(r=>rowNodes.get(r.row)?.id===fallback);const headName=headRow?cleanName(headRow.Name):get(fallback)?.name;report.unresolved.push({id:n.id,name:n.name||row.Name,sourceManager:row['Reporting Manager'],temporaryManager:headName,reason:'Workbook manager is absent from the agreed chart scope.'});return fallback;};
 // Replace anonymous filled positions with newly identified employees, never a named person or an open role.
 for(const row of selected.filter(r=>!isVacancy(r))){let n=rowNodes.get(row.row);if(!report.added.some(a=>a.id===n.id))continue;
  const parent=parentFor(row,n),pool=previous.filter(p=>p.namePending&&p.status==='Filled'&&!claim.has(p.id)&&branches.get(scopeHeads[row.Function]).has(p.id));
  const score=p=>(p.parentId===parent?20:0)+(p.title===row['Current Designation']||p.title===recommended(row)?10:0)+(p.title==='Designation not provided'?3:0);
  pool.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));const slot=pool[0];if(!slot)continue;
  const replacement={...n,id:slot.id,notes:'Named from the employee master by reusing an anonymous position. Reporting, designation and assignments follow the master; the former anonymous position does not establish this employee’s prior identity.'};nodes.splice(nodes.indexOf(n),1);nodes[nodes.findIndex(p=>p.id===slot.id)]=replacement;claim.add(slot.id);rowNodes.set(row.row,replacement);if(row['Emp id'])sourceIds.set(row['Emp id'],replacement);
  report.added=report.added.filter(a=>a.id!==n.id);report.namedPlaceholders.push({id:slot.id,row:row.row,name:replacement.name,priorManager:slot.parentId,priorDesignation:slot.title});
 }
 // Existing filled employees absent from this workbook stay visible for confirmation.
 // Reserve specifically labelled roles and exact reporting matches before generic TBH rows.
 const vacancyPriority=row=>{const label=row.Name.toLowerCase();if(row.Function==='CNG - Care'&&label!=='tbh')return 100;const manager=managerNode(row);return previous.some(p=>p.status==='Vacant'&&p.parentId===manager?.id&&(p.title===row['Current Designation']||p.title===recommended(row)))?50:0;};
 const vacancyRows=selected.filter(isVacancy).sort((a,b)=>vacancyPriority(b)-vacancyPriority(a)||a.row-b.row);
 for(const row of vacancyRows){
  let n=nodes.find(p=>p.masterSourceHash===source.sha256&&p.masterRow===row.row&&p.status==='Vacant');
  if(!n){const pool=previous.filter(p=>p.status==='Vacant'&&!claim.has(p.id)&&branches.get(scopeHeads[row.Function]).has(p.id));const label=row.Name.toLowerCase();const parent=managerNode(row)?.id||scopeHeads[row.Function];
   const score=p=>(p.parentId===parent?4:0)+(p.title===row['Current Designation']||p.title===recommended(row)?6:0)+(/mumbai support manager/.test(label)&&/project manager/i.test(p.title)?50:0)+(/mumbai support [123]/.test(label)&&p.parentId==='care-v-8'?40:0)+(/lead prime/.test(label)&&p.id==='care-v-4'?60:0)+(/flow/.test(label)&&p.product?.toLowerCase().includes('flow')?20:0);
   pool.sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));n=pool[0]&&get(pool[0].id);if(n)report.vacanciesReused.push({id:n.id,row:row.row});else {n=make(row,true);if(get(n.id))throw Error('Vacancy ID collision');nodes.push(n);report.added.push({id:n.id,row:row.row,name:row.Name});}
  }
  claim.add(n.id);rowNodes.set(row.row,n);
 }
 // All employee identities and vacancies are known before assigning relationships.
 report.unresolved=[];
 for(const row of selected){const n=rowNodes.get(row.row),old=original.get(n.id),vacant=isVacancy(row);const displayName=n.id==='sagar'?'Sagar':vacant?'':cleanName(row.Name);n.name=displayName;n.namePending=vacant;
  n.employeeId=vacant?'':row['Emp id'];n.masterSourceHash=source.sha256;n.masterRow=row.row;
  const title=row['Current Designation']||old?.title||recommended(row)||'';
  n.title=title;n.designationMissing=!title;
  if(!row['Current Designation'])report.designationFallbacks.push({id:n.id,name:displayName||row.Name,used:old?.title?'Existing designation':recommended(row)?'Recommended designation':'Missing',title});
  if(!title)report.missingDesignations.push({id:n.id,row:row.row,name:displayName||row.Name});
  n.parentId=parentFor(row,n);n.team=row.Function;n.count=1;
  n.employment=row.Position.toLowerCase()==='contract'?'Contract':row.Position?'Employee':old?.employment||'Not specified';
  n.status=vacant?'Vacant':old?.status==='Yet to join'?'Yet to join':'Filled';
  if(row['Total Experience'])n.experience=years(row['Total Experience']);if(row['Uncia Exp'])n.tenure=years(row['Uncia Exp']);
  if(row['Module'])n.product=row['Module'];if(row['Client Name'])n.assignment=row['Client Name'];
  n.employeeDetails=Object.fromEntries(Object.entries(row).filter(([k,v])=>!['row','#'].includes(k)&&v!==''));
  n.employeeDetails.Source=`${source.source} · ${source.sheet} · row ${row.row}`;
  if(reportsToSatish(row.Function)&&!['sagar','satish'].includes(n.id))n.employeeDetails['Reporting override']='GoLive / GoLive & QA reports directly to Satish, as instructed by the user on 4 November 2026. The original workbook manager is retained for reference.';
  const unresolved=report.unresolved.find(u=>u.id===n.id);n.mappingNote=unresolved?`${unresolved.reason} Source manager: ${unresolved.sourceManager||'not supplied'}. Temporarily shown under ${unresolved.temporaryManager}; confirm reporting.`:'';
  n.needsMapping=!!unresolved;n.pendingMove=/goes to care/i.test(row.Name);n.pending=false;
  if(old&&old.parentId!==n.parentId)report.reportingChanges.push({id:n.id,name:displayName||row.Name,from:old.parentId,to:n.parentId});
  if(old)report.updated.push({id:n.id,row:row.row,name:displayName||row.Name});
 }
 const inScope=new Set(Object.values(scopeHeads).flatMap(h=>[...branches.get(h)]));
 report.retainedUnlisted=[];
 for(const n of nodes){if(!claim.has(n.id)&&inScope.has(n.id)&&n.status==='Filled'){n.needsMapping=true;n.mappingNote=n.namePending?'Unnamed filled position from the earlier chart is not resolved by this workbook. Retained for headcount confirmation.':'Existing employee is absent from the scoped master rows. Retained for confirmation.';if(!n.title||n.title==='Designation not provided'){n.title='';n.designationMissing=true;report.missingDesignations.push({id:n.id,name:n.name||'Name pending',reason:'Existing unresolved CARE position; no designation in the source.'});}report.retainedUnlisted.push({id:n.id,name:n.name||'Name pending',title:n.title});}}
 // The root has a source manager outside this chart; it intentionally remains the root.
 const invalid=validateNodes(nodes);if(invalid)throw Error(invalid);
 if(new Set(nodes.map(n=>n.id)).size!==nodes.length)throw Error('Duplicate chart IDs');
 const ids=nodes.filter(n=>n.status!=='Vacant'&&n.employeeId).map(n=>n.employeeId);if(new Set(ids).size!==ids.length)throw Error('Duplicate employee IDs');
 for(const old of previous.filter(n=>n.status==='Vacant'))if(!nodes.some(n=>n.id===old.id&&n.status==='Vacant'))throw Error('An existing vacancy was lost');
 report.before={positions:total(previous),vacancies:previous.filter(n=>n.status==='Vacant').length};report.after={positions:total(nodes),filled:nodes.filter(n=>n.status==='Filled').length,yetToJoin:nodes.filter(n=>n.status==='Yet to join').length,vacancies:nodes.filter(n=>n.status==='Vacant').length};
 return {nodes,report};
}
