import type {
  FdGraphRenderFrame,
  FdGraphRenderingBackend,
  FdGraphRenderingSurface,
} from './backend.js'
import {
  FdGraphDOMRenderingBackend,
  type FdGraphDOMRenderingBackendConfiguration,
} from './dom-backend.js'

export interface FdGraphWebGL2RenderingBackendConfiguration
  extends FdGraphDOMRenderingBackendConfiguration {
  readonly maximumDOMNodeCount?: number
  readonly minimumDOMNodeZoom?: number
  readonly maximumEdgeLabelCount?: number
}

interface FdGraphWebGL2Programs {
  readonly edge: WebGLProgram
  readonly node: WebGLProgram
}

interface FdGraphWebGL2Buffers {
  readonly edge: WebGLBuffer
  readonly node: WebGLBuffer
}

type FdRGBA = readonly [number, number, number, number]

const edgeStride = 10
const nodeStride = 12

const edgeVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec2 sourcePoint;
layout(location = 1) in vec2 targetPoint;
layout(location = 2) in vec4 edgeColor;
layout(location = 3) in float edgeWidth;
layout(location = 4) in float dashed;

uniform vec2 worldOrigin;
uniform vec2 viewportOrigin;
uniform vec2 viewportSize;
uniform float zoom;
uniform float segmentCount;

out vec4 color;
out float pathPosition;
flat out float isDashed;

vec2 curvePoint(float progress) {
  float distance = abs(targetPoint.x - sourcePoint.x);
  float control = max(distance * 0.45, 48.0);
  float direction = targetPoint.x >= sourcePoint.x ? 1.0 : -1.0;
  vec2 firstControl = sourcePoint + vec2(control * direction, 0.0);
  vec2 secondControl = targetPoint - vec2(control * direction, 0.0);
  float inverse = 1.0 - progress;
  return inverse * inverse * inverse * sourcePoint
    + 3.0 * inverse * inverse * progress * firstControl
    + 3.0 * inverse * progress * progress * secondControl
    + progress * progress * progress * targetPoint;
}

vec2 curveDerivative(float progress) {
  float distance = abs(targetPoint.x - sourcePoint.x);
  float control = max(distance * 0.45, 48.0);
  float direction = targetPoint.x >= sourcePoint.x ? 1.0 : -1.0;
  vec2 firstControl = sourcePoint + vec2(control * direction, 0.0);
  vec2 secondControl = targetPoint - vec2(control * direction, 0.0);
  float inverse = 1.0 - progress;
  return 3.0 * inverse * inverse * (firstControl - sourcePoint)
    + 6.0 * inverse * progress * (secondControl - firstControl)
    + 3.0 * progress * progress * (targetPoint - secondControl);
}

void main() {
  int vertex = gl_VertexID % 6;
  float along = vertex == 1 || vertex == 2 || vertex == 4 ? 1.0 : 0.0;
  float side = vertex == 0 || vertex == 1 || vertex == 3 ? -1.0 : 1.0;
  float segment = float(gl_VertexID / 6);
  float startProgress = segment / segmentCount;
  float endProgress = (segment + 1.0) / segmentCount;
  vec2 start = curvePoint(startProgress);
  vec2 end = curvePoint(endProgress);
  vec2 startInViewport = (start - worldOrigin) * zoom + viewportOrigin;
  vec2 endInViewport = (end - worldOrigin) * zoom + viewportOrigin;
  vec2 tangent = mix(curveDerivative(startProgress), curveDerivative(endProgress), along);
  float tangentLength = max(length(tangent), 0.0001);
  vec2 normal = vec2(-tangent.y, tangent.x) / tangentLength;
  vec2 position = mix(startInViewport, endInViewport, along)
    + normal * side * max(edgeWidth, 1.0) * 0.5;
  vec2 clip = position / viewportSize * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  color = edgeColor;
  pathPosition = mix(startProgress, endProgress, along)
    * max(length(targetPoint - sourcePoint) * zoom * 1.15, 1.0);
  isDashed = dashed;
}
`

const edgeFragmentShader = `#version 300 es
precision highp float;

in vec4 color;
in float pathPosition;
flat in float isDashed;
out vec4 fragmentColor;

void main() {
  if (isDashed > 0.5 && mod(pathPosition, 13.0) > 7.0) discard;
  fragmentColor = color;
}
`

const nodeVertexShader = `#version 300 es
precision highp float;

layout(location = 0) in vec4 nodeRect;
layout(location = 1) in vec4 fillColor;
layout(location = 2) in vec4 strokeColor;

uniform vec2 worldOrigin;
uniform vec2 viewportOrigin;
uniform vec2 viewportSize;
uniform float zoom;

out vec2 nodeCoordinate;
out vec2 nodeSize;
out vec4 fill;
out vec4 stroke;

void main() {
  int vertex = gl_VertexID % 6;
  vec2 coordinate;
  if (vertex == 0) coordinate = vec2(0.0, 0.0);
  else if (vertex == 1) coordinate = vec2(1.0, 0.0);
  else if (vertex == 2) coordinate = vec2(1.0, 1.0);
  else if (vertex == 3) coordinate = vec2(0.0, 0.0);
  else if (vertex == 4) coordinate = vec2(1.0, 1.0);
  else coordinate = vec2(0.0, 1.0);
  vec2 worldPosition = nodeRect.xy + nodeRect.zw * coordinate;
  vec2 position = (worldPosition - worldOrigin) * zoom + viewportOrigin;
  vec2 clip = position / viewportSize * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  nodeCoordinate = coordinate;
  nodeSize = max(nodeRect.zw * zoom, vec2(1.0));
  fill = fillColor;
  stroke = strokeColor;
}
`

const nodeFragmentShader = `#version 300 es
precision highp float;

in vec2 nodeCoordinate;
in vec2 nodeSize;
in vec4 fill;
in vec4 stroke;
out vec4 fragmentColor;

void main() {
  vec2 halfSize = nodeSize * 0.5;
  vec2 point = (nodeCoordinate - 0.5) * nodeSize;
  float radius = min(12.0, max(min(halfSize.x, halfSize.y) - 0.5, 0.5));
  vec2 rounded = abs(point) - halfSize + radius;
  float distance = length(max(rounded, 0.0)) + min(max(rounded.x, rounded.y), 0.0) - radius;
  float antialiasing = max(fwidth(distance), 0.75);
  float coverage = 1.0 - smoothstep(-antialiasing, antialiasing, distance);
  float interior = smoothstep(0.5, 1.5, -distance);
  fragmentColor = mix(stroke, fill, interior) * coverage;
}
`

export class FdGraphWebGL2RenderingBackend implements FdGraphRenderingBackend {
  readonly kind = 'webgl2'
  private canvas = this.makeCanvas()
  private readonly nodeBackend: FdGraphDOMRenderingBackend
  private readonly fallbackBackend: FdGraphDOMRenderingBackend
  private readonly maximumDOMNodeCount: number
  private readonly minimumDOMNodeZoom: number
  private readonly maximumEdgeLabelCount: number
  private surface: FdGraphRenderingSurface | undefined
  private context: WebGL2RenderingContext | undefined
  private programs: FdGraphWebGL2Programs | undefined
  private buffers: FdGraphWebGL2Buffers | undefined
  private latestFrame: FdGraphRenderFrame | undefined
  private edgeCount = 0
  private nodeCount = 0
  private geometryRevision = ''
  private usingFallback = false
  private colorProbe: HTMLElement | undefined
  private readonly colorCache = new Map<string, FdRGBA>()

  constructor(configuration: FdGraphWebGL2RenderingBackendConfiguration = {}) {
    this.maximumDOMNodeCount = this.nonnegativeInteger(
      configuration.maximumDOMNodeCount ?? 2_000,
      'maximum DOM node count',
    )
    this.minimumDOMNodeZoom = this.nonnegative(
      configuration.minimumDOMNodeZoom ?? 0.18,
      'minimum DOM node zoom',
    )
    this.maximumEdgeLabelCount = this.nonnegativeInteger(
      configuration.maximumEdgeLabelCount ?? 500,
      'maximum edge label count',
    )
    this.nodeBackend = new FdGraphDOMRenderingBackend({
      ...(configuration.createNodeContent
        ? { createNodeContent: configuration.createNodeContent }
        : {}),
      rendersEdgePaths: false,
      rendersEdgeLabels: true,
    })
    this.fallbackBackend = new FdGraphDOMRenderingBackend({
      ...(configuration.createNodeContent
        ? { createNodeContent: configuration.createNodeContent }
        : {}),
    })
  }

  mount(surface: FdGraphRenderingSurface): void {
    if (this.surface === surface) return
    this.unmount()
    this.surface = surface
    this.canvas = this.makeCanvas()
    surface.viewport.append(this.canvas)
    this.colorProbe = document.createElement('span')
    this.colorProbe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none'
    surface.viewport.append(this.colorProbe)
    if (this.initializeContext()) this.nodeBackend.mount(surface)
    else this.activateFallback()
  }

  render(frame: FdGraphRenderFrame): void {
    this.latestFrame = frame
    if (this.usingFallback || !this.context || !this.programs || !this.buffers) {
      this.fallbackBackend.render(frame)
      return
    }
    const drawsDOMNodes =
      frame.nodes.length <= this.maximumDOMNodeCount &&
      frame.viewport.transform.zoom >= this.minimumDOMNodeZoom
    const labelEdges =
      frame.edges.length <= this.maximumEdgeLabelCount
        ? frame.edges
        : frame.edges.filter(({ focused, hovered, selected }) => focused || hovered || selected)
    this.nodeBackend.render({
      ...frame,
      presentationRevision: frame.presentationRevision * 2 + (drawsDOMNodes ? 0 : 1),
      nodes: drawsDOMNodes ? frame.nodes : [],
      edges: labelEdges,
    })
    const geometryRevision = `${frame.snapshotRevision}:${frame.presentationRevision}`
    if (geometryRevision !== this.geometryRevision) {
      this.geometryRevision = geometryRevision
      this.uploadGeometry(frame)
    }
    this.draw(frame, !drawsDOMNodes)
  }

  unmount(): void {
    this.nodeBackend.unmount()
    this.fallbackBackend.unmount()
    this.releaseContext()
    this.canvas.remove()
    this.colorProbe?.remove()
    this.colorProbe = undefined
    this.surface = undefined
    this.latestFrame = undefined
    this.geometryRevision = ''
    this.usingFallback = false
    this.colorCache.clear()
  }

  private makeCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.className = 'graph-gpu-layer'
    canvas.setAttribute('part', 'gpu-layer')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    return canvas
  }

  private initializeContext(): boolean {
    const context = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false,
    })
    if (!context) return false
    const edge = this.makeProgram(context, edgeVertexShader, edgeFragmentShader)
    const node = this.makeProgram(context, nodeVertexShader, nodeFragmentShader)
    const edgeBuffer = context.createBuffer()
    const nodeBuffer = context.createBuffer()
    if (!edge || !node || !edgeBuffer || !nodeBuffer) {
      if (edge) context.deleteProgram(edge)
      if (node) context.deleteProgram(node)
      if (edgeBuffer) context.deleteBuffer(edgeBuffer)
      if (nodeBuffer) context.deleteBuffer(nodeBuffer)
      context.getExtension('WEBGL_lose_context')?.loseContext()
      return false
    }
    context.disable(context.DEPTH_TEST)
    context.enable(context.BLEND)
    context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA)
    this.context = context
    this.programs = { edge, node }
    this.buffers = { edge: edgeBuffer, node: nodeBuffer }
    this.usingFallback = false
    return true
  }

  private makeProgram(
    context: WebGL2RenderingContext,
    vertexSource: string,
    fragmentSource: string,
  ): WebGLProgram | undefined {
    const vertex = this.makeShader(context, context.VERTEX_SHADER, vertexSource)
    const fragment = this.makeShader(context, context.FRAGMENT_SHADER, fragmentSource)
    if (!vertex || !fragment) {
      if (vertex) context.deleteShader(vertex)
      if (fragment) context.deleteShader(fragment)
      return undefined
    }
    const program = context.createProgram()
    if (!program) {
      context.deleteShader(vertex)
      context.deleteShader(fragment)
      return undefined
    }
    context.attachShader(program, vertex)
    context.attachShader(program, fragment)
    context.linkProgram(program)
    context.deleteShader(vertex)
    context.deleteShader(fragment)
    if (context.getProgramParameter(program, context.LINK_STATUS)) return program
    context.deleteProgram(program)
    return undefined
  }

  private makeShader(
    context: WebGL2RenderingContext,
    type: number,
    source: string,
  ): WebGLShader | undefined {
    const shader = context.createShader(type)
    if (!shader) return undefined
    context.shaderSource(shader, source)
    context.compileShader(shader)
    return shader
  }

  private uploadGeometry(frame: FdGraphRenderFrame): void {
    const context = this.context
    const buffers = this.buffers
    if (!context || !buffers) return
    this.colorCache.clear()
    const edgeData = new Float32Array(frame.edges.length * edgeStride)
    const nodeData = new Float32Array(frame.nodes.length * nodeStride)
    const defaultEdge = this.cssColor('--fd-canvas-edge-color', '#aeb5af')
    const focus = this.cssColor('--fd-graph-focus-color', '#6d9ea5')
    const defaultFill = this.cssColor('--fd-canvas-node-surface-color', '#ffffff')
    const defaultStroke = this.cssColor('--fd-canvas-node-border-color', '#d7dcd8')
    const accent = this.cssColor('--fd-canvas-accent-color', '#6d9ea5')
    let offset = 0
    for (const rendered of frame.edges) {
      const color =
        rendered.focused || rendered.selected
          ? rendered.focused
            ? focus
            : accent
          : this.color(rendered.edge.style?.color, defaultEdge)
      edgeData.set(
        [
          rendered.source.x,
          rendered.source.y,
          rendered.target.x,
          rendered.target.y,
          ...this.premultiplied(color),
          rendered.edge.style?.width ?? 2,
          rendered.edge.style?.dashed ? 1 : 0,
        ],
        offset,
      )
      offset += edgeStride
    }
    offset = 0
    for (const rendered of frame.nodes) {
      const fill = this.color(rendered.node.style?.fill, defaultFill)
      const stroke =
        rendered.focused || rendered.selected
          ? this.color(rendered.node.style?.accent, rendered.focused ? focus : accent)
          : this.color(rendered.node.style?.stroke, defaultStroke)
      nodeData.set(
        [
          rendered.frame.x,
          rendered.frame.y,
          rendered.frame.width,
          rendered.frame.height,
          ...this.premultiplied(fill),
          ...this.premultiplied(stroke),
        ],
        offset,
      )
      offset += nodeStride
    }
    context.bindBuffer(context.ARRAY_BUFFER, buffers.edge)
    context.bufferData(context.ARRAY_BUFFER, edgeData, context.DYNAMIC_DRAW)
    context.bindBuffer(context.ARRAY_BUFFER, buffers.node)
    context.bufferData(context.ARRAY_BUFFER, nodeData, context.DYNAMIC_DRAW)
    this.edgeCount = frame.edges.length
    this.nodeCount = frame.nodes.length
  }

  private draw(frame: FdGraphRenderFrame, drawsNodes: boolean): void {
    const context = this.context
    const programs = this.programs
    const buffers = this.buffers
    if (!context || !programs || !buffers) return
    const width = Math.max(Math.ceil(frame.viewport.size.width * frame.pixelRatio), 1)
    const height = Math.max(Math.ceil(frame.viewport.size.height * frame.pixelRatio), 1)
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height
    context.viewport(0, 0, width, height)
    context.clearColor(0, 0, 0, 0)
    context.clear(context.COLOR_BUFFER_BIT)
    const worldOrigin = frame.viewport.visibleWorldRect
    const viewportOrigin = frame.viewport.transform.applyPoint(worldOrigin)
    const uniforms = {
      worldOrigin: [worldOrigin.x, worldOrigin.y] as const,
      viewportOrigin: [viewportOrigin.x, viewportOrigin.y] as const,
      viewportSize: [frame.viewport.size.width, frame.viewport.size.height] as const,
      zoom: frame.viewport.transform.zoom,
    }
    if (this.edgeCount > 0) {
      context.useProgram(programs.edge)
      this.setCommonUniforms(context, programs.edge, uniforms)
      const segmentCount = this.edgeSegmentCount(frame)
      context.uniform1f(context.getUniformLocation(programs.edge, 'segmentCount'), segmentCount)
      context.bindBuffer(context.ARRAY_BUFFER, buffers.edge)
      this.configureAttribute(context, 0, 2, edgeStride, 0)
      this.configureAttribute(context, 1, 2, edgeStride, 2)
      this.configureAttribute(context, 2, 4, edgeStride, 4)
      this.configureAttribute(context, 3, 1, edgeStride, 8)
      this.configureAttribute(context, 4, 1, edgeStride, 9)
      context.drawArraysInstanced(context.TRIANGLES, 0, segmentCount * 6, this.edgeCount)
    }
    if (drawsNodes && this.nodeCount > 0) {
      context.useProgram(programs.node)
      this.setCommonUniforms(context, programs.node, uniforms)
      context.bindBuffer(context.ARRAY_BUFFER, buffers.node)
      this.configureAttribute(context, 0, 4, nodeStride, 0)
      this.configureAttribute(context, 1, 4, nodeStride, 4)
      this.configureAttribute(context, 2, 4, nodeStride, 8)
      context.drawArraysInstanced(context.TRIANGLES, 0, 6, this.nodeCount)
    }
  }

  private edgeSegmentCount(frame: FdGraphRenderFrame): number {
    if (frame.edges.length > 50_000 || frame.viewport.transform.zoom < 0.12) return 4
    if (frame.edges.length > 10_000 || frame.viewport.transform.zoom < 0.35) return 8
    return 16
  }

  private configureAttribute(
    context: WebGL2RenderingContext,
    location: number,
    size: number,
    stride: number,
    offset: number,
  ): void {
    context.enableVertexAttribArray(location)
    context.vertexAttribPointer(
      location,
      size,
      context.FLOAT,
      false,
      stride * Float32Array.BYTES_PER_ELEMENT,
      offset * Float32Array.BYTES_PER_ELEMENT,
    )
    context.vertexAttribDivisor(location, 1)
  }

  private setCommonUniforms(
    context: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: {
      readonly worldOrigin: readonly [number, number]
      readonly viewportOrigin: readonly [number, number]
      readonly viewportSize: readonly [number, number]
      readonly zoom: number
    },
  ): void {
    context.uniform2f(
      context.getUniformLocation(program, 'worldOrigin'),
      uniforms.worldOrigin[0],
      uniforms.worldOrigin[1],
    )
    context.uniform2f(
      context.getUniformLocation(program, 'viewportOrigin'),
      uniforms.viewportOrigin[0],
      uniforms.viewportOrigin[1],
    )
    context.uniform2f(
      context.getUniformLocation(program, 'viewportSize'),
      uniforms.viewportSize[0],
      uniforms.viewportSize[1],
    )
    context.uniform1f(context.getUniformLocation(program, 'zoom'), uniforms.zoom)
  }

  private cssColor(property: string, fallback: string): FdRGBA {
    const source = this.surface
      ? getComputedStyle(this.surface.viewport).getPropertyValue(property)
      : ''
    return this.color(source.trim() || fallback, [0, 0, 0, 1])
  }

  private color(value: string | undefined, fallback: FdRGBA): FdRGBA {
    const probe = this.colorProbe
    if (!value || !probe) return fallback
    const cached = this.colorCache.get(value)
    if (cached) return cached
    probe.style.color = ''
    probe.style.color = value
    if (!probe.style.color) return fallback
    const resolved = getComputedStyle(probe).color
    const values = resolved.match(/[\d.]+/g)?.map(Number)
    if (!values || values.length < 3) return fallback
    const [red = 0, green = 0, blue = 0, alpha = 1] = values
    const color: FdRGBA = resolved.startsWith('color(srgb')
      ? [red, green, blue, alpha]
      : [red / 255, green / 255, blue / 255, alpha]
    this.colorCache.set(value, color)
    return color
  }

  private premultiplied(color: FdRGBA): FdRGBA {
    return [color[0] * color[3], color[1] * color[3], color[2] * color[3], color[3]]
  }

  private activateFallback(): void {
    const surface = this.surface
    if (!surface) return
    this.nodeBackend.unmount()
    this.fallbackBackend.mount(surface)
    this.usingFallback = true
    if (this.latestFrame) this.fallbackBackend.render(this.latestFrame)
  }

  private releaseContext(): void {
    const context = this.context
    if (!context) return
    if (this.programs) {
      context.deleteProgram(this.programs.edge)
      context.deleteProgram(this.programs.node)
    }
    if (this.buffers) {
      context.deleteBuffer(this.buffers.edge)
      context.deleteBuffer(this.buffers.node)
    }
    this.programs = undefined
    this.buffers = undefined
    this.context = undefined
    this.edgeCount = 0
    this.nodeCount = 0
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    context.getExtension('WEBGL_lose_context')?.loseContext()
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault()
    this.context = undefined
    this.programs = undefined
    this.buffers = undefined
    this.activateFallback()
  }

  private handleContextRestored = (): void => {
    const surface = this.surface
    if (!surface || !this.initializeContext()) return
    this.fallbackBackend.unmount()
    this.nodeBackend.mount(surface)
    this.geometryRevision = ''
    if (this.latestFrame) this.render(this.latestFrame)
  }

  private nonnegative(value: number, name: string): number {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must not be negative`)
    return value
  }

  private nonnegativeInteger(value: number, name: string): number {
    if (!Number.isInteger(value) || value < 0)
      throw new RangeError(`${name} must be a nonnegative integer`)
    return value
  }
}
