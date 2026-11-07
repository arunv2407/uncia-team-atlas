import type {Person} from './model';
export const choiceFields=['Function','Client Name','Position','Billing','Skills','Skills / Specialisation','Current Location','Base Location','Module','Allocation Type','Remark','Current workload/milestone','Expected availability'] as const;
export type ChoiceField=typeof choiceFields[number];
export type FieldChoices=Record<string,string[]>;
export function displayChoice(field:string,value:string):string{if(field==='Expected availability'&&/^\d{5}(\.\d+)?$/.test(value)&&Number(value)>20000&&Number(value)<80000)return new Date(Date.UTC(1899,11,30)+Math.floor(Number(value))*86400000).toISOString().slice(0,10);return value;}
export function choiceValue(person:Person,field:string):string{return field==='Function'?person.team:field==='Client Name'?person.assignment:person.employeeDetails?.[field]||'';}
export function withChoice(person:Person,field:string,value:string):Person{return field==='Function'?{...person,team:value}:field==='Client Name'?{...person,assignment:value,employeeDetails:{...person.employeeDetails,'Client Name':value}}:{...person,employeeDetails:{...person.employeeDetails,[field]:value}};}
