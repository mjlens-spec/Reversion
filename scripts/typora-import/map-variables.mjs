/**
 * Pipeline layer 2 — variable-mapper (规格 §6).
 *
 * 输入：layer 1 抽出的 Typora 变量字典 + scripts/typora-map/variables.mjs 映射表
 * 输出：反文变量声明（骆峰 + kebab 双层转发）、Typora 变量 → 反文引用名的重写表、
 *       以及《未映射变量清单》。
 */

import {
  VARIABLE_MAP,
  canonicalVariableName,
  camelToKebabVar,
  lookupVariable
} from '../typora-map/variables.mjs'

/**
 * @param {{values: Map<string,string>, order: string[]}} extracted
 * @param {Map<string, number>} references  var(--x) 引用计数（剥离后统计）
 * @param {{namespace: string}} options
 */
export function mapVariables (extracted, references, options) {
  const ns = options.namespace
  const themeVars = []          // { name, value, strategy, from }
  const marktextVars = []       // { name, value }
  const kebabVars = []          // { name, value }
  const rewrites = new Map()    // typoraVarName -> reversion var name
  const entries = []            // report rows
  const aliasCollisions = []

  const canonicalOwner = new Map()
  const deferredMerges = []

  const themeVarName = (suffix) => `--${ns}-${suffix}`

  for (const typoraName of extracted.order) {
    const rawValue = extracted.values.get(typoraName)
    const { canonical, entry } = lookupVariable(typoraName)

    if (canonical !== typoraName) {
      if (canonicalOwner.has(canonical)) {
        aliasCollisions.push({ typoraName, canonical, winner: canonicalOwner.get(canonical) })
        entries.push({ typoraName, canonical, strategy: 'alias-collision', target: null, value: rawValue, note: `与 ${canonicalOwner.get(canonical)} 归一到同一规范名 ${canonical}，本条按直通处理` })
        // Fall through to passthrough handling below.
        registerPassthrough(typoraName, rawValue, `别名冲突（规范名 ${canonical} 已被 ${canonicalOwner.get(canonical)} 占用）`)
        continue
      }
      canonicalOwner.set(canonical, typoraName)
    } else if (entry) {
      canonicalOwner.set(canonical, typoraName)
    }

    if (!entry) {
      const used = references.get(typoraName) || 0
      if (used > 0) {
        registerPassthrough(typoraName, rawValue, '映射表未收录，被保留规则引用，按「直通」生成命名空间变量')
      } else {
        entries.push({ typoraName, canonical, strategy: 'drop-unused', target: null, value: rawValue, note: '映射表未收录且剥离后无任何引用，不生成（减少死代码）' })
      }
      continue
    }

    switch (entry.strategy) {
      case 'drop':
        entries.push({ typoraName, canonical, strategy: 'drop', target: null, value: rawValue, note: entry.note || '规格裁决丢弃' })
        break

      case 'merge':
        deferredMerges.push({ typoraName, canonical, entry, rawValue })
        break

      case 'font':
        // Font stacks are materialised by the font-slot-injector, but the raw
        // namespace variable is emitted here so both layers share one source.
        pushThemeVar(typoraName, canonical, entry, rawValue, 'font')
        break

      case 'syntax':
        pushThemeVar(typoraName, canonical, entry, rawValue, 'syntax')
        break

      case 'theme-var':
      default:
        pushThemeVar(typoraName, canonical, entry, rawValue, 'theme-var')
        break
    }
  }

  // Merges run last: they need to know whether their target variable exists.
  for (const { typoraName, canonical, entry, rawValue } of deferredMerges) {
    const intoName = entry.into
    const intoEntry = VARIABLE_MAP[canonicalVariableName(intoName)]
    const intoPresent = extracted.values.has(intoName) && intoEntry && intoEntry.strategy !== 'drop'
    if (intoPresent) {
      const target = themeVarName(intoEntry.themeVar)
      rewrites.set(typoraName, target)
      entries.push({ typoraName, canonical, strategy: 'merge', target, value: rawValue, note: entry.note || `并入 ${intoName}` })
    } else {
      pushThemeVar(typoraName, canonical, { ...entry, themeVar: entry.fallbackThemeVar }, rawValue, 'theme-var', `${entry.into} 缺席，退回自有变量`)
    }
  }

  function registerPassthrough (typoraName, rawValue, note) {
    const target = themeVarName(typoraName.replace(/^--/, ''))
    themeVars.push({ name: target, value: rawValue, strategy: 'passthrough', from: typoraName })
    rewrites.set(typoraName, target)
    entries.push({ typoraName, canonical: typoraName, strategy: 'passthrough', target, value: rawValue, note })
  }

  function pushThemeVar (typoraName, canonical, entry, rawValue, strategy, extraNote) {
    const target = themeVarName(entry.themeVar)
    themeVars.push({ name: target, value: rawValue, strategy, from: typoraName })
    rewrites.set(typoraName, target)

    const forwarded = []
    for (const camel of entry.marktext || []) {
      marktextVars.push({ name: `--${camel}`, value: `var(${target})` })
      const kebab = `--${camelToKebabVar(camel)}`
      if (kebab !== `--${camel}`) kebabVars.push({ name: kebab, value: `var(--${camel})` })
      forwarded.push(`--${camel}`)
    }
    for (const kebabName of entry.kebabOnly || []) {
      kebabVars.push({ name: `--${kebabName}`, value: `var(${target})` })
      forwarded.push(`--${kebabName}`)
    }

    const notes = [entry.note, extraNote, entry.manualReview].filter(Boolean)
    entries.push({
      typoraName,
      canonical,
      strategy,
      target,
      forwarded,
      value: rawValue,
      manualReview: entry.manualReview || null,
      note: notes.join('；')
    })
  }

  return {
    themeVars,
    marktextVars,
    kebabVars,
    rewrites,
    entries,
    aliasCollisions,
    unmapped: entries.filter((e) => e.strategy === 'passthrough' || e.strategy === 'drop-unused')
  }
}

/** Rewrite every `var(--typora-name)` in a declaration value to its Reversion target. */
export function rewriteValue (value, rewrites) {
  return value.replace(/var\(\s*(--[\w-]+)/g, (match, name) => {
    const target = rewrites.get(name)
    return target ? `var(${target}` : match
  })
}
