import {validateNodes} from '../local-dist/model.mjs';
import {cleanName} from './employee-master.mjs';

const functions=new Set(['golive','quality assurance','golive & qa']);
const normal=value=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
export function employeeIdentity(name,explicitId=''){
 const suffix=name.match(/\s+(?:[-–]\s*)?[([]?((?:TR|E|C)\d+)[)\]]?\s*$/i);
 const supplied=/^(?:TR|E|C)\d+$/i.test(explicitId.trim())?explicitId.trim().toUpperCase():'';
 const embedded=suffix?.[1].toUpperCase()||'';
 if(supplied&&embedded&&supplied!==embedded)throw Error('Conflicting employee IDs for '+name);
 return {name:cleanName(suffix?name.slice(0,suffix.index):name),employeeId:supplied||embedded};
}
const recommended=row=>(row['Recommended Designation - Function']||'').replace(/\s+-\s+(?:GoLive|QA|Leadership)$/i,'').trim();
const years=value=>Number.isFinite(Number(value))?String(Math.round(Number(value)*100)/100):value;
export function reconcileSatishTeam(previous,source){
 const rows=source.rows.filter(r=>functions.has(r.Function.trim().toLowerCase()));
 if(!rows.length)throw Error('No Satish-team functions in the master.');
 const nodes=structuredClone(previous),rowNodes=new Map(),claimed=new Set(),report={source:source.source,sha256:source.sha256,rows:rows.length,added:[],reportingChanges:[],pendingEmployeeIds:[],preservedDesignations:[],managers:[],nameSuffixIds:[]};
 const byName=name=>nodes.filter(n=>n.name&&!n.namePending&&normal(employeeIdentity(n.name).name)===normal(name));
 for(const row of rows){const identity=employeeIdentity(row.Name,row['Emp id']);let matches=identity.employeeId?nodes.filter(n=>n.employeeId?.toUpperCase()===identity.employeeId):[];
  if(!matches.length)matches=byName(identity.name);if(matches.length>1)throw Error('Ambiguous employee '+row.Name);
  let n=matches[0];if(!n){if(/^TBH\b/i.test(row.Name))throw Error('A new team vacancy needs explicit reconciliation.');n={id:identity.employeeId?'employee-'+identity.employeeId.toLowerCase():'team-person-'+normal(identity.name),parentId:'satish',name:identity.name,title:row['Current Designation']||recommended(row),team:row.Function,assignment:'',product:'',status:'Filled',employment:'Not specified',count:1,experience:'',tenure:'',notes:''};if(nodes.some(p=>p.id===n.id))throw Error('Position ID collision');nodes.push(n);report.added.push({id:n.id,name:n.name});}
  if(claimed.has(n.id))throw Error('Two source rows match '+row.Name);claimed.add(n.id);rowNodes.set(row.row,n);
  if(identity.employeeId&&n.employeeId&&identity.employeeId!==n.employeeId.toUpperCase())throw Error('Employee ID conflicts with existing record for '+n.name);
  const oldName=n.name;n.name=n.id==='sagar'?'Sagar':identity.name;n.employeeId=identity.employeeId||n.employeeId||'';
  if(oldName!==n.name&&identity.employeeId)report.nameSuffixIds.push({id:n.id,name:n.name,employeeId:n.employeeId});
  if(!n.employeeId&&!/^TBH\b/i.test(row.Name))report.pendingEmployeeIds.push({id:n.id,name:n.name,sourceId:row['Emp id']});
 }
 const managerAliases=new Map([['aylwint','Aylwin Titus']]);
 for(const row of rows){const n=rowNodes.get(row.row),old=previous.find(p=>p.id===n.id);let parentId=null;
  if(n.id!=='sagar'){
   const identity=employeeIdentity(row['Reporting Manager']);const canonical=managerAliases.get(normal(identity.name))||identity.name;
   let managers=identity.employeeId?nodes.filter(p=>p.employeeId?.toUpperCase()===identity.employeeId):[];
   if(!managers.length)managers=byName(canonical);if(managers.length!==1)throw Error('Unresolved or ambiguous manager '+row['Reporting Manager']+' for '+n.name);
   parentId=managers[0].id;if(parentId===n.id)throw Error('Self-reporting for '+n.name);
  }
  n.parentId=parentId;n.team=row.Function;n.namePending=false;n.needsMapping=false;n.mappingNote='';n.masterSourceHash=source.sha256;n.masterRow=row.row;
  if(row['Emp id'].trim().toUpperCase()==='NJ')n.status='Yet to join';
  if(!n.title){n.title=row['Current Designation']||recommended(row);n.designationMissing=!n.title;}
  if(old?.title&&row['Current Designation']&&old.title!==row['Current Designation'])report.preservedDesignations.push({name:n.name,title:old.title,sourceTitle:row['Current Designation']});
  if(row.Position)n.employment=row.Position.toLowerCase()==='contract'?'Contract':'Employee';
  if(row['Total Experience'])n.experience=years(row['Total Experience']);if(row['Uncia Exp'])n.tenure=years(row['Uncia Exp']);
  if(row.Module)n.product=row.Module;if(row['Client Name'])n.assignment=row['Client Name'];
  n.employeeDetails=Object.fromEntries(Object.entries(row).filter(([k,v])=>!['row','#'].includes(k)&&v!==''));n.employeeDetails.Name=n.name;n.employeeDetails['Emp id']=n.employeeId;
  n.employeeDetails.Source=`${source.source} · ${source.sheet} · row ${row.row}`;
  if(!n.employeeId)n.employeeDetails['Employee ID status']='Pending — no unique employee ID supplied in the master.';
  if(old&&old.parentId!==parentId)report.reportingChanges.push({name:n.name,from:old.parentId,to:parentId});
  report.managers.push({row:row.row,id:n.id,name:n.name,parentId,sourceManager:row['Reporting Manager']});
 }
 const invalid=validateNodes(nodes);if(invalid)throw Error(invalid);
 for(const old of previous){const n=nodes.find(n=>n.id===old.id);if(!n)throw Error('Existing position lost');if(!claimed.has(old.id)&&JSON.stringify(n)!==JSON.stringify(old))throw Error('Unrelated record modified');const pendingJoiner=rows.some(r=>rowNodes.get(r.row)?.id===n.id&&r['Emp id'].trim().toUpperCase()==='NJ');if((old.status!==n.status&&!pendingJoiner)||old.count!==n.count)throw Error('Existing status or headcount changed');if(old.title&&n.title!==old.title)throw Error('Existing designation changed');}
 for(const n of nodes.filter(n=>claimed.has(n.id)&&n.id!=='sagar')){let current=n;const visited=new Set();while(current?.parentId){if(visited.has(current.id))throw Error('Reporting cycle');visited.add(current.id);current=nodes.find(p=>p.id===current.parentId);}if(current?.id!=='sagar')throw Error('Team is disconnected from Sagar');}
 const sourceSagarExceptions=report.managers.filter(m=>m.parentId==='sagar'&&m.id!=='satish').map(m=>m.name);report.directToSagar=sourceSagarExceptions;report.positions=nodes.length;report.openPositions=nodes.filter(n=>n.status==='Vacant').length;
 return {nodes,report};
}
