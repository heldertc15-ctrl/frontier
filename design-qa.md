# A01 authoritative fishing attempt — visual QA

**Date:** 2026-09-26  
**Scope:** The owner-supplied fishing reference inside Frontier's existing A01 context panel. F02/F03 and other stages are outside this refinement.  
**Final result:** passed  
**Owner visual approval:** PENDING

No actionable P0/P1/P2 visual issue was found in the inspected captures. This is an independent
comparison of this run's browser captures, not owner approval or certification of the whole A01 MVP.

## Source and comparison evidence

- Source visual truth: `C:/Users/helde/AppData/Local/Temp/codex-clipboard-f25231c1-b0fd-4975-8331-d082d2eeb239.png`
  (494×491 pixels; an isolated reference panel, with no specified CSS viewport or density).
- Full-view comparison: the source and `artifacts/a01-attempt-progress/active-1440x900.jpg` were
  opened together in one comparison input. The world and HUD remain visible; progress appears
  above compact equipment and catch results, and Stop Fishing stays in the footer.
- Focused comparison: the source and `artifacts/a01-attempt-progress/active-390x844.jpg` were
  opened together at original image detail. This captures the complete narrow activity panel and
  makes its type, ring, fish silhouette, copy, equipment, results, and button readable together.
- The attempted `panel-1440x900` capture was horizontally clipped and was rejected, then removed.
  It was not used as proof of fidelity.

The source omits equipment, conditions, latest catch, and session results that the owner expressly
requires retained. Their presence makes this implementation taller and narrower than the isolated
reference. The existing desktop shell and narrow page scrolling are intentional constraints.

## Rendered evidence and density

The capturing agent measured the actual browser CSS viewports below. Browser DPR was 1.1; the
viewport-control request accounted for that ratio. The capture provider normalized/downsampled
some outputs and added outer padding in some captures. Image dimensions were independently read
from the saved JPEG files; screenshot extensions were corrected from `.png` to `.jpg`. This
review compares the app content at its displayed scale, without treating provider padding,
resampling, or antialiasing as product defects. No edited/cropped replacement image was produced.

| Evidence                         | Measured CSS viewport | Saved image pixels | Inspected state                                              |
| -------------------------------- | --------------------- | ------------------ | ------------------------------------------------------------ |
| `active-1440x900.jpg`            | 1440×900              | 1440×900           | Active, before first catch                                   |
| `active-1366x768.jpg`            | 1366×768              | 1365×768           | Active, retained catch, internally scrolling context         |
| `active-1920x1080.jpg`           | 1920×1080             | 1920×1080          | Active, retained catch, full desktop composition             |
| `active-1280x720.jpg`            | 1280×720              | 1280×720           | Active, before first catch, reachable footer                 |
| `active-390x844.jpg`             | 390×844               | 376×813            | Narrow activity panel, no catch, footer visible              |
| `active-320x640.jpg`             | 320×640               | 306×612            | Narrow world/context, scrolled to ring, sticky footer        |
| `catch-1440x900.jpg`             | 1440×900              | 1440×900           | Awarded Mackerel, 0.227 kg, one-fish summary                 |
| `no-catch-retained-1440x900.jpg` | 1440×900              | 1440×900           | No-catch result retains Mackerel and summary                 |
| `stop-confirmation-1440x900.jpg` | 1440×900              | 1440×900           | Inline Keep fishing / Stop and view catch choices            |
| `stopped-1440x900.jpg`           | 1440×900              | 1440×900           | Confirmed stop, retained catch and Session complete, no ring |

All evidence paths in the table are relative to `artifacts/a01-attempt-progress/`.

## Comparison by required surface

- **Fonts and typography:** The centered bold Fishing… heading, distinct waiting status, and muted
  explanatory line preserve the reference hierarchy in Frontier's existing UI type. The complete
  narrow panel shows no clipped labels or problematic copy wrapping. Provider resampling limits
  exact font-edge and antialiasing judgments.
- **Spacing and layout:** The ring remains the primary activity visual, with breathing room around
  the centered fish and copy. Compact loadout precedes latest catch and summary. Short desktop
  layouts use internal context scrolling with the footer kept visible. At 320px, the sticky footer
  stays reachable while the panel's remaining content is reached by scrolling.
- **Colors and tokens:** The dark blue/slate activity surface, lighter text hierarchy, subdued
  dividers, cyan progress arc, and outlined Stop control maintain the reference's restrained
  treatment within the existing shell. The ring track remains distinguishable from its filled arc.
  This screenshot review does not certify numerical contrast ratios.
- **Image quality and asset fidelity:** The small warm fish mark, cyan fish silhouette, and round-ended
  circular arc communicate the supplied composition without embedding the reference screenshot.
  Existing rod, bait, catch, and world assets remain appropriate. The chosen fish silhouette differs
  from the reference's stylized fish shape; using the existing fish asset is an acceptable scoped
  adaptation. JPEG resampling is a capture limitation, not a finding about runtime image sharpness.
- **Copy and content:** Fishing…, Your line is in the water. Good luck!, Waiting for a bite…,
  Each attempt consumes 1 bait., and Stop Fishing are present. The retained catch and species count
  stay coherent after a no-catch. Confirmation stays inline; the confirmed stopped view removes
  progress and shows Session complete with the same earned results.

## Flow steps and findings

1. **Confirmed active state — visually sound.** All documented desktop sizes preserve the world,
   HUD, activity hierarchy, and Stop footer. The extra retained information follows the owner's scope.
2. **Narrow active state — visually sound within the existing responsive shell.** The 390px capture
   shows the whole activity panel; the 320px capture shows normal page scrolling and the reachable
   sticky Stop control without horizontal content collisions.
3. **Catch then unsuccessful attempt — visually sound.** The Mackerel card and one-fish summary
   remain visible after No catch. The capturing agent reports that this sequence used an authorized
   forced catch followed by a natural no-catch result.
4. **Inline stop confirmation — visually sound.** Both choices stay in the footer region without
   covering the world. The capturing agent reports narrow keyboard Tab reached Stop, Enter opened
   this prompt, and Escape returned focus to Stop.
5. **Server-confirmed stopped result — visually sound.** Progress is absent, activity is Idle,
   and the catch/Session complete summary remains. The focused stopped heading is visibly outlined.

## Comparison history and remaining limits

One comparison pass found no actionable P0/P1/P2 differences; no visual code changes were requested
by this independent review. Additional stop and no-catch captures were inspected in the same pass.

Screenshot inspection does not establish clock accuracy, stale-response handling, persistence,
polling limits, or server authority; those require the separate tests and runtime evidence recorded
in `docs/PROJECT_STATE.md`. This reviewer did not independently operate the browser or measure
contrast, and has not claimed a dedicated screen-reader, physical touch-device, or zoom test.
Reduced-motion behavior and progress semantics require the implementation checks, rather than
inference from static images. Full-progress Checking for a bite… and connection-error states were
not among these saved visual captures. Owner visual approval and final A01 MVP verification remain
separate pending gates.

## Handoff checklist

- [x] Compare source and rendered implementation together, including a readable focused view.
- [x] Inspect all six documented CSS-size captures and supplied catch/stop states.
- [x] Evaluate typography, layout, color, asset quality, and exact activity copy.
- [x] Record provider scaling, rejected capture, and limits without attributing them to the product.
- [ ] Obtain the owner's explicit visual approval of this rendered revision.
