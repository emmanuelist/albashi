// Returns the self-relay spike's leftovers to the owner's MetaMask. Untagged: internal transfers, not product use.
import { createPublicClient, createWalletClient, http, erc20Abi, getAddress, formatUnits } from 'viem';
import { celo } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const TO = getAddress(process.env.PAYOUT_TO);
const TOKENS = [['cNGN', '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f'], ['USD₮', '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e']];
const transport = http('https://forno.celo.org');
const pub = createPublicClient({ chain: celo, transport });
const done = async (label, hash) => { const r = await pub.waitForTransactionReceipt({ hash }); console.log(`${r.status === 'success' ? '✓' : '✗'} ${label} ${hash}`); if (r.status !== 'success') process.exit(1); };

for (const key of [process.env.OWNER_KEY, process.env.AGENT_KEY]) {
  const acct = privateKeyToAccount(key);
  const w = createWalletClient({ account: acct, chain: celo, transport });
  for (const [sym, t] of TOKENS) {
    const b = await pub.readContract({ address: t, abi: erc20Abi, functionName: 'balanceOf', args: [acct.address], blockTag: 'pending' });
    if (b > 0n) await done(`${formatUnits(b, 6)} ${sym} → MetaMask`, await w.writeContract({ address: t, abi: erc20Abi, functionName: 'transfer', args: [TO, b] }));
  }
  const b = await pub.getBalance({ address: acct.address, blockTag: 'pending' });
  const { maxFeePerGas, maxPriorityFeePerGas } = await pub.estimateFeesPerGas();
  const gas = await pub.estimateGas({ account: acct.address, to: TO, value: 1n });
  const reserve = gas * maxFeePerGas;
  if (b > reserve * 2n) await done(`${formatUnits(b - reserve, 18)} CELO → MetaMask`, await w.sendTransaction({ to: TO, value: b - reserve, gas, maxFeePerGas, maxPriorityFeePerGas }));
}
