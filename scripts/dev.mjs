import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {handleApi} from '../src/api.mjs';
import {fileStore} from './file-store.mjs';
const store=fileStore('.local/content.json');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try{
    const method=req.method||'GET';
    if(req.url.startsWith('/api/')){
      const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>500000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
      const request=new Request('http://127.0.0.1:4173'+req.url,{method,headers:req.headers,body:['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks)});
      const response=await handleApi(request,{env:{DEV_LOCAL:true},store});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
    }
    const pathname=new URL(req.url,'http://localhost').pathname,file=pathname==='/'?'index.html':pathname.slice(1);
    if(!['index.html','app.js','styles.css'].includes(file)){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'});res.end(await readFile(path.join('public',file)));
  }catch(error){console.error(error.name);res.writeHead(500);res.end('Local server error');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/ — localhost-only editor; saves to .local/content.json'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
