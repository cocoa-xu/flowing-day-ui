import type { FdCanvasRect, FdCanvasSize } from '../geometry.js'
import type { FdAnyGraphNode } from '../graph/model.js'

export type FdGraphMiniMapVisibility = 'always' | 'whenNavigationIsUseful'
export type FdGraphMiniMapRepresentation = 'adaptive' | 'silhouette' | 'structure'
export type FdGraphMiniMapInteraction = 'displayOnly' | 'pan' | 'panAndZoom'
export type FdGraphMiniMapRefreshPolicy = 'adaptiveLive' | 'afterChangesSettle'
export type FdGraphMiniMapPlacement =
  | 'topLeading'
  | 'topTrailing'
  | 'bottomLeading'
  | 'bottomTrailing'

export type FdGraphMiniMapScope =
  | { readonly kind: 'overview' }
  | { readonly kind: 'localNavigator'; readonly surroundingScale: number }
  | { readonly kind: 'custom'; readonly bounds: FdCanvasRect }

export interface FdGraphMiniMapPerformanceConfiguration {
  readonly aggregationCellSize?: number
  readonly maximumNodePrimitiveDensity?: number
  readonly maximumEdgePrimitiveDensity?: number
  readonly maximumAdaptiveStyleCount?: number
  readonly maximumAggregationCellCount?: number
}

export interface FdGraphMiniMapNodeStyle {
  readonly fill: string
  readonly stroke?: string
  readonly strokeWidth?: number
}

export interface FdGraphMiniMapStyle {
  readonly background?: string
  readonly border?: string
  readonly edge?: string
  readonly viewportFill?: string
  readonly viewportStroke?: string
  readonly nodeStyles?: readonly FdGraphMiniMapNodeStyle[]
  readonly cornerRadius?: number
  readonly viewportCornerRadius?: number
  readonly viewportStrokeWidth?: number
}

export interface FdGraphMiniMapConfiguration {
  readonly size?: FdCanvasSize
  readonly contentPadding?: number
  readonly visibility?: FdGraphMiniMapVisibility
  readonly scope?: FdGraphMiniMapScope
  readonly representation?: FdGraphMiniMapRepresentation
  readonly interaction?: FdGraphMiniMapInteraction
  readonly refreshPolicy?: FdGraphMiniMapRefreshPolicy
  readonly performance?: FdGraphMiniMapPerformanceConfiguration
  readonly placement?: FdGraphMiniMapPlacement
  readonly overlayInsets?: number
  readonly zoomSensitivity?: number
  readonly discreteScrollMultiplier?: number
  readonly accessibilityLabel?: string
  readonly style?: FdGraphMiniMapStyle
  readonly nodeStyleIndex?: (node: FdAnyGraphNode) => number
}

export interface FdResolvedGraphMiniMapPerformanceConfiguration {
  readonly aggregationCellSize: number
  readonly maximumNodePrimitiveDensity: number
  readonly maximumEdgePrimitiveDensity: number
  readonly maximumAdaptiveStyleCount: number
  readonly maximumAggregationCellCount: number
}

export interface FdResolvedGraphMiniMapStyle {
  readonly background: string
  readonly border: string
  readonly edge: string
  readonly viewportFill: string
  readonly viewportStroke: string
  readonly nodeStyles: readonly Required<FdGraphMiniMapNodeStyle>[]
  readonly cornerRadius: number
  readonly viewportCornerRadius: number
  readonly viewportStrokeWidth: number
}

export interface FdResolvedGraphMiniMapConfiguration {
  readonly size: FdCanvasSize
  readonly contentPadding: number
  readonly visibility: FdGraphMiniMapVisibility
  readonly scope: FdGraphMiniMapScope
  readonly representation: FdGraphMiniMapRepresentation
  readonly interaction: FdGraphMiniMapInteraction
  readonly refreshPolicy: FdGraphMiniMapRefreshPolicy
  readonly performance: FdResolvedGraphMiniMapPerformanceConfiguration
  readonly placement: FdGraphMiniMapPlacement
  readonly overlayInsets: number
  readonly zoomSensitivity: number
  readonly discreteScrollMultiplier: number
  readonly accessibilityLabel: string
  readonly style: FdResolvedGraphMiniMapStyle
  readonly nodeStyleIndex: (node: FdAnyGraphNode) => number
}

const finiteMinimum = (value: number, minimum: number, name: string): number => {
  if (!Number.isFinite(value) || value < minimum) {
    throw new RangeError(`${name} must be at least ${minimum}`)
  }
  return value
}

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`)
  }
  return value
}

export function resolveGraphMiniMapConfiguration(
  configuration: FdGraphMiniMapConfiguration,
): FdResolvedGraphMiniMapConfiguration {
  const size = configuration.size ?? { width: 220, height: 144 }
  const nodeStyles = configuration.style?.nodeStyles ?? [{ fill: 'rgb(115 120 114 / 0.52)' }]
  if (nodeStyles.length === 0) throw new RangeError('node styles must not be empty')
  return {
    size: {
      width: finiteMinimum(size.width, Number.EPSILON, 'minimap width'),
      height: finiteMinimum(size.height, Number.EPSILON, 'minimap height'),
    },
    contentPadding: finiteMinimum(configuration.contentPadding ?? 10, 0, 'content padding'),
    visibility: configuration.visibility ?? 'whenNavigationIsUseful',
    scope: configuration.scope ?? { kind: 'overview' },
    representation: configuration.representation ?? 'adaptive',
    interaction: configuration.interaction ?? 'panAndZoom',
    refreshPolicy: configuration.refreshPolicy ?? 'adaptiveLive',
    performance: {
      aggregationCellSize: finiteMinimum(
        configuration.performance?.aggregationCellSize ?? 2,
        Number.EPSILON,
        'aggregation cell size',
      ),
      maximumNodePrimitiveDensity: finiteMinimum(
        configuration.performance?.maximumNodePrimitiveDensity ?? 0.2,
        Number.EPSILON,
        'maximum node primitive density',
      ),
      maximumEdgePrimitiveDensity: finiteMinimum(
        configuration.performance?.maximumEdgePrimitiveDensity ?? 0.08,
        0,
        'maximum edge primitive density',
      ),
      maximumAdaptiveStyleCount: positiveInteger(
        configuration.performance?.maximumAdaptiveStyleCount ?? 32,
        'maximum adaptive style count',
      ),
      maximumAggregationCellCount: positiveInteger(
        configuration.performance?.maximumAggregationCellCount ?? 1_000_000,
        'maximum aggregation cell count',
      ),
    },
    placement: configuration.placement ?? 'bottomTrailing',
    overlayInsets: finiteMinimum(configuration.overlayInsets ?? 16, 0, 'overlay insets'),
    zoomSensitivity: finiteMinimum(
      configuration.zoomSensitivity ?? 1,
      Number.EPSILON,
      'zoom sensitivity',
    ),
    discreteScrollMultiplier: finiteMinimum(
      configuration.discreteScrollMultiplier ?? 12,
      Number.EPSILON,
      'discrete scroll multiplier',
    ),
    accessibilityLabel: configuration.accessibilityLabel ?? 'Graph overview',
    style: {
      background: configuration.style?.background ?? 'rgb(255 255 255 / 0.96)',
      border: configuration.style?.border ?? 'rgb(115 120 114 / 0.18)',
      edge: configuration.style?.edge ?? 'rgb(115 120 114 / 0.24)',
      viewportFill: configuration.style?.viewportFill ?? 'rgb(109 158 165 / 0.1)',
      viewportStroke: configuration.style?.viewportStroke ?? 'rgb(109 158 165 / 0.88)',
      nodeStyles: nodeStyles.map((style) => ({
        fill: style.fill,
        stroke: style.stroke ?? 'transparent',
        strokeWidth: finiteMinimum(style.strokeWidth ?? 1, 0, 'node stroke width'),
      })),
      cornerRadius: finiteMinimum(configuration.style?.cornerRadius ?? 12, 0, 'corner radius'),
      viewportCornerRadius: finiteMinimum(
        configuration.style?.viewportCornerRadius ?? 3,
        0,
        'viewport corner radius',
      ),
      viewportStrokeWidth: finiteMinimum(
        configuration.style?.viewportStrokeWidth ?? 1.5,
        Number.EPSILON,
        'viewport stroke width',
      ),
    },
    nodeStyleIndex: configuration.nodeStyleIndex ?? (() => 0),
  }
}
