import {randomUUID} from 'node:crypto';
export const initialContent=()=>({profile:{name:'Gyulim Kim',affiliation:'SNU CSE 24',bio:'배우고, 읽고, 만드는 과정에서\n만난 생각들을 모읍니다.',interests:[],revision:null},entries:[],projects:[],library:[],topics:[],cvitems:[]});
export function normalizeContent(data){return {...data,library:data.library??[],topics:data.topics??[],cvitems:data.cvitems??[]};}
export class ConflictError extends Error{constructor(){super('다른 곳에서 내용이 변경되었어요. 작성한 내용을 복사해 두고 새로고침해 주세요.');this.status=409;}}
export function supabaseStore(url,key,fetchImpl=fetch){
  async function request(query,options={}){
    if(!url||!key)throw new Error('Missing Supabase configuration');
    const endpoint=new URL('/rest/v1/personal_archive',url);
    endpoint.search=new URLSearchParams(query).toString();
    const response=await fetchImpl(endpoint,{...options,headers:{apikey:key,...(!key.startsWith('sb_secret_')?{Authorization:`Bearer ${key}`}:{ }), 'Content-Type':'application/json',Prefer:'return=representation',...options.headers},cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(response.status===409)throw new ConflictError();
    if(!response.ok)throw new Error(`Supabase storage request failed (${response.status})`);
    return response.json();
  }
  return {
    async read(){
      const rows=await request({id:'eq.main',select:'data,revision'});
      return rows.length?{data:rows[0].data,version:rows[0].revision}:{data:initialContent(),version:null};
    },
    async write(data,version){
      const revision=randomUUID(),body=JSON.stringify({id:'main',data,revision});
      const rows=await request(version?{id:'eq.main',revision:`eq.${version}`}:{},{method:version?'PATCH':'POST',body});
      if(rows.length!==1)throw new ConflictError();
      return rows[0].revision;
    }
  };
}
