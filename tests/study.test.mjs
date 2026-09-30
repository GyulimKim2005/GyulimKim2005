import test from 'node:test';
import assert from 'node:assert/strict';
import {getSchema} from '@tiptap/core';
import {noteExtensions} from '../src/note-extensions.js';
import {validateNoteDocument,noteText,plainDocument} from '../src/note-document.mjs';
import {handleApi} from '../src/api.mjs';
import {initialContent} from '../src/store.mjs';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const p=text=>({type:'paragraph',content:[{type:'text',text}]});
const doc={type:'doc',content:[
  {type:'heading',attrs:{level:2},content:[{type:'text',text:'미적분 중간고사'}]},
  {type:'paragraph',content:[{type:'text',text:'정적분',marks:[{type:'bold'},{type:'highlight',attrs:{color:'#fff0ad'}}]},{type:'inlineMath',attrs:{latex:'x^2'}}]},
  {type:'blockMath',attrs:{latex:'\\int_0^1 x^2\\,dx=\\frac13'}},
  {type:'blockMath',attrs:{latex:'\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}'}},
  {type:'table',content:[{type:'tableRow',content:[{type:'tableHeader',attrs:{colspan:1,rowspan:1,colwidth:[120]},content:[p('정리')]},{type:'tableHeader',content:[p('조건')]}]},{type:'tableRow',content:[{type:'tableCell',content:[p('연속')]},{type:'tableCell',content:[p('닫힌 구간')]}]}]},
  {type:'image',attrs:{src:'data:image/png;base64,iVBORw0KGgo=',alt:'필기',width:'50%'}},
  {type:'bulletList',content:[{type:'listItem',content:[p('복습할 증명')]}]}
]};
function context(){let data=initialContent(),version=null;return {env:{DEV_LOCAL:true},store:{async read(){return {data:structuredClone(data),version};},async write(next){data=structuredClone(next);version=String(Number(version)+1);return version;}}};}
function request(body,id='study'){return new Request('http://localhost/api/entries/'+id,{method:'PUT',headers:{'Content-Type':'application/json','X-Archive-Request':'1'},body:JSON.stringify({title:'공부',category:'study',date:'2026-09-30',summary:'',tags:[],sourceUrl:'',body:'untrusted search text',bodyVersion:1,bodyDoc:doc,revision:null,...body})});}
test('rich notes persist math, table, image and formatting across reopen and update',async()=>{
  const ctx=context(),response=await handleApi(request({}),ctx);assert.equal(response.status,200);const first=await response.json();
  assert.deepEqual(first.bodyDoc,validateNoteDocument(doc));assert.match(first.body,/미적분/);assert.match(first.body,/\\int/);assert.match(first.body,/복습할 증명/);assert.doesNotMatch(first.body,/untrusted/);
  const read=await handleApi(new Request('http://localhost/api/content'),ctx),saved=(await read.json()).entries[0];
  const changed=structuredClone(saved);changed.bodyDoc.content[2].attrs.latex='\\frac{1}{3}';assert.equal((await handleApi(request(changed),ctx)).status,200);
  assert.equal((await handleApi(request(saved),ctx)).status,409);
  const latest=(await ctx.store.read()).data.entries[0];const {bodyDoc,bodyVersion,...legacy}=latest;
  assert.equal((await handleApi(request({...legacy,bodyDoc:undefined,bodyVersion:undefined}),ctx)).status,409);
});
test('plain older notes remain readable and can upgrade without losing line breaks',async()=>{
  const ctx=context(),body='첫 줄\n\n둘째 줄 <script>alert(1)</script>';
  const response=await handleApi(request({body,bodyDoc:undefined,bodyVersion:undefined}),ctx);assert.equal(response.status,200);const old=await response.json();
  assert.equal(old.body,body);assert.equal(noteText(plainDocument(body)),body);
  const next=await handleApi(request({...old,bodyDoc:plainDocument(body),bodyVersion:1}),ctx);assert.equal(next.status,200);assert.equal((await next.json()).body,body);
});
test('server rejects unsafe URLs, malformed or excessive documents and empty notes',async()=>{
  const badDocs=[
    {type:'doc',content:[{type:'script',text:'alert(1)'}]},
    {type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'link',marks:[{type:'link',attrs:{href:'javascript:alert(1)'}}]}]}]},
    {type:'doc',content:[{type:'image',attrs:{src:'data:image/svg+xml;base64,PHN2Zz4='}}]},
    {type:'doc',content:[{type:'paragraph',content:[p('nested')]}]},
    plainDocument(''),
    {type:'doc',content:[{type:'blockMath',attrs:{latex:'x'.repeat(10001)}}]},
    plainDocument('x'.repeat(100001))
  ];
  for(const bodyDoc of badDocs)assert.equal((await handleApi(request({bodyDoc}),context())).status,400);
  assert.equal((await handleApi(request({bodyVersion:99}),context())).status,400);
  const dirty=plainDocument('서식');dirty.content[0].attrs={textAlign:'expression(alert(1))',onclick:'alert(1)'};dirty.content[0].content[0].marks=[{type:'textStyle',attrs:{color:'url(https://evil.test)',fontSize:'9999px',fontFamily:'evil'}}];
  const clean=validateNoteDocument(dirty);assert.doesNotMatch(JSON.stringify(clean),/evil|onclick|expression|9999/);
});
test('validated rich documents fit the actual editor schema and math node types',()=>{
  const schema=getSchema(noteExtensions());schema.nodeFromJSON(validateNoteDocument(doc)).check();
  const inline={type:'doc',content:[{type:'paragraph',content:[{type:'inlineMath',attrs:{latex:'\\sqrt{x}'}}]}]};schema.nodeFromJSON(validateNoteDocument(inline)).check();
});
test('editor restores complete local drafts, keeps failed-save content, and preserves rich formatting',async t=>{
  const bundle=await build({entryPoints:['src/study-editor.js'],bundle:true,write:false,format:'iife',globalName:'StudyNotesTest',target:'es2022'});
  const dom=new JSDOM('<!doctype html><dialog open><form><input name="title" value="공부"><label><textarea name="body" required></textarea></label></form></dialog>',{url:'https://archive.test',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window,d=w.document;t.after(()=>w.close());
  w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}});w.eval(bundle.outputFiles[0].text);
  const form=d.querySelector('form'),textarea=form.elements.body;let dirty=0,revision;
  const options={form,textarea,entry:{id:'draft-test',revision:'r1',body:noteText(doc),bodyDoc:doc},id:'draft-test',onDirty:()=>dirty++,onRevision:value=>revision=value};
  const mounted=w.StudyNotesTest.mount(options);assert.ok(d.querySelector('.note-prose table'));assert.equal(d.querySelectorAll('.note-math').length,3);assert.equal(mounted.collect().bodyDoc.content[1].content[0].marks.length,2);
  form.elements.title.value='복구할 공부 제목';form.dispatchEvent(new w.Event('input',{bubbles:true}));mounted.flush();assert.ok(dirty>0);
  assert.equal(JSON.parse(w.localStorage.getItem('gyulim-study-draft:draft-test')).fields.title,'복구할 공부 제목');
  const before=JSON.stringify(mounted.collect());mounted.setSaving(true);assert.equal(d.querySelector('.note-prose').getAttribute('contenteditable'),'false');mounted.setSaving(false);assert.equal(form.elements.title.disabled,false);mounted.flush();assert.equal(JSON.stringify(mounted.collect()),before);mounted.destroy();
  // Closing/reopening a real form creates fresh controls, just like app.js.
  form.innerHTML='<input name="title" value="서버 제목"><label><textarea name="body" required></textarea></label>';
  const restored=w.StudyNotesTest.mount({...options,textarea:form.elements.body});assert.ok(d.querySelector('.note-draft-banner'));
  [...d.querySelectorAll('.note-draft-banner button')].find(b=>b.textContent==='복구').click();
  assert.equal(form.elements.title.value,'복구할 공부 제목');assert.equal(revision,'r1');assert.equal(restored.collect().bodyDoc.content[2].attrs.latex,doc.content[2].attrs.latex);
  restored.saved();assert.equal(w.localStorage.getItem('gyulim-study-draft:draft-test'),null);restored.destroy();assert.equal(w.localStorage.getItem('gyulim-study-draft:draft-test'),null);
});
