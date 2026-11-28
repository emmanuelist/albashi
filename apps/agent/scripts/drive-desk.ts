// Drives the deployed owner desk in a visible browser, as the demo agency's owner, and records it (video + a
// screenshot per beat) for the demo film. The browser's wallet is a stand-in backed by the test owner's key from
// .env: it answers the desk's wallet requests (accounts, chain, typed-data signatures, transactions) in this Node
// process, so the key never enters the page. Everything the desk does is real and on Celo mainnet.
//
//   node --env-file=.env scripts/drive-desk.ts --payee 0x… --name "…" --naira 1500                 dry: fills the payslip, sends nothing
//   node --env-file=.env scripts/drive-desk.ts --payee 0x… --name "…" --naira 1500 --fund 1.18 --live   funds the payroll balance, signs, pays
//
// Never claim a run recorded this way was "signed in MetaMask": it was signed by the owner's key in this script.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, isAddress, type Hex, type TypedDataDefinition } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const require = createRequire(import.meta.url);
// Playwright from the global CLI install (nothing added to this package), driving the installed Google Chrome.
type Page = { goto(u: string, o?: object): Promise<unknown>; [k: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const { chromium } = require('/opt/homebrew/lib/node_modules/@playwright/cli/node_modules/playwright') as { chromium: { launch(o: object): Promise<any> } }; // eslint-disable-line @typescript-eslint/no-explicit-any

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const LIVE = process.argv.includes('--live');
const SITE = arg('url') ?? 'https://albashi.vercel.app';
const PAYEE = arg('payee') ?? '';
const NAME = arg('name') ?? '';
const NAIRA = arg('naira') ?? '';
const FUND = arg('fund');
// --stop: the reversal beat. The owner stops the agent on the desk, then writes a payslip the desk can no longer pay.
const STOP = process.argv.includes('--stop');
if (!isAddress(PAYEE) || !NAME || !/^\d+(\.\d{1,2})?$/.test(NAIRA)) throw new Error('need --payee 0x… --name "…" --naira 1500');

const owner = privateKeyToAccount(process.env.OWNER_KEY as Hex);
const rpc = http(process.env.CELO_RPC_URL ?? 'https://forno.celo.org', { retryCount: 3 });
const pub = createPublicClient({ chain: celo, transport: rpc });
const wallet = createWalletClient({ account: owner, chain: celo, transport: rpc });

const out = new URL(`../../../internal/video/raw/${new Date().toISOString().replace(/[:.]/g, '-')}/`, import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const log = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

// EIP-712 JSON from the page carries uint values as strings; viem signs bigints.
function typedFromJson(json: string): TypedDataDefinition {
  const t = JSON.parse(json) as { domain: Record<string, unknown>; types: Record<string, { name: string; type: string }[]>; primaryType: string; message: Record<string, unknown> };
  const types = Object.fromEntries(Object.entries(t.types).filter(([k]) => k !== 'EIP712Domain'));
  const conv = (type: string, v: unknown): unknown => {
    if (type.endsWith('[]')) return (v as unknown[]).map((x) => conv(type.slice(0, -2), x));
    if (types[type]) return Object.fromEntries(types[type]!.map((f) => [f.name, conv(f.type, (v as Record<string, unknown>)[f.name])]));
    if (/^u?int\d*$/.test(type)) return BigInt(v as string);
    return v;
  };
  const domain = { ...t.domain, ...(t.domain.chainId !== undefined ? { chainId: Number(t.domain.chainId) } : {}) };
  return { domain, types, primaryType: t.primaryType, message: conv(t.primaryType, t.message) } as unknown as TypedDataDefinition;
}

async function answer({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
  switch (method) {
    case 'eth_requestAccounts':
    case 'eth_accounts':
      return [owner.address];
    case 'eth_chainId':
      return '0xa4ec';
    case 'wallet_switchEthereumChain':
    case 'wallet_addEthereumChain':
      return null;
    case 'eth_signTypedData_v4': {
      if (!LIVE) throw Object.assign(new Error('Dry run: the stand-in wallet declined to sign.'), { code: 4001 });
      const sig = await owner.signTypedData(typedFromJson(params![1] as string));
      log('signed the payslip (EIP-712) with the owner key');
      return sig;
    }
    case 'eth_sendTransaction': {
      if (!LIVE) throw Object.assign(new Error('Dry run: the stand-in wallet declined to send.'), { code: 4001 });
      const tx = params![0] as { to: Hex; data?: Hex; value?: Hex; gas?: Hex };
      const hash = await wallet.sendTransaction({ to: tx.to, data: tx.data, value: tx.value ? BigInt(tx.value) : 0n });
      log(`sent ${tx.data?.slice(0, 10) ?? 'value'} to ${tx.to}: ${hash}`);
      return hash;
    }
    default:
      return pub.request({ method, params } as never);
  }
}

// --pin <ip>: reach the site through one Vercel edge address. On 28 Nov this machine's network could not reach
// Vercel's 64.29.17.3 / 216.198.79.3 cluster (vercel.com too) while .67 and .131 answered; DNS rotates among them.
const PIN = arg('pin');
const browser = await chromium.launch({ headless: false, channel: 'chrome', args: PIN ? [`--host-resolver-rules=MAP ${new globalThis.URL(SITE).host} ${PIN}`] : [] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
const page: Page = await ctx.newPage();
await page.exposeFunction('__ownerWallet', (req: { method: string; params?: unknown[] }) =>
  answer(req).then((result) => ({ result }), (e: { message?: string; code?: number }) => ({ error: { message: e.message ?? 'error', code: e.code ?? -32000 } })));
await page.addInitScript(() => {
  const call = (window as unknown as { __ownerWallet(r: unknown): Promise<{ result?: unknown; error?: { message: string; code: number } }> }).__ownerWallet;
  (window as unknown as { ethereum: unknown }).ethereum = {
    isAlbashiStandIn: true,
    request: async (r: unknown) => { const a = await call(r); if (a.error) throw Object.assign(new Error(a.error.message), a.error); return a.result; },
    on() {}, removeListener() {},
  };
});
let shot = 0;
const snap = async (name: string) => { await page.screenshot({ path: `${out}${String(++shot).padStart(2, '0')}-${name}.png` }); log(`screenshot ${name}`); };

try {
  // The desk re-reads Celo on a timer, so the network never goes idle: wait for its content instead.
  await page.goto(`${SITE}/desk`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.locator('.recon, .empty').first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await snap('desk-read-only');

  await page.getByRole('button', { name: /connect the owner wallet/i }).first().click();
  await page.locator('.chip-owner').waitFor({ timeout: 15_000 });
  await page.waitForTimeout(800);
  await snap('owner-connected');

  if (STOP) {
    await page.getByRole('button', { name: 'Stop the agent', exact: true }).click();
    await page.waitForFunction(() => /\d\.\d{4}/.test(document.querySelector('.stop-confirm')?.textContent ?? ''), null, { timeout: 30_000 });
    await page.waitForTimeout(1200);
    await snap('stop-confirm');
    await page.getByRole('button', { name: 'Stop the agent now' }).click();
    await page.locator('.stop-done, .stop .refusal').first().waitFor({ timeout: 180_000 });
    await page.waitForTimeout(1500);
    await snap('stopped');
    log(`stop: ${await page.locator('.stop-done, .stop .refusal').first().innerText()}`);
    // After the desk re-reads Celo, the agent panel and the payslip editor show what stopping means.
    await page.waitForTimeout(3000);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.recon, .empty').first().waitFor({ timeout: 60_000 });
    await page.getByRole('button', { name: /connect the owner wallet/i }).first().click();
    await page.locator('.chip-owner').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(1500);
    await snap('agent-has-no-permission');
  }

  if (FUND) {
    const before = await page.locator('.dk-side .big').nth(1).innerText();
    await page.locator('.fund input').fill(FUND);
    await page.waitForTimeout(600);
    await snap('add-funds');
    await page.getByRole('button', { name: 'Add funds' }).click();
    if (LIVE) {
      await page.locator('.fund input').and(page.locator('[value=""]')).waitFor({ timeout: 180_000 });
      await page.waitForFunction((b: string) => (document.querySelectorAll('.dk-side .big')[1] as HTMLElement | undefined)?.innerText !== b, before, { timeout: 90_000 });
      await page.waitForTimeout(1200);
      await snap('funded');
    } else {
      await page.waitForTimeout(1500);
      await snap('add-funds-declined-dry');
    }
  }

  await page.getByRole('button', { name: /new payslip/i }).click();
  await page.locator('.draft-book').waitFor();
  await page.getByLabel('Line 1 payee name').fill(NAME);
  await page.getByLabel('Line 1 payee address').fill(PAYEE);
  await page.getByLabel('Line 1 amount in naira').fill(NAIRA);
  await page.waitForFunction(() => !!(document.querySelector('.terms .in-amt') as HTMLInputElement | null)?.value, null, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.locator('.draft-book').scrollIntoViewIfNeeded();
  await snap('payslip-written');
  const notes = await page.locator('.draft-book .notes').allInnerTexts();
  if (notes.length) log(`desk notes: ${notes.join(' | ')}`);
  const signBtn = page.getByRole('button', { name: /sign and pay/i });
  log(`sign button enabled: ${await signBtn.isEnabled()}`);

  if (STOP) {
    // The reversal beat: with the agent stopped, the desk won't let the owner hand it a payslip.
    await page.locator('.draft-book .notes').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await snap('payslip-blocked-agent-stopped');
  } else if (LIVE) {
    await signBtn.click();
    await page.locator('.done-line, .draft-book .refusal').first().waitFor({ timeout: 240_000 });
    await page.waitForTimeout(2500);
    await snap('run-outcome');
    const outcome = await page.locator('.done-line, .draft-book .refusal').first().innerText();
    log(`outcome: ${outcome}`);
    const receipt = page.locator('.draft-book .foil-paid a.ref').first();
    if (await receipt.count()) {
      const href = await receipt.getAttribute('href');
      log(`receipt: ${SITE}${href}`);
      await receipt.click();
      await page.locator('.rc-amount, .rc-empty').first().waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500);
      await snap('receipt');
    }
  } else {
    log('dry run: stopped before signing; nothing was funded, signed or sent');
  }
  await page.waitForTimeout(1500);
} finally {
  await ctx.close();
  await browser.close();
  log(`recording and screenshots in ${out}`);
}
