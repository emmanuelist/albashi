// Textile's live USD₮ → cNGN preview for the payslip editor, held up to 30 s (lib/cached.ts) with its true read time.
import { cachedRate } from '../../lib/cached.ts';
import { toJson } from '../../lib/payslip-json.ts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rate = await cachedRate();
  if (!rate) return Response.json({ error: 'Textile is not quoting right now.' }, { status: 503 });
  return Response.json(toJson({ buyUnits: rate.buyUnits, sellUnits: rate.sellUnits, readAt: rate.readAt.toISOString() }));
}
