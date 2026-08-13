// B1: brand-consistency cleanup contract tests.
//
// Companion to tests/source-migration.test.mjs (E1 task 3's rebrand), which
// only asserted the *original* patch's narrow scope (menu.marktext.title/
// about/hide/quit for en + zh-CN, package.json, logo, themes, TOC defaults,
// auto-update). This file guards the B1 audit's findings: the remaining
// literal "MarkText"/"luo han" residue that shipped in every one of the
// 9 locale files and a handful of source files, the two items the audit
// deliberately kept (Help > Support MarkText, and the About dialog's new
// upstream acknowledgment line), and the Help-menu / crash-reporter links
// that now point at the Reversion fork instead of upstream.
//
// See outputs/B1品牌清理报告_Claude_260726.md for the full audit list,
// dispositions, and reasoning behind each whitelist entry.
//
// Same pattern as source-migration.test.mjs: asserts against the upstream
// *source tree* directly (always runs, no build required), and cross-checks
// the compiled build:unpack artifact when present (skipped otherwise).

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
const readJson = (relativeToDesktop) => JSON.parse(read(relativeToDesktop))

const LOCALES = ['de', 'en', 'es', 'fr', 'ja', 'ko', 'pt', 'zh-CN', 'zh-TW']
const localePath = (locale) => `static/locales/${locale}.json`

const flatten = (obj, prefix = '') => {
  const out = {}
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k))
    }
  } else {
    out[prefix] = obj
  }
  return out
}

// ---------------------------------------------------------------------------
// Whole-locale-file sweep: after the fix, exactly two keys per locale may
// still contain the literal substring "MarkText" -- everything else the B1
// audit found has either been rewritten (Reversion / 反文) or deleted as a
// dead key. This is the flagship regression guard: any *new* literal
// "MarkText" string added to a locale file in the future (a new preference
// description, a new menu label, ...) will fail this test until it is
// explicitly triaged into the whitelist below.
// ---------------------------------------------------------------------------

const WHITELISTED_MARKTEXT_KEYS = new Set([
  // Locked B1 policy: the upstream GitHub Sponsors entry is kept and
  // explicitly annotated as an upstream support entry point.
  'menu.help.support',
  // New: the About dialog's upstream acknowledgment line.
  'about.basedOnMarkText'
])

test('no unreviewed literal "MarkText" residue remains in any of the 9 locale files', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  for (const locale of LOCALES) {
    const flat = flatten(readJson(localePath(locale)))
    const offenders = Object.entries(flat)
      .filter(([key, value]) => typeof value === 'string' && /marktext/i.test(value))
      .map(([key]) => key)
      .filter((key) => !WHITELISTED_MARKTEXT_KEYS.has(key))
    assert.deepEqual(offenders, [], `${locale}.json has unreviewed "MarkText" strings at: ${offenders.join(', ')}`)
  }
})

test('the two whitelisted MarkText mentions are exactly the ones the audit intended, in every locale', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  for (const locale of LOCALES) {
    const data = readJson(localePath(locale))
    assert.match(data.menu.help.support, /MarkText/, `${locale}: menu.help.support should still mention MarkText`)
    assert.match(data.about.basedOnMarkText, /MarkText/, `${locale}: about.basedOnMarkText should mention MarkText`)
  }
})

// ---------------------------------------------------------------------------
// About dialog: Reversion-attributed copyright line + upstream acknowledgment
// ---------------------------------------------------------------------------

test('About dialog copyright is attributed to Reversion (not Luo Ran) in every locale', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  for (const locale of LOCALES) {
    const { copyright } = readJson(localePath(locale)).about
    assert.match(copyright, /Reversion/, `${locale}: about.copyright should credit Reversion`)
    assert.doesNotMatch(copyright, /Luo Ran/i, `${locale}: about.copyright should not mention Luo Ran`)
    assert.match(copyright, /\{year\}/, `${locale}: about.copyright should keep the {year} interpolation`)
  }

  const about = read('src/renderer/src/components/about/index.vue')
  assert.match(about, /const basedOnMarkText = t\('about\.basedOnMarkText'\)/)
  assert.match(about, /\{\{ basedOnMarkText \}\}/)
})

test("electron-builder.yml pins NSHumanReadableCopyright to Reversion instead of falling back to package.json's author (Jocs)", (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const builderConfig = read('electron-builder.yml')
  assert.match(builderConfig, /^copyright: Copyright © 2026 Reversion$/m)
})

// ---------------------------------------------------------------------------
// Dead locale keys removed (were unreferenced by any template/component)
// ---------------------------------------------------------------------------

test('unreferenced MarkText-branded locale keys were deleted, not just left to rot', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  for (const locale of LOCALES) {
    const data = readJson(localePath(locale))
    assert.equal(data.menu.help.aboutMarkText, undefined, `${locale}: menu.help.aboutMarkText should be removed`)
    assert.equal(data.menu.marktext.marktext, undefined, `${locale}: menu.marktext.marktext should be removed`)
    assert.equal(data.menu.marktext.hideMarkText, undefined, `${locale}: menu.marktext.hideMarkText should be removed`)
    // The keys actually wired into templates/marktext.ts and templates/help.ts
    // must still be present and unaffected by the cleanup.
    assert.ok(data.menu.marktext.hide, `${locale}: menu.marktext.hide must still exist`)
    assert.ok(data.menu.help.about, `${locale}: menu.help.about must still exist`)
  }
})

// ---------------------------------------------------------------------------
// Renderer: title bar placeholder + theme preview sample link
// ---------------------------------------------------------------------------

test('title bar shows "Reversion" (not "MarkText") when no file is open', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const titleBar = read('src/renderer/src/components/titleBar/index.vue')
  assert.match(titleBar, /v-if="!filename"[\s\S]{0,120}>Reversion<\/span>/)
  assert.doesNotMatch(titleBar, />MarkText</)
})

test('theme preview sample no longer links to the upstream marktext.app domain', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const themeMd = read('src/renderer/src/prefComponents/theme/theme.md')
  assert.doesNotMatch(themeMd, /marktext\.app/)
})

// ---------------------------------------------------------------------------
// Menu links: changelog / report-bug / license -> Reversion fork;
// view-source / ask-question / markdown-reference / follow-us -> unchanged
// (deliberate whitelist -- see report for why each was kept)
// ---------------------------------------------------------------------------

test('Help menu: changelog, report-bug, and license now point at the Reversion fork', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const help = read('src/main/menu/templates/help.ts')
  assert.match(help, /shell\.openExternal\('https:\/\/github\.com\/mjlens-spec\/Reversion\/releases'\)/)
  assert.match(help, /shell\.openExternal\('https:\/\/github\.com\/mjlens-spec\/Reversion\/issues'\)/)
  assert.match(help, /shell\.openExternal\('https:\/\/github\.com\/mjlens-spec\/Reversion\/blob\/main\/LICENSE'\)/)
})

test('Help menu: view-source, ask-question, markdown-reference, and follow-us deliberately still point upstream', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const help = read('src/main/menu/templates/help.ts')
  // View Source: the Reversion-modified tree (upstream/marktext,
  // reversion/main) has not been pushed to a public repo yet -- pointing
  // here would show docs/scripts but not the app's actual source.
  assert.match(help, /shell\.openExternal\('https:\/\/github\.com\/marktext\/marktext'\)/)
  // Ask Question: the fork repo has GitHub Discussions disabled (verified
  // via `gh api repos/mjlens-spec/Reversion` -> has_discussions: false).
  assert.match(help, /shell\.openExternal\('https:\/\/github\.com\/marktext\/marktext\/discussions'\)/)
  // Markdown Reference: generic shared-engine documentation, no Reversion equivalent.
  assert.match(help, /shell\.openExternal\(\s*'https:\/\/marktext\.me\/docs\/markdown-syntax'\s*\)/)
  // Follow Us: Reversion has no social account of its own.
  assert.match(help, /shell\.openExternal\('https:\/\/twitter\.com\/marktextapp'\)/)
})

test('crash-report "Report" action files issues against the Reversion fork', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const config = read('src/main/config.ts')
  assert.match(config, /export const GITHUB_REPO_URL = 'https:\/\/github\.com\/mjlens-spec\/Reversion'/)

  const exceptionHandler = read('src/main/exceptionHandler.ts')
  assert.match(exceptionHandler, /Reversion: \$\{MARKTEXT_VERSION_STRING\}/)
  assert.doesNotMatch(exceptionHandler, /\nMarkText: /)
  // crashReporter.start's companyName should now match its sibling
  // productName field (both 'Reversion') instead of the half-migrated
  // companyName: 'marktext' the B1 audit found.
  assert.match(exceptionHandler, /companyName: 'Reversion',\s*\n\s*productName: 'Reversion',/)
})

test('CLI --version says Reversion, and --help names the real per-platform executable', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const cli = read('src/main/cli/index.ts')
  assert.match(cli, /writeLine\(`Reversion: \$\{MARKTEXT_VERSION_STRING\}`\)/)
  // Flipped by the B2 productName migration. B1 deliberately left this line as
  // the literal "Usage: marktext" because that *was* the real executable name.
  // electron-builder now derives CFBundleExecutable from
  // `productName: Reversion`, so on macOS the binary is Contents/MacOS/Reversion
  // while win/linux still pin `executableName: marktext`. The usage line has to
  // follow the truth on both, hence the platform switch rather than a flat
  // rename.
  assert.match(cli, /const executableName = process\.platform === 'darwin' \? 'Reversion' : 'marktext'/)
  assert.match(cli, /Usage: \$\{executableName\} \[commands\] \[path \.\.\.\]/)
})

// ---------------------------------------------------------------------------
// Preferences JSON-schema descriptions (internal metadata, not rendered to
// any UI -- fixed anyway for consistency, per the B1 report)
// ---------------------------------------------------------------------------

test('preferences JSON-schema descriptions no longer say MarkText', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  for (const schemaPath of [
    'src/main/preferences/schema.json',
    'src/main/dataCenter/schema.json',
    'src/main/editorBufferStore/schema.json'
  ]) {
    const raw = read(schemaPath)
    assert.doesNotMatch(raw, /MarkText/, `${schemaPath} should not mention MarkText`)
  }
})

// ---------------------------------------------------------------------------
// Hard-constraint regression guards: technical identifiers the B1 audit
// explicitly whitelisted (do NOT touch) must remain exactly as-is.
// ---------------------------------------------------------------------------

test('technical identifiers the B1 audit whitelisted are still untouched', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  // keytar Keychain service name -- changing this would orphan any secret
  // an existing user already has stored under the "marktext" service.
  const dataCenter = read('src/main/dataCenter/index.ts')
  assert.match(dataCenter, /this\.serviceName = 'marktext'/)
  const editorBufferStore = read('src/main/editorBufferStore/index.ts')
  assert.match(editorBufferStore, /this\.serviceName = 'marktext'/)

  // Windows AppUserModelID -- taskbar/notification grouping identity,
  // analogous to appId. It remains stable as Windows packaging is introduced.
  const main = read('src/main/index.ts')
  assert.match(main, /setAppUserModelId\('com\.electron\.marktext'\)/)

  // appId / package name -- already guarded by source-migration.test.mjs,
  // re-asserted here as a one-stop B1 sanity check colocated with the rest of
  // the brand-cleanup contract.
  //
  // Note what is NOT on this list any more: electron-builder.yml's
  // `productName`. B1 listed it as a hard constraint on the strength of a
  // reproduced crash, but the crash was caused by rewriting CFBundleName
  // *after* packaging while the Helper directories kept the old name. Moving
  // productName renames both together, which is the supported path; B2 migrated
  // it to "Reversion" and verified the result end to end (V1-V7). See
  // outputs/B2产品名迁移报告_Claude_260726.md.
  const builderConfig = read('electron-builder.yml')
  assert.match(builderConfig, /^appId: com\.github\.marktext\.marktext$/m)
  const pkg = readJson('package.json')
  assert.equal(pkg.name, 'marktext')
  // Windows/Linux executable names are separate knobs from productName and stay
  // "marktext" for internal compatibility, even though user-facing installers
  // and shortcuts are branded Reversion.
  assert.match(builderConfig, /^ {2}executableName: marktext$/m)
  assert.match(builderConfig, /^ {2}executableName: 'marktext'$/m)
})

test('Windows installer surfaces are branded Reversion while technical identifiers stay stable', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const builderConfig = read('electron-builder.yml')
  const installer = fs.readFileSync(path.join(desktop, 'build', 'windows', 'installer.nsh'), 'utf8')

  assert.match(builderConfig, /artifactName: 'Reversion-\$\{version\}-windows-\$\{arch\}-setup\.\$\{ext\}'/)
  assert.match(builderConfig, /win:[\s\S]*icon: static\/icon\.png/)
  assert.match(installer, /associate Markdown files[^\n]+with Reversion/)
  assert.match(installer, /Reversion\.Document/)
  assert.match(installer, /Reversion Markdown Document/)
  assert.doesNotMatch(installer, /with MarkText\?|MarkText Markdown Document/)
  assert.match(installer, /\$INSTDIR\\marktext\.exe/)
})

test('electron-builder.yml productName is Reversion, so macOS names the bundle, executable and helpers after it', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')
  const builderConfig = read('electron-builder.yml')
  assert.match(builderConfig, /^productName: Reversion$/m)
  assert.doesNotMatch(builderConfig, /^productName: marktext$/m)
})

// ---------------------------------------------------------------------------
// Build-artifact cross-check (only runs when out/ has been built locally)
// ---------------------------------------------------------------------------

test('build:unpack output reflects the B1 fixes (not just the source tree)', (t) => {
  if (!outAvailable) {
    t.skip('packages/desktop/out not built in this environment (run pnpm run build:unpack in upstream/marktext first)')
    return
  }
  const mainFile = path.join(out, 'main', 'index.js')
  const main = fs.readFileSync(mainFile, 'utf8')
  assert.match(main, /mjlens-spec\/Reversion\/releases/)
  assert.match(main, /mjlens-spec\/Reversion\/issues/)
  assert.match(main, /mjlens-spec\/Reversion\/blob\/main\/LICENSE/)
  assert.match(main, /Reversion: \$\{/)
  assert.doesNotMatch(main, /Images from web which you used in MarkText/)

  const rendererAssets = path.join(out, 'renderer', 'assets')
  const candidate = fs
    .readdirSync(rendererAssets)
    .map((file) => path.join(rendererAssets, file))
    .find((file) => file.endsWith('.js') && fs.readFileSync(file, 'utf8').includes('basedOnMarkText'))
  assert.ok(candidate, 'expected a renderer chunk with the compiled locale strings')
  const renderer = fs.readFileSync(candidate, 'utf8')
  assert.match(renderer, /Copyright © Reversion 2026-\{year\}/)
  assert.match(renderer, /basedOnMarkText/)
  assert.doesNotMatch(renderer, /marktext\.app/)
})
