// The desk's icons, drawn on one 20px grid with a 1.6 stroke so they read as one set.
type P = { className?: string };
const S = (d: React.ReactNode, c?: string) => (
  <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" className={c} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
);
export const Check = ({ className }: P) => S(<path d="m4.5 10.5 3.5 3.5 7.5-8" />, className);
export const Cross = ({ className }: P) => S(<path d="m5.5 5.5 9 9m0-9-9 9" />, className);
export const Plus = ({ className }: P) => S(<path d="M10 4.5v11M4.5 10h11" />, className);
export const Minus = ({ className }: P) => S(<path d="M5 10h10" />, className);
export const Out = ({ className }: P) => S(<><path d="M8.5 5H5v10h10v-3.5" /><path d="M11 4h5v5M16 4l-7 7" /></>, className);
export const Wallet = ({ className }: P) => S(<><path d="M3.5 6.5h12a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15V5.5A1.5 1.5 0 0 1 4.5 4H14" /><path d="M13.5 11.5h1" /></>, className);
export const Pen = ({ className }: P) => S(<path d="M12.5 4.5 15.5 7.5 7.5 15.5H4.5v-3z" />, className);
export const Dot = ({ className }: P) => S(<circle cx="10" cy="10" r="3" fill="currentColor" stroke="none" />, className);
