# css-style

CSS parsing, selectors, the cascade, and native CSSOM objects for Silk, from bytes to computed
values. The [SVG renderer](https://github.com/silk-lang/nonstd/tree/main/svg) uses the shared parser and cascade for source documents
and `use` instances. The CSSOM layer reuses those components; it does not require a browser,
WebGPU, or a particular UI tree.

## What it covers

- **Syntax:** decoding stylesheet bytes with the WHATWG encodings, the CSS Syntax 3 tokenizer,
  and rule and declaration parsing with error recovery.
- **Selectors:** Selectors 4 with specificity. Matching runs against any tree that implements
  `ElementTree`, including shadow trees and host-reported interactive states. An optional index
  finds candidate rules by ID, class and name.
- **Cascade:** origins, `!important`, nested layer order, specificity and order, inheritance, and
  custom properties with `var()` substitution (Cascade 5 and Variables 1).
- **Conditions:** `@media` (Media Queries 4, evaluated with three-valued logic), `@supports`,
  and import conditions.
- **Values:** lengths and `calc()` expressions, colours (Color 4, including system colours),
  transforms, font and text values, and filter, masking and shape values, computed into an
  immutable style store.
- **Native CSSOM:** mutable declaration blocks, media lists, stylesheet/rule objects, live rule
  and stylesheet collections, constructed-sheet adoption, inline-style synchronization, and
  read-only computed-style queries.
- **Shared written values:** `written` reads CSS text into the plain `Value` and `Declaration`
  of [css-properties](../properties), for every property in the shared catalog and not only the
  ones with a grammar here: `written.value(b"calc(100% - 8px)")`,
  `written.declarations(b"width: 10px; color: red")`, and `written.fromStyle` for a CSSOM
  declaration block. It reads values by shape and keeps anything without one as CSS text.
- **Box properties in the cascade:** the cascade covers the whole shared catalog. The box
  properties (margin, padding, border, flex, grid, background and the rest) have no grammar
  here yet: a declaration is read by shape, kept as canonical CSS text, and not checked against
  the property's grammar. Box shorthands expand to their longhands through css-properties'
  `shorthands`, and a shorthand value in a form it does not expand is dropped as invalid.
  `written.computedValue(engine, style, property)` reads any computed value back as a written
  `Value`, ready for css-properties' `convert`.

Every stage has explicit limits on input size, storage, nesting and matching work, so hostile
stylesheets fail with a `CssError` instead of running away.

## Example

```silk
import css.tokens { CssError, Limits }
import css.lexer
import css.syntax
import silk.mem.allocator { Allocator, OutOfMemoryError }

/// Counts the `!important` declarations in a style attribute such as "fill: red; stroke: blue !important".
pub effect fn importantCount(style: &[u8]) -> usize
  ! CssError | OutOfMemoryError
  ? &mut Allocator {
  let limits = Limits.make()
  let tokens = run lexer.tokenize(style, &limits)
  let declarations = run syntax.parseDeclarations(&tokens, tokens.all(), &limits)
  let mut count: usize = 0
  let mut i: usize = 0
  while i < declarations.length() {
    if declarations.asSlice()[i].important {
      count = count + 1
    }
    i = i + 1
  }
  return count
}
```

The SVG renderer is the full example of selector matching, the cascade and computed values:
see [`stylesheets.silk`](https://github.com/silk-lang/lib-svg/blob/main/modules/src/stylesheets.silk)
and [`style_tree.silk`](https://github.com/silk-lang/lib-svg/blob/main/modules/src/style_tree.silk).
The SVG renderer imports the package as `svg_css`.

## Native CSSOM

```silk
import css.cssom_declaration { StyleDeclaration }
import css.cssom_error { CssomError }
import css.tokens { CssError, Limits }
import silk.collections.bytes { Bytes }
import silk.mem.allocator { Allocator, OutOfMemoryError }

pub effect fn editStyle() -> Bytes
  ! CssomError | CssError | OutOfMemoryError
  ? &mut Allocator {
  let limits = Limits.make()
  let mut style = run StyleDeclaration.parse(b"opacity: .25; color: red", &limits)
  run style.setProperty(b"opacity", b".75", b"important", &limits)
  return run style.cssText()
}
```

The result is `color: red; opacity: 0.75 !important;`. Invalid property values are ignored;
resource exhaustion is a typed failure rather than an invalid-value fallback.

| Module | Contract |
| --- | --- |
| `cssom_declaration` | Ordered longhands, priorities, shorthand expansion/reconstruction, custom properties, pending substitutions, mutation revisions, read-only protection, and parent-rule identity. |
| `cssom_stylesheet` | Stable sheet-local rule IDs, live `RuleList` handles, insertion/deletion, replacement transactions, namespaces, nested rules, media/supports, font-face, page/margin, keyframes, and layers. Deleted rules remain addressable while the sheet owns them. |
| `cssom_media` | Media-list serialization, indexed access, append/delete semantics, and matching through the shared Media Queries parser. |
| `cssom_document` | Associated/adopted/final stylesheet ordering, same-constructor-document adoption, and alternate stylesheet sets. Hosts supply node identity and tree order. |
| `cssom_inline` | External attribute writes preserve source spelling; effective CSSOM writes serialize the attribute. The host delivers mutation notifications when `setProperty` returns true or a revision changes. |
| `cssom_computed` | A persistent handle reads the current `computed.Engine` through a fresh `Binding`. Host-supplied layout facts resolve applicable lengths, transform matrices, and origins; `layoutComplete` distinguishes missing used-value facts. |
| `cssom_loading` | Fetch-response MIME/quirks checks, stylesheet decoding, and origin-clean state. Transport supplies the final response's MIME essence and CORS classification. |
| `cssom_serialization` | Identifier escaping, quoted strings/URLs, numeric serialization, token-preserving components, and selector serialization. |

`StyleSheet.cssRules()` enforces origin-clean access. `rule`, `ruleMut`, and `rulesFor` are
privileged native host operations, not a security boundary for untrusted scripts. The host
also schedules asynchronous replacement around `beginReplace`/`finishReplace` and handles
Fetch, URL resolution, imported-sheet attachment, and document lifecycle.

The shared value model now validates and expands `animation` before cascade selection; SVG
animation sampling consumes those computed longhands instead of independently layering an
opaque shorthand. `text-decoration` includes thickness and its reset, and dash-array number
values retain their unitless specified form.

## Typed OM and View

These APIs share the existing declaration, value, media-query, color, and geometry stores;
they do not maintain a second cascade or an independent hit-testing tree.

| Module | Contract |
| --- | --- |
| `typed_om` | `StyleValues` owns numeric and unparsed-value arenas. Its `parse`/`parseAll` methods validate through the declaration parser, retain source provenance, and reify supported property values. |
| `typed_om_numeric` | Unit values, dimension/type algebra, compatible-unit conversion, arithmetic/math nodes, sum conversion, equality, and serialization. Handles belong to their originating store. |
| `typed_om_unparsed` | Indexed text/variable-reference segments, shared fallback identity, mutation, and cycle detection during serialization. |
| `typed_om_transform` | Transform components and lists, dimensional validation, mutation, CSS serialization, and DOMMatrix conversion. Percentage transforms require resolved lengths before matrix conversion. |
| `typed_om_color` | RGB, HSL, HWB, Lab, LCH, OKLab, OKLCH, and generic color-space objects with channel validation and shared unclipped color conversion. |
| `typed_om_map` | Live read-only/mutable declaration and inline-attribute maps; typed `set`, list `append`, `delete`, and `clear` update the original declaration rather than a copy. |
| `typed_om_computed` | A persistent computed-style map reads a fresh engine binding. It returns computed values, not the layout-resolved values exposed by legacy CSSOM. |
| `cssom_geometry` | Points, rectangles, quads, matrices, list snapshots, matrix dictionaries, inversion, transformation, serialization, and structured-copy records. |
| `cssom_view` | Bounding rectangles, visibility checks, document/root/body metric forwarding, scroll normalization, and logical scroll alignment. |
| `cssom_view_geometry` | Host-backed box quads and coordinate conversion across transforms, scroll offsets, and browsing-context boundaries. |
| `cssom_view_window` | Host-backed window/screen/visual-viewport measurements, media-query-list changes, ordered viewport/scroll events, scroll request completion/interruption, and window-operation requests. |

Native callers retain the owning stores and provide current style/layout state. Window
operations are requests acknowledged by a real host; these modules do not invent screen,
navigation, visual-viewport, or layout data. The native API uses owned values and borrowed
views rather than exposing JavaScript objects, WebIDL prototypes, or promises.

[`ui/tree`](https://github.com/silk-lang/nonstd/tree/main/ui/tree) provides a `cssom_view` adapter over its actual rendered fragments,
glyph runs, clipping, scroll state, and hit traversal. Smooth scrolling advances through
`FrameInput.time`, preserves fractional offsets, and is interrupted by user input. This is
not an automatic stylesheet-to-`ui/tree.Style` bridge: the native smoke explicitly converts
a typed CSS length before applying the existing tree mutation API.

Some pinned draft sections are explicitly unfinished: Typed OM color stringification,
parts of math-value reification, and browser hit-testing details do not define complete
algorithms. Color serialization/conversion and math extensions are native behavior, not
evidence of conformance to an algorithm the draft does not specify.

### Conformance boundary

This is not a claim of complete browser CSSOM or complete CSS support. Declarations use the
existing property catalog, which remains SVG-oriented: ordinary style blocks do not yet
support general box-model, flex, or grid property families. Page/margin descriptors have
their own grammar. CSSOM selector parsing accepts nesting and pseudo-elements, but the static
tree matcher does not implement nested-parent selector expansion or dynamic browser state.
Relative resource URL resolution and browser host bindings remain outside these modules.

The family APIs above are implemented as native Silk interfaces, not DOM/Window/WebIDL
bindings. The native tree adapter exposes only geometry the renderer actually supports;
general CSS transforms and `content-visibility` cannot be synthesized from absent tree style
state. Hosts must provide real style/layout state; missing state is not replaced with
fabricated browser geometry.

## Specification baseline

`specs.lock.json` pins 159 records: [CSSOM](https://drafts.csswg.org/cssom/),
[CSSOM View](https://drafts.csswg.org/cssom-view/),
[Typed OM](https://drafts.css-houdini.org/css-typed-om-1/), and each draft's direct normative
bibliography. Records retain their bibliography identities even when URLs overlap.
The Silk specification tasks share SHA-256 content-addressed caching and explicit lock updates. Run maintenance commands from the repository root; HTTPS downloads use `curl`, while parsing, validation, hashing, and generation run in Silk.
Cached specification documents live in the ignored `modules/style/.cache/specs` directory.

```sh
silk task fetch-style-specs           # fetch or verify the pinned baseline
silk task fetch-style-specs --offline
silk task fetch-style-specs --update  # explicitly replace the reviewed baseline
```

## Tests

From the repository root:

```sh
silk test --manifest-path modules/style/silk.toml --root src/tests.silk
```

The tests run in this repository's CSS CI workflow using Silk directly. The encoding tables are
generated by `silk task generate-encodings` from pinned WHATWG sources. The default is offline
and verifies every cached input; `--fetch` hydrates missing locked sources, while
`--update REVISION` explicitly selects a lowercase 40-hex upstream commit. License text and
packed-table output are preserved. These tasks are optional maintenance tools, not build steps.

The CSSOM cases exercise exception precedence, invalid-mutation no-ops, shorthand resets,
custom-property source preservation, detached rule identity, live collections, adoption,
descriptor grammars, origin checks, and computed values against real engine builds.
A native executable smoke run also exercised declaration/rule mutation, descriptor
serialization, live lists, inline attributes, and adoption. Browser differential checks
covered selected serialization and inline-mutation cases, not the complete Web Platform Tests.

The family cases also exercise numeric dimensions, mutable unparsed-value graphs,
transform matrices, color conversions, live typed maps, computed-versus-resolved values,
geometry conversion, media-query change ordering, and scroll interruption. The native
integration smoke applies a typed `160px` width to a real tree, observes the `3,2,1` hit
stack, advances smooth scrolling through `87.5px` to `100px`, and checks the child's
resulting `-100px` viewport position. Tree regressions cover per-axis clipping and
UTF-16 caret/range offsets from shaped text.

The browser WebGPU harness also compares the four rendered tree fixtures in RGBA8 and BGRA8,
including fractional wheel scrolling. All eight comparisons passed the existing pixel-error
limits; the scrolled inbox had maximum channel error 8 and mean error approximately 0.0582.
The native macOS window check compiled and presented two frames but stalled waiting for its
third frame event, so it is not counted as a passing native-window readback check.

On macOS, the pinned Silk test runtime needs the real SDK's `alarm` symbol
([silk-lang/silk#2762](https://github.com/silk-lang/silk/issues/2762)); the repository's CI uses:

```sh
SDKROOT="$(xcrun --sdk macosx --show-sdk-path)" silk test --manifest-path modules/style/silk.toml --root src/tests.silk
```

## License

MIT or Apache-2.0.

## Compiled stylesheet foundation

`compile.compile(css, options)` produces a `sheet.Sheet` from CSS bytes. It compiles selectors
and shared typed declarations, preserves custom-property and variable token programs, resolves
nesting, flattens layer order, evaluates `@supports`, and retains media/container/starting
conditions, validated `@property` registrations, and `@font-face`/`@keyframes` metadata. It does not run CSS processors.

`Sheet.encode()` writes the internal `SILKCSS` byte format. `Sheet.decode(bytes, limits)` reads
parsed programs without invoking the CSS tokenizer or selector parser. The format is versioned
and checks the property-catalog fingerprint; it has no cross-version compatibility promise.
Keyframe definitions retain numeric offsets, shared declarations, layer ranks and conditions;
`StyleSheets.keyframes(name)` chooses the active definition in adoption order.
Decoded buffers contain token text but no original stylesheet source. Written values without a
shared typed shape still carry their value text. Subject indexes and conservative invalidation
keys are rebuilt from the decoded selector programs.

The per-element `Resolver` uses the subject index, reads current `ElementTree.state` bits, and
returns cascade candidates and matched rule identities. `Resolver.invalidation` exposes name,
state, structural, descendant, sibling, and ancestor dependencies. Static hosts can omit the
state operation; its default returns no interactive states. `sheet_conditions.update` evaluates
retained media conditions against a host environment and reports whether rule eligibility changed.

`MatchContext.pseudo` selects the originating element's `::before` or `::after` target;
its default `None` matches ordinary elements. Normal rule arms do not match generated targets,
and mixed selector lists retain the specificity of the matching arm. `pseudoStates` supplies
states on the pseudo-element itself, separately from origin states before the `::before` or
`::after` selector. These targets survive binary round trips in format version 5.
The low-level matcher supports these state suffixes, but the stylesheet compiler diagnoses and
drops rules containing them, matching Chromium 151 (which rejects `::before:hover` and
`::before:active`). Origin-state selectors such as `:hover::before` remain supported.

`generated_content.parse(input)` returns keywords or an ordered list of strings and `attr()`
references, including empty strings and string fallbacks. The compiler reports and drops
unsupported content forms such as counters, quote controls, images, and alternative text.
Creating boxes, reading attributes, inheritance, hit testing and accessibility are host work.

`registration` validates the supported `@property` syntax: `*`, `<length>`, `<length-percentage>`,
`<color>`, `<number>`, `<percentage>`, and `<angle>`. `VariableStore.register` installs definitions
before scopes are built; later registrations replace earlier definitions with the same name.
Scopes apply registered initial values, `inherits: false`, syntax checks after substitution,
and invalid-value defaults. Changing registrations requires rebuilding the scopes. The variable
store still retains token values; canonicalizing relative typed values at their defining element
requires host integration.

Hosts resolve pending values, install active registrations, consume animation/font metadata,
and integrate invalidation with their tree. Size container conditions have an opt-in host contract:
`ElementTree.container(node, name, axes, pseudo)` selects the nearest eligible ancestor and
supplies its content-box size and font/writing metrics in `Environment.querySize`/`initial`.
`StyleSheets.resolve` applies those conditions per element; direct resolver users must use
`resolveFiltered` with `sheet_conditions.Filter`. Global condition updates deliberately ignore
container conditions for name-defining rules such as `@keyframes`. Query lists select ancestors
independently, nested conditions must all match, and a missing container never matches `not`.
Hosts that omit the operation have no eligible containers. The compiler still reports container
rules as unsupported until the UI host's containment, query invalidation and relayout are connected.
Diagnostics aggregate dropped features; `Options.strict` rejects a sheet with diagnostics.

Container length units (`cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`) parse, serialize,
participate in dimensional math, and survive compiled-sheet round trips. `dimensions.Context`
provides independent optional container sizes for physical and logical axes, falling back to
the small viewport for missing inputs. Hosts select the appropriate ancestors; logical unit
axes follow the styled element's writing mode. These relative lengths are valid registered
property values, but cannot be typed `@property` initial values because they depend on context.
Units are encoded by CSS spelling, so these additions do not change the binary layout.

`colors.parseProgram` handles nested `color-mix()` with deferred `currentcolor` and system colors.
It supports the standard rectangular and polar spaces, normalized percentages, premultiplied
alpha, hue interpolation methods, and missing components. Standalone sheet color expressions
are encoded as bounded programs, and native color/paint values use the same evaluator.
Contextual mixes inside compound text/effect values still need integration.

The fixture tests cover Tailwind 4.3.5 and handwritten CSS, binary round trips, malformed data,
state matching, layer precedence, nesting, and condition changes. They do not establish rendering
parity with Chromium.

`adopted.StyleSheets` owns compiled sheets in a root's adoption order. Replacing
an id retains its position; removing a sheet rebuilds first-appearance layer
order from the surviving sheets. Matching combines indexes from each sheet,
resolves named layers across sheets, reads importance per declaration, and
includes caller-supplied inline priorities. Its ordered candidates reference
the original compiled declarations, and matched rules retain sheet ids.
Condition updates report whether eligibility changed. It performs no stylesheet
text parsing; value computation remains the host's responsibility.
