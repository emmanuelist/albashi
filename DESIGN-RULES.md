# Design rules

The authority for every interface in this project. Skills and tools (impeccable, Emil's motion pass, any library) work inside these rules, and the rules win any conflict. They exist because builds kept starting as a desktop picture, repaired for phones afterwards, and drifting towards a generic look.

The rules come in three parts, so an implementation preference is never mistaken for a UX principle:

1. **Product and UX:** what makes the product useful, understandable and trustworthy.
2. **Visual system:** what makes it coherent and recognisably itself.
3. **Engineering:** how it's built to work on every screen, and how that's verified.

**Exceptions.** The rules and tokens are the default. An exception is allowed when the product, accessibility or usability needs it: a trading screen denser than a landing page, a full-bleed image in `vw`. Make it deliberately, and record it in `docs/DECISIONS.md` with the reason. An exception nobody wrote down is a defect.

---

## Part 1 · Product and UX

### 1. Purpose and structure

*Why: a judge or user who can't tell what a screen is for leaves.*

- **Every screen has one primary objective,** and one primary action, which is visually obvious. Secondary actions are reachable but never compete with it.
- **Related information is grouped,** and navigation follows the product's structure, kept shallow.
- **Forms ask only what the task needs.**
- **Destructive actions state their consequence** before they run, and every failed action offers a way to recover.

### 2. Trust and transactional integrity

*Why: in payments, chains and agents, a status that's wrong is worse than a slow one. This applies the truth rules to the interface.*

- **Never show an unconfirmed transaction as done.** Pending, confirmed, failed, refused and reversed are distinct states, each with its own word and shape.
- **Optimistic UI is for interface feedback, never for settlement.** A pressed button responds at once; a payment says "pending" until the chain or the processor confirms it.
- **Show what was signed and when:** the transaction ID linked to its explorer, the timestamp, and the amount.
- **Fees and totals are shown before confirmation,** and estimated values are labelled as estimates.
- **Data says how fresh it is.** A value read from a source carries when it was read, and stale or unavailable data says so instead of showing the last number as current.

### 3. Content and microcopy

*Why: generated interfaces default to vague copy, and vague copy reads as unfinished.*

- **Buttons name the action:** "Pay 3 freelancers", not "Submit".
- **Errors say what happened and what to do next,** in plain words, never a raw code alone.
- **Empty states say what the user can do,** with the action to do it.
- **One term per concept** across the whole product: if it's a "payslip" on one screen, it's never an "invoice" on another.
- **Status words are unambiguous:** "Paid", "Refused: payee not on payslip", never "Done" or "Error".

### 4. Data and numbers

*Why: fintech, chain and developer products live or die on whether numbers can be read and trusted.*

- **Every value carries its unit and currency,** with consistent precision per kind of value, formatted with `Intl.NumberFormat`.
- **Positive and negative are distinguishable without colour:** a sign, an arrow or a word.
- **Large numbers stay readable:** grouping separators, `tabular-nums`, and compact forms (1.2M) only where precision doesn't matter.
- **Charts earn their place:** each one answers a question the user has. Never add a chart to fill space.
- **Tables sort where users need to compare,** and on phones they become a scroll container or a stacked list, chosen per table.

### 5. Accessibility

*Why: an interface people can't operate isn't finished, and judges notice broken keyboard flow and unreadable text.*

- **Contrast meets WCAG 2.2 AA:** 4.5:1 for normal text, 3:1 for large text (24 px, or about 18.7 px bold), and 3:1 for essential non-text elements: borders that identify a control, state icons, focus rings. Decorative dividers are exempt.
- **Colour is never the only signal.** A state carries a word or an icon as well (REFUSED, PAID, HELD).
- **Everything works by keyboard,** in a logical order, with a visible `:focus-visible` ring.
- **Controls have names** (visible text or `aria-label`), and images have useful `alt`, or empty `alt` when decorative.
- **Never block zoom.** The viewport tag is `width=device-width, initial-scale=1`. Never use `maximum-scale=1` or `user-scalable=no`.

---

## Part 2 · Visual system

### 6. Identity

*Why: a responsive, accessible interface can still look like every other entry. Identity is what a judge remembers.*

- **Set the direction before building screens:** the product's world, type, palette and material, chosen for this product (the hackathon skill's `reference/interface.md` covers how).
- **Draw the signature component in its domain's notation,** never as a generic card.
- **No default decoration.** Gradients, glass, heavy shadows, rounded card grids and generic dashboard layouts are used only when the product needs them, and never because they're popular.
- **References inform decisions; they're never copied.**

### 7. Type

*Why: a fixed type scale either breaks phones or wastes desktops; a fluid one with floors and ceilings fits both.*

- **Sizes are rem, made fluid with `clamp(min, preferred, max)`.** The min is the phone size, the max is the desktop size, and both are rem.
- **The scale is small and named:** display, h1, h2, h3, lede, body, small, label. Components use the names, never ad-hoc sizes.
- **Body text is at least 1rem (16 px) on phones,** and inputs too, or iOS zooms the page on focus. Supporting text stays at 0.875rem or more, and only a few labels go down to 0.75rem.
- **A phone headline fits:** around 2.25–3rem at 375 px, in four lines or fewer. If it doesn't, shorten the headline or lower the minimum.
- **Line height tightens as size grows:** around 1.5 for body, 1.1–1.2 for headlines.

### 8. Colour

*Why: raw colour values drift; semantic tokens keep meaning consistent and make a theme change a one-file job.*

- **Components use semantic tokens,** never raw values: `surface`, `surface-raised`, `text`, `text-muted`, `border`, `divider`, `accent`, `success`, `warning`, `danger`. Raw values live only in the token file.
- **One accent, with a meaning:** the primary action or the product's key state, nothing decorative.
- **State colours mean the same thing everywhere.** Red is refusal or danger; it never decorates.
- **A dark theme is a second set of the same tokens,** measured for contrast in its own right.
- **Build palettes in OKLCH,** so steps look even to the eye, and re-measure contrast whenever a token changes.

### 9. Spacing and layout rhythm

*Why: arbitrary spacing is the fastest way to make screens look designed separately.*

- **One spacing scale** in 4 px steps (0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8 rem), never arbitrary values.
- **Section spacing is fluid:** `clamp()` from the phone gap to the desktop gap.
- **More space above a heading than below it,** so it belongs to what follows.

### 10. Components and states

*Why: the happy path is a fraction of what users and judges see.*

- **Every interactive component defines its states:** default, hover, focus-visible, active, disabled, and loading where it fetches.
- **Every data view defines its states:** first visit or empty, loading (shaped like the content), error with a way out, stale data labelled with when it was read, long content, and a large number.
- **Interface feedback is immediate:** a pressed state or a local update within about 100 ms. Settlement waits for confirmation (section 2).
- **Things that look alike act alike,** on every screen.

### 11. Motion

*Why: motion that explains cause and effect helps; motion for its own sake slows everyone down.*

- **Motion shows cause and effect,** never decoration.
- **Feedback motion is short** (about 150–250 ms) and interruptible, and gestures follow springs.
- **Under `prefers-reduced-motion: reduce`, motion is removed or becomes a fade.**

---

## Part 3 · Engineering

### 12. Responsive layout

*Why: a page built as a scaled desktop picture is oversized everywhere in between, and gets repaired forever.*

- **Mobile-first, validated across the range.** 375 px is the primary design reference: write base styles for it and add `min-width` queries going up. 320 px is the mandatory minimum test, and 360 and 430 px are spot checks.
- **Layout is flow, not placement.** Flex and grid with content-sized tracks (`minmax`, `fr`, `auto-fit`). Never position page regions at percentages of a mockup, and never scale the page as one picture. A mockup guides the look, never the layout.
- **Never size type or layout as a fraction of the width:** no `calc(100vw / N)` units, and no `font-size` in raw `vw`. Viewport units are fine where the viewport is the point: full-bleed sections and backgrounds, full-screen navigation and immersive scenes (`dvh` or `svh` for heights, never `100vh`), and fluid spacing inside `clamp()`.
- **Content width is capped:** a page container around 72–80rem with at least a 1rem gutter, and running text at 45–75 characters (`max-width: 65ch`).
- **Components respond to their container** (`@container`), so a card works in a sidebar and a main column alike.
- **Long values are decided at design time:** addresses and hashes get a short form (`0x1a2b…9f0e`) or wrap inside a bounded box.
- **The page never scrolls sideways** from 320 px up. Intentional horizontal interactions are fine inside their own scroll container: data tables, code, charts, timelines, carousels, horizontal navigation.
- **Respect `env(safe-area-inset-*)`** on edge-to-edge layouts.

### 13. Touch and input

*Why: a thumb is far less precise than a cursor.*

- **Tap targets are at least 44 × 44 px on phones and tablets.** WCAG 2.2's minimum is 24 × 24 px, or smaller with enough space around it, and the audit fails anything below that. Links inside a line of text are exempt.
- **Nothing depends on hover.** Whatever hover reveals is also reachable by tap and keyboard.
- **The primary action on a phone sits within thumb reach,** never behind a menu.

### 14. Images and media

*Why: images are the usual cause of layout shift and slow first screens.*

- **Every image reserves its space** with `width` and `height` or `aspect-ratio`.
- **Images are responsive** (`next/image`, or `srcset` with `sizes`) in modern formats (AVIF or WebP). When the subject would be lost on a phone, art direction changes the crop.
- **Below-the-fold images and heavy components load lazily.**

### 15. Performance

*Why: a beautiful page that loads slowly shows a blank screen to a judge on cellular.*

- **The first screen is server-rendered and complete,** with the signature component's last state in the HTML.
- **Hold the Core Web Vitals budgets:** LCP 2.5 s or less, CLS 0.1 or less, INP 200 ms or less, on first load and after hydration. A PageSpeed Insights mobile score of 90 is the target, not a pass mark: it moves with test conditions.
- **Ship less JavaScript:** server components by default, a client component only where there's interaction.
- **Expensive effects (blur, large shadows, WebGL, scroll-linked animation) are bounded** and tested on a mid-range phone.

### 16. Internationalisation

*Why: hardcoded formats break the moment a user or judge isn't in your locale.*

- **Format numbers, currencies, dates and times with `Intl`,** never by hand, and state time zones where timing matters.
- **Layouts survive longer text:** nothing depends on a word's exact width.
- **Use logical properties** (`margin-inline`, `padding-block`), so a right-to-left layout is a setting, not a rewrite, when one is needed.

### 17. Check as you build, not at the end

*Why: everything above is cheap while building and expensive to retrofit.*

Every UI change is checked at 375 px and 1440 px before it's committed: screenshot both and look at them. Before a milestone, check 320, 375, 768, 1024, 1440 and 1920 px.

```bash
playwright-cli -s=check open http://localhost:3000
playwright-cli -s=check resize 375 812 && playwright-cli -s=check screenshot --filename=phone.png
playwright-cli -s=check resize 1440 900 && playwright-cli -s=check screenshot --filename=desktop.png
playwright-cli -s=check close
```

Then run the hackathon skill's `ui-audit.mjs` on the deployed URL. It enforces sections 5, 7, 12, 13 and 15 at 320, 375, 768 and 1440 px.
