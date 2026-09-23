import {get,put} from '@vercel/blob';
export const initialContent=()=>({profile:{name:'Gyulim Kim',affiliation:'SNU CSE ’24',bio:'배우고, 읽고, 만드는 과정에서\n만난 생각들을 모읍니다.',interests:[],revision:null},entries:[],projects:[]});
export class ConflictError extends Error{constructor(){super('다른 곳에서 내용이 변경되었어요. 작성한 내용을 복사해 두고 새로고침해 주세요.');this.status=409;}}
export function blobStore(token){
  const pathname='personal-archive/content.json';
  return {
    async read(){
      if(!token)throw new Error('Missing storage configuration');
      const result=await get(pathname,{access:'private',token,useCache:false});
      return result?{data:await new Response(result.stream).json(),version:result.blob.etag}:{data:initialContent(),version:null};
    },
    async write(data,version){
      try{return (await put(pathname,JSON.stringify(data),{access:'private',token,addRandomSuffix:false,contentType:'application/json',allowOverwrite:version!==null,...(version?{ifMatch:version}:{})})).etag;}
      catch(error){if(/Precondition|already exists/i.test(error.name+' '+error.message))throw new ConflictError();throw error;}
    }
  };
}
