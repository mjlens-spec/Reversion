# Reversion

**English** | [简体中文](README.zh-CN.md)

<img src="icon/reversion-hand-pencil-engraving_OC_0807B.png" alt="Reversion icon" width="128" align="right" />

Reversion, Chinese name `反文`, is a WYSIWYG Markdown editor for Chinese-language writing. It is based on [MarkText](https://github.com/marktext/marktext) `v0.20.0-rc.1` and its TypeScript editor engine, `@muyajs/core`, with inline live rendering, a native macOS Finder Quick Look extension, two typographic themes, an importer for Typora themes, and export to HTML, PDF, DOCX and a single long PNG.

Current release: **2.1.7**, for macOS Apple Silicon, macOS Intel, and Windows x64. Reversion keeps MarkText's application data directory and technical identifiers, so preferences, history, and updater continuity survive migration from earlier versions.

## Core features

- **Inline live rendering** — Muya stays in WYSIWYG mode by default. Bold, italic, links, inline code, and math render as you type; Markdown markers appear inside the active syntax range and collapse once the caret leaves it.
- **Dual-font reading system** — choose Western body and CJK fonts independently or keep following the active theme. The editor and HTML, PNG, PDF and print exports share the same composed font stack.
- **Chinese typography** — CJK/Latin spacing and punctuation trimming stay in the render layer without changing Markdown source; context-aware smart quotes and a Chinese Typography Cleanup command handle actual input.
- **Reading controls and immersive writing** — body size, column width, line height and paragraph spacing are independent; focus and typewriter modes add input-only centering, IME protection and virtual document-edge space.
- **Semantic minimap** — a narrow right-edge overview maps headings, paragraphs, code, quotes, tables and diagrams, with click, drag and a rendered-content hover magnifier.
- **Light and dark appearance** — built-in light and dark themes work with the system appearance; Claude like and Lens Design keep their original light designs, while imported Typora themes and all exports also remain predictably light.
- **Bilingual command palette** — `Command+Shift+P` searches commands, recent files and current-folder files in English or Chinese; `Command+K` remains assigned to the table of contents.
- **Typora theme import** — Theme ▸ Import Theme (Typora compatible) converts a Typora theme's CSS, in the app, into a Reversion editor theme plus a matching HTML/PDF export theme, and writes a compatibility report listing anything it could not map. The same pipeline is available as `scripts/import-typora-theme.mjs`. Verified against six of Typora's built-in themes.
- **Export** — HTML, PDF, DOCX and a single long PNG. HTML and PDF carry the export themes, fonts, TOC and header/footer settings; DOCX goes through pandoc into native Word structures; PNG renders the whole document as one unpaginated image.
- **Finder Quick Look** — the app bundles a native macOS Quick Look Preview Extension. Select a Markdown file in Finder and press Space to preview headings, lists, block quotes, code blocks, tables, and inline formatting.
- **Diagrams and math** — Mermaid 11, Vega-Lite, PlantUML, flowchart.js, and KaTeX.
- **Full-text search** — ripgrep-backed project search with exclusion rules and symlink handling.
- **Bilingual product name** — English systems show `Reversion`, Simplified and Traditional Chinese systems show `反文`. The About view uses `Reversion · 反文`.

## Download

Prebuilt installers are on the [Releases page](https://github.com/mjlens-spec/Reversion/releases):

- Windows 10 / 11 x64: `Reversion-<version>-windows-x64-setup.exe`
- Intel Mac: `Reversion-<version>-x64.dmg`
- Apple Silicon Mac: `Reversion-<version>-arm64.dmg`

The same release includes macOS updater ZIPs, a Windows differential-update file, `latest-mac.yml`, `latest.yml`, and SHA-256 checksums.

The app checks this repository for a newer stable release 15 seconds after the first window opens and stays quiet when already current. When an update is found, a compact progress card shows percentage, transfer size, speed and remaining time without blocking the editor. Reversion asks before restarting, protects unsaved documents, and shows the release notes once after the new version opens. **Reversion → Check for Updates** works at any time.

The macOS app is ad-hoc signed with a stable application requirement and is **not Apple notarized**. The stable requirement is what lets one release validate the next; downloads are additionally covered by GitHub HTTPS and the SHA-512 digest in `latest-mac.yml`. On first launch macOS Gatekeeper may require Control-click → Open in Finder. The Windows installer is currently unsigned and may show an “Unknown publisher” SmartScreen warning; download it only from this repository's Releases page and verify the included SHA-256 checksum.

## What's new in 2.1.7

- Fixed export dialogs opening as a blank white window, which blocked PDF, HTML, DOCX and PNG export before any progress or controls could appear.
- Added a production-rendering regression test that verifies the dialog is painted, receives pointer input, and never collapses the renderer into a flat white frame.

## Major releases

- **2.1.0** — Chinese typography, adjustable reading geometry, focus and typewriter modes, light/dark/system appearance, and the current app icon.
- **2.0.0** — A document-first visual shell, semantic minimap, independent Western/CJK fonts, and a bilingual command palette.
- **1.9.0** — A filename-first title bar with compact folder context.
- **1.8.0** — A responsive directory tree for single-file and project navigation.
- **1.7.0** — A redesigned workspace shell, persistent tabs, focused export entry, and rebuilt selection toolbar.
- **1.6.0** — DOCX and long-PNG export.
- **1.5.0** — Expanded table and link editing.
- **1.3.0** — Migration to the TypeScript Muya engine and a complete in-app update flow.

Full notes and downloads: [Releases](https://github.com/mjlens-spec/Reversion/releases).

## Roadmap

**Later.** Inline live rendering behavior parity with Typora (caret anchoring, click targeting, link editing), table editing (row/column handles, Excel/CSV paste, wide-table scrolling), and PDF export outline and page-break control.

Known IME edge cases are recorded with reproduction notes in `tests-e2e/helpers/known-issues.ts`.

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
REVERSION_ARCH=arm64 ./scripts/build-release-from-source.sh 2.1.7
REVERSION_ARCH=x64 ./scripts/build-release-from-source.sh 2.1.7
```

Windows PowerShell:

```powershell
./scripts/build-windows-release-from-source.ps1 2.1.7
```

Artifacts land in `releases/<version>/`: macOS DMGs and updater ZIPs, the Windows installer and differential-update file, update manifests, and SHA-256 checksums.

Tests:

```bash
npm test               # contract tests: source migration, branding, release pipeline, theme transpiler
npm run test:e2e       # Playwright: launch smoke + branding checks against a packaged .app
npm run test:muya-e2e  # Playwright: the editor engine's own suite, in Chromium
```

The e2e suites drive a real packaged application and assert that the user's actual `~/Library/Application Support/marktext` directory is left byte-for-byte unchanged.

## Repository layout

- `themes/` — editor and export CSS themes.
- `scripts/build-release-from-source.sh` — macOS source → arm64 or x64 DMG / ZIP / `latest-mac.yml` / checksums.
- `scripts/build-windows-release-from-source.ps1` — Windows source → x64 installer / `latest.yml` / differential-update file / checksum.
- `scripts/import-typora-theme.mjs`, `scripts/typora-import/`, `scripts/typora-map/` — Typora theme transpiler: six-stage pipeline plus the replaceable mapping data.
- `scripts/brand-app.sh`, `scripts/build-icon.sh`, `scripts/install-icon.sh` — bundle localization and icon tooling.
- `quicklook/` — Swift source and XcodeGen definition for the Finder Quick Look Preview Extension.
- `icon/` — the current app icon source and generated production outputs.
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

- macOS application path: `/Applications/Reversion.app`
- macOS user data: `~/Library/Application Support/marktext` — deliberately unchanged from MarkText, which is what preserves existing preferences and the update chain
- macOS Bundle identifier: `com.github.marktext.marktext`, also unchanged for the same reason
- macOS: separate native Apple Silicon arm64 and Intel x64 releases
- Windows: Windows 10 / 11 x64; application data and the internal executable name retain the compatibility identifier `marktext`

## License and notices

MIT licensed. See [`LICENSE`](LICENSE) and [`NOTICE.md`](NOTICE.md) for upstream copyright, license, font, and trademark notes.

Sources:

- MarkText: https://github.com/marktext/marktext
- Typora Claude-like theme page: https://theme.typora.io/theme/Claude-Theme/
- Claude-like source theme: https://github.com/Muyiiiii/Typora_Claude-Like_Theme
