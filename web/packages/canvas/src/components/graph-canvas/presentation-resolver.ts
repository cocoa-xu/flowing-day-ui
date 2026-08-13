import type { FdCanvasRect } from '../../geometry.js'
import { FdGraphCanvasAnchor, type FdGraphCanvasContent } from '../../graph/content.js'
import type { FdGraphElementID } from '../../graph/model.js'
import type { FdGraphPresentationLocalElementID } from '../../graph/presentation.js'
import type { FdGraphCanvasGuide } from '../../interactions/arrangement.js'
import type {
  FdGraphCanvasSessionState,
  FdGraphCanvasTransientNodeDrag,
  FdGraphCanvasTransientNodeResize,
} from '../../interactions/session.js'
import { FdGraphCanvasTransientGeometry } from '../../interactions/transient-geometry.js'
import { sameLayoutInputID } from '../../layout/model.js'
import type { FdGraphEdgeRoute } from '../../layout/pipeline.js'

export class FdGraphCanvasPresentationResolver<
  ElementID extends FdGraphElementID = FdGraphElementID,
> {
  readonly content: FdGraphCanvasContent<ElementID>
  readonly session: FdGraphCanvasSessionState<ElementID>

  constructor(
    content: FdGraphCanvasContent<ElementID>,
    session: FdGraphCanvasSessionState<ElementID>,
  ) {
    this.content = content
    this.session = session
  }

  get activeNodeDrag(): FdGraphCanvasTransientNodeDrag<ElementID> | undefined {
    const drag = this.session.transientNodeDrag
    return drag && this.matchesContent(drag.basePresentationSnapshotID, drag.baseLayoutInputID)
      ? drag
      : undefined
  }

  get activeNodeResize(): FdGraphCanvasTransientNodeResize<ElementID> | undefined {
    if (this.session.transientNodeDrag) return undefined
    const resize = this.session.transientNodeResize
    return resize &&
      this.matchesContent(resize.basePresentationSnapshotID, resize.baseLayoutInputID)
      ? resize
      : undefined
  }

  get activeGuides(): readonly FdGraphCanvasGuide[] {
    return this.activeNodeResize?.guides ?? this.activeNodeDrag?.guides ?? []
  }

  nodeFrame(localID: FdGraphPresentationLocalElementID): FdCanvasRect | undefined {
    const elementID = this.content.elementID(localID)
    const resize = this.activeNodeResize
    const resizeBaseFrame = elementID === undefined ? undefined : resize?.baseFrames.get(elementID)
    if (resize && resizeBaseFrame) {
      return FdGraphCanvasTransientGeometry.resizing(
        resizeBaseFrame,
        resize.baseBounds,
        resize.bounds,
      )
    }
    const frame = this.content.frame(localID)
    if (!frame) return undefined
    const translation = this.translation(localID)
    return {
      ...frame,
      x: frame.x + translation.width,
      y: frame.y + translation.height,
    }
  }

  anchor(
    anchor: FdGraphCanvasAnchor,
    nodeLocalID: FdGraphPresentationLocalElementID,
  ): FdGraphCanvasAnchor {
    const translation = this.translation(nodeLocalID)
    if (translation.width !== 0 || translation.height !== 0) {
      return new FdGraphCanvasAnchor(
        {
          x: anchor.position.x + translation.width,
          y: anchor.position.y + translation.height,
        },
        anchor.normal,
      )
    }
    const elementID = this.content.elementID(nodeLocalID)
    const resize = this.activeNodeResize
    const baseFrame = elementID === undefined ? undefined : resize?.baseFrames.get(elementID)
    if (!resize || !baseFrame) return anchor
    const frame = FdGraphCanvasTransientGeometry.resizing(
      baseFrame,
      resize.baseBounds,
      resize.bounds,
    )
    return FdGraphCanvasTransientGeometry.resizing(anchor, baseFrame, frame)
  }

  edgeRoute(localID: FdGraphPresentationLocalElementID): FdGraphEdgeRoute | undefined {
    const route = this.content.route(localID)
    const endpointNodeIDs = this.content.endpointNodeLocalIDs(localID)
    const anchors = this.content.edgeAnchors(localID)
    if (!route || !endpointNodeIDs || !anchors) return undefined
    const first = this.anchor(anchors.first, endpointNodeIDs.first)
    const second = this.anchor(anchors.second, endpointNodeIDs.second)
    const firstDelta = {
      width: first.position.x - anchors.first.position.x,
      height: first.position.y - anchors.first.position.y,
    }
    const secondDelta = {
      width: second.position.x - anchors.second.position.x,
      height: second.position.y - anchors.second.position.y,
    }
    if (
      firstDelta.width === 0 &&
      firstDelta.height === 0 &&
      secondDelta.width === 0 &&
      secondDelta.height === 0
    ) {
      return route
    }
    return FdGraphCanvasTransientGeometry.deforming(route, firstDelta, secondDelta)
  }

  visibleElementIDs(intersecting: FdCanvasRect): {
    readonly nodeIDs: readonly FdGraphPresentationLocalElementID[]
    readonly edgeIDs: readonly FdGraphPresentationLocalElementID[]
    readonly portIDs: readonly FdGraphPresentationLocalElementID[]
  } {
    const slice = this.content.renderElementIDs(intersecting)
    const nodeIDs = [...slice.nodeIDs]
    const edgeIDs = [...slice.edgeIDs]
    const knownNodeIDs = new Set(nodeIDs)
    const knownEdgeIDs = new Set(edgeIDs)
    const drag = this.activeNodeDrag
    if (drag && (drag.translation.width !== 0 || drag.translation.height !== 0)) {
      const sourceRect = {
        ...intersecting,
        x: intersecting.x - drag.translation.width,
        y: intersecting.y - drag.translation.height,
      }
      this.appendTransientNodes(
        this.content.renderElementIDs(sourceRect).nodeIDs,
        drag.nodeIDs,
        nodeIDs,
        edgeIDs,
        knownNodeIDs,
        knownEdgeIDs,
      )
    }
    const resize = this.activeNodeResize
    if (resize) {
      const sourceRect = FdGraphCanvasTransientGeometry.resizing(
        intersecting,
        resize.bounds,
        resize.baseBounds,
      )
      this.appendTransientNodes(
        this.content.nodeLocalIDs(sourceRect),
        resize.nodeIDs,
        nodeIDs,
        edgeIDs,
        knownNodeIDs,
        knownEdgeIDs,
      )
    }
    return {
      nodeIDs,
      edgeIDs,
      portIDs: nodeIDs.flatMap((nodeID) => this.content.portLocalIDs(nodeID)),
    }
  }

  private translation(localID: FdGraphPresentationLocalElementID): {
    readonly width: number
    readonly height: number
  } {
    const elementID = this.content.elementID(localID)
    const drag = this.activeNodeDrag
    return elementID !== undefined && drag?.nodeIDs.has(elementID)
      ? drag.translation
      : { width: 0, height: 0 }
  }

  private matchesContent(
    presentationSnapshotID: string | number,
    layoutInputID: FdGraphCanvasContent<ElementID>['id'],
  ): boolean {
    return (
      presentationSnapshotID === this.content.presentation.snapshotID &&
      sameLayoutInputID(layoutInputID, this.content.id)
    )
  }

  private appendTransientNodes(
    candidates: readonly FdGraphPresentationLocalElementID[],
    transientNodeIDs: ReadonlySet<ElementID>,
    nodeIDs: FdGraphPresentationLocalElementID[],
    edgeIDs: FdGraphPresentationLocalElementID[],
    knownNodeIDs: Set<FdGraphPresentationLocalElementID>,
    knownEdgeIDs: Set<FdGraphPresentationLocalElementID>,
  ): void {
    for (const localID of candidates) {
      const elementID = this.content.elementID(localID)
      if (elementID === undefined || !transientNodeIDs.has(elementID)) continue
      if (!knownNodeIDs.has(localID)) {
        knownNodeIDs.add(localID)
        nodeIDs.push(localID)
      }
      for (const edgeID of this.content.incidentEdgeLocalIDs(localID)) {
        if (knownEdgeIDs.has(edgeID)) continue
        knownEdgeIDs.add(edgeID)
        edgeIDs.push(edgeID)
      }
    }
  }
}
