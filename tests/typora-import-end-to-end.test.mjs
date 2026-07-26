/**
 * E2 任务 2 —— Typora 主题转译器：端到端测试（CLI + 三件产物）。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import postcss from 'postcss'

import { translateTyporaTheme, normaliseNamespace } from '../scripts/typora-import/index.mjs'
import { parseArgs, run } from '../scripts/import-typora-theme.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixturePath = path.join(root, 'tests/typora-import-fixtures/sample-typora-theme.css')
const fixtureCss = fs.readFileSync(fixturePath, 'utf8')

const translated = translateTyporaTheme(fixtureCss, {
  themeName: 'sample',
  sourcePath: fixturePath,
  now: '2026-07-26'
})

const parseCss = (css, label) => {
  try {
    return postcss.parse(css, { from: label })
  } catch (error) {
    assert.fail(`${label} 不是合法 CSS: ${error.message}`)
  }
}

test('端到端：两份产物都是合法 CSS，且作用域正确', () => {
  const editor = parseCss(translated.editorCss, 'editor')
  const exported = parseCss(translated.exportCss, 'export')

  const editorSelectors = []
  editor.walkRules((rule) => editorSelectors.push(rule.selector))
  const exportSelectors = []
  exported.walkRules((rule) => exportSelectors.push(rule.selector))

  assert.ok(editorSelectors.some((s) => s.includes('#ag-editor-id h1.ag-paragraph')))
  assert.ok(editorSelectors.some((s) => s.includes('#ag-editor-id code.ag-inline-rule')))
  assert.ok(editorSelectors.some((s) => s.includes("p[data-role='hr']::before")))
  assert.ok(editorSelectors.some((s) => s.trim() === '.cm-keyword'))
  assert.ok(!editorSelectors.some((s) => s.includes('.markdown-body')), '编辑器主题不得混入导出作用域')

  assert.ok(exportSelectors.some((s) => s.includes('.markdown-body h1')))
  assert.ok(exportSelectors.some((s) => s.includes('.markdown-body hr')))
  assert.ok(exportSelectors.some((s) => s.trim() === '.toc-container'))
  assert.ok(!exportSelectors.some((s) => s.includes('ag-paragraph')), '导出主题不得混入编辑器选择器')
  assert.ok(!exportSelectors.some((s) => s.includes('cm-keyword')), '导出 HTML 没有 CodeMirror')
})

test('端到端：编辑器主题包在 @media not print 里，导出主题自带重新生成的打印块', () => {
  const editor = parseCss(translated.editorCss, 'editor')
  const wrappers = []
  editor.walkAtRules('media', (at) => wrappers.push(at.params))
  assert.ok(wrappers.includes('not print'))

  // Typora 原文的 @media print 被剥离，导出侧的 print 块由转译器重新生成
  assert.doesNotMatch(translated.editorCss, /page-break-inside/)
  assert.doesNotMatch(translated.exportCss, /page-break-inside/)
  assert.match(translated.exportCss, /@media print \{[\s\S]*\.markdown-body \{[\s\S]*max-width: none/)
})

test('端到端：变量双层转发与阅读字体槽位齐备', () => {
  for (const css of [translated.editorCss, translated.exportCss]) {
    assert.match(css, /--sample-bg: #ffffff;/)
    assert.match(css, /--reading-font-title: var\(--sample-font-body\);/)
    assert.match(css, /--reading-font-quote: var\(--sample-font-body\);/)
  }
  // 骆峰 + kebab 双层只出现在编辑器主题（导出侧不需要 muya 变量）
  assert.match(translated.editorCss, /--editorBgColor: var\(--sample-bg\);/)
  assert.match(translated.editorCss, /--editor-bg-color: var\(--editorBgColor\);/)
  assert.doesNotMatch(translated.exportCss, /--editorBgColor/)

  // 语法高亮固定变量化（规格 §7 问题 4）
  assert.match(translated.editorCss, /--sample-code-keyword-color: #aa00aa;/)
  assert.match(translated.editorCss, /\.cm-keyword \{[\s\S]*var\(--sample-code-keyword-color\)/)
  assert.doesNotMatch(translated.editorCss, /\.cm-keyword \{[\s\S]*#aa00aa/)

  // 运行时字体覆盖只提供 fallback，不定义默认值（规格 §1.3）
  assert.match(translated.editorCss, /var\(--editor-title-font-family, var\(--reading-font-title\)\)/)
  assert.doesNotMatch(translated.editorCss, /--editor-title-font-family:/)
  assert.doesNotMatch(translated.exportCss, /--editor-heading-font-family/)
})

test('端到端：hr 走 --hrColor 与 p[data-role=hr]::before（规格 §5 已核实）', () => {
  assert.match(translated.editorCss, /--hrColor: var\(--sample-line\);/)
  assert.match(translated.editorCss, /p\[data-role='hr'\]::before \{[\s\S]*border-top-color/)
  assert.match(translated.editorCss, /p\[data-role='hr'\] \{[\s\S]*margin: 20px 0/)
  assert.match(translated.exportCss, /\.markdown-body hr \{/)
})

test('端到端：统计口径与报告一致', () => {
  const s = translated.stats
  assert.equal(s.sourceVariables, 18)
  assert.equal(s.droppedVariables, 2) // --window-bg-color / --table-alt-color
  assert.ok(s.strippedSelectors >= 4)
  assert.equal(s.translatable, s.sourceSelectors - s.strippedSelectors)
  assert.equal(s.eitherMapped + s.neitherMapped, s.translatable)
  assert.ok(s.eitherMapped / s.translatable > 0.9, `覆盖率过低: ${s.eitherMapped}/${s.translatable}`)

  assert.match(translated.report, /# sample — Typora 主题转译兼容报告/)
  assert.match(translated.report, new RegExp(`\\| 源变量 \\| ${s.sourceVariables} \\|`))
})

test('CLI：参数解析', () => {
  const parsedArgs = parseArgs(['theme.css', '--name', 'foo', '--out-dir', 'out', '--no-important'])
  assert.equal(parsedArgs.input, 'theme.css')
  assert.equal(parsedArgs.name, 'foo')
  assert.equal(parsedArgs.outDir, 'out')
  assert.equal(parsedArgs.important, false)

  assert.throws(() => parseArgs(['theme.css']), /缺少 --name/)
  assert.throws(() => parseArgs(['--name', 'foo', '--out-dir', 'o']), /缺少输入文件/)
  assert.throws(() => parseArgs(['a.css', 'b.css', '--name', 'f', '--out-dir', 'o']), /只能指定一个输入文件/)

  assert.equal(normaliseNamespace('Claude Like/Dark'), 'claude-like-dark')
  assert.throws(() => normaliseNamespace('---'), /Invalid theme name/)
})

test('CLI：写出三件产物到 <out-dir>', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typora-import-test-'))
  try {
    const logs = []
    const result = run([fixturePath, '--name', 'sample', '--out-dir', outDir, '--quiet'], { log: (line) => logs.push(line) })

    assert.equal(result.editorPath, path.join(outDir, 'sample-marktext.css'))
    assert.equal(result.exportPath, path.join(outDir, 'export', 'sample.css'))
    assert.equal(result.reportPath, path.join(outDir, 'sample-report.md'))
    for (const file of [result.editorPath, result.exportPath, result.reportPath]) {
      assert.ok(fs.existsSync(file), `${file} 未生成`)
      assert.ok(fs.readFileSync(file, 'utf8').length > 200)
    }
    assert.deepEqual(logs, [result.editorPath, result.exportPath, result.reportPath])

    // --no-important 关闭编辑器主题的 !important 追加
    const plainDir = fs.mkdtempSync(path.join(os.tmpdir(), 'typora-import-test-'))
    run([fixturePath, '--name', 'sample', '--out-dir', plainDir, '--quiet', '--no-important'], { log: () => {} })
    const plain = fs.readFileSync(path.join(plainDir, 'sample-marktext.css'), 'utf8')
    assert.doesNotMatch(plain, /background-color: var\(--sample-bg\) !important/)
    fs.rmSync(plainDir, { recursive: true, force: true })
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true })
  }
})

test('端到端：换命名空间不影响结构，只换变量前缀', () => {
  const other = translateTyporaTheme(fixtureCss, { themeName: 'sample', namespace: 'zzz', now: '2026-07-26' })
  assert.match(other.editorCss, /--zzz-bg: #ffffff;/)
  assert.doesNotMatch(other.editorCss, /--sample-bg:/)
  assert.equal(other.stats.eitherMapped, translated.stats.eitherMapped)
})
