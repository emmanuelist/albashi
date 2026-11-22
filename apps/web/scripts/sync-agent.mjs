// Copies the agent's code (apps/agent/src, the single source) into app/agent/ so the web app's server routes can run
// it: Vercel deploys apps/web on its own, so it can't import from ../agent at build time. Run after changing
// apps/agent/src: npm run sync-agent. test/agent-sync.test.ts fails if a copy has drifted.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
export const FILES = ['abi.ts', 'payslip.ts', 'textile.ts', 'payrun.ts', 'relay.ts', 'runner.ts'];
export const HEADER = '// Copied from apps/agent/src by apps/web/scripts/sync-agent.mjs. Edit the original, then run npm run sync-agent.\n';
const src = new URL('../../agent/src/', import.meta.url);
const dst = new URL('../app/agent/', import.meta.url);
if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(dst, { recursive: true });
  for (const f of FILES) writeFileSync(new URL(f, dst), HEADER + readFileSync(new URL(f, src), 'utf8'));
  console.log(`synced ${FILES.length} files into app/agent/`);
}
