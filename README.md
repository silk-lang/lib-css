# lib-css

CSS libraries for Silk, extracted from [silk-lang/nonstd](https://github.com/silk-lang/nonstd/tree/7d6c3693a9ad1fec24127985626ab4224f9f1995/css).
This repository starts from that commit's CSS snapshot; earlier implementation history remains in nonstd.

| Package | Path | Purpose |
| --- | --- | --- |
| `css-layout` | [css/layout](css/layout) | Block, inline, flex and grid layout |
| `css-style` | [css/style](css/style) | Parsing, selectors, cascade, CSSOM and Typed OM |

Library package names, exports, fixtures and directory paths are preserved. `css-style` uses Silk's Git dependency support to fetch `graphics-geometry` from [lib-graphics](https://github.com/silk-lang/lib-graphics); no sibling checkout is required. `css-layout` has no package dependencies. Keep the graphics revision in the manifest aligned with `lib-fonts` and other consumers: Silk rejects duplicate physical copies of a named package.

[`layout-test-harness/`](layout-test-harness) is internal development tooling for layout tests,
conformance checks and benchmarks, not a library or supported consumer CLI. Silk builds it as
the executable `css-layout-test-harness`; applications should depend on the libraries above.

## Build and test

Install [Silk](https://github.com/silk-lang/silk) and LLVM 22, then run from this repository:

```sh
silk use
silk check --workspace
silk test --manifest-path css/layout/silk.toml --root src/tests.silk
silk test --manifest-path css/style/silk.toml --root src/tests.silk
silk build --package css-layout-test-harness
```

On macOS, set `SDKROOT` to `xcrun --sdk macosx --show-sdk-path` before running tests. Set `SILK_CLANG` if LLVM's Clang is not your default compiler.

The workspace pins Silk `0.1.0-dev.63+657e3c900f65`. CI invokes Silk directly; ordinary builds and native tests do not use Python. Layout's existing differential, benchmark and specification-maintenance tools are retained, including their optional Python dependencies. The two helpers under `svg/scripts` support CSS's existing specification downloader and encoding-table generator; no SVG library is included.

See the package READMEs for APIs, conformance boundaries, optional tooling and licensing.
