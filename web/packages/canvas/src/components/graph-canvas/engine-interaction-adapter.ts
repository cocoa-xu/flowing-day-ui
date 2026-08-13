import type { FdCanvasRect } from '../../geometry.js'
import { unionCanvasRects } from '../../geometry.js'
import { FdGraphCanvasAnchor, type FdGraphCanvasContent } from '../../graph/content.js'
import type {
  FdGraphConnectionCancelDetail,
  FdGraphConnectionCompleteDetail,
  FdGraphConnectionPreviewChangeDetail,
  FdGraphNodeFramesChangeDetail,
} from '../../graph/events.js'
import type { FdGraphElementID } from '../../graph/model.js'
import {
  FdGraphCanvasConnectionCancellationIntent,
  type FdGraphCanvasConnectionCancellationReason,
  FdGraphCanvasConnectionCompletionIntent,
  FdGraphCanvasConnectionFeedback,
  type FdGraphCanvasConnectionOperation,
  type FdGraphCanvasConnectionOrigin,
  FdGraphCanvasTransientConnection,
} from '../../interactions/connection-model.js'
import {
  FdGraphCanvasNodeDragIntent,
  FdGraphCanvasNodeResizeChange,
  FdGraphCanvasNodeResizeIntent,
  FdGraphCanvasTransientNodeDrag,
  FdGraphCanvasTransientNodeResize,
} from '../../interactions/session.js'
import { sameLayoutInputID } from '../../layout/model.js'
import type { FdGraphCanvasActiveNodeInteraction } from './interaction-controller.js'

type ActiveMove = Extract<FdGraphCanvasActiveNodeInteraction, { readonly kind: 'move' }>
type ActiveResize = Extract<FdGraphCanvasActiveNodeInteraction, { readonly kind: 'resize' }>

export function graphCanvasTransientNodeDrag<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  interaction: ActiveMove,
): FdGraphCanvasTransientNodeDrag<ElementID> | undefined {
  const nodeID = canonicalID(content, interaction.anchorNodeID)
  const baseFrame = interaction.baseFrames.get(interaction.anchorNodeID)
  const latestFrame = interaction.latestFrames.get(interaction.anchorNodeID)
  if (nodeID === undefined || !baseFrame || !latestFrame) return undefined
  return new FdGraphCanvasTransientNodeDrag({
    nodeID,
    nodeIDs: canonicalIDs(content, interaction.baseFrames.keys()),
    basePresentationSnapshotID: content.presentation.snapshotID,
    baseLayoutInputID: content.id,
    baseBounds: interaction.baseBounds,
    translation: {
      width: latestFrame.x - baseFrame.x,
      height: latestFrame.y - baseFrame.y,
    },
    guides: interaction.guides,
    snapState: interaction.snapState,
    ...(interaction.constrainedAxis ? { constrainedAxis: interaction.constrainedAxis } : {}),
  })
}

export function graphCanvasTransientNodeResize<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  interaction: ActiveResize,
): FdGraphCanvasTransientNodeResize<ElementID> | undefined {
  const anchorNodeID = canonicalID(content, interaction.anchorNodeID)
  const baseFrames = canonicalFrames(content, interaction.baseFrames)
  const bounds = unionBounds(interaction.latestFrames.values())
  if (anchorNodeID === undefined || !baseFrames.has(anchorNodeID) || !bounds) return undefined
  return new FdGraphCanvasTransientNodeResize({
    anchorNodeID,
    basePresentationSnapshotID: content.presentation.snapshotID,
    baseLayoutInputID: content.id,
    nodeOrder: [
      anchorNodeID,
      ...[...baseFrames.keys()].filter((nodeID) => nodeID !== anchorNodeID),
    ],
    baseFrames,
    minimumBoundsSize: interaction.minimumBoundsSize,
    ...(interaction.maximumBoundsSize ? { maximumBoundsSize: interaction.maximumBoundsSize } : {}),
    edges: interaction.edges,
    bounds,
    guides: interaction.guides,
    snapState: interaction.snapState,
    ...(interaction.aspectRatioDrivingAxis
      ? { aspectRatioDrivingAxis: interaction.aspectRatioDrivingAxis }
      : {}),
  })
}

export function graphCanvasNodeDragIntent<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  detail: FdGraphNodeFramesChangeDetail,
  drag: FdGraphCanvasTransientNodeDrag<ElementID> | undefined,
  focusedNodeID: FdGraphElementID | undefined,
): FdGraphCanvasNodeDragIntent<ElementID> | undefined {
  if (drag) {
    if (!matchesContent(content, drag.basePresentationSnapshotID, drag.baseLayoutInputID)) {
      return undefined
    }
    return new FdGraphCanvasNodeDragIntent(
      drag.nodeID,
      drag.basePresentationSnapshotID,
      drag.baseLayoutInputID,
      drag.translation,
      drag.nodeIDs,
    )
  }
  const firstChange = detail.changes[0]
  if (!firstChange) return undefined
  const candidateAnchor = focusedNodeID ?? firstChange.nodeID
  const nodeID = canonicalID(content, candidateAnchor)
  if (nodeID === undefined) return undefined
  const anchorChange =
    detail.changes.find(({ nodeID }) => nodeID === candidateAnchor) ?? firstChange
  return new FdGraphCanvasNodeDragIntent(
    nodeID,
    content.presentation.snapshotID,
    content.id,
    {
      width: anchorChange.after.x - anchorChange.before.x,
      height: anchorChange.after.y - anchorChange.before.y,
    },
    canonicalIDs(
      content,
      detail.changes.map(({ nodeID }) => nodeID),
    ),
  )
}

export function graphCanvasNodeResizeIntent<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  detail: FdGraphNodeFramesChangeDetail,
  resize: FdGraphCanvasTransientNodeResize<ElementID>,
): FdGraphCanvasNodeResizeIntent<ElementID> | undefined {
  if (!matchesContent(content, resize.basePresentationSnapshotID, resize.baseLayoutInputID)) {
    return undefined
  }
  const changes = detail.changes.flatMap((change) => {
    const nodeID = canonicalID(content, change.nodeID)
    return nodeID === undefined
      ? []
      : [
          new FdGraphCanvasNodeResizeChange(
            nodeID,
            {
              width: change.after.x - change.before.x,
              height: change.after.y - change.before.y,
            },
            {
              width: change.after.width - change.before.width,
              height: change.after.height - change.before.height,
            },
          ),
        ]
  })
  if (!changes.some(({ nodeID }) => nodeID === resize.anchorNodeID)) return undefined
  return new FdGraphCanvasNodeResizeIntent(
    resize.anchorNodeID,
    changes,
    resize.edges,
    resize.basePresentationSnapshotID,
    resize.baseLayoutInputID,
  )
}

export function graphCanvasTransientConnection<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  connection: NonNullable<FdGraphConnectionPreviewChangeDetail['connection']>,
): FdGraphCanvasTransientConnection<ElementID> | undefined {
  const origin = connectionOrigin(content, connection.origin)
  if (!origin) return undefined
  const candidatePortID = connection.candidate
    ? canonicalID(content, connection.candidate.endpoint.portID)
    : undefined
  return new FdGraphCanvasTransientConnection({
    origin,
    basePresentationSnapshotID: content.presentation.snapshotID,
    baseLayoutInputID: content.id,
    stationaryAnchor: new FdGraphCanvasAnchor(connection.stationaryPoint),
    originalMovingAnchor: new FdGraphCanvasAnchor(connection.originalMovingPoint),
    movingAnchor: new FdGraphCanvasAnchor(connection.movingPoint),
    ...(candidatePortID === undefined ? {} : { candidatePortID }),
    ...(connection.validation
      ? {
          validation:
            connection.validation.kind === 'valid'
              ? ({ kind: 'valid' } as const)
              : ({
                  kind: 'invalid',
                  feedback: new FdGraphCanvasConnectionFeedback(
                    connection.validation.feedback?.message,
                  ),
                } as const),
        }
      : {}),
  })
}

export function graphCanvasConnectionCompletionIntent<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  detail: FdGraphConnectionCompleteDetail,
  connection: FdGraphCanvasTransientConnection<ElementID> | undefined,
): FdGraphCanvasConnectionCompletionIntent<ElementID> | undefined {
  if (
    !connection ||
    !matchesContent(content, connection.basePresentationSnapshotID, connection.baseLayoutInputID)
  ) {
    return undefined
  }
  const operation = connectionOperation(content, detail.operation)
  return operation
    ? new FdGraphCanvasConnectionCompletionIntent({
        operation,
        basePresentationSnapshotID: connection.basePresentationSnapshotID,
        baseLayoutInputID: connection.baseLayoutInputID,
      })
    : undefined
}

export function graphCanvasConnectionCancellationIntent<ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  detail: FdGraphConnectionCancelDetail,
  connection: FdGraphCanvasTransientConnection<ElementID> | undefined,
): FdGraphCanvasConnectionCancellationIntent<ElementID> | undefined {
  if (
    !connection ||
    !matchesContent(content, connection.basePresentationSnapshotID, connection.baseLayoutInputID)
  ) {
    return undefined
  }
  const origin = connectionOrigin(content, detail.origin)
  if (!origin) return undefined
  const reason: FdGraphCanvasConnectionCancellationReason =
    detail.reason.kind === 'invalidTarget'
      ? {
          kind: 'invalidTarget',
          feedback: new FdGraphCanvasConnectionFeedback(detail.reason.feedback?.message),
        }
      : detail.reason
  return new FdGraphCanvasConnectionCancellationIntent({
    origin,
    reason,
    basePresentationSnapshotID: connection.basePresentationSnapshotID,
    baseLayoutInputID: connection.baseLayoutInputID,
  })
}

const matchesContent = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  snapshotID: string | number,
  layoutInputID: typeof content.id,
): boolean =>
  snapshotID === content.presentation.snapshotID && sameLayoutInputID(layoutInputID, content.id)

const canonicalID = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  elementID: FdGraphElementID,
): ElementID | undefined =>
  content.contains(elementID as ElementID) ? (elementID as ElementID) : undefined

const canonicalIDs = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  elementIDs: Iterable<FdGraphElementID>,
): ReadonlySet<ElementID> =>
  new Set(
    [...elementIDs].flatMap((elementID) => {
      const resolved = canonicalID(content, elementID)
      return resolved === undefined ? [] : [resolved]
    }),
  )

const canonicalFrames = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  frames: ReadonlyMap<FdGraphElementID, FdCanvasRect>,
): ReadonlyMap<ElementID, FdCanvasRect> =>
  new Map(
    [...frames].flatMap(([elementID, frame]) => {
      const resolved = canonicalID(content, elementID)
      return resolved === undefined ? [] : ([[resolved, frame]] as const)
    }),
  )

const unionBounds = (frames: Iterable<FdCanvasRect>): FdCanvasRect | undefined => {
  let bounds: FdCanvasRect | undefined
  for (const frame of frames) bounds = unionCanvasRects(bounds, frame)
  return bounds
}

const connectionOrigin = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  origin: NonNullable<FdGraphConnectionPreviewChangeDetail['connection']>['origin'],
): FdGraphCanvasConnectionOrigin<ElementID> | undefined => {
  if (origin.kind === 'new') {
    const sourcePortID = canonicalID(content, origin.source.portID)
    return sourcePortID === undefined ? undefined : { kind: 'new', sourcePortID }
  }
  const edgeID = canonicalID(content, origin.edgeID)
  const originalEndpointID = canonicalID(content, origin.original.portID)
  const fixedEndpointID = canonicalID(content, origin.fixed.portID)
  return edgeID === undefined || originalEndpointID === undefined || fixedEndpointID === undefined
    ? undefined
    : {
        kind: 'reconnect',
        edgeID,
        endpoint: origin.endpoint,
        originalEndpointID,
        fixedEndpointID,
      }
}

const connectionOperation = <ElementID extends FdGraphElementID>(
  content: FdGraphCanvasContent<ElementID>,
  operation: FdGraphConnectionCompleteDetail['operation'],
): FdGraphCanvasConnectionOperation<ElementID> | undefined => {
  if (operation.kind === 'create') {
    const sourcePortID = canonicalID(content, operation.source.portID)
    const targetPortID = canonicalID(content, operation.target.portID)
    return sourcePortID === undefined || targetPortID === undefined
      ? undefined
      : { kind: 'create', sourcePortID, targetPortID }
  }
  const edgeID = canonicalID(content, operation.edgeID)
  const targetPortID = canonicalID(content, operation.target.portID)
  return edgeID === undefined || targetPortID === undefined
    ? undefined
    : { kind: 'reconnect', edgeID, endpoint: operation.endpoint, targetPortID }
}
