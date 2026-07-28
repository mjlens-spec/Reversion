// E1 task 3: contract tests for the source-level migration of the former
// app.asar patches (scripts/patch-asar-themes.mjs, scripts/brand-app.sh,
// scripts/install-theme.mjs, config/app-update.yml) into
// upstream/marktext (branch reversion/main). These assert against the
// upstream *source tree* directly (always runs, no build required) and,
// where a build:unpack output happens to be present, cross-check the
// compiled artifact too (skipped otherwise -- this repo does not commit
// upstream/marktext's build output).
//
// The pre-existing patch-script tests (auto-update-release, claude-like-
// font-roles, patch-asar-default-toc, reversion-features, runtime-font-
// preferences, theme-font-roles) are untouched and still exercise
// scripts/patch-asar-themes.mjs itself, which remains in the repo.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const upstream = path.join(root, 'upstream', 'marktext')
const desktop = path.join(upstream, 'packages', 'desktop')

const upstreamAvailable = fs.existsSync(desktop)
const out = path.join(desktop, 'out')
const outAvailable = upstreamAvailable && fs.existsSync(out)

const read = (relativeToDesktop) => fs.readFileSync(path.join(desktop, relativeToDesktop), 'utf8')

test('upstream/marktext checkout is present for this task', (t) => {
  if (!upstreamAvailable) {
    t.skip('upstream/marktext not checked out in this environment')
    return
  }
  assert.ok(fs.existsSync(path.join(desktop, 'package.json')))
})

// ---------------------------------------------------------------------------
// Hard constraint: appId and the legacy userData directory must never change.
// ---------------------------------------------------------------------------

test('electron-builder.yml keeps the original appId (auto-update + user data compatibility)', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const builderConfig = read('electron-builder.yml')
  assert.match(builderConfig, /^appId: com\.github\.marktext\.marktext$/m)
})

test('main/index.ts pins userData to the legacy ~/Library/Application Support/marktext directory', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const main = read('src/main/index.ts')
  assert.match(main, /reversionLegacyUserDataPath = path\.join\(app\.getPath\('appData'\), 'marktext'\)/)
  assert.match(main, /app\.setPath\('userData', reversionLegacyUserDataPath\)/)
  assert.match(main, /app\.setName\('Reversion'\)/)
})

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------

test('packages/desktop/package.json carries Reversion branding without renaming the workspace package', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.productName, 'Reversion')
  assert.match(pkg.description, /反文/)
  // Intentionally unchanged: the root workspace scripts filter on this name
  // (`pnpm --filter marktext ...`), and CI relies on that filter. It is also
  // what app-builder-lib derives updaterCacheDirName from, which is why the
  // B2 productName migration explicitly did not touch it -- productName lives
  // in electron-builder.yml and is a separate field.
  assert.equal(pkg.name, 'marktext')

  // B2: electron-builder's own productName, which is what actually names the
  // .app, its executable, its helpers and CFBundleName on macOS.
  assert.match(read('electron-builder.yml'), /^productName: Reversion$/m)
})

test('renderer About dialog and window title are rebranded', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const about = read('src/renderer/src/components/about/index.vue')
  assert.match(about, /const name = 'Reversion · 反文'/)
  const indexHtml = read('src/renderer/index.html')
  assert.match(indexHtml, /<title>Reversion<\/title>/)
})

test('app menu strings are rebranded in en/zh locales, other locale keys are untouched', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const en = JSON.parse(read('static/locales/en.json'))
  assert.equal(en.menu.marktext.title, 'Reversion')
  assert.equal(en.menu.marktext.about, 'About Reversion')
  assert.equal(en.menu.marktext.hide, 'Hide Reversion')
  assert.equal(en.menu.marktext.quit, 'Quit Reversion')
  // Untouched: matches the original patch's narrow regex-safe scope.
  assert.equal(en.menu.marktext.checkUpdates, 'Check for Updates...')

  const zhCN = JSON.parse(read('static/locales/zh-CN.json'))
  assert.equal(zhCN.menu.marktext.title, '反文')
  assert.equal(zhCN.menu.marktext.about, '关于反文')
  assert.equal(zhCN.menu.marktext.quit, '退出反文')
})

test('renderer logo asset was replaced with the Reversion icon', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const logoPath = path.join(desktop, 'src/renderer/src/assets/images/logo.png')
  assert.ok(fs.existsSync(logoPath))
  const reversionIcon = fs.readFileSync(path.join(root, 'icon', 'lens-marktext-icon.png'))
  const logo = fs.readFileSync(logoPath)
  assert.ok(reversionIcon.equals(logo), 'logo.png must match icon/lens-marktext-icon.png byte-for-byte')
})

// ---------------------------------------------------------------------------
// Theme registration
// ---------------------------------------------------------------------------

test('Lens Design and Claude-like ship as real theme asset files matching the Reversion repo copies', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  for (const [repoFile, desktopFile] of [
    ['themes/lens-design-marktext.css', 'src/renderer/src/assets/themes/lens-design.theme.css'],
    ['themes/claude-like-marktext.css', 'src/renderer/src/assets/themes/claude-like.theme.css']
  ]) {
    const repoContent = fs.readFileSync(path.join(root, repoFile), 'utf8')
    const desktopContent = read(desktopFile)
    assert.equal(desktopContent, repoContent, `${desktopFile} must match ${repoFile}`)
  }
})

test('both themes are wired into addThemeStyle(), the Preferences grid, and the View menu', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const themeUtil = read('src/renderer/src/util/theme.ts')
  assert.match(themeUtil, /case 'claude-like':\s*\n\s*themeStyleEle\.innerHTML = claudeLike\(\)/)
  assert.match(themeUtil, /case 'lens-design':\s*\n\s*themeStyleEle\.innerHTML = lensDesign\(\)/)

  const themeColor = read('src/renderer/src/util/themeColor.ts')
  assert.match(themeColor, /export const lensDesign = /)
  assert.match(themeColor, /export const claudeLike = /)

  const prefConfig = read('src/renderer/src/prefComponents/theme/config.ts')
  assert.match(prefConfig, /\{ name: 'claude-like' \}/)
  assert.match(prefConfig, /\{ name: 'lens-design' \}/)

  const menuTemplate = read('src/main/menu/templates/theme.ts')
  assert.match(menuTemplate, /label: 'Claude-like'/)
  assert.match(menuTemplate, /label: 'Lens Design'/)

  const commonTheme = read('src/common/theme.ts')
  assert.match(commonTheme, /\['lens-design', '#f4f6f8'\]/)
  assert.match(commonTheme, /\['claude-like', '#f7f6f3'\]/)
  const windowBase = read('src/main/windows/base.ts')
  assert.match(windowBase, /getThemeBackgroundColor\(theme\)/)
})

test('Lens Design is the schema default theme (was scripts/install-theme.mjs)', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const schema = JSON.parse(read('src/main/preferences/schema.json'))
  assert.equal(schema.theme.default, 'lens-design')
  assert.equal(schema.lightModeTheme.default, 'lens-design')
  // These already matched upstream defaults pre-migration; asserted here so
  // a future upstream change doesn't silently drift from what
  // install-theme.mjs (and users relying on defaults) expect.
  assert.equal(schema.sourceCodeModeEnabled.default, false)
  assert.equal(schema.autoPairMarkdownSyntax.default, true)
})

test('the first-run preference seed (not just the validation schema) defaults to Lens Design', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  // Found by the E1 task 5 e2e smoke suite (tests-e2e/smoke.spec.ts): on a
  // truly fresh userData directory, `Preference.init()`
  // (src/main/preferences/index.ts) seeds electron-store from
  // `static/preference.json` -- NOT from schema.json's per-field `default`,
  // which electron-store only consults for *validation*. The test above
  // only ever checked schema.json, so it stayed green while a real cold
  // start still landed on the upstream "light" theme. Guard both files so
  // this can't silently drift apart again.
  const staticSeed = JSON.parse(read('static/preference.json'))
  assert.equal(staticSeed.theme, 'lens-design')
  assert.equal(staticSeed.lightModeTheme, 'lens-design')
  // darkModeTheme / followSystemTheme are intentionally out of scope (see
  // E1任务3 report §2.4) -- only asserting they weren't touched.
  assert.equal(staticSeed.darkModeTheme, 'dark')
  assert.equal(staticSeed.followSystemTheme, true)
  // Same failure class, found by the beta.2 preference-crash diagnosis:
  // `Preference.init()` deletes stored keys that are absent from the seed
  // file, so the three font-role keys must exist here or every restart
  // silently resets a user's custom title/heading/body fonts.
  const schema = JSON.parse(read('src/main/preferences/schema.json'))
  for (const key of ['editorTitleFontFamily', 'editorHeadingFontFamily', 'editorBodyFontFamily']) {
    assert.equal(staticSeed[key], schema[key].default, `${key} seed must match its schema default`)
  }
})

test('independent title/heading/body font-role preferences exist end to end', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const schema = JSON.parse(read('src/main/preferences/schema.json'))
  assert.equal(schema.editorTitleFontFamily.default, 'Cormorant Garamond')
  assert.equal(schema.editorHeadingFontFamily.default, 'Spectral')
  assert.equal(schema.editorBodyFontFamily.default, 'Noto Sans SC')

  const editorVue = read('src/renderer/src/components/editorWithTabs/editor.vue')
  assert.match(editorVue, /'--editor-title-font-family': editorTitleFontFamily \|\| 'var\(--reading-font-title\)'/)
  assert.match(editorVue, /'--editor-body-font-family': editorBodyFontFamily \|\| 'var\(--reading-font-body\)'/)
  assert.match(editorVue, /watch\(editorBodyFontFamily/)
  assert.match(editorVue, /editorFontFamily: resolveEditorFont\(editorBodyFontFamily\.value\)/)

  const prefEditor = read('src/renderer/src/prefComponents/editor/index.vue')
  assert.match(prefEditor, /onSelectChange\('editorTitleFontFamily', value\)/)
  assert.match(prefEditor, /onSelectChange\('editorHeadingFontFamily', value\)/)
  assert.match(prefEditor, /onSelectChange\('editorBodyFontFamily', value\)/)
})

// ---------------------------------------------------------------------------
// Default TOC + sidebar behavior
// ---------------------------------------------------------------------------

test('layout store defaults to the table of contents and always restores into it', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const layout = read('src/renderer/src/store/layout.ts')
  assert.match(layout, /const rightColumn = ref<string>\('toc'\)/)
  assert.match(layout, /rightColumn: 'toc',\s*\n\s*showSideBar: true,\s*\n\s*showTabBar: layout\.showTabBar/)
})

test('opening a project and bootstrapping a window both land on the table of contents with the sidebar open', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const project = read('src/renderer/src/store/project.ts')
  assert.match(project, /rightColumn: 'toc',\s*\n\s*showSideBar: true,\s*\n\s*showTabBar: true/)

  const editor = read('src/renderer/src/store/editor.ts')
  assert.match(editor, /rightColumn: 'toc',\s*\n\s*showSideBar: true,\s*\n\s*showTabBar: !!tabBarVisibility/)
})

test('inline live-rendering CSS lives in the desktop global stylesheet', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const css = read('src/renderer/src/assets/styles/index.css')
  assert.match(css, /\.mu-editor \.mu-hide,\s*\n\.mu-editor \.mu-hide \.mu-highlight,\s*\n\.mu-editor \.mu-hide \.mu-selection \{/)
  assert.match(css, /opacity: 0 !important;/)
})

// ---------------------------------------------------------------------------
// Auto-update
// ---------------------------------------------------------------------------

test('electron-builder.yml declares the Reversion GitHub release feed', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const builderConfig = read('electron-builder.yml')
  assert.match(builderConfig, /publish:\s*\n\s*provider: github\s*\n\s*owner: mjlens-spec\s*\n\s*repo: Reversion/)
})

test('checkUpdates supports a silent mode used for the startup auto-check', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const actions = read('src/main/menu/actions/marktext.ts')
  assert.match(actions, /isSilentUpdateCheck = options\.silent === true/)
  assert.match(actions, /if \(win && !isSilentUpdateCheck\)/)

  const main = read('src/main/index.ts')
  assert.match(main, /app\.once\('browser-window-created', \(_event, browserWindow\) => \{/)
  assert.match(main, /setTimeout\(\(\) => checkUpdates\(browserWindow, \{ silent: true \}\), 15_000\)/)
})

// ---------------------------------------------------------------------------
// Removed legacy blocks (asar patch used to strip these; confirm they never
// existed in upstream source, i.e. there is nothing left to remove there).
// ---------------------------------------------------------------------------

test('semantic minimap and Git diff bridge have no footprint in upstream source', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const searchRoots = [path.join(desktop, 'src')]
  const offenders = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.(ts|vue|js)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf8')
        if (/semantic.?minimap|reversionSemanticMinimap|git-diff-summary/i.test(content)) {
          offenders.push(full)
        }
      }
    }
  }
  for (const dir of searchRoots) walk(dir)
  assert.deepEqual(offenders, [])
})

// ---------------------------------------------------------------------------
// Build-artifact cross-check (only runs when out/ has been built locally --
// upstream/marktext's build output is not committed to this repo).
// ---------------------------------------------------------------------------

test('build:unpack output contains the migrated theme, font-role, and TOC markers', (t) => {
  if (!outAvailable) {
    t.skip('packages/desktop/out not built in this environment (run pnpm run build:unpack in upstream/marktext first)')
    return
  }
  const rendererAssets = path.join(out, 'renderer', 'assets')
  const rendererFile = fs
    .readdirSync(rendererAssets)
    .map((file) => path.join(rendererAssets, file))
    .find((file) => file.endsWith('.js') && fs.readFileSync(file, 'utf8').includes('"lens-design"'))
  assert.ok(rendererFile, 'expected a renderer chunk registering the lens-design theme')
  const renderer = fs.readFileSync(rendererFile, 'utf8')
  assert.match(renderer, /"claude-like"/)
  assert.match(renderer, /editorTitleFontFamily/)
  assert.match(renderer, /editorHeadingFontFamily/)
  assert.match(renderer, /editorBodyFontFamily/)

  const cssFile = fs
    .readdirSync(rendererAssets)
    .map((file) => path.join(rendererAssets, file))
    .find((file) => file.endsWith('.css') && fs.readFileSync(file, 'utf8').includes('.mu-editor .mu-hide'))
  assert.ok(cssFile, 'expected a CSS chunk with the Reversion inline live-rendering rules')

  const mainFile = path.join(out, 'main', 'index.js')
  const main = fs.readFileSync(mainFile, 'utf8')
  assert.match(main, /reversionLegacyUserDataPath/)
  assert.match(main, /browser-window-created/)

  const indexHtml = fs.readFileSync(path.join(out, 'renderer', 'index.html'), 'utf8')
  assert.match(indexHtml, /<title>Reversion<\/title>/)
})
