# Reversion

**English** | [简体中文](README.zh-CN.md)

<img src="icon/reversion-hand-pencil-engraving_OC_0807B.png" alt="Reversion icon" width="128" align="right" />

Reversion, Chinese name `反文`, is a macOS WYSIWYG Markdown editor for Chinese-language writing. It is based on [MarkText](https://github.com/marktext/marktext) `v0.20.0-rc.1` and its TypeScript editor engine, `@muyajs/core`, with inline live rendering, a native Finder Quick Look extension, two typographic themes, an importer for Typora themes, and export to HTML, PDF, DOCX and a single long PNG.

Current release: **2.1.1** (Apple Silicon). Reversion keeps MarkText's application data directory and bundle identifier, so preferences, history, and updater continuity survive migration from earlier versions.

## Core features

- **Inline live rendering** — Muya stays in WYSIWYG mode by default. Bold, italic, links, inline code, and math render as you type; Markdown markers appear inside the active syntax range and collapse once the caret leaves it.
- **Dual-font reading system** — choose Western body and CJK fonts independently or keep following the active theme. The editor and HTML, PNG, PDF and print exports share the same composed font stack.
- **Chinese typography** — CJK/Latin spacing and punctuation trimming stay in the render layer without changing Markdown source; context-aware smart quotes and a Chinese Typography Cleanup command handle actual input.
- **Reading controls and immersive writing** — body size, column width, line height and paragraph spacing are independent; focus and typewriter modes add input-only centering, IME protection and virtual document-edge space.
- **Semantic minimap** — a narrow right-edge overview maps headings, paragraphs, code, quotes, tables and diagrams, with click, drag and a rendered-content hover magnifier.
- **Light and dark appearance** — built-in themes support Light, Dark and System; imported Typora themes and all exports remain predictably light.
- **Bilingual command palette** — `Command+Shift+P` searches commands, recent files and current-folder files in English or Chinese; `Command+K` remains assigned to the table of contents.
- **Typora theme import** — Theme ▸ Import Theme (Typora compatible) converts a Typora theme's CSS, in the app, into a Reversion editor theme plus a matching HTML/PDF export theme, and writes a compatibility report listing anything it could not map. The same pipeline is available as `scripts/import-typora-theme.mjs`. Verified against six of Typora's built-in themes.
- **Export** — HTML, PDF, DOCX and a single long PNG. HTML and PDF carry the export themes, fonts, TOC and header/footer settings; DOCX goes through pandoc into native Word structures; PNG renders the whole document as one unpaginated image.
- **Finder Quick Look** — the app bundles a native macOS Quick Look Preview Extension. Select a Markdown file in Finder and press Space to preview headings, lists, block quotes, code blocks, tables, and inline formatting.
- **Diagrams and math** — Mermaid 11, Vega-Lite, PlantUML, flowchart.js, and KaTeX.
- **Full-text search** — ripgrep-backed project search with exclusion rules and symlink handling.
- **Bilingual product name** — English systems show `Reversion`, Simplified and Traditional Chinese systems show `反文`. The About view uses `Reversion · 反文`.

## Download

Prebuilt `arm64` DMGs are on the [Releases page](https://github.com/mjlens-spec/Reversion/releases). Each release ships `Reversion-<version>-arm64.dmg` together with the updater ZIP, `latest-mac.yml`, and SHA-256 sidecars.

The app checks this repository for a newer stable release 15 seconds after the first window opens and stays quiet when already current. When an update is found, a compact progress card shows percentage, transfer size, speed and remaining time without blocking the editor. Reversion asks before restarting, protects unsaved documents, and shows the release notes once after the new version opens. **Reversion → Check for Updates** works at any time.

The app is ad-hoc signed with a stable application requirement and is **not Apple notarized**. The stable requirement is what lets one release validate the next; downloads are additionally covered by GitHub HTTPS and the SHA-512 digest in `latest-mac.yml`. On first launch macOS Gatekeeper may require Control-click → Open in Finder.

## What's new in 2.1.1

- **Documents stay visible when release notes appear.** The post-update notice no longer covers or blanks the editor, and its Escape, focus, and focus-restoration behavior is now explicit.
- **The semantic minimap magnifier reads as a thumbnail.** The panel keeps its existing size, while preview text is 3 px smaller and follows the document's selected Western and CJK fonts.
- **The macOS App Icon fits the Dock correctly.** Every ICNS slot preserves real transparency and uses the same visual safe area as standard macOS app icons.

## What's new in 2.1.0

- **Chinese typography is built in.** CJK/Latin spacing and punctuation trimming leave Markdown bytes untouched; smart quotes recognize Chinese context; the cleanup command exposes individual rules, protected regions and replacement counts.
- **Reading geometry is adjustable.** Body size, reading-column width, line height and paragraph spacing update the editor and styled exports in real time; tables stay exactly 1 px smaller than body copy.
- **Focus and typewriter modes are complete.** Typewriter mode centers only while typing by default, adapts to the viewport, protects IME composition and pauses cleanly in source mode.
- **The workspace adopts Claude Code's information density.** Body/sidebar proportions, a three-segment view switcher and narrow rounded scrollbars now share one visual rhythm; the denser outline and 32 px minimap gain a true rendered-content hover magnifier.
- **Built-in themes gain three appearance states.** Light, Dark and System cover both chrome and document content; imported themes lock to light and exports remain light.
- **A new default App Icon.** Finder, Dock, the app bundle and DMG use the approved near-white warm-paper engraving of a hand holding a pencil; explicit alternative icon choices remain intact.

## What's new in 2.0.0

- **A new document-first visual shell.** The sidebar becomes a shallow translucent floating panel; Mermaid diagrams sit in calm visual cards; highlights use flat green, blue, orange and pink color blocks; quotes use a pale tinted surface and a single accent rule.
- **A semantic minimap for long documents.** It follows the viewport, supports click and drag navigation, and withdraws in narrow windows, source mode and modal states.
- **Independent Western and CJK reading fonts.** Searchable system-font pickers include live previews, report the effective CJK face, persist across restarts and flow into every styled export.
- **A bilingual command workspace.** The upgraded palette adds three sections, recent-command ranking, document-aware disabled states, IME composition protection and reliable global Escape handling.
- **Complete localization.** New 2.0 labels are present in all ten interface languages.

## What's new in 1.9.0

- **The title bar now leads with the document name.** The active filename is bold and shown without its final extension, so it remains the clearest piece of context at a glance.
- **Folder context is compact and readable.** A muted capsule follows the filename and shows up to the three nearest folders in parent-to-child order, with restrained chevrons between levels.
- **Long paths stay inside the window chrome.** Filenames and folder levels truncate independently when space is tight, while macOS rename behavior and the unsaved-document indicator remain intact.

## What's new in 1.8.1

- **The sidebar content now has consistent breathing room.** Files, Search and TOC sit inside an 8 px inset on all four sides, matching the annotated spacing target without changing the sidebar's outer width.
- **The complete sidebar type scale is one pixel smaller.** View labels, file and folder rows, search fields and results, TOC entries, buttons and the word counter all use the same reduced hierarchy.
- **Auto-fit and scrolling remain intact.** The double-click width calculation includes the new inset, while each view retains its existing selection, disabled-state and overflow behavior.

## What's new in 1.8.0

- **Files is now a real directory tree.** Opening a document shows its surrounding folder structure instead of a flat list of open tabs. You can move to the parent folder and expand child folders without first opening a project.
- **File states stay clear.** Supported documents use the normal file treatment, unsupported formats are muted and disabled, and the active document remains visibly selected.
- **Large folders stay responsive.** Directory entries are loaded in batches, cached while moving between documents in the same folder, and expanded only when needed.
- **Safer navigation across filesystems.** Windows drive roots, UNC shares, symbolic links, unreadable folders and retry states are handled explicitly.
- **Keyboard and localized access.** Tree rows support keyboard navigation and accessible current/disabled states; all new labels and errors are available in Reversion's ten interface languages.

## What's new in 1.7.2

- **Precisely aligned sidebar controls.** The Files / Search / TOC icons now sit at the geometric center of their compact buttons while the active view still reveals its label.
- **The utility footer is back.** Settings returns to the lower-left corner, while the lower-right restores live CJK and Latin word counts with detailed totals in a tooltip.
- **A calmer settings symbol.** The former gear is replaced with a rounded linear sliders icon that matches the workspace's restrained outlined language.
- **An icon-first Export control.** The upper-right action is reduced to a tray-and-arrow symbol with a compact dropdown chevron; it stays borderless and transparent at rest, then gains a restrained highlight on hover or while its menu is open.
- **Tabs stay bounded and reachable.** The persistent tab strip now scrolls inside the available workspace width; the new-tab button remains beside the final visible tab, and switching to an overflowed tab brings it back into view.

## What's new in 1.7.0

- **A redesigned workspace shell.** The sidebar now uses a paper-toned horizontal Files / Search / TOC switcher; the active view reveals its label while inactive views stay icon-first. A persistent workspace bar keeps the sidebar toggle, tabs, new-tab button and Export action in one stable place.
- **A focused export entry point.** The upper-right action now exposes only Export, with clear enabled and disabled states and the existing HTML, PDF, DOCX and PNG routes behind it.
- **A selection toolbar rebuilt around writing.** The floating toolbar now has a full-width paragraph trigger, a paragraph submenu for plain text, headings, lists, tasks, quotes and code, plus compact inline formatting rows. Links use an independent light-blue accent; comments and AI-writing actions are intentionally absent.
- **Safer selection editing.** Cross-paragraph formatting, reverse selections, IME composition, Escape-level closing and keyboard focus behavior now share one selection-aware path.

## What's new in 1.6.2

- **Long table-of-contents entries wrap inside the sidebar.** Headings that exceed the available width now continue on the next line instead of ending in an ellipsis or creating horizontal overflow.
- **The sidebar reopens at the silver ratio.** Every app launch resets the table-of-contents sidebar and editor to `1 : 2.414`. Dragging still adjusts the width for the current session, and narrow windows retain the 220 px safety minimum.

## What's new in 1.6.1

- **The table toolbar no longer covers the export dialog.** With the dialog open, moving the pointer across it found the table painted behind and popped the engine's column toolbar on top, hiding the tabs and options. The editor is dropped from hit-testing while a dialog is up.
- **The export dialog has a cancel button.** Escape or a click outside were the only ways out; a quiet Cancel now sits beside Export, and the settings you changed are kept either way.

## What's new in 1.6.0

- **Export as DOCX.** File → Export → Export as DOCX converts from the markdown source: headings, lists, tables, quotes and code blocks become native Word structures, math becomes native Word equations (OMML) you can keep editing, `[TOC]` becomes a Word table-of-contents field, and relative image paths resolve against the document's own folder. The conversion is done by pandoc, which you install yourself (`brew install pandoc`); the export says so when it is missing. Word owns the styling, so the page, theme and font settings in the export dialog do not apply to it.
- **Export as PNG (long image).** File → Export → Export as PNG renders the whole document into one tall, unpaginated image. The export dialog gains an "Image" tab: image width (400–2000 px), resolution (standard 1x or HiDPI 2x), margin and background colour. Styling follows the export theme and font settings, exactly as HTML export does, and the image is cropped to the article's real height.
- **A new app icon.** Handwritten W on newsprint, used by Finder, the Dock and the installer alike. The "App icon" picker now offers five. Anyone still on the previous default is moved to the new icon; a deliberate pick is left alone.

1.5.2 brought the app-icon picker and the single-bar quotes; 1.5.1 brought the double-click sidebar auto-fit and the wider reading columns.

Full notes: [Releases](https://github.com/mjlens-spec/Reversion/releases/tag/v2.1.1).

## Roadmap

**Later.** Inline live rendering behavior parity with Typora (caret anchoring, click targeting, link editing), table editing (row/column handles, Excel/CSV paste, wide-table scrolling), and PDF export outline and page-break control.

Known limitations are tracked in the repository's planning documents; a handful of IME edge cases are recorded with reproduction notes in `tests-e2e/helpers/known-issues.ts`.

## Themes

| Theme | Style |
| --- | --- |
| **Lens Design** | Peacock blue / wine / gold accents on cool paper, built on the Lens Design typography system. Large titles use Cormorant Garamond with LXGW WenKai as the CJK fallback, smaller headings use Spectral with the same fallback, and body copy uses Noto Sans / Noto Sans SC at 17 px with a 1.7 line height. |
| **Claude-like** | Warm cream paper with a terracotta accent, adapted from the Typora [Claude-like theme](https://github.com/Muyiiiii/Typora_Claude-Like_Theme). Headings use Source Serif 4 with LXGW WenKai as the CJK fallback; body text uses Source Han Sans / Noto Sans SC. |

Both themes exist in two forms: a built-in editor theme in the theme picker, and an HTML/PDF export theme under `themes/export/`. Each exposes `--reading-font-title`, `--reading-font-heading`, and `--reading-font-body`; override those three variables to change title, heading, and body faces independently. The sidebar opens to the current document's table of contents on startup.

### Importing a Typora theme

```bash
node scripts/import-typora-theme.mjs <typora-theme.css> --name <name> --out-dir <dir>
```

This writes `<name>-marktext.css` (editor), `export/<name>.css` (HTML/PDF), and `<name>-report.md` — the report lists dropped rules, unmapped selectors and variables, and a coverage figure. Themes that lean on Typora-specific DOM structure or bundled JavaScript will need manual touch-up; the report says which rules those are. The selector, variable, and strip tables live in `scripts/typora-map/` as plain data modules so they can be swapped wholesale when the editor engine changes.

## Building from source

The build resolves the upstream source tree, applies Reversion's commits, and produces signed artifacts. It pins Node to the version upstream releases with (see `.nvmrc`) and pnpm to the version in upstream's `packageManager` field.

```bash
./scripts/build-release-from-source.sh 2.1.1
```

Artifacts land in `releases/<version>/`: DMG, updater ZIP, `latest-mac.yml`, and SHA-256 sidecars.

Tests:

```bash
npm test               # contract tests: source migration, branding, release pipeline, theme transpiler
npm run test:e2e       # Playwright: launch smoke + branding checks against a packaged .app
npm run test:muya-e2e  # Playwright: the editor engine's own suite, in Chromium
```

The e2e suites drive a real packaged application and assert that the user's actual `~/Library/Application Support/marktext` directory is left byte-for-byte unchanged.

## Repository layout

- `themes/` — editor and export CSS themes.
- `scripts/build-release-from-source.sh` — source → DMG / ZIP / `latest-mac.yml` / checksums.
- `scripts/import-typora-theme.mjs`, `scripts/typora-import/`, `scripts/typora-map/` — Typora theme transpiler: six-stage pipeline plus the replaceable mapping data.
- `scripts/brand-app.sh`, `scripts/build-icon.sh`, `scripts/install-icon.sh` — bundle localization and icon tooling.
- `quicklook/` — Swift source and XcodeGen definition for the Finder Quick Look Preview Extension.
- `icon/` — app icon sources and outputs, including the 1.0 production spec and earlier drafts.
- `tests/`, `tests-e2e/` — contract tests and Playwright suites.
- `config/` — `app-update.yml` (the single source of truth for the update feed) and the bundle's localized `InfoPlist` strings.
- `patches/` — runtime CSS for inline live rendering, kept in sync with the source tree.

Editor source lives in a fork of upstream MarkText that is not committed here; this repository holds the customizations, themes, tooling, tests, and release pipeline.

## Lens Design palette

- Peacock blue `#1F566B` · Wine `#8E3B46` · Gold `#B0883E` · Paper `#F4F6F8` · Text `#15181C`
- CJK editorial font: `LXGW WenKai` (霞鹜文楷), falling back to `Noto Serif SC` and `Songti SC`
- Title font `Cormorant Garamond`, heading font `Spectral` — both fall back to LXGW WenKai for CJK glyphs
- Body / UI: `Noto Sans`, `Noto Sans SC`, Apple / PingFang fallback · Mono: `JetBrains Mono`, `SF Mono`, Menlo
- Lens Design H1 uses a 700 weight so Latin and LXGW WenKai CJK titles carry the same visual weight

## Compatibility

- App path: `/Applications/Reversion.app`
- User data: `~/Library/Application Support/marktext` — deliberately unchanged from MarkText, which is what preserves existing preferences and the update chain
- Bundle identifier: `com.github.marktext.marktext`, also unchanged for the same reason
- Apple Silicon only; Intel and Universal builds are not currently produced

## License and notices

MIT licensed. See [`LICENSE`](LICENSE) and [`NOTICE.md`](NOTICE.md) for upstream copyright, license, font, and trademark notes.

Sources:

- MarkText: https://github.com/marktext/marktext
- Typora Claude-like theme page: https://theme.typora.io/theme/Claude-Theme/
- Claude-like source theme: https://github.com/Muyiiiii/Typora_Claude-Like_Theme
