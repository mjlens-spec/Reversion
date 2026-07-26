# Reversion

**English** | [简体中文](README.zh-CN.md)

<img src="icon/lens-marktext-icon.png" alt="Reversion icon" width="128" align="right" />

Reversion, Chinese name `反文`, is a macOS WYSIWYG Markdown editor based on [MarkText](https://github.com/marktext/marktext) `0.19.1`. Version `1.1.0` adds inline live rendering, Finder Quick Look, two editor and export themes, and an app icon built around the calligraphic Chinese radical `攵`.

Reversion preserves MarkText's application data directory and bundle identifier so existing preferences, history, and updater continuity survive migration. The source tree does not commit MarkText binaries or `app.asar`; see [Download](#download) for the prebuilt DMG.

## Core features

- **Inline live rendering**: Muya remains in WYSIWYG mode by default. Bold, italic, links, inline code, math, and other syntax render as you type; Markdown markers appear within the active syntax range and collapse when the caret leaves it.
- **Finder Quick Look**: `Reversion.app` embeds a native macOS Quick Look Preview Extension. Select a Markdown file in Finder and press Space to preview headings, lists, block quotes, code blocks, tables, and inline formatting.
- **Bilingual product name**: English systems display `Reversion`; Simplified and Traditional Chinese systems display `反文`. The About view uses `Reversion · 反文`.

## Download

Prebuilt `arm64` macOS DMGs are published on the [Releases page](https://github.com/mjlens-spec/Reversion/releases). Starting with `1.1.0`, release files use the name `Reversion-<version>-arm64.dmg` and include Reversion, its Quick Look extension, licenses, and notices.

The app silently checks this repository's latest stable release 15 seconds after the first window opens. It asks before downloading and installing a newer version and stays quiet when already current. Reversion's Check for Updates menu remains available.

The app uses an ad-hoc signature with a stable application requirement and is **not Apple notarized**. That stable requirement lets releases validate one another; downloads are also protected by GitHub HTTPS and the SHA-512 digest in `latest-mac.yml`. On first launch, macOS Gatekeeper may require opening it from Finder with Control-click → Open.

## Themes

| Theme | Style |
| --- | --- |
| **Lens Design** | Peacock blue / wine / gold accents on a cool paper background, built on the Lens Design typography system. Large titles use Cormorant Garamond with LXGW WenKai as the CJK fallback, smaller headings use Spectral with the same LXGW WenKai fallback, and body copy uses Noto Sans / Noto Sans SC at 17 px with a 1.7 line height. |
| **Claude-like** | Warm cream paper with a terracotta accent, adapted from the Typora [Claude-like theme](https://github.com/Muyiiiii/Typora_Claude-Like_Theme). Headings use Source Serif 4 with LXGW WenKai as the CJK fallback; body text uses Source Han Sans / Noto Sans SC. |

Both themes ship in two forms:

- Built-in editor themes (`themes/lens-design-marktext.css`, `themes/claude-like-marktext.css`), injected into Reversion's theme picker.
- HTML/PDF export themes (`themes/export/lens-design.css`, `themes/export/claude-like.css`).
- Three independent reading font slots (`--reading-font-title`, `--reading-font-heading`, and `--reading-font-body`) let each theme control large titles, smaller headings, and body copy separately.
- The left sidebar opens to the current document's table of contents on startup.

## Repository layout

- `themes/` — editor and export CSS themes.
- `icon/` — app icon sources and outputs: `lens-marktext-pu-v1-source.png` (original generated source), `lens-marktext-pu-v1-alpha.png` (production source with transparent corners), `lens-marktext-icon.png` (1024 px), `lens-marktext-icon.icns`, the 1.0 production spec, and earlier drafts kept for reference.
- `patches/` — runtime CSS for inline live rendering.
- `quicklook/` — Swift source and XcodeGen definition for the native Finder Quick Look Preview Extension.
- `scripts/install-builtin-themes.sh` — backs up `app.asar`, installs the Reversion runtime, themes, bilingual branding, and Quick Look extension, then ad-hoc signs the app.
- `scripts/install-theme.sh` — backs up `preferences.json`, installs the export themes, clears Custom CSS, and selects `lens-design`.
- `scripts/build-icon.sh` — builds the `.icns` from a PNG source (requires ImageMagick: `brew install imagemagick`).
- `scripts/install-icon.sh` — backs up the Reversion app icon files, replaces them, ad-hoc signs the app, and refreshes the icon cache.
- `scripts/build-release.sh` — builds the app with a stable application requirement, updater ZIP, `latest-mac.yml`, DMG, and checksum files.

## Install from source

Install the Reversion runtime, built-in themes, branding, and Quick Look extension:

```bash
./scripts/install-builtin-themes.sh
```

Install user preferences and export themes:

```bash
./scripts/install-theme.sh
```

Build and install the icon:

```bash
./scripts/build-icon.sh
./scripts/install-icon.sh
```

The default icon source is the version 1.0 calligraphic `攵` asset. Pass another PNG or SVG path to `build-icon.sh` to build an alternate icon without changing the default.

Restart Reversion after installation. Finder and Dock icon caches can lag; quit and relaunch Reversion once if the old icon is still visible.

## Lens Design palette

- Peacock blue: `#1F566B`
- Wine: `#8E3B46`
- Gold: `#B0883E`
- Paper: `#F4F6F8`
- Text: `#15181C`
- CJK editorial font: `LXGW WenKai` (霞鹜文楷), with `Noto Serif SC` and `Songti SC` fallbacks
- Title font: `Cormorant Garamond`; heading font: `Spectral`; both fall back to LXGW WenKai for CJK glyphs
- Body/UI fonts: `Noto Sans`, `Noto Sans SC`, Apple/PingFang fallback
- Mono: `JetBrains Mono`, `SF Mono`, Menlo fallback
- Reading roles: wordmark for large titles, display for smaller headings, and sans for body copy. The editor defaults are `Cormorant Garamond`, `Spectral`, and `Noto Sans SC`, with the theme's LXGW WenKai CJK fallback chain. Override the three `--reading-font-*` variables to change them independently.
- Lens Design editor H1 uses a 700 weight so Latin and LXGW WenKai CJK titles carry the same visual weight.

## Compatibility

Reversion `1.1.0` uses the MarkText `0.19.1` macOS bundle structure:

- Default app path: `/Applications/Reversion.app`; `/Applications/MarkText.app` is accepted during initial migration
- User data: `~/Library/Application Support/marktext`
- Bundled app archive: `/Applications/Reversion.app/Contents/Resources/app.asar`

The original data path and bundle identifier are intentionally preserved for compatibility. Inspect the patcher before upgrading if upstream MarkText changes its bundle structure.

## License and notices

This project is MIT licensed. See [`LICENSE`](LICENSE) and [`NOTICE.md`](NOTICE.md) for upstream copyright, license, font, and trademark notes.

Sources:

- MarkText: https://github.com/marktext/marktext
- Typora Claude-like theme page: https://theme.typora.io/theme/Claude-Theme/
- Claude-like source theme: https://github.com/Muyiiiii/Typora_Claude-Like_Theme
