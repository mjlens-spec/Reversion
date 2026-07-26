# IME Matrix Fixture (do not hand-edit without updating helpers/positions.ts)

This document exists solely to give the E3 task-1 IME automation suite one
stable, uniquely-markered spot per matrix-A input position (see
outputs/E3执行简报草案_Claude_260726.md §3.2). Every `MARK-*` token below is
looked up verbatim by `helpers/ime.ts`'s `placeCaretAtMarker()` — do not
rename a token without updating the matching entry in
`helpers/positions.ts`, and keep every token unique in the whole file (the
lookup takes the first and only match).

Runtime copies of this file live under an isolated temp directory per spec
file (see `helpers/ime-fixture.ts`) — the checked-in copy here is never
opened directly, so autosave-driven writes (matrix B10) can never touch it.

## MARK-A7-HEADING a heading for composition

A2-plain-lead-in. MARK-A2-BEFORE中文MARK-A2-AFTER a sentence with existing
Chinese text on both sides, for mid-sentence insertion. MARK-A1-START a
plain sentence ending right here for end-of-paragraph appendingMARK-A1-END

This paragraph has a **MARK-A3-BOLD-TEXT**MARK-A3-AFTER-BOLD bold range for
interior and boundary composition, and a `MARK-A4-CODE-TEXT`MARK-A4-AFTER-CODE
inline code span for the same purpose.

This paragraph has an inline formula $x^2+y^2=1$MARK-A5-AFTER-MATH right
after it, and a [MARK-A6-LINK-TEXT](https://example.com/reversion) link
with text to compose inside of.

- MARK-A8-UL-ITEM unordered list item
1. MARK-A8-OL-ITEM ordered list item
- [ ] MARK-A8-TASK-ITEM task list item

| MARK-A9-CELL-1 | MARK-A9-CELL-2 |
| --- | --- |
| row2-col1 | row2-col2 |

```text
MARK-A10-CODE-LINE inside a fenced code block
second line unaffected
```

> MARK-A11-QUOTE-TEXT inside a blockquote

MARK-A12-LAST-LINE is the last real paragraph; the A12 test presses Enter
after it and composes into the freshly created empty paragraph, covering
"document-end empty paragraph."

```markathirteenlang
A13 covers the code-fence LANGUAGE INPUT box (functionType: languageInput
in codeBlockCtrl.js), a distinct content block from the code body above —
its rendered .ag-language-input span holds the fence's language token,
"markathirteenlang" itself, which the A13 test composes into directly.
```

<div class="ime-matrix-a14">MARK-A14-HTML-TEXT inside a raw HTML block</div>

MARK-B13-BASE end of this line — the B13 test presses Shift+Enter here to
create a soft line break, then composes on the fresh empty line, asserting
the first composed character isn't dropped (issue-1447-adjacent path in
inputCtrl.js only special-cases plain `insertText` events, not composition
commits — see report).

