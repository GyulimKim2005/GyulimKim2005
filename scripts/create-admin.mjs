import {randomBytes} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {digest} from '../src/auth.mjs';
const key=randomBytes(24).toString('base64url'),secret=randomBytes(32).toString('hex');
await mkdir('.local',{recursive:true});
// wx deliberately refuses to overwrite existing credentials.
await writeFile('.local/admin-credentials.json',JSON.stringify({loginKey:key,ADMIN_KEY_HASH:digest(key),SESSION_SECRET:secret},null,2),{flag:'wx',mode:0o600});
console.log('Credentials saved to .local/admin-credentials.json (ignored by Git). Keep loginKey private. Set ADMIN_KEY_HASH and SESSION_SECRET as Vercel secrets.');
