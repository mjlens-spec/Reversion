import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = path.join(root, 'upstream', 'marktext')

const readSource = relativePath => fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8')

const editor = readSource('packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue')
const claudeTheme = readSource('packages/desktop/src/renderer/src/assets/themes/claude-like.theme.css')
const lensTheme = readSource('packages/desktop/src/renderer/src/assets/themes/lens-design.theme.css')

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

test('bundled reading themes expose a 1200px text measure on wide windows', () => {
  for (const [name, source] of [['Claude-like', claudeTheme], ['Lens Design', lensTheme]]) {
    assert.match(
      source,
      /--reading-column-width:\s*min\(1300px, 90%\);/,
      `${name} should reserve a 1300px container, including the editor's 100px horizontal padding`
    )
  }
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
