/**
 * Selector syntax helpers shared by the stripper and the selector rewriter.
 * Pure syntax: contains no Typora → Reversion mapping knowledge.
 */

/** Split a selector list on top-level commas (respects (), [], "" and ''). */
export function splitSelectorList (selectorList) {
  const out = []
  let depth = 0
  let quote = null
  let current = ''

  for (const ch of selectorList) {
    if (quote) {
      current += ch
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
      continue
    }
    if (ch === '(' || ch === '[') depth += 1
    if (ch === ')' || ch === ']') depth -= 1
    if (ch === ',' && depth === 0) {
      out.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) out.push(current)
  return out.map((s) => s.trim()).filter(Boolean)
}

/** Collapse whitespace and normalise combinators to a single canonical spacing. */
export function normaliseSelector (selector) {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .trim()
}

/**
 * Split one normalised selector into compounds and combinators.
 * @returns {{compounds: string[], combinators: string[]}} combinators[i] joins
 *   compounds[i] and compounds[i + 1]; '' means descendant.
 */
export function splitCompounds (selector) {
  const parts = normaliseSelector(selector).split(' ')
  const compounds = []
  const combinators = []
  let pendingCombinator = null

  for (const part of parts) {
    if (part === '>' || part === '+' || part === '~') {
      pendingCombinator = part
      continue
    }
    if (compounds.length) combinators.push(pendingCombinator || '')
    compounds.push(part)
    pendingCombinator = null
  }
  return { compounds, combinators }
}

/** Join compounds back with their combinators. */
export function joinCompounds (compounds, combinators) {
  let out = compounds[0] || ''
  for (let i = 1; i < compounds.length; i += 1) {
    const combinator = combinators[i - 1]
    out += combinator ? ` ${combinator} ` : ' '
    out += compounds[i]
  }
  return out
}

const SIMPLE_TOKEN = /^(?:[*]|[a-zA-Z][\w-]*)/
const ID_TOKEN = /^#[\w-]+/
const CLASS_TOKEN = /^\.[\w-]+/

/**
 * Tokenise a compound selector.
 * @returns {{element:string|null, ids:string[], classes:string[], attrs:string[], pseudos:string[], base:string}}
 */
export function parseCompound (compound) {
  let rest = compound
  let element = null
  const ids = []
  const classes = []
  const attrs = []
  const pseudos = []

  const elementMatch = rest.match(SIMPLE_TOKEN)
  if (elementMatch) {
    element = elementMatch[0]
    rest = rest.slice(element.length)
  }

  while (rest.length) {
    if (rest.startsWith('::') || rest.startsWith(':')) {
      const isDouble = rest.startsWith('::')
      let i = isDouble ? 2 : 1
      while (i < rest.length && /[\w-]/.test(rest[i])) i += 1
      let token = rest.slice(0, i)
      if (rest[i] === '(') {
        let depth = 0
        let j = i
        for (; j < rest.length; j += 1) {
          if (rest[j] === '(') depth += 1
          else if (rest[j] === ')') {
            depth -= 1
            if (depth === 0) { j += 1; break }
          }
        }
        token = rest.slice(0, j)
        i = j
      }
      pseudos.push(token)
      rest = rest.slice(i)
      continue
    }
    if (rest.startsWith('[')) {
      let depth = 0
      let j = 0
      for (; j < rest.length; j += 1) {
        if (rest[j] === '[') depth += 1
        else if (rest[j] === ']') {
          depth -= 1
          if (depth === 0) { j += 1; break }
        }
      }
      attrs.push(rest.slice(0, j))
      rest = rest.slice(j)
      continue
    }
    const idMatch = rest.match(ID_TOKEN)
    if (idMatch) {
      ids.push(idMatch[0])
      rest = rest.slice(idMatch[0].length)
      continue
    }
    const classMatch = rest.match(CLASS_TOKEN)
    if (classMatch) {
      classes.push(classMatch[0])
      rest = rest.slice(classMatch[0].length)
      continue
    }
    // Unrecognised syntax: surface it so the caller can bail out safely.
    return { element, ids, classes, attrs, pseudos, base: compound, unparsed: rest }
  }

  const base = `${element || ''}${ids.join('')}${classes.join('')}${attrs.join('')}`
  return { element, ids, classes, attrs, pseudos, base, unparsed: '' }
}

/** Cartesian product of per-position alternatives, joined by combinators. */
export function expandSelector (alternativesPerCompound, combinators) {
  let acc = ['']
  for (let i = 0; i < alternativesPerCompound.length; i += 1) {
    const alternatives = alternativesPerCompound[i]
    const next = []
    for (const prefix of acc) {
      for (const alternative of alternatives) {
        if (!prefix) {
          next.push(alternative)
          continue
        }
        const combinator = combinators[i - 1]
        next.push(combinator ? `${prefix} ${combinator} ${alternative}` : `${prefix} ${alternative}`)
      }
    }
    acc = next
  }
  return [...new Set(acc)].filter(Boolean)
}
