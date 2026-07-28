import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('Claude-like themes expose LXGW WenKai and independent reading roles', () => {
  for (const relativePath of ['themes/claude-like-marktext.css', 'themes/export/claude-like.css']) {
    const css = fs.readFileSync(path.join(root, relativePath), 'utf8')

    assert.match(css, /--claude-font-cjk:\s*"LXGW WenKai",\s*"霞鹜文楷"/)
    assert.match(css, /--reading-font-title:\s*var\(--claude-font-title\);/)
    assert.match(css, /--reading-font-heading:\s*var\(--claude-font-heading\);/)
    assert.match(css, /--reading-font-body:\s*var\(--claude-font-reading\);/)
  }
})

test('Claude-like Reversion selectors keep Muya headings out of the body font rule', () => {
  const css = fs.readFileSync(path.join(root, 'themes/claude-like-marktext.css'), 'utf8')

  assert.match(css, /\.mu-container h1[^{}]*\{[^{}]*font-family:\s*var\(--editor-title-font-family,\s*var\(--reading-font-title\)\)/s)
  assert.match(css, /\.mu-container h2[^{}]*\{[^{}]*font-family:\s*var\(--editor-heading-font-family,\s*var\(--reading-font-heading\)\)/s)
  assert.match(css, /\.mu-container p[^{}]*\{[^{}]*font-family:\s*var\(--editor-body-font-family,\s*var\(--reading-font-body\)\)/s)
  assert.doesNotMatch(
    css,
    /(?:^|\n)\s*\.mu-paragraph\s*,[^{}]*\{[^{}]*font-family:\s*var\(--editor-body-font-family/s,
    'the Claude-like body rule must not flatten Muya heading elements'
  )
})

test('Lens Design Reversion H1 uses the configured bold display face', () => {
  const css = fs.readFileSync(path.join(root, 'themes/lens-design-marktext.css'), 'utf8')

  assert.match(css, /\.mu-container h1[^{}]*\{[^{}]*font-weight:\s*700\s*!important/s)
})
