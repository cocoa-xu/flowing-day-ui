import { describe, expect, it, vi } from 'vitest'
import { FdCanvasViewport } from '../geometry.js'
import { FdGraphCanvasEdgeReconnectionActions } from '../interactions/connection-model.js'
import { FdGraphCanvasSessionID, FdGraphCanvasSessionState } from '../interactions/session.js'
import { FdGraphEdgeRoute } from '../layout/pipeline.js'
import { FdCanvasProxy, FdCanvasRenderContext } from '../rendering-context.js'
import {
  FdGraphCanvasAnchor,
  type FdGraphCanvasContent,
  FdGraphCanvasEdgeAnchors,
} from './content.js'
import {
  FdGraphCanvasEdgeContext,
  FdGraphCanvasElementActions,
  FdGraphCanvasNodeContext,
  FdGraphCanvasNodeResizeActions,
  FdGraphCanvasOverlayContext,
  FdGraphCanvasPortContext,
  FdGraphCanvasSelectionResizeContext,
  FdGraphCanvasSmartMagnifyContext,
  FdGraphCanvasWorldContext,
} from './contexts.js'
import { FdGraphCanvasNodeCapabilities } from './interaction-policy.js'
import { FdGraphInstanceHandle, FdGraphPresentationLocalElementID } from './presentation.js'

const localID = FdGraphPresentationLocalElementID.source({
  instanceHandle: new FdGraphInstanceHandle(0),
  elementID: { kind: 'node', nodeID: 'node' },
})
const frame = { x: 10, y: 20, width: 120, height: 80 }

describe('graph canvas contexts', () => {
  it('gates resize actions with the Swift-aligned enabled state', () => {
    const update = vi.fn()
    const end = vi.fn()
    const cancel = vi.fn()
    const enabled = new FdGraphCanvasNodeResizeActions({
      isEnabled: true,
      update,
      end,
      cancel,
    })

    enabled.update(new Set(['trailing']), { width: 12, height: 0 })
    enabled.end()
    enabled.cancel()

    expect(update).toHaveBeenCalledWith(new Set(['trailing']), { width: 12, height: 0 })
    expect(end).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()

    FdGraphCanvasNodeResizeActions.disabled.update(new Set(['trailing']), {
      width: 12,
      height: 0,
    })
  })

  it('requires selection resize contexts to retain their anchor', () => {
    expect(
      () =>
        new FdGraphCanvasSelectionResizeContext({
          anchorNodeID: 'anchor',
          nodeIDs: new Set(['peer']),
          frame,
          renderedFrame: frame,
          renderScale: 1,
          isResizing: false,
          actions: FdGraphCanvasNodeResizeActions.disabled,
        }),
    ).toThrow(RangeError)

    expect(
      new FdGraphCanvasSelectionResizeContext({
        anchorNodeID: 'anchor',
        nodeIDs: new Set(['anchor', 'peer']),
        frame,
        renderedFrame: frame,
        renderScale: 2,
        isResizing: true,
        actions: FdGraphCanvasNodeResizeActions.disabled,
      }),
    ).toMatchObject({ anchorNodeID: 'anchor', renderScale: 2, isResizing: true })
  })

  it('forwards selection and element actions without canvas ownership', () => {
    const select = vi.fn()
    const send = vi.fn()
    const actions = new FdGraphCanvasElementActions({ select, send })

    actions.select('toggle')
    actions.send('inspect')

    expect(select).toHaveBeenCalledWith('toggle')
    expect(send).toHaveBeenCalledWith('inspect')
  })

  it('uses the same node context defaults as Swift', () => {
    const context = new FdGraphCanvasNodeContext({
      elementID: 'node',
      localID,
      baseFrame: frame,
      frame,
      renderedFrame: frame,
      renderScale: 1,
      isSelected: false,
      isHovered: true,
      isBeingDragged: false,
      actions: FdGraphCanvasElementActions.disabled,
    })

    expect(context.isFocused).toBe(false)
    expect(context.isBeingResized).toBe(false)
    expect(context.capabilities).toBe(FdGraphCanvasNodeCapabilities.standard)
    expect(context.resizeActions.isEnabled).toBe(false)
  })

  it('uses Swift-aligned port and edge interaction defaults', () => {
    const port = new FdGraphCanvasPortContext({
      elementID: 'port',
      localID,
      nodeLocalID: localID,
      anchor: new FdGraphCanvasAnchor({ x: 10, y: 20 }, { dx: 1, dy: 0 }),
      renderedPosition: { x: 20, y: 40 },
      renderScale: 2,
      isSelected: false,
      isHovered: false,
      actions: FdGraphCanvasElementActions.disabled,
    })
    const route = new FdGraphEdgeRoute({ x: 0, y: 0 }, [{ kind: 'line', end: { x: 100, y: 0 } }])
    const edge = new FdGraphCanvasEdgeContext({
      elementID: 'edge',
      localID,
      worldRoute: route,
      renderedRoute: route,
      anchors: new FdGraphCanvasEdgeAnchors(
        new FdGraphCanvasAnchor({ x: 0, y: 0 }, { dx: 1, dy: 0 }),
        new FdGraphCanvasAnchor({ x: 100, y: 0 }, { dx: -1, dy: 0 }),
        true,
      ),
      worldFrame: { x: 0, y: 0, width: 100, height: 0 },
      renderedFrame: { x: 0, y: 0, width: 200, height: 0 },
      renderScale: 2,
      isSelected: false,
      isHovered: false,
      isTransient: false,
      actions: FdGraphCanvasElementActions.disabled,
    })

    expect(port.connectionState).toEqual({ kind: 'idle' })
    expect(edge.reconnectionActions).toEqual(FdGraphCanvasEdgeReconnectionActions.disabled)
    expect(edge.reconnectionActions.isEnabled).toBe(false)
  })

  it('retains the exact world and overlay dependencies supplied by the canvas', () => {
    const content = {} as FdGraphCanvasContent<string>
    const session = new FdGraphCanvasSessionState<string>()
    const viewport = new FdCanvasViewport()
    const renderContext = new FdCanvasRenderContext(viewport, frame)
    const surface = renderContext.renderSurface()
    const proxy = new FdCanvasProxy({
      context: renderContext,
      setZoom: () => {},
      anchor: () => {},
      focus: () => {},
      fit: () => {},
    })
    const world = new FdGraphCanvasWorldContext({
      content,
      session,
      renderContext,
      surface,
      guides: [],
    })
    const overlay = new FdGraphCanvasOverlayContext({
      sessionID: new FdGraphCanvasSessionID('session'),
      content,
      session,
      proxy,
    })

    expect(world.content).toBe(content)
    expect(world.session).toBe(session)
    expect(world.renderContext).toBe(renderContext)
    expect(world.surface).toBe(surface)
    expect(overlay.content).toBe(content)
    expect(overlay.session).toBe(session)
    expect(overlay.proxy).toBe(proxy)
  })

  it('resolves the standard smart-magnify action in Swift order', () => {
    const canvas = {
      location: { x: 20, y: 20 },
      worldLocation: { x: 20, y: 20 },
      viewport: new FdCanvasViewport(),
      initialZoom: 1,
      zoomTolerance: 0.01,
      canRestoreViewport: false,
      isZoomedIn: false,
    }
    const nearestNodeFrame = { x: 10, y: 10, width: 100, height: 80 }
    const focusedElementBounds = { x: 0, y: 0, width: 300, height: 200 }

    expect(
      new FdGraphCanvasSmartMagnifyContext({
        canvas: { ...canvas, canRestoreViewport: true },
        nearestNodeFrame,
        focusedElementBounds,
      }).standardAction(1.5, 48),
    ).toEqual({ kind: 'restore' })
    expect(
      new FdGraphCanvasSmartMagnifyContext({
        canvas: { ...canvas, isZoomedIn: true },
        nearestNodeFrame,
        focusedElementBounds,
      }).standardAction(1.5, 48),
    ).toEqual({ kind: 'fit', rect: focusedElementBounds, padding: 48 })
    expect(
      new FdGraphCanvasSmartMagnifyContext({
        canvas,
        nearestNodeFrame,
      }).standardAction(1.5, 48),
    ).toEqual({ kind: 'focus', rect: nearestNodeFrame, zoom: 1.5 })
    expect(new FdGraphCanvasSmartMagnifyContext({ canvas }).standardAction(1.5, 48)).toEqual({
      kind: 'none',
    })
  })
})
