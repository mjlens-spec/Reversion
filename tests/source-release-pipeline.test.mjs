import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const scriptPath = path.join(root, 'scripts', 'build-release-from-source.sh')
const script = fs.readFileSync(scriptPath, 'utf8')
const upstreamDesktop = path.join(root, 'upstream', 'marktext', 'packages', 'desktop')

// `upstream/` and `releases/` are git-ignored working directories. Tests that
// need them degrade to t.skip() so the suite still passes on a clean clone.
const readIfPresent = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null)

const yamlScalar = (text, key) => {
  const match = text.match(new RegExp(`^[ \\t]*(?:- )?${key}:[ \\t]*([^\\s#]+)`, 'm'))
  return match ? match[1] : null
}

const parseFlatYaml = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith(' ') && !line.startsWith('#'))
    .map((line) => line.slice(0, line.indexOf(':')))

const latestReleaseDir = () => {
  const releases = path.join(root, 'releases')
  if (!fs.existsSync(releases)) return null
  const candidates = fs
    .readdirSync(releases, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(entry.name))
    .map((entry) => path.join(releases, entry.name))
    .filter((dir) => fs.existsSync(path.join(dir, 'latest-mac.yml')))
  if (candidates.length === 0) return null
  return candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]
}

test('the source-built release script exists and is executable', () => {
  assert.ok(fs.existsSync(scriptPath), 'scripts/build-release-from-source.sh must exist')
  assert.ok(fs.statSync(scriptPath).mode & 0o111, 'the release script must be executable')
  assert.match(script, /^#!\/usr\/bin\/env bash$/m)
  assert.match(script, /^set -euo pipefail$/m)
})

test('the legacy binary-patching pipeline is marked as superseded', () => {
  const legacy = fs.readFileSync(path.join(root, 'scripts', 'build-release.sh'), 'utf8')
  assert.match(legacy, /SUPERSEDED by scripts\/build-release-from-source\.sh/)
})

test('the source pipeline builds from upstream sources instead of re-patching a binary', () => {
  for (const required of [
    'pnpm install --frozen-lockfile --ignore-scripts',
    'pnpm tsx scripts/postinstall.ts',
    'pnpm run build:unpack',
    'CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac',
    '--dir --publish never'
  ]) {
    assert.ok(script.includes(required), `the release script must run: ${required}`)
  }
  for (const forbidden of ['patch-asar-themes.mjs', 'npx --yes asar', '/Applications/Reversion.app']) {
    assert.ok(!script.includes(forbidden), `the source pipeline must not depend on: ${forbidden}`)
  }
})

test('the Node toolchain is pinned to the version used by upstream release CI', () => {
  const nvmrc = fs.readFileSync(path.join(root, '.nvmrc'), 'utf8').trim()
  assert.match(nvmrc, /^\d+\.\d+\.\d+$/, '.nvmrc must pin an exact Node version')
  assert.ok(script.includes('.nvmrc'), 'the release script must read the pinned version from .nvmrc')
  assert.ok(
    script.includes('REVERSION_BOOTSTRAP_NODE') && script.includes('SHASUMS256.txt'),
    'provisioning the pinned Node must be opt-in and checksum-verified'
  )
  assert.ok(
    script.includes('nvm install') && script.includes('REVERSION_NODE_BIN'),
    'a version mismatch must fail with actionable install guidance'
  )

  const workflow = readIfPresent(path.join(root, 'upstream', 'marktext', '.github', 'workflows', 'release.yml'))
  if (workflow == null) return
  assert.ok(
    workflow.includes(`node-version: '${nvmrc}'`),
    `.nvmrc (${nvmrc}) must match the node-version pinned in upstream release.yml`
  )
})

test('the pnpm toolchain is pinned to the upstream packageManager field', () => {
  assert.ok(script.includes('packageManager'), 'the release script must read the pinned pnpm version')
  const upstreamPkg = readIfPresent(path.join(root, 'upstream', 'marktext', 'package.json'))
  if (upstreamPkg == null) return
  assert.match(JSON.parse(upstreamPkg).packageManager, /^pnpm@\d+\.\d+\.\d+$/)
})

test('the version is written into the source before the build, not patched afterwards', () => {
  assert.ok(
    script.includes('packages/desktop') && script.includes('DESKTOP_PKG'),
    'the release script must write the version into the upstream desktop package.json'
  )
  assert.ok(
    !script.includes('LENS_RELEASE_VERSION'),
    'the post-build MARKTEXT_VERSION rewrite must be gone; electron.vite.config.ts injects it from package.json'
  )
  assert.ok(
    script.includes('MARKTEXT_VERSION was not injected'),
    'the release script must verify the injected version in the built main bundle'
  )
  assert.ok(script.includes('REVERSION_KEEP_VERSION'), 'restoring the source version must be the default, opt-out')
})

test('the pipeline derives every bundle path from productName and asserts the renamed layout', () => {
  // B2 productName migration. The pre-1.2.0 pipeline hardcoded
  // dist/mac-arm64/marktext.app and Contents/MacOS/marktext; both now follow
  // electron-builder.yml's `productName: Reversion`. The assertions matter
  // because Electron resolves its helper apps from CFBundleName at runtime, so
  // a half-applied rename is a launch-time crash rather than a cosmetic bug.
  assert.ok(script.includes('PRODUCT_NAME="Reversion"'), 'the release script must pin the productName it expects')
  assert.ok(
    script.includes('BUILT_APP="$UPSTREAM/dist/mac-$ARCH/$PRODUCT_NAME.app"'),
    'the built bundle path must derive from productName'
  )
  assert.ok(
    !script.includes('marktext.app') && !script.includes('MacOS/marktext'),
    'no path may still hardcode the pre-1.2.0 marktext bundle/executable name'
  )
  assert.ok(
    script.includes('Contents/MacOS/$PRODUCT_NAME'),
    'the arm64 check must run against the renamed executable'
  )
  assert.ok(
    script.includes('$PRODUCT_NAME Helper$helper.app'),
    'the script must assert all four renamed Helper bundles exist'
  )
  assert.ok(
    script.includes('CFBundleName') && script.includes('drifted away from $PRODUCT_NAME'),
    'the shipping bundle must be re-checked for CFBundleName/DisplayName/Executable drift'
  )
})

test('the pipeline guards the asarUnpack regression the binary-patching pipeline had', () => {
  assert.ok(script.includes('app.asar.unpacked'), 'the release script must check the unpacked payload')
  assert.ok(
    script.includes('asarUnpack rules were lost'),
    'a missing or empty app.asar.unpacked must fail the build'
  )
})

test('the release feed has one source of truth and is cross-checked against electron-builder.yml', () => {
  const configPath = path.join(root, 'config', 'app-update.yml')
  const config = fs.readFileSync(configPath, 'utf8')
  assert.equal(yamlScalar(config, 'provider'), 'github')
  assert.equal(yamlScalar(config, 'owner'), 'mjlens-spec')
  assert.equal(yamlScalar(config, 'repo'), 'Reversion')
  assert.equal(
    yamlScalar(config, 'updaterCacheDirName'),
    'reversion-updater',
    'the updater cache dir must stay identical to the shipped 1.1.0 build'
  )

  assert.ok(script.includes('release feed drift'), 'the release script must fail on feed drift')
  assert.ok(
    script.includes('updaterCacheDirName') && script.includes('staged app-update.yml'),
    'the release script must verify the staged app-update.yml, not just write it'
  )

  const builderYml = readIfPresent(path.join(upstreamDesktop, 'electron-builder.yml'))
  if (builderYml == null) return
  const publishBlock = builderYml.match(/^publish:\n(?:[ \t]+.*\n)+/m)
  assert.ok(publishBlock, 'electron-builder.yml must declare a publish block')
  for (const field of ['provider', 'owner', 'repo']) {
    assert.equal(
      yamlScalar(publishBlock[0], field),
      yamlScalar(config, field),
      `electron-builder.yml publish.${field} must match config/app-update.yml`
    )
  }
})

test('the shipping bundle keeps a stable ad-hoc signing identity', () => {
  for (const requirement of [
    'codesign --force --deep --sign -',
    '=designated => identifier',
    'com.github.marktext.marktext',
    'com.github.marktext.marktext.reversion-quicklook',
    'codesign --verify --deep --strict',
    "grep -q 'arm64'",
    'xattr -cr'
  ]) {
    assert.ok(script.includes(requirement), `the release script must include ${requirement}`)
  }
  const deepSignAt = script.indexOf('codesign --force --deep --sign -')
  const pinnedSignAt = script.indexOf(
    'codesign --force --sign - --requirements "=designated => identifier \\"$APP_ID\\""'
  )
  assert.ok(deepSignAt >= 0 && pinnedSignAt >= 0, 'both signing passes must be present')
  assert.ok(
    deepSignAt < pinnedSignAt,
    'the identifier-pinned re-sign must come after the recursive ad-hoc sign, otherwise --deep overwrites it'
  )
  assert.ok(
    script.includes('CFBundleIdentifier drifted'),
    'the release script must assert the bundle identifier never drifts'
  )
})

test('the pipeline emits the same artifact set and layout as the 1.1.0 release', () => {
  for (const requirement of [
    'releases/$VERSION',
    'Reversion-$VERSION-$ARCH',
    'ditto -c -k --sequesterRsrc --keepParent',
    'make-update-manifest.mjs',
    'latest-mac.yml',
    'hdiutil create',
    'shasum -a 256',
    'brand-app.sh',
    'build-quicklook.sh',
    'lens-marktext-icon.icns',
    'themes/export',
    '*.lens-backup-*',
    '*.lens-*-backup-*'
  ]) {
    assert.ok(script.includes(requirement), `the release script must include ${requirement}`)
  }
  assert.ok(script.includes('release output already exists'), 'the release script must refuse to overwrite artifacts')
})

test('the update manifest generator accepts prerelease versions', async () => {
  const { createMacUpdateManifest } = await import(
    pathToFileURL(path.join(root, 'scripts', 'make-update-manifest.mjs'))
  )
  const manifest = createMacUpdateManifest({
    version: '1.2.0-beta.1',
    fileName: 'Reversion-1.2.0-beta.1-arm64-mac.zip',
    size: 1,
    sha512: 'digest',
    releaseDate: '2026-07-26T00:00:00.000Z'
  })
  assert.match(manifest, /^version: 1\.2\.0-beta\.1$/m)
  assert.match(manifest, /^ {2}- url: Reversion-1\.2\.0-beta\.1-arm64-mac\.zip$/m)
})

test('a built release directory matches the 1.1.0 latest-mac.yml contract', (t) => {
  const dir = latestReleaseDir()
  if (dir == null) {
    t.skip('no built release directory found under releases/ (run scripts/build-release-from-source.sh first)')
    return
  }
  const version = path.basename(dir)
  const manifest = fs.readFileSync(path.join(dir, 'latest-mac.yml'), 'utf8')

  assert.equal(yamlScalar(manifest, 'version'), version)
  const zipName = `Reversion-${version}-arm64-mac.zip`
  const dmgName = `Reversion-${version}-arm64.dmg`
  for (const artifact of [zipName, `${zipName}.sha256`, dmgName, `${dmgName}.sha256`]) {
    assert.ok(fs.existsSync(path.join(dir, artifact)), `${artifact} must exist in ${dir}`)
  }

  assert.deepEqual(parseFlatYaml(manifest), ['version', 'files', 'path', 'sha512', 'releaseDate'])
  assert.equal(yamlScalar(manifest, 'path'), zipName)
  assert.equal(yamlScalar(manifest, 'url'), zipName)

  const zipPath = path.join(dir, zipName)
  const sha512 = crypto.createHash('sha512').update(fs.readFileSync(zipPath)).digest('base64')
  assert.equal(yamlScalar(manifest, 'sha512'), sha512, 'latest-mac.yml sha512 must match the shipped ZIP')
  assert.equal(Number(yamlScalar(manifest, 'size')), fs.statSync(zipPath).size)

  const reference = readIfPresent(path.join(root, 'releases', '1.1.0', 'latest-mac.yml'))
  if (reference != null) {
    assert.deepEqual(
      parseFlatYaml(manifest),
      parseFlatYaml(reference),
      'the manifest field structure must stay identical to the 1.1.0 release'
    )
  }
})

test('a built .app carries the Reversion update feed, identity and signature', (t) => {
  const dir = latestReleaseDir()
  const stagedApps = fs.existsSync(path.join(root, '.tmp'))
    ? fs
        .readdirSync(path.join(root, '.tmp'))
        .filter((entry) => entry.startsWith('reversion-release-'))
        .map((entry) => path.join(root, '.tmp', entry, 'Reversion.app'))
        .filter((app) => fs.existsSync(path.join(app, 'Contents', 'Info.plist')))
    : []
  if (dir == null || stagedApps.length === 0) {
    t.skip('no staged Reversion.app found (run scripts/build-release-from-source.sh first)')
    return
  }
  const app = stagedApps.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]

  const updateYml = fs.readFileSync(path.join(app, 'Contents', 'Resources', 'app-update.yml'), 'utf8')
  const config = fs.readFileSync(path.join(root, 'config', 'app-update.yml'), 'utf8')
  assert.equal(updateYml, config, 'the shipped app-update.yml must be config/app-update.yml verbatim')

  assert.ok(
    fs.existsSync(path.join(app, 'Contents', 'Resources', 'app.asar.unpacked')),
    'the shipped bundle must keep the asarUnpack payload'
  )

  const requirement = execFileSync('codesign', ['-d', '-r-', app], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  assert.match(
    requirement,
    /designated => identifier "com\.github\.marktext\.marktext"/,
    'the designated requirement must be identifier-pinned so older installs accept the update'
  )
})

test('a built .app is named Reversion throughout: bundle name, executable and all four helpers', (t) => {
  // B2 acceptance criterion, checked against the real staged artifact rather
  // than the script text: on current macOS the menu-bar application menu title
  // and the Dock tile name are driven by CFBundleName, and Electron resolves the
  // helper apps from the same field, so this is the one place where the rename
  // either fully landed or the app crashes / silently says "marktext".
  const stagedApps = fs.existsSync(path.join(root, '.tmp'))
    ? fs
        .readdirSync(path.join(root, '.tmp'))
        .filter((entry) => entry.startsWith('reversion-release-'))
        .map((entry) => path.join(root, '.tmp', entry, 'Reversion.app'))
        .filter((app) => fs.existsSync(path.join(app, 'Contents', 'Info.plist')))
    : []
  // Only bundles built after the B2 migration can satisfy this; older staged
  // dirs are kept around on dev machines for inspection.
  const migrated = stagedApps.filter((app) =>
    fs.existsSync(path.join(app, 'Contents', 'MacOS', 'Reversion'))
  )
  if (migrated.length === 0) {
    t.skip('no post-B2 staged Reversion.app found (run scripts/build-release-from-source.sh first)')
    return
  }
  const app = migrated.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0]

  const plistValue = (key) =>
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Print :${key}`, path.join(app, 'Contents', 'Info.plist')], {
      encoding: 'utf8'
    }).trim()

  assert.equal(plistValue('CFBundleName'), 'Reversion')
  assert.equal(plistValue('CFBundleDisplayName'), 'Reversion')
  assert.equal(plistValue('CFBundleExecutable'), 'Reversion')
  // Unchanged by the rename -- auto-update and userData compatibility bind here.
  assert.equal(plistValue('CFBundleIdentifier'), 'com.github.marktext.marktext')

  const frameworks = path.join(app, 'Contents', 'Frameworks')
  for (const suffix of ['', ' (GPU)', ' (Plugin)', ' (Renderer)']) {
    assert.ok(
      fs.existsSync(path.join(frameworks, `Reversion Helper${suffix}.app`)),
      `Frameworks/Reversion Helper${suffix}.app must exist`
    )
  }
  const leftovers = fs.readdirSync(frameworks).filter((entry) => /^marktext Helper/.test(entry))
  assert.deepEqual(leftovers, [], 'no pre-B2 "marktext Helper*.app" bundle may survive the rename')
})
