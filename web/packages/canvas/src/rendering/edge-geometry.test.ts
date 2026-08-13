import { describe, expect, it } from 'vitest'
import { graphCubicEdgeGeometryResolver, graphCubicEdgePoint } from './edge-geometry.js'

const edge = {
  id: 'edge',
  source: { nodeID: 'source' },
  target: { nodeID: 'target' },
}

describe('graph cubic edge geometry', () => {
  it('preserves the established horizontal curve by default', () => {
    const geometry = graphCubicEdgeGeometryResolver()({
      edge,
      source: { x: 20, y: 30 },
      target: { x: 220, y: 130 },
    })

    expect(geometry.start).toEqual({ x: 20, y: 30 })
    expect(geometry.control1).toEqual({ x: 110, y: 30 })
    expect(geometry.control2).toEqual({ x: 130, y: 130 })
    expect(geometry.end).toEqual({ x: 220, y: 130 })
  })

  it('routes vertically and keeps the arrow clear of its target', () => {
    const geometry = graphCubicEdgeGeometryResolver({
      direction: 'vertical',
      minimumControlDistance: 28,
      maximumControlDistance: 54,
    })({
      edge: {
        ...edge,
        style: { targetDecoration: { kind: 'arrow', length: 6.5, width: 5.5, gap: 3 } },
      },
      source: { x: 40, y: 60 },
      target: { x: 140, y: 260 },
    })

    expect(geometry.end.y).toBeCloseTo(250.5)
    expect(geometry.targetArrow?.tip).toEqual({ x: 140, y: 257 })
    expect(geometry.control1.x).toBe(40)
    expect(geometry.control2.x).toBe(140)
  })

  it('returns a stable midpoint for label placement', () => {
    const geometry = graphCubicEdgeGeometryResolver({ direction: 'vertical' })({
      edge,
      source: { x: 0, y: 0 },
      target: { x: 100, y: 200 },
    })

    expect(graphCubicEdgePoint(geometry, 0.5)).toEqual({ x: 50, y: 100 })
  })

  it('rejects invalid control distance ranges', () => {
    expect(() =>
      graphCubicEdgeGeometryResolver({
        minimumControlDistance: 60,
        maximumControlDistance: 40,
      }),
    ).toThrow(RangeError)
  })

  it('rejects invalid arrow metrics', () => {
    const resolve = graphCubicEdgeGeometryResolver()
    expect(() =>
      resolve({
        edge: {
          ...edge,
          style: { targetDecoration: { kind: 'arrow', length: -1 } },
        },
        source: { x: 0, y: 0 },
        target: { x: 100, y: 0 },
      }),
    ).toThrow(RangeError)
  })
})
