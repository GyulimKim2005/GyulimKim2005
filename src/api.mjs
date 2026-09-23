import {randomUUID} from 'node:crypto';
import {authenticated,configured,verifyKey,sessionCookie,clearCookie} from './auth.mjs';
import {ConflictError} from './store.mjs';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
class InputError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const clean=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new InputError('필수 항목과 글자 수를 확인해 주세요.');return value.trim();};
function tags(value){if(!Array.isArray(value)||value.length>12)throw new InputError('태그는 12개까지 입력할 수 있어요.');return value.map(s=>clean(s,40,true));}
function link(value,required=false){const s=clean(value??'',2048,required);if(!s&&!required)return '';try{const url=new URL(s);if(['http:','https:'].includes(url.protocol))return url.href;}catch{}throw new InputError('http:// 또는 https://로 시작하는 주소를 입력해 주세요.');}
function validate(kind,input){
  if(kind==='profile')return {name:clean(input.name,80,true),affiliation:clean(input.affiliation,150),bio:clean(input.bio,2000),interests:tags(input.interests)};
  if(kind==='projects')return {title:clean(input.title,150,true),description:clean(input.description,1000),url:link(input.url,true),label:clean(input.label,40)||'WEBSITE'};
  if(!['study','reading','publication'].includes(input.category))throw new InputError('기록 분류를 선택해 주세요.');
  if(typeof input.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)throw new InputError('기록 날짜를 확인해 주세요.');
  return {category:input.category,title:clean(input.title,200,true),summary:clean(input.summary,500),body:clean(input.body,100000,true),tags:tags(input.tags),sourceUrl:link(input.sourceUrl),date:input.date};
}
async function inputOf(request){
  if(request.headers.get('X-Archive-Request')!=='1'||!(request.headers.get('Content-Type')||'').startsWith('application/json'))throw new InputError('올바르지 않은 요청입니다.',403);
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)throw new InputError('허용되지 않은 요청입니다.',403);
  if(Number(request.headers.get('Content-Length')||0)>500000)throw new InputError('내용이 너무 깁니다.',413);
  const raw=await request.text();if(raw.length>150000)throw new InputError('내용이 너무 깁니다.',413);
  let input;try{input=JSON.parse(raw);}catch{throw new InputError('입력 내용을 읽을 수 없어요.');}
  if(!input||typeof input!=='object'||Array.isArray(input))throw new InputError('입력 내용을 확인해 주세요.');return input;
}
export async function handleApi(request,{env={},store}){
  try{
    const path=new URL(request.url).pathname,method=request.method,owner=authenticated(request,env);
    if(path==='/api/session'&&method==='GET')return json({canEdit:owner,loginReady:configured(env),local:env.DEV_LOCAL===true});
    if(path==='/api/login'&&method==='POST'){
      const input=await inputOf(request);if(!configured(env))return json({error:'관리자 로그인이 아직 연결되지 않았어요.'},503);
      if(!verifyKey(input.key,env))return json({error:'로그인 키를 확인해 주세요.'},401);
      return json({canEdit:true},200,{'Set-Cookie':sessionCookie(env)});
    }
    if(path==='/api/logout'&&method==='POST'){await inputOf(request);return json({ok:true},200,{'Set-Cookie':clearCookie});}
    if(path==='/api/content'&&method==='GET'){
      const {data}=await store.read();data.entries.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));data.projects.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return json(data);
    }
    const match=/^\/api\/(entries|projects)\/([a-zA-Z0-9-]{1,80})$/.exec(path);
    if(path!=='/api/profile'&&!match)return json({error:'찾을 수 없는 주소입니다.'},404);
    if(!owner)return json({error:'관리자 로그인이 필요해요.'},403);
    if(!['PUT','DELETE'].includes(method)||(path==='/api/profile'&&method!=='PUT'))return json({error:'지원하지 않는 요청입니다.'},405);
    const input=await inputOf(request),snapshot=await store.read(),data=snapshot.data;
    if(path==='/api/profile'){
      if(data.profile.revision!==(input.revision??null))throw new ConflictError();
      data.profile={...validate('profile',input),revision:randomUUID()};await store.write(data,snapshot.version);return json(data.profile);
    }
    const [,kind,id]=match,index=data[kind].findIndex(item=>item.id===id),old=data[kind][index];
    if(old&&old.revision!==input.revision)throw new ConflictError();
    if(!old&&input.revision)throw new InputError('이미 삭제된 항목이에요. 내용을 복사한 뒤 새 기록으로 저장해 주세요.',409);
    if(method==='DELETE'){if(index<0)return json({ok:true});data[kind].splice(index,1);await store.write(data,snapshot.version);return json({ok:true});}
    const value={...validate(kind,input),id,createdAt:old?.createdAt||new Date().toISOString(),revision:randomUUID()};
    if(index<0)data[kind].push(value);else data[kind][index]=value;
    await store.write(data,snapshot.version);return json(value);
  }catch(error){if(error.status)return json({error:error.message},error.status);console.error('archive_request_failed',error.name);return json({error:'저장소에 연결하지 못했어요. 작성한 내용은 유지되니 잠시 후 다시 시도해 주세요.'},503);}
}
