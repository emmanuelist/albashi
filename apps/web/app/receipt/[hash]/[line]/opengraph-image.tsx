// The receipt's link preview: what a freelancer sees when the agency pastes the link into WhatsApp or Telegram.
// Read from Celo like the page itself; if the run can't be read, the image says so instead of showing a number.
import { ImageResponse } from 'next/og';
import { getAddress, isHash, type Hash } from 'viem';
import { readRun } from '../../../lib/desk.ts';
import { PAYEES, PAYERS } from '../../../lib/payees.ts';
import { money, short, wat, watDay } from '../../../desk/format.ts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'An Albashi payment receipt, read from Celo';

export default async function Image({ params }: { params: Promise<{ hash: string; line: string }> }) {
  const p = await params;
  const line = Number(p.line) - 1;
  const run = isHash(p.hash) && Number.isInteger(line) && line >= 0 ? await readRun(p.hash as Hash) : null;
  const paid = run?.paid.find((x) => x.line === line);
  const to = paid ? getAddress(paid.to) : null;
  const owner = run?.payslip?.owner ? getAddress(run.payslip.owner) : null;
  const at = run ? new Date(run.at) : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#1c1e3e', color: '#f6f6f7', fontSize: 32 }}>
        <div style={{ display: 'flex', letterSpacing: 4, fontWeight: 600 }}>ALBASHI · PAYMENT RECEIPT</div>
        {paid && to && at ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 132, fontWeight: 600, color: '#e9b65a', letterSpacing: -2 }}>NGN {money(paid.amount)}</div>
            <div style={{ display: 'flex', marginTop: 24, alignItems: 'center' }}>
              <div style={{ display: 'flex', padding: '6px 16px', border: '4px solid #e9b65a', borderRadius: 8, color: '#e9b65a', fontWeight: 600, marginRight: 24 }}>PAID</div>
              <div style={{ display: 'flex' }}>{watDay(at)} {wat(at)} WAT</div>
            </div>
            <div style={{ display: 'flex', marginTop: 32, color: '#d1c3c8' }}>
              To {PAYEES[to] ?? short(to)} · from {owner ? (PAYERS[owner] ?? short(owner)) : 'the agency'}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 56 }}>{run ? 'No payment on this line' : 'Celo didn’t answer; open the link to read it'}</div>
        )}
        <div style={{ display: 'flex', color: '#d1c3c8' }}>The exact amount the agency signed, confirmed on Celo.</div>
      </div>
    ),
    size,
  );
}
