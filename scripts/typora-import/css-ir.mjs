/**
 * Flatten a postcss AST into a simple, target-agnostic intermediate representation
 * so every later pipeline layer is a pure data transform (and unit-testable without
 * postcss node objects).
 */

import { splitSelectorList, normaliseSelector } from './selector-syntax.mjs'
import { isRootRule } from './extract-variables.mjs'

/**
 * @typedef {{prop:string,value:string,important:boolean}} IrDecl
 * @typedef {{selectors:string[],decls:IrDecl[],at:string[],line:number}} IrRule
 */

const PASSTHROUGH_AT_RULES = new Set(['font-face', 'keyframes', '-webkit-keyframes', 'supports', 'charset', 'namespace'])

/**
 * @param {import('postcss').Root} root
 * @returns {{rules:IrRule[], atRules:Array, imports:string[], includeWhenExport:string[], unsupportedAtRules:string[]}}
 */
export function flatten (root) {
  const rules = []
  const atRules = []
  const imports = []
  const includeWhenExport = []
  const unsupportedAtRules = []

  const walk = (container, atChain) => {
    container.each((node) => {
      if (node.type === 'rule') {
        if (isRootRule(node) && node.nodes && node.nodes.every((n) => n.type === 'decl' && n.prop.startsWith('--'))) {
          // :root variable block — owned by the variable-extractor layer.
          return
        }
        rules.push({
          selectors: splitSelectorList(node.selector).map(normaliseSelector),
          decls: (node.nodes || [])
            .filter((n) => n.type === 'decl')
            .map((n) => ({ prop: n.prop.trim(), value: n.value.trim(), important: Boolean(n.important) })),
          at: atChain,
          line: node.source && node.source.start ? node.source.start.line : 0
        })
        return
      }
      if (node.type === 'atrule') {
        const name = node.name.toLowerCase()
        if (name === 'media') {
          walk(node, [...atChain, `@media ${node.params.trim()}`])
          return
        }
        if (name === 'import') {
          imports.push(node.params.trim())
          return
        }
        if (name === 'include-when-export') {
          includeWhenExport.push(node.params.trim())
          return
        }
        if (PASSTHROUGH_AT_RULES.has(name)) {
          atRules.push({ name, params: node.params.trim(), css: node.toString(), line: node.source && node.source.start ? node.source.start.line : 0 })
          return
        }
        unsupportedAtRules.push(`@${node.name} ${node.params}`.trim())
      }
    })
  }

  walk(root, [])
  return { rules, atRules, imports, includeWhenExport, unsupportedAtRules }
}

/** Render a declaration list into CSS text. */
export function renderDecls (decls, indent, forceImportant) {
  return decls
    .map(({ prop, value, important }) => {
      const bang = important || forceImportant ? ' !important' : ''
      return `${indent}${prop}: ${value}${bang};`
    })
    .join('\n')
}
