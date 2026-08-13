import { describe, expect, it } from 'vitest'
import { resolveGraphMiniMapConfiguration, resolveGraphMiniMapStyle } from './configuration.js'
import type { FdAnyGraphMiniMapSnapshot } from './model.js'
import { planGraphMiniMap } from './planner.js'
import {
  FdGraphMiniMapPlanProjection,
  FdGraphMiniMapTransform,
  graphMiniMapIsVisible,
  graphMiniMapScopeBounds,
} from './transform.js'

const performanceConfiguration = resolveGraphMiniMapConfiguration({}).performance

const largeSnapshot = (): FdAnyGraphMiniMapSnapshot => ({
  id: 'large',
  contentBounds: { x: 0, y: 0, width: 4_800, height: 3_000 },
  nodes: Array.from({ length: 100_000 }, (_, index) => ({
    id: index,
    frame: {
      x: (index % 400) * 12,
      y: Math.floor(index / 400) * 12,
      width: 8,
      height: 8,
    },
  })),
  edges: [],
})

describe('graph minimap geometry', () => {
  it('resolves style independently from core configuration', () => {
    expect(resolveGraphMiniMapStyle({ background: '#fffaf7' }).background).toBe('#fffaf7')
    expect(resolveGraphMiniMapStyle().nodeStyles).toHaveLength(1)
  })

  it('fits and round-trips world geometry', () => {
    const transform = new FdGraphMiniMapTransform(
      { x: 100, y: 200, width: 1_000, height: 500 },
      { width: 220, height: 144 },
      10,
    )
    const world = { x: 740, y: 420 }
    const roundTripped = transform.removePoint(transform.applyPoint(world))

    expect(transform.scale).toBeCloseTo(0.2)
    expect(roundTripped.x).toBeCloseTo(world.x)
    expect(roundTripped.y).toBeCloseTo(world.y)
    expect(transform.removeSize({ width: 20, height: 10 })).toEqual({
      width: 100,
      height: 50,
    })
  })

  it('supports overview, local navigator, and automatic visibility', () => {
    expect(
      graphMiniMapScopeBounds(
        { kind: 'overview' },
        { x: 100, y: 100, width: 400, height: 300 },
        { x: -200, y: 50, width: 200, height: 160 },
      ),
    ).toEqual({ x: -200, y: 50, width: 700, height: 350 })
    expect(
      graphMiniMapScopeBounds(
        { kind: 'localNavigator', surroundingScale: 3 },
        { x: 0, y: 0, width: 10_000, height: 10_000 },
        { x: 400, y: 300, width: 800, height: 600 },
      ),
    ).toEqual({ x: -400, y: -300, width: 2_400, height: 1_800 })
    expect(
      graphMiniMapIsVisible(
        'whenNavigationIsUseful',
        { x: 100, y: 100, width: 300, height: 200 },
        { x: 0, y: 0, width: 800, height: 600 },
      ),
    ).toBe(false)
  })

  it('projects a retained plan into a changing display transform', () => {
    const source = new FdGraphMiniMapTransform(
      { x: 0, y: 0, width: 1_000, height: 500 },
      { width: 220, height: 144 },
      10,
    )
    const target = new FdGraphMiniMapTransform(
      { x: -400, y: -200, width: 1_800, height: 900 },
      { width: 220, height: 144 },
      10,
    )
    const projection = new FdGraphMiniMapPlanProjection(source, target)
    const world = { x: 720, y: 310 }
    const projected = projection.applyPoint(source.applyPoint(world))

    expect(projected.x).toBeCloseTo(target.applyPoint(world).x)
    expect(projected.y).toBeCloseTo(target.applyPoint(world).y)
  })
})

describe('graph minimap planning', () => {
  it('preserves developer styles in silhouette mode', () => {
    const snapshot: FdAnyGraphMiniMapSnapshot = {
      id: 'styled',
      contentBounds: { x: 0, y: 0, width: 240, height: 40 },
      nodes: [0, 1, 2].map((id) => ({
        id,
        frame: { x: id * 100, y: 0, width: 40, height: 40 },
      })),
      edges: [],
    }
    const plan = planGraphMiniMap({
      snapshot,
      transform: new FdGraphMiniMapTransform(
        snapshot.contentBounds,
        { width: 300, height: 100 },
        0,
      ),
      representation: 'silhouette',
      performance: performanceConfiguration,
      availableNodeStyleCount: 2,
      nodeStyleIndex: ({ id }) => Number(id) % 2,
    })

    expect(plan.aggregated).toBe(false)
    expect(plan.nodeBatches.map(({ styleIndex }) => styleIndex)).toEqual([0, 1])
    expect(plan.nodeBatches.map(({ rects }) => rects.length)).toEqual([2, 1])
    expect(plan.edgeSegments).toHaveLength(0)
  })

  it('includes simplified edges in structure mode', () => {
    const snapshot: FdAnyGraphMiniMapSnapshot = {
      id: 'structure',
      contentBounds: { x: 0, y: 0, width: 200, height: 100 },
      nodes: [
        { id: 0, frame: { x: 0, y: 0, width: 40, height: 40 } },
        { id: 1, frame: { x: 160, y: 60, width: 40, height: 40 } },
      ],
      edges: [{ id: 0, start: { x: 20, y: 20 }, end: { x: 180, y: 80 } }],
    }
    const plan = planGraphMiniMap({
      snapshot,
      transform: new FdGraphMiniMapTransform(
        snapshot.contentBounds,
        { width: 200, height: 100 },
        0,
      ),
      representation: 'structure',
      performance: performanceConfiguration,
      availableNodeStyleCount: 1,
      nodeStyleIndex: () => 0,
    })

    expect(plan.edgeSegments).toHaveLength(1)
  })

  it('skips non-finite geometry and preserves integer style identities', () => {
    const snapshot: FdAnyGraphMiniMapSnapshot = {
      id: 'invalid-geometry',
      contentBounds: { x: 0, y: 0, width: 100, height: 100 },
      nodes: [
        { id: 'valid', frame: { x: 0, y: 0, width: 40, height: 40 } },
        { id: 'invalid', frame: { x: Number.NaN, y: 0, width: 40, height: 40 } },
      ],
      edges: [
        { id: 'valid', start: { x: 0, y: 0 }, end: { x: 40, y: 40 } },
        { id: 'invalid', start: { x: 0, y: 0 }, end: { x: Number.NaN, y: 40 } },
      ],
    }
    const plan = planGraphMiniMap({
      snapshot,
      transform: new FdGraphMiniMapTransform(
        snapshot.contentBounds,
        { width: 100, height: 100 },
        0,
      ),
      representation: 'structure',
      performance: performanceConfiguration,
      availableNodeStyleCount: 2,
      nodeStyleIndex: () => -1,
    })

    expect(plan.nodeBatches).toMatchObject([{ styleIndex: -1, rects: [{}] }])
    expect(plan.edgeSegments).toHaveLength(1)
  })

  it('bounds a hundred-thousand-node adaptive plan by its pixel budget', () => {
    const snapshot = largeSnapshot()
    const plan = planGraphMiniMap({
      snapshot,
      transform: new FdGraphMiniMapTransform(
        snapshot.contentBounds,
        { width: 220, height: 144 },
        10,
      ),
      representation: 'adaptive',
      performance: performanceConfiguration,
      availableNodeStyleCount: 4,
      nodeStyleIndex: ({ id }) => Number(id) % 4,
    })
    const primitiveCount = plan.nodeBatches.reduce((count, batch) => count + batch.rects.length, 0)

    expect(plan.aggregated).toBe(true)
    expect(primitiveCount).toBeLessThanOrEqual(Math.ceil(220 / 2) * Math.ceil(144 / 2))
    expect(plan.nodeBatches.length).toBeLessThanOrEqual(4)
    expect(plan.edgeSegments).toHaveLength(0)
  })

  it('honors the explicit aggregation memory ceiling', () => {
    const snapshot = largeSnapshot()
    const performance = resolveGraphMiniMapConfiguration({
      performance: {
        aggregationCellSize: 1,
        maximumNodePrimitiveDensity: 0.001,
        maximumAggregationCellCount: 10_000,
      },
    }).performance
    const plan = planGraphMiniMap({
      snapshot,
      transform: new FdGraphMiniMapTransform(
        snapshot.contentBounds,
        { width: 4_000, height: 4_000 },
        0,
      ),
      representation: 'adaptive',
      performance,
      availableNodeStyleCount: 1,
      nodeStyleIndex: () => 0,
    })
    const primitiveCount = plan.nodeBatches.reduce((count, batch) => count + batch.rects.length, 0)

    expect(primitiveCount).toBeLessThanOrEqual(10_000)
  })

  it('cooperatively cancels expensive planning', () => {
    const snapshot = largeSnapshot()
    const controller = new AbortController()
    controller.abort()

    expect(() =>
      planGraphMiniMap({
        snapshot,
        transform: new FdGraphMiniMapTransform(
          snapshot.contentBounds,
          { width: 220, height: 144 },
          10,
        ),
        representation: 'adaptive',
        performance: performanceConfiguration,
        availableNodeStyleCount: 1,
        nodeStyleIndex: () => 0,
        signal: controller.signal,
      }),
    ).toThrow()
  })
})
