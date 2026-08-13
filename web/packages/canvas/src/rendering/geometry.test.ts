import { describe, expect, it } from 'vitest'
import { FdCanvasTransform } from '../geometry.js'
import { FdGraphCanvasAnchor } from '../graph/content.js'
import { FdGraphEdgeRoute } from '../layout/pipeline.js'
import { FdGraphCanvasRenderingGeometry } from './geometry.js'

describe('graph canvas rendering geometry', () => {
  it('translates an anchor without changing its normal', () => {
    const anchor = new FdGraphCanvasAnchor({ x: 10, y: 20 }, { dx: 1, dy: 0 })

    expect(FdGraphCanvasRenderingGeometry.translated(anchor, { width: -4, height: 7 })).toEqual(
      new FdGraphCanvasAnchor({ x: 6, y: 27 }, { dx: 1, dy: 0 }),
    )
  })

  it('transforms every point in a mixed route relative to the render origin', () => {
    const route = new FdGraphEdgeRoute({ x: 1, y: 2 }, [
      { kind: 'line', end: { x: 3, y: 4 } },
      { kind: 'quadratic', control: { x: 5, y: 6 }, end: { x: 7, y: 8 } },
      {
        kind: 'cubic',
        control1: { x: 9, y: 10 },
        control2: { x: 11, y: 12 },
        end: { x: 13, y: 14 },
      },
    ])

    expect(
      FdGraphCanvasRenderingGeometry.transformed(
        route,
        new FdCanvasTransform(2, { x: 10, y: 20 }),
        { x: 5, y: 7 },
      ),
    ).toEqual(
      new FdGraphEdgeRoute({ x: 7, y: 17 }, [
        { kind: 'line', end: { x: 11, y: 21 } },
        { kind: 'quadratic', control: { x: 15, y: 25 }, end: { x: 19, y: 29 } },
        {
          kind: 'cubic',
          control1: { x: 23, y: 33 },
          control2: { x: 27, y: 37 },
          end: { x: 31, y: 41 },
        },
      ]),
    )
  })
})
