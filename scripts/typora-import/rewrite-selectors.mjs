/**
 * Pipeline layer 3 — selector-rewriter (规格 §6，拆两路并行).
 *
 * 输入：剥离后的 IR 规则 + scripts/typora-map/selectors.mjs 映射表
 * 输出 A：编辑器规则（根作用域 #ag-editor-id）
 * 输出 B：导出规则（根作用域 .markdown-body）
 *
 * 硬性约束（规格 §6）：严禁「看起来像」的启发式重写。命中不了白名单的一律进
 * 「未映射」清单交人工处理。
 */

import {
  ROOT_TARGETS,
  SEQUENCE_MAP,
  PSEUDO_ONLY_ENTRY,
  lookupToken,
  resolveFontRole,
  resolveScope
} from '../typora-map/selectors.mjs'
import {
  splitCompounds,
  parseCompound,
  expandSelector,
  normaliseSelector
} from './selector-syntax.mjs'

const toArray = (value) => (Array.isArray(value) ? value : [value])

/**
 * Resolve one normalised Typora selector for one target.
 * @returns {{ok:true, selectors:string[], fontRole:string|null, entry:object, propRoutes?:object, prefix?:string}
 *          |{ok:false, reason:'unmapped'|'target-unsupported'|'unparsed', detail:string}}
 */
export function resolveSelector (selector, target) {
  const normalised = normaliseSelector(selector)

  const sequence = SEQUENCE_MAP[normalised]
  if (sequence) {
    const replacement = sequence[target]
    if (replacement === null || replacement === undefined) {
      return { ok: false, reason: 'target-unsupported', detail: sequence.note || `${target} 目标无对应结构`, entry: sequence }
    }
    const scoped = toArray(replacement).map((sel) => scopeSelector(sel, resolveScope(sequence, target), target))
    return { ok: true, selectors: scoped, fontRole: resolveFontRole(sequence, target), entry: sequence, viaSequence: true }
  }

  const { compounds, combinators } = splitCompounds(normalised)
  if (!compounds.length) return { ok: false, reason: 'unparsed', detail: selector }

  const alternatives = []
  const usedCombinators = []
  let inAppContext = false
  let lastEntry = null
  let firstEntry = null
  let propRouteEntry = null

  for (let i = 0; i < compounds.length; i += 1) {
    const compound = compounds[i]
    const parsed = parseCompound(compound)
    if (parsed.unparsed) return { ok: false, reason: 'unparsed', detail: compound }

    const pseudoSuffix = parsed.pseudos.join('')
    const attrSuffix = parsed.attrs.join('')

    if (inAppContext) {
      // Inside a CodeMirror subtree the DOM is CodeMirror's own, not muya's:
      // pass the compound through verbatim instead of guessing an ag-* class.
      if (alternatives.length) usedCombinators.push(combinators[i - 1] || '')
      alternatives.push([compound])
      continue
    }

    const resolved = resolveCompound(parsed, compound, target)
    if (!resolved.ok) return resolved

    lastEntry = resolved.entry
    if (i === 0) firstEntry = resolved.entry

    const isLast = i === compounds.length - 1
    const routable = Boolean(resolved.entry.propRoutes) && resolved.replacement === null && isLast
    if (routable) {
      propRouteEntry = resolved.entry
    } else if (!resolved.verbatim && resolved.replacement === null) {
      return { ok: false, reason: 'target-unsupported', detail: resolved.entry.note || `${target} 目标无对应结构`, entry: resolved.entry }
    }

    if (resolved.entry.absorbAncestors) {
      alternatives.length = 0
      usedCombinators.length = 0
      inAppContext = true
      firstEntry = resolved.entry
    } else if (alternatives.length) {
      usedCombinators.push(combinators[i - 1] || '')
    }

    if (resolveScope(resolved.entry, target) === 'app') inAppContext = true

    const values = resolved.verbatim || resolved.replacement === null
      ? [compound]
      : toArray(resolved.replacement).map((sel) => `${sel}${attrSuffix}${pseudoSuffix}`)
    alternatives.push(values)
  }

  const firstScope = firstEntry ? resolveScope(firstEntry, target) : 'content'
  const unscoped = inAppContext ||
    firstScope === 'root' || firstScope === 'app' ||
    Boolean(lastEntry && lastEntry.passthrough && compounds.length === 1)

  if (propRouteEntry) {
    const prefixAlternatives = alternatives.slice(0, -1)
    const prefixCombinators = usedCombinators.slice(0, Math.max(0, prefixAlternatives.length - 1))
    const prefixes = prefixAlternatives.length
      ? expandSelector(prefixAlternatives, prefixCombinators)
      : ['']
    const rootPrefix = unscoped ? '' : ROOT_TARGETS[target]
    return {
      ok: true,
      selectors: [],
      propRoutes: propRouteEntry,
      prefixes: prefixes.map((p) => [rootPrefix, p].filter(Boolean).join(' ')),
      fontRole: resolveFontRole(propRouteEntry, target),
      entry: propRouteEntry
    }
  }

  let selectors = expandSelector(alternatives, usedCombinators)
  if (!unscoped) selectors = selectors.map((sel) => `${ROOT_TARGETS[target]} ${sel}`)

  return { ok: true, selectors, fontRole: resolveFontRole(lastEntry, target), entry: lastEntry, firstEntry }
}

function resolveCompound (parsed, compound, target) {
  const baseNoAttrs = `${parsed.element || ''}${parsed.ids.join('')}${parsed.classes.join('')}`

  if (!baseNoAttrs && !parsed.attrs.length && parsed.pseudos.length) {
    return { ok: true, entry: PSEUDO_ONLY_ENTRY, replacement: null, verbatim: true }
  }

  const candidates = []
  if (parsed.base) candidates.push(parsed.base)
  if (baseNoAttrs && baseNoAttrs !== parsed.base) candidates.push(baseNoAttrs)
  candidates.push(...parsed.ids, ...parsed.classes)
  if (parsed.element) candidates.push(parsed.element)

  let entry = null
  let anchor = null
  for (const candidate of candidates) {
    const found = lookupToken(candidate)
    if (found) {
      entry = found
      anchor = candidate
      break
    }
  }

  if (!entry) {
    return { ok: false, reason: 'unmapped', detail: compound }
  }

  // Strict whitelist: every id/class must be accounted for by the anchor.
  const anchorCoversAll = anchor === parsed.base || anchor === baseNoAttrs
  if (!anchorCoversAll) {
    const leftovers = [...parsed.ids, ...parsed.classes].filter((token) => token !== anchor)
    if (leftovers.length) {
      return { ok: false, reason: 'unmapped', detail: `${compound}（未识别：${leftovers.join('')}）` }
    }
  }

  if (entry.passthrough) {
    return { ok: true, entry, replacement: baseNoAttrs || compound }
  }

  const replacement = Object.prototype.hasOwnProperty.call(entry, target) ? entry[target] : undefined
  if (replacement === undefined) {
    return { ok: false, reason: 'unmapped', detail: compound }
  }
  return { ok: true, entry, replacement }
}

function scopeSelector (selector, scope, target) {
  if (scope === 'app' || scope === 'root') return selector
  return `${ROOT_TARGETS[target]} ${selector}`
}

/**
 * Rewrite a whole rule set for one target.
 * @param {import('./css-ir.mjs').IrRule[]} rules
 * @param {'editor'|'export'} target
 */
export function rewriteRules (rules, target) {
  const out = []
  const unmapped = []
  const targetUnsupported = []
  const capturedVars = []
  const routedPropIssues = []

  for (const rule of rules) {
    const resolvedGroups = []

    for (const selector of rule.selectors) {
      const resolved = resolveSelector(selector, target)
      if (!resolved.ok) {
        const record = { selector, line: rule.line, reason: resolved.reason, detail: resolved.detail, target }
        if (resolved.reason === 'target-unsupported') targetUnsupported.push(record)
        else unmapped.push(record)
        continue
      }

      if (resolved.propRoutes) {
        const routed = applyPropRoutes(resolved, rule, target)
        out.push(...routed.rules)
        capturedVars.push(...routed.vars)
        routedPropIssues.push(...routed.issues)
        continue
      }

      // Variables captured from a top-level rule (e.g. #write { max-width } → --editorAreaWidth).
      if (resolved.entry && resolved.entry.captureVars && !rule.at.length) {
        for (const [prop, spec] of Object.entries(resolved.entry.captureVars)) {
          const decl = rule.decls.find((d) => d.prop === prop)
          if (decl) capturedVars.push({ marktext: spec.marktext, kebab: spec.kebab, value: decl.value, from: `${selector}{${prop}}` })
        }
      }

      if (resolved.entry && resolved.entry.companion && resolved.entry.companion.target === target && !rule.at.length) {
        const companion = resolved.entry.companion
        const decls = rule.decls.filter((d) => companion.props.includes(d.prop))
        if (decls.length) {
          out.push({ selectors: [companion.selector], decls, at: rule.at, fontRole: null, origin: `${selector}（伴生规则）`, line: rule.line })
        }
      }

      resolvedGroups.push({ selectors: resolved.selectors, fontRole: resolved.fontRole, origin: selector })
    }

    if (!resolvedGroups.length) continue

    const hasFontFamily = rule.decls.some((d) => d.prop === 'font-family')
    if (!hasFontFamily) {
      out.push({
        selectors: [...new Set(resolvedGroups.flatMap((g) => g.selectors))],
        decls: rule.decls,
        at: rule.at,
        fontRole: null,
        origin: resolvedGroups.map((g) => g.origin).join(', '),
        line: rule.line
      })
      continue
    }

    const byRole = new Map()
    for (const group of resolvedGroups) {
      const key = group.fontRole || ''
      if (!byRole.has(key)) byRole.set(key, { selectors: [], origins: [] })
      byRole.get(key).selectors.push(...group.selectors)
      byRole.get(key).origins.push(group.origin)
    }
    for (const [role, group] of byRole) {
      out.push({
        selectors: [...new Set(group.selectors)],
        decls: rule.decls,
        at: rule.at,
        fontRole: role || null,
        origin: group.origins.join(', '),
        line: rule.line
      })
    }
  }

  return { rules: out, unmapped, targetUnsupported, capturedVars, routedPropIssues }
}

function applyPropRoutes (resolved, rule, target) {
  const entry = resolved.propRoutes
  const vars = []
  const issues = []
  const consumed = new Set()
  const byTarget = new Map()

  for (const route of entry.propRoutes) {
    const decls = []
    for (const decl of rule.decls) {
      if (!route.props.includes(decl.prop)) continue
      consumed.add(decl.prop)
      decls.push({ prop: route.renameTo || decl.prop, value: decl.value, important: decl.important })
      if (route.variable) vars.push({ marktext: route.variable, value: decl.value, from: `hr{${decl.prop}}` })
    }
    if (!decls.length) continue
    for (const [prop, value] of route.appendDecls || []) {
      if (!decls.some((d) => d.prop === prop)) decls.push({ prop, value, important: false })
    }
    if (!byTarget.has(route.target)) {
      byTarget.set(route.target, {
        selectors: [...new Set(resolved.prefixes.map((prefix) => [prefix, route.target].filter(Boolean).join(' ')))],
        decls: [],
        at: rule.at,
        fontRole: null,
        origin: `${rule.selectors.join(', ')}（属性改道 → ${route.target}）`,
        line: rule.line
      })
    }
    const bucket = byTarget.get(route.target)
    for (const decl of decls) {
      if (!bucket.decls.some((d) => d.prop === decl.prop)) bucket.decls.push(decl)
    }
  }
  const rules = [...byTarget.values()]

  for (const decl of rule.decls) {
    if (consumed.has(decl.prop)) continue
    if ((entry.dropProps || []).includes(decl.prop)) continue
    issues.push({ prop: decl.prop, value: decl.value, line: rule.line, target, detail: '属性改道未覆盖，未搬运到任何目标' })
  }

  return { rules, vars, issues }
}
