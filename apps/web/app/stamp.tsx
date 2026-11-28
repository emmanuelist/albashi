// The stamp: the one object the desk and the freelancer's receipt share. PAID in gold, only once Celo has confirmed the
// payment; REFUSED in grey, always with the reason beside it. Styles in tokens.css (.stamp).
import { Check, Cross } from './desk/icons.tsx';

export function Stamp({ kind, children, land = false }: { kind: 'paid' | 'refused'; children?: React.ReactNode; land?: boolean }) {
  return (
    <span className={`stamp${kind === 'refused' ? ' stamp-refused' : ''}${land ? ' stamp-land' : ''}`}>
      {kind === 'paid' ? <Check className="ic" /> : <Cross className="ic" />}
      {kind === 'paid' ? 'PAID' : 'REFUSED'}
      {children}
    </span>
  );
}
