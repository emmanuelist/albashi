---
name: Albashi
description: Payroll in naira on Celo, told as the credit alerts and pay-advice slips a payment leaves behind.
colors:
  credit-gold: "#e9b65a"
  credit-gold-deep: "#a8691c"
  credit-gold-hover: "#f0c470"
  sheet-gold: "#d8b274"
  on-gold-ink: "#26190a"
  dusk-violet: "#35204f"
  dusk-night: "#2b1b4a"
  dusk-navy: "#1c1e3e"
  frost-panel: "rgba(46, 36, 66, 0.62)"
  frost-panel-deep: "rgba(30, 26, 52, 0.72)"
  frost-alert: "rgba(62, 48, 66, 0.5)"
  frost-declined: "rgba(52, 48, 56, 0.6)"
  frost-edge: "rgba(255, 255, 255, 0.26)"
  hairline: "rgba(255, 255, 255, 0.14)"
  hairline-strong: "rgba(255, 255, 255, 0.24)"
  ink-on-photo: "#f6f6f7"
  ink-quiet: "#d1c3c8"
  desk-quiet: "#cbbfd0"
  desk-faint: "#a99db3"
  sheet-ink: "#d9d3df"
  sheet-quiet: "#a49dae"
  declined-grey: "#d4d2d6"
  warn-amber: "#f0c27a"
  error-salmon: "#f19a8a"
typography:
  rate-display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11.76vw"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.4vw, 2.75rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  figure-large:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "30px"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.2
    fontFeature: "tnum"
  record:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  stamp:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.04em"
  sms-alert:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.385
  brand:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.06em"
rounded:
  stamp: "6px"
  input: "8px"
  button: "10px"
  slip: "14px"
  alert: "18px"
  editor: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  slip: "22px"
  section: "28px"
components:
  button-primary:
    backgroundColor: "{colors.credit-gold}"
    textColor: "{colors.on-gold-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.credit-gold-hover}"
    textColor: "{colors.on-gold-ink}"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    textColor: "{colors.ink-on-photo}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.desk-quiet}"
    rounded: "{rounded.button}"
    padding: "0 18px"
    height: "44px"
  input:
    backgroundColor: "rgba(10, 8, 22, 0.45)"
    textColor: "{colors.ink-on-photo}"
    typography: "{typography.record}"
    rounded: "{rounded.input}"
    padding: "0 12px"
    height: "44px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.desk-quiet}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  slip:
    backgroundColor: "{colors.frost-panel}"
    textColor: "{colors.ink-on-photo}"
    rounded: "{rounded.slip}"
    padding: "18px 22px"
  slip-declined:
    backgroundColor: "{colors.frost-declined}"
    textColor: "{colors.declined-grey}"
    rounded: "{rounded.slip}"
    padding: "18px 22px"
  stamp-paid:
    textColor: "{colors.credit-gold}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "5px 11px 5px 8px"
  stamp-declined:
    textColor: "{colors.declined-grey}"
    typography: "{typography.stamp}"
    rounded: "{rounded.stamp}"
    padding: "5px 11px 5px 8px"
  panel:
    backgroundColor: "{colors.frost-panel}"
    textColor: "{colors.ink-on-photo}"
    rounded: "{rounded.slip}"
    padding: "18px 20px"
  alert-card:
    backgroundColor: "{colors.frost-alert}"
    textColor: "{colors.ink-on-photo}"
    typography: "{typography.sms-alert}"
    rounded: "{rounded.alert}"
    padding: "11px 13px 12px 11px"
---

# Design System: Albashi

## Overview

**Creative North Star: "The Alert and the Counterfoil"**

Albashi lives in the paperwork a Nigerian payment leaves behind. On the public page that is a phone's lock screen at dusk over Lagos: frosted notification cards from the sender ALBASHI, set like bank credit alerts. On the owner's desk it is the same dusk carried indoors: a book of pay-advice slips, each torn along a dashed perforation, whose counterfoil is stamped PAID when the pay-run contract's event is read, or DECLINED and struck when nobody signed it. Both surfaces are one world: violet-to-navy night, frosted translucent panels, one warm gold that means money arrived, and monospaced figures you could check against the chain.

The system is dark, quiet and exact. Density is moderate on the desk (laptop-first ledger, 16px body) and theatrical only in the public first viewport, where the live rate is set at lock-screen clock scale. Decoration is almost absent; character comes from the artefacts (alert, slip, perforation, stamp) and from the strict split between words (Inter) and records (IBM Plex Mono).

The two surfaces do not share one token file. The proof page defines its colours on `:root` in `globals.css` (plus a calmer set scoped to the below-the-fold reading sections); the desk redefines its own set under `.desk` in `desk.css`, borrowing only the gold, night, navy, declined grey, ink and font variables from `:root`. The frontmatter records the values both actually use; where a value belongs to one surface only, the prose says so.

**Key Characteristics:**
- Dusk violet into navy ground; never a white or neutral-grey canvas.
- Frosted, translucent panels with hairline white edges; depth by blur and tone, not shadow.
- Gold is the only accent, and it means a credit or the action that leads to one.
- Declined is grey, struck through, and always spelled out in words.
- Every figure, address, hash and alert in IBM Plex Mono; every sentence in Inter.
- One motion: a stamp landing.

## Colors

A low-saturation night palette with one warm metal accent; state is carried by words and strikes first, colour second.

### Primary
- **Credit Gold** (`credit-gold`): the only accent. PAID stamps and their counterfoil wash (gold at 10%), the gold credit-alert disc and the mark's dot on the proof page, the primary button, the owner chip's border, completed stages, and on the desk the focus ring, input caret and text selection. Its meaning is "money arrived, or this is the action that makes it arrive".
- **Deep Gold** (`credit-gold-deep`): the shadow side of the credit disc's radial gradient on the proof page. Not used as a flat fill.
- **Lit Gold** (`credit-gold-hover`): the primary button's hover. Nowhere else.
- **Reading Gold** (`sheet-gold`): a softened gold used only in the proof page's long reading sections (PASS verdicts, proven status labels, link underlines) so small gold text does not shimmer on violet.

### Neutral
- **Dusk Violet** (`dusk-violet`), **Night** (`dusk-night`), **Navy** (`dusk-navy`): the desk ground is a 172deg gradient from violet through night (34%) to navy, fixed to the first 1200px over a navy fill. Night is the proof page's body and theme colour; the reading sections sit on a darker gradient (`#1a1838` to `#191826`).
- **Frost Panel** and **Deep Frost** (`frost-panel`, `frost-panel-deep`): desk slips and side panels, and the reconciliation strip and public-check panel respectively.
- **Alert Frost** (`frost-alert`): the proof page's notification cards, tuned so 13px white text keeps 4.5:1 over the brightest sunset. **Declined Frost** (`frost-declined`) is its greyer, more opaque sibling, used by both declined alerts and declined slips.
- **Frost Edge**, **Hairline**, **Strong Hairline**: 1px white-alpha borders. Edge on frosted alert cards and lock-screen discs; hairline on desk panels, dividers and slip borders; strong hairline on buttons, chips and inputs.
- **Photo Ink** (`ink-on-photo`): primary text on both surfaces. **Quiet Ink** (`ink-quiet`) is the proof page's secondary; the desk uses its own **Desk Quiet** and **Desk Faint** for labels and metadata; the reading sections use **Sheet Ink** (about 11:1, chosen to avoid halation) and **Sheet Quiet**.
- **Declined Grey** (`declined-grey`): struck amounts, DECLINED stamps, declined alert text.
- **Warn Amber** (`warn-amber`): an ended session, the wrong-account chip, the banner and notes. It is always paired with a sentence ("ended 22 Nov 10:26 WAT").
- **Error Salmon** (`error-salmon`): invalid input borders; field error text uses a lighter `#f6b3a6`, the proof page's FAIL verdict `#ff9a8a`.
- **On-Gold Ink** (`on-gold-ink`): text on the gold primary button.

### Named Rules
**The Gold Means Money Rule.** Gold appears only where a credit landed, a check passed, or on the one action that moves money forward (and, on the desk, the keyboard focus that leads to it). Never gold for decoration, headings or a second "brand" highlight.

**The Words Before Colour Rule.** A state is never colour alone. Declined is grey plus a strike plus the word DECLINED and the contract's reason; a warning is amber plus the sentence that explains it.

**The No Daylight Rule.** Every surface sits on the dusk ground. There is no light theme and no white panel.

## Typography

**Word Font:** Inter 400/500 (with ui-sans-serif, system-ui)
**Record Font:** IBM Plex Mono 400/600 (with ui-monospace, SFMono-Regular, Menlo)

Both faces are self-hosted, subset to Latin plus ₦ and ₮, and carry both symbols.

**Character:** Inter speaks; Plex Mono records. The mono face does the work a bank alert's SMS font or a counterfoil's typed figures do, so anything that could be checked against the chain reads as typed record rather than prose.

### Hierarchy
- **Rate Display** (Inter 500, one comp pixel of 316 at desktop, about 11.8vw; 72 phone units on a phone; line-height 1): the live USD₮-to-naira rate in the proof page's first viewport, at lock-screen clock scale. One per page.
- **Headline** (Inter 500, clamp 1.75 to 2.75rem, line-height 1.12, -0.015em, max 24ch, balanced): section titles in the proof page's reading sections.
- **Title** (Inter 500, 26px desk / 22px phone, line-height 1.2): the desk's pay-run heading; 20px for the public-check sub-book.
- **Body** (Inter 400, 16px/1.5 on the desk; 1.0625rem/1.6 at 60 to 62ch in the reading sections).
- **Label** (Inter 400, 13 to 14px, desk quiet): term names in the reconciliation strip and facts list, slip line labels, panel titles (500).
- **Figure Large** (Plex Mono 600, 30px/1.15): slip amounts, the panel rate and float.
- **Figure** (Plex Mono 600, 20px/1.2): reconciliation strip values; 22px inside amount inputs.
- **Record** (Plex Mono 400, 13 to 15px): payee addresses, hashes, event refs, input text, floor and metadata lines.
- **Stamp** (Plex Mono 600, 20px, 0.04em, uppercase word): PAID and DECLINED; 14px in compact slips.
- **SMS Alert** (Plex Mono, 13px/18px on a phone, 31 comp pixels on desktop, all caps as bank alerts read, sender in 600): the proof page's notification cards and the rate line beneath the rate.
- **Brand** (Plex Mono 600, 0.04 to 0.06em tracking): the ALBASHI wordmark beside the handwritten mark.

### Named Rules
**The Typed Record Rule.** Every figure, address, hash, block number, time stamp and alert line is set in IBM Plex Mono; every sentence, label and button is set in Inter. Never a naira amount in Inter outside the rate display.

**The Tabular Rule.** Figures line up. The desk sets `tabular-nums` on its root; the proof page relies on Plex Mono's fixed widths for the same effect.

## Layout

The proof page's first viewport is a measured composition: every element sits at its position in the approved 2688 by 1520 comp, expressed as percentages, with sizes in comp pixels scaled by one unit (`100vw / 2688`). It is a full-bleed photographic wallpaper (dusk over a Lagos bridge) with a status bar, the rate and its source line centred, a vertical stack of five alerts down the middle, and two round actions in the lower corners. On a phone (below 760px or taller than 5:6) the same markup reflows into a grid: brand and network on top, rate, rate line, the alert stack, and the two actions as small frosted discs with labels beneath. One unit becomes one CSS pixel of a 390px phone, capped at 1.35px for tablets. Below the first viewport the page switches to ordinary flow in a 920px reading column, rem sizes, ruled lists and step rows.

The desk is a two-column ledger: main column plus a 340px sticky side column (top 92px), 28px gaps, max 1360px, side padding clamp(16px, 3vw, 40px), under a 64px sticky top bar. Slips stack with 12px gaps; beyond six lines they fold to one row each (6px gaps) and keep their stamp column. At 1080px the grid becomes one column ordered run first, then the agent's limits and float, then the public check; side panels tile at 240px minimum. At 680px slips stack the counterfoil under the advice (perforation turns horizontal), the reconciliation strip goes two by two, addresses shorten to `0x1234…abcd`, and the wordmark collapses to the mark.

Spacing is hand-tuned rather than a strict scale; the recurring steps are 4, 8, 12, 18, 22 and 28px.

## Elevation & Depth

Depth is atmospheric. Surfaces are translucent over the dusk ground, separated by tone and blur and edged by a white hairline; nothing casts a drop shadow. The proof page blurs its alert cards and action discs heavily (64 comp pixels, 22px on a phone, saturation 0.85); the desk blurs only its sticky top bar (16px) and lets its panels read through alpha alone.

### Shadow Vocabulary
- **Credit disc rim** (`box-shadow: inset 0 0 0 6u #9a5f17`): the inner rim of the gold credit icon on alert cards.
- **Rate-line glow** (`box-shadow: 0 0 18u 10u rgb(70 36 92 / 0.45)`): phone only, a violet halo that keeps the rate line legible over the photo.
- **Input focus halo** (`box-shadow: 0 0 0 3px rgba(233, 182, 90, 0.2)`): the desk input's focus state.

### Named Rules
**The Frost Not Shadow Rule.** A panel is lifted by translucency and a hairline edge, never by an outer drop shadow.

## Shapes

Soft but not bubbly. Radii grow with the size of the object: stamps 6px, inputs and tabs 8px, buttons and notes 10px, slips, panels and code blocks 14px, alert cards about 18px (26 comp pixels on desktop), the editor book and the check table 18 to 20px, chips fully round. Lock-screen actions and status icons are circles. The one deliberate non-rectangle is the counterfoil: a 2px dashed white line (28% alpha) with two 16px navy notches punched at its ends, so the slip reads as tearable paper. Stamps sit rotated -3deg.

## Components

### Buttons
One shape, three weights.
- **Shape:** gently rounded (10px), 44px minimum height, 18px side padding, Inter 500 15px, optional 18px line icon before the label.
- **Primary:** solid gold with dark brown text. Reserved for the money-moving action: sign and run, new payslip. Disabled primary drops to the secondary's grey, never a faded gold.
- **Secondary:** 6% white fill, strong hairline border, white text; hover raises to 11% and a 40% border.
- **Ghost:** transparent, quiet text; hover adds a 6% fill. Used for close, add a line.
- **Icon:** 40px square, transparent (remove a line).
- **States:** 0.18s transitions on the desk's standard ease; press nudges down 1px; focus is a 2px gold outline offset 2px; disabled is 45% opacity.
- **Lock-screen actions (proof page):** large frosted circles with a line glyph and an Inter label inside on desktop; on a phone a 54px frosted disc with the label beneath. Focus is a white outline.

### Chips
- **Style:** 36px pill, strong hairline border, Inter 500 14px, quiet text, optional wallet icon.
- **State:** owner connected shows white text and a gold border at 55%; wrong account or read-only shows amber text and border, with a banner sentence underneath.

### Cards / Containers
- **Side panel:** frost panel, hairline border, 14px radius, 18 by 20px padding; title in quiet Inter 14px, a Figure Large value, a quiet meta line with the source and read time.
- **Facts list:** 92px term column, hairline row rules, mono values; an ended session renders in amber with its date.
- **Empty state:** dashed strong hairline, 28px padding, a sentence and a primary action.

### Inputs / Fields
- **Style:** 44px, 8px radius, strong hairline border, dark translucent fill, Plex Mono 15px, gold caret. Amount fields set the ₦ sign inside at 22px mono with the figure in 22px mono 600.
- **Focus:** border turns gold with a 3px gold halo at 20%.
- **Error / Disabled:** salmon border with a salmon sentence below; disabled at 60% opacity. Labels in quiet Inter 14px above, hints in faint Inter 13.5px.

### Navigation
- **Desk top bar:** sticky, 64px, near-opaque night with a 16px blur and a hairline base; mark plus mono wordmark, then Desk and Proof tabs (Inter 500, quiet; hover 6% fill; current page white on a 10% fill, 8px radius), wallet chip at the right.
- **Proof page status bar:** a dark violet gradient strip carrying the brand, the network and live block in mono, and the section links.

### Desk Slip (signature)
The pay-advice slip. Left, the advice: line label (13px quiet), payee address (Record), amount (Figure Large). Right, a 290px counterfoil behind the dashed perforation with its two notches. The counterfoil holds the state:
- **PAID hh:mm:** gold-bordered stamp with a check, on a 10% gold wash, followed by the paid amount and the Paid event link.
- **DECLINED:** grey-bordered stamp with a cross; the whole slip on declined frost, the amount struck and grey, and the contract's sentence and error name beneath. A declined payee stays on the page; it is never removed.
- **Signed:** quiet Inter 600 word plus a faint note ("waiting for the agent").
- **Running:** the word with a small pulsing gold dot ("stamped when PayRun pays this line").
- **Not signed yet:** the word alone.
In compact mode (more than six lines) the stamp drops to 14px and unrotated; a declined counterfoil still takes a second line so its reason stays readable.

### Reconciliation Strip
A four-cell definition strip on deep frost with hairline dividers: Signed, Paid by PayRun, USD₮ spent, Rate got (with the signed floor beneath in faint mono). Labels in Inter 13px, values in Figure. Two by two on a phone.

### SMS Alert Card (proof page)
A frosted lock-screen notification: icon tile on the left (the Albashi app tile, a gold credit disc with a down arrow, or a grey ringed disc with a cross), sender ALBASHI and time on the head row, body in all-caps mono written the way bank alerts read (AMT, DESC, TIME, REF). A credit card links to its transaction; the declined card uses declined frost, grey text and a strike, and says DEBIT DECLINED and why. Hover brightens the edge to 50% white; focus is a white outline.

### Motion
One motion in the system: the stamp landing. When the pay-run contract's Paid event for a line is read, its stamp drops in over 0.38s on `cubic-bezier(0.16, 1, 0.3, 1)`, from 1.7x scale, -11deg and a 2px blur to rest at -3deg. A 1.4s opacity pulse marks a running line. Hovers use 0.15 to 0.18s on `cubic-bezier(0.2, 0.8, 0.2, 1)`. Under `prefers-reduced-motion` the stamp and pulses do not animate.

## Do's and Don'ts

### Do:
- **Do** set every figure, address, hash, time and alert line in IBM Plex Mono and every sentence in Inter.
- **Do** keep gold (#e9b65a) for credits, passed checks, PAID stamps and the single money-moving primary action.
- **Do** show a refusal on the page: declined frost, grey, a strike, the word DECLINED and the contract's own reason.
- **Do** put the source and read time next to every live value ("Textile FX quote, read 10:26 WAT").
- **Do** lift panels with translucency and a white hairline edge over the dusk ground.
- **Do** let only the stamp land; respect reduced motion.
- **Do** shorten addresses to `0x1234…abcd` on narrow screens rather than letting them wrap through a slip.

### Don't:
- **Don't** introduce a light theme, white panels or a neutral grey canvas.
- **Don't** use gold as a decorative highlight, a heading colour or a second brand tint.
- **Don't** show a state by colour alone; warn-amber and declined-grey always travel with words.
- **Don't** add drop shadows to panels or cards.
- **Don't** replace the slip book with a KPI row over a generic transactions table.
- **Don't** add a second animation vocabulary (slides, bounces, staggered reveals) beside the stamp.
