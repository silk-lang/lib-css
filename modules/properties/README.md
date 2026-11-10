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
  It covers 280 properties: the SVG and text properties first, then the box properties (position
  and insets, sizes, margin, padding, border, radius, flex, grid, gap, alignment, background,
  shadow, breaks). `css-style` re-exports it as `properties` and limits itself to the first 172,
  the ones it parses today.
