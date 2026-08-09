# Canvas performance benchmark

This opt-in headed benchmark measures the production graph canvas on a real display. It is kept
outside the default test and CI commands because refresh-rate measurements from a headless runner
do not represent interactive desktop performance.

Run the complete node-count ladder on the main display:

```sh
pnpm benchmark:canvas
```

Limit the run or retain structured results when investigating a regression:

```sh
pnpm benchmark:canvas -- \
  --counts=10000,50000,100000 \
  --scenarios=pan,zoom,drag,click \
  --frame-updates=intent \
  --duration=2000 \
  --output=/tmp/flowing-day-canvas-benchmark.json
```

The runner maximizes Chromium on the main display, calibrates the observed refresh interval before
every scenario, and reports frame-time percentiles, synchronous input-handler cost, frame delivery,
dropped frames, DOM size, and JavaScript heap use after forced garbage collection. `automatic` is
the default rendering backend; use `--backend=dom` or
`--backend=webgl2` only for controlled comparisons.

The default frame update mode is `intent`. Use `--frame-updates=local` to include the package-owned
local snapshot commit in drag measurements.
