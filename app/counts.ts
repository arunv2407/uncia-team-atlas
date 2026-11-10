import {descendants,type Person} from './model';
export function positionCounts(rows:Person[]){return rows.reduce((a,n)=>{a.total+=n.count;if(n.status==='Filled')a.filled+=n.count;else if(n.status==='Vacant')a.open+=n.count;else a.joining+=n.count;return a},{total:0,filled:0,open:0,joining:0});}
export function hierarchyCounts(nodes:Person[],id:string,matching?:Set<string>){const own=nodes.find(n=>n.id===id);return positionCounts((own?[own,...descendants(nodes,id)]:[]).filter(n=>!matching||matching.has(n.id)));}
export function functionBreakdown(rows:Person[]){return [...new Set(rows.map(n=>n.team))].sort().map(team=>({team,...positionCounts(rows.filter(n=>n.team===team))}));}
