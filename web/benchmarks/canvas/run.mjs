import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { createServer as createViteServer } from 'vite'

const argumentsByName = new Map(
  process.argv.slice(2).map((argument) => {
    const [name, value = 'true'] = argument.replace(/^--/, '').split('=', 2)
    return [name, value]
  }),
)
const counts = (argumentsByName.get('counts') ?? '1000,2000,5000,10000,20000,50000,100000')
  .split(',')
  .map(Number)
  .filter((value) => Number.isInteger(value) && value > 0)
const supportedScenarios = new Set(['pan', 'zoom', 'drag', 'click'])
const scenarios = (argumentsByName.get('scenarios') ?? 'pan,zoom,drag,click')
  .split(',')
  .filter((value) => supportedScenarios.has(value))
const duration = Math.max(Number(argumentsByName.get('duration') ?? 2_000), 500)
const backend = argumentsByName.get('backend') ?? 'automatic'
const frameUpdates = argumentsByName.get('frame-updates') ?? 'intent'
const output = argumentsByName.get('output')
if (counts.length === 0) throw new Error('at least one positive node count is required')
if (scenarios.length === 0) throw new Error('at least one supported scenario is required')
if (!['automatic', 'webgl2', 'dom'].includes(backend)) throw new Error('unsupported backend')
if (!['intent', 'local'].includes(frameUpdates)) throw new Error('unsupported frame update mode')
const port = await availablePort()
const server = await createViteServer({
  root: import.meta.dirname,
  server: { host: '127.0.0.1', port },
  logLevel: 'error',
})
await server.listen()

const browser = await chromium.launch({ headless: false, args: ['--window-position=0,0'] })
const page = await browser.newPage({ viewport: null })
const devtools = await page.context().newCDPSession(page)
await devtools.send('Performance.enable')
const { windowId } = await devtools.send('Browser.getWindowForTarget')
await devtools.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'maximized' } })
const results = []

try {
  for (const count of counts) {
    const url = `http://127.0.0.1:${port}/?nodes=${count}&backend=${backend}&frameUpdates=${frameUpdates}`
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate(() => window.fdCanvasBenchmark.ready)
    const metadata = await page.evaluate(async () => ({
      nodeCount: window.fdCanvasBenchmark.nodeCount,
      edgeCount: window.fdCanvasBenchmark.edgeCount,
      buildDuration: window.fdCanvasBenchmark.buildDuration,
      initializationDuration: await window.fdCanvasBenchmark.initializationDuration,
      backend: window.fdCanvasBenchmark.backend,
      frameUpdates: window.fdCanvasBenchmark.frameUpdates,
      devicePixelRatio: window.devicePixelRatio,
      screen: { width: window.screen.width, height: window.screen.height },
      hardwareConcurrency: navigator.hardwareConcurrency,
    }))
    for (const scenario of scenarios) {
      const metrics = await page.evaluate(
        ([name, measurementDuration]) =>
          window.fdCanvasBenchmark.measure(name, measurementDuration),
        [scenario, duration],
      )
      await devtools.send('HeapProfiler.collectGarbage')
      const performanceMetrics = await devtools.send('Performance.getMetrics')
      const heapUsed = performanceMetrics.metrics.find(
        ({ name }) => name === 'JSHeapUsedSize',
      )?.value
      const domNodeCount = await page.evaluate(() => document.getElementsByTagName('*').length)
      const result = {
        ...metadata,
        scenario,
        ...metrics,
        domNodeCount,
        ...(heapUsed === undefined ? {} : { heapUsedMB: heapUsed / 1_048_576 }),
      }
      results.push(result)
      process.stdout.write(
        `${String(count).padStart(6)} ${scenario.padEnd(5)} ${result.backend.padEnd(7)} ` +
          `${(result.refreshInterval || 0).toFixed(2)}ms refresh ` +
          `${(result.p95 || 0).toFixed(2)}ms p95 ` +
          `${(result.inputP95 || 0).toFixed(2)}ms input ` +
          `${((result.frameDelivery || 0) * 100).toFixed(1)}% delivery ` +
          `${result.droppedFrameCount} dropped ` +
          `${(result.heapUsedMB ?? 0).toFixed(1)}MB heap\n`,
      )
    }
  }
  if (output)
    await import('node:fs/promises').then(({ writeFile }) =>
      writeFile(output, JSON.stringify(results, null, 2)),
    )
} finally {
  await browser.close()
  await server.close()
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('failed to allocate benchmark port'))
        return
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}
