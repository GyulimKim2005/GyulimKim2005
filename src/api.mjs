import {randomUUID} from 'node:crypto';
import {authenticated,configured,verifyKey,sessionCookie,clearCookie} from './auth.mjs';
import {ConflictError,normalizeContent} from './store.mjs';
import {discover,discoveryReady} from './discovery.mjs';
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
class InputError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const clean=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new InputError('필수 항목과 글자 수를 확인해 주세요.');return value.trim();};
function tags(value){if(!Array.isArray(value)||value.length>12)throw new InputError('태그는 12개까지 입력할 수 있어요.');return value.map(s=>clean(s,40,true));}
function ids(value=[]){if(!Array.isArray(value)||value.length>100||value.some(id=>typeof id!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(id)))throw new InputError('연결할 글을 확인해 주세요.');return [...new Set(value)];}
function link(value,required=false){const s=clean(value??'',2048,required);if(!s&&!required)return '';try{const url=new URL(s);if(['http:','https:'].includes(url.protocol))return url.href;}catch{}throw new InputError('http:// 또는 https://로 시작하는 주소를 입력해 주세요.');}
function validate(kind,input){
  if(kind==='profile')return {name:clean(input.name,80,true),affiliation:clean(input.affiliation,150),bio:clean(input.bio,2000),interests:tags(input.interests),photoUrl:link(input.photoUrl),interestsText:clean(input.interestsText??'',10000),cv:clean(input.cv??'',20000),cvUrl:link(input.cvUrl)};
  if(kind==='projects')return {title:clean(input.title,150,true),description:clean(input.description,1000),url:link(input.url,true),label:clean(input.label,40)||'WEBSITE'};
  if(kind==='library'){
    if(!['paper','article','book'].includes(input.type)||!['study','leisure'].includes(input.purpose))throw new InputError('자료 종류와 읽기 목적을 선택해 주세요.');
    return {title:clean(input.title,200,true),creator:clean(input.creator??'',200),type:input.type,purpose:input.purpose,review:clean(input.review??'',5000),url:link(input.url,true),entryIds:ids(input.entryIds),tags:tags(input.tags??[])};
  }
  if(kind==='topics')return {title:clean(input.title,60,true),note:clean(input.note??'',3000),parentId:input.parentId?ids([input.parentId])[0]:'',entryIds:ids(input.entryIds)};
  if(kind==='cvitems'){
    if(!['education','research','experience','award','skill'].includes(input.section))throw new InputError('이력 분류를 선택해 주세요.');
    return {section:input.section,title:clean(input.title,200,true),subtitle:clean(input.subtitle??'',200),period:clean(input.period??'',100),body:clean(input.body??'',5000),url:link(input.url),order:Number.isFinite(Number(input.order))?Math.max(-9999,Math.min(9999,Number(input.order))):0};
  }
  if(!['study','reading','publication','thoughts','daily'].includes(input.category))throw new InputError('기록 분류를 선택해 주세요.');
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
export async function handleApi(request,{env={},store,fetchImpl=fetch}){
  try{
    const path=new URL(request.url).pathname,method=request.method,owner=authenticated(request,env);
    if(path==='/api/session'&&method==='GET')return json({canEdit:owner,loginReady:configured(env),local:env.DEV_LOCAL===true,aiReady:owner&&discoveryReady(env)});
    if(path==='/api/discover'&&method==='POST'){
      if(!owner)return json({error:'AI 웹 검색은 관리자만 사용할 수 있어요.'},403);
      const input=await inputOf(request);const query=clean(input.query,500,true);
      return json(await discover({query,type:input.type,purpose:input.purpose,env,store,fetchImpl}));
    }
    if(path==='/api/login'&&method==='POST'){
      const input=await inputOf(request);if(!configured(env))return json({error:'관리자 로그인이 아직 연결되지 않았어요.'},503);
      if(!verifyKey(input.key,env))return json({error:'로그인 키를 확인해 주세요.'},401);
      return json({canEdit:true},200,{'Set-Cookie':sessionCookie(env)});
    }
    if(path==='/api/logout'&&method==='POST'){await inputOf(request);return json({ok:true},200,{'Set-Cookie':clearCookie});}
    if(path==='/api/content'&&method==='GET'){
      const snapshot=await store.read(),data=normalizeContent(snapshot.data);data.entries.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));data.projects.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));delete data.aiUsage;return json(data);
    }
    const match=/^\/api\/(entries|projects|library|topics|cvitems)\/([a-zA-Z0-9-]{1,80})$/.exec(path);
    if(path!=='/api/profile'&&!match)return json({error:'찾을 수 없는 주소입니다.'},404);
    if(!owner)return json({error:'관리자 로그인이 필요해요.'},403);
    if(!['PUT','DELETE'].includes(method)||(path==='/api/profile'&&method!=='PUT'))return json({error:'지원하지 않는 요청입니다.'},405);
    const input=await inputOf(request),snapshot=await store.read(),data=normalizeContent(snapshot.data);
    if(path==='/api/profile'){
      if(data.profile.revision!==(input.revision??null))throw new ConflictError();
      data.profile={...validate('profile',input),revision:randomUUID()};await store.write(data,snapshot.version);return json(data.profile);
    }
    const [,kind,id]=match,index=data[kind].findIndex(item=>item.id===id),old=data[kind][index];
    if(old&&old.revision!==input.revision)throw new ConflictError();
    if(!old&&input.revision)throw new InputError('이미 삭제된 항목이에요. 내용을 복사한 뒤 새 기록으로 저장해 주세요.',409);
    if(method==='DELETE'){
      if(index<0)return json({ok:true});data[kind].splice(index,1);
      if(kind==='entries')for(const item of [...data.library,...data.topics])if(item.entryIds.includes(id)){item.entryIds=item.entryIds.filter(ref=>ref!==id);item.revision=randomUUID();}
      if(kind==='topics')for(const item of data.topics)if(item.parentId===id){item.parentId=old.parentId;item.revision=randomUUID();}
      await store.write(data,snapshot.version);return json({ok:true});
    }
    const value={...validate(kind,input),id,createdAt:old?.createdAt||new Date().toISOString(),revision:randomUUID()};
    if(value.entryIds?.some(ref=>!data.entries.some(entry=>entry.id===ref)))throw new InputError('연결하려는 기록이 삭제되었어요. 새로고침해 주세요.',409);
    if(kind==='topics'){
      if(value.parentId&&!data.topics.some(topic=>topic.id===value.parentId))throw new InputError('상위 관심사를 찾을 수 없어요.',409);
      const seen=new Set([id]);let parent=value.parentId;
      while(parent){if(seen.has(parent))throw new InputError('관심사를 자기 자신이나 하위 관심사에 연결할 수 없어요.');seen.add(parent);parent=data.topics.find(topic=>topic.id===parent)?.parentId;}
      if(!old&&data.topics.length>=100)throw new InputError('관심사는 100개까지 등록할 수 있어요.');
    }
    if(index<0)data[kind].push(value);else data[kind][index]=value;
    await store.write(data,snapshot.version);return json(value);
  }catch(error){if(error.status)return json({error:error.message},error.status);console.error('archive_request_failed',error.name);return json({error:'저장소에 연결하지 못했어요. 작성한 내용은 유지되니 잠시 후 다시 시도해 주세요.'},503);}
}
