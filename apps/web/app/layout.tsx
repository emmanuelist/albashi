import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './layout-vars.css';
import './globals.css';
import './tokens.css';

// Faces chosen by metric matching against the approved comp (font-match) and by glyph coverage: the page sets
// ₦ and ₮, so both faces must carry them. The rate and actions in Inter, the SMS alerts in IBM Plex Mono.
// Both are subset to Latin plus the symbols used here and served from this project's own files (SIL OFL 1.1).
const rateFace = localFont({
  src: [
    { path: './fonts/Inter-400.woff2', weight: '400' },
    { path: './fonts/Inter-500.woff2', weight: '500' },
  ],
  variable: '--face-rate',
  display: 'swap',
});
const smsFace = localFont({
  src: [
    { path: './fonts/IBMPlexMono-Regular.woff2', weight: '400' },
    { path: './fonts/IBMPlexMono-SemiBold.woff2', weight: '600' },
  ],
  variable: '--face-sms',
  display: 'swap',
});

// Facts only (docs/EVIDENCE.md C-2, C-3): the thesis stays out of link previews until the pay-run contract proves it.
const description =
  'Payroll in naira on Celo. An agent converts USD₮ to cNGN on Textile FX and pays out from the owner’s Altana wallet, under a session the owner can revoke in one transaction.';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:5180'),
  ),
  title: 'Albashi · payroll in naira on Celo',
  description,
  openGraph: { title: 'Albashi · payroll in naira on Celo', description, type: 'website', siteName: 'Albashi' },
  twitter: { card: 'summary_large_image', title: 'Albashi · payroll in naira on Celo', description },
};

export const viewport: Viewport = { themeColor: '#2b1b4a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rateFace.variable} ${smsFace.variable}`}>
      <body>{children}</body>
    </html>
  );
}
