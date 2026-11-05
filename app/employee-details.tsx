import type {Person} from './model';
export const employeeFields=['Position','Client Name','Billing','Skills','Skills / Specialisation','Current Location','Base Location','Module','Allocation Type','Remark','Current workload/milestone','Expected availability','Framework Review Remarks'];
export function EmployeeDetails({person}:{person:Person}){
 if(!person.employeeDetails)return null;
 return <><dt>Employee ID</dt><dd>{person.employeeId||'Not supplied'}</dd>{Object.entries(person.employeeDetails).filter(([key,value])=>value&&key!=='Emp id').map(([key,value])=><div className="employee-detail-field" key={key}><dt>{key==='Name'?'Master: name / transfer note':key==='Current Designation'?'Master: current designation':key==='Recommended Designation - Function'?'Master: recommended designation':key==='Reporting Manager'?'Master: reporting manager':key}</dt><dd className="notes-text">{['Total Experience','Uncia Exp'].includes(key)&&Number.isFinite(Number(value))?String(Math.round(Number(value)*100)/100):value}</dd></div>)}</>;
}
export function EmployeeDetailsEditor({person,onChange}:{person:Person;onChange:(person:Person)=>void}){
 return <details className="span2"><summary>Employee details</summary><fieldset className="employee-fields"><legend>Additional information</legend><div className="form-grid"><label className="span2">Employee ID<input value={person.employeeId||''} disabled={person.status==='Vacant'} onChange={e=>onChange({...person,employeeId:e.target.value})}/></label>{employeeFields.map(key=><label className="span2" key={key}>{key}<input value={person.employeeDetails?.[key]||''} onChange={e=>onChange({...person,employeeDetails:{...person.employeeDetails,[key]:e.target.value}})}/></label>)}</div></fieldset></details>;
}
