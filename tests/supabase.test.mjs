import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseStore,ConflictError,initialContent} from '../src/store.mjs';

test('Supabase adapter creates, reads and conditionally updates without losing concurrent edits',async()=>{
  let row=null;
  const calls=[];
  const store=supabaseStore('https://project.supabase.co','sb_secret_test',async(url,options)=>{
    calls.push({url,options});
    assert.equal(options.headers.apikey,'sb_secret_test');assert.equal(options.headers.Authorization,undefined);
    if(!options.method)return Response.json(row?[row]:[]);
    if(options.method==='POST'&&row)return Response.json({},{status:409});
    if(options.method==='PATCH'&&url.searchParams.get('revision')!==`eq.${row.revision}`)return Response.json([]);
    row=JSON.parse(options.body);return Response.json([row]);
  });
  assert.equal((await store.read()).version,null);
  const data=initialContent(),first=await store.write(data,null);
  assert.equal((await store.read()).version,first);
  await assert.rejects(store.write(data,null),ConflictError);
  data.profile.name='Saved';const second=await store.write(data,first);
  assert.notEqual(second,first);
  await assert.rejects(store.write(initialContent(),first),ConflictError);
  assert.equal((await store.read()).data.profile.name,'Saved');
  assert.equal(calls.at(-1).url.pathname,'/rest/v1/personal_archive');
});
test('Supabase adapter fails closed on configuration and database errors',async()=>{
  await assert.rejects(supabaseStore('', '').read(),/configuration/);
  await assert.rejects(supabaseStore('https://project.supabase.co','sb_secret_test',async()=>Response.json({secret:'must not surface'},{status:401})).read(),error=>error.message.includes('401')&&!error.message.includes('must not surface'));
});
