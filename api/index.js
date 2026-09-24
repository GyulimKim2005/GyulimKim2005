import {handleApi} from '../src/api.mjs';
import {supabaseStore} from '../src/store.mjs';
export default async function handler(req,res){
  const method=req.method||'GET',protocol=req.headers['x-forwarded-proto']==='http'?'http':'https';
  const body=['GET','HEAD'].includes(method)?undefined:typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
  const url=new URL(`${protocol}://${req.headers.host}${req.url}`);
  const route=url.searchParams.get('route');
  if(route!==null){url.pathname='/api/'+route;url.searchParams.delete('route');}
  const request=new Request(url,{method,headers:req.headers,body});
  const response=await handleApi(request,{env:process.env,store:supabaseStore(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY)});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
}
