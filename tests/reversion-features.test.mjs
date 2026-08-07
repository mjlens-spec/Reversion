import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')
const readBuffer = (relativePath) => fs.readFileSync(path.join(root, relativePath))

test('2.1.0 App Icon is controlled, transparent, and consumed by every macOS package surface', async() => {
  const source = readBuffer('icon/reversion-hand-pencil-engraving_OC_0807B.png')
  const pngTargets = [
    'upstream/marktext/packages/desktop/static/icon.png',
    'upstream/marktext/packages/desktop/static/appIcons/hand-pencil-engraving.png',
    'upstream/marktext/packages/desktop/src/renderer/src/assets/appIcons/hand-pencil-engraving.png',
    'upstream/marktext/packages/desktop/build/icons/icon.png'
  ]

  assert.equal(source.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(source.readUInt32BE(16), 1024)
  assert.equal(source.readUInt32BE(20), 1024)
  const { default: sharp } = await import('../upstream/marktext/node_modules/sharp/lib/index.js')
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const alphaAt = (x, y) => data[(y * info.width + x) * info.channels + 3]
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023]]) {
    assert.equal(alphaAt(x, y), 0, `icon corner ${x},${y} must be transparent`)
  }
  assert.equal(alphaAt(512, 512), 255, 'icon artwork must remain opaque at its center')
  let minVisibleX = info.width
  let minVisibleY = info.height
  let maxVisibleX = -1
  let maxVisibleY = -1
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (alphaAt(x, y) > 16) {
        minVisibleX = Math.min(minVisibleX, x)
        minVisibleY = Math.min(minVisibleY, y)
        maxVisibleX = Math.max(maxVisibleX, x)
        maxVisibleY = Math.max(maxVisibleY, y)
      }
    }
  }
  const visibleWidthRatio = (maxVisibleX - minVisibleX + 1) / info.width
  const visibleHeightRatio = (maxVisibleY - minVisibleY + 1) / info.height
  assert.ok(
    visibleWidthRatio >= 0.8 && visibleWidthRatio <= 0.84,
    `icon visible width must match the macOS Dock safe area, received ${visibleWidthRatio}`
  )
  assert.ok(
    visibleHeightRatio >= 0.8 && visibleHeightRatio <= 0.84,
    `icon visible height must match the macOS Dock safe area, received ${visibleHeightRatio}`
  )
  for (const target of pngTargets) {
    assert.deepEqual(readBuffer(target), source, `${target} must remain byte-identical to the approved source`)
  }

  for (const target of [
    'upstream/marktext/packages/desktop/static/icon.icns',
    'upstream/marktext/packages/desktop/build/icons/icon.icns'
  ]) {
    const icns = readBuffer(target)
    assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns')
    assert.equal(icns.readUInt32BE(4), icns.length)
    const expectedSlots = new Map([
      ['icp4', 16], ['icp5', 32], ['icp6', 64], ['ic07', 128],
      ['ic08', 256], ['ic09', 512], ['ic10', 1024]
    ])
    let offset = 8
    while (offset < icns.length) {
      const type = icns.subarray(offset, offset + 4).toString('ascii')
      const length = icns.readUInt32BE(offset + 4)
      const payload = icns.subarray(offset + 8, offset + length)
      if (expectedSlots.has(type)) {
        assert.equal(payload.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
        assert.equal(payload.readUInt32BE(16), expectedSlots.get(type), `${target} has the wrong ${type} width`)
        assert.equal(payload.readUInt32BE(20), expectedSlots.get(type), `${target} has the wrong ${type} height`)
        const slot = await sharp(payload).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
        const alphaAt = (x, y) => slot.data[(y * slot.info.width + x) * slot.info.channels + 3]
        for (const [x, y] of [
          [0, 0],
          [slot.info.width - 1, 0],
          [0, slot.info.height - 1],
          [slot.info.width - 1, slot.info.height - 1]
        ]) {
          assert.ok(alphaAt(x, y) <= 16, `${target} ${type} corner ${x},${y} must be transparent`)
        }
        let nonOpaquePixels = 0
        let minVisibleX = slot.info.width
        let minVisibleY = slot.info.height
        let maxVisibleX = -1
        let maxVisibleY = -1
        for (let index = 3; index < slot.data.length; index += slot.info.channels) {
          if (slot.data[index] < 250) nonOpaquePixels += 1
          if (slot.data[index] > 16) {
            const pixelIndex = (index - 3) / slot.info.channels
            const x = pixelIndex % slot.info.width
            const y = Math.floor(pixelIndex / slot.info.width)
            minVisibleX = Math.min(minVisibleX, x)
            minVisibleY = Math.min(minVisibleY, y)
            maxVisibleX = Math.max(maxVisibleX, x)
            maxVisibleY = Math.max(maxVisibleY, y)
          }
        }
        assert.ok(
          nonOpaquePixels > slot.info.width * slot.info.height * 0.05,
          `${target} ${type} must preserve the rounded alpha mask, not only its four corners`
        )
        const slotWidthRatio = (maxVisibleX - minVisibleX + 1) / slot.info.width
        const slotHeightRatio = (maxVisibleY - minVisibleY + 1) / slot.info.height
        assert.ok(
          slotWidthRatio >= 0.75 && slotWidthRatio <= 0.88,
          `${target} ${type} visible width must stay inside the Dock safe area`
        )
        assert.ok(
          slotHeightRatio >= 0.75 && slotHeightRatio <= 0.88,
          `${target} ${type} visible height must stay inside the Dock safe area`
        )
        expectedSlots.delete(type)
      }
      offset += length
    }
    assert.deepEqual([...expectedSlots.keys()], [], `${target} is missing ICNS slots`)
  }

  const builder = read('upstream/marktext/packages/desktop/electron-builder.yml')
  const releaseBuilder = read('scripts/build-release-from-source.sh')
  const generator = read('scripts/generate-macos-icon.mjs')
  assert.match(builder, /mac:[\s\S]*icon:\s*static\/icon\.icns/)
  assert.match(builder, /linux:[\s\S]*icon:\s*['"]?static\/icon\.png['"]?/)
  assert.match(releaseBuilder, /APP_ICON_SOURCE=.*reversion-hand-pencil-engraving_OC_0807B\.png/)
  assert.match(releaseBuilder, /generate-macos-icon\.mjs/)
  assert.match(generator, /\['icon_512x512@2x\.png', 1024\]/)
  assert.match(generator, /make-icns\.mjs/)
})

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

test('theme stylesheets keep braces balanced', () => {
  // A stray top-level `}` is silently discarded by Chromium's error recovery
  // but breaks stricter CSS tooling; 2.0.0 shipped one in each export theme.
  const themeFiles = [
    'themes/lens-design-marktext.css',
    'themes/claude-like-marktext.css',
    'themes/export/lens-design.css',
    'themes/export/claude-like.css',
    'patches/reversion-runtime.css'
  ]
  for (const themePath of themeFiles) {
    const css = read(themePath)
    let depth = 0
    let line = 1
    for (const ch of css) {
      if (ch === '\n') line += 1
      else if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        assert.ok(depth >= 0, `${themePath}: stray closing brace at line ${line}`)
      }
    }
    assert.equal(depth, 0, `${themePath}: ${depth} unclosed brace(s) at end of file`)
  }
})

test('editor and export themes balance narrow and wide tables', () => {
  // In the editor a wide table now scrolls inside `.mu-table` (muya's
  // blockSyntax.css sets `overflow-x: auto` on the figure), so the table sizes
  // to its content and the 13px compression that used to be the only way to
  // fit it is gone. `min-width: 100%` still makes a narrow table fill the
  // column. In 2.1 both editor and export derive table type from the active
  // reading size so it is always exactly two pixels smaller.
  for (const themePath of ['themes/lens-design-marktext.css', 'themes/claude-like-marktext.css']) {
    const css = read(themePath)
    assert.match(css, /\.mu-container table \{[\s\S]*width: max-content;[\s\S]*min-width: 100%;[\s\S]*table-layout: auto;/)
    assert.match(css, /--reading-table-font-size:\s*calc\(var\(--reading-font-size\) - 2px\)/)
    assert.match(css, /\.mu-container table th \{[\s\S]*line-height: 1\.45 !important;[\s\S]*white-space: normal;/)
    assert.match(css, /\.mu-container table td,[\s\S]*\.mu-container table th \{[\s\S]*min-width: 4\.5em;[\s\S]*font-size: var\(--reading-table-font-size\) !important;/)
    assert.match(css, /\.mu-container table td:first-child,[\s\S]*\.mu-container table th:first-child \{[\s\S]*min-width: 3\.25em;/)
    assert.match(css, /\.mu-container table td:last-child,[\s\S]*\.mu-container table th:last-child \{[\s\S]*min-width: 8\.5em;/)
    assert.match(css, /\.mu-container table td \*,[\s\S]*\.mu-container table th \* \{[\s\S]*font-size: inherit !important;[\s\S]*line-height: inherit !important;/)
    assert.doesNotMatch(css, /#ag-editor-id|\.ag-/)
  }

  for (const themePath of ['themes/export/lens-design.css', 'themes/export/claude-like.css']) {
    const css = read(themePath)
    assert.match(css, /--reading-table-font-size:\s*calc\(var\(--reading-font-size\) - 2px\)/)
    assert.match(css, /\.markdown-body table \{[\s\S]*width: 100%;[\s\S]*table-layout: auto;/)
    assert.match(css, /\.markdown-body table td,[\s\S]*\.markdown-body table th \{[\s\S]*font-size: var\(--reading-table-font-size\);/)
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
