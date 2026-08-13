import { describe, expect, it } from 'vitest'
import { FdGraphCanvasAnchor } from '../graph/content.js'
import { FdGraphEdgeRoute } from '../layout/pipeline.js'
import { FdGraphCanvasResizeBehavior } from './arrangement.js'
import { FdGraphCanvasTransientGeometry } from './transient-geometry.js'

describe('graph canvas transient geometry', () => {
  const frame = { x: 10, y: 20, width: 100, height: 50 }

  it('resizes edges using standard and modifier-derived behavior', () => {
    expect(
      FdGraphCanvasTransientGeometry.resizing(frame, new Set(['trailing', 'bottom']), {
        width: 20,
        height: 10,
      }),
    ).toEqual({ x: 10, y: 20, width: 120, height: 60 })

    expect(
      FdGraphCanvasTransientGeometry.resizing(
        frame,
        new Set(['leading']),
        { width: 5, height: 0 },
        new Set(['resizeFromCenter']),
      ),
    ).toEqual({ x: 15, y: 20, width: 90, height: 50 })

    expect(
      FdGraphCanvasTransientGeometry.resizing(
        frame,
        new Set(['trailing', 'bottom']),
        { width: 20, height: 40 },
        new Set(['preserveResizeAspectRatio']),
      ),
    ).toEqual({ x: 10, y: 20, width: 180, height: 90 })

    expect(
      FdGraphCanvasTransientGeometry.resizing(
        frame,
        new Set(['trailing', 'bottom']),
        { width: 20, height: 40 },
        new FdGraphCanvasResizeBehavior({
          preservesAspectRatio: true,
          aspectRatioDrivingAxis: 'horizontal',
        }),
      ),
    ).toEqual({ x: 10, y: 20, width: 120, height: 60 })

    expect(
      FdGraphCanvasTransientGeometry.resizing(
        frame,
        new Set(['trailing']),
        { width: 20, height: 0 },
        new Set(['preserveResizeAspectRatio']),
      ),
    ).toEqual({ x: 10, y: 15, width: 120, height: 60 })
  })

  it('validates resize behavior and resize edges', () => {
    expect(() => new FdGraphCanvasResizeBehavior({ preservesAspectRatio: true })).toThrow(
      'aspect ratio preservation requires a driving axis',
    )
    expect(() =>
      FdGraphCanvasTransientGeometry.resizing(frame, new Set(['leading', 'trailing']), {
        width: 10,
        height: 0,
      }),
    ).toThrow('invalid resize edges')
  })

  it('constrains translation using normalized dominant movement', () => {
    expect(
      FdGraphCanvasTransientGeometry.dominantAxis(
        { width: 20, height: 20 },
        { width: 200, height: 50 },
      ),
    ).toBe('vertical')
    expect(
      FdGraphCanvasTransientGeometry.constrainingToDominantAxis({ width: -12, height: 8 }),
    ).toEqual({ width: -12, height: 0 })
    expect(
      FdGraphCanvasTransientGeometry.constraining({ width: -12, height: 8 }, 'vertical'),
    ).toEqual({ width: 0, height: 8 })
  })

  it('reflows anchors and frames between selection bounds', () => {
    const source = { x: 0, y: 0, width: 100, height: 100 }
    const destination = { x: 10, y: 20, width: 200, height: 40 }
    const anchor = new FdGraphCanvasAnchor({ x: 25, y: 75 }, { dx: 0, dy: -1 })

    expect(FdGraphCanvasTransientGeometry.resizing(anchor, source, destination)).toEqual(
      new FdGraphCanvasAnchor({ x: 60, y: 50 }, { dx: 0, dy: -1 }),
    )
    expect(
      FdGraphCanvasTransientGeometry.resizing(
        { x: 25, y: 50, width: 20, height: 10 },
        source,
        destination,
      ),
    ).toEqual({ x: 60, y: 40, width: 40, height: 4 })

    const scaled = FdGraphCanvasTransientGeometry.scaling(
      new Map([
        ['first', { x: 0, y: 0, width: 10, height: 20 }],
        ['second', { x: 50, y: 50, width: 20, height: 30 }],
      ]),
      source,
      destination,
    )
    expect(scaled.get('first')).toEqual({ x: 10, y: 20, width: 20, height: 8 })
    expect(scaled.get('second')).toEqual({ x: 110, y: 40, width: 40, height: 12 })
  })

  it('deforms every route segment according to endpoint progress', () => {
    const route = new FdGraphEdgeRoute({ x: 0, y: 0 }, [
      { kind: 'line', end: { x: 10, y: 0 } },
      { kind: 'quadratic', control: { x: 15, y: 5 }, end: { x: 20, y: 0 } },
      {
        kind: 'cubic',
        control1: { x: 23, y: 0 },
        control2: { x: 27, y: 0 },
        end: { x: 30, y: 0 },
      },
    ])
    const result = FdGraphCanvasTransientGeometry.deforming(
      route,
      { width: 0, height: 10 },
      { width: 30, height: 40 },
    )

    expect(result.start).toEqual({ x: 0, y: 10 })
    expect(result.segments[0]).toEqual({ kind: 'line', end: { x: 20, y: 20 } })
    expect(result.segments[1]).toEqual({
      kind: 'quadratic',
      control: { x: 30, y: 30 },
      end: { x: 40, y: 30 },
    })
    const cubic = result.segments[2]
    expect(cubic?.kind).toBe('cubic')
    if (cubic?.kind !== 'cubic') return
    expect(cubic.control1.x).toBeCloseTo(46.333333)
    expect(cubic.control1.y).toBeCloseTo(33.333333)
    expect(cubic.control2.x).toBeCloseTo(53.666667)
    expect(cubic.control2.y).toBeCloseTo(36.666667)
    expect(cubic.end).toEqual({ x: 60, y: 40 })
  })

  it('translates the start of an empty route', () => {
    expect(
      FdGraphCanvasTransientGeometry.deforming(
        new FdGraphEdgeRoute({ x: 5, y: 7 }, []),
        { width: 2, height: 3 },
        { width: 20, height: 30 },
      ),
    ).toEqual(new FdGraphEdgeRoute({ x: 7, y: 10 }, []))
  })
})
