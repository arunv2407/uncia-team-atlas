export type Person={id:string;parentId:string|null;name:string;title:string;team:string;assignment:string;product?:string;status:'Filled'|'Vacant'|'Yet to join';employment:'Employee'|'Contract'|'Not specified';count:number;experience:string;tenure:string;notes:string;pending?:boolean;pendingMove?:boolean;needsMapping?:boolean;namePending?:boolean;employeeId?:string;employeeDetails?:Record<string,string>;mappingNote?:string;reportingException?:string;designationMissing?:boolean;masterSourceHash?:string;masterRow?:number};
export type Activity={at:string;by:string;action:string;previous?:Person[]};
export function descendants(nodes:Person[],id:string):Person[]{const result:Person[]=[];const visit=(p:string)=>{for(const n of nodes.filter(x=>x.parentId===p)){result.push(n);visit(n.id)}};visit(id);return result;}
export function validateNodes(input:unknown):string|null{
 if(!Array.isArray(input)||input.length<1||input.length>5000)return 'Use between 1 and 5,000 positions.';
 const nodes=input as Person[];const ids=new Set<string>();
 for(const n of nodes){if(!n||typeof n.id!=='string'||n.id.length>100||!n.id||ids.has(n.id))return 'Position IDs must be unique.';ids.add(n.id);for(const k of ['name','title','team','assignment','experience','tenure','notes'] as const)if(typeof n[k]!=='string'||n[k].length>3000)return 'Invalid text field.';if((!n.title.trim()&&n.designationMissing!==true)||!['Filled','Vacant','Yet to join'].includes(n.status)||!['Employee','Contract','Not specified'].includes(n.employment)||!Number.isInteger(n.count)||n.count<1||n.count>10000)return 'Check designation, status and headcount.';if(n.status!=='Vacant'&&!n.name.trim()&&n.namePending!==true)return 'Filled positions need a name or group label.';if(n.parentId!==null&&typeof n.parentId!=='string')return 'Invalid reporting relationship.';}
 for(const n of nodes){if(n.product!==undefined&&(typeof n.product!=='string'||n.product.length>100))return 'Invalid product.';if(n.namePending!==undefined&&typeof n.namePending!=='boolean')return 'Invalid name-pending flag.';if(n.employeeId!==undefined&&(typeof n.employeeId!=='string'||n.employeeId.length>100))return 'Invalid employee ID.';if(n.reportingException!==undefined&&(typeof n.reportingException!=='string'||n.reportingException.length>3000))return 'Invalid reporting exception.';if(n.mappingNote!==undefined&&(typeof n.mappingNote!=='string'||n.mappingNote.length>3000))return 'Invalid mapping note.';if(n.employeeDetails!==undefined&&(!n.employeeDetails||Array.isArray(n.employeeDetails)||typeof n.employeeDetails!=='object'||Object.keys(n.employeeDetails).length>40||Object.entries(n.employeeDetails).some(([k,v])=>k.length>100||typeof v!=='string'||v.length>3000)))return 'Invalid employee details.';}
 const employeeIds=nodes.filter(n=>n.status!=='Vacant'&&n.employeeId?.trim()).map(n=>n.employeeId!.trim().toLowerCase());if(new Set(employeeIds).size!==employeeIds.length)return 'Employee IDs must be unique.';
 const root=nodes.find(n=>n.id==='sagar');if(!root||root.parentId!==null||root.name!=='Sagar'||root.count!==1||root.status!=='Filled')return 'Sagar must remain the head of this chart.';
 const map=new Map(nodes.map(n=>[n.id,n]));for(const n of nodes){if(n.id!=='sagar'&&(!n.parentId||!ids.has(n.parentId)))return 'Every position must report to someone in the chart.';const visited=new Set<string>();let cur:Person|undefined=n;while(cur){if(visited.has(cur.id))return 'This reporting change would create a circular hierarchy.';visited.add(cur.id);cur=cur.parentId?map.get(cur.parentId):undefined;}}
 return null;
}

export function expandUnnamedResources(nodes:Person[]):Person[]{
 const unnamed=(n:Person)=>n.namePending===true||n.status==='Vacant'||/ group$/i.test(n.name)||n.id==='care-unallocated-filled';
 const expected=nodes.reduce((sum,n)=>sum+(unnamed(n)?n.count:1),0);if(expected>5000)throw Error('Splitting these counts would exceed 5,000 individual entries.');
 const ids=new Set(nodes.map(n=>n.id));const result:Person[]=[];
 for(const n of nodes){if(!unnamed(n)){result.push(n);continue}if(n.count>1&&nodes.some(p=>p.parentId===n.id))throw Error('An unnamed group with reports needs its reporting relationships resolved before splitting.');
  for(let i=1;i<=n.count;i++){const id=i===1?n.id:n.id.slice(0,80)+'-slot-'+i;if(i>1&&ids.has(id))throw Error('An individual entry ID already exists. Refresh the chart before splitting.');ids.add(id);result.push({...n,id,name:'',namePending:true,count:1});}
 }
 return result;
}
