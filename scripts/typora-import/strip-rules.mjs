/**
 * Pipeline layer 4 — stripper (规格 §6；按规格要求「先于 selector-rewriter 跑」).
 *
 * 输入：IR 规则清单 + 剥离清单（scripts/typora-map/strip.mjs）
 * 输出：保留规则 + 被剥离记录（含原因）+ 需人工确认记录
 */

import { matchStripRule } from '../typora-map/strip.mjs'

/**
 * @param {import('./css-ir.mjs').IrRule[]} rules
 */
export function stripRules (rules) {
  const kept = []
  const stripped = []
  const manualReview = []

  for (const rule of rules) {
    // A whole @media print block is stripped wholesale (规格 §4).
    const atHit = rule.at
      .map((at) => ({ at, hit: matchStripRule(at.replace(/\s+/g, ' ').trim()) }))
      .find((candidate) => candidate.hit)
    if (atHit) {
      record(atHit.hit, rule, rule.selectors)
      continue
    }

    const keptSelectors = []
    const droppedBuckets = new Map()

    for (const selector of rule.selectors) {
      const hit = matchStripRule(selector)
      if (!hit) {
        keptSelectors.push(selector)
        continue
      }
      if (!droppedBuckets.has(hit.id)) droppedBuckets.set(hit.id, { hit, selectors: [] })
      droppedBuckets.get(hit.id).selectors.push(selector)
    }

    for (const { hit, selectors } of droppedBuckets.values()) {
      record(hit, rule, selectors)
    }

    if (keptSelectors.length) {
      kept.push({ ...rule, selectors: keptSelectors })
    }
  }

  function record (hit, rule, selectors) {
    const entry = {
      ruleId: hit.id,
      reason: hit.reason,
      selectors,
      line: rule.line,
      declCount: rule.decls.length
    }
    stripped.push(entry)
    if (hit.disposition === 'manual') manualReview.push(entry)
  }

  return { kept, stripped, manualReview }
}
