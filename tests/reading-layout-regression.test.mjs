import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'upstream', 'marktext')

const readSource = relativePath => fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8')

const editor = readSource('packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue')
const layoutStore = readSource('packages/desktop/src/renderer/src/store/layout.ts')
const claudeTheme = readSource('packages/desktop/src/renderer/src/assets/themes/claude-like.theme.css')
const lensTheme = readSource('packages/desktop/src/renderer/src/assets/themes/lens-design.theme.css')
const preferenceSchema = JSON.parse(readSource('packages/desktop/src/main/preferences/schema.json'))
const preferenceSeed = JSON.parse(readSource('packages/desktop/static/preference.json'))
const rendererPreferences = readSource('packages/desktop/src/renderer/src/store/preferences.ts')

test('startup restores a 1:2.34 sidebar-to-editor split instead of the 19% regression', () => {
  assert.match(layoutStore, /const SIDEBAR_EDITOR_RATIO = 2\.34/)
  assert.match(
    layoutStore,
    /viewportWidth\s*\/\s*\(1\s*\+\s*SIDEBAR_EDITOR_RATIO\)/
  )
  assert.doesNotMatch(layoutStore, /SIDEBAR_VIEWPORT_SHARE\s*=\s*0\.19/)
})

test('normal reading mode does not add a viewport of blank space after the document', () => {
  assert.doesNotMatch(
    editor,
    /\.editor-component \.mu-container\s*\{[^}]*padding-bottom:\s*100vh/s
  )
  assert.match(
    editor,
    /\.editor-component \.mu-container\s*\{[^}]*padding-bottom:\s*64px/s
  )
  assert.match(
    editor,
    /\.typewriter \.editor-component \.mu-container\s*\{[^}]*padding-bottom:\s*calc\(50vh - 1lh\)/s
  )
})

test('body text occupies 76% of the live editor pane with 12% on each side', () => {
  assert.match(
    editor,
    /\.editor-component \.mu-container\s*\{[^}]*max-width:\s*calc\(76% \+ 100px\) !important;/s
  )

  for (const [name, source] of [['Claude-like', claudeTheme], ['Lens Design', lensTheme]]) {
    assert.match(
      source,
      /--reading-column-width:\s*calc\(76% \+ 100px\);/,
      `${name} should add the engine's 100px padding around a 76% text measure`
    )
  }
})

test('fresh profiles use Claude-like without overwriting explicit user choices', () => {
  assert.equal(preferenceSchema.theme.default, 'claude-like')
  assert.equal(preferenceSchema.lightModeTheme.default, 'claude-like')
  assert.equal(preferenceSeed.theme, 'claude-like')
  assert.equal(preferenceSeed.lightModeTheme, 'claude-like')
  assert.match(rendererPreferences, /theme:\s*'claude-like'/)
  assert.match(rendererPreferences, /followSystemTheme:\s*false/)
  assert.match(rendererPreferences, /lightModeTheme:\s*'claude-like'/)
})

test('tables are globally two pixels smaller than surrounding body text', () => {
  assert.match(
    editor,
    /\.editor-component \.mu-container table :is\(td, th\)\s*\{[^}]*font-size:\s*var\(--reading-table-font-size, calc\(1em - 2px\)\) !important;/s
  )
  assert.match(
    editor,
    /\.editor-component \.mu-container table :is\(td, th\) \*\s*\{[^}]*font-size:\s*inherit !important;/s
  )

  for (const [name, source] of [['Claude-like', claudeTheme], ['Lens Design', lensTheme]]) {
    assert.match(
      source,
      /--reading-table-font-size:\s*calc\(var\(--reading-font-size\) - 2px\);/,
      `${name} should keep its table scale aligned with the global rule`
    )
  }
})
