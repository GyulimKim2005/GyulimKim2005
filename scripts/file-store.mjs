import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialContent,ConflictError} from '../src/store.mjs';
export function fileStore(filename){
  let queue=Promise.resolve();
  const read=async()=>{try{return JSON.parse(await readFile(filename,'utf8'));}catch(error){if(error.code==='ENOENT')return {data:initialContent(),version:null};throw error;}};
  return {read,write(data,version){
    const next=queue.then(async()=>{const old=await read();if(old.version!==version)throw new ConflictError();const revision=randomUUID();await mkdir(dirname(filename),{recursive:true});const temp=filename+'.'+revision+'.tmp';await writeFile(temp,JSON.stringify({data,version:revision}));await rename(temp,filename);return revision;});queue=next.catch(()=>{});return next;
  }};
}
