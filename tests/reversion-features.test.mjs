import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('inline live rendering preserves Muya hidden markers and active syntax feedback', () => {
  const css = read('patches/reversion-runtime.css')
  const installer = read('scripts/install-theme.mjs')
  const patcher = read('scripts/patch-asar-themes.mjs')

  assert.match(css, /\.mu-editor \.mu-hide[\s\S]*opacity: 0 !important/s)
  assert.match(css, /\.mu-editor \.mu-active \.mu-gray/)
  assert.match(css, /\.mu-editor \.mu-active \.mu-inline-rule/)
  assert.doesNotMatch(css, /#ag-editor-id|\.ag-/)
  assert.match(installer, /sourceCodeModeEnabled: false/)
  assert.match(installer, /autoPairMarkdownSyntax: true/)
  assert.match(patcher, /const reversionRuntimeCss = fs\.readFileSync/)
  assert.match(patcher, /replaceMarkedAppend\([\s\S]*Reversion runtime styles patch start/)
})

test('legacy injected minimap and background Git bridge stay removed', () => {
  const patcher = read('scripts/patch-asar-themes.mjs')
  const css = read('patches/reversion-runtime.css')

  assert.equal(fs.existsSync(path.join(root, 'patches/reversion-renderer-runtime.js')), false)
  assert.equal(fs.existsSync(path.join(root, 'patches/reversion-main-runtime.js')), false)
  assert.doesNotMatch(css, /reversion-(?:semantic-)?minimap/)
  assert.doesNotMatch(patcher, /reversion::git-diff-summary/)
  assert.doesNotMatch(patcher, /setInterval\(|MutationObserver/)
  assert.match(patcher, /removeMarkedBlock\([\s\S]*Reversion semantic minimap runtime patch start/)
  assert.match(patcher, /removeMarkedBlock\([\s\S]*Reversion Git diff bridge patch start/)
})

test('Reversion 2.0 themes render diagrams, flat highlights, and editorial quotes', () => {
  for (const themePath of ['themes/lens-design-marktext.css', 'themes/claude-like-marktext.css']) {
    const css = read(themePath)
    assert.match(css, /figure\.mu-diagram-block \.mu-diagram-preview \{[\s\S]*border-radius: 16px !important;[\s\S]*box-shadow:/)
    assert.match(css, /\.mu-container blockquote \{[\s\S]*border-left: 4px solid/)
    assert.match(css, /\.mu-container mark\[data-color='green'\] \{[\s\S]*background: rgba\(/)
    assert.match(css, /\.mu-container mark\[data-color='blue'\] \{[\s\S]*background: rgba\(/)
    assert.doesNotMatch(css, /\.mu-container mark[^}]*linear-gradient/s)
  }

  for (const themePath of ['themes/export/lens-design.css', 'themes/export/claude-like.css']) {
    const css = read(themePath)
    assert.match(css, /\.markdown-body figure\.mu-diagram-block \.mu-diagram-preview \{[\s\S]*border-radius: 16px;/)
    assert.match(css, /\.markdown-body blockquote \{[\s\S]*border-left: 4px solid/)
    assert.match(css, /\.markdown-body mark\[data-color='pink'\][^{]*\{ background: rgba\(/)
    assert.doesNotMatch(css, /\.markdown-body mark[^}]*linear-gradient/s)
  }
})

test('editor and export themes balance narrow and wide tables', () => {
  // In the editor a wide table now scrolls inside `.mu-table` (muya's
  // blockSyntax.css sets `overflow-x: auto` on the figure), so the table sizes
  // to its content and the 13px compression that used to be the only way to
  // fit it is gone. `min-width: 100%` still makes a narrow table fill the
  // column. Export keeps 100% + 13px: a printed page cannot scroll.
  for (const themePath of ['themes/lens-design-marktext.css', 'themes/claude-like-marktext.css']) {
    const css = read(themePath)
    assert.match(css, /\.mu-container table \{[\s\S]*width: max-content;[\s\S]*min-width: 100%;[\s\S]*table-layout: auto;/)
    assert.doesNotMatch(css, /\.mu-container table \{[^}]*font-size: 13px/)
    assert.match(css, /\.mu-container table th \{[\s\S]*line-height: 1\.45 !important;[\s\S]*white-space: normal;/)
    assert.match(css, /\.mu-container table td,[\s\S]*\.mu-container table th \{[\s\S]*min-width: 4\.5em;/)
    assert.match(css, /\.mu-container table td:first-child,[\s\S]*\.mu-container table th:first-child \{[\s\S]*min-width: 3\.25em;/)
    assert.match(css, /\.mu-container table td:last-child,[\s\S]*\.mu-container table th:last-child \{[\s\S]*min-width: 8\.5em;/)
    assert.match(css, /\.mu-container table td \*,[\s\S]*\.mu-container table th \* \{[\s\S]*font-size: inherit !important;[\s\S]*line-height: inherit !important;/)
    assert.doesNotMatch(css, /#ag-editor-id|\.ag-/)
  }

  for (const themePath of ['themes/export/lens-design.css', 'themes/export/claude-like.css']) {
    const css = read(themePath)
    assert.match(css, /\.markdown-body table \{[\s\S]*width: 100%;[\s\S]*table-layout: auto;[\s\S]*font-size: 13px;/)
    assert.match(css, /\.markdown-body table th \{[\s\S]*line-height: 1\.45;[\s\S]*white-space: normal;/)
    assert.match(css, /\.markdown-body table td \*,[\s\S]*font-size: inherit !important;[\s\S]*line-height: inherit !important;/)
    assert.match(css, /@media print[\s\S]*\.markdown-body table th \{[\s\S]*white-space: normal;/)
  }
})

test('Reversion branding is localized and applied to app and ASAR metadata', () => {
  const brandScript = read('scripts/brand-app.sh')
  const patcher = read('scripts/patch-asar-themes.mjs')
  const english = read('config/InfoPlist.en.strings')
  const simplifiedChinese = read('config/InfoPlist.zh-Hans.strings')
  const traditionalChinese = read('config/InfoPlist.zh-Hant.strings')

  // B2 productName migration: brand-app.sh no longer *sets* the bundle names.
  // electron-builder derives CFBundleName / CFBundleDisplayName /
  // CFBundleExecutable and the four Helper bundles from
  // `productName: Reversion`, so the script's remaining job on that front is to
  // verify them (a productName regression must fail the release, not ship a
  // bundle that silently reverts to "marktext" in the menu bar and Dock).
  assert.doesNotMatch(brandScript, /Set :CFBundleName/)
  assert.doesNotMatch(brandScript, /Set :CFBundleDisplayName/)
  assert.match(brandScript, /PRODUCT_NAME="Reversion"/)
  assert.match(brandScript, /for key in CFBundleName CFBundleDisplayName CFBundleExecutable/)
  assert.match(brandScript, /Contents\/Frameworks\/\$PRODUCT_NAME Helper\$helper\.app/)
  assert.match(brandScript, /UTImportedTypeDeclarations/)
  assert.match(brandScript, /net\.daringfireball\.markdown/)
  assert.match(brandScript, /LSItemContentTypes/)
  assert.match(english, /"CFBundleDisplayName" = "Reversion"/)
  assert.match(simplifiedChinese, /"CFBundleDisplayName" = "反文"/)
  assert.match(traditionalChinese, /"CFBundleDisplayName" = "反文"/)
  // Stage-2 boundary (deliberately out of B2's scope): none of the three
  // InfoPlist.strings files may localize CFBundleName. Electron resolves helper
  // apps from CFBundleName, and a *localized* override is an untested variant of
  // the crash B1 reproduced -- it would only break on Chinese systems. Menu bar
  // stays "Reversion" until that is verified separately.
  for (const strings of [english, simplifiedChinese, traditionalChinese]) {
    assert.doesNotMatch(strings, /CFBundleName/)
  }
  assert.match(patcher, /electron\.app\.setName\("Reversion"\)/)
  assert.match(patcher, /electron\.app\.setPath\("userData", reversionLegacyUserDataPath\)/)
  assert.match(patcher, /getPath\("appData"\), "marktext"/)
  assert.match(patcher, /const name = "Reversion · 反文"/)
  assert.match(patcher, /packageJson\.name = 'reversion'/)
  assert.match(patcher, /<title>Reversion<\/title>/)
  assert.match(patcher, /rendererLogoName/)
  assert.match(patcher, /lens-marktext-icon\.png/)
})

test('Finder Quick Look is a bundled macOS preview extension for Markdown', () => {
  const project = read('quicklook/project.yml')
  const plist = read('quicklook/Info.plist')
  const controller = read('quicklook/Sources/PreviewViewController.swift')
  const renderer = read('quicklook/Sources/ReversionMarkdownRenderer.swift')
  const entitlements = read('quicklook/ReversionQuickLook.entitlements')
  const builder = read('scripts/build-quicklook.sh')
  const releaseBuilder = read('scripts/build-release.sh')

  assert.match(project, /type: app-extension/)
  assert.match(plist, /com\.apple\.quicklook\.preview/)
  assert.match(plist, /<key>NSExtensionAttributes<\/key>[\s\S]*<key>QLSupportedContentTypes<\/key>[\s\S]*net\.daringfireball\.markdown/)
  assert.match(plist, /<key>QLIsDataBasedPreview<\/key>\s*<false\/>/)
  assert.match(controller, /QLPreviewingController/)
  assert.doesNotMatch(controller, /@objc\(PreviewViewController\)/)
  assert.match(controller, /preparePreviewOfFile\(at url: URL/)
  assert.match(renderer, /AttributedString\(markdown:/)
  assert.match(entitlements, /com\.apple\.security\.app-sandbox/)
  assert.match(entitlements, /com\.apple\.security\.files\.user-selected\.read-only/)
  assert.match(builder, /xcodebuild/)
  assert.match(builder, /ReversionQuickLook\.appex/)
  assert.match(releaseBuilder, /APP_NAME="Reversion\.app"/)
  assert.match(releaseBuilder, /build-quicklook\.sh/)
  assert.match(releaseBuilder, /codesign --force --deep --sign - "\$STAGED_APP"[\s\S]*codesign --force --sign - --requirements .*reversion-quicklook.*--entitlements .*ReversionQuickLook\.entitlements.*ReversionQuickLook\.appex/)
})
