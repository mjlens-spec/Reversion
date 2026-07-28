// The app imports Typora themes in-process (Theme ▸ 导入主题（Typora 兼容）),
// which means the transpiler has to exist inside the shipped bundle as well as
// here in the tooling repo. It is vendored to
// `packages/desktop/src/main/typoraTheme/` as a verbatim copy, so this repo
// stays the single place the pipeline is edited.
//
// Two copies of 2 000+ lines drift silently: a fix made here would keep the
// CLI correct while the in-app import quietly kept the old behavior. Compare
// them byte for byte instead of trusting anyone to remember the second step.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VENDOR_ROOT = path.join(
  ROOT,
  'upstream/marktext/packages/desktop/src/main/typoraTheme'
)

const upstreamAvailable = fs.existsSync(VENDOR_ROOT)

const listMjs = (dir) =>
  fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.mjs'))
    .sort()

for (const dirName of ['typora-import', 'typora-map']) {
  test(`vendored ${dirName}/ is byte-identical to scripts/${dirName}/`, (t) => {
    if (!upstreamAvailable) return t.skip('upstream/marktext not available')

    const sourceDir = path.join(ROOT, 'scripts', dirName)
    const vendorDir = path.join(VENDOR_ROOT, dirName)

    const sourceFiles = listMjs(sourceDir)
    assert.deepEqual(
      listMjs(vendorDir),
      sourceFiles,
      `${dirName}: vendored copy has a different file set; re-copy the directory`
    )

    for (const name of sourceFiles) {
      const expected = fs.readFileSync(path.join(sourceDir, name))
      const actual = fs.readFileSync(path.join(vendorDir, name))
      assert.ok(
        expected.equals(actual),
        `${dirName}/${name} drifted from scripts/${dirName}/${name}; `
          + 'edit the copy under scripts/ and re-copy it into the app'
      )
    }
  })
}

test('the app declares postcss, the transpiler’s only runtime dependency', (t) => {
  if (!upstreamAvailable) return t.skip('upstream/marktext not available')

  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'upstream/marktext/packages/desktop/package.json'),
      'utf8'
    )
  )
  // A transitive hoist happens to resolve today; an explicit dependency is what
  // keeps the in-app import working after any unrelated dependency change.
  assert.ok(
    pkg.dependencies?.postcss,
    'packages/desktop must depend on postcss explicitly for the vendored transpiler'
  )
})
