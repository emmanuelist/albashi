// The web app's copy of the agent code must match apps/agent/src exactly (scripts/sync-agent.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FILES, HEADER } from '../scripts/sync-agent.mjs';

const src = new URL('../../agent/src/', import.meta.url);
test('app/agent/ is an exact copy of apps/agent/src', { skip: !existsSync(src) }, () => {
  for (const f of FILES) {
    assert.equal(readFileSync(new URL(`../app/agent/${f}`, import.meta.url), 'utf8'), HEADER + readFileSync(new URL(f, src), 'utf8'), `${f} has drifted: run npm run sync-agent`);
  }
});
