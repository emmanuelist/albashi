// Albashi's mark, "Alert A": a geometric A cut flat at apex and feet, a low heavy crossbar, and a gold dot,
// the lock-screen badge for a payment that just landed (gold means a credit, as everywhere on the page).
// Geometry is shared with app/icon.svg and the generated icons; the legs are separate paths because they are
// mirror images, and one path would cancel their overlap at the apex.
export default function AlbashiMark({ className, letter = 'currentColor' }: { className?: string; letter?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path fill={letter} d="M11.55 84 L35.49 19 L49.35 19 L25.4 84 Z" />
      <path fill={letter} d="M64.6 84 L40.65 19 L54.51 19 L78.45 84 Z" />
      <rect x="27" y="58" width="36" height="9" fill={letter} />
      <circle cx="79.5" cy="24" r="10" fill="var(--credit-hi)" />
    </svg>
  );
}
