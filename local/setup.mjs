import {createApp} from './server.mjs';
console.log('Ready for account setup JSON on stdin (input is hidden).');
const wasRaw=process.stdin.isRaw;if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdin.resume();
const input=await new Promise((resolve,reject)=>{let text='';const listener=chunk=>{text+=chunk.toString();if(text.includes('\u0003')){reject(Error('Cancelled'));return}if(text.includes('\n')||text.includes('\r')){process.stdin.off('data',listener);resolve(text.trim())}};process.stdin.on('data',listener)});
if(process.stdin.isTTY)process.stdin.setRawMode(!!wasRaw);process.stdin.pause();
const accounts=JSON.parse(input);const app=await createApp({bootstrap:accounts});
console.log('Accounts configured. Only salted password hashes were stored. Existing chart data was retained.');app.db.close();
