# lib-css

CSS libraries for Silk, extracted from [silk-lang/nonstd](https://github.com/silk-lang/nonstd/tree/7d6c3693a9ad1fec24127985626ab4224f9f1995/css).
This repository starts from that commit's CSS snapshot; earlier implementation history remains in nonstd.

| Package | Path | Purpose |
| --- | --- | --- |
| `css-layout` | [modules/layout](modules/layout) | Block, inline, flex and grid layout |
| `css-style` | [modules/style](modules/style) | Parsing, selectors, cascade, CSSOM and Typed OM |
| `css-properties` | [modules/properties](modules/properties) | Value types shared by the other packages |

Library packages live under `modules/`; package names, exports and fixtures are preserved. `css-style` uses Silk's Git dependency support to fetch `graphics-geometry` from [lib-graphics](https://github.com/silk-lang/lib-graphics); no sibling checkout is required. `css-layout` has no package dependencies. Keep the graphics revision in the manifest aligned with `lib-fonts` and other consumers: Silk rejects duplicate physical copies of a named package.

[`layout-test-harness/`](layout-test-harness) is internal development tooling for layout tests,
conformance checks and benchmarks, not a library or supported consumer CLI. Silk builds it as
the executable `css-layout-test-harness`; applications should depend on the libraries above.

## Build and test

Install [Silk](https://github.com/silk-lang/silk) and LLVM 22, then run from this repository:

```sh
silk use
silk check --workspace
silk test --manifest-path modules/layout/silk.toml --root src/tests.silk
silk test --manifest-path modules/style/silk.toml --root src/tests.silk
silk build --package css-layout-test-harness
```

On macOS, set `SDKROOT` to `xcrun --sdk macosx --show-sdk-path` before running tests. Set `SILK_CLANG` if LLVM's Clang is not your default compiler.

The workspace pins Silk `0.1.0-dev.74+205aea3f5b2e`. Development automation is written in Silk under `src/`; `silk task` lists the commands. CI runs `silk task ci`. The full layout gate is `silk task check`; differential browser checks use `silk task chrome-diff --cli PATH`. Native tools such as curl, tar, Cargo, CMake and Chrome remain external executables, not interpreter dependencies.
Native automation supports macOS and GNU/Linux. Windows managed-child-process support is blocked by [Silk #3034](https://github.com/silk-lang/silk/issues/3034); affected tasks report that capability as unavailable, with no legacy interpreter fallback. Specification and encoding maintenance and fixture-font generation remain available. See [layout limitations](modules/layout/LIMITATIONS.md).

Specification maintenance uses `silk task fetch-layout-specs`, `silk task fetch-style-specs` and `silk task fetch-specs`. Updates are explicit (`--update`); the root and style baselines support `--offline`. Run `silk task generate-encodings` offline against the locked cache, add `--fetch` to hydrate missing immutable inputs, or use `--update REVISION` to select a new upstream commit. No SVG library is included.

See the package READMEs for APIs, conformance boundaries, optional tooling and licensing.
