---
version: 1
slug: "apps-web-app-page-tsx"
primary_target: "apps/web/app/page.tsx"
related_targets: []
---

## Scope

Public proof page (Persuade): the first viewport plus one short follow-on section (how it works in three steps, verify it yourself, limits). Not the owner app.

## Audience and job

Hackathon judges (about four minutes, often on a phone) and Nigerian agency owners. In seconds they must get: Albashi pays freelancers in naira; the agent can't pay anything the owner didn't sign; here is the proof on Celo. Actions: "Run payroll" (owners) and "Try to pay someone not on the payslip" (judges, a real refusal on Celo). Until the pay-run contract exists, that refusal is the Altana session allowlist's (real); it switches to the contract's refusal once deployed.

## Proof and constraints

Every alert is a real Celo payout linked to its transaction; the rate is Textile's with its read time. No invented numbers. States: runs of 1 to 40 people, ₦5,000 to ₦2,000,000, long and short names; no run yet (last real run and when); Textile no_quote (last rate and its age); slow Celo (server-rendered last state); refusal pending, refused, error. Server-render the last known state for no-JS and link previews. Never address the viewer as the owner unless their wallet proved it.

## Direction contract

THESIS: One pay run told as the credit alerts a Nigerian freelancer waits for: every signed line lands as its own alert in the order it was paid, and the attempt that wasn't signed lands as DEBIT DECLINED. It refuses the category's split hero with a stats row and the space's stamped paper slip.

OWN-WORLD: The lock screen a payment lands on: a full-bleed photographic wallpaper from the audience's world under frosted notification cards; Albashi is the SMS sender ("ALBASHI"); alert text in a monospaced SMS face, all caps, set the way bank alerts read (Amt, Desc, Time, Ref); one Albashi accent for credits, plain grey with a strike and words for declined, so state never depends on colour.

STORY: The visitor reads the headline as the first alert, watches the run land alert by alert, opens one into its receipt (amount, rate, Celo transaction, verify link), then presses "Try to pay someone not on the payslip" and watches the declined alert arrive with its transaction.

FIRST VIEWPORT: The alert stack is the page's spine, top to bottom. The lock-screen widget area holds the live rate (USD₮ → ₦, Textile, read time), the owner's signed floor, and the two actions as plainly clickable controls. On a phone the page is the phone screen at native scale.

FORM: Credit-alert stack on a lock screen, my rank-1 grounded candidate taken as the pick card. seed:8a85a2d70a6ed7a8

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Approved comp

`.impeccable/mocks/comp-2.png` ("The rate is the clock", approved by the user 2026-11-21 on the decision page): a lock screen over Lagos at dusk; the live rate at clock scale with its source line as the date; frosted ALBASHI alerts centred; the two actions as round lock-screen buttons in the bottom corners. Known defect to raise after the hero passes, with the user: the comp strikes through the declined alert's sender as well as its message; only the message should be struck, and the refusal needs more presence.

## Memorable moment

The declined alert arriving, grey and struck through, with its Celo transaction under it.

## Open decisions

The SMS face and the accent colour (set in the build from the approved comp).
