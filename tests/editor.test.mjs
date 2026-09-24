import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,unlink,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {JSDOM} from 'jsdom';
import {handleApi} from '../src/api.mjs';
import {digest} from '../src/auth.mjs';
import {fileStore} from '../scripts/file-store.mjs';
const waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error('UI did not reach expected state');};
async function editor(t,env={DEV_LOCAL:true},options={}){
  const dir=await mkdtemp(join(tmpdir(),'gyulim-editor-test-')),file=join(dir,'data.json'),store=fileStore(file);
  if(options.seed){const snapshot=await store.read();options.seed(snapshot.data);await store.write(snapshot.data,snapshot.version);}
  const dom=new JSDOM(await readFile('public/index.html','utf8'),{url:'https://archive.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  t.after(async()=>{w.close();await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(dir);});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.confirm=()=>true;let cookie='',failSave=false;
  w.scrollTo=()=>{};w.matchMedia=()=>({matches:true});
  w.fetch=async(path,options={})=>{
    if(failSave&&options.method==='PUT')return Response.json({error:'테스트 저장 실패'},{status:503});
    const headers={...options.headers,...(cookie?{Cookie:cookie}:{})};
    const response=await handleApi(new Request('https://archive.test'+path,{...options,headers}),{env,store,fetchImpl:providerFetch});
    const next=response.headers.get('set-cookie');if(next)cookie=next.includes('Max-Age=0')?'':next.split(';')[0];return response;
  };
  const providerFetch=options.fetchImpl;
  w.eval(await readFile('public/app.js','utf8'));
  for(const file of ['spaces','orbit','rabbit'])w.eval(await readFile('public/'+file+'.js','utf8'));
  await waitFor(()=>!w.document.getElementById('new-entry').disabled);
  return {w,document:w.document,store,fail(value){failSave=value;},submit(form){form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}};
}
test('editor creates and filters records, preserves failed input, and manages links',async t=>{
  const ui=await editor(t),d=ui.document;
  d.getElementById('new-entry').click();const form=d.getElementById('editor-form');
  form.elements.title.value='직접 쓴 공부 기록';form.elements.body.value='첫 번째 문단\n두 번째 문단';ui.submit(form);
  await waitFor(()=>!d.getElementById('editor').open);
  assert.match(d.getElementById('entries').textContent,/직접 쓴 공부 기록/);assert.equal((await ui.store.read()).data.entries.length,1);
  d.querySelector('[data-filter="reading"]').click();assert.equal(d.querySelectorAll('.entry-row').length,0);
  d.querySelector('[data-filter="all"]').click();d.querySelector('.entry-row').click();assert.match(d.getElementById('reader-body').textContent,/두 번째 문단/);
  d.getElementById('edit-entry').click();form.elements.body.value='저장 실패해도 남아야 하는 본문';ui.fail(true);ui.submit(form);
  await waitFor(()=>!d.getElementById('form-error').hidden);assert.equal(form.elements.body.value,'저장 실패해도 남아야 하는 본문');assert.equal(d.getElementById('editor').open,true);
  ui.fail(false);ui.submit(form);await waitFor(()=>!d.getElementById('editor').open);assert.equal((await ui.store.read()).data.entries[0].body,'저장 실패해도 남아야 하는 본문');
  d.getElementById('new-project').click();form.elements.title.value='내 사이트';form.elements.url.value='https://example.org';ui.submit(form);
  await waitFor(()=>!d.getElementById('editor').open);assert.equal(d.querySelector('.project-link').href,'https://example.org/');assert.equal(d.querySelector('.project-link').rel,'noopener noreferrer');
  d.querySelector('.project-controls .danger').click();d.getElementById('confirm-delete').click();await waitFor(()=>!d.getElementById('confirm-dialog').open);assert.equal((await ui.store.read()).data.projects.length,0);
});

test('home shows only the latest five and search includes older archive records',async t=>{
  const ui=await editor(t,{DEV_LOCAL:true},{seed:data=>{data.entries=Array.from({length:8},(_,i)=>({id:'record-'+i,revision:'r'+i,title:'기록 '+i,body:i===0?'아주 오래된 특별한 검색어':'본문',summary:'',date:'2026-09-'+String(i+1).padStart(2,'0'),category:'study',tags:[],sourceUrl:'',createdAt:'2026-09-01T00:00:00Z'}));}}),d=ui.document;
  assert.deepEqual([...d.querySelectorAll('#recent-posts h3')].map(e=>e.textContent),['기록 7','기록 6','기록 5','기록 4','기록 3']);
  d.getElementById('search-input').value='특별한 검색어';ui.submit(d.getElementById('search-form'));
  assert.equal(ui.w.location.pathname,'/archive');assert.equal(d.getElementById('home').hidden,true);assert.equal(d.querySelectorAll('#entries .entry-row').length,1);assert.match(d.getElementById('entries').textContent,/기록 0/);
});

test('home sort changes the selected five records and preserves archive order',async t=>{
  const titles=['Zulu','Delta','Hotel','Alpha','Golf','Bravo','Foxtrot','Echo'];
  const ui=await editor(t,{DEV_LOCAL:true},{seed:data=>{data.entries=titles.map((title,i)=>({id:'sort-'+i,revision:'r'+i,title,body:'본문',summary:'',date:'2026-09-'+String(i+1).padStart(2,'0'),category:'study',tags:[],sourceUrl:'',createdAt:'2026-09-01T00:00:00Z'}));}}),d=ui.document;
  const visible=()=>[...d.querySelectorAll('#recent-posts h3')].map(e=>e.textContent),select=d.getElementById('recent-sort');
  assert.deepEqual(visible(),['Echo','Foxtrot','Bravo','Golf','Alpha']);
  select.value='oldest';select.dispatchEvent(new ui.w.Event('change'));
  assert.deepEqual(visible(),['Zulu','Delta','Hotel','Alpha','Golf']);
  select.value='title';select.dispatchEvent(new ui.w.Event('change'));
  assert.deepEqual(visible(),['Alpha','Bravo','Delta','Echo','Foxtrot']);
  assert.equal(ui.w.localStorage.getItem('gyulim-home-sort'),'title');
  assert.match(d.getElementById('recent-posts').getAttribute('aria-label'),/제목순/);
  assert.deepEqual([...d.querySelectorAll('#entries h3')].map(e=>e.textContent),[...titles].reverse());
});

test('recent frames survive loading, failed requests and recovery',async t=>{
  const dom=new JSDOM(await readFile('public/index.html','utf8'),{url:'https://archive.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
  t.after(()=>w.close());w.scrollTo=()=>{};
  assert.equal(d.querySelectorAll('#recent-posts .recent-card').length,5);
  let recover=false;
  w.fetch=async path=>path==='/api/session'?Response.json({canEdit:false}):recover?Response.json({profile:{name:'Gyulim Kim',affiliation:'SNU CSE 24',bio:'',interests:[]},entries:[],projects:[],library:[],topics:[],cvitems:[]}):Response.json({error:'Offline'},{status:503});
  w.eval(await readFile('public/app.js','utf8'));
  await waitFor(()=>d.querySelector('.recent-error'));
  assert.equal(d.querySelectorAll('#recent-posts .recent-card').length,5);
  d.getElementById('recent-sort').value='oldest';d.getElementById('recent-sort').dispatchEvent(new w.Event('change'));
  assert(d.querySelector('.recent-error'));
  recover=true;d.querySelector('.recent-error button').click();
  await waitFor(()=>!d.querySelector('.recent-error'));
  assert.equal(d.querySelectorAll('#recent-posts .recent-card').length,5);
  assert.match(d.getElementById('recent-posts').textContent,/아직 등록한 기록/);
});

test('web recommendations show sources and prepare an unsaved library record',async t=>{
  const ui=await editor(t,{DEV_LOCAL:true,AI_SEARCH_ENABLED:'true',OPENAI_API_KEY:'test-only-fake-key'},{fetchImpl:async()=>Response.json({status:'completed',output:[{type:'web_search_call',action:{sources:[{url:'https://example.org/verified',title:'Verified publisher'}]}},{type:'message',content:[{type:'output_text',text:JSON.stringify({results:[{title:'검색된 책',creator:'Author',type:'book',url:'https://example.org/verified',reason:'추천 설명'}]})}]}]})}),d=ui.document;
  d.getElementById('discover-query').value='새로운 책';ui.submit(d.getElementById('discover-form'));
  await waitFor(()=>d.querySelector('.discovery-card'));
  assert.equal(d.querySelector('.discovery-card a').href,'https://example.org/verified');assert.equal((await ui.store.read()).data.library.length,0);
  d.querySelector('.discovery-card button').click();const form=d.getElementById('editor-form');assert.equal(form.elements.title.value,'검색된 책');assert.equal(form.elements.review.value,'');
  ui.submit(form);await waitFor(()=>!d.getElementById('editor').open);assert.equal((await ui.store.read()).data.library[0].title,'검색된 책');
});

test('shelf, mind map, CV and archive links can be edited from the page',async t=>{
  const ui=await editor(t),d=ui.document,form=d.getElementById('editor-form');
  d.getElementById('new-entry').click();form.elements.title.value='연결할 글';form.elements.body.value='연결 본문';ui.submit(form);await waitFor(()=>!d.getElementById('editor').open);
  const id=(await ui.store.read()).data.entries[0].id;
  d.querySelector('.orbit-item[href="/library"]').click();assert.equal(ui.w.location.pathname,'/library');
  d.getElementById('new-book').click();form.elements.title.value='나의 읽기';form.elements.url.value='https://example.org/book';form.elements.review.value='짧은 감상평';form.elements.purpose.value='leisure';form.querySelector('[name="entryIds"]').checked=true;ui.submit(form);await waitFor(()=>!d.getElementById('editor').open);
  assert.equal((await ui.store.read()).data.library[0].entryIds[0],id);assert.equal(d.querySelectorAll('.book-spine').length,1);
  d.querySelector('[data-book-type="paper"]').click();assert.equal(d.querySelectorAll('.book-spine').length,0);d.querySelector('[data-book-type="all"]').click();
  d.querySelector('.book-spine').click();assert.equal(d.getElementById('detail-review').textContent,'짧은 감상평');assert.equal(d.getElementById('detail-link').href,'https://example.org/book');
  d.querySelector('#detail-related button').click();assert.equal(d.getElementById('reader-title').textContent,'연결할 글');assert.match(d.getElementById('reader-related').textContent,/나의 읽기/);
  d.querySelector('#reader .close-dialog').click();d.querySelector('.inner-header a[href="/interests"]').click();d.getElementById('new-topic').click();form.elements.title.value='인지과학';form.elements.note.value='관심사 이야기';form.querySelector('[name="entryIds"]').checked=true;ui.submit(form);await waitFor(()=>!d.getElementById('editor').open);
  d.querySelector('.mindmap-node').click();assert.match(d.getElementById('topic-detail').textContent,/연결할 글/);
  d.querySelector('.inner-header a[href="/cv"]').click();d.getElementById('new-cvitem').click();form.elements.title.value='직접 입력한 이력';form.elements.period.value='2026';ui.submit(form);await waitFor(()=>!d.getElementById('editor').open);assert.match(d.getElementById('resume-sections').textContent,/직접 입력한 이력/);
  d.querySelector('.inner-header a[href="/about"]').click();assert.equal(d.getElementById('about-page').hidden,false);
  ui.w.history.pushState({},'','/dev');ui.w.dispatchEvent(new ui.w.PopStateEvent('popstate'));assert.equal(d.getElementById('projects').hidden,false);
});

test('rabbit count is visible only while held; orbit rotation does not navigate on drag',async t=>{
  const ui=await editor(t),w=ui.w,d=ui.document,rabbit=d.getElementById('pet-rabbit'),counter=d.getElementById('pet-count');
  assert.equal(counter.hidden,true);rabbit.dispatchEvent(new w.KeyboardEvent('keydown',{key:' ',bubbles:true}));assert.equal(counter.hidden,false);assert.match(counter.textContent,/1번/);assert.equal(d.querySelectorAll('.petal').length,6);
  assert.equal(d.querySelectorAll('.petal svg path').length,6);assert.equal(rabbit.classList.contains('petted'),false);
  assert([...d.querySelectorAll('.petal')].every(p=>parseFloat(p.style.getPropertyValue('--dy'))<=-180));
  rabbit.dispatchEvent(new w.KeyboardEvent('keyup',{key:' ',bubbles:true}));assert.equal(counter.hidden,true);assert.equal(w.localStorage.getItem('gyulim-rabbit-pets'),'1');
  rabbit.dispatchEvent(new w.MouseEvent('pointerdown',{button:0,clientX:10,clientY:10,bubbles:true}));assert.equal(counter.hidden,false);w.dispatchEvent(new w.Event('blur'));assert.equal(counter.hidden,true);
  const orbit=d.getElementById('orbit'),link=orbit.querySelector('a');orbit.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:560});
  const ring=d.getElementById('orbit-path'),fixedRing=ring.getAttribute('d'),initialPosition=link.style.cssText;
  const before=orbit.dataset.rotation;d.getElementById('orbit-next').click();assert.notEqual(orbit.dataset.rotation,before);
  assert.notEqual(link.style.cssText,initialPosition);assert.equal(ring.getAttribute('d'),fixedRing);
  link.dispatchEvent(new w.MouseEvent('pointerdown',{button:0,clientX:200,clientY:200,bubbles:true}));orbit.dispatchEvent(new w.MouseEvent('pointermove',{button:0,clientX:300,clientY:250,bubbles:true,cancelable:true}));orbit.dispatchEvent(new w.MouseEvent('pointerup',{button:0,bubbles:true}));link.dispatchEvent(new w.MouseEvent('click',{button:0,detail:1,bubbles:true,cancelable:true}));assert.equal(w.location.pathname,'/');
  assert.equal(ring.getAttribute('d'),fixedRing);
  orbit.dispatchEvent(new w.WheelEvent('wheel',{deltaY:80,bubbles:true,cancelable:true}));assert.equal(ring.getAttribute('d'),fixedRing);
  orbit.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(link.style.cssText,initialPosition);assert.equal(ring.getAttribute('d'),fixedRing);
  link.click();assert.equal(w.location.pathname,'/interests');
});

test('orbit menus keep equal arc distances, stay on the visible ring and move their labels with position',async t=>{
  const ui=await editor(t),d=ui.document,w=ui.w,orbit=d.getElementById('orbit'),ring=d.getElementById('orbit-path'),fixed=ring.getAttribute('d');
  const points=[...fixed.matchAll(/[ML]([\d.-]+) ([\d.-]+)/g)].map(m=>({x:Number(m[1]),y:Number(m[2])}));
  let length=0;points.forEach((p,i)=>{if(i)length+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y);p.distance=length;});
  function verify(){
    const distances=[...orbit.querySelectorAll('.orbit-item')].map(item=>{
      const x=parseFloat(item.style.left)*1016/100,y=parseFloat(item.style.top)*533/100;let error=Infinity,distance;
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy))),e=Math.hypot(x-a.x-dx*t,y-a.y-dy*t);
        if(e<error){error=e;distance=a.distance+(b.distance-a.distance)*t;}
      }
      assert(error<.01,'menu centre must remain on the drawn line');return distance;
    }).sort((a,b)=>a-b);
    distances.forEach((value,i)=>{const gap=i===4?length+distances[0]-value:distances[i+1]-value;assert(Math.abs(gap-length/5)<.01,'spacing must not change with curvature or wrapping');});
    assert.equal(ring.getAttribute('d'),fixed);
  }
  verify();assert(d.querySelector('[data-orbit-index="1"]').classList.contains('label-upper-left'));
  d.getElementById('orbit-next').click();verify();
  assert(d.querySelector('[data-orbit-index="0"]').classList.contains('label-upper-left'));
  assert(!d.querySelector('[data-orbit-index="1"]').classList.contains('label-upper-left'));
  for(let i=0;i<30;i++){orbit.dispatchEvent(new w.WheelEvent('wheel',{deltaY:i%2?100:260,bubbles:true,cancelable:true}));verify();}
});
test('login and logout change editing controls without exposing credentials',async t=>{
  const ui=await editor(t,{ADMIN_KEY_HASH:digest('test-ui-only-key'),SESSION_SECRET:'test-only-session-secret-with-more-than-32-characters'}),d=ui.document;
  assert.equal(d.getElementById('new-entry').hidden,true);d.getElementById('sign-in').click();d.getElementById('login-key').value='test-ui-only-key';ui.submit(d.getElementById('login-form'));
  await waitFor(()=>!d.getElementById('new-entry').hidden);assert.equal(d.getElementById('login-key').value,'');assert.equal(d.getElementById('sign-out').hidden,false);
  d.getElementById('sign-out').click();await waitFor(()=>d.getElementById('new-entry').hidden);assert.equal(d.getElementById('sign-in').hidden,false);
});
