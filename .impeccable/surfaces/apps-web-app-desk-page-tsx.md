---
version: 1
slug: "apps-web-app-desk-page-tsx"
primary_target: "apps/web/app/desk/page.tsx"
related_targets: []
---

## Scope

The owner desk at /desk (Operate). Anyone can open it read-only; writing, signing and running unlock when the owner's wallet connects (MetaMask; the demo owner is the test owner 0x0Eca…D4B1). Laptop first for writing a payslip; the phone shows the run and its state. Not the public proof page.

## Audience and job

Agency owners: write a payslip (payee address, naira amount per line), see the live Textile rate and set the floor, sign it once in their wallet, let the agent run it, and see each line paid exactly as signed. Judges without a wallet: see the agency's last real run line by line, the agent's limits, and ask PayRun to pay a stranger (POST /api/try, NotSigned live).

## Proof and constraints

Every value from Celo (PayRun Ran/Paid events, float, session permissions read from the owner account), Textile (preview rate) or the signed payslip; nothing invented. States: wallet not connected / wrong account / wrong network; session live / expired / missing (expired since 22 Nov 09:27 UTC: re-grant needed before a run); float enough / short; rate unavailable; payslip empty, 1 to 40 lines, invalid address, zero amount; signing (waiting on wallet), rejected in wallet; running (PayRun judging, quoting, sending, mined), refused with PayRun's sentence, error; run paid line by line. Money as bigint base units end to end; display only rounds.

## Direction contract

THESIS: The payslip is a book of pay-advice slips: each signed line is the advice half, and PayRun's Paid event stamps its counterfoil; a payee nobody signed stays on the page, stamped DECLINED and struck, never removed. It refuses a KPI row over a generic transactions table.

OWN-WORLD: The lock screen's world at desk scale: dusk violet-to-navy ground, frosted slips with a dashed perforation, IBM Plex Mono for every figure and reference, Inter for words, gold (#e9b65a) only for PAID stamps and the primary action, grey with strike and words for declined. Standard web controls throughout.

STORY: The visitor sees the last run's slips with stamped counterfoils, reads the agent's limits beside them, presses Try and watches a DECLINED slip arrive from PayRun; the owner connects, writes lines, signs, and watches each counterfoil stamp as its Paid event lands.

FIRST VIEWPORT: Top bar (mark, Desk / Proof tabs, wallet chip). Under it a reconciliation strip: signed ₦, paid ₦, USD₮ spent, rate got vs floor. Main column: the slips, each advice | counterfoil; beyond six lines they collapse to one-line slips keeping the stamp column. Right column: live rate, the agent's limits (calls, float, session expiry), float. Primary action New payslip and the Try button at the column's foot.

FORM: Pay advice with counterfoils, rank 4 on my list (dealt lead), raised by the ticket wallet (stamped states that never disappear). seed:d7eb4de4d84badaa

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Memorable moment

A counterfoil taking its gold PAID stamp the moment PayRun's Paid event for that line is read from Celo; and a stranger's slip stamped DECLINED by PayRun on demand.

## Bar

Syncly (hacks-winners-proj/neromtoobad/syncly/web): token discipline, every control's busy/error/disabled state, live polling, plain specific copy, one easing curve, reduced motion respected. The desk is judged side by side against its PayDesk at the finish.

## Open decisions

Whether the editor is a panel beside the book or replaces the book while writing (decide in build; keep the signed payslip visible next to the run it starts).
