import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
const WEEK=604800;
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const configured=env=>/^[a-f0-9]{64}$/.test(env.ADMIN_KEY_HASH||'')&&(env.SESSION_SECRET||'').length>=32;
export const verifyKey=(key,env)=>configured(env)&&typeof key==='string'&&key.length<=256&&equal(digest(key),env.ADMIN_KEY_HASH);
const sign=(payload,env)=>createHmac('sha256',env.SESSION_SECRET).update(payload).digest('base64url');
export function sessionCookie(env,now=Date.now()){
  const payload=Buffer.from(JSON.stringify({role:'owner',exp:Math.floor(now/1000)+WEEK})).toString('base64url');
  return `archive_session=${payload}.${sign(payload,env)}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${WEEK}`;
}
export function authenticated(request,env,now=Date.now()){
  if(env.DEV_LOCAL===true)return true;
  if(!configured(env))return false;
  const cookie=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('archive_session='));
  if(!cookie)return false;
  const [payload,signed,extra]=cookie.slice(16).split('.');
  if(!payload||!signed||extra||!equal(sign(payload,env),signed))return false;
  try{const data=JSON.parse(Buffer.from(payload,'base64url').toString());const time=Math.floor(now/1000);return data.role==='owner'&&Number.isInteger(data.exp)&&data.exp>time&&data.exp<=time+WEEK;}catch{return false;}
}
export const clearCookie='archive_session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0';
