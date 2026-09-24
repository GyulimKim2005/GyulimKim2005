import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../src/api.mjs';
import {fileStore} from './file-store.mjs';
try{process.loadEnvFile('.env.local');}catch(error){if(error.code!=='ENOENT')throw error;}
const port=Number(process.env.PORT||4173);
const store=fileStore(process.env.LOCAL_CONTENT_FILE||'.local/content.json');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
  try{
    const method=req.method||'GET';
    if(req.url.startsWith('/api/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>500000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request('http://127.0.0.1:'+port+req.url,{method,headers:req.headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)});
      const response=await handleApi(request,{env:{...process.env,DEV_LOCAL:true},store});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    const pathname=new URL(req.url,'http://localhost').pathname;
    const routes=['/','/about','/interests','/dev','/archive','/library','/cv'];
    const file=routes.includes(pathname.replace(/\/$/,'')||'/')?'index.html':pathname.slice(1);
    if(!['index.html','app.js','orbit.js','rabbit.js','spaces.js','styles.css','assets/miricanvas-home.png','assets/paper-background.png'].includes(file)){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(await readFile(path.join('public',file)));
  }catch(error){console.error(error.name);res.writeHead(500);res.end('Local server error');}
});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port+'/ — localhost-only editor'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
