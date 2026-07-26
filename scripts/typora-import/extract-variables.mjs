/**
 * Pipeline layer 1 — variable-extractor (规格 §6).
 *
 * 输入：postcss AST
 * 输出：{ typoraVarName: rawValue } 字典 + 声明顺序
 * 职责：只读 :root（以及等价的 html/:root 组合），不碰其余规则。
 */

const ROOT_SELECTOR = /(^|,)\s*(:root|html)\s*(,|$)/

export function isRootRule (rule) {
  if (!rule || rule.type !== 'rule') return false
  return ROOT_SELECTOR.test(rule.selector.replace(/\s+/g, ' '))
}

/**
 * @param {import('postcss').Root} root
 * @returns {{values: Map<string,string>, order: string[], rootRules: number, declarations: number}}
 */
export function extractVariables (root) {
  const values = new Map()
  const order = []
  let rootRules = 0
  let declarations = 0

  root.walkRules((rule) => {
    if (!isRootRule(rule)) return
    let hits = 0
    rule.walkDecls((decl) => {
      if (!decl.prop.startsWith('--')) return
      hits += 1
      declarations += 1
      if (!values.has(decl.prop)) order.push(decl.prop)
      values.set(decl.prop, decl.value.trim())
    })
    if (hits) rootRules += 1
  })

  return { values, order, rootRules, declarations }
}

/** Collect every `var(--x)` reference that appears anywhere in the stylesheet. */
export function collectVariableReferences (root) {
  const refs = new Map()
  root.walkDecls((decl) => {
    for (const name of findVarReferences(decl.value)) {
      refs.set(name, (refs.get(name) || 0) + 1)
    }
  })
  return refs
}

const VAR_REF = /var\(\s*(--[\w-]+)/g

export function findVarReferences (value) {
  const out = []
  if (typeof value !== 'string') return out
  VAR_REF.lastIndex = 0
  let match
  while ((match = VAR_REF.exec(value))) out.push(match[1])
  return out
}
