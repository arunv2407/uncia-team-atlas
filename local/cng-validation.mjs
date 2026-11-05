import {descendants,validateNodes} from '../local-dist/model.mjs';
export const cngNamedRoles=[
 ['guna','Gunasekaran Sundaram','Chief Customer Officer'],
 ['sasi','Sasi Kumar S','Senior Product Manager'],
 ['nitheish','Nitheish Kumar','Lead Software Engineer'],
 ['rajaselvam','Rajaselvam M','Lead Software Engineer'],
 ['dillip','Dillip M','Senior Product Manager'],
 ['kaushal','Kaushal G','Senior Product Manager'],
 ['sai','Sai Gandhi G','Principal Solution Architect'],
 ['bhuvan','Bhuvaneshwar S','Senior Software Engineer'],
 ['sam','Sam Godson M','Senior Software Engineer'],
 ['muthu','Muthumanikandan M','Solution Architect'],
 ['govind','Govindaraj V','Senior Product Support Engineer'],
];
export const cngSource='Validated against CNG Org Strcuture.jpg supplied 2 November 2026 (Care, Nurture & Grow - Nov 2026). Only explicitly named leader designations and reporting links are used; unnamed designation counts are not assigned to existing named individuals without evidence.';
export function reconcileNamedCng(previous){const nodes=structuredClone(previous),changes=[];const get=id=>{const n=nodes.find(n=>n.id===id);if(!n)throw Error('Expected existing CNG record '+id);return n};
 for(const [id,name,title] of cngNamedRoles){const person=get(id);if(person.name!==name)throw Error('Name mismatch for '+id);if(person.title!==title){changes.push({id,name,from:person.title,to:title});person.notes=[person.notes,cngSource,'Prior designation: '+person.title+'. The supplied screenshot explicitly identifies this person as '+title+'.'].filter(Boolean).join('\n');person.title=title;}}
 const links=[['guna','sagar'],['karthik','guna'],['sasi','guna'],['nitheish','sasi'],['rajaselvam','sasi'],['dillip','guna'],['sathishraj','dillip'],['kaushal','guna'],['sai','guna'],['bhuvan','sai'],['sam','guna'],['muthu','guna'],['govind','karthik']];
 for(const [id,parent] of links){const n=get(id);if(n.parentId!==parent){changes.push({id,name:n.name,reportingFrom:n.parentId,reportingTo:parent});n.parentId=parent;}}
 const summary='CNG screenshot snapshot: 83 positions (71 filled, 12 TBH), including CARE 20 (11 filled, 9 TBH). The separately supplied detailed CARE screenshot is retained at 27 positions (16 filled including 4 pending moves, 2 yet to join, 9 TBH). Current CNG view therefore has 86 positions (72 filled, 2 yet to join, 12 vacancies). CHOLA currently has 14 versus screenshot 17 because three pending-move people are shown under CARE; CANFIN has 14 versus 15 because Praveen AB is retained in his detailed CARE leadership role. These cross-snapshot differences are flagged, not fixed by deleting or duplicating people. CARE detail and six mapping-pending named records are retained.';
 get('guna').notes=[get('guna').notes,cngSource,summary].filter(Boolean).join('\n');get('guna').pending=true;
 get('karthik').notes=[get('karthik').notes,'CNG validation: Karthik reports directly to Gunasekaran, who reports to Sagar. The detailed CARE structure (27 positions) is retained instead of the conflicting 20-position CNG overview snapshot.'].filter(Boolean).join('\n');
 get('govind').notes=[get('govind').notes,'CNG validation confirms designation Senior Product Support Engineer and reporting to Karthik. The mapping flag remains because reconciliation with the detailed CARE product/assignment structure is not yet confirmed.'].filter(Boolean).join('\n');
 const invalid=validateNodes(nodes);if(invalid)throw Error(invalid);return {nodes,changes,links,summary};}
export function cngCounts(nodes){const get=id=>nodes.find(n=>n.id===id);const group=ids=>{const list=ids.flatMap(id=>[get(id),...descendants(nodes,id)]).filter(Boolean);return {filled:list.filter(n=>n.status==='Filled').reduce((a,n)=>a+n.count,0),yetToJoin:list.filter(n=>n.status==='Yet to join').reduce((a,n)=>a+n.count,0),vacancies:list.filter(n=>n.status==='Vacant').reduce((a,n)=>a+n.count,0),total:list.reduce((a,n)=>a+n.count,0)}};return {CNG:group(['guna']),CHOLA:group(['sasi']),CANFIN:group(['dillip']),ICICI:group(['kaushal']),TVSCredit:group(['sai','sam','muthu']),CARE:group(['karthik']),NurtureAndGrowth:group(nodes.filter(n=>n.parentId==='guna'&&n.status==='Vacant'&&n.title==='Lead Account Manager').map(n=>n.id))};}
