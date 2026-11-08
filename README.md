# lib-css

CSS libraries for Silk, extracted from [silk-lang/nonstd](https://github.com/silk-lang/nonstd/tree/7d6c3693a9ad1fec24127985626ab4224f9f1995/css).
The original packages remain in nonstd for now. This repository starts from that commit's CSS snapshot; earlier history remains in nonstd.

| Package | Path | Purpose |
| --- | --- | --- |
| `css-layout` | [css/layout](css/layout) | Block, inline, flex and grid layout |
| `css-style` | [css/style](css/style) | Parsing, selectors, cascade, CSSOM and Typed OM |
| `css-layout-cli` | [css/layout/tools/cli](css/layout/tools/cli) | Native JSON layout adapter |

Package names, exports, fixtures and directory paths are preserved. `css-style` uses Silk's Git dependency support to fetch `graphics-geometry` from nonstd at commit `7d6c3693a9ad1fec24127985626ab4224f9f1995`; no sibling checkout is required. `css-layout` has no package dependencies.

## Build and test

Install [Silk](https://github.com/silk-lang/silk) and LLVM 22, then run from this repository:

```sh
silk use
silk check --workspace
silk test --manifest-path css/layout/silk.toml --root src/tests.silk
silk test --manifest-path css/style/silk.toml --root src/tests.silk
silk build --package css-layout-cli
```

On macOS, set `SDKROOT` to `xcrun --sdk macosx --show-sdk-path` before running tests. Set `SILK_CLANG` if LLVM's Clang is not your default compiler.

The workspace pins Silk `0.1.0-dev.61+91f335268900`. CI invokes Silk directly; ordinary builds and native tests do not use Python. Layout's existing differential, benchmark and specification-maintenance tools are retained, including their optional Python dependencies. The two helpers under `svg/scripts` support CSS's existing specification downloader and encoding-table generator; no SVG library is included.

See the package READMEs for APIs, conformance boundaries, optional tooling and licensing.
