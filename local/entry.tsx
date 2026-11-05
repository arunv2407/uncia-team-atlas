import React from 'react';
import {createRoot} from 'react-dom/client';
import Atlas from '../app/atlas';
import '../app/globals.css';
const nativeFetch=window.fetch.bind(window);
async function start(){const r=await nativeFetch('/auth/me');if(!r.ok){location.replace('/login');return}const me=await r.json() as {mustChange:boolean;csrf:string};if(me.mustChange){location.replace('/account');return}window.fetch=(input,init={})=>{const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.origin);if(url.origin===location.origin&&!['GET','HEAD'].includes((init.method||'GET').toUpperCase())){const headers=new Headers(init.headers);headers.set('X-CSRF-Token',me.csrf);init={...init,headers}}return nativeFetch(input,init)};createRoot(document.getElementById('root')!).render(<Atlas local/>)}
start().catch(()=>{document.getElementById('root')!.textContent='Could not open the app. Reload the page to try again.'});
