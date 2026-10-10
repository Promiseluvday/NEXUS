// Creates app/.env.local for YOUR PC, from the local database's own settings.
// Run with:  npm run env:local   (the database must be running: npm run db:start)
//
// It asks the Supabase tool for the local address and the anon key, and
// writes them in the form the screens read. The local key is the standard
// demo key every local Supabase uses, not a secret. .env.local is ignored by
// Git, so it never leaves your PC.
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

let out;
try {
  out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  console.error('Could not read the database settings. Is Docker Desktop running? Then run: npm run db:start');
  process.exit(1);
}

const get = (name) => {
  const line = out.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^"|"$/g, '') : '';
};
const url = get('API_URL') || 'http://127.0.0.1:54321';
const key = get('ANON_KEY');
if (!key) {
  console.error('The database is not running. Run: npm run db:start   then try again.');
  process.exit(1);
}

const existed = existsSync('.env.local');
writeFileSync('.env.local', [
  '# Made by "npm run env:local". Local PC only; ignored by Git.',
  `VITE_SUPABASE_URL=${url}`,
  `VITE_SUPABASE_ANON_KEY=${key}`,
  'VITE_USERNAME_EMAIL_DOMAIN=users.nexus.local',
  '',
].join('\n'), { encoding: 'utf8' });

console.log(`${existed ? 'Updated' : 'Created'} .env.local (database at ${url}).`);
console.log('Now start (or restart) the screens: npm run dev');
