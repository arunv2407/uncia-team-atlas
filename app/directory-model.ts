import {displayChoice} from './choices';
import type {Person} from './model';
export type DirectoryColumn={id:string;label:string;value:(person:Person)=>string};
export type ColumnFilters=Record<string,string[]>;
export const defaultColumns=['name','employeeId','title','reportsTo','function','product','assignment','status','employment','count'];
export function directoryColumns(nodes:Person[]):DirectoryColumn[]{const byId=new Map(nodes.map(n=>[n.id,n]));const columns:DirectoryColumn[]=[
 {id:'name',label:'Name / position',value:n=>n.name||(n.status==='Vacant'?'To be hired':'Name pending')},
 {id:'employeeId',label:'Employee ID',value:n=>n.employeeId||''},{id:'title',label:'Designation',value:n=>n.title},
 {id:'reportsTo',label:'Reports to',value:n=>byId.get(n.parentId||'')?.name||''},{id:'function',label:'Function',value:n=>n.team},
 {id:'product',label:'Product/Assignment',value:n=>n.product||''},{id:'assignment',label:'Client / project notes',value:n=>n.assignment},
 {id:'status',label:'Status',value:n=>n.status==='Vacant'?'Vacant / To be hired':n.status==='Yet to join'?'Pending joining':'Filled'},
 {id:'employment',label:'Employment',value:n=>n.employment},{id:'count',label:'Count',value:n=>String(n.count)},
 {id:'experience',label:'Experience (years)',value:n=>n.experience},{id:'tenure',label:'UNCIA experience (years)',value:n=>n.tenure},
 ];
 const keys=[...new Set(nodes.flatMap(n=>Object.keys(n.employeeDetails||{})))].filter(k=>!['Name','Emp id','Function','Client Name','Total Experience','Uncia Exp'].includes(k));
 for(const key of keys)columns.push({id:'detail:'+key,label:['Current Designation','Recommended Designation - Function','Reporting Manager'].includes(key)?'Master: '+key:key,value:n=>displayChoice(key,n.employeeDetails?.[key]||'')});
 columns.push({id:'mapping',label:'Mapping / confirmation',value:n=>n.mappingNote|| (n.needsMapping?'Mapping to confirm':'')});return columns;
}
export function filterDirectory(rows:Person[],columns:DirectoryColumn[],filters:ColumnFilters):Person[]{return rows.filter(n=>Object.entries(filters).every(([id,values])=>{const column=columns.find(c=>c.id===id);return !column||values.includes(column.value(n));}));}
export function columnValues(rows:Person[],column:DirectoryColumn):string[]{return [...new Set(rows.map(column.value))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));}
