import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { Browser, Builder } from 'selenium-webdriver'
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
const browserName = argumentsByName.get('browser') ?? 'chromium'
const windowBounds = parseWindowBounds(argumentsByName.get('window'))
const output = argumentsByName.get('output')
if (counts.length === 0) throw new Error('at least one positive node count is required')
if (scenarios.length === 0) throw new Error('at least one supported scenario is required')
if (!['automatic', 'webgl2', 'dom'].includes(backend)) throw new Error('unsupported backend')
if (!['intent', 'local'].includes(frameUpdates)) throw new Error('unsupported frame update mode')
if (!['chromium', 'safari'].includes(browserName)) throw new Error('unsupported browser')
const port = await availablePort()
const server = await createViteServer({
  root: import.meta.dirname,
  server: { host: '127.0.0.1', port },
  logLevel: 'error',
})
await server.listen()

const session = browserName === 'safari' ? await openSafariSession() : await openChromiumSession()
const results = []

try {
  for (const count of counts) {
    const url = `http://127.0.0.1:${port}/?nodes=${count}&backend=${backend}&frameUpdates=${frameUpdates}`
    await session.goto(url)
    await session.ready()
    const metadata = await session.metadata()
    for (const scenario of scenarios) {
      const metrics = await session.measure(scenario, duration)
      const diagnostics = await session.diagnostics()
      const result = {
        ...metadata,
        browser: browserName,
        scenario,
        ...metrics,
        ...diagnostics,
      }
      results.push(result)
      process.stdout.write(
        `${String(count).padStart(6)} ${scenario.padEnd(5)} ${result.backend.padEnd(7)} ` +
          `${(result.refreshInterval || 0).toFixed(2)}ms refresh ` +
          `${(result.p95 || 0).toFixed(2)}ms p95 ` +
          `${(result.p99 || 0).toFixed(2)}ms p99 ` +
          `${(result.maximum || 0).toFixed(2)}ms max ` +
          `${(result.inputP99 || 0).toFixed(2)}ms input p99 ` +
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
  await session.close()
  await server.close()
}

async function openChromiumSession() {
  const browser = await chromium.launch({ headless: false, args: ['--window-position=0,0'] })
  const page = await browser.newPage({ viewport: null })
  const devtools = await page.context().newCDPSession(page)
  await devtools.send('Performance.enable')
  const { windowId } = await devtools.send('Browser.getWindowForTarget')
  await devtools.send('Browser.setWindowBounds', {
    windowId,
    bounds: windowBounds ?? { windowState: 'maximized' },
  })
  return {
    goto: (url) => page.goto(url, { waitUntil: 'networkidle' }),
    ready: () => page.evaluate(() => window.fdCanvasBenchmark.ready),
    metadata: () =>
      page.evaluate(async () => ({
        nodeCount: window.fdCanvasBenchmark.nodeCount,
        edgeCount: window.fdCanvasBenchmark.edgeCount,
        buildDuration: window.fdCanvasBenchmark.buildDuration,
        initializationDuration: await window.fdCanvasBenchmark.initializationDuration,
        backend: window.fdCanvasBenchmark.backend,
        frameUpdates: window.fdCanvasBenchmark.frameUpdates,
        devicePixelRatio: window.devicePixelRatio,
        screen: { width: window.screen.width, height: window.screen.height },
        hardwareConcurrency: navigator.hardwareConcurrency,
      })),
    measure: (scenario, measurementDuration) =>
      page.evaluate(
        ([name, duration]) => window.fdCanvasBenchmark.measure(name, duration),
        [scenario, measurementDuration],
      ),
    diagnostics: async () => {
      await devtools.send('HeapProfiler.collectGarbage')
      const performanceMetrics = await devtools.send('Performance.getMetrics')
      const heapUsed = performanceMetrics.metrics.find(
        ({ name }) => name === 'JSHeapUsedSize',
      )?.value
      const diagnostics = await page.evaluate(benchmarkDOMDiagnostics)
      return {
        ...diagnostics,
        ...(heapUsed === undefined ? {} : { heapUsedMB: heapUsed / 1_048_576 }),
      }
    },
    close: () => browser.close(),
  }
}

async function openSafariSession() {
  const driver = await new Builder().forBrowser(Browser.SAFARI).build()
  if (windowBounds) await driver.manage().window().setRect(windowBounds)
  else await driver.manage().window().maximize()
  const executeAsync = async (script, ...args) => {
    const result = await driver.executeAsyncScript(script, ...args)
    if (result && typeof result === 'object' && '__error' in result) {
      throw new Error(result.__error)
    }
    return result
  }
  return {
    goto: (url) => driver.get(url),
    ready: () =>
      executeAsync(`
        const done = arguments[arguments.length - 1]
        const deadline = performance.now() + 20_000
        const awaitBenchmark = () => {
          if (window.fdCanvasBenchmark) {
            window.fdCanvasBenchmark.ready.then(
              () => done(true),
              (error) => done({ __error: String(error) }),
            )
            return
          }
          if (performance.now() >= deadline) {
            done({ __error: 'Canvas benchmark did not initialize within 20 seconds' })
            return
          }
          setTimeout(awaitBenchmark, 16)
        }
        awaitBenchmark()
      `),
    metadata: () =>
      executeAsync(`
        const done = arguments[arguments.length - 1]
        Promise.resolve(window.fdCanvasBenchmark.initializationDuration).then(
          (initializationDuration) => done({
            nodeCount: window.fdCanvasBenchmark.nodeCount,
            edgeCount: window.fdCanvasBenchmark.edgeCount,
            buildDuration: window.fdCanvasBenchmark.buildDuration,
            initializationDuration,
            backend: window.fdCanvasBenchmark.backend,
            frameUpdates: window.fdCanvasBenchmark.frameUpdates,
            devicePixelRatio: window.devicePixelRatio,
            screen: { width: window.screen.width, height: window.screen.height },
            hardwareConcurrency: navigator.hardwareConcurrency,
          }),
          (error) => done({ __error: String(error) }),
        )
      `),
    measure: (scenario, measurementDuration) =>
      executeAsync(
        `
          const done = arguments[arguments.length - 1]
          window.fdCanvasBenchmark.measure(arguments[0], arguments[1]).then(
            done,
            (error) => done({ __error: String(error) }),
          )
        `,
        scenario,
        measurementDuration,
      ),
    diagnostics: () =>
      driver.executeScript(`
        const visit = (root) => {
          let elementCount = root.querySelectorAll('*').length
          let renderedNodeCount = root.querySelectorAll('.graph-node').length
          for (const element of root.querySelectorAll('*')) {
            if (!element.shadowRoot) continue
            const nested = visit(element.shadowRoot)
            elementCount += nested.elementCount
            renderedNodeCount += nested.renderedNodeCount
          }
          return { elementCount, renderedNodeCount }
        }
        const result = visit(document)
        const graph = document.querySelector('fd-graph-canvas')
        const engine = graph?.shadowRoot?.querySelector('fd-graph-canvas-engine')
        return {
          domNodeCount: result.elementCount,
          renderedDOMNodeCount: result.renderedNodeCount,
          viewportZoom: engine?.viewport?.transform?.zoom
            ?? graph?.session?.viewport?.transform?.zoom,
          renderWorldRect: engine?.renderWorldRect,
        }
      `),
    close: () => driver.quit(),
  }
}

function benchmarkDOMDiagnostics() {
  const visit = (root) => {
    let elementCount = root.querySelectorAll('*').length
    let renderedNodeCount = root.querySelectorAll('.graph-node').length
    for (const element of root.querySelectorAll('*')) {
      if (!element.shadowRoot) continue
      const nested = visit(element.shadowRoot)
      elementCount += nested.elementCount
      renderedNodeCount += nested.renderedNodeCount
    }
    return { elementCount, renderedNodeCount }
  }
  const result = visit(document)
  const graph = document.querySelector('fd-graph-canvas')
  const engine = graph?.shadowRoot?.querySelector('fd-graph-canvas-engine')
  return {
    domNodeCount: result.elementCount,
    renderedDOMNodeCount: result.renderedNodeCount,
    viewportZoom: engine?.viewport?.transform?.zoom ?? graph?.session?.viewport?.transform?.zoom,
    renderWorldRect: engine?.renderWorldRect,
  }
}

function parseWindowBounds(value) {
  if (value === undefined) return undefined
  const [left, top, width, height] = value.split(',').map(Number)
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error('window must use left,top,width,height with a positive size')
  }
  return { x: left, y: top, width, height }
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
