import { describe, expect, it } from 'vitest'
import {
  graphEdgeReference,
  graphElementReferenceKey,
  graphNodeReference,
  graphPortReference,
} from './model.js'

describe('graph element references', () => {
  it('keeps element kinds and identifier types distinct', () => {
    const keys = new Set([
      graphElementReferenceKey(graphNodeReference('1')),
      graphElementReferenceKey(graphNodeReference(1)),
      graphElementReferenceKey(graphEdgeReference('1')),
      graphElementReferenceKey(graphPortReference('1', '1')),
    ])

    expect(keys.size).toBe(4)
  })

  it('does not collide when string identifiers contain delimiters', () => {
    expect(graphElementReferenceKey(graphPortReference('a:s:b', 'c'))).not.toBe(
      graphElementReferenceKey(graphPortReference('a', 'b:s:c')),
    )
  })
})
