import { describe, expect, it } from 'vitest'
import { resolveGraphRenderingBackendKind } from './backend.js'
import { FdGraphWebGL2RenderingBackend } from './webgl2-backend.js'

describe('graph rendering backend resolution', () => {
  it('selects the fastest supported production backend automatically', () => {
    expect(resolveGraphRenderingBackendKind('automatic', { webgl2: true })).toBe('webgl2')
    expect(resolveGraphRenderingBackendKind('automatic', { webgl2: false })).toBe('dom')
  })

  it('falls back safely when an explicitly requested backend is unavailable', () => {
    expect(resolveGraphRenderingBackendKind('webgl2', { webgl2: false })).toBe('dom')
    expect(resolveGraphRenderingBackendKind('dom', { webgl2: true })).toBe('dom')
  })

  it('rejects invalid density thresholds', () => {
    expect(() => new FdGraphWebGL2RenderingBackend({ maximumDOMNodeCount: 1.5 })).toThrow(
      RangeError,
    )
    expect(() => new FdGraphWebGL2RenderingBackend({ minimumDOMNodeZoom: -1 })).toThrow(RangeError)
  })
})
