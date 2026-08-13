import { describe, expect, it } from 'vitest'
import { FdGraphEdgeRoute } from '../layout/pipeline.js'
import {
  graphCubicEdgeGeometryResolver,
  graphEdgeCubicSegments,
  graphEdgePath,
  graphEdgePoint,
} from './edge-geometry.js'

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

    expect(graphEdgeCubicSegments(geometry)).toEqual([
      {
        start: { x: 20, y: 30 },
        control1: { x: 110, y: 30 },
        control2: { x: 130, y: 130 },
        end: { x: 220, y: 130 },
      },
    ])
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

    const segment = graphEdgeCubicSegments(geometry)[0]
    expect(segment?.end.y).toBeCloseTo(250.5)
    expect(geometry.targetArrow?.tip).toEqual({ x: 140, y: 257 })
    expect(segment?.control1.x).toBe(40)
    expect(segment?.control2.x).toBe(140)
  })

  it('returns a stable midpoint for label placement', () => {
    const geometry = graphCubicEdgeGeometryResolver({ direction: 'vertical' })({
      edge,
      source: { x: 0, y: 0 },
      target: { x: 100, y: 200 },
    })

    expect(graphEdgePoint(geometry, 0.5)).toEqual({ x: 50, y: 100 })
  })

  it('preserves mixed layout route segments without flattening their path', () => {
    const route = new FdGraphEdgeRoute({ x: 0, y: 0 }, [
      { kind: 'line', end: { x: 20, y: 0 } },
      { kind: 'quadratic', control: { x: 30, y: 10 }, end: { x: 40, y: 0 } },
      {
        kind: 'cubic',
        control1: { x: 50, y: -10 },
        control2: { x: 60, y: 10 },
        end: { x: 70, y: 0 },
      },
    ])

    expect(graphEdgePath({ route })).toBe('M 0 0 L 20 0 Q 30 10, 40 0 C 50 -10, 60 10, 70 0')
    expect(graphEdgeCubicSegments({ route })).toHaveLength(3)
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
