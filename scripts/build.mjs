import {execFileSync} from 'node:child_process';
for(const file of ['public/app.js','public/orbit.js','public/rabbit.js','public/spaces.js','src/discovery.mjs','src/api.mjs','src/auth.mjs','src/store.mjs','api/index.js'])execFileSync(process.execPath,['--check',file],{stdio:'inherit'});
console.log('Client and API syntax checks passed. Static output: public/');
