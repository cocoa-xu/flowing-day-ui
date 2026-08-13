import { readFile } from 'node:fs/promises'

const output = await readFile(
  new URL('../dist/components/graph-canvas/fd-graph-canvas-element.js', import.meta.url),
  'utf8',
)
const engine = await readFile(
  new URL('../dist/components/graph-canvas/fd-graph-canvas.js', import.meta.url),
  'utf8',
)

if (!output.includes('from "./fd-graph-canvas.js"')) {
  throw new Error('built graph canvas does not retain its engine registration dependency')
}

if (!engine.includes('import "../canvas/fd-canvas.js"')) {
  throw new Error('built graph canvas does not retain its canvas registration dependency')
}
