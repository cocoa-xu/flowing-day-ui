import { expect, it } from 'vitest'
import { FdCanvasTransform, FdCanvasViewport } from '../geometry.js'
import { FdCanvasRenderCoverage } from './render-coverage.js'

const viewport = (offsetX: number) =>
  new FdCanvasViewport(
    new FdCanvasTransform(1, { x: offsetX, y: 0 }),
    { width: 100, height: 100 },
    { x: 0, y: 0, width: 100, height: 100 },
  )

it('retains overscan until visible bounds escape the retained rect', () => {
  const coverage = new FdCanvasRenderCoverage()
  expect(coverage.update(viewport(0), 20, 0.5, false)).toEqual({
    x: -20,
    y: -20,
    width: 140,
    height: 140,
  })
  expect(coverage.update(viewport(-5), 20, 0.5, false)).toBeUndefined()
  expect(coverage.update(viewport(-15), 20, 0.5, false)).toEqual({
    x: -5,
    y: -20,
    width: 140,
    height: 140,
  })
})
