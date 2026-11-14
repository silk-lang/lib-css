# css-properties

CSS properties and their value types, in one place. `css-layout`, `css-style` and their clients
import these instead of defining their own.

## What it covers

- **Computed values** (`computed`): the typed values layout and paint read once the cascade has run
  and units are resolved. `Dimension` holds pixels and a percentage fraction (0.5 is 50%), `Edges`
  holds four of them, and each keyword property has its own enum (`Display`, `FlexDirection`,
  `Align`, `Overflow`, `Position` and the rest).

- **The property catalog** (`catalog`): one `Property` enum with each property's name, index,
  inheritance, initial value and shorthand expansion, taken from the pinned specifications.
  It covers 288 properties: the SVG and text properties first, then the box properties (position
  and insets, sizes, margin, padding, border, radius, flex, grid, gap, alignment, background,
  shadow, breaks), the two that have no standard name, `-silk-selection-color` and
  `-silk-placeholder-color`, and last `transition` and its longhands. `shorthands` does not
  expand `transition`; its consumer reads the comma lists. `css-style` re-exports it as `properties` and cascades all of it: the
  first 172 with their own grammars, the box properties by shape.

- **Paint and text** (also in `computed`): `Paint` (background `Fill`, border, radii, `BoxShadow`,
  opacity, object fit) and `Text` (font, colors, decoration and the inherited layout text
  properties), with their `initial()` values.

- **Values as written** (`values`): plain data a style patch can carry and an inspector can
  print. `Value` follows CSS Typed OM: a keyword, a number with a unit, a color, a math tree for
  `calc()`, a function, a sequence of components, or CSS text for anything without a typed form.
  A percentage is written as in CSS, so `percent(50.0)` is `50%`. `Declaration` is a property, a
  value and the `!important` flag, as in CSSOM. `write` and `writeDeclaration` serialize the way
  CSSOM does. css-style's `written` module parses CSS text into these values.

- **Keywords** (`keywords`, `keyword_enums`): one `Keyword` enum with CSS spellings and lookup,
  and for each computed keyword enum a pair of functions to and from `Keyword`. css-style's value
  keywords are this same enum, so a keyword read by css-style and one in a `Declaration` compare
  directly. The computed enums include the SVG painting ones (`FillRule`, `LineCap`, `LineJoin`,
  `BlendMode`).

- **Conversion** (`convert`): written to computed against a `Context` (font sizes and viewport),
  and computed back to written. A conversion returns `None` when a value does not fit, which is
  how a client ignores an invalid declaration.

- **Box shorthands** (`shorthands`): `longhand(shorthand, value, target)` gives the value one
  longhand gets from a shorthand's written value, such as `margin-left` from `margin: 1px 2px`,
  with initial values for what the shorthand leaves out. It covers the common forms of the box
  shorthands (`margin`, `padding`, `inset`, the `border` family, `border-radius`, `flex`,
  `flex-flow`, `gap`, the `place-*` trio, the grid lines, and simple `grid`, `grid-template`
  and `background` values). css-style's cascade expands box shorthands with it.

- **Typed constructors** (`declare`): one function per property.

  ```silk
  import properties.declare
  import properties.values { px, percent }

  let patch = [declare.width(percent(50.0)), declare.position(Position.Absolute), declare.marginTop(px(8.0))]
  ```
