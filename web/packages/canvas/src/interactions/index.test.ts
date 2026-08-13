import { describe, expect, it } from 'vitest'
import { FdGraphCanvasSnapState } from './index.js'

describe('interaction exports', () => {
  it('exports snap state as a constructible value', () => {
    expect(new FdGraphCanvasSnapState()).toBeInstanceOf(FdGraphCanvasSnapState)
  })
})
