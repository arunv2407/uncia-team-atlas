import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const options={N:65536,r:8,p:2,maxmem:128*1024*1024};
export const token=()=>randomBytes(32).toString('base64url');
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const passwordError=p=>typeof p!=='string'||p.length<14||p.length>128?'Use a password of 14–128 characters.':null;
export async function hashPassword(password){const salt=randomBytes(24).toString('hex');const key=await scrypt(password,salt,64,options);return `scrypt$65536$8$2$${salt}$${key.toString('hex')}`;}
export async function verifyPassword(password,encoded){try{const [type,N,r,p,salt,key]=encoded.split('$');if(type!=='scrypt'||N!=='65536'||r!=='8'||p!=='2'||!salt||!key)return false;const expected=Buffer.from(key,'hex');const actual=await scrypt(password,salt,64,options);return expected.length===actual.length&&timingSafeEqual(expected,actual)}catch{return false}}
export function safeEqual(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
