// Albashi's mark: one handwritten stroke writes an "a" and runs out into a gold dot. You sign the payslip;
// the payment lands (gold means a credit, as everywhere on the page). Explored with GPT Image 2 on Higgsfield
// (internal/design/logo/), then redrawn here as vector. app/icon.svg and the generated icons use the same path.
export default function AlbashiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <g transform="translate(-7 -4.5)">
        <path
          d="M59.2 44 C55 32 31 31 24.5 49 C18.5 65 30 76.5 42.5 70.5 C52 66 57.5 54 60 41 C58.5 53 55.5 66 61 71.5 C66.5 76.5 74 71 79 66.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="11.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="88.5" cy="60" r="7" fill="var(--credit-hi)" />
      </g>
    </svg>
  );
}
