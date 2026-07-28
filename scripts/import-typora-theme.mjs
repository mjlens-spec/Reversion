#!/usr/bin/env node
/**
 * Typora 主题 → 反文（Reversion）主题 转译器 CLI。
 *
 * 用法：
 *   node scripts/import-typora-theme.mjs <typora-theme.css> --name <themeName> --out-dir <dir>
 *
 * 产物（三件）：
 *   <out-dir>/<name>-marktext.css   编辑器主题（根作用域 .mu-editor）
 *   <out-dir>/export/<name>.css     导出主题（根作用域 .markdown-body）
 *   <out-dir>/<name>-report.md      兼容报告（丢弃/未映射/覆盖率）
 *
 * 可选：
 *   --var-prefix <ns>   自定义 CSS 变量命名空间（默认取 <name>）
 *   --no-important      编辑器主题不自动追加 !important
 *   --quiet             只输出产物路径
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { translateTyporaTheme, normaliseNamespace } from './typora-import/index.mjs'

const USAGE = `用法: node scripts/import-typora-theme.mjs <typora-theme.css> --name <themeName> --out-dir <dir>
       [--var-prefix <ns>] [--no-important] [--quiet]`

export function parseArgs (argv) {
  const options = { input: null, name: null, outDir: null, varPrefix: null, important: true, quiet: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--name':
        options.name = argv[++i]
        break
      case '--out-dir':
      case '--out':
        options.outDir = argv[++i]
        break
      case '--var-prefix':
        options.varPrefix = argv[++i]
        break
      case '--no-important':
        options.important = false
        break
      case '--quiet':
        options.quiet = true
        break
      case '-h':
      case '--help':
        options.help = true
        break
      default:
        if (arg.startsWith('--')) throw new Error(`未知参数: ${arg}\n${USAGE}`)
        if (options.input) throw new Error(`只能指定一个输入文件（多余的: ${arg}）\n${USAGE}`)
        options.input = arg
    }
  }
  if (options.help) return options
  if (!options.input) throw new Error(`缺少输入文件\n${USAGE}`)
  if (!options.name) throw new Error(`缺少 --name\n${USAGE}`)
  if (!options.outDir) throw new Error(`缺少 --out-dir\n${USAGE}`)
  return options
}

export function run (argv, io = { log: console.log }) {
  const options = parseArgs(argv)
  if (options.help) {
    io.log(USAGE)
    return null
  }

  const inputPath = path.resolve(options.input)
  const css = fs.readFileSync(inputPath, 'utf8')
  const namespace = normaliseNamespace(options.varPrefix || options.name)

  const result = translateTyporaTheme(css, {
    themeName: options.name,
    namespace,
    sourcePath: inputPath,
    important: options.important
  })

  const outDir = path.resolve(options.outDir)
  const exportDir = path.join(outDir, 'export')
  fs.mkdirSync(exportDir, { recursive: true })

  const editorPath = path.join(outDir, `${options.name}-marktext.css`)
  const exportPath = path.join(exportDir, `${options.name}.css`)
  const reportPath = path.join(outDir, `${options.name}-report.md`)

  fs.writeFileSync(editorPath, result.editorCss, 'utf8')
  fs.writeFileSync(exportPath, result.exportCss, 'utf8')
  fs.writeFileSync(reportPath, result.report, 'utf8')

  if (!options.quiet) {
    const s = result.stats
    io.log(`[${options.name}] 源规则 ${s.sourceRules} 条 / 选择器 ${s.sourceSelectors} 条`)
    io.log(`[${options.name}] 剥离 ${s.strippedSelectors} 条，可转译 ${s.translatable} 条`)
    io.log(`[${options.name}] 编辑器命中 ${s.editorMapped}，导出命中 ${s.exportMapped}，任一命中 ${s.eitherMapped}（${pct(s.eitherMapped, s.translatable)}）`)
    io.log(`[${options.name}] 变量 ${s.sourceVariables} 个：映射 ${s.mappedVariables} / 直通 ${s.passthroughVariables} / 丢弃 ${s.droppedVariables}`)
  }
  io.log(editorPath)
  io.log(exportPath)
  io.log(reportPath)

  return { editorPath, exportPath, reportPath, result }
}

function pct (value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '—'
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  try {
    run(process.argv.slice(2))
  } catch (error) {
    console.error(error.message)
    process.exit(1)
  }
}
