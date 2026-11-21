import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './layout-vars.css';
import './globals.css';

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

export const metadata: Metadata = {
  title: 'Albashi',
  description: 'Albashi pays your freelancers in naira, and its agent can only pay the payslip you signed.',
};

export const viewport: Viewport = { themeColor: '#2b1b4a' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${rateFace.variable} ${smsFace.variable}`}>
      <body>{children}</body>
    </html>
  );
}
