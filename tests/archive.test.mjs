import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleApi} from '../src/api.mjs';
import {digest,sessionCookie} from '../src/auth.mjs';
import {initialContent} from '../src/store.mjs';
import {fileStore} from '../scripts/file-store.mjs';
const env={ADMIN_KEY_HASH:digest('test-only-admin-key'),SESSION_SECRET:'test-only-session-secret-at-least-32-characters'};
const cookie=sessionCookie(env).split(';')[0];
const entry={category:'study',title:'테스트 기록',summary:'저장 테스트',body:'본문\n두 번째 줄',date:'2026-09-23',tags:['CS'],sourceUrl:'https://example.org/paper',revision:null};
async function setup(t){const dir=await mkdtemp(join(tmpdir(),'gyulim-archive-test-'));const file=join(dir,'content.json');t.after(async()=>{await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(dir);});return {file,store:fileStore(file)};}
function request(path,method='GET',body,options={}){
  const headers={...(body?{'Content-Type':'application/json','X-Archive-Request':'1'}:{}),...(options.owner?{Cookie:cookie}:{}),...options.headers};
  return new Request('https://archive.test'+path,{method,headers,body:body?JSON.stringify(body):undefined});
}
test('public reads are empty and unauthenticated mutations are rejected',async t=>{
  const {store}=await setup(t);const context={env,store};
  const content=await handleApi(request('/api/content'),context);assert.equal(content.status,200);assert.deepEqual((await content.json()).entries,[]);
  const denied=await handleApi(request('/api/entries/test','PUT',entry),context);assert.equal(denied.status,403);
  const spoof=await handleApi(request('/api/entries/test','PUT',entry,{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.org'}}),context);assert.equal(spoof.status,403);
});
test('login, signed session, expiry, tampering and logout',async t=>{
  const {store}=await setup(t);const context={env,store};
  const wrong=await handleApi(request('/api/login','POST',{key:'wrong'}),context);assert.equal(wrong.status,401);
  const good=await handleApi(request('/api/login','POST',{key:'test-only-admin-key'}),context);assert.equal(good.status,200);const header=good.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);
  const session=await handleApi(request('/api/session','GET',undefined,{headers:{Cookie:header.split(';')[0]}}),context);assert.equal((await session.json()).canEdit,true);
  const altered=await handleApi(request('/api/session','GET',undefined,{headers:{Cookie:cookie+'x'}}),context);assert.equal((await altered.json()).canEdit,false);
  const expired=sessionCookie(env,Date.now()-604801000).split(';')[0];const gone=await handleApi(request('/api/session','GET',undefined,{headers:{Cookie:expired}}),context);assert.equal((await gone.json()).canEdit,false);
  const logout=await handleApi(request('/api/logout','POST',{}, {owner:true}),context);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
});
test('record creation, reopen persistence, update conflict and deletion',async t=>{
  const {store,file}=await setup(t);const context={env,store};
  const made=await handleApi(request('/api/entries/record-one','PUT',entry,{owner:true}),context);assert.equal(made.status,200);const first=await made.json();
  const reopened=await fileStore(file).read();assert.equal(reopened.data.entries[0].body,entry.body);
  const changed=await handleApi(request('/api/entries/record-one','PUT',{...first,title:'수정된 제목'},{owner:true}),context);assert.equal(changed.status,200);const second=await changed.json();
  const stale=await handleApi(request('/api/entries/record-one','PUT',{...first,title:'오래된 편집'},{owner:true}),context);assert.equal(stale.status,409);
  const deleted=await handleApi(request('/api/entries/record-one','DELETE',{revision:second.revision},{owner:true}),context);assert.equal(deleted.status,200);assert.equal((await store.read()).data.entries.length,0);
});
test('all record categories, profile and website CRUD',async t=>{
  const {store}=await setup(t),context={env,store};
  for(const category of ['study','reading','publication']){const response=await handleApi(request('/api/entries/'+category,'PUT',{...entry,category},{owner:true}),context);assert.equal(response.status,200);}
  const profile=await handleApi(request('/api/profile','PUT',{...initialContent().profile,name:'Edited name',interests:['systems']},{owner:true}),context);assert.equal(profile.status,200);
  const project={title:'My site',description:'소개',url:'https://example.org',label:'WEBSITE',revision:null};
  const created=await handleApi(request('/api/projects/site-one','PUT',project,{owner:true}),context);assert.equal(created.status,200);const value=await created.json();
  const edited=await handleApi(request('/api/projects/site-one','PUT',{...value,title:'Updated site'},{owner:true}),context);assert.equal(edited.status,200);
  const deleted=await handleApi(request('/api/projects/site-one','DELETE',{revision:(await edited.json()).revision},{owner:true}),context);assert.equal(deleted.status,200);
  const data=(await store.read()).data;assert.equal(data.profile.name,'Edited name');assert.equal(data.entries.length,3);assert.equal(data.projects.length,0);
});
test('unsafe links, invalid dates, empty content and cross-origin writes fail',async t=>{
  const {store}=await setup(t),context={env,store};
  for(const change of [{sourceUrl:'javascript:alert(1)'},{date:'2026-02-31'},{body:''},{category:'unknown'},{tags:['x'.repeat(41)]}]){const result=await handleApi(request('/api/entries/invalid','PUT',{...entry,...change},{owner:true}),context);assert.equal(result.status,400);}
  const csrf=await handleApi(request('/api/entries/csrf','PUT',entry,{owner:true,headers:{Origin:'https://other.test'}}),context);assert.equal(csrf.status,403);
  const missingHeader=await handleApi(request('/api/entries/csrf','PUT',entry,{owner:true,headers:{'X-Archive-Request':''}}),context);assert.equal(missingHeader.status,403);
  assert.equal((await store.read()).data.entries.length,0);
});
test('concurrent writers cannot silently overwrite each other',async t=>{
  const {store}=await setup(t);const a=await store.read(),b=await store.read();a.data.profile.name='A';b.data.profile.name='B';
  const result=await Promise.allSettled([store.write(a.data,a.version),store.write(b.data,b.version)]);
  assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.find(r=>r.status==='rejected').reason.status,409);assert.equal((await store.read()).data.profile.name,'A');
});
test('missing production auth fails closed and storage failures are explicit',async()=>{
  const store={async read(){throw new Error('Offline');}};
  const session=await handleApi(request('/api/session'),{env:{},store});assert.equal((await session.json()).canEdit,false);
  const missing=await handleApi(request('/api/login','POST',{key:'x'}),{env:{},store});assert.equal(missing.status,503);
  const failure=await handleApi(request('/api/content'),{env,store});assert.equal(failure.status,503);assert.match((await failure.json()).error,/작성한 내용은 유지/);
});
