// Per-engine known-issue registry for the IME matrix.
//
// Originally these markers lived inline in the spec files as `test.fail()` /
// `test.fixme()` calls with the reason in the message. E3 task 2 needs the
// SAME matrix to run against two engines whose defect sets differ, and a
// legacy-derived `test.fail()` reports "Expected to fail, but passed" — a
// hard failure that, in a `describe.serial` block, skips every cell after it.
// So the markers had to become engine-keyed data. They stayed data-only for
// the same reason the locating profile did: no assertion anywhere changes,
// only whether a cell is ANNOTATED as already-known-broken on that engine.
//
// Every entry is populated from an actual observed run — never from source
// review or expectation. `outcomes.md`-style provenance is kept in the reason
// string so the annotation documents WHY, not just THAT.

import { test } from '@playwright/test'
import { type EngineId, engineIdFromEnv } from './engine-profile'

/** Cells that fail deterministically on this engine. Annotated `test.fail()`. */
export type KnownIssueTable = Record<string, string>

/**
 * Cells observed to fail only some of the time. `test.fail()` cannot encode
 * these (a lucky green run reports "expected to fail but passed" as its own
 * failure), so they are annotated `test.fixme()` — skipped, and reported
 * separately. Set REVERSION_IME_OBSERVE_INTERMITTENT=1 to execute them anyway
 * for rate measurement (see matrix-b).
 */
export type IntermittentTable = Record<string, string>

const LEGACY_KNOWN: KnownIssueTable = {
  A5:
    'KNOWN ISSUE (legacy; reproducible, not flaky — byte-identical across 3 full matrix-a reruns plus a '
    + 'dedicated control run): composing right at the boundary immediately after an inline $...$ formula '
    + 'corrupts the surrounding text — the full composition buffer ("fanwen") leaks in as literal text before '
    + 'the marker, AND the committed hanzi ("反文") lands split into the MIDDLE of the following marker text '
    + 'rather than at the caret. Controls rule out task 1 fidelity limit #1 (the stochastic CDP '
    + 'composition-buffer quirk): the identical simulator call pattern is clean at a plain paragraph, at a '
    + 'blockquote, and at this same marker with edge=after.',
  A6:
    'KNOWN ISSUE (legacy): a childList (structural) DOM mutation is observed on the link\'s content span '
    + 'WHILE composition is still active (before compositionend) — something (plausibly a hover/link-tools '
    + 'popover reacting to the composing selection) inserts a node into the live subtree mid-composition. '
    + 'Committed text and caret are both correct.',
  'B1@A3':
    'KNOWN ISSUE (legacy): Enter during an active composition inside a BOLD-formatted paragraph is NOT '
    + 'swallowed as a candidate-confirm — it inserts a real paragraph break, splitting the paragraph at the '
    + 'composition point. A1 (plain paragraph) does NOT reproduce this.',
  'B1@A9':
    'KNOWN ISSUE (legacy): committed text is correct ("MARK-A9-CELL-1ceshi"), but a structural (childList) '
    + 'DOM mutation is observed on the table cell WHILE composition was still open (before compositionend).',
  'B1@A10':
    'KNOWN ISSUE (legacy, SEVERE, on-target for upstream #4851): pressing Enter during an active composition '
    + 'inside a fenced code block DROPS all content after the composed text — real data loss (丢字), not '
    + 'merely an unswallowed keypress.',
  // 'B11@A10' was here (legacy, P0): Backspace during an active composition
  // inside a fenced code block deleted a character from the WRONG place and
  // committed the composed text at the end of the block instead of at the
  // caret. Root cause was backspaceCtrl.js's codeContent branch reading the
  // MODEL cursor while keydownBinding never gated the delete path on
  // `!isComposed`. FIXED for 1.2.0 in muyajs keyboard.js (commit 69f5e7ee,
  // the legacy-engine equivalent of upstream marktext PR #4957), so the cell
  // is expected to PASS now and must not carry a test.fail() annotation.
}

const LEGACY_INTERMITTENT: IntermittentTable = {
  'B8@A3':
    'RECLASSIFIED BY E3 TASK 2 (was: intermittent ~50%). In isolation this is 100% deterministic and '
    + 'conditioned on the caret sitting INSIDE an inline-format range: 12/12 reproduced at A3 (bold) and 8/8 '
    + 'at A4 (inline code), while 0/12 reproduced at A1 (plain paragraph) and 0/8 at the A3/A4 boundary '
    + 'positions one character OUTSIDE the same ranges in the same paragraph. Neither a longer pre-undo delay '
    + '(600ms, 8/8 still reproduced) nor a 3-step composition (8/8) changes it. Kept as fixme here only '
    + 'because the ORIGINAL matrix-b row ordering (B1..B6 run at A3 first) still shows a mixed rate, which '
    + 'this annotation must not assert either way; see the task 2 report.'
}

// Populated from real muya2 runs (upstream v0.20.0-rc.1) as they are
// observed. Empty until a run says otherwise — never pre-seeded from
// upstream issue text, since the whole point of the comparison is to measure
// rather than assume.
const MUYA2_KNOWN: KnownIssueTable = {}
const MUYA2_INTERMITTENT: IntermittentTable = {}

const KNOWN: Record<EngineId, KnownIssueTable> = { legacy: LEGACY_KNOWN, muya2: MUYA2_KNOWN }
const INTERMITTENT: Record<EngineId, IntermittentTable> = {
  legacy: LEGACY_INTERMITTENT,
  muya2: MUYA2_INTERMITTENT
}

/**
 * Discovery escape hatch. A `describe.serial` block stops at the first
 * unannotated failure, so mapping an unfamiliar engine's defect set means
 * running, seeing one new failure, annotating it, and running again. Passing
 * the already-seen cells in REVERSION_IME_KNOWN_EXTRA (comma-separated, e.g.
 * `A5,B1@A10`) automates that loop without hand-editing this file on every
 * iteration — the final observed set is then written into the table above
 * with its real symptom text, which is what ships.
 */
function envExtraKnown(): KnownIssueTable {
  const raw = process.env.REVERSION_IME_KNOWN_EXTRA
  if (!raw) return {}
  const out: KnownIssueTable = {}
  for (const cell of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    out[cell] =
      'DISCOVERY RUN (REVERSION_IME_KNOWN_EXTRA): annotated only so the serial '
      + 'block continues past it and the remaining cells can be mapped. Not a '
      + 'documented finding — see the task 2 report for the graded verdict.'
  }
  return out
}

export function knownIssuesForActiveEngine(): KnownIssueTable {
  return { ...KNOWN[engineIdFromEnv()], ...envExtraKnown() }
}

/** Discovery counterpart of `envExtraKnown` for cells that turn out to be
 * FLAKY on the engine being mapped — `test.fail()` can't hold them past the
 * serial block (a green run reports "expected to fail, but passed"), so the
 * loop needs to skip them instead and measure their rate separately with
 * REVERSION_IME_OBSERVE_INTERMITTENT. Comma-separated cell list. */
function envExtraIntermittent(): IntermittentTable {
  const raw = process.env.REVERSION_IME_INTERMITTENT_EXTRA
  if (!raw) return {}
  const out: IntermittentTable = {}
  for (const cell of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    out[cell] =
      'DISCOVERY RUN (REVERSION_IME_INTERMITTENT_EXTRA): observed to fail only '
      + 'some of the time on this engine; skipped so the serial block can map the '
      + 'remaining cells. Rate measured separately — see the task 2 report.'
  }
  return out
}

export function intermittentIssuesForActiveEngine(): IntermittentTable {
  return { ...INTERMITTENT[engineIdFromEnv()], ...envExtraIntermittent() }
}

/**
 * Shared annotation helper used by every matrix spec file. Applies the
 * active engine's annotation for `cell`, if any, and nothing else — the
 * cell's assertions are untouched either way.
 *
 * REVERSION_IME_OBSERVE_INTERMITTENT=1 lifts only the `fixme` on intermittent
 * cells so their outcome gets recorded (a skipped cell contributes no row to
 * the results JSON, which makes measuring a reproduction rate by rerunning
 * impossible).
 *
 * REVERSION_IME_NO_ANNOTATIONS=1 lifts everything, for a raw "what does this
 * build actually do" pass. Note that in a `describe.serial` block a genuine
 * failure then skips the remaining cells — which is exactly why annotations
 * exist and why this is opt-in.
 */
export function annotateKnownIssue(cell: string): void {
  if (process.env.REVERSION_IME_NO_ANNOTATIONS === '1') return

  const intermittentReason = intermittentIssuesForActiveEngine()[cell]
  if (intermittentReason) {
    if (process.env.REVERSION_IME_OBSERVE_INTERMITTENT !== '1') test.fixme(true, intermittentReason)
    return
  }
  const reason = knownIssuesForActiveEngine()[cell]
  if (reason) test.fail(true, reason)
}
