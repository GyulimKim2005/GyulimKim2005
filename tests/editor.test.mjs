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
async function editor(t,env={DEV_LOCAL:true}){
  const dir=await mkdtemp(join(tmpdir(),'gyulim-editor-test-')),file=join(dir,'data.json'),store=fileStore(file);
  const dom=new JSDOM(await readFile('public/index.html','utf8'),{url:'https://archive.test',runScripts:'outside-only'}),w=dom.window;
  t.after(async()=>{w.close();await unlink(file).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(dir);});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.confirm=()=>true;let cookie='',failSave=false;
  w.fetch=async(path,options={})=>{
    if(failSave&&options.method==='PUT')return Response.json({error:'테스트 저장 실패'},{status:503});
    const headers={...options.headers,...(cookie?{Cookie:cookie}:{})};
    const response=await handleApi(new Request('https://archive.test'+path,{...options,headers}),{env,store});
    const next=response.headers.get('set-cookie');if(next)cookie=next.includes('Max-Age=0')?'':next.split(';')[0];return response;
  };
  w.eval(await readFile('public/app.js','utf8'));
  await waitFor(()=>w.document.querySelector('.empty-state'));
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
test('login and logout change editing controls without exposing credentials',async t=>{
  const ui=await editor(t,{ADMIN_KEY_HASH:digest('test-ui-only-key'),SESSION_SECRET:'test-only-session-secret-with-more-than-32-characters'}),d=ui.document;
  assert.equal(d.getElementById('new-entry').hidden,true);d.getElementById('sign-in').click();d.getElementById('login-key').value='test-ui-only-key';ui.submit(d.getElementById('login-form'));
  await waitFor(()=>!d.getElementById('new-entry').hidden);assert.equal(d.getElementById('login-key').value,'');assert.equal(d.getElementById('sign-out').hidden,false);
  d.getElementById('sign-out').click();await waitFor(()=>d.getElementById('new-entry').hidden);assert.equal(d.getElementById('sign-in').hidden,false);
});
