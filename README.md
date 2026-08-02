# Reversion

**English** | [简体中文](README.zh-CN.md)

<img src="icon/lens-marktext-icon.png" alt="Reversion icon" width="128" align="right" />

Reversion, Chinese name `反文`, is a macOS WYSIWYG Markdown editor for Chinese-language writing. It is based on [MarkText](https://github.com/marktext/marktext) `v0.20.0-rc.1` and its TypeScript editor engine, `@muyajs/core`, with inline live rendering, a native Finder Quick Look extension, two typographic themes, an importer for Typora themes, and export to HTML, PDF, DOCX and a single long PNG.

Current release: **1.7.0** (Apple Silicon). Reversion keeps MarkText's application data directory and bundle identifier, so preferences, history, and updater continuity survive migration from earlier versions.

## Core features

- **Inline live rendering** — Muya stays in WYSIWYG mode by default. Bold, italic, links, inline code, and math render as you type; Markdown markers appear inside the active syntax range and collapse once the caret leaves it.
- **Typography-first themes** — two built-in themes, each with three independent reading font slots so large titles, smaller headings, and body copy can use different faces, with a CJK fallback chain that does not break Latin metrics.
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

Full notes: [Releases](https://github.com/mjlens-spec/Reversion/releases/tag/v1.7.0).

## Roadmap

**Later.** Inline live rendering behavior parity with Typora (caret anchoring, click targeting, link editing), table editing (row/column handles, Excel/CSV paste, wide-table scrolling), PDF export outline and page-break control, and Chinese typography refinements (CJK/Latin spacing, punctuation compression, smart quotes).

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
./scripts/build-release-from-source.sh 1.7.0
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
